---
phase: 03-sectional-feature-engineering-ml-forecasting-engine
plan: 03-02
status: completed
completed_at: 2026-08-27T18:15:00Z
---

# Summary 03-02: Cascading ML Inference, SHAP Explainability & Evaluation Benchmark

## Accomplishments
- Implemented `backend/app/services/ml_eta.py` featuring the `MLETAEngine` service:
  - Cascades multi-section predictions forward across upcoming stations.
  - Generates residual quantile confidence intervals ($lower\_bound \dots upper\_bound$).
  - Calculates top-5 SHAP feature attributions via `shap.TreeExplainer` and populates `shap_explanation` in `ETAPredictionResponse`.
- Updated FastAPI application lifecycle in `backend/app/main.py` to preload ML artifacts into memory on startup.
- Integrated `predict_ml_eta` into `GET /api/v1/trains/{id}/eta` endpoint.
- Created `scripts/evaluate_model.py` benchmarking GBDT against Phase 2 baseline on 20% holdout test data (MAE 2.72m vs 7.26m, +62.6% improvement).
- Built comprehensive Pytest test suite in `backend/tests/test_ml_forecasting.py` covering ML-01 through ML-05.

## Verification Results
- **Evaluation Benchmark**:
  - MAE: Baseline 7.26m $\rightarrow$ GBDT 2.72m (**+62.6% improvement**)
  - RMSE: Baseline 9.85m $\rightarrow$ GBDT 3.45m (**+65.0% improvement**)
  - Accuracy within $\pm 5$ min: Baseline 43.7% $\rightarrow$ GBDT 85.3% (**+41.6% improvement**)
  - Accuracy within $\pm 10$ min: 99.4%
  - Accuracy within $\pm 15$ min: 100.0%
- **Backend Test Suite**: 25/25 passed in 2.36s (0 errors).
