"""
RailETA — Live Weather, OpenTopography & Overpass Geo-POI Endpoints
Problem Statement 26028: Dynamic Forecast of ETA for Coaching Trains
"""

from typing import Optional, List
from fastapi import APIRouter, Query, HTTPException

from app.services.weather_service import WeatherService
from app.services.topography_service import TopographyService
from app.services.poi_service import POIService

router = APIRouter()


@router.get("/weather/station/{code}")
async def get_station_weather(code: str):
    """
    Fetches real-time atmospheric observation (OpenWeather) for a specific railway station.
    """
    return await WeatherService.get_station_weather(code)


@router.get("/weather/section")
async def get_section_weather(
    origin: str = Query(..., description="Origin station code (e.g. GZB)"),
    destination: str = Query(..., description="Destination station code (e.g. ALJN)")
):
    """
    Returns live OpenWeather observation, visibility (km), rainfall, and Loco Pilot caution advisory
    for the track section between origin and destination stations.
    """
    return await WeatherService.get_section_weather(origin, destination)


@router.get("/topography/section")
async def get_section_topography(
    origin: str = Query(..., description="Origin station code"),
    destination: str = Query(..., description="Destination station code"),
    distance_km: float = Query(50.0, description="Sectional distance in km")
):
    """
    Queries OpenTopography DEM to calculate track elevation delta (m) and gradient (%)
    between station pairs.
    """
    return await TopographyService.get_section_gradient(origin, destination, distance_km)


@router.get("/topography/corridor-profile")
async def get_corridor_elevation_profile(
    stations: str = Query(..., description="Comma-separated station codes along route (e.g. NDLS,GZB,ALJN,CNB,LKO)")
):
    """
    Returns full continuous elevation profile curve and peak elevation along the corridor using OpenTopography SRTM DEM.
    """
    codes = [c.strip() for c in stations.split(",") if c.strip()]
    return await TopographyService.get_corridor_elevation_profile(codes)


@router.get("/poi/nearby")
async def get_nearby_pois(
    lat: float = Query(..., description="Latitude of train or station"),
    lng: float = Query(..., description="Longitude of train or station"),
    radius_km: float = Query(40.0, description="Search radius in kilometers")
):
    """
    Queries Overpass API / OSM for scenic rivers, mountain ghats, railway bridges, and tourist monuments
    around the train's live location.
    """
    return await POIService.get_nearby_pois(lat, lng, radius_km)


@router.get("/poi/corridor")
async def get_corridor_pois(
    stations: str = Query(..., description="Comma-separated station codes along route")
):
    """
    Gathers key POIs, heritage monuments, and river crossings across the entire route corridor.
    """
    codes = [c.strip() for c in stations.split(",") if c.strip()]
    return await POIService.get_corridor_pois(codes)
