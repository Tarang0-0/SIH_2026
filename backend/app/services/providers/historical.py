"""
RailETA — Historical & Database Train Data Provider
Problem Statement 26028: Dynamic Forecast of ETA for Coaching Trains

Implements BaseTrainDataProvider backed by Supabase PostgreSQL (with automatic
in-memory fallback to official timetable catalog when offline).
"""

import logging
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional

from app.services.providers.base import BaseTrainDataProvider
from app.services.providers.catalog import TRAINS_CATALOG, CORRIDOR_TOPOLOGY, STATION_MASTER, DynamicTrainResolver
from app.schemas.event import CanonicalTrainEvent
from app.db.supabase import get_db

import threading

logger = logging.getLogger("raileta.provider.historical")

class HistoricalTrainDataProvider(BaseTrainDataProvider):
    """
    Primary provider for querying timetables, station master catalogs, and active journey states
    from Supabase PostgreSQL (with fallback to DynamicTrainResolver).
    """

    def __init__(self):
        self._lock = threading.Lock()
        with self._lock:
            self._local_trains = {t["journey_id"]: dict(t) for t in TRAINS_CATALOG}
            self._local_trains_by_num = {t["train_number"]: t["journey_id"] for t in TRAINS_CATALOG}

    def _sync_local_train(self, train_meta: Dict[str, Any]):
        j_id = train_meta["journey_id"]
        t_num = train_meta["train_number"]
        with self._lock:
            self._local_trains[j_id] = train_meta
            self._local_trains_by_num[t_num] = j_id

    async def get_active_trains(self) -> List[Dict[str, Any]]:
        db = get_db()
        if db:
            try:
                res = db.table("journeys").select(
                    "journey_id, current_delay_minutes, current_speed_kmph, current_station_code, next_station_code, status, data_source, trains(train_number, train_name, train_type, origin_station_code, destination_station_code)"
                ).execute()
                if res.data and len(res.data) > 0:
                    train_list = []
                    for row in res.data:
                        t_info = row.get("trains") or {}
                        train_list.append({
                            "journey_id": row["journey_id"],
                            "train_number": t_info.get("train_number", "Unknown"),
                            "train_name": t_info.get("train_name", "Unknown"),
                            "train_type": t_info.get("train_type", "Express"),
                            "origin": t_info.get("origin_station_code", "NDLS"),
                            "destination": t_info.get("destination_station_code", "NDLS"),
                            "current_station": row.get("current_station_code", "NDLS"),
                            "next_station": row.get("next_station_code", "NDLS"),
                            "speed_kmph": float(row.get("current_speed_kmph") or 0.0),
                            "delay_minutes": float(row.get("current_delay_minutes") or 0.0),
                            "status": row.get("status", "ACTIVE"),
                            "data_source": row.get("data_source", "REAL")
                        })
                    return train_list
            except Exception as e:
                logger.warning(f"Error fetching active trains from Supabase: {e}")

        # In-memory verified fallback
        with self._lock:
            return [dict(t) for t in self._local_trains.values()]

    async def get_route_topology(self, train_number: str) -> List[Dict[str, Any]]:
        db = get_db()
        if db:
            try:
                # Query route stations for train_number
                res = db.table("route_stations").select(
                    "sequence_number, distance_from_source_km, scheduled_arrival, scheduled_departure, scheduled_dwell_minutes, stations(station_code, station_name, latitude, longitude)"
                ).eq("routes.trains.train_number", train_number).order("sequence_number").execute()
                if res.data and len(res.data) > 0:
                    topology = []
                    for row in res.data:
                        stn_info = row.get("stations") or {}
                        topology.append({
                            "sequence": row["sequence_number"],
                            "station_code": stn_info.get("station_code"),
                            "station_name": stn_info.get("station_name"),
                            "distance_km": float(row["distance_from_source_km"]),
                            "scheduled_arrival": str(row["scheduled_arrival"]),
                            "scheduled_departure": str(row["scheduled_departure"]),
                            "dwell_minutes": int(row.get("scheduled_dwell_minutes", 2)),
                            "latitude": float(stn_info.get("latitude", 0.0)),
                            "longitude": float(stn_info.get("longitude", 0.0))
                        })
                    return topology
            except Exception as e:
                logger.warning(f"Error querying route topology from Supabase: {e}")

        # Dynamic resolver fallback
        raw_topo = DynamicTrainResolver.resolve_topology(train_number)
        topo = []
        for item in raw_topo:
            stn_meta = STATION_MASTER.get(item["station_code"], {})
            topo.append({
                **item,
                "latitude": item.get("latitude") or stn_meta.get("lat", 28.6415),
                "longitude": item.get("longitude") or stn_meta.get("lng", 77.2197)
            })
        return topo

    async def get_latest_running_state(self, journey_id: str) -> Optional[Dict[str, Any]]:
        # Check if train_number was passed instead of journey_id
        with self._lock:
            if journey_id in self._local_trains_by_num:
                journey_id = self._local_trains_by_num[journey_id]

        db = get_db()
        if db:
            try:
                res = db.table("journeys").select(
                    "*, trains(train_number, train_name, train_type, origin_station_code, destination_station_code)"
                ).eq("journey_id", journey_id).execute()
                if res.data:
                    row = res.data[0]
                    t_info = row.get("trains") or {}
                    return {
                        "journey_id": row["journey_id"],
                        "train_number": t_info.get("train_number", "12004"),
                        "train_name": t_info.get("train_name", "Train"),
                        "train_type": t_info.get("train_type", "Express"),
                        "current_station": row.get("current_station_code", "NDLS"),
                        "next_station": row.get("next_station_code", "GZB"),
                        "delay_minutes": float(row.get("current_delay_minutes", 0.0)),
                        "speed_kmph": float(row.get("current_speed_kmph", 0.0)),
                        "last_update_timestamp": row.get("updated_at"),
                        "status": row.get("status", "ACTIVE"),
                        "data_source": row.get("data_source", "REAL")
                    }
            except Exception as e:
                logger.warning(f"Error fetching journey state from DB: {e}")

        with self._lock:
            if journey_id in self._local_trains:
                t = dict(self._local_trains[journey_id])
                return {
                    "journey_id": t["journey_id"],
                    "train_number": t["train_number"],
                    "train_name": t["train_name"],
                    "train_type": t["train_type"],
                    "current_station": t["current_station"],
                    "next_station": t["next_station"],
                    "delay_minutes": float(t["delay_minutes"]),
                    "speed_kmph": float(t["speed_kmph"]),
                    "last_update_timestamp": datetime.now(timezone.utc).isoformat(),
                    "status": t["status"],
                    "data_source": t["data_source"]
                }

        # Resolve dynamically if valid train number
        clean_num = journey_id.replace("J_", "").replace("J", "")
        resolved = DynamicTrainResolver.resolve_train(clean_num)
        if resolved:
            self._sync_local_train(resolved)
            return {
                **resolved,
                "last_update_timestamp": datetime.now(timezone.utc).isoformat()
            }

        return None


    async def search_trains(self, query: str) -> List[Dict[str, Any]]:
        q = query.strip().lower()
        if not q:
            return await self.get_active_trains()

        all_trains = await self.get_active_trains()
        results = []
        seen_numbers = set()
        for t in all_trains:
            if (q in t["train_number"].lower() or 
                q in t["train_name"].lower() or 
                q in t["origin"].lower() or 
                q in t["destination"].lower() or 
                q in t["current_station"].lower()):
                results.append(t)
                seen_numbers.add(t["train_number"])

        # If user searched a number and it wasn't matched yet, synthesize on the fly
        if q.isdigit() and len(q) >= 4 and q not in seen_numbers:
            synthesized = DynamicTrainResolver.resolve_train(q)
            self._sync_local_train(synthesized)
            results.append(synthesized)

        return results


    async def update_running_state(self, event: CanonicalTrainEvent) -> bool:
        journey_id = event.journey_id
        with self._lock:
            if journey_id in self._local_trains_by_num:
                journey_id = self._local_trains_by_num[journey_id]

            if journey_id in self._local_trains:
                self._local_trains[journey_id]["current_station"] = event.current_station
                self._local_trains[journey_id]["next_station"] = event.next_station
                self._local_trains[journey_id]["delay_minutes"] = float(event.delay_minutes)
                self._local_trains[journey_id]["speed_kmph"] = float(event.speed_kmph)
                self._local_trains[journey_id]["status"] = event.status

        db = get_db()
        if db:
            try:
                db.table("journeys").update({
                    "current_station_code": event.current_station,
                    "next_station_code": event.next_station,
                    "current_delay_minutes": event.delay_minutes,
                    "current_speed_kmph": event.speed_kmph,
                    "status": event.status,
                    "updated_at": event.timestamp.isoformat()
                }).eq("journey_id", journey_id).execute()
                
                # Insert running update audit log
                db.table("running_updates").insert({
                    "journey_id": journey_id,
                    "timestamp": event.timestamp.isoformat(),
                    "latitude": event.latitude,
                    "longitude": event.longitude,
                    "speed_kmph": event.speed_kmph,
                    "delay_minutes": int(event.delay_minutes),
                    "current_station_code": event.current_station,
                    "next_station_code": event.next_station,
                    "data_source": event.source.value if hasattr(event.source, "value") else str(event.source)
                }).execute()
            except Exception as e:
                logger.warning(f"Error persisting running state update to DB: {e}")

        return True

    def get_data_source_mode(self) -> str:
        return "REAL"
