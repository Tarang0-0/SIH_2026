import logging
from datetime import datetime, time, timedelta, timezone
from typing import List
from fastapi import HTTPException
from app.schemas.eta import StationETA, ETAPredictionResponse
from app.services.features import parse_iso_datetime
from app.services.ingestion import MOCK_JOURNEY_STORE, VALID_STATIONS
from app.db.supabase import get_db

logger = logging.getLogger("raileta.baseline")

from app.services.providers.catalog import CORRIDOR_TOPOLOGY as ROUTE_TOPOLOGY, DynamicTrainResolver


def parse_time_str(time_str: str) -> time:
    """Helper to parse HH:MM:SS string."""
    parts = [int(p) for p in time_str.split(':')]
    return time(parts[0], parts[1], parts[2])

def calculate_baseline_eta(journey_id: str, db=None) -> ETAPredictionResponse:
    """
    Computes schedule-based Baseline ETA (Scheduled Arrival + Current Observed Delay)
    for all upcoming stations on the train's route.
    """
    db_client = db or get_db()
    
    # 1. Fetch Journey State
    journey_state = None
    if db_client:
        try:
            res = db_client.table("journeys").select("*, trains(train_number, train_name)").eq("journey_id", journey_id).execute()
            if res.data:
                journey_state = res.data[0]
        except Exception as e:
            logger.error(f"Error fetching journey state from DB: {e}")

    # Fallback to Mock Store if DB record not present
    if not journey_state:
        if journey_id in MOCK_JOURNEY_STORE:
            mock_data = MOCK_JOURNEY_STORE[journey_id]
            journey_state = {
                "journey_id": mock_data["journey_id"],
                "train_number": mock_data["train_number"],
                "train_name": mock_data["train_name"],
                "current_station_code": mock_data["current_station"],
                "next_station_code": mock_data["next_station"],
                "current_delay_minutes": mock_data["current_delay_minutes"],
                "current_speed_kmph": mock_data["current_speed_kmph"],
                "updated_at": mock_data["last_update_timestamp"],
                "journey_date": "2026-08-27",
                "data_source": mock_data["data_source"]
            }
        else:
            clean_num = journey_id.replace("J_", "").replace("J", "")
            synth = DynamicTrainResolver.resolve_train(clean_num)
            MOCK_JOURNEY_STORE[journey_id] = {
                "journey_id": journey_id,
                "train_number": synth["train_number"],
                "train_name": synth["train_name"],
                "current_station": synth["current_station"],
                "next_station": synth["next_station"],
                "current_delay_minutes": synth["delay_minutes"],
                "current_speed_kmph": synth["speed_kmph"],
                "last_update_timestamp": datetime.now(timezone.utc),
                "data_source": synth["data_source"]
            }
            journey_state = {
                "journey_id": journey_id,
                "train_number": synth["train_number"],
                "train_name": synth["train_name"],
                "current_station_code": synth["current_station"],
                "next_station_code": synth["next_station"],
                "current_delay_minutes": synth["delay_minutes"],
                "current_speed_kmph": synth["speed_kmph"],
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "journey_date": "2026-08-27",
                "data_source": synth["data_source"]
            }

    train_num = journey_state.get("train_number", "12004")
    train_name = journey_state.get("train_name", "Lucknow Swarna Shatabdi Express")
    curr_delay = int(journey_state.get("current_delay_minutes", 0))
    curr_speed = float(journey_state.get("current_speed_kmph", 0.0))
    curr_stn = journey_state.get("current_station_code", "NDLS")
    next_stn = journey_state.get("next_station_code", "GZB")
    data_src = journey_state.get("data_source", "SIMULATED")
    
    updated_at_raw = journey_state.get("updated_at")
    last_update_dt = parse_iso_datetime(updated_at_raw)
    
    journey_date_str = journey_state.get("journey_date")
    if journey_date_str:
        try:
            base_date = datetime.strptime(str(journey_date_str), "%Y-%m-%d").date()
        except ValueError:
            base_date = last_update_dt.date()
    else:
        base_date = last_update_dt.date()

    # 2. Lookup Route Stations Topology
    topology = DynamicTrainResolver.resolve_topology(train_num)
    
    # Identify current station sequence
    curr_seq = 1
    for stn_item in topology:
        if stn_item["station_code"] == curr_stn:
            curr_seq = stn_item["sequence"]
            break


    origin_dep_time = parse_time_str(topology[0]["scheduled_departure"])

    # 3. Compute Baseline ETAs for all upcoming stations (sequence > curr_seq)
    predictions: List[StationETA] = []
    
    for stn in topology:
        if stn["sequence"] > curr_seq:
            arr_time = parse_time_str(stn["scheduled_arrival"])
            
            # Handle overnight day roll-over
            day_offset = 0
            if arr_time < origin_dep_time:
                day_offset = 1

            sched_dt = datetime.combine(base_date + timedelta(days=day_offset), arr_time, tzinfo=timezone.utc)
            
            # Baseline ETA = Scheduled Arrival + Current Delay
            baseline_eta_dt = sched_dt + timedelta(minutes=curr_delay)
            
            # Baseline confidence interval residual bounds (preserves negative delay for early arrival)
            lower_bound_mins = float(curr_delay) - 3.0
            upper_bound_mins = float(curr_delay) + 5.0
            
            lower_bound_dt = sched_dt + timedelta(minutes=lower_bound_mins)
            upper_bound_dt = sched_dt + timedelta(minutes=upper_bound_mins)

            station_eta = StationETA(
                station_code=stn["station_code"],
                station_name=stn["station_name"],
                sequence_number=stn["sequence"],
                distance_km=stn["distance_km"],
                scheduled_arrival=stn["scheduled_arrival"],
                scheduled_departure=stn["scheduled_departure"],
                baseline_eta=baseline_eta_dt.isoformat(),
                predicted_eta=baseline_eta_dt.isoformat(),
                predicted_delay_minutes=float(curr_delay),
                confidence_range_lower=lower_bound_dt.isoformat(),
                confidence_range_upper=upper_bound_dt.isoformat(),
                lower_bound_minutes=round(lower_bound_mins, 2),
                upper_bound_minutes=round(upper_bound_mins, 2),
                model_version="baseline-v1.0",
                data_source=data_src
            )
            predictions.append(station_eta)

    # 4. Optional Database Persistence into eta_predictions
    if db_client:
        try:
            for p in predictions:
                db_client.table("eta_predictions").insert({
                    "journey_id": journey_id,
                    "target_station_id": None, # Linked via code in app logic
                    "predicted_arrival_time": p.predicted_eta,
                    "baseline_eta": p.baseline_eta,
                    "predicted_delay_minutes": p.predicted_delay_minutes,
                    "lower_bound_minutes": p.lower_bound_minutes,
                    "upper_bound_minutes": p.upper_bound_minutes,
                    "model_version": "baseline-v1.0",
                    "data_source": data_src
                }).execute()
        except Exception as e:
            logger.warning(f"Failed to persist prediction history: {e}")

    return ETAPredictionResponse(
        journey_id=journey_id,
        train_number=train_num,
        train_name=train_name,
        current_station_code=curr_stn,
        next_station_code=next_stn,
        current_delay_minutes=curr_delay,
        current_speed_kmph=curr_speed,
        last_update_timestamp=last_update_dt,
        predictions=predictions,
        shap_explanation={},
        data_source=data_src
    )

