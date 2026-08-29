#!/usr/bin/env python3
"""
RailETA — Synthetic Historical Train Running Data Generator
Problem Statement: SIH26028 (Dynamic Forecast of ETA for Coaching Trains)

This script generates realistic section-level train traversal data with authentic
railway operational correlations (priority dispatching, peak congestion, weather slowdowns,
upstream delay compounding, and timetable recovery margins).

Target Variable (Y): actual_run_time_min
"""

import os
import random
import numpy as np
import pandas as pd
from datetime import datetime, timedelta

# Set seed for reproducible synthetic data generation
RANDOM_SEED = 42
np.random.seed(RANDOM_SEED)
random.seed(RANDOM_SEED)

# ==============================================================================
# 1. REAL-WORLD RAILWAY SECTION TOPOLOGY (Trunk Corridors)
# ==============================================================================
ROUTES = [
    {
        "train_number": "22436",
        "train_name": "Vande Bharat Express",
        "train_type": "VB",
        "max_speed_kmh": 130.0,
        "priority_level": 1,  # Highest priority (gets green signals)
        "sections": [
            {"from_station": "NDLS", "to_station": "CNB", "distance_km": 440.0, "scheduled_run_time_min": 240.0},
            {"from_station": "CNB", "to_station": "PRYJ", "distance_km": 194.5, "scheduled_run_time_min": 100.0},
            {"from_station": "PRYJ", "to_station": "DDU", "distance_km": 153.0, "scheduled_run_time_min": 90.0},
            {"from_station": "DDU", "to_station": "BSB", "distance_km": 18.0, "scheduled_run_time_min": 25.0},
        ],
    },
    {
        "train_number": "12302",
        "train_name": "Howrah Rajdhani Express",
        "train_type": "RAJ",
        "max_speed_kmh": 130.0,
        "priority_level": 1,  # High priority
        "sections": [
            {"from_station": "NDLS", "to_station": "CNB", "distance_km": 440.0, "scheduled_run_time_min": 285.0},
            {"from_station": "CNB", "to_station": "PRYJ", "distance_km": 194.5, "scheduled_run_time_min": 120.0},
            {"from_station": "PRYJ", "to_station": "DDU", "distance_km": 153.0, "scheduled_run_time_min": 105.0},
            {"from_station": "DDU", "to_station": "GAYA", "distance_km": 205.0, "scheduled_run_time_min": 130.0},
            {"from_station": "GAYA", "to_station": "DHN", "distance_km": 201.0, "scheduled_run_time_min": 140.0},
            {"from_station": "DHN", "to_station": "HWH", "distance_km": 259.0, "scheduled_run_time_min": 200.0},
        ],
    },
    {
        "train_number": "12951",
        "train_name": "Mumbai Rajdhani Express",
        "train_type": "RAJ",
        "max_speed_kmh": 130.0,
        "priority_level": 1,
        "sections": [
            {"from_station": "BCT", "to_station": "ST", "distance_km": 263.0, "scheduled_run_time_min": 160.0},
            {"from_station": "ST", "to_station": "BRC", "distance_km": 129.0, "scheduled_run_time_min": 80.0},
            {"from_station": "BRC", "to_station": "RTM", "distance_km": 261.0, "scheduled_run_time_min": 195.0},
            {"from_station": "RTM", "to_station": "KOTA", "distance_km": 266.0, "scheduled_run_time_min": 155.0},
            {"from_station": "KOTA", "to_station": "MTJ", "distance_km": 324.0, "scheduled_run_time_min": 195.0},
            {"from_station": "MTJ", "to_station": "NDLS", "distance_km": 143.0, "scheduled_run_time_min": 110.0},
        ],
    },
    {
        "train_number": "12004",
        "train_name": "Lucknow Shatabdi Express",
        "train_type": "SF",
        "max_speed_kmh": 110.0,
        "priority_level": 2,  # Superfast priority
        "sections": [
            {"from_station": "NDLS", "to_station": "GZB", "distance_km": 24.5, "scheduled_run_time_min": 38.0},
            {"from_station": "GZB", "to_station": "ALJN", "distance_km": 106.3, "scheduled_run_time_min": 60.0},
            {"from_station": "ALJN", "to_station": "CNB", "distance_km": 308.6, "scheduled_run_time_min": 210.0},
            {"from_station": "CNB", "to_station": "LKO", "distance_km": 71.6, "scheduled_run_time_min": 75.0},
        ],
    },
    {
        "train_number": "12802",
        "train_name": "Purushottam Express",
        "train_type": "EXP",
        "max_speed_kmh": 100.0,
        "priority_level": 3,  # Mail/Express priority
        "sections": [
            {"from_station": "NDLS", "to_station": "CNB", "distance_km": 440.0, "scheduled_run_time_min": 350.0},
            {"from_station": "CNB", "to_station": "PRYJ", "distance_km": 194.5, "scheduled_run_time_min": 150.0},
            {"from_station": "PRYJ", "to_station": "DDU", "distance_km": 153.0, "scheduled_run_time_min": 135.0},
            {"from_station": "DDU", "to_station": "GAYA", "distance_km": 205.0, "scheduled_run_time_min": 165.0},
            {"from_station": "GAYA", "to_station": "BKSC", "distance_km": 149.0, "scheduled_run_time_min": 135.0},
            {"from_station": "BKSC", "to_station": "PURI", "distance_km": 612.0, "scheduled_run_time_min": 520.0},
        ],
    }
]

