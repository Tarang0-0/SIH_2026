import asyncio
import datetime as dt
import os
import tempfile
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from api.routers.eta import get_train_eta
from api.routers.weather import get_weather
from api.services import feedback_store
from api.services.feedback_store import get_train_history, record_live_cycle
from api.services.weather import WeatherInvalid, WeatherUnavailable, clear_weather_cache, fetch_current_weather


class WeatherIntegrationTests(unittest.TestCase):
    def setUp(self):
        clear_weather_cache()

    def tearDown(self):
        clear_weather_cache()

    def _payload(self):
        return {
            "dt": int(dt.datetime.now(dt.timezone.utc).timestamp()),
            "main": {"temp": 29.5, "feels_like": 32.0, "humidity": 92, "pressure": 1004},
            "wind": {"speed": 12.0},
            "visibility": 1800,
            "clouds": {"all": 90},
            "rain": {"1h": 4.2},
            "weather": [{"id": 500, "main": "Rain", "description": "light rain"}],
        }

    def test_openweather_payload_is_normalized_and_risk_is_explicit(self):
        async def run():
            with patch.dict(os.environ, {"OPENWEATHER_API_KEY": "test-key"}, clear=False), \
                 patch("api.services.weather._fetch_openweather_json", AsyncMock(return_value=self._payload())):
                return await fetch_current_weather(28.64, 77.22)

        snapshot = asyncio.run(run())
        self.assertEqual(snapshot.provider, "OPENWEATHER")
        self.assertEqual(snapshot.temperature_c, 29.5)
        self.assertGreater(snapshot.weather_risk_score, 0)
        self.assertEqual(snapshot.public_dict()["coordinate_source"], "train_coordinates")
        self.assertNotIn("raw_payload", snapshot.public_dict())

    def test_missing_key_is_fail_safe(self):
        async def run():
            with patch.dict(os.environ, {"OPENWEATHER_API_KEY": ""}, clear=False):
                return await fetch_current_weather(28.64, 77.22)

        with self.assertRaises(WeatherUnavailable):
            asyncio.run(run())

    def test_invalid_payload_is_rejected(self):
        async def run():
            with patch.dict(os.environ, {"OPENWEATHER_API_KEY": "test-key"}, clear=False), \
                 patch("api.services.weather._fetch_openweather_json", AsyncMock(return_value={"main": {"temp": "bad"}})):
                return await fetch_current_weather(28.64, 77.22)

        with self.assertRaises(WeatherInvalid):
            asyncio.run(run())

    def test_weather_is_cached_for_same_location(self):
        async def run():
            fetch = AsyncMock(return_value=self._payload())
            with patch.dict(os.environ, {"OPENWEATHER_API_KEY": "test-key"}, clear=False), \
                 patch("api.services.weather._fetch_openweather_json", fetch):
                await fetch_current_weather(28.6401, 77.2201)
                await fetch_current_weather(28.6402, 77.2202)
            return fetch

        fetch = asyncio.run(run())
        self.assertEqual(fetch.await_count, 1)

    def test_weather_is_persisted_with_live_feedback(self):
        with tempfile.TemporaryDirectory() as directory:
            database = os.path.join(directory, "feedback.sqlite3")
            status = SimpleNamespace(
                observed_at=dt.datetime(2026, 9, 8, 8, 0, tzinfo=dt.timezone.utc),
                provider="TEST_PROVIDER", current_station="NDLS", next_station="BSB",
                current_delay_minutes=7, latitude=28.64, longitude=77.22, speed_kmh=40,
                observation_quality="provider_timestamp", raw_payload={"source": "test"},
            )
            eta = get_train_eta("22436", date="2026-09-08", current_station="NDLS", current_delay=7)
            weather = SimpleNamespace(
                observed_at=dt.datetime(2026, 9, 8, 8, 0, tzinfo=dt.timezone.utc).isoformat(),
                provider="OPENWEATHER", latitude=28.64, longitude=77.22,
                temperature_c=29.5, feels_like_c=32, humidity_pct=90, pressure_hpa=1004,
                wind_speed_mps=10, visibility_m=2000, precipitation_1h_mm=2,
                snow_1h_mm=0, weather_id=500, weather_main="Rain",
                weather_description="light rain", cloud_pct=90, weather_risk_score=0.6,
                observation_quality="provider_timestamp", coordinate_source="train_coordinates",
                raw_payload={"dt": 1},
            )
            with patch.dict(os.environ, {"RAILPULSE_FEEDBACK_DB": database}, clear=False):
                result = record_live_cycle("22436", dt.date(2026, 9, 8), status, eta, weather=weather)
                history = get_train_history("22436", dt.date(2026, 9, 8))
            self.assertTrue(result["weather_observation_recorded"])
            self.assertEqual(len(history["weather_observations"]), 1)
            self.assertEqual(history["weather_observations"][0]["provider"], "OPENWEATHER")

    def test_weather_endpoint_returns_provider_snapshot(self):
        async def run():
            with patch.dict(os.environ, {"OPENWEATHER_API_KEY": "test-key"}, clear=False), \
                 patch("api.routers.weather.fetch_current_weather", AsyncMock(return_value=SimpleNamespace(public_dict=lambda: {"provider": "OPENWEATHER"}))):
                return await get_weather(28.64, 77.22)

        self.assertEqual(asyncio.run(run())["provider"], "OPENWEATHER")


if __name__ == "__main__":
    unittest.main()
