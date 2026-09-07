"""Export Phase 2 station-level labels from verified live observations.

Only provider-reported actual arrival events are exported. A live status that
contains only the current station or an expected time is retained in SQLite for
observability but cannot become a supervised label.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from api.services.feedback_store import export_station_level_dataset


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("data/station_level_training.csv"),
        help="CSV path for provider-actual next-station labels",
    )
    args = parser.parse_args()
    count = export_station_level_dataset(args.output)
    print(f"Exported {count:,} station-level labels to {args.output}")
    if count == 0:
        print("No labels were exported: collect live-status responses containing actual station arrivals first.")


if __name__ == "__main__":
    main()
