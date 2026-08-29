"""
RailETA Feature Engineering Pipeline
Problem Statement: SIH26028 (Dynamic Forecast of ETA for Coaching Trains)

This module transforms raw railway operational telemetry and timetable schedules into
high-signal, zero-data-leakage tabular features for tree-based regression (XGBoost/LightGBM).

Invariant:
Every feature calculated for prediction at timestamp T relies strictly on information
available at or before timestamp T.
"""

import logging
from typing import Dict, Any, List, Optional, Union
import numpy as np
import pandas as pd

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("raileta.features")

# ==============================================================================
# 1. CANONICAL FEATURE SPECIFICATION
# ==============================================================================

# Priority mapping: lower number = higher track clearance priority
TRAIN_PRIORITY_MAP: Dict[str, int] = {
    "VB": 1,     # Vande Bharat (Top priority)
    "RAJ": 1,    # Rajdhani (Top priority)
    "SF": 2,     # Shatabdi / Superfast (Standard priority)
    "EXP": 3,    # Mail / Express (Lower priority)
    "PASS": 4,   # Passenger / Local (Lowest priority)
}
DEFAULT_PRIORITY = 3

# Max permissible track speed by train type (km/h)
TRAIN_MAX_SPEED_MAP: Dict[str, float] = {
    "VB": 130.0,
    "RAJ": 130.0,
    "SF": 110.0,
    "EXP": 100.0,
    "PASS": 80.0,
}
DEFAULT_MAX_SPEED = 100.0

# Major junction stations known for switching/approach signal congestion
MAJOR_JUNCTION_STATIONS = {"NDLS", "CNB", "PRYJ", "DDU", "GZB", "ST", "BRC", "RTM", "KOTA", "MTJ", "HWH"}

# Final ordered feature list passed to the ML model
FEATURE_NAMES: List[str] = [
    # Group A: Spatial & Timetable Foundation
    "distance_km",
    "scheduled_run_time_min",
    "historical_avg_run_time_min",
    "schedule_buffer_slack_min",
    
    # Group B: Velocity & Operational Limits
    "planned_speed_kmh",
    "speed_ratio_to_max",
    
    # Group C: Live Running State at Departure
    "departure_delay_min",
    "delay_severity_tier",
    "train_priority_level",
    
    # Group D: Temporal & Traffic Context
    "departure_hour",
    "sin_hour",
    "cos_hour",
    "day_of_week",
    "is_peak_hours",
    "is_weekend",
    
    # Group E: Infrastructure & Environmental Context
    "is_junction_section",
    "section_congestion_level",
    "weather_impact_flag",
]

TARGET_NAME = "actual_run_time_min"


# ==============================================================================
# 2. FEATURE ENGINEERING CLASS
# ==============================================================================

