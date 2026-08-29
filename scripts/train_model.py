#!/usr/bin/env python3
"""
RailETA GBDT Model Training & Serialization Pipeline
Trains GBDT section travel time forecasting model on zero-leakage tabular features.
"""

import os
import sys
from typing import Any, Tuple, List

# Canonical feature column ordering for zero-leakage section time-series model
FEATURE_COLUMNS: List[str] = [
    "current_delay_minutes",
    "current_speed_kmph",
    "section_distance_km",
    "scheduled_section_minutes",
    "historical_avg_running_minutes",
    "historical_p90_running_minutes",
    "departure_hour",
    "day_of_week",
    "train_type_encoded"
]

import joblib  # type: ignore[import-untyped]
import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error  # type: ignore[import-untyped]
from sklearn.ensemble import GradientBoostingRegressor  # type: ignore[import-untyped]


def get_gbdt_model() -> Tuple[Any, str]:
    """Initializes GBDT Regressor with XGBoost if available, falling back to scikit-learn GradientBoostingRegressor."""
    try:
        import xgboost as xgb  # type: ignore[import-untyped]
        return xgb.XGBRegressor(
            n_estimators=120,
            max_depth=5,
            learning_rate=0.08,
            subsample=0.85,
            colsample_bytree=0.85,
            random_state=42,
            n_jobs=-1
        ), "XGBRegressor"
    except Exception:
        return GradientBoostingRegressor(
            n_estimators=120,
            max_depth=5,
            learning_rate=0.08,
            subsample=0.85,
            random_state=42
        ), "GradientBoostingRegressor"


def train_and_evaluate() -> None:
    current_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.abspath(os.path.join(current_dir, ".."))
    data_path = os.path.join(project_root, "backend/ml/data/synthetic_section_data.csv")
    models_dir = os.path.join(project_root, "backend/ml/models")
    os.makedirs(models_dir, exist_ok=True)

    if not os.path.exists(data_path):
        raise FileNotFoundError(f"Training dataset not found at: {data_path}. Run generate_training_data.py first.")

    print(f"Loading synthetic dataset from: {data_path}...")
    df = pd.read_csv(data_path)
    
    # Chronological sort (by timestamp) to ensure strict temporal order
    df = df.sort_values("timestamp").reset_index(drop=True)
    
    X = df[FEATURE_COLUMNS]
    y = df["actual_running_minutes"]

    # 80/20 Chronological split (no random shuffling to prevent temporal data leakage)
    split_idx = int(len(df) * 0.80)
    X_train, X_test = X.iloc[:split_idx], X.iloc[split_idx:]
    y_train, y_test = y.iloc[:split_idx], y.iloc[split_idx:]

    print(f"Dataset split: {len(X_train)} train rows, {len(X_test)} test rows (Chronological).")

    # Train GBDT Regressor
    model, model_type = get_gbdt_model()
    print(f"Training GBDT model ({model_type})...")
    model.fit(X_train, y_train)

    # Evaluate predictions
    y_train_pred = model.predict(X_train)
    y_test_pred = model.predict(X_test)

    train_mae = mean_absolute_error(y_train, y_train_pred)
    train_rmse = float(np.sqrt(mean_squared_error(y_train, y_train_pred)))
    test_mae = mean_absolute_error(y_test, y_test_pred)
    test_rmse = float(np.sqrt(mean_squared_error(y_test, y_test_pred)))

    print("=" * 60)
    print(f"  GBDT ({model_type}) Section Travel Time Model Results")
    print("=" * 60)
    print(f"  Train MAE  : {train_mae:.2f} minutes | Train RMSE: {train_rmse:.2f} minutes")
    print(f"  Test MAE   : {test_mae:.2f} minutes | Test RMSE : {test_rmse:.2f} minutes")
    
    # Calculate Residual Distribution for Uncertainty Quantile Bounds
    residuals = y_train - y_train_pred
    q10 = float(np.percentile(residuals, 10))
    q90 = float(np.percentile(residuals, 90))
    print(f"  Residual Bounds (Train): q10 = {q10:.2f} min, q90 = {q90:.2f} min")
    print("=" * 60)

    # Save artifacts
    model_file = os.path.join(models_dir, "eta_model.pkl")
    residuals_file = os.path.join(models_dir, "residuals.pkl")

    joblib.dump(model, model_file)
    joblib.dump({
        "q10": q10,
        "q90": q90,
        "train_mae": float(train_mae),
        "test_mae": float(test_mae),
        "train_rmse": float(train_rmse),
        "test_rmse": float(test_rmse),
        "feature_names": FEATURE_COLUMNS,
        "model_type": model_type
    }, residuals_file)

    print(f"Model saved to: {model_file}")
    print(f"Residual bounds saved to: {residuals_file}")


if __name__ == "__main__":
    train_and_evaluate()
