#!/usr/bin/env python3
"""
RailETA Dynamic ETA Workflow Interactive Demonstration
Problem Statement: SIH26028 (Dynamic Forecast of ETA for Coaching Trains)

Demonstrates how the closed-loop workflow dynamically recalculates ETAs as real-world
operational conditions evolve:
- Telemetry Ingestion -> Feature Recalculation -> In-Memory Model Inference -> Delta Drift Comparison -> Persistence

Demonstrates:
1. Normal departure baseline
2. Congestion slowdown (ETA pushes back)
3. Clear-track speed recovery (ETA pulls forward)
4. Unplanned signal hold-up (ETA updates dynamically)
"""

import os
import sys
import time
from datetime import datetime, timedelta, timezone

# Add backend directory to sys.path
script_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(script_dir)
sys.path.insert(0, os.path.join(project_root, "backend"))

from app.schemas.train_api import TrainStateUpdateRequest
from app.services.dynamic_workflow import DynamicETAOrchestrator


def run_demo():
    print("=" * 86)
    print(" RailETA Dynamic ETA Update Workflow Demonstration (SIH26028) ")
    print("=" * 86)
    print("Demonstrating real-time ETA adaptation as operational conditions shift...\n")

    journey_id = "J_12302"
    train_number = "12302"
    base_time = datetime(2026, 8, 29, 16, 0, tzinfo=timezone.utc)

    # 5 Sequential Real-Time Operational Updates
    operational_events = [
        {
            "step": 1,
            "title": "Origin Departure at New Delhi (NDLS)",
            "current_station": "NDLS",
            "next_station": "CNB",
            "speed_kmh": 105.0,
            "delay_minutes": 0.0,
            "distance_remaining_km": 440.0,
            "section_congestion_level": 0.50,
            "weather_impact_flag": 0,
            "time_offset_min": 0,
        },
        {
            "step": 2,
            "title": "Evening Peak Congestion outside Ghaziabad (GZB)",
            "current_station": "NDLS",
            "next_station": "CNB",
            "speed_kmh": 75.0,
            "delay_minutes": 12.0,  # Train slowed down by junction queue
            "distance_remaining_km": 360.0,
            "section_congestion_level": 0.88,
            "weather_impact_flag": 0,
            "time_offset_min": 55,
        },
        {
            "step": 3,
            "title": "Clear High-Speed Stretch past Aligarh (ALJN)",
            "current_station": "NDLS",
            "next_station": "CNB",
            "speed_kmh": 125.0,  # Rajdhani pilot pushes speed
            "delay_minutes": 8.0,  # Recovered 4 minutes!
            "distance_remaining_km": 250.0,
            "section_congestion_level": 0.40,
            "weather_impact_flag": 0,
            "time_offset_min": 115,
        },
        {
            "step": 4,
            "title": "Unplanned Signal Hold-Up before Kanpur Junction",
            "current_station": "NDLS",
            "next_station": "CNB",
            "speed_kmh": 20.0,  # Crawl speed
            "delay_minutes": 32.0,  # Injected delay
            "distance_remaining_km": 60.0,
            "section_congestion_level": 0.92,
            "weather_impact_flag": 0,
            "time_offset_min": 210,
        },
        {
            "step": 5,
            "title": "Arrival & Departure from Kanpur Central (CNB)",
            "current_station": "CNB",
            "next_station": "PRYJ",
            "speed_kmh": 112.0,
            "delay_minutes": 26.0,  # Dwell slack absorbed 6 minutes
            "distance_remaining_km": 194.5,
            "section_congestion_level": 0.65,
            "weather_impact_flag": 0,
            "time_offset_min": 285,
        },
    ]

    print(f"{'Step':<5} | {'Event Time':<10} | {'Location':<12} | {'Speed':<9} | {'Delay':<8} | {'Destination ETA':<16} | {'Delta vs Prev ETA':<16} | {'Drift Status'}")
    print("-" * 96)

    for evt in operational_events:
        event_time = base_time + timedelta(minutes=evt["time_offset_min"])
        update_req = TrainStateUpdateRequest(
            journey_id=journey_id,
            current_station=evt["current_station"],
            next_station=evt["next_station"],
            speed_kmh=evt["speed_kmh"],
            delay_minutes=evt["delay_minutes"],
            distance_remaining_km=evt["distance_remaining_km"],
            section_congestion_level=evt["section_congestion_level"],
            weather_impact_flag=evt["weather_impact_flag"],
            timestamp=event_time,
            source="SIMULATED",
        )

        t_start = time.perf_counter()
        result = DynamicETAOrchestrator.process_update(update_req)
        inference_latency_ms = (time.perf_counter() - t_start) * 1000.0

        drift = result["eta_drift_comparison"]
        dest_forecast = result["destination_forecast"]
        dest_eta_formatted = datetime.fromisoformat(dest_forecast["predicted_arrival_time"]).strftime("%H:%M:%S")
        time_str = event_time.strftime("%H:%M:%S")
        loc_str = f"{evt['current_station']}->{evt['next_station']}"
        speed_str = f"{evt['speed_kmh']} km/h"
        delay_str = f"+{evt['delay_minutes']}m"
        delta_str = f"{drift['drift_minutes']:+0.1f} min" if drift["drift_minutes"] != 0 else "--- (Baseline)"

        print(f"#{evt['step']:<4} | {time_str:<10} | {loc_str:<12} | {speed_str:<9} | {delay_str:<8} | {dest_eta_formatted:<16} | {delta_str:<16} | [{drift['drift_direction']}]")
        print(f"       ↳ Operational Rationale: {drift['summary']} (Latency: {inference_latency_ms:.1f}ms)\n")

    print("=" * 86)
    print("[+] Dynamic ETA Update Workflow Demonstration Completed Successfully!")
    print("=" * 86)


if __name__ == "__main__":
    run_demo()
