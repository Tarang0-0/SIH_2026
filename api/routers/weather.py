"""OpenWeather endpoints for explicit, provider-backed weather snapshots."""

from fastapi import APIRouter, HTTPException, Query

from api.services.coordinates import station_coordinates
from api.services.weather import WeatherInvalid, WeatherUnavailable, fetch_current_weather

router = APIRouter(prefix="/api/v1", tags=["Weather"])


def _weather_response(snapshot):
    return snapshot.public_dict()


@router.get("/weather")
async def get_weather(
    latitude: float = Query(..., ge=-90, le=90),
    longitude: float = Query(..., ge=-180, le=180),
):
    try:
        snapshot = await fetch_current_weather(latitude, longitude)
    except WeatherUnavailable as error:
        raise HTTPException(status_code=503, detail="Weather is unavailable: configure a valid OpenWeather API key") from error
    except WeatherInvalid as error:
        raise HTTPException(status_code=502, detail="OpenWeather returned unusable data") from error
    return _weather_response(snapshot)


@router.get("/stations/{station_code}/weather")
async def get_station_weather(station_code: str):
    code = str(station_code).strip().upper()
    coordinates = station_coordinates(code)
    if coordinates is None:
        raise HTTPException(status_code=404, detail=f"No coordinates found for station {code}")
    try:
        snapshot = await fetch_current_weather(*coordinates, coordinate_source="station_coordinates")
    except WeatherUnavailable as error:
        raise HTTPException(status_code=503, detail="Weather is unavailable: configure a valid OpenWeather API key") from error
    except WeatherInvalid as error:
        raise HTTPException(status_code=502, detail="OpenWeather returned unusable data") from error
    response = _weather_response(snapshot)
    response["station_code"] = code
    return response
