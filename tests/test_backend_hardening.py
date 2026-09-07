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
        self.assertEqual(dispatched.recipient, "+919876543210")
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

    def test_search_and_amenities_reject_invalid_input_safely(self):
        self.assertEqual(eta.search_trains(""), [])
        self.assertEqual(eta.search_trains(" "), [])
        with self.assertRaises(HTTPException) as invalid_station:
            from api.routers.amenities import get_station_amenities
            get_station_amenities("!!")
        self.assertEqual(invalid_station.exception.status_code, 422)


if __name__ == "__main__":
    unittest.main()
