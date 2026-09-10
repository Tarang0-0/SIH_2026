"""Optional Phase 2 next-station model loading and inference."""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any, Optional

import joblib
import numpy as np
import pandas as pd


ROOT_DIR = Path(__file__).resolve().parents[2]
MODELS_DIR = ROOT_DIR / "models"
DATA_PATH = ROOT_DIR / "data" / "station_level_training.csv"
PHASE2_FEATURES = [
    "scheduled_minutes_to_next", "current_station_sequence", "next_station_sequence",
    "delay_at_current_minutes", "is_rescheduled", "rescheduled_by_minutes",
]
_models: dict[str, Any] = {}
_metadata: dict[str, Any] = {}
logger = logging.getLogger(__name__)


def load_phase2_models() -> tuple[dict[str, Any], dict[str, Any]]:
    global _models, _metadata
    _models, _metadata = {}, {}
    paths = {
        "travel_p10": MODELS_DIR / "phase2_travel_p10.pkl",
        "travel_p50": MODELS_DIR / "phase2_travel_p50.pkl",
        "travel_p90": MODELS_DIR / "phase2_travel_p90.pkl",
        "delay_p10": MODELS_DIR / "phase2_delay_p10.pkl",
        "delay_p50": MODELS_DIR / "phase2_delay_p50.pkl",
        "delay_p90": MODELS_DIR / "phase2_delay_p90.pkl",
    }
    if not all(path.exists() for path in paths.values()):
        return _models, _metadata
    try:
        loaded = {name: joblib.load(path) for name, path in paths.items()}
        contracts = {tuple(getattr(model, "feature_names_in_", ())) for model in loaded.values()}
        if contracts != {tuple(PHASE2_FEATURES)}:
            raise ValueError("Phase 2 model feature contracts do not match")
        metadata_path = MODELS_DIR / "phase2_model_metadata.json"
        metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
        if not isinstance(metadata, dict) or metadata.get("features") != PHASE2_FEATURES:
            raise ValueError("Phase 2 metadata feature contract is invalid")
        _models, _metadata = loaded, metadata
    except Exception:
        logger.exception("Phase 2 model artifacts are invalid; disabling Phase 2")
        _models, _metadata = {}, {}
    return _models, _metadata


def phase2_status() -> dict[str, Any]:
    rows = 0
    dates = 0
    try:
        frame = pd.read_csv(DATA_PATH, usecols=["journey_date", "label_quality"])
        verified = frame[frame["label_quality"].eq("provider_actual_arrivals")]
        rows = int(len(verified))
        dates = int(verified["journey_date"].nunique())
    except (OSError, ValueError, KeyError, pd.errors.ParserError):
        pass
    return {
        "active": bool(_models),
        "model_version": _metadata.get("model_version") if _metadata else None,
        "features": list(PHASE2_FEATURES),
        "data_gate": {
            "verified_rows": rows,
            "journey_dates": dates,
            "minimum_rows": 50,
            "minimum_dates": 3,
            "ready": rows >= 50 and dates >= 3,
        },
    }


def predict_phase2(features: dict[str, float]) -> Optional[dict[str, Any]]:
    if not _models:
        return None
    frame = pd.DataFrame([{name: features.get(name, 0.0) for name in PHASE2_FEATURES}], columns=PHASE2_FEATURES)
    try:
        values = {name: float(_models[name].predict(frame)[0]) for name in _models}
    except Exception:
        return None
    if not np.isfinite(list(values.values())).all():
        return None
    travel = [max(0.1, values[f"travel_{label}"]) for label in ("p10", "p50", "p90")]
    delay = [values[f"delay_{label}"] for label in ("p10", "p50", "p90")]
    travel[0], travel[2] = min(travel[0], travel[1]), max(travel[2], travel[1])
    delay[0], delay[2] = min(delay[0], delay[1]), max(delay[2], delay[1])
    return {
        "prediction_source": "phase2_next_station_model",
        "model_version": _metadata.get("model_version"),
        "predicted_minutes_to_next": travel[1], "p10_minutes_to_next": travel[0], "p90_minutes_to_next": travel[2],
        "predicted_delay_change_minutes": delay[1], "p10_delay_change_minutes": delay[0], "p90_delay_change_minutes": delay[2],
    }
