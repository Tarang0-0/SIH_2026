"""
RailETA Prediction History Store
Problem Statement: SIH26028 (Dynamic Forecast of ETA for Coaching Trains)

Maintains chronological snapshots of dynamic ETA forecasts per active journey to demonstrate
continuous real-time adaptation as train position and operational events evolve.
"""

import uuid
import logging
from datetime import datetime, timezone
from typing import Dict, List, Optional
from collections import defaultdict

logger = logging.getLogger("raileta.history")

# In-memory thread-safe snapshot storage keyed by journey_id
_PREDICTION_HISTORY: Dict[str, List[Dict]] = defaultdict(list)
_MAX_HISTORY_PER_JOURNEY = 50


def record_prediction_snapshot(
    journey_id: str,
    train_number: str,
    current_station: str,
    reported_delay_min: float,
    reported_speed_kmh: float,
    destination_station: str,
    destination_baseline_eta: str,
    destination_predicted_eta: str,
    predicted_delay_at_destination_min: float,
    primary_driving_factor: str,
    timestamp: Optional[datetime] = None,
) -> Dict:
    """
    Appends a new prediction snapshot to the journey's timeline history.
    """
    ts = timestamp or datetime.now(timezone.utc)
    snapshot = {
        "snapshot_id": f"SNAP-{uuid.uuid4().hex[:8].upper()}",
        "timestamp": ts,
        "train_station": current_station,
        "reported_delay_min": round(float(reported_delay_min), 1),
        "reported_speed_kmh": round(float(reported_speed_kmh), 1),
        "destination_station": destination_station,
        "destination_baseline_eta": destination_baseline_eta,
        "destination_predicted_eta": destination_predicted_eta,
        "predicted_delay_at_destination_min": round(float(predicted_delay_at_destination_min), 1),
        "primary_driving_factor": primary_driving_factor,
    }

    history_list = _PREDICTION_HISTORY[journey_id]
    history_list.append(snapshot)

    # Trim to maximum history capacity
    if len(history_list) > _MAX_HISTORY_PER_JOURNEY:
        _PREDICTION_HISTORY[journey_id] = history_list[-_MAX_HISTORY_PER_JOURNEY:]

    return snapshot


def get_journey_prediction_history(journey_id: str) -> List[Dict]:
    """
    Retrieves the chronological list of prediction snapshots for a journey.
    """
    return list(_PREDICTION_HISTORY.get(journey_id, []))


def clear_history_for_journey(journey_id: str) -> None:
    """Clears history for a completed or reset journey."""
    if journey_id in _PREDICTION_HISTORY:
        del _PREDICTION_HISTORY[journey_id]
