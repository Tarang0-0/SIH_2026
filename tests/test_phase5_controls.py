import json
import tempfile
import unittest
from pathlib import Path

import numpy as np

from api.services.phase4_signals import derive_station_signals
from api.services.phase5_controls import (
    apply_interval_calibration,
    calibration_bucket,
    calibration_metrics,
    conformal_radius,
    population_stability_index,
    promote_model,
)


class Phase5ControlTests(unittest.TestCase):
    def test_conformal_radius_and_metrics_are_deterministic(self):
        y = np.array([10, 20, 30, 40, 50], dtype=float)
        p10 = np.array([8, 18, 28, 38, 48], dtype=float)
        p50 = np.array([10, 20, 30, 40, 50], dtype=float)
        p90 = np.array([12, 22, 32, 42, 52], dtype=float)
        self.assertEqual(conformal_radius(y, p10, p90, 0.8), 0.0)
        metrics = calibration_metrics(y, p10, p50, p90)
        self.assertEqual(metrics["rows"], 5)
        self.assertEqual(metrics["interval_coverage"], 1.0)

    def test_calibration_only_widens_bounds_and_keeps_median(self):
        from api.services import phase5_controls
        old = phase5_controls._calibration
        phase5_controls._calibration = {
            "version": "test", "global_radius_minutes": 5, "min_bucket_rows": 250,
            "buckets": {},
        }
        try:
            p10, p50, p90, bucket = apply_interval_calibration(10, 20, 30, {
                "current_delay": 5, "scheduled_travel_hours": 2,
            })
        finally:
            phase5_controls._calibration = old
        self.assertEqual((p10, p50, p90), (5, 20, 35))
        self.assertEqual(bucket, "delay:low|horizon:short")

    def test_drift_metric_requires_real_samples(self):
        self.assertIsNone(population_stability_index([1, 2], [1, 2]))
        value = population_stability_index(np.arange(100), np.arange(100) + 20)
        self.assertIsNotNone(value)
        self.assertGreater(value, 0)

    def test_promotion_requires_untouched_holdout_and_improvement(self):
        candidate = {
            "model_version": "candidate-v2",
            "previous_p50_mae_minutes": 30,
            "target_coverage": 0.8,
            "evaluation": {"rows": 120, "p50_mae_minutes": 20, "interval_coverage": 0.82},
            "holdout": {"untouched": True},
        }
        with tempfile.TemporaryDirectory() as directory:
            registry = Path(directory) / "registry.json"
            entry = promote_model(candidate, registry)
            self.assertEqual(entry["model_version"], "candidate-v2")
            self.assertEqual(json.loads(registry.read_text())["current_model_version"], "candidate-v2")

        candidate["holdout"]["untouched"] = False
        with self.assertRaises(ValueError):
            promote_model(candidate, Path(tempfile.mkdtemp()) / "registry.json")

    def test_station_signals_are_provider_derived_and_transparent(self):
        signals = derive_station_signals([
            {"expected_arrival": "10:00", "delay_in_arrival": "5"},
            {"expected_arrival": "10:15", "delay_in_arrival": "10"},
        ], 2)
        self.assertEqual(signals["train_count"], 2)
        self.assertEqual(signals["headway_min_minutes"], 15)
        self.assertFalse(signals["block_occupancy_available"])


if __name__ == "__main__":
    unittest.main()
