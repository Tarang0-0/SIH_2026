"""Station-aware ETA prediction endpoint."""

import datetime as dt
import json
import logging
import os
import re
from typing import Any, Optional, Tuple
from zoneinfo import ZoneInfo

import numpy as np
import pandas as pd
from fastapi import APIRouter, HTTPException, Query

from api.schemas import StationETADetail, TrainETAResponse
from api.services.coordinates import station_coordinates
from api.services.phase3_dataset import haversine_km, stable_hash
from api.services.phase3_models import predict_phase3
from api.services.phase2_models import predict_phase2
from api.services.phase5_controls import apply_interval_calibration

router = APIRouter(prefix="/api/v1/trains", tags=["ETA Prediction"])
models_ref: dict[str, Any] = {}
explainer_ref: Any = None
feature_defaults_ref: dict[str, float] = {}
TRAIN_ROUTES_INDEX: dict[str, dict[str, Any]] = {}
HISTORICAL_DELAY_RECORDS: dict[str, list[dict[str, Any]]] = {}
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
INDEX_PATH = os.path.join(ROOT_DIR, "data", "train_routes_index.json")
DEFAULTS_PATH = os.path.join(ROOT_DIR, "models", "feature_defaults.json")
HISTORY_PATH = os.path.join(ROOT_DIR, "models", "historical_delay_records.json")
METADATA_PATH = os.path.join(ROOT_DIR, "models", "model_metadata.json")
MODEL_VERSION = "unknown"
logger = logging.getLogger(__name__)
INDIA_TIMEZONE = ZoneInfo("Asia/Kolkata")


def load_train_index(force: bool = False) -> None:
    global TRAIN_ROUTES_INDEX
    if TRAIN_ROUTES_INDEX and not force:
        return
    TRAIN_ROUTES_INDEX = {}
    try:
        with open(INDEX_PATH) as file:
            TRAIN_ROUTES_INDEX = json.load(file)
        print(f"✅ [Namaste Rail] Loaded {len(TRAIN_ROUTES_INDEX)} train routes from index.")
    except (OSError, json.JSONDecodeError) as error:
        print(f"⚠️ [Namaste Rail] Failed to load train index: {error}")


def load_feature_defaults(force: bool = False) -> None:
    global feature_defaults_ref
    if feature_defaults_ref and not force:
        return
    feature_defaults_ref = {}
    try:
        with open(DEFAULTS_PATH) as file:
            loaded = json.load(file)
        if not isinstance(loaded, dict):
            raise ValueError("feature defaults must be an object")
        feature_defaults_ref = {
            str(key): float(value) for key, value in loaded.items()
            if np.isfinite(float(value))
        }
    except (OSError, ValueError, TypeError, json.JSONDecodeError) as error:
        print(f"⚠️ [Namaste Rail] Failed to load feature defaults: {error}")


def load_historical_records(force: bool = False) -> None:
    global HISTORICAL_DELAY_RECORDS
    if HISTORICAL_DELAY_RECORDS and not force:
        return
    HISTORICAL_DELAY_RECORDS = {}
    try:
        with open(HISTORY_PATH) as file:
            loaded = json.load(file)
        if not isinstance(loaded, dict):
            raise ValueError("historical records must be an object")
        HISTORICAL_DELAY_RECORDS = loaded
    except (OSError, ValueError, json.JSONDecodeError):
        pass


def load_model_metadata(force: bool = False) -> None:
    """Load the model identifier used to make each live forecast."""
    global MODEL_VERSION
    if MODEL_VERSION != "unknown" and not force:
        return
    MODEL_VERSION = "unknown"
    try:
        with open(METADATA_PATH, encoding="utf-8") as file:
            loaded = json.load(file)
        if isinstance(loaded, dict) and loaded.get("model_version"):
            MODEL_VERSION = str(loaded["model_version"])
    except (OSError, json.JSONDecodeError, TypeError):
        logger.warning("Model metadata is unavailable; feedback will use version 'unknown'")


load_train_index()
load_feature_defaults()
load_historical_records()
load_model_metadata()


def set_models(models: dict[str, Any], explainer: Any) -> None:
    global models_ref, explainer_ref
    models_ref, explainer_ref = models, explainer


