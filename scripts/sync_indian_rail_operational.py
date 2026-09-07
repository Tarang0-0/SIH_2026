"""Fetch daily cancellation/rescheduling signals into the feedback store."""

from __future__ import annotations

import argparse
import asyncio
import datetime as dt
import os
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))


def load_local_env() -> None:
    env_path = ROOT_DIR / ".env"
    if not env_path.exists():
        return
    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip("\"'"))

from api.services.feedback_store import record_operational_events
from api.services.official_status import (
    OfficialScheduleInvalid,
    LiveStatusUnavailable,
    fetch_cancelled_trains,
    fetch_rescheduled_trains,
)


async def sync(journey_date: dt.date) -> int:
    cancelled = await fetch_cancelled_trains(journey_date)
    rescheduled = await fetch_rescheduled_trains(journey_date)
    count = record_operational_events(cancelled + rescheduled)
    print(f"Fetched {len(cancelled):,} cancelled and {len(rescheduled):,} rescheduled trains")
    print(f"Persisted {count:,} operational events for {journey_date.isoformat()}")
    return count


def main() -> None:
    load_local_env()
    parser = argparse.ArgumentParser()
    parser.add_argument("--date", default=dt.date.today().isoformat(), help="Journey date in YYYY-MM-DD")
    args = parser.parse_args()
    try:
        journey_date = dt.date.fromisoformat(args.date)
    except ValueError as error:
        raise SystemExit("--date must use YYYY-MM-DD") from error
    try:
        asyncio.run(sync(journey_date))
    except (LiveStatusUnavailable, OfficialScheduleInvalid) as error:
        raise SystemExit(f"IndianRailAPI sync unavailable: {error}") from error


if __name__ == "__main__":
    main()
