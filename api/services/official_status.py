"""Adapters for RailRadar, IndianRailAPI, and another authorised live-status feed.

IndianRailAPI provides a current station and delay but not GPS coordinates or
speed. A second generic adapter remains available for an approved HTTPS
provider that implements the normalized JSON contract below. Neither adapter
scrapes a browser page or fabricates a location.

Required response fields:
  train_number, observed_at, current_station, current_delay_minutes
Optional fields:
  latitude, longitude, speed_kmh, next_station, provider
"""

from __future__ import annotations

import datetime as dt
import math
import os
import re
from dataclasses import dataclass
from typing import Any, Optional
from urllib.parse import quote, urlparse

import httpx

from api.services.http_client import get_http_client
from api.services.phase2_dataset import normalize_station_code, normalize_train_route, parse_delay_minutes


def _status_max_age_seconds() -> int:
    try:
        configured = int(os.getenv("OFFICIAL_RAIL_STATUS_MAX_AGE_SECONDS", "300"))
    except ValueError:
        configured = 300
    return max(30, min(3600, configured))


class LiveStatusUnavailable(Exception):
    """Raised when no authorised live-status provider is configured."""


class LiveStatusInvalid(Exception):
    """Raised when a provider's response cannot safely be used."""


class LiveStationInvalid(Exception):
    """Raised when the live-station provider response is malformed."""


class OfficialScheduleInvalid(Exception):
    """Raised when the official train schedule cannot be normalized."""


@dataclass(frozen=True)
class LiveTrainStatus:
    train_number: str
    observed_at: dt.datetime
    current_station: str
    current_delay_minutes: int
    latitude: Optional[float]
    longitude: Optional[float]
    speed_kmh: Optional[float]
    next_station: Optional[str]
    provider: str
    raw_payload: Optional[dict[str, Any]] = None
    observation_quality: str = "provider_timestamp"


INDIAN_RAIL_API_BASE = "https://indianrailapi.com/api/v2"
RAILRADAR_API_BASE = "https://api.railradar.in/v1"


def _railradar_api_key() -> str:
    return os.getenv("RAILRADAR_API_KEY", "").strip()


def _railradar_api_base() -> str:
    configured = os.getenv("RAILRADAR_API_BASE_URL", RAILRADAR_API_BASE).strip().rstrip("/")
    parsed = urlparse(configured)
    if parsed.scheme != "https" or not parsed.netloc:
        raise LiveStatusUnavailable("RAILRADAR_API_BASE_URL must be an HTTPS URL")
    return configured


def _indian_rail_api_key() -> str:
    # Do not reuse RAPIDAPI_KEY: IndianRailAPI issues its own path-based key.
    return os.getenv("INDIAN_RAIL_API_KEY", "").strip()


def _indian_rail_api_base() -> str:
    configured = os.getenv("INDIAN_RAIL_API_BASE_URL", INDIAN_RAIL_API_BASE).strip().rstrip("/")
    parsed = urlparse(configured)
    if parsed.scheme != "https" or not parsed.netloc:
        raise LiveStatusUnavailable("INDIAN_RAIL_API_BASE_URL must be an HTTPS URL")
    return configured


def _same_train_number(left: Any, right: str) -> bool:
    left_text, right_text = str(left or "").strip(), str(right).strip()
    if not left_text or not right_text:
        return False
    return left_text == right_text or left_text.lstrip("0") == right_text.lstrip("0")


def _parse_indian_delay(value: Any) -> Optional[int]:
    """Parse IndianRailAPI delay values such as ``14 M``, ``RT`` or ``01:24``."""
    if value is None:
        return None
    text = str(value).strip().upper()
    if not text or text == "-":
        return None
    if text in {"RT", "ON TIME", "ONTIME"}:
        return 0
    match = re.fullmatch(r"(\d+)\s*(?:M|MIN|MINS|MINUTES)?", text)
    if match:
        return int(match.group(1))
    match = re.fullmatch(r"(\d{1,3}):(\d{2})", text)
    if match:
        return int(match.group(1)) * 60 + int(match.group(2))
    return None


