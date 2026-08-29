import json
import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from app.main import app
from app.services.ingestion import MOCK_JOURNEY_STORE
from app.services.websocket_manager import ws_manager

client = TestClient(app)

@pytest.fixture(autouse=True)
def reset_mock_store():
    """Reset in-memory state and clear active WebSocket connections before each test."""
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
    ws_manager.active_journey_connections.clear()
    ws_manager.global_connections.clear()

# 1. Active Trains List Endpoint Test
def test_01_active_trains_list_endpoint():
    response = client.get("/api/v1/trains")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 2
    
    j1001 = next((t for t in data if t["journey_id"] == "J1001"), None)
    assert j1001 is not None
    assert j1001["train_number"] == "12004"
    assert j1001["origin"] == "NDLS"
    assert j1001["destination"] == "LKO"
    assert j1001["data_source"] in ["REAL", "SIMULATED"]

# 2. Train Route Topology Endpoint Test
def test_02_train_route_topology_endpoint():
    response = client.get("/api/v1/trains/12004/route")
    assert response.status_code == 200
    data = response.json()
    assert data["train_number"] == "12004"
    stations = data["stations"]
    assert len(stations) == 5
    codes = [s["station_code"] for s in stations]
    assert codes == ["NDLS", "GZB", "ALJN", "CNB", "LKO"]
    assert stations[0]["distance_km"] == 0.0
    assert stations[-1]["distance_km"] == 511.0

# 3. Train Route Not Found Test
def test_03_train_route_not_found():
    response = client.get("/api/v1/trains/99999/route")
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()

# 4. Train ETA Prediction Endpoint Test
def test_04_train_eta_prediction_endpoint():
    response = client.get("/api/v1/trains/12004/eta")
    assert response.status_code == 200
    data = response.json()
    assert data["train_number"] == "12004"
    assert len(data["predictions"]) > 0
    assert "shap_explanation" in data
    assert len(data["shap_explanation"]) > 0

# 5. WebSocket Journey Stream Connection & Initial Payload Test
def test_05_websocket_journey_connection_and_initial_payload():
    with client.websocket_connect("/ws/trains/J1001") as websocket:
        # Receive initial state pushed upon connection
        initial_msg = websocket.receive_text()
        data = json.loads(initial_msg)
        assert data["journey_id"] == "J1001"
        assert data["train_number"] == "12004"
        assert len(data["predictions"]) > 0

        # Send ping, receive pong
        websocket.send_text("ping")
        resp = websocket.receive_text()
        assert resp == "pong"

# 6. WebSocket Global Stream Connection Test
def test_06_websocket_global_stream_connection():
    with client.websocket_connect("/ws/live-stream") as websocket:
        websocket.send_text("ping")
        resp = websocket.receive_text()
        assert resp == "pong"

# 7. Ingestion Event Triggers Live WebSocket Broadcast Test
def test_07_ingestion_triggers_live_websocket_broadcast():
    with client.websocket_connect("/ws/trains/J1001") as websocket:
        # Discard initial payload
        websocket.receive_text()

        # Post a running update
        payload = {
            "journey_id": "J1001",
            "timestamp": "2026-08-27T06:55:00Z",
            "latitude": 28.6657,
            "longitude": 77.4393,
            "speed_kmph": 75.0,
            "delay_minutes": 6,
            "current_station": "GZB",
            "next_station": "ALJN",
            "source": "SIMULATED"
        }
        res = client.post("/api/v1/running-updates", json=payload)
        assert res.status_code == 200
        assert res.json()["websocket_broadcast"] is True

        # Verify broadcast received on WebSocket
        broadcast_msg = websocket.receive_text()
        event_data = json.loads(broadcast_msg)
        assert event_data["type"] == "ETA_UPDATE"
        assert event_data["journey_id"] == "J1001"
        assert "data" in event_data
        assert event_data["data"]["current_station_code"] == "GZB"
        assert event_data["data"]["current_delay_minutes"] == 6

