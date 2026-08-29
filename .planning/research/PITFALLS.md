# Domain Pitfalls & Mitigations — RailETA

## Critical Pitfalls & Mitigation Strategies

### 1. Data Leakage in Time-Series Forecasting
- **Risk**: Using future station arrival times or future delays when training section models for a given timestamp T.
- **Warning Sign**: Unusually perfect model accuracy (MAE < 30 seconds across long journeys) during validation.
- **Mitigation**: Strictly implement chronological train-validation-test splits. Cut off feature access at timestamp T during feature extraction. Enforce automated unit tests checking zero future column access.

### 2. "Timetable + Delay" Fallacy
- **Risk**: Simply adding current delay to all remaining stations (`Destination ETA = Scheduled Destination + Current Delay`).
- **Warning Sign**: Model predictions perfectly mirror the schedule baseline without reflecting section slowdowns or schedule recovery sections.
- **Mitigation**: Formulate targets at the section level (`sectional_running_time`). Evaluate models explicitly against the `Scheduled + Delay` baseline using percentage improvement metrics.

### 3. LLM/RAG Hallucination Trap
- **Risk**: Using an LLM or Vector DB to generate or explain numerical ETA predictions directly.
- **Warning Sign**: Non-deterministic arrival predictions or fabricated reasons for delay.
- **Mitigation**: Restrict LLMs entirely from the prediction path. Use deterministic XGBoost/LightGBM for predictions and SHAP feature importance vectors for explanations.

### 4. Over-Complicating with Deep Learning (LSTM/Transformer)
- **Risk**: Implementing heavy PyTorch/TensorFlow sequence models without sufficient historical training data, causing high latency and overfitting.
- **Warning Sign**: Slow inference times (> 2 seconds per event), high GPU overhead, poor generalization.
- **Mitigation**: Mandate tabular gradient boosted trees (XGBoost/LightGBM) as the initial P0 ML engine. Only consider deep learning if empirical evaluation proves statistically significant gain over GBDT.

### 5. Frontend/Backend Contract Drift
- **Risk**: UI component assumptions drifting from FastAPI Pydantic schema or Supabase table definitions.
- **Warning Sign**: `undefined` fields in React components, broken real-time WebSocket payloads.
- **Mitigation**: Maintain a single source of truth using OpenAPI TypeScript generator or shared Pydantic data contracts.