def _validate_indian_response(payload: Any) -> dict[str, Any]:
    if not isinstance(payload, dict):
        raise LiveStatusInvalid("IndianRailAPI response must be a JSON object")
    if str(payload.get("ResponseCode", "")).strip() != "200":
        message = str(payload.get("Message") or payload.get("Status") or "request failed")
        raise LiveStatusUnavailable(f"IndianRailAPI rejected the request: {message}")
    return payload


async def _fetch_indian_rail_json(path: str) -> Any:
    key = _indian_rail_api_key()
    if not key:
        raise LiveStatusUnavailable("INDIAN_RAIL_API_KEY is not configured")
    endpoint = f"{_indian_rail_api_base()}/{path.lstrip('/')}"
    try:
        client = get_http_client(15.0)
        response = await client.get(endpoint)
        response.raise_for_status()
        return response.json()
    except httpx.HTTPError as error:
        raise LiveStatusUnavailable("IndianRailAPI could not be reached") from error
    except ValueError as error:
        raise LiveStatusInvalid("IndianRailAPI returned invalid JSON") from error


def _validate_railradar_response(payload: Any) -> dict[str, Any]:
    if not isinstance(payload, dict):
        raise LiveStatusInvalid("RailRadar response must be a JSON object")
    if payload.get("success") is not True or not isinstance(payload.get("data"), dict):
        error = payload.get("error")
        message = error.get("message") if isinstance(error, dict) else None
        raise LiveStatusUnavailable(str(message or "RailRadar rejected the request"))
    return payload


async def _fetch_railradar_json(path: str, params: Optional[dict[str, Any]] = None) -> Any:
    key = _railradar_api_key()
    if not key:
        raise LiveStatusUnavailable("RAILRADAR_API_KEY is not configured")
    endpoint = f"{_railradar_api_base()}/{path.lstrip('/')}"
    try:
        client = get_http_client(15.0)
        response = await client.get(endpoint, params=params or {}, headers={
            "Accept": "application/json", "Authorization": f"Bearer {key}",
        })
        response.raise_for_status()
        return response.json()
    except httpx.HTTPError as error:
        raise LiveStatusUnavailable("RailRadar could not be reached") from error
    except ValueError as error:
        raise LiveStatusInvalid("RailRadar returned invalid JSON") from error


def _parse_provider_timestamp(value: Any) -> dt.datetime:
    try:
        parsed = dt.datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            raise ValueError("timezone is required")
        return parsed.astimezone(dt.timezone.utc)
    except (TypeError, ValueError) as error:
        raise LiveStatusInvalid("RailRadar returned an invalid update timestamp") from error


def _railradar_data(payload: dict[str, Any]) -> dict[str, Any]:
    return payload["data"]


def _railradar_route_contract(payload: dict[str, Any], train_number: str) -> Optional[dict[str, Any]]:
    """Convert RailRadar's live route to the runtime ETA route contract."""
    data = _railradar_data(payload)
    route = data.get("route")
    if not isinstance(route, list):
        return None
    stops: list[dict[str, Any]] = []
    for index, item in enumerate(route, start=1):
        if not isinstance(item, dict):
            continue
        # RailRadar includes pass-through locations in `route`; the ETA UI
        # and provider's `nextHalt` should use actual scheduled halts.
        if item.get("isHalt") is False:
            continue
        code = normalize_station_code(item.get("stationCode") or item.get("code"))
        if not code:
            continue
        try:
            sequence = int(item.get("sequence") or index)
        except (TypeError, ValueError):
            sequence = index
        scheduled = item.get("scheduledArrival") or item.get("scheduledDeparture")
        if not scheduled:
            continue
        try:
            distance = max(0.0, float(item.get("distance") or 0.0))
        except (TypeError, ValueError):
            distance = 0.0
        stops.append({
            "seq": sequence, "code": code,
            "name": str(item.get("stationName") or code).strip(),
            "sched": _clock_text(scheduled), "dist": distance,
        })
    if len(stops) < 2:
        return None
    stops.sort(key=lambda stop: stop["seq"])
    train = data.get("train") if isinstance(data.get("train"), dict) else {}
    source = train.get("source") if isinstance(train.get("source"), dict) else {}
    destination = train.get("destination") if isinstance(train.get("destination"), dict) else {}
    return {
        "name": str(data.get("trainName") or train.get("name") or f"Train {train_number}").strip(),
        "source": normalize_station_code(source.get("code") or stops[0]["code"]),
        "dest": normalize_station_code(destination.get("code") or stops[-1]["code"]),
        "stops": stops, "provider": "RAILRADAR",
    }