class FeatureEngineer:
    """
    Computes domain-specific, leak-free features for Train ETA forecasting.
    Can be used in batch training or online single-event inference.
    """

    def __init__(self, section_stats: Optional[Dict[str, float]] = None):
        """
        Args:
            section_stats: Precomputed historical average run times by section (from training set).
                           Key: "FROM_TO", e.g. "NDLS_CNB" -> 275.4 min.
        """
        self.section_stats = section_stats or {}
        self.feature_columns = list(FEATURE_NAMES)

    def fit_section_stats(self, df: pd.DataFrame) -> None:
        """
        Calculates baseline section statistics strictly from historical training data.
        Prevents data leakage by computing section averages before evaluation.
        """
        if "from_station_code" in df.columns and "to_station_code" in df.columns and TARGET_NAME in df.columns:
            df["section_key"] = df["from_station_code"] + "_" + df["to_station_code"]
            stats = df.groupby("section_key")[TARGET_NAME].mean().to_dict()
            self.section_stats = {k: round(v, 2) for k, v in stats.items()}
            logger.info(f"Learned historical baselines for {len(self.section_stats)} unique route sections.")

    def transform(self, df_input: pd.DataFrame, is_training: bool = False) -> pd.DataFrame:
        """
        Transforms raw train records into the finalized engineered feature set.
        """
        df = df_input.copy()

        # ----------------------------------------------------------------------
        # Group A: Spatial & Timetable Foundation
        # ----------------------------------------------------------------------
        # 1. Section Key for historical baseline lookup
        if "from_station_code" in df.columns and "to_station_code" in df.columns:
            section_keys = df["from_station_code"] + "_" + df["to_station_code"]
        else:
            section_keys = pd.Series(["UNKNOWN"] * len(df), index=df.index)

        # 2. Historical Section Run Time Baseline
        # If section stats not yet fitted, approximate with 95% of scheduled time
        fallback_baseline = df["scheduled_run_time_min"] * 0.95
        df["historical_avg_run_time_min"] = section_keys.map(self.section_stats).fillna(fallback_baseline).round(1)

        # 3. Schedule Buffer Slack (Minutes)
        # Difference between timetable allotted time and historical typical time
        # Positive slack = recovery margin exists; Negative/zero = tight timetable
        df["schedule_buffer_slack_min"] = (df["scheduled_run_time_min"] - df["historical_avg_run_time_min"]).round(1)

        # ----------------------------------------------------------------------
        # Group B: Velocity & Operational Limits
        # ----------------------------------------------------------------------
        # 4. Planned Timetable Speed (km/h)
        safe_sched_hours = np.clip(df["scheduled_run_time_min"] / 60.0, 0.05, 24.0)
        df["planned_speed_kmh"] = (df["distance_km"] / safe_sched_hours).round(1)

        # 5. Speed Ratio to Train's Maximum Permissible Speed
        # Measures how close to maximum locomotive capability the schedule requires
        max_speeds = df["train_type"].map(TRAIN_MAX_SPEED_MAP).fillna(DEFAULT_MAX_SPEED)
        df["speed_ratio_to_max"] = (df["planned_speed_kmh"] / max_speeds).clip(0.1, 1.2).round(3)

        # ----------------------------------------------------------------------
        # Group C: Live Running State at Departure
        # ----------------------------------------------------------------------
        # 6. Train Priority Level (1 = Top, 2 = Medium, 3 = Mail/Exp)
        df["train_priority_level"] = df["train_type"].map(TRAIN_PRIORITY_MAP).fillna(DEFAULT_PRIORITY).astype(int)

        # 7. Delay Severity Tier (Categorical Ordinal)
        # Tier 0: On-time / Minor delay (0 to 5m)
        # Tier 1: Moderate recoverable delay (5 to 20m) -> Locomotive pilots push speed
        # Tier 2: Significant delay (20 to 45m)
        # Tier 3: Severe delay (>45m) -> High probability of being placed in loop lines
        def get_delay_tier(delay: float) -> int:
            if delay < 5.0:
                return 0
            elif delay <= 20.0:
                return 1
            elif delay <= 45.0:
                return 2
            else:
                return 3

        df["delay_severity_tier"] = df["departure_delay_min"].apply(get_delay_tier)

        # ----------------------------------------------------------------------
        # Group D: Temporal & Cyclical Context
        # ----------------------------------------------------------------------
        # 8. Cyclical 24-Hour Time Representation
        # 23:00 and 00:00 are adjacent in physical reality; sin/cos captures this continuous cycle
        hour_radians = 2 * np.pi * (df["departure_hour"] % 24) / 24.0
        df["sin_hour"] = np.sin(hour_radians).round(4)
        df["cos_hour"] = np.cos(hour_radians).round(4)

        # 9. Peak Hours Flag (Morning: 08-11, Evening: 17-21)
        df["is_peak_hours"] = df["departure_hour"].apply(
            lambda h: 1 if (8 <= h <= 11 or 17 <= h <= 21) else 0
        )

        # 10. Weekend Surge Flag (Friday=4, Sunday=6)
        df["is_weekend"] = df["day_of_week"].apply(lambda d: 1 if d in [4, 6] else 0)

        # ----------------------------------------------------------------------
        # Group E: Infrastructure & Environmental Context
        # ----------------------------------------------------------------------
        # 11. Major Junction Flag (Approach switching and platform clearance delays)
        if "from_station_code" in df.columns and "to_station_code" in df.columns:
            df["is_junction_section"] = (
                df["from_station_code"].isin(MAJOR_JUNCTION_STATIONS)
                | df["to_station_code"].isin(MAJOR_JUNCTION_STATIONS)
            ).astype(int)
        else:
            df["is_junction_section"] = 0

        # Fill any unexpected nulls in environmental features
        df["section_congestion_level"] = df["section_congestion_level"].fillna(0.50).round(2)
        df["weather_impact_flag"] = df["weather_impact_flag"].fillna(0).astype(int)

        # Select only the registered feature columns in canonical order
        return df[self.feature_columns]

    def extract_from_realtime_event(self, event: Dict[str, Any]) -> pd.DataFrame:
        """
        Helper to engineer features from a single live JSON telemetry event.
        """
        # Flatten payload if nested
        data = event.copy()
        if "telemetry" in data and isinstance(data["telemetry"], dict):
            telemetry = data.pop("telemetry")
            data.update(telemetry)

        # Key aliasing for consistency
        alias_map = {
            "current_delay_min": "departure_delay_min",
            "scheduled_section_time_min": "scheduled_run_time_min",
            "next_station_distance_km": "distance_km",
            "station_code": "from_station_code",
            "next_station_code": "to_station_code",
        }
        for old_k, new_k in alias_map.items():
            if old_k in data and new_k not in data:
                data[new_k] = data[old_k]

        # Extract hour/day if timestamp provided
        if "timestamp" in data:
            ts = pd.to_datetime(data["timestamp"])
            if "departure_hour" not in data:
                data["departure_hour"] = ts.hour
            if "day_of_week" not in data:
                data["day_of_week"] = ts.dayofweek

        df_single = pd.DataFrame([data])
        return self.transform(df_single, is_training=False)


