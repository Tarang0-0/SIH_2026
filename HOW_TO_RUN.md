# RailETA — How to Run & Verify

**Smart India Hackathon 2026 — Problem Statement 26028**  
*Dynamic Forecast of Expected Time of Arrival (ETA) for Indian Railways Coaching Trains*

---

## 🚀 1. Quick Start (Single Command)

To start both the FastAPI backend and Next.js frontend with one command:

### 🍎 Mac / Linux Users
```bash
./start.sh
```

### 🪟 Windows Users
Double-click `start.bat` in the project folder, or run in Command Prompt:
```cmd
start.bat
```

The script will automatically:
1. Create the Python virtualenv and install dependencies if missing.
2. Install frontend `npm` modules if missing.
3. Launch the **FastAPI Backend** on `http://127.0.0.1:8000`.
4. Launch the **Next.js Frontend** on `http://localhost:3000`.

---

## 🛠️ 2. Manual Step-by-Step Startup

If you prefer running the servers in separate terminal tabs manually:

### Terminal 1: FastAPI Backend

**Mac/Linux:**
```bash
source backend/venv/bin/activate
export PYTHONPATH=backend
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

**Windows (Command Prompt / PowerShell):**
```cmd
backend\venv\Scripts\activate
set PYTHONPATH=backend
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

*Endpoints:*
- **Interactive OpenAPI Documentation**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **Service Health**: [http://127.0.0.1:8000/api/v1/health](http://127.0.0.1:8000/api/v1/health)

---

### Terminal 2: Next.js Frontend

**All Platforms:**
```bash
cd frontend
npm run dev
```

*Dashboard:*
- **Web Application**: [http://localhost:3000](http://localhost:3000)

---

## 🧪 3. Automated Verification & Testing

### Run Backend Pytest Suite
**Mac/Linux:**
```bash
PYTHONPATH=backend backend/venv/bin/pytest
```
**Windows:**
```cmd
set PYTHONPATH=backend
backend\venv\Scripts\pytest
```

### Run SIH 5-Stage Live Demonstration Runner
**Mac/Linux:**
```bash
PYTHONPATH=backend backend/venv/bin/python scripts/sih_demo_runner.py
```
**Windows:**
```cmd
set PYTHONPATH=backend
backend\venv\Scripts\python scripts\sih_demo_runner.py
```

### Verify Production Frontend Build
```bash
cd frontend
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

**Mac/Linux:**
```bash
lsof -ti :8000 | xargs kill -9 2>/dev/null || true
lsof -ti :3000 | xargs kill -9 2>/dev/null || true
```

**Windows:**
```cmd
FOR /F "tokens=5" %T IN ('netstat -a -n -o ^| findstr :8000') DO TaskKill.exe /PID %T /F
FOR /F "tokens=5" %T IN ('netstat -a -n -o ^| findstr :3000') DO TaskKill.exe /PID %T /F
```

Admin credentials for the Controller Session:
- **Username**: `admin`
- **Password**: `admin2026`
