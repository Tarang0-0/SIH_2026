"""
RailETA — Overpass API Geo-POI & Railway Heritage Integration Service
Problem Statement 26028: Dynamic Forecast of ETA for Coaching Trains

Queries OpenStreetMap Overpass API (https://overpass-api.de/api/interpreter)
to dynamically identify geographic landmarks, waterways, mountain ghats,
railway bridges/tunnels, and cultural monuments along the active train corridor.
"""

import logging
import time
from typing import Dict, Any, List, Optional
import httpx

from app.services.providers.catalog import STATION_MASTER

logger = logging.getLogger("raileta.poi")

_POI_CACHE: Dict[str, tuple[float, List[Dict[str, Any]]]] = {}
CACHE_TTL_SECONDS = 3600  # 1 hour cache per coordinate bounding box

# Representative verified landmarks for Indian Railway flagship corridors (instant offline cache)
KNOWN_CORRIDOR_LANDMARKS: List[Dict[str, Any]] = [
    # Rivers & Waterways
    {"name": "Yamuna River", "type": "river", "category": "waterway", "lat": 28.6650, "lng": 77.2600, "description": "Major Himalayan river crossed on the historic Yamuna Railway Bridge"},
    {"name": "Ganga River (Holy Ganges)", "type": "river", "category": "waterway", "lat": 25.4300, "lng": 81.8600, "description": "Sacred river crossing near Prayagraj & Varanasi rail viaducts"},
    {"name": "Narmada River", "type": "river", "category": "waterway", "lat": 21.7000, "lng": 73.0000, "description": "Major west-flowing river crossed near Bharuch railway bridge"},
    {"name": "Tapi River", "type": "river", "category": "waterway", "lat": 21.2000, "lng": 72.8300, "description": "Crossed entering Surat City corridor"},
    {"name": "Gomti River", "type": "river", "category": "waterway", "lat": 26.8500, "lng": 80.9500, "description": "Flowing through Lucknow City and Gomti Nagar rail section"},
    {"name": "Chambal River", "type": "river", "category": "waterway", "lat": 26.6500, "lng": 78.8500, "description": "Deep ravine river crossed on Kota-Gwalior railway division"},
    {"name": "Betwa River", "type": "river", "category": "waterway", "lat": 25.4000, "lng": 78.5500, "description": "Crossed near Jhansi & Orchha heritage region"},
    {"name": "Hooghly River", "type": "river", "category": "waterway", "lat": 22.5850, "lng": 88.3450, "description": "Crossed near Howrah Terminal approach"},

    # Mountains, Ghats & Terrain
    {"name": "Thal Ghat (Kasara Ghat)", "type": "ghat", "category": "mountain", "lat": 19.6800, "lng": 73.4800, "description": "Famous 1 in 37 steep rail incline in Western Ghats requiring banker locomotives"},
    {"name": "Bhor Ghat (Khandala Incline)", "type": "ghat", "category": "mountain", "lat": 18.7500, "lng": 73.3500, "description": "Historic scenic mountain railway pass connecting Mumbai & Pune"},
    {"name": "Vindhya Mountain Range", "type": "mountain", "category": "mountain", "lat": 23.5000, "lng": 77.8000, "description": "Ancient mountain belt traversed on Bhopal-Itarsi line"},
    {"name": "Aravalli Range", "type": "mountain", "category": "mountain", "lat": 26.5000, "lng": 74.8000, "description": "Oldest fold mountains running parallel to Delhi-Jaipur-Ajmer railway corridor"},

    # Rail Bridges, Tunnels & Infrastructure
    {"name": "Old Yamuna Bridge (Loha Pul)", "type": "bridge", "category": "infrastructure", "lat": 28.6657, "lng": 77.2553, "description": "Double-decker steel truss railway bridge built in 1866"},
    {"name": "Curzon Bridge (Prayagraj)", "type": "bridge", "category": "infrastructure", "lat": 25.4500, "lng": 81.8600, "description": "Historic multi-span steel bridge across River Ganga"},
    {"name": "Golden Bridge (Narmada)", "type": "bridge", "category": "infrastructure", "lat": 21.7050, "lng": 72.9800, "description": "Heavy-duty rail crossing on Western Railway mainline"},
    {"name": "Parsik Rail Tunnel", "type": "tunnel", "category": "infrastructure", "lat": 19.1800, "lng": 73.0100, "description": "Historic 1.3 km tunnel on Central Railway suburban corridor"},

    # Monuments, UNESCO & Heritage
    {"name": "Taj Mahal & Agra Fort", "type": "monument", "category": "heritage", "lat": 27.1751, "lng": 78.0421, "description": "UNESCO World Heritage wonder visible along Agra Cantt approach"},
    {"name": "Gwalior Fort (Gibraltar of India)", "type": "monument", "category": "heritage", "lat": 26.2290, "lng": 78.1690, "description": "8th-century hill fortress overlooking Gwalior Junction"},
    {"name": "Kashi Vishwanath Corridor", "type": "monument", "category": "heritage", "lat": 25.3109, "lng": 83.0107, "description": "Spiritual landmark near Varanasi Junction"},
    {"name": "Bada Imambara & Rumi Darwaza", "type": "monument", "category": "heritage", "lat": 26.8689, "lng": 80.9129, "description": "Nawabi architectural wonder near Lucknow Charbagh"},
    {"name": "Sanchi Stupa (UNESCO)", "type": "monument", "category": "heritage", "lat": 23.4795, "lng": 77.7397, "description": "3rd-century BCE Buddhist monument right next to Sanchi rail station"},
    {"name": "Gateway of India & CSMT (UNESCO)", "type": "monument", "category": "heritage", "lat": 18.9400, "lng": 72.8350, "description": "Victorian Gothic architectural masterpiece serving as Central Railway headquarters"}
]