def set_train_route(train_number: str, route: dict[str, Any]) -> None:
    """Replace one local route with a validated official schedule at runtime."""
    train_key = str(train_number).strip()
    if not train_key or not isinstance(route, dict) or not isinstance(route.get("stops"), list):
        raise ValueError("route must contain a train number and stops")
    if len(route["stops"]) < 2:
        raise ValueError("route must contain at least two stops")
    TRAIN_ROUTES_INDEX[train_key] = dict(route)


@router.get("/search", tags=["Train Search"])
def search_trains(q: str = Query("", max_length=100)):
    query, matches = q.strip().lower(), []
    if len(query) < 2:
        return matches
    for train_no, info in TRAIN_ROUTES_INDEX.items():
        if query in train_no or query in info.get("name", "").lower():
            matches.append({"train_number": train_no, "train_name": info.get("name", f"Train {train_no}"),
                            "origin": info.get("source", "Origin"), "dest": info.get("dest", "Destination")})
            if len(matches) == 10:
                break
    return matches


def _parse_clock(value: Any) -> int:
    try:
        hour, minute = str(value).strip()[:5].split(":")
        result = int(hour) * 60 + int(minute)
        if 0 <= result < 1440:
            return result
    except (TypeError, ValueError):
        pass
    raise ValueError(f"invalid timetable time: {value!r}")


def _elapsed_schedule_minutes(stops: list[dict[str, Any]]) -> list[int]:
    """Convert clock-only timetable values to elapsed time, including multi-day trips."""
    clocks = [_parse_clock(stop.get("sched", "")) for stop in stops]
    elapsed, previous, day_offset = [0], clocks[0], 0
    for clock in clocks[1:]:
        candidate = clock + day_offset
        while candidate < previous:
            day_offset += 1440
            candidate = clock + day_offset
        elapsed.append(candidate - clocks[0])
        previous = candidate
    return elapsed


def resolve_journey_date(
    train_number: str,
    requested_date: Optional[dt.date] = None,
    now: Optional[dt.datetime] = None,
) -> dt.date:
    """Keep an overnight journey on its departure date after local midnight.

    Timetable values are clock-only, so both today's and yesterday's departure
    are tested against the route's elapsed duration. An explicit API date
    always wins; otherwise the active journey is the latest candidate whose
    scheduled window contains the current local time.
    """
    if requested_date is not None:
        return requested_date
    info = TRAIN_ROUTES_INDEX.get(str(train_number).strip())
    local_now = (now or dt.datetime.now(INDIA_TIMEZONE))
    if local_now.tzinfo is None:
        local_now = local_now.replace(tzinfo=INDIA_TIMEZONE)
    else:
        local_now = local_now.astimezone(INDIA_TIMEZONE)
    today = local_now.date()
    if not isinstance(info, dict) or not isinstance(info.get("stops"), list) or not info["stops"]:
        return today
    try:
        stops = sorted(info["stops"], key=lambda stop: int(stop.get("seq", 0)))
        elapsed = _elapsed_schedule_minutes(stops)
        departure_minutes = _parse_clock(stops[0].get("sched", "00:00"))
    except (AttributeError, TypeError, ValueError):
        return today
    duration_minutes = max(elapsed[-1], 1)
    # A small grace window covers a late terminal arrival without making an
    # old journey steal a new day's search.
    journey_end_grace = 6 * 60
    for candidate in (today, today - dt.timedelta(days=1)):
        start = dt.datetime.combine(candidate, dt.time()) + dt.timedelta(minutes=departure_minutes)
        start = start.replace(tzinfo=INDIA_TIMEZONE)
        end = start + dt.timedelta(minutes=duration_minutes + journey_end_grace)
        if start <= local_now <= end:
            return candidate
    return today


def _build_features(distance_km: float, num_stops: int, travel_hours: float,
                    departure_hour: int, day_of_week: int, month: int, current_delay: float,
                    current_station: Optional[str] = None) -> dict[str, float]:
    """Works with the safe model and retains compatibility with older artifacts."""
    features = {key: float(value) for key, value in feature_defaults_ref.items()}
    features.update({
        "distance_km": distance_km, "num_scheduled_stops": float(num_stops), "scheduled_travel_hours": travel_hours,
        "departure_hour": float(departure_hour), "day_of_week": float(day_of_week), "month": float(month),
        "current_delay": current_delay,  # ignored by newly trained models; legacy only
        "is_weekend": float(day_of_week >= 5), "is_night_departure": float(departure_hour >= 22 or departure_hour <= 4),
        "is_peak_hour": float(departure_hour in range(6, 9) or departure_hour in range(17, 21)),
        "is_monsoon_season": float(month in (6, 7, 8, 9)), "is_fog_risk": float(month in (12, 1, 2) and departure_hour < 10),
        "fog_risk_score": .6 if month in (12, 1, 2) and departure_hour < 10 else (.2 if month in (12, 1, 2) else 0.0),
        "season_severity_score": {1: .65, 2: .55, 3: .25, 4: .30, 5: .40, 6: .70, 7: .85, 8: .90, 9: .78, 10: .35, 11: .30, 12: .60}[month],
        # The newer station-delay feed has a different target distribution from
        # the historical journey file. Mark live/current-station requests so
        # the retrained model can learn that domain shift explicitly.
        "is_station_feed": float(current_station is not None),
    })
    return features


