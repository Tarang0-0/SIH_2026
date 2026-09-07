"""Train the deployable ETA models from all compatible project data.

The project contains two supervised sources:

* ``ir_train.csv``: journey-level training rows with the complete model
  feature contract.
* ``combined_delay_*.csv``: station-level observations from the newer feed.

The station feed is ingested in chunks, invalid delay values are rejected, and
all valid observations are reduced to the latest/highest station observation
for each train/date. This prevents trains with more station rows from being
overweighted while producing the same journey-level target used by the model.
The final 10% of calendar dates remains a strict holdout for honest metrics;
deployable artifacts are fit on the earlier 90% after validation.
"""

from __future__ import annotations

import json
import re
import time
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.metrics import mean_absolute_error, mean_squared_error

DATA_PATH = Path("data/ir_train.csv")
HISTORY_PATH = Path("data/train_delays.csv")
ONLINE_HISTORY_PATH = Path("data/online_completed_journeys.csv")
ROUTE_DETAILS_PATH = Path("data/Train_details_22122017.csv")
SCHEDULES_PATH = Path("data/train_schedules.csv")
COMBINED_PATTERN = "combined_delay_*.csv"
MODELS_DIR = Path("models")
TARGET = "delay_minutes"
RANDOM_STATE = 42
MAX_DELAY_MINUTES = 720
VALIDATION_ESTIMATORS = 400

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
    stripped = text.lstrip("0")
    return stripped or "0"


def parse_time_hour(value: object, default: float = 12.0) -> float:
    match = re.match(r"^(\d{1,2})", str(value or ""))
    if not match:
        return default
    return float(min(23, max(0, int(match.group(1)))))


def parse_duration_hours(value: object) -> float | None:
    text = str(value or "").lower()
    hour_match = re.search(r"(\d+(?:\.\d+)?)\s*h", text)
    minute_match = re.search(r"(\d+(?:\.\d+)?)\s*m", text)
    if not hour_match and not minute_match:
        return None
    hours = float(hour_match.group(1)) if hour_match else 0.0
    minutes = float(minute_match.group(1)) if minute_match else 0.0
    return hours + minutes / 60.0


def pinball_loss(y_true: np.ndarray, y_pred: np.ndarray, alpha: float) -> float:
    error = y_true - y_pred
    return float(np.mean(np.maximum(alpha * error, (alpha - 1.0) * error)))


