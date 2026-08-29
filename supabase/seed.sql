-- RailETA Seed Data Script
-- File: supabase/seed.sql
-- Seed stations, trains, routes, route_stations, historical section metrics, and initial journey states

-- 1. SEED STATIONS (Northern, Western, Eastern, Central Corridors)
INSERT INTO stations (station_code, station_name, latitude, longitude, zone, division, data_source) VALUES
('NDLS', 'New Delhi', 28.6415, 77.2197, 'NR', 'DLI', 'REAL'),
('GZB', 'Ghaziabad Junction', 28.6657, 77.4393, 'NR', 'DLI', 'REAL'),
('ALJN', 'Aligarh Junction', 27.8974, 78.0777, 'NCR', 'PRYJ', 'REAL'),
('CNB', 'Kanpur Central', 26.4547, 80.3512, 'NCR', 'PRYJ', 'REAL'),
('LKO', 'Lucknow Charbagh', 26.8317, 80.9234, 'NR', 'LKO', 'REAL'),
('BCT', 'Mumbai Central', 18.9696, 72.8193, 'WR', 'MMCT', 'REAL'),
('ST', 'Surat', 21.2049, 72.8406, 'WR', 'BRC', 'REAL'),
('BRC', 'Vadodara Junction', 22.3107, 73.1812, 'WR', 'BRC', 'REAL'),
('RTM', 'Ratlam Junction', 23.3344, 75.0371, 'WR', 'RTM', 'REAL'),
('KOTA', 'Kota Junction', 25.2138, 75.8648, 'WCR', 'KOTA', 'REAL'),
('MTJ', 'Mathura Junction', 27.4924, 77.6737, 'NCR', 'AGC', 'REAL'),
('HWH', 'Howrah Junction', 22.5839, 88.3426, 'ER', 'HWH', 'REAL'),
('DGR', 'Durgapur', 23.4986, 87.3119, 'ER', 'ASN', 'REAL'),
('ASN', 'Asansol Junction', 23.6889, 86.9661, 'ER', 'ASN', 'REAL'),
('DHN', 'Dhanbad Junction', 23.7957, 86.4304, 'ECR', 'DHN', 'REAL'),
('GAYA', 'Gaya Junction', 24.7955, 84.9994, 'ECR', 'DDU', 'REAL'),
('DDU', 'Pt. Deen Dayal Upadhyaya Junction', 25.2818, 83.1189, 'ECR', 'DDU', 'REAL'),
('PRYJ', 'Prayagraj Junction', 25.4414, 81.8432, 'NCR', 'PRYJ', 'REAL')
ON CONFLICT (station_code) DO UPDATE SET
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude;

-- 2. SEED TRAINS
INSERT INTO trains (train_number, train_name, train_type, origin_station_code, destination_station_code, data_source) VALUES
('12004', 'Lucknow Swarna Shatabdi Express', 'Shatabdi', 'NDLS', 'LKO', 'REAL'),
('12951', 'Mumbai Rajdhani Express', 'Rajdhani', 'BCT', 'NDLS', 'REAL'),
('12301', 'Howrah Rajdhani Express', 'Rajdhani', 'HWH', 'NDLS', 'REAL')
ON CONFLICT (train_number) DO NOTHING;

-- 3. SEED ROUTES & ROUTE STATIONS FOR 12004 (NDLS -> LKO)
WITH t_12004 AS (SELECT id FROM trains WHERE train_number = '12004' LIMIT 1)
INSERT INTO routes (id, train_id, route_name, total_distance_km)
SELECT 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, id, 'NDLS-LKO Shatabdi Main Route', 511.0
FROM t_12004
ON CONFLICT (id) DO NOTHING;

-- Route stations for 12004
INSERT INTO route_stations (route_id, station_id, sequence_number, distance_from_source_km, scheduled_arrival, scheduled_departure, scheduled_dwell_minutes) VALUES
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, (SELECT id FROM stations WHERE station_code = 'NDLS'), 1, 0.0, '06:10:00', '06:10:00', 0),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, (SELECT id FROM stations WHERE station_code = 'GZB'), 2, 24.5, '06:48:00', '06:50:00', 2),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, (SELECT id FROM stations WHERE station_code = 'ALJN'), 3, 130.8, '07:49:00', '07:51:00', 2),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, (SELECT id FROM stations WHERE station_code = 'CNB'), 4, 439.4, '11:20:00', '11:25:00', 5),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, (SELECT id FROM stations WHERE station_code = 'LKO'), 5, 511.0, '12:40:00', '12:40:00', 0)
ON CONFLICT DO NOTHING;

-- 4. SEED ROUTES & ROUTE STATIONS FOR 12951 (BCT -> NDLS)
WITH t_12951 AS (SELECT id FROM trains WHERE train_number = '12951' LIMIT 1)
INSERT INTO routes (id, train_id, route_name, total_distance_km)
SELECT 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22'::uuid, id, 'BCT-NDLS Rajdhani Main Route', 1386.0
FROM t_12951
ON CONFLICT (id) DO NOTHING;

