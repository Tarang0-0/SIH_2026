# RailPulse 🚂
### Dynamic Train ETA Prediction & Network Cascading Delay Propagation Engine
**Smart India Hackathon 2026** | Ministry of Railways / CRIS  
**Theme:** Smart Automation, Transportation & Logistics  

---

## 🌟 Executive Overview
**RailPulse** replaces static, schedule-based timetable estimates with a Machine Learning telemetry engine for the Indian Railways. It captures provider-backed feedback for a gated, auditable retraining loop.

Unlike conventional railway tracking apps that merely carry forward current delays, RailPulse predicts downstream ETA intervals from historical delay patterns, timetable structure, and live signals available from configured providers. Network occupancy and dispatch causality remain explicitly data-gated.

Live weather is provided by OpenWeather when `OPENWEATHER_API_KEY` is set on
the backend. It is stored as an external, explicitly tagged feature for Phase
4 evaluation; current ETA serving does not claim weather improves accuracy
until a labelled chronological retraining run proves it.

---

## 🚀 Key Technical Differentiators

1. **Strict Temporal Integrity (Zero Data Leakage):**
   - Verified chronological train/val/test splits (Months 1–4 Train, Month 5 Validation, Month 6 Test) with 15 fully held-out unseen trains.
   - Historical delay momentum computed exclusively using `.expanding().mean().shift(1)` to strictly forbid future data leakage.

2. **Quantile Uncertainty & Monotonic Guard:**
   - Multi-quantile regression models estimate **P10 (optimistic)**, **P50 (median)**, and **P90 (conservative)** destination delay.
   - P10/P90 are clamped around the independently learned P50, so interval crossing is fixed without silently changing the median estimate.

3. **Explainable AI (SHAP Waterfall Attribution):**
   - Natural language root-cause explainability powered by TreeExplainer SHAP contributions, turning opaque model weights into actionable explanations for passengers (e.g., *"Delayed by 24m — primary factor: heavy freight precedence on Mathura chord"*).

4. **Auditable Learning Loop:**
   - Provider observations, forecasts, and confirmed station events are stored for chronological dataset export, evaluation, and gated model promotion. Predictions are never used as labels.

5. **Decoupled 2-Tier Architecture:**
   - **FastAPI Engine (`api/`):** In-memory model caching, OpenAPI 3.0 documentation, and Server-Sent Events (SSE) RTIS GPS streaming.
   - **Next.js Frontend (`frontend/`):** Minimalist Dark-Slate Bento Grid telemetry dashboard, full-screen interactive rail map, and passenger search interface.

---

## 📂 Project Architecture

```text
SIH_202/
├── api/                         # Production FastAPI Service (Port 8000)
│   ├── main.py                  # Lean application orchestrator & CORS setup
│   ├── schemas.py               # Pydantic request/response validation contracts
│   └── routers/                 # Modular API endpoints
│       ├── eta.py               # Core ML ETA prediction & cascading stops
│       ├── telemetry.py         # Live RTIS GPS Server-Sent Events (SSE) stream
│       ├── alerts.py            # Proactive arrival & delay change notification engine
│       ├── amenities.py         # Station waiting lounges, sleeping pods & cloakrooms
│       └── control_room.py      # Live downstream exposure and cascade-risk contracts
├── frontend/                    # Modern Next.js React Web Application (Port 3000)
│   └── src/app/
│       ├── page.tsx             # Passenger Landing Page & Train Search
│       ├── dashboard/page.tsx   # Minimalist Bento Grid Telemetry Dashboard
│       └── map/page.tsx         # Date-preserving live corridor redirect
├── models/                      # Serialized ML Models
│   ├── eta_regressor.pkl        # Main XGBoost P50 ETA Regressor
│   ├── eta_quantile_p10.pkl     # P10 Optimistic Quantile Regressor
│   └── eta_quantile_p90.pkl     # P90 Conservative Quantile Regressor
├── scripts/                     # Rigorous End-to-End ML Pipeline (Phases 1-4)
│   ├── 01_build_dataset.py      # Raw schedule ingestion & synthetic noise model
│   ├── 02_feature_engineering.py# Autoregressive lag features & safe windowing
│   ├── 03_split_data.py         # Chronological train/val/test data splits
│   ├── 04a_baseline_model.py    # Naive carry-forward baseline benchmarks
│   ├── 04b_train_eta_model.py   # Main XGBoost regressor with early stopping
│   ├── 04c_train_confidence.py  # Quantile pinball loss training
│   ├── 04e_ablation_study.py    # Feature group dependency audit & SHAP breakdown
│   ├── 05_simulate_feedback.py  # Continuous learning retraining simulation
│   └── 06_quantile_diag.py      # Quantile crossing audit & sorting fix
├── tests/                       # Automated Test Suite
│   └── test_api_phase4.py       # Automated unit tests for API endpoints
├── reports/                     # Visualizations & Presentation Slides
│   └── retraining_improvement.png # Continuous learning MAE improvement chart
├── run_demo.sh                  # Single-command unified launcher
└── how_to_run.txt               # Step-by-step setup and execution guide
```

