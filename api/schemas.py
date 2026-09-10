from datetime import date
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

class AdminLoginRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=128)
    password: str = Field(..., min_length=1, max_length=256)

class AdminLoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int

class AlertSubscriptionRequest(BaseModel):
    train_number: str = Field(..., min_length=3, max_length=10, pattern=r"^\d+$", description="IR train number")
    station_code: str = Field(..., min_length=2, max_length=8, pattern=r"^[A-Za-z0-9]+$", description="Target destination station code")
    target_arrival_date: date = Field(..., description="Journey date YYYY-MM-DD")
    user_phone: str = Field(..., pattern=r"^\+[1-9]\d{7,14}$", description="E.164 mobile number for SMS / WhatsApp dispatch")
    alert_window_minutes: int = Field(default=30, ge=1, le=360, description="Notify when train is N minutes away")
    notify_on_delay_change: bool = Field(default=True, description="Notify if delay changes by > 10m")

class AlertSubscriptionResponse(BaseModel):
    status: str
    message: str
    subscription_id: str
    notification_rules: List[str]

class AlertTriggerResponse(BaseModel):
    status: str
    channel: str
    recipient: str
    dispatched_at: str
    payload: Dict[str, str]

class StationAmenityItem(BaseModel):
    id: str
    type: str
    name: str
    platform: str
    status: str
    occupancy: str
    cost: str
    amenities: List[str]

class StationAmenitiesResponse(BaseModel):
    station_code: str
    station_name: str
    recommendation: str
    amenities: List[StationAmenityItem]

class BottleneckSection(BaseModel):
    section: str
    congestion_level: str
    cause: str
    impacted_passenger_trains: List[str]
    ai_dispatch_action: str

class ProtectedConnection(BaseModel):
    junction: str
    inbound_delayed_train: str
    connecting_train: str
    scheduled_connection_gap: str
    revised_gap: str
    status: str

class CascadeRiskResponse(BaseModel):
    monitored_corridor: str
    network_cascade_index: float
    high_risk_bottlenecks: List[BottleneckSection]
    protected_passenger_connections: List[ProtectedConnection]

class StationETADetail(BaseModel):
    station_code: str
    station_name: Optional[str] = None
    distance_km: Optional[float] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    scheduled_arrival: str
    predicted_arrival: str
    predicted_arrival_datetime: Optional[str] = None
    delay_minutes: int
    p10_delay_minutes: Optional[int] = None
    p90_delay_minutes: Optional[int] = None
    confidence_percent: int
    delay_reason: str
    platform_prediction: Optional[str] = None

class TrainETAResponse(BaseModel):
    train_number: str
    train_name: str
    origin_station: Optional[str] = None
    destination_station: Optional[str] = None
    last_updated: str
    current_location: Dict[str, Any]
    stations: List[StationETADetail]


class LiveStationTrain(BaseModel):
    train_number: str
    train_name: str
    source: Optional[str] = None
    destination: Optional[str] = None
    schedule_arrival: Optional[str] = None
    schedule_departure: Optional[str] = None
    halt: Optional[str] = None
    expected_arrival: Optional[str] = None
    delay_in_arrival: Optional[str] = None
    expected_departure: Optional[str] = None
    delay_in_departure: Optional[str] = None


class LiveStationResponse(BaseModel):
    station_code: str
    hours: int
    observed_at: str
    provider: str
    trains: List[LiveStationTrain]
    signals: Dict[str, Any] = Field(default_factory=dict)
