from __future__ import annotations

from contextlib import asynccontextmanager
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import os
import joblib
import datetime
import logging
import subprocess
import sys
from typing import Optional

# Add root directory to python path
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT_DIR not in sys.path:
    sys.path.append(ROOT_DIR)


def _load_local_env() -> None:
    """Load simple KEY=VALUE entries without requiring python-dotenv."""
    env_path = os.path.join(ROOT_DIR, ".env")
    if not os.path.exists(env_path):
        return
    try:
        with open(env_path, encoding="utf-8") as env_file:
            for raw_line in env_file:
                line = raw_line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, value = line.split("=", 1)
                key, value = key.strip(), value.strip().strip("\"'")
                if key and key not in os.environ:
                    os.environ[key] = value
    except OSError:
        logger = logging.getLogger(__name__)
        logger.warning("Unable to read local environment file: %s", env_path)


_load_local_env()

from src.explainability import DelayExplainer
from api.routers import eta as eta_module
from api.routers.eta import router as eta_router, set_models, load_feature_defaults, load_historical_records, load_model_metadata, load_train_index
from api.routers.telemetry import router as telemetry_router
from api.routers.alerts import router as alerts_router
from api.routers.amenities import router as amenities_router
from api.routers.control_room import router as control_room_router
from api.routers.live_station import router as live_station_router
from api.routers.weather import router as weather_router
from api.services.phase3_models import load_phase3_models, phase3_status
from api.services.phase2_models import load_phase2_models, phase2_status
from api.services.phase5_controls import load_phase5_calibration, phase5_status
from api.services.network_signals import network_provider_configured, network_provider_name
from api.services.learning_status import load_learning_status
from api.services.http_client import close_http_client
from api.middleware.rate_limit import RateLimiterMiddleware
from api.schemas import AdminLoginRequest, AdminLoginResponse
from api.services.admin_auth import SESSION_TTL_SECONDS, credentials_are_valid, issue_session_token, require_admin

logger = logging.getLogger(__name__)

models = {}
explainer = None
_scheduler = None


def _load_eta_model_bundle() -> Optional[dict[str, object]]:
    """Load and validate the three terminal ETA artifacts as one bundle."""
    models_dir = os.path.join(ROOT_DIR, "models")
    paths = {
        "p50": os.path.join(models_dir, "eta_regressor.pkl"),
        "p10": os.path.join(models_dir, "eta_quantile_p10.pkl"),
        "p90": os.path.join(models_dir, "eta_quantile_p90.pkl"),
    }
    if not all(os.path.exists(path) for path in paths.values()):
        return None
    loaded = {name: joblib.load(path) for name, path in paths.items()}
    contracts = [tuple(getattr(model, "feature_names_in_", ())) for model in loaded.values()]
    if not contracts[0] or len(set(contracts)) != 1:
        raise ValueError("ETA model feature contracts do not match")
    return loaded


def startup_event():
    global models, explainer
    models, explainer = {}, None

    print("🚂 [RailTrackr] Initializing ML models into memory...")
    load_train_index()
    load_feature_defaults()
    load_historical_records()
    load_model_metadata()
    load_phase3_models()
    load_phase2_models()
    load_phase5_calibration()
    try:
        loaded_models = _load_eta_model_bundle()
        if loaded_models is not None:
            models = loaded_models
            explainer = DelayExplainer(models["p50"])
            set_models(models, explainer)
            print("✅ [RailTrackr] Production ML models and SHAP Explainer active.")
        else:
            set_models({}, None)
            print("ℹ️ [RailTrackr] Local model files not found on disk. Running in calibrated fallback mode.")
    except Exception:
        logger.exception("ETA model loading failed; starting without trained models")
        set_models({}, None)


def _truthy(value: str | None) -> bool:
    return str(value or "").strip().lower() in {"1", "true", "yes", "on"}


