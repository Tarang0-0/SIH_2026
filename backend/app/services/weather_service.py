"""
RailETA — Live OpenWeather Integration Service
Problem Statement 26028: Dynamic Forecast of ETA for Coaching Trains

Fetches real-time atmospheric observations (visibility, temperature, rainfall, fog)
from OpenWeatherMap API to compute physical loco speed restrictions and sectional delay multipliers.
"""

import logging
import time
from typing import Dict, Any, Optional
import httpx

from app.core.config import settings
from app.services.providers.catalog import STATION_MASTER

logger = logging.getLogger("raileta.weather")

# In-memory weather observation cache: key -> (timestamp, data)
_WEATHER_CACHE: Dict[str, tuple[float, Dict[str, Any]]] = {}
CACHE_TTL_SECONDS = 600 # 10 minutes cache


class WeatherService:
    @staticmethod
    async def get_station_weather(station_code: str) -> Dict[str, Any]:
        """
        Fetches live weather for a specific station code from OpenWeatherMap.
        """
        stn = STATION_MASTER.get(station_code.upper())
        if not stn:
            return WeatherService._fallback_weather("Clear", 26.0, 8.0, 0.0)

        lat = stn.get("lat", 28.6415)
        lng = stn.get("lng", 77.2197)
        return await WeatherService.get_coordinates_weather(lat, lng, stn.get("name", station_code))

    @staticmethod
    async def get_coordinates_weather(lat: float, lng: float, location_name: str = "Section") -> Dict[str, Any]:
        """
        Queries OpenWeather API for specific GPS coordinates.
        """
        cache_key = f"{round(lat, 2)}_{round(lng, 2)}"
        now = time.time()

        if cache_key in _WEATHER_CACHE:
            cached_time, cached_data = _WEATHER_CACHE[cache_key]
            if now - cached_time < CACHE_TTL_SECONDS:
                return cached_data

        api_key = settings.OPENWEATHER_API_KEY
        if not api_key:
            return WeatherService._fallback_weather("Clear", 25.0, 8.0, 0.0, location_name)

        url = f"https://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lng}&appid={api_key}&units=metric"

        try:
            async with httpx.AsyncClient(timeout=4.0) as client:
                resp = await client.get(url)
                if resp.status_code == 200:
                    raw = resp.json()
                    weather_main = raw.get("weather", [{}])[0].get("main", "Clear")
                    weather_desc = raw.get("weather", [{}])[0].get("description", "clear sky")
                    temp = float(raw.get("main", {}).get("temp", 25.0))
                    humidity = float(raw.get("main", {}).get("humidity", 50.0))
                    
                    # Visibility in meters from OpenWeather (e.g. 10000 -> 10.0 km)
                    raw_vis = raw.get("visibility", 10000)
                    vis_km = round(float(raw_vis) / 1000.0, 1)

                    # Rain volume mm/1h
                    rain_mm = float(raw.get("rain", {}).get("1h", 0.0))
                    wind_kmph = round(float(raw.get("wind", {}).get("speed", 3.0)) * 3.6, 1)

                    # Determine railway operational caution advisory
                    caution, icon_type = WeatherService._compute_rail_caution(weather_main, vis_km, rain_mm)

                    result = {
                        "location": location_name,
                        "condition": weather_desc.title(),
                        "condition_category": weather_main,
                        "temperature_c": temp,
                        "humidity_percent": humidity,
                        "visibility_km": vis_km,
                        "rainfall_mm_hr": rain_mm,
                        "wind_speed_kmph": wind_kmph,
                        "caution_advisory": caution,
                        "icon_type": icon_type,
                        "data_source": "OPENWEATHER_LIVE",
                        "timestamp": now
                    }

                    _WEATHER_CACHE[cache_key] = (now, result)
                    return result
                else:
                    logger.warning(f"OpenWeather API returned status {resp.status_code}: {resp.text}")
        except Exception as e:
            logger.warning(f"OpenWeather API fetch error: {e}")

        # Fallback if API fails or network offline
        fallback = WeatherService._fallback_weather("Clear", 25.0, 8.0, 0.0, location_name)
        _WEATHER_CACHE[cache_key] = (now, fallback)
        return fallback

    @staticmethod
    async def get_section_weather(origin_code: str, dest_code: str) -> Dict[str, Any]:
        """
        Computes representative sectional weather between origin and destination stations.
        """
        stn1 = STATION_MASTER.get(origin_code.upper(), {"lat": 28.6415, "lng": 77.2197, "name": origin_code})
        stn2 = STATION_MASTER.get(dest_code.upper(), {"lat": 27.8974, "lng": 78.0777, "name": dest_code})

        mid_lat = (stn1["lat"] + stn2["lat"]) / 2.0
        mid_lng = (stn1["lng"] + stn2["lng"]) / 2.0
        sec_name = f"Between {stn1.get('name', origin_code)} & {stn2.get('name', dest_code)}"

        return await WeatherService.get_coordinates_weather(mid_lat, mid_lng, sec_name)

    @staticmethod
    def _compute_rail_caution(condition: str, vis_km: float, rain_mm: float) -> tuple[str, str]:
        """
        Determines Indian Railways Loco Pilot Operating Rules based on atmospheric conditions.
        """
        cond_lower = condition.lower()
        if "fog" in cond_lower or "mist" in cond_lower or "haze" in cond_lower or vis_km < 1.5:
            if vis_km < 0.8:
                return "Severe Fog Caution — Loco restricted to max 30 km/h (Detonator rules)", "fog"
            elif vis_km < 1.5:
                return "Fog Visibility Caution — Loco restricted to max 60 km/h", "fog"
            else:
                return "Moderate Mist — Headway cautionary signal observance", "fog"
        elif "rain" in cond_lower or "thunderstorm" in cond_lower or rain_mm > 0.0:
            if rain_mm > 15.0:
                return "Heavy Downpour — Track patrol alert & 2x braking distance", "rain"
            else:
                return "Wet Rail Caution — Extended deceleration profile applied", "rain"
        else:
            return "Clear Weather — Optimal corridor line speed authorized", "sun"

    @staticmethod
    def _fallback_weather(condition: str, temp: float, vis_km: float, rain_mm: float, location: str = "Corridor") -> Dict[str, Any]:
        caution, icon_type = WeatherService._compute_rail_caution(condition, vis_km, rain_mm)
        return {
            "location": location,
            "condition": condition,
            "condition_category": condition,
            "temperature_c": temp,
            "humidity_percent": 55.0,
            "visibility_km": vis_km,
            "rainfall_mm_hr": rain_mm,
            "wind_speed_kmph": 12.0,
            "caution_advisory": caution,
            "icon_type": icon_type,
            "data_source": "SIMULATED",
            "timestamp": time.time()
        }


def get_weather_service() -> WeatherService:
    return WeatherService()

