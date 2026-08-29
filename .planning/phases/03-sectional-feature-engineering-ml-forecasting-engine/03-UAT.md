---
status: complete
phase: 03-sectional-feature-engineering-ml-forecasting-engine
source:
  - scripts/generate_training_data.py
  - backend/app/services/features.py
  - scripts/train_model.py
  - backend/app/services/ml_eta.py
  - scripts/evaluate_model.py
  - backend/tests/test_ml_forecasting.py
started: 2026-08-27T18:12:00Z
updated: 2026-08-27T18:15:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Zero-Leakage Feature Extractor (ML-01)
expected: FeatureExtractor accepts only observations <= T and static topology to produce 9 tabular features.
result: pass

### 2. GBDT Section Model Training & Serialization (ML-02)
expected: scripts/train_model.py fits GBDT regressor on actual_running_minutes and serializes eta_model.pkl and residuals.pkl.
result: pass

### 3. Model Benchmark Evaluation vs Baseline (ML-03)
expected: scripts/evaluate_model.py proves GBDT achieves superior MAE/RMSE over static schedule baseline on 20% holdout.
result: pass (MAE 2.72m vs 7.26m, +62.6% improvement)

### 4. Confidence Bounds Calculation (ML-04)
expected: Prediction engine computes residual quantile intervals satisfying lower_bound <= predicted_delay <= upper_bound.
result: pass

### 5. SHAP Feature Explainability Vector (ML-05)
expected: shap.TreeExplainer generates top-5 feature attributions in ETAPredictionResponse.shap_explanation.
result: pass

## Summary

total: 5
passed: 5
issues: 0
pending: 0
skipped: 0

## Gaps

[none]
