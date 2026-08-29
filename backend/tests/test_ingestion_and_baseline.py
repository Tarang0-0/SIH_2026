import os
import json
import pytest
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient
from app.main import app
from app.schemas.event import CanonicalTrainEvent
from app.services.baseline import calculate_baseline_eta
from app.services.ingestion import MOCK_JOURNEY_STORE

client = TestClient(app)

@pytest.fixture(autouse=True)
def reset_mock_store():
    """Reset mock journey store before each test to ensure test isolation."""
    MOCK_JOURNEY_STORE["J1001"] = {
        "journey_id": "J1001",
        "train_number": "12004",
        "train_name": "Lucknow Swarna Shatabdi Express",
        "current_station": "NDLS",
        "next_station": "GZB",
        "current_delay_minutes": 0,
        "current_speed_kmph": 0.0,
        "last_update_timestamp": datetime.fromisoformat("2026-08-27T06:10:00+00:00"),
        "data_source": "SIMULATED"
    }
    MOCK_JOURNEY_STORE["J1002"] = {
        "journey_id": "J1002",
        "train_number": "12951",
        "train_name": "Mumbai Rajdhani Express",
        "current_station": "BCT",
        "next_station": "ST",
        "current_delay_minutes": 15,
        "current_speed_kmph": 92.0,
        "last_update_timestamp": datetime.fromisoformat("2026-08-27T17:00:00+00:00"),
        "data_source": "SIMULATED"
    }

