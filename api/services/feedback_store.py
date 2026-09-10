"""Durable live-observation and forecast-feedback storage.

Predictions are never written back as training labels. A forecast is resolved
only when a later live observation reports the corresponding station. The
observed delay is retained separately from the forecast error so completed
journeys can be exported for an explicit retraining run.
"""

from __future__ import annotations

import datetime as dt
import json
import os
import sqlite3
from pathlib import Path
from typing import Any, Optional

from api.services.phase2_dataset import build_station_level_rows, json_payload, normalize_train_route
from api.services.phase3_dataset import build_phase3_rows
from api.services.phase4_dataset import PHASE4_WEATHER_FEATURES, add_weather_features


ROOT_DIR = Path(__file__).resolve().parents[2]
DEFAULT_DB_PATH = ROOT_DIR / "data" / "railpulse_feedback.sqlite3"
ONLINE_DATASET_PATH = ROOT_DIR / "data" / "online_completed_journeys.csv"
_initialized_databases: set[Path] = set()


def _db_path() -> Path:
    configured = os.getenv("RAILPULSE_FEEDBACK_DB", "").strip()
    return Path(configured) if configured else DEFAULT_DB_PATH


def _init_schema(connection: sqlite3.Connection) -> None:
    connection.executescript(
        """
        CREATE TABLE IF NOT EXISTS live_observations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            train_number TEXT NOT NULL,
            journey_date TEXT NOT NULL,
            observed_at TEXT NOT NULL,
            provider TEXT NOT NULL,
            current_station TEXT NOT NULL,
            next_station TEXT,
            current_delay_minutes INTEGER NOT NULL,
            latitude REAL,
            longitude REAL,
            speed_kmh REAL,
            is_terminal INTEGER NOT NULL DEFAULT 0,
            observation_quality TEXT NOT NULL DEFAULT 'provider_timestamp',
            raw_payload_json TEXT NOT NULL DEFAULT '{}',
            UNIQUE(train_number, journey_date, observed_at, provider, current_station, current_delay_minutes)
        );

        CREATE TABLE IF NOT EXISTS forecasts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            observation_id INTEGER NOT NULL,
            train_number TEXT NOT NULL,
            journey_date TEXT NOT NULL,
            created_at TEXT NOT NULL,
            provider TEXT NOT NULL,
            current_station TEXT NOT NULL,
            station_code TEXT NOT NULL,
            scheduled_arrival TEXT NOT NULL,
            predicted_arrival TEXT NOT NULL,
            predicted_arrival_datetime TEXT,
            predicted_delay_minutes INTEGER NOT NULL,
            p10_delay_minutes INTEGER,
            p90_delay_minutes INTEGER,
            model_version TEXT NOT NULL DEFAULT 'unknown',
            resolved_at TEXT,
            actual_delay_minutes INTEGER,
            actual_observation_at TEXT,
            error_minutes REAL,
            UNIQUE(observation_id, station_code),
            FOREIGN KEY(observation_id) REFERENCES live_observations(id)
        );

        CREATE INDEX IF NOT EXISTS idx_observations_train_date
            ON live_observations(train_number, journey_date, observed_at);
        CREATE INDEX IF NOT EXISTS idx_forecasts_resolution
            ON forecasts(train_number, journey_date, station_code, resolved_at, created_at);

        CREATE TABLE IF NOT EXISTS station_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            train_number TEXT NOT NULL,
            journey_date TEXT NOT NULL,
            observed_at TEXT NOT NULL,
            provider TEXT NOT NULL,
            station_code TEXT NOT NULL,
            station_name TEXT,
            sequence INTEGER,
            scheduled_arrival TEXT,
            scheduled_departure TEXT,
            actual_arrival_at TEXT,
            actual_departure_at TEXT,
            delay_arrival_minutes INTEGER,
            delay_departure_minutes INTEGER,
            status TEXT,
            event_quality TEXT NOT NULL,
            raw_payload_json TEXT NOT NULL DEFAULT '{}',
            UNIQUE(train_number, journey_date, provider, station_code, actual_arrival_at, actual_departure_at)
        );

        CREATE TABLE IF NOT EXISTS operational_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            train_number TEXT NOT NULL,
            journey_date TEXT NOT NULL,
            event_type TEXT NOT NULL,
            rescheduled_by_minutes INTEGER,
            provider TEXT NOT NULL,
            recorded_at TEXT NOT NULL,
            raw_payload_json TEXT NOT NULL DEFAULT '{}',
            UNIQUE(train_number, journey_date, event_type, provider)
        );

        CREATE TABLE IF NOT EXISTS weather_observations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            train_number TEXT NOT NULL,
            journey_date TEXT NOT NULL,
            station_code TEXT,
            observed_at TEXT NOT NULL,
            provider TEXT NOT NULL,
            latitude REAL NOT NULL,
            longitude REAL NOT NULL,
            temperature_c REAL,
            feels_like_c REAL,
            humidity_pct REAL,
            pressure_hpa REAL,
            wind_speed_mps REAL,
            visibility_m REAL,
            precipitation_1h_mm REAL NOT NULL DEFAULT 0,
            snow_1h_mm REAL NOT NULL DEFAULT 0,
            weather_id INTEGER,
            weather_main TEXT,
            weather_description TEXT,
            cloud_pct REAL,
            weather_risk_score REAL NOT NULL,
            observation_quality TEXT NOT NULL,
            coordinate_source TEXT NOT NULL,
            raw_payload_json TEXT NOT NULL DEFAULT '{}',
            UNIQUE(train_number, journey_date, observed_at, provider, latitude, longitude)
        );

        CREATE TABLE IF NOT EXISTS station_board_observations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            station_code TEXT NOT NULL,
            observed_at TEXT NOT NULL,
            provider TEXT NOT NULL,
            hours INTEGER NOT NULL,
            train_count INTEGER NOT NULL,
            mean_delay_minutes REAL,
            max_delay_minutes REAL,
            headway_min_minutes REAL,
            station_congestion_index REAL,
            signals_json TEXT NOT NULL DEFAULT '{}',
            trains_json TEXT NOT NULL DEFAULT '[]',
            UNIQUE(station_code, observed_at, provider, hours)
        );

        CREATE INDEX IF NOT EXISTS idx_station_events_train_date
            ON station_events(train_number, journey_date, sequence, actual_arrival_at);
        CREATE INDEX IF NOT EXISTS idx_operational_events_train_date
            ON operational_events(train_number, journey_date, event_type);
        CREATE INDEX IF NOT EXISTS idx_weather_observations_train_date
            ON weather_observations(train_number, journey_date, observed_at);
        CREATE INDEX IF NOT EXISTS idx_station_board_code_time
            ON station_board_observations(station_code, observed_at);
        """
    )
    # Keep databases created by an earlier development build usable.
    table_columns = {
        "live_observations": {row["name"] for row in connection.execute("PRAGMA table_info(live_observations)")},
        "forecasts": {row["name"] for row in connection.execute("PRAGMA table_info(forecasts)")},
    }
    migrations = {
        "live_observations": {
            "is_terminal": "INTEGER NOT NULL DEFAULT 0",
            "observation_quality": "TEXT NOT NULL DEFAULT 'provider_timestamp'",
            "raw_payload_json": "TEXT NOT NULL DEFAULT '{}'",
        },
        "forecasts": {"model_version": "TEXT NOT NULL DEFAULT 'unknown'"},
    }
    for table, fields in migrations.items():
        for field, definition in fields.items():
            if field not in table_columns[table]:
                connection.execute(f"ALTER TABLE {table} ADD COLUMN {field} {definition}")