INSERT INTO route_stations (route_id, station_id, sequence_number, distance_from_source_km, scheduled_arrival, scheduled_departure, scheduled_dwell_minutes) VALUES
('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22'::uuid, (SELECT id FROM stations WHERE station_code = 'BCT'), 1, 0.0, '17:00:00', '17:00:00', 0),
('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22'::uuid, (SELECT id FROM stations WHERE station_code = 'ST'), 2, 263.0, '19:42:00', '19:47:00', 5),
('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22'::uuid, (SELECT id FROM stations WHERE station_code = 'BRC'), 3, 392.0, '21:08:00', '21:18:00', 10),
('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22'::uuid, (SELECT id FROM stations WHERE station_code = 'RTM'), 4, 653.0, '00:35:00', '00:38:00', 3),
('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22'::uuid, (SELECT id FROM stations WHERE station_code = 'KOTA'), 5, 919.0, '03:15:00', '03:25:00', 10),
('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22'::uuid, (SELECT id FROM stations WHERE station_code = 'MTJ'), 6, 1243.0, '06:40:00', '06:42:00', 2),
('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22'::uuid, (SELECT id FROM stations WHERE station_code = 'NDLS'), 7, 1386.0, '08:32:00', '08:32:00', 0)
ON CONFLICT DO NOTHING;

-- 5. SEED HISTORICAL SECTION METRICS (section_history)
INSERT INTO section_history (section_id, from_station_id, to_station_id, distance_km, train_type, historical_avg_speed_kmph, historical_median_running_minutes, historical_p90_running_minutes, sample_count, data_source) VALUES
('SEC_NDLS_GZB', (SELECT id FROM stations WHERE station_code = 'NDLS'), (SELECT id FROM stations WHERE station_code = 'GZB'), 24.5, 'Shatabdi', 42.0, 35.0, 42.0, 150, 'REAL'),
('SEC_GZB_ALJN', (SELECT id FROM stations WHERE station_code = 'GZB'), (SELECT id FROM stations WHERE station_code = 'ALJN'), 106.3, 'Shatabdi', 108.0, 59.0, 68.0, 150, 'REAL'),
('SEC_ALJN_CNB', (SELECT id FROM stations WHERE station_code = 'ALJN'), (SELECT id FROM stations WHERE station_code = 'CNB'), 308.6, 'Shatabdi', 105.0, 176.0, 195.0, 150, 'REAL'),
('SEC_CNB_LKO', (SELECT id FROM stations WHERE station_code = 'CNB'), (SELECT id FROM stations WHERE station_code = 'LKO'), 71.6, 'Shatabdi', 62.0, 69.0, 80.0, 150, 'REAL'),

('SEC_BCT_ST', (SELECT id FROM stations WHERE station_code = 'BCT'), (SELECT id FROM stations WHERE station_code = 'ST'), 263.0, 'Rajdhani', 97.0, 162.0, 175.0, 200, 'REAL'),
('SEC_ST_BRC', (SELECT id FROM stations WHERE station_code = 'ST'), (SELECT id FROM stations WHERE station_code = 'BRC'), 129.0, 'Rajdhani', 102.0, 76.0, 85.0, 200, 'REAL'),
('SEC_BRC_RTM', (SELECT id FROM stations WHERE station_code = 'BRC'), (SELECT id FROM stations WHERE station_code = 'RTM'), 261.0, 'Rajdhani', 89.0, 176.0, 190.0, 200, 'REAL'),
('SEC_RTM_KOTA', (SELECT id FROM stations WHERE station_code = 'RTM'), (SELECT id FROM stations WHERE station_code = 'KOTA'), 266.0, 'Rajdhani', 101.0, 157.0, 170.0, 200, 'REAL'),
('SEC_KOTA_MTJ', (SELECT id FROM stations WHERE station_code = 'KOTA'), (SELECT id FROM stations WHERE station_code = 'MTJ'), 324.0, 'Rajdhani', 99.0, 195.0, 210.0, 200, 'REAL'),
('SEC_MTJ_NDLS', (SELECT id FROM stations WHERE station_code = 'MTJ'), (SELECT id FROM stations WHERE station_code = 'NDLS'), 143.0, 'Rajdhani', 86.0, 100.0, 115.0, 200, 'REAL')
ON CONFLICT DO NOTHING;

-- 6. SEED ACTIVE JOURNEYS FOR DEMO
INSERT INTO journeys (journey_id, train_id, journey_date, status, current_station_id, next_station_id, current_delay_minutes, current_speed_kmph, data_source) VALUES
('J1001', (SELECT id FROM trains WHERE train_number = '12004'), CURRENT_DATE, 'ACTIVE', (SELECT id FROM stations WHERE station_code = 'GZB'), (SELECT id FROM stations WHERE station_code = 'ALJN'), 8, 84.5, 'SIMULATED'),
('J1002', (SELECT id FROM trains WHERE train_number = '12951'), CURRENT_DATE, 'ACTIVE', (SELECT id FROM stations WHERE station_code = 'BRC'), (SELECT id FROM stations WHERE station_code = 'RTM'), 15, 92.0, 'SIMULATED')
ON CONFLICT (journey_id) DO NOTHING;
