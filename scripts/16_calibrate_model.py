"""Calibrate deployed ETA intervals on a chronological calibration split.

The final chronological slice remains an untouched promotion holdout. The
median is never changed; only interval bounds may be widened by split-
conformal residual radii. This script writes ``models/phase5_calibration.json``
and refuses to write it when the source is too small or malformed.
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from api.services.phase5_controls import calibration_bucket, calibration_metrics, conformal_radius


def load_training_module():
    path = ROOT_DIR / "scripts" / "12_train_ir_production.py"
    spec = importlib.util.spec_from_file_location("train_ir_production", path)
    if spec is None or spec.loader is None:
        raise RuntimeError("cannot load production training helpers")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def predict(models, frame: pd.DataFrame, training_module, defaults: dict[str, float]):
    features = training_module.make_features(frame, defaults)
    output = [models[label].predict(features) for label in ("p10", "p50", "p90")]
    p10, p50, p90 = output
    return np.minimum(p10, p50), p50, np.maximum(p90, p50)


def load_deployed_data(trainer) -> pd.DataFrame:
    """Rebuild the same compatible population used by the deployed trainer."""
    legacy = trainer.load_legacy_data()
    defaults = {
        column: float(pd.to_numeric(legacy[column], errors="coerce").median())
        for column in trainer.FEATURE_COLS
    }
    route_summary = trainer.build_route_summaries()
    online = trainer.load_online_completed_data(defaults, route_summary)
    online["_source_priority"] = 1
    online = online.sort_values(["departure_date", "_train_key", "_source_priority"])
    online = online.drop_duplicates(["_train_key", "departure_date"], keep="last")
    data = legacy.copy() if online.empty else pd.concat([legacy, online], ignore_index=True)
    return data.sort_values("departure_date").reset_index(drop=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--max-rows", type=int, default=100000)
    parser.add_argument("--min-calibration-rows", type=int, default=1000)
    parser.add_argument("--target-coverage", type=float, default=0.80)
    args = parser.parse_args()
    if not 0.5 < args.target_coverage < 1:
        raise SystemExit("--target-coverage must be between 0.5 and 1")

    trainer = load_training_module()
    data = load_deployed_data(trainer)
    if len(data) < args.min_calibration_rows * 2:
        raise SystemExit("not enough compatible rows for chronological calibration and holdout")
    try:
        _, calibration, holdout = trainer.temporal_split(data)
    except ValueError as error:
        raise SystemExit(str(error)) from error
    if len(calibration) > args.max_rows:
        calibration = calibration.sort_values("departure_date").iloc[::max(1, len(calibration) // args.max_rows)].head(args.max_rows)
    if len(holdout) > args.max_rows:
        holdout = holdout.sort_values("departure_date").iloc[::max(1, len(holdout) // args.max_rows)].head(args.max_rows)
    if len(calibration) < args.min_calibration_rows or len(holdout) < args.min_calibration_rows:
        raise SystemExit("calibration and untouched holdout each need the configured minimum rows")

    metadata_path = ROOT_DIR / "models" / "model_metadata.json"
    metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
    defaults_path = ROOT_DIR / "models" / "feature_defaults.json"
    train_defaults = json.loads(defaults_path.read_text(encoding="utf-8")) if defaults_path.exists() else {
        column: float(pd.to_numeric(calibration[column], errors="coerce").median())
        for column in trainer.FEATURE_COLS
    }
    model_files = {"p10": "eta_quantile_p10.pkl", "p50": "eta_regressor.pkl", "p90": "eta_quantile_p90.pkl"}
    models = {label: joblib.load(ROOT_DIR / "models" / filename) for label, filename in model_files.items()}
    cal_p10, cal_p50, cal_p90 = predict(models, calibration, trainer, train_defaults)
    hold_p10, hold_p50, hold_p90 = predict(models, holdout, trainer, train_defaults)
    y_cal = calibration[trainer.TARGET].to_numpy(dtype=float)
    y_hold = holdout[trainer.TARGET].to_numpy(dtype=float)
    global_radius = conformal_radius(y_cal, cal_p10, cal_p90, args.target_coverage)
    buckets: dict[str, dict[str, float | int]] = {}
    bucket_values: dict[str, list[float]] = {}
    # The compatible journey-level sources do not carry a pre-snapshot delay.
    # Do not silently classify every row as delay:high; use the global radius
    # until a real current-delay calibration population is available.
    bucket_features = None
    if "delay_at_previous_station" in calibration.columns:
        bucket_features = calibration.apply(
            lambda row: calibration_bucket({
                "current_delay": row.get("delay_at_previous_station"),
                "scheduled_travel_hours": row.get("scheduled_travel_hours"),
            }), axis=1
        )
    nonconformity = np.maximum.reduce([cal_p10 - y_cal, y_cal - cal_p90, np.zeros(len(y_cal))])
    if bucket_features is not None:
        for key, value in zip(bucket_features, nonconformity):
            bucket_values.setdefault(str(key), []).append(float(value))
    for key, values in bucket_values.items():
        if len(values) >= 250:
            buckets[key] = {
                "rows": len(values),
                "radius_minutes": conformal_radius(
                    np.asarray(values), np.zeros(len(values)), np.zeros(len(values)), args.target_coverage
                ),
            }

    hold_p10_cal = hold_p10.copy()
    hold_p90_cal = hold_p90.copy()
    hold_features = None
    if "delay_at_previous_station" in holdout.columns:
        hold_features = holdout.apply(
            lambda row: calibration_bucket({
                "current_delay": row.get("delay_at_previous_station"),
                "scheduled_travel_hours": row.get("scheduled_travel_hours"),
            }), axis=1
        )
    for index, key in enumerate(hold_features if hold_features is not None else [None] * len(holdout)):
        radius = buckets.get(str(key), {}).get("radius_minutes", global_radius) if hold_features is not None else global_radius
        hold_p10_cal[index] = max(0.0, hold_p10_cal[index] - float(radius))
        hold_p90_cal[index] = max(hold_p50[index], hold_p90_cal[index] + float(radius))
    before = calibration_metrics(y_hold, hold_p10, hold_p50, hold_p90)
    after = calibration_metrics(y_hold, hold_p10_cal, hold_p50, hold_p90_cal)
    artifact = {
        "version": "phase5-conformal-v1",
        "target_coverage": args.target_coverage,
        "global_radius_minutes": global_radius,
        "min_bucket_rows": 250,
        "buckets": buckets,
        "source": "deployed_compatible_population",
        "calibration_period": {"start": str(calibration.departure_date.min().date()), "end": str(calibration.departure_date.max().date())},
        "untouched_holdout_period": {"start": str(holdout.departure_date.min().date()), "end": str(holdout.departure_date.max().date())},
        "calibration_rows": len(calibration),
        "holdout_rows": len(holdout),
        "holdout_metrics_before": before,
        "holdout_metrics_after": after,
        "trained_model_version": metadata.get("model_version", "unknown"),
    }
    (ROOT_DIR / "models" / "phase5_calibration.json").write_text(json.dumps(artifact, indent=2) + "\n")
    registry_path = ROOT_DIR / "models" / "model_registry.json"
    if not registry_path.exists():
        registry_path.write_text(json.dumps({
            "current_model_version": artifact["trained_model_version"],
            "history": [{"model_version": artifact["trained_model_version"], "status": "existing-baseline"}],
        }, indent=2) + "\n")
    print(json.dumps(artifact, indent=2))


if __name__ == "__main__":
    main()
