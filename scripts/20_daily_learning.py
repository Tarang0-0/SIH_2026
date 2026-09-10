"""Refresh verified datasets and retrain models when new data is available.

This is intentionally an explicit, schedulable job rather than a background
thread inside FastAPI. It keeps collection, label creation, dataset export,
and model training auditable and prevents predictions from becoming labels.

The job is safe to run every day:

* collection is optional and uses only an authorised provider;
* exports are rebuilt from the durable SQLite feedback store;
* trainers run only when their input fingerprint changes (or ``--force`` is
  supplied);
* failed training restores the previous deployable artifacts;
* every outcome is written to ``reports/daily_learning_status.json``.

For live collection, set ``RAILPULSE_DAILY_TRAIN_NUMBERS`` in ``.env`` and
run with ``--collect``. Without that setting, the job still exports and trains
from observations collected by normal live API usage or another collector.
"""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any, Iterable


ROOT_DIR = Path(__file__).resolve().parents[1]
REPORT_PATH = ROOT_DIR / "reports" / "daily_learning_status.json"
LOCK_PATH = ROOT_DIR / "data" / ".daily_learning.lock"


def load_local_env() -> None:
    """Load simple root ``.env`` values without requiring python-dotenv."""
    env_path = ROOT_DIR / ".env"
    if not env_path.exists():
        return
    try:
        for raw_line in env_path.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = (part.strip() for part in line.split("=", 1))
            value = value.strip("\"'")
            if key and key not in os.environ:
                os.environ[key] = value
    except OSError:
        return


def truthy(value: str | None) -> bool:
    return str(value or "").strip().lower() in {"1", "true", "yes", "on"}


def configured_int(value: str | None, default: int) -> int:
    try:
        return int(str(value).strip()) if value is not None and str(value).strip() else default
    except (TypeError, ValueError):
        return default


def sha256_file(path: Path) -> str | None:
    if not path.exists():
        return None
    digest = hashlib.sha256()
    with path.open("rb") as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def line_count(path: Path) -> int:
    if not path.exists():
        return 0
    with path.open("r", encoding="utf-8", errors="replace") as file:
        return max(0, sum(1 for _ in file) - 1)


def run_command(name: str, command: list[str]) -> dict[str, Any]:
    """Run one pipeline stage and retain only useful, bounded diagnostics."""
    completed = subprocess.run(
        command,
        cwd=ROOT_DIR,
        text=True,
        capture_output=True,
        check=False,
    )
    output = (completed.stdout + completed.stderr).splitlines()
    return {
        "name": name,
        "status": "completed" if completed.returncode == 0 else "failed_or_gated",
        "exit_code": completed.returncode,
        "output_tail": output[-12:],
    }


def guarded_command(name: str, command: list[str], artifacts: Iterable[Path]) -> dict[str, Any]:
    """Run a trainer and restore artifacts if it fails or produces nothing."""
    artifact_paths = [path for path in artifacts if path.exists()]
    with tempfile.TemporaryDirectory(prefix="railtrackr-learning-") as backup_dir:
        backup_root = Path(backup_dir)
        backups: dict[Path, Path] = {}
        for index, path in enumerate(artifact_paths):
            backup = backup_root / f"{index}-{path.name}"
            shutil.copy2(path, backup)
            backups[path] = backup

        result = run_command(name, command)
        if result["exit_code"] != 0:
            for path, backup in backups.items():
                shutil.copy2(backup, path)
            for path in artifacts:
                if path.exists() and path not in backups:
                    path.unlink()
            result["artifacts_restored"] = True
            return result

        expected = [path for path in artifacts if path.suffix in {".pkl", ".json"}]
        if not expected or not all(path.exists() and path.stat().st_size > 0 for path in expected):
            for path, backup in backups.items():
                shutil.copy2(backup, path)
            for path in artifacts:
                if path.exists() and path not in backups:
                    path.unlink()
            result.update({"status": "failed_or_gated", "artifacts_restored": True})
            result["output_tail"] = [*result["output_tail"], "Trainer produced no expected artifacts."]
        else:
            result["artifacts_restored"] = False
        return result