# High congestion bottleneck junction stations
BOTTLENECK_STATIONS = {"NDLS", "CNB", "PRYJ", "DDU", "GZB", "ST", "BRC", "KOTA"}

# ==============================================================================
# 2. OPERATIONAL SIMULATION LOGIC
# ==============================================================================

def calculate_realistic_run_time(
    distance_km: float,
    scheduled_run_time_min: float,
    departure_hour: int,
    day_of_week: int,
    departure_delay_min: float,
    train_type: str,
    priority_level: int,
    from_station: str,
    to_station: str,
    section_congestion_level: float,
    weather_impact_flag: int
) -> float:
    """
    Computes the actual section running time using realistic operational rules:
    1. Base travel time derived from scheduled timetable speed (includes timetable slack).
    2. Time-of-day peak congestion multiplier (Morning: 08:00-11:00, Evening: 17:00-21:00).
    3. Bottleneck junction entrance/clearance friction.
    4. Upstream delay propagation vs timetable recovery margin.
    5. Weather/fog speed restriction factor.
    6. Gaussian noise (stochastic operational variability).
    """
    # 1. Base run time (timetable includes ~5% built-in recovery buffer)
    base_run_time = scheduled_run_time_min * 0.95

    # 2. Peak Hour Congestion Multiplier
    if 8 <= departure_hour <= 11 or 17 <= departure_hour <= 21:
        # Peak congestion adds extra travel time
        peak_multiplier = 1.0 + (0.08 * section_congestion_level)
    elif 1 <= departure_hour <= 4:
        # Off-peak late night tracks are clear
        peak_multiplier = 0.96
    else:
        # Regular daytime off-peak
        peak_multiplier = 1.0 + (0.02 * section_congestion_level)

    # 3. Weekend Traffic Factor (Fridays & Sundays have higher passenger density)
    weekend_multiplier = 1.02 if day_of_week in [4, 6] else 1.00

    # 4. Junction Delay / Clearance Factor
    junction_delay_min = 0.0
    if from_station in BOTTLENECK_STATIONS or to_station in BOTTLENECK_STATIONS:
        junction_delay_min = float(np.random.uniform(2.0, 8.0) * section_congestion_level)

    # 5. Upstream Delay Impact (Compounding vs Recovery)
    delay_impact_min = 0.0
    if departure_delay_min > 30.0:
        # Late-running trains lose their scheduled dispatch slots
        loop_penalty = 0.06 if priority_level >= 2 else 0.02
        delay_impact_min = float((departure_delay_min * loop_penalty) + np.random.uniform(2.0, 7.0))
    elif 5.0 <= departure_delay_min <= 20.0 and priority_level == 1:
        # Premium trains (Rajdhani/VB) actively attempt recovery
        recovery_minutes = float(np.random.uniform(2.0, 6.0))
        delay_impact_min = -recovery_minutes

    # 6. Weather Impact (Fog/Monsoon visibility speed restrictions)
    weather_multiplier = 1.0
    if weather_impact_flag == 1:
        weather_multiplier = float(np.random.uniform(1.20, 1.35))

    # 7. Stochastic Operational Noise (small random variations)
    random_noise_min = float(np.random.normal(loc=0.0, scale=2.5))

    # Compute raw actual running time
    actual_run_time = (
        (base_run_time * peak_multiplier * weekend_multiplier * weather_multiplier)
        + junction_delay_min
        + delay_impact_min
        + random_noise_min
    )

    # Physical Boundary Safeguards
    min_physical_time = (distance_km / 140.0) * 60.0
    max_physical_time = (distance_km / 20.0) * 60.0

    actual_run_time = max(min_physical_time, min(max_physical_time, actual_run_time))
    return round(float(actual_run_time), 2)


# ==============================================================================
# 3. DATASET GENERATION PIPELINE
# ==============================================================================

