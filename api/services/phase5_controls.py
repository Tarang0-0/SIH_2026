"""Phase 5 calibration, drift, and safe model-promotion controls.

The controls are deliberately conservative: calibration may widen an interval,
never move the median forecast, and model promotion requires an untouched
holdout, enough rows, a better median error, and target interval coverage.
"""

from __future__ import annotations

import datetime as dt
import json
import math
import os
from pathlib import Path
from typing import Any, Optional

import numpy as np


ROOT_DIR = Path(__file__).resolve().parents[2]
CALIBRATION_PATH = ROOT_DIR / "models" / "phase5_calibration.json"
REGISTRY_PATH = ROOT_DIR / "models" / "model_registry.json"
DEFAULT_TARGET_COVERAGE = 0.80
DEFAULT_MIN_PROMOTION_ROWS = 100
_calibration: dict[str, Any] = {}


def _finite(value: Any) -> Optional[float]:
    try:
        number = float(value)
        return number if math.isfinite(number) else None
    except (TypeError, ValueError):
        return None


def _bucket(value: Any, thresholds: tuple[float, ...], labels: tuple[str, ...]) -> str:
    number = _finite(value)
    if number is None:
        return labels[-1]
    for threshold, label in zip(thresholds, labels):
        if number < threshold:
            return label
    return labels[-1]


def calibration_bucket(features: dict[str, Any]) -> str:
    delay = _bucket(features.get("current_delay"), (15, 60), ("low", "medium", "high"))
    horizon = _bucket(features.get("scheduled_travel_hours"), (4, 12), ("short", "medium", "long"))
    return f"delay:{delay}|horizon:{horizon}"


def load_phase5_calibration(path: Path = CALIBRATION_PATH, force: bool = False) -> dict[str, Any]:
    global _calibration
    if _calibration and not force:
        return _calibration
    _calibration = {}
    try:
        loaded = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(loaded, dict) and float(loaded.get("global_radius_minutes", -1)) >= 0:
            _calibration = loaded
    except (OSError, ValueError, TypeError):
        pass
    return _calibration


def phase5_status() -> dict[str, Any]:
    current = None
    registry_path = Path(os.getenv("RAILPULSE_MODEL_REGISTRY", str(REGISTRY_PATH)))
    try:
        registry = json.loads(registry_path.read_text(encoding="utf-8"))
        current = registry.get("current_model_version") if isinstance(registry, dict) else None
    except (OSError, ValueError, TypeError):
        pass
    return {
        "calibration_active": bool(_calibration),
        "calibration_version": _calibration.get("version") if _calibration else None,
        "target_coverage_percent": round(float(_calibration.get("target_coverage", 0)) * 100, 2) if _calibration else None,
        "model_registry_present": registry_path.exists(),
        "current_model_version": current,
    }


def apply_interval_calibration(
    p10: float, p50: float, p90: float, features: Optional[dict[str, Any]] = None
) -> tuple[float, float, float, Optional[str]]:
    """Widen prediction bounds using an offline conformal radius, if promoted."""
    if not _calibration:
        return p10, p50, p90, None
    bucket = calibration_bucket(features or {})
    bucket_info = (_calibration.get("buckets") or {}).get(bucket, {})
    radius = bucket_info.get("radius_minutes") if bucket_info.get("rows", 0) >= _calibration.get("min_bucket_rows", 250) else None
    if radius is None:
        radius = _calibration.get("global_radius_minutes", 0)
    radius = max(0.0, float(radius or 0.0))
    return max(0.0, p10 - radius), p50, max(p50, p90 + radius), bucket


def conformal_radius(y_true: np.ndarray, p10: np.ndarray, p90: np.ndarray, coverage: float) -> float:
    """Finite-sample split-conformal interval expansion radius."""
    y_true = np.asarray(y_true, dtype=float)
    p10, p90 = np.asarray(p10, dtype=float), np.asarray(p90, dtype=float)
    valid = np.isfinite(y_true) & np.isfinite(p10) & np.isfinite(p90)
    if int(valid.sum()) < 1:
        raise ValueError("calibration requires at least one finite row")
    nonconformity = np.maximum.reduce([p10[valid] - y_true[valid], y_true[valid] - p90[valid], np.zeros(int(valid.sum()))])
    level = min(1.0, max(0.0, float(coverage)))
    quantile = min(1.0, math.ceil((len(nonconformity) + 1) * level) / len(nonconformity))
    return float(max(0.0, np.quantile(nonconformity, quantile, method="higher")))


