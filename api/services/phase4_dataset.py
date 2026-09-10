"""External-signal feature contract for Phase 4 training exports."""

from __future__ import annotations

PHASE4_WEATHER_FEATURES = [
    "weather_available", "weather_temperature_c", "weather_feels_like_c",
    "weather_humidity_pct", "weather_pressure_hpa", "weather_wind_speed_mps",
    "weather_visibility_m", "weather_precipitation_1h_mm", "weather_snow_1h_mm",
    "weather_cloud_pct", "weather_risk_score", "weather_age_minutes",
]


def add_weather_features(observation: dict, weather: dict | None) -> dict:
    """Attach only provider-backed weather features; missing stays missing."""
    result = {}
    for field in PHASE4_WEATHER_FEATURES:
        result[field] = None
    result["weather_available"] = 0
    if not weather:
        return result
    result.update({
        "weather_available": 1,
        "weather_temperature_c": weather.get("temperature_c"),
        "weather_feels_like_c": weather.get("feels_like_c"),
        "weather_humidity_pct": weather.get("humidity_pct"),
        "weather_pressure_hpa": weather.get("pressure_hpa"),
        "weather_wind_speed_mps": weather.get("wind_speed_mps"),
        "weather_visibility_m": weather.get("visibility_m"),
        "weather_precipitation_1h_mm": weather.get("precipitation_1h_mm"),
        "weather_snow_1h_mm": weather.get("snow_1h_mm"),
        "weather_cloud_pct": weather.get("cloud_pct"),
        "weather_risk_score": weather.get("weather_risk_score"),
        "weather_age_minutes": weather.get("weather_age_minutes"),
    })
    return result