def _run_daily_learning() -> None:
    """Spawn daily_learning as a subprocess so it cannot crash the API process."""
    script = os.path.join(ROOT_DIR, "scripts", "20_daily_learning.py")
    collect_flag = ["--collect"] if _truthy(os.getenv("RAILPULSE_DAILY_COLLECT")) else []
    trains = os.getenv("RAILPULSE_DAILY_TRAIN_NUMBERS", "").strip()
    train_flag = ["--trains", trains] if trains else []
    cmd = [sys.executable, script, *collect_flag, *train_flag]
    logger.info("[RailTrackr] Starting daily learning job: %s", " ".join(cmd))
    try:
        result = subprocess.run(cmd, cwd=ROOT_DIR, capture_output=True, text=True, timeout=7200)
        if result.returncode == 0:
            logger.info("[RailTrackr] Daily learning completed successfully")
        else:
            logger.warning(
                "[RailTrackr] Daily learning finished with exit code %d:\n%s",
                result.returncode,
                (result.stdout + result.stderr)[-2000:],
            )
        # Reload models into memory only after a successful retraining
        if result.returncode == 0:
            _hot_reload_models()
    except subprocess.TimeoutExpired:
        logger.error("[RailTrackr] Daily learning job exceeded 2-hour timeout and was killed")
    except Exception:
        logger.exception("[RailTrackr] Daily learning job failed to start")


def _hot_reload_models() -> bool:
    """Reload .pkl models into memory without restarting the process."""
    global models, explainer
    learning_lock = os.path.join(ROOT_DIR, "data", ".daily_learning.lock")
    if os.path.isdir(learning_lock):
        logger.warning("[RailTrackr] Hot reload skipped while daily learning is publishing artifacts")
        return False
    try:
        new_models = _load_eta_model_bundle()
        if new_models is not None:
            new_explainer = DelayExplainer(new_models["p50"])
            models = new_models
            explainer = new_explainer
            set_models(models, explainer)
            load_feature_defaults(force=True)
            load_historical_records(force=True)
            load_model_metadata(force=True)
            # Daily learning may also have produced Phase 2/3 artifacts. They
            # must be revalidated and swapped into the serving process at the
            # same time as the terminal ETA models; otherwise a successful
            # retraining run stays inactive until a manual restart.
            load_phase3_models()
            load_phase2_models()
            load_phase5_calibration(force=True)
            logger.info("[RailTrackr] Models hot-reloaded after retraining")
            return True
        logger.warning("[RailTrackr] Hot reload skipped because one or more ETA artifacts are missing")
        return False
    except Exception:
        logger.exception("[RailTrackr] Hot model reload failed — continuing with existing models")
        return False


def _start_scheduler() -> None:
    """Start APScheduler to trigger daily learning at 02:00 IST every night."""
    global _scheduler
    if _scheduler is not None:
        return
    try:
        from apscheduler.schedulers.background import BackgroundScheduler
        from apscheduler.triggers.cron import CronTrigger
        from zoneinfo import ZoneInfo
        _scheduler = BackgroundScheduler(daemon=True)
        _scheduler.add_job(
            _run_daily_learning,
            trigger=CronTrigger(hour=2, minute=0, timezone=ZoneInfo("Asia/Kolkata")),
            id="daily_learning",
            name="RailTrackr Daily Learning",
            replace_existing=True,
            misfire_grace_time=3600,  # allow up to 1 hour late start (e.g. after Render cold boot)
        )
        _scheduler.start()
        logger.info("[RailTrackr] Daily learning scheduler started — fires at 02:00 IST")
    except ImportError:
        _scheduler = None
        logger.warning(
            "[RailTrackr] APScheduler not installed — daily learning will not auto-trigger. "
            "Run: pip install apscheduler"
        )
    except Exception:
        _scheduler = None
        logger.exception("[RailTrackr] Failed to start daily learning scheduler")


def _stop_scheduler() -> None:
    """Stop the process-local scheduler when the ASGI lifespan ends."""
    global _scheduler
    if _scheduler is None:
        return
    try:
        _scheduler.shutdown(wait=False)
    finally:
        _scheduler = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    startup_event()
    _start_scheduler()
    try:
        yield
    finally:
        _stop_scheduler()
        await close_http_client()


