import pandas as pd
import numpy as np
import os
import joblib
import warnings
import matplotlib.pyplot as plt
from lightgbm import LGBMRegressor

# Suppress warnings
warnings.simplefilter(action='ignore', category=FutureWarning)

TRAIN_PATH = 'data/splits/train.parquet'
VAL_PATH = 'data/splits/val.parquet'
TEST_PATH = 'data/splits/test.parquet'
MODEL_DIR = 'models'
REPORTS_DIR = 'reports'

EXCLUDE_COLS = [
    'train_no', 'date', 'station_code', 'scheduled_arrival', 
    'actual_arrival', 'delay_minutes', 'delay_reason'
]

def prepare_data(filepath, dummy_cols=None):
    if not os.path.exists(filepath):
        raise FileNotFoundError(f"{filepath} not found. Please run Step 3 (03_split_data.py) first to generate splits.")
        
    df = pd.read_parquet(filepath)
    df_feat = df.drop(columns=[c for c in EXCLUDE_COLS if c in df.columns], errors='ignore')
    
    cat_cols = [c for c in ['train_type', 'day_of_week', 'weather', 'season'] if c in df_feat.columns]
    df_feat = pd.get_dummies(df_feat, columns=cat_cols)
    
    if dummy_cols is not None:
        missing = set(dummy_cols) - set(df_feat.columns)
        for c in missing:
            df_feat[c] = False
        df_feat = df_feat[dummy_cols]
        
    X = df_feat.astype(float)
    y = df['delay_minutes'].values
    return X, y, df_feat.columns

def compute_confidence_score(p10, p90):
    """
    Formula: Confidence Score (%) = 100 * exp(-0.02 * (P90 - P10))
    
    Logic: 
    - The interval is P90 - P10 (representing the 80% prediction interval).
    - A narrower interval means the model is highly certain of the bounds (low variance).
    - Using an exponential decay maps the interval width to a smooth 0-100% score:
        Width = 0 mins   -> 100.0% confidence
        Width = 10 mins  -> ~81.9% confidence
        Width = 30 mins  -> ~54.9% confidence
        Width = 60 mins  -> ~30.1% confidence
        Width = 120 mins ->  ~9.1% confidence
    """
    width = np.clip(p90 - p10, a_min=0, a_max=None)
    return 100.0 * np.exp(-0.02 * width)

def main():
    os.makedirs(MODEL_DIR, exist_ok=True)
    os.makedirs(REPORTS_DIR, exist_ok=True)
    
    print("Loading data...")
    X_train, y_train, train_cols = prepare_data(TRAIN_PATH)
    X_val, y_val, _ = prepare_data(VAL_PATH, dummy_cols=train_cols)
    X_test, y_test, _ = prepare_data(TEST_PATH, dummy_cols=train_cols)
    
    models = {}
    alphas = [0.1, 0.5, 0.9]
    
    print(f"Training LightGBM Quantile Regressors for percentiles: [10th, 50th, 90th]...")
    for alpha in alphas:
        target_name = f"P{int(alpha*100)}"
        print(f"\n  -> Training {target_name} model...")
        
        model = LGBMRegressor(
            objective='quantile',
            alpha=alpha,
            n_estimators=300,
            learning_rate=0.05,
            max_depth=6,
            random_state=42,
            n_jobs=-1
        )
        
        # Fit with validation set
        model.fit(
            X_train, y_train,
            eval_set=[(X_val, y_val)],
            eval_metric='quantile'
        )
        
        models[target_name.lower()] = model
        
        save_path = os.path.join(MODEL_DIR, f'eta_quantile_{target_name.lower()}.pkl')
        joblib.dump(model, save_path)
        print(f"     Saved {target_name} model to {save_path}")
        
    print("\n=======================================================")
    print("Predicting on Test Set and Calculating Confidence...")
    p10 = models['p10'].predict(X_test)
    p50 = models['p50'].predict(X_test)
    p90 = models['p90'].predict(X_test)
    
    # Calculate confidence score
    confidence_scores = compute_confidence_score(p10, p90)
    
    print("\n--- CONFIDENCE SCORE FORMULA ---")
    print(compute_confidence_score.__doc__.strip())
    
    # Calibration Check
    print("\n--- CALIBRATION CHECK ---")
    print("Theory: Because we model P10 and P90, statistically 80% of all real delays should")
    print("fall inside this band. A perfectly calibrated model will maintain ~80% coverage ")
    print("whether the interval is narrow (high confidence) or wide (low confidence).")
    
    # Check if actual delay is inside the predicted 80% interval
    in_bounds = (y_test >= p10) & (y_test <= p90)
    overall_coverage = in_bounds.mean() * 100
    print(f"\nOverall Test Set Coverage (Target: 80%): {overall_coverage:.1f}%")
    
    # Bin by confidence score to plot calibration
    bins = np.linspace(0, 100, 11) # 10 decile bins from 0 to 100
    bin_indices = np.digitize(confidence_scores, bins) - 1
    bin_indices = np.clip(bin_indices, 0, 9) # Ensure 0-9
    
    bin_centers = []
    coverages = []
    
    for i in range(10):
        mask = (bin_indices == i)
        if mask.sum() > 0:
            bin_center = (bins[i] + bins[i+1]) / 2.0
            coverage = in_bounds[mask].mean() * 100.0
            
            bin_centers.append(bin_center)
            coverages.append(coverage)
            
            print(f"Confidence {bins[i]:3.0f}-{bins[i+1]:3.0f}% Bin: Coverage = {coverage:4.1f}% (N = {mask.sum()})")
            
    # Plotting
    plt.figure(figsize=(9, 6))
    
    # Calibration curve
    plt.plot(bin_centers, coverages, marker='o', linestyle='-', linewidth=2, color='#1f77b4', markersize=8, label='Empirical Coverage')
    
    # Target line (80%)
    plt.axhline(y=80, color='#d62728', linestyle='--', linewidth=2, label='Target Coverage (80% theoretical)')
    
    # Aesthetics
    plt.ylim(0, 100)
    plt.xlim(0, 100)
    plt.xlabel('Predicted Confidence Score (%)', fontsize=12)
    plt.ylabel('Actual Outcomes falling within P10-P90 Band (%)', fontsize=12)
    plt.title('Model Calibration: Does the 80% Interval actually trap 80% of outcomes?', fontsize=14, pad=15)
    plt.legend(loc='lower left', fontsize=11)
    plt.grid(True, alpha=0.3)
    
    # Annotate explanation
    plt.text(50, 10, "A flat blue line near the red line indicates excellent statistical calibration.", 
             ha='center', va='center', fontsize=10, style='italic',
             bbox=dict(facecolor='white', alpha=0.8, edgecolor='none'))
    
    plot_path = os.path.join(REPORTS_DIR, 'calibration_plot.png')
    plt.savefig(plot_path, dpi=300, bbox_inches='tight')
    plt.close()
    
    print(f"\n✅ Saved highly presentable calibration plot to {plot_path}")
    print("=======================================================")

if __name__ == '__main__':
    main()