def _clock_text(value: Any) -> str:
    """Convert RailRadar ISO timestamps or clock strings to HH:MM."""
    text = str(value or "").strip()
    match = re.search(r"T(\d{2}:\d{2})", text)
    if match:
        return match.group(1)
    match = re.search(r"(?:^|\s)(\d{1,2}:\d{2})", text)
    return match.group(1) if match else text[:5]


async def _fetch_railradar_live_status(train_number: str, journey_date: dt.date) -> LiveTrainStatus:
    payload = _validate_railradar_response(await _fetch_railradar_json(
        f"trains/{quote(train_number, safe='')}/live",
        {"date": journey_date.isoformat(), "authoritative": "true"},
    ))
    data = _railradar_data(payload)
    returned_number = data.get("trainNumber")
    train = data.get("train") if isinstance(data.get("train"), dict) else {}
    returned_number = returned_number or train.get("number")
    if not _same_train_number(returned_number, train_number):
        raise LiveStatusInvalid("RailRadar returned a different train number")
    location = data.get("currentLocation")
    if not isinstance(location, dict):
        raise LiveStatusInvalid("RailRadar did not return a current location")
    station = normalize_station_code(location.get("stationCode"))
    if not station:
        raise LiveStatusInvalid("RailRadar current location has no station code")
    try:
        delay = int(data.get("delayMinutes"))
    except (TypeError, ValueError) as error:
        raise LiveStatusInvalid("RailRadar returned an invalid delay") from error
    if not -720 <= delay <= 720:
        raise LiveStatusInvalid("RailRadar delay is outside the accepted range")
    # RailRadar can report a negative value when the train is early. The
    # deployed ETA contract models lateness only; retain the signed provider
    # value in raw_payload and use zero as the conservative serving anchor.
    serving_delay = max(0, delay)
    observed_at = _parse_provider_timestamp(data.get("lastUpdatedAt"))
    age_seconds = (dt.datetime.now(dt.timezone.utc) - observed_at).total_seconds()
    if age_seconds > _status_max_age_seconds() or age_seconds < -60:
        raise LiveStatusInvalid("RailRadar status is stale or has an invalid timestamp")
    coordinates = location.get("coordinates") if isinstance(location.get("coordinates"), dict) else {}
    try:
        latitude = float(coordinates["lat"]) if coordinates.get("lat") is not None else None
        longitude = float(coordinates["lng"]) if coordinates.get("lng") is not None else None
    except (TypeError, ValueError) as error:
        raise LiveStatusInvalid("RailRadar returned invalid current coordinates") from error
    route = data.get("route") if isinstance(data.get("route"), list) else []
    for item in route:
        if isinstance(item, dict) and normalize_station_code(item.get("stationCode")) == station:
            try:
                if latitude is None:
                    latitude = float(item["lat"]) if item.get("lat") is not None else None
                if longitude is None:
                    longitude = float(item["lng"]) if item.get("lng") is not None else None
            except (TypeError, ValueError) as error:
                raise LiveStatusInvalid("RailRadar returned invalid station coordinates") from error
            break
    speed = location.get("speedKmh")
    try:
        speed = float(speed) if speed is not None else None
    except (TypeError, ValueError) as error:
        raise LiveStatusInvalid("RailRadar returned an invalid speed") from error
    if speed is not None and not 0 <= speed <= 400:
        raise LiveStatusInvalid("RailRadar speed is outside the accepted range")
    next_halt = data.get("nextHalt") if isinstance(data.get("nextHalt"), dict) else {}
    return LiveTrainStatus(
        train_number=train_number, observed_at=observed_at, current_station=station,
        current_delay_minutes=serving_delay, latitude=latitude, longitude=longitude,
        speed_kmh=speed, next_station=normalize_station_code(next_halt.get("stationCode")) or None,
        provider="RAILRADAR", raw_payload=data, observation_quality="provider_timestamp",
    )


