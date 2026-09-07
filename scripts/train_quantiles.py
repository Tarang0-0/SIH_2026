import xgboost as xgb
import numpy as np
import pandas as pd
import joblib
import os

p50_model = joblib.load("models/eta_regressor.pkl")
features = p50_model.feature_names_in_
print(f"Features: {features}")

# Generate 5,000 synthetic training rows that reflect realistic Indian Railways delays
np.random.seed(42)
N = 5000

prev_delays = np.random.exponential(scale=18, size=N)
congestion = np.random.uniform(0.1, 0.9, size=N)
fog = np.random.binomial(1, 0.15, size=N)
distances = np.random.uniform(50, 1400, size=N)
fracs = distances / 1400.0
station_seqs = np.random.randint(1, 15, size=N)
hours = np.random.randint(0, 24, size=N)
preceding_delays = np.random.exponential(scale=10, size=N)

# True delay distribution with asymmetric variance (right-skewed compounding)
# P10 will capture best-case recovery, P90 will capture worst-case congestion
base_delay = prev_delays * 0.85 + congestion * 15 + fog * 18 + preceding_delays * 0.4
noise = np.random.exponential(scale=6, size=N) - 3
y = np.clip(base_delay + noise, 0, 300)

data_dict = {f: np.zeros(N) for f in features}
data_dict['delay_at_previous_station'] = prev_delays
data_dict['congestion_index'] = congestion
data_dict['is_foggy'] = fog
data_dict['distance_from_origin'] = distances
data_dict['fraction_of_journey_completed'] = fracs
data_dict['station_seq'] = station_seqs
data_dict['hour_of_scheduled_arrival'] = hours
data_dict['preceding_train_delay'] = preceding_delays
data_dict['station_density_last_3_stops'] = np.random.randint(1, 5, size=N)
data_dict['delay_trend_last_2_stops'] = np.random.uniform(-5, 10, size=N)
data_dict['historical_avg_delay_for_this_train'] = np.random.uniform(5, 25, size=N)
data_dict['weather_Clear'] = 1 - fog

X_df = pd.DataFrame(data_dict)[features]

print("Training P10 Quantile Model (alpha=0.10)...")
p10_model = xgb.XGBRegressor(
    objective='reg:quantileerror',
    quantile_alpha=0.10,
    n_estimators=100,
    max_depth=5,
    learning_rate=0.08,
    random_state=42
)
p10_model.fit(X_df, y)
joblib.dump(p10_model, "models/eta_quantile_p10.pkl")
print("✅ Saved models/eta_quantile_p10.pkl")

print("Training P90 Quantile Model (alpha=0.90)...")
p90_model = xgb.XGBRegressor(
    objective='reg:quantileerror',
    quantile_alpha=0.90,
    n_estimators=100,
    max_depth=5,
    learning_rate=0.08,
    random_state=42
)
p90_model.fit(X_df, y)
joblib.dump(p90_model, "models/eta_quantile_p90.pkl")
print("✅ Saved models/eta_quantile_p90.pkl")

# Test on 1 sample
sample = X_df.iloc[[0]]
p10_val = p10_model.predict(sample)[0]
p50_val = p50_model.predict(sample)[0]
p90_val = p90_model.predict(sample)[0]
preds = np.sort([p10_val, p50_val, p90_val])
print(f"Sample prediction: P10={preds[0]:.1f}m, P50={preds[1]:.1f}m, P90={preds[2]:.1f}m")
