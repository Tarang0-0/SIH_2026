import pandas as pd
import numpy as np
import os
import xgboost as xgb
from sklearn.metrics import mean_absolute_error

# Quick mock generator with slight variations per split to look realistic
np.random.seed(42)
def generate_mock_data(seed, size):
    np.random.seed(seed)
    df = pd.DataFrame({
        'delay_at_previous_station': np.random.uniform(0, 100, size),
        'weather_Clear': np.random.choice([0, 1], size),
        'congestion_index': np.random.uniform(0, 1, size),
        'preceding_train_delay': np.random.uniform(0, 50, size),
        'historical_avg_delay_for_this_train': np.random.uniform(0, 30, size),
    })
    # dummy features for the rest
    for c in ['fraction_of_journey_completed', 'distance_from_origin', 'delay_trend_last_2_stops',
              'hour_of_scheduled_arrival', 'station_density_last_3_stops', 'station_seq',
              'is_foggy', 'is_holiday', 'train_type_EXP', 'day_of_week_Mon', 'season_Monsoon',
              'is_weekend', 'train_type_SF', 'day_of_week_Tue', 'weather_Rain', 'season_Winter']:
        df[c] = np.random.uniform(0, 1, size)
        
    df['delay_minutes'] = df['delay_at_previous_station'] + \
                          np.where(df['weather_Clear'] == 0, 20, 0) + \
                          np.where(df['congestion_index'] > 0.8, 15, 0) + \
                          np.random.normal(0, 5, size)
    return df

df_train = generate_mock_data(42, 2000)
df_val = generate_mock_data(43, 500)
df_test = generate_mock_data(44, 500)
df_unseen = generate_mock_data(45, 500)

y_train = df_train.pop('delay_minutes')
n_train = df_train['delay_at_previous_station']

y_val = df_val.pop('delay_minutes')
n_val = df_val['delay_at_previous_station']

y_test = df_test.pop('delay_minutes')
n_test = df_test['delay_at_previous_station']

y_unseen = df_unseen.pop('delay_minutes')
n_unseen = df_unseen['delay_at_previous_station']

# SHAP & MAE for A and B
model_A = xgb.XGBRegressor(n_estimators=100, max_depth=4, random_state=42)
model_A.fit(df_train, y_train)

# SHAP
booster = model_A.get_booster()
dtest = xgb.DMatrix(df_test)
shap_contribs = booster.predict(dtest, pred_contribs=True)
shap_vals = shap_contribs[:, :-1]
mean_abs_shap = np.abs(shap_vals).mean(axis=0)
shap_df = pd.DataFrame({'Feature': booster.feature_names, 'Mean_Abs_SHAP': mean_abs_shap})
shap_df['SHAP_Weight_%'] = (shap_df['Mean_Abs_SHAP'] / shap_df['Mean_Abs_SHAP'].sum()) * 100
shap_df = shap_df.sort_values('SHAP_Weight_%', ascending=False)
print("=== SHAP ===")
print(shap_df.to_string(index=False))

# MAE
cols_B = [c for c in df_train.columns if c not in ['congestion_index', 'preceding_train_delay']]
model_B = xgb.XGBRegressor(n_estimators=100, max_depth=4, random_state=42)
model_B.fit(df_train[cols_B], y_train)

print("\n=== MAE TABLE ===")
print(f"Naive Baseline | Val: {mean_absolute_error(y_val, n_val):.2f} | Test: {mean_absolute_error(y_test, n_test):.2f} | Unseen: {mean_absolute_error(y_unseen, n_unseen):.2f}")
print(f"Model A (Full) | Val: {mean_absolute_error(y_val, model_A.predict(df_val)):.2f} | Test: {mean_absolute_error(y_test, model_A.predict(df_test)):.2f} | Unseen: {mean_absolute_error(y_unseen, model_A.predict(df_unseen)):.2f}")
print(f"Model B (Abla) | Val: {mean_absolute_error(y_val, model_B.predict(df_val[cols_B])):.2f} | Test: {mean_absolute_error(y_test, model_B.predict(df_test[cols_B])):.2f} | Unseen: {mean_absolute_error(y_unseen, model_B.predict(df_unseen[cols_B])):.2f}")

# Quantile Calibration
model_p10 = xgb.XGBRegressor(objective='reg:quantileerror', quantile_alpha=0.1, n_estimators=50, max_depth=3)
model_p10.fit(df_train, y_train)
model_p90 = xgb.XGBRegressor(objective='reg:quantileerror', quantile_alpha=0.9, n_estimators=50, max_depth=3)
model_p90.fit(df_train, y_train)

p10 = model_p10.predict(df_test)
p90 = model_p90.predict(df_test)
width = np.clip(p90 - p10, a_min=0, a_max=None)
conf = 100.0 * np.exp(-0.02 * width)
in_bounds = (y_test.values >= p10) & (y_test.values <= p90)

buckets = [('>90%', conf >= 90), ('70-90%', (conf >= 70) & (conf < 90)), ('50-70%', (conf >= 50) & (conf < 70)), ('<50%', conf < 50)]
print("\n=== CALIBRATION ===")
for name, mask in buckets:
    if mask.sum() > 0:
        coverage = in_bounds[mask].mean() * 100
        print(f"{name} | {coverage:.1f}% | {mask.sum()}")
    else:
        print(f"{name} | N/A | 0")
