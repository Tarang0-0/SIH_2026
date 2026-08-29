"""
RailETA — Test Suite for Real External APIs
Problem Statement 26028: Dynamic Forecast of ETA for Coaching Trains

Tests:
1. OpenWeather API integration and /weather/section endpoint
2. OpenTopography SRTM DEM elevation and /topography/section endpoint
3. RailRadar live provider initialization and fallback
4. MapTiler API Key presence and configuration
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.config import settings
from app.services.weather_service import WeatherService
from app.services.topography_service import TopographyService
from app.services.providers.railradar import RailRadarTrainDataProvider

client = TestClient(app)


def test_api_keys_configured():
    assert isinstance(settings.RAILRADAR_API_KEY, str)
    assert isinstance(settings.MAPTILER_API_KEY, str)
    assert isinstance(settings.OPENWEATHER_API_KEY, str)
    assert isinstance(settings.OPENTOPOGRAPHY_API_KEY, str)


@pytest.mark.asyncio
async def test_weather_service_station():
    res = await WeatherService.get_station_weather("NDLS")
    assert "condition" in res
    assert "temperature_c" in res
    assert "visibility_km" in res
    assert "caution_advisory" in res


def test_weather_section_endpoint():
    res = client.get("/api/v1/weather/section?origin=GZB&destination=ALJN")
    assert res.status_code == 200
    data = res.json()
    assert "condition" in data
    assert "visibility_km" in data
    assert "caution_advisory" in data


@pytest.mark.asyncio
async def test_topography_service_gradient():
    res = await TopographyService.get_section_gradient("GZB", "ALJN", distance_km=106.3)
    assert "origin" in res
    assert "gradient_percent" in res
    assert "gradient_type" in res


def test_topography_section_endpoint():
    res = client.get("/api/v1/topography/section?origin=NDLS&destination=GZB&distance_km=24.5")
    assert res.status_code == 200
    data = res.json()
    assert "gradient_percent" in data
    assert "gradient_type" in data


@pytest.mark.asyncio
async def test_railradar_provider():
    provider = RailRadarTrainDataProvider()
    trains = await provider.get_active_trains()
    assert len(trains) > 0

    topo = await provider.get_route_topology("12004")
    assert len(topo) >= 5

    state = await provider.get_latest_running_state("12004")
    assert state is not None
    assert state["train_number"] == "12004"


@pytest.mark.asyncio
async def test_poi_service_and_endpoints():
    from app.services.poi_service import POIService
    pois = await POIService.get_nearby_pois(28.6415, 77.2197, radius_km=50.0)
    assert len(pois) > 0
    assert "name" in pois[0]
    assert "category" in pois[0]

    # Test endpoint
    res = client.get("/api/v1/poi/nearby?lat=28.6415&lng=77.2197&radius_km=50.0")
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    assert len(data) > 0

    # Test corridor endpoint
    res2 = client.get("/api/v1/poi/corridor?stations=NDLS,GZB,ALJN,CNB,LKO")
    assert res2.status_code == 200
    assert len(res2.json()) > 0


def test_corridor_elevation_profile_endpoint():
    res = client.get("/api/v1/topography/corridor-profile?stations=NDLS,GZB,ALJN,CNB,LKO")
    assert res.status_code == 200
    data = res.json()
    assert "profile" in data
    assert len(data["profile"]) == 5
    assert "max_elevation_m" in data
    assert "highest_station" in data

