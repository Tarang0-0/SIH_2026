"""Live telemetry from an authorised provider; never a fabricated train feed."""

import asyncio
import datetime as dt
import json
import logging
import os
import time
from typing import Any, Dict, List, Optional, Tuple
from zoneinfo import ZoneInfo

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse

from api.schemas import TrainETAResponse
from api.routers import eta as eta_module
from api.services.official_status import (
    OfficialScheduleInvalid,
    LiveStatusInvalid,
    LiveStatusUnavailable,
    fetch_train_schedule,
    fetch_live_status,
    fetch_train_route_geometry,
    runtime_route_from_status,
)
from api.routers.eta import get_train_eta
from api.routers.eta import resolve_journey_date
from api.services.feedback_store import get_train_history, record_live_cycle
from api.services.coordinates import station_coordinates
from api.services.weather import WeatherInvalid, WeatherSnapshot, WeatherUnavailable, fetch_current_weather

router = APIRouter(prefix="/api/v1/trains", tags=["Live Train Status & Telemetry"])
logger = logging.getLogger(__name__)
INDEX_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data", "train_routes_index.json")
_route_index: Optional[Dict[str, Dict[str, Any]]] = None
_official_schedule_cache: Dict[str, tuple[float, Dict[str, Any]]] = {}


def _poll_seconds() -> int:
    try:
        configured = int(os.getenv("OFFICIAL_RAIL_STATUS_POLL_SECONDS", "30"))
    except ValueError:
        configured = 30
    return max(5, min(300, configured))


POLL_SECONDS = _poll_seconds()


def _schedule_cache_seconds() -> int:
    try:
        configured = int(os.getenv("INDIAN_RAIL_SCHEDULE_CACHE_SECONDS", "21600"))
    except ValueError:
        configured = 21600
    return max(300, min(86400, configured))


async def _refresh_official_route(train_number: str) -> None:
    """Use TrainSchedule when configured, retaining local fallback on outages."""
    if not os.getenv("INDIAN_RAIL_API_KEY", "").strip():
        return
    now = time.monotonic()
    cached = _official_schedule_cache.get(train_number)
    if cached and now - cached[0] < _schedule_cache_seconds():
        eta_module.set_train_route(train_number, cached[1])
        return
    try:
        route = await fetch_train_schedule(train_number)
    except (LiveStatusUnavailable, OfficialScheduleInvalid):
        logger.warning("Official schedule unavailable for train %s; using local route fallback", train_number)
        return
    eta_module.set_train_route(train_number, route)
    _official_schedule_cache[train_number] = (now, route)


def _apply_provider_route(train_number: str, status: Any) -> None:
    route = runtime_route_from_status(status)
    if route is not None:
        eta_module.set_train_route(train_number, route)


async def _weather_for_status(status: Any) -> Optional[WeatherSnapshot]:
    """Fetch weather at the live coordinate, or explicitly at the station."""
    latitude, longitude = getattr(status, "latitude", None), getattr(status, "longitude", None)
    coordinate_source = "train_coordinates"
    if latitude is None or longitude is None:
        coordinates = station_coordinates(getattr(status, "current_station", ""))
        if coordinates is None:
            return None
        latitude, longitude = coordinates
        coordinate_source = "station_coordinates"
    try:
        return await fetch_current_weather(latitude, longitude, coordinate_source=coordinate_source)
    except (WeatherUnavailable, WeatherInvalid):
        logger.warning("Weather unavailable for live status at %s", getattr(status, "current_station", "unknown"))
        return None


def _load_route_index() -> Dict[str, Dict[str, Any]]:
    global _route_index
    if _route_index is not None:
        return _route_index
    try:
        with open(INDEX_PATH, "r", encoding="utf-8") as file:
            loaded = json.load(file)
    except (OSError, json.JSONDecodeError) as error:
        raise HTTPException(status_code=503, detail="Train route index is unavailable") from error
    if not isinstance(loaded, dict):
        raise HTTPException(status_code=503, detail="Train route index is invalid")
    _route_index = loaded
    return _route_index


