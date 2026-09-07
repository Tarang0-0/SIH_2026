import unittest

from api.services.phase3_dataset import PHASE3_FEATURES, build_phase3_rows, stable_hash


class Phase3DatasetTests(unittest.TestCase):
    def test_builds_movement_features_from_snapshot_and_later_arrival(self):
        observations = [{
            "train_number": "22436", "journey_date": "2026-09-08",
            "observed_at": "2026-09-08T08:00:00+00:00", "provider": "RAILRADAR",
            "current_station": "NDLS", "next_station": "CNB", "current_delay_minutes": 8,
            "speed_kmh": 72, "raw_payload_json": '{"currentLocation":{"coordinates":{"lat":28.64,"lng":77.22}}}',
        }]
        events = [
            {"train_number": "22436", "journey_date": "2026-09-08", "observed_at": "2026-09-08T08:00:00+00:00", "provider": "RAILRADAR", "station_code": "NDLS", "sequence": 1, "scheduled_arrival": "2026-09-08T07:55:00+00:00", "actual_arrival_at": "2026-09-08T08:08:00+00:00", "delay_arrival_minutes": 13, "raw_payload_json": '{"distance":0,"lat":28.64,"lng":77.22}'},
            {"train_number": "22436", "journey_date": "2026-09-08", "observed_at": "2026-09-08T09:30:00+00:00", "provider": "RAILRADAR", "station_code": "CNB", "sequence": 2, "scheduled_arrival": "2026-09-08T10:00:00+00:00", "actual_arrival_at": "2026-09-08T10:20:00+00:00", "delay_arrival_minutes": 20, "raw_payload_json": '{"distance":440,"lat":26.45,"lng":80.33}'},
        ]
        rows = build_phase3_rows(observations, events, [])
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["next_station"], "CNB")
        self.assertEqual(rows[0]["minutes_to_next"], 140.0)
        self.assertEqual(rows[0]["delay_change_minutes"], 12.0)
        self.assertEqual(rows[0]["distance_to_next_km"], 440.0)
        self.assertTrue(all(feature in rows[0] for feature in PHASE3_FEATURES))

    def test_segment_hash_is_stable(self):
        self.assertEqual(stable_hash("22436:NDLS:CNB"), stable_hash("22436:NDLS:CNB"))


if __name__ == "__main__":
    unittest.main()