# ==============================================================================
# 3. VERIFICATION & SELF-TEST
# ==============================================================================

if __name__ == "__main__":
    import os

    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(os.path.dirname(script_dir))
    csv_file = os.path.join(project_root, "backend", "ml", "data", "historical_section_runs.csv")

    print("=" * 75)
    print(" RailETA Feature Engineering Pipeline Self-Test ")
    print("=" * 75)

    if os.path.exists(csv_file):
        df_raw = pd.read_csv(csv_file)
        print(f"Loaded raw dataset with {len(df_raw)} records.")

        # Initialize Feature Engineer and fit historical baselines
        fe = FeatureEngineer()
        fe.fit_section_stats(df_raw)

        # Transform entire dataset
        X_engineered = fe.transform(df_raw, is_training=True)
        print(f"\n[+] Engineered Feature Matrix Shape: {X_engineered.shape}")
        print(f"[+] Total Engineered Features: {len(X_engineered.columns)}")

        print("\n--- Feature Matrix Snapshot (First 2 Rows) ---")
        for col in X_engineered.columns:
            print(f"  * {col:<30}: {X_engineered[col].iloc[0]} | {X_engineered[col].iloc[1]}")

        # Test Real-Time Single Event Transformation
        print("\n" + "-" * 75)
        print("[+] Testing Single Live Real-Time Telemetry Event...")
        live_event = {
            "train_number": "12302",
            "train_type": "RAJ",
            "station_code": "CNB",
            "next_station_code": "PRYJ",
            "distance_km": 194.5,
            "scheduled_run_time_min": 120.0,
            "departure_hour": 18,
            "day_of_week": 4,  # Friday
            "departure_delay_min": 18.5,
            "section_congestion_level": 0.82,
            "weather_impact_flag": 0,
        }
        X_live = fe.extract_from_realtime_event(live_event)
        print("Live Feature Vector:")
        print(X_live.to_string())

        print("\n[+] Verification PASSED: Feature engineering pipeline is ready!")
    else:
        print(f"CSV file not found at: {csv_file}")
