"""Train Phase 3 next-station movement and delay-propagation models.

The trainer is deliberately gated. It requires provider-confirmed future
arrivals and evaluates against a chronological holdout before saving any
artifacts. A timetable baseline predicts scheduled travel time; a
carry-forward baseline predicts zero delay change.
"""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.metrics import mean_absolute_error

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from api.services.phase3_dataset import PHASE3_FEATURES


DATA_PATH = Path("data/phase3_movement_training.csv")
MODELS_DIR = Path("models")
TARGETS = {"travel": "minutes_to_next", "delay_change": "delay_change_minutes"}


def pinball_loss(y_true: np.ndarray, y_pred: np.ndarray, alpha: float) -> float:
    error = y_true - y_pred
    return float(np.mean(np.maximum(alpha * error, (alpha - 1.0) * error)))


def make_model(alpha: float, estimators: int = 300) -> xgb.XGBRegressor:
    return xgb.XGBRegressor(
        objective="reg:quantileerror", quantile_alpha=alpha,
        n_estimators=estimators, max_depth=5, learning_rate=0.04,
        min_child_weight=5, subsample=0.85, colsample_bytree=0.9,
        reg_alpha=0.05, reg_lambda=1.0, tree_method="hist",
        random_state=42, n_jobs=-1,
    )


def main() -> None:
    started = time.time()
    if not DATA_PATH.exists():
        raise SystemExit(f"Missing {DATA_PATH}. Run scripts/build_phase3_movement_dataset.py first.")
    frame = pd.read_csv(DATA_PATH)
    required = {"journey_date", "label_quality", *PHASE3_FEATURES, *TARGETS.values()}
    missing = required.difference(frame.columns)
    if missing:
        raise SystemExit(f"Phase 3 dataset is missing columns: {', '.join(sorted(missing))}")
    frame["journey_date"] = pd.to_datetime(frame["journey_date"], errors="coerce")
    for column in [*PHASE3_FEATURES, *TARGETS.values()]:
        frame[column] = pd.to_numeric(frame[column], errors="coerce")
    frame = frame[
        frame["label_quality"].eq("provider_actual_arrival_after_snapshot")
        & frame["journey_date"].notna()
        & frame["minutes_to_next"].between(0.1, 1440)
    ].copy()
    if len(frame) < 100 or frame["journey_date"].dt.date.nunique() < 5:
        raise SystemExit(
            f"Not enough verified Phase 3 data: {len(frame)} rows across "
            f"{frame['journey_date'].dt.date.nunique()} dates; need at least 100 rows and 5 dates."
        )

    dates = np.sort(frame["journey_date"].dt.normalize().unique())
    split = max(1, int(len(dates) * 0.8))
    train = frame[frame["journey_date"].dt.normalize().isin(dates[:split])]
    test = frame[frame["journey_date"].dt.normalize().isin(dates[split:])]
    if train.empty or test.empty:
        raise SystemExit("Phase 3 chronological split produced an empty train or test set.")
    defaults = {column: float(train[column].median()) if train[column].notna().any() else 0.0 for column in PHASE3_FEATURES}
    X_train = train[PHASE3_FEATURES].fillna(defaults).astype("float32")
    X_test = test[PHASE3_FEATURES].fillna(defaults).astype("float32")
    metadata: dict[str, object] = {
        "model_version": "phase3-movement-v1",
        "features": PHASE3_FEATURES,
        "data_source": str(DATA_PATH),
        "label_quality_required": "provider_actual_arrival_after_snapshot",
        "rows": int(len(frame)), "train_rows": int(len(train)), "test_rows": int(len(test)),
        "targets": {}, "split": {"train_end": str(train.journey_date.max().date()), "test_start": str(test.journey_date.min().date())},
    }
    MODELS_DIR.mkdir(exist_ok=True)
    for target_name, target_column in TARGETS.items():
        target_frame = train[target_column].notna()
        test_target = test[target_column].notna()
        if int(target_frame.sum()) < 50 or int(test_target.sum()) < 10:
            raise SystemExit(f"Not enough non-null {target_name} labels for a chronological evaluation.")
        x_train_target = X_train.loc[target_frame]
        x_test_target = X_test.loc[test_target]
        y_train = train.loc[target_frame, target_column].to_numpy(dtype="float32")
        y_test = test.loc[test_target, target_column].to_numpy(dtype="float32")
        target_meta: dict[str, object] = {
            "baseline_mae_minutes": float(mean_absolute_error(
                y_test,
                test.loc[test_target, "scheduled_minutes_to_next"].fillna(defaults["scheduled_minutes_to_next"])
                if target_name == "travel" else np.zeros_like(y_test),
            )),
            "models": {},
        }
        predictions: dict[str, np.ndarray] = {}
        for label, alpha in (("p10", 0.10), ("p50", 0.50), ("p90", 0.90)):
            model = make_model(alpha)
            model.fit(x_train_target, y_train, verbose=False)
            joblib.dump(model, MODELS_DIR / f"phase3_{target_name}_{label}.pkl")
            predictions[label] = model.predict(x_test_target)
            target_meta["models"][label] = {
                "mae_minutes": float(mean_absolute_error(y_test, predictions[label])),
                "pinball_loss": pinball_loss(y_test, predictions[label], alpha),
            }
        metadata["targets"][target_name] = target_meta

    metadata["trained_at_utc"] = pd.Timestamp.utcnow().isoformat()
    (MODELS_DIR / "phase3_model_metadata.json").write_text(json.dumps(metadata, indent=2) + "\n")
    print(json.dumps(metadata, indent=2))
    print(f"Saved Phase 3 artifacts in {time.time() - started:.1f}s")


if __name__ == "__main__":
    main()
