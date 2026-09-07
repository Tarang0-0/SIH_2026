"""Export terminal live observations for an explicit model retraining run."""

from pathlib import Path

from api.services.feedback_store import export_completed_journeys


if __name__ == "__main__":
    output = Path("data/online_completed_journeys.csv")
    count = export_completed_journeys(output)
    print(f"Exported {count:,} completed journeys to {output}")