def get_train_stops(train_number: str) -> Tuple[str, List[Dict[str, Any]]]:
    train_key = str(train_number).strip()
    # ETA and telemetry must read the same in-memory index so an official
    # TrainSchedule refresh is immediately used by both endpoints.
    info = eta_module.TRAIN_ROUTES_INDEX.get(train_key)
    if info is None:
        info = _load_route_index().get(train_key)
    if not isinstance(info, dict) or not isinstance(info.get("stops"), list) or not info["stops"]:
        raise HTTPException(status_code=404, detail=f"No timetable route found for train {train_key}")
    if not all(isinstance(stop, dict) for stop in info["stops"]):
        raise HTTPException(status_code=422, detail="Route stop data is malformed")
    try:
        stops = sorted(info["stops"], key=lambda stop: int(stop.get("seq", 0)))
    except (TypeError, ValueError) as error:
        raise HTTPException(status_code=422, detail="Route stop sequence is malformed") from error
    return str(info.get("name", f"Train {train_key}")), stops


def _next_station(stops: List[Dict[str, Any]], current_station: str) -> Optional[str]:
    current = current_station.strip().upper()
    for index, stop in enumerate(stops):
        if str(stop.get("code", "")).strip().upper() == current:
            return str(stops[index + 1].get("code")) if index + 1 < len(stops) else None
    return None


def _model_eta_payload(
    train_number: str,
    journey_date: Optional[dt.date],
    status: Any,
    weather: Optional[WeatherSnapshot] = None,
) -> Dict[str, Any]:
    """Run the deployed ETA model using the verified live observation."""
    try:
        eta = get_train_eta(
            train_number=train_number,
            date=(journey_date or dt.date.today()).isoformat(),
            current_station=status.current_station,
            current_delay=status.current_delay_minutes,
            speed_kmh=status.speed_kmh, current_latitude=status.latitude,
            current_longitude=status.longitude, observed_at=status.observed_at,
        )
    except HTTPException as error:
        return {"available": False, "reason": str(error.detail)}
    feedback = _record_feedback(train_number, journey_date or dt.date.today(), status, eta, weather)
    return {
        "available": True,
        "destination_delay_minutes": eta.stations[-1].delay_minutes if eta.stations else None,
        "destination_confidence_percent": eta.stations[-1].confidence_percent if eta.stations else None,
        "next_station_prediction": eta.current_location.get("next_station_prediction"),
        "feedback": feedback,
        "stations": [station.model_dump(mode="json") for station in eta.stations],
    }


def _record_feedback(
    train_number: str,
    journey_date: dt.date,
    status: Any,
    eta: TrainETAResponse,
    weather: Optional[WeatherSnapshot] = None,
) -> Dict[str, Any]:
    try:
        return record_live_cycle(
            train_number,
            journey_date,
            status,
            eta,
            model_version=eta_module.MODEL_VERSION,
            weather=weather,
        )
    except Exception:
        # Live prediction must remain available if the local feedback store is
        # temporarily unavailable. The failure is visible in server logs and
        # does not turn an otherwise valid provider response into fake data.
        logger.exception("Unable to persist live feedback for train %s", train_number)
        return {"observation_recorded": False, "reason": "feedback_store_unavailable"}


@router.get("/{train_number}/history", tags=["Forecast Feedback"])
def get_history(train_number: str, date: Optional[str] = None) -> Dict[str, Any]:
    try:
        requested_date = dt.date.fromisoformat(date) if date else None
        journey_date = resolve_journey_date(train_number, requested_date)
    except ValueError as error:
        raise HTTPException(status_code=422, detail="date must use YYYY-MM-DD") from error
    return get_train_history(train_number, journey_date)


