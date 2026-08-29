# RailETA — UI Test Plan & Verification Matrix

**Document ID:** `docs/UI_TEST_PLAN.md`  
**Problem Statement:** Smart India Hackathon 2026 — PS 26028  
**Scope:** Frontend Usability, Accessibility, Navigation, Playwright E2E, and WebSocket Streaming  
**Date:** 2026-08-28  

---

## 1. Test Scenarios & Journeys

### Journey 1: Primary Passenger Flow (5–10 Second Comprehension)
1. **Open App:** Navigate to `http://localhost:3000`. Verify Overview page renders hero search and network snapshot.
2. **Search Train:** Type `12004` into search bar. Verify autocomplete dropdown renders within 200ms showing `Lucknow Swarna Shatabdi Express`.
3. **Select Train:** Click result or press Enter. Verify navigation to Train Detail view.
4. **Verify 7-Tier Display:**
   - Level 1: Expected Arrival Time is visible and prominently rendered in large font.
   - Level 2: Delay Status badge is clearly formatted (`On Time` or `+8m Late`).
   - Level 3: Next station card shows name, scheduled arrival, and distance.
   - Level 4: Destination ETA card shows final expected arrival.
   - Level 5: Freshness timestamp (`Updated just now`).
   - Level 6: Likely Prediction Window (`[06:36 - 06:41]`).
   - Level 7: "Why did the ETA change?" accordion expands and displays human-readable operational factors.

### Journey 2: Dynamic Live Replay & WebSocket Broadcast Flow
1. **Connect to WebSocket:** Open train detail for `12004` (`J1001`). Verify connection indicator shows `LIVE WS`.
2. **Inject Disruption:** Click `+10m Signal Caution` in Disruption Simulator.
3. **Assert Live Recalculation:**
   - Feedback toast appears (`Disruption injected · Recalculated downstream ETAs`).
   - Expected Arrival time updates dynamically.
   - Station ETA table updates downstream values without full page reload.

### Journey 3: Navigation & Deep Linking Flow
1. **Switch Views:** Click `Find Train`, `Live Map`, and `Operations` tabs in HeaderNav. Verify each view renders seamlessly.
2. **Direct URL Deep Link:** Open `http://localhost:3000?train=12951`. Verify Mumbai Rajdhani loads directly with all topology and ETA forecasts.
3. **Switch Modes:** Click `Operations Mode`. Verify Fleet Sidebar, MapLibre vector map, cascading GBDT table, and SHAP TreeExplainer render.

### Journey 4: Empty & Error State Handling
1. **Search with No Matches:** Search for `99999`. Verify polite empty state ("No trains matched '99999'").
2. **Offline Fallback:** Disconnect backend. Verify user-friendly banner ("Showing latest available forecast · [Retry]") without raw stack traces.

---

## 2. Automated Test Execution Commands

- **Backend Test Suite (37 Tests):**
  ```bash
  cd backend && ./venv/bin/pytest
  ```
- **Next.js Production Build:**
  ```bash
  cd frontend && npm run build
  ```
- **SIH End-to-End Demo Script:**
  ```bash
  python scripts/sih_demo_runner.py
  ```