def acquire_lock() -> None:
    LOCK_PATH.parent.mkdir(parents=True, exist_ok=True)
    try:
        LOCK_PATH.mkdir()
    except FileExistsError as error:
        raise SystemExit(
            f"Daily learning is already running ({LOCK_PATH}). "
            "Wait for that run to finish before starting another."
        ) from error


def release_lock() -> None:
    try:
        LOCK_PATH.rmdir()
    except OSError:
        pass


def read_previous_report() -> dict[str, Any]:
    try:
        payload = json.loads(REPORT_PATH.read_text(encoding="utf-8"))
        return payload if isinstance(payload, dict) else {}
    except (OSError, ValueError, TypeError):
        return {}


def collect_if_requested(args: argparse.Namespace) -> dict[str, Any]:
    trains = args.trains or os.getenv("RAILPULSE_DAILY_TRAIN_NUMBERS", "").strip()
    should_collect = args.collect or truthy(os.getenv("RAILPULSE_DAILY_COLLECT"))
    if not should_collect:
        return {"status": "not_requested", "message": "Live collection was not requested."}
    if not trains:
        return {
            "status": "not_configured",
            "message": "Set RAILPULSE_DAILY_TRAIN_NUMBERS to enable scheduled live collection.",
        }
    interval = max(30, args.interval or configured_int(os.getenv("RAILPULSE_DAILY_COLLECTION_INTERVAL_SECONDS"), 300))
    duration = max(interval, args.duration or configured_int(os.getenv("RAILPULSE_DAILY_COLLECTION_SECONDS"), 3600))
    command = [
        sys.executable, str(ROOT_DIR / "scripts" / "15_collect_live_feedback.py"),
        "--trains", trains, "--interval", str(interval), "--duration", str(duration),
    ]
    if args.date:
        command.extend(["--date", args.date])
    result = run_command("live_collection", command)
    result.update({"trains": trains, "interval_seconds": interval, "duration_seconds": duration})
    return result


def export_datasets() -> dict[str, dict[str, Any]]:
    from api.services.feedback_store import (
        export_completed_journeys,
        export_phase3_movement_dataset,
        export_station_level_dataset,
    )

    outputs = {
        "completed_journeys": ROOT_DIR / "data" / "online_completed_journeys.csv",
        "station_level": ROOT_DIR / "data" / "station_level_training.csv",
        "phase3_movement": ROOT_DIR / "data" / "phase3_movement_training.csv",
    }
    exporters = {
        "completed_journeys": export_completed_journeys,
        "station_level": export_station_level_dataset,
        "phase3_movement": export_phase3_movement_dataset,
    }
    datasets: dict[str, dict[str, Any]] = {}
    for name, path in outputs.items():
        try:
            rows = int(exporters[name](path))
            error = None
        except Exception as exc:  # keep the report useful if one export fails
            rows = 0
            error = f"{type(exc).__name__}: {exc}"
        datasets[name] = {
            "path": str(path.relative_to(ROOT_DIR)),
            "rows": rows if error is None else line_count(path),
            "sha256": sha256_file(path),
            "error": error,
        }
    return datasets


def changed(dataset: dict[str, Any], previous: dict[str, Any], name: str, force: bool) -> bool:
    if force:
        return True
    old = (previous.get("datasets") or {}).get(name) or {}
    return dataset.get("sha256") != old.get("sha256")