class POIService:
    @staticmethod
    async def get_nearby_pois(lat: float, lng: float, radius_km: float = 40.0) -> List[Dict[str, Any]]:
        """
        Fetches scenic rivers, mountain ghats, railway bridges, and tourist monuments
        around a given GPS location using Overpass API (with local fallback).
        """
        cache_key = f"{round(lat, 2)}_{round(lng, 2)}_{int(radius_km)}"
        now = time.time()

        if cache_key in _POI_CACHE:
            cached_time, cached_data = _POI_CACHE[cache_key]
            if now - cached_time < CACHE_TTL_SECONDS:
                return cached_data

        # 1. First, search verified corridor database within distance
        matched: List[Dict[str, Any]] = []
        for poi in KNOWN_CORRIDOR_LANDMARKS:
            # Approximate Euclidean distance in km (1 deg ~ 111 km)
            d_lat = (poi["lat"] - lat) * 111.0
            d_lng = (poi["lng"] - lng) * 102.0
            dist_km = (d_lat**2 + d_lng**2)**0.5

            if dist_km <= radius_km:
                matched.append({
                    **poi,
                    "distance_from_train_km": round(dist_km, 1)
                })

        # 2. Query Overpass API dynamically for additional real-time OSM POIs
        try:
            delta_deg = radius_km / 111.0
            bbox = f"{lat - delta_deg},{lng - delta_deg},{lat + delta_deg},{lng + delta_deg}"
            
            overpass_query = f"""
            [out:json][timeout:4];
            (
              node["tourism"="attraction"]({bbox});
              node["historic"="monument"]({bbox});
              node["waterway"="river"]({bbox});
              node["natural"="peak"]({bbox});
            );
            out 8;
            """
            
            url = "https://overpass-api.de/api/interpreter"
            async with httpx.AsyncClient(timeout=3.5) as client:
                resp = await client.post(url, data={"data": overpass_query})
                if resp.status_code == 200:
                    osm_data = resp.json()
                    elements = osm_data.get("elements", [])
                    seen_names = {p["name"].lower() for p in matched}

                    for el in elements:
                        tags = el.get("tags", {})
                        name = tags.get("name") or tags.get("name:en")
                        if not name or name.lower() in seen_names:
                            continue

                        p_lat = float(el.get("lat", lat))
                        p_lng = float(el.get("lon", lng))
                        d_lat = (p_lat - lat) * 111.0
                        d_lng = (p_lng - lng) * 102.0
                        dist_km = (d_lat**2 + d_lng**2)**0.5

                        category = "heritage"
                        p_type = "monument"
                        if "waterway" in tags:
                            category = "waterway"
                            p_type = "river"
                        elif "natural" in tags:
                            category = "mountain"
                            p_type = "peak"

                        matched.append({
                            "name": name,
                            "type": p_type,
                            "category": category,
                            "lat": p_lat,
                            "lng": p_lng,
                            "description": tags.get("description", f"Notable {category} point of interest along the rail corridor"),
                            "distance_from_train_km": round(dist_km, 1)
                        })
                        seen_names.add(name.lower())
        except Exception as e:
            logger.debug(f"Overpass API query fallback: {e}")

        # Sort by proximity to the train
        matched.sort(key=lambda x: x.get("distance_from_train_km", 999.0))
        results = matched[:12]

        _POI_CACHE[cache_key] = (now, results)
        return results

    @staticmethod
    async def get_corridor_pois(station_codes: List[str]) -> List[Dict[str, Any]]:
        """
        Gathers POIs across all stations in a route corridor.
        """
        all_pois: List[Dict[str, Any]] = []
        seen = set()

        for code in station_codes:
            stn = STATION_MASTER.get(code.upper())
            if not stn:
                continue
            pois = await POIService.get_nearby_pois(stn["lat"], stn["lng"], radius_km=35.0)
            for p in pois:
                if p["name"] not in seen:
                    seen.add(p["name"])
                    all_pois.append({
                        **p,
                        "near_station": code.upper()
                    })

        return all_pois[:20]
