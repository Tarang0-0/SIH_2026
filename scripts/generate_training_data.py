#!/usr/bin/env python3
"""
RailETA Synthetic Training Data Generator
Generates realistic section-level traversal logs tagged as 'SYNTHETIC' for GBDT model training.
"""

import os
import sys
import numpy as np
import pandas as pd
from typing import cast

# Section definitions based on seeded IR topology
SECTIONS = [
    # 12004 Shatabdi (Train Type 0)
    {
        "train_number": "12004",
        "train_type": "Shatabdi",
        "train_type_encoded": 0,
        "from_station": "NDLS",
        "to_station": "GZB",
        "section_distance_km": 24.5,
        "scheduled_section_minutes": 38.0,
        "historical_avg_running_minutes": 36.0,
        "historical_p90_running_minutes": 42.0,
    },
    {
        "train_number": "12004",
        "train_type": "Shatabdi",
        "train_type_encoded": 0,
        "from_station": "GZB",
        "to_station": "ALJN",
        "section_distance_km": 106.3,
        "scheduled_section_minutes": 59.0,
        "historical_avg_running_minutes": 57.0,
        "historical_p90_running_minutes": 68.0,
    },
    {
        "train_number": "12004",
        "train_type": "Shatabdi",
        "train_type_encoded": 0,
        "from_station": "ALJN",
        "to_station": "CNB",
        "section_distance_km": 308.6,
        "scheduled_section_minutes": 209.0,
        "historical_avg_running_minutes": 205.0,
        "historical_p90_running_minutes": 228.0,
    },
    {
        "train_number": "12004",
        "train_type": "Shatabdi",
        "train_type_encoded": 0,
        "from_station": "CNB",
        "to_station": "LKO",
        "section_distance_km": 71.6,
        "scheduled_section_minutes": 75.0,
        "historical_avg_running_minutes": 72.0,
        "historical_p90_running_minutes": 85.0,
    },
    # 12951 Rajdhani (Train Type 1)
    {
        "train_number": "12951",
        "train_type": "Rajdhani",
        "train_type_encoded": 1,
        "from_station": "BCT",
        "to_station": "ST",
        "section_distance_km": 263.0,
        "scheduled_section_minutes": 162.0,
        "historical_avg_running_minutes": 158.0,
        "historical_p90_running_minutes": 172.0,
    },
    {
        "train_number": "12951",
        "train_type": "Rajdhani",
        "train_type_encoded": 1,
        "from_station": "ST",
        "to_station": "BRC",
        "section_distance_km": 129.0,
        "scheduled_section_minutes": 81.0,
        "historical_avg_running_minutes": 79.0,
        "historical_p90_running_minutes": 90.0,
    },
    {
        "train_number": "12951",
        "train_type": "Rajdhani",
        "train_type_encoded": 1,
        "from_station": "BRC",
        "to_station": "RTM",
        "section_distance_km": 261.0,
        "scheduled_section_minutes": 197.0,
        "historical_avg_running_minutes": 193.0,
        "historical_p90_running_minutes": 215.0,
    },
    {
        "train_number": "12951",
        "train_type": "Rajdhani",
        "train_type_encoded": 1,
        "from_station": "RTM",
        "to_station": "KOTA",
        "section_distance_km": 266.0,
        "scheduled_section_minutes": 157.0,
        "historical_avg_running_minutes": 154.0,
        "historical_p90_running_minutes": 170.0,
    },
    {
        "train_number": "12951",
        "train_type": "Rajdhani",
        "train_type_encoded": 1,
        "from_station": "KOTA",
        "to_station": "MTJ",
        "section_distance_km": 324.0,
        "scheduled_section_minutes": 195.0,
        "historical_avg_running_minutes": 190.0,
        "historical_p90_running_minutes": 212.0,
    },
    {
        "train_number": "12951",
        "train_type": "Rajdhani",
        "train_type_encoded": 1,
        "from_station": "MTJ",
        "to_station": "NDLS",
        "section_distance_km": 143.0,
        "scheduled_section_minutes": 110.0,
        "historical_avg_running_minutes": 108.0,
        "historical_p90_running_minutes": 125.0,
    },
]