def temporal_split(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    dates = np.sort(df["departure_date"].dt.normalize().unique())
    if len(dates) < 30:
        raise ValueError("At least 30 departure dates are required for a temporal split.")
    train_end = max(1, int(len(dates) * 0.80))
    validation_end = max(train_end + 1, int(len(dates) * 0.90))
    return (
        df[df["departure_date"].dt.normalize().isin(dates[:train_end])].copy(),
        df[df["departure_date"].dt.normalize().isin(dates[train_end:validation_end])].copy(),
        df[df["departure_date"].dt.normalize().isin(dates[validation_end:])].copy(),
    )


def make_features(df: pd.DataFrame, defaults: dict[str, float]) -> pd.DataFrame:
    features = df.loc[:, FEATURE_COLS].copy().apply(pd.to_numeric, errors="coerce")
    for column in FEATURE_COLS:
        features[column] = features[column].replace([np.inf, -np.inf], np.nan).fillna(defaults[column])
    return features.astype("float32")


def load_legacy_data() -> pd.DataFrame:
    required = ["departure_date", "train_number", TARGET, *(column for column in FEATURE_COLS if column != "is_station_feed")]
    data = pd.read_csv(DATA_PATH, usecols=required, parse_dates=["departure_date"])
    data["_train_key"] = data["train_number"].map(normalize_train_number)
    data[TARGET] = pd.to_numeric(data[TARGET], errors="coerce")
    data = data.dropna(subset=["departure_date", TARGET])
    data = data[data["_train_key"].ne("")]
    data = data[data[TARGET].between(0, MAX_DELAY_MINUTES)].copy()
    data["is_station_feed"] = 0.0
    return data


def build_route_summaries() -> dict[str, dict[str, float]]:
    """Build timetable-derived features for station-feed train numbers."""
    summary: dict[str, dict[str, float]] = {}
    if ROUTE_DETAILS_PATH.exists():
        details = pd.read_csv(
            ROUTE_DETAILS_PATH,
            usecols=["Train No", "SEQ", "Arrival time", "Departure Time", "Distance"],
            dtype={"Train No": "string"},
            low_memory=False,
        )
        details["train_key"] = details["Train No"].map(normalize_train_number)
        details["seq_num"] = pd.to_numeric(details["SEQ"], errors="coerce")
        details["distance_num"] = pd.to_numeric(details["Distance"], errors="coerce")
        details = details.dropna(subset=["train_key", "seq_num"])
        for train_key, group in details.groupby("train_key", sort=False):
            ordered = group.sort_values("seq_num")
            departure_hour = parse_time_hour(ordered.iloc[0]["Departure Time"])
            first_departure = pd.to_datetime(ordered.iloc[0]["Departure Time"], format="%H:%M:%S", errors="coerce")
            last_arrival = pd.to_datetime(ordered.iloc[-1]["Arrival time"], format="%H:%M:%S", errors="coerce")
            travel_hours = None
            if pd.notna(first_departure) and pd.notna(last_arrival):
                minutes = (last_arrival.hour * 60 + last_arrival.minute) - (first_departure.hour * 60 + first_departure.minute)
                if minutes <= 0:
                    minutes += 24 * 60
                travel_hours = min(72.0, max(0.1, minutes / 60.0))
            summary[train_key] = {
                "distance_km": float(ordered["distance_num"].max()) if ordered["distance_num"].notna().any() else np.nan,
                "num_scheduled_stops": float(ordered["seq_num"].max()),
                "scheduled_travel_hours": travel_hours if travel_hours is not None else np.nan,
                "departure_hour": departure_hour,
            }

    if SCHEDULES_PATH.exists():
        schedules = pd.read_csv(SCHEDULES_PATH, dtype={"train_number": "string"})
        for row in schedules.to_dict("records"):
            train_key = normalize_train_number(row.get("train_number"))
            if train_key in summary:
                continue
            summary[train_key] = {
                "distance_km": pd.to_numeric(pd.Series([row.get("distance_km")]), errors="coerce").iloc[0],
                "num_scheduled_stops": pd.to_numeric(pd.Series([row.get("total_halts")]), errors="coerce").iloc[0],
                "scheduled_travel_hours": parse_duration_hours(row.get("duration")),
                "departure_hour": parse_time_hour(row.get("departure_time")),
            }
    return summary


def aggregate_combined_delay_data(defaults: dict[str, float], route_summary: dict[str, dict[str, float]]) -> tuple[pd.DataFrame, dict[str, int]]:
    """Read all station files in chunks and reduce them to journey rows."""
    files = sorted(Path("data").glob(COMBINED_PATTERN))
    if not files:
        return pd.DataFrame(columns=["departure_date", "_train_key", TARGET, *FEATURE_COLS]), {"files": 0, "raw_rows": 0, "valid_observations": 0, "journey_rows": 0}

    partials: list[pd.DataFrame] = []
    raw_rows = valid_observations = 0
    for index, path in enumerate(files, start=1):
        print(f"Ingesting {path.name} ({index}/{len(files)})...")
        frame = pd.read_csv(
            path,
            usecols=["date", "station_no", "delay", "train_no"],
            dtype={"train_no": "string"},
            low_memory=False,
        )
        raw_rows += len(frame)
        frame["departure_date"] = pd.to_datetime(frame["date"], errors="coerce")
        frame["station_num"] = pd.to_numeric(frame["station_no"], errors="coerce")
        frame[TARGET] = pd.to_numeric(frame["delay"], errors="coerce")
        frame["train_key"] = frame["train_no"].map(normalize_train_number)
        frame = frame[
            frame["departure_date"].notna()
            & frame["train_key"].ne("")
            & frame[TARGET].between(0, MAX_DELAY_MINUTES)
        ][["departure_date", "station_num", TARGET, "train_key"]]
        valid_observations += len(frame)
        if frame.empty:
            continue
        frame = frame.sort_values(["train_key", "departure_date", "station_num"], na_position="first")
        partials.append(frame.drop_duplicates(["train_key", "departure_date"], keep="last"))

    if not partials:
        return pd.DataFrame(columns=["departure_date", "_train_key", TARGET, *FEATURE_COLS]), {"files": len(files), "raw_rows": raw_rows, "valid_observations": 0, "journey_rows": 0}

    journeys = pd.concat(partials, ignore_index=True)
    journeys = journeys.sort_values(["train_key", "departure_date", "station_num"], na_position="first")
    journeys = journeys.drop_duplicates(["train_key", "departure_date"], keep="last").reset_index(drop=True)
    dates = journeys["departure_date"]
    months = dates.dt.month
    route_values = journeys["train_key"].map(route_summary)
    for column in ("distance_km", "num_scheduled_stops", "scheduled_travel_hours", "departure_hour"):
        journeys[column] = route_values.map(lambda value: value.get(column) if isinstance(value, dict) else np.nan)

    journeys["day_of_week"] = dates.dt.dayofweek
    journeys["month"] = months
    journeys["is_weekend"] = dates.dt.dayofweek.isin([5, 6]).astype(float)
    journeys["is_night_departure"] = (
        journeys["departure_hour"].between(22, 23) | journeys["departure_hour"].between(0, 5)
    ).astype(float)
    journeys["is_peak_hour"] = journeys["departure_hour"].isin([7, 8, 9, 17, 18, 19]).astype(float)
    journeys["is_festival_season"] = months.isin([10, 11]).astype(float)
    journeys["is_monsoon_season"] = months.isin([6, 7, 8, 9]).astype(float)
    journeys["is_fog_risk"] = months.isin([11, 12, 1, 2]).astype(float)
    journeys["fog_risk_score"] = journeys["is_fog_risk"]
    journeys["season_severity_score"] = np.select(
        [journeys["is_monsoon_season"].eq(1), journeys["is_fog_risk"].eq(1)],
        [0.78, 0.65],
        default=0.35,
    )
    for column in ("zone_fog_index", "zone_congestion_index", "track_doubled", "is_hdn_route", "is_electrified", "psr_count", "seat_utilisation_pct"):
        journeys[column] = np.nan
    journeys["is_station_feed"] = 1.0
    for column in FEATURE_COLS:
        journeys[column] = pd.to_numeric(journeys[column], errors="coerce").fillna(defaults[column])
    return journeys.rename(columns={"train_key": "_train_key"})[["departure_date", "_train_key", TARGET, *FEATURE_COLS]], {
        "files": len(files),
        "raw_rows": raw_rows,
        "valid_observations": valid_observations,
        "journey_rows": len(journeys),
    }


def load_online_completed_data(defaults: dict[str, float], route_summary: dict[str, dict[str, float]]) -> pd.DataFrame:
    """Load terminal observations recorded by the live feedback store.

    These rows are deliberately opt-in through the exported file and are only
    created after a provider reports the train at its terminal station.
    """
    columns = ["departure_date", "_train_key", TARGET, *FEATURE_COLS]
    if not ONLINE_HISTORY_PATH.exists():
        return pd.DataFrame(columns=columns)
    frame = pd.read_csv(ONLINE_HISTORY_PATH, dtype={"train_number": "string"})
    required = {"train_number", "journey_date", "delay_minutes"}
    if not required.issubset(frame.columns):
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
    for column in ("distance_km", "num_scheduled_stops", "scheduled_travel_hours", "departure_hour"):
        frame[column] = route_values.map(lambda value: value.get(column) if isinstance(value, dict) else np.nan)
    frame["day_of_week"] = dates.dt.dayofweek
    frame["month"] = months
    frame["is_weekend"] = dates.dt.dayofweek.isin([5, 6]).astype(float)
    frame["is_night_departure"] = frame["departure_hour"].between(22, 23) | frame["departure_hour"].between(0, 5)
    frame["is_night_departure"] = frame["is_night_departure"].astype(float)
    frame["is_peak_hour"] = frame["departure_hour"].isin([7, 8, 9, 17, 18, 19]).astype(float)
    frame["is_festival_season"] = months.isin([10, 11]).astype(float)
    frame["is_monsoon_season"] = months.isin([6, 7, 8, 9]).astype(float)
    frame["is_fog_risk"] = months.isin([11, 12, 1, 2]).astype(float)
    frame["fog_risk_score"] = frame["is_fog_risk"]
    frame["season_severity_score"] = np.select(
        [frame["is_monsoon_season"].eq(1), frame["is_fog_risk"].eq(1)],
        [0.78, 0.65], default=0.35,
    )
    for column in ("zone_fog_index", "zone_congestion_index", "track_doubled", "is_hdn_route", "is_electrified", "psr_count", "seat_utilisation_pct"):
        frame[column] = np.nan
    frame["is_station_feed"] = 1.0
    for column in FEATURE_COLS:
        frame[column] = pd.to_numeric(frame[column], errors="coerce").fillna(defaults[column])
    return frame[columns]


def make_model(alpha: float, n_estimators: int, early_stopping_rounds: int | None = None) -> xgb.XGBRegressor:
    params: dict[str, object] = {
        "objective": "reg:quantileerror", "quantile_alpha": alpha,
        "n_estimators": n_estimators, "max_depth": 6, "learning_rate": 0.05,
        "min_child_weight": 8, "subsample": 0.85, "colsample_bytree": 0.90,
        "reg_alpha": 0.05, "reg_lambda": 1.0, "tree_method": "hist",
        "random_state": RANDOM_STATE, "n_jobs": -1,
    }
    if early_stopping_rounds is not None:
        params["early_stopping_rounds"] = early_stopping_rounds
    return xgb.XGBRegressor(**params)


def build_historical_records() -> None:
    output_path = MODELS_DIR / "historical_delay_records.json"
    if not HISTORY_PATH.exists():
        output_path.write_text("{}\n")
        return
    history = pd.read_csv(HISTORY_PATH)
    required = {"train_number", "journey_date", "arrival_delay_min"}
    if not required.issubset(history.columns):
        output_path.write_text("{}\n")
        return
    if "cancellation_status" in history:
        history = history[pd.to_numeric(history["cancellation_status"], errors="coerce").fillna(0).eq(0)]
    history["journey_date"] = pd.to_datetime(history["journey_date"], errors="coerce")
    history["arrival_delay_min"] = pd.to_numeric(history["arrival_delay_min"], errors="coerce")
    history = history.dropna(subset=["journey_date", "arrival_delay_min"])
    history = history[history["arrival_delay_min"].between(0, MAX_DELAY_MINUTES)]
    records = {}
    for train_number, group in history.groupby("train_number"):
        records[normalize_train_number(train_number)] = [
            {"date": row.journey_date.date().isoformat(), "arrival_delay_min": float(row.arrival_delay_min)}
            for row in group.sort_values("journey_date").itertuples(index=False)
        ]
    output_path.write_text(json.dumps(records, indent=2) + "\n")


def main() -> None:
    if not DATA_PATH.exists():
        raise FileNotFoundError(f"Missing training data: {DATA_PATH}")
    MODELS_DIR.mkdir(exist_ok=True)
    started = time.time()

    legacy = load_legacy_data()
    defaults = {column: float(pd.to_numeric(legacy[column], errors="coerce").median()) for column in FEATURE_COLS}
    route_summary = build_route_summaries()
    combined, source_stats = aggregate_combined_delay_data(defaults, route_summary)
    online = load_online_completed_data(defaults, route_summary)
    legacy["_source_priority"] = 0
    combined["_source_priority"] = 1
    online["_source_priority"] = 2
    # The legacy file can contain multiple valid records for one train/date;
    # preserve those rows. Online terminal labels only need deduplication
    # against the compatible combined-feed journey rows.
    combined_online = pd.concat([combined, online], ignore_index=True)
    combined_online = combined_online.sort_values(["departure_date", "_train_key", "_source_priority"])
    combined_online = combined_online.drop_duplicates(["_train_key", "departure_date"], keep="last")
    data = pd.concat([legacy, combined_online], ignore_index=True).sort_values("departure_date").reset_index(drop=True)
    train_df, validation_df, test_df = temporal_split(data)
    print(f"Loaded {len(data):,} compatible journeys")
    print(f"Legacy rows: {len(legacy):,}; combined journey rows: {len(combined):,}; online completed rows: {len(online):,}")
    print(f"Train/validation/test = {len(train_df):,}/{len(validation_df):,}/{len(test_df):,}")

    train_defaults = {column: float(pd.to_numeric(train_df[column], errors="coerce").median()) for column in FEATURE_COLS}
    X_train = make_features(train_df, train_defaults)
    X_validation = make_features(validation_df, train_defaults)
    X_test = make_features(test_df, train_defaults)
    y_train = train_df[TARGET].to_numpy(dtype="float32")
    y_validation = validation_df[TARGET].to_numpy(dtype="float32")
    y_test = test_df[TARGET].to_numpy(dtype="float32")

    validation_models: dict[str, xgb.XGBRegressor] = {}
    best_rounds: dict[str, int] = {}
    for label, alpha in (("p10", 0.10), ("p50", 0.50), ("p90", 0.90)):
        print(f"Training validation {label} model on {len(X_train):,} rows...")
        model = make_model(alpha, VALIDATION_ESTIMATORS, early_stopping_rounds=30)
        model.fit(X_train, y_train, eval_set=[(X_validation, y_validation)], verbose=False)
        validation_models[label] = model
        best_rounds[label] = int(model.best_iteration if model.best_iteration is not None else VALIDATION_ESTIMATORS - 1) + 1

    p10, p50, p90 = (validation_models[label].predict(X_test) for label in ("p10", "p50", "p90"))
    p10, p90 = np.minimum(p10, p50), np.maximum(p90, p50)
    validation_metrics = {
        "test_mae_minutes": float(mean_absolute_error(y_test, p50)),
        "test_rmse_minutes": float(mean_squared_error(y_test, p50) ** 0.5),
        "test_median_baseline_mae_minutes": float(mean_absolute_error(y_test, np.full_like(y_test, np.median(y_train)))),
        "test_p10_pinball_loss": pinball_loss(y_test, p10, 0.10),
        "test_p90_pinball_loss": pinball_loss(y_test, p90, 0.90),
        "test_p10_p90_coverage_percent": float(np.mean((y_test >= p10) & (y_test <= p90)) * 100),
    }
    print("Validation-selected model metrics:")
    print(json.dumps(validation_metrics, indent=2))

    # Fit the deployable artifacts on every row before the strict holdout.
    fit_df = pd.concat([train_df, validation_df], ignore_index=True)
    X_fit = make_features(fit_df, train_defaults)
    y_fit = fit_df[TARGET].to_numpy(dtype="float32")
    filenames = {"p10": "eta_quantile_p10.pkl", "p50": "eta_regressor.pkl", "p90": "eta_quantile_p90.pkl"}
    for label, alpha in (("p10", 0.10), ("p50", 0.50), ("p90", 0.90)):
        print(f"Fitting deployable {label} artifact for {len(X_fit):,} rows ({best_rounds[label]} rounds)...")
        model = make_model(alpha, best_rounds[label])
        model.fit(X_fit, y_fit, verbose=False)
        joblib.dump(model, MODELS_DIR / filenames[label])

    final_models = {label: joblib.load(MODELS_DIR / filenames[label]) for label in filenames}
    final_p10, final_p50, final_p90 = (final_models[label].predict(X_test) for label in ("p10", "p50", "p90"))
    final_p10, final_p90 = np.minimum(final_p10, final_p50), np.maximum(final_p90, final_p50)
    metrics = {
        "test_mae_minutes": float(mean_absolute_error(y_test, final_p50)),
        "test_rmse_minutes": float(mean_squared_error(y_test, final_p50) ** 0.5),
        "test_median_baseline_mae_minutes": float(mean_absolute_error(y_test, np.full_like(y_test, np.median(y_train)))),
        "test_p10_pinball_loss": pinball_loss(y_test, final_p10, 0.10),
        "test_p90_pinball_loss": pinball_loss(y_test, final_p90, 0.90),
        "test_p10_p90_coverage_percent": float(np.mean((y_test >= final_p10) & (y_test <= final_p90)) * 100),
    }
    print("Final deployable artifact metrics:")
    print(json.dumps(metrics, indent=2))

    (MODELS_DIR / "feature_defaults.json").write_text(json.dumps(train_defaults, indent=2) + "\n")
    build_historical_records()
    metadata = {
        "model_version": "time-safe-eta-v2-all-compatible-data",
        "target": "destination_arrival_delay_minutes",
        "feature_columns": FEATURE_COLS,
        "excluded_leakage_columns": ["delay_minutes", "is_delayed", "primary_delay_cause", "current_delay"],
        "data_sources": {
            "legacy_training_file": str(DATA_PATH),
            "combined_delay_pattern": COMBINED_PATTERN,
            "online_completed_file": str(ONLINE_HISTORY_PATH),
            **source_stats,
            "legacy_rows": len(legacy),
            "online_completed_rows": len(online),
            "compatible_rows_total": len(data),
        },
        "split": {
            "type": "chronological whole-date",
            "train_end": str(train_df.departure_date.max().date()),
            "validation_end": str(validation_df.departure_date.max().date()),
            "test_start": str(test_df.departure_date.min().date()),
            "test_end": str(test_df.departure_date.max().date()),
        },
        "best_rounds": best_rounds,
        "metrics": metrics,
        "validation_selected_metrics": validation_metrics,
        "trained_at_utc": pd.Timestamp.utcnow().isoformat(),
    }
    (MODELS_DIR / "model_metadata.json").write_text(json.dumps(metadata, indent=2) + "\n")
    print(f"Saved deployable models and metadata in {time.time() - started:.1f}s")


if __name__ == "__main__":
    main()
