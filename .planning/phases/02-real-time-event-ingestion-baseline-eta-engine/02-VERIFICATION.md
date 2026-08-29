---
status: passed
phase: 02-real-time-event-ingestion-baseline-eta-engine
verified_at: 2026-08-27T17:48:00Z
---

# Phase 2 Verification Report: Real-Time Event Ingestion & Baseline ETA Engine

## Executive Summary
All verification criteria for Phase 2 are fully satisfied. The FastAPI event ingestion API (`POST /api/v1/running-updates`), canonical event validator, out-of-order event handler, Schedule-Based Baseline ETA Calculation Engine ($\text{Baseline ETA}_s = \text{Scheduled Arrival}_s + \text{Current Observed Delay}$), prediction REST API (`GET /api/v1/trains/{id}/eta`), and deterministic replay simulator CLI (`scripts/replay_simulator.py`) have been created and verified.

## Verified Deliverables

| Deliverable | Requirement | Verification Method | Status |
|-------------|-------------|---------------------|--------|
| Event Ingestion API | INGEST-01 | FastAPI route `POST /api/v1/running-updates` | PASS |
| Out-of-Order & Duplicate Invariant | INGEST-01 | Pytest test 03 & 04 (Timestamp invariant check) | PASS |
| Boundary Validation | INGEST-01 | Pytest test 06 & 07 (Speed > 220 km/h returns 400) | PASS |
| Deterministic Replay Simulator | INGEST-02 | CLI script `scripts/replay_simulator.py` + `j1001_replay_events.json` | PASS |
| Baseline ETA Engine | BASE-01 | Service `calculate_baseline_eta` ($\text{Scheduled} + \text{Delay}$) | PASS |
| ETA Prediction API | BASE-01 | FastAPI route `GET /api/v1/trains/{id}/eta` | PASS |
| Test Suite | INGEST-01, INGEST-02, BASE-01 | Pytest `tests/test_ingestion_and_baseline.py` (17/17 passed) | PASS |

## Automated Test Results
- **Backend Pytest**: `17 passed in 0.40s` (0 warnings).
- **Live Replay Verification**: Replay simulator streamed 9 events to FastAPI server, updating journey state and producing live baseline station ETAs.

## Conclusion
Phase 2 verification passed with zero blockers and zero open issues.