def training_stages(datasets: dict[str, dict[str, Any]], previous: dict[str, Any], force: bool) -> list[dict[str, Any]]:
    python = sys.executable
    scripts_dir = ROOT_DIR / "scripts"
    stages: list[dict[str, Any]] = []

    main_model_artifacts = [
        ROOT_DIR / "models" / name
        for name in ("eta_quantile_p10.pkl", "eta_regressor.pkl", "eta_quantile_p90.pkl", "feature_defaults.json", "historical_delay_records.json", "model_metadata.json")
    ]
    if changed(datasets["completed_journeys"], previous, "completed_journeys", force):
        if not (ROOT_DIR / "data" / "ir_train.csv").exists():
            # Full IR dataset unavailable (e.g. cloud deployment).
            # Fall back to the online-only trainer which uses live feedback
            # data only — no ir_train.csv dependency.
            online_artifacts = [
                ROOT_DIR / "models" / name
                for name in ("eta_quantile_p10.pkl", "eta_regressor.pkl", "eta_quantile_p90.pkl",
                             "feature_defaults.json", "model_metadata.json")
            ]
            stages.append(guarded_command(
                "main_eta_training",
                [python, str(scripts_dir / "21_train_online_only.py")],
                online_artifacts,
            ))
        else:
            stages.append(guarded_command(
                "main_eta_training",
                [python, str(scripts_dir / "12_train_ir_production.py")],
                main_model_artifacts,
            ))
    else:
        stages.append({"name": "main_eta_training", "status": "unchanged", "message": "No new completed journeys."})


    phase2_artifacts = [
        ROOT_DIR / "models" / f"phase2_{target}_{quantile}.pkl"
        for target in ("travel", "delay")
        for quantile in ("p10", "p50", "p90")
    ] + [ROOT_DIR / "models" / "phase2_model_metadata.json"]
    if changed(datasets["station_level"], previous, "station_level", force):
        stages.append(guarded_command(
            "phase2_next_station_training",
            [python, str(scripts_dir / "13_train_next_station_models.py")],
            phase2_artifacts,
        ))
    else:
        stages.append({"name": "phase2_next_station_training", "status": "unchanged", "message": "No new station labels."})

    phase3_artifacts = [
        ROOT_DIR / "models" / f"phase3_{target}_{quantile}.pkl"
        for target in ("travel", "delay_change")
        for quantile in ("p10", "p50", "p90")
    ] + [ROOT_DIR / "models" / "phase3_model_metadata.json"]
    if changed(datasets["phase3_movement"], previous, "phase3_movement", force):
        stages.append(guarded_command(
            "phase3_movement_training",
            [python, str(scripts_dir / "14_train_phase3_movement_models.py")],
            phase3_artifacts,
        ))
    else:
        stages.append({"name": "phase3_movement_training", "status": "unchanged", "message": "No new movement labels."})
    return stages


def write_report(report: dict[str, Any]) -> None:
    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(
        "w", encoding="utf-8", dir=REPORT_PATH.parent,
        prefix=f".{REPORT_PATH.name}.", suffix=".tmp", delete=False,
    ) as temporary:
        temporary.write(json.dumps(report, indent=2, sort_keys=True) + "\n")
        temporary.flush()
        os.fsync(temporary.fileno())
        temporary_path = Path(temporary.name)
    temporary_path.replace(REPORT_PATH)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--collect", action="store_true", help="Poll configured trains before exporting datasets")
    parser.add_argument("--trains", help="Comma-separated train numbers for this collection run")
    parser.add_argument("--interval", type=int, help="Collection interval in seconds (minimum 30)")
    parser.add_argument("--duration", type=int, help="Collection duration in seconds")
    parser.add_argument("--date", help="Journey date YYYY-MM-DD; defaults to today")
    parser.add_argument("--force", action="store_true", help="Run all trainers even when dataset fingerprints are unchanged")
    args = parser.parse_args()
    load_local_env()
    acquire_lock()
    started = dt.datetime.now(dt.timezone.utc)
    previous = read_previous_report()
    try:
        collection = collect_if_requested(args)
        datasets = export_datasets()
        training = training_stages(datasets, previous, args.force)
        training_errors = [stage for stage in training if stage.get("status") in {"failed_or_gated", "blocked"}]
        dataset_errors = [name for name, dataset in datasets.items() if dataset.get("error")]
        collection_gated = collection.get("status") in {"failed_or_gated", "not_configured"}
        if training_errors or dataset_errors or collection_gated:
            overall = "completed_with_gates"
        else:
            overall = "completed"
        report = {
            "status": overall,
            "run_started_utc": started.isoformat(),
            "run_finished_utc": dt.datetime.now(dt.timezone.utc).isoformat(),
            "collection": collection,
            "datasets": datasets,
            "training": training,
            "new_verified_data": any(
                changed(datasets[name], previous, name, args.force)
                for name in datasets
            ),
            "message": (
                "The report contains a collection, export, or training gate; inspect the stage details before treating the run as complete."
                if training_errors or dataset_errors or collection_gated
                else "Verified datasets were refreshed and eligible trainers completed."
            ),
        }
        write_report(report)
        print(json.dumps(report, indent=2))
        raise SystemExit(0 if overall == "completed" else 2)
    finally:
        release_lock()


if __name__ == "__main__":
    main()
