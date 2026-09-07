"""Local alert-subscription store and simulator.

The simulator does not send messages. Its persistence logic is nevertheless
atomic so a malformed or interrupted write cannot silently lose every alert.
"""

import datetime as dt
import json
import os
import tempfile
import threading
import uuid
from typing import Any, Dict, List
from zoneinfo import ZoneInfo

from fastapi import APIRouter, HTTPException

from api.schemas import AlertSubscriptionRequest, AlertSubscriptionResponse, AlertTriggerResponse

router = APIRouter(prefix="/api/v1/alerts", tags=["Alerts & Notifications"])
ALERTS_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "data", "alerts_registry.json")
_alerts_lock = threading.Lock()
IST = ZoneInfo("Asia/Kolkata")


def load_alerts() -> List[Dict[str, Any]]:
    if not os.path.exists(ALERTS_FILE):
        return []
    try:
        with open(ALERTS_FILE, "r", encoding="utf-8") as file:
            alerts = json.load(file)
    except (OSError, json.JSONDecodeError):
        return []
    return alerts if isinstance(alerts, list) else []


def save_alerts(alerts: List[Dict[str, Any]]) -> None:
    """Atomically replace the registry or raise, rather than claiming success."""
    directory = os.path.dirname(ALERTS_FILE)
    os.makedirs(directory, exist_ok=True)
    descriptor, temporary_path = tempfile.mkstemp(prefix=".alerts-", suffix=".json", dir=directory)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as file:
            json.dump(alerts, file, indent=2)
            file.flush()
            os.fsync(file.fileno())
        os.replace(temporary_path, ALERTS_FILE)
    except OSError:
        try:
            os.unlink(temporary_path)
        except OSError:
            pass
        raise


def _public_alert(alert: Dict[str, Any]) -> Dict[str, Any]:
    """The list endpoint must not expose subscribers' phone numbers."""
    return {key: value for key, value in alert.items() if key != "user_phone"}


@router.post("/subscribe", response_model=AlertSubscriptionResponse, status_code=201)
def subscribe_to_alerts(subscription: AlertSubscriptionRequest):
    """Register an alert; actual message dispatch remains intentionally simulated."""
    sub_dict = subscription.model_dump(mode="json")
    sub_dict.update({
        "id": f"sub_{uuid.uuid4().hex}",
        "station_code": subscription.station_code.upper(),
        "created_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        "status": "ACTIVE",
    })
    try:
        with _alerts_lock:
            alerts = load_alerts()
            alerts.append(sub_dict)
            save_alerts(alerts)
    except OSError as error:
        raise HTTPException(status_code=503, detail="Alert registry is temporarily unavailable") from error
    return AlertSubscriptionResponse(
        status="success",
        message=f"Proactive alert registered for Train {subscription.train_number} arriving at {sub_dict['station_code']}",
        subscription_id=sub_dict["id"],
        notification_rules=[
            f"SMS dispatched when train is {subscription.alert_window_minutes} mins from {sub_dict['station_code']}",
            "Instant WhatsApp alert if compounding delay increases by > 10 mins",
            "Platform assignment change push alert",
        ],
    )


@router.get("/active")
def get_active_alerts():
    """List subscriptions without leaking users' contact details."""
    alerts = load_alerts()
    active_alerts = [alert for alert in alerts if alert.get("status") == "ACTIVE"]
    return {"count": len(active_alerts), "subscriptions": [_public_alert(alert) for alert in active_alerts]}


@router.post("/simulate-trigger/{subscription_id}", response_model=AlertTriggerResponse)
def simulate_alert_trigger(subscription_id: str):
    """Return the notification payload a worker would dispatch for a real subscription."""
    sub = next((alert for alert in load_alerts() if alert.get("id") == subscription_id and alert.get("status") == "ACTIVE"), None)
    if sub is None:
        raise HTTPException(status_code=404, detail="Active alert subscription not found")
    train_number, station_code = sub["train_number"], sub["station_code"]
    return AlertTriggerResponse(
        status="DISPATCHED", channel="SMS_GATEWAY_SIMULATOR", recipient=sub["user_phone"],
        dispatched_at=dt.datetime.now(IST).isoformat(timespec="seconds"),
        payload={
            "title": f"🚨 RailPulse Alert: Train {train_number}",
            "body": f"Your train #{train_number} is approaching {station_code}. Predicted arrival is updated by RailPulse AI.",
        },
    )
