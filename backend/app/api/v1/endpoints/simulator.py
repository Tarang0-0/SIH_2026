import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, Header, status

from app.schemas.eta import ETAPredictionResponse
from app.services.ml_eta import predict_ml_eta
from app.services.ingestion import MOCK_JOURNEY_STORE
from app.services.websocket_manager import ws_manager
from app.core.security import verify_admin_credentials, generate_admin_token, verify_admin_token
from app.db.supabase import get_db

logger = logging.getLogger("raileta.simulator")

router = APIRouter()

class AdminLoginRequest(BaseModel):
    username: str = Field(..., description="Admin Username")
    password: str = Field(..., description="Admin Password")

class AdminLoginResponse(BaseModel):
    status: str
    authenticated: bool
    access_token: str
    token_type: str
    message: str

class DisruptionSimulationRequest(BaseModel):
    journey_id: str = Field(..., description="Journey ID (e.g. J1001, J1002, or train number)")
    additional_delay_minutes: float = Field(..., description="Additional delay to inject in minutes", ge=-30.0, le=180.0)
    section_from: Optional[str] = Field(None, description="Starting station of disrupted section (e.g. GZB)")
    section_to: Optional[str] = Field(None, description="Ending station of disrupted section (e.g. ALJN)")
    disruption_type: str = Field("Signal Failure", description="Type of disruption (e.g. Signal Failure, Winter Fog, Track Maintenance)")


class DisruptionSimulationResponse(BaseModel):
    status: str
    journey_id: str
    train_number: str
    disruption_type: str
    injected_delay_minutes: float
    new_total_delay_minutes: float
    current_station: str
    next_station: str
    prediction: ETAPredictionResponse
    websocket_broadcast: bool


@router.post("/auth/admin-login", response_model=AdminLoginResponse)
def admin_login(req: AdminLoginRequest):
    """
    Authenticates Operational Controller against secure salted hash credentials.
    Returns secure bearer session token.
    """
    if not verify_admin_credentials(req.username, req.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid controller credentials. Access denied."
        )
    
    token = generate_admin_token()
    return AdminLoginResponse(
        status="success",
        authenticated=True,
        access_token=token,
        token_type="Bearer",
        message="Controller session successfully authenticated."
    )


@router.post("/simulate/disruption", response_model=DisruptionSimulationResponse)
def simulate_disruption(
    req: DisruptionSimulationRequest,
    authorization: Optional[str] = Header(None)
):
    """
    Simulates an operational disruption on an active journey.
    Injects custom delay, recalculates cascading GBDT section ETAs with uncertainty bounds & SHAP explainability,
    and broadcasts the updated forecast to connected WebSocket subscribers in real time.
    """
    # Universal journey ID resolution — no hardcoded train-to-journey mappings
    journey_id = req.journey_id
    if journey_id.isdigit():
        journey_id = f"J_{journey_id}"
    elif not journey_id.startswith("J"):
        journey_id = f"J_{journey_id}"

    db_client = get_db()
    train_number = "12004"
    new_total_delay = 0.0
    curr_stn = "GZB"
    next_stn = "ALJN"

    # Update thread-safe journey store
    clean_num = journey_id.replace("J_", "").replace("J", "")
    from app.services.concurrent_store import journey_store
    from app.services.providers.catalog import DynamicTrainResolver

    if not journey_store.contains(journey_id):
        synth = DynamicTrainResolver.resolve_train(clean_num)
        if synth:
            journey_store.put(journey_id, {
                "journey_id": journey_id,
                "train_number": synth["train_number"],
                "train_name": synth["train_name"],
                "current_station": req.section_from or synth["current_station"],
                "next_station": req.section_to or synth["next_station"],
                "current_delay_minutes": float(synth["delay_minutes"]),
                "current_speed_kmph": float(synth["speed_kmph"]),
                "last_update_timestamp": datetime.now(timezone.utc),
                "data_source": synth["data_source"]
            })

    j_state = journey_store.get(journey_id)
    if not j_state:
        raise HTTPException(status_code=404, detail=f"Journey '{journey_id}' not found")

    train_number = j_state.get("train_number", clean_num)
    current_delay = float(j_state.get("current_delay_minutes", 0.0))
    new_total_delay = max(0.0, current_delay + req.additional_delay_minutes)
    curr_stn = req.section_from or j_state.get("current_station", "NDLS")
    next_stn = req.section_to or j_state.get("next_station", "GZB")

    journey_store.update(journey_id, {
        "current_delay_minutes": new_total_delay,
        "current_station": curr_stn,
        "next_station": next_stn,
        "last_update_timestamp": datetime.now(timezone.utc)
    })

    # Update Supabase if connected
    if db_client:
        try:
            db_client.table("journeys").update({
                "current_delay_minutes": new_total_delay,
                "current_station_code": curr_stn,
                "next_station_code": next_stn,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }).eq("journey_id", journey_id).execute()
        except Exception as e:
            logger.warning(f"Error updating DB with simulated disruption: {e}")

    # Compute updated cascading ML ETA
    prediction = predict_ml_eta(journey_id)

    # Broadcast via WebSocket
    broadcast_success = False
    try:
        ws_manager.sync_broadcast(journey_id, {
            "type": "ETA_UPDATE",
            "disruption_simulation": True,
            "disruption_type": req.disruption_type,
            "journey_id": journey_id,
            "train_number": train_number,
            "event_timestamp": datetime.now(timezone.utc).isoformat(),
            "data": prediction.model_dump()
        })
        broadcast_success = True
    except Exception as e:
        logger.warning(f"Error broadcasting simulated disruption: {e}")

    return DisruptionSimulationResponse(
        status="success",
        journey_id=journey_id,
        train_number=train_number,
        disruption_type=req.disruption_type,
        injected_delay_minutes=req.additional_delay_minutes,
        new_total_delay_minutes=new_total_delay,
        current_station=curr_stn,
        next_station=next_stn,
        prediction=prediction,
        websocket_broadcast=broadcast_success
    )
