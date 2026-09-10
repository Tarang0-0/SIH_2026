import datetime as dt
import os
import sys
import tempfile
import unittest
from types import SimpleNamespace
from unittest.mock import patch, MagicMock

# Add project root to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import numpy as np
from fastapi.testclient import TestClient

from api.main import app
from api.routers import eta
from api.routers.eta import _build_features, _elapsed_schedule_minutes, _model_quantiles, resolve_journey_date
from api.services import feedback_store
from api.services.feedback_store import record_live_cycle
from api.services.phase5_controls import apply_interval_calibration
from src.explainability import DelayExplainer


class AuditFixesTests(unittest.TestCase):
    def setUp(self):
        self.tempdir = tempfile.TemporaryDirectory()
        self.db_path = os.path.join(self.tempdir.name, "test_audit.sqlite3")

    def tearDown(self):
        self.tempdir.cleanup()

    def test_record_live_cycle_duplicate_safe(self):
        """Verify record_live_cycle does not crash on identical re-submission."""
        with patch.dict(os.environ, {"RAILPULSE_FEEDBACK_DB": self.db_path}, clear=False):
            status = SimpleNamespace(
                observed_at=dt.datetime(2026, 9, 10, 12, 0, tzinfo=dt.timezone.utc),
                provider="TEST_PROVIDER", current_station="NDLS", next_station="CNB",
                current_delay_minutes=25, latitude=28.6139, longitude=77.2090, speed_kmh=80.0,
                raw_payload={"test": True}, observation_quality="provider_timestamp",
            )
            dummy_eta = eta.get_train_eta("12004", date="2026-09-10", current_station="NDLS", current_delay=25)
            # First insert
            res1 = record_live_cycle("12004", dt.date(2026, 9, 10), status, dummy_eta)
            self.assertTrue(res1["observation_recorded"])

            # Immediate second insert with same status (simulate duplicate polling/retry)
            res2 = record_live_cycle("12004", dt.date(2026, 9, 10), status, dummy_eta)
            self.assertTrue(res2["observation_recorded"])
            self.assertEqual(res1["observation_id"], res2["observation_id"])

    def test_model_quantiles_fallback_preserves_current_delay(self):
        """When no ML model is loaded, _model_quantiles must preserve reported delay."""
        with patch.dict(eta.models_ref, {}, clear=True):
            features = {"current_delay": 45.0}
            p10, p50, p90, reason = _model_quantiles(features)
            self.assertEqual(p50, 45.0)
            self.assertEqual(p10, 40.0)
            self.assertEqual(p90, 60.0)
            self.assertIn("No trained model", reason)

    def test_static_eta_does_not_mark_origin_as_live_station_feed(self):
        features = _build_features(100.0, 4, 2.0, 6, 1, 9, 0.0, None)
        live_features = _build_features(100.0, 4, 2.0, 6, 1, 9, 0.0, "NDLS")
        self.assertEqual(features["is_station_feed"], 0.0)
        self.assertEqual(live_features["is_station_feed"], 1.0)

    def test_static_eta_datetimes_are_timezone_aware(self):
        response = eta.get_train_eta("12004", date="2026-09-11")
        self.assertTrue(response.stations[0].predicted_arrival_datetime.endswith("+05:30"))

    def test_elapsed_schedule_minutes_loop_guard(self):
        """Corrupt timetable sequences must fail cleanly rather than infinite looping."""
        stops = [
            {"code": "A", "sched": "10:00", "seq": 1},
            {"code": "B", "sched": "invalid", "seq": 2},
        ]
        with self.assertRaises(ValueError):
            _elapsed_schedule_minutes(stops)

    def test_resolve_journey_date_multiday(self):
        """Multi-day trains must resolve candidate dates beyond just yesterday."""
        fake_route = {
            "name": "Long Distance Express",
            "stops": [
                {"code": "AAA", "sched": "06:00", "seq": 1},
                {"code": "BBB", "sched": "18:00", "seq": 2},
                {"code": "CCC", "sched": "08:00", "seq": 3},
                {"code": "DDD", "sched": "20:00", "seq": 4},
            ]
        }
        with patch.dict(eta.TRAIN_ROUTES_INDEX, {"99999": fake_route}):
            now = dt.datetime(2026, 9, 12, 12, 0, tzinfo=eta.INDIA_TIMEZONE)
            resolved = resolve_journey_date("99999", now=now)
            self.assertIn(resolved, [dt.date(2026, 9, 10), dt.date(2026, 9, 11), dt.date(2026, 9, 12)])

    def test_apply_interval_calibration_monotonicity(self):
        """Conformal calibration must preserve p10 <= p50 <= p90."""
        with patch("api.services.phase5_controls._calibration", {"global_radius_minutes": 20.0}):
            p10_cal, p50_cal, p90_cal, _ = apply_interval_calibration(p10=10.0, p50=12.0, p90=25.0)
            self.assertTrue(0.0 <= p10_cal <= p50_cal <= p90_cal)
            self.assertEqual(p10_cal, 0.0)
            self.assertEqual(p50_cal, 12.0)
            self.assertEqual(p90_cal, 45.0)

    def test_delay_explainer_heuristic_fallback(self):
        """DelayExplainer produces heuristic explanation when SHAP returns zeros."""
        dummy_model = MagicMock()
        explainer = DelayExplainer(dummy_model)
        feature_names = ["current_delay", "fog_risk_score", "is_monsoon_season"]
        feature_values = [35.0, 0.6, 1.0]
        shap_zeros = [0.0, 0.0, 0.0]

        sentence = explainer.explain_delay(35.0, feature_names, feature_values, shap_zeros)
        self.assertIn("Predicted 35-min delay", sentence)
        self.assertIn("delay carried over from current position", sentence)

    def test_admin_reload_models_endpoint(self):
        """The reload endpoint requires the configured admin token."""
        client = TestClient(app)
        with patch.dict(os.environ, {"RAILPULSE_ADMIN_TOKEN": "test-admin-token"}, clear=False):
            unauthorized = client.post("/api/v1/admin/reload-models")
            self.assertEqual(unauthorized.status_code, 401)
            response = client.post(
                "/api/v1/admin/reload-models",
                headers={"Authorization": "Bearer test-admin-token"},
            )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "success")
        self.assertIn("timestamp", data)

    def test_operator_auth_is_server_side_and_control_room_is_protected(self):
        client = TestClient(app)
        with patch.dict(
            os.environ,
            {
                "RAILPULSE_ADMIN_TOKEN": "server-secret",
                "RAILPULSE_ADMIN_USERNAME": "operator",
                "RAILPULSE_ADMIN_PASSWORD": "strong-password",
            },
            clear=False,
        ):
            self.assertEqual(client.get("/api/v1/control-room/cascade-risk").status_code, 401)
            bad = client.post("/api/v1/admin/login", json={"username": "admin", "password": "admin@2026"})
            self.assertEqual(bad.status_code, 401)
            login = client.post("/api/v1/admin/login", json={"username": "operator", "password": "strong-password"})
            self.assertEqual(login.status_code, 200)
            token = login.json()["access_token"]
            self.assertEqual(
                client.get("/api/v1/control-room/cascade-risk", headers={"Authorization": f"Bearer {token}"}).status_code,
                503,
            )


if __name__ == "__main__":
    unittest.main()
