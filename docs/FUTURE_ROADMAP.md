# RailETA — Future Capabilities & Extensible Roadmap
**Document ID:** `docs/FUTURE_ROADMAP.md`  
**Problem Statement:** SIH 2026 — PS 26028  

---

## 1. Modular Architecture Principles

To ensure RailETA is future-ready without incurring scope creep during MVP delivery, all future capabilities are decoupled via feature flags and modular service interfaces:

```python
# Environment Feature Flags (app/core/config.py)
ENABLE_WEATHER_INTELLIGENCE: bool = False
ENABLE_DELAY_RISK_CLASSIFIER: bool = False
ENABLE_DELAY_PROPAGATION_GRAPH: bool = False
ENABLE_PASSENGER_PUSH_ALERTS: bool = False
ENABLE_STATION_PLATFORM_PLANNER: bool = False
ENABLE_LLM_OPERATIONS_ASSISTANT: bool = False
ENABLE_VOICE_QUERY_INTERFACE: bool = False
```

---

## 2. Documented Future Feature Backlog

### Feature A: Probabilistic Delay Risk Classifier
- *Objective:* Predict the probability ($0-100\%$) that a train currently running on time will encounter $> 15$ min delay in upcoming bottleneck sections.
- *Method:* Binary classification model (LightGBM Classifier) trained on historical section congestion factors.

### Feature B: Downstream Delay Propagation Graph
- *Objective:* Model cross-train interference (e.g. freight train precedence or single-line crossing hold) using a directed section occupancy graph.

### Feature C: Hyper-Local Weather Intelligence
- *Objective:* Integrate IMD / OpenWeatherMap precipitation, winter fog visibility (< 500m), and high-temperature track speed restriction flags into the feature extractor.

### Feature D: Real-Time Passenger Push Notifications & WhatsApp Alerts
- *Objective:* WebPush and WhatsApp API integration sending proactive alerts when predicted arrival changes by $> 10$ minutes.

### Feature E: Station Master Platform & Conflict Resolution Planner
- *Objective:* Recommend optimal platform assignments and loop line dispatch schedules based on dynamic multi-train arrival forecasts.

### Feature F: Natural Language Operations Assistant
- *Objective:* Structured SQL/RAG LLM agent over Supabase operational logs allowing controllers to query: *"Which Rajdhani trains on the Delhi-Howrah route have lost more than 10 minutes today?"*

### Feature G: Multilingual Voice Query Interface
- *Objective:* Speech-to-text passenger interface in Hindi, English, and regional Indian languages: *"गाड़ी संख्या 12004 कानपुर कब पहुंचेगी?"*
