"""Phase 2 helpers for turning official rail responses into training records.

The existing journey-level model predicts a destination delay. Phase 2 needs a
different, station-level dataset: a timestamped observation at one station and
an observed arrival at the next station. This module deliberately keeps the
provider response flexible because IndianRailAPI has used slightly different
field names across response versions.

Important: an expected arrival is never promoted to an actual arrival. Rows
created from expected times remain provider context only and are excluded from
the supervised station-level export.
"""

from __future__ import annotations

import datetime as dt
import json
import re
from typing import Any, Iterable, Optional


def _first(item: dict[str, Any], *names: str) -> Any:
    for name in names:
        if name in item and item[name] not in (None, "", "-"):
            return item[name]
    return None


def normalize_station_code(value: Any) -> str:
    return str(value or "").strip().upper()


def parse_delay_minutes(value: Any) -> Optional[int]:
    """Parse IndianRailAPI values such as ``14 M``, ``RT`` or ``01:24``."""
    if value is None:
        return None
    text = str(value).strip().upper()
    if not text or text in {"-", "NA", "N/A", "NULL"}:
        return None
    if text in {"RT", "ON TIME", "ONTIME", "0", "0 M"}:
        return 0
    match = re.fullmatch(r"(\d+)\s*(?:M|MIN|MINS|MINUTES)?", text)
    if match:
        return int(match.group(1))
    match = re.fullmatch(r"(\d{1,3}):(\d{2})", text)
    if match:
        return int(match.group(1)) * 60 + int(match.group(2))
    return None


def _clock_from_text(value: Any) -> Optional[tuple[int, int, int]]:
    match = re.search(r"(\d{1,2}):(\d{2})(?::(\d{2}))?", str(value or ""))
    if not match:
        return None
    hour, minute, second = int(match.group(1)), int(match.group(2)), int(match.group(3) or 0)
    if hour > 23 or minute > 59 or second > 59:
        return None
    return hour, minute, second


def parse_provider_datetime(
    value: Any,
    journey_date: dt.date,
    previous: Optional[dt.datetime] = None,
    default_timezone: dt.tzinfo = dt.timezone.utc,
) -> Optional[dt.datetime]:
    """Parse a provider time and roll it over midnight in route order."""
    if value in (None, "", "-"):
        return None
    text = str(value).strip()
    # RailRadar sends timezone-aware ISO timestamps. Parse them before the
    # clock-only fallback so IST values are not mistakenly interpreted as UTC.
    try:
        parsed_iso = dt.datetime.fromisoformat(text.replace("Z", "+00:00"))
        if parsed_iso.tzinfo is not None:
            return parsed_iso.astimezone(dt.timezone.utc)
    except ValueError:
        pass
    formats_with_year = (
        "%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%d %b %Y %H:%M",
        "%H:%M:%S, %d %b %Y", "%H:%M, %d %b %Y",
    )
    for fmt in formats_with_year:
        try:
            parsed = dt.datetime.strptime(text, fmt)
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=default_timezone)
            return parsed.astimezone(dt.timezone.utc)
        except ValueError:
            continue
    # Some railway responses omit the year (for example ``23:50, 31 Dec``).
    # Comparing only month numbers breaks around January and December. Build
    # nearby candidates and choose the one that fits route chronology.
    for fmt in ("%H:%M:%S, %d %b", "%H:%M, %d %b"):
        try:
            parsed = dt.datetime.strptime(text, fmt)
        except ValueError:
            continue
        candidates = [
            parsed.replace(year=journey_date.year + offset, tzinfo=default_timezone)
            for offset in (-1, 0, 1)
        ]
        if previous is not None:
            previous_local = previous.astimezone(default_timezone)
            after_previous = [candidate for candidate in candidates if candidate >= previous_local]
            parsed = min(after_previous or candidates, key=lambda candidate: abs(candidate - previous_local))
        else:
            journey_start = dt.datetime.combine(journey_date, dt.time(), tzinfo=default_timezone)
            parsed = min(candidates, key=lambda candidate: abs(candidate - journey_start))
        return parsed.astimezone(dt.timezone.utc)
    clock = _clock_from_text(text)
    if clock is None:
        return None
    parsed = dt.datetime.combine(journey_date, dt.time(*clock), tzinfo=default_timezone)
    if previous is not None:
        while parsed < previous:
            parsed += dt.timedelta(days=1)
    return parsed.astimezone(dt.timezone.utc)


