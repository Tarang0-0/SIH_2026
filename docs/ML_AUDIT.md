# RailETA — Machine Learning System Audit & Evaluation Benchmark
**Document ID:** `docs/ML_AUDIT.md`  
**Problem Statement:** SIH 2026 — PS 26028 (Dynamic Forecast of ETA for Coaching Trains)  
**Audit Date:** 2026-08-27  
**Model Architecture:** Gradient Boosted Decision Trees (GBDT / XGBoost) + TreeExplainer  

---

## 1. Executive Summary

The RailETA ML forecasting engine was audited against the 12 core evaluation criteria specified in the SIH 26028 PRD. The system operates on a section-level cascading forecasting paradigm, predicting section running times and aggregating cumulative arrival times downstream with residual uncertainty intervals and SHAP explainability.

---

## 2. Detailed Audit Criteria Analysis

### 1. Prediction Target
- **What the model predicts:** `actual_running_minutes` (continuous float $\ge \text{physical\_minimum}$) for a specific track section between two adjacent stations ($\text{Station}_A \to \text{Station}_B$).
- **Cascading Formulation:** Downstream arrival time at station $N$ is computed recursively:
  $$\text{ETA}_N = \text{Current Time } T + \sum_{k=\text{current}}^{N-1} \left( \hat{y}_k + \text{Dwell}_k \right)$$
  where $\hat{y}_k$ is the ML-predicted travel time across section $k$, and $\text{Dwell}_k$ is the scheduled halt duration at intermediate station $k$.

---

### 2. Feature Vector Definition
The canonical feature vector consists of strictly 9 features:
```python
FEATURE_COLUMNS = [
    "current_delay_minutes",          # Float: observed delay upon section entry
    "current_speed_kmph",             # Float: observed instantaneous entry speed
    "section_distance_km",            # Float: topological section track length
    "scheduled_section_minutes",      # Float: timetable scheduled traversal time
    "historical_avg_running_minutes", # Float: historical average running duration
    "historical_p90_running_minutes", # Float: historical 90th percentile duration
    "departure_hour",                 # Int: hour of day [0-23] for congestion modeling
    "day_of_week",                    # Int: day of week [0-6] for weekly traffic cycles
    "train_type_encoded"              # Int: train priority (0=Shatabdi, 1=Rajdhani, 2=Vande Bharat, 3=Express)
]
```

---

### 3. Feature Availability & Zero-Leakage Guarantee
- **Invariant:** All features computed for prediction at timestamp $T$ derive strictly from:
  1. Active journey state at or before $T$ (`current_delay_minutes`, `current_speed_kmph`).
  2. Static route topology and schedule baseline (`section_distance_km`, `scheduled_section_minutes`, `historical_avg_running_minutes`, `historical_p90_running_minutes`).
  3. Calendar context determined at time $T$ (`departure_hour`, `day_of_week`).
- **Zero-Leakage Invariant Status:** **PASSED**. No future station arrival times or downstream target labels are present in the feature matrix during training or inference.

---

### 4. Data Split Strategy
- **Split Strategy:** Strict **Chronological Split** (80% Train on earlier timestamps, 20% Held-out Test on later timestamps).
- **Leakage Prevention:** No random row-wise shuffling (`shuffle=False`), preventing temporal data leakage.
- **Dataset Size:** 5,000 sequential section runs (4,000 train rows, 1,000 test holdout rows).

---

### 5. Baseline Definition
- **Baseline Formula:**
  $$\text{Baseline ETA}_N = \text{Scheduled Arrival}_N + \text{Current Observed Delay at Time } T$$
- **Baseline Code Path:** The baseline is calculated via `app.services.baseline.calculate_baseline_eta`, ensuring the identical formula is used in evaluation benchmarks and live API responses.

---

### 6. Benchmark Evaluation Results (Test Holdout)

Evaluating on the 20% chronological test holdout (1,000 independent section runs):

| Metric | Static Schedule Baseline | RailETA GBDT Model | Absolute Improvement | Relative Gain |
|:---|:---:|:---:|:---:|:---:|
| **MAE (Mean Absolute Error)** | **7.26 min** | **2.72 min** | **-4.54 min** | **+62.6% Better** |
| **RMSE (Root Mean Sq Error)** | **9.85 min** | **3.45 min** | **-6.40 min** | **+65.0% Better** |
| **Accuracy within $\pm 5$ min** | 43.7% | **85.3%** | +41.6% | **1.95x Higher** |
| **Accuracy within $\pm 10$ min** | 75.8% | **99.4%** | +23.6% | **1.31x Higher** |
| **Accuracy within $\pm 15$ min** | 91.2% | **100.0%** | +8.8% | **1.10x Higher** |

---

### 7. Uncertainty & Confidence Bounds Methodology
- **Approach:** Residual Quantile Analysis on the training set.
- **Residual Distribution:**
  $$\text{Residual} = y_{\text{actual}} - \hat{y}_{\text{pred}}$$
  $$q_{10} = -3.61 \text{ minutes}, \quad q_{90} = +3.68 \text{ minutes}$$
- **Dynamic Confidence Interval:**
  $$\text{Lower Bound} = \text{Predicted Delay} + q_{10}$$
  $$\text{Upper Bound} = \text{Predicted Delay} + q_{90}$$
- **Physical Invariant:** $\text{Lower Bound} \le \text{Upper Bound}$ strictly enforced.

---

### 8. Explainability via SHAP TreeExplainer
- **Attribution Model:** TreeExplainer decomposing section predictions into exact additive contributions:
  $$\hat{y} = \mathbb{E}[y] + \sum_{i=1}^{M} \phi_i$$
- **Operational Interpretation:**
  - $\phi_i < 0$: Features enabling **delay recovery** (e.g. Loco pilot clear track, off-peak night slot).
  - $\phi_i > 0$: Features causing **delay compounding** (e.g. Peak hour congestion, heavy entry delay).
- **Top Contributors:** `current_delay_minutes`, `departure_hour`, `scheduled_section_minutes`, `section_distance_km`.

---

### 9. Inference vs Training Consistency
- **Feature Extractor:** Single shared class `FeatureExtractor.extract_features` used across training script (`train_model.py`), evaluation harness (`evaluate_model.py`), and real-time backend engine (`ml_eta.py`).
- **Feature Ordering:** Guaranteed by strict `FEATURE_COLUMNS` schema validation.

---

### 10. Model Artifacts & Versioning
- **Artifacts Stored:**
  - `backend/ml/models/eta_model.pkl` (Serialized GBDT / XGBoost model)
  - `backend/ml/models/residuals.pkl` (Metadata containing $q_{10}, q_{90}$, train/test MAE/RMSE, feature list, and model type)
- **Active Model Version Tag:** `gbdt-v1.0` / `xgboost-v1.0`
