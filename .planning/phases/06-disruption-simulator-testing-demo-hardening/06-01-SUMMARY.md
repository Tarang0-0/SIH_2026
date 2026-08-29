---
phase: 06-disruption-simulator-testing-demo-hardening
plan: 01
title: Interactive What-If Disruption Simulator UI & Backend API
status: complete
completed_at: 2026-08-27T16:55:00Z
coverage:
  - id: D-06-01
    description: "What-If Operational Disruption API with Live Broadcast (SIM-01)"
    result: pass
    verification: "backend/tests/test_realtime_api.py::test_11_simulate_disruption_custom_endpoint"
  - id: D-06-02
    description: "Interactive Disruption Simulation Modal Component (SIM-01)"
    result: pass
    verification: "frontend/src/components/DisruptionSimulatorModal.tsx"
---

# Plan 06-01 Summary: Interactive What-If Disruption Simulator UI & Backend API

## Accomplishments
1. **Disruption Simulation REST Endpoint (`backend/app/api/v1/endpoints/simulator.py`)**:
   - `POST /api/v1/simulate/disruption`: Ingests operational disruption events, adjusts train delay deltas, recalculates cascading GBDT section predictions with uncertainty bounds, and triggers real-time WebSocket broadcast.
2. **Interactive What-If Disruption Modal (`frontend/src/components/DisruptionSimulatorModal.tsx`)**:
   - Built preset scenario selectors (Signal Failure, Winter Fog, Track Work, Loco Fault).
   - Added interactive delay slider (-10m to +90m) and inception station dropdown.
   - Connected "Simulate Disruption" button directly to the backend with live prediction hydration.

## Files Created / Modified
- `backend/app/api/v1/endpoints/simulator.py` [NEW]
- `frontend/src/components/DisruptionSimulatorModal.tsx` [NEW]
- `frontend/src/components/HeaderNav.tsx` [MODIFIED]
- `frontend/src/app/page.tsx` [MODIFIED]
- `backend/app/main.py` [MODIFIED]
