"""
RailETA Database Repository Layer
Problem Statement: SIH26028 (Dynamic Forecast of ETA for Coaching Trains)

Handles persistent storage and retrieval for:
1. Train running states & telemetry updates
2. Dynamic ML & Baseline ETA forecasts
3. Ground-truth physical station arrivals
4. Longitudinal prediction error reconciliation and accuracy analytics

Supports Supabase PostgreSQL with local offline fallback.
"""

import uuid
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from collections import defaultdict

from app.db.supabase import get_db

logger = logging.getLogger("raileta.repository")


class ETADatabaseRepository:
    """
    Database repository cleanly isolating data persistence from the ML engine.
    """

    def __init__(self):
        # In-memory store used for offline demo / fallback execution
        self._local_trains: Dict[str, Dict] = {}
        self._local_updates: List[Dict] = []
        self._local_predictions: List[Dict] = []
        self._local_actual_arrivals: List[Dict] = []
        self._local_accuracy_logs: List[Dict] = []

    def save_running_update(
        self,
        journey_id: str,
        train_number: str,
        current_station: str,
        next_station: str,
        speed_kmh: float,
        delay_minutes: float,
        timestamp: Optional[datetime] = None,
        data_source: str = "SIMULATED"
    ) -> str:
        """
        Stores real-time telemetry punch into database.
        """
        update_id = f"UPD-{uuid.uuid4().hex[:8].upper()}"
        ts = timestamp or datetime.now(timezone.utc)

        record = {
            "id": update_id,
            "journey_id": journey_id,
            "train_number": train_number,
            "timestamp": ts.isoformat(),
            "speed_kmph": float(speed_kmh),
            "delay_minutes": float(delay_minutes),
            "current_station_code": current_station,
            "next_station_code": next_station,
            "data_source": data_source,
        }

        db_client = get_db()
        if db_client:
            try:
                db_client.table("running_updates").insert(record).execute()
            except Exception as e:
                logger.warning(f"Failed to insert running update to DB: {e}")

        self._local_updates.append(record)
        return update_id

    def save_eta_predictions(
        self,
        journey_id: str,
        train_number: str,
        predictions: List[Dict[str, Any]],
        prediction_timestamp: Optional[datetime] = None,
        model_version: str = "GBDT-v1.0",
        data_source: str = "SIMULATED",
    ) -> int:
        """
        Persists a batch of station ETA forecasts generated at a specific prediction timestamp.
        """
        ts = prediction_timestamp or datetime.now(timezone.utc)
        records = []

        for p in predictions:
            pred_id = f"PRED-{uuid.uuid4().hex[:8].upper()}"
            rec = {
                "id": pred_id,
                "journey_id": journey_id,
                "train_number": train_number,
                "target_station_code": p["station_code"],
                "predicted_arrival_time": p["predicted_eta"],
                "baseline_eta": p["baseline_eta"],
                "predicted_delay_minutes": float(p.get("predicted_delay_minutes", 0.0)),
                "lower_bound_minutes": float(p.get("lower_bound_minutes", -3.6)),
                "upper_bound_minutes": float(p.get("upper_bound_minutes", +3.6)),
                "model_version": model_version,
                "prediction_timestamp": ts.isoformat(),
                "data_source": data_source,
            }
            records.append(rec)

        db_client = get_db()
        if db_client and records:
            try:
                db_client.table("eta_predictions").insert(records).execute()
            except Exception as e:
                logger.warning(f"Failed to persist ETA predictions to DB: {e}")

        self._local_predictions.extend(records)
        return len(records)

    def record_actual_arrival(
        self,
        journey_id: str,
        train_number: str,
        station_code: str,
        actual_arrival_time: datetime,
        scheduled_arrival_time: datetime,
        actual_delay_minutes: float,
    ) -> Dict[str, Any]:
        """
        Ground Truth Outcome Reconciliation:
        Records actual physical arrival punch, reconciles all prior predictions for this station,
        and computes the empirical forecast accuracy improvement over baseline.
        """
        arrival_id = f"ARR-{uuid.uuid4().hex[:8].upper()}"
        arrival_rec = {
            "id": arrival_id,
            "journey_id": journey_id,
            "train_number": train_number,
            "station_code": station_code,
            "actual_arrival_time": actual_arrival_time.isoformat(),
            "scheduled_arrival_time": scheduled_arrival_time.isoformat(),
            "actual_delay_minutes": float(actual_delay_minutes),
            "recorded_at": datetime.now(timezone.utc).isoformat(),
        }

        self._local_actual_arrivals.append(arrival_rec)

        # Reconcile all historical predictions made for this journey & station
        matching_preds = [
            p for p in self._local_predictions
            if p["journey_id"] == journey_id and p["target_station_code"] == station_code
        ]

        evaluated_accuracy_logs = []
        for p in matching_preds:
            p_ts = datetime.fromisoformat(p["prediction_timestamp"])
            pred_arr = datetime.fromisoformat(p["predicted_arrival_time"])
            base_arr = datetime.fromisoformat(p["baseline_eta"])

            # Lead time in minutes (how far ahead the prediction was made)
            lead_time_min = max(0.1, (actual_arrival_time - p_ts).total_seconds() / 60.0)

            # Absolute Errors in minutes
            ml_err = abs((pred_arr - actual_arrival_time).total_seconds()) / 60.0
            base_err = abs((base_arr - actual_arrival_time).total_seconds()) / 60.0
            improvement = base_err - ml_err

            acc_log = {
                "id": f"ACC-{uuid.uuid4().hex[:8].upper()}",
                "prediction_id": p["id"],
                "journey_id": journey_id,
                "train_number": train_number,
                "target_station_code": station_code,
                "prediction_timestamp": p["prediction_timestamp"],
                "actual_arrival_time": actual_arrival_time.isoformat(),
                "lead_time_minutes": round(lead_time_min, 1),
                "predicted_arrival_time": p["predicted_arrival_time"],
                "baseline_arrival_time": p["baseline_eta"],
                "ml_error_minutes": round(ml_err, 2),
                "baseline_error_minutes": round(base_err, 2),
                "ml_improvement_minutes": round(improvement, 2),
                "within_5_min_flag": 1 if ml_err <= 5.0 else 0,
                "model_version": p.get("model_version", "GBDT-v1.0"),
            }
            evaluated_accuracy_logs.append(acc_log)

        self._local_accuracy_logs.extend(evaluated_accuracy_logs)

        # Sync to Supabase PostgreSQL if available
        db_client = get_db()
        if db_client:
            try:
                db_client.table("actual_arrivals").insert(arrival_rec).execute()
                if evaluated_accuracy_logs:
                    db_client.table("prediction_accuracy_logs").insert(evaluated_accuracy_logs).execute()
            except Exception as e:
                logger.warning(f"Failed to record actual arrival & accuracy logs to DB: {e}")

        return {
            "arrival_id": arrival_id,
            "station_code": station_code,
            "reconciled_predictions_count": len(evaluated_accuracy_logs),
            "accuracy_evaluations": evaluated_accuracy_logs,
        }

    def get_accuracy_analytics(self, journey_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Computes longitudinal accuracy analytics by lead-time windows (e.g. >2h, 1-2h, 30-60m, <30m).
        Shows how prediction accuracy improves as the train approaches the destination.
        """
        logs = self._local_accuracy_logs
        if journey_id:
            logs = [l for l in logs if l["journey_id"] == journey_id]

        if not logs:
            return {
                "total_evaluated_forecasts": 0,
                "lead_time_breakdown": [],
                "overall_ml_mae": 0.0,
                "overall_baseline_mae": 0.0,
                "accuracy_within_5_min_pct": 0.0,
            }

        # Bucket by lead time
        tiers = defaultdict(list)
        for l in logs:
            lead = l["lead_time_minutes"]
            if lead >= 120.0:
                tier = "4. Long-Range (>2 hrs)"
            elif lead >= 60.0:
                tier = "3. Mid-Range (1-2 hrs)"
            elif lead >= 30.0:
                tier = "2. Short-Range (30-60 min)"
            else:
                tier = "1. Imminent (<30 min)"
            tiers[tier].append(l)

        tier_summary = []
        for tier_name, tier_logs in sorted(tiers.items()):
            ml_errors = [x["ml_error_minutes"] for x in tier_logs]
            base_errors = [x["baseline_error_minutes"] for x in tier_logs]
            w5_flags = [x["within_5_min_flag"] for x in tier_logs]

            ml_mae = sum(ml_errors) / len(ml_errors)
            base_mae = sum(base_errors) / len(base_errors)
            gain_pct = ((base_mae - ml_mae) / max(0.01, base_mae)) * 100.0

            tier_summary.append({
                "lead_time_tier": tier_name,
                "forecast_count": len(tier_logs),
                "ml_mae_minutes": round(ml_mae, 2),
                "baseline_mae_minutes": round(base_mae, 2),
                "accuracy_gain_pct": round(gain_pct, 1),
                "pct_within_5_min": round((sum(w5_flags) / len(w5_flags)) * 100.0, 1),
            })

        all_ml_errs = [x["ml_error_minutes"] for x in logs]
        all_base_errs = [x["baseline_error_minutes"] for x in logs]
        all_w5 = [x["within_5_min_flag"] for x in logs]

        return {
            "total_evaluated_forecasts": len(logs),
            "overall_ml_mae": round(sum(all_ml_errs) / len(all_ml_errs), 2),
            "overall_baseline_mae": round(sum(all_base_errs) / len(all_base_errs), 2),
            "accuracy_within_5_min_pct": round((sum(all_w5) / len(all_w5)) * 100.0, 1),
            "lead_time_breakdown": tier_summary,
        }


# Singleton database repository instance
db_repository = ETADatabaseRepository()
