import json
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.services.websocket_manager import ws_manager
from app.services.ml_eta import predict_ml_eta

logger = logging.getLogger("raileta.websockets")

router = APIRouter()

@router.websocket("/ws/trains/{journey_id}")
async def websocket_train_stream(websocket: WebSocket, journey_id: str):
    """
    WebSocket endpoint for subscribing to live ETA predictions of a specific journey.
    Pushes an immediate prediction upon connection, then streams real-time updates as events arrive.
    """
    clean_id = journey_id.strip()
    if clean_id.isdigit():
        target_journey_id = f"J_{clean_id}"
    elif not clean_id.startswith("J"):
        target_journey_id = f"J_{clean_id}"
    else:
        target_journey_id = clean_id

    await ws_manager.connect(websocket, target_journey_id)
    
    # Send initial state immediately upon connection
    try:
        initial_eta = predict_ml_eta(target_journey_id)
        await websocket.send_text(json.dumps(initial_eta.model_dump(), default=str))
    except Exception as e:
        logger.warning(f"Error sending initial state to WebSocket for {target_journey_id}: {e}")

    try:
        while True:
            # Keep connection open and receive any client-side ping/messages
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, target_journey_id)
        logger.info(f"WebSocket client disconnected from journey {target_journey_id}")
    except Exception as e:
        logger.error(f"WebSocket error for journey {target_journey_id}: {e}")
        ws_manager.disconnect(websocket, target_journey_id)

@router.websocket("/ws/live-stream")
async def websocket_global_stream(websocket: WebSocket):
    """
    WebSocket endpoint for subscribing to global fleet-wide real-time updates and predictions.
    """
    await ws_manager.connect(websocket, "global")
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, "global")
        logger.info("WebSocket client disconnected from global stream")
    except Exception as e:
        logger.error(f"WebSocket global stream error: {e}")
        ws_manager.disconnect(websocket, "global")
