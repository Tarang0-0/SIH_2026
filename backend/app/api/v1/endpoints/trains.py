"""
RailETA Trains & Real-Time Telemetry API Endpoints
Problem Statement: SIH26028 (Dynamic Forecast of ETA for Coaching Trains)

Provides modular endpoints for:
1. Getting active trains and specific train running state
2. Ingesting and updating real-time train state updates
3. Requesting dynamic ML ETA forecasts
4. Fetching chronological ETA prediction history
5. Recording physical station arrivals and evaluating longitudinal accuracy
"""

import logging
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, Query, Path, status

from app.schemas.train_api import (
    TrainStateResponse,
    TrainStateUpdateRequest,
    TrainStateUpdateResponse,
    DetailedETAPredictionResponse,
    StationETAItem,
    PredictionHistoryResponse,
    PredictionHistorySnapshot,
    AIExplainRequest,
    AIExplanationResponse,
)
from app.services.eta_inference_service import eta_inference_service, TrainStateInput
from app.services.train_simulator import SIMULATION_ROUTES, simulator_manager
from app.services.concurrent_store import journey_store
from app.services.prediction_history import record_prediction_snapshot, get_journey_prediction_history
from app.db.repository import db_repository

logger = logging.getLogger("raileta.trains_router")
router = APIRouter()


class ActualArrivalRequest(BaseModel):
    station_code: str = Field(..., min_length=2, max_length=6, description="Station code arrived at (e.g. PRYJ)")
    actual_arrival_time: datetime = Field(..., description="Actual arrival timestamp")
    scheduled_arrival_time: datetime = Field(..., description="Scheduled arrival timestamp")
    actual_delay_minutes: float = Field(..., description="Actual observed delay in minutes upon arrival")


def _resolve_train_meta(identifier: str):
    """Helper to resolve train number and metadata from ID."""
    clean_id = identifier.replace("J_", "").replace("J", "").strip()
    if clean_id in SIMULATION_ROUTES:
        return clean_id, SIMULATION_ROUTES[clean_id]
    return "12302", SIMULATION_ROUTES["12302"]


def _get_active_state(journey_id: str, train_num: str, route_meta: dict) -> dict:
    """Helper to fetch or seed live state from memory/simulator."""
    stored = journey_store.get(journey_id)
    if stored:
        return stored

    first_sec = route_meta["sections"][0]
    initial_state = {
        "journey_id": journey_id,
        "train_number": train_num,
        "train_name": route_meta["train_name"],
        "train_type": route_meta["train_type"],
        "current_station": first_sec["from_station"],
        "next_station": first_sec["to_station"],
        "current_delay_minutes": 0.0,
        "current_speed_kmph": float(route_meta["cruise_speed_kmh"]),
        "distance_to_next_station_km": float(first_sec["distance_km"]),
        "status": "IN_TRANSIT",
        "last_update_timestamp": datetime.now(timezone.utc),
        "data_source": "SIMULATED",
    }
    journey_store.put(journey_id, initial_state)
    return initial_state


# ==============================================================================
# 1. GET ACTIVE TRAINS & SINGLE TRAIN STATE
# ==============================================================================

@router.get(
    "/trains",
    response_model=List[TrainStateResponse],
    summary="List all active coaching trains",
    description="Returns the live running state, current position, speed, and delay of all active trains.",
)
def get_active_trains():
    active_list = []
    for t_num, meta in SIMULATION_ROUTES.items():
        jid = f"J_{t_num}"
        st = _get_active_state(jid, t_num, meta)
        active_list.append(TrainStateResponse(
            journey_id=st.get("journey_id", jid),
            train_number=st.get("train_number", t_num),
            train_name=st.get("train_name", meta["train_name"]),
            train_type=st.get("train_type", meta["train_type"]),
            current_station_code=st.get("current_station", meta["sections"][0]["from_station"]),
            next_station_code=st.get("next_station", meta["sections"][0]["to_station"]),
            current_speed_kmh=float(st.get("current_speed_kmph", 0.0)),
            current_delay_minutes=float(st.get("current_delay_minutes", 0.0)),
            distance_to_next_station_km=float(st.get("distance_to_next_station_km", meta["sections"][0]["distance_km"])),
            status=st.get("status", "IN_TRANSIT"),
            last_update_timestamp=st.get("last_update_timestamp", datetime.now(timezone.utc)),
            data_source=st.get("data_source", "SIMULATED"),
        ))
    return active_list


