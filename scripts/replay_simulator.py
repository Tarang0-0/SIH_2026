#!/usr/bin/env python3
"""
RailETA Deterministic Replay Simulator CLI
Simulates a real-time NTES / train running update stream for SIH demonstration and evaluation.
"""

import os
import sys
import json
import time
import argparse
import urllib.request
import urllib.error
from datetime import datetime

def load_events(fixture_path: str):
    if not os.path.exists(fixture_path):
        raise FileNotFoundError(f"Fixture file not found at: {fixture_path}")
    with open(fixture_path, "r", encoding="utf-8") as f:
        return json.load(f)

def run_replay(api_url: str, journey_id: str, speed_multiplier: float, fixture_path: str, loop: bool):
    events = load_events(fixture_path)
    filtered_events = [e for e in events if e.get("journey_id") == journey_id]
    
    if not filtered_events:
        filtered_events = events # Fallback to all if journey_id matches fixture

    print("=" * 70)
    print(f"  RailETA Replay Simulator Engine")
    print(f"  Target API Endpoint: {api_url}")
    print(f"  Journey ID: {journey_id}")
    print(f"  Speed Multiplier: {speed_multiplier}x")
    print(f"  Total Sequence Events: {len(filtered_events)}")
    print("=" * 70)

    iteration = 1
    while True:
        print(f"\n--- Starting Replay Sequence Pass #{iteration} ---")
        prev_ts = None
        
        for idx, event in enumerate(filtered_events, 1):
            ts_str = event["timestamp"].replace("Z", "+00:00")
            curr_ts = datetime.fromisoformat(ts_str)
            
            if prev_ts is not None:
                # Calculate interval in seconds
                delta_sec = (curr_ts - prev_ts).total_seconds()
                sleep_duration = max(0.1, delta_sec / speed_multiplier)
                time.sleep(sleep_duration)
            
            # Post event payload
            payload_data = json.dumps(event).encode("utf-8")
            req = urllib.request.Request(
                api_url,
                data=payload_data,
                headers={"Content-Type": "application/json"}
            )
            
            try:
                with urllib.request.urlopen(req) as resp:
                    resp_body = json.loads(resp.read().decode("utf-8"))
                    print(
                        f"[{idx}/{len(filtered_events)}] Event Sent: {event['current_station']} → {event['next_station']} | "
                        f"Delay: +{event['delay_minutes']} min | Speed: {event['speed_kmph']} km/h | "
                        f"HTTP {resp.status} (Baseline ETAs: {resp_body.get('baseline_etas_calculated', 0)})"
                    )
            except urllib.error.HTTPError as err:
                print(f"[{idx}/{len(filtered_events)}] ERROR HTTP {err.code}: {err.read().decode('utf-8')}")
            except Exception as e:
                print(f"[{idx}/{len(filtered_events)}] ERROR: {e}")
                
            prev_ts = curr_ts

        if not loop:
            print("\nReplay pass complete.")
            break
            
        iteration += 1
        time.sleep(2.0)

def main():
    parser = argparse.ArgumentParser(description="RailETA Deterministic Replay Simulator CLI")
    parser.add_argument("--journey-id", type=str, default="J1001", help="Journey ID to replay (e.g. J1001)")
    parser.add_argument("--speed-multiplier", type=float, default=2.0, help="Replay speed multiplier (e.g. 1.0, 2.0, 5.0)")
    parser.add_argument("--api-url", type=str, default="http://localhost:8000/api/v1/running-updates", help="FastAPI endpoint URL")
    parser.add_argument("--fixture", type=str, default="scripts/fixtures/j1001_replay_events.json", help="Path to events fixture JSON")
    parser.add_argument("--loop", action="store_true", help="Loop replay sequence continuously")

    args = parser.parse_args()
    
    # Resolve relative fixture path relative to project root
    fixture_path = args.fixture
    if not os.path.isabs(fixture_path):
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        fixture_path = os.path.join(base_dir, args.fixture)

    run_replay(
        api_url=args.api_url,
        journey_id=args.journey_id,
        speed_multiplier=args.speed_multiplier,
        fixture_path=fixture_path,
        loop=args.loop
    )

if __name__ == "__main__":
    main()
