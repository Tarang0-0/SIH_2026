"""Re-normalize previously stored provider event timestamps."""

from pathlib import Path
import sys

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from api.services.feedback_store import repair_station_event_timestamps


if __name__ == "__main__":
    print(f"Repaired {repair_station_event_timestamps():,} stored station events")
