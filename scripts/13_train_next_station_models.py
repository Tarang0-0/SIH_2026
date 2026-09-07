"""Train Phase 2 next-station models from provider-actual labels.

The command intentionally refuses to train on an empty or tiny feedback set.
The existing destination-delay model remains the production model until this
station-level model has enough completed journeys and passes an untouched
chronological evaluation.
"""

from __future__ import annotations

import json
import time
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.metrics import mean_absolute_error


DATA_PATH = Path("data/station_level_training.csv")
MODELS_DIR = Path("models")
FEATURES = [
    "scheduled_minutes_to_next", "current_station_sequence", "next_station_sequence",
    "delay_at_current_minutes", "is_rescheduled", "rescheduled_by_minutes",
]
TARGETS = {"travel": "minutes_to_next", "delay": "delay_at_next_minutes"}


def make_model(alpha: float, estimators: int = 250) -> xgb.XGBRegressor:
    return xgb.XGBRegressor(
        objective="reg:quantileerror", quantile_alpha=alpha,
        n_estimators=estimators, max_depth=4, learning_rate=0.04,
        min_child_weight=5, subsample=0.85, colsample_bytree=0.9,
        reg_alpha=0.05, reg_lambda=1.0, tree_method="hist",
        random_state=42, n_jobs=-1,
    )


def main() -> None:
    started = time.time()
    if not DATA_PATH.exists():
        raise SystemExit(f"Missing {DATA_PATH}. Run scripts/build_station_level_dataset.py first.")
    frame = pd.read_csv(DATA_PATH)
    required = {"journey_date", "label_quality", *FEATURES, *TARGETS.values()}
    missing = required.difference(frame.columns)
    if missing:
        raise SystemExit(f"Phase 2 dataset is missing columns: {', '.join(sorted(missing))}")
    frame["journey_date"] = pd.to_datetime(frame["journey_date"], errors="coerce")
    for column in [*FEATURES, *TARGETS.values()]:
        frame[column] = pd.to_numeric(frame[column], errors="coerce")
    cancelled = (
        pd.to_numeric(frame["is_cancelled"], errors="coerce").fillna(0)
        if "is_cancelled" in frame.columns
        else pd.Series(0, index=frame.index)
    )
    frame = frame[
        frame["label_quality"].eq("provider_actual_arrivals")
        & cancelled.eq(0)
        & frame["journey_date"].notna()
        & frame["minutes_to_next"].between(0.1, 1440)
        & frame["delay_at_next_minutes"].between(0, 720)
    ].copy()
    if len(frame) < 50 or frame["journey_date"].dt.date.nunique() < 3:
        raise SystemExit(
            f"Not enough verified Phase 2 data: {len(frame)} rows across "
            f"{frame['journey_date'].dt.date.nunique()} dates; need at least 50 rows and 3 dates."
        )

    dates = np.sort(frame["journey_date"].dt.normalize().unique())
    split = max(1, int(len(dates) * 0.8))
    train = frame[frame["journey_date"].dt.normalize().isin(dates[:split])]
    test = frame[frame["journey_date"].dt.normalize().isin(dates[split:])]
    if train.empty or test.empty:
        raise SystemExit("Phase 2 chronological split produced an empty train or test set.")

    defaults = {column: float(train[column].median()) for column in FEATURES}
    X_train = train[FEATURES].fillna(defaults).astype("float32")
    X_test = test[FEATURES].fillna(defaults).astype("float32")
    metadata: dict[str, object] = {
        "model_version": "phase2-next-station-v1",
        "features": FEATURES,
        "data_source": str(DATA_PATH),
        "label_quality_required": "provider_actual_arrivals",
        "rows": int(len(frame)),
        "train_rows": int(len(train)),
        "test_rows": int(len(test)),
        "targets": {},
    }
    MODELS_DIR.mkdir(exist_ok=True)
    for target_name, target_column in TARGETS.items():
        y_train = train[target_column].to_numpy(dtype="float32")
        y_test = test[target_column].to_numpy(dtype="float32")
        target_meta: dict[str, object] = {}
        for label, alpha in (("p10", 0.10), ("p50", 0.50), ("p90", 0.90)):
            model = make_model(alpha)
            model.fit(X_train, y_train, verbose=False)
            joblib.dump(model, MODELS_DIR / f"phase2_{target_name}_{label}.pkl")
            prediction = model.predict(X_test)
            target_meta[f"{label}_mae_minutes"] = float(mean_absolute_error(y_test, prediction))
        metadata["targets"][target_name] = target_meta

    metadata["trained_at_utc"] = pd.Timestamp.utcnow().isoformat()
    (MODELS_DIR / "phase2_model_metadata.json").write_text(json.dumps(metadata, indent=2) + "\n")
    print(json.dumps(metadata, indent=2))
    print(f"Saved Phase 2 models in {time.time() - started:.1f}s")


if __name__ == "__main__":
    main()
