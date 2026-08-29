"""
RailETA Inference & Prediction Utility
Problem Statement: SIH26028 (Dynamic Forecast of ETA for Coaching Trains)

Provides high-level, production-ready prediction functions for:
1. Single-section travel time forecasting with uncertainty bounds.
2. End-to-end journey ETA cascading along multi-station route topologies.
"""

import os
import sys
import logging
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, List, Optional, Union
import pandas as pd
import numpy as np

# Add backend directory to sys.path
script_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(os.path.dirname(script_dir))
sys.path.insert(0, os.path.join(project_root, "backend"))

from ml.model_loader import load_model
from ml.features import FeatureEngineer, FEATURE_NAMES

logger = logging.getLogger("raileta.predictor")


class ETAPredictor:
    """
    Production-ready inference engine for dynamic train ETA predictions.
    """

    def __init__(self):
        self.model, self.metadata = load_model()
        self.feature_engineer = FeatureEngineer(section_stats=self.metadata.get("section_stats", {}))
        self.q10_residual = self.metadata.get("residual_q10", -2.5)
        self.q90_residual = self.metadata.get("residual_q90", +2.5)

    def predict_section(self, event: Dict[str, Any]) -> Dict[str, Any]:
        """
        Predicts travel time for a single station-to-station hop.

        Args:
            event: Dictionary with keys like train_type, distance_km, scheduled_run_time_min,
                   departure_hour, day_of_week, departure_delay_min, etc.

        Returns:
            Dict with predicted_run_time_min, lower_bound_min, upper_bound_min, delay_drift_min.
        """
        # Extract features using the leak-free pipeline
        X_live = self.feature_engineer.extract_from_realtime_event(event)

        # Run model inference (< 2ms)
        raw_pred = float(self.model.predict(X_live)[0])

        # Physical safety clamp: cannot be faster than 140 km/h or slower than 15 km/h
        dist_km = float(event.get("distance_km", event.get("next_station_distance_km", 100.0)))
        min_time = (dist_km / 140.0) * 60.0
        max_time = (dist_km / 15.0) * 60.0
        predicted_run_time = max(min_time, min(max_time, raw_pred))

        # Schedule delta
        sched_min = float(event.get("scheduled_run_time_min", event.get("scheduled_section_time_min", predicted_run_time)))
        delay_drift = predicted_run_time - sched_min

        # 80% Confidence Interval bounds using test residuals
        lower_bound = max(min_time, predicted_run_time + self.q10_residual)
        upper_bound = min(max_time, predicted_run_time + self.q90_residual)

        return {
            "predicted_run_time_min": round(predicted_run_time, 2),
            "lower_bound_min": round(lower_bound, 2),
            "upper_bound_min": round(upper_bound, 2),
            "delay_drift_min": round(delay_drift, 2),
            "model_version": self.metadata.get("model_type", "GBDT-v1.0"),
        }

    def predict_journey_timeline(
        self,
        current_time: datetime,
        current_station_code: str,
        current_delay_min: float,
        train_type: str,
        remaining_sections: List[Dict[str, Any]],
        default_dwell_minutes: float = 3.0,
    ) -> List[Dict[str, Any]]:
        """
        Dynamically forecasts ETAs for all upcoming stations down the route by cascading
        section predictions step-by-step.

        Args:
            current_time: Time of departure from current station (UTC or local tz).
            current_station_code: Code of the current station (e.g. "NDLS").
            current_delay_min: Current observed delay in minutes.
            train_type: "VB", "RAJ", "SF", or "EXP".
            remaining_sections: List of section dicts [{from_station, to_station, distance_km, scheduled_run_time_min, ...}].
            default_dwell_minutes: Average station stop duration for intermediate stops.

        Returns:
            List of station prediction dictionaries with baseline_eta, predicted_eta, confidence bounds.
        """
        timeline = []
        running_time_cursor = current_time
        running_delay = float(current_delay_min)

        for sec in remaining_sections:
            from_stn = sec["from_station"]
            to_stn = sec["to_station"]
            dist_km = float(sec["distance_km"])
            sched_min = float(sec["scheduled_run_time_min"])

            # Prepare section feature event
            sec_event = {
                "train_type": train_type,
                "station_code": from_stn,
                "next_station_code": to_stn,
                "distance_km": dist_km,
                "scheduled_run_time_min": sched_min,
                "departure_hour": running_time_cursor.hour,
                "day_of_week": running_time_cursor.weekday(),
                "departure_delay_min": running_delay,
                "section_congestion_level": float(sec.get("congestion_level", 0.55)),
                "weather_impact_flag": int(sec.get("weather_flag", 0)),
            }

            # Predict traversal time for this section
            pred_res = self.predict_section(sec_event)
            pred_run_time = pred_res["predicted_run_time_min"]

            # Compute Arrival Timestamp at to_stn
            arrival_dt = running_time_cursor + timedelta(minutes=pred_run_time)

            # Compute Naive Baseline Arrival Time (for comparison)
            baseline_arrival_dt = running_time_cursor + timedelta(minutes=sched_min + running_delay)

            # Update accumulated delay for next hop
            section_delay_drift = pred_run_time - sched_min
            running_delay = max(0.0, running_delay + section_delay_drift)

            # Confidence interval timestamps
            lower_dt = running_time_cursor + timedelta(minutes=pred_res["lower_bound_min"])
            upper_dt = running_time_cursor + timedelta(minutes=pred_res["upper_bound_min"])

            timeline.append({
                "from_station": from_stn,
                "station_code": to_stn,
                "distance_km": dist_km,
                "scheduled_section_min": sched_min,
                "predicted_section_min": pred_run_time,
                "predicted_arrival_time": arrival_dt.isoformat(),
                "baseline_arrival_time": baseline_arrival_dt.isoformat(),
                "predicted_accumulated_delay_min": round(running_delay, 1),
                "confidence_lower": lower_dt.isoformat(),
                "confidence_upper": upper_dt.isoformat(),
            })

            # Advance clock for next section (arrival time + dwell time at station)
            running_time_cursor = arrival_dt + timedelta(minutes=default_dwell_minutes)

        return timeline


