# RailETA — Dynamic Forecast of ETA for Coaching Trains

## What This Is

RailETA is a continuously updating, explainable Expected Time of Arrival (ETA) forecasting engine for Indian Railways coaching trains. It combines real-time train running state, schedules, historical section-level running behavior, and operational/environmental variables to dynamically forecast future arrival times at upcoming stations and final destinations.

## Core Value

Accurately forecast future section-level running behavior and arrival times dynamically as operational events occur, delivering measurable improvements over static schedule + delay baselines without using fabricated data or LLM hallucinations.

## Business Context

- **Customer**: Indian Railways passengers, station controllers, and operational teams (SIH 2026 Problem 26028)
- **Revenue model**: Open-source public infrastructure / Smart India Hackathon 2026 solution
- **Success metric**: Statistically significant MAE/RMSE reduction and higher ±5/10/15 min accuracy windows vs. baseline
- **Strategy notes**: SIH 26028 Official Problem Statement Single Source of Truth (SSOT)

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Dynamic section-level ML ETA forecasting engine (XGBoost / LightGBM)
- [ ] Real-time running update ingestion & state tracking pipeline (Replay/Live adapter)
- [ ] Baseline ETA calculator (`Scheduled ETA + Current Delay`) for benchmarking
- [ ] Supabase PostgreSQL database schema (trains, routes, stations, journeys, updates, predictions)
- [ ] FastAPI backend REST API and WebSocket real-time update engine
- [ ] Next.js + React + Tailwind CSS + MapLibre GL JS frontend dashboard
- [ ] Interactive what-if disruption simulation & deterministic replay mode
- [ ] Feature-level prediction explainability (SHAP / feature contribution breakdown)
- [ ] Confidence interval / uncertainty range calculation per ETA prediction
- [ ] Playwright E2E browser verification and Pytest automated testing suite

### Out of Scope

- RAG / Vector DB / LLM-generated ETA numbers — [Numeric forecasting requires deterministic ML pipelines; LLMs risk hallucination]
- Voice UI in P0 MVP — [P1/P2 optional enhancement; core ETA engine must not be blocked]
- Live Indian Railways signal network integration — [Authentic APIs unvalidated for hackathon; synthetic deterministic replay used]
- Freight train forecasting — [Explicitly scoped to coaching trains under SIH 26028]

## Context

SIH 2026 Problem Statement 26028 requires dynamic forecasting of ETA for coaching trains. The architecture relies on three primary orchestration pillars:
- **GSD Core**: Planning, roadmap decomposition, verification gates, and milestone tracking.
- **Google Antigravity**: Autonomous code generation, debugging, refactoring, and test execution.
- **Google Stitch**: UI/UX exploration, layout concepts, and design component handoffs.

## Constraints

- **Tech Stack**: Next.js, FastAPI, Supabase PostgreSQL, XGBoost/LightGBM, MapLibre GL JS, Pytest, Playwright.
- **Data Integrity**: Zero data leakage constraint (predictions at time T use only data available at or before T).
- **No Fabricated Information**: Explicit labeling of REAL vs SIMULATED data; empirical ML evaluation.
- **System of Record**: Supabase PostgreSQL as sole database platform (no MongoDB/Firebase).

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Section-level forecasting over global delay extrapolation | Captures localized running behavior and section recovery/slowdowns | — Pending |
| Supabase PostgreSQL as primary system of record | Consolidated managed relational platform with PostGIS capabilities | — Pending |
| XGBoost / LightGBM over Deep Learning | Tabular time-series strength, faster training/inference, explainable | — Pending |
| MapLibre GL JS over proprietary maps | Provider-agnostic, open-source geospatial visualization | — Pending |
| Deterministic Replay Feed for Demo | Ensures 100% reproducible live event injection during SIH evaluation | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-08-27 after initialization*