def _route_items(payload: Any) -> list[dict[str, Any]]:
    if not isinstance(payload, dict):
        return []
    route = _first(payload, "TrainRoute", "Route", "train_route", "route")
    if not isinstance(route, list):
        return []
    return [item for item in route if isinstance(item, dict)]


def _route_station_code(item: dict[str, Any]) -> str:
    return normalize_station_code(_first(item, "StationCode", "stationCode", "station_code", "Code", "code"))


def _route_sequence(item: dict[str, Any], fallback: int) -> int:
    value = _first(item, "SerialNo", "StationNo", "Sequence", "sequence", "Seq", "station_no", "seq")
    try:
        return int(value)
    except (TypeError, ValueError):
        return fallback


def normalize_train_route(
    payload: Any,
    train_number: str,
    journey_date: dt.date,
    observed_at: dt.datetime,
    provider: str,
) -> list[dict[str, Any]]:
    """Normalize a live-status TrainRoute into station event dictionaries."""
    items = _route_items(payload)
    if not items:
        current = payload.get("CurrentStation") if isinstance(payload, dict) else None
        if isinstance(current, dict):
            code = _route_station_code(current)
            if code:
                return [{
                    "train_number": str(train_number), "journey_date": journey_date.isoformat(),
                    "observed_at": observed_at.isoformat(), "provider": provider,
                    "station_code": code, "station_name": _first(current, "StationName", "Name"),
                    "sequence": None, "scheduled_arrival": None, "scheduled_departure": None,
                    "actual_arrival_at": None, "actual_departure_at": None,
                    "delay_arrival_minutes": parse_delay_minutes(_first(current, "DelayInArrival")),
                    "delay_departure_minutes": parse_delay_minutes(_first(current, "DelayInDeparture")),
                    "status": _first(current, "Status"),
                    "event_quality": "provider_station_observation",
                    "raw_payload": current,
                }]
        return []

    ordered = sorted(
        ((index, item, _route_sequence(item, index + 1)) for index, item in enumerate(items)),
        key=lambda value: (value[2], value[0]),
    )
    normalized: list[dict[str, Any]] = []
    # IndianRailAPI returns timetable and actual event times as clock-only
    # values in IST. Other adapters currently provide UTC or timezone-aware
    # timestamps, so retain UTC as their default for backwards compatibility.
    default_timezone = (
        dt.timezone(dt.timedelta(hours=5, minutes=30))
        if str(provider).strip().upper() == "INDIAN_RAIL_API"
        else dt.timezone.utc
    )
    previous_scheduled_arrival: Optional[dt.datetime] = None
    previous_scheduled_departure: Optional[dt.datetime] = None
    previous_actual_arrival: Optional[dt.datetime] = None
    previous_actual_departure: Optional[dt.datetime] = None
    for _, item, sequence in ordered:
        code = _route_station_code(item)
        if not code:
            continue
        scheduled_arrival = parse_provider_datetime(
            _first(item, "ScheduleArrival", "scheduledArrival", "ScheduledArrival", "ArrivalTime", "scheduled_arrival"),
            journey_date, previous_scheduled_arrival, default_timezone,
        )
        scheduled_departure = parse_provider_datetime(
            _first(item, "ScheduleDeparture", "scheduledDeparture", "ScheduledDeparture", "DepartureTime", "scheduled_departure"),
            journey_date, previous_scheduled_departure, default_timezone,
        )
        actual_arrival = parse_provider_datetime(
            _first(item, "ActualArrival", "actualArrival", "ActualArrivalTime", "ActualArrTime", "actual_arrival"),
            journey_date, previous_actual_arrival, default_timezone,
        )
        actual_departure = parse_provider_datetime(
            _first(item, "ActualDeparture", "actualDeparture", "ActualDepartureTime", "ActualDepTime", "actual_departure"),
            journey_date, previous_actual_departure, default_timezone,
        )
        status_value = str(_first(item, "Status", "status") or "").strip().lower()
        # Some live providers populate planned-looking actual fields on future
        # route rows. A row marked upcoming/scheduled is not an arrival event.
        if status_value in {"upcoming", "scheduled", "not-started", "not_started"}:
            actual_arrival = None
            actual_departure = None
        if scheduled_arrival is not None:
            previous_scheduled_arrival = scheduled_arrival
        if scheduled_departure is not None:
            previous_scheduled_departure = scheduled_departure
        if actual_arrival is not None:
            previous_actual_arrival = actual_arrival
        if actual_departure is not None:
            previous_actual_departure = actual_departure
        normalized.append({
            "train_number": str(train_number), "journey_date": journey_date.isoformat(),
            "observed_at": observed_at.isoformat(), "provider": provider,
            "station_code": code, "station_name": _first(item, "StationName", "stationName", "Name", "station_name"),
            "sequence": sequence,
            "scheduled_arrival": scheduled_arrival.isoformat() if scheduled_arrival else None,
            "scheduled_departure": scheduled_departure.isoformat() if scheduled_departure else None,
            "actual_arrival_at": actual_arrival.isoformat() if actual_arrival else None,
            "actual_departure_at": actual_departure.isoformat() if actual_departure else None,
            "delay_arrival_minutes": parse_delay_minutes(_first(item, "DelayInArrival", "delayArrival", "ArrivalDelay", "delay_in_arrival")),
            "delay_departure_minutes": parse_delay_minutes(_first(item, "DelayInDeparture", "delayDeparture", "DepartureDelay", "delay_in_departure")),
            "status": _first(item, "Status", "status"),
            "event_quality": "provider_actual_event" if actual_arrival or actual_departure else "provider_route_observation",
            "raw_payload": item,
        })
    return normalized


