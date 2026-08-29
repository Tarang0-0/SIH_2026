import logging
from fastapi import APIRouter, Depends, HTTPException
from app.schemas.event import CanonicalTrainEvent
from app.services.ingestion import process_running_update
from app.services.baseline import calculate_baseline_eta
from app.services.ml_eta import predict_ml_eta
from app.services.websocket_manager import ws_manager

logger = logging.getLogger("raileta.ingestion_endpoint")

router = APIRouter()

@router.post("/running-updates")
async def ingest_running_update(event: CanonicalTrainEvent):
    """
    Ingest a real-time train running update event.
    Validates payload, updates journey state store, calculates downstream baseline/ML ETAs,
    and broadcasts live prediction updates to connected WebSocket subscribers.
    """
    res = process_running_update(event)
    
    # Calculate baseline ETAs if state was updated
    try:
        baseline_etas = calculate_baseline_eta(event.journey_id)
        res["baseline_etas_calculated"] = len(baseline_etas.predictions)
    except Exception:
        res["baseline_etas_calculated"] = 0

    # Calculate and broadcast dynamic ML ETAs if state was updated
    if res.get("journey_state_updated", True):
        try:
            ml_eta = predict_ml_eta(event.journey_id)
            res["ml_eta_calculated"] = True
            res["ml_predicted_delay"] = ml_eta.current_delay_minutes
            
            # Broadcast to WebSocket subscribers in real time
            await ws_manager.broadcast_to_journey(event.journey_id, {
                "type": "ETA_UPDATE",
                "journey_id": event.journey_id,
                "train_number": ml_eta.train_number,
                "event_timestamp": event.timestamp.isoformat(),
                "data": ml_eta.model_dump()
            })
            res["websocket_broadcast"] = True
        except Exception as e:
            logger.warning(f"Error computing or broadcasting ML ETA for {event.journey_id}: {e}")
            res["websocket_broadcast"] = False

    return res

