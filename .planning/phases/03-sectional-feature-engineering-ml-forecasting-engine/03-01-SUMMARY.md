---
phase: 03-sectional-feature-engineering-ml-forecasting-engine
plan: 03-01
status: completed
completed_at: 2026-08-27T18:15:00Z
---

# Summary 03-01: Synthetic Data Generation, Feature Extraction & GBDT Training

## Accomplishments
- Implemented `scripts/generate_training_data.py` producing 5,000 realistic synthetic section traversal records with Gaussian delay variance ($\sigma=5\text{ min}$), time-of-day/day-of-week distributions, and ±10% seasonal variance.
- Created `backend/app/services/features.py` featuring the zero-leakage `FeatureExtractor` class extracting 9 standardized tabular features.
- Implemented offline model training pipeline in `scripts/train_model.py` with 80/20 chronological split, training a GBDT regressor on section running times (`actual_running_minutes`).
- Computed empirical residual quantile intervals ($q_{10} = -3.61\text{ min}$, $q_{90} = +3.68\text{ min}$) and persisted model artifacts to `backend/ml/models/eta_model.pkl` and `residuals.pkl`.

## Verification Results
- Synthetic data generated: 5,000 rows in `backend/ml/data/synthetic_section_data.csv`.
- GBDT training performance: Train MAE 2.25 min, Test MAE 2.72 min.