def _as_datetime(value: Any) -> Optional[dt.datetime]:
    try:
        parsed = dt.datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=dt.timezone.utc)
    except (TypeError, ValueError):
        return None


def build_station_level_rows(events: Iterable[dict[str, Any]]) -> list[dict[str, Any]]:
    """Create honest next-station labels from actual arrival events only."""
    grouped: dict[tuple[str, str], dict[str, dict[str, Any]]] = {}
    for event in events:
        if event.get("event_quality") != "provider_actual_event" or not event.get("actual_arrival_at"):
            continue
        code = normalize_station_code(event.get("station_code"))
        if not code:
            continue
        key = (str(event.get("train_number", "")), str(event.get("journey_date", "")))
        current = grouped.setdefault(key, {}).get(code)
        # Keep the most recent provider record for a station; a status poll may
        # repeat the same route event several times.
        if current is None or str(event.get("observed_at", "")) >= str(current.get("observed_at", "")):
            grouped[key][code] = dict(event)

    rows: list[dict[str, Any]] = []
    for (train_number, journey_date), station_map in grouped.items():
        ordered = sorted(
            station_map.values(),
            key=lambda item: (item.get("sequence") if item.get("sequence") is not None else 10**9, item["station_code"]),
        )
        for current, following in zip(ordered, ordered[1:]):
            current_arrival = _as_datetime(current.get("actual_arrival_at"))
            next_arrival = _as_datetime(following.get("actual_arrival_at"))
            if current_arrival is None or next_arrival is None:
                continue
            snapshot_at = _as_datetime(current.get("observed_at"))
            # A provider route contains the train's already-completed events as
            # well as the current/future route. Only the next arrival strictly
            # after the snapshot can be a supervised target; otherwise a late
            # poll would turn historical events into leaked labels.
            if snapshot_at is not None and next_arrival <= snapshot_at:
                continue
            minutes_to_next = (next_arrival - current_arrival).total_seconds() / 60.0
            if not 0 < minutes_to_next <= 24 * 60:
                continue
            scheduled_current = _as_datetime(current.get("scheduled_arrival"))
            scheduled_next = _as_datetime(following.get("scheduled_arrival"))
            scheduled_minutes = None
            if scheduled_current and scheduled_next:
                scheduled_minutes = (scheduled_next - scheduled_current).total_seconds() / 60.0
                if scheduled_minutes <= 0:
                    scheduled_minutes = None
            current_delay = current.get("delay_arrival_minutes")
            next_delay = following.get("delay_arrival_minutes")
            rows.append({
                "train_number": train_number, "journey_date": journey_date,
                "snapshot_observed_at": current.get("observed_at"),
                "current_station": current.get("station_code"),
                "next_station": following.get("station_code"),
                "current_station_sequence": current.get("sequence"),
                "next_station_sequence": following.get("sequence"),
                "scheduled_minutes_to_next": scheduled_minutes,
                "actual_arrival_current": current_arrival.isoformat(),
                "actual_arrival_next": next_arrival.isoformat(),
                "minutes_to_next": minutes_to_next,
                "delay_at_current_minutes": current_delay,
                "delay_at_next_minutes": next_delay,
                "delay_change_minutes": (next_delay - current_delay) if current_delay is not None and next_delay is not None else None,
                "label_quality": "provider_actual_arrivals",
                "provider": current.get("provider"),
            })
    return rows


def json_payload(value: Any) -> str:
    return json.dumps(value or {}, sort_keys=True, separators=(",", ":"))