# 8. Global Stream Receives Broadcast on Event Ingestion Test
def test_08_global_stream_receives_broadcast():
    with client.websocket_connect("/ws/live-stream") as global_ws:
        payload = {
            "journey_id": "J1001",
            "timestamp": "2026-08-27T07:15:00Z",
            "latitude": 28.6657,
            "longitude": 77.4393,
            "speed_kmph": 88.0,
            "delay_minutes": 4,
            "current_station": "GZB",
            "next_station": "ALJN",
            "source": "SIMULATED"
        }
        res = client.post("/api/v1/running-updates", json=payload)
        assert res.status_code == 200

        broadcast_msg = global_ws.receive_text()
        event_data = json.loads(broadcast_msg)
        assert event_data["type"] == "ETA_UPDATE"
        assert event_data["journey_id"] == "J1001"
        assert event_data["data"]["current_delay_minutes"] == 4

# 9. Disruption Simulation Endpoint Test (SIM-01)
def test_09_simulate_disruption_endpoint():
    with client.websocket_connect("/ws/trains/J1001") as websocket:
        # Discard initial payload
        websocket.receive_text()

        sim_payload = {
            "delay_increment_minutes": 12,
            "new_speed_kmph": 45.0,
            "reason": "Signal failure at Ghaziabad"
        }
        res = client.post("/api/v1/trains/12004/simulate-disruption", json=sim_payload)
        assert res.status_code == 200
        data = res.json()
        assert data["journey_id"] == "J1001"
        assert data["current_delay_minutes"] >= 12
        assert len(data["predictions"]) > 0

        # Verify broadcast on WebSocket
        broadcast_msg = websocket.receive_text()
        event_data = json.loads(broadcast_msg)
        assert event_data["type"] == "ETA_UPDATE"
        assert event_data["simulation_reason"] == "Signal failure at Ghaziabad"
        assert event_data["data"]["current_delay_minutes"] >= 12


# 10. Disruption Simulation Not Found Test
def test_10_simulate_disruption_not_found():
    sim_payload = {"delay_increment_minutes": 10}
    res = client.post("/api/v1/trains/UNKNOWN_ID/simulate-disruption", json=sim_payload)
    assert res.status_code == 404

# 11. Custom Disruption Simulation POST /simulate/disruption Test
def test_11_simulate_disruption_custom_endpoint():
    with client.websocket_connect("/ws/trains/J1001") as websocket:
        websocket.receive_text() # initial

        disruption_req = {
            "journey_id": "J1001",
            "additional_delay_minutes": 25.0,
            "section_from": "GZB",
            "section_to": "ALJN",
            "disruption_type": "Signal Failure"
        }
        res = client.post("/api/v1/simulate/disruption", json=disruption_req)
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "success"
        assert data["injected_delay_minutes"] == 25.0
        assert data["new_total_delay_minutes"] >= 25.0
        assert data["websocket_broadcast"] is True
        assert len(data["prediction"]["predictions"]) > 0

        # Receive WebSocket broadcast
        broadcast_msg = websocket.receive_text()
        ws_data = json.loads(broadcast_msg)
        assert ws_data["type"] == "ETA_UPDATE"
        assert ws_data["disruption_simulation"] is True
        assert ws_data["disruption_type"] == "Signal Failure"

# 12. Real-Time Autocomplete Search Trains Test
def test_12_search_trains_endpoint():
    res = client.get("/api/v1/trains/search?q=Shatabdi")
    assert res.status_code == 200
    data = res.json()
    assert len(data) >= 1
    assert data[0]["train_number"] == "12004"

    res_num = client.get("/api/v1/trains/search?q=12951")
    assert res_num.status_code == 200
    data_num = res_num.json()
    assert len(data_num) >= 1
    assert "Mumbai Rajdhani" in data_num[0]["train_name"]



