"""
RailETA Production ETA Inference Service
Problem Statement: SIH26028 (Dynamic Forecast of ETA for Coaching Trains)

Unified inference pipeline for real-time train ETA forecasting:
1. Input validation & physical sanity checks
2. Zero-leakage feature preprocessing (100% parity with training pipeline)
3. High-throughput, thread-safe model inference
4. Conversion of predicted minutes to localized ISO 8601 arrival timestamps
5. Uncertainty interval calculation (80% confidence bounds from test residuals)
6. Explainability breakdown (identifying factors driving delay adjustments)
"""

import os
import sys
import logging
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, List, Optional, Union
from pydantic import BaseModel, Field

# Ensure backend directory is in sys.path
script_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(os.path.dirname(script_dir))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from ml.model_loader import load_model
from ml.features import FeatureEngineer, FEATURE_NAMES
from ml.preprocessing import ETAPreprocessor, SANITY_BOUNDS

logger = logging.getLogger("raileta.inference_service")


# ==============================================================================
# 1. INPUT & OUTPUT DATA SCHEMAS
# ==============================================================================

class TrainStateInput(BaseModel):
    """Real-time train state telemetry update."""
    journey_id: str = Field(..., description="Unique journey identifier (e.g. J_12302)")
    train_number: str = Field(..., description="5-digit train number (e.g. 12302)")
    train_name: Optional[str] = Field("Coaching Express", description="Train name")
    train_type: str = Field("EXP", description="Train type: VB, RAJ, SF, EXP, PASS")
    current_station_code: str = Field(..., description="Last station passed or departed (e.g. CNB)")
    next_station_code: str = Field(..., description="Next upcoming station (e.g. PRYJ)")
    distance_to_next_station_km: float = Field(..., ge=0.5, le=1200.0, description="Remaining distance in km")
    scheduled_section_duration_min: float = Field(..., ge=1.0, le=1440.0, description="Timetable allotted minutes")
    current_delay_minutes: float = Field(0.0, description="Current delay at departure in minutes")
    current_speed_kmh: Optional[float] = Field(None, description="Current speed in km/h")
    departure_timestamp: Optional[datetime] = Field(None, description="Departure timestamp from current station")
    section_congestion_level: Optional[float] = Field(0.55, ge=0.0, le=1.0, description="Line congestion score")
    weather_impact_flag: Optional[int] = Field(0, description="1 if fog/monsoon speed restrictions active, 0 otherwise")
    data_source: str = Field("SIMULATED", description="REAL or SIMULATED")


class SingleSectionETAResult(BaseModel):
    """Output for a single section ETA forecast."""
    journey_id: str
    train_number: str
    from_station: str
    to_station: str
    distance_km: float
    scheduled_run_time_min: float
    predicted_run_time_min: float
    predicted_delay_drift_min: float
    departure_time: str
    baseline_eta: str
    predicted_eta: str
    confidence_interval: Dict[str, Any]
    explainability: Dict[str, Any]
    model_version: str
    data_source: str


# ==============================================================================
# 2. ETA INFERENCE SERVICE CLASS
# ==============================================================================

