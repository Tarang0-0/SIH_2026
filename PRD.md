# PRD: RailETA — Dynamic ETA Forecast for Coaching Trains

**Status:** Planning | **Last Updated:** 2026-08-27

## Overview

RailETA is a continuously updating, explainable ETA forecasting engine for Indian Railways coaching trains (SIH 2026 Problem 26028). It combines real-time running state, schedules, historical section-level running behavior, and operational/environmental variables to dynamically forecast arrival times at upcoming stations and final destinations.

## Core Value

Accurately forecast future section-level running behavior and arrival times dynamically as operational events occur, delivering measurable improvements over static schedule + delay baselines — without fabricated data or LLM hallucinations.

## Business Context

| | |
|---|---|
| **Customer** | Indian Railways passengers, station controllers, operational teams |
| **Context** | Smart India Hackathon 2026, Problem Statement 26028 |
| **Model** | Open-source public infrastructure |
| **Success Metric** | Statistically significant MAE/RMSE reduction and higher ±5/10/15 min accuracy windows vs. baseline |

## Data Sources

| Category | Source | Status |
|---|---|---|
| **Real — static** | Train/station/route master data, published timetables | Open — confirm source (e.g. data.gov.in, NTES-derived datasets) in Phase 1 |
| **Real — historical running behavior** | Section-level historical running-time/delay records | Open — confirm provider, date range, and route/train coverage in Phase 1 |
| **Real-time / live** | Running updates (lat/long, station, speed, delay) during demo | Ingested via FastAPI ingestion (INGEST-01) |
| **Simulated** | Deterministic replay feed for demo reproducibility; any gap-filled or synthetic section data | Explicitly labeled SIMULATED end-to-end (DB → API → UI), per "no fabricated data" constraint |

**Resolve in Phase 1:**
- Source(s) and licensing for historical section-level data, and minimum viable history length for the ML model to train meaningfully.
- Fallback if real coverage is too sparse for a given route/section: exclude that section from ML predictions and fall back to baseline, rather than fabricating data.
- REAL vs. SIMULATED labeling implemented as a `data_source` column at the schema level, so it propagates to API/UI without extra translation logic.

## Goals

1. Beat the naive `Scheduled ETA + Current Delay` baseline with a section-level ML model, with measurable, reproducible evaluation.
2. Keep predictions deterministic and explainable (GBDT + SHAP) — zero LLM/RAG involvement in numeric forecasting.
3. Enforce zero data leakage: predictions at time T use only data available at or before T.
4. Ship a working demo: live map, station-by-station ETA cards with confidence bounds, and an interactive disruption simulator.

## Scope (v1 / P0)

| Area | Requirement |
|---|---|
| **Data** | Supabase schema + seed data for trains, stations, routes, schedules, historical section metrics (DATA-01/02) |
| **Ingestion** | FastAPI ingestion of running updates (lat/long, station, speed, delay); deterministic replay adapter (INGEST-01/02) |
| **Baseline** | `Scheduled Arrival + Current Delay` calculator for benchmarking (BASE-01) |
| **ML** | Zero-leakage section feature pipeline; XGBoost/LightGBM model; MAE/RMSE + accuracy-window eval; confidence bounds; SHAP explainability (ML-01→05) |
| **API** | REST endpoints (train search, journey state, route) + WebSocket stream for live ETA updates (API-01/02) |
| **Frontend** | Next.js dashboard: fleet overview, search, MapLibre GL route + train markers, station ETA cards w/ confidence + SHAP breakdown (UI-01→03) |
| **Simulation** | Interactive what-if disruption injection (e.g., 10-min halt) with downstream ETA recalculation (SIM-01) |
| **Testing** | Pytest (leakage, API contracts); Playwright E2E (search, live update, simulation) (TEST-01/02) |

### Baseline Definition Details

- **"Current delay"** = the delay reported in the most recent `running_updates` record at or before prediction time T (no interpolation/extrapolation between reports).
- **Cold start** (no running updates yet): baseline = scheduled arrival time (delay = 0) until the first real update arrives.
- **Stale updates** (train silent for an extended period): staleness threshold TBD in Phase 2 — flag prediction confidence as degraded rather than silently carrying forward a stale delay value indefinitely.
- Baseline is computed by the same code path for evaluation and the live API, so the "beat the baseline" claim isn't computed differently in each context.

