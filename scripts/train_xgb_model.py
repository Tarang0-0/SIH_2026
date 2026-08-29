#!/usr/bin/env python3
"""
RailETA GBDT / XGBoost Model Training Pipeline
Problem Statement: SIH26028 (Dynamic Forecast of ETA for Coaching Trains)

Trains a Gradient Boosted Decision Tree regressor to dynamically forecast section travel times
with zero temporal leakage, evaluates performance against non-ML baselines, and serializes
the trained model alongside feature metadata and uncertainty bounds.
"""

import os
import sys
import json
import logging
from typing import Tuple, Dict, Any

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error
from sklearn.ensemble import GradientBoostingRegressor

# Setup logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("raileta.train")

# Add backend directory to sys.path
script_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(script_dir)
sys.path.insert(0, os.path.join(project_root, "backend"))

from ml.preprocessing import ETAPreprocessor
from ml.features import FeatureEngineer, FEATURE_NAMES, TARGET_NAME
from ml.baseline import BaselinePredictor


def get_tree_regressor(random_seed: int = 42) -> Tuple[Any, str]:
    """
    Initializes XGBoost Regressor if library dependencies (OpenMP) are available,
    falling back seamlessly to Scikit-Learn GradientBoostingRegressor.
    """
    try:
        import xgboost as xgb
        model = xgb.XGBRegressor(
            n_estimators=150,
            max_depth=5,
            learning_rate=0.06,
            subsample=0.85,
            colsample_bytree=0.85,
            min_child_weight=3,
            random_state=random_seed,
            n_jobs=-1,
        )
        return model, "XGBoost (XGBRegressor)"
    except Exception as e:
        logger.info(f"Using Scikit-Learn GradientBoostingRegressor (Native GBDT engine). Notice: {e}")
        model = GradientBoostingRegressor(
            n_estimators=150,
            max_depth=5,
            learning_rate=0.06,
            subsample=0.85,
            min_samples_split=6,
            min_samples_leaf=3,
            random_state=random_seed,
        )
        return model, "Scikit-Learn (GradientBoostingRegressor)"


