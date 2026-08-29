"""
RailETA — Canonical Internal Data Schema
Problem Statement: SIH26028 (Dynamic Forecast of ETA for Coaching Trains)

This module defines the unified, normalized internal data contracts that bridge
heterogeneous external data feeds (RailRadar Live API, CRIS/NTES historical records,
Supabase database models) into standardized Python models for ML inference,
training, feature extraction, and dashboard rendering.

Key Guarantees:
- Strict typing with Pydantic v2
- Zero data leakage isolation (target variable `actual_run_time_min` is Optional)
- Standardized station codes, timestamps (ISO-8601 UTC), and delay metrics
- Explicit data source provenance (REAL vs SIMULATED vs HISTORICAL)
"""

from datetime import datetime, timezone
from enum import Enum
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field, field_validator


class DataSourceMode(str, Enum):
    REAL = "REAL"
    HISTORICAL = "HISTORICAL"
    SIMULATED = "SIMULATED"
    DERIVED = "DERIVED"


class TrainRunningStatus(str, Enum):
    RUNNING = "RUNNING"
    STOPPED = "STOPPED"
    DELAYED = "DELAYED"
    ON_TIME = "ON_TIME"
    TERMINATED = "TERMINATED"
    SCHEDULED = "SCHEDULED"


class StationHaltStatus(str, Enum):
    DEPARTED = "departed"
    CURRENT = "current"
    UPCOMING = "upcoming"


class CanonicalStation(BaseModel):
    """Normalized station representation."""
    station_code: str = Field(..., description="IR station code (e.g., NDLS, CNB, LKO)")
    station_name: str = Field(..., description="Official station name")
    latitude: float = Field(default=0.0, description="WGS-84 latitude coordinate")
    longitude: float = Field(default=0.0, description="WGS-84 longitude coordinate")
    zone: Optional[str] = Field(default=None, description="Railway Zone (e.g. NR, NCR, WR)")
    division: Optional[str] = Field(default=None, description="Railway Division")
    is_junction: bool = Field(default=False, description="True if station is a multi-line railway junction")

    @field_validator("station_code")
    @classmethod
    def clean_station_code(cls, v: str) -> str:
        return v.strip().upper()


class CanonicalHalt(BaseModel):
    """Normalized route halt node with timetable and observed live timings."""
    sequence: int = Field(..., description="1-indexed sequence along the journey")
    station_code: str = Field(..., description="Station IR code")
    station_name: str = Field(default="", description="Station display name")
    distance_km: float = Field(default=0.0, ge=0.0, description="Cumulative distance from route origin in km")
    
    # Timetable Schedules (HH:MM:SS or ISO string)
    scheduled_arrival: str = Field(default="00:00:00")
    scheduled_departure: str = Field(default="00:05:00")
    scheduled_dwell_min: int = Field(default=2, ge=0)
    
    # Live Observed Timings (Populated in real-time or historical logs)
    actual_arrival: Optional[str] = Field(default=None)
    actual_departure: Optional[str] = Field(default=None)
    delay_arrival_min: float = Field(default=0.0, description="Arrival delay in minutes (positive = late)")
    delay_departure_min: float = Field(default=0.0, description="Departure delay in minutes (positive = late)")
    
    # Status
    status: StationHaltStatus = Field(default=StationHaltStatus.UPCOMING)
    is_halt: bool = Field(default=True, description="False if train passes through without scheduled passenger halt")
    latitude: float = Field(default=0.0)
    longitude: float = Field(default=0.0)