def _connect(path: Optional[Path] = None) -> sqlite3.Connection:
    database_path = (path or _db_path()).resolve()
    database_path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(database_path, timeout=10)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA journal_mode=WAL")
    if database_path not in _initialized_databases:
        _init_schema(connection)
        _initialized_databases.add(database_path)
    return connection


def connect_feedback_store() -> sqlite3.Connection:
    """Open the feedback store and apply its idempotent schema migrations."""
    return _connect()


def repair_station_event_timestamps() -> int:
    """Re-normalize stored provider route timestamps after parser upgrades."""
    connection = _connect()
    try:
        rows = connection.execute(
            "SELECT id, train_number, journey_date, observed_at, provider, raw_payload_json FROM station_events"
        ).fetchall()
        repaired = 0
        for row in rows:
            try:
                raw = json.loads(row["raw_payload_json"] or "{}")
                journey_date = dt.date.fromisoformat(row["journey_date"])
                observed_at = dt.datetime.fromisoformat(str(row["observed_at"]).replace("Z", "+00:00"))
                normalized = normalize_train_route(
                    {"route": [raw]}, row["train_number"], journey_date, observed_at, row["provider"]
                )
                if not normalized:
                    continue
                event = normalized[0]
                connection.execute(
                    """
                    UPDATE station_events
                    SET scheduled_arrival = ?, scheduled_departure = ?,
                        actual_arrival_at = ?, actual_departure_at = ?,
                        delay_arrival_minutes = ?, delay_departure_minutes = ?,
                        event_quality = ?
                    WHERE id = ?
                    """,
                    (
                        event.get("scheduled_arrival"), event.get("scheduled_departure"),
                        event.get("actual_arrival_at"), event.get("actual_departure_at"),
                        event.get("delay_arrival_minutes"), event.get("delay_departure_minutes"),
                        event.get("event_quality"), row["id"],
                    ),
                )
                repaired += 1
            except (KeyError, TypeError, ValueError, json.JSONDecodeError):
                continue
        connection.commit()
        return repaired
    finally:
        connection.close()


