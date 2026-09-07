import pandas as pd
import numpy as np
import os

VAL_PATH = 'data/splits/val.parquet'
TEST_PATH = 'data/splits/test.parquet'
UNSEEN_PATH = 'data/splits/test_unseen_trains.parquet'

def generate_mock_data():
    """Generates mock data for testing in environments without the parquet files."""
    print("WARNING: Generating mock data because parquet files are missing locally...")
    np.random.seed(42)
    n_rows = 500
    y_true = np.random.gamma(shape=2.0, scale=15.0, size=n_rows)
    # The naive model carries over the previous delay. 
    # Let's mock previous delay as the true delay minus some random drift
    drift = np.random.normal(loc=0, scale=5.0, size=n_rows)
    y_pred = np.clip(y_true - drift, a_min=0, a_max=None)
    
    df = pd.DataFrame({
        'delay_minutes': y_true,
        'delay_at_previous_station': y_pred
    })
    return df

def calculate_metrics(y_true, y_pred):
    mae = np.mean(np.abs(y_true - y_pred))
    rmse = np.sqrt(np.mean((y_true - y_pred)**2))
    return mae, rmse

def evaluate_baseline(filepath, split_name):
    if os.path.exists(filepath):
        df = pd.read_parquet(filepath)
    else:
        df = generate_mock_data()
        
    if 'delay_minutes' not in df.columns or 'delay_at_previous_station' not in df.columns:
        print(f"Error: Required columns missing in {filepath}")
        return
        
    y_true = df['delay_minutes']
    
    # Naive Carry-Forward baseline
    # Predict the delay at this station will be exactly what it was at the previous station
    y_pred = df['delay_at_previous_station']
    
    mae, rmse = calculate_metrics(y_true, y_pred)
    
    print(f"\n--- BASELINE (naive carry-forward) on {split_name.upper()} SET ---")
    if os.path.exists(filepath):
        print(f"Source: {filepath}")
    print(f"Rows evaluated: {len(df):,}")
    print(f"MAE:  {mae:.2f} minutes")
    print(f"RMSE: {rmse:.2f} minutes")

def main():
    print("Evaluating Baseline Models...")
    evaluate_baseline(VAL_PATH, "Validation")
    evaluate_baseline(TEST_PATH, "Test")
    
    # Also evaluate the unseen trains holdout set for full comparison
    if os.path.exists(UNSEEN_PATH) or not os.path.exists(TEST_PATH):
        evaluate_baseline(UNSEEN_PATH, "Unseen Trains (Test)")

if __name__ == '__main__':
    main()
