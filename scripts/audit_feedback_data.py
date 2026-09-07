"""Read-only audit of the live feedback store used by continuous learning."""

from __future__ import annotations

import json
import sqlite3
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.append(str(ROOT_DIR))
from api.services.feedback_store import _db_path, connect_feedback_store


def main() -> None:
    path = _db_path()
    if not path.exists():
        print(json.dumps({"database": str(path), "status": "empty"}, indent=2))
        return
    connection = connect_feedback_store()
    connection.row_factory = sqlite3.Row
    try:
        def scalar(query: str) -> int:
            return int(connection.execute(query).fetchone()[0])

        report = {
            "database": str(path),
            "observations": scalar("SELECT COUNT(*) FROM live_observations"),
            "terminal_observations": scalar("SELECT COUNT(*) FROM live_observations WHERE is_terminal = 1"),
            "forecasts": scalar("SELECT COUNT(*) FROM forecasts"),
            "resolved_forecasts": scalar("SELECT COUNT(*) FROM forecasts WHERE resolved_at IS NOT NULL"),
            "unresolved_forecasts": scalar("SELECT COUNT(*) FROM forecasts WHERE resolved_at IS NULL"),
            "station_events": scalar("SELECT COUNT(*) FROM station_events"),
            "actual_station_events": scalar(
                "SELECT COUNT(*) FROM station_events WHERE event_quality = 'provider_actual_event'"
            ),
            "operational_events": scalar("SELECT COUNT(*) FROM operational_events"),
            "providers": [dict(row) for row in connection.execute(
                "SELECT provider, COUNT(*) AS count FROM live_observations GROUP BY provider ORDER BY count DESC"
            )],
            "observation_quality": [dict(row) for row in connection.execute(
                "SELECT observation_quality, COUNT(*) AS count FROM live_observations GROUP BY observation_quality"
            )],
            "model_versions": [dict(row) for row in connection.execute(
                "SELECT model_version, COUNT(*) AS count FROM forecasts GROUP BY model_version"
            )],
            "invalid_delays": scalar(
                "SELECT COUNT(*) FROM live_observations WHERE current_delay_minutes < 0 OR current_delay_minutes > 720"
            ),
            "missing_stations": scalar(
                "SELECT COUNT(*) FROM live_observations WHERE current_station IS NULL OR current_station = ''"
            ),
        }
        print(json.dumps(report, indent=2))
    finally:
        connection.close()


if __name__ == "__main__":
    main()
