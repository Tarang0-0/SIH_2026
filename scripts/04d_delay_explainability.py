import pandas as pd
import numpy as np
import os
import sys
import joblib

# Add project root to path so we can import src
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from src.explainability import DelayExplainer

MODEL_PATH = 'models/eta_regressor.pkl'
TEST_PATH = 'data/splits/test.parquet'

EXCLUDE_COLS = [
    'train_no', 'date', 'station_code', 'scheduled_arrival', 
    'actual_arrival', 'delay_minutes', 'delay_reason'
]

def generate_mock_data(feature_names):
    """Generates mock data strictly for testing without real parquet files."""
    n_rows = 10
    
    # We must match the feature_names exactly for the model to predict
    # We'll just create a dataframe filled with zeros, then inject some signals
    df_feat = pd.DataFrame(np.zeros((n_rows, len(feature_names))), columns=feature_names)
    
    # Inject some signals so SHAP finds something
    if 'weather_Rain' in df_feat.columns:
        df_feat['weather_Rain'] = np.random.choice([0, 1], n_rows)
    if 'delay_at_previous_station' in df_feat.columns:
        df_feat['delay_at_previous_station'] = np.random.uniform(5, 50, n_rows)
    if 'congestion_index' in df_feat.columns:
        df_feat['congestion_index'] = np.random.uniform(0.5, 1.0, n_rows)
    
    true_labels = np.random.choice(['Weather Disruption', 'Congestion', 'Minor Delay'], n_rows)
    return df_feat, true_labels

def main():
    if not os.path.exists(MODEL_PATH):
        print(f"Error: {MODEL_PATH} not found. Please run Step 4b to train the model first.")
        return
        
    try:
        import shap
    except ImportError:
        print("Error: SHAP library not installed. Please pip install shap.")
        return
        
    print(f"Loading trained ETA model from {MODEL_PATH}...")
    model = joblib.load(MODEL_PATH)
    
    print("Initializing SHAP Explainer (this may take a few seconds)...")
    explainer = DelayExplainer(model)
    
    # Extract the expected feature names from the model
    # XGBoost models usually store feature names
    expected_features = model.feature_names_in_
    
    if os.path.exists(TEST_PATH):
        print(f"Loading test data from {TEST_PATH}...")
        df = pd.read_parquet(TEST_PATH)
        true_labels = df['delay_reason'].values
        
        # Prepare features exactly as during training
        df_feat = df.drop(columns=[c for c in EXCLUDE_COLS if c in df.columns], errors='ignore')
        cat_cols = [c for c in ['train_type', 'day_of_week', 'weather', 'season'] if c in df_feat.columns]
        df_feat = pd.get_dummies(df_feat, columns=cat_cols)
        
        # Align columns to match the trained model
        missing = set(expected_features) - set(df_feat.columns)
        for c in missing:
            df_feat[c] = False
        df_feat = df_feat[list(expected_features)].astype(float)
        
    else:
        print(f"WARNING: {TEST_PATH} not found. Using mock data for demonstration.")
        df_feat, true_labels = generate_mock_data(expected_features)
        
    # Select 10 random rows
    np.random.seed(42)
    sample_indices = np.random.choice(len(df_feat), 10, replace=False)
    
    X_sample = df_feat.iloc[sample_indices]
    y_labels_sample = true_labels[sample_indices]
    
    print("Computing SHAP values for the sample...")
    shap_values_matrix = explainer.get_shap_values(X_sample)
    predictions = model.predict(X_sample)
    
    print("\n=======================================================")
    print("      NATURAL LANGUAGE EXPLAINABILITY DEMONSTRATION    ")
    print("=======================================================\n")
    
    for i in range(10):
        pred_delay = predictions[i]
        true_reason = y_labels_sample[i]
        
        # Extract data for this specific row
        row_feat_vals = X_sample.iloc[i].values
        row_shap_vals = shap_values_matrix[i]
        
        # Generate the natural language sentence
        explanation_sentence = explainer.explain_delay(
            predicted_delay=pred_delay,
            feature_names=list(expected_features),
            feature_values=row_feat_vals,
            shap_values=row_shap_vals
        )
        
        print(f"Sample {i+1}:")
        print(f"  System Output: {explanation_sentence}")
        print(f"  True Label:    [{true_reason}]")
        print("-" * 55)

if __name__ == '__main__':
    main()
