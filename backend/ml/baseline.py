"""
RailETA Baseline ETA Prediction Methods
Problem Statement: SIH26028 (Dynamic Forecast of ETA for Coaching Trains)

This module implements standard non-ML baseline methods to benchmark against:
1. Pure Timetable Schedule Baseline (assumes train will run strictly on timetable time).
2. Naive Delay-Adjusted Baseline (standard NTES rule: assumes current delay remains constant).
3. Historical Section Mean Baseline (uses historical average traversal time for each section).
"""

from typing import Dict, Optional, Union
import numpy as np
import pandas as pd


class BaselinePredictor:
    """
    Non-Machine-Learning baseline predictors for section travel time forecasting.
    """

    def __init__(self, section_means: Optional[Dict[str, float]] = None):
        """
        Args:
            section_means: Mapping of "FROM_TO" section keys to historical average minutes.
        """
        self.section_means = section_means or {}

    def fit_historical_means(self, df: pd.DataFrame, target_col: str = "actual_run_time_min") -> None:
        """
        Calculates the historical average section travel time from past data.
        """
        if "from_station_code" in df.columns and "to_station_code" in df.columns and target_col in df.columns:
            section_keys = df["from_station_code"] + "_" + df["to_station_code"]
            self.section_means = df.groupby(section_keys)[target_col].mean().to_dict()

    def predict_pure_schedule(self, df: pd.DataFrame) -> pd.Series:
        """
        Baseline Method 1: Pure Timetable Schedule.
        Assumes the train will take exactly its scheduled timetable duration.
        """
        return df["scheduled_run_time_min"].astype(float)

    def predict_historical_mean(self, df: pd.DataFrame) -> pd.Series:
        """
        Baseline Method 2: Historical Section Mean.
        Predicts the historical average travel time for that specific section.
        Falls back to scheduled time if section is unseen.
        """
        if "from_station_code" in df.columns and "to_station_code" in df.columns:
            section_keys = df["from_station_code"] + "_" + df["to_station_code"]
            preds = section_keys.map(self.section_means).fillna(df["scheduled_run_time_min"])
            return preds.astype(float)
        return df["scheduled_run_time_min"].astype(float)

    def predict_naive_delay_adjusted(self, df: pd.DataFrame) -> pd.Series:
        """
        Baseline Method 3: Simple Delay-Adjusted Heuristic.
        Adjusts scheduled time with a simple heuristic:
        - If train is late (>20 min), add 4% delay propagation penalty.
        - If train is high-priority and slightly late (5-20 min), assume 3% timetable recovery.
        """
        base_time = df["scheduled_run_time_min"].astype(float).copy()
        
        # Apply simple heuristic adjustments
        delay = df.get("departure_delay_min", pd.Series(0.0, index=df.index))
        train_type = df.get("train_type", pd.Series("EXP", index=df.index))

        adjustments = pd.Series(0.0, index=df.index)

        # High priority trains slightly late recover small buffer
        recover_mask = (delay >= 5.0) & (delay <= 20.0) & (train_type.isin(["VB", "RAJ"]))
        adjustments[recover_mask] = -0.03 * base_time[recover_mask]

        # Heavy delays compound slightly
        heavy_delay_mask = delay > 30.0
        adjustments[heavy_delay_mask] = 0.04 * base_time[heavy_delay_mask]

        predicted_time = base_time + adjustments
        return predicted_time.round(2)


# ==============================================================================
# REUSABLE CONVENIENCE FUNCTIONS
# ==============================================================================

def compute_schedule_baseline(scheduled_run_time_min: float) -> float:
    """Predicts travel time purely based on static schedule."""
    return float(scheduled_run_time_min)


def compute_delay_adjusted_baseline(
    scheduled_run_time_min: float,
    departure_delay_min: float,
    train_type: str = "EXP"
) -> float:
    """
    Predicts travel time using naive rule:
    Adjusts scheduled time by standard delay buffer heuristic.
    """
    pred = float(scheduled_run_time_min)
    if departure_delay_min > 30.0:
        pred += 0.04 * scheduled_run_time_min
    elif 5.0 <= departure_delay_min <= 20.0 and train_type in ["VB", "RAJ"]:
        pred -= 0.03 * scheduled_run_time_min
    return round(pred, 2)
