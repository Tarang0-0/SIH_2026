"""Phase 3 movement features and honest next-station labels.

Rows are built from a live snapshot and a later provider-confirmed arrival at
the next halt. The snapshot's own prediction is never used as a label.
"""

from __future__ import annotations

import datetime as dt
import hashlib
import json
import math
from typing import Any, Optional

from api.services.phase4_dataset import PHASE4_WEATHER_FEATURES


PHASE3_FEATURES = [
    "scheduled_minutes_to_next", "current_delay_minutes", "delay_trend_minutes_per_hour",
    "dwell_minutes", "speed_kmh", "has_speed", "distance_to_next_km",
    "remaining_scheduled_minutes", "current_station_sequence", "next_station_sequence",
    "train_number_hash", "segment_id_hash", "is_rescheduled", "rescheduled_by_minutes",
]


def parse_datetime(value: Any) -> Optional[dt.datetime]:
    try:
        parsed = dt.datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=dt.timezone.utc)
    except (TypeError, ValueError):
        return None


def stable_hash(value: Any) -> float:
    digest = hashlib.sha256(str(value or "").encode("utf-8")).hexdigest()
    return int(digest[:12], 16) / float(16**12 - 1)


def haversine_km(lat1: Any, lon1: Any, lat2: Any, lon2: Any) -> Optional[float]:
    try:
        lat1, lon1, lat2, lon2 = map(float, (lat1, lon1, lat2, lon2))
    except (TypeError, ValueError):
        return None
    if not all(math.isfinite(value) for value in (lat1, lon1, lat2, lon2)):
        return None
    radius = 6371.0088
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lon2 - lon1)
    a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    return radius * 2 * math.atan2(math.sqrt(a), math.sqrt(max(0.0, 1 - a)))


def _raw_coordinates(raw: Any) -> tuple[Any, Any]:
    if not isinstance(raw, dict):
        return None, None
    if isinstance(raw.get("currentLocation"), dict):
        raw = raw["currentLocation"]
    coordinates = raw.get("coordinates") if isinstance(raw.get("coordinates"), dict) else raw
    return coordinates.get("lat"), coordinates.get("lng") or coordinates.get("lon")


def _numeric(value: Any) -> Optional[float]:
    try:
        result = float(value)
        return result if math.isfinite(result) else None
    except (TypeError, ValueError):
        return None


def _event_key(event: dict[str, Any]) -> tuple[str, str]:
    return str(event.get("station_code") or "").upper(), str(event.get("provider") or "")


def _event_distance(event: Optional[dict[str, Any]]) -> Optional[float]:
    if not event:
        return None
    raw = event.get("raw_payload")
    if isinstance(raw, str):
        try:
            raw = json.loads(raw)
        except ValueError:
            raw = None
    if isinstance(raw, dict):
        return _numeric(raw.get("distance"))
    return None


