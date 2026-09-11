import unittest
import sys
import os
import tempfile
import datetime as dt
import asyncio
from fastapi import HTTPException
from unittest.mock import AsyncMock, patch

# Add project root to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from api.main import health_check, startup_event
from api.routers.amenities import get_station_amenities
from api.routers.alerts import subscribe_to_alerts, get_active_alerts, simulate_alert_trigger
from api.routers import alerts
from api.routers.control_room import get_control_room_cascade_risk, get_control_room_impact
from api.routers.eta import get_train_eta, resolve_journey_date
from api.schemas import AlertSubscriptionRequest
from api.services.official_status import LiveTrainStatus

class TestPhase4Capabilities(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        startup_event()

    def setUp(self):
        self._alerts_directory = tempfile.TemporaryDirectory()
        self._alerts_file = alerts.ALERTS_FILE
        alerts.ALERTS_FILE = os.path.join(self._alerts_directory.name, "alerts.json")

    def tearDown(self):
        alerts.ALERTS_FILE = self._alerts_file
        self._alerts_directory.cleanup()
    
    def test_health_check(self):
        res = health_check()
        self.assertEqual(res["status"], "healthy")
        self.assertEqual(res["service"], "RailTrackr Operations Engine")
        self.assertIn("timestamp", res)

    def test_station_amenities_catalog(self):
        with self.assertRaises(HTTPException) as unavailable:
            get_station_amenities("KOTA")
        self.assertEqual(unavailable.exception.status_code, 503)

    def test_proactive_alert_lifecycle(self):
        # 1. Subscribe
        req = AlertSubscriptionRequest(
            train_number="12951",
            station_code="KOTA",
            target_arrival_date="2026-09-03",
            user_phone="+919876543210",
            alert_window_minutes=30
        )
        sub_res = subscribe_to_alerts(req)
        self.assertEqual(sub_res.status, "success")
        self.assertTrue(sub_res.subscription_id.startswith("sub_"))
        
        # 2. Check Active
        active = get_active_alerts()
        self.assertGreaterEqual(active["count"], 1)
        
        # 3. Trigger Simulation
        trigger_res = simulate_alert_trigger(sub_res.subscription_id)
        self.assertEqual(trigger_res.status, "DISPATCHED")
        self.assertEqual(trigger_res.channel, "SMS_GATEWAY_SIMULATOR")
        self.assertIn("12951", trigger_res.payload["body"])

    def test_control_room_cascade_risk(self):
        with self.assertRaises(HTTPException) as unavailable:
            get_control_room_cascade_risk()
        self.assertEqual(unavailable.exception.status_code, 503)

    def test_control_room_uses_explicit_offline_preview_without_live_provider(self):
        with patch.dict(
            os.environ,
            {
                "RAILRADAR_API_KEY": "",
                "INDIAN_RAIL_API_KEY": "",
                "OFFICIAL_RAIL_STATUS_URL": "",
            },
            clear=False,
        ):
            result = asyncio.run(
                get_control_room_impact("12301", date="2026-09-11", lookahead_stations=4)
            )

        self.assertEqual(result["incident"]["provider"], "LOCAL_TIMETABLE_PREVIEW")
        self.assertEqual(result["data_quality"]["mode"], "offline_timetable_preview")
        self.assertFalse(result["data_quality"]["live_status_available"])
        self.assertEqual(result["affected_station_codes"], ["HWH", "DHN", "PNME", "GAYA"])
        self.assertEqual(result["affected_trains"], [])
        self.assertEqual(result["data_quality"]["failed_station_boards"], ["HWH", "DHN", "PNME", "GAYA"])

    def test_control_room_impact_uses_live_station_boards(self):
        observed_at = dt.datetime(2026, 9, 8, 8, 0, tzinfo=dt.timezone.utc)
        status = LiveTrainStatus(
            train_number="22436",
            observed_at=observed_at,
            current_station="NDLS",
            current_delay_minutes=22,
            latitude=28.64,
            longitude=77.22,
            speed_kmh=0.0,
            next_station="CNB",
            provider="RAILRADAR",
            raw_payload={
                "trainNumber": "22436",
                "trainName": "Test Express",
                "route": [
                    {"stationCode": "NDLS", "stationName": "New Delhi", "sequence": 1, "isHalt": True, "scheduledArrival": "08:00"},
                    {"stationCode": "CNB", "stationName": "Kanpur", "sequence": 2, "isHalt": True, "scheduledArrival": "11:00"},
                    {"stationCode": "DDU", "stationName": "Deen Dayal Upadhyaya", "sequence": 3, "isHalt": True, "scheduledArrival": "14:00"},
                ],
            },
        )

        async def board_for(station_code, hours=2):
            if station_code == "NDLS":
                return [
                    {"train_number": "22436", "train_name": "Test Express", "schedule_arrival": "08:00", "expected_arrival": "08:22", "delay_in_arrival": "22"},
                    {"train_number": "12301", "train_name": "Other Express", "schedule_arrival": "08:30", "expected_arrival": "08:45", "delay_in_arrival": "15"},
                ]
            return [
                {"train_number": "12301", "train_name": "Other Express", "schedule_arrival": "11:10", "expected_arrival": "11:25", "delay_in_arrival": "15"},
            ]

        with patch("api.routers.control_room.fetch_live_status", new=AsyncMock(return_value=status)), \
             patch("api.routers.control_room.fetch_live_station", new=AsyncMock(side_effect=board_for)):
            result = asyncio.run(get_control_room_impact("22436", date="2026-09-08", lookahead_stations=2))

        self.assertEqual(result["incident"]["halt_status"], "halted")
        self.assertEqual(result["incident"]["delay_minutes"], 22)
        self.assertEqual(result["affected_station_codes"], ["NDLS", "CNB"])
        self.assertEqual(len(result["affected_trains"]), 2)
        self.assertTrue(all(item["train_number"] == "12301" for item in result["affected_trains"]))
        self.assertFalse(result["data_quality"]["blockage_causality_confirmed"])

    def test_eta_is_station_aware_and_monotonic(self):
        eta = get_train_eta(
            train_number="12951",
            date="2026-09-03",
            current_station="NDLS",
            current_delay=15
        )
        self.assertEqual(eta.train_number, "12951")
        # A live ETA must not include stops already passed. NDLS is on this
        # train's route, so its result begins at the selected current station.
        self.assertGreaterEqual(len(eta.stations), 1)
        self.assertEqual(eta.stations[0].station_code, "NDLS")
        for station in eta.stations:
            self.assertLessEqual(station.p10_delay_minutes, station.delay_minutes)
            self.assertLessEqual(station.delay_minutes, station.p90_delay_minutes)
        
    def test_eta_without_date_param(self):
        # Verify bug fix: date can be omitted and defaults gracefully to today
        eta = get_train_eta(train_number="12951")
        self.assertEqual(eta.train_number, "12951")
        self.assertIsNotNone(eta.origin_station)
        self.assertIsNotNone(eta.destination_station)
        self.assertTrue(len(eta.stations) > 0)

    def test_overnight_journey_keeps_previous_departure_date_after_midnight(self):
        from zoneinfo import ZoneInfo
        india = ZoneInfo("Asia/Kolkata")
        after_midnight = dt.datetime(2026, 9, 8, 0, 10, tzinfo=india)
        before_departure = dt.datetime(2026, 9, 8, 23, 50, tzinfo=india)
        self.assertEqual(
            resolve_journey_date("12452", now=after_midnight),
            dt.date(2026, 9, 7),
        )
        self.assertEqual(
            resolve_journey_date("12452", now=before_departure),
            dt.date(2026, 9, 8),
        )
        explicit = dt.date(2026, 9, 1)
        self.assertEqual(resolve_journey_date("12452", explicit, after_midnight), explicit)

    def test_multi_train_support(self):
        # Verify 22691 Bangalore Rajdhani and 12627 Karnataka Exp
        eta_22691 = get_train_eta(train_number="22691")
        self.assertEqual(eta_22691.train_number, "22691")
        self.assertTrue(len(eta_22691.stations) >= 10)
        
        eta_12627 = get_train_eta(train_number="12627")
        self.assertEqual(eta_12627.train_number, "12627")
        self.assertTrue(len(eta_12627.stations) >= 30)

    def test_amenities_dynamic_fallback(self):
        with self.assertRaises(HTTPException) as unavailable:
            get_station_amenities("SBC")
        self.assertEqual(unavailable.exception.status_code, 503)

if __name__ == '__main__':
    unittest.main()
