"""Read the last daily data and retraining run without touching the pipeline."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any


ROOT_DIR = Path(__file__).resolve().parents[2]
STATUS_PATH = ROOT_DIR / "reports" / "daily_learning_status.json"


def load_learning_status(path: Path = STATUS_PATH) -> dict[str, Any]:
    """Return the latest local pipeline report, or an explicit not-run state."""
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError, TypeError):
        return {
            "status": "not_run",
            "message": "The daily learning pipeline has not produced a report yet.",
            "report_path": str(path),
        }
    if not isinstance(payload, dict):
        return {
            "status": "invalid",
            "message": "The daily learning report is not a JSON object.",
            "report_path": str(path),
        }
    return payload
