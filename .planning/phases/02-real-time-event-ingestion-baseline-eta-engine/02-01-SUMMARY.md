---
phase: 02-real-time-event-ingestion-baseline-eta-engine
plan: 02-01
status: completed
completed_at: 2026-08-27T17:48:00Z
---

# Summary 02-01: Event Ingestion Pipeline & Deterministic Replay Feed

## Accomplishments
- Implemented FastAPI event ingestion endpoint `POST /api/v1/running-updates` in `backend/app/api/v1/endpoints/ingestion.py`.
- Created event validation & state management service in `backend/app/services/ingestion.py` supporting range bounds checks ($0.0 \le speed \le 220.0 \text{ km/h}$, coordinates bounds, station code validation) and timestamp invariant processing (out-of-order logs event but skips journey state mutation).
- Built deterministic 9-event sequence fixture in `scripts/fixtures/j1001_replay_events.json` for Shatabdi train 12004.
- Created standalone CLI replay simulator tool in `scripts/replay_simulator.py` with configurable speed multipliers (`--speed-multiplier`), controls, and explicit `"source": "SIMULATED"` provenance tagging.

## User-Facing Changes
- Ingestion endpoint `POST /api/v1/running-updates` accepts canonical train events and updates journey state in real time.
- Replay simulator tool enables hands-free reproducible event streaming for SIH evaluation.

## Verification
- Verified against live FastAPI engine: 9 sequential updates posted, state updated, and baseline ETAs calculated.
