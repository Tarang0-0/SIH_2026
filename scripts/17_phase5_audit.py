"""Produce a read-only Phase 5 health, drift, freshness, and error report."""

from __future__ import annotations

import datetime as dt
import json
import sqlite3
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from api.services.feedback_store import connect_feedback_store
from api.services.phase5_controls import error_by_segment, phase5_status, population_stability_index


def main() -> None:
    connection = connect_feedback_store()
    try:
        observations = [dict(row) for row in connection.execute(
            "SELECT observed_at, provider, current_delay_minutes FROM live_observations ORDER BY observed_at"
        )]
        recent_cutoff = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(hours=24)).isoformat()
        recent = [dict(row) for row in connection.execute(
            "SELECT observed_at, provider, current_delay_minutes FROM live_observations WHERE observed_at >= ? ORDER BY observed_at",
            (recent_cutoff,),
        )]
        comparisons = [dict(row) for row in connection.execute(
            """
            SELECT f.current_station, f.station_code, f.error_minutes, f.provider,
                   f.actual_observation_at
            FROM forecasts f
            WHERE f.resolved_at IS NOT NULL
            """
        )]
        weather_count = int(connection.execute("SELECT COUNT(*) FROM weather_observations").fetchone()[0])
        station_board_count = int(connection.execute("SELECT COUNT(*) FROM station_board_observations").fetchone()[0])
        provider_freshness = [dict(row) for row in connection.execute(
            "SELECT provider, MAX(observed_at) AS latest_observed_at, COUNT(*) AS observations FROM live_observations GROUP BY provider"
        )]
    finally:
        connection.close()
    reference = [row["current_delay_minutes"] for row in observations[:-len(recent)] or observations]
    current = [row["current_delay_minutes"] for row in recent]
    report = {
        "generated_at_utc": dt.datetime.now(dt.timezone.utc).isoformat(),
        "phase5": phase5_status(),
        "observations": len(observations),
        "recent_24h_observations": len(recent),
        "provider_freshness": provider_freshness,
        "delay_drift_psi": population_stability_index(reference, current),
        "resolved_forecasts": len(comparisons),
        "error_by_segment": error_by_segment(comparisons),
        "weather_observations": weather_count,
        "station_board_observations": station_board_count,
        "data_gaps": {
            "block_occupancy": "provider_not_configured",
            "maintenance_blocks": "provider_not_configured",
        },
    }
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
