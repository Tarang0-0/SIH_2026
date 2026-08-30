@echo off
setlocal
echo =================================================================
echo   Starting RailETA Dynamic ETA Forecasting Engine (SIH 2026)
echo =================================================================

:: Switch to the directory containing this script
cd /d "%~dp0"

echo [1/4] Checking Python Virtual Environment...
if not exist "backend\venv" (
    echo Creating Python virtual environment...
    python -m venv backend\venv
    call backend\venv\Scripts\activate.bat
    pip install -r backend\requirements.txt
) else (
    call backend\venv\Scripts\activate.bat
)

echo [2/4] Checking Node Modules...
if not exist "frontend\node_modules" (
    echo Installing frontend npm packages...
    cd frontend
    call npm install
    cd ..
)

echo [3/4] Launching FastAPI Backend on port 8000...
start "RailETA FastAPI Backend" cmd /k "call backend\venv\Scripts\activate.bat && set PYTHONPATH=%cd%\backend && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

:: Wait for a few seconds to let backend start up
timeout /t 3 /nobreak >nul

echo [4/4] Launching Next.js Frontend on port 3000...
start "RailETA Next.js Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo =================================================================
echo  RailETA System is LIVE!
echo  Frontend Dashboard : http://localhost:3000
echo  Backend API Docs   : http://127.0.0.1:8000/docs
echo  Health Endpoint    : http://127.0.0.1:8000/api/v1/health
echo =================================================================
echo.
echo To stop the servers, close the two command windows that just opened.
pause
