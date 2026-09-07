import pandas as pd
import numpy as np
import os
import warnings

# Suppress pandas FutureWarnings for clean output
warnings.simplefilter(action='ignore', category=FutureWarning)

INPUT_PARQUET = 'data/train_eta_features.parquet'
OUTPUT_DIR = 'data/splits'

def generate_mock_data():
    """Generates mock data in case the script is run without the output of step 2."""
    print("WARNING: Input parquet not found. Generating mock data for testing...")
    dates = pd.date_range('2024-01-01', '2024-06-30')
    rows = []
    # Create 30 trains, 182 days each
    trains = [f'100{i:02d}' for i in range(30)]
    for d in dates:
        for t in trains:
            rows.append({
                'train_no': t,
                'date': d,
                'delay_minutes': np.random.randint(0, 50),
            })
    return pd.DataFrame(rows)

def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    if os.path.exists(INPUT_PARQUET):
        print(f"Loading data from {INPUT_PARQUET}...")
        df = pd.read_parquet(INPUT_PARQUET)
    else:
        df = generate_mock_data()
        
    # Ensure date is a proper datetime object
    df['date'] = pd.to_datetime(df['date'])
    
    # 1. Hold out 15 completely unseen trains
    unique_trains = df['train_no'].unique()
    np.random.seed(42)  # For reproducibility
    
    # Select 15 trains to completely withhold
    if len(unique_trains) >= 15:
        holdout_trains = np.random.choice(unique_trains, 15, replace=False)
    else:
        # Fallback if the mock dataset is too small
        holdout_trains = unique_trains[:max(1, len(unique_trains)//2)]
        
    df_unseen = df[df['train_no'].isin(holdout_trains)].copy()
    
    # 2. Extract remaining trains for standard splits
    df_main = df[~df['train_no'].isin(holdout_trains)].copy()
    
    # 3. Time-based splits
    # Extract month to securely define the cuts
    df_main['month'] = df_main['date'].dt.month
    
    df_train = df_main[df_main['month'].isin([1, 2, 3, 4])].copy()
    df_val = df_main[df_main['month'] == 5].copy()
    df_test = df_main[df_main['month'] == 6].copy()
    
    # Drop the temporary month column if it wasn't in the original dataset
    for d in [df_train, df_val, df_test]:
        if 'month' in d.columns:
            d.drop(columns=['month'], inplace=True, errors='ignore')
            
    # 4. Save to files
    unseen_path = os.path.join(OUTPUT_DIR, 'test_unseen_trains.parquet')
    train_path = os.path.join(OUTPUT_DIR, 'train.parquet')
    val_path = os.path.join(OUTPUT_DIR, 'val.parquet')
    test_path = os.path.join(OUTPUT_DIR, 'test.parquet')
    
    try:
        df_unseen.to_parquet(unseen_path, index=False)
        df_train.to_parquet(train_path, index=False)
        df_val.to_parquet(val_path, index=False)
        df_test.to_parquet(test_path, index=False)
        print(f"Successfully saved all splits to {OUTPUT_DIR}/")
    except ImportError:
        print("\nNote: pyarrow/fastparquet not found locally. Skipping actual parquet save during mock run.")
        
    # 5. Print Row Counts
    print("\n--- SPLIT ROW COUNTS ---")
    print(f"Train set (Months 1-4):      {len(df_train):,}")
    print(f"Validation set (Month 5):    {len(df_val):,}")
    print(f"Test set (Month 6):          {len(df_test):,}")
    print(f"Unseen Trains (Full 6 mo):   {len(df_unseen):,}")
    
    # 6. Confirm Date & Train Overlap Rules
    print("\n--- VALIDATION & OVERLAP CHECKS ---")
    train_dates = set(df_train['date'].dt.date)
    val_dates = set(df_val['date'].dt.date)
    test_dates = set(df_test['date'].dt.date)
    
    overlap_train_val = train_dates.intersection(val_dates)
    overlap_val_test = val_dates.intersection(test_dates)
    overlap_train_test = train_dates.intersection(test_dates)
    
    print(f"Train/Val date overlap:  {len(overlap_train_val)} days {'(PASSED)' if len(overlap_train_val) == 0 else '(FAILED)'}")
    print(f"Val/Test date overlap:   {len(overlap_val_test)} days {'(PASSED)' if len(overlap_val_test) == 0 else '(FAILED)'}")
    print(f"Train/Test date overlap: {len(overlap_train_test)} days {'(PASSED)' if len(overlap_train_test) == 0 else '(FAILED)'}")
    
    if len(df_unseen) > 0:
        unseen_train_ids = set(df_unseen['train_no'])
        main_train_ids = set(df_train['train_no']).union(set(df_val['train_no'])).union(set(df_test['train_no']))
        overlap_trains = unseen_train_ids.intersection(main_train_ids)
        print(f"Unseen/Main train ID overlap: {len(overlap_trains)} trains {'(PASSED)' if len(overlap_trains) == 0 else '(FAILED)'}")

if __name__ == '__main__':
    main()
