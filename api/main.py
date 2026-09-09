from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
import joblib
import datetime
import logging
import sys

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

app = FastAPI(
    title="Namaste Rail ETA & Telemetry Platform",
    version="2.0",
    description="Train ETA prediction with authorised live-status ingestion and transparent model forecasts",
    docs_url="/docs",
    redoc_url="/redoc"
)

logger = logging.getLogger(__name__)

# This service has no cookie/session authentication. Explicit local development
# origins are safer and valid with future credentialed browser requests.
cors_origins = [origin.strip() for origin in os.getenv(
    "CORS_ALLOW_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"
).split(",") if origin.strip()]

# Enable CORS for all frontends (Next.js, Vite, or future Figma prototypes)
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include all modular routers
app.include_router(eta_router)
app.include_router(telemetry_router)
app.include_router(alerts_router)
app.include_router(amenities_router)
app.include_router(control_room_router)
app.include_router(live_station_router)
app.include_router(weather_router)

models = {}
explainer = None

@app.on_event("startup")
def startup_event():
    global models, explainer
    models, explainer = {}, None
    models_dir = os.path.join(ROOT_DIR, "models")
    
    print("🚂 [Namaste Rail] Initializing ML models into memory...")
    load_train_index()
    load_feature_defaults()
    load_historical_records()
    load_model_metadata()
    load_phase3_models()
    load_phase2_models()
    load_phase5_calibration()
    try:
        p50_path = os.path.join(models_dir, "eta_regressor.pkl")
        p10_path = os.path.join(models_dir, "eta_quantile_p10.pkl")
        p90_path = os.path.join(models_dir, "eta_quantile_p90.pkl")
        
        if all(os.path.exists(path) for path in (p50_path, p10_path, p90_path)):
            loaded_models = {
                "p50": joblib.load(p50_path),
                "p10": joblib.load(p10_path),
                "p90": joblib.load(p90_path),
            }
            feature_contracts = [tuple(model.feature_names_in_) for model in loaded_models.values()]
            if not feature_contracts[0] or len(set(feature_contracts)) != 1:
                raise ValueError("ETA model feature contracts do not match")
            models = loaded_models
            explainer = DelayExplainer(models["p50"])
            set_models(models, explainer)
        print("✅ [Namaste Rail] Production ML models and SHAP Explainer active.")
        else:
            set_models({}, None)
        print("ℹ️ [Namaste Rail] Local model files not found on disk. Running in calibrated fallback mode.")
    except Exception:
        logger.exception("ETA model loading failed; starting without trained models")
        set_models({}, None)

@app.get("/health", tags=["System Health"])
def health_check():
    """System health check and diagnostic status."""
    return {
        "status": "healthy" if "p50" in models else "degraded",
        "service": "Namaste Rail Operations Engine",
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
        "weather_provider_configured": bool(os.getenv("OPENWEATHER_API_KEY", "").strip()),
        "weather_provider": "OPENWEATHER" if os.getenv("OPENWEATHER_API_KEY", "").strip() else None,
        "network_signals_provider_configured": network_provider_configured(),
        "network_signals_provider": network_provider_name(),
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()
    }

@app.get("/learning-status", tags=["System Health"])
def learning_status():
    """Return the last daily collection/export/retraining report."""
    return load_learning_status()