def _scheduled_history_rows(stops: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Return a read-only timetable projection from the verified route index."""
    return [
        {
            "station_code": str(stop.get("code", "")),
            "station_name": str(stop.get("name", stop.get("code", ""))),
            "sequence": stop.get("seq"),
            "scheduled_arrival": stop.get("sched"),
            "scheduled_departure": None,
            "actual_arrival_at": None,
            "actual_departure_at": None,
            "delay_minutes": None,
        }
        for stop in stops
    ]


def _history_rows(history: Dict[str, Any], stops: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Prefer stored station events, falling back to the scheduled route."""
    events = history.get("station_events") or []
    if not events:
        return _scheduled_history_rows(stops)

    by_station: Dict[str, Dict[str, Any]] = {}
    for event in events:
        code = str(event.get("station_code", "")).strip().upper()
        if not code:
            continue
        # Later observations are more complete for the same station.
        by_station[code] = {
            "station_code": code,
            "station_name": event.get("station_name") or code,
            "sequence": event.get("sequence"),
            "scheduled_arrival": event.get("scheduled_arrival"),
            "scheduled_departure": event.get("scheduled_departure"),
            "actual_arrival_at": event.get("actual_arrival_at"),
            "actual_departure_at": event.get("actual_departure_at"),
            "delay_minutes": event.get("delay_arrival_minutes"),
        }

    rows = list(by_station.values())
    rows.sort(key=lambda row: (row.get("sequence") is None, row.get("sequence") or 0))
    return rows or _scheduled_history_rows(stops)


@router.get("/{train_number}/previous-timetables", tags=["Forecast Feedback"])
def get_previous_timetables(train_number: str, days: int = 5) -> Dict[str, Any]:
    """Return the previous five journey dates without exposing a date picker.

    Actual station events are returned when the local feedback store has them.
    Otherwise the verified route index is returned as a clearly labelled
    scheduled timetable, never as fabricated historical running data.
    """
    day_count = max(1, min(5, int(days)))
    train_key = str(train_number).strip()
    train_name, stops = get_train_stops(train_key)
    today = dt.datetime.now(ZoneInfo("Asia/Kolkata")).date()
    response_days: List[Dict[str, Any]] = []

    for offset in range(1, day_count + 1):
        journey_date = today - dt.timedelta(days=offset)
        history = get_train_history(train_key, journey_date)
        has_actual_events = bool(history.get("station_events"))
        response_days.append({
            "date": journey_date.isoformat(),
            "available": has_actual_events,
            "source": "stored_station_events" if has_actual_events else "scheduled_route",
            "observation_count": history.get("observation_count", 0),
            "comparison_count": history.get("comparison_count", 0),
            "note": (
                "Stored provider station events for this journey."
                if has_actual_events
                else "No stored run for this date; showing the scheduled timetable only."
            ),
            "timetable": _history_rows(history, stops),
        })

    return {"train_number": train_key, "train_name": train_name, "days": response_days}


@router.get("/{train_number}/live-eta", response_model=TrainETAResponse)
async def get_live_eta(train_number: str, date: Optional[str] = None):
    """Fetch IndianRailAPI status and feed its station/delay into the ETA model."""
    train_key = str(train_number).strip()
    try:
        requested_date = dt.date.fromisoformat(date) if date else None
    except ValueError as error:
        raise HTTPException(status_code=422, detail="date must use YYYY-MM-DD") from error
    await _refresh_official_route(train_key)
    journey_date = resolve_journey_date(train_key, requested_date)
    try:
        status = await fetch_live_status(train_key, journey_date)
    except LiveStatusUnavailable as error:
        raise HTTPException(status_code=503, detail="Live status is unavailable: configure an authorised provider") from error
    except LiveStatusInvalid as error:
        raise HTTPException(status_code=502, detail="Live-status provider returned unusable data") from error
    _apply_provider_route(train_key, status)
    get_train_stops(train_key)
    weather = await _weather_for_status(status)
    try:
        eta = get_train_eta(
            train_number=train_key,
            date=(journey_date or dt.date.today()).isoformat(),
            current_station=status.current_station,
            current_delay=status.current_delay_minutes,
            speed_kmh=status.speed_kmh, current_latitude=status.latitude,
            current_longitude=status.longitude, observed_at=status.observed_at,
        )
    except HTTPException as error:
        raise HTTPException(status_code=502, detail=f"Live status cannot be mapped to the local ETA route: {error.detail}") from error
    eta.current_location.update({
        "journey_date": (journey_date or dt.date.today()).isoformat(),
        "reported_delay_minutes": status.current_delay_minutes,
        "status_observed_at": status.observed_at.isoformat(),
        "status_provider": status.provider,
        "position_available": status.latitude is not None,
        "latitude": status.latitude,
        "longitude": status.longitude,
        "speed_kmh": status.speed_kmh,
    })
    eta.current_location["weather"] = weather.public_dict() if weather else None
    eta.current_location["feedback"] = _record_feedback(
        train_key, journey_date or dt.date.today(), status, eta, weather
    )
    return eta


@router.get("/{train_number}/route-geometry")
async def get_route_geometry(train_number: str):
    """Return verified railway track geometry without exposing provider credentials."""
    try:
        return {
            "train_number": str(train_number).strip(),
            "route": await fetch_train_route_geometry(train_number),
        }
    except LiveStatusUnavailable as error:
        raise HTTPException(status_code=503, detail="Railway route geometry is unavailable: configure RailRadar") from error
    except LiveStatusInvalid as error:
        raise HTTPException(status_code=502, detail="RailRadar returned unusable route geometry") from error


@router.get("/{train_number}/live-stream")
async def stream_live_gps(train_number: str, request: Request, date: Optional[str] = None):
    """Stream verified live records from a configured authorised status provider."""
    train_key = str(train_number).strip()
    try:
        requested_date = dt.date.fromisoformat(date) if date else None
    except ValueError as error:
        raise HTTPException(status_code=422, detail="date must use YYYY-MM-DD") from error
    await _refresh_official_route(train_key)
    journey_date = resolve_journey_date(train_key, requested_date)
    try:
        first_status = await fetch_live_status(train_key, journey_date)
    except LiveStatusUnavailable as error:
        raise HTTPException(status_code=503, detail="Live status is unavailable: configure an authorised Railway/CRIS provider") from error
    except LiveStatusInvalid as error:
        raise HTTPException(status_code=502, detail="Live-status provider returned unusable data") from error
    _apply_provider_route(train_key, first_status)
    train_name, stops = get_train_stops(train_key)

    async def event_generator():
        status = first_status
        while not await request.is_disconnected():
            next_station = status.next_station or _next_station(stops, status.current_station)
            weather = await _weather_for_status(status)
            payload = {
                "train_number": train_key,
                "train_name": train_name,
                "journey_date": journey_date.isoformat(),
                "timestamp": status.observed_at.isoformat(),
                "gps": {
                    "latitude": status.latitude,
                    "longitude": status.longitude,
                    "position_available": status.latitude is not None,
                    "speed_kmh": status.speed_kmh,
                    "rtis_device_status": "LIVE",
                    "data_source": status.provider,
                    "weather": weather.public_dict() if weather else None,
                },
                "sector_telemetry": {
                    "current_station": status.current_station,
                    "next_station": next_station,
                },
                "dynamic_eta": {
                    "reported_delay_minutes": status.current_delay_minutes,
                    "source": status.provider,
                    "model_forecast": _model_eta_payload(train_key, journey_date, status, weather),
                },
            }
            yield f"data: {json.dumps(payload)}\n\n"
            await asyncio.sleep(POLL_SECONDS)
            try:
                status = await fetch_live_status(train_key, journey_date)
            except LiveStatusUnavailable:
                yield "event: status\ndata: {\"availability\": \"unavailable\"}\n\n"
                return
            except LiveStatusInvalid:
                yield "event: status\ndata: {\"availability\": \"invalid_provider_data\"}\n\n"
                return

    return StreamingResponse(event_generator(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