def generate_historical_dataset(num_trips: int = 1500) -> pd.DataFrame:
    """
    Generates multi-day historical trip logs by simulating complete end-to-end
    journeys and breaking them into atomic station-to-station section records.
    """
    records = []
    current_date = datetime(2026, 1, 1, 6, 0, 0)
    trip_counter = 1000

    print(f"-> Simulating {num_trips} full multi-station journeys across routes...")

    for trip_idx in range(num_trips):
        trip_counter += 1
        trip_id = f"TRIP-{trip_counter}"

        # Pick a route template
        route = random.choice(ROUTES)
        train_num = route["train_number"]
        train_name = route["train_name"]
        train_type = route["train_type"]
        priority = route["priority_level"]

        # Journey start time (staggered across days)
        current_date += timedelta(hours=random.choice([2, 3, 4, 6]))
        day_of_week = current_date.weekday()
        month = current_date.month

        # Initial source departure delay (most trains start on time or with small delay)
        if np.random.rand() < 0.70:
            current_delay = float(np.clip(np.random.normal(loc=2.0, scale=4.0), 0.0, 20.0))
        else:
            current_delay = float(np.clip(np.random.exponential(scale=20.0), 10.0, 120.0))

        current_trip_time = current_date

        # Traverse sections sequentially in this trip
        for sec in route["sections"]:
            from_stn = sec["from_station"]
            to_stn = sec["to_station"]
            dist_km = sec["distance_km"]
            sched_min = sec["scheduled_run_time_min"]
            dep_hour = current_trip_time.hour

            # Section Congestion Level (0.0 = completely clear, 1.0 = heavy traffic)
            base_congestion = 0.50
            if from_stn in BOTTLENECK_STATIONS or to_stn in BOTTLENECK_STATIONS:
                base_congestion += 0.25
            if 8 <= dep_hour <= 11 or 17 <= dep_hour <= 21:
                base_congestion += 0.20
            congestion_level = round(float(np.clip(base_congestion + np.random.uniform(-0.15, 0.15), 0.1, 0.98)), 2)

            # Weather Impact Flag (Simulating North Indian winter fog in Jan/Feb)
            weather_flag = 0
            if month in [1, 2] and from_stn in ["NDLS", "GZB", "ALJN", "CNB", "PRYJ", "DDU"]:
                if dep_hour <= 9 or dep_hour >= 21:
                    if np.random.rand() < 0.40:
                        weather_flag = 1

            # Compute Target Y: actual_run_time_min
            actual_min = calculate_realistic_run_time(
                distance_km=dist_km,
                scheduled_run_time_min=sched_min,
                departure_hour=dep_hour,
                day_of_week=day_of_week,
                departure_delay_min=current_delay,
                train_type=train_type,
                priority_level=priority,
                from_station=from_stn,
                to_station=to_stn,
                section_congestion_level=congestion_level,
                weather_impact_flag=weather_flag,
            )

            # Append the row record
            records.append({
                "trip_id": trip_id,
                "train_number": train_num,
                "train_name": train_name,
                "train_type": train_type,
                "from_station_code": from_stn,
                "to_station_code": to_stn,
                "distance_km": dist_km,
                "scheduled_run_time_min": sched_min,
                "departure_hour": dep_hour,
                "day_of_week": day_of_week,
                "departure_delay_min": round(current_delay, 1),
                "section_congestion_level": congestion_level,
                "weather_impact_flag": weather_flag,
                "actual_run_time_min": actual_min,  # <-- TARGET (Y)
            })

            # Propagate delay to next section
            section_delay_drift = actual_min - sched_min
            dwell_slack = float(np.random.uniform(-1.0, 2.0))
            current_delay = max(0.0, current_delay + section_delay_drift + dwell_slack)

            # Advance clock for next section
            current_trip_time += timedelta(minutes=actual_min + 5)

    df = pd.DataFrame(records)
    return df


# ==============================================================================
# 4. MAIN EXECUTION & FILE EXPORT
# ==============================================================================

def main():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    output_dir = os.path.join(base_dir, "backend", "ml", "data")
    os.makedirs(output_dir, exist_ok=True)

    full_csv_path = os.path.join(output_dir, "historical_section_runs.csv")
    sample_csv_path = os.path.join(output_dir, "historical_section_runs_sample.csv")

    print("=" * 70)
    print(" RailETA Synthetic Data Generator (SIH26028) ")
    print("=" * 70)

    # 1. Generate full dataset (1,600 simulated journeys -> ~8,000 section records)
    df_full = generate_historical_dataset(num_trips=1600)
    df_full.to_csv(full_csv_path, index=False)
    print(f"\n[+] Full historical dataset created:")
    print(f"    Location: {full_csv_path}")
    print(f"    Total Rows: {len(df_full):,}")
    print(f"    Total Columns: {len(df_full.columns)}")

    # 2. Generate a clean sample dataset (25 rows) for manual inspection
    df_sample = df_full.head(25)
    df_sample.to_csv(sample_csv_path, index=False)
    print(f"\n[+] Sample dataset created for manual review:")
    print(f"    Location: {sample_csv_path}")
    print(f"    Sample Rows: {len(df_sample)}")

    # 3. Print Statistical Overview
    print("\n" + "=" * 70)
    print(" DATASET SUMMARY & CORRELATION CHECK ")
    print("=" * 70)
    print(df_full[["distance_km", "scheduled_run_time_min", "departure_delay_min", "actual_run_time_min"]].describe().round(1))

    print("\nMean Actual Run Time vs Scheduled Run Time by Train Type:")
    type_summary = df_full.groupby("train_type")[["scheduled_run_time_min", "actual_run_time_min"]].mean().round(1)
    print(type_summary)

    print("\nWeather Impact Check (Average Section Run Time in Minutes):")
    weather_summary = df_full.groupby("weather_impact_flag")[["actual_run_time_min"]].mean().round(1)
    print(weather_summary)


if __name__ == "__main__":
    main()
