# Roadmap: RailETA — Dynamic ETA Forecast for Coaching Trains

## Overview

RailETA is built in 6 focused phases following a Vertical MVP strategy (`PROJECT_MODE=mvp`). The roadmap progresses from Supabase schema setup and event ingestion to zero-leakage section-level ML forecasting, real-time WebSocket APIs, Next.js/MapLibre UI, and interactive disruption simulation.

## Phases

- [x] **Phase 1: Project & Database Foundation (Supabase)** - Initialize repo, FastAPI, Next.js, and Supabase PostgreSQL schema with seed data.
- [x] **Phase 2: Real-time Event Ingestion & Baseline ETA Engine** - Event ingestion, deterministic replay feed, and schedule baseline calculator.
- [x] **Phase 3: Sectional Feature Engineering & ML Forecasting Engine** - Zero-leakage feature pipeline, GBDT model training, confidence bounds, and SHAP explainability.
- [x] **Phase 4: Real-time Prediction Stream & Backend API** - FastAPI REST endpoints and WebSocket stream for dynamic ETA updates.
- [x] **Phase 5: Next.js + MapLibre GL Dashboard (Stitch UI)** - Fleet dashboard, animated route visualizer, and station ETA detail cards.
- [x] **Phase 6: Disruption Simulator, Testing & Demo Hardening** - Interactive what-if simulator, Pytest/Playwright test suites, and SIH demo replay script.

## Phase Details

### Phase 1: Project & Database Foundation (Supabase)
**Goal**: Establish system of record with Supabase PostgreSQL schema, seed topology datasets, and backend/frontend application scaffolding.
**Mode**: mvp
**Depends on**: Nothing
**Requirements**: DATA-01, DATA-02
**Success Criteria**:
  1. Supabase PostgreSQL database initialized with tables for trains, stations, routes, schedules, and historical section metrics.
  2. FastAPI backend and Next.js frontend projects configured with active Supabase client connections.
**Plans**: 2 plans

Plans:
- [x] 01-01: Supabase migrations and seed scripts for train topologies and historical section metrics.
- [x] 01-02: FastAPI backend scaffolding and Next.js workspace setup with Supabase SDK.

### Phase 2: Real-time Event Ingestion & Baseline ETA Engine
**Goal**: Build event ingestion pipeline, deterministic replay feed adapter, and schedule baseline ETA calculation engine.
**Mode**: mvp
**Depends on**: Phase 1
**Requirements**: INGEST-01, INGEST-02, BASE-01
**Success Criteria**:
  1. FastAPI endpoint ingests train running state updates and updates current position in Supabase.
  2. Deterministic replay feed adapter streams journey events for demonstration.
  3. Baseline ETA (`Scheduled Arrival + Current Delay`) calculated for all upcoming stations.
**Plans**: 2 plans

Plans:
- [x] 02-01: Event ingestion schema, state store, and deterministic replay feed adapter.
- [x] 02-02: Baseline ETA calculator engine and station delay propagation baseline API.

### Phase 3: Sectional Feature Engineering & ML Forecasting Engine
**Goal**: Build zero-leakage section feature extraction, train XGBoost/LightGBM section ETA model, compute confidence bounds, and generate SHAP explainability.
**Mode**: mvp
**Depends on**: Phase 2
**Requirements**: ML-01, ML-02, ML-03, ML-04, ML-05
**Success Criteria**:
  1. Section-level tabular feature extraction pipeline created with zero temporal leakage.
  2. GBDT model trained on historical section run logs.
  3. Evaluation harness demonstrates measurable MAE/RMSE improvement over static baseline.
  4. Dynamic confidence intervals (e.g. ±5-15 min) and SHAP feature importance vectors generated per prediction.
**Plans**: 2 plans

Plans:
- [x] 03-01: Synthetic training data generation, zero-leakage feature extractor, and XGBoost training pipeline.
- [x] 03-02: Cascading ML inference engine, SHAP tree explainability, evaluation benchmark, and test suite.

### Phase 4: Real-time Prediction Stream & Backend API
**Goal**: Expose FastAPI REST endpoints and WebSocket stream for live dynamic ETA updates.
**Mode**: mvp
**Depends on**: Phase 3
**Requirements**: API-01, API-02
**Success Criteria**:
  1. FastAPI REST endpoints return active train list, station route details, and predictions.
  2. WebSocket publishes dynamic ETA recalculations to connected frontend clients when running updates arrive.
**Plans**: 1 plan

Plans:
- [x] 04-01: FastAPI REST endpoints and WebSocket real-time prediction engine.

### Phase 5: Next.js + MapLibre GL Dashboard (Stitch UI)
**Goal**: Build Next.js dashboard featuring MapLibre GL JS route visualizer and station ETA details using Stitch design specifications.
**Mode**: mvp
**Depends on**: Phase 4
**Requirements**: UI-01, UI-02, UI-03
**Success Criteria**:
  1. Next.js dashboard displays fleet overview, search, and station auto-complete.
  2. MapLibre GL JS map renders station route nodes and animated train location markers.
  3. Train detail page displays station-by-station ETAs, confidence range badges, and SHAP feature breakdown.
**Plans**: 2 plans

Plans:
- [x] 05-01: Next.js dashboard layout, search interface, and MapLibre GL map component.
- [x] 05-02: Train detail page with live station ETA list, confidence bounds, and SHAP feature chart.

### Phase 6: Disruption Simulator, Testing & Demo Hardening
**Goal**: Deliver interactive what-if disruption simulator, Pytest/Playwright test suites, and deterministic SIH demo script.
**Mode**: mvp
**Depends on**: Phase 5
**Requirements**: SIM-01, TEST-01, TEST-02
**Success Criteria**:
  1. Interactive what-if simulator allows injecting custom delays and triggers dynamic downstream ETA adjustments.
  2. Pytest suite passes for ML leakage and API contracts; Playwright E2E browser tests pass for main user flows.
  3. Deterministic 1-minute demo script verified for SIH evaluation.
**Plans**: 2 plans

Plans:
- [x] 06-01: Interactive what-if disruption simulator UI and backend integration.
- [x] 06-02: Pytest ML/API test execution, Playwright E2E verification, and SIH demo scenario verification.

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Project & Database Foundation | v1.0 | 2/2 | Complete | 2026-08-27 |
| 2. Event Ingestion & Baseline ETA | v1.0 | 2/2 | Complete | 2026-08-27 |
| 3. Sectional ML Forecasting Engine | v1.0 | 2/2 | Complete | 2026-08-27 |
| 4. Real-time Prediction API | v1.0 | 1/1 | Complete | 2026-08-27 |
| 5. Next.js + MapLibre Dashboard | v1.0 | 2/2 | Complete | 2026-08-27 |
| 6. Disruption Simulator & Testing | v1.0 | 2/2 | Complete | 2026-08-27 |
