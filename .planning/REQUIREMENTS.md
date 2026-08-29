# Requirements: RailETA — Dynamic ETA Forecast for Coaching Trains

**Defined:** 2026-08-27
**Core Value:** Accurately forecast future section-level running behavior and arrival times dynamically as operational events occur, delivering measurable improvements over static schedule + delay baselines without using fabricated data or LLM hallucinations.

## v1 Requirements

### Data Foundation & System of Record

- [ ] **DATA-01**: Seed Supabase PostgreSQL with trains, stations, routes, and schedule topologies for coaching trains.
- [ ] **DATA-02**: Store historical section-level running metrics and dwell observations in Supabase.

### Event Ingestion & State Pipeline

- [ ] **INGEST-01**: FastAPI engine ingests train running updates (lat/long, current station, speed, current delay).
- [ ] **INGEST-02**: Deterministic event replay adapter streams running updates for demonstration and evaluation.

### Baseline ETA Benchmarking

- [ ] **BASE-01**: Calculate schedule baseline ETA (`Scheduled Arrival + Current Delay`) per upcoming station.

### Sectional ML Forecasting Engine

- [ ] **ML-01**: Extract section-level tabular features (sectional distance, historical speed, elapsed delay, time of day) with zero future data leakage.
- [ ] **ML-02**: Train GBDT model (XGBoost / LightGBM) to forecast section running times and upcoming station ETAs.
- [ ] **ML-03**: Evaluate model against schedule baseline (MAE, RMSE, ±5m/10m/15m accuracy windows).
- [ ] **ML-04**: Calculate prediction uncertainty / confidence bounds per station ETA prediction.
- [ ] **ML-05**: Compute feature-level contribution breakdown (SHAP) for explainable predictions.

### Backend API & Real-Time Update Stream

- [ ] **API-01**: FastAPI REST endpoints for train search, journey state, and route station sequence.
- [ ] **API-02**: FastAPI WebSocket / Realtime stream publishing dynamic ETA updates on incoming events.

### Frontend Dashboard & Map Visualization

- [ ] **UI-01**: Next.js dashboard with fleet overview, train search, and station auto-complete.
- [ ] **UI-02**: MapLibre GL JS route visualization rendering station nodes and animated train markers.
- [ ] **UI-03**: Train details screen presenting station-by-station ETA cards, confidence bounds, and explainability breakdown.

### Disruption Simulation & Replay

- [ ] **SIM-01**: Interactive what-if simulator enabling custom event injection (e.g., 10-minute halt) and dynamic downstream ETA updates.

### Testing & Verification

- [ ] **TEST-01**: Automated Pytest suite verifying feature extraction, data leakage prevention, and API contracts.
- [ ] **TEST-02**: Playwright browser E2E test suite verifying train search, live event update, and simulation flows.

## v2 Requirements

### Environmental & Network Enhancements

- **ENV-01**: Ingest real-time weather observations (rainfall, visibility) for weather-adjusted section predictions.
- **NET-01**: Delay propagation modeling across shared track segments and station choke points.

## Out of Scope

| Feature | Reason |
|---------|--------|
| LLM / RAG Numerical Forecasting | Risk of numerical hallucination; ML tabular time-series models are deterministic and explainable |
| P0 Voice UI Commands | Optional P1/P2 add-on; must not block core forecasting delivery |
| Live Signal Interlocking Network | Unvalidated live API access; synthetic deterministic replay used for hackathon demo |
| Freight Train Forecasting | Scoped strictly to Indian Railways coaching trains under SIH 26028 |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| DATA-01 | Phase 1 | Pending |
| DATA-02 | Phase 1 | Pending |
| INGEST-01 | Phase 2 | Pending |
| INGEST-02 | Phase 2 | Pending |
| BASE-01 | Phase 2 | Pending |
| ML-01 | Phase 3 | Pending |
| ML-02 | Phase 3 | Pending |
| ML-03 | Phase 3 | Pending |
| ML-04 | Phase 3 | Pending |
| ML-05 | Phase 3 | Pending |
| API-01 | Phase 4 | Pending |
| API-02 | Phase 4 | Pending |
| UI-01 | Phase 5 | Pending |
| UI-02 | Phase 5 | Pending |
| UI-03 | Phase 5 | Pending |
| SIM-01 | Phase 6 | Pending |
| TEST-01 | Phase 6 | Pending |
| TEST-02 | Phase 6 | Pending |

**Coverage:**
- v1 requirements: 18 total
- Mapped to phases: 18
- Unmapped: 0 ✓

---
*Requirements defined: 2026-08-27*
*Last updated: 2026-08-27 after roadmap creation*
