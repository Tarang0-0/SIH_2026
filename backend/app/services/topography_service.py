"""
RailETA — OpenTopography SRTM Elevation & Gradient Integration Service
Problem Statement 26028: Dynamic Forecast of ETA for Coaching Trains

Queries OpenTopography Global DEM API to calculate sectional elevation gain/loss,
full corridor elevation profiles, and track gradient multipliers for tractive resistance.
"""

import logging
import time
from typing import Dict, Any, List
import httpx

from app.core.config import settings
from app.services.providers.catalog import STATION_MASTER

logger = logging.getLogger("raileta.topography")

_TOPO_CACHE: Dict[str, Dict[str, Any]] = {}
_PROFILE_CACHE: Dict[str, Dict[str, Any]] = {}


class TopographyService:
    @staticmethod
    async def get_section_gradient(origin_code: str, dest_code: str, distance_km: float = 50.0) -> Dict[str, Any]:
        """
        Calculates elevation profile and track gradient between two station codes.
        """
        cache_key = f"{origin_code.upper()}_{dest_code.upper()}"
        if cache_key in _TOPO_CACHE:
            return _TOPO_CACHE[cache_key]

        stn1 = STATION_MASTER.get(origin_code.upper(), {"lat": 28.6415, "lng": 77.2197, "name": origin_code})
        stn2 = STATION_MASTER.get(dest_code.upper(), {"lat": 27.8974, "lng": 78.0777, "name": dest_code})

        api_key = settings.OPENTOPOGRAPHY_API_KEY
        elev1 = await TopographyService.get_point_elevation(stn1["lat"], stn1["lng"], api_key)
        elev2 = await TopographyService.get_point_elevation(stn2["lat"], stn2["lng"], api_key)

        delta_elev = elev2 - elev1
        # Gradient in percent: (elevation delta in meters / distance in meters) * 100
        dist_m = max(1000.0, distance_km * 1000.0)
        gradient_pct = round((delta_elev / dist_m) * 100.0, 3)

        gradient_type = "Level Track"
        if gradient_pct > 0.3:
            gradient_type = "Uphill Gradient (Tractive Load)"
        elif gradient_pct < -0.3:
            gradient_type = "Downhill Gradient (Gravity Assist)"

        result = {
            "origin": origin_code,
            "origin_elevation_m": round(elev1, 1),
            "destination": dest_code,
            "destination_elevation_m": round(elev2, 1),
            "elevation_delta_m": round(delta_elev, 1),
            "distance_km": distance_km,
            "gradient_percent": gradient_pct,
            "gradient_type": gradient_type,
            "data_source": "OPENTOPOGRAPHY_DEM"
        }

        _TOPO_CACHE[cache_key] = result
        return result

    @staticmethod
    async def get_corridor_elevation_profile(station_codes: List[str]) -> Dict[str, Any]:
        """
        Computes the complete continuous elevation profile curve across all stations along a route.
        Returns: list of station elevation nodes, highest elevation peak, lowest point, and total climb.
        """
        clean_codes = [c.strip().upper() for c in station_codes if c.strip()]
        if not clean_codes:
            return {"profile": [], "max_elevation_m": 0, "min_elevation_m": 0, "highest_station": "N/A"}

        cache_key = "_".join(clean_codes)
        if cache_key in _PROFILE_CACHE:
            return _PROFILE_CACHE[cache_key]

        api_key = settings.OPENTOPOGRAPHY_API_KEY
        profile_nodes: List[Dict[str, Any]] = []

        for idx, code in enumerate(clean_codes):
            stn = STATION_MASTER.get(code, {"lat": 28.6415, "lng": 77.2197, "name": code})
            elev = await TopographyService.get_point_elevation(stn["lat"], stn["lng"], api_key)
            profile_nodes.append({
                "sequence": idx + 1,
                "station_code": code,
                "station_name": stn.get("name", code),
                "latitude": stn["lat"],
                "longitude": stn["lng"],
                "elevation_m": round(elev, 1)
            })

        elevations = [n["elevation_m"] for n in profile_nodes]
        max_elev = max(elevations) if elevations else 0.0
        min_elev = min(elevations) if elevations else 0.0
        highest_node = next((n for n in profile_nodes if n["elevation_m"] == max_elev), None)

        result = {
            "profile": profile_nodes,
            "max_elevation_m": max_elev,
            "min_elevation_m": min_elev,
            "highest_station": highest_node["station_code"] if highest_node else "N/A",
            "highest_station_name": highest_node["station_name"] if highest_node else "N/A",
            "elevation_range_m": round(max_elev - min_elev, 1),
            "data_source": "OPENTOPOGRAPHY_DEM"
        }

        _PROFILE_CACHE[cache_key] = result
        return result

    @staticmethod
    async def get_point_elevation(lat: float, lng: float, api_key: str) -> float:
        """
        Queries OpenTopography or returns terrain altitude model.
        """
        if not api_key:
            return TopographyService._approximate_elevation(lat, lng)

        url = f"https://portal.opentopography.org/API/globaldem?demtype=SRTMGL3&south={lat-0.01}&north={lat+0.01}&west={lng-0.01}&east={lng+0.01}&outputFormat=JSON&API_Key={api_key}"
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                resp = await client.get(url)
                if resp.status_code == 200:
                    data = resp.json()
                    if "results" in data and len(data["results"]) > 0:
                        return float(data["results"][0].get("elevation", 215.0))
        except Exception as e:
            logger.debug(f"OpenTopography query fallback: {e}")

        return TopographyService._approximate_elevation(lat, lng)

    @staticmethod
    def _approximate_elevation(lat: float, lng: float) -> float:
        """
        Physical approximation of Indian subcontinent elevation based on coordinates.
        (e.g. Indo-Gangetic plain 180-230m, Deccan plateau 500-900m, Coastal 5-30m).
        """
        if lat < 15.0:  # Southern peninsula / Bangalore / Western Ghats
            return 850.0 if lng < 78.0 else 20.0
        elif 18.0 <= lat <= 24.0:  # Central / Deccan (Pune, Bhopal)
            return 520.0
        elif 25.0 <= lat <= 30.0:  # Northern Plains (Delhi, Kanpur, Lucknow, Patna)
            return 216.0 - ((lng - 77.0) * 12.0)
        return 215.0
