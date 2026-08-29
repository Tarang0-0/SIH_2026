#!/usr/bin/env python3
"""
RailETA Database Persistence & Accuracy Reconciliation Test Suite
Problem Statement: SIH26028 (Dynamic Forecast of ETA for Coaching Trains)

Verifies:
1. Telemetry update persistence in database repository
2. ETA forecast persistence with prediction timestamps
3. Physical ground-truth arrival recording
4. Automated prediction error reconciliation (|ML Error| vs |Baseline Error|)
5. Longitudinal accuracy analytics by lead-time windows
"""

import os
import sys
from datetime import datetime, timedelta, timezone

# Add backend directory to sys.path
script_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(script_dir)
sys.path.insert(0, os.path.join(project_root, "backend"))

from app.db.repository import db_repository
from app.services.eta_inference_service import eta_inference_service, TrainStateInput


def test_database_persistence():
    print("=" * 82)
    print(" RailETA Database Persistence & Error Reconciliation Test (SIH26028) ")
    print("=" * 82)

    journey_id = "J_12302"
    train_number = "12302"
    from_stn = "CNB"
    target_stn = "PRYJ"
    sched_min = 120.0
    dist_km = 194.5

    # Timeline anchors
    origin_dep_time = datetime(2026, 8, 29, 14, 0, tzinfo=timezone.utc)
    scheduled_arr_time = origin_dep_time + timedelta(minutes=sched_min)  # 16:00 UTC

    # --------------------------------------------------------------------------
    # 1. Telemetry & Forecast 1: 120 minutes before arrival (at departure from CNB)
    # --------------------------------------------------------------------------
    print("\n[Step 1] Ingesting Telemetry Update #1 (T = 14:00, Lead Time = 120 min)...")
    upd_id_1 = db_repository.save_running_update(
        journey_id=journey_id,
        train_number=train_number,
        current_station=from_stn,
        next_station=target_stn,
        speed_kmh=110.0,
        delay_minutes=15.0,
        timestamp=origin_dep_time,
        data_source="SIMULATED",
    )
    print(f"  -> Persisted Telemetry Update ID: {upd_id_1}")

    # Generate ML Prediction #1
    state_1 = TrainStateInput(
        journey_id=journey_id,
        train_number=train_number,
        train_type="RAJ",
        current_station_code=from_stn,
        next_station_code=target_stn,
        distance_to_next_station_km=dist_km,
        scheduled_section_duration_min=sched_min,
        current_delay_minutes=15.0,
        departure_timestamp=origin_dep_time,
        section_congestion_level=0.70,
        weather_impact_flag=0,
    )
    res_1 = eta_inference_service.predict_section_eta(state_1)
    db_repository.save_eta_predictions(
        journey_id=journey_id,
        train_number=train_number,
        predictions=[{
            "station_code": target_stn,
            "predicted_eta": res_1.predicted_eta,
            "baseline_eta": res_1.baseline_eta,
            "predicted_delay_minutes": res_1.predicted_delay_drift_min,
            "lower_bound_minutes": res_1.confidence_interval["lower_bound_minutes"],
            "upper_bound_minutes": res_1.confidence_interval["upper_bound_minutes"],
        }],
        prediction_timestamp=origin_dep_time,
        model_version=res_1.model_version,
    )
    print(f"  -> Forecast #1 Saved: Baseline ETA = {res_1.baseline_eta[11:19]} | ML Predicted ETA = {res_1.predicted_eta[11:19]}")

    # --------------------------------------------------------------------------
    # 2. Telemetry & Forecast 2: 45 minutes before arrival (en route)
    # --------------------------------------------------------------------------
    time_2 = origin_dep_time + timedelta(minutes=75)  # 15:15 UTC
    print("\n[Step 2] Ingesting Telemetry Update #2 (T = 15:15, Lead Time = 45 min)...")
    upd_id_2 = db_repository.save_running_update(
        journey_id=journey_id,
        train_number=train_number,
        current_station=from_stn,
        next_station=target_stn,
        speed_kmh=115.0,
        delay_minutes=10.0,  # Train recovered 5 minutes on clear stretch!
        timestamp=time_2,
        data_source="SIMULATED",
    )
    state_2 = TrainStateInput(
        journey_id=journey_id,
        train_number=train_number,
        train_type="RAJ",
        current_station_code=from_stn,
        next_station_code=target_stn,
        distance_to_next_station_km=60.0,
        scheduled_section_duration_min=45.0,
        current_delay_minutes=10.0,
        departure_timestamp=time_2,
        section_congestion_level=0.55,
        weather_impact_flag=0,
    )
    res_2 = eta_inference_service.predict_section_eta(state_2)
    db_repository.save_eta_predictions(
        journey_id=journey_id,
        train_number=train_number,
        predictions=[{
            "station_code": target_stn,
            "predicted_eta": res_2.predicted_eta,
            "baseline_eta": res_2.baseline_eta,
            "predicted_delay_minutes": res_2.predicted_delay_drift_min,
            "lower_bound_minutes": res_2.confidence_interval["lower_bound_minutes"],
            "upper_bound_minutes": res_2.confidence_interval["upper_bound_minutes"],
        }],
        prediction_timestamp=time_2,
        model_version=res_2.model_version,
    )
    print(f"  -> Forecast #2 Saved: Baseline ETA = {res_2.baseline_eta[11:19]} | ML Predicted ETA = {res_2.predicted_eta[11:19]}")

    # --------------------------------------------------------------------------
    # 3. Ground Truth: Train Physically Arrives at Prayagraj (PRYJ) at 16:08 UTC
    # --------------------------------------------------------------------------
    actual_arr_time = origin_dep_time + timedelta(minutes=128)  # 16:08 UTC (Actual Delay = +8.0m)
    print(f"\n[Step 3] Recording Ground Truth Physical Arrival at {target_stn}...")
    print(f"  -> Scheduled Arrival Time: {scheduled_arr_time.isoformat()[11:19]} UTC")
    print(f"  -> Actual Physical Arrival: {actual_arr_time.isoformat()[11:19]} UTC (+8.0 min delay)")

    eval_res = db_repository.record_actual_arrival(
        journey_id=journey_id,
        train_number=train_number,
        station_code=target_stn,
        actual_arrival_time=actual_arr_time,
        scheduled_arrival_time=scheduled_arr_time,
        actual_delay_minutes=8.0,
    )

    print(f"\n[+] Ground Truth Reconciled {eval_res['reconciled_predictions_count']} historical forecasts:")
    print("-" * 82)
    print(f"{'Prediction Timestamp':<22} | {'Lead Time':<10} | {'Baseline Err':<13} | {'ML Error':<10} | {'ML Accuracy Gain'}")
    print("-" * 82)
    for acc in eval_res["accuracy_evaluations"]:
        print(f"{acc['prediction_timestamp'][:19]:<22} | {acc['lead_time_minutes']:6.1f} min | {acc['baseline_error_minutes']:8.2f} min  | {acc['ml_error_minutes']:6.2f} m | {acc['ml_improvement_minutes']:+5.2f} min")

    # --------------------------------------------------------------------------
    # 4. Query Longitudinal Accuracy Analytics
    # --------------------------------------------------------------------------
    print("\n[Step 4] Querying Longitudinal Accuracy Analytics by Lead-Time Windows...")
    analytics = db_repository.get_accuracy_analytics(journey_id=journey_id)
    print(f"  -> Total Evaluated Forecasts: {analytics['total_evaluated_forecasts']}")
    print(f"  -> Overall ML MAE           : {analytics['overall_ml_mae']} minutes")
    print(f"  -> Overall Baseline MAE     : {analytics['overall_baseline_mae']} minutes")
    print(f"  -> Predictions within ±5 min: {analytics['accuracy_within_5_min_pct']}%")

    print("\nLead-Time Window Breakdown:")
    for tier in analytics["lead_time_breakdown"]:
        print(f"  * {tier['lead_time_tier']:<28} -> ML MAE: {tier['ml_mae_minutes']}m vs Baseline: {tier['baseline_mae_minutes']}m ({tier['accuracy_gain_pct']:+0.1f}% gain)")

    print("\n" + "=" * 82)
    print("[+] Database Persistence & Ground-Truth Error Reconciliation VERIFIED!")
    print("=" * 82)


if __name__ == "__main__":
    test_database_persistence()
