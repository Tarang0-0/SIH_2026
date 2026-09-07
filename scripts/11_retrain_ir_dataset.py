import pandas as pd
import numpy as np
import xgboost as xgb
import joblib
import os
import time
from sklearn.model_selection import train_test_split

print("=" * 60)
print("🚂 RailPulse Model Retraining on IR Dataset")
print("=" * 60)

DATA_PATH = "data/ir_train.csv"
MODELS_DIR = "models"
os.makedirs(MODELS_DIR, exist_ok=True)

# 1. Load Data
print("\n[1/4] Loading dataset...")
df = pd.read_csv(DATA_PATH)
print(f"Loaded {len(df):,} records.")

# 2. Feature Engineering
print("\n[2/4] Preparing features...")
target = 'delay_minutes'
drop_cols = ['journey_id', 'train_number', 'departure_date', 'primary_delay_cause', 'is_delayed', 'zone']

# Drop non-feature columns
df = df.drop(columns=[c for c in drop_cols if c in df.columns])

# One-hot encode categoricals
cat_cols = ['train_type', 'season', 'zone_abbr', 'source_station_category', 'destination_station_category', 'traction_type']
df = pd.get_dummies(df, columns=[c for c in cat_cols if c in df.columns], drop_first=True)

X = df.drop(columns=[target])
y = df[target]

# Split data
X_train, X_val, y_train, y_val = train_test_split(X, y, test_size=0.1, random_state=42)
print(f"Train samples: {len(X_train):,}")
print(f"Val samples:   {len(X_val):,}")

# 3. Train Models
print("\n[3/4] Training Multi-Quantile XGBoost Models...")

# Main P50 Median Regressor
t0 = time.time()
print("  -> Training P50 Expected Delay Model (XGBRegressor)...")
p50_model = xgb.XGBRegressor(
    n_estimators=100,
    max_depth=5,
    learning_rate=0.1,
    subsample=0.85,
    colsample_bytree=0.85,
    random_state=42,
    n_jobs=-1
)
p50_model.fit(X_train, y_train, eval_set=[(X_val, y_val)], verbose=False)
joblib.dump(p50_model, os.path.join(MODELS_DIR, "eta_regressor.pkl"))
print(f"     ✅ Saved models/eta_regressor.pkl ({time.time() - t0:.1f}s)")

# P10 Quantile Regressor
t0 = time.time()
print("  -> Training P10 Optimistic Quantile Model (alpha=0.10)...")
p10_model = xgb.XGBRegressor(
    objective='reg:quantileerror',
    quantile_alpha=0.10,
    n_estimators=50,
    max_depth=5,
    learning_rate=0.1,
    random_state=42,
    n_jobs=-1
)
p10_model.fit(X_train, y_train, eval_set=[(X_val, y_val)], verbose=False)
joblib.dump(p10_model, os.path.join(MODELS_DIR, "eta_quantile_p10.pkl"))
print(f"     ✅ Saved models/eta_quantile_p10.pkl ({time.time() - t0:.1f}s)")

# P90 Quantile Regressor
t0 = time.time()
print("  -> Training P90 Conservative Quantile Model (alpha=0.90)...")
p90_model = xgb.XGBRegressor(
    objective='reg:quantileerror',
    quantile_alpha=0.90,
    n_estimators=50,
    max_depth=5,
    learning_rate=0.1,
    random_state=42,
    n_jobs=-1
)
p90_model.fit(X_train, y_train, eval_set=[(X_val, y_val)], verbose=False)
joblib.dump(p90_model, os.path.join(MODELS_DIR, "eta_quantile_p90.pkl"))
print(f"     ✅ Saved models/eta_quantile_p90.pkl ({time.time() - t0:.1f}s)")

print("\n[4/4] Evaluating models...")
p50_preds = p50_model.predict(X_val)
mae = np.mean(np.abs(y_val - p50_preds))
print(f"  • Validation MAE: {mae:.2f} minutes")

print("\n" + "=" * 60)
print("🎯 ALL MODELS RETRAINED SUCCESSFULLY ON NEW DATASET!")
print("=" * 60)
