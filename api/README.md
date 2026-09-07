# RailPulse ETA API

This directory contains the FastAPI service that serves the Machine Learning ETA models for the RailPulse platform.

## Features
- **FastAPI Framework:** High performance and automatic OpenAPI documentation.
- **In-Memory Model Caching:** XGBoost, Quantile Models, and SHAP Explainers are loaded exactly once during server startup using the `@app.on_event("startup")` hook to ensure lightning-fast prediction times per request.
- **Quantile Crossing Fix:** Clamps P10/P90 around the independently predicted P50 on every request.
- **Dynamic SHAP Explanations:** Explanations dynamically generated per-request based on the specific feature values passed.

## Requirements
Ensure you have the virtual environment activated and the required dependencies installed:
```bash
pip install fastapi uvicorn pandas numpy xgboost joblib scikit-learn shap
```
*(Make sure the trained `.pkl` models are properly generated and sit in the `../models/` directory!)*

## Running Locally

To start the development server with live reloading, run:

```bash
uvicorn api.main:app --reload --host 0.0.0.0 --port 8000
```
*(Run this command from the root of the project, NOT inside the `api/` folder)*

Once running, you can view the automatic interactive API documentation at:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

---

## Example `curl` Tests

Once the server is running, you can open a new terminal and test these real-world scenarios:

### 1. Health Check
```bash
curl -X GET "http://localhost:8000/health"
```

### 2. Predict ETA for a selected train
```bash
curl -X GET "http://localhost:8000/api/v1/trains/${TRAIN_NUMBER}/eta?date=${YYYY_MM_DD}&current_station=${STATION_CODE}&current_delay=${DELAY_MINUTES}"
```

### 3. Use the live provider-backed ETA
```bash
curl "http://localhost:8000/api/v1/trains/${TRAIN_NUMBER}/live-eta?date=${YYYY_MM_DD}"
```

### 4. Query live trains at a station
```bash
curl "http://localhost:8000/api/v1/stations/${STATION_CODE}/live?hours=2"
```

### 5. Query current weather
Set `OPENWEATHER_API_KEY` in the server-side `.env` file. The key is never
sent to the browser. Weather can be queried by coordinates or station code:

```bash
curl "http://localhost:8000/api/v1/weather?latitude=28.64177&longitude=77.22027"
curl "http://localhost:8000/api/v1/stations/NDLS/weather"
```

Live ETA responses include `current_location.weather` when provider-backed
coordinates are available. Each snapshot is stored for later Phase 4 training;
it does not change the deployed ETA model until a weather-labelled,
chronological evaluation passes.

An optional authorised railway network-signal feed can be connected with
`RAIL_NETWORK_SIGNALS_URL`, `RAIL_NETWORK_SIGNALS_PROVIDER`, and
`RAIL_NETWORK_SIGNALS_TOKEN`. Its response must contain timestamped `signals`
with station/block occupancy, signal aspect, maintenance, speed restriction,
and preceding-train fields. If it is not configured, those fields remain
explicitly unavailable.

Phase 5 controls are available offline:

```bash
./ml/venv/bin/python scripts/16_calibrate_model.py
./ml/venv/bin/python scripts/17_phase5_audit.py
./ml/venv/bin/python scripts/18_promote_model.py candidate.json
```

Promotion refuses candidates without an untouched holdout, enough verified
labels, better median error, and the requested interval coverage.

---

## Phase 4: Bonus Features Endpoints

### 6. Live status, model ETA, and live-station feed
Set `RAILRADAR_API_KEY` in the backend environment. The adapter prefers
RailRadar's live train endpoint for current station, delay, coordinates, speed,
next halt, and route events. The key is sent only as an Authorization Bearer
header and is never returned by the backend. IndianRailAPI remains available
as a fallback through `INDIAN_RAIL_API_KEY`.

```bash
curl "http://localhost:8000/api/v1/trains/${TRAIN_NUMBER}/live-eta?date=${YYYY_MM_DD}"
curl "http://localhost:8000/api/v1/stations/${STATION_CODE}/live?hours=2"
```

The Server-Sent Events stream includes the same live observation and the model forecast. Pass
the same journey date selected in the dashboard when reviewing a specific run:

```bash
curl -N "http://localhost:8000/api/v1/trains/${TRAIN_NUMBER}/live-stream?date=${YYYY_MM_DD}"
```

### Phase 2: station-level learning

When a live provider is configured, live ETA requests also refresh the train
route from its official route data (cached for six hours).
The live-status response is stored in `data/railpulse_feedback.sqlite3`; its
actual station events are exported with:

```bash
./ml/venv/bin/python scripts/build_station_level_dataset.py
./ml/venv/bin/python scripts/sync_indian_rail_operational.py --date YYYY-MM-DD
./ml/venv/bin/python scripts/13_train_next_station_models.py
./ml/venv/bin/python scripts/15_collect_live_feedback.py --trains 22436,22439 --interval 300 --duration 3600
./ml/venv/bin/python scripts/build_phase3_movement_dataset.py
./ml/venv/bin/python scripts/14_train_phase3_movement_models.py
./ml/venv/bin/python scripts/19_run_phase_pipeline.py
```

The Phase 2 trainer will stop instead of training when there are not enough
provider-actual arrival labels. Expected arrival times, predictions, and
request-time-only observations are never used as station-level labels.
The Phase 3 trainer additionally requires a later provider-confirmed arrival
after each live snapshot and evaluates against chronological timetable and
carry-forward baselines before saving its six quantile artifacts.

See [`data/README.md`](../data/README.md) for the provider environment variables and required JSON contract.

### 6. Station amenities
```bash
curl -X GET "http://localhost:8000/api/v1/stations/${STATION_CODE}/amenities"
```

This currently returns `503` until a verified amenity provider is configured;
the API does not return fabricated occupancy or pricing.

### 7. Subscribe to Proactive Arrival & Delay Alerts
```bash
curl -X POST "http://localhost:8000/api/v1/alerts/subscribe" \
     -H "Content-Type: application/json" \
     -d '{
       "train_number": "${TRAIN_NUMBER}",
       "station_code": "${STATION_CODE}",
       "target_arrival_date": "${YYYY_MM_DD}",
       "user_phone": "${E164_PHONE}",
       "alert_window_minutes": 30
     }'
```

### 8. Trigger the alert simulator for a created subscription
```bash
curl -X POST "http://localhost:8000/api/v1/alerts/simulate-trigger/${SUBSCRIPTION_ID}"
```

### 9. Control-room cascade data
```bash
curl -X GET "http://localhost:8000/api/v1/control-room/cascade-risk"
curl "http://localhost:8000/api/v1/control-room/impact/${TRAIN_NUMBER}?date=${YYYY_MM_DD}&lookahead_stations=4"
```

The `impact` endpoint fetches the incident train's verified live status and
live boards for its next downstream stations. It returns potential station-
window exposure records for other trains, including delay and expected arrival
when the provider supplies them. It does not claim track blockage causality
because a network occupancy/dispatch feed is not configured. The aggregate
`cascade-risk` route remains `503` until that feed is available.
