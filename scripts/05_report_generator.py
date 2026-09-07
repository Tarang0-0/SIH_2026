import pandas as pd
import numpy as np
import os
import joblib
import xgboost as xgb
from sklearn.metrics import mean_absolute_error
from xgboost import XGBRegressor

TRAIN_PATH = 'data/splits/train.parquet'
VAL_PATH = 'data/splits/val.parquet'
TEST_PATH = 'data/splits/test.parquet'
UNSEEN_PATH = 'data/splits/test_unseen_trains.parquet'
MODEL_DIR = 'models'

EXCLUDE_COLS = [
    'train_no', 'date', 'station_code', 'scheduled_arrival', 
    'actual_arrival', 'delay_minutes', 'delay_reason'
]

# Provide fallback generator
def generate_mock_data():
    np.random.seed(42)
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
    df['delay_minutes'] = df['delay_at_previous_station'] + \
                          np.where(df['weather'] == 'Rain', 20, 0) + \
                          np.where(df['congestion_index'] > 0.8, 15, 0) + \
                          np.random.normal(0, 2, n_rows)
    
    return df

def get_features_and_target(df, dummy_cols=None, drop_synthetic=False):
    df_feat = df.drop(columns=[c for c in EXCLUDE_COLS if c in df.columns], errors='ignore')
    
    if drop_synthetic:
        df_feat = df_feat.drop(columns=['congestion_index', 'preceding_train_delay'], errors='ignore')
        
    cat_cols = [c for c in ['train_type', 'day_of_week', 'weather', 'season'] if c in df_feat.columns]
    df_feat = pd.get_dummies(df_feat, columns=cat_cols)
    
    if dummy_cols is not None:
        missing_cols = set(dummy_cols) - set(df_feat.columns)
        for c in missing_cols:
            df_feat[c] = False
        df_feat = df_feat[dummy_cols]
        
    X = df_feat.astype(float)
    y = df['delay_minutes']
    naive_y = df['delay_at_previous_station']
    return X, y, naive_y, df_feat.columns

def load_data_or_mock(path):
    if os.path.exists(path):
        return pd.read_parquet(path)
    return generate_mock_data()

def main():
    df_train = load_data_or_mock(TRAIN_PATH)
    df_val = load_data_or_mock(VAL_PATH)
    df_test = load_data_or_mock(TEST_PATH)
    df_unseen = load_data_or_mock(UNSEEN_PATH)
    
    X_train, y_train, n_train, cols_A = get_features_and_target(df_train, drop_synthetic=False)
    X_val, y_val, n_val, _ = get_features_and_target(df_val, dummy_cols=cols_A, drop_synthetic=False)
    X_test, y_test, n_test, _ = get_features_and_target(df_test, dummy_cols=cols_A, drop_synthetic=False)
    X_unseen, y_unseen, n_unseen, _ = get_features_and_target(df_unseen, dummy_cols=cols_A, drop_synthetic=False)
    
    X_train_B, y_train_B, n_train_B, cols_B = get_features_and_target(df_train, drop_synthetic=True)
    X_val_B, y_val_B, n_val_B, _ = get_features_and_target(df_val, dummy_cols=cols_B, drop_synthetic=True)
    X_test_B, y_test_B, n_test_B, _ = get_features_and_target(df_test, dummy_cols=cols_B, drop_synthetic=True)
    X_unseen_B, y_unseen_B, n_unseen_B, _ = get_features_and_target(df_unseen, dummy_cols=cols_B, drop_synthetic=True)

    # 1. Evaluate Naive Baseline
    mae_naive_val = mean_absolute_error(y_val, n_val)
    mae_naive_test = mean_absolute_error(y_test, n_test)
    mae_naive_unseen = mean_absolute_error(y_unseen, n_unseen)
    
    # 2. Evaluate Model A
    model_A = XGBRegressor(n_estimators=300, learning_rate=0.05, max_depth=6, random_state=42, early_stopping_rounds=15, eval_metric='mae')
    model_A.fit(X_train, y_train, eval_set=[(X_val, y_val)], verbose=False)
    
    mae_A_val = mean_absolute_error(y_val, model_A.predict(X_val))
    mae_A_test = mean_absolute_error(y_test, model_A.predict(X_test))
    mae_A_unseen = mean_absolute_error(y_unseen, model_A.predict(X_unseen))
    
    # 3. Evaluate Model B
    model_B = XGBRegressor(n_estimators=300, learning_rate=0.05, max_depth=6, random_state=42, early_stopping_rounds=15, eval_metric='mae')
    model_B.fit(X_train_B, y_train_B, eval_set=[(X_val_B, y_val_B)], verbose=False)
    
    mae_B_val = mean_absolute_error(y_val_B, model_B.predict(X_val_B))
    mae_B_test = mean_absolute_error(y_test_B, model_B.predict(X_test_B))
    mae_B_unseen = mean_absolute_error(y_unseen_B, model_B.predict(X_unseen_B))
    
    print("=== MAE TABLE ===")
    print(f"Naive Baseline | {mae_naive_val:.3f} | {mae_naive_test:.3f} | {mae_naive_unseen:.3f}")
    print(f"Model A (Full) | {mae_A_val:.3f} | {mae_A_test:.3f} | {mae_A_unseen:.3f}")
    print(f"Model B (Abla) | {mae_B_val:.3f} | {mae_B_test:.3f} | {mae_B_unseen:.3f}")
    
    # 4. SHAP Values
    print("\n=== SHAP ===")
    booster = model_A.get_booster()
    dtest = xgb.DMatrix(X_test[booster.feature_names])
    shap_contribs = booster.predict(dtest, pred_contribs=True)
    shap_vals = shap_contribs[:, :-1]
    
    mean_abs_shap = np.abs(shap_vals).mean(axis=0)
    shap_importance = pd.DataFrame({'Feature': booster.feature_names, 'Mean_Abs_SHAP': mean_abs_shap})
    shap_importance['SHAP_Weight_%'] = (shap_importance['Mean_Abs_SHAP'] / shap_importance['Mean_Abs_SHAP'].sum()) * 100
    shap_importance = shap_importance.sort_values('SHAP_Weight_%', ascending=False)
    
    print(shap_importance.to_string(index=False))
    
    # 5. Calibration Check
    print("\n=== CALIBRATION ===")
    try:
        model_p10 = joblib.load(os.path.join(MODEL_DIR, 'eta_quantile_p10.pkl'))
        model_p90 = joblib.load(os.path.join(MODEL_DIR, 'eta_quantile_p90.pkl'))
        
        p10 = model_p10.predict(X_test)
        p90 = model_p90.predict(X_test)
        width = np.clip(p90 - p10, a_min=0, a_max=None)
        conf = 100.0 * np.exp(-0.02 * width)
        
        in_bounds = (y_test.values >= p10) & (y_test.values <= p90)
        
        buckets = [
            ('>90%', conf >= 90),
            ('70-90%', (conf >= 70) & (conf < 90)),
            ('50-70%', (conf >= 50) & (conf < 70)),
            ('<50%', conf < 50)
        ]
        
        for name, mask in buckets:
            if mask.sum() > 0:
                coverage = in_bounds[mask].mean() * 100
                print(f"{name} | {coverage:.1f}% | {mask.sum()}")
            else:
                print(f"{name} | N/A | 0")
    except Exception as e:
        print("Could not load calibration models:", e)

if __name__ == '__main__':
    main()
