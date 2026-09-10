#!/usr/bin/env bash

# ==============================================================================
# 🚂 Namaste Rail - Single Command Unified Demo Launcher
# Smart India Hackathon 2026
# ==============================================================================

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_ROOT="$PROJECT_ROOT/frontend"
export PYTHONPATH="$PROJECT_ROOT:${PYTHONPATH:-}"

# Locate Python Virtual Environment
PYTHON_EXEC=""
if [ -x "$PROJECT_ROOT/.venv/bin/python" ]; then
  PYTHON_EXEC="$PROJECT_ROOT/.venv/bin/python"
elif [ -x "$PROJECT_ROOT/venv/bin/python" ]; then
  PYTHON_EXEC="$PROJECT_ROOT/venv/bin/python"
elif [ -x "$PROJECT_ROOT/ml/venv/bin/python" ]; then
  PYTHON_EXEC="$PROJECT_ROOT/ml/venv/bin/python"
elif command -v python3 >/dev/null 2>&1; then
  PYTHON_EXEC="$(command -v python3)"
else
  echo "❌ Error: Python environment not found." >&2
  echo "   Create it with: python3 -m venv .venv && .venv/bin/python -m pip install -r ml/requirements.txt" >&2
  exit 1
fi

echo "========================================================"
echo "  🚂 STARTING NAMASTE RAIL AI OPERATIONS & TELEMETRY ENGINE  "
echo "========================================================"

# Helper to cleanly reclaim a port if occupied by a stale/zombie process
free_port() {
  local port=$1
  local pids
  pids=$(lsof -ti :"$port" 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo "⚠️  Port $port is currently in use by PID(s): $pids. Reclaiming port..."
    for pid in $pids; do
      kill -TERM "$pid" 2>/dev/null || true
    done
    sleep 1
    # Force kill if still occupied
    pids=$(lsof -ti :"$port" 2>/dev/null || true)
    if [ -n "$pids" ]; then
      for pid in $pids; do
        kill -9 "$pid" 2>/dev/null || true
      done
      sleep 0.5
    fi
    echo "   ✅ Port $port cleared."
  fi
}

# Pre-flight port cleanup
echo "🧹 Checking and freeing ports 8000 & 3000..."
free_port 8000
free_port 3000

BACKEND_PID=""
FRONTEND_PID=""

# Cleanup handler on exit (Ctrl+C or kill signal)
cleanup() {
  echo ""
  echo "🛑 Shutting down Namaste Rail services..."

  if [ -n "$BACKEND_PID" ] && kill -0 "$BACKEND_PID" 2>/dev/null; then
    kill -TERM "$BACKEND_PID" 2>/dev/null || true
  fi

  if [ -n "$FRONTEND_PID" ] && kill -0 "$FRONTEND_PID" 2>/dev/null; then
    pkill -P "$FRONTEND_PID" 2>/dev/null || true
    kill -TERM "$FRONTEND_PID" 2>/dev/null || true
  fi

  kill $(jobs -p) 2>/dev/null || true

  # Ensure no orphan processes linger on ports 8000 & 3000
  free_port 8000
  free_port 3000

  echo "✅ All services stopped safely."
  exit 0
}

trap cleanup SIGINT SIGTERM

# 1. Run quick diagnostic unit tests
echo ""
echo "🔍 [1/3] Running Phase 4 Automated Unit Tests..."
"$PYTHON_EXEC" -m unittest tests/test_api_phase4.py
echo "   ✅ Unit tests passed successfully."

# 2. Launch FastAPI Backend Service
echo ""
echo "🚀 [2/3] Launching FastAPI Engine on http://localhost:8000..."
cd "$PROJECT_ROOT"
"$PYTHON_EXEC" -m uvicorn api.main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

echo "   ⏳ Verifying backend health on http://127.0.0.1:8000/health..."
BACKEND_READY=false
for i in $(seq 1 30); do
  if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
    echo "❌ Error: FastAPI Backend died unexpectedly during startup." >&2
    exit 1
  fi
  if "$PYTHON_EXEC" -c "import urllib.request, sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=1).status == 200 else 1)" 2>/dev/null; then
    BACKEND_READY=true
    break
  fi
  sleep 1
done

if [ "$BACKEND_READY" = true ]; then
  echo "   ✅ FastAPI Engine is online and ready on port 8000."
else
  echo "   ⚠️ FastAPI took longer than expected to report healthy, continuing..."
fi

# 3. Launch Next.js Frontend
echo ""
echo "💻 [3/3] Launching Next.js Frontend on http://localhost:3000..."
cd "$FRONTEND_ROOT"

if [ ! -d "$FRONTEND_ROOT/node_modules" ]; then
  echo "   📦 Installing frontend dependencies..."
  npm install
fi

npm run dev -- -p 3000 &
FRONTEND_PID=$!

echo "   ⏳ Waiting for Next.js to start on http://localhost:3000..."
FRONTEND_READY=false
for i in $(seq 1 30); do
  if ! kill -0 "$FRONTEND_PID" 2>/dev/null; then
    echo "❌ Error: Next.js frontend died unexpectedly during startup." >&2
    exit 1
  fi
  if "$PYTHON_EXEC" -c "import urllib.request, sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:3000', timeout=1).status in (200, 304, 307, 308) else 1)" 2>/dev/null; then
    FRONTEND_READY=true
    break
  fi
  sleep 1
done

if [ "$FRONTEND_READY" = true ]; then
  echo "   ✅ Next.js Frontend is online on port 3000."
fi

echo ""
echo "========================================================"
echo "  🌟 NAMASTE RAIL IS READY FOR PRESENTATION & DEMO!"
echo "========================================================"
echo "  • Passenger Web App:     http://localhost:3000"
echo "  • Telemetry Dashboard:   http://localhost:3000/dashboard"
echo "  • Fullscreen Live Map:   http://localhost:3000/map"
echo "  • Interactive API Docs:  http://localhost:8000/docs"
echo "  • Health Diagnostics:   http://localhost:8000/health"
echo "  • SSE Live Stream:       http://localhost:8000/api/v1/trains/{train_number}/live-stream"
echo "========================================================"
echo "Press [CTRL+C] to stop all services."

# Automatically launch browser if available
if command -v open >/dev/null 2>&1; then
  open "http://localhost:3000" 2>/dev/null || true
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open "http://localhost:3000" 2>/dev/null || true
fi

# Active process supervisor
while true; do
  if [ -n "$BACKEND_PID" ] && ! kill -0 "$BACKEND_PID" 2>/dev/null; then
    echo "❌ Backend process stopped."
    cleanup
  fi
  if [ -n "$FRONTEND_PID" ] && ! kill -0 "$FRONTEND_PID" 2>/dev/null; then
    echo "❌ Frontend process stopped."
    cleanup
  fi
  sleep 2
done