class ETAInferenceService:
    """
    Thread-safe, high-performance ETA inference service.
    Loads model once into memory and provides sub-5ms predictions.
    """

    _instance: Optional["ETAInferenceService"] = None

    def __init__(self):
        # Load trained ML model and metadata from disk
        self.model, self.metadata = load_model()
        self.feature_engineer = FeatureEngineer(section_stats=self.metadata.get("section_stats", {}))
        self.preprocessor = ETAPreprocessor()

        self.q10_residual = self.metadata.get("residual_q10", -3.63)
        self.q90_residual = self.metadata.get("residual_q90", +3.64)
        self.model_type = self.metadata.get("model_type", "GBDT Regressor")
        logger.info(f"ETAInferenceService initialized successfully with {self.model_type}.")

    @classmethod
    def get_instance(cls) -> "ETAInferenceService":
        if cls._instance is None:
            cls._instance = ETAInferenceService()
        return cls._instance

    def validate_input(self, state: TrainStateInput) -> None:
        """
        Validates input boundaries and prevents physically impossible inputs.
        """
        if state.distance_to_next_station_km <= 0:
            raise ValueError(f"Distance must be positive, got {state.distance_to_next_station_km} km")
        if state.scheduled_section_duration_min <= 0:
            raise ValueError(f"Scheduled duration must be positive, got {state.scheduled_section_duration_min} min")
        if state.current_delay_minutes < -60.0 or state.current_delay_minutes > 1440.0:
            raise ValueError(f"Delay {state.current_delay_minutes} min is outside reasonable bounds [-60, 1440]")

    def predict_section_eta(self, state: TrainStateInput) -> SingleSectionETAResult:
        """
        Predicts ETA for the immediate upcoming station with zero-leakage preprocessing.
        """
        self.validate_input(state)

        dep_time = state.departure_timestamp or datetime.now(timezone.utc)
        if dep_time.tzinfo is None:
            dep_time = dep_time.replace(tzinfo=timezone.utc)

        # 1. Build Canonical Feature Event
        raw_event = {
            "train_number": state.train_number,
            "train_type": state.train_type,
            "station_code": state.current_station_code,
            "next_station_code": state.next_station_code,
            "distance_km": state.distance_to_next_station_km,
            "scheduled_run_time_min": state.scheduled_section_duration_min,
            "departure_hour": dep_time.hour,
            "day_of_week": dep_time.weekday(),
            "departure_delay_min": state.current_delay_minutes,
            "section_congestion_level": state.section_congestion_level,
            "weather_impact_flag": state.weather_impact_flag,
        }

        # 2. Extract Features using exact training-parity transformer
        X_live = self.feature_engineer.extract_from_realtime_event(raw_event)

        # 3. Model Inference (< 2ms)
        raw_pred_min = float(self.model.predict(X_live)[0])

        # 4. Enforce Physical Feasibility Guardrails
        # Max track speed limit: 140 km/h; Min crawl speed: 15 km/h
        min_allowed_time = (state.distance_to_next_station_km / 140.0) * 60.0
        max_allowed_time = (state.distance_to_next_station_km / 15.0) * 60.0
        predicted_run_time_min = round(max(min_allowed_time, min(max_allowed_time, raw_pred_min)), 2)

        # 5. Calculate Arrival Timestamps
        predicted_arrival_dt = dep_time + timedelta(minutes=predicted_run_time_min)
        
        # Naive Schedule Baseline (Schedule Time + Current Delay)
        baseline_arrival_dt = dep_time + timedelta(minutes=state.scheduled_section_duration_min + state.current_delay_minutes)

        # Delay drift (how much delay will increase or decrease over this section)
        delay_drift_min = round(predicted_run_time_min - state.scheduled_section_duration_min, 2)

        # 6. Uncertainty Confidence Interval (80% Confidence from Test Residuals)
        lower_bound_min = round(max(min_allowed_time, predicted_run_time_min + self.q10_residual), 2)
        upper_bound_min = round(min(max_allowed_time, predicted_run_time_min + self.q90_residual), 2)
        lower_dt = dep_time + timedelta(minutes=lower_bound_min)
        upper_dt = dep_time + timedelta(minutes=upper_bound_min)

        # 7. Generate Explainability Rationale
        explainability = self._generate_explanation(
            state=state,
            pred_time=predicted_run_time_min,
            delay_drift=delay_drift_min,
            dep_hour=dep_time.hour
        )

        return SingleSectionETAResult(
            journey_id=state.journey_id,
            train_number=state.train_number,
            from_station=state.current_station_code,
            to_station=state.next_station_code,
            distance_km=state.distance_to_next_station_km,
            scheduled_run_time_min=state.scheduled_section_duration_min,
            predicted_run_time_min=predicted_run_time_min,
            predicted_delay_drift_min=delay_drift_min,
            departure_time=dep_time.isoformat(),
            baseline_eta=baseline_arrival_dt.isoformat(),
            predicted_eta=predicted_arrival_dt.isoformat(),
            confidence_interval={
                "lower_bound_minutes": lower_bound_min,
                "upper_bound_minutes": upper_bound_min,
                "range_span_minutes": round(upper_bound_min - lower_bound_min, 1),
                "lower_eta": lower_dt.isoformat(),
                "upper_eta": upper_dt.isoformat(),
                "confidence_level": "80% empirical holdout",
            },
            explainability=explainability,
            model_version=self.model_type,
            data_source=state.data_source,
        )

    def _generate_explanation(
        self,
        state: TrainStateInput,
        pred_time: float,
        delay_drift: float,
        dep_hour: int
    ) -> Dict[str, Any]:
        """
        Generates intuitive, human-understandable explanations for why the ETA shifted.
        """
        reasons = []

        if state.weather_impact_flag == 1:
            reasons.append("Severe winter fog / speed restriction active on section (+15 to +30 min impact).")

        if (8 <= dep_hour <= 11 or 17 <= dep_hour <= 21):
            reasons.append(f"Peak hour traffic window (Hour {dep_hour}:00) causing junction approach clearance friction.")
        elif (1 <= dep_hour <= 5):
            reasons.append(f"Off-peak night window (Hour {dep_hour}:00) — clear tracks allow faster transit pace.")

        if state.current_delay_minutes > 30.0:
            reasons.append("High upstream delay (>30 min) increases probability of being held at loop sidings for express crossings.")
        elif 5.0 <= state.current_delay_minutes <= 20.0 and state.train_type in ["VB", "RAJ"]:
            reasons.append(f"High-priority {state.train_type} dispatch status allows driver to recover timetable slack.")

        if not reasons:
            reasons.append("Section operating under normal nominal conditions within expected timetable margins.")

        return {
            "summary": f"ETA adjusted by {delay_drift:+0.1f} min relative to timetable schedule.",
            "delay_drift_minutes": delay_drift,
            "driving_factors": reasons,
        }

    def predict_multi_station_timeline(
        self,
        journey_id: str,
        train_number: str,
        train_type: str,
        current_station: str,
        current_delay_min: float,
        departure_time: datetime,
        remaining_stops: List[Dict[str, Any]],
        data_source: str = "SIMULATED",
    ) -> List[Dict[str, Any]]:
        """
        Predicts complete cascading multi-stop station arrival timeline.
        """
        timeline = []
        running_time = departure_time
        running_delay = float(current_delay_min)

        for sec in remaining_stops:
            from_stn = sec["from_station"]
            to_stn = sec["to_station"]
            dist_km = float(sec["distance_km"])
            sched_min = float(sec["scheduled_min"])
            congestion = float(sec.get("congestion", 0.55))
            weather = int(sec.get("weather", 0))

            state_input = TrainStateInput(
                journey_id=journey_id,
                train_number=train_number,
                train_type=train_type,
                current_station_code=from_stn,
                next_station_code=to_stn,
                distance_to_next_station_km=dist_km,
                scheduled_section_duration_min=sched_min,
                current_delay_minutes=running_delay,
                departure_timestamp=running_time,
                section_congestion_level=congestion,
                weather_impact_flag=weather,
                data_source=data_source,
            )

            res = self.predict_section_eta(state_input)

            timeline.append({
                "from_station": from_stn,
                "station_code": to_stn,
                "distance_km": dist_km,
                "scheduled_min": sched_min,
                "predicted_min": res.predicted_run_time_min,
                "delay_drift_min": res.predicted_delay_drift_min,
                "predicted_eta": res.predicted_eta,
                "baseline_eta": res.baseline_eta,
                "confidence_lower": res.confidence_interval["lower_eta"],
                "confidence_upper": res.confidence_interval["upper_eta"],
                "explainability": res.explainability["driving_factors"],
            })

            # Advance clock (predicted run time + 3 min station dwell)
            running_time = datetime.fromisoformat(res.predicted_eta) + timedelta(minutes=3.0)
            running_delay = max(0.0, running_delay + res.predicted_delay_drift_min)

        return timeline


# Singleton instance
eta_inference_service = ETAInferenceService.get_instance()
