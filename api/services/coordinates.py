"""Station-coordinate catalogue loader.

Coordinates are separate data, not fallback geometry. Missing values remain
missing so the API never draws an invented route through interpolated points.
"""

import json
import math
import os
from typing import Dict, Optional, Tuple

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
COORDINATES_PATH = os.path.join(ROOT_DIR, "data", "station_coordinates.json")
_catalog: Optional[Dict[str, Tuple[float, float]]] = None


def _load_catalog() -> Dict[str, Tuple[float, float]]:
    global _catalog
    if _catalog is not None:
        return _catalog
    try:
        with open(COORDINATES_PATH, "r", encoding="utf-8") as file:
            raw = json.load(file)
    except (OSError, json.JSONDecodeError):
        _catalog = {}
        return _catalog
    catalog = {}
    if isinstance(raw, dict):
        for code, value in raw.items():
            try:
                latitude, longitude = float(value[0]), float(value[1])
                if math.isfinite(latitude) and math.isfinite(longitude) and -90 <= latitude <= 90 and -180 <= longitude <= 180:
                    catalog[str(code).strip().upper()] = (latitude, longitude)
            except (IndexError, TypeError, ValueError):
                continue
    _catalog = catalog
    return _catalog


def station_coordinates(station_code: str) -> Optional[Tuple[float, float]]:
    return _load_catalog().get(str(station_code).strip().upper())