@router.get(
    "/trains/{id}",
    response_model=TrainStateResponse,
    summary="Get current state of a specific train",
    description="Fetches instantaneous speed, delay, current station, and next station for a train or journey ID.",
)
def get_train_state(
    id: str = Path(..., description="Train number (e.g. 12302) or Journey ID (e.g. J_12302)")
):
    t_num, meta = _resolve_train_meta(id)
    jid = id if id.startswith("J") else f"J_{t_num}"
    st = _get_active_state(jid, t_num, meta)

    return TrainStateResponse(
        journey_id=st.get("journey_id", jid),
        train_number=st.get("train_number", t_num),
        train_name=st.get("train_name", meta["train_name"]),
        train_type=st.get("train_type", meta["train_type"]),
        current_station_code=st.get("current_station", meta["sections"][0]["from_station"]),
        next_station_code=st.get("next_station", meta["sections"][0]["to_station"]),
        current_speed_kmh=float(st.get("current_speed_kmph", 0.0)),
        current_delay_minutes=float(st.get("current_delay_minutes", 0.0)),
        distance_to_next_station_km=float(st.get("distance_to_next_station_km", meta["sections"][0]["distance_km"])),
        status=st.get("status", "IN_TRANSIT"),
        last_update_timestamp=st.get("last_update_timestamp", datetime.now(timezone.utc)),
        data_source=st.get("data_source", "SIMULATED"),
    )


# ==============================================================================
# 2. UPDATE REAL-TIME TRAIN STATE & PERSIST
# ==============================================================================

@router.post(
    "/trains/update",
    response_model=TrainStateUpdateResponse,
    status_code=status.HTTP_200_OK,
    summary="Send/update real-time train running state",
    description="Ingests telemetry punch, updates in-memory journey state, persists to database, and triggers dynamic ML ETA recalculation.",
)
def update_train_state(payload: TrainStateUpdateRequest):
    from app.services.dynamic_workflow import DynamicETAOrchestrator
    result = DynamicETAOrchestrator.process_update(payload)

    t_num, meta = _resolve_train_meta(payload.journey_id)
    jid = payload.journey_id if payload.journey_id.startswith("J") else f"J_{t_num}"
    event_time = payload.timestamp or datetime.now(timezone.utc)

    state_resp = TrainStateResponse(
        journey_id=jid,
        train_number=t_num,
        train_name=meta["train_name"],
        train_type=meta["train_type"],
        current_station_code=payload.current_station,
        next_station_code=payload.next_station,
        current_speed_kmh=payload.speed_kmh,
        current_delay_minutes=payload.delay_minutes,
        distance_to_next_station_km=payload.distance_remaining_km or 100.0,
        status="STOPPED" if payload.speed_kmh == 0 else "IN_TRANSIT",
        last_update_timestamp=event_time,
        data_source=payload.source,
    )

    drift_info = result["eta_drift_comparison"]
    return TrainStateUpdateResponse(
        status="success",
        message=f"[{drift_info['drift_direction']}] {drift_info['summary']}",
        journey_id=jid,
        train_number=t_num,
        updated_state=state_resp,
        latest_predicted_eta=result["immediate_next_station_forecast"]["predicted_arrival_time"],
        predicted_delay_minutes=result["immediate_next_station_forecast"]["predicted_section_duration_min"],
        prediction_recorded=True,
    )


# ==============================================================================
# 3. GET DYNAMIC ML ETA PREDICTION (MULTI-STOP CASCADE)
# ==============================================================================