def train_pipeline() -> None:
    data_path = os.path.join(project_root, "backend", "ml", "data", "historical_section_runs.csv")
    models_dir = os.path.join(project_root, "backend", "ml", "models")
    os.makedirs(models_dir, exist_ok=True)

    if not os.path.exists(data_path):
        raise FileNotFoundError(f"Training data not found at: {data_path}. Run generate_historical_data.py first.")

    print("=" * 80)
    print(" RailETA Machine Learning Training & Validation Pipeline (SIH26028) ")
    print("=" * 80)

    # 1. Load and Clean Raw Historical Data
    preprocessor = ETAPreprocessor()
    df_raw = pd.read_csv(data_path)
    logger.info(f"Loaded raw dataset with {len(df_raw):,} rows.")

    df_cleaned = preprocessor.handle_missing_and_types(df_raw)
    df_cleaned = preprocessor.filter_anomalies(df_cleaned)

    # 2. Zero-Leakage Chronological / Trip-Based Data Split
    # In railway time-series data, random row shuffling causes severe data leakage
    # because sections from the same trip or future dates leak into the training set.
    # We split by unique trip_ids sequentially: first 80% trips for train, last 20% for test.
    unique_trips = df_cleaned["trip_id"].unique()
    num_trips = len(unique_trips)
    split_trip_idx = int(num_trips * 0.80)

    train_trips = set(unique_trips[:split_trip_idx])
    test_trips = set(unique_trips[split_trip_idx:])

    train_df = df_cleaned[df_cleaned["trip_id"].isin(train_trips)].copy().reset_index(drop=True)
    test_df = df_cleaned[df_cleaned["trip_id"].isin(test_trips)].copy().reset_index(drop=True)

    logger.info(f"Trip Split: {len(train_trips)} train trips ({len(train_df):,} section rows) | "
                f"{len(test_trips)} test trips ({len(test_df):,} section rows).")

    # 3. Fit Feature Engineering strictly on the Training Set
    # Section historical averages must be computed ONLY from past training trips!
    feature_engineer = FeatureEngineer()
    feature_engineer.fit_section_stats(train_df)

    X_train = feature_engineer.transform(train_df, is_training=True)
    y_train = train_df[TARGET_NAME]

    X_test = feature_engineer.transform(test_df, is_training=False)
    y_test = test_df[TARGET_NAME]

    # 4. Initialize and Train GBDT Model
    model, model_type_name = get_tree_regressor(random_seed=42)
    print(f"\n[+] Training {model_type_name} on {len(X_train):,} samples across {len(FEATURE_NAMES)} features...")
    model.fit(X_train, y_train)
    print("[+] Model training completed successfully!")

    # 5. Evaluate on Train and Test Sets
    y_train_pred = model.predict(X_train)
    y_test_pred = model.predict(X_test)

    train_mae = mean_absolute_error(y_train, y_train_pred)
    train_rmse = float(np.sqrt(mean_squared_error(y_train, y_train_pred)))

    test_mae = mean_absolute_error(y_test, y_test_pred)
    test_rmse = float(np.sqrt(mean_squared_error(y_test, y_test_pred)))

    # Compute baseline metrics on the same test set for comparison
    baseline_pred = test_df["scheduled_run_time_min"]
    baseline_mae = mean_absolute_error(y_test, baseline_pred)
    baseline_rmse = float(np.sqrt(mean_squared_error(y_test, baseline_pred)))

    mae_improvement_pct = ((baseline_mae - test_mae) / baseline_mae) * 100.0
    rmse_improvement_pct = ((baseline_rmse - test_rmse) / baseline_rmse) * 100.0

    test_abs_errors = np.abs(y_test - y_test_pred)
    acc_within_3m = float((test_abs_errors <= 3.0).mean() * 100.0)
    acc_within_5m = float((test_abs_errors <= 5.0).mean() * 100.0)
    acc_within_10m = float((test_abs_errors <= 10.0).mean() * 100.0)

    # 6. Calculate Residuals for Prediction Uncertainty Intervals (Quantile Confidence Bounds)
    # The 10th and 90th percentiles of train residuals give the 80% confidence interval margin
    train_residuals = y_train - y_train_pred
    q10_residual = float(np.percentile(train_residuals, 10))
    q90_residual = float(np.percentile(train_residuals, 90))

    # 7. Print Detailed Evaluation Benchmark
    print("\n" + "=" * 80)
    print("                    MODEL EVALUATION BENCHMARK REPORT")
    print("=" * 80)
    print(f"  Model Engine               : {model_type_name}")
    print(f"  Holdout Test Set Size      : {len(test_df):,} section runs ({len(test_trips)} unseen trips)")
    print("-" * 80)
    print(f"  {'Metric':<30} | {'Schedule Baseline':<18} | {'RailETA ML Model':<18} | {'Improvement':<12}")
    print("-" * 80)
    print(f"  {'MAE (Mean Absolute Error)':<30} | {baseline_mae:8.2f} mins     | {test_mae:8.2f} mins     | {mae_improvement_pct:+6.1f}%")
    print(f"  {'RMSE (Root Mean Sq Error)':<30} | {baseline_rmse:8.2f} mins     | {test_rmse:8.2f} mins     | {rmse_improvement_pct:+6.1f}%")
    print("-" * 80)
    print(f"  Accuracy within ±3 mins    : {acc_within_3m:5.1f}%")
    print(f"  Accuracy within ±5 mins    : {acc_within_5m:5.1f}%")
    print(f"  Accuracy within ±10 mins   : {acc_within_10m:5.1f}%")
    print(f"  Uncertainty Margin (80% CI): [{q10_residual:+.2f} min, {q90_residual:+.2f} min]")
    print("=" * 80)

    # Feature Importance Analysis (Top 8 most influential features)
    if hasattr(model, "feature_importances_"):
        importances = model.feature_importances_
        feature_importance_df = pd.DataFrame({
            "feature": FEATURE_NAMES,
            "importance": importances
        }).sort_values("importance", ascending=False)

        print("\nTop 8 Most Important Features Influencing ETA Predictions:")
        for idx, row in feature_importance_df.head(8).iterrows():
            bar = "#" * int(row["importance"] * 50)
            print(f"  - {row['feature']:<28}: {row['importance']:.3f} | {bar}")

    # 8. Serialize Trained Model and Production Metadata
    model_save_path = os.path.join(models_dir, "eta_model.joblib")
    metadata_save_path = os.path.join(models_dir, "model_metadata.json")

    joblib.dump(model, model_save_path)
    logger.info(f"Saved trained model artifact to: {model_save_path}")

    metadata: Dict[str, Any] = {
        "model_type": model_type_name,
        "feature_names": FEATURE_NAMES,
        "target_name": TARGET_NAME,
        "section_stats": feature_engineer.section_stats,
        "train_mae": round(float(train_mae), 2),
        "test_mae": round(float(test_mae), 2),
        "test_rmse": round(float(test_rmse), 2),
        "mae_improvement_pct": round(float(mae_improvement_pct), 1),
        "residual_q10": round(q10_residual, 2),
        "residual_q90": round(q90_residual, 2),
        "accuracy_within_5m": round(acc_within_5m, 1),
        "accuracy_within_10m": round(acc_within_10m, 1),
    }

    with open(metadata_save_path, "w") as f:
        json.dump(metadata, f, indent=2)
    logger.info(f"Saved inference metadata to: {metadata_save_path}")
    print("\n[+] All model training artifacts successfully saved to disk!")


if __name__ == "__main__":
    train_pipeline()
