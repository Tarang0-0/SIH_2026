"""Repair invalid same-station forecast resolutions in the feedback store.

Older API versions created a forecast for the already-observed current station
and resolved it on the next poll while the train was still there. Those rows
are not valid arrival labels. The default mode is a read-only report; pass
``--apply`` after taking a database backup to clear only those resolutions.
"""

from __future__ import annotations

import argparse
import json
import sys

from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from api.services.feedback_store import _db_path, connect_feedback_store


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="Clear invalid same-station resolutions")
    args = parser.parse_args()
    connection = connect_feedback_store()
    try:
        count = int(connection.execute(
            """
            SELECT COUNT(*) FROM forecasts
            WHERE resolved_at IS NOT NULL AND current_station = station_code
            """
        ).fetchone()[0])
        changed = 0
        if args.apply and count:
            cursor = connection.execute(
                """
                UPDATE forecasts
                SET resolved_at = NULL, actual_delay_minutes = NULL,
                    actual_observation_at = NULL, error_minutes = NULL
                WHERE resolved_at IS NOT NULL AND current_station = station_code
                """
            )
            connection.commit()
            changed = cursor.rowcount
        print(json.dumps({
            "database": str(_db_path()),
            "invalid_same_station_resolutions": count,
            "repaired": changed,
            "mode": "apply" if args.apply else "report",
        }, indent=2))
    finally:
        connection.close()


if __name__ == "__main__":
    main()
