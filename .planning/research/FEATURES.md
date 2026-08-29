# Feature Research — RailETA

## Feature Breakdown by Priority

### Table Stakes (P0 — Mandatory for MVP)

1. **Train Discovery & Search**: Search coaching trains by train number (e.g., 12951, 12002) or name, with station auto-complete.
2. **Train Running State Ingestion**: Ingest position updates (lat/long, current station, current speed, accumulated delay).
3. **Baseline ETA Calculation**: Standard calculation (`Scheduled Arrival + Current Delay`) serving as benchmark.
4. **Sectional ML ETA Forecasting**: Dynamic prediction of sectional arrival/departure times at intermediate stations and final destination.
5. **Interactive Fleet & Route Dashboard**: Map display using MapLibre GL JS showing train position along route nodes.
6. **Confidence / Uncertainty Range Display**: Show expected arrival bounds (e.g., `18:41 (Range: 18:35 – 18:48)`).
7. **Explainability Breakdown**: Feature impact breakdown showing why ETA drifted (e.g., `Section slowdown: +3m, Recovery: -1m`).
8. **Deterministic Replay / Simulation Mode**: Ability to replay event streams and inject disruptions (e.g., 10-minute halt) to trigger dynamic recalculations.

### Differentiators (P1 — Strong Enhancements)

1. **Weather Enrichment**: Ingestion of weather parameters (rainfall, visibility, temperature) for section risk adjustment.
2. **What-If Disruption Simulator**: Interactive control allowing users to inject custom delay events and observe downstream ETA adjustments across stations.
3. **Prediction Audit History**: Historical log showing how ETA predictions for a specific train/station evolved over elapsed journey time.
4. **Operations Analytics View**: Sectional delay statistics, recovery rates, and baseline vs. ML performance comparative charts.

### Anti-Features (Deliberately Excluded / Out of Scope)

1. **LLM/RAG Numerical Prediction**: Using generative AI/LLMs to invent arrival times (risks severe hallucinations and lack of statistical grounding).
2. **Voice Interface in Core Gate**: Blocking P0 completion for voice commands.
3. **Freight Train Forecasting**: Scoped strictly to Indian Railways coaching trains per SIH 26028.
4. **Live Signal/Interlocking Network Integration**: Unvalidated live APIs; synthetic/replay data feeds used instead.

## Complexity & Risk Mapping

| Feature | Complexity | Key Risk | Mitigation |
|---------|------------|----------|------------|
| Sectional ML Model | High | Data leakage, overfitting on static timetables | Strict temporal split, section-level target formulation |
| Dynamic Update Pipeline | Medium | Out-of-order events, UI stutter | Debounced updates, Supabase Realtime / WebSocket state store |
| What-If Simulator | Medium | Logic drift between simulation & inference | Call identical FastAPI prediction engine endpoint |
