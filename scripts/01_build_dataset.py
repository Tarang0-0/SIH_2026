import pandas as pd
import numpy as np
import json
import os
import argparse
from datetime import datetime, timedelta

# Default paths, assuming the script runs from the project root
SF_PATH = '/mnt/user-data/uploads/SF-TRAINS.json'
EXP_PATH = '/mnt/user-data/uploads/EXP-TRAINS.json'
PASS_PATH = '/mnt/user-data/uploads/PASS-TRAINS.json'
DELAYS_CSV = '/mnt/user-data/uploads/train_delays.csv'
OUTPUT_DIR = 'data'
OUTPUT_PARQUET = os.path.join(OUTPUT_DIR, 'train_eta_training_data.parquet')
SELECTED_TRAINS_CSV = os.path.join(OUTPUT_DIR, 'selected_trains.csv')

def load_and_parse_json(filepath, train_type):
    print(f"Loading {train_type} trains from {filepath}...")
    if not os.path.exists(filepath):
        print(f"Warning: {filepath} not found. Returning empty DataFrame.")
        return pd.DataFrame()
        
    with open(filepath, 'r') as f:
        data = json.load(f)
    
    rows = []
    for train in data:
        train_no = str(train.get('train_number', train.get('train_no', train.get('trainNo', 'UNK'))))
        train_name = train.get('train_name', train.get('trainName', 'UNK'))
        
        running_days = train.get('running_days', train.get('run_days', []))
        if isinstance(running_days, str):
            running_days = [d.strip() for d in running_days.split(',')]
            
        stops = train.get('route', train.get('stops', train.get('stationList', [])))
        for i, stop in enumerate(stops):
            station_str = stop.get('station_name', stop.get('station', stop.get('stationName', 'UNKNOWN - UNK')))
            parts = station_str.split(' - ')
            if len(parts) >= 2:
                station_name = parts[0].strip()
                station_code = parts[1].strip()
            else:
                station_name = station_str
                station_code = "UNK"
                
            rows.append({
                'train_no': train_no,
                'train_name': train_name,
                'train_type': train_type,
                'running_days': ','.join(running_days) if isinstance(running_days, list) else str(running_days),
                'station_seq': stop.get('station_seq', stop.get('seq', i + 1)),
                'station_name': station_name,
                'station_code': station_code,
                'scheduled_arrival': stop.get('scheduled_arrival', stop.get('arrivalTime', '--')),
                'scheduled_departure': stop.get('scheduled_departure', stop.get('departureTime', '--')),
                'distance_km': float(stop.get('distance_km', stop.get('distance', 0))),
                'day_of_journey': int(stop.get('day_of_journey', stop.get('dayCount', 1)))
            })
            
    return pd.DataFrame(rows)

def parse_time(t_str):
    if pd.isna(t_str) or t_str in ['--', '', 'None', 'Destination', 'Origin', 'Start']:
        return None
    try:
        return pd.to_datetime(t_str, format='%H:%M').time()
    except:
        return None

def make_dt(date, days, time_obj):
    if pd.isnull(date) or pd.isnull(time_obj):
        return pd.NaT
    return date + pd.Timedelta(days=days-1) + pd.Timedelta(hours=time_obj.hour, minutes=time_obj.minute)

def accumulate_delay(drifts):
    arr = np.zeros(len(drifts), dtype=int)
    curr = 0
    for i, d in enumerate(drifts.values):
        curr += d
        if curr < 0: 
            curr = 0
        arr[i] = curr
    return arr