def _historical_prior(train_number: str, query_date: dt.date) -> Tuple[Optional[float], int]:
    values = []
    for record in HISTORICAL_DELAY_RECORDS.get(train_number, []):
        try:
            if dt.date.fromisoformat(record["date"]) < query_date:
                values.append(float(record["arrival_delay_min"]))
        except (KeyError, TypeError, ValueError):
            continue
    return (float(np.median(values)), len(values)) if values else (None, 0)


def _model_quantiles(features: dict[str, float]) -> tuple[float, float, float, str]:
    if "p50" not in models_ref or models_ref["p50"] is None:
        return 0.0, 0.0, 15.0, "No trained model is loaded; using the reported delay only."
    model = models_ref["p50"]
    expected = list(model.feature_names_in_)
    X = pd.DataFrame([{name: features.get(name, 0.0) for name in expected}], columns=expected)
    try:
        p50 = max(0.0, float(model.predict(X)[0]))
        p10 = float(models_ref.get("p10", model).predict(X)[0])
        p90 = float(models_ref.get("p90", model).predict(X)[0])
    except Exception as error:
        logger.exception("ETA model inference failed")
        raise HTTPException(status_code=503, detail="ETA model is temporarily unavailable") from error
    if not np.isfinite([p10, p50, p90]).all():
        logger.error("ETA model produced non-finite predictions")
        raise HTTPException(status_code=503, detail="ETA model produced an invalid prediction")
    p10, p50, p90, calibration_bucket = apply_interval_calibration(p10, p50, p90, features)
    reason = "Route, timetable, seasonal, and network-risk factors"
    if calibration_bucket:
        reason += "; conformal interval calibration"
    if explainer_ref is not None:
        try:
            reason = explainer_ref.explain_delay(p50, expected, X.iloc[0].values, explainer_ref.get_shap_values(X)[0])
        except Exception:
            pass
    return min(p10, p50), p50, max(p90, p50), reason


def _reason_for_station(reason: str, predicted_delay: float) -> str:
    """Keep the human-readable explanation aligned with the station forecast."""
    return re.sub(
        r"^Predicted \d+-min delay",
        f"Predicted {int(round(predicted_delay))}-min delay",
        reason,
        count=1,
    )


