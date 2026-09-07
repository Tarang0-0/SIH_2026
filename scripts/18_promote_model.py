"""Promote a candidate only after Phase 5 safety checks pass."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from api.services.phase5_controls import promote_model


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("candidate", type=Path, help="JSON candidate manifest produced by a training/evaluation run")
    parser.add_argument("--registry", type=Path, default=ROOT_DIR / "models" / "model_registry.json")
    parser.add_argument("--min-rows", type=int, default=100)
    args = parser.parse_args()
    candidate = json.loads(args.candidate.read_text(encoding="utf-8"))
    try:
        entry = promote_model(candidate, args.registry, min_rows=args.min_rows)
    except (OSError, ValueError, TypeError, json.JSONDecodeError) as error:
        raise SystemExit(str(error)) from error
    print(json.dumps({"status": "promoted", "entry": entry}, indent=2))


if __name__ == "__main__":
    main()
