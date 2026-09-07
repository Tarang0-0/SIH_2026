import numpy as np

FEATURE_DESCRIPTIONS = {
    # Journey-level features from the IR dataset
    "distance_km": "the total route distance",
    "num_scheduled_stops": "the number of intermediate stops",
    "scheduled_travel_hours": "the scheduled journey duration",
    "departure_hour": "the departure time of day",
    "day_of_week": "the day of the week",
    "month": "the time of year",
    "is_weekend": "weekend traffic patterns",
    "is_night_departure": "night-time departure conditions",
    "is_peak_hour": "peak-hour congestion",
    "is_festival_season": "festival season passenger surge",
    "is_monsoon_season": "monsoon weather disruptions",
    "is_fog_risk": "fog risk conditions",
    "fog_risk_score": "fog severity on the route",
    "zone_fog_index": "historical fog-related delay risk for the zone",
    "zone_congestion_index": "route network congestion in the zone",
    "season_severity_score": "weather severity for the season",
    "track_doubled": "track capacity (single vs doubled)",
    "is_hdn_route": "high density network corridor load",
    "is_electrified": "electrification status of the route",
    "psr_count": "permanent speed restrictions on the route",
    "seat_utilisation_pct": "passenger load factor",
    "current_delay": "delay carried over from the current position",
    # Legacy features (kept for backward compatibility)
    "delay_at_previous_station": "delay carried over from the previous station",
    "congestion_index": "high congestion in this route segment",
    "preceding_train_delay": "late running of the preceding train",
    "weather_Rain": "heavy rain conditions",
    "weather_Fog": "foggy weather conditions",
    "historical_avg_delay_for_this_train": "this train's historical tendency to run late",
    "is_holiday": "holiday traffic impacts",
    "station_density_last_3_stops": "high station density and stopping frequency",
    "delay_trend_last_2_stops": "a recent worsening delay trend",
    "fraction_of_journey_completed": "the current stage of the journey",
    "hour_of_scheduled_arrival": "the time of day",
    "distance_from_origin": "the distance traveled so far",
}

class DelayExplainer:
    def __init__(self, model):
        """
        Initialize with a trained XGBoost/LightGBM model.
        Supports both native XGBoost Tree SHAP (pred_contribs) and shap.TreeExplainer.
        """
        self.model = model
        self.has_shap_lib = False
        try:
            import shap
            self.explainer = shap.TreeExplainer(model)
            self.has_shap_lib = True
        except ImportError:
            self.explainer = None
        
    def get_shap_values(self, X):
        """Returns SHAP values array for the dataset X."""
        if self.has_shap_lib and self.explainer:
            return self.explainer.shap_values(X)
        elif hasattr(self.model, "get_booster"):
            import xgboost as xgb
            dmat = xgb.DMatrix(X)
            # pred_contribs returns [N, num_features + 1] where last col is base value
            contribs = self.model.get_booster().predict(dmat, pred_contribs=True)
            return contribs[:, :-1]
        else:
            # Fallback uniform proxy
            return np.zeros(X.shape)
        
    def explain_delay(self, predicted_delay, feature_names, feature_values, shap_values):
        """
        Converts top SHAP features into a natural-language sentence.
        
        predicted_delay: float, the predicted delay in minutes
        feature_names: list of str, names of the features
        feature_values: list/array of float, the actual values of the features for this row
        shap_values: list/array of float, the SHAP values for this row
        """
        if predicted_delay < 5:
            return f"Predicted {predicted_delay:.0f}-min delay — expected to be mostly on time."
            
        # Pair up names, values, and shap impacts
        feature_data = []
        for name, val, impact in zip(feature_names, feature_values, shap_values):
            if impact > 0: # We only care about factors driving the delay UP
                feature_data.append((name, val, impact))
                
        # Sort by highest SHAP impact
        feature_data.sort(key=lambda x: x[2], reverse=True)
        
        if not feature_data:
            return f"Predicted {predicted_delay:.0f}-min delay — due to baseline route factors."
            
        def format_desc(name, val):
            desc = FEATURE_DESCRIPTIONS.get(name, name.replace('_', ' '))
            # Add dynamic context where useful to make it sound natural
            if name == 'current_delay':
                return f"{val:.0f} min delay carried over from current position"
            if name == 'preceding_train_delay':
                return f"preceding train running {val:.0f} min late"
            if name == 'delay_at_previous_station':
                return f"{val:.0f} min delay carried over from the previous station"
            if name == 'zone_congestion_index':
                return f"high zone congestion ({val:.0%})"
            if name == 'fog_risk_score':
                return f"fog risk severity ({val:.0%})"
            if name == 'seat_utilisation_pct':
                return f"high passenger load ({val:.0f}%)"
            if name == 'distance_km':
                return f"long-distance route ({val:.0f} km)"
            return desc
            
        primary_name, primary_val, _ = feature_data[0]
        primary_desc = format_desc(primary_name, primary_val)
        
        if len(feature_data) > 1:
            sec_name, sec_val, _ = feature_data[1]
            sec_desc = format_desc(sec_name, sec_val)
            return f"Predicted {predicted_delay:.0f}-min delay — primary factor: {primary_desc}; secondary: {sec_desc}."
        else:
            return f"Predicted {predicted_delay:.0f}-min delay — primary factor: {primary_desc}."
