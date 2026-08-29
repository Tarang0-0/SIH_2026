-- RailETA Database Schema Migration
-- Migration: 20260827000000_initial_schema.sql
-- Description: Core tables for trains, stations, routes, journeys, running updates, section history, and ETA predictions

-- Enable PostGIS extension for spatial queries (if available)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- Data Source Provenance ENUM
DO $$ BEGIN
    CREATE TYPE data_source_type AS ENUM ('REAL', 'DERIVED', 'SIMULATED', 'SYNTHETIC');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 1. STATIONS TABLE
CREATE TABLE IF NOT EXISTS stations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    station_code VARCHAR(10) UNIQUE NOT NULL,
    station_name VARCHAR(100) NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    zone VARCHAR(10) DEFAULT 'NR',
    division VARCHAR(50) DEFAULT 'DLI',
    data_source data_source_type NOT NULL DEFAULT 'REAL',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. TRAINS TABLE
CREATE TABLE IF NOT EXISTS trains (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    train_number VARCHAR(10) UNIQUE NOT NULL,
    train_name VARCHAR(100) NOT NULL,
    train_type VARCHAR(50) NOT NULL DEFAULT 'Express', -- Express, Rajdhani, Shatabdi, Vande Bharat
    origin_station_code VARCHAR(10) REFERENCES stations(station_code),
    destination_station_code VARCHAR(10) REFERENCES stations(station_code),
    data_source data_source_type NOT NULL DEFAULT 'REAL',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. ROUTES TABLE
CREATE TABLE IF NOT EXISTS routes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    train_id UUID REFERENCES trains(id) ON DELETE CASCADE,
    route_name VARCHAR(100) NOT NULL,
    total_distance_km DOUBLE PRECISION NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. ROUTE STATIONS TABLE (Topology and Schedule)
CREATE TABLE IF NOT EXISTS route_stations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    route_id UUID REFERENCES routes(id) ON DELETE CASCADE,
    station_id UUID REFERENCES stations(id) ON DELETE RESTRICT,
    sequence_number INT NOT NULL,
    distance_from_source_km DOUBLE PRECISION NOT NULL,
    scheduled_arrival TIME,
    scheduled_departure TIME,
    scheduled_dwell_minutes INT DEFAULT 2,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_route_sequence UNIQUE (route_id, sequence_number)
);

-- 5. JOURNEYS TABLE (Active or historical train runs)
CREATE TABLE IF NOT EXISTS journeys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    journey_id VARCHAR(50) UNIQUE NOT NULL, -- e.g. J1001
    train_id UUID REFERENCES trains(id) ON DELETE RESTRICT,
    journey_date DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'ACTIVE', -- SCHEDULED, ACTIVE, COMPLETED, CANCELLED
    current_station_id UUID REFERENCES stations(id),
    next_station_id UUID REFERENCES stations(id),
    current_delay_minutes INT DEFAULT 0,
    current_speed_kmph DOUBLE PRECISION DEFAULT 0.0,
    data_source data_source_type NOT NULL DEFAULT 'SIMULATED',
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. RUNNING UPDATES TABLE (Canonical event log)
CREATE TABLE IF NOT EXISTS running_updates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    journey_id VARCHAR(50) REFERENCES journeys(journey_id) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    speed_kmph DOUBLE PRECISION NOT NULL,
    delay_minutes INT NOT NULL,
    current_station_code VARCHAR(10) REFERENCES stations(station_code),
    next_station_code VARCHAR(10) REFERENCES stations(station_code),
    data_source data_source_type NOT NULL DEFAULT 'SIMULATED',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. SECTION HISTORY TABLE (Aggregated historical running metrics per track section)
CREATE TABLE IF NOT EXISTS section_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    section_id VARCHAR(50) NOT NULL, -- e.g. SEC_NDLS_GZB
    from_station_id UUID REFERENCES stations(id),
    to_station_id UUID REFERENCES stations(id),
    distance_km DOUBLE PRECISION NOT NULL,
    train_type VARCHAR(50) DEFAULT 'Express',
    historical_avg_speed_kmph DOUBLE PRECISION NOT NULL,
    historical_median_running_minutes DOUBLE PRECISION NOT NULL,
    historical_p90_running_minutes DOUBLE PRECISION,
    sample_count INT DEFAULT 100,
    data_source data_source_type NOT NULL DEFAULT 'REAL',
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_section_train_type UNIQUE (section_id, train_type)
);

