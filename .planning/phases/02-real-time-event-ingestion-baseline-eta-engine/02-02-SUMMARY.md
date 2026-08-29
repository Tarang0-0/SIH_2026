---
phase: 02-real-time-event-ingestion-baseline-eta-engine
plan: 02-02
status: completed
completed_at: 2026-08-27T17:48:00Z
---

# Summary 02-02: Baseline ETA Calculation Engine & Verification Suite

## Accomplishments
- Implemented Schedule-Based Baseline ETA Calculation Engine ($\text{Baseline ETA}_s = \text{Scheduled Arrival}_s + \text{Current Delay}$) in `backend/app/services/baseline.py`.
- Created prediction REST API endpoints in `backend/app/api/v1/endpoints/eta.py` (`GET /api/v1/trains/{id}/eta`).
- Built comprehensive Pytest test suite in `backend/tests/test_ingestion_and_baseline.py` covering all 13 mandated test cases (valid ingestion, malformed payload, duplicate event, out-of-order event, stale event, impossible speed, invalid lat/lon, negative delay, invalid station, baseline formula calculation, terminal station, multiple upcoming stations, replay fixture parsing).

## Verification Results
- Pytest test suite: `17 passed in 0.40s` (0 warnings).
- End-to-end integration verified: Posting running update with $+5 \text{ min}$ delay recalculated downstream baseline ETAs for all upcoming stations instantly (ALJN 07:54, CNB 11:25, LKO 12:45).