def generate_dataset(num_samples: int = 5000, seed: int = 42) -> pd.DataFrame:
    np.random.seed(seed)
    records = []

    # Generate sequential chronological runs across 60 days
    base_timestamps = pd.date_range(start="2026-01-01", periods=num_samples, freq="15min")

    for i in range(num_samples):
        sec = SECTIONS[np.random.randint(0, len(SECTIONS))]
        ts: pd.Timestamp = cast(pd.Timestamp, base_timestamps[i])
        
        dep_hour: int = ts.hour
        day_of_week: int = ts.dayofweek
        
        # Entry delay (mix of on-time, slight delay, and rare higher delays)
        delay_rnd = np.random.exponential(scale=6.0) - 2.0
        current_delay = float(np.clip(delay_rnd, -5.0, 90.0))
        
        # Current entry speed
        base_speed = (sec["section_distance_km"] / (sec["historical_avg_running_minutes"] / 60.0))
        current_speed = float(np.clip(np.random.normal(loc=base_speed, scale=10.0), 30.0, 130.0))
        
        # Factors affecting actual section running time:
        # 1. Base historical section speed
        # 2. Peak hour congestion factor (08-11 and 17-21)
        peak_multiplier = 1.0
        if 8 <= dep_hour <= 11 or 17 <= dep_hour <= 21:
            peak_multiplier = 1.05 + np.random.uniform(0.0, 0.04)
        elif 1 <= dep_hour <= 5:
            peak_multiplier = 0.96 # Faster night clear tracks
            
        # 3. High delay compounding / recovery effect
        # If moderate delay (5-20 min), loco pilot tries to recover 2-5%
        # If severe delay (>40 min), loops/crossings cause further small delays (+3-8%)
        delay_effect_min = 0.0
        if 5 <= current_delay <= 25:
            delay_effect_min = -0.03 * sec["historical_avg_running_minutes"]
        elif current_delay > 40:
            delay_effect_min = 0.05 * sec["historical_avg_running_minutes"]
            
        # 4. Stochastic Gaussian noise
        noise_min = np.random.normal(loc=0.0, scale=3.0)
        
        # 5. Seasonal factor (simulating winter fog in Jan/Feb on Northern sections)
        seasonal_multiplier = 1.0
        if int(ts.month) in [1, 2] and sec["from_station"] in ["NDLS", "GZB", "ALJN", "CNB"]:
            seasonal_multiplier = 1.08 + np.random.uniform(0.0, 0.05)

        actual_running = (
            sec["historical_avg_running_minutes"] * peak_multiplier * seasonal_multiplier
            + delay_effect_min
            + noise_min
        )
        
        # Ensure physical bounds (minimum travel time at 140 km/h max speed)
        min_possible = (sec["section_distance_km"] / 140.0) * 60.0
        actual_running = max(min_possible, actual_running)

        records.append({
            "timestamp": str(ts.isoformat()),
            "train_number": sec["train_number"],
            "train_type": sec["train_type"],
            "train_type_encoded": sec["train_type_encoded"],
            "from_station": sec["from_station"],
            "to_station": sec["to_station"],
            "section_distance_km": sec["section_distance_km"],
            "scheduled_section_minutes": sec["scheduled_section_minutes"],
            "historical_avg_running_minutes": sec["historical_avg_running_minutes"],
            "historical_p90_running_minutes": sec["historical_p90_running_minutes"],
            "current_delay_minutes": current_delay,
            "current_speed_kmph": current_speed,
            "departure_hour": dep_hour,
            "day_of_week": day_of_week,
            "actual_running_minutes": round(actual_running, 2),
            "source": "SYNTHETIC"
        })

    df = pd.DataFrame(records)
    return df

def main():
    output_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "../backend/ml/data")
    os.makedirs(output_dir, exist_ok=True)
    output_file = os.path.join(output_dir, "synthetic_section_data.csv")
    
    print(f"Generating 5,000 synthetic section records...")
    df = generate_dataset(num_samples=5000)
    df.to_csv(output_file, index=False)
    print(f"Successfully generated {len(df)} records at: {output_file}")
    print(f"Dataset summary:\n{df[['current_delay_minutes', 'actual_running_minutes', 'section_distance_km']].describe()}")

if __name__ == "__main__":
    main()
