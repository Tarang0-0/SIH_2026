"""
RailETA Dynamic ETA Forecast Endpoints
Problem Statement: SIH26028 (Dynamic Forecast of ETA for Coaching Trains)
"""

from fastapi import APIRouter, Path
from app.schemas.train_api import DetailedETAPredictionResponse, PredictionHistoryResponse
from app.api.v1.endpoints.trains import get_dynamic_eta, get_prediction_history

router = APIRouter()

@router.get(
    "/eta/{id}",
    response_model=DetailedETAPredictionResponse,
    summary="Get latest dynamic ML ETA forecast",
    description="Returns cascading station-by-station ETA predictions, baseline comparison, uncertainty bounds, and explainability factors.",
)
def get_eta_alias(
    id: str = Path(..., description="Train number or Journey ID")
):
    return get_dynamic_eta(id)


@router.get(
    "/eta/{id}/history",
    response_model=PredictionHistoryResponse,
    summary="Get ETA prediction history for journey",
    description="Returns chronological snapshot history showing how dynamic ETAs adapted as new telemetry updates arrived.",
)
def get_history_alias(
    id: str = Path(..., description="Train number or Journey ID")
):
    return get_prediction_history(id)
