from pydantic import BaseModel, Field
from datetime import datetime
from typing import List, Dict, Optional

class StationETA(BaseModel):
    station_code: str
    station_name: str
    sequence_number: int
    distance_km: float
    scheduled_arrival: str
    scheduled_departure: str
    baseline_eta: str # Scheduled + Current Delay ISO string
    predicted_eta: str # ML forecast ISO string
    predicted_delay_minutes: float
    confidence_range_lower: str
    confidence_range_upper: str
    lower_bound_minutes: float
    upper_bound_minutes: float
    model_version: str = "xgboost-v1.0"
    data_source: str = "SIMULATED"

class ETAPredictionResponse(BaseModel):
    journey_id: str
    train_number: str
    train_name: str
    current_station_code: str
    next_station_code: str
    current_delay_minutes: int
    current_speed_kmph: float
    last_update_timestamp: datetime
    predictions: List[StationETA]
    shap_explanation: Dict[str, float] = Field(default_factory=dict)
    data_source: str = "SIMULATED"
