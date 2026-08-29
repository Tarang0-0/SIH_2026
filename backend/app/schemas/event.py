from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime
from typing import Literal

DataSourceType = Literal['REAL', 'DERIVED', 'SIMULATED', 'SYNTHETIC']

class CanonicalTrainEvent(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "journey_id": "J1001",
                "timestamp": "2026-08-27T12:10:00Z",
                "latitude": 28.6657,
                "longitude": 77.4393,
                "speed_kmph": 62.0,
                "delay_minutes": 9,
                "current_station": "GZB",
                "next_station": "ALJN",
                "source": "SIMULATED"
            }
        }
    )

    journey_id: str = Field(..., description="Unique journey identifier")
    timestamp: datetime = Field(..., description="ISO timestamp of event")
    latitude: float = Field(..., description="Current GPS latitude")
    longitude: float = Field(..., description="Current GPS longitude")
    speed_kmph: float = Field(..., ge=0.0, description="Current observed speed in km/h")
    delay_minutes: int = Field(..., description="Current delay in minutes")
    current_station: str = Field(..., description="Station code of current or last passed station")
    next_station: str = Field(..., description="Station code of next upcoming station")
    status: str = Field(default="RUNNING", description="Running status of the train: RUNNING, SCHEDULED, COMPLETED, CANCELLED")
    source: DataSourceType = Field(default="SIMULATED", description="Data provenance classification")

