# RailETA — REST & WebSocket API Specification
**Document ID:** `docs/API.md`  
**Problem Statement:** SIH 2026 — PS 26028  
**Base URL:** `http://127.0.0.1:8000/api/v1`  
**WebSocket URL:** `ws://127.0.0.1:8000/ws`  

---

## 1. REST Endpoints

### 1.1 Health & Status
- **`GET /health`** / **`GET /api/v1/health`**
  - Returns service status, ML model loaded state, database connectivity status, and data source mode.

### 1.2 Train Fleet & Route Information
- **`GET /api/v1/trains`**
  - Returns list of active trains (`journey_id`, `train_number`, `train_name`, `origin`, `destination`, `current_station`, `delay_minutes`, `speed_kmph`, `data_source`).
- **`GET /api/v1/trains/{train_number}/route`**
  - Returns ordered station topology for the route with distances and timetable schedules.
- **`GET /api/v1/trains/search?q={query}`**
  - Autocomplete search by train number, train name, or station code.

### 1.3 Dynamic ETA Forecast
- **`GET /api/v1/trains/{train_number}/eta`**
  - Computes and returns cascading GBDT predictions for all upcoming stations, static baseline comparisons, uncertainty bounds, and SHAP explainability.

### 1.4 Real-Time Event Ingestion
- **`POST /api/v1/running-updates`**
  - Ingests a canonical telemetry event (`timestamp`, `latitude`, `longitude`, `speed_kmph`, `delay_minutes`, `current_station`, `next_station`), updates journey state, recalculates ETA, and broadcasts to WebSocket clients.

### 1.5 What-If Disruption Simulation
- **`POST /api/v1/simulate/disruption`**
  - Injects simulated operational disruption (`additional_delay_minutes`, `section_from`, `section_to`, `disruption_type`), updates journey state, recalculates cascading forecast, and broadcasts live update.

---

## 2. WebSocket Channels

- **`ws://127.0.0.1:8000/ws/trains/{journey_id}`**
  - Connects to single journey stream. On connection, immediately delivers current journey state and ETA forecast. Receives live updates whenever new events arrive.
- **`ws://127.0.0.1:8000/ws/live-stream`**
  - Global fleet stream receiving all broadcast updates across the network.
