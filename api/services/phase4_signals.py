"""Derived Phase 4 signals from provider-backed live station boards."""

from __future__ import annotations

import re
from typing import Any


def _delay_minutes(value: Any) -> float | None:
    text = str(value or "").strip().upper()
    if not text or text in {"-", "RT", "ON TIME", "ONTIME"}:
        return 0.0 if text in {"RT", "ON TIME", "ONTIME"} else None
    match = re.search(r"(-?\d+)", text)
    return float(match.group(1)) if match else None


def _clock_minutes(value: Any) -> int | None:
    match = re.search(r"(?:^|\s)(\d{1,2}):(\d{2})", str(value or ""))
    if not match:
        return None
    hour, minute = int(match.group(1)), int(match.group(2))
    return hour * 60 + minute if 0 <= hour < 24 and 0 <= minute < 60 else None


def derive_station_signals(
    trains: list[dict[str, Any]],
    hours: int,
    network_signals: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Return observed board signals plus optional provider network signals."""
    delays = [
        value for train in trains
        for value in [_delay_minutes(train.get("delay_in_arrival") or train.get("delay_in_departure"))]
        if value is not None
    ]
    times = sorted(
        value for train in trains
        for value in [_clock_minutes(train.get("expected_arrival") or train.get("schedule_arrival"))]
        if value is not None
    )
    gaps = [right - left for left, right in zip(times, times[1:]) if right > left]
    # This is a monitoring index, not a learned delay prediction. Its formula
    # is intentionally returned with its source label and can be replaced by
    # a provider-supplied occupancy signal later.
    congestion = min(1.0, len(trains) / max(1.0, float(hours) * 10.0))
    network_rows = network_signals.get("signals", []) if isinstance(network_signals, dict) else []
    occupied_blocks = sum(1 for row in network_rows if row.get("occupancy") == "occupied")
    maintenance_blocks = sum(1 for row in network_rows if row.get("maintenance_active"))
    restrictions = [row.get("speed_restriction_kmh") for row in network_rows if row.get("speed_restriction_kmh") is not None]
    preceding_delays = [row.get("preceding_train_delay_minutes") for row in network_rows if row.get("preceding_train_delay_minutes") is not None]
    return {
        "train_count": len(trains),
        "board_window_hours": hours,
        "mean_delay_minutes": round(sum(delays) / len(delays), 3) if delays else None,
        "max_delay_minutes": max(delays) if delays else None,
        "headway_min_minutes": min(gaps) if gaps else None,
        "station_congestion_index": round(congestion, 3),
        "source": "live_station_provider_derived",
        "occupancy_data_available": bool(network_rows),
        "block_occupancy_available": bool(network_rows),
        "maintenance_block_available": bool(network_rows),
        "network_signal_provider": network_signals.get("provider") if isinstance(network_signals, dict) else None,
        "network_signal_observed_at": network_signals.get("observed_at") if isinstance(network_signals, dict) else None,
        "occupied_block_count": occupied_blocks,
        "maintenance_block_count": maintenance_blocks,
        "speed_restriction_count": len(restrictions),
        "minimum_speed_restriction_kmh": min(restrictions) if restrictions else None,
        "preceding_train_delay_max_minutes": max(preceding_delays) if preceding_delays else None,
    }
