"""Station amenities endpoint.

IndianRailAPI does not expose amenity occupancy or pricing. Returning a
fabricated catalogue is worse than reporting that the capability is not
configured, so this endpoint fails explicitly until a real amenity provider is
connected.
"""

import re

from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/api/v1/stations", tags=["Station Amenities & Smart Waiting"])


@router.get("/{station_code}/amenities")
def get_station_amenities(station_code: str):
    code = str(station_code).strip().upper()
    if not re.fullmatch(r"[A-Z0-9]{2,8}", code):
        raise HTTPException(status_code=422, detail="station_code must contain 2 to 8 letters or digits")
    raise HTTPException(
        status_code=503,
        detail="Station amenities are unavailable: no verified amenity provider is configured",
    )
