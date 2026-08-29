from fastapi.testclient import TestClient
from app.main import app
from app.schemas.event import CanonicalTrainEvent

client = TestClient(app)

def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "service" in data

def test_api_v1_health_check():
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"

def test_canonical_event_schema_validation():
    payload = {
        "journey_id": "J1001",
        "timestamp": "2026-08-27T12:10:00Z",
        "latitude": 27.1767,
        "longitude": 78.0081,
        "speed_kmph": 62.0,
        "delay_minutes": 9,
        "current_station": "GZB",
        "next_station": "ALJN",
        "source": "SIMULATED"
    }
    event = CanonicalTrainEvent(**payload)
    assert event.journey_id == "J1001"
    assert event.speed_kmph == 62.0
    assert event.delay_minutes == 9
    assert event.source == "SIMULATED"

def test_get_sample_trains():
    response = client.get("/api/v1/trains")
    assert response.status_code == 200
    trains = response.json()
    assert len(trains) >= 2
    assert trains[0]["journey_id"] == "J1001"
