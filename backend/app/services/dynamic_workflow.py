"""
RailETA Dynamic ETA Update Workflow Orchestrator
Problem Statement: SIH26028 (Dynamic Forecast of ETA for Coaching Trains)

Coordinates the closed-loop real-time prediction workflow:
1. Ingests train position / operational telemetry
2. Persists update to DB & journey store
3. Extracts zero-leakage features
4. Executes in-memory GBDT model inference (no retraining)
5. Computes Delta vs Previous ETA (drift in minutes)
6. Persists new prediction & historical snapshot
7. Broadcasts updated forecast via WebSockets to connected dashboards
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, Optional, List, Tuple

from app.schemas.train_api import (
    TrainStateUpdateRequest,
    TrainStateResponse,
    DetailedETAPredictionResponse,
    StationETAItem,
)
from app.services.eta_inference_service import eta_inference_service, TrainStateInput
from app.services.train_simulator import SIMULATION_ROUTES
from app.services.concurrent_store import journey_store
from app.services.prediction_history import record_prediction_snapshot, get_journey_prediction_history
from app.services.websocket_manager import ws_manager
from app.db.repository import db_repository

logger = logging.getLogger("raileta.dynamic_workflow")

# In-memory cache of previous ETA forecasts per journey for delta drift comparison
_PREVIOUS_ETA_CACHE: Dict[str, Dict[str, Any]] = {}


class DynamicETAOrchestrator:
    """
    Coordinates dynamic real-time ETA updates upon receiving train position telemetry.
    """

    @classmethod
    def process_update(cls, update: TrainStateUpdateRequest) -> Dict[str, Any]:
        """
        Executes the 7-step dynamic update loop.
        """
        clean_num = update.journey_id.replace("J_", "").replace("J", "").strip()
        t_num = clean_num if clean_num in SIMULATION_ROUTES else "12302"
        meta = SIMULATION_ROUTES.get(t_num, SIMULATION_ROUTES["12302"])
        jid = update.journey_id if update.journey_id.startswith("J") else f"J_{t_num}"
        event_time = update.timestamp or datetime.now(timezone.utc)
        if event_time.tzinfo is None:
            event_time = event_time.replace(tzinfo=timezone.utc)

        # ----------------------------------------------------------------------
        # Step 1: Store the Real-Time Update in Memory and DB
        # ----------------------------------------------------------------------
        dist_km = update.distance_remaining_km
        sched_min = 120.0
        for sec in meta["sections"]:
            if sec["from_station"] == update.current_station and sec["to_station"] == update.next_station:
                dist_km = dist_km or float(sec["distance_km"])
                sched_min = float(sec["scheduled_min"])
                break
        if dist_km is None:
            dist_km = 100.0

        updated_dict = {
            "journey_id": jid,
            "train_number": t_num,
            "train_name": meta["train_name"],
            "train_type": meta["train_type"],
            "current_station": update.current_station,
            "next_station": update.next_station,
            "current_speed_kmph": float(update.speed_kmh),
            "current_delay_minutes": float(update.delay_minutes),
            "distance_to_next_station_km": float(dist_km),
            "status": "STOPPED" if update.speed_kmh == 0 else "IN_TRANSIT",
            "last_update_timestamp": event_time,
            "data_source": update.source,
        }
        journey_store.put(jid, updated_dict)

        # Persist raw telemetry
        db_repository.save_running_update(
            journey_id=jid,
            train_number=t_num,
            current_station=update.current_station,
            next_station=update.next_station,
            speed_kmh=update.speed_kmh,
            delay_minutes=update.delay_minutes,
            timestamp=event_time,
            data_source=update.source,
        )

        # ----------------------------------------------------------------------
        # Step 2 & 3: Recalculate Features & Run Trained Model (In-Memory)
        # ----------------------------------------------------------------------
        state_input = TrainStateInput(
            journey_id=jid,
            train_number=t_num,
            train_name=meta["train_name"],
            train_type=meta["train_type"],
            current_station_code=update.current_station,
            next_station_code=update.next_station,
            distance_to_next_station_km=dist_km,
            scheduled_section_duration_min=sched_min,
            current_delay_minutes=update.delay_minutes,
            current_speed_kmh=update.speed_kmh,
            departure_timestamp=event_time,
            section_congestion_level=update.section_congestion_level,
            weather_impact_flag=update.weather_impact_flag,
            data_source=update.source,
        )

        # Immediate next-station prediction
        immediate_pred = eta_inference_service.predict_section_eta(state_input)

        # Multi-stop cascading route timeline
        remaining_secs = []
        found_curr = False
        for sec in meta["sections"]:
            if sec["from_station"] == update.current_station or found_curr:
                found_curr = True
                remaining_secs.append(sec)
        if not remaining_secs:
            remaining_secs = meta["sections"]

        timeline = eta_inference_service.predict_multi_station_timeline(
            journey_id=jid,
            train_number=t_num,
            train_type=meta["train_type"],
            current_station=update.current_station,
            current_delay_min=update.delay_minutes,
            departure_time=event_time,
            remaining_stops=remaining_secs,
            data_source=update.source,
        )

        # Final destination prediction
        destination_stop = timeline[-1] if timeline else {
            "station_code": update.next_station,
            "predicted_eta": immediate_pred.predicted_eta,
            "baseline_eta": immediate_pred.baseline_eta,
        }
        new_dest_eta_str = destination_stop["predicted_eta"]
        new_dest_eta_dt = datetime.fromisoformat(new_dest_eta_str)

        # ----------------------------------------------------------------------
        # Step 4 & 5: Compare New ETA with Previous ETA (Delta Drift)
        # ----------------------------------------------------------------------
        prev_forecast = _PREVIOUS_ETA_CACHE.get(jid)
        eta_drift_minutes = 0.0
        drift_direction = "UNCHANGED"
        drift_summary = "Initial dynamic ETA prediction baseline established."

        if prev_forecast is not None:
            prev_dest_eta_dt = datetime.fromisoformat(prev_forecast["destination_predicted_eta"])
            # Delta in minutes: positive = ETA pushed later (more delayed), negative = ETA earlier (recovered)
            eta_drift_minutes = round((new_dest_eta_dt - prev_dest_eta_dt).total_seconds() / 60.0, 1)

            if eta_drift_minutes > 0.5:
                drift_direction = "DELAYED"
                drift_summary = (
                    f"ETA shifted +{eta_drift_minutes} min later at {destination_stop['station_code']} "
                    f"(from {prev_dest_eta_dt.strftime('%H:%M')} to {new_dest_eta_dt.strftime('%H:%M')}). "
                    f"Reason: {immediate_pred.explainability['driving_factors'][0]}"
                )
            elif eta_drift_minutes < -0.5:
                drift_direction = "IMPROVED"
                drift_summary = (
                    f"ETA recovered {abs(eta_drift_minutes)} min earlier at {destination_stop['station_code']} "
                    f"(from {prev_dest_eta_dt.strftime('%H:%M')} to {new_dest_eta_dt.strftime('%H:%M')}). "
                    f"Reason: {immediate_pred.explainability['driving_factors'][0]}"
                )
            else:
                drift_direction = "STABLE"
                drift_summary = f"ETA holding stable at {new_dest_eta_dt.strftime('%H:%M')} (±{abs(eta_drift_minutes)}m variation)."

        # Cache this forecast as previous for subsequent updates
        _PREVIOUS_ETA_CACHE[jid] = {
            "prediction_timestamp": event_time.isoformat(),
            "destination_station": destination_stop["station_code"],
            "destination_predicted_eta": new_dest_eta_str,
            "next_station_code": update.next_station,
            "next_station_predicted_eta": immediate_pred.predicted_eta,
            "reported_delay_min": update.delay_minutes,
        }

        # ----------------------------------------------------------------------
        # Step 6: Store New Prediction in DB & Snapshot History
        # ----------------------------------------------------------------------
        pred_records = [
            {
                "station_code": item["station_code"],
                "predicted_eta": item["predicted_eta"],
                "baseline_eta": item["baseline_eta"],
                "predicted_delay_minutes": item["delay_drift_min"],
                "lower_bound_minutes": -3.6,
                "upper_bound_minutes": +3.6,
            }
            for item in timeline
        ]
        db_repository.save_eta_predictions(
            journey_id=jid,
            train_number=t_num,
            predictions=pred_records,
            prediction_timestamp=event_time,
            model_version=eta_inference_service.model_type,
            data_source=update.source,
        )

        # Append snapshot to history
        record_prediction_snapshot(
            journey_id=jid,
            train_number=t_num,
            current_station=update.current_station,
            reported_delay_min=update.delay_minutes,
            reported_speed_kmh=update.speed_kmh,
            destination_station=destination_stop["station_code"],
            destination_baseline_eta=destination_stop["baseline_eta"],
            destination_predicted_eta=new_dest_eta_str,
            predicted_delay_at_destination_min=immediate_pred.predicted_delay_drift_min,
            primary_driving_factor=immediate_pred.explainability["driving_factors"][0],
            timestamp=event_time,
        )

        # ----------------------------------------------------------------------
        # Step 7: Broadcast via WebSockets & Assemble Response
        # ----------------------------------------------------------------------
        response_payload = {
            "status": "success",
            "journey_id": jid,
            "train_number": t_num,
            "train_name": meta["train_name"],
            "update_event_time": event_time.isoformat(),
            "telemetry": {
                "current_station": update.current_station,
                "next_station": update.next_station,
                "speed_kmh": update.speed_kmh,
                "delay_minutes": update.delay_minutes,
            },
            "immediate_next_station_forecast": {
                "station_code": update.next_station,
                "predicted_arrival_time": immediate_pred.predicted_eta,
                "baseline_arrival_time": immediate_pred.baseline_eta,
                "predicted_section_duration_min": immediate_pred.predicted_run_time_min,
                "confidence_range": [
                    immediate_pred.confidence_interval["lower_bound_minutes"],
                    immediate_pred.confidence_interval["upper_bound_minutes"],
                ],
                "explainability": immediate_pred.explainability["driving_factors"],
            },
            "destination_forecast": {
                "destination_station": destination_stop["station_code"],
                "predicted_arrival_time": new_dest_eta_str,
                "baseline_arrival_time": destination_stop["baseline_eta"],
            },
            "eta_drift_comparison": {
                "drift_direction": drift_direction,
                "drift_minutes": eta_drift_minutes,
                "summary": drift_summary,
                "previous_forecast_timestamp": prev_forecast["prediction_timestamp"] if prev_forecast else None,
            },
            "upcoming_timeline_stops_count": len(timeline),
            "model_version": eta_inference_service.model_type,
            "data_source": update.source,
        }

        # WebSocket real-time broadcast
        try:
            ws_manager.sync_broadcast(jid, {
                "type": "DYNAMIC_ETA_UPDATE",
                "journey_id": jid,
                "train_number": t_num,
                "timestamp": event_time.isoformat(),
                "data": response_payload,
            })
        except Exception as e:
            logger.warning(f"WebSocket broadcast error: {e}")

        return response_payload