---

## 👥 Team setup

This is a single GitHub repository for the backend, frontend, models, tests,
and documentation. The recommended team workflow is:

1. Clone the repository and create a local branch for each change.
2. Copy `.env.example` to `.env`; keep provider credentials local.
3. Install the backend and frontend dependencies described below.
4. Run the tests and frontend build before opening a pull request.
5. Merge reviewed pull requests into `main` after the GitHub Actions checks
   pass.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the exact clone, setup, branch,
testing, and pull-request commands. GitHub branch protection for `main` is
recommended so teammates do not overwrite each other's work.

## ⚡ Quick Start: Running the Demo

### One-time setup

```bash
python3 -m venv .venv
source .venv/bin/activate          # Windows PowerShell: .venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r ml/requirements.txt

cp .env.example .env
cd frontend
npm ci
cp .env.example .env.local
cd ..
```

The checked-in model artifacts and timetable index are enough for the offline
demo. Live provider keys are optional; without them, live provider-backed
fields are reported as unavailable.

### Windows quick start

Install Git for Windows, Python 3.9+, and Node.js 20 LTS, then run these
commands in PowerShell:

```powershell
git clone https://github.com/Tarang0-0/SIH_2026.git
cd SIH_202
powershell -ExecutionPolicy Bypass -File .\scripts\setup_windows.ps1
powershell -ExecutionPolicy Bypass -File .\run_demo.ps1
```

See [WINDOWS_SETUP.md](WINDOWS_SETUP.md) for troubleshooting and test
commands.

### Option 1: Single-Command Launch (Recommended)
```bash
./run_demo.sh
```

On Windows, use `powershell -ExecutionPolicy Bypass -File .\run_demo.ps1`.

### Option 2: Manual Launch
1. **Start the FastAPI Engine (Port 8000):**
   ```bash
   .venv/bin/uvicorn api.main:app --reload --host 0.0.0.0 --port 8000
   ```
2. **Start the Next.js Frontend (Port 3000):**
   ```bash
   cd frontend && npm run dev
   ```

---

## 🧪 Automated Testing
Run the Phase 4 unit test suite:
```bash
source .venv/bin/activate
python -m unittest discover -s tests -p 'test_*.py'
```

## Model training and limits

Retrain the deployable ETA artifacts and write reproducible held-out metrics:

```bash
.venv/bin/python scripts/12_train_ir_production.py
```

The API prefers RailRadar for live station/delay status when `RAILRADAR_API_KEY`
is configured, with IndianRailAPI retained as a fallback. See [the validation
report](reports/model_validation.md) for the actual test results, leakage
safeguards, and data limitations.

Phase 2 station-level learning is now wired into the live feedback path. When
the live provider is configured, live ETA requests refresh official route data,
persist normalized station events, and keep cancellation and rescheduling
signals. Export verified labels with
`.venv/bin/python scripts/build_station_level_dataset.py`; the separate
next-station trainer will refuse to train until enough provider-actual arrivals
have been collected.

For bounded live collection, run
`.venv/bin/python scripts/15_collect_live_feedback.py --trains 22436,22439
--interval 300 --duration 3600`.

Phase 3 adds movement snapshots and separate next-station travel-time and
delay-propagation quantile models. Run
`.venv/bin/python scripts/build_phase3_movement_dataset.py` followed by
`.venv/bin/python scripts/14_train_phase3_movement_models.py` after enough
live journeys have completed. The API uses those artifacts only after their
feature contract is validated.

Add your own provider credential to `.env` before starting the backend:

```bash
INDIAN_RAIL_API_KEY=your_indianrailapi_key
```

The key is read only by the backend. Do not commit it or expose it through
`NEXT_PUBLIC_*` variables.

An authorised network-signal provider can be connected with
`RAIL_NETWORK_SIGNALS_URL`, `RAIL_NETWORK_SIGNALS_PROVIDER`, and
`RAIL_NETWORK_SIGNALS_TOKEN`. Without that provider, occupancy, signal,
maintenance, restriction, and preceding-train fields remain unavailable and
are reported as unavailable rather than inferred.

## Live data and map integrity

The dashboard no longer interpolates unknown station coordinates, guesses a
platform, or animates a synthetic train. It plots only known station coordinates
in the timetable order, and creates the train marker only after receiving an
authorised live coordinate. Configure an approved Railway/CRIS status provider
to enable actual speed and location; the full contract is in
[data/README.md](data/README.md).

---

*Built with precision for Smart India Hackathon 2026.*