**v2 (post-MVP):** weather-adjusted predictions (ENV-01), delay propagation across shared track/choke points (NET-01).

**Out of scope:** LLM/RAG numeric forecasting, voice UI, live signal/interlocking integration, freight trains.

## Architecture

```
Replay Feed / Data Providers
        ↓
FastAPI Event Ingestion & State Adapter ──→ Supabase PostgreSQL (PostGIS)
        ↓                                          ↑
Feature Engineering Pipeline                       │
        ↓                                          │
ML Inference Engine (XGBoost/LightGBM) ────────────┘
        ↓
WebSocket / REST Prediction API
        ↓
Next.js + MapLibre GL Dashboard
```

**Flow:** event received → validated & stored (`running_updates`) → journey state updated → section features computed → model inference → prediction stored (`eta_predictions`) → broadcast via WebSocket → UI updates map/ETA list/confidence badges.

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js (React 19), Tailwind + shadcn/ui, TanStack Query, MapLibre GL JS |
| Backend | FastAPI (Python 3.11+) |
| Database | Supabase (PostgreSQL 15+, PostGIS) — sole system of record, no Mongo/Firebase |
| ML | Pandas, NumPy, scikit-learn, XGBoost/LightGBM, SHAP |
| Testing | Pytest, Vitest, Playwright |
| AI workflow | GSD Core (planning), Google Antigravity (implementation), Google Stitch (UI/UX) |

## Key Decisions

- Section-level forecasting over global delay extrapolation — captures localized slowdowns/recovery.
- Supabase as sole system of record — relational integrity + PostGIS.
- GBDT over deep learning — better fit for small tabular datasets, explainable, fast.
- MapLibre GL over proprietary maps — open-source, no API key cost.
- Deterministic replay feed for demo — reproducible live-event injection during evaluation.

## Evaluation Methodology

- **Split strategy:** chronological split (train on earlier dates, evaluate on later dates) — never random row-wise — consistent with the zero-leakage constraint. Route/train-held-out evaluation as a secondary robustness check.
- **Statistical significance:** paired comparison of per-prediction absolute errors between model and baseline (paired t-test or bootstrap CI on the MAE/RMSE difference), not a raw point-estimate comparison.
- **Minimum sample size:** to be set once real data volume is known in Phase 1 — define the minimum evaluated predictions/journeys needed before an improvement claim is meaningful.
- **Reporting:** MAE, RMSE, and ±5/10/15 min accuracy-window hit rates, reported for both baseline and model on the same held-out set.

## Confidence Bounds Methodology

- Approach to be decided early in Phase 3, since it affects model architecture, not just post-hoc calculation. Candidates: quantile regression (separate low/high quantile models), conformal prediction (coverage-guaranteed wrapper), or residual-based bootstrapping.
- Target coverage level (e.g. 80% or 90% interval) to be defined and validated on the held-out evaluation set, not just asserted.

## Cold-Start & Missing-Data Handling

- **New train / no running updates yet:** fall back to baseline (scheduled ETA), flagged as "baseline only, insufficient live data" in the API/UI rather than shown as a full model prediction.
- **GPS/position gaps mid-journey:** staleness threshold defined in Phase 2; predictions continue using last-known state, with confidence bounds widened accordingly.
- **Section with insufficient historical training data:** model does not predict for that section — falls back to baseline for that section only, consistent with the "no fabricated data" constraint.

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Data leakage (future info used at train time) | Strict chronological splits; cutoff feature access at T; automated tests |
| "Timetable + delay" fallacy (model mirrors trivial baseline) | Section-level targets; explicit % improvement vs. baseline |
| LLM/RAG hallucination in predictions | LLMs excluded from prediction path entirely; SHAP for explainability |
| Over-complicating with deep learning | GBDT mandated for P0; DL only if empirically justified |
| Frontend/backend contract drift | Shared OpenAPI/Pydantic contracts as single source of truth |
| Historical data too sparse to train meaningfully | See Data Sources fallback — narrow scope to well-covered sections/routes |

## Constraints

- Zero data leakage (predictions at T use only data ≤ T).
- No fabricated data — explicit REAL vs. SIMULATED labeling.
- Supabase PostgreSQL only.

## Non-Functional Requirements

