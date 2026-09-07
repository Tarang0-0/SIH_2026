import datetime as dt
import os
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from api.routers.eta import get_train_eta
from api.services.feedback_store import export_station_level_dataset, record_live_cycle
from api.services.phase2_dataset import build_station_level_rows, normalize_train_route
from api.services.official_status import _normalize_schedule_response


class Phase2DatasetTests(unittest.TestCase):
    def test_official_schedule_normalizes_to_runtime_route_contract(self):
        route = _normalize_schedule_response({
            "ResponseCode": "200", "TrainName": "TEST EXPRESS", "Route": [
                {"SerialNo": 1, "StationCode": "NDLS", "StationName": "NEW DELHI", "ArrivalTime": "08:00", "Distance": "0"},
                {"SerialNo": 2, "StationCode": "BSB", "StationName": "VARANASI", "ArrivalTime": "10:00", "Distance": "125"},
            ],
        }, "22436")
        self.assertEqual(route["source"], "NDLS")
        self.assertEqual(route["dest"], "BSB")
        self.assertEqual(route["stops"][1]["dist"], 125.0)

    def test_route_normalization_keeps_actual_and_expected_times_separate(self):
        observed_at = dt.datetime(2026, 9, 8, 8, 0, tzinfo=dt.timezone.utc)
        payload = {
            "TrainRoute": [
                {
                    "SerialNo": 1, "StationCode": "NDLS", "StationName": "NEW DELHI",
                    "ScheduleArrival": "08:00", "ActualArrival": "08:07", "DelayInArrival": "07 M",
                },
                {
                    "SerialNo": 2, "StationCode": "BSB", "StationName": "VARANASI",
                    "ScheduleArrival": "10:00", "ActualArrival": "10:18", "DelayInArrival": "18 M",
                    "ExpectedArrival": "10:20",
                },
            ]
        }
        events = normalize_train_route(payload, "22436", dt.date(2026, 9, 8), observed_at, "TEST")
        self.assertEqual([event["station_code"] for event in events], ["NDLS", "BSB"])
        self.assertEqual(events[0]["event_quality"], "provider_actual_event")
        self.assertTrue(events[1]["actual_arrival_at"].endswith("10:18:00+00:00"))

        rows = build_station_level_rows(events)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["current_station"], "NDLS")
        self.assertEqual(rows[0]["next_station"], "BSB")
        self.assertEqual(rows[0]["minutes_to_next"], 131.0)

    def test_upcoming_route_rows_never_become_actual_arrival_labels(self):
        payload = {"route": [{
            "sequence": 2, "stationCode": "BSB", "stationName": "VARANASI",
            "scheduledArrival": "2026-09-08T14:00:00+05:30",
            "actualArrival": "2026-09-08T14:00:00+05:30", "status": "upcoming",
        }]}
        events = normalize_train_route(payload, "22436", dt.date(2026, 9, 8), dt.datetime.now(dt.timezone.utc), "RAILRADAR")
        self.assertEqual(events[0]["event_quality"], "provider_route_observation")
        self.assertIsNone(events[0]["actual_arrival_at"])

    def test_timezone_aware_provider_time_is_converted_to_utc(self):
        from api.services.phase2_dataset import parse_provider_datetime
        parsed = parse_provider_datetime("2026-09-08T10:00:00+05:30", dt.date(2026, 9, 8))
        self.assertEqual(parsed.isoformat(), "2026-09-08T04:30:00+00:00")

    def test_feedback_cycle_persists_station_events_and_exports_labels(self):
        with tempfile.TemporaryDirectory() as directory:
            database = os.path.join(directory, "phase2.sqlite3")
            output = Path(directory) / "station_level.csv"
            status = SimpleNamespace(
                observed_at=dt.datetime(2026, 9, 8, 8, 0, tzinfo=dt.timezone.utc),
                provider="TEST_PROVIDER", current_station="NDLS", next_station="BSB",
                current_delay_minutes=7, latitude=None, longitude=None, speed_kmh=None,
                observation_quality="request_time_station_status",
                raw_payload={
                    "TrainRoute": [
                        {"SerialNo": 1, "StationCode": "NDLS", "ScheduleArrival": "08:00", "ActualArrival": "08:07", "DelayInArrival": "07 M"},
                        {"SerialNo": 2, "StationCode": "BSB", "ScheduleArrival": "10:00", "ActualArrival": "10:18", "DelayInArrival": "18 M"},
                    ]
                },
            )
            eta = get_train_eta("22436", date="2026-09-08", current_station="NDLS", current_delay=7)
            with patch.dict(os.environ, {"RAILPULSE_FEEDBACK_DB": database}, clear=False):
                result = record_live_cycle("22436", dt.date(2026, 9, 8), status, eta, "phase2-test")
                count = export_station_level_dataset(output)
            self.assertEqual(result["station_events_recorded"], 2)
            self.assertEqual(count, 1)
            self.assertIn("minutes_to_next", output.read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
