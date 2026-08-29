-- RailETA Persistence & Longitudinal Accuracy Schema
-- Migration: 20260829000000_eta_persistence_and_accuracy.sql
-- Description: Adds actual station arrival recording and automated prediction error reconciliation

-- 1. ACTUAL STATION ARRIVALS TABLE
-- Records ground truth arrival punches when a train physically reaches a station.
CREATE TABLE IF NOT EXISTS actual_arrivals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    journey_id VARCHAR(50) NOT NULL,
    train_number VARCHAR(10) NOT NULL,
    station_code VARCHAR(10) NOT NULL,
    actual_arrival_time TIMESTAMPTZ NOT NULL,
    scheduled_arrival_time TIMESTAMPTZ NOT NULL,
    actual_delay_minutes DOUBLE PRECISION NOT NULL,
    dwell_duration_minutes DOUBLE PRECISION DEFAULT 2.0,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_actual_arrivals_journey_stn 
ON actual_arrivals(journey_id, station_code);

-- 2. PREDICTION ACCURACY & ERROR ANALYSIS TABLE
-- Links each historical ETA forecast to the eventual ground truth actual arrival.
CREATE TABLE IF NOT EXISTS prediction_accuracy_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prediction_id UUID,
    journey_id VARCHAR(50) NOT NULL,
    train_number VARCHAR(10) NOT NULL,
    target_station_code VARCHAR(10) NOT NULL,
    prediction_timestamp TIMESTAMPTZ NOT NULL,
    actual_arrival_time TIMESTAMPTZ NOT NULL,
    
    -- Lead time: How many minutes in advance was this prediction generated?
    lead_time_minutes DOUBLE PRECISION NOT NULL,
    
    -- Forecasts vs Ground Truth
    predicted_arrival_time TIMESTAMPTZ NOT NULL,
    baseline_arrival_time TIMESTAMPTZ NOT NULL,
    
    -- Absolute Errors (Minutes)
    ml_error_minutes DOUBLE PRECISION NOT NULL,
    baseline_error_minutes DOUBLE PRECISION NOT NULL,
    
    -- Performance Metrics
    ml_improvement_minutes DOUBLE PRECISION NOT NULL, -- (baseline_error - ml_error)
    within_5_min_flag INT NOT NULL DEFAULT 1,
    
    model_version VARCHAR(50) NOT NULL DEFAULT 'GBDT-v1.0',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pred_accuracy_journey 
ON prediction_accuracy_logs(journey_id, target_station_code);

CREATE INDEX IF NOT EXISTS idx_pred_accuracy_lead_time 
ON prediction_accuracy_logs(lead_time_minutes);

-- 3. LONGITUDINAL ACCURACY ANALYTICAL VIEW
-- Aggregates prediction performance by lead-time windows (e.g. >120m, 60-120m, 30-60m, <30m)
CREATE OR REPLACE VIEW v_prediction_accuracy_by_lead_time AS
SELECT 
    CASE 
        WHEN lead_time_minutes >= 120 THEN '4. Long-Range (>2 hrs)'
        WHEN lead_time_minutes >= 60  THEN '3. Mid-Range (1-2 hrs)'
        WHEN lead_time_minutes >= 30  THEN '2. Short-Range (30-60 min)'
        ELSE '1. Imminent (<30 min)'
    END AS lead_time_tier,
    COUNT(*) AS total_forecasts,
    ROUND(AVG(ml_error_minutes)::numeric, 2) AS ml_mae_minutes,
    ROUND(AVG(baseline_error_minutes)::numeric, 2) AS baseline_mae_minutes,
    ROUND(AVG(ml_improvement_minutes)::numeric, 2) AS avg_error_reduction_minutes,
    ROUND((AVG(within_5_min_flag) * 100)::numeric, 1) AS pct_within_5_min
FROM prediction_accuracy_logs
GROUP BY 1
ORDER BY 1;
