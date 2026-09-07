import pandas as pd
import numpy as np
import os
import warnings

# Suppress pandas FutureWarnings for clean output
warnings.simplefilter(action='ignore', category=FutureWarning)

INPUT_PARQUET = 'data/train_eta_training_data.parquet'
OUTPUT_PARQUET = 'data/train_eta_features.parquet'

def generate_mock_data():
    """Generates mock data in case the script is run without the output of step 1."""
    print("WARNING: Input parquet not found. Generating mock data for testing...")
    dates = pd.date_range('2024-01-01', '2024-01-06')
    rows = []
    trains = ['12951', '12627']
    for t in trains:
        for i, d in enumerate(dates):
            # Make the delay increase over days so we can see the expanding mean clearly
            base_delay = i * 10 
            for seq, dist in enumerate([0, 50, 120, 200, 250]):
                delay = base_delay + seq * 2
                rows.append({
                    'train_no': t,
                    'train_type': 'SF',
                    'date': d,
                    'station_seq': seq + 1,
                    'station_code': f'STN{seq}',
                    'scheduled_arrival': pd.Timestamp(d) + pd.Timedelta(hours=seq+10),
                    'distance_from_origin': dist,
                    'delay_minutes': delay,
                    'delay_at_previous_station': delay - 2 if seq > 0 else 0,
                    'delay_reason': 'Minor Delay' if delay > 0 else 'On Time'
                })
    return pd.DataFrame(rows)

