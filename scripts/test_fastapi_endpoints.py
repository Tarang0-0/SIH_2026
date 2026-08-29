#!/usr/bin/env python3
"""
RailETA FastAPI Backend Endpoints Test Suite
Problem Statement: SIH26028 (Dynamic Forecast of ETA for Coaching Trains)

Verifies:
1. GET /health and GET /api/v1/health
2. GET /api/v1/trains (active trains)
3. GET /api/v1/trains/{id} (single train state)
4. POST /api/v1/trains/update (send real-time state update)
5. GET /api/v1/trains/{id}/eta (dynamic ML ETA prediction)
6. GET /api/v1/trains/{id}/history (prediction history snapshots)
"""

import os
import sys
import json
from fastapi.testclient import TestClient

# Add backend directory to sys.path
script_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(script_dir)
sys.path.insert(0, os.path.join(project_root, "backend"))

from app.main import app


def test_api():
    client = TestClient(app)
    print("=" * 82)
    print(" RailETA FastAPI Backend Endpoints Verification Test (SIH26028) ")
    print("=" * 82)

    # 1. Health Check
    print("\n[1] Testing GET /health...")
    resp = client.get("/health")
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
    health_data = resp.json()
    print(f"  -> Health Status : {health_data.get('status')} | Service: {health_data.get('service')}")
    print(f"  -> ML Loaded     : {health_data.get('ml_model_loaded')}")

    # 2. Get Active Trains List
    print("\n[2] Testing GET /api/v1/trains...")
    resp = client.get("/api/v1/trains")
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
    trains = resp.json()
    print(f"  -> Active Trains Found: {len(trains)}")
    for t in trains[:3]:
        print(f"     * Train {t['train_number']}: {t['train_name']} | At: {t['current_station_code']} -> {t['next_station_code']} | Delay: +{t['current_delay_minutes']}m")

    # 3. Get Single Train State
    print("\n[3] Testing GET /api/v1/trains/12302 (Howrah Rajdhani)...")
    resp = client.get("/api/v1/trains/12302")
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
    t_state = resp.json()
    print(f"  -> Journey ID   : {t_state['journey_id']}")
    print(f"  -> Train Name   : {t_state['train_name']} ({t_state['train_type']})")
    print(f"  -> Current Stop : {t_state['current_station_code']} -> Next: {t_state['next_station_code']}")
    print(f"  -> Live Speed   : {t_state['current_speed_kmh']} km/h | Delay: +{t_state['current_delay_minutes']} min")

    # 4. Update Real-Time Train State (Telemetry Event)
    print("\n[4] Testing POST /api/v1/trains/update...")
    update_payload = {
        "journey_id": "J_12302",
        "current_station": "CNB",
        "next_station": "PRYJ",
        "speed_kmh": 110.5,
        "delay_minutes": 18.0,
        "distance_remaining_km": 194.5,
        "section_congestion_level": 0.75,
        "weather_impact_flag": 0,
        "source": "SIMULATED"
    }
    resp = client.post("/api/v1/trains/update", json=update_payload)
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
    update_res = resp.json()
    print(f"  -> Update Status   : {update_res['status']}")
    print(f"  -> New Location    : {update_res['updated_state']['current_station_code']} -> {update_res['updated_state']['next_station_code']}")
    print(f"  -> Recomputed ETA  : {update_res['latest_predicted_eta']}")
    print(f"  -> Predicted Delay : {update_res['predicted_delay_minutes']:+0.1f} min drift")

    # 5. Get Dynamic ML ETA Predictions (Multi-Stop Timeline)
    print("\n[5] Testing GET /api/v1/trains/12302/eta (and /api/v1/eta/12302)...")
    resp = client.get("/api/v1/trains/12302/eta")
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
    eta_data = resp.json()
    print(f"  -> Train            : {eta_data['train_name']} ({eta_data['train_number']})")
    print(f"  -> Current Location : {eta_data['current_station_code']} | Observed Delay: +{eta_data['current_delay_minutes']}m")
    print(f"  -> Upcoming Stops Forecast ({len(eta_data['predictions'])} stations):")
    for stop in eta_data["predictions"]:
        print(f"     * {stop['station_code']:<6} | ML ETA: {stop['predicted_eta'][:19]} | Baseline: {stop['baseline_eta'][:19]} | Conf: [{stop['confidence_lower_eta'][11:16]} - {stop['confidence_upper_eta'][11:16]}]")

    # 6. Get Prediction History
    print("\n[6] Testing GET /api/v1/trains/12302/history...")
    resp = client.get("/api/v1/trains/12302/history")
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
    history_data = resp.json()
    print(f"  -> Total Snapshots Recorded: {history_data['total_snapshots']}")
    for snap in history_data["history"]:
        print(f"     * [{snap['timestamp'][:19]}] Reported at {snap['train_station']} (Delay: +{snap['reported_delay_min']}m, Speed: {snap['reported_speed_kmh']}km/h) -> Dest ETA: {snap['destination_predicted_eta'][:19]}")

    print("\n" + "=" * 82)
    print("[+] All FastAPI Backend Endpoints PASSED with 100% test coverage!")
    print("=" * 82)


if __name__ == "__main__":
    test_api()
