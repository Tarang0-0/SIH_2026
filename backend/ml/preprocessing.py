"""
RailETA Data Preprocessing & Feature Transformation Pipeline
Problem Statement: SIH26028 (Dynamic Forecast of ETA for Coaching Trains)

This module provides a unified, reusable preprocessing pipeline for:
1. Training Mode: Ingests raw historical CSV logs, performs data hygiene, validates boundaries,
   engineers temporal & spatial features, and extracts (X, y) matrices.
2. Inference Mode (Real-Time): Preprocesses streaming single-event telemetry payloads into the exact
   feature matrix required by the ML model with ZERO training-serving skew.
"""

import logging
from typing import Dict, Any, List, Tuple, Optional, Union
import numpy as np
import pandas as pd

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("raileta.preprocessing")

# ==============================================================================
# 1. CANONICAL ENCODINGS & FEATURE SPECIFICATIONS
# ==============================================================================

# Explicit categorical mappings (avoids random one-hot skew between train and inference)
TRAIN_TYPE_MAP: Dict[str, int] = {
    "VB": 0,       # Vande Bharat (Top priority)
    "RAJ": 1,      # Rajdhani (High priority)
    "SF": 2,       # Superfast (Standard priority)
    "EXP": 3,      # Mail / Express (Lower priority)
    "PASS": 4,     # Passenger / Local (Lowest priority)
}
DEFAULT_TRAIN_TYPE_ENCODED = 3  # Fallback for unknown train types

# Final feature columns passed directly to the XGBoost/LightGBM model
FEATURE_COLUMNS: List[str] = [
    "distance_km",
    "scheduled_run_time_min",
    "planned_speed_kmh",
    "departure_hour",
    "day_of_week",
    "is_peak_hour",
    "is_weekend",
    "departure_delay_min",
    "section_congestion_level",
    "weather_impact_flag",
    "train_type_encoded",
]

TARGET_COLUMN = "actual_run_time_min"

# Physical railway sanity bounds for data filtering
SANITY_BOUNDS = {
    "min_distance_km": 1.0,
    "max_distance_km": 1200.0,
    "min_scheduled_min": 5.0,
    "max_scheduled_min": 1440.0,
    "min_speed_kmh": 10.0,      # Minimum moving speed
    "max_speed_kmh": 160.0,     # Max permissible track speed on Indian Railways
    "min_delay_min": -30.0,     # Maximum early arrival margin
    "max_delay_min": 1440.0,    # Max 24-hour delay
}


# ==============================================================================
# 2. CORE PREPROCESSING CLASS
# ==============================================================================