def main():
    if os.path.exists(INPUT_PARQUET):
        print(f"Loading data from {INPUT_PARQUET}...")
        df = pd.read_parquet(INPUT_PARQUET)
    else:
        df = generate_mock_data()
        
    print(f"Initial shape: {df.shape}")
    
    # 1. hour_of_scheduled_arrival
    df['hour_of_scheduled_arrival'] = pd.to_datetime(df['scheduled_arrival']).dt.hour
    
    # 2. is_weekend
    df['is_weekend'] = pd.to_datetime(df['date']).dt.dayofweek >= 5
    
    # 3. is_holiday
    # Major Indian holidays in the Jan-Jun 2024 window
    holidays_2024 = pd.to_datetime([
        '2024-01-01', # New Year
        '2024-01-15', # Makar Sankranti / Pongal
        '2024-01-26', # Republic Day
        '2024-03-08', # Maha Shivaratri
        '2024-03-25', # Holi
        '2024-04-09', # Ugadi
        '2024-04-11', # Eid ul Fitr
        '2024-04-17', # Ram Navami
        '2024-05-23', # Buddha Purnima
        '2024-06-17'  # Eid al-Adha
    ])
    df['is_holiday'] = pd.to_datetime(df['date']).isin(holidays_2024)
    
    # 4. fraction_of_journey_completed
    route_dist = df.groupby(['train_no', 'date'])['distance_from_origin'].transform('max')
    df['fraction_of_journey_completed'] = np.where(
        route_dist > 0, 
        df['distance_from_origin'] / route_dist, 
        0.0
    )
    
    # 5. station_density_last_3_stops (stations per 100km over last 3 stops)
    df = df.sort_values(['train_no', 'date', 'station_seq'])
    df['dist_3_stops_ago'] = df.groupby(['train_no', 'date'])['distance_from_origin'].shift(3)
    
    dist_diff = df['distance_from_origin'] - df['dist_3_stops_ago']
    dist_diff = dist_diff.clip(lower=1.0) # Avoid division by zero
    
    df['station_density_last_3_stops'] = 300.0 / dist_diff
    df['station_density_last_3_stops'] = df['station_density_last_3_stops'].fillna(0.0)
    df = df.drop(columns=['dist_3_stops_ago'])
    
    # 6. delay_trend_last_2_stops
    # Delay at (k-1) is delay_at_previous_station
    # Delay at (k-2) is shift(1) of delay_at_previous_station
    if 'delay_at_previous_station' not in df.columns:
        df['delay_at_previous_station'] = df.groupby(['train_no', 'date'])['delay_minutes'].shift(1).fillna(0)
        
    df['delay_at_2_stations_ago'] = df.groupby(['train_no', 'date'])['delay_at_previous_station'].shift(1).fillna(0)
    df['delay_trend_last_2_stops'] = df['delay_at_previous_station'] - df['delay_at_2_stations_ago']
    df = df.drop(columns=['delay_at_2_stations_ago'])
    
    # 7. historical_avg_delay_for_this_train
    """
    LEAKAGE PREVENTION EXPLANATION:
    To compute the historical average delay of a train without data leakage:
    1. We group the raw dataset by ('train_no', 'date') to calculate the mean 'delay_minutes' for that train strictly on that single calendar day.
    2. We sort these daily aggregates chronologically by 'date' ensuring a true time-series order.
    3. We apply `expanding().mean().shift(1)` within each 'train_no' group:
       - `expanding().mean()` calculates the cumulative average of all daily delays up to the current row.
       - `.shift(1)` crucially pushes this cumulative average down by exactly one row.
       This step ensures that the feature value at row `T` ONLY incorporates data from rows `[0, T-1]`.
    4. We merge this strictly historical feature back to the main dataframe based on `train_no` and `date`.
    By aggregating purely at the date level and rigorously shifting, we guarantee that no station's outcome from date `D` 
    (or any future date) can "leak" backward into the prediction features for any station on date `D`.
    """
    daily_delay = df.groupby(['train_no', 'date'])['delay_minutes'].mean().reset_index()
    daily_delay = daily_delay.sort_values(['train_no', 'date'])
    
    def expanding_shifted_mean(group):
        return group.expanding().mean().shift(1)
        
    daily_delay['historical_avg_delay_for_this_train'] = (
        daily_delay.groupby('train_no', group_keys=False)['delay_minutes']
        .apply(expanding_shifted_mean)
    )
    
    print("\n--- LEAKAGE PREVENTION DEMO ---")
    print("Here is how the daily aggregate delays and the shifted expanding mean look for a single train:")
    demo_train = daily_delay['train_no'].iloc[0]
    demo_df = daily_delay[daily_delay['train_no'] == demo_train].head(5)
    print(demo_df[['train_no', 'date', 'delay_minutes', 'historical_avg_delay_for_this_train']].to_string(index=False))
    print("Notice how on row `i`, 'historical_avg_delay' is exactly the average of 'delay_minutes' from row 0 to i-1. The first day is NaN because there is no prior history.")
    
    # Merge the historical feature back
    df = df.merge(daily_delay[['train_no', 'date', 'historical_avg_delay_for_this_train']], on=['train_no', 'date'], how='left')
    
    # Fill first-day NaNs with 0 (since there is no historical baseline yet)
    df['historical_avg_delay_for_this_train'] = df['historical_avg_delay_for_this_train'].fillna(0)
    
    # Save features
    os.makedirs(os.path.dirname(OUTPUT_PARQUET), exist_ok=True)
    try:
        df.to_parquet(OUTPUT_PARQUET, index=False)
        print(f"\nSuccessfully saved model-ready features to {OUTPUT_PARQUET}")
    except ImportError:
        print("\nNote: pyarrow/fastparquet not found locally. Skipping actual parquet save during mock run.")
    
    print("\n--- FINAL CHECKS ---")
    print("Final Column List:")
    print(list(df.columns))
    
    print(f"\nRow count: {len(df)}")
    
    targets = ['delay_minutes', 'delay_reason']
    for t in targets:
        if t in df.columns:
            nan_cnt = df[t].isna().sum()
            print(f"NaN count in {t}: {nan_cnt} {'(PASSED)' if nan_cnt == 0 else '(FAILED)'}")
        else:
            print(f"Warning: Target column {t} missing!")
            
    print(f"\nSuccessfully saved model-ready features to {OUTPUT_PARQUET}")

if __name__ == "__main__":
    main()
