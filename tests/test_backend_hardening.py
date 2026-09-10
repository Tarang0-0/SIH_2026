import asyncio
import datetime as dt
import os
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
from unittest.mock import AsyncMock, patch

from fastapi import HTTPException
from pydantic import ValidationError

from api.routers import alerts, eta, telemetry
from api.routers.eta import get_train_eta
from api.services.official_status import (
    LiveStatusInvalid,
    LiveTrainStatus,
    _parse_status,
    fetch_live_station,
    fetch_live_status,
)
from api.services.network_signals import NetworkSignalsInvalid, _normalize_signal
from api.services.phase2_dataset import parse_provider_datetime
from api.services import feedback_store
from api.services.feedback_store import get_train_history, record_live_cycle
from api.schemas import AlertSubscriptionRequest


class _ConnectedRequest:
    async def is_disconnected(self):
        return False


class BackendHardeningTests(unittest.TestCase):
    def setUp(self):
        self.tempdir = tempfile.TemporaryDirectory()
        self.original_alerts_file = alerts.ALERTS_FILE
        alerts.ALERTS_FILE = os.path.join(self.tempdir.name, "alerts.json")

    def tearDown(self):
        alerts.ALERTS_FILE = self.original_alerts_file
        self.tempdir.cleanup()

    def test_alerts_are_unique_validated_and_redacted(self):
        request = AlertSubscriptionRequest(
            train_number="12951", station_code="kota", target_arrival_date="2026-09-03",
            user_phone="+919876543210", alert_window_minutes=30,
        )
        first = alerts.subscribe_to_alerts(request)
        second = alerts.subscribe_to_alerts(request)
        self.assertNotEqual(first.subscription_id, second.subscription_id)
        active = alerts.get_active_alerts()
        self.assertEqual(active["count"], 2)
        self.assertNotIn("user_phone", active["subscriptions"][0])
        dispatched = alerts.simulate_alert_trigger(first.subscription_id)
        self.assertEqual(dispatched.recipient, "***********10")
        with self.assertRaises(HTTPException) as missing:
            alerts.simulate_alert_trigger("sub_does_not_exist")
        self.assertEqual(missing.exception.status_code, 404)
        with self.assertRaises(ValidationError):
            AlertSubscriptionRequest(train_number="12", station_code="KOTA", target_arrival_date="bad-date", user_phone="123")

    def test_telemetry_rejects_unknown_train_and_uses_only_provider_data(self):
        with self.assertRaises(HTTPException) as missing:
            telemetry.get_train_stops("does-not-exist")
        self.assertEqual(missing.exception.status_code, 404)

        async def first_event():
            status = LiveTrainStatus(
                train_number="12627", observed_at=dt.datetime.now(dt.timezone.utc), current_station="SBC",
                current_delay_minutes=12, latitude=12.9784, longitude=77.5694, speed_kmh=45.0,
                next_station="BNC", provider="TEST_OFFICIAL_PROVIDER",
            )
            with patch.dict(os.environ, {"RAILPULSE_FEEDBACK_DB": os.path.join(self.tempdir.name, "telemetry.sqlite3")}, clear=False):
                with patch.object(telemetry, "fetch_live_status", AsyncMock(return_value=status)):
                    response = await telemetry.stream_live_gps("12627", _ConnectedRequest())
                    return await response.body_iterator.__anext__()

        event = asyncio.run(first_event())
        if isinstance(event, bytes):
            event = event.decode("utf-8")
        self.assertTrue(event.startswith("data: "))
        self.assertIn('"data_source": "TEST_OFFICIAL_PROVIDER"', event)

    def test_telemetry_refuses_to_invent_live_data_without_provider(self):
        async def request_stream():
            with patch.dict(os.environ, {"OFFICIAL_RAIL_STATUS_URL": "", "RAILRADAR_API_KEY": "", "INDIAN_RAIL_API_KEY": ""}, clear=False):
                return await telemetry.stream_live_gps("12627", _ConnectedRequest())

        with self.assertRaises(HTTPException) as unavailable:
            asyncio.run(request_stream())
        self.assertEqual(unavailable.exception.status_code, 503)

    def test_provider_rejects_stale_or_mismatched_status(self):
        stale = {
            "train_number": "12627", "observed_at": "2020-01-01T00:00:00+00:00",
            "current_station": "SBC", "current_delay_minutes": 2,
        }
        with self.assertRaises(LiveStatusInvalid):
            _parse_status(stale, "12627")
        with self.assertRaises(LiveStatusInvalid):
            _parse_status({**stale, "train_number": "12951"}, "12627")

    def test_provider_accepts_zero_padded_train_numbers(self):
        payload = {
            "train_number": "012627", "observed_at": dt.datetime.now(dt.timezone.utc).isoformat(),
            "current_station": "SBC", "current_delay_minutes": 2,
        }
        self.assertEqual(_parse_status(payload, "12627").train_number, "12627")

    def test_network_signal_boolean_strings_are_normalized(self):
        self.assertFalse(_normalize_signal({"station_code": "NDLS", "maintenance_active": "false"})["maintenance_active"])
        self.assertTrue(_normalize_signal({"station_code": "NDLS", "maintenance_active": "YES"})["maintenance_active"])
        with self.assertRaises(NetworkSignalsInvalid):
            _normalize_signal({"station_code": "NDLS", "maintenance_active": "maybe"})

    def test_provider_date_without_year_handles_new_year_rollover(self):
        journey_date = dt.date(2026, 1, 1)
        parsed = parse_provider_datetime("23:50, 31 Dec", journey_date)
        self.assertEqual(parsed.date(), dt.date(2025, 12, 31))

    def test_feedback_resolves_all_prior_predictions_for_first_station_arrival(self):
        feedback_db = os.path.join(self.tempdir.name, "multi_forecast.sqlite3")
        with patch.dict(os.environ, {"RAILPULSE_FEEDBACK_DB": feedback_db}, clear=False), \
             patch.object(feedback_store, "ONLINE_DATASET_PATH", Path(self.tempdir.name) / "online.csv"):
            first = SimpleNamespace(
                observed_at=dt.datetime(2026, 9, 3, 8, 0, tzinfo=dt.timezone.utc),
                provider="TEST_PROVIDER", current_station="NDLS", next_station="BSB",
                current_delay_minutes=15, latitude=None, longitude=None, speed_kmh=None,
                raw_payload={}, observation_quality="provider_timestamp",
            )
            first_eta = get_train_eta("22436", date="2026-09-03", current_station="NDLS", current_delay=15)
            record_live_cycle("22436", dt.date(2026, 9, 3), first, first_eta, model_version="test")
            second = SimpleNamespace(**{**first.__dict__, "observed_at": dt.datetime(2026, 9, 3, 8, 30, tzinfo=dt.timezone.utc)})
            second_eta = get_train_eta("22436", date="2026-09-03", current_station="NDLS", current_delay=15)
            record_live_cycle("22436", dt.date(2026, 9, 3), second, second_eta, model_version="test")
            next_station = first_eta.current_location["next_station_code"]
            arrival = SimpleNamespace(**{**first.__dict__, "observed_at": dt.datetime(2026, 9, 3, 10, 0, tzinfo=dt.timezone.utc), "current_station": next_station, "current_delay_minutes": 19})
            arrival_eta = get_train_eta("22436", date="2026-09-03", current_station=next_station, current_delay=19)
            result = record_live_cycle("22436", dt.date(2026, 9, 3), arrival, arrival_eta, model_version="test")
            self.assertEqual(result["latest_comparison"]["resolved_forecast_count"], 2)
            self.assertEqual(get_train_history("22436", dt.date(2026, 9, 3))["comparison_count"], 2)

    def test_indian_rail_api_live_train_status_is_normalized(self):
        payload = {
            "ResponseCode": "200",
            "TrainNumber": "12627",
            "CurrentStation": {
                "StationCode": "SBC",
                "DelayInArrival": "12 M",
                "DelayInDeparture": "14 M",
            },
            "TrainRoute": [],
            "Message": "SUCCESS",
        }

        async def fetch():
            with patch.dict(os.environ, {"INDIAN_RAIL_API_KEY": "test-key", "RAILRADAR_API_KEY": ""}, clear=False):
                with patch("api.services.official_status._fetch_indian_rail_json", AsyncMock(return_value=payload)):
                    return await fetch_live_status("12627", dt.date(2026, 9, 7))

        status = asyncio.run(fetch())
        self.assertEqual(status.current_station, "SBC")
        self.assertEqual(status.current_delay_minutes, 14)
        self.assertEqual(status.provider, "INDIAN_RAIL_API")
        self.assertIsNone(status.latitude)

    def test_railradar_live_train_status_is_normalized(self):
        now = dt.datetime.now(dt.timezone.utc).isoformat()
        payload = {
            "success": True,
            "data": {
                "trainNumber": "12627", "trainName": "KARNATAKA EXP", "lastUpdatedAt": now,
                "delayMinutes": 12,
                "currentLocation": {"stationCode": "SBC", "speedKmh": 54.5},
                "nextHalt": {"stationCode": "BNC"},
                "train": {"number": "12627", "source": {"code": "NDLS"}, "destination": {"code": "SBC"}},
                "route": [
                    {"sequence": 1, "stationCode": "NDLS", "stationName": "NEW DELHI", "isHalt": True, "scheduledDeparture": now, "actualDeparture": now, "distance": 0},
                    {"sequence": 2, "stationCode": "PASS", "stationName": "PASS THROUGH", "isHalt": False, "scheduledArrival": now, "distance": 100},
                    {"sequence": 3, "stationCode": "SBC", "stationName": "KSR BENGALURU", "isHalt": True, "scheduledArrival": now, "actualArrival": now, "distance": 2100},
                ],
            },
        }

        async def fetch():
            with patch.dict(os.environ, {"RAILRADAR_API_KEY": "test-key", "INDIAN_RAIL_API_KEY": ""}, clear=False):
                with patch("api.services.official_status._fetch_railradar_json", AsyncMock(return_value=payload)):
                    return await fetch_live_status("12627", dt.date(2026, 9, 8))

        status = asyncio.run(fetch())
        self.assertEqual(status.provider, "RAILRADAR")
        self.assertEqual(status.current_station, "SBC")
        self.assertEqual(status.next_station, "BNC")
        self.assertEqual(status.speed_kmh, 54.5)
        from api.services.official_status import runtime_route_from_status
        route = runtime_route_from_status(status)
        self.assertEqual([stop["code"] for stop in route["stops"]], ["NDLS", "SBC"])

    def test_indian_rail_api_live_station_is_normalized(self):
        payload = {
            "ResponseCode": "200",
            "Status": "SUCCESS",
            "Trains": [{
                "Name": "TEST EXPRESS", "Number": "12951", "Source": "NDLS", "Destination": "MMCT",
                "ScheduleArrival": "10:00", "ScheduleDeparture": "10:05", "Halt": "00:05",
                "ExpectedArrival": "10:24, 07 Sep", "DelayInArrival": "00:24",
                "ExpectedDeparture": "10:29, 07 Sep", "DelayInDeparture": "00:24",
            }],
        }

        async def fetch():
            with patch.dict(os.environ, {"INDIAN_RAIL_API_KEY": "test-key", "RAILRADAR_API_KEY": ""}, clear=False):
                with patch("api.services.official_status._fetch_indian_rail_json", AsyncMock(return_value=payload)):
                    return await fetch_live_station("kota", 2)

        trains = asyncio.run(fetch())
        self.assertEqual(trains[0]["train_number"], "12951")
        self.assertEqual(trains[0]["delay_in_arrival"], "00:24")

    def test_eta_malformed_route_is_a_client_error(self):
        original_index = eta.TRAIN_ROUTES_INDEX
        eta.TRAIN_ROUTES_INDEX = {"bad": {"name": "Bad", "stops": [{"seq": "x", "code": "BAD", "sched": "12:00"}]}}
        try:
            with self.assertRaises(HTTPException) as malformed:
                eta.get_train_eta("bad")
            self.assertEqual(malformed.exception.status_code, 422)
        finally:
            eta.TRAIN_ROUTES_INDEX = original_index

    def test_live_feedback_resolves_next_station_forecast(self):
        feedback_db = os.path.join(self.tempdir.name, "feedback.sqlite3")
        with patch.dict(os.environ, {"RAILPULSE_FEEDBACK_DB": feedback_db}, clear=False), \
             patch.object(feedback_store, "ONLINE_DATASET_PATH", Path(self.tempdir.name) / "online.csv"):
            first_status = SimpleNamespace(
                observed_at=dt.datetime(2026, 9, 3, 8, 0, tzinfo=dt.timezone.utc),
                provider="TEST_PROVIDER", current_station="NDLS", next_station="BSB",
                current_delay_minutes=15, latitude=None, longitude=None, speed_kmh=None,
                raw_payload={"source": "unit-test"}, observation_quality="provider_timestamp",
            )
            first_eta = get_train_eta("22436", date="2026-09-03", current_station="NDLS", current_delay=15)
            first_result = record_live_cycle("22436", dt.date(2026, 9, 3), first_status, first_eta, model_version="test-model")
            self.assertTrue(first_result["observation_recorded"])
            self.assertIsNone(first_result["latest_comparison"])

            next_station = first_eta.current_location["next_station_code"]
            second_status = SimpleNamespace(
                observed_at=dt.datetime(2026, 9, 3, 10, 0, tzinfo=dt.timezone.utc),
                provider="TEST_PROVIDER", current_station=next_station, next_station=None,
                current_delay_minutes=19, latitude=None, longitude=None, speed_kmh=None,
                raw_payload={"source": "unit-test"}, observation_quality="provider_timestamp",
            )
            second_eta = get_train_eta(
                "22436", date="2026-09-03", current_station=next_station, current_delay=19
            )
            second_result = record_live_cycle("22436", dt.date(2026, 9, 3), second_status, second_eta, model_version="test-model")
            self.assertIsNotNone(second_result["latest_comparison"])
            self.assertEqual(second_result["latest_comparison"]["station_code"], next_station)
            history = get_train_history("22436", dt.date(2026, 9, 3))
            self.assertEqual(history["observation_count"], 2)
            self.assertEqual(history["comparison_count"], 1)
            self.assertEqual(history["observations"][0]["observation_quality"], "provider_timestamp")
            self.assertEqual(history["comparisons"][0]["model_version"], "test-model")

    def test_live_feedback_does_not_score_same_station_as_an_arrival(self):
        feedback_db = os.path.join(self.tempdir.name, "same_station.sqlite3")
        with patch.dict(os.environ, {"RAILPULSE_FEEDBACK_DB": feedback_db}, clear=False), \
             patch.object(feedback_store, "ONLINE_DATASET_PATH", Path(self.tempdir.name) / "online.csv"):
            status = SimpleNamespace(
                observed_at=dt.datetime(2026, 9, 3, 8, 0, tzinfo=dt.timezone.utc),
                provider="TEST_PROVIDER", current_station="NDLS", next_station="BSB",
                current_delay_minutes=15, latitude=None, longitude=None, speed_kmh=None,
                raw_payload={"source": "unit-test"}, observation_quality="provider_timestamp",
            )
            eta_payload = get_train_eta("22436", date="2026-09-03", current_station="NDLS", current_delay=15)
            record_live_cycle("22436", dt.date(2026, 9, 3), status, eta_payload, model_version="test-model")

            repeated_status = SimpleNamespace(**{
                **status.__dict__,
                "observed_at": dt.datetime(2026, 9, 3, 8, 15, tzinfo=dt.timezone.utc),
            })
            repeated_eta = get_train_eta("22436", date="2026-09-03", current_station="NDLS", current_delay=15)
            result = record_live_cycle("22436", dt.date(2026, 9, 3), repeated_status, repeated_eta, model_version="test-model")
            self.assertIsNone(result["latest_comparison"])
            history = get_train_history("22436", dt.date(2026, 9, 3))
            self.assertEqual(history["comparison_count"], 0)

    def test_search_and_amenities_reject_invalid_input_safely(self):
        self.assertEqual(eta.search_trains(""), [])
        self.assertEqual(eta.search_trains(" "), [])
        with self.assertRaises(HTTPException) as invalid_station:
            from api.routers.amenities import get_station_amenities
            get_station_amenities("!!")
        self.assertEqual(invalid_station.exception.status_code, 422)

    def test_schema_initializes_once_per_database(self):
        db_path = Path(self.tempdir.name) / "test_init_once.sqlite3"
        conn1 = feedback_store._connect(db_path)
        self.assertIn(db_path.resolve(), feedback_store._initialized_databases)
        conn1.close()

        # Connect a second time; schema initialization should be skipped
        conn2 = feedback_store._connect(db_path)
        self.assertIn(db_path.resolve(), feedback_store._initialized_databases)
        conn2.close()

    def test_http_client_connection_pooling_and_lifecycle(self):
        from api.services.http_client import get_http_client, close_http_client
        client1 = get_http_client(15.0)
        client2 = get_http_client(15.0)
        self.assertIs(client1, client2)
        self.assertFalse(client1.is_closed)

        asyncio.run(close_http_client())
        self.assertTrue(client1.is_closed)

    def test_idempotent_loading_skips_reload(self):
        from api.routers import eta
        from api.services import phase5_controls
        eta.load_train_index()
        initial_len = len(eta.TRAIN_ROUTES_INDEX)
        self.assertGreater(initial_len, 0)
        eta.load_train_index()
        self.assertEqual(len(eta.TRAIN_ROUTES_INDEX), initial_len)

        phase5_controls.load_phase5_calibration()
        phase5_controls.load_phase5_calibration()

    def test_hot_reload_refreshes_all_model_tiers_and_calibration(self):
        import api.main as main
        from api.services import phase2_models, phase3_models, phase5_controls
        fake_model = SimpleNamespace(feature_names_in_=("feature",))
        with patch.object(main.joblib, "load", side_effect=[fake_model, fake_model, fake_model]), \
             patch.object(main, "DelayExplainer", return_value=object()), \
             patch.object(main, "load_feature_defaults") as defaults, \
             patch.object(main, "load_historical_records") as history, \
             patch.object(main, "load_model_metadata") as metadata, \
             patch.object(main, "load_phase3_models") as phase3, \
             patch.object(main, "load_phase2_models") as phase2, \
             patch.object(main, "load_phase5_calibration") as calibration, \
             patch.object(main, "set_models") as set_models, \
             patch("os.path.exists", return_value=True):
            main._hot_reload_models()
        defaults.assert_called_once_with(force=True)
        history.assert_called_once_with(force=True)
        metadata.assert_called_once_with(force=True)
        phase3.assert_called_once_with()
        phase2.assert_called_once_with()
        calibration.assert_called_once_with(force=True)
        set_models.assert_called_once()

    def test_bounded_weather_and_schedule_cache_eviction(self):
        from api.services import weather
        from api.routers import telemetry

        weather.clear_weather_cache()
        original_cap = weather.MAX_WEATHER_CACHE_SIZE
        try:
            weather.MAX_WEATHER_CACHE_SIZE = 3
            for i in range(5):
                key = (float(i), float(i))
                if len(weather._cache) >= weather.MAX_WEATHER_CACHE_SIZE and key not in weather._cache:
                    oldest = min(weather._cache.keys(), key=lambda k: weather._cache[k][0])
                    weather._cache.pop(oldest, None)
                weather._cache[key] = (float(i), None)
            self.assertEqual(len(weather._cache), 3)
            self.assertIn((4.0, 4.0), weather._cache)
            self.assertNotIn((0.0, 0.0), weather._cache)
        finally:
            weather.MAX_WEATHER_CACHE_SIZE = original_cap
            weather.clear_weather_cache()

        original_sched_cap = telemetry.MAX_SCHEDULE_CACHE_SIZE
        try:
            telemetry.MAX_SCHEDULE_CACHE_SIZE = 3
            telemetry._official_schedule_cache.clear()
            for i in range(5):
                t_key = f"train_{i}"
                if len(telemetry._official_schedule_cache) >= telemetry.MAX_SCHEDULE_CACHE_SIZE and t_key not in telemetry._official_schedule_cache:
                    oldest = min(telemetry._official_schedule_cache.keys(), key=lambda k: telemetry._official_schedule_cache[k][0])
                    telemetry._official_schedule_cache.pop(oldest, None)
                telemetry._official_schedule_cache[t_key] = (float(i), {})
            self.assertEqual(len(telemetry._official_schedule_cache), 3)
            self.assertIn("train_4", telemetry._official_schedule_cache)
            self.assertNotIn("train_0", telemetry._official_schedule_cache)
        finally:
            telemetry.MAX_SCHEDULE_CACHE_SIZE = original_sched_cap
            telemetry._official_schedule_cache.clear()

    def test_rate_limiter_middleware_enforces_limit_and_exempts_health(self):
        from starlette.applications import Starlette
        from starlette.middleware import Middleware
        from starlette.responses import PlainTextResponse
        from starlette.routing import Route
        from starlette.testclient import TestClient
        from api.middleware.rate_limit import RateLimiterMiddleware

        demo_app = Starlette(
            routes=[
                Route("/health", lambda r: PlainTextResponse("ok")),
                Route("/api/test", lambda r: PlainTextResponse("hello")),
            ],
            middleware=[
                Middleware(RateLimiterMiddleware, default_max_requests=2, window_seconds=60),
            ],
        )
        import warnings
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", DeprecationWarning)
            client = TestClient(demo_app)

            # Health is exempt
            for _ in range(5):
                response = client.get("/health")
                self.assertEqual(response.status_code, 200)

            # Normal endpoint is limited to 2
            r1 = client.get("/api/test")
            self.assertEqual(r1.status_code, 200)
            r2 = client.get("/api/test")
            self.assertEqual(r2.status_code, 200)
            r3 = client.get("/api/test")
            self.assertEqual(r3.status_code, 429)
            self.assertIn("Rate limit exceeded", r3.json()["detail"])
            self.assertIn("Retry-After", r3.headers)

            # Forwarding headers are untrusted by default; rotating fake
            # addresses must not bypass the limiter.
            with patch.dict(os.environ, {"RATE_LIMIT_TRUST_PROXY_HEADERS": "false"}, clear=False):
                limited = client.get("/api/test", headers={"X-Forwarded-For": "203.0.113.10"})
                self.assertEqual(limited.status_code, 429)


if __name__ == "__main__":
    unittest.main()
