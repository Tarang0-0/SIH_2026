#!/bin/bash
# RailETA — Automated System Launcher (SIH 2026 Problem 26028)
# Starts FastAPI Backend on Port 8000 and Next.js Frontend on Port 3000

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

echo "================================================================="
echo "🚆 Starting RailETA Dynamic ETA Forecasting Engine (SIH 2026)"
echo "================================================================="

# 1. Check Python Virtualenv
if [ ! -d "backend/venv" ]; then
    echo "Creating Python virtualenv..."
    python3 -m venv backend/venv
    source backend/venv/bin/activate
    pip install -r backend/requirements.txt
else
    source backend/venv/bin/activate
fi

# 2. Check Node Modules
if [ ! -d "frontend/node_modules" ]; then
    echo "Installing frontend npm packages..."
    cd frontend && npm install && cd ..
fi

# 3. Kill any old dangling processes on 8000 and 3000
echo "Checking and freeing ports 8000 and 3000..."
lsof -ti :8000 | xargs kill -9 2>/dev/null || true
lsof -ti :3000 | xargs kill -9 2>/dev/null || true

# 4. Launch FastAPI Backend
echo "Starting FastAPI backend on http://127.0.0.1:8000..."
export PYTHONPATH=backend
backend/venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

sleep 2

# 5. Launch Next.js Frontend
echo "Starting Next.js frontend on http://localhost:3000..."
cd frontend
npm run dev &
FRONTEND_PID=$!

echo ""
echo "================================================================="
echo "✅ RailETA System is LIVE!"
echo "🌐 Frontend Dashboard : http://localhost:3000"
echo "📖 Backend API Docs   : http://127.0.0.1:8000/docs"
echo "🩺 Health Endpoint    : http://127.0.0.1:8000/api/v1/health"
echo "================================================================="
echo "Press CTRL+C to stop all servers."

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true; exit 0" SIGINT SIGTERM EXIT

wait
