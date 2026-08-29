# Project Research Summary — RailETA

## Core Domain Insights

Dynamic ETA forecasting for Indian Railways coaching trains (SIH 26028) requires moving beyond basic timetable tracking. The core technical value lies in section-level time-series forecasting that accounts for section-specific running behavior, station dwell times, accumulated delay, and operational conditions.

## Key Findings

### Recommended Technology Stack
- **Frontend**: Next.js, React, Tailwind CSS, shadcn/ui, TanStack Query, MapLibre GL JS
- **Backend**: FastAPI (Python 3.11+), Pydantic, WebSockets
- **Database System of Record**: Supabase (Managed PostgreSQL 15+ & PostGIS)
- **ML Engine**: Python, Pandas, scikit-learn, XGBoost / LightGBM, SHAP
- **Testing & Verification**: Pytest, Vitest, Playwright E2E
- **Orchestration Pillars**: GSD Core (planning/verification), Google Antigravity (implementation), Google Stitch (UI/UX design handoff)

### Key Requirements & Feature Hierarchy
- **P0 Table Stakes**: Train search, live state ingestion, schedule baseline calculation, section-level ML forecasting, MapLibre GL route visualizer, confidence range estimation, prediction explainability breakdown, deterministic replay/simulation engine.
- **P1 Enhancements**: Weather enrichment, interactive what-if disruption simulator, prediction audit history, operations analytics dashboard.
- **P2 / Future**: Live signal network integration, national streaming architecture, automated online model retraining.

### Architecture & Build Order
1. Supabase PostgreSQL Schema & Seed Data Pipeline
2. FastAPI Event Ingestion & Baseline ETA Engine
3. Feature Engineering & XGBoost ML Training Pipeline
4. Dynamic Prediction REST & WebSocket API
5. Next.js + MapLibre GL Dashboard with Stitch UI Concepts
6. Disruption Simulation Engine & Playwright Verification

### Key Risks & Critical Mitigations
- **Data Leakage**: Strict temporal split (prediction at T uses data $\le$ T).
- **Static Baseline Illusion**: Benchmark ML predictions explicitly against `Scheduled ETA + Current Delay`.
- **Fake AI / LLM Hallucinations**: Zero LLM involvement in numerical predictions; SHAP feature contributions for explainability.

## Sources

- SIH 2026 Problem Statement 26028 Official Guidelines
- Indian Railways Sectional Running & Schedule Topologies
- GSD Core & Google Antigravity Architecture Contracts
