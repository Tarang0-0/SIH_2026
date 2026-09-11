"""OpenWeather current conditions with validation, caching, and safe features.

Weather is an external signal, not a truth label.  The normalized snapshot is
stored with its provider quality and coordinates so a later training run can
choose whether to use it without silently imputing a weather value.
"""

from __future__ import annotations

import datetime as dt
import dataclasses
import math
import os
import time
from dataclasses import dataclass
from typing import Any, Optional
from urllib.parse import urlparse

import httpx

from api.services.http_client import get_http_client


class WeatherUnavailable(Exception):
    """Raised when OpenWeather is not configured or cannot be reached."""


class WeatherInvalid(Exception):
    """Raised when OpenWeather returns a payload we cannot trust."""


@dataclass(frozen=True)
class WeatherSnapshot:
    provider: str
    observed_at: dt.datetime
    latitude: float
    longitude: float
    temperature_c: Optional[float]
    feels_like_c: Optional[float]
    humidity_pct: Optional[float]
    pressure_hpa: Optional[float]
    wind_speed_mps: Optional[float]
    visibility_m: Optional[float]
    precipitation_1h_mm: float
    snow_1h_mm: float
    weather_id: Optional[int]
    weather_main: Optional[str]
    weather_description: Optional[str]
    cloud_pct: Optional[float]
    weather_risk_score: float
    observation_quality: str
    coordinate_source: str = "train_coordinates"
    raw_payload: Optional[dict[str, Any]] = None

    def public_dict(self) -> dict[str, Any]:
        """Return the frontend-safe snapshot; never expose the raw provider body."""
        return {
            "provider": self.provider,
            "observed_at": self.observed_at.isoformat(),
            "latitude": self.latitude,
            "longitude": self.longitude,
            "temperature_c": self.temperature_c,
            "feels_like_c": self.feels_like_c,
            "humidity_pct": self.humidity_pct,
            "pressure_hpa": self.pressure_hpa,
            "wind_speed_mps": self.wind_speed_mps,
            "visibility_m": self.visibility_m,
            "precipitation_1h_mm": self.precipitation_1h_mm,
            "snow_1h_mm": self.snow_1h_mm,
            "weather_id": self.weather_id,
            "weather_main": self.weather_main,
            "weather_description": self.weather_description,
            "cloud_pct": self.cloud_pct,
            "weather_risk_score": self.weather_risk_score,
            "observation_quality": self.observation_quality,
            "coordinate_source": self.coordinate_source,
        }


_cache: dict[tuple[float, float], tuple[float, WeatherSnapshot]] = {}
MAX_WEATHER_CACHE_SIZE = 500


def _api_key() -> str:
    return os.getenv("OPENWEATHER_API_KEY", "").strip()


def _endpoint() -> str:
    return os.getenv("OPENWEATHER_API_URL", "").strip().rstrip("/")


def _cache_seconds() -> int:
    try:
        value = int(os.getenv("OPENWEATHER_CACHE_SECONDS", "900"))
    except ValueError:
        value = 900
    return max(60, min(3600, value))


def _validate_coordinates(latitude: Any, longitude: Any) -> tuple[float, float]:
    try:
        latitude, longitude = float(latitude), float(longitude)
    except (TypeError, ValueError) as error:
        raise WeatherInvalid("latitude and longitude must be numeric") from error
    if not all(math.isfinite(value) for value in (latitude, longitude)):
        raise WeatherInvalid("latitude and longitude must be finite")
    if not -90 <= latitude <= 90 or not -180 <= longitude <= 180:
        raise WeatherInvalid("coordinates are out of range")
    return latitude, longitude


def _optional_number(value: Any, minimum: float, maximum: float, field: str) -> Optional[float]:
    if value is None:
        return None
    try:
        number = float(value)
    except (TypeError, ValueError) as error:
        raise WeatherInvalid(f"OpenWeather returned invalid {field}") from error
    if not math.isfinite(number) or not minimum <= number <= maximum:
        raise WeatherInvalid(f"OpenWeather returned out-of-range {field}")
    return number


def _risk_score(
    weather_main: Optional[str],
    visibility_m: Optional[float],
    wind_speed_mps: Optional[float],
    humidity_pct: Optional[float],
    precipitation_1h_mm: float,
    snow_1h_mm: float,
) -> float:
    """Create an auditable feature, not a learned delay prediction."""
    main = (weather_main or "").lower()
    score = 0.0
    if any(token in main for token in ("thunderstorm", "tornado")):
        score += 0.75
    elif any(token in main for token in ("snow", "rain", "drizzle")):
        score += 0.35
    elif any(token in main for token in ("fog", "mist", "haze", "smoke", "dust", "sand")):
        score += 0.30
    if precipitation_1h_mm >= 10 or snow_1h_mm >= 5:
        score += 0.25
    elif precipitation_1h_mm >= 2 or snow_1h_mm >= 1:
        score += 0.10
    if visibility_m is not None and visibility_m < 2000:
        score += 0.25
    elif visibility_m is not None and visibility_m < 5000:
        score += 0.10
    if wind_speed_mps is not None and wind_speed_mps >= 17:
        score += 0.20
    elif wind_speed_mps is not None and wind_speed_mps >= 10:
        score += 0.08
    if humidity_pct is not None and humidity_pct >= 95 and visibility_m is not None and visibility_m < 5000:
        score += 0.05
    return round(min(1.0, score), 3)