def _record_station_events(
    connection: sqlite3.Connection,
    train_number: str,
    journey_date: dt.date,
    status: Any,
) -> int:
    raw_payload = getattr(status, "raw_payload", None) or {}
    events = normalize_train_route(
        raw_payload,
        str(train_number).strip(),
        journey_date,
        status.observed_at,
        str(status.provider or "UNKNOWN"),
    )
    recorded = 0
    for event in events:
        connection.execute(
            """
            INSERT OR IGNORE INTO station_events (
                train_number, journey_date, observed_at, provider, station_code,
                station_name, sequence, scheduled_arrival, scheduled_departure,
                actual_arrival_at, actual_departure_at, delay_arrival_minutes,
                delay_departure_minutes, status, event_quality, raw_payload_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                event["train_number"], event["journey_date"], event["observed_at"], event["provider"],
                event["station_code"], event.get("station_name"), event.get("sequence"),
                event.get("scheduled_arrival"), event.get("scheduled_departure"),
                event.get("actual_arrival_at"), event.get("actual_departure_at"),
                event.get("delay_arrival_minutes"), event.get("delay_departure_minutes"),
                event.get("status"), event.get("event_quality"), json_payload(event.get("raw_payload")),
            ),
        )
        recorded += 1
    return recorded


def record_operational_events(events: list[dict[str, Any]], recorded_at: Optional[dt.datetime] = None) -> int:
    """Persist cancelled/rescheduled flags fetched for a journey date."""
    timestamp = (recorded_at or dt.datetime.now(dt.timezone.utc)).astimezone(dt.timezone.utc).isoformat()
    connection = _connect()
    try:
        count = 0
        for event in events:
            train_number = str(event.get("train_number") or "").strip()
            journey_date = str(event.get("journey_date") or "").strip()
            event_type = str(event.get("event_type") or "").strip().lower()
            if not train_number or not journey_date or event_type not in {"cancelled", "rescheduled"}:
                continue
            connection.execute(
                """
                INSERT INTO operational_events (
                    train_number, journey_date, event_type, rescheduled_by_minutes,
                    provider, recorded_at, raw_payload_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(train_number, journey_date, event_type, provider)
                DO UPDATE SET rescheduled_by_minutes=excluded.rescheduled_by_minutes,
                              recorded_at=excluded.recorded_at,
                              raw_payload_json=excluded.raw_payload_json
                """,
                (
                    train_number, journey_date, event_type, event.get("rescheduled_by_minutes"),
                    str(event.get("provider") or "UNKNOWN"), timestamp, json_payload(event.get("raw_payload")),
                ),
            )
            count += 1
        connection.commit()
        return count
    finally:
        connection.close()


def record_station_board(
    station_code: str,
    hours: int,
    trains: list[dict[str, Any]],
    signals: dict[str, Any],
    observed_at: Optional[dt.datetime] = None,
    provider: str = "UNKNOWN",
) -> bool:
    """Persist a provider-backed station board and its transparent signals."""
    timestamp = (observed_at or dt.datetime.now(dt.timezone.utc)).astimezone(dt.timezone.utc).isoformat()
    connection = _connect()
    try:
        connection.execute(
            """
            INSERT OR IGNORE INTO station_board_observations (
                station_code, observed_at, provider, hours, train_count,
                mean_delay_minutes, max_delay_minutes, headway_min_minutes,
                station_congestion_index, signals_json, trains_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                str(station_code).strip().upper(), timestamp, str(provider or "UNKNOWN"), int(hours),
                int(signals.get("train_count", len(trains))), signals.get("mean_delay_minutes"),
                signals.get("max_delay_minutes"), signals.get("headway_min_minutes"),
                signals.get("station_congestion_index"), json_payload(signals), json_payload(trains),
            ),
        )
        connection.commit()
        return True
    finally:
        connection.close()


def _iso(value: Any) -> str:
    if isinstance(value, dt.datetime):
        return value.astimezone(dt.timezone.utc).isoformat()
    return str(value)


def _model_dump(value: Any) -> dict[str, Any]:
    if hasattr(value, "model_dump"):
        return value.model_dump(mode="json")
    if hasattr(value, "dict"):
        return value.dict()
    if isinstance(value, dict):
        return value
    raise TypeError("feedback payload must be a mapping or Pydantic model")


def _record_weather_observation(
    connection: sqlite3.Connection,
    train_number: str,
    journey_date: dt.date,
    station_code: Optional[str],
    weather: Any,
) -> bool:
    """Persist a normalized weather snapshot without leaking it into labels."""
    if weather is None:
        return False
    if hasattr(weather, "public_dict"):
        payload = dict(weather.public_dict())
        payload["raw_payload"] = getattr(weather, "raw_payload", None) or {}
    elif hasattr(weather, "__dict__") and not isinstance(weather, dict):
        payload = dict(weather.__dict__)
    elif isinstance(weather, dict):
        payload = dict(weather)
    else:
        return False
    try:
        observed_at = str(payload["observed_at"])
        provider = str(payload["provider"] or "UNKNOWN")
        latitude = float(payload["latitude"])
        longitude = float(payload["longitude"])
        risk = float(payload["weather_risk_score"])
    except (KeyError, TypeError, ValueError):
        return False
    raw_payload = payload.get("raw_payload") or {}
    connection.execute(
        """
        INSERT OR IGNORE INTO weather_observations (
            train_number, journey_date, station_code, observed_at, provider,
            latitude, longitude, temperature_c, feels_like_c, humidity_pct,
            pressure_hpa, wind_speed_mps, visibility_m, precipitation_1h_mm,
            snow_1h_mm, weather_id, weather_main, weather_description, cloud_pct,
            weather_risk_score, observation_quality, coordinate_source, raw_payload_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            str(train_number).strip(), journey_date.isoformat(),
            str(station_code or "").strip().upper() or None, observed_at, provider,
            latitude, longitude, payload.get("temperature_c"), payload.get("feels_like_c"),
            payload.get("humidity_pct"), payload.get("pressure_hpa"), payload.get("wind_speed_mps"),
            payload.get("visibility_m"), payload.get("precipitation_1h_mm") or 0,
            payload.get("snow_1h_mm") or 0, payload.get("weather_id"), payload.get("weather_main"),
            payload.get("weather_description"), payload.get("cloud_pct"), risk,
            str(payload.get("observation_quality") or "provider_payload"),
            str(payload.get("coordinate_source") or "unknown"), json_payload(raw_payload),
        ),
    )
    return True


def record_live_cycle(
    train_number: str,
    journey_date: dt.date,
    status: Any,
    eta: Any,
    model_version: str = "unknown",
    weather: Any = None,
) -> dict[str, Any]:
    """Store one live observation, forecast rows, and newly resolvable errors."""
    observed_at = _iso(status.observed_at)
    provider = str(status.provider or "UNKNOWN")
    current_station = str(status.current_station).strip().upper()
    train_key = str(train_number).strip()
    date_key = journey_date.isoformat()
    eta_payload = _model_dump(eta)
    stations = eta_payload.get("stations") or []
    is_terminal = bool(stations and str(stations[-1].get("station_code") or "").strip().upper() == current_station)
    connection = _connect()
    try:
        # Resolve the previous forecast before inserting this cycle's forecast
        # for the same station. This prevents a poll from scoring itself.
        prior = connection.execute(
            """
            SELECT id, predicted_delay_minutes
            FROM forecasts
            WHERE train_number = ? AND journey_date = ? AND station_code = ?
              AND resolved_at IS NULL AND created_at < ?
            ORDER BY created_at DESC
            LIMIT 1
            """,
            (train_key, date_key, current_station, observed_at),
        ).fetchone()
        resolved = None
        if prior is not None:
            error = int(status.current_delay_minutes) - int(prior["predicted_delay_minutes"])
            connection.execute(
                """
                UPDATE forecasts
                SET resolved_at = ?, actual_delay_minutes = ?,
                    actual_observation_at = ?, error_minutes = ?
                WHERE id = ?
                """,
                (observed_at, int(status.current_delay_minutes), observed_at, float(error), int(prior["id"])),
            )
            resolved = {
                "forecast_id": int(prior["id"]),
                "station_code": current_station,
                "predicted_delay_minutes": int(prior["predicted_delay_minutes"]),
                "actual_delay_minutes": int(status.current_delay_minutes),
                "error_minutes": error,
                "actual_time_quality": "first_provider_observation_at_station",
            }

        connection.execute(
            """
            INSERT OR IGNORE INTO live_observations (
                train_number, journey_date, observed_at, provider,
                current_station, next_station, current_delay_minutes,
                latitude, longitude, speed_kmh, is_terminal,
                observation_quality, raw_payload_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                train_key, date_key, observed_at, provider, current_station,
                getattr(status, "next_station", None), int(status.current_delay_minutes),
                getattr(status, "latitude", None), getattr(status, "longitude", None),
                getattr(status, "speed_kmh", None), int(is_terminal),
                str(getattr(status, "observation_quality", "provider_timestamp")),
                json.dumps(getattr(status, "raw_payload", None) or {}, sort_keys=True, separators=(",", ":")),
            ),
        )
        station_events_recorded = _record_station_events(connection, train_key, journey_date, status)
        weather_recorded = _record_weather_observation(
            connection, train_key, journey_date, current_station, weather
        )
        observation_row = connection.execute(
            """
            SELECT id FROM live_observations
            WHERE train_number = ? AND journey_date = ? AND observed_at = ?
              AND provider = ? AND current_station = ? AND current_delay_minutes = ?
            """,
            (train_key, date_key, observed_at, provider, current_station, int(status.current_delay_minutes)),
        ).fetchone()
        if observation_row is None:
            raise RuntimeError("failed to persist live observation")
        observation_id = int(observation_row["id"])

        forecast_count = 0
        for station in stations:
            station_code = str(station.get("station_code") or "").strip().upper()
            if not station_code:
                continue
            connection.execute(
                """
                INSERT OR IGNORE INTO forecasts (
                    observation_id, train_number, journey_date, created_at, provider,
                    current_station, station_code, scheduled_arrival, predicted_arrival,
                    predicted_arrival_datetime, predicted_delay_minutes,
                    p10_delay_minutes, p90_delay_minutes, model_version
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    observation_id, train_key, date_key, observed_at, provider,
                    current_station, station_code,
                    str(station.get("scheduled_arrival") or ""),
                    str(station.get("predicted_arrival") or ""),
                    station.get("predicted_arrival_datetime"),
                    int(station.get("delay_minutes") or 0),
                    station.get("p10_delay_minutes"), station.get("p90_delay_minutes"),
                    str(model_version or "unknown"),
                ),
            )
            forecast_count += 1

        connection.commit()
        dataset_exported = False
        if is_terminal:
            try:
                export_completed_journeys(ONLINE_DATASET_PATH)
                dataset_exported = True
            except (OSError, sqlite3.Error):
                # The observation is already durable; a later explicit export
                # can repair a transient filesystem/database issue.
                dataset_exported = False
        observation_count = connection.execute(
            "SELECT COUNT(*) FROM live_observations WHERE train_number = ? AND journey_date = ?",
            (train_key, date_key),
        ).fetchone()[0]
        resolved_count = connection.execute(
            """
            SELECT COUNT(*) FROM forecasts
            WHERE train_number = ? AND journey_date = ? AND resolved_at IS NOT NULL
            """,
            (train_key, date_key),
        ).fetchone()[0]
        return {
            "observation_recorded": True,
            "observation_id": observation_id,
            "forecast_rows_recorded": forecast_count,
            "station_events_recorded": station_events_recorded,
            "weather_observation_recorded": weather_recorded,
            "completed_dataset_updated": dataset_exported,
            "observations_today": int(observation_count),
            "resolved_forecasts_today": int(resolved_count),
            "latest_comparison": resolved,
        }
    finally:
        connection.close()


def get_train_history(train_number: str, journey_date: dt.date) -> dict[str, Any]:
    connection = _connect()
    try:
        observations = [dict(row) for row in connection.execute(
            """
            SELECT train_number, journey_date, observed_at, provider, current_station,
                   next_station, current_delay_minutes, latitude, longitude, speed_kmh,
                   is_terminal, observation_quality
            FROM live_observations
            WHERE train_number = ? AND journey_date = ?
            ORDER BY observed_at
            """,
            (str(train_number).strip(), journey_date.isoformat()),
        )]
        comparisons = [dict(row) for row in connection.execute(
            """
            SELECT station_code, created_at, predicted_arrival, predicted_arrival_datetime,
                   predicted_delay_minutes, p10_delay_minutes, p90_delay_minutes,
                   model_version, actual_observation_at, actual_delay_minutes, error_minutes
            FROM forecasts
            WHERE train_number = ? AND journey_date = ? AND resolved_at IS NOT NULL
            ORDER BY actual_observation_at
            """,
            (str(train_number).strip(), journey_date.isoformat()),
        )]
        station_events = [dict(row) for row in connection.execute(
            """
            SELECT station_code, station_name, sequence, observed_at,
                   scheduled_arrival, scheduled_departure, actual_arrival_at,
                   actual_departure_at, delay_arrival_minutes,
                   delay_departure_minutes, event_quality, provider
            FROM station_events
            WHERE train_number = ? AND journey_date = ?
            ORDER BY sequence, observed_at
            """,
            (str(train_number).strip(), journey_date.isoformat()),
        )]
        weather_observations = [dict(row) for row in connection.execute(
            """
            SELECT station_code, observed_at, provider, latitude, longitude,
                   temperature_c, feels_like_c, humidity_pct, pressure_hpa,
                   wind_speed_mps, visibility_m, precipitation_1h_mm, snow_1h_mm,
                   weather_id, weather_main, weather_description, cloud_pct,
                   weather_risk_score, observation_quality, coordinate_source
            FROM weather_observations
            WHERE train_number = ? AND journey_date = ?
            ORDER BY observed_at
            """,
            (str(train_number).strip(), journey_date.isoformat()),
        )]
        return {
            "train_number": str(train_number).strip(),
            "journey_date": journey_date.isoformat(),
            "observation_count": len(observations),
            "comparison_count": len(comparisons),
            "observations": observations,
            "comparisons": comparisons,
            "station_events": station_events,
            "weather_observations": weather_observations,
        }
    finally:
        connection.close()


def export_completed_journeys(output_path: Path) -> int:
    """Export terminal observations as labels for an explicit retraining run."""
    import csv

    connection = _connect()
    try:
        rows = connection.execute(
            """
            SELECT o.train_number, o.journey_date, o.current_delay_minutes AS delay_minutes,
                   o.observed_at
            FROM live_observations o
            JOIN (
                SELECT train_number, journey_date, MAX(observed_at) AS last_observed_at
                FROM live_observations
                WHERE is_terminal = 1
                GROUP BY train_number, journey_date
            ) latest ON latest.train_number = o.train_number
                    AND latest.journey_date = o.journey_date
                    AND latest.last_observed_at = o.observed_at
            WHERE o.is_terminal = 1
            ORDER BY o.journey_date, o.train_number
            """
        ).fetchall()
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with output_path.open("w", newline="", encoding="utf-8") as file:
            writer = csv.writer(file)
            writer.writerow(["train_number", "journey_date", "delay_minutes", "observed_at"])
            writer.writerows([tuple(row) for row in rows])
        return len(rows)
    finally:
        connection.close()


def export_station_level_dataset(output_path: Path) -> int:
    """Export only provider-actual station pairs for Phase 2 training."""
    import csv

    connection = _connect()
    try:
        events = [dict(row) for row in connection.execute(
            """
            SELECT train_number, journey_date, observed_at, provider,
                   station_code, station_name, sequence, scheduled_arrival,
                   scheduled_departure, actual_arrival_at, actual_departure_at,
                   delay_arrival_minutes, delay_departure_minutes, status,
                   event_quality
            FROM station_events
            WHERE event_quality = 'provider_actual_event'
              AND actual_arrival_at IS NOT NULL
            ORDER BY train_number, journey_date, sequence, observed_at
            """
        )]
        rows = build_station_level_rows(events)
        for row in rows:
            operational = connection.execute(
                """
                SELECT
                    MAX(CASE WHEN event_type = 'cancelled' THEN 1 ELSE 0 END) AS is_cancelled,
                    MAX(CASE WHEN event_type = 'rescheduled' THEN 1 ELSE 0 END) AS is_rescheduled,
                    MAX(CASE WHEN event_type = 'rescheduled' THEN rescheduled_by_minutes ELSE NULL END) AS rescheduled_by_minutes
                FROM operational_events
                WHERE train_number = ? AND journey_date = ?
                """,
                (row["train_number"], row["journey_date"]),
            ).fetchone()
            row["is_cancelled"] = int(operational["is_cancelled"] or 0) if operational else 0
            row["is_rescheduled"] = int(operational["is_rescheduled"] or 0) if operational else 0
            row["rescheduled_by_minutes"] = operational["rescheduled_by_minutes"] if operational else None
        output_path.parent.mkdir(parents=True, exist_ok=True)
        fieldnames = [
            "train_number", "journey_date", "snapshot_observed_at", "current_station", "next_station",
            "current_station_sequence", "next_station_sequence", "scheduled_minutes_to_next",
            "actual_arrival_current", "actual_arrival_next", "minutes_to_next",
            "delay_at_current_minutes", "delay_at_next_minutes", "delay_change_minutes",
            "label_quality", "provider", "is_cancelled", "is_rescheduled", "rescheduled_by_minutes",
        ]
        with output_path.open("w", newline="", encoding="utf-8") as file:
            writer = csv.DictWriter(file, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)
        return len(rows)
    finally:
        connection.close()


def export_phase3_movement_dataset(output_path: Path) -> int:
    """Export movement snapshots with later provider-confirmed labels."""
    import csv

    connection = _connect()
    try:
        observations = [dict(row) for row in connection.execute(
            """
            SELECT train_number, journey_date, observed_at, provider,
                   current_station, next_station, current_delay_minutes,
                   latitude, longitude, speed_kmh, raw_payload_json
            FROM live_observations
            ORDER BY train_number, journey_date, observed_at
            """
        )]
        events = [dict(row) for row in connection.execute(
            """
            SELECT train_number, journey_date, observed_at, provider,
                   station_code, sequence, scheduled_arrival,
                   actual_arrival_at, delay_arrival_minutes, raw_payload_json
            FROM station_events
            ORDER BY train_number, journey_date, sequence, observed_at
            """
        )]
        operational = [dict(row) for row in connection.execute(
            """
            SELECT train_number, journey_date, event_type, rescheduled_by_minutes
            FROM operational_events
            ORDER BY train_number, journey_date
            """
        )]
        weather = [dict(row) for row in connection.execute(
            """
            SELECT train_number, journey_date, observed_at, provider,
                   temperature_c, feels_like_c, humidity_pct, pressure_hpa,
                   wind_speed_mps, visibility_m, precipitation_1h_mm, snow_1h_mm,
                   cloud_pct, weather_risk_score
            FROM weather_observations
            ORDER BY train_number, journey_date, observed_at
            """
        )]
        # Weather is joined backward in time so a future provider observation
        # cannot leak into a movement snapshot's training features.
        weather_by_key: dict[tuple[str, str], list[dict[str, Any]]] = {}
        for item in weather:
            weather_by_key.setdefault((str(item["train_number"]), str(item["journey_date"])), []).append(item)
        for observation in observations:
            key = (str(observation["train_number"]), str(observation["journey_date"]))
            observed_at = dt.datetime.fromisoformat(str(observation["observed_at"]).replace("Z", "+00:00"))
            if observed_at.tzinfo is None:
                observed_at = observed_at.replace(tzinfo=dt.timezone.utc)
            candidates = []
            for item in weather_by_key.get(key, []):
                try:
                    weather_at = dt.datetime.fromisoformat(str(item["observed_at"]).replace("Z", "+00:00"))
                except ValueError:
                    continue
                if weather_at.tzinfo is None:
                    weather_at = weather_at.replace(tzinfo=dt.timezone.utc)
                if weather_at <= observed_at:
                    candidates.append((weather_at, item))
            selected = max(candidates, key=lambda value: value[0])[1] if candidates else None
            if selected:
                selected_at = dt.datetime.fromisoformat(str(selected["observed_at"]).replace("Z", "+00:00"))
                if selected_at.tzinfo is None:
                    selected_at = selected_at.replace(tzinfo=dt.timezone.utc)
                age = max(0.0, (observed_at - selected_at.astimezone(dt.timezone.utc)).total_seconds() / 60.0)
                # Current conditions older than three hours are not treated as
                # a valid feature for a movement snapshot.
                selected = {**selected, "weather_age_minutes": round(age, 3)} if age <= 180 else None
            observation.update(add_weather_features(observation, selected))
        rows = build_phase3_rows(observations, events, operational)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        fieldnames = [
            "train_number", "journey_date", "snapshot_observed_at", "current_station", "next_station",
            "scheduled_minutes_to_next", "current_delay_minutes", "delay_trend_minutes_per_hour",
            "dwell_minutes", "speed_kmh", "has_speed", "distance_to_next_km",
            "remaining_scheduled_minutes", "current_station_sequence", "next_station_sequence",
            "train_number_hash", "segment_id_hash", "is_rescheduled", "rescheduled_by_minutes",
            "minutes_to_next", "delay_at_next_minutes", "delay_change_minutes",
            "label_quality", "provider",
            *PHASE4_WEATHER_FEATURES,
        ]
        with output_path.open("w", newline="", encoding="utf-8") as file:
            writer = csv.DictWriter(file, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)
        return len(rows)
    finally:
        connection.close()