app = FastAPI(
    title="RailTrackr ETA & Telemetry Platform",
    version="2.0",
    description="Train ETA prediction with authorised live-status ingestion and transparent model forecasts",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# This service has no cookie/session authentication. Origins are supplied by
# deployment configuration so production deployments do not inherit local URLs.
cors_origins = [origin.strip() for origin in os.getenv("CORS_ALLOW_ORIGINS", "").split(",") if origin.strip()]

# Enable CORS only for configured frontends.
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(RateLimiterMiddleware)

# Include all modular routers
app.include_router(eta_router)
app.include_router(telemetry_router)
app.include_router(alerts_router)
app.include_router(amenities_router)
app.include_router(control_room_router)
app.include_router(live_station_router)
app.include_router(weather_router)

@app.get("/health", tags=["System Health"])
def health_check():
    """System health check and diagnostic status."""
    return {
        "status": "healthy" if "p50" in models else "degraded",
        "service": "RailTrackr Operations Engine",
        "version": "2.0",
        "models_active": "p50" in models,
        "model_version": eta_module.MODEL_VERSION,
        "phase3": phase3_status(),
        "phase2": phase2_status(),
        "phase5": phase5_status(),
        "learning": load_learning_status(),
        "indexed_routes": len(eta_module.TRAIN_ROUTES_INDEX),
        "live_provider_configured": bool(
            os.getenv("RAILRADAR_API_KEY") or os.getenv("INDIAN_RAIL_API_KEY") or os.getenv("OFFICIAL_RAIL_STATUS_URL")
        ),
        "live_provider": (
            "RAILRADAR" if os.getenv("RAILRADAR_API_KEY") else
            "INDIAN_RAIL_API" if os.getenv("INDIAN_RAIL_API_KEY") else
            "GENERIC" if os.getenv("OFFICIAL_RAIL_STATUS_URL") else None
        ),
        "weather_provider_configured": bool(
            os.getenv("OPENWEATHER_API_KEY", "").strip()
            and os.getenv("OPENWEATHER_API_URL", "").strip()
        ),
        "weather_provider": "OPENWEATHER" if (
            os.getenv("OPENWEATHER_API_KEY", "").strip()
            and os.getenv("OPENWEATHER_API_URL", "").strip()
        ) else None,
        "network_signals_provider_configured": network_provider_configured(),
        "network_signals_provider": network_provider_name(),
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()
    }

@app.get("/learning-status", tags=["System Health"])
def learning_status():
    """Return the last daily collection/export/retraining report."""
    return load_learning_status()


@app.post("/api/v1/admin/login", response_model=AdminLoginResponse, tags=["System Health"])
def admin_login(credentials: AdminLoginRequest) -> AdminLoginResponse:
    """Exchange server-configured operator credentials for a short-lived token."""
    if not os.getenv("RAILPULSE_ADMIN_TOKEN", "").strip():
        raise HTTPException(
            status_code=503,
            detail="Admin operations are disabled until RAILPULSE_ADMIN_TOKEN is configured",
        )
    if not credentials_are_valid(credentials.username, credentials.password):
        raise HTTPException(status_code=401, detail="Invalid operator credentials")
    return AdminLoginResponse(access_token=issue_session_token(), expires_in=SESSION_TTL_SECONDS)


@app.post("/api/v1/admin/reload-models", tags=["System Health"])
def reload_models(
    _authorized: bool = Depends(require_admin),
):
    """Hot-reload all ML model artifacts from disk into memory."""
    if not _hot_reload_models():
        raise HTTPException(status_code=503, detail="Model artifacts could not be reloaded")
    return {
        "status": "success",
        "models_active": "p50" in models,
        "model_version": eta_module.MODEL_VERSION,
        "phase3_active": phase3_status().get("active", False),
        "phase2_active": phase2_status().get("active", False),
        "calibration_active": phase5_status().get("calibration_active", False),
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    }
