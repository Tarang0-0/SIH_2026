"""Run all data exports/trainers in order without bypassing any gates."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[1]
PYTHON = ROOT_DIR / "ml" / "venv" / "bin" / "python"


def run(script: str) -> dict[str, object]:
    completed = subprocess.run(
        [str(PYTHON), str(ROOT_DIR / "scripts" / script)],
        cwd=ROOT_DIR, text=True, capture_output=True,
    )
    return {
        "script": script,
        "exit_code": completed.returncode,
        "status": "completed" if completed.returncode == 0 else "gated_or_failed",
        "output_tail": (completed.stdout + completed.stderr).splitlines()[-8:],
    }


def main() -> None:
    results = [
        run("build_station_level_dataset.py"), run("13_train_next_station_models.py"),
        run("build_phase3_movement_dataset.py"), run("14_train_phase3_movement_models.py"),
    ]
    print(json.dumps({"pipeline": "phase2-phase3", "results": results}, indent=2))
    # A data gate is expected until verified live labels exist, but it must
    # still be visible to CI/orchestration as a non-successful run.
    if any(result["exit_code"] != 0 for result in results):
        raise SystemExit(1)


if __name__ == "__main__":
    main()