def calibration_metrics(y_true: np.ndarray, p10: np.ndarray, p50: np.ndarray, p90: np.ndarray) -> dict[str, float]:
    y_true = np.asarray(y_true, dtype=float)
    p10, p50, p90 = np.asarray(p10), np.asarray(p50), np.asarray(p90)
    valid = np.isfinite(y_true) & np.isfinite(p10) & np.isfinite(p50) & np.isfinite(p90)
    if not valid.any():
        raise ValueError("metrics require at least one finite row")
    return {
        "rows": int(valid.sum()),
        "p50_mae_minutes": float(np.mean(np.abs(y_true[valid] - p50[valid]))),
        "interval_coverage": float(np.mean((y_true[valid] >= p10[valid]) & (y_true[valid] <= p90[valid]))),
        "mean_interval_width_minutes": float(np.mean(p90[valid] - p10[valid])),
    }


def population_stability_index(reference: Any, current: Any, bins: int = 10) -> Optional[float]:
    """Calculate PSI with fixed reference quantile bins; None means unusable."""
    ref = np.asarray(list(reference), dtype=float)
    cur = np.asarray(list(current), dtype=float)
    ref, cur = ref[np.isfinite(ref)], cur[np.isfinite(cur)]
    if len(ref) < 20 or len(cur) < 20:
        return None
    edges = np.unique(np.quantile(ref, np.linspace(0, 1, bins + 1)))
    if len(edges) < 3:
        return 0.0
    ref_counts, _ = np.histogram(ref, bins=edges)
    cur_counts, _ = np.histogram(cur, bins=edges)
    ref_share = np.maximum(ref_counts / len(ref), 1e-6)
    cur_share = np.maximum(cur_counts / len(cur), 1e-6)
    return float(np.sum((cur_share - ref_share) * np.log(cur_share / ref_share)))


def error_by_segment(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    grouped: dict[str, list[float]] = {}
    for row in rows:
        error = _finite(row.get("error_minutes"))
        if error is None:
            continue
        key = f"{str(row.get('current_station') or 'UNKNOWN')}->{str(row.get('station_code') or 'UNKNOWN')}"
        grouped.setdefault(key, []).append(abs(error))
    return [
        {"segment": key, "rows": len(values), "mae_minutes": round(float(np.mean(values)), 3)}
        for key, values in sorted(grouped.items())
    ]


def promote_model(
    candidate: dict[str, Any],
    registry_path: Path = REGISTRY_PATH,
    *,
    min_rows: int = DEFAULT_MIN_PROMOTION_ROWS,
) -> dict[str, Any]:
    """Promote only a candidate with explicit untouched-holdout evidence."""
    version = str(candidate.get("model_version") or "").strip()
    evaluation = candidate.get("evaluation") if isinstance(candidate.get("evaluation"), dict) else {}
    holdout = candidate.get("holdout") if isinstance(candidate.get("holdout"), dict) else {}
    rows = int(evaluation.get("rows", 0) or 0)
    current_mae = _finite(evaluation.get("p50_mae_minutes"))
    previous_mae = _finite(candidate.get("previous_p50_mae_minutes"))
    coverage = _finite(evaluation.get("interval_coverage"))
    target = _finite(candidate.get("target_coverage")) or DEFAULT_TARGET_COVERAGE
    checks = {
        "version_present": bool(version),
        "enough_rows": rows >= min_rows,
        "untouched_holdout": holdout.get("untouched") is True,
        "beats_previous": previous_mae is not None and current_mae is not None and current_mae < previous_mae,
        "coverage_target_met": coverage is not None and coverage >= target,
    }
    if not all(checks.values()):
        raise ValueError(f"candidate is not safe to promote: {checks}")
    try:
        registry = json.loads(registry_path.read_text(encoding="utf-8"))
        if not isinstance(registry, dict):
            raise ValueError("model registry must be an object")
    except (OSError, ValueError, TypeError):
        registry = {"history": []}
    previous = registry.get("current_model_version")
    entry = {
        "model_version": version, "promoted_at_utc": dt.datetime.now(dt.timezone.utc).isoformat(),
        "evaluation": evaluation, "holdout": holdout, "previous_model_version": previous,
    }
    history = registry.get("history") if isinstance(registry.get("history"), list) else []
    registry.update({"current_model_version": version, "current": entry, "history": [*history, entry]})
    registry_path.parent.mkdir(parents=True, exist_ok=True)
    registry_path.write_text(json.dumps(registry, indent=2) + "\n", encoding="utf-8")
    return entry


load_phase5_calibration()
