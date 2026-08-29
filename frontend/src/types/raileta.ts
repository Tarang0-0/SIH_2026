export type DataSourceType = 'REAL' | 'DERIVED' | 'SIMULATED' | 'SYNTHETIC';

export interface TrainSummary {
  journey_id: string;
  train_number: string;
  train_name: string;
  train_type?: string;
  origin: string;
  destination: string;
  current_station: string;
  next_station: string;
  speed_kmph: number;
  delay_minutes: number;
  status: string;
  data_source: DataSourceType;
  last_update?: string;
}

export interface StationETA {
  station_code: string;
  station_name: string;
  sequence_number: number;
  distance_km: number;
  scheduled_arrival: string;
  scheduled_departure: string;
  baseline_eta: string;
  predicted_eta: string;
  predicted_delay_minutes: number;
  confidence_range_lower: string;
  confidence_range_upper: string;
  lower_bound_minutes: number;
  upper_bound_minutes: number;
  model_version: string;
  data_source: string;
}

export interface ETAPredictionResponse {
  journey_id: string;
  train_number: string;
  train_name: string;
  current_station_code: string;
  next_station_code: string;
  current_delay_minutes: number;
  current_speed_kmph: number;
  last_update_timestamp: string;
  predictions: StationETA[];
  shap_explanation: Record<string, number>;
  data_source: string;
}

export interface RouteStationTopology {
  sequence: number;
  station_code: string;
  station_name: string;
  distance_km: number;
  scheduled_arrival: string;
  scheduled_departure: string;
  dwell_minutes?: number;
  latitude: number;
  longitude: number;
}