async def _fetch_indian_live_status(train_number: str, journey_date: dt.date) -> LiveTrainStatus:
    path = (
        f"livetrainstatus/apikey/{quote(_indian_rail_api_key(), safe='')}"
        f"/trainnumber/{quote(train_number, safe='')}/date/{journey_date:%Y%m%d}/"
    )
    payload = _validate_indian_response(await _fetch_indian_rail_json(path))
    if not _same_train_number(payload.get("TrainNumber"), train_number):
        raise LiveStatusInvalid("IndianRailAPI returned a different train number")
    current = payload.get("CurrentStation")
    if not isinstance(current, dict):
        raise LiveStatusInvalid("IndianRailAPI did not return a current station")
    station = str(current.get("StationCode") or "").strip().upper()
    if not station:
        raise LiveStatusInvalid("IndianRailAPI current station has no station code")
    delay = None
    for field in ("DelayInDeparture", "DelayInArrival"):
        delay = _parse_indian_delay(current.get(field))
        if delay is not None:
            break
    if delay is None or not 0 <= delay <= 720:
        raise LiveStatusInvalid("IndianRailAPI current-station delay is invalid")
    # The API response has no observation timestamp. The request time is an
    # honest freshness bound; it is not presented as a GPS measurement time.
    observed_at = dt.datetime.now(dt.timezone.utc)
    route_events = normalize_train_route(
        payload, train_number, journey_date, observed_at, "INDIAN_RAIL_API"
    )
    current_sequence = next(
        (event.get("sequence") for event in route_events if event.get("station_code") == station),
        None,
    )
    next_station = next(
        (
            str(event.get("station_code"))
            for event in route_events
            if current_sequence is not None
            and event.get("sequence") is not None
            and event.get("sequence") > current_sequence
        ),
        None,
    )
    return LiveTrainStatus(
        train_number=train_number,
        observed_at=observed_at,
        current_station=station,
        current_delay_minutes=delay,
        latitude=None,
        longitude=None,
        speed_kmh=None,
        next_station=next_station,
        provider="INDIAN_RAIL_API",
        raw_payload=payload,
        observation_quality="request_time_station_status",
    )


def _normalize_schedule_response(payload: Any, train_number: str) -> dict[str, Any]:
    """Normalize TrainSchedule into the local train_routes_index contract."""
    if not isinstance(payload, dict):
        raise OfficialScheduleInvalid("IndianRailAPI schedule response must be an object")
    if str(payload.get("ResponseCode", "")).strip() != "200":
        raise OfficialScheduleInvalid(str(payload.get("Message") or payload.get("Status") or "schedule request failed"))
    route = payload.get("Route") or payload.get("TrainRoute") or payload.get("route")
    if not isinstance(route, list) or not route:
        raise OfficialScheduleInvalid("IndianRailAPI schedule has no route")
    stops: list[dict[str, Any]] = []
    for index, item in enumerate(route, start=1):
        if not isinstance(item, dict):
            continue
        station_code = normalize_station_code(
            item.get("StationCode") or item.get("station_code") or item.get("Code") or item.get("code")
        )
        sched = item.get("ArrivalTime") or item.get("ScheduleArrival") or item.get("scheduled_arrival")
        if not station_code or not sched:
            continue
        try:
            sequence = int(item.get("SerialNo") or item.get("StationNo") or item.get("Sequence") or index)
        except (TypeError, ValueError):
            sequence = index
        distance = item.get("Distance") or item.get("distance") or item.get("DistanceFromSource") or 0
        try:
            distance = float(distance)
        except (TypeError, ValueError):
            distance = 0.0
        stops.append({
            "seq": sequence,
            "code": station_code,
            "name": str(item.get("StationName") or item.get("Name") or station_code).strip(),
            "sched": str(sched).strip()[:5],
            "dist": max(0.0, distance),
        })
    if len(stops) < 2:
        raise OfficialScheduleInvalid("IndianRailAPI schedule has fewer than two valid stations")
    stops.sort(key=lambda stop: stop["seq"])
    first, last = stops[0], stops[-1]
    return {
        "name": str(payload.get("TrainName") or payload.get("Name") or f"Train {train_number}").strip(),
        "source": first["code"], "dest": last["code"], "stops": stops,
        "provider": "INDIAN_RAIL_API",
    }


