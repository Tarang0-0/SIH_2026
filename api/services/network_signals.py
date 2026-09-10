"""Optional provider adapter for live railway network signals.

The public train-status providers expose train and station observations, but
not necessarily block occupancy, signal aspects, maintenance blocks, or
sectional restrictions. This adapter accepts an authorised HTTPS provider
through environment configuration without inventing those values locally.

Expected response contract::

    {
      "observed_at": "2026-09-08T10:00:00Z",
      "signals": [{
        "station_code": "NDLS",
        "block_section": "NDLS-CNB-01",
        "occupancy": "occupied",
        "signal_aspect": "caution",
        "maintenance_active": false,
        "speed_restriction_kmh": 60,
        "preceding_train_delay_minutes": 8
      }]
    }

Only provider-backed records are returned to the API and model pipeline.
"""

from __future__ import annotations

import datetime as dt
import os
from typing import Any, Optional
from urllib.parse import urlparse

import httpx

from api.services.http_client import get_http_client
from api.services.phase2_dataset import normalize_station_code


class NetworkSignalsUnavailable(Exception):
    """Raised when no authorised network-signal provider is configured."""


class NetworkSignalsInvalid(Exception):
    """Raised when a network-signal response violates the contract."""


def network_provider_name() -> Optional[str]:
    return os.getenv("RAIL_NETWORK_SIGNALS_PROVIDER", "").strip() or None


def network_provider_configured() -> bool:
    return bool(os.getenv("RAIL_NETWORK_SIGNALS_URL", "").strip())


def _endpoint() -> str:
    configured = os.getenv("RAIL_NETWORK_SIGNALS_URL", "").strip().rstrip("/")
    if not configured:
        raise NetworkSignalsUnavailable("RAIL_NETWORK_SIGNALS_URL is not configured")
    parsed = urlparse(configured)
    allow_local_http = os.getenv("RAIL_NETWORK_SIGNALS_ALLOW_HTTP", "").strip().lower() == "true"
    if parsed.scheme != "https" and not (allow_local_http and parsed.scheme == "http" and parsed.hostname in {"127.0.0.1", "localhost"}):
        raise NetworkSignalsUnavailable("RAIL_NETWORK_SIGNALS_URL must be HTTPS")
    if not parsed.netloc:
        raise NetworkSignalsUnavailable("RAIL_NETWORK_SIGNALS_URL is invalid")
    return configured


def _number(value: Any, field: str, minimum: float, maximum: float) -> Optional[float]:
    if value in (None, ""):
        return None
    try:
        result = float(value)
    except (TypeError, ValueError) as error:
        raise NetworkSignalsInvalid(f"{field} must be numeric") from error
    if not minimum <= result <= maximum:
        raise NetworkSignalsInvalid(f"{field} is outside the accepted range")
    return result


def _normalize_signal(item: Any) -> dict[str, Any]:
    if not isinstance(item, dict):
        raise NetworkSignalsInvalid("network signal entries must be objects")
    station_code = normalize_station_code(item.get("station_code") or item.get("stationCode"))
    if not station_code:
        raise NetworkSignalsInvalid("network signal is missing station_code")
    occupancy = str(item.get("occupancy") or "unknown").strip().lower()
    if occupancy not in {"occupied", "clear", "unknown"}:
        raise NetworkSignalsInvalid("occupancy must be occupied, clear, or unknown")
    return {
        "station_code": station_code,
        "block_section": str(item.get("block_section") or item.get("blockSection") or "").strip() or None,
        "occupancy": occupancy,
        "signal_aspect": str(item.get("signal_aspect") or item.get("signalAspect") or "").strip() or None,
        "maintenance_active": bool(item.get("maintenance_active", item.get("maintenanceActive", False))),
        "speed_restriction_kmh": _number(item.get("speed_restriction_kmh", item.get("speedRestrictionKmh")), "speed_restriction_kmh", 0, 400),
        "preceding_train_delay_minutes": _number(item.get("preceding_train_delay_minutes", item.get("precedingTrainDelayMinutes")), "preceding_train_delay_minutes", -720, 720),
    }


async def fetch_network_signals(
    station_codes: list[str],
    train_number: Optional[str] = None,
    journey_date: Optional[dt.date] = None,
) -> dict[str, Any]:
    endpoint = _endpoint()
    codes = [normalize_station_code(code) for code in station_codes if normalize_station_code(code)]
    if not codes:
        return {"provider": network_provider_name(), "observed_at": None, "signals": []}
    params: dict[str, str] = {"station_codes": ",".join(dict.fromkeys(codes))}
    if train_number:
        params["train_number"] = str(train_number).strip()
    if journey_date:
        params["journey_date"] = journey_date.isoformat()
    headers = {"Accept": "application/json"}
    token = os.getenv("RAIL_NETWORK_SIGNALS_TOKEN", "").strip()
    if token:
        headers["Authorization"] = f"Bearer {token}"
    try:
        client = get_http_client(15.0)
        response = await client.get(endpoint, params=params, headers=headers)
        response.raise_for_status()
        payload = response.json()
    except httpx.HTTPError as error:
        raise NetworkSignalsUnavailable("network-signal provider could not be reached") from error
    except ValueError as error:
        raise NetworkSignalsInvalid("network-signal provider returned invalid JSON") from error
    if not isinstance(payload, dict):
        raise NetworkSignalsInvalid("network-signal response must be an object")
    if payload.get("success") is False:
        raise NetworkSignalsUnavailable(str(payload.get("message") or "network-signal provider rejected the request"))
    raw_signals = payload.get("signals")
    if raw_signals is None and isinstance(payload.get("data"), dict):
        raw_signals = payload["data"].get("signals")
    if not isinstance(raw_signals, list):
        raise NetworkSignalsInvalid("network-signal response has no signals list")
    observed_at = payload.get("observed_at") or payload.get("observedAt")
    if observed_at is not None:
        try:
            parsed = dt.datetime.fromisoformat(str(observed_at).replace("Z", "+00:00"))
            if parsed.tzinfo is None:
                raise ValueError("timezone required")
            observed_at = parsed.astimezone(dt.timezone.utc).isoformat()
        except ValueError as error:
            raise NetworkSignalsInvalid("network-signal observed_at must be timezone-aware ISO-8601") from error
    return {
        "provider": network_provider_name() or "NETWORK_SIGNALS",
        "observed_at": observed_at,
        "signals": [_normalize_signal(item) for item in raw_signals],
    }