@router.get(
    "/trains/{id}/eta",
    response_model=DetailedETAPredictionResponse,
    summary="Get latest dynamic ML ETA forecast",
    description="Returns cascading station-by-station ETA predictions, baseline comparison, uncertainty bounds, and explainability factors.",
)
def get_dynamic_eta(
    id: str = Path(..., description="Train number or Journey ID")
):
    t_num, meta = _resolve_train_meta(id)
    jid = id if id.startswith("J") else f"J_{t_num}"
    st = _get_active_state(jid, t_num, meta)

    curr_stn = st.get("current_station", meta["sections"][0]["from_station"])
    curr_delay = float(st.get("current_delay_minutes", 0.0))
    event_time = st.get("last_update_timestamp", datetime.now(timezone.utc))

    remaining_secs = []
    found_curr = False
    for sec in meta["sections"]:
        if sec["from_station"] == curr_stn or found_curr:
            found_curr = True
            remaining_secs.append(sec)

    if not remaining_secs:
        remaining_secs = meta["sections"]

    timeline_raw = eta_inference_service.predict_multi_station_timeline(
        journey_id=jid,
        train_number=t_num,
        train_type=meta["train_type"],
        current_station=curr_stn,
        current_delay_min=curr_delay,
        departure_time=event_time,
        remaining_stops=remaining_secs,
        data_source=st.get("data_source", "SIMULATED"),
    )

    # Persist all multi-stop predictions to DB
    pred_records = [
        {
            "station_code": item["station_code"],
            "predicted_eta": item["predicted_eta"],
            "baseline_eta": item["baseline_eta"],
            "predicted_delay_minutes": item["delay_drift_min"],
            "lower_bound_minutes": -3.6,
            "upper_bound_minutes": +3.6,
        }
        for item in timeline_raw
    ]
    db_repository.save_eta_predictions(
        journey_id=jid,
        train_number=t_num,
        predictions=pred_records,
        prediction_timestamp=event_time,
        model_version=eta_inference_service.model_type,
        data_source=st.get("data_source", "SIMULATED"),
    )

    items: List[StationETAItem] = []
    for idx, item in enumerate(timeline_raw, start=1):
        items.append(StationETAItem(
            station_code=item["station_code"],
            station_name=f"Station {item['station_code']}",
            sequence_number=idx,
            distance_km=item["distance_km"],
            scheduled_arrival=item["predicted_eta"],
            scheduled_departure=item["predicted_eta"],
            baseline_eta=item["baseline_eta"],
            predicted_eta=item["predicted_eta"],
            predicted_delay_minutes=item["delay_drift_min"],
            confidence_lower_eta=item["confidence_lower"],
            confidence_upper_eta=item["confidence_upper"],
            lower_bound_minutes=-3.6,
            upper_bound_minutes=+3.6,
            explainability=item["explainability"],
            model_version=eta_inference_service.model_type,
            data_source=st.get("data_source", "SIMULATED"),
        ))

    summary_text = (
        f"Dynamic ML forecast for {meta['train_name']} ({t_num}). "
        f"Forecasts {len(items)} upcoming station stops using zero-leakage GBDT regression."
    )

    return DetailedETAPredictionResponse(
        journey_id=jid,
        train_number=t_num,
        train_name=meta["train_name"],
        train_type=meta["train_type"],
        current_station_code=curr_stn,
        next_station_code=st.get("next_station", meta["sections"][0]["to_station"]),
        current_delay_minutes=curr_delay,
        current_speed_kmh=float(st.get("current_speed_kmph", 0.0)),
        last_update_timestamp=event_time,
        predictions=items,
        overall_summary=summary_text,
        model_version=eta_inference_service.model_type,
        data_source=st.get("data_source", "SIMULATED"),
    )


# ==============================================================================
# 4. PREDICTION HISTORY
# ==============================================================================

@router.get(
    "/trains/{id}/history",
    response_model=PredictionHistoryResponse,
    summary="Get ETA prediction history for journey",
    description="Returns chronological snapshot history showing how dynamic ETAs adapted as new telemetry updates arrived.",
)
def get_prediction_history(
    id: str = Path(..., description="Train number or Journey ID")
):
    t_num, meta = _resolve_train_meta(id)
    jid = id if id.startswith("J") else f"J_{t_num}"
    history_records = get_journey_prediction_history(jid)

    snapshots = [
        PredictionHistorySnapshot(
            snapshot_id=rec["snapshot_id"],
            timestamp=rec["timestamp"],
            train_station=rec["train_station"],
            reported_delay_min=rec["reported_delay_min"],
            reported_speed_kmh=rec["reported_speed_kmh"],
            destination_station=rec["destination_station"],
            destination_baseline_eta=rec["destination_baseline_eta"],
            destination_predicted_eta=rec["destination_predicted_eta"],
            predicted_delay_at_destination_min=rec["predicted_delay_at_destination_min"],
            primary_driving_factor=rec["primary_driving_factor"],
        )
        for rec in history_records
    ]

    return PredictionHistoryResponse(
        journey_id=jid,
        train_number=t_num,
        train_name=meta["train_name"],
        total_snapshots=len(snapshots),
        history=snapshots,
    )


# ==============================================================================
# 5. RECORD PHYSICAL ARRIVAL & RECONCILE ACCURACY
# ==============================================================================