async def fetch_train_schedule(train_number: str) -> dict[str, Any]:
    """Fetch and normalize the official TrainSchedule response."""
    key = str(train_number).strip()
    if not key or not key.isdigit():
        raise OfficialScheduleInvalid("train_number must contain only digits")
    payload = _validate_indian_response(
        await _fetch_indian_rail_json(
            f"TrainSchedule/apikey/{quote(_indian_rail_api_key(), safe='')}/TrainNumber/{quote(key, safe='')}/"
        )
    )
    return _normalize_schedule_response(payload, key)


def _normalize_operational_list(payload: Any, event_type: str, journey_date: dt.date) -> list[dict[str, Any]]:
    if not isinstance(payload, dict):
        raise OfficialScheduleInvalid("IndianRailAPI operational response must be an object")
    if str(payload.get("ResponseCode", "")).strip() != "200":
        raise OfficialScheduleInvalid(str(payload.get("Message") or payload.get("Status") or "operational request failed"))
    items = payload.get("Trains") or payload.get("Train") or payload.get("Data") or []
    if not isinstance(items, list):
        raise OfficialScheduleInvalid("IndianRailAPI operational response has no train list")
    output = []
    for item in items:
        if not isinstance(item, dict):
            continue
        number = str(item.get("TrainNo") or item.get("TrainNumber") or item.get("Number") or "").strip()
        if not number:
            continue
        rescheduled_by = item.get("RescheduledBy") or item.get("rescheduled_by")
        output.append({
            "train_number": number,
            "journey_date": journey_date.isoformat(),
            "event_type": event_type,
            "rescheduled_by_minutes": parse_delay_minutes(rescheduled_by),
            "raw_payload": item,
            "provider": "INDIAN_RAIL_API",
        })
    return output


async def fetch_cancelled_trains(journey_date: dt.date) -> list[dict[str, Any]]:
    payload = _validate_indian_response(
        await _fetch_indian_rail_json(
            f"CancelledTrains/apikey/{quote(_indian_rail_api_key(), safe='')}/Date/{journey_date:%Y%m%d}"
        )
    )
    return _normalize_operational_list(payload, "cancelled", journey_date)


async def fetch_rescheduled_trains(journey_date: dt.date) -> list[dict[str, Any]]:
    payload = _validate_indian_response(
        await _fetch_indian_rail_json(
            f"RescheduledTrains/apikey/{quote(_indian_rail_api_key(), safe='')}/Date/{journey_date:%Y%m%d}"
        )
    )
    return _normalize_operational_list(payload, "rescheduled", journey_date)


def runtime_route_from_status(status: LiveTrainStatus) -> Optional[dict[str, Any]]:
    """Return a provider-supplied route suitable for live ETA serving."""
    if status.provider == "RAILRADAR" and isinstance(status.raw_payload, dict):
        return _railradar_route_contract({"data": status.raw_payload}, status.train_number)
    return None


async def fetch_train_route_geometry(train_number: str) -> dict[str, Any]:
    """Fetch provider-supplied railway track geometry for a train route."""
    train_key = str(train_number).strip()
    if not train_key:
        raise LiveStatusInvalid("train number is required")
    payload = _validate_railradar_response(await _fetch_railradar_json(
        f"trains/{quote(train_key, safe='')}/route",
        params={"format": "geojson", "stops": "true"},
    ))
    data = _railradar_data(payload)
    geojson = data.get("geojson") if isinstance(data.get("geojson"), dict) else data
    geometry = geojson.get("geometry") if isinstance(geojson, dict) else None
    if not isinstance(geometry, dict) or geometry.get("type") not in {"LineString", "MultiLineString"}:
        raise LiveStatusInvalid("RailRadar route geometry is missing or unsupported")
    coordinates = geometry.get("coordinates")
    if not isinstance(coordinates, list) or not coordinates:
        raise LiveStatusInvalid("RailRadar route geometry has no coordinates")
    return {"type": geometry["type"], "coordinates": coordinates, "source": "RAILRADAR"}


