# Architecture Research — RailETA

## System Architecture Overview

```text
[ Data Providers / Replay Feed ]
             │
             ▼
[ FastAPI Event Ingestion & State Adapter ] ───▶ [ Supabase PostgreSQL (PostGIS) ]
             │                                              ▲
             ▼                                              │
[ Feature Engineering & Pipeline Engine ]                     │
             │                                              │
             ▼                                              │
[ ML Inference Engine (XGBoost / LightGBM) ] ────────────────┘
             │
             ▼
[ WebSocket / REST Prediction API ]
             │
             ▼
[ Next.js + MapLibre GL Dashboard (Stitch UI Design) ]
```

## Component Boundaries

1. **Event Ingestion & State Manager (FastAPI)**: Accepts running updates, validates schema, updates current train state in Supabase, and triggers feature recalculation.
2. **Feature Engineering Engine**: Computes section-level features (distance to next station, mean historical sectional speed, time of day, elapsed delay, weather).
3. **ML Inference Engine**: Loads pre-trained section models, calculates point prediction, confidence range, and feature contributions (SHAP).
4. **Supabase PostgreSQL System of Record**: Stores route topologies, stations, train schedules, historical section running metrics, running logs, and prediction snapshots.
5. **Frontend Dashboard (Next.js & MapLibre GL)**: Consumes REST API and WebSockets to visualize route nodes, live train position, prediction cards, confidence intervals, and simulation controls.

## Data Flow & Triggers

1. Incoming Event (Replay Feed / API POST `/api/v1/running-updates`)
2. Validate Schema & Store Event -> `running_updates` table.
3. Update `journeys` current position and delay state.
4. Calculate section features for upcoming remaining stations.
5. Call ML Model Inference (`/predict`).
6. Store prediction result in `eta_predictions` table.
7. Broadcast update via WebSocket / Supabase Realtime to Next.js UI.
8. Next.js UI updates map marker position, station ETA list, and confidence badges.

## Recommended Build Order

1. **Database Schema & Seed Pipeline**: Base tables (trains, stations, routes, schedules, historical section running metrics).
2. **Backend API & Event Ingest**: FastAPI boilerplate, Supabase connection, event receiver, baseline ETA calculator.
3. **ML Pipeline & Baseline Benchmark**: Dataset generator, leakage-free feature extractor, XGBoost model training vs. schedule baseline.
4. **Dynamic Prediction API**: Integrate model inference into FastAPI with confidence bounds & explainability output.
5. **Frontend Dashboard & Map Visualization**: Next.js app, MapLibre GL train route, station ETA list, live update hook.
6. **Simulation Engine & UI Polish**: What-if event injection controls, video demo scenarios, Playwright verification.
