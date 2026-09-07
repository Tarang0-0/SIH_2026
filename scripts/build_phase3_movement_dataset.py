"""Export Phase 3 movement snapshots with verified future labels."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from api.services.feedback_store import export_phase3_movement_dataset


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=Path("data/phase3_movement_training.csv"))
    args = parser.parse_args()
    count = export_phase3_movement_dataset(args.output)
    print(f"Exported {count:,} Phase 3 movement rows to {args.output}")
    if count == 0:
        print("No rows exported: collect snapshots followed by provider-confirmed next-station arrivals.")


if __name__ == "__main__":
    main()
