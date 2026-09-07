"""IndianRailAPI live-station endpoint."""

import datetime as dt
import logging
import os
import re

from fastapi import APIRouter, HTTPException, Query

from api.schemas import LiveStationResponse, LiveStationTrain
from api.services.official_status import LiveStationInvalid, LiveStatusInvalid, LiveStatusUnavailable, fetch_live_station
from api.services.feedback_store import record_station_board
from api.services.phase4_signals import derive_station_signals
from api.services.network_signals import NetworkSignalsInvalid, NetworkSignalsUnavailable, fetch_network_signals

router = APIRouter(prefix="/api/v1/stations", tags=["Live Station Trains"])
logger = logging.getLogger(__name__)


@router.get("/{station_code}/live", response_model=LiveStationResponse)
async def get_live_station(
    station_code: str,
    hours: int = Query(2, description="Live-provider window; RailRadar supports 2, 4, 6, or 8 hours"),
):
    code = str(station_code).strip().upper()
    if not re.fullmatch(r"[A-Z0-9]{2,8}", code):
        raise HTTPException(status_code=422, detail="station_code must contain 2 to 8 letters or digits")
    allowed_hours = (2, 4, 6, 8) if os.getenv("RAILRADAR_API_KEY", "").strip() else (2, 4)
    if hours not in allowed_hours:
        raise HTTPException(status_code=422, detail=f"hours must be one of {allowed_hours}")
    try:
        trains = await fetch_live_station(code, hours)
    except LiveStatusUnavailable as error:
        raise HTTPException(status_code=503, detail="Live station data is unavailable: configure an authorised live-station provider") from error
    except (LiveStationInvalid, LiveStatusInvalid) as error:
        raise HTTPException(status_code=502, detail="Live-station provider returned unusable data") from error
    network_signals = None
    try:
        network_signals = await fetch_network_signals([code])
    except (NetworkSignalsInvalid, NetworkSignalsUnavailable):
        # Station boards remain useful when the optional network provider is
        # not configured; the response records that those fields are absent.
        logger.info("Network signals unavailable for station %s", code)
    signals = derive_station_signals(trains, hours, network_signals)
    provider = "RAILRADAR" if os.getenv("RAILRADAR_API_KEY", "").strip() else "INDIAN_RAIL_API"
    try:
        record_station_board(code, hours, trains, signals, provider=provider)
    except Exception:
        logger.exception("Unable to persist live station board for %s", code)
    return LiveStationResponse(
        station_code=code,
        hours=hours,
        observed_at=dt.datetime.now(dt.timezone.utc).isoformat(),
        provider=provider,
        trains=[LiveStationTrain(**train) for train in trains], signals=signals,
    )
