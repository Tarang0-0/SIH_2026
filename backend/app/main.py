import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.security import SecurityHeadersMiddleware
from app.core.rate_limiter import RateLimitMiddleware
from app.api.v1.endpoints.ingestion import router as ingestion_router
from app.api.v1.endpoints.trains import router as trains_router
from app.api.v1.endpoints.eta import router as eta_router
from app.api.v1.endpoints.websockets import router as websockets_router
from app.api.v1.endpoints.simulator import router as simulator_router
from app.api.v1.endpoints.external import router as external_router
from app.services.ml_eta import MLETAEngine
from app.services.websocket_manager import ws_manager


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: capture server event loop & preload ML model
    try:
        loop = asyncio.get_running_loop()
        ws_manager.set_event_loop(loop)
    except RuntimeError:
        pass
    _ = MLETAEngine.get_instance()
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    description="RailETA Dynamic Train Expected Time of Arrival (ETA) Forecasting Engine API (SIH 2026 Problem Statement 26028)",
    lifespan=lifespan
)

# 1. Security HTTP Headers Middleware (HSTS, CSP, X-Frame-Options)
app.add_middleware(SecurityHeadersMiddleware)

# 2. Token Bucket IP Rate Limiting Middleware
app.add_middleware(RateLimitMiddleware)

# 3. CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global Exception Handler for Clean JSON Error Responses
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={
            "error": "InternalServerError",
            "message": "An unexpected error occurred in RailETA processing engine.",
            "detail": str(exc) if settings.ENVIRONMENT == "development" else "Internal server error"
        }
    )

# Include API Routers
app.include_router(ingestion_router, prefix=settings.API_V1_STR, tags=["Ingestion"])
app.include_router(trains_router, prefix=settings.API_V1_STR, tags=["Trains & Route Topology"])
app.include_router(eta_router, prefix=settings.API_V1_STR, tags=["Dynamic ETA Forecasting"])
app.include_router(simulator_router, prefix=settings.API_V1_STR, tags=["What-If Disruption Simulator & Auth"])
app.include_router(external_router, prefix=settings.API_V1_STR, tags=["Live Weather & Topography"])
app.include_router(websockets_router, tags=["Real-time WebSockets"])


@app.get("/")
def root():
    return {
        "service": "RailETA Engine API",
        "version": "1.0.0",
        "status": "online",
        "docs": "/docs",
        "websocket_endpoints": [
            "/ws/trains/{journey_id}",
            "/ws/live-stream"
        ]
    }


@app.get("/health")
@app.get(f"{settings.API_V1_STR}/health")
def health_check():
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "environment": settings.ENVIRONMENT,
        "data_source_mode": settings.DATA_SOURCE_MODE,
        "ml_model_loaded": MLETAEngine.get_instance().is_loaded
    }
