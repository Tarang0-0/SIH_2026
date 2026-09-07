import pandas as pd
import numpy as np
import os
import joblib
import warnings
from sklearn.metrics import mean_absolute_error, mean_squared_error
from xgboost import XGBRegressor

# Suppress warnings
warnings.simplefilter(action='ignore', category=FutureWarning)

TRAIN_PATH = 'data/splits/train.parquet'
VAL_PATH = 'data/splits/val.parquet'
TEST_PATH = 'data/splits/test.parquet'
UNSEEN_PATH = 'data/splits/test_unseen_trains.parquet'
MODEL_DIR = 'models'
MODEL_PATH = os.path.join(MODEL_DIR, 'eta_regressor.pkl')

# Explicitly exclude leakage columns and targets/IDs
EXCLUDE_COLS = [
    'train_no', 'date', 'station_code', 'scheduled_arrival', 
    'actual_arrival', 'delay_minutes', 'delay_reason'
]

def generate_mock_data():
    """Generates mock data strictly for testing without real parquet files."""
    n_rows = 1000
    df = pd.DataFrame({
        'train_no': np.random.choice(['1001', '1002'], n_rows),
        'date': pd.date_range('2024-01-01', periods=n_rows),
        'station_code': 'STN',
        'scheduled_arrival': '12:00',
        'actual_arrival': '12:10',
        'delay_reason': 'None',
        
        'train_type': np.random.choice(['SF', 'EXP'], n_rows),
        'day_of_week': np.random.choice(['Mon', 'Tue'], n_rows),
        'weather': np.random.choice(['Clear', 'Rain'], n_rows),
        'season': np.random.choice(['Winter', 'Monsoon'], n_rows),
        'is_foggy': np.random.choice([True, False], n_rows),
        'is_weekend': np.random.choice([True, False], n_rows),
        'is_holiday': np.random.choice([True, False], n_rows),
        
        'distance_from_origin': np.random.uniform(0, 500, n_rows),
        'fraction_of_journey_completed': np.random.uniform(0, 1, n_rows),
        'station_density_last_3_stops': np.random.uniform(0, 10, n_rows),
        'delay_trend_last_2_stops': np.random.uniform(-10, 10, n_rows),
        'historical_avg_delay_for_this_train': np.random.uniform(0, 30, n_rows),
        'congestion_index': np.random.uniform(0, 1, n_rows),
        'preceding_train_delay': np.random.uniform(0, 50, n_rows),
        'station_seq': np.random.randint(1, 20, n_rows),
        'hour_of_scheduled_arrival': np.random.randint(0, 24, n_rows),
    })
    
    df['delay_at_previous_station'] = np.random.uniform(0, 100, n_rows)
    # Inject real signal for the ML model to learn: Rain + Congestion = Delay
    df['delay_minutes'] = df['delay_at_previous_station'] + \
                          np.where(df['weather'] == 'Rain', 20, 0) + \
                          np.where(df['congestion_index'] > 0.8, 15, 0) + \
                          np.random.normal(0, 2, n_rows)
    
    return df

def get_features_and_target(df, dummy_cols=None):
    # Drop leakage columns
    df_feat = df.drop(columns=[c for c in EXCLUDE_COLS if c in df.columns], errors='ignore')
    
    # One-hot encode categoricals securely
    cat_cols = [c for c in ['train_type', 'day_of_week', 'weather', 'season'] if c in df_feat.columns]
    df_feat = pd.get_dummies(df_feat, columns=cat_cols)
    
    # Ensure exact column alignment across train, val, and test splits
    if dummy_cols is not None:
        missing_cols = set(dummy_cols) - set(df_feat.columns)
        for c in missing_cols:
            df_feat[c] = False
        df_feat = df_feat[dummy_cols]
        
    X = df_feat.astype(float)
    y = df['delay_minutes']
    naive_y = df['delay_at_previous_station']
    return X, y, naive_y, df_feat.columns