@router.get("/{train_number}/eta", response_model=TrainETAResponse)
def get_train_eta(train_number: str, date: Optional[str] = None, current_station: Optional[str] = None,
                  current_delay: int = 0, speed_kmh: Optional[float] = None,
                  current_latitude: Optional[float] = None, current_longitude: Optional[float] = None,
                  observed_at: Optional[dt.datetime] = None, delay_trend_minutes_per_hour: float = 0.0,
                  dwell_minutes: Optional[float] = None):
    """Predict only the current and downstream stops for a train in service."""
    if not 0 <= current_delay <= 720:
        raise HTTPException(status_code=422, detail="current_delay must be between 0 and 720 minutes")
    train_key = str(train_number).strip()
    try:
        requested_date = dt.date.fromisoformat(date) if date else None
        journey_date = resolve_journey_date(train_key, requested_date)
    except ValueError as error:
        raise HTTPException(status_code=422, detail="date must use YYYY-MM-DD") from error
    info = TRAIN_ROUTES_INDEX.get(train_key)
    if not info or not info.get("stops"):
        raise HTTPException(status_code=404, detail=f"No timetable route found for train {train_key}")
    try:
        stops = sorted(info["stops"], key=lambda stop: int(stop.get("seq", 0)))
    except (AttributeError, TypeError, ValueError) as error:
        raise HTTPException(status_code=422, detail="Route stop sequence is malformed") from error
    try:
        elapsed = _elapsed_schedule_minutes(stops)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=f"Route timetable is malformed: {error}") from error
    station = (current_station or stops[0].get("code", "")).strip().upper()
    current_index = next((i for i, stop in enumerate(stops) if str(stop.get("code", "")).strip().upper() == station), None)
    if current_index is None:
        raise HTTPException(status_code=422, detail=f"Station {station} is not on train {train_key}'s route")

    try:
        distances = [float(stop.get("dist", 0.0) or 0.0) for stop in stops]
    except (AttributeError, TypeError, ValueError) as error:
        raise HTTPException(status_code=422, detail="Route distance data is malformed") from error
    if not np.isfinite(distances).all() or any(distance < 0 for distance in distances):
        raise HTTPException(status_code=422, detail="Route distance data is malformed")
    total_distance, total_minutes = max(max(distances), 1.0), max(elapsed[-1], 1)
    departure_hour = _parse_clock(stops[0].get("sched", "00:00")) // 60
    features = _build_features(total_distance, len(stops), total_minutes / 60, departure_hour,
                               journey_date.weekday(), journey_date.month, float(current_delay), station)
    p10, p50, p90, reason = _model_quantiles(features)
    historic_delay, historic_count = _historical_prior(train_key, journey_date)
    if historic_delay is not None:
        weight = min(.45, .45 * historic_count / (historic_count + 3))
        adjustment = weight * (historic_delay - p50)
        p10, p50, p90 = p10 + adjustment, p50 + adjustment, p90 + adjustment
        reason = f"{reason}; {historic_count} completed prior run(s) for this train also inform the estimate"
    p10, p50, p90 = max(0., p10), max(0., p50), max(0., p90)
    p10, p90 = min(p10, p50), max(p90, p50)

    # Observation anchors the current stop; a static forecast dominates at the route origin and fades at destination.
    remaining_fraction = (total_minutes - elapsed[current_index]) / total_minutes
    destination = [current_delay + remaining_fraction * (prediction - current_delay) for prediction in (p10, p50, p90)]
    destination = [max(0., prediction) for prediction in destination]
    destination[0], destination[2] = min(destination[0], destination[1]), max(destination[2], destination[1])
    journey_start = dt.datetime.combine(journey_date, dt.time()) + dt.timedelta(minutes=_parse_clock(stops[0].get("sched", "00:00")))
    remaining_minutes = max(total_minutes - elapsed[current_index], 1)
    station_responses = []
    for index in range(current_index, len(stops)):
        progress = min(1., max(0., (elapsed[index] - elapsed[current_index]) / remaining_minutes))
        predictions = [max(0., current_delay + progress * (prediction - current_delay)) for prediction in destination]
        predictions[0], predictions[2] = min(predictions[0], predictions[1]), max(predictions[2], predictions[1])
        predicted_time = journey_start + dt.timedelta(minutes=elapsed[index] + round(predictions[1]))
        confidence = int(np.clip(98. - .55 * (predictions[2] - predictions[0]) - 18. * progress, 50., 98.))
        stop = stops[index]
        coordinates = station_coordinates(str(stop.get("code", "")))
        station_reason = (
            "Reported delay at current station"
            if index == current_index
            else _reason_for_station(reason, predictions[1])
        )
        station_responses.append(StationETADetail(
            station_code=str(stop.get("code", "UNK")), station_name=stop.get("name") or stop.get("code", "UNK"),
            distance_km=distances[index], latitude=coordinates[0] if coordinates else None,
            longitude=coordinates[1] if coordinates else None, scheduled_arrival=str(stop.get("sched", ""))[:5],
            predicted_arrival=predicted_time.strftime("%H:%M"), predicted_arrival_datetime=predicted_time.isoformat(),
            delay_minutes=int(round(predictions[1])), p10_delay_minutes=int(round(predictions[0])),
            p90_delay_minutes=int(round(predictions[2])), confidence_percent=confidence,
            delay_reason=station_reason, platform_prediction=None,
        ))
    next_station = stops[current_index + 1].get("code") if current_index + 1 < len(stops) else None
    next_prediction = None
    if current_index + 1 < len(stops) and len(station_responses) > 1:
        next_detail = station_responses[1]
        scheduled_minutes_to_next = int(elapsed[current_index + 1] - elapsed[current_index])
        next_coordinates = station_coordinates(str(stops[current_index + 1].get("code", "")))
        gps_distance = (
            haversine_km(current_latitude, current_longitude, next_coordinates[0], next_coordinates[1])
            if current_latitude is not None and current_longitude is not None and next_coordinates else None
        )
        phase3_prediction = predict_phase3({
            "scheduled_minutes_to_next": float(scheduled_minutes_to_next),
            "current_delay_minutes": float(current_delay),
            "delay_trend_minutes_per_hour": float(delay_trend_minutes_per_hour or 0.0),
            "dwell_minutes": float(dwell_minutes or 0.0),
            "speed_kmh": float(speed_kmh or 0.0), "has_speed": float(speed_kmh is not None),
            "distance_to_next_km": gps_distance if gps_distance is not None else max(0.0, distances[current_index + 1] - distances[current_index]),
            "remaining_scheduled_minutes": float(scheduled_minutes_to_next),
            "current_station_sequence": float(stops[current_index].get("seq", current_index + 1)),
            "next_station_sequence": float(stops[current_index + 1].get("seq", current_index + 2)),
            "train_number_hash": stable_hash(train_key),
            "segment_id_hash": stable_hash(f"{train_key}:{station}:{stops[current_index + 1].get('code', '')}"),
            "is_rescheduled": 0.0, "rescheduled_by_minutes": 0.0,
        })
        if phase3_prediction is None:
            phase3_prediction = predict_phase2({
                "scheduled_minutes_to_next": float(scheduled_minutes_to_next),
                "current_station_sequence": float(stops[current_index].get("seq", current_index + 1)),
                "next_station_sequence": float(stops[current_index + 1].get("seq", current_index + 2)),
                "delay_at_current_minutes": float(current_delay),
                "is_rescheduled": 0.0,
                "rescheduled_by_minutes": 0.0,
            })
        prediction_source = "journey_model_interpolation"
        if phase3_prediction is not None and observed_at is not None:
            prediction_source = phase3_prediction["prediction_source"]
            next_delay = max(0.0, float(current_delay) + phase3_prediction["predicted_delay_change_minutes"])
            next_p10_delay = max(0.0, float(current_delay) + phase3_prediction["p10_delay_change_minutes"])
            next_p90_delay = max(0.0, float(current_delay) + phase3_prediction["p90_delay_change_minutes"])
            next_p10_delay, next_p90_delay = min(next_p10_delay, next_delay), max(next_p90_delay, next_delay)
            predicted_minutes = max(1, int(round(phase3_prediction["predicted_minutes_to_next"])))
            predicted_p10_minutes = max(1, int(round(phase3_prediction["p10_minutes_to_next"])))
            predicted_p90_minutes = max(predicted_minutes, int(round(phase3_prediction["p90_minutes_to_next"])))
            predicted_datetime = observed_at + dt.timedelta(minutes=predicted_minutes)
            next_detail.predicted_arrival = predicted_datetime.strftime("%H:%M")
            next_detail.predicted_arrival_datetime = predicted_datetime.isoformat()
            next_detail.delay_minutes = int(round(next_delay))
            next_detail.p10_delay_minutes = int(round(next_p10_delay))
            next_detail.p90_delay_minutes = int(round(next_p90_delay))
        else:
            predicted_minutes = max(0, scheduled_minutes_to_next + next_detail.delay_minutes - int(current_delay))
        next_prediction = {
            "station_code": next_detail.station_code,
            "station_name": next_detail.station_name,
            "scheduled_arrival": next_detail.scheduled_arrival,
            "predicted_arrival": next_detail.predicted_arrival,
            "predicted_arrival_datetime": next_detail.predicted_arrival_datetime,
            "scheduled_minutes_to_next": scheduled_minutes_to_next,
            "predicted_minutes_to_next": predicted_minutes,
            "predicted_delay_minutes": next_detail.delay_minutes,
            "p10_delay_minutes": next_detail.p10_delay_minutes,
            "p90_delay_minutes": next_detail.p90_delay_minutes,
            "prediction_source": prediction_source,
        }
    return TrainETAResponse(
        train_number=train_key, train_name=info.get("name", f"Train {train_key}"), origin_station=info.get("source"),
        destination_station=info.get("dest"), last_updated=dt.datetime.now(dt.timezone.utc).isoformat(),
        current_location={"station_code": station, "next_station_code": next_station,
                          "route_progress_percent": round(100 * elapsed[current_index] / total_minutes, 1),
                          "next_station_prediction": next_prediction},
        stations=station_responses,
    )
