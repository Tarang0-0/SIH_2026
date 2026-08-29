---
phase: "03"
phase_name: "Sectional Feature Engineering & ML Forecasting Engine"
date: "2026-08-27"
status: "locked"
---

# Phase 3 Context: Sectional Feature Engineering & ML Forecasting Engine

<domain>
Build the zero-leakage GBDT section travel-time forecasting engine for RailETA:
1. Generate ~5,000 SYNTHETIC training records with realistic variability
2. Train a single unified XGBoostRegressor on per-section travel time
3. Evaluate against Phase 2 schedule baseline with MAE/RMSE/accuracy windows
4. Serve predictions via FastAPI (trained .pkl loaded at startup)
5. Generate top-5 SHAP feature contributions per journey + residual quantile confidence bounds
</domain>

<decisions>

## 1. Training Data Strategy

- **Volume**: Generate ~5,000 SYNTHETIC section records total (both trains combined).
- **Provenance**: All generated rows tagged `source='SYNTHETIC'` in Supabase.
- **Generation script**: `scripts/generate_training_data.py` — reads seed `section_history` means, applies Gaussian noise (mean=historical_avg, std=5 min) for delay, uniform sampling for time-of-day (0–23h) and day_of_week (0–6), seasonal factor ±10%.
- **Train/test split**: Chronological 80/20 split (first 80% train, last 20% test). Simulates temporal ordering, avoids temporal leakage.

## 2. Model Training & Serving

- **Algorithm**: `XGBoostRegressor` (primary). `LightGBM` as comparison candidate for eval report.
- **Model granularity**: Single unified model — `train_type_encoded` as a categorical feature (Shatabdi=0, Rajdhani=1, Express=2). One `.pkl` artifact.
- **Training script**: `scripts/train_model.py` — outputs `backend/ml/models/eta_model.pkl` + companion `backend/ml/models/residuals.pkl` (for quantile bounds).
- **FastAPI serving**: Model loaded once at startup via `@asynccontextmanager` lifespan event. Stored in app-state. No retraining at inference time.

## 3. Feature Set (Zero-Leakage Enforced)

Features allowed at inference time T (all observable at or before T):

| Feature | Source | Type |
|---------|--------|------|
| `current_delay_minutes` | journeys.current_delay_minutes | float |
| `current_speed_kmph` | journeys.current_speed_kmph | float |
| `section_distance_km` | route_stations topology (static) | float |
| `scheduled_section_minutes` | route_stations schedule (static) | float |
| `historical_avg_running_minutes` | section_history (pre-computed) | float |
| `historical_p90_running_minutes` | section_history (pre-computed) | float |
| `departure_hour` | journey.journey_date + departure (static) | int 0–23 |
| `day_of_week` | journey.journey_date (static) | int 0–6 |
| `train_type_encoded` | trains.train_type (static) | int 0–2 |

**Zero-leakage enforcement**: Implemented via a `FeatureExtractor` class (`backend/app/services/features.py`). It accepts only data from `MOCK_JOURNEY_STORE` / `journeys` table at the current timestamp. Static topology (distance, scheduled time) is allowed — these are not future observations.

## 4. Target Variable & Cascade Prediction

- **Target variable**: `actual_running_minutes` per section (section travel time, not total journey time).
- **Cascade**: At inference, model predicts all upcoming sections forward from `current_station`. First section uses live state; subsequent sections use propagated predicted arrival + delay.
- **Station ETA assembly**: `predicted_eta = journey_departure + sum(predicted_section_times_up_to_station)`.

## 5. Confidence Bounds

- **Method**: Residual quantile intervals from training set.
  - At training time: compute `residuals = actual_running_minutes - predicted_running_minutes` on training data.
  - Persist `q10 = np.percentile(residuals, 10)` and `q90 = np.percentile(residuals, 90)` in `residuals.pkl`.
  - At inference: `lower_bound_minutes = predicted_delay - abs(q10)`, `upper_bound_minutes = predicted_delay + q90`.
- No separate quantile regression models needed.

## 6. SHAP Explainability

- **Library**: `shap.TreeExplainer(model)` — deterministic, uses tree structure.
- **Granularity**: Journey-level SHAP — averaged SHAP values across all upcoming section predictions. Single dict per `ETAPredictionResponse`.
- **Shape**: Top-5 features by absolute SHAP value: `{"current_delay": 4.2, "historical_avg": -1.1, "time_of_day": 0.8, ...}`.
- **Zero LLM rule**: SHAP values are derived purely from model tree structures — no LLMs, no RAG for numeric attribution.

## 7. Evaluation Harness

- **Script**: `scripts/evaluate_model.py` — runs both baseline (`Scheduled + Delay`) and GBDT on the 20% holdout set.
- **Metrics reported**: MAE (minutes), RMSE (minutes), ±5 min accuracy %, ±10 min accuracy %, ±15 min accuracy %. Baseline and GBDT shown side-by-side.
- **Output**: Console/JSON print (can be piped to file). No markdown report artifact needed for Phase 3.

</decisions>

<canonical_refs>
- `docs/PRD.md` — Section 8 (ML Rules), Section 14 (Explainability criteria)
- `backend/app/schemas/eta.py` — StationETA and ETAPredictionResponse contracts (Phase 3 fills predicted_eta, shap_explanation, lower/upper_bound_minutes)
- `backend/app/schemas/event.py` — CanonicalTrainEvent (input contract)
- `backend/app/services/baseline.py` — Phase 2 baseline engine (Phase 3 replaces predicted_eta with GBDT output, keeps baseline_eta as benchmark)
- `backend/app/services/ingestion.py` — MOCK_JOURNEY_STORE (source for feature extraction at inference time)
- `supabase/seed.sql` — section_history table with historical means for Gaussian noise generation
- `.planning/REQUIREMENTS.md` — ML-01 through ML-05 requirements
</canonical_refs>

<code_context>
- `backend/app/schemas/eta.py`: `StationETA` and `ETAPredictionResponse` already define `predicted_eta`, `shap_explanation`, `lower_bound_minutes`, `upper_bound_minutes` — Phase 3 fills these from GBDT instead of baseline.
- `backend/app/services/baseline.py`: `ROUTE_TOPOLOGY` dict with section distances and schedules — reusable for feature extraction.
- `backend/app/services/ingestion.py`: `MOCK_JOURNEY_STORE` — source of `current_delay_minutes`, `current_speed_kmph`, `current_station` at inference time.
- `backend/ml/models/` [NEW] — directory for `eta_model.pkl` + `residuals.pkl` artifacts.
- `scripts/` — `generate_training_data.py`, `train_model.py`, `evaluate_model.py` [NEW].
</code_context>

<deferred>
- Weather-adjusted section predictions (ENV-01) — v2 requirement, out of scope for Phase 3.
- Per-station SHAP dicts in StationETA — deferred; journey-level SHAP is sufficient for SIH demo.
- XGBoost quantile regression for tighter intervals — deferred; residual quantile method is sufficient.
</deferred>
