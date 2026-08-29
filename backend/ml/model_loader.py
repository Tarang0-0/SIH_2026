"""
RailETA Model Loader Utility
Problem Statement: SIH26028 (Dynamic Forecast of ETA for Coaching Trains)

Provides cached, thread-safe loading of the serialized ML model and feature metadata.
"""

import os
import json
import logging
from typing import Tuple, Dict, Any, Optional
import joblib

logger = logging.getLogger("raileta.model_loader")

# Cached in-memory instances (Singleton pattern for high-throughput API)
_CACHED_MODEL: Optional[Any] = None
_CACHED_METADATA: Optional[Dict[str, Any]] = None


def get_model_paths() -> Tuple[str, str]:
    """Returns absolute paths to model.joblib and model_metadata.json."""
    base_dir = os.path.dirname(os.path.abspath(__file__))
    models_dir = os.path.join(base_dir, "models")
    model_path = os.path.join(models_dir, "eta_model.joblib")
    metadata_path = os.path.join(models_dir, "model_metadata.json")
    return model_path, metadata_path


def load_model(force_reload: bool = False) -> Tuple[Any, Dict[str, Any]]:
    """
    Loads and caches the trained GBDT/XGBoost model and its metadata JSON.
    
    Returns:
        (model, metadata_dict)
    """
    global _CACHED_MODEL, _CACHED_METADATA

    if _CACHED_MODEL is not None and _CACHED_METADATA is not None and not force_reload:
        return _CACHED_MODEL, _CACHED_METADATA

    model_path, metadata_path = get_model_paths()

    if not os.path.exists(model_path) or not os.path.exists(metadata_path):
        raise FileNotFoundError(
            f"ML model artifacts not found. Expected:\n- {model_path}\n- {metadata_path}\n"
            f"Please run 'python3 scripts/train_xgb_model.py' to generate the trained model."
        )

    logger.info(f"Loading trained ML model from: {model_path}")
    model = joblib.load(model_path)

    logger.info(f"Loading model metadata from: {metadata_path}")
    with open(metadata_path, "r") as f:
        metadata = json.load(f)

    _CACHED_MODEL = model
    _CACHED_METADATA = metadata
    return model, metadata