class CanonicalTrainState(BaseModel):
    """
    Normalized real-time train operational state.
    Used across ingestion pipelines, WebSocket streaming, and ETA recalculation orchestrators.
    """
    journey_id: str = Field(..., description="Unique journey identifier (e.g. J_12004 or TRIP-1001)")
    train_number: str = Field(..., description="5-digit Indian Railways coaching train number")
    train_name: str = Field(..., description="Official train name")
    train_type: str = Field(default="Express", description="Train category (VB, RAJ, SF, EXP, PASS)")
    
    # Live position
    current_station_code: str = Field(..., description="Station code train just passed or is at")
    next_station_code: str = Field(..., description="Upcoming scheduled halt station code")
    
    # Telemetry
    current_delay_minutes: float = Field(default=0.0, description="Current delay in minutes relative to timetable")
    current_speed_kmph: float = Field(default=0.0, ge=0.0, le=200.0, description="Current instantaneous / average speed")
    latitude: Optional[float] = Field(default=None, description="Live GPS latitude if available")
    longitude: Optional[float] = Field(default=None, description="Live GPS longitude if available")
    
    # Metadata & Source
    status: TrainRunningStatus = Field(default=TrainRunningStatus.RUNNING)
    last_update_timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    data_source: DataSourceMode = Field(default=DataSourceMode.REAL)
    provider_source: str = Field(default="RailRadar", description="Upstream provider source tag")


class CanonicalSectionRun(BaseModel):
    """
    Normalized single-section train transit record.
    Acts as the core unit for both:
    1. Historical Training Data (where `actual_run_time_min` is the ground-truth target `y`)
    2. Real-Time Inference Input (where `actual_run_time_min` is predicted by the ML model)
    """
    # Identifiers
    trip_id: str = Field(..., description="Journey / trip identifier")
    train_number: str = Field(..., description="Train number")
    train_name: str = Field(default="Express", description="Train name")
    train_type: str = Field(default="EXP", description="Standardized train type code: VB, RAJ, SF, EXP, PASS")
    
    # Section spatial boundaries
    from_station_code: str = Field(..., description="Section departure station code")
    to_station_code: str = Field(..., description="Section arrival station code")
    distance_km: float = Field(..., gt=0.0, description="Track distance of this section in km")
    
    # Timetable benchmarks
    scheduled_run_time_min: float = Field(..., gt=0.0, description="Scheduled timetable transit time in minutes")
    
    # Live conditions at departure (T0)
    departure_hour: int = Field(..., ge=0, le=23, description="Hour of departure (0-23)")
    day_of_week: int = Field(..., ge=0, le=6, description="Day of week (0=Monday, 6=Sunday)")
    departure_delay_min: float = Field(default=0.0, description="Delay at moment of entering this section")
    
    # Dynamic operational features
    section_congestion_level: float = Field(default=0.5, ge=0.0, le=1.0, description="Track congestion factor (0.0=free, 1.0=saturated)")
    weather_impact_flag: int = Field(default=0, ge=0, le=1, description="1 if severe fog/rain/heat advisory active, 0 otherwise")
    
    # Optional historical/contextual signals
    historical_avg_run_time_min: Optional[float] = Field(default=None, description="Rolling 30-day section average duration")
    is_junction_section: bool = Field(default=False, description="1 if arrival/departure is a major interchange junction")
    
    # Ground Truth Target (None during live real-time inference; required during training evaluation)
    actual_run_time_min: Optional[float] = Field(
        default=None, 
        gt=0.0, 
        description="GROUND TRUTH TARGET: actual duration taken to traverse section. None during live inference."
    )
    
    # Data Provenance
    data_source: DataSourceMode = Field(default=DataSourceMode.HISTORICAL)

    def to_ml_feature_dict(self) -> Dict[str, Any]:
        """
        Converts canonical section record into standard feature dictionary for ML preprocessor.
        Zero data leakage guaranteed: never includes actual_run_time_min.
        """
        return {
            "distance_km": float(self.distance_km),
            "scheduled_run_time_min": float(self.scheduled_run_time_min),
            "departure_hour": int(self.departure_hour),
            "day_of_week": int(self.day_of_week),
            "departure_delay_min": float(self.departure_delay_min),
            "section_congestion_level": float(self.section_congestion_level),
            "weather_impact_flag": int(self.weather_impact_flag),
            "train_type": str(self.train_type),
            "from_station_code": str(self.from_station_code),
            "to_station_code": str(self.to_station_code),
            "historical_avg_run_time_min": self.historical_avg_run_time_min
        }