def _parse_live_station_train(item: Any) -> dict[str, Optional[str]]:
    if not isinstance(item, dict):
        raise LiveStationInvalid("IndianRailAPI live-station train must be an object")
    number = str(item.get("Number") or "").strip()
    name = str(item.get("Name") or "").strip()
    if not number or not name:
        raise LiveStationInvalid("IndianRailAPI live-station train is missing number or name")
    normalized = {
        "train_number": number,
        "train_name": name,
        "source": str(item.get("Source") or "").strip().upper() or None,
        "destination": str(item.get("Destination") or "").strip().upper() or None,
        "schedule_arrival": str(item.get("ScheduleArrival") or "").strip() or None,
        "schedule_departure": str(item.get("ScheduleDeparture") or "").strip() or None,
        "halt": str(item.get("Halt") or "").strip() or None,
        "expected_arrival": str(item.get("ExpectedArrival") or "").strip() or None,
        "delay_in_arrival": str(item.get("DelayInArrival") or "").strip() or None,
        "expected_departure": str(item.get("ExpectedDeparture") or "").strip() or None,
        "delay_in_departure": str(item.get("DelayInDeparture") or "").strip() or None,
    }
    return normalized


async def fetch_live_station(station_code: str, hours: int = 2) -> list[dict[str, Optional[str]]]:
    """Fetch a live station board from the configured live provider."""
    code = str(station_code).strip().upper()
    if not re.fullmatch(r"[A-Z0-9]{2,8}", code):
        raise LiveStationInvalid("station_code must contain 2 to 8 letters or digits")
    if _railradar_api_key():
        if hours not in (2, 4, 6, 8):
            raise LiveStationInvalid("RailRadar hours must be 2, 4, 6, or 8")
        payload = _validate_railradar_response(await _fetch_railradar_json(
            f"stations/{quote(code, safe='')}/live", {"hours": hours}
        ))
        trains = _railradar_data(payload).get("trains")
        if not isinstance(trains, list):
            raise LiveStationInvalid("RailRadar live-station response has no train list")
        normalized = []
        for item in trains:
            if not isinstance(item, dict):
                continue
            train = item.get("train") if isinstance(item.get("train"), dict) else {}
            stop = item.get("stop") if isinstance(item.get("stop"), dict) else {}
            live = item.get("live") if isinstance(item.get("live"), dict) else {}
            number = str(train.get("number") or "").strip()
            name = str(train.get("name") or "").strip()
            if not number or not name:
                continue
            delay = live.get("delayMinutes")
            normalized.append({
                "train_number": number, "train_name": name,
                "source": normalize_station_code(train.get("source")) or None,
                "destination": normalize_station_code(train.get("destination")) or None,
                "schedule_arrival": str(stop.get("arrival") or "").strip() or None,
                "schedule_departure": str(stop.get("departure") or "").strip() or None,
                "halt": str(live.get("type") or "").strip() or None,
                "expected_arrival": str(live.get("expectedArrivalTime") or "").strip() or None,
                "delay_in_arrival": str(delay) if delay is not None else None,
                "expected_departure": str(live.get("expectedDepartureTime") or "").strip() or None,
                "delay_in_departure": str(delay) if delay is not None else None,
            })
        return normalized
    if hours not in (2, 4):
        raise LiveStationInvalid("IndianRailAPI hours must be 2 or 4")
    path = (
        f"LiveStation/apikey/{quote(_indian_rail_api_key(), safe='')}"
        f"/StationCode/{quote(code, safe='')}/hours/{hours}/"
    )
    payload = _validate_indian_response(await _fetch_indian_rail_json(path))
    if str(payload.get("Status", "")).strip().upper() not in {"SUCCESS", ""}:
        raise LiveStationInvalid("IndianRailAPI live-station response is not successful")
    trains = payload.get("Trains")
    if not isinstance(trains, list):
        raise LiveStationInvalid("IndianRailAPI live-station response has no train list")
    return [_parse_live_station_train(item) for item in trains]


