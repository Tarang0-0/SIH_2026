import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Union, Optional
import numpy as np
import pandas as pd

logger = logging.getLogger("raileta.features")

# Canonical 20-feature ordering required by the high-precision GBDT model
FEATURE_COLUMNS: List[str] = [
    "current_delay_minutes",
    "current_speed_kmph",
    "section_distance_km",
    "scheduled_section_minutes",
    "historical_avg_running_minutes",
    "historical_p90_running_minutes",
    "departure_hour",
    "day_of_week",
    "train_type_encoded",
    "recent_delay_change",
    "rolling_speed_kmph",
    "is_peak_hours",
    "temperature_c",
    "rainfall_mm_hr",
    "visibility_km",
    "weather_condition_encoded",
    "elevation_gain_m",
    "gradient_pct",
    "junction_density",
    "is_severe_heat"
]


def parse_iso_datetime(value: Union[str, datetime, None]) -> datetime:
    """
    Robust datetime normalizer.
    Converts ISO strings (including 'Z' suffix) and raw datetime objects into
    timezone-aware UTC datetime instances across Python versions.
    """
    if value is None:
        return datetime.now(timezone.utc)

    if isinstance(value, datetime):
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)

    if isinstance(value, str):
        cleaned = value.strip().replace("Z", "+00:00")
        try:
            dt = datetime.fromisoformat(cleaned)
        except ValueError:
            # Fallback for YYYY-MM-DD date strings
            dt = datetime.strptime(cleaned, "%Y-%m-%d")

        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)

    raise TypeError(f"Cannot parse datetime from type {type(value)}: {value}")


class FeatureExtractor:
    """
    Zero-Data-Leakage Tabular Feature Extractor for Section Travel Time Forecasting.
    
    Invariant:
    All features computed for prediction at time T strictly derive from:
    1. Active journey running state at or before T (delay, entry speed, recent trends).
    2. Static route topology and schedule baseline (distance, scheduled time, historical metrics).
    3. Calendar and temporal context (hour of day, day of week, peak hours) at time T.
    4. Physical atmospheric observations (temperature, rainfall, visibility) at time T.
    5. Topographical and geospatial metrics (elevation change, gradient, track density).
    """

    @classmethod
    def get_feature_names(cls) -> List[str]:
        return list(FEATURE_COLUMNS)

    @classmethod
    def extract_features(
        cls,
        current_delay_minutes: float,
        current_speed_kmph: float,
        section_distance_km: float,
        scheduled_section_minutes: float,
        historical_avg_running_minutes: float,
        historical_p90_running_minutes: float,
        train_type_encoded: int,
        timestamp: datetime,
        recent_delay_change: float = 0.0,
        rolling_speed_kmph: Optional[float] = None,
        temperature_c: float = 28.0,
        rainfall_mm_hr: float = 0.0,
        visibility_km: float = 8.0,
        weather_condition_encoded: int = 0,
        elevation_gain_m: float = 0.0,
        gradient_pct: float = 0.0,
        junction_density: float = 1.0,
        is_severe_heat: Optional[int] = None,
        feature_columns: Optional[List[str]] = None
    ) -> pd.DataFrame:
        """
        Extracts a single-row DataFrame formatted with the required feature columns.
        """
        if timestamp.tzinfo is None:
            timestamp = timestamp.replace(tzinfo=timezone.utc)

        departure_hour = timestamp.hour
        day_of_week = timestamp.weekday()
        is_peak = 1 if (7 <= departure_hour <= 10 or 17 <= departure_hour <= 21) else 0
        r_speed = rolling_speed_kmph if rolling_speed_kmph is not None else float(current_speed_kmph)
        severe_heat = is_severe_heat if is_severe_heat is not None else (1 if temperature_c >= 42.0 else 0)

        cols = feature_columns if feature_columns is not None else FEATURE_COLUMNS

        feature_dict: Dict[str, Any] = {
            "current_delay_minutes": float(current_delay_minutes),
            "current_speed_kmph": float(current_speed_kmph),
            "section_distance_km": float(section_distance_km),
            "scheduled_section_minutes": float(scheduled_section_minutes),
            "historical_avg_running_minutes": float(historical_avg_running_minutes),
            "historical_p90_running_minutes": float(historical_p90_running_minutes),
            "departure_hour": int(departure_hour),
            "day_of_week": int(day_of_week),
            "train_type_encoded": int(train_type_encoded),
            "recent_delay_change": float(recent_delay_change),
            "rolling_speed_kmph": float(r_speed),
            "is_peak_hours": int(is_peak),
            "temperature_c": float(temperature_c),
            "rainfall_mm_hr": float(rainfall_mm_hr),
            "visibility_km": float(visibility_km),
            "weather_condition_encoded": int(weather_condition_encoded),
            "elevation_gain_m": float(elevation_gain_m),
            "gradient_pct": float(gradient_pct),
            "junction_density": float(junction_density),
            "is_severe_heat": int(severe_heat)
        }

        # Filter to only the columns expected by the active model
        filtered_dict = {col: feature_dict.get(col, 0.0) for col in cols}
        return pd.DataFrame([filtered_dict], columns=pd.Index(cols))