def build_phase3_rows(observations: list[dict[str, Any]], events: list[dict[str, Any]], operational: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Build one feature row per snapshot with a later next-station label."""
    by_train_date: dict[tuple[str, str], list[dict[str, Any]]] = {}
    for event in events:
        event = dict(event)
        raw = event.get("raw_payload_json") or event.get("raw_payload") or {}
        if isinstance(raw, str):
            try:
                raw = json.loads(raw)
            except ValueError:
                raw = {}
        event["raw_payload"] = raw
        by_train_date.setdefault((str(event.get("train_number")), str(event.get("journey_date"))), []).append(event)
    op_by_key: dict[tuple[str, str], dict[str, Any]] = {}
    for item in operational:
        op_by_key[(str(item.get("train_number")), str(item.get("journey_date")))] = item

    previous: dict[tuple[str, str], dict[str, Any]] = {}
    rows: list[dict[str, Any]] = []
    for observation in sorted(observations, key=lambda item: str(item.get("observed_at", ""))):
        train = str(observation.get("train_number") or "")
        date = str(observation.get("journey_date") or "")
        observed_at = parse_datetime(observation.get("observed_at"))
        if not train or not date or observed_at is None:
            continue
        key = (train, date)
        current_code = str(observation.get("current_station") or "").upper()
        train_events = by_train_date.get(key, [])
        same_provider = [event for event in train_events if str(event.get("provider")) == str(observation.get("provider"))]
        current_events = [event for event in same_provider if str(event.get("station_code") or "").upper() == current_code]
        current = max(current_events, key=lambda event: str(event.get("observed_at", "")), default=None)
        sequence = _numeric(current.get("sequence")) if current else None
        if sequence is None:
            continue
        next_code = str(observation.get("next_station") or "").upper()
        following = [event for event in same_provider if _numeric(event.get("sequence")) is not None and _numeric(event.get("sequence")) > sequence]
        if next_code:
            matching = [event for event in following if str(event.get("station_code") or "").upper() == next_code]
            next_event = min(matching, key=lambda event: _numeric(event.get("sequence")) or 10**9, default=None)
        else:
            next_event = min(following, key=lambda event: _numeric(event.get("sequence")) or 10**9, default=None)
        if next_event is None:
            continue
        next_code = str(next_event.get("station_code") or "").upper()
        next_arrivals = [
            event for event in same_provider
            if str(event.get("station_code") or "").upper() == next_code
            and event.get("actual_arrival_at")
            and parse_datetime(event.get("actual_arrival_at")) is not None
            and parse_datetime(event.get("actual_arrival_at")) > observed_at
        ]
        next_actual = min(next_arrivals, key=lambda event: parse_datetime(event["actual_arrival_at"]) or dt.datetime.max, default=None)
        if next_actual is None:
            previous[key] = observation
            continue
        actual_arrival = parse_datetime(next_actual.get("actual_arrival_at"))
        if actual_arrival is None:
            continue
        minutes_to_next = (actual_arrival - observed_at).total_seconds() / 60.0
        if not 0 < minutes_to_next <= 24 * 60:
            continue
        previous_observation = previous.get(key)
        delay_trend = 0.0
        if previous_observation:
            prior_at = parse_datetime(previous_observation.get("observed_at"))
            prior_delay = _numeric(previous_observation.get("current_delay_minutes"))
            current_delay = _numeric(observation.get("current_delay_minutes"))
            hours = (observed_at - prior_at).total_seconds() / 3600.0 if prior_at else 0
            if prior_delay is not None and current_delay is not None and hours > 0:
                delay_trend = (current_delay - prior_delay) / hours
        current_scheduled = parse_datetime(current.get("scheduled_arrival")) if current else None
        next_scheduled = parse_datetime(next_event.get("scheduled_arrival"))
        scheduled_minutes = ((next_scheduled - current_scheduled).total_seconds() / 60.0
                             if current_scheduled and next_scheduled else None)
        remaining_scheduled = ((next_scheduled - observed_at).total_seconds() / 60.0
                               if next_scheduled else scheduled_minutes)
        current_raw = current.get("raw_payload") if current else {}
        next_distance = _event_distance(next_event)
        current_distance = _event_distance(current)
        distance_to_next = next_distance - current_distance if next_distance is not None and current_distance is not None else None
        obs_lat, obs_lon = _raw_coordinates(observation.get("raw_payload_json") or observation.get("raw_payload"))
        next_lat, next_lon = _raw_coordinates(next_event.get("raw_payload"))
        gps_distance = haversine_km(obs_lat, obs_lon, next_lat, next_lon)
        op = op_by_key.get(key, {})
        current_delay = _numeric(observation.get("current_delay_minutes"))
        next_delay = _numeric(next_actual.get("delay_arrival_minutes"))
        delay_change = next_delay - current_delay if next_delay is not None and current_delay is not None else None
        segment_id = f"{train}:{current_code}:{next_code}"
        rows.append({
            "train_number": train, "journey_date": date, "snapshot_observed_at": observed_at.isoformat(),
            "current_station": current_code, "next_station": next_code,
            "scheduled_minutes_to_next": scheduled_minutes, "current_delay_minutes": current_delay,
            "delay_trend_minutes_per_hour": delay_trend, "dwell_minutes": _numeric(observation.get("dwell_minutes")),
            "speed_kmh": _numeric(observation.get("speed_kmh")), "has_speed": int(observation.get("speed_kmh") is not None),
            "distance_to_next_km": distance_to_next if distance_to_next is not None else gps_distance,
            "remaining_scheduled_minutes": remaining_scheduled,
            "current_station_sequence": sequence, "next_station_sequence": _numeric(next_event.get("sequence")),
            "train_number_hash": stable_hash(train), "segment_id_hash": stable_hash(segment_id),
            "is_rescheduled": int(op.get("event_type") == "rescheduled"),
            "rescheduled_by_minutes": _numeric(op.get("rescheduled_by_minutes")) or 0.0,
            "minutes_to_next": minutes_to_next, "delay_at_next_minutes": next_delay,
            "delay_change_minutes": delay_change, "label_quality": "provider_actual_arrival_after_snapshot",
            "provider": observation.get("provider"),
            **{field: observation.get(field) for field in PHASE4_WEATHER_FEATURES},
        })
        previous[key] = observation
    return rows