# 1. Valid Event Ingestion Test
def test_01_valid_event_ingestion():
    payload = {
        "journey_id": "J1001",
        "timestamp": "2026-08-27T06:50:00Z",
        "latitude": 28.6657,
        "longitude": 77.4393,
        "speed_kmph": 62.0,
        "delay_minutes": 8,
        "current_station": "GZB",
        "next_station": "ALJN",
        "source": "SIMULATED"
    }
    response = client.post("/api/v1/running-updates", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["journey_id"] == "J1001"
    assert "running_update_id" in data
    assert data["baseline_etas_calculated"] > 0

# 2. Malformed Payload Handling Test
def test_02_malformed_payload_missing_field():
    payload = {
        "journey_id": "J1001",
        "timestamp": "2026-08-27T06:50:00Z",
        "speed_kmph": 62.0,
        # Missing required delay_minutes, current_station, next_station
    }
    response = client.post("/api/v1/running-updates", json=payload)
    assert response.status_code == 422 # Unprocessable entity

# 3. Duplicate Event Handling Test
def test_03_duplicate_event_handling():
    payload = {
        "journey_id": "J1001",
        "timestamp": "2026-08-27T06:50:00Z",
        "latitude": 28.6657,
        "longitude": 77.4393,
        "speed_kmph": 62.0,
        "delay_minutes": 8,
        "current_station": "GZB",
        "next_station": "ALJN",
        "source": "SIMULATED"
    }
    response1 = client.post("/api/v1/running-updates", json=payload)
    response2 = client.post("/api/v1/running-updates", json=payload)
    assert response1.status_code == 200
    assert response2.status_code == 200

# 4. Out-of-Order Event Handling Test
def test_04_out_of_order_event_handling():
    # Newer event
    newer_payload = {
        "journey_id": "J1001",
        "timestamp": "2026-08-27T10:00:00Z",
        "latitude": 27.8974,
        "longitude": 78.0777,
        "speed_kmph": 90.0,
        "delay_minutes": 10,
        "current_station": "ALJN",
        "next_station": "CNB",
        "source": "SIMULATED"
    }
    client.post("/api/v1/running-updates", json=newer_payload)

    # Out-of-order older event (08:00 < 10:00)
    older_payload = {
        "journey_id": "J1001",
        "timestamp": "2026-08-27T08:00:00Z",
        "latitude": 28.6657,
        "longitude": 77.4393,
        "speed_kmph": 50.0,
        "delay_minutes": 2,
        "current_station": "GZB",
        "next_station": "ALJN",
        "source": "SIMULATED"
    }
    response = client.post("/api/v1/running-updates", json=older_payload)
    assert response.status_code == 200
    data = response.json()
    assert data["journey_state_updated"] == False
    assert data["is_out_of_order"] == True

# 5. Stale Event Ingestion Test
def test_05_stale_event_ingestion():
    # Event timestamp 2 hours ago
    stale_ts = (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat()
    payload = {
        "journey_id": "J1001",
        "timestamp": stale_ts,
        "latitude": 28.6657,
        "longitude": 77.4393,
        "speed_kmph": 60.0,
        "delay_minutes": 5,
        "current_station": "GZB",
        "next_station": "ALJN",
        "source": "SIMULATED"
    }
    response = client.post("/api/v1/running-updates", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["is_stale"] == True

# 6. Impossible Speed Validation Test
def test_06_impossible_speed_validation():
    payload = {
        "journey_id": "J1001",
        "timestamp": "2026-08-27T12:00:00Z",
        "latitude": 28.6657,
        "longitude": 77.4393,
        "speed_kmph": 250.0, # > 220 km/h threshold
        "delay_minutes": 5,
        "current_station": "GZB",
        "next_station": "ALJN",
        "source": "SIMULATED"
    }
    response = client.post("/api/v1/running-updates", json=payload)
    assert response.status_code == 400
    assert "Speed 250.0 km/h is out of valid range" in response.json()["detail"]

# 7. Invalid Coordinates Validation Test
def test_07_invalid_coordinates_validation():
    payload = {
        "journey_id": "J1001",
        "timestamp": "2026-08-27T12:00:00Z",
        "latitude": 95.0, # Invalid lat > 90
        "longitude": 77.4393,
        "speed_kmph": 60.0,
        "delay_minutes": 5,
        "current_station": "GZB",
        "next_station": "ALJN",
        "source": "SIMULATED"
    }
    response = client.post("/api/v1/running-updates", json=payload)
    assert response.status_code == 400
    assert "Latitude 95.0 out of valid bounds" in response.json()["detail"]

# 8. Negative Delay Handling Test
def test_08_negative_delay_handling():
    # Ahead of schedule by 5 minutes (-5 delay)
    payload = {
        "journey_id": "J1001",
        "timestamp": "2026-08-27T12:00:00Z",
        "latitude": 28.6657,
        "longitude": 77.4393,
        "speed_kmph": 85.0,
        "delay_minutes": -5,
        "current_station": "NDLS",
        "next_station": "GZB",
        "source": "SIMULATED"
    }
    response = client.post("/api/v1/running-updates", json=payload)
    assert response.status_code == 200

    eta_res = client.get("/api/v1/trains/J1001/eta")
    assert eta_res.status_code == 200
    eta_data = eta_res.json()
    assert eta_data["current_delay_minutes"] == -5
    # GZB scheduled arrival is 06:48:00. Delay -5 mins -> 06:43:00
    gzb_prediction = eta_data["predictions"][0]
    assert gzb_prediction["station_code"] == "GZB"
    assert "06:43:00" in gzb_prediction["baseline_eta"]

# 9. Unrecognized Station Code Test
def test_09_unrecognized_station_code():
    payload = {
        "journey_id": "J1001",
        "timestamp": "2026-08-27T12:00:00Z",
        "latitude": 28.6657,
        "longitude": 77.4393,
        "speed_kmph": 60.0,
        "delay_minutes": 5,
        "current_station": "INVALID_CODE",
        "next_station": "ALJN",
        "source": "SIMULATED"
    }
    response = client.post("/api/v1/running-updates", json=payload)
    assert response.status_code == 404

# 10. Baseline ETA Formula Calculation Test
def test_10_baseline_eta_formula_calculation():
    payload = {
        "journey_id": "J1001",
        "timestamp": "2026-08-27T13:00:00Z",
        "latitude": 28.6657,
        "longitude": 77.4393,
        "speed_kmph": 80.0,
        "delay_minutes": 10,
        "current_station": "GZB",
        "next_station": "ALJN",
        "source": "SIMULATED"
    }
    client.post("/api/v1/running-updates", json=payload)

    response = client.get("/api/v1/trains/J1001/eta")
    assert response.status_code == 200
    data = response.json()
    assert data["current_delay_minutes"] == 10
    
    # ALJN scheduled arrival is 07:49:00 + 10m = 07:59:00
    aljn_pred = [p for p in data["predictions"] if p["station_code"] == "ALJN"][0]
    assert "07:59:00" in aljn_pred["baseline_eta"]

# 11. Terminal Station Handling Test
def test_11_terminal_station_handling():
    payload = {
        "journey_id": "J1001",
        "timestamp": "2026-08-27T13:00:00Z",
        "latitude": 28.6657,
        "longitude": 77.4393,
        "speed_kmph": 80.0,
        "delay_minutes": 10,
        "current_station": "GZB",
        "next_station": "ALJN",
        "source": "SIMULATED"
    }
    client.post("/api/v1/running-updates", json=payload)

    response = client.get("/api/v1/trains/J1001/eta")
    data = response.json()
    lko_pred = [p for p in data["predictions"] if p["station_code"] == "LKO"][0]
    assert lko_pred["station_code"] == "LKO"
    # LKO scheduled arrival is 12:40:00 + 10m delay = 12:50:00
    assert "12:50:00" in lko_pred["baseline_eta"]

# 12. Multiple Upcoming Stations Sequence Order Test
def test_12_multiple_upcoming_stations_sequence():
    response = client.get("/api/v1/trains/J1001/eta")
    data = response.json()
    predictions = data["predictions"]
    # Sequence numbers should be strictly increasing
    seqs = [p["sequence_number"] for p in predictions]
    assert seqs == sorted(seqs)
    assert len(seqs) >= 3 # ALJN, CNB, LKO

# 13. Deterministic Replay Fixture Verification Test
def test_13_replay_fixture_parsing():
    fixture_path = os.path.join(os.path.dirname(__file__), "../../scripts/fixtures/j1001_replay_events.json")
    assert os.path.exists(fixture_path)
    
    with open(fixture_path, "r", encoding="utf-8") as f:
        events_json = json.load(f)
    
    assert len(events_json) >= 9
    for raw_event in events_json:
        event_obj = CanonicalTrainEvent(**raw_event)
        assert event_obj.journey_id == "J1001"
        assert event_obj.source == "SIMULATED"
