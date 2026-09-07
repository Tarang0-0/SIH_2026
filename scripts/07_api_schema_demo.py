import pandas as pd
import numpy as np
import os
import sys
import json
from datetime import datetime, timedelta

# Mock generator that includes all necessary columns for the API
np.random.seed(42)
n_rows = 5
df = pd.DataFrame({
    'train_no': np.random.choice(['22691', '12951', '12627', '12301', '12423'], n_rows, replace=False),
    'station_code': ['GZB', 'CNB', 'NDLS', 'BCT', 'MAS'],
    'scheduled_arrival': ['2024-06-15 10:55', '2024-06-15 14:30', '2024-06-15 18:00', '2024-06-16 08:45', '2024-06-16 11:20'],
    
    # Feature inputs
    'delay_at_previous_station': [12, 45, 0, 110, 22],
    'weather_Rain': [0, 1, 0, 1, 0],
    'weather_Clear': [1, 0, 1, 0, 1],
    'weather_Fog': [0, 0, 0, 0, 0],
    'congestion_index': [0.6, 0.9, 0.2, 0.8, 0.3],
    'preceding_train_delay': [9, 35, 0, 85, 12],
    'historical_avg_delay_for_this_train': [15, 20, 5, 40, 10],
    'station_density_last_3_stops': [4.5, 6.2, 8.1, 5.0, 3.2],
    'delay_trend_last_2_stops': [2, 10, -5, 25, 1],
    'distance_from_origin': [250, 400, 10, 1200, 800]
})

# Simulate Model Predictions
df['predicted_delay_minutes'] = df['delay_at_previous_station'] + \
    df['weather_Rain'] * 30 + \
    np.where(df['congestion_index'] > 0.5, 15, 0) + \
    np.random.normal(0, 3, n_rows).astype(int)
    
df['predicted_delay_minutes'] = df['predicted_delay_minutes'].clip(lower=0)

# Simulate P10 and P90 for confidence
df['p10'] = df['predicted_delay_minutes'] - np.random.uniform(5, 20, n_rows)
df['p90'] = df['predicted_delay_minutes'] + np.random.uniform(5, 20, n_rows)
df['width'] = df['p90'] - df['p10']
df['confidence_percent'] = (100.0 * np.exp(-0.02 * df['width'])).astype(int)

# Platform
df['platform_prediction'] = np.random.randint(1, 8, n_rows)

import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from src.explainability import DelayExplainer

# Dummy Explainer wrapper since we don't have SHAP installed
class DummyExplainer:
    def explain_delay(self, predicted_delay, row):
        if predicted_delay < 5:
            return "Predicted mostly on time — no major delaying factors."
            
        factors = []
        if row['weather_Rain'] == 1:
            factors.append(("heavy rain conditions", 30))
        if row['congestion_index'] > 0.5:
            factors.append((f"high congestion near {row['station_code']}", 15))
        if row['delay_at_previous_station'] > 10:
            factors.append((f"{row['delay_at_previous_station']} min delay carried over from previous station", 12))
        if row['preceding_train_delay'] > 20:
            factors.append((f"preceding train running {row['preceding_train_delay']} min late", 10))
            
        factors.sort(key=lambda x: x[1], reverse=True)
        
        if not factors:
            return f"Predicted {predicted_delay:.0f}-min delay — baseline route factors."
            
        if len(factors) > 1:
            return f"Predicted {predicted_delay:.0f}-min delay — primary factor: {factors[0][0]}; secondary: {factors[1][0]}."
        else:
            return f"Predicted {predicted_delay:.0f}-min delay — primary factor: {factors[0][0]}."

explainer = DummyExplainer()

api_responses = []

for idx, row in df.iterrows():
    # Compute predicted arrival
    sched_time = pd.to_datetime(row['scheduled_arrival'])
    pred_time = sched_time + pd.Timedelta(minutes=row['predicted_delay_minutes'])
    
    explanation = explainer.explain_delay(row['predicted_delay_minutes'], row)
    
    api_obj = {
      "station_code": row['station_code'],
      "scheduled_arrival": sched_time.strftime("%H:%M"),
      "predicted_arrival": pred_time.strftime("%H:%M"),
      "delay_minutes": int(row['predicted_delay_minutes']),
      "confidence_percent": int(row['confidence_percent']),
      "delay_reason": explanation,
      "platform_prediction": int(row['platform_prediction'])
    }
    
    train_response = {
      "train_number": str(row['train_no']),
      "train_name": "Simulated Express",
      "last_updated": datetime.now().strftime("%Y-%m-%dT%H:%M:%S+05:30"),
      "current_location": { "lat": 28.61, "lon": 77.21, "section": f"APPROACHING-{row['station_code']}" },
      "stations": [api_obj]
    }
    api_responses.append(train_response)

print(json.dumps(api_responses, indent=2))
