# RailETA — How to Run & Verify

**Smart India Hackathon 2026 — Problem Statement 26028**  
*Dynamic Forecast of Expected Time of Arrival (ETA) for Indian Railways Coaching Trains*

---

## 🚀 1. Quick Start (Single Command)

To start both the FastAPI backend and Next.js frontend with one command:

```bash
cd /Users/tarang/Desktop/HACKATHON/SIH_2026
./start.sh
```

This script will:
1. Activate the Python virtualenv and install dependencies if missing.
2. Ensure frontend npm modules are installed.
3. Automatically free ports `8000` and `3000`.
4. Launch the **FastAPI Backend** on `http://127.0.0.1:8000`.
5. Launch the **Next.js Frontend** on `http://localhost:3000`.

---

## 🛠️ 2. Manual Step-by-Step Startup

If you prefer running the servers in separate terminal tabs:

### Terminal 1: FastAPI Backend
```bash
cd /Users/tarang/Desktop/HACKATHON/SIH_2026
source backend/venv/bin/activate
export PYTHONPATH=backend
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

*Endpoints:*
- **Interactive OpenAPI Documentation**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **Service Health**: [http://127.0.0.1:8000/api/v1/health](http://127.0.0.1:8000/api/v1/health)
- **Active Trains List**: [http://127.0.0.1:8000/api/v1/trains](http://127.0.0.1:8000/api/v1/trains)

---

### Terminal 2: Next.js Frontend
```bash
cd /Users/tarang/Desktop/HACKATHON/SIH_2026/frontend
npm run dev
```

*Dashboard:*
- **Web Application**: [http://localhost:3000](http://localhost:3000)

---

## 🧪 3. Automated Verification & Testing

### Run Backend Pytest Suite (53 / 53 Tests)
```bash
cd /Users/tarang/Desktop/HACKATHON/SIH_2026
PYTHONPATH=backend backend/venv/bin/pytest
```

### Run SIH 5-Stage Live Demonstration Runner
```bash
cd /Users/tarang/Desktop/HACKATHON/SIH_2026
PYTHONPATH=backend backend/venv/bin/python scripts/sih_demo_runner.py
```

### Verify Production Frontend Build
```bash
cd /Users/tarang/Desktop/HACKATHON/SIH_2026/frontend
npm run build
```

---

## 🔑 4. Environment Variables & Real APIs

All verified API keys are pre-configured in `.env`, `backend/.env`, and `frontend/.env.local`:

| Variable | API Service | Purpose |
|---|---|---|
| `RAILRADAR_API_KEY` | **RailRadar** | Live train running states, timetable catalog & routes |
| `MAPTILER_API_KEY` | **MapTiler** | 3D vector map tiles (`streets-v2` & `streets-v2-dark`) |
| `OPENWEATHER_API_KEY` | **OpenWeather** | Live atmospheric visibility, rainfall & loco pilot caution rules |
| `OPENTOPOGRAPHY_API_KEY` | **OpenTopography** | SRTM Global DEM terrain elevation curve & track gradients |
| Public Endpoint | **Overpass API (OSM)** | Live scenic rivers (Yamuna, Ganga, Narmada), ghats & monuments |

---

## 🔧 5. Troubleshooting & Port Cleanup

If port `8000` or `3000` is already in use by another process:

```bash
# Free ports 8000 and 3000
lsof -ti :8000 | xargs kill -9 2>/dev/null || true
lsof -ti :3000 | xargs kill -9 2>/dev/null || true
```

Admin credentials for the Controller Session:
- **Username**: `admin`
- **Password**: `admin2026`