@router.post(
    "/trains/{id}/record-arrival",
    summary="Record physical ground-truth station arrival",
    description="Records ground truth arrival punch, reconciles all prior predictions for this station, and calculates accuracy improvements.",
)
def record_station_arrival(
    id: str,
    payload: ActualArrivalRequest,
):
    t_num, meta = _resolve_train_meta(id)
    jid = id if id.startswith("J") else f"J_{t_num}"

    eval_result = db_repository.record_actual_arrival(
        journey_id=jid,
        train_number=t_num,
        station_code=payload.station_code,
        actual_arrival_time=payload.actual_arrival_time,
        scheduled_arrival_time=payload.scheduled_arrival_time,
        actual_delay_minutes=payload.actual_delay_minutes,
    )

    return {
        "status": "success",
        "journey_id": jid,
        "train_number": t_num,
        "arrival_result": eval_result,
    }


@router.get(
    "/trains/{id}/accuracy-analytics",
    summary="Get longitudinal accuracy analytics",
    description="Returns empirical error reduction breakdown by lead-time windows (e.g. >2h, 1-2h, 30-60m, <30m).",
)
def get_accuracy_analytics(
    id: str,
):
    t_num, meta = _resolve_train_meta(id)
    jid = id if id.startswith("J") else f"J_{t_num}"
    analytics = db_repository.get_accuracy_analytics(journey_id=jid)
    return {
        "journey_id": jid,
        "train_number": t_num,
        "analytics": analytics,
    }


# ==============================================================================
# 6. OPTIONAL AI EXPLANATION LAYER (LLM / Fallback)
# ==============================================================================

@router.post(
    "/trains/{id}/ai-explain",
    response_model=AIExplanationResponse,
    summary="Generate AI natural language explanation of ETA forecast",
    description="Uses an LLM (with zero-latency rule engine fallback) to explain why the ETA shifted and provide passenger-friendly insights. Does NOT calculate numbers.",
)
def get_ai_explanation(
    id: str = Path(..., description="Train number or Journey ID"),
    payload: Optional[AIExplainRequest] = None,
):
    from app.services.llm_explainer import ai_explainer_service

    t_num, meta = _resolve_train_meta(id)
    jid = id if id.startswith("J") else f"J_{t_num}"
    st = _get_active_state(jid, t_num, meta)

    target_stn = payload.station_code if (payload and payload.station_code) else st.get("next_station", meta["sections"][0]["to_station"])
    curr_stn = st.get("current_station", meta["sections"][0]["from_station"])
    curr_delay = float(st.get("current_delay_minutes", 0.0))
    curr_speed = float(st.get("current_speed_kmph", 100.0))
    dest_stn = meta["sections"][-1]["to_station"]

    # Compute immediate prediction to feed into LLM as facts
    sched_min = 120.0
    dist_km = 100.0
    for sec in meta["sections"]:
        if sec["from_station"] == curr_stn:
            sched_min = float(sec["scheduled_min"])
            dist_km = float(sec["distance_km"])
            break

    state_input = TrainStateInput(
        journey_id=jid,
        train_number=t_num,
        train_type=meta["train_type"],
        current_station_code=curr_stn,
        next_station_code=target_stn,
        distance_to_next_station_km=dist_km,
        scheduled_section_duration_min=sched_min,
        current_delay_minutes=curr_delay,
        current_speed_kmh=curr_speed,
        departure_timestamp=st.get("last_update_timestamp", datetime.now(timezone.utc)),
    )
    pred_res = eta_inference_service.predict_section_eta(state_input)

    ai_exp = ai_explainer_service.generate_explanation(
        train_number=t_num,
        train_name=meta["train_name"],
        train_type=meta["train_type"],
        current_station=curr_stn,
        next_station=target_stn,
        destination_station=dest_stn,
        current_speed_kmh=curr_speed,
        current_delay_min=curr_delay,
        scheduled_eta_str=pred_res.departure_time[:16],
        baseline_eta_str=pred_res.baseline_eta[:16],
        predicted_eta_str=pred_res.predicted_eta[:16],
        delay_drift_min=pred_res.predicted_delay_drift_min,
        confidence_range=[
            pred_res.confidence_interval["lower_bound_minutes"],
            pred_res.confidence_interval["upper_bound_minutes"],
        ],
        operational_factors=pred_res.explainability["driving_factors"],
        section_congestion_level=0.65,
        weather_fog_active=False,
    )

    return AIExplanationResponse(
        journey_id=jid,
        train_number=t_num,
        train_name=meta["train_name"],
        target_station=target_stn,
        summary=ai_exp["summary"],
        operational_bullet_points=ai_exp["operational_bullet_points"],
        confidence_assessment=ai_exp["confidence_assessment"],
        passenger_advice=ai_exp["passenger_advice"],
        generated_by=ai_exp["generated_by"],
        is_fallback=ai_exp["is_fallback"],
        data_source=st.get("data_source", "SIMULATED"),
    )
