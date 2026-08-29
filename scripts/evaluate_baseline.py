#!/usr/bin/env python3
"""
RailETA Baseline Evaluation Script
Problem Statement: SIH26028 (Dynamic Forecast of ETA for Coaching Trains)

Evaluates non-ML baseline ETA methods (Pure Schedule, Historical Mean, Naive Delay-Adjusted)
against the ground truth actual section travel time using MAE and RMSE metrics.
"""

import os
import sys
import numpy as np
import pandas as pd

# Add backend directory to python path
script_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(script_dir)
sys.path.insert(0, os.path.join(project_root, "backend"))

from ml.baseline import BaselinePredictor


def calculate_metrics(y_true: pd.Series, y_pred: pd.Series) -> dict:
    """
    Computes standard regression evaluation metrics:
    - MAE: Mean Absolute Error (average minutes off)
    - RMSE: Root Mean Squared Error (penalizes large outlier errors)
    - Accuracy within +/- 3 min, +/- 5 min, +/- 10 min
    """
    errors = y_true - y_pred
    abs_errors = np.abs(errors)

    mae = float(np.mean(abs_errors))
    rmse = float(np.sqrt(np.mean(errors ** 2)))

    pct_within_3 = float(np.mean(abs_errors <= 3.0) * 100.0)
    pct_within_5 = float(np.mean(abs_errors <= 5.0) * 100.0)
    pct_within_10 = float(np.mean(abs_errors <= 10.0) * 100.0)

    return {
        "MAE": mae,
        "RMSE": rmse,
        "within_3m": pct_within_3,
        "within_5m": pct_within_5,
        "within_10m": pct_within_10,
    }


def main():
    data_path = os.path.join(project_root, "backend", "ml", "data", "historical_section_runs.csv")

    if not os.path.exists(data_path):
        print(f"Error: Dataset not found at {data_path}. Run generate_historical_data.py first.")
        sys.exit(1)

    print("=" * 78)
    print(" RailETA Baseline Evaluation & Benchmark Report ")
    print("=" * 78)

    df = pd.read_csv(data_path)
    total_records = len(df)
    y_true = df["actual_run_time_min"]

    print(f"Dataset Size: {total_records:,} historical section runs")
    print(f"Average Actual Travel Time : {y_true.mean():.1f} minutes")
    print(f"Average Scheduled Time     : {df['scheduled_run_time_min'].mean():.1f} minutes")
    print(f"Average Initial Delay      : {df['departure_delay_min'].mean():.1f} minutes\n")

    # Initialize Baseline Predictor
    predictor = BaselinePredictor()
    predictor.fit_historical_means(df, target_col="actual_run_time_min")

    # 1. Baseline 1: Pure Timetable Schedule
    pred_schedule = predictor.predict_pure_schedule(df)
    metrics_schedule = calculate_metrics(y_true, pred_schedule)

    # 2. Baseline 2: Historical Section Mean
    pred_hist_mean = predictor.predict_historical_mean(df)
    metrics_hist_mean = calculate_metrics(y_true, pred_hist_mean)

    # 3. Baseline 3: Simple Delay-Adjusted Heuristic
    pred_delay_adjusted = predictor.predict_naive_delay_adjusted(df)
    metrics_delay_adjusted = calculate_metrics(y_true, pred_delay_adjusted)

    # Display Comparative Results Table
    print("-" * 78)
    print(f"{'Baseline Method':<30} | {'MAE (min)':<10} | {'RMSE (min)':<11} | {'±3m Acc':<8} | {'±5m Acc':<8} | {'±10m Acc':<8}")
    print("-" * 78)

    results = [
        ("1. Pure Timetable Schedule", metrics_schedule),
        ("2. Historical Section Mean", metrics_hist_mean),
        ("3. Naive Delay-Adjusted", metrics_delay_adjusted),
    ]

    for name, m in results:
        print(f"{name:<30} | {m['MAE']:8.2f} m | {m['RMSE']:9.2f} m | {m['within_3m']:6.1f} % | {m['within_5m']:6.1f} % | {m['within_10m']:6.1f} %")

    print("-" * 78)
    print("\nBENCHMARK TAKEAWAYS FOR MACHINE LEARNING:")
    print(f"  * The best simple non-ML baseline (Historical Mean) achieves an MAE of {metrics_hist_mean['MAE']:.2f} minutes.")
    print(f"  * Our upcoming XGBoost ML model must achieve an MAE lower than {metrics_hist_mean['MAE']:.2f} minutes")
    print(f"    by capturing non-linear patterns (weather fog, peak hours, compound delays).")
    print("=" * 78)


if __name__ == "__main__":
    main()
