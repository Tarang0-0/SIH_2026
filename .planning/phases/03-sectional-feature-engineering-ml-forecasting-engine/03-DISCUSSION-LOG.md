# Phase 3 Discussion Log: Sectional Feature Engineering & ML Forecasting Engine

**Date:** 2026-08-27
**Phase:** 03-sectional-feature-engineering-ml-forecasting-engine
**Areas discussed:** Training data strategy, Feature set & leakage boundary, Model evaluation harness, SHAP & confidence bounds

---

## Area 1: Training Data Strategy

| Question | Options Presented | Selected |
|----------|------------------|----------|
| How to generate training data? | Synthetic 2k / Derived from replay / Use seed rows only | **Generate ~5,000 SYNTHETIC records** |
| Volume? | 2,000 / 1,000 per train / 5,000 | **5,000 records** |
| Variability pattern? | Gaussian noise / Peak-hour patterns / Uniform range | **Gaussian (mean=historical_avg, std=5 min), uniform time/day, seasonal ±10%** |
| Train/test split? | Chronological 80/20 / K-fold CV / Hold-out by journey | **Chronological 80/20 split** |

---

## Area 2: Feature Set & Leakage Boundary

| Question | Options Presented | Selected |
|----------|------------------|----------|
| Feature set? | Recommended 9-feature set / Minimal 4 / Extended with weather | **current_delay, current_speed, section_distance, scheduled_section_mins, historical_avg, historical_p90, departure_hour, day_of_week, train_type_encoded** |
| Leakage enforcement? | FeatureExtractor class / Timestamp guard / Comments only | **FeatureExtractor class (MOCK_JOURNEY_STORE / journeys only)** |
| Model granularity? | Per train type / Unified / Per section | **Single unified model, train_type_encoded as feature** |
| Target variable? | Per-section travel time / Total remaining time / Residual delta | **Per-section actual_running_minutes** |
| Cascade depth? | All upcoming sections / Next station only / Next 2 sections | **All upcoming sections, cascade forward** |

---

## Area 3: Model Evaluation Harness

| Question | Options Presented | Selected |
|----------|------------------|----------|
| Metrics? | MAE+RMSE+±5/10/15 min / MAE+RMSE only / % improvement headline | **MAE, RMSE, ±5/10/15 min accuracy %, baseline vs GBDT side-by-side** |
| Output format? | Console/JSON / Markdown .md / Both | **Console/JSON from scripts/evaluate_model.py** |

---

## Area 4: SHAP & Confidence Bounds

| Question | Options Presented | Selected |
|----------|------------------|----------|
| SHAP structure? | Top-5 per station dict / Global importance / Full vector | **Top-5 {feature: shap_value} dict** |
| Confidence bounds method? | Residual quantile intervals / Quantile regression / Fixed MAE multiplier | **Residual quantile intervals (q10, q90 from training residuals)** |
| SHAP dict placement? | Journey-level averaged / Per-station in StationETA / Both | **Journey-level in ETAPredictionResponse.shap_explanation** |

---

## Deferred Ideas

- Weather-adjusted section predictions (ENV-01) — v2 scope
- Per-station SHAP dicts in StationETA — deferred; journey-level sufficient
- XGBoost quantile regression for tighter intervals — deferred
