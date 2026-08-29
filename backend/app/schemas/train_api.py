"""
RailETA API Pydantic Schemas
Problem Statement: SIH26028 (Dynamic Forecast of ETA for Coaching Trains)

Defines strict request/response data contracts for train state, real-time updates,
dynamic ETA forecasting, prediction history, and system health checks.
"""

from datetime import datetime
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


# ==============================================================================
# 1. TRAIN STATE SCHEMAS
# ==============================================================================

class TrainStateResponse(BaseModel):
    journey_id: str = Field(..., description="Unique journey ID (e.g. J_12302)")
    train_number: str = Field(..., description="5-digit train number (e.g. 12302)")
    train_name: str = Field(..., description="Official train name")
    train_type: str = Field("EXP", description="Train type category (VB, RAJ, SF, EXP)")
    current_station_code: str = Field(..., description="Current/last passed station code")
    next_station_code: str = Field(..., description="Next station code on route")
    current_speed_kmh: float = Field(0.0, ge=0.0, le=220.0, description="Current speed in km/h")
    current_delay_minutes: float = Field(0.0, description="Current delay relative to timetable in minutes")
    distance_to_next_station_km: float = Field(..., ge=0.0, description="Remaining distance to next station")
    status: str = Field("IN_TRANSIT", description="IN_TRANSIT, STOPPED, or COMPLETED")
    last_update_timestamp: datetime = Field(..., description="Timestamp of latest telemetry report")
    data_source: str = Field("SIMULATED", description="REAL or SIMULATED")


class TrainStateUpdateRequest(BaseModel):
    journey_id: str = Field(..., description="Unique journey identifier (e.g. J_12302 or 12302)")
    current_station: str = Field(..., min_length=2, max_length=6, description="Station code (e.g. CNB)")
    next_station: str = Field(..., min_length=2, max_length=6, description="Next station code (e.g. PRYJ)")
    speed_kmh: float = Field(..., ge=0.0, le=220.0, description="Current train speed in km/h")
    delay_minutes: float = Field(..., ge=-60.0, le=1440.0, description="Observed departure/running delay in minutes")
    distance_remaining_km: Optional[float] = Field(None, ge=0.0, description="Optional remaining distance to next stop")
    weather_impact_flag: Optional[int] = Field(0, description="1 if fog/monsoon active, 0 otherwise")
    section_congestion_level: Optional[float] = Field(0.55, ge=0.0, le=1.0, description="Line traffic score")
    timestamp: Optional[datetime] = Field(None, description="Event timestamp (defaults to current UTC time)")
    source: str = Field("SIMULATED", description="Data source tag: REAL or SIMULATED")


class TrainStateUpdateResponse(BaseModel):
    status: str = "success"
    message: str
    journey_id: str
    train_number: str
    updated_state: TrainStateResponse
    latest_predicted_eta: Optional[str] = None
    predicted_delay_minutes: Optional[float] = None
    prediction_recorded: bool = True


# ==============================================================================
# 2. DYNAMIC ETA PREDICTION SCHEMAS
# ==============================================================================

class StationETAItem(BaseModel):
    station_code: str
    station_name: str
    sequence_number: int
    distance_km: float
    scheduled_arrival: str
    scheduled_departure: str
    baseline_eta: str
    predicted_eta: str
    predicted_delay_minutes: float
    confidence_lower_eta: str
    confidence_upper_eta: str
    lower_bound_minutes: float
    upper_bound_minutes: float
    explainability: List[str]
    model_version: str = "GBDT-v1.0"
    data_source: str = "SIMULATED"


class DetailedETAPredictionResponse(BaseModel):
    journey_id: str
    train_number: str
    train_name: str
    train_type: str
    current_station_code: str
    next_station_code: str
    current_delay_minutes: float
    current_speed_kmh: float
    last_update_timestamp: datetime
    predictions: List[StationETAItem]
    overall_summary: str
    model_version: str
    data_source: str = "SIMULATED"


# ==============================================================================
# 3. PREDICTION HISTORY SCHEMAS
# ==============================================================================

class PredictionHistorySnapshot(BaseModel):
    snapshot_id: str
    timestamp: datetime
    train_station: str
    reported_delay_min: float
    reported_speed_kmh: float
    destination_station: str
    destination_baseline_eta: str
    destination_predicted_eta: str
    predicted_delay_at_destination_min: float
    primary_driving_factor: str


class PredictionHistoryResponse(BaseModel):
    journey_id: str
    train_number: str
    train_name: str
    total_snapshots: int
    history: List[PredictionHistorySnapshot]


# ==============================================================================
# 4. SYSTEM HEALTH CHECK SCHEMA
# ==============================================================================

class SystemHealthResponse(BaseModel):
    status: str = "healthy"
    service_name: str = "RailETA Dynamic ETA Engine"
    version: str = "1.0.0"
    environment: str = "development"
    ml_model_loaded: bool
    ml_model_type: str
    active_trains_count: int
    server_time_utc: datetime


# ==============================================================================
# 5. AI EXPLANATION SCHEMAS
# ==============================================================================

class AIExplainRequest(BaseModel):
    station_code: Optional[str] = Field(None, description="Target station code to explain (defaults to next station)")


class AIExplanationResponse(BaseModel):
    journey_id: str
    train_number: str
    train_name: str
    target_station: str
    summary: str
    operational_bullet_points: List[str]
    confidence_assessment: str
    passenger_advice: str
    generated_by: str
    is_fallback: bool
    data_source: str = "SIMULATED"
