"""
RailETA — Thread-Safe Concurrent Journey Store
Problem Statement 26028: Dynamic Forecast of ETA for Coaching Trains

Replaces the unsafe global MOCK_JOURNEY_STORE dict with a thread-safe,
per-session-isolated store that supports multi-user concurrent access
without data corruption or cross-user state leakage.
"""

import time
import threading
import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List

logger = logging.getLogger("raileta.concurrent_store")

# Stale entry eviction threshold (30 minutes)
_STALE_TTL_SECONDS = 1800


class ConcurrentJourneyStore:
    """
    Thread-safe in-memory journey state store with RLock protection.

    All reads and writes are protected by a reentrant lock to prevent
    data corruption under concurrent Gunicorn/Uvicorn worker access.

    Supports:
    - Multi-user safe get/put/update
    - Automatic stale entry eviction
    - Per-journey state isolation
    """

    def __init__(self):
        self._store: Dict[str, Dict[str, Any]] = {}
        self._lock = threading.RLock()
        self._last_cleanup = time.time()

    def get(self, journey_id: str) -> Optional[Dict[str, Any]]:
        """Thread-safe retrieval of journey state."""
        with self._lock:
            entry = self._store.get(journey_id)
            if entry is None:
                return None
            # Return a copy to prevent external mutation of internal state
            return dict(entry)

    def put(self, journey_id: str, state: Dict[str, Any]) -> None:
        """Thread-safe insertion or full replacement of journey state."""
        with self._lock:
            self._store[journey_id] = dict(state)
            self._store[journey_id]["_store_updated_at"] = time.time()
        self._maybe_cleanup()

    def update(self, journey_id: str, updates: Dict[str, Any]) -> bool:
        """Thread-safe partial update of journey state fields. Returns True if journey existed."""
        with self._lock:
            if journey_id not in self._store:
                return False
            self._store[journey_id].update(updates)
            self._store[journey_id]["_store_updated_at"] = time.time()
            return True

    def get_or_create(self, journey_id: str, factory_fn) -> Dict[str, Any]:
        """
        Thread-safe get-or-create pattern.
        If journey_id doesn't exist, calls factory_fn() to create the initial state.
        factory_fn should return a Dict[str, Any].
        """
        with self._lock:
            existing = self._store.get(journey_id)
            if existing is not None:
                return dict(existing)

        # Call factory outside the lock to avoid holding lock during I/O
        new_state = factory_fn()
        if new_state is None:
            return {}

        with self._lock:
            # Double-check after re-acquiring lock
            if journey_id in self._store:
                return dict(self._store[journey_id])
            self._store[journey_id] = dict(new_state)
            self._store[journey_id]["_store_updated_at"] = time.time()
            return dict(self._store[journey_id])

    def contains(self, journey_id: str) -> bool:
        """Thread-safe existence check."""
        with self._lock:
            return journey_id in self._store

    def keys(self) -> List[str]:
        """Thread-safe snapshot of all journey IDs."""
        with self._lock:
            return list(self._store.keys())

    def all_entries(self) -> List[Dict[str, Any]]:
        """Thread-safe snapshot of all journey states."""
        with self._lock:
            return [dict(v) for v in self._store.values()]

    def size(self) -> int:
        """Thread-safe count of active journeys."""
        with self._lock:
            return len(self._store)

    def remove(self, journey_id: str) -> bool:
        """Thread-safe removal of a journey entry."""
        with self._lock:
            if journey_id in self._store:
                del self._store[journey_id]
                return True
            return False

    def _maybe_cleanup(self) -> None:
        """Periodically evict stale entries (older than 30 min without update)."""
        now = time.time()
        if now - self._last_cleanup < 300:  # Run at most every 5 minutes
            return

        with self._lock:
            self._last_cleanup = now
            stale_ids = []
            for jid, entry in self._store.items():
                updated_at = entry.get("_store_updated_at", 0)
                if now - updated_at > _STALE_TTL_SECONDS:
                    stale_ids.append(jid)

            for jid in stale_ids:
                del self._store[jid]

            if stale_ids:
                logger.info(f"Evicted {len(stale_ids)} stale journey entries from ConcurrentJourneyStore.")


# Global singleton — replaces the old unprotected MOCK_JOURNEY_STORE dict
journey_store = ConcurrentJourneyStore()