def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    # 1. Parse all three JSON files
    df_sf = load_and_parse_json(SF_PATH, 'SF')
    df_exp = load_and_parse_json(EXP_PATH, 'EXP')
    df_pass = load_and_parse_json(PASS_PATH, 'PASS')
    
    df_all = pd.concat([df_sf, df_exp, df_pass], ignore_index=True)
    if df_all.empty:
        print("No data loaded. Please ensure the JSON files exist at the specified paths.")
        return

    # 2. Select representative subset
    print("Selecting representative subset (100 SF, 100 EXP, 100 PASS)...")
    np.random.seed(42)
    selected_trains = []
    for ttype in ['SF', 'EXP', 'PASS']:
        subset = df_all[df_all['train_type'] == ttype]
        ttype_trains = subset['train_no'].unique()
        if len(ttype_trains) > 100:
            selected = np.random.choice(ttype_trains, 100, replace=False)
        else:
            selected = ttype_trains
        selected_trains.extend(selected)
        
    df_subset = df_all[df_all['train_no'].isin(selected_trains)].copy()
    
    # Save log of selected trains for reproducibility
    pd.DataFrame({'train_no': selected_trains}).to_csv(SELECTED_TRAINS_CSV, index=False)
    print(f"Saved selected trains to {SELECTED_TRAINS_CSV}")

    # 3. Generate 6 months of dates
    print("Generating 6-month date range schedules...")
    start_date = pd.to_datetime('2024-01-01')
    end_date = pd.to_datetime('2024-06-30')
    date_range = pd.date_range(start_date, end_date)
    
    # Mapping for days of week
    day_map = {'MON': 0, 'TUE': 1, 'WED': 2, 'THU': 3, 'FRI': 4, 'SAT': 5, 'SUN': 6}
    
    expanded_rows = []
    for train_no, group in df_subset.groupby('train_no'):
        rd_str = str(group['running_days'].iloc[0]).upper()
        if not rd_str or rd_str == 'DAILY':
            valid_days = set(range(7))
        else:
            valid_days = set()
            for d_name, d_idx in day_map.items():
                if d_name in rd_str:
                    valid_days.add(d_idx)
            if not valid_days:
                valid_days = set(range(7))
                
        valid_dates = [d for d in date_range if d.dayofweek in valid_days]
        for d in valid_dates:
            daily_group = group.copy()
            daily_group['date'] = d
            expanded_rows.append(daily_group)
            
    df_expanded = pd.concat(expanded_rows, ignore_index=True)

    # 4. Process timestamps & Simulate delays
    print("Computing timestamps and simulating realistic delays...")
    df_expanded['arr_time_obj'] = df_expanded['scheduled_arrival'].apply(parse_time)
    df_expanded['dep_time_obj'] = df_expanded['scheduled_departure'].apply(parse_time)
    df_expanded['arr_time_obj'] = df_expanded['arr_time_obj'].fillna(df_expanded['dep_time_obj'])
    df_expanded['dep_time_obj'] = df_expanded['dep_time_obj'].fillna(df_expanded['arr_time_obj'])

    df_expanded['scheduled_arrival_dt'] = df_expanded.apply(
        lambda row: make_dt(row['date'], row['day_of_journey'], row['arr_time_obj']), axis=1
    )
    
    # Drop rows where we couldn't parse time
    df_expanded = df_expanded.dropna(subset=['scheduled_arrival_dt'])

    # Congestion and Preceding train
    df_expanded['arrival_hour'] = df_expanded['scheduled_arrival_dt'].dt.floor('H')
    congestion = df_expanded.groupby(['station_code', 'arrival_hour']).size().reset_index(name='train_count')
    max_trains = congestion['train_count'].max() or 1
    congestion['congestion_index'] = congestion['train_count'] / max_trains
    
    # Synthetic preceding_train_delay (corresponds to congestion)
    congestion['preceding_train_delay'] = (congestion['congestion_index'] * np.random.uniform(10, 60, len(congestion))).astype(int)

    df_expanded = df_expanded.merge(congestion[['station_code', 'arrival_hour', 'congestion_index', 'preceding_train_delay']], 
                                    on=['station_code', 'arrival_hour'], how='left')
    df_expanded['congestion_index'] = df_expanded['congestion_index'].fillna(0)
    df_expanded['preceding_train_delay'] = df_expanded['preceding_train_delay'].fillna(0)

    # Delay Vectorized Logic
    month = df_expanded['date'].dt.month
    is_winter = month.isin([11, 12, 1, 2])
    is_monsoon = month.isin([6, 7, 8, 9])
    
    northern_zones = ['NDLS', 'DLI', 'LKO', 'CNB', 'ASR', 'JAT', 'CDG', 'BSB', 'PNBE', 'NR']
    is_north = df_expanded['station_code'].apply(lambda x: any(nz in x for nz in northern_zones)) | (np.random.rand(len(df_expanded)) < 0.15)
    
    df_expanded['season'] = 'Summer/Other'
    df_expanded.loc[is_winter, 'season'] = 'Winter'
    df_expanded.loc[is_monsoon, 'season'] = 'Monsoon'
    
    df_expanded['weather'] = 'Clear'
    df_expanded['is_foggy'] = False
    
    fog_mask = is_winter & is_north & (np.random.rand(len(df_expanded)) < 0.25)
    df_expanded.loc[fog_mask, 'weather'] = 'Fog'
    df_expanded.loc[fog_mask, 'is_foggy'] = True
    
    rain_mask = is_monsoon & (np.random.rand(len(df_expanded)) < 0.2)
    df_expanded.loc[rain_mask, 'weather'] = 'Rain'

    # Drift base
    df_expanded['drift'] = np.random.normal(0, 5, len(df_expanded)).astype(int)
    df_expanded['delay_reason'] = np.where(df_expanded['drift'] > 0, 'Minor Delay', 'On Time')
    
    rand_vals = np.random.rand(len(df_expanded))
    
    # Apply specific empirical targets
    # Fog: Mean ~48
    fog_cond = (df_expanded['weather'] == 'Fog')
    df_expanded.loc[fog_cond, 'drift'] += np.random.gamma(2, 22, fog_cond.sum()).astype(int)
    df_expanded.loc[fog_cond, 'delay_reason'] = 'Weather Disruption'
    
    # Rain: Mean ~93
    rain_cond = (df_expanded['weather'] == 'Rain') & (rand_vals < 0.3)
    df_expanded.loc[rain_cond, 'drift'] += np.random.gamma(2, 45, rain_cond.sum()).astype(int)
    df_expanded.loc[rain_cond, 'delay_reason'] = 'Weather Disruption'
    
    # Congestion: Mean ~76
    cong_cond = (df_expanded['congestion_index'] > 0.5) & (rand_vals >= 0.3) & (rand_vals < 0.4)
    df_expanded.loc[cong_cond, 'drift'] += np.random.gamma(2, 38, cong_cond.sum()).astype(int)
    df_expanded.loc[cong_cond, 'delay_reason'] = 'Congestion'
    
    # Late Incoming Train: Mean ~80
    prec_cond = (df_expanded['preceding_train_delay'] > 20) & (rand_vals >= 0.4) & (rand_vals < 0.5)
    df_expanded.loc[prec_cond, 'drift'] += df_expanded.loc[prec_cond, 'preceding_train_delay'].astype(int)
    df_expanded.loc[prec_cond, 'delay_reason'] = 'Late Incoming Train'
    
    # Signal Failure: Mean ~135
    sig_cond = (rand_vals < 0.01)
    df_expanded.loc[sig_cond, 'drift'] += np.random.gamma(4, 33, sig_cond.sum()).astype(int)
    df_expanded.loc[sig_cond, 'delay_reason'] = 'Signal Failure'
    
    # Technical Issue: Mean ~50
    tech_cond = (rand_vals >= 0.01) & (rand_vals < 0.03)
    df_expanded.loc[tech_cond, 'drift'] += np.random.gamma(5, 10, tech_cond.sum()).astype(int)
    df_expanded.loc[tech_cond, 'delay_reason'] = 'Technical Issue'
    
    # Station Sequence Fixes
    df_expanded.loc[df_expanded['station_seq'] == 1, 'drift'] = np.clip(df_expanded.loc[df_expanded['station_seq'] == 1, 'drift'], 0, None)
    
    # Compounding
    df_expanded = df_expanded.sort_values(['train_no', 'date', 'station_seq'])
    df_expanded['delay_minutes'] = df_expanded.groupby(['train_no', 'date'])['drift'].transform(accumulate_delay)
    
    df_expanded.loc[df_expanded['delay_minutes'] <= 0, 'delay_reason'] = 'On Time'
    
    df_expanded['actual_arrival'] = df_expanded['scheduled_arrival_dt'] + pd.to_timedelta(df_expanded['delay_minutes'], unit='m')
    df_expanded['delay_at_previous_station'] = df_expanded.groupby(['train_no', 'date'])['delay_minutes'].shift(1).fillna(0).astype(int)
    
    df_expanded['is_origin'] = (df_expanded['station_seq'] == 1)
    df_expanded['is_destination'] = (df_expanded['station_seq'] == df_expanded.groupby(['train_no', 'date'])['station_seq'].transform('max'))
    
    df_expanded['day_of_week'] = df_expanded['date'].dt.day_name()
    df_expanded['distance_from_origin'] = df_expanded['distance_km']
    
    # 5. Output
    cols = [
        'train_no', 'train_type', 'date', 'day_of_week', 'month', 'station_seq', 'station_code',
        'distance_from_origin', 'scheduled_arrival_dt', 'actual_arrival', 'delay_minutes',
        'delay_at_previous_station', 'weather', 'is_foggy', 'season', 'congestion_index',
        'preceding_train_delay', 'delay_reason', 'is_origin', 'is_destination'
    ]
    df_final = df_expanded[cols].rename(columns={'scheduled_arrival_dt': 'scheduled_arrival'})
    
    df_final.to_parquet(OUTPUT_PARQUET, index=False)
    print(f"Successfully saved {len(df_final)} rows to {OUTPUT_PARQUET}")
    
    # 6. Print Summaries
    print("\n--- Summary Statistics ---")
    print(f"Total rows: {len(df_final):,}")
    print(f"Date range: {df_final['date'].min().date()} to {df_final['date'].max().date()}")
    print(f"Unique Trains: {df_final['train_no'].nunique()}")
    
    print("\n--- Delay Minutes Distribution ---")
    print(df_final['delay_minutes'].describe(percentiles=[.25, .5, .75, .90, .95, .99]))
    
    print("\n--- Delay Reason Value Counts ---")
    print(df_final['delay_reason'].value_counts())

if __name__ == "__main__":
    main()