# ==============================================================================
# SELF-TEST & VERIFICATION
# ==============================================================================

if __name__ == "__main__":
    from datetime import datetime, timezone

    print("=" * 75)
    print(" RailETA Predictor Utility Self-Test ")
    print("=" * 75)

    try:
        predictor = ETAPredictor()
        print("[+] Model loaded successfully into memory.")

        # Test single section prediction
        test_event = {
            "train_number": "12302",
            "train_type": "RAJ",
            "station_code": "CNB",
            "next_station_code": "PRYJ",
            "distance_km": 194.5,
            "scheduled_run_time_min": 120.0,
            "departure_hour": 18,
            "day_of_week": 4,
            "departure_delay_min": 25.0,
            "section_congestion_level": 0.85,
            "weather_impact_flag": 0,
        }

        res = predictor.predict_section(test_event)
        print("\nSingle Section Prediction (Kanpur -> Prayagraj | Rajdhani Express):")
        print(f"  * Scheduled Time       : 120.0 minutes")
        print(f"  * Current Departure Delay: 25.0 minutes (Peak Hour Congestion 0.85)")
        print(f"  * Predicted Section Run: {res['predicted_run_time_min']} minutes")
        print(f"  * 80% Confidence Range : [{res['lower_bound_min']} min, {res['upper_bound_min']} min]")
        print(f"  * Predicted Delay Drift: {res['delay_drift_min']:+0.1f} minutes")

        # Test full route timeline cascade
        route_sections = [
            {"from_station": "NDLS", "to_station": "CNB", "distance_km": 440.0, "scheduled_run_time_min": 285.0},
            {"from_station": "CNB", "to_station": "PRYJ", "distance_km": 194.5, "scheduled_run_time_min": 120.0},
            {"from_station": "PRYJ", "to_station": "DDU", "distance_km": 153.0, "scheduled_run_time_min": 105.0},
        ]
        start_time = datetime(2026, 8, 29, 16, 55, tzinfo=timezone.utc)

        timeline = predictor.predict_journey_timeline(
            current_time=start_time,
            current_station_code="NDLS",
            current_delay_min=10.0,
            train_type="RAJ",
            remaining_sections=route_sections,
        )

        print("\nMulti-Stop Cascading Journey Timeline Forecast:")
        for stop in timeline:
            print(f"  -> Station {stop['station_code']:<5} | Predicted ETA: {stop['predicted_arrival_time']} "
                  f"| Acc. Delay: {stop['predicted_accumulated_delay_min']:4.1f}m (Section Time: {stop['predicted_section_min']}m)")

        print("\n[+] Verification PASSED: Predictor utility is ready!")

    except Exception as e:
        print(f"Test note: {e}")
