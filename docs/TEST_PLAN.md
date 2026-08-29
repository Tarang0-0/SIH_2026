# RailETA — Comprehensive Verification & Test Plan
**Document ID:** `docs/TEST_PLAN.md`  
**Problem Statement:** SIH 2026 — PS 26028  

---

## 1. Test Layers & Verification Gates

### 1.1 Backend Unit & Integration Tests (Pytest)
- **Health & Invariants:** Verify API health, zero-leakage invariant flags, and Pydantic validation.
- **Ingestion & Validation:** Test valid updates, duplicate rejection, out-of-order timestamps, invalid coordinates, and negative delay support.
- **ML Forecasting:** Test model artifact loading, feature vector schema, cascading section calculations, residual quantile bounds ($q_{10} \le q_{90}$), and SHAP attribution dictionaries.
- **Real-Time API & WebSockets:** Test active trains list, route topology, ETA endpoints, single-journey WebSocket streaming, global broadcast streams, and disruption injection.

### 1.2 Frontend & TypeScript Type Checks
- `npx tsc --noEmit`: 100% strict type safety across all React components, hooks, and schemas.
- `npm run build`: Zero-error production Next.js 15 App Router compilation.

### 1.3 Playwright Golden User Journey E2E Test
- **Flow:**
  1. Open Application at `http://localhost:3000`.
  2. Search for train `12004` ("Lucknow Swarna Shatabdi").
  3. Verify Dynamic ETA card renders predicted arrival, delay, and confidence window.
  4. Switch to Operations Mode and verify MapLibre vector map and SHAP chart render.
  5. Trigger Disruption Simulator (`+15 min Signal Caution`).
  6. Assert WebSocket updates the predicted ETA and station table live without full page reload.