| Area | Target (TBD — confirm before Phase 4) |
|---|---|
| Prediction latency | End-to-end (event ingested → prediction broadcast), target < 2–3s |
| WebSocket update frequency | Set to match replay feed cadence during demo |
| Demo scale | Concurrent trains / dashboard users to be sized against replay dataset in Phase 1 |
| Reliability | N/A for hackathon demo scope, but replay must be reproducible run-to-run |

## Access & Auth

No authentication in v1 — API and dashboard are open for judging. A future public deployment would need read-only public access plus authenticated write access for ingestion sources; out of scope for v1.

## Team & Ownership

| Phase/Area | Owner |
|---|---|
| Foundation (schema, seed data, scaffolding) | TBD |
| Ingestion & Baseline | TBD |
| ML Engine | TBD |
| Prediction API | TBD |
| Dashboard | TBD |
| Simulation & Hardening | TBD |

*(Fill in names once team roles are assigned; even a rough owner-per-phase avoids everyone touching every layer under time pressure.)*

## Assumptions

- Real historical section-level data (see Data Sources) will be available in sufficient volume and quality to train a GBDT model that meaningfully beats the baseline; if not, fallback is to narrow scope to sections/routes with adequate data.
- Supabase free/hobby tier is sufficient for demo-scale data volume and concurrent connections.
- The deterministic replay feed is representative enough of real operational patterns to make a convincing live demo.
- Judges evaluate primarily via the live demo + metrics report, not a large-scale production deployment.

## Roadmap (6 Phases, MVP mode)

1. **Foundation** — Supabase schema, seed data, FastAPI/Next.js scaffolding
2. **Ingestion & Baseline** — event pipeline, replay feed, baseline ETA calculator
3. **ML Engine** — zero-leakage features, GBDT training/eval, confidence bounds, SHAP
4. **Prediction API** — REST + WebSocket real-time stream
5. **Dashboard** — Next.js + MapLibre fleet view, train detail page
6. **Simulation & Hardening** — what-if simulator, Pytest/Playwright, demo script

**Current status:** Phase 1 of 6, 0/11 plans complete, not yet started.

### Phase Timeline & Per-Phase Definition of Done

| Phase | Target Date (TBD) | Definition of Done |
|---|---|---|
| 1. Foundation | TBD | Schema deployed to Supabase, seed data loaded, FastAPI + Next.js scaffolds run locally, data source(s) confirmed |
| 2. Ingestion & Baseline | TBD | Replay feed produces `running_updates`; baseline calculator matches Baseline Definition Details |
| 3. ML Engine | TBD | Leakage tests pass; model beats baseline on held-out set per Evaluation Methodology; confidence bounds + SHAP working |
| 4. Prediction API | TBD | REST + WebSocket endpoints match shared OpenAPI/Pydantic contracts; latency within NFR target |
| 5. Dashboard | TBD | Fleet view, search, map, and ETA cards with confidence + SHAP render against live API |
| 6. Simulation & Hardening | TBD | Disruption simulator recalculates downstream ETAs correctly; Pytest + Playwright suites pass; demo script runs end-to-end |

*(Target dates to be set once the SIH 2026 submission/demo deadline is confirmed — work backward from that date.)*

## Demo Narrative

Suggested walkthrough for judges: (1) live map with trains moving via the replay feed; (2) select a train, show station-by-station ETA cards with confidence bounds and SHAP explanation; (3) inject a disruption (e.g. 10-min halt) via the simulator and show downstream ETAs recalculating in real time; (4) metrics panel comparing model MAE/RMSE and accuracy windows against the baseline, referencing the Evaluation Methodology.

## Glossary

- **Section:** a discrete track segment between two stations, the unit at which running behavior is forecasted.
- **Coaching train:** passenger-carrying train (as opposed to freight), the sole scope of this project.
- **Running update:** a live event report (position, speed, delay) for a train during its journey.
- **REAL vs SIMULATED:** data provenance label required on all displayed data — REAL for actual historical/live records, SIMULATED for replay or gap-filled data.

## Success Criteria (Definition of Done for v1)

- ML model shows statistically significant MAE/RMSE improvement over baseline, with ±5/10/15 min accuracy windows reported.
- Live dashboard displays real-time train positions, ETA predictions, confidence ranges, and SHAP-based explanations.
- Disruption simulator correctly recalculates downstream ETAs on injected events.
- Full Pytest + Playwright suites pass; deterministic demo script runs end-to-end.
