#!/usr/bin/env bash

# ==============================================================================
# 🚂 RailPulse - Single Command Unified Demo Launcher
# Smart India Hackathon 2026
# ==============================================================================

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -x "$PROJECT_ROOT/.venv/bin/python" ]; then
  PYTHON_EXEC="$PROJECT_ROOT/.venv/bin/python"
  UVICORN_EXEC="$PROJECT_ROOT/.venv/bin/uvicorn"
elif [ -x "$PROJECT_ROOT/ml/venv/bin/python" ]; then
  # Backward-compatible fallback for existing local installations.
  PYTHON_EXEC="$PROJECT_ROOT/ml/venv/bin/python"
  UVICORN_EXEC="$PROJECT_ROOT/ml/venv/bin/uvicorn"
else
  echo "Python environment not found. Create it with:" >&2
  echo "  python3 -m venv .venv && .venv/bin/python -m pip install -r ml/requirements.txt" >&2
  exit 1
fi

echo "========================================================"
echo "  🚂 STARTING RAILPULSE AI OPERATIONS & TELEMETRY ENGINE  "
echo "========================================================"

# Cleanup handler on exit (Ctrl+C)
cleanup() {
    echo ""
    echo "🛑 Shutting down RailPulse services..."
    kill $(jobs -p) 2>/dev/null || true
    echo "✅ All services stopped safely."
    exit 0
}
trap cleanup SIGINT SIGTERM EXIT

# 1. Run quick diagnostic unit tests
echo "🔍 [1/3] Running Phase 4 Automated Unit Tests..."
"$PYTHON_EXEC" -m unittest tests/test_api_phase4.py

# 2. Launch FastAPI Backend Service
echo ""
echo "🚀 [2/3] Launching FastAPI Engine on http://localhost:8000..."
"$UVICORN_EXEC" api.main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

# Wait for backend to warm up
sleep 2

# 3. Launch Next.js Frontend
echo ""
echo "💻 [3/3] Launching Next.js Frontend on http://localhost:3000..."
cd "$PROJECT_ROOT/frontend"
npm run dev -- -p 3000 &
FRONTEND_PID=$!

echo ""
echo "========================================================"
echo "  🌟 RAILPULSE IS READY FOR PRESENTATION & DEMO!"
echo "========================================================"
echo "  • Passenger Web App:     http://localhost:3000"
echo "  • Telemetry Dashboard:   http://localhost:3000/dashboard"
echo "  • Fullscreen Live Map:   http://localhost:3000/map"
echo "  • Interactive API Docs:  http://localhost:8000/docs"
echo "  • SSE Live Stream:        http://localhost:8000/api/v1/trains/{train_number}/live-stream"
echo "========================================================"
echo "Press [CTRL+C] to stop all services."

# Keep alive
wait
