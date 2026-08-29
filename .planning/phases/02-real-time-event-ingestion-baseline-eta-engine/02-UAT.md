---
status: complete
phase: 02-real-time-event-ingestion-baseline-eta-engine
source:
  - backend/app/services/ingestion.py
  - backend/app/services/baseline.py
  - backend/app/api/v1/endpoints/ingestion.py
  - backend/app/api/v1/endpoints/eta.py
  - scripts/replay_simulator.py
  - backend/tests/test_ingestion_and_baseline.py
started: 2026-08-27T17:48:00Z
updated: 2026-08-27T17:48:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Ingestion Endpoint POST /api/v1/running-updates
expected: Valid CanonicalTrainEvent payload returns HTTP 200 OK and updates journey state in real time.
result: pass

### 2. Domain Validation & Boundary Enforcement
expected: Out-of-bounds speed (>220 km/h) returns HTTP 400. Malformed payload returns HTTP 422. Unknown station code returns HTTP 404.
result: pass

### 3. Out-of-Order & Duplicate Event Resilience
expected: Out-of-order event (older timestamp) is logged in running_updates but journey state is not mutated. Duplicate event returns HTTP 200 without duplicate state error.
result: pass

### 4. Schedule-Based Baseline ETA Engine
expected: GET /api/v1/trains/{id}/eta calculates baseline ETA = Scheduled Arrival + Current Delay for all upcoming stations without ML extrapolation.
result: pass

### 5. Deterministic Replay Simulator CLI
expected: scripts/replay_simulator.py streams event sequence to FastAPI endpoint with configurable speed multiplier and explicit SIMULATED source tagging.
result: pass

## Summary

total: 5
passed: 5
issues: 0
pending: 0
skipped: 0

## Gaps

[none]
