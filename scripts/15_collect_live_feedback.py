"""Poll RailRadar and accumulate real live observations for Phase 2.

This collector records only provider responses. It does not create labels from
predictions. Keep the interval within the provider's quota and stop the process
when the requested duration has elapsed.
"""

from __future__ import annotations

import argparse
import asyncio
import datetime as dt
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from api.main import _load_local_env

_load_local_env()

from api.routers import eta as eta_module
from api.routers.eta import get_train_eta, resolve_journey_date
from api.services.feedback_store import record_live_cycle
from api.services.official_status import (
    LiveStatusInvalid,
    LiveStatusUnavailable,
    fetch_live_status,
    runtime_route_from_status,
)


async def collect(train_numbers: list[str], interval: int, duration: int, journey_date: dt.date | None) -> None:
    end_at = asyncio.get_running_loop().time() + duration
    cycle = 0
    while True:
        cycle += 1
        recorded = 0
        for train_number in train_numbers:
            try:
                active_journey_date = resolve_journey_date(train_number, journey_date)
                status = await fetch_live_status(train_number, active_journey_date)
                route = runtime_route_from_status(status)
                if route is not None:
                    eta_module.set_train_route(train_number, route)
                eta = get_train_eta(
                    train_number=train_number,
                    date=active_journey_date.isoformat(),
                    current_station=status.current_station,
                    current_delay=status.current_delay_minutes,
                    speed_kmh=status.speed_kmh,
                    current_latitude=status.latitude,
                    current_longitude=status.longitude,
                    observed_at=status.observed_at,
                )
                result = record_live_cycle(
                    train_number, active_journey_date, status, eta,
                    model_version=eta_module.MODEL_VERSION,
                )
                recorded += 1
                print(
                    f"cycle={cycle} train={train_number} station={status.current_station} "
                    f"delay={status.current_delay_minutes} events={result.get('station_events_recorded', 0)}"
                )
            except Exception as error:
                print(f"cycle={cycle} train={train_number} unavailable={error}", file=sys.stderr)
        if asyncio.get_running_loop().time() >= end_at:
            print(f"Finished after {cycle} cycle(s); recorded {recorded} response(s) in the last cycle")
            return
        await asyncio.sleep(interval)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--trains", required=True, help="Comma-separated train numbers")
    parser.add_argument("--interval", type=int, default=300, help="Seconds between polls; minimum 30")
    parser.add_argument("--duration", type=int, default=3600, help="Total collection duration in seconds")
    parser.add_argument("--date", help="Journey date YYYY-MM-DD; defaults to today")
    args = parser.parse_args()
    trains = [value.strip() for value in args.trains.split(",") if value.strip().isdigit()]
    if not trains:
        raise SystemExit("--trains must contain at least one numeric train number")
    interval = max(30, args.interval)
    duration = max(interval, args.duration)
    try:
        journey_date = dt.date.fromisoformat(args.date) if args.date else None
    except ValueError as error:
        raise SystemExit("--date must use YYYY-MM-DD") from error
    asyncio.run(collect(trains, interval, duration, journey_date))


if __name__ == "__main__":
    main()