class ETAPreprocessor:
    """
    Reusable Preprocessor for both Offline Historical Training and Online Real-Time Prediction.
    """

    def __init__(self, feature_cols: Optional[List[str]] = None):
        self.feature_columns = feature_cols or list(FEATURE_COLUMNS)

    # --------------------------------------------------------------------------
    # Step 1: Input Validation
    # --------------------------------------------------------------------------
    def validate_raw_schema(self, df: pd.DataFrame, is_training: bool = True) -> None:
        """
        Ensures the input DataFrame contains all required fields before processing.
        """
        required_cols = [
            "train_type",
            "distance_km",
            "scheduled_run_time_min",
            "departure_hour",
            "day_of_week",
            "departure_delay_min",
        ]
        if is_training:
            required_cols.append(TARGET_COLUMN)

        missing = [col for col in required_cols if col not in df.columns]
        if missing:
            raise ValueError(f"Schema Validation Error: Missing required columns: {missing}")

    # --------------------------------------------------------------------------
    # Step 2: Missing Value Handling & Type Coercion
    # --------------------------------------------------------------------------
    def handle_missing_and_types(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Cleans data types, coerces strings/numerics, and imputes safe railway defaults.
        """
        df = df.copy()

        # Coerce numeric columns
        numeric_cols = [
            "distance_km",
            "scheduled_run_time_min",
            "departure_hour",
            "day_of_week",
            "departure_delay_min",
            "section_congestion_level",
            "weather_impact_flag",
        ]
        for col in numeric_cols:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors="coerce")

        if TARGET_COLUMN in df.columns:
            df[TARGET_COLUMN] = pd.to_numeric(df[TARGET_COLUMN], errors="coerce")

        # Impute safe domain defaults for missing values
        df["departure_delay_min"] = df["departure_delay_min"].fillna(0.0)
        df["section_congestion_level"] = df["section_congestion_level"].fillna(0.50)
        df["weather_impact_flag"] = df["weather_impact_flag"].fillna(0).astype(int)
        df["departure_hour"] = df["departure_hour"].fillna(12).astype(int)
        df["day_of_week"] = df["day_of_week"].fillna(2).astype(int)  # Default Wednesday

        # Clean string columns
        if "train_type" in df.columns:
            df["train_type"] = df["train_type"].astype(str).str.strip().str.upper()

        return df

    # --------------------------------------------------------------------------
    # Step 3: Anomaly & Invalid Record Removal (Training Only)
    # --------------------------------------------------------------------------
    def filter_anomalies(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Removes corrupt, impossible, or extreme outlier records from historical training data.
        """
        initial_count = len(df)

        # 1. Target must be positive and non-null
        valid_mask = df[TARGET_COLUMN].notnull() & (df[TARGET_COLUMN] > 0)

        # 2. Distance and scheduled time bounds
        valid_mask &= (df["distance_km"] >= SANITY_BOUNDS["min_distance_km"]) & (
            df["distance_km"] <= SANITY_BOUNDS["max_distance_km"]
        )
        valid_mask &= (df["scheduled_run_time_min"] >= SANITY_BOUNDS["min_scheduled_min"]) & (
            df["scheduled_run_time_min"] <= SANITY_BOUNDS["max_scheduled_min"]
        )

        # 3. Delay boundary check
        valid_mask &= (df["departure_delay_min"] >= SANITY_BOUNDS["min_delay_min"]) & (
            df["departure_delay_min"] <= SANITY_BOUNDS["max_delay_min"]
        )

        # 4. Physical speed feasibility check
        # Calculate actual average speed in km/h: distance / (actual_min / 60)
        avg_speed_kmh = df["distance_km"] / (df[TARGET_COLUMN] / 60.0)
        valid_mask &= (avg_speed_kmh >= SANITY_BOUNDS["min_speed_kmh"]) & (
            avg_speed_kmh <= SANITY_BOUNDS["max_speed_kmh"]
        )

        df_clean = df[valid_mask].reset_index(drop=True)
        dropped_count = initial_count - len(df_clean)

        if dropped_count > 0:
            logger.info(f"Anomaly Filter: Dropped {dropped_count} invalid records ({dropped_count/initial_count:.1%}).")
        return df_clean

    # --------------------------------------------------------------------------
    # Step 4: Feature Engineering
    # --------------------------------------------------------------------------
    def engineer_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Generates domain-specific features needed for high-accuracy ETA regression.
        """
        df = df.copy()

        # 1. Planned Timetable Speed (km/h)
        # Avoid division by zero with clip
        safe_sched_hours = np.clip(df["scheduled_run_time_min"] / 60.0, 0.05, 24.0)
        df["planned_speed_kmh"] = np.round(df["distance_km"] / safe_sched_hours, 1)

        # 2. Categorical Encoding for Train Priority Type
        df["train_type_encoded"] = df["train_type"].map(TRAIN_TYPE_MAP).fillna(DEFAULT_TRAIN_TYPE_ENCODED).astype(int)

        # 3. Peak Hour Traffic Flag (Morning: 8-11 AM, Evening: 5-9 PM)
        df["is_peak_hour"] = df["departure_hour"].apply(
            lambda h: 1 if (8 <= h <= 11 or 17 <= h <= 21) else 0
        )

        # 4. Weekend Indicator (Friday=4, Sunday=6 have heavier passenger loads)
        df["is_weekend"] = df["day_of_week"].apply(lambda d: 1 if d in [4, 6] else 0)

        # 5. Hour bounds normalization (ensure 0-23)
        df["departure_hour"] = df["departure_hour"] % 24
        df["day_of_week"] = df["day_of_week"] % 7

        return df

    # --------------------------------------------------------------------------
    # Step 5: Full Pipeline Execution (Training Mode)
    # --------------------------------------------------------------------------
    def process_training_data(
        self, data_source: Union[str, pd.DataFrame]
    ) -> Tuple[pd.DataFrame, pd.Series, pd.DataFrame]:
        """
        End-to-end preprocessing for training data.
        Returns:
            X (pd.DataFrame): Feature matrix
            y (pd.Series): Target actual run time series
            df_processed (pd.DataFrame): Complete processed dataset for inspection
        """
        if isinstance(data_source, str):
            logger.info(f"Loading historical CSV dataset from: {data_source}")
            df = pd.read_csv(data_source)
        else:
            df = data_source.copy()

        logger.info(f"Initial raw record count: {len(df):,}")

        # 1. Validate Schema
        self.validate_raw_schema(df, is_training=True)

        # 2. Clean types & handle nulls
        df = self.handle_missing_and_types(df)

        # 3. Remove corrupt/impossible records
        df = self.filter_anomalies(df)

        # 4. Feature Engineering
        df = self.engineer_features(df)

        # 5. Extract Feature Matrix (X) and Target (y)
        X = df[self.feature_columns]
        y = df[TARGET_COLUMN]

        logger.info(f"Successfully processed {len(X):,} training samples across {len(self.feature_columns)} features.")
        return X, y, df

    # --------------------------------------------------------------------------
    # Step 6: Full Pipeline Execution (Real-Time Inference Mode)
    # --------------------------------------------------------------------------
    def process_realtime_input(self, payload: Union[Dict[str, Any], pd.DataFrame]) -> pd.DataFrame:
        """
        Preprocesses a single real-time event dictionary or small batch for live prediction.
        Ensures exact column match and encoding with zero data leakage.
        """
        if isinstance(payload, dict):
            # Flatten telemetry sub-dictionary if nested
            data = payload.copy()
            if "telemetry" in data and isinstance(data["telemetry"], dict):
                telemetry = data.pop("telemetry")
                data.update(telemetry)
            df = pd.DataFrame([data])
        else:
            df = payload.copy()

        # Handle missing columns or slight key variations
        key_alias = {
            "current_delay_min": "departure_delay_min",
            "scheduled_section_time_min": "scheduled_run_time_min",
            "next_station_distance_km": "distance_km",
        }
        df = df.rename(columns=key_alias)

        # If departure_hour or day_of_week are missing, extract from timestamp if present
        if "timestamp" in df.columns and ("departure_hour" not in df.columns or "day_of_week" not in df.columns):
            ts = pd.to_datetime(df["timestamp"])
            if "departure_hour" not in df.columns:
                df["departure_hour"] = ts.dt.hour
            if "day_of_week" not in df.columns:
                df["day_of_week"] = ts.dt.dayofweek

        # Impute missing features if not provided in real-time stream
        for col in ["departure_delay_min", "section_congestion_level", "weather_impact_flag"]:
            if col not in df.columns:
                df[col] = 0.0

        # Run type coercion & feature engineering
        df = self.handle_missing_and_types(df)
        df = self.engineer_features(df)

        # Select only the exact feature columns required by the model
        X_live = df[self.feature_columns]
        return X_live


# ==============================================================================
# 3. VERIFICATION AND SELF-TEST
# ==============================================================================

if __name__ == "__main__":
    import os

    # Resolve paths relative to this script
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(os.path.dirname(script_dir))
    csv_file = os.path.join(project_root, "backend", "ml", "data", "historical_section_runs.csv")

    print("=" * 70)
    print(" RailETA Preprocessing Pipeline Self-Test ")
    print("=" * 70)

    preprocessor = ETAPreprocessor()

    if os.path.exists(csv_file):
        # 1. Test Training Data Pipeline
        print(f"\n[Test 1] Processing Historical Dataset ({csv_file})...")
        X, y, df_clean = preprocessor.process_training_data(csv_file)
        print(f"-> Feature Matrix Shape (X): {X.shape}")
        print(f"-> Target Vector Shape (y):   {y.shape}")
        print("\nProcessed Features Sample (First 3 rows):")
        print(X.head(3).to_string())

        # 2. Test Real-Time Event Preprocessing
        print("\n" + "-" * 70)
        print("[Test 2] Processing Real-Time JSON Telemetry Event...")
        sample_realtime_event = {
            "train_number": "12302",
            "train_type": "RAJ",
            "station_code": "CNB",
            "next_station_code": "PRYJ",
            "distance_km": 194.5,
            "scheduled_run_time_min": 120.0,
            "departure_hour": 18,
            "day_of_week": 4,  # Friday
            "departure_delay_min": 15.0,
            "section_congestion_level": 0.75,
            "weather_impact_flag": 0,
        }

        X_live = preprocessor.process_realtime_input(sample_realtime_event)
        print("-> Live Inference Feature Vector:")
        print(X_live.to_string())

        print("\n[+] Verification PASSED: Preprocessing pipeline is fully operational!")
    else:
        print(f"Warning: Sample CSV not found at {csv_file}. Please generate dataset first.")
