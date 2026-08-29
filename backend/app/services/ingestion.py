import uuid
import logging
from datetime import datetime, timezone
from fastapi import HTTPException
from app.schemas.event import CanonicalTrainEvent
from app.services.features import parse_iso_datetime
from app.db.supabase import get_db
from app.services.concurrent_store import journey_store
from app.services.providers.catalog import STATION_MASTER, DynamicTrainResolver

logger = logging.getLogger("raileta.ingestion")

# Station topology validation dictionary populated from Master Catalog
VALID_STATIONS = {k: v.get("name", k) for k, v in STATION_MASTER.items()}

class _DictProxy(dict):
    """Proxy dict that writes field changes back to ConcurrentJourneyStore."""
    def __init__(self, store, key, data):
        super().__init__(data)
        self._store = store
        self._key = key

    def __setitem__(self, k, v):
        super().__setitem__(k, v)
        self._store.update(self._key, {k: v})


class _MockJourneyStoreCompat:
    """Dict-like wrapper around ConcurrentJourneyStore for backward compatibility."""
    def __contains__(self, key):
        return journey_store.contains(key)
    def __getitem__(self, key):
        val = journey_store.get(key)
        if val is None:
            raise KeyError(key)
        return _DictProxy(journey_store, key, val)
    def __setitem__(self, key, value):
        journey_store.put(key, value)
    def get(self, key, default=None):
        val = journey_store.get(key)
        if val is None:
            return default
        return _DictProxy(journey_store, key, val)

MOCK_JOURNEY_STORE = _MockJourneyStoreCompat()


def _seed_initial_journeys():
    """Seed the store with initial demo journeys if empty (for offline/demo mode only)."""
    if journey_store.size() == 0:
        journey_store.put("J1001", {
            "journey_id": "J1001",
            "train_number": "12004",
            "train_name": "Lucknow Swarna Shatabdi Express",
            "current_station": "NDLS",
            "next_station": "GZB",
            "current_delay_minutes": 0,
            "current_speed_kmph": 0.0,
            "last_update_timestamp": datetime.now(timezone.utc),
            "data_source": "REAL"
        })
        journey_store.put("J1002", {
            "journey_id": "J1002",
            "train_number": "12951",
            "train_name": "Mumbai Rajdhani Express",
            "current_station": "BCT",
            "next_station": "ST",
            "current_delay_minutes": 15,
            "current_speed_kmph": 92.0,
            "last_update_timestamp": datetime.now(timezone.utc),
            "data_source": "REAL"
        })

# Seed on import for demo/test compatibility
_seed_initial_journeys()


def validate_event_bounds(event: CanonicalTrainEvent):
    """Validate business domain constraints on running updates."""
    if event.speed_kmph < 0.0 or event.speed_kmph > 220.0:
        raise HTTPException(
            status_code=400,
            detail=f"Speed {event.speed_kmph} km/h is out of valid range [0.0, 220.0 km/h]"
        )
    if event.latitude < -90.0 or event.latitude > 90.0:
        raise HTTPException(
            status_code=400,
            detail=f"Latitude {event.latitude} out of valid bounds [-90.0, 90.0]"
        )
    if event.longitude < -180.0 or event.longitude > 180.0:
        raise HTTPException(
            status_code=400,
            detail=f"Longitude {event.longitude} out of valid bounds [-180.0, 180.0]"
        )
    if event.current_station not in VALID_STATIONS:
        raise HTTPException(
            status_code=404,
            detail=f"Current station code '{event.current_station}' not found in topology"
        )
    if event.next_station not in VALID_STATIONS:
        raise HTTPException(
            status_code=404,
            detail=f"Next station code '{event.next_station}' not found in topology"
        )

def process_running_update(event: CanonicalTrainEvent, db=None) -> dict:
    """
    Validates, logs, and processes canonical running update event.
    Enforces timestamp invariant (out-of-order events do not mutate journey state).
    """
    validate_event_bounds(event)

    db_client = db or get_db()
    update_id = str(uuid.uuid4())
    journey_state_updated = False
    is_out_of_order = False
    is_stale = False

    event_ts = parse_iso_datetime(event.timestamp)

    now_utc = datetime.now(timezone.utc)
    freshness_seconds = (now_utc - event_ts).total_seconds()
    if freshness_seconds > 1800:
        is_stale = True

    if db_client:
        try:
            db_client.table("running_updates").insert({
                "id": update_id,
                "journey_id": event.journey_id,
                "timestamp": event_ts.isoformat(),
                "latitude": event.latitude,
                "longitude": event.longitude,
                "speed_kmph": event.speed_kmph,
                "delay_minutes": event.delay_minutes,
                "current_station_code": event.current_station,
                "next_station_code": event.next_station,
                "data_source": event.source
            }).execute()

            j_res = db_client.table("journeys").select("*").eq("journey_id", event.journey_id).execute()
            if j_res.data:
                journey_rec: dict = j_res.data[0]
                last_ts_raw = journey_rec.get("updated_at")
                last_ts = parse_iso_datetime(last_ts_raw) if last_ts_raw else None

                if last_ts and event_ts < last_ts:
                    is_out_of_order = True
                    logger.info(f"Out-of-order event for {event.journey_id}: event ts {event_ts} < last ts {last_ts}")
                else:
                    db_client.table("journeys").update({
                        "current_delay_minutes": event.delay_minutes,
                        "current_speed_kmph": event.speed_kmph,
                        "data_source": event.source,
                        "updated_at": event_ts.isoformat()
                    }).eq("journey_id", event.journey_id).execute()
                    journey_state_updated = True
            else:
                raise HTTPException(status_code=404, detail=f"Journey '{event.journey_id}' not found")

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"DB Error processing event: {e}")
            journey_state_updated, is_out_of_order = _process_store_update(event, event_ts)
    else:
        journey_state_updated, is_out_of_order = _process_store_update(event, event_ts)

    return {
        "status": "success",
        "journey_id": event.journey_id,
        "running_update_id": update_id,
        "event_timestamp": event_ts.isoformat(),
        "journey_state_updated": journey_state_updated,
        "is_out_of_order": is_out_of_order,
        "is_stale": is_stale,
        "data_source": event.source
    }

def _process_store_update(event: CanonicalTrainEvent, event_ts: datetime):
    """Thread-safe journey store update for offline/demo execution."""
    existing = journey_store.get(event.journey_id)

    if existing is None:
        clean_num = event.journey_id.replace("J_", "").replace("J", "")
        train_meta = DynamicTrainResolver.resolve_train(clean_num)
        journey_store.put(event.journey_id, {
            "journey_id": event.journey_id,
            "train_number": train_meta["train_number"] if train_meta else clean_num,
            "train_name": train_meta["train_name"] if train_meta else f"Train {clean_num}",
            "current_station": event.current_station,
            "next_station": event.next_station,
            "current_delay_minutes": event.delay_minutes,
            "current_speed_kmph": event.speed_kmph,
            "last_update_timestamp": event_ts,
            "data_source": event.source
        })
        return True, False

    last_ts_raw = existing.get("last_update_timestamp")
    last_ts = parse_iso_datetime(last_ts_raw) if last_ts_raw else None

    if last_ts and event_ts < last_ts:
        return False, True

    journey_store.update(event.journey_id, {
        "current_station": event.current_station,
        "next_station": event.next_station,
        "current_delay_minutes": event.delay_minutes,
        "current_speed_kmph": event.speed_kmph,
        "last_update_timestamp": event_ts,
        "data_source": event.source
    })

    return True, False
