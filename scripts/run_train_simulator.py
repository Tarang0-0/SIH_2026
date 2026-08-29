#!/usr/bin/env python3
"""
RailETA Real-Time Train Simulator Runner CLI
Problem Statement: SIH26028 (Dynamic Forecast of ETA for Coaching Trains)

Runs the train simulator loop in terminal, printing live train physics, section progress,
delay drift, and triggering dynamic ML ETA forecasts on station events.
"""

import os
import sys
import time
import asyncio
from datetime import datetime, timezone

# Add backend directory to sys.path
script_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(script_dir)
sys.path.insert(0, os.path.join(project_root, "backend"))

from app.services.train_simulator import TrainSimulatorManager
from ml.predictor import ETAPredictor


async def run_simulation_demo():
    print("=" * 80)
    print(" RailETA Real-Time Train Movement Simulator (SIH26028) ")
    print("=" * 80)

    # Initialize Simulator and ML Predictor
    sim_manager = TrainSimulatorManager()
    train_number = "12302"  # Howrah Rajdhani Express
    journey_id = f"J_{train_number}"

    # Start Howrah Rajdhani with an initial 10-minute delay
    train = sim_manager.start_train(
        train_number=train_number,
        journey_id=journey_id,
        initial_delay_minutes=10.0,
    )
    predictor = ETAPredictor()

    print(f"Active Simulated Train: {train.train_name} ({train.train_number})")
    print(f"Train Type: {train.train_type} | Initial Delay: +{train.current_delay_min} min | Max Speed: {train.max_speed} km/h")
    print(f"Route Sections: {len(train.sections)} stops along NDLS -> CNB -> PRYJ -> DDU -> GAYA -> DHN -> HWH")
    print("-" * 80)
    print(f"{'Sim Time':<10} | {'Status':<12} | {'Section':<14} | {'Speed':<10} | {'Progress':<18} | {'Delay':<8} | {'ML Next Station ETA'}")
    print("-" * 80)

    # Simulate 20 ticks at 120x acceleration (each 0.5s real time = 60s simulated train time)
    step = 0
    while not train.is_completed and step < 25:
        step += 1
        # Advance train by 180 seconds (3 virtual minutes)
        event = train.tick(elapsed_sim_seconds=180.0)

        sim_time_str = datetime.fromisoformat(event["timestamp"]).strftime("%H:%M:%S")
        sec_prog = event["section_progress"]
        status = event["status"]
        speed = f"{event['speed_kmph']} km/h"
        section_name = f"{sec_prog['from_station']} -> {sec_prog['to_station']}"
        progress_str = f"{sec_prog['traversed_km']:5.1f}/{sec_prog['section_distance_km']:5.1f}km ({sec_prog['progress_percentage']}%)"
        delay_str = f"+{event['delay_minutes']}m"

        # If train reaches station or departs, trigger ML prediction
        ml_eta_display = "---"
        if event["event_type"] in ["STATION_ARRIVAL", "STATION_DEPARTURE", "IN_TRANSIT"]:
            sec_event = {
                "train_type": event["train_type"],
                "station_code": sec_prog["from_station"],
                "next_station_code": sec_prog["to_station"],
                "distance_km": sec_prog["remaining_km"],
                "scheduled_run_time_min": max(5.0, (sec_prog["remaining_km"] / 100.0) * 60.0),
                "departure_hour": event["operational_context"]["departure_hour"],
                "day_of_week": event["operational_context"]["day_of_week"],
                "departure_delay_min": event["delay_minutes"],
                "section_congestion_level": event["operational_context"]["section_congestion_level"],
                "weather_impact_flag": event["operational_context"]["weather_impact_flag"],
            }
            pred = predictor.predict_section(sec_event)
            ml_eta_display = f"In {pred['predicted_run_time_min']}m [{pred['lower_bound_min']}-{pred['upper_bound_min']}m]"

        print(f"{sim_time_str:<10} | {status:<12} | {section_name:<14} | {speed:<10} | {progress_str:<18} | {delay_str:<8} | {ml_eta_display}")

        # At step 10, simulate an unplanned signal disruption (+15 minutes) to show dynamic response
        if step == 10:
            print(" >>> [INCIDENT SIMULATION]: Unplanned Signal Hold-Up ahead! Injecting +15.0m delay...")
            train.inject_disruption(additional_delay_min=15.0)

        await asyncio.sleep(0.3)  # Fast visual display

    print("=" * 80)
    print("[+] Train Movement Simulator self-test completed successfully!")


if __name__ == "__main__":
    asyncio.run(run_simulation_demo())