def evaluate_predictions(y_true, y_pred, y_naive, split_name):
    mae_model = mean_absolute_error(y_true, y_pred)
    rmse_model = np.sqrt(mean_squared_error(y_true, y_pred))
    
    mae_naive = mean_absolute_error(y_true, y_naive)
    rmse_naive = np.sqrt(mean_squared_error(y_true, y_naive))
    
    print(f"\n--- RESULTS ON {split_name.upper()} SET ---")
    print(f"Metrics     | Baseline (Naive) | ML Model (XGBoost) | Improvement")
    print(f"------------|------------------|--------------------|------------")
    print(f"MAE  (mins) | {mae_naive:16.2f} | {mae_model:18.2f} | {mae_naive - mae_model:10.2f}")
    print(f"RMSE (mins) | {rmse_naive:16.2f} | {rmse_model:18.2f} | {rmse_naive - rmse_model:10.2f}")
    
    if mae_model >= mae_naive * 0.95:
        print("\n⚠️ WARNING: The ML model did not clearly beat the naive baseline!")
        print("Possible Reasons:")
        print(" 1. The synthetic delay generation was too purely random without enough signal tied to the features (like weather/congestion).")
        print(" 2. 'delay_at_previous_station' already captures ~95% of the variance (the compounding effect dominates).")
        print(" 3. Data Leakage: Check if the model is trivially carrying forward the current station's answer.")
    else:
        print("\n✅ The ML model successfully learned patterns beyond just carrying over the previous delay!")

def load_data_or_mock(path):
    if os.path.exists(path):
        return pd.read_parquet(path)
    print(f"WARNING: {path} not found. Using mock data.")
    return generate_mock_data()

def main():
    print("Loading datasets...")
    df_train = load_data_or_mock(TRAIN_PATH)
    df_val = load_data_or_mock(VAL_PATH)
    df_test = load_data_or_mock(TEST_PATH)
    df_unseen = load_data_or_mock(UNSEEN_PATH)
    
    print("Extracting features and removing leakage...")
    X_train, y_train, naive_train, train_cols = get_features_and_target(df_train)
    X_val, y_val, naive_val, _ = get_features_and_target(df_val, dummy_cols=train_cols)
    X_test, y_test, naive_test, _ = get_features_and_target(df_test, dummy_cols=train_cols)
    X_unseen, y_unseen, naive_unseen, _ = get_features_and_target(df_unseen, dummy_cols=train_cols)
    
    print(f"Training XGBoost on {len(X_train)} rows and {len(train_cols)} features...")
    
    model = XGBRegressor(
        n_estimators=500,
        learning_rate=0.05,
        max_depth=6,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=42,
        early_stopping_rounds=20,
        eval_metric='mae'
    )
    
    model.fit(
        X_train, y_train,
        eval_set=[(X_val, y_val)],
        verbose=False
    )
    
    print(f"Training stopped at iteration {model.best_iteration} (Early Stopping)")
    
    # Save model
    os.makedirs(MODEL_DIR, exist_ok=True)
    joblib.dump(model, MODEL_PATH)
    print(f"Model saved securely to {MODEL_PATH}")
    
    # Print Feature Importances
    importances = model.feature_importances_
    feat_imp = pd.DataFrame({'Feature': train_cols, 'Importance': importances})
    feat_imp = feat_imp.sort_values('Importance', ascending=False).head(15)
    
    print("\n--- TOP 15 FEATURE IMPORTANCES ---")
    print(feat_imp.to_string(index=False))
    
    # Evaluate Test Set
    pred_test = model.predict(X_test)
    evaluate_predictions(y_test, pred_test, naive_test, "Test (Month 6)")
    
    # Evaluate Unseen Trains Set
    pred_unseen = model.predict(X_unseen)
    evaluate_predictions(y_unseen, pred_unseen, naive_unseen, "Unseen Trains Holdout")
    
if __name__ == '__main__':
    main()