def _as_optional_float(value: Any, minimum: float, maximum: float, field: str) -> Optional[float]:
    if value is None:
        return None
    try:
        result = float(value)
    except (TypeError, ValueError) as error:
        raise LiveStatusInvalid(f"{field} must be numeric") from error
    if not math.isfinite(result) or not minimum <= result <= maximum:
        raise LiveStatusInvalid(f"{field} is out of range")
    return result


def _parse_status(payload: Any, train_number: str) -> LiveTrainStatus:
    if not isinstance(payload, dict):
        raise LiveStatusInvalid("provider response must be a JSON object")
    if str(payload.get("train_number", "")).strip() != train_number:
        raise LiveStatusInvalid("provider returned a different train number")
    try:
        observed_at = dt.datetime.fromisoformat(str(payload["observed_at"]).replace("Z", "+00:00"))
        if observed_at.tzinfo is None:
            raise ValueError("timezone is required")
        station = str(payload["current_station"]).strip().upper()
        delay = int(payload["current_delay_minutes"])
    except (KeyError, TypeError, ValueError) as error:
        raise LiveStatusInvalid("provider response is missing a valid status field") from error
    if not station or not 0 <= delay <= 720:
        raise LiveStatusInvalid("provider station or delay is invalid")
    age_seconds = (dt.datetime.now(dt.timezone.utc) - observed_at.astimezone(dt.timezone.utc)).total_seconds()
    if age_seconds > _status_max_age_seconds() or age_seconds < -60:
        raise LiveStatusInvalid("provider status is stale or has an invalid timestamp")
    latitude = _as_optional_float(payload.get("latitude"), -90, 90, "latitude")
    longitude = _as_optional_float(payload.get("longitude"), -180, 180, "longitude")
    if (latitude is None) != (longitude is None):
        raise LiveStatusInvalid("latitude and longitude must be provided together")
    speed = _as_optional_float(payload.get("speed_kmh"), 0, 400, "speed_kmh")
    return LiveTrainStatus(
        train_number=train_number, observed_at=observed_at, current_station=station,
        current_delay_minutes=delay, latitude=latitude, longitude=longitude, speed_kmh=speed,
        next_station=str(payload["next_station"]).strip().upper() if payload.get("next_station") else None,
        provider=str(payload.get("provider") or "OFFICIAL_RAIL_STATUS"),
        raw_payload=payload,
        observation_quality="provider_timestamp",
    )


async def fetch_live_status(train_number: str, journey_date: Optional[dt.date] = None) -> LiveTrainStatus:
    """Fetch a verified status from RailRadar, IndianRailAPI, or a generic provider."""
    if _railradar_api_key():
        return await _fetch_railradar_live_status(train_number, journey_date or dt.date.today())
    if _indian_rail_api_key():
        return await _fetch_indian_live_status(train_number, journey_date or dt.date.today())
    endpoint = os.getenv("OFFICIAL_RAIL_STATUS_URL", "").strip()
    if not endpoint:
        raise LiveStatusUnavailable("No authorised live-status provider is configured")
    parsed = urlparse(endpoint)
    if parsed.scheme != "https" or not parsed.netloc:
        raise LiveStatusUnavailable("OFFICIAL_RAIL_STATUS_URL must be an HTTPS URL")
    headers = {"Accept": "application/json"}
    token = os.getenv("OFFICIAL_RAIL_STATUS_TOKEN", "").strip()
    if token:
        headers["Authorization"] = f"Bearer {token}"
    params = {"train_number": train_number}
    if journey_date:
        params["journey_date"] = journey_date.isoformat()
    try:
        client = get_http_client(10.0)
        response = await client.get(endpoint, params=params, headers=headers)
        response.raise_for_status()
        return _parse_status(response.json(), train_number)
    except httpx.HTTPError as error:
        raise LiveStatusUnavailable("Official live-status provider could not be reached") from error
    except ValueError as error:
        raise LiveStatusInvalid("Official live-status provider returned invalid JSON") from error
