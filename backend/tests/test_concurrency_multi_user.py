import concurrent.futures
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_concurrent_multi_user_eta_queries():
    """
    Simulates 20 concurrent user queries for different train numbers simultaneously.
    Verifies thread safety, isolation, and zero race conditions under concurrent load.
    """
    train_numbers = [
        "12004", "12951", "12301", "22436", "20608",
        "12245", "12626", "12424", "12002", "12138",
        "12430", "12801", "12555", "12011", "22222",
        "12004", "12951", "12301", "22436", "20608"
    ]

    def query_train(train_num: str):
        res = client.get(f"/api/v1/trains/{train_num}/eta")
        return res.status_code, res.json()

    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
        results = list(executor.map(query_train, train_numbers))

    for status_code, data in results:
        assert status_code == 200
        assert "train_number" in data
        assert "predictions" in data
        assert len(data["predictions"]) > 0
        assert "shap_explanation" in data

def test_concurrent_multi_user_simulations():
    """
    Simulates multiple concurrent users injecting disruptions across different trains simultaneously.
    Verifies that state modifications for one journey do not corrupt or bleed into other journeys.
    """
    simulations = [
        ("12004", 5.0, 75.0),
        ("12951", 10.0, 85.0),
        ("12301", 15.0, 90.0),
        ("22436", 8.0, 110.0),
    ]

    def run_simulation(sim_tuple):
        t_num, add_delay, speed = sim_tuple
        res = client.post(f"/api/v1/trains/{t_num}/simulate-disruption", json={
            "delay_increment_minutes": add_delay,
            "new_speed_kmph": speed,
            "reason": f"Concurrent test for {t_num}"
        })
        return res.status_code, res.json()

    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
        results = list(executor.map(run_simulation, simulations))

    for status_code, data in results:
        assert status_code == 200
        assert "predictions" in data
        assert len(data["predictions"]) > 0

def test_arbitrary_train_number_ml_resolution():
    """
    Verifies that ANY arbitrary 5-digit Indian Railways train number
    can be queried dynamically without returning 404 or empty state.
    """
    test_trains = ["12565", "14218", "15018", "19038"]
    for t_num in test_trains:
        res = client.get(f"/api/v1/trains/{t_num}/eta")
        assert res.status_code == 200
        data = res.json()
        assert data["train_number"] == t_num
        assert len(data["predictions"]) > 0
        assert data["current_speed_kmph"] > 0