def _timestamp(payload: dict[str, Any]) -> tuple[dt.datetime, str]:
    raw = payload.get("dt")
    if raw is not None:
        try:
            value = dt.datetime.fromtimestamp(float(raw), tz=dt.timezone.utc)
            age = (dt.datetime.now(dt.timezone.utc) - value).total_seconds()
            if -300 <= age <= 3 * 3600:
                return value, "provider_timestamp"
        except (TypeError, ValueError, OverflowError, OSError):
            pass
    return dt.datetime.now(dt.timezone.utc), "request_time_provider_payload"


def _normalize(payload: Any, latitude: float, longitude: float) -> WeatherSnapshot:
    if not isinstance(payload, dict):
        raise WeatherInvalid("OpenWeather response must be a JSON object")
    main = payload.get("main") if isinstance(payload.get("main"), dict) else {}
    wind = payload.get("wind") if isinstance(payload.get("wind"), dict) else {}
    clouds = payload.get("clouds") if isinstance(payload.get("clouds"), dict) else {}
    weather_items = payload.get("weather") if isinstance(payload.get("weather"), list) else []
    weather = weather_items[0] if weather_items and isinstance(weather_items[0], dict) else {}
    rain = payload.get("rain") if isinstance(payload.get("rain"), dict) else {}
    snow = payload.get("snow") if isinstance(payload.get("snow"), dict) else {}
    temperature = _optional_number(main.get("temp"), -100, 70, "temperature")
    feels_like = _optional_number(main.get("feels_like"), -100, 70, "feels_like")
    humidity = _optional_number(main.get("humidity"), 0, 100, "humidity")
    pressure = _optional_number(main.get("pressure"), 300, 1200, "pressure")
    wind_speed = _optional_number(wind.get("speed"), 0, 150, "wind speed")
    visibility = _optional_number(payload.get("visibility"), 0, 100000, "visibility")
    cloud_pct = _optional_number(clouds.get("all"), 0, 100, "cloud percentage")
    precipitation = _optional_number(rain.get("1h", 0), 0, 1000, "rainfall") or 0.0
    snow_1h = _optional_number(snow.get("1h", 0), 0, 1000, "snowfall") or 0.0
    weather_id = weather.get("id")
    if weather_id is not None:
        try:
            weather_id = int(weather_id)
        except (TypeError, ValueError) as error:
            raise WeatherInvalid("OpenWeather returned invalid weather id") from error
    weather_main = str(weather.get("main") or "").strip() or None
    weather_description = str(weather.get("description") or "").strip() or None
    observed_at, quality = _timestamp(payload)
    return WeatherSnapshot(
        provider="OPENWEATHER", observed_at=observed_at,
        latitude=latitude, longitude=longitude,
        temperature_c=temperature, feels_like_c=feels_like, humidity_pct=humidity,
        pressure_hpa=pressure, wind_speed_mps=wind_speed, visibility_m=visibility,
        precipitation_1h_mm=precipitation, snow_1h_mm=snow_1h,
        weather_id=weather_id, weather_main=weather_main,
        weather_description=weather_description, cloud_pct=cloud_pct,
        weather_risk_score=_risk_score(weather_main, visibility, wind_speed, humidity, precipitation, snow_1h),
        observation_quality=quality, raw_payload=payload,
    )


async def _fetch_openweather_json(latitude: float, longitude: float) -> Any:
    key = _api_key()
    if not key:
        raise WeatherUnavailable("OPENWEATHER_API_KEY is not configured")
    endpoint = _endpoint()
    if not endpoint:
        raise WeatherUnavailable("OPENWEATHER_API_URL is not configured")
    parsed = urlparse(endpoint)
    if parsed.scheme != "https" or not parsed.netloc:
        raise WeatherUnavailable("OpenWeather endpoint must use HTTPS")
    try:
        client = get_http_client(15.0)
        response = await client.get(
            endpoint,
            params={"lat": latitude, "lon": longitude, "appid": key, "units": "metric"},
            headers={"Accept": "application/json"},
        )
        response.raise_for_status()
        return response.json()
    except httpx.HTTPStatusError as error:
        if error.response.status_code in (401, 403):
            raise WeatherUnavailable("OpenWeather rejected the configured API key") from error
        raise WeatherUnavailable("OpenWeather returned an HTTP error") from error
    except httpx.HTTPError as error:
        raise WeatherUnavailable("OpenWeather could not be reached") from error
    except ValueError as error:
        raise WeatherInvalid("OpenWeather returned invalid JSON") from error


async def fetch_current_weather(
    latitude: Any,
    longitude: Any,
    *,
    coordinate_source: str = "train_coordinates",
    force_refresh: bool = False,
) -> WeatherSnapshot:
    """Fetch a validated, short-lived current-weather snapshot."""
    latitude, longitude = _validate_coordinates(latitude, longitude)
    key = (round(latitude, 3), round(longitude, 3))
    cached = _cache.get(key)
    if cached and not force_refresh and time.monotonic() - cached[0] < _cache_seconds():
        snapshot = cached[1]
        return WeatherSnapshot(**{**dataclasses.asdict(snapshot), "coordinate_source": coordinate_source})
    snapshot = _normalize(await _fetch_openweather_json(latitude, longitude), latitude, longitude)
    snapshot = WeatherSnapshot(**{**dataclasses.asdict(snapshot), "coordinate_source": coordinate_source})
    if len(_cache) >= MAX_WEATHER_CACHE_SIZE and key not in _cache:
        oldest_key = min(_cache.keys(), key=lambda k: _cache[k][0])
        _cache.pop(oldest_key, None)
    _cache[key] = (time.monotonic(), snapshot)
    return snapshot


def clear_weather_cache() -> None:
    """Clear process-local weather cache; useful for tests and operational resets."""
    _cache.clear()