-- 8. ETA PREDICTIONS TABLE (Forecast history log)
CREATE TABLE IF NOT EXISTS eta_predictions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    journey_id VARCHAR(50) REFERENCES journeys(journey_id) ON DELETE CASCADE,
    target_station_id UUID REFERENCES stations(id),
    predicted_arrival_time TIMESTAMPTZ NOT NULL,
    baseline_eta TIMESTAMPTZ NOT NULL, -- Scheduled Arrival + Current Delay
    predicted_delay_minutes DOUBLE PRECISION NOT NULL,
    lower_bound_minutes DOUBLE PRECISION NOT NULL,
    upper_bound_minutes DOUBLE PRECISION NOT NULL,
    model_version VARCHAR(50) NOT NULL DEFAULT 'xgboost-v1.0',
    prediction_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    shap_explanation JSONB DEFAULT '{}'::jsonb,
    data_source data_source_type NOT NULL DEFAULT 'SIMULATED',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_stations_code ON stations(station_code);
CREATE INDEX IF NOT EXISTS idx_trains_number ON trains(train_number);
CREATE INDEX IF NOT EXISTS idx_route_stations_route_seq ON route_stations(route_id, sequence_number);
CREATE INDEX IF NOT EXISTS idx_journeys_journey_id ON journeys(journey_id);
CREATE INDEX IF NOT EXISTS idx_journeys_train_id ON journeys(train_id);
CREATE INDEX IF NOT EXISTS idx_running_updates_journey_ts ON running_updates(journey_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_section_history_from_to ON section_history(from_station_id, to_station_id);
CREATE INDEX IF NOT EXISTS idx_eta_predictions_journey_ts ON eta_predictions(journey_id, prediction_timestamp DESC);

-- ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE trains ENABLE ROW LEVEL SECURITY;
ALTER TABLE routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE route_stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE journeys ENABLE ROW LEVEL SECURITY;
ALTER TABLE running_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE section_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE eta_predictions ENABLE ROW LEVEL SECURITY;

-- Allow public read access to all tables
CREATE POLICY "Allow public read access on stations" ON stations FOR SELECT USING (true);
CREATE POLICY "Allow public read access on trains" ON trains FOR SELECT USING (true);
CREATE POLICY "Allow public read access on routes" ON routes FOR SELECT USING (true);
CREATE POLICY "Allow public read access on route_stations" ON route_stations FOR SELECT USING (true);
CREATE POLICY "Allow public read access on journeys" ON journeys FOR SELECT USING (true);
CREATE POLICY "Allow public read access on running_updates" ON running_updates FOR SELECT USING (true);
CREATE POLICY "Allow public read access on section_history" ON section_history FOR SELECT USING (true);
CREATE POLICY "Allow public read access on eta_predictions" ON eta_predictions FOR SELECT USING (true);

-- Allow service role full access for insertion/updates
CREATE POLICY "Allow service role full access on stations" ON stations USING (auth.role() = 'service_role' OR auth.role() = 'anon');
CREATE POLICY "Allow service role full access on trains" ON trains USING (auth.role() = 'service_role' OR auth.role() = 'anon');
CREATE POLICY "Allow service role full access on routes" ON routes USING (auth.role() = 'service_role' OR auth.role() = 'anon');
CREATE POLICY "Allow service role full access on route_stations" ON route_stations USING (auth.role() = 'service_role' OR auth.role() = 'anon');
CREATE POLICY "Allow service role full access on journeys" ON journeys USING (auth.role() = 'service_role' OR auth.role() = 'anon');
CREATE POLICY "Allow service role full access on running_updates" ON running_updates USING (auth.role() = 'service_role' OR auth.role() = 'anon');
CREATE POLICY "Allow service role full access on section_history" ON section_history USING (auth.role() = 'service_role' OR auth.role() = 'anon');
CREATE POLICY "Allow service role full access on eta_predictions" ON eta_predictions USING (auth.role() = 'service_role' OR auth.role() = 'anon');
