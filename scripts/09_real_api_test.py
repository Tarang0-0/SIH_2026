import pandas as pd
import numpy as np
import os
import joblib
import json
from datetime import datetime

# Import the explainer
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from src.explainability import DelayExplainer

def main():
    # Paths
    TEST_PATH = 'data/splits/test.parquet'
    MODEL_P50_PATH = 'models/eta_regressor.pkl'
    MODEL_P10_PATH = 'models/eta_quantile_p10.pkl'
    MODEL_P90_PATH = 'models/eta_quantile_p90.pkl'
    
    EXCLUDE_COLS = [
        'train_no', 'date', 'station_code', 'scheduled_arrival', 
        'actual_arrival', 'delay_minutes', 'delay_reason'
    ]

    print("=== LOADING REAL DATA AND MODELS ===")
    if not os.path.exists(TEST_PATH):
        print(f"FATAL: {TEST_PATH} not found. Please ensure the parquet files exist.")
        return
        
    df_test = pd.read_parquet(TEST_PATH)
    
    # 1. Sample 5 real rows reproducibly
    sample_df = df_test.sample(5, random_state=42).copy()
    
    # Load Models
    model_p50 = joblib.load(MODEL_P50_PATH)
    model_p10 = joblib.load(MODEL_P10_PATH)
    model_p90 = joblib.load(MODEL_P90_PATH)
    
    # Initialize Explainer
    explainer = DelayExplainer(model_p50)
    
    # Prepare features
    df_feat = sample_df.drop(columns=[c for c in EXCLUDE_COLS if c in sample_df.columns], errors='ignore')
    cat_cols = [c for c in ['train_type', 'day_of_week', 'weather', 'season'] if c in df_feat.columns]
    df_feat = pd.get_dummies(df_feat, columns=cat_cols)
    
    # Align columns
    expected_features = model_p50.feature_names_in_
    for c in set(expected_features) - set(df_feat.columns):
        df_feat[c] = False
    X_sample = df_feat[list(expected_features)].astype(float)
    
    # Predict
    p50_raw = model_p50.predict(X_sample)
    p10_raw = model_p10.predict(X_sample)
    p90_raw = model_p90.predict(X_sample)
    
    # Apply np.sort fix
    preds = np.column_stack([p10_raw, p50_raw, p90_raw])
    preds_sorted = np.sort(preds, axis=1)
    p10 = preds_sorted[:, 0]
    p50 = preds_sorted[:, 1]
    p90 = preds_sorted[:, 2]
    
    # Confidence Score
    width = np.clip(p90 - p10, a_min=0, a_max=None)
    confidence = 100.0 * np.exp(-0.02 * width)
    
    # SHAP Values
    shap_vals_matrix = explainer.get_shap_values(X_sample)
    
    print("\n=======================================================")
    print("                RAW MODEL OUTPUT STAGE                 ")
    print("=======================================================\n")
    
    api_responses = []
    
    for i in range(len(sample_df)):
        row = sample_df.iloc[i]
        feat_vals = X_sample.iloc[i].values
        shap_vals = shap_vals_matrix[i]
        
        # Raw Data Print
        print(f"--- SAMPLE {i+1} : {row['train_no']} at {row['station_code']} ---")
        print(f"RAW P10: {p10[i]:.2f}")
        print(f"RAW P50: {p50[i]:.2f}")
        print(f"RAW P90: {p90[i]:.2f}")
        print(f"RAW Width: {width[i]:.2f}")
        print(f"RAW Confidence: {confidence[i]:.2f}%")
        print(f"RAW SHAP Top 3 (Feature, Value, Impact):")
        
        feature_data = []
        for name, val, impact in zip(expected_features, feat_vals, shap_vals):
            if impact > 0:
                feature_data.append((name, val, impact))
        feature_data.sort(key=lambda x: x[2], reverse=True)
        for feat in feature_data[:3]:
            print(f"   -> {feat[0]}: val={feat[1]:.2f}, SHAP={feat[2]:.2f}")
            
        print("-" * 55)
        
        # Format for API
        explanation = explainer.explain_delay(
            predicted_delay=p50[i],
            feature_names=list(expected_features),
            feature_values=feat_vals,
            shap_values=shap_vals
        )
        
        sched_time = pd.to_datetime(row['scheduled_arrival'])
        pred_time = sched_time + pd.Timedelta(minutes=int(p50[i]))
        
        api_obj = {
            "station_code": str(row['station_code']),
            "scheduled_arrival": sched_time.strftime("%H:%M"),
            "predicted_arrival": pred_time.strftime("%H:%M"),
            "delay_minutes": int(p50[i]),
            "confidence_percent": int(confidence[i]),
            "delay_reason": explanation,
            "platform_prediction": "Not yet implemented - planned for production"
        }
        
        train_response = {
            "train_number": str(row['train_no']),
            "train_name": str(row.get('train_name', 'Unknown Express')),
            "last_updated": datetime.now().strftime("%Y-%m-%dT%H:%M:%S+05:30"),
            "current_location": { 
                "lat": 0.0, "lon": 0.0, 
                "section": f"APPROACHING-{row['station_code']}" 
            },
            "stations": [api_obj]
        }
        api_responses.append(train_response)

    print("\n=======================================================")
    print("                FINAL JSON API SCHEMA                  ")
    print("=======================================================\n")
    print(json.dumps(api_responses, indent=2))

if __name__ == '__main__':
    main()
