"""Train ETA models using only live feedback data when ir_train.csv is absent.

This script is triggered automatically by 20_daily_learning.py when the base
IR dataset is not present (e.g. on Render or any deployment where the 337 MB
file cannot be stored). It uses the online_completed_journeys.csv produced by
the live feedback store and builds the same feature contract as the production
trainer so the resulting .pkl files are fully compatible with the running API.

Minimum data gate: 30 completed journeys across at least 3 distinct dates.
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

ROOT_DIR = Path(__file__).resolve().parents[1]
ONLINE_PATH = ROOT_DIR / "data" / "online_completed_journeys.csv"
ROUTES_INDEX_PATH = ROOT_DIR / "data" / "train_routes_index.json"
ROUTE_DETAILS_PATH = ROOT_DIR / "data" / "Train_details_22122017.csv"
SCHEDULES_PATH = ROOT_DIR / "data" / "train_schedules.csv"
MODELS_DIR = ROOT_DIR / "models"
TARGET = "delay_minutes"
MAX_DELAY_MINUTES = 720
RANDOM_STATE = 42
MIN_ROWS = 30
MIN_DATES = 3

FEATURE_COLS = [
    "distance_km", "num_scheduled_stops", "scheduled_travel_hours",
    "departure_hour", "day_of_week", "month", "is_weekend",
    "is_night_departure", "is_peak_hour", "is_festival_season",
    "is_monsoon_season", "is_fog_risk", "fog_risk_score",
    "zone_fog_index", "zone_congestion_index", "season_severity_score",
    "track_doubled", "is_hdn_route", "is_electrified", "psr_count",
    "seat_utilisation_pct", "is_station_feed",
]


def normalize_train_number(value: object) -> str:
    text = str(value or "").strip()
    if not text or text.lower() == "nan":
        return ""
    return text.lstrip("0") or "0"


def _parse_time_hour(value: object, default: float = 12.0) -> float:
    import re
    match = re.match(r"^(\d{1,2})", str(value or ""))
    if not match:
        return default
    return float(min(23, max(0, int(match.group(1)))))


def _parse_duration_hours(value: object) -> float | None:
    import re
    text = str(value or "").lower()
    hm = re.search(r"(\d+(?:\.\d+)?)\s*h", text)
    mm = re.search(r"(\d+(?:\.\d+)?)\s*m", text)
    if not hm and not mm:
        return None
    return (float(hm.group(1)) if hm else 0.0) + (float(mm.group(1)) if mm else 0.0) / 60.0


def build_route_summary() -> dict[str, dict[str, float]]:
    """Build departure_hour, distance, stops, travel_hours per train."""
    summary: dict[str, dict[str, float]] = {}

    if ROUTES_INDEX_PATH.exists():
        print("  Loading route features from train_routes_index.json...")
        with ROUTES_INDEX_PATH.open(encoding="utf-8") as fh:
            index: dict = json.load(fh)
        for train_no, info in index.items():
            if not isinstance(info, dict):
                continue
            stops = info.get("stops")
            if not isinstance(stops, list) or len(stops) < 2:
                continue
            try:
                stops_sorted = sorted(stops, key=lambda s: int(s.get("seq", 0)))
                dists = [float(s.get("dist", 0) or 0) for s in stops_sorted]
                distance_km = max(dists) if dists else float("nan")
                num_stops = float(len(stops_sorted))
                first_sched = str(stops_sorted[0].get("sched", "12:00"))[:5]
                dep_hour = float(int(first_sched.split(":")[0])) if ":" in first_sched else 12.0

                def clock_min(t: str) -> int:
                    h, m = t.split(":")
                    return int(h) * 60 + int(m)

                clocks = [clock_min(str(s.get("sched", "00:00"))[:5]) for s in stops_sorted]
                elapsed = clocks[-1] - clocks[0]
                if elapsed <= 0:
                    elapsed += 1440
                travel_hours = elapsed / 60.0

                summary[normalize_train_number(train_no)] = {
                    "distance_km": distance_km,
                    "num_scheduled_stops": num_stops,
                    "scheduled_travel_hours": min(72.0, max(0.1, travel_hours)),
                    "departure_hour": dep_hour,
                }
            except (ValueError, TypeError, KeyError):
                continue
        print(f"  -> {len(summary)} trains found in routes index")

    if ROUTE_DETAILS_PATH.exists():
        details = pd.read_csv(
            ROUTE_DETAILS_PATH,
            usecols=["Train No", "SEQ", "Arrival time", "Departure Time", "Distance"],
            dtype={"Train No": "string"}, low_memory=False,
        )
        details["train_key"] = details["Train No"].map(normalize_train_number)
        details["seq_num"] = pd.to_numeric(details["SEQ"], errors="coerce")
        details["dist_num"] = pd.to_numeric(details["Distance"], errors="coerce")
        details = details.dropna(subset=["train_key", "seq_num"])
        for train_key, grp in details.groupby("train_key", sort=False):
            if train_key in summary:
                continue
            ordered = grp.sort_values("seq_num")
            dep_hour = _parse_time_hour(ordered.iloc[0]["Departure Time"])
            fd = pd.to_datetime(ordered.iloc[0]["Departure Time"], format="%H:%M:%S", errors="coerce")
            la = pd.to_datetime(ordered.iloc[-1]["Arrival time"], format="%H:%M:%S", errors="coerce")
            th = None
            if pd.notna(fd) and pd.notna(la):
                mins = (la.hour * 60 + la.minute) - (fd.hour * 60 + fd.minute)
                if mins <= 0:
                    mins += 1440
                th = min(72.0, max(0.1, mins / 60.0))
            summary[train_key] = {
                "distance_km": float(ordered["dist_num"].max()) if ordered["dist_num"].notna().any() else float("nan"),
                "num_scheduled_stops": float(ordered["seq_num"].max()),
                "scheduled_travel_hours": th if th is not None else float("nan"),
                "departure_hour": dep_hour,
            }

    if SCHEDULES_PATH.exists():
        scheds = pd.read_csv(SCHEDULES_PATH, dtype={"train_number": "string"})
        for row in scheds.to_dict("records"):
            key = normalize_train_number(row.get("train_number"))
            if key in summary:
                continue
            summary[key] = {
                "distance_km": pd.to_numeric(pd.Series([row.get("distance_km")]), errors="coerce").iloc[0],
                "num_scheduled_stops": pd.to_numeric(pd.Series([row.get("total_halts")]), errors="coerce").iloc[0],
                "scheduled_travel_hours": _parse_duration_hours(row.get("duration")),
                "departure_hour": _parse_time_hour(row.get("departure_time")),
            }

    return summary


def load_online_data(route_summary: dict[str, dict[str, float]]) -> pd.DataFrame:
    columns = ["departure_date", "_train_key", TARGET, *FEATURE_COLS]
    if not ONLINE_PATH.exists():
        return pd.DataFrame(columns=columns)

    frame = pd.read_csv(ONLINE_PATH, dtype={"train_number": "string"})
    required = {"train_number", "journey_date", "delay_minutes"}
    if not required.issubset(frame.columns):
        print(f"  WARNING: online_completed_journeys.csv missing columns: {required - set(frame.columns)}")
        return pd.DataFrame(columns=columns)

    frame["departure_date"] = pd.to_datetime(frame["journey_date"], errors="coerce")
    frame["_train_key"] = frame["train_number"].map(normalize_train_number)
    frame[TARGET] = pd.to_numeric(frame["delay_minutes"], errors="coerce")
    frame = frame[
        frame["departure_date"].notna()
        & frame["_train_key"].ne("")
        & frame[TARGET].between(0, MAX_DELAY_MINUTES)
    ].copy()

    if frame.empty:
        return pd.DataFrame(columns=columns)

    dates = frame["departure_date"]
    months = dates.dt.month
    route_values = frame["_train_key"].map(route_summary)

    for col in ("distance_km", "num_scheduled_stops", "scheduled_travel_hours", "departure_hour"):
        frame[col] = route_values.map(lambda v, c=col: v.get(c) if isinstance(v, dict) else float("nan"))

    frame["day_of_week"] = dates.dt.dayofweek
    frame["month"] = months
    frame["is_weekend"] = dates.dt.dayofweek.isin([5, 6]).astype(float)
    frame["is_night_departure"] = (
        frame["departure_hour"].between(22, 23) | frame["departure_hour"].between(0, 5)
    ).astype(float)
    frame["is_peak_hour"] = frame["departure_hour"].isin([7, 8, 9, 17, 18, 19]).astype(float)
    frame["is_festival_season"] = months.isin([10, 11]).astype(float)
    frame["is_monsoon_season"] = months.isin([6, 7, 8, 9]).astype(float)
    frame["is_fog_risk"] = months.isin([11, 12, 1, 2]).astype(float)
    frame["fog_risk_score"] = frame["is_fog_risk"]
    frame["season_severity_score"] = np.select(
        [frame["is_monsoon_season"].eq(1), frame["is_fog_risk"].eq(1)],
        [0.78, 0.65], default=0.35,
    )
    for col in ("zone_fog_index", "zone_congestion_index", "track_doubled",
                "is_hdn_route", "is_electrified", "psr_count", "seat_utilisation_pct"):
        frame[col] = float("nan")
    frame["is_station_feed"] = 1.0

    return frame[columns]


def make_features(df: pd.DataFrame, defaults: dict[str, float]) -> pd.DataFrame:
    features = df[FEATURE_COLS].copy().apply(pd.to_numeric, errors="coerce")
    for col in FEATURE_COLS:
        features[col] = features[col].replace([float("inf"), float("-inf")], float("nan")).fillna(defaults[col])
    return features.astype("float32")


def train_quantile(
    X_train: pd.DataFrame, y_train: np.ndarray,
    X_val: pd.DataFrame, y_val: np.ndarray,
    alpha: float, n_estimators: int = 200,
) -> xgb.XGBRegressor:
    model = xgb.XGBRegressor(
        objective="reg:quantileerror",
        quantile_alpha=alpha,
        n_estimators=n_estimators,
        max_depth=5,
        learning_rate=0.07,
        min_child_weight=5,
        subsample=0.85,
        colsample_bytree=0.90,
        reg_alpha=0.05,
        reg_lambda=1.0,
        tree_method="hist",
        random_state=RANDOM_STATE,
        n_jobs=-1,
        early_stopping_rounds=20,
    )
    model.fit(X_train, y_train, eval_set=[(X_val, y_val)], verbose=False)
    return model


def main() -> None:
    print("=" * 60)
    print("RailTrackr -- Online-Only ETA Model Training")
    print("=" * 60)

    print("\n[1/5] Checking online_completed_journeys.csv...")
    if not ONLINE_PATH.exists():
        print(f"  NOT FOUND: {ONLINE_PATH}")
        print("  The model will be retrained once the API has collected enough")
        print("  completed journeys via live-eta / live-stream endpoints.")
        sys.exit(1)

    raw = pd.read_csv(ONLINE_PATH, dtype={"train_number": "string"})
    n_dates = raw["journey_date"].nunique() if "journey_date" in raw.columns else 0
    n_rows = len(raw)
    print(f"  Rows: {n_rows}  |  Distinct dates: {n_dates}")

    if n_rows < MIN_ROWS or n_dates < MIN_DATES:
        print(f"  Data gate not met: need >= {MIN_ROWS} rows and >= {MIN_DATES} dates.")
        print("  Keep the API running with RAILPULSE_DAILY_COLLECT=true to accumulate data.")
        sys.exit(2)

    print(f"  Data gate passed ({n_rows} rows, {n_dates} dates)")

    print("\n[2/5] Building route feature summary...")
    route_summary = build_route_summary()

    print("\n[3/5] Featurizing online journeys...")
    data = load_online_data(route_summary)
    if data.empty or len(data) < MIN_ROWS:
        print("  Not enough rows after feature engineering. Exiting.")
        sys.exit(2)

    data = data.sort_values("departure_date").reset_index(drop=True)
    n = len(data)
    # Keep validation chronological even for the minimum data gate. A random
    # fallback would let future journeys influence early-stopping decisions.
    validation_rows = max(3, int(round(n * 0.10)))
    validation_rows = min(validation_rows, n - 1)
    train_df = data.iloc[:-validation_rows]
    val_df = data.iloc[-validation_rows:]

    defaults = {col: float(pd.to_numeric(train_df[col], errors="coerce").median()) for col in FEATURE_COLS}
    X_train = make_features(train_df, defaults)
    y_train = train_df[TARGET].to_numpy(dtype="float32")
    X_val = make_features(val_df, defaults)
    y_val = val_df[TARGET].to_numpy(dtype="float32")
    print(f"  Train: {len(X_train):,}  |  Val: {len(X_val):,}")

    MODELS_DIR.mkdir(exist_ok=True)
    print("\n[4/5] Training quantile models...")
    t0 = time.time()

    for label, alpha, path in [
        ("p50", 0.50, MODELS_DIR / "eta_regressor.pkl"),
        ("p10", 0.10, MODELS_DIR / "eta_quantile_p10.pkl"),
        ("p90", 0.90, MODELS_DIR / "eta_quantile_p90.pkl"),
    ]:
        print(f"  -> Training {label} (alpha={alpha})...")
        model = train_quantile(X_train, y_train, X_val, y_val, alpha)
        joblib.dump(model, path)
        print(f"     Saved {path.name} ({time.time() - t0:.1f}s)")

    print("\n[5/5] Evaluating and writing metadata...")
    p50 = joblib.load(MODELS_DIR / "eta_regressor.pkl")
    preds = p50.predict(X_val)
    mae = float(np.mean(np.abs(y_val - preds)))
    print(f"  Validation MAE: {mae:.2f} minutes")

    import datetime as dt
    version = f"online-{dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%S')}"
    metadata = {
        "model_version": version,
        "trained_at_utc": dt.datetime.now(dt.timezone.utc).isoformat(),
        "training_source": "online_completed_journeys",
        "train_rows": len(X_train),
        "val_mae_minutes": round(mae, 3),
        "features": FEATURE_COLS,
    }
    (MODELS_DIR / "model_metadata.json").write_text(
        json.dumps(metadata, indent=2) + "\n", encoding="utf-8"
    )
    (MODELS_DIR / "feature_defaults.json").write_text(
        json.dumps(defaults, indent=2) + "\n", encoding="utf-8"
    )
    print(f"  Model version: {version}")
    print("\n" + "=" * 60)
    print("ONLINE-ONLY MODELS TRAINED SUCCESSFULLY")
    print("=" * 60)


if __name__ == "__main__":
    main()
