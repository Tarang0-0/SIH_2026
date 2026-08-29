import os
import joblib
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from app.main import app
from app.services.features import FeatureExtractor, FEATURE_COLUMNS
from app.services.ml_eta import MLETAEngine, predict_ml_eta

client = TestClient(app)

# 1. Zero-Leakage Feature Extraction Test (ML-01)
def test_01_feature_extractor_zero_leakage():
    now_ts = datetime.now(timezone.utc)
    features_df = FeatureExtractor.extract_features(
        current_delay_minutes=12.0,
        current_speed_kmph=85.0,
        section_distance_km=106.3,
        scheduled_section_minutes=59.0,
        historical_avg_running_minutes=57.0,
        historical_p90_running_minutes=68.0,
        train_type_encoded=0,
        timestamp=now_ts
    )
    
    assert list(features_df.columns) == FEATURE_COLUMNS
    assert len(features_df) == 1
    assert features_df["current_delay_minutes"].iloc[0] == 12.0
    assert features_df["departure_hour"].iloc[0] == now_ts.hour
    assert features_df["day_of_week"].iloc[0] == now_ts.weekday()

# 2. Model Loading and Artifact Verification (ML-02)
def test_02_model_loading_and_artifacts():
    engine = MLETAEngine.get_instance()
    assert engine.is_loaded is True
    assert engine.model is not None
    assert engine.explainer is not None
    assert "q10" in engine.residuals_meta
    assert "q90" in engine.residuals_meta

# 3. Dynamic ML ETA Endpoint Test (ML-02, ML-04, ML-05)
def test_03_ml_eta_prediction_endpoint():
    response = client.get("/api/v1/trains/12004/eta")
    assert response.status_code == 200
    data = response.json()
    
    assert data["journey_id"] == "J1001"
    assert data["train_number"] == "12004"
    assert len(data["predictions"]) >= 3
    
    # Check first upcoming prediction
    first_pred = data["predictions"][0]
    assert "predicted_eta" in first_pred
    assert "baseline_eta" in first_pred
    assert "confidence_range_lower" in first_pred
    assert "confidence_range_upper" in first_pred
    assert first_pred["model_version"] == "gbdt-v1.0"
    assert first_pred["data_source"] in ["REAL", "SIMULATED"]

# 4. Confidence Bounds Invariant Test (ML-04)
def test_04_confidence_bounds_invariant():
    response = client.get("/api/v1/trains/J1001/eta")
    assert response.status_code == 200
    data = response.json()

    for pred in data["predictions"]:
        lower_mins = pred["lower_bound_minutes"]
        upper_mins = pred["upper_bound_minutes"]
        pred_delay = pred["predicted_delay_minutes"]
        
        assert lower_mins <= upper_mins, f"Lower bound {lower_mins} > upper bound {upper_mins}"
        assert pred["confidence_range_lower"] <= pred["confidence_range_upper"]

# 5. SHAP Feature Attribution Structure Test (ML-05)
def test_05_shap_explanation_structure():
    response = client.get("/api/v1/trains/J1001/eta")
    assert response.status_code == 200
    data = response.json()

    shap_exp = data["shap_explanation"]
    assert isinstance(shap_exp, dict)
    assert len(shap_exp) <= 5 # Top-5 features
    for k, v in shap_exp.items():
        assert isinstance(k, str)
        assert isinstance(v, float)

# 6. Cascading Multi-Section Prediction Test (ML-02)
def test_06_cascading_multi_section_sequence():
    response = client.get("/api/v1/trains/J1001/eta")
    assert response.status_code == 200
    data = response.json()

    predictions = data["predictions"]
    seq_nums = [p["sequence_number"] for p in predictions]
    assert seq_nums == sorted(seq_nums)
    
    # Terminal station should be LKO for 12004
    lko_pred = [p for p in predictions if p["station_code"] == "LKO"][0]
    assert lko_pred["station_name"] == "Lucknow Charbagh"

# 7. Rajdhani Corridor ML Prediction Test (ML-02)
def test_07_rajdhani_ml_eta_prediction():
    response = client.get("/api/v1/trains/12951/eta")
    assert response.status_code == 200
    data = response.json()

    assert data["train_number"] == "12951"
    assert len(data["predictions"]) >= 5
    assert len(data["shap_explanation"]) > 0

# 8. Evaluation Benchmark Integrity Test (ML-03)
def test_08_evaluation_benchmark_superiority():
    models_dir = os.path.join(os.path.dirname(__file__), "../ml/models")
    residuals_file = os.path.join(models_dir, "residuals.pkl")
    assert os.path.exists(residuals_file)

    meta = joblib.load(residuals_file)
    assert meta["test_mae"] < 4.0 # Test MAE strictly under 4 min threshold
