# RailETA — Production ML Model Evaluation Report
**Document ID:** `docs/EVALUATION.md`  
**Problem Statement:** SIH 2026 — PS 26028 (Dynamic Forecast of ETA for Coaching Trains)  
**Evaluation Date:** 2026-08-28  
**Holdout Set:** 3,000 Chronological Test Section Runs (20% Holdout of 15,000 Dataset)  

---

## 1. Executive Summary

This report documents the rigorous evaluation of RailETA's production **20-Feature Gradient Boosted Decision Tree (GBDT)** model. The model incorporates **topographical elevation gradients (OpenTopography SRTM DEM)**, **severe weather rules (OpenWeather fog detonator speed caps, monsoon downpours, extreme track heat)**, **junction congestion indices**, and **dynamic train line priorities**.

---

## 2. Benchmark Results

| Model Configuration | Feature Count | MAE (min) | RMSE (min) | Median AE (min) | Acc $\pm 5$m (%) | Acc $\pm 10$m (%) | Acc $\pm 15$m (%) | Relative Gain vs Baseline |
|:---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Static Schedule Baseline** | 1 (Timetable) | **24.94** | **42.19** | **16.30** | 15.3% | 31.4% | 46.3% | Baseline |
| **RailETA Production GBDT** | **20 Features** | **1.49** | **4.25** | **1.10** | **98.5%** | **99.7%** | **99.9%** | **+94.0%** |

---

## 3. Real-World Physical Factors Modeled

1. **Topographical Gradients (OpenTopography SRTM DEM):** Steep inclines (such as Bhor Ghat, Thal Ghat, Malwa Plateau) introduce physical deceleration (+5% to +20% section runtime).
2. **Dense Fog Caution (Detonator Rules):** Low visibility (< 800m) restricts train speed to 30–60 km/h in winter corridors.
3. **Monsoon Downpours (> 25 mm/h):** Track patrol caution and extended braking distances.
4. **Extreme Heat (> 42°C):** Track expansion alerts trigger caution speeds (~100 km/h).
5. **Junction Interlocking Density:** Compensates for crossing and terminal switch headway delays.
6. **Empirical Prediction Intervals:** $q_{10} = -1.90$ min and $q_{90} = 1.92$ min construct calibrated 80% confidence bounds.
