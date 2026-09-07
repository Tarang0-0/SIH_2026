"""Live operator control-room views.

The operator view correlates a verified live train status with verified live
station boards on the train's downstream route. It intentionally does not
claim that a train is blocked by another train: a network occupancy or
dispatch feed is not configured, so the response calls these records
"potential exposure" and reports the live sources used.
"""

from __future__ import annotations

import asyncio
import datetime as dt
from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Query

from api.routers import eta as eta_router
from api.routers.eta import resolve_journey_date
from api.services.official_status import (
    LiveStationInvalid,
    LiveStatusInvalid,
    LiveStatusUnavailable,
    fetch_live_station,
    fetch_live_status,
    runtime_route_from_status,
)
from api.services.phase2_dataset import normalize_station_code, parse_delay_minutes
from api.services.network_signals import NetworkSignalsInvalid, NetworkSignalsUnavailable, fetch_network_signals

router = APIRouter(prefix="/api/v1/control-room", tags=["Control Room & Cascade Prevention"])


def _live_network_unavailable():
    raise HTTPException(
        status_code=503,
        detail="Control-room cascade data is unavailable: no live network occupancy provider is configured",
    )


def _journey_date(value: Optional[str]) -> Optional[dt.date]:
    if not value:
        return None
    try:
        return dt.date.fromisoformat(value)
    except ValueError as error:
        raise HTTPException(status_code=422, detail="date must use YYYY-MM-DD format") from error


def _route_for_status(status: Any) -> Optional[dict[str, Any]]:
    route = runtime_route_from_status(status)
    if route and isinstance(route.get("stops"), list):
        return route
    fallback = eta_router.TRAIN_ROUTES_INDEX.get(str(status.train_number).strip())
    return fallback if isinstance(fallback, dict) else None


def _affected_stations(status: Any, route: Optional[dict[str, Any]], limit: int) -> list[dict[str, Any]]:
    if not route:
        return []
    stops = [stop for stop in route.get("stops", []) if isinstance(stop, dict)]
    if not stops:
        return []
    current = normalize_station_code(status.current_station)
    next_station = normalize_station_code(status.next_station)
    index = next((i for i, stop in enumerate(stops) if normalize_station_code(stop.get("code")) == current), None)
    if index is None:
        index = next((i for i, stop in enumerate(stops) if normalize_station_code(stop.get("code")) == next_station), 0)
    return stops[index:index + limit]


def _halt_status(speed_kmh: Optional[float]) -> str:
    if speed_kmh is None:
        return "unknown"
    return "halted" if speed_kmh <= 1 else "moving"


async def _station_board(code: str) -> tuple[str, list[dict[str, Optional[str]]] | Exception]:
    try:
        return code, await fetch_live_station(code, hours=2)
    except (LiveStationInvalid, LiveStatusInvalid, LiveStatusUnavailable) as error:
        return code, error


@router.get("/impact/{train_number}")
async def get_control_room_impact(
    train_number: str,
    date: Optional[str] = Query(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$"),
    lookahead_stations: int = Query(default=4, ge=1, le=8),
):
    """Return trains potentially exposed to a delayed or halted incident train."""
    train_key = str(train_number).strip()
    if not train_key.isdigit():
        raise HTTPException(status_code=422, detail="train_number must contain only digits")
    requested_date = _journey_date(date)
    resolved_date = requested_date or resolve_journey_date(train_key)
    try:
        status = await fetch_live_status(train_key, resolved_date)
    except LiveStatusUnavailable as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except LiveStatusInvalid as error:
        raise HTTPException(status_code=502, detail=str(error)) from error

    route = _route_for_status(status)
    stations = _affected_stations(status, route, lookahead_stations)
    if not stations:
        raise HTTPException(
            status_code=502,
            detail="The live provider did not return a usable downstream route for this train",
        )

    board_results = await asyncio.gather(*(_station_board(normalize_station_code(stop.get("code"))) for stop in stations))
    network_signals = None
    try:
        network_signals = await fetch_network_signals(
            [normalize_station_code(stop.get("code")) for stop in stations],
            train_number=train_key,
            journey_date=resolved_date,
        )
    except (NetworkSignalsInvalid, NetworkSignalsUnavailable):
        network_signals = None
    network_by_station = {
        normalize_station_code(row.get("station_code")): row
        for row in (network_signals or {}).get("signals", [])
        if isinstance(row, dict)
    }
    affected: list[dict[str, Any]] = []
    failed_stations: list[str] = []
    for station_code, board_or_error in board_results:
        if isinstance(board_or_error, Exception):
            failed_stations.append(station_code)
            continue
        for train in board_or_error:
            number = str(train.get("train_number") or "").strip()
            if not number or number == train_key:
                continue
            delay = parse_delay_minutes(train.get("delay_in_arrival"))
            network_row = network_by_station.get(station_code)
            network_reason = ""
            if network_row and network_row.get("occupancy") == "occupied":
                network_reason = " Provider network signal reports an occupied block."
            elif network_row and network_row.get("maintenance_active"):
                network_reason = " Provider network signal reports an active maintenance block."
            affected.append({
                "train_number": number,
                "train_name": train.get("train_name") or number,
                "station_code": station_code,
                "scheduled_arrival": train.get("schedule_arrival"),
                "expected_arrival": train.get("expected_arrival"),
                "delay_minutes": delay,
                "impact_reason": (
                    "Live board places this train in the incident train's downstream station window; "
                    "potential knock-on exposure, not confirmed track blockage."
                    + network_reason
                ),
                "provider": status.provider,
            })

    unique: dict[tuple[str, str], dict[str, Any]] = {}
    for item in affected:
        unique[(item["train_number"], item["station_code"])] = item

    return {
        "incident": {
            "train_number": train_key,
            "journey_date": resolved_date.isoformat(),
            "current_station": normalize_station_code(status.current_station),
            "next_station": normalize_station_code(status.next_station) or None,
            "delay_minutes": status.current_delay_minutes,
            "halt_status": _halt_status(status.speed_kmh),
            "speed_kmh": status.speed_kmh,
            "provider": status.provider,
            "observed_at": status.observed_at.isoformat(),
        },
        "affected_station_codes": [normalize_station_code(stop.get("code")) for stop in stations],
        "affected_trains": list(unique.values()),
        "data_quality": {
            "source": "live train status plus live station boards",
            "provider": status.provider,
            "occupancy_data_available": False,
            "blockage_causality_confirmed": False,
            "failed_station_boards": failed_stations,
            "network_signals_available": bool(network_signals and network_signals.get("signals")),
            "network_signal_provider": (network_signals or {}).get("provider"),
            "network_signal_observed_at": (network_signals or {}).get("observed_at"),
        },
        "network_signals": (network_signals or {}).get("signals", []),
    }


@router.get("/cascade-risk")
@router.get("/congestion")
def get_control_room_cascade_risk():
    """Keep the old aggregate route honest until a network occupancy feed exists."""
    return _live_network_unavailable()
