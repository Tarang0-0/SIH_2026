"""
RailETA Real-Time Train Movement Simulation Engine
Problem Statement: SIH26028 (Dynamic Forecast of ETA for Coaching Trains)

Simulates continuous, physically realistic train movement along multi-stop Indian Railways
trunk routes with dynamic velocity adjustment, delay accumulation/recovery, junction friction,
and station dwell cycles.

Exposes asynchronous generators, callbacks, and manual disruption injection for FastAPI
and WebSocket integration.
"""

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, List, Optional, Callable, AsyncGenerator

logger = logging.getLogger("raileta.train_simulator")

# ==============================================================================
# 1. CANONICAL CORRIDOR ROUTE TOPOLOGIES
# ==============================================================================

SIMULATION_ROUTES: Dict[str, Dict[str, Any]] = {
    "12302": {
        "train_number": "12302",
        "train_name": "Howrah Rajdhani Express",
        "train_type": "RAJ",
        "priority_level": 1,
        "max_speed_kmh": 130.0,
        "cruise_speed_kmh": 115.0,
        "sections": [
            {"from_station": "NDLS", "to_station": "CNB", "distance_km": 440.0, "scheduled_min": 285.0, "base_congestion": 0.70},
            {"from_station": "CNB", "to_station": "PRYJ", "distance_km": 194.5, "scheduled_min": 120.0, "base_congestion": 0.65},
            {"from_station": "PRYJ", "to_station": "DDU", "distance_km": 153.0, "scheduled_min": 105.0, "base_congestion": 0.60},
            {"from_station": "DDU", "to_station": "GAYA", "distance_km": 205.0, "scheduled_min": 130.0, "base_congestion": 0.50},
            {"from_station": "GAYA", "to_station": "DHN", "distance_km": 201.0, "scheduled_min": 140.0, "base_congestion": 0.45},
            {"from_station": "DHN", "to_station": "HWH", "distance_km": 259.0, "scheduled_min": 200.0, "base_congestion": 0.65},
        ],
    },
    "22436": {
        "train_number": "22436",
        "train_name": "Vande Bharat Express",
        "train_type": "VB",
        "priority_level": 1,
        "max_speed_kmh": 130.0,
        "cruise_speed_kmh": 120.0,
        "sections": [
            {"from_station": "NDLS", "to_station": "CNB", "distance_km": 440.0, "scheduled_min": 240.0, "base_congestion": 0.70},
            {"from_station": "CNB", "to_station": "PRYJ", "distance_km": 194.5, "scheduled_min": 100.0, "base_congestion": 0.65},
            {"from_station": "PRYJ", "to_station": "DDU", "distance_km": 153.0, "scheduled_min": 90.0, "base_congestion": 0.60},
            {"from_station": "DDU", "to_station": "BSB", "distance_km": 18.0, "scheduled_min": 25.0, "base_congestion": 0.55},
        ],
    },
    "12004": {
        "train_number": "12004",
        "train_name": "Lucknow Shatabdi Express",
        "train_type": "SF",
        "priority_level": 2,
        "max_speed_kmh": 110.0,
        "cruise_speed_kmh": 95.0,
        "sections": [
            {"from_station": "NDLS", "to_station": "GZB", "distance_km": 24.5, "scheduled_min": 38.0, "base_congestion": 0.85},
            {"from_station": "GZB", "to_station": "ALJN", "distance_km": 106.3, "scheduled_min": 60.0, "base_congestion": 0.60},
            {"from_station": "ALJN", "to_station": "CNB", "distance_km": 308.6, "scheduled_min": 210.0, "base_congestion": 0.55},
            {"from_station": "CNB", "to_station": "LKO", "distance_km": 71.6, "scheduled_min": 75.0, "base_congestion": 0.75},
        ],
    },
    "12951": {
        "train_number": "12951",
        "train_name": "Mumbai Rajdhani Express",
        "train_type": "RAJ",
        "priority_level": 1,
        "max_speed_kmh": 130.0,
        "cruise_speed_kmh": 115.0,
        "sections": [
            {"from_station": "BCT", "to_station": "ST", "distance_km": 263.0, "scheduled_min": 160.0, "base_congestion": 0.70},
            {"from_station": "ST", "to_station": "BRC", "distance_km": 129.0, "scheduled_min": 80.0, "base_congestion": 0.65},
            {"from_station": "BRC", "to_station": "RTM", "distance_km": 261.0, "scheduled_min": 195.0, "base_congestion": 0.55},
            {"from_station": "RTM", "to_station": "KOTA", "distance_km": 266.0, "scheduled_min": 155.0, "base_congestion": 0.50},
            {"from_station": "KOTA", "to_station": "MTJ", "distance_km": 324.0, "scheduled_min": 195.0, "base_congestion": 0.55},
            {"from_station": "MTJ", "to_station": "NDLS", "distance_km": 143.0, "scheduled_min": 110.0, "base_congestion": 0.80},
        ],
    }
}


# ==============================================================================
# 2. ACTIVE SIMULATED TRAIN INSTANCE
# ==============================================================================

class SimulatedTrain:
    """
    Stateful object tracking the live physical movement of an active train journey.
    """

    def __init__(
        self,
        train_number: str = "12302",
        journey_id: Optional[str] = None,
        initial_delay_minutes: float = 0.0,
        start_time: Optional[datetime] = None,
    ):
        if train_number not in SIMULATION_ROUTES:
            train_number = "12302"

        self.route_data = SIMULATION_ROUTES[train_number]
        self.train_number = train_number
        self.journey_id = journey_id or f"J_{train_number}"
        self.train_name = self.route_data["train_name"]
        self.train_type = self.route_data["train_type"]
        self.priority = self.route_data["priority_level"]
        self.max_speed = self.route_data["max_speed_kmh"]
        self.cruise_speed = self.route_data["cruise_speed_kmh"]
        self.sections = self.route_data["sections"]

        # Journey Progress Pointers
        self.current_section_idx = 0
        self.traversed_section_km = 0.0
        self.current_speed_kmh = 0.0
        self.current_delay_min = float(initial_delay_minutes)
        self.simulated_time = start_time or datetime.now(timezone.utc)
        self.is_stopped_at_station = False
        self.dwell_time_remaining_sec = 0.0
        self.is_completed = False
        self.weather_impact_flag = 0

    @property
    def current_section(self) -> Dict[str, Any]:
        if self.current_section_idx < len(self.sections):
            return self.sections[self.current_section_idx]
        return self.sections[-1]

    @property
    def current_station(self) -> str:
        return self.current_section["from_station"]

    @property
    def next_station(self) -> str:
        return self.current_section["to_station"]

    @property
    def section_distance_km(self) -> float:
        return float(self.current_section["distance_km"])

    @property
    def remaining_section_km(self) -> float:
        return max(0.0, self.section_distance_km - self.traversed_section_km)

    def inject_disruption(self, additional_delay_min: float, weather_fog: bool = False) -> None:
        """Allows injecting real-time operational incidents (e.g. Signal Failure, Fog)."""
        self.current_delay_min = max(0.0, self.current_delay_min + additional_delay_min)
        if weather_fog:
            self.weather_impact_flag = 1
        logger.info(f"[{self.train_number}] Injected disruption: +{additional_delay_min}m delay (Total: {self.current_delay_min}m)")

    def tick(self, elapsed_sim_seconds: float = 60.0) -> Dict[str, Any]:
        """
        Advances the train physics forward by `elapsed_sim_seconds` virtual time.
        """
        if self.is_completed:
            return self.get_state_snapshot("JOURNEY_COMPLETED")

        self.simulated_time += timedelta(seconds=elapsed_sim_seconds)
        sec = self.current_section
        dep_hour = self.simulated_time.hour

        # 1. Check if currently stopped at a station dwell
        if self.is_stopped_at_station:
            self.dwell_time_remaining_sec -= elapsed_sim_seconds
            self.current_speed_kmh = 0.0
            if self.dwell_time_remaining_sec <= 0:
                self.is_stopped_at_station = False
                self.current_section_idx += 1
                self.traversed_section_km = 0.0

                if self.current_section_idx >= len(self.sections):
                    self.is_completed = True
                    return self.get_state_snapshot("FINAL_DESTINATION_REACHED")
                return self.get_state_snapshot("STATION_DEPARTURE")
            return self.get_state_snapshot("DWELLING_AT_STATION")

        # 2. Dynamic Speed Computation
        base_speed = self.cruise_speed

        # A. Congestion slowdown (Peak hours 08-11, 17-21)
        is_peak = (8 <= dep_hour <= 11 or 17 <= dep_hour <= 21)
        congestion = sec.get("base_congestion", 0.50) + (0.15 if is_peak else 0.0)

        # B. Weather fog restriction
        if self.weather_impact_flag == 1:
            target_speed = min(65.0, base_speed * 0.60)
        else:
            speed_factor = 1.0 - (0.15 * congestion)
            target_speed = base_speed * speed_factor

        # C. Approach Deceleration when within 5 km of next station
        if self.remaining_section_km < 5.0:
            approach_pct = max(0.2, self.remaining_section_km / 5.0)
            target_speed = max(25.0, target_speed * approach_pct)

        # Smooth velocity transition
        self.current_speed_kmh = round(0.7 * self.current_speed_kmh + 0.3 * target_speed, 1)

        # 3. Advance Distance Traversed
        distance_covered_km = (self.current_speed_kmh * (elapsed_sim_seconds / 3600.0))
        self.traversed_section_km += distance_covered_km

        # 4. Realistic Delay Evolution
        # Timetable expected pace in km/s:
        expected_km_per_sec = (self.section_distance_km / (sec["scheduled_min"] * 60.0))
        actual_km_per_sec = distance_covered_km / max(1.0, elapsed_sim_seconds)

        # If running slower than timetable pace, accumulate delay; if faster, recover delay
        delta_delay_sec = (expected_km_per_sec - actual_km_per_sec) * (self.section_distance_km / max(0.1, actual_km_per_sec * 60))
        self.current_delay_min = max(0.0, round(self.current_delay_min + (delta_delay_sec / 3600.0), 1))

        # 5. Check Station Arrival
        if self.traversed_section_km >= self.section_distance_km:
            self.traversed_section_km = self.section_distance_km
            self.is_stopped_at_station = True
            self.dwell_time_remaining_sec = 180.0  # 3-minute station stop
            return self.get_state_snapshot("STATION_ARRIVAL")

        return self.get_state_snapshot("IN_TRANSIT")

    def get_state_snapshot(self, event_type: str = "IN_TRANSIT") -> Dict[str, Any]:
        """Returns canonical real-time state payload."""
        sec = self.current_section
        dep_hour = self.simulated_time.hour
        is_peak = 1 if (8 <= dep_hour <= 11 or 17 <= dep_hour <= 21) else 0

        return {
            "event_type": event_type,
            "journey_id": self.journey_id,
            "train_number": self.train_number,
            "train_name": self.train_name,
            "train_type": self.train_type,
            "timestamp": self.simulated_time.isoformat(),
            "status": "STOPPED" if self.is_stopped_at_station else ("COMPLETED" if self.is_completed else "IN_TRANSIT"),
            "current_station": self.current_station,
            "next_station": self.next_station,
            "speed_kmph": self.current_speed_kmh,
            "delay_minutes": self.current_delay_min,
            "section_progress": {
                "from_station": self.current_station,
                "to_station": self.next_station,
                "section_distance_km": self.section_distance_km,
                "traversed_km": round(self.traversed_section_km, 2),
                "remaining_km": round(self.remaining_section_km, 2),
                "progress_percentage": round((self.traversed_section_km / max(0.1, self.section_distance_km)) * 100.0, 1),
            },
            "operational_context": {
                "departure_hour": dep_hour,
                "day_of_week": self.simulated_time.weekday(),
                "is_peak_hours": is_peak,
                "section_congestion_level": sec.get("base_congestion", 0.55),
                "weather_impact_flag": self.weather_impact_flag,
            },
            "source": "SIMULATED",
        }


# ==============================================================================
# 3. SIMULATOR MANAGER & STREAMING INTERFACE
# ==============================================================================

class TrainSimulatorManager:
    """
    Manages active simulated trains, background polling loops, and event distribution.
    """

    def __init__(self):
        self.active_trains: Dict[str, SimulatedTrain] = {}
        self.listeners: List[Callable[[Dict[str, Any]], None]] = []
        self._is_running = False

    def start_train(
        self,
        train_number: str = "12302",
        journey_id: Optional[str] = None,
        initial_delay_minutes: float = 0.0,
    ) -> SimulatedTrain:
        """Starts or resets a simulated journey."""
        jid = journey_id or f"J_{train_number}"
        train = SimulatedTrain(
            train_number=train_number,
            journey_id=jid,
            initial_delay_minutes=initial_delay_minutes,
        )
        self.active_trains[jid] = train
        logger.info(f"Started simulated train {train_number} ({jid})")
        return train

    def get_train(self, journey_id: str) -> Optional[SimulatedTrain]:
        return self.active_trains.get(journey_id)

    def inject_disruption(self, journey_id: str, additional_delay_min: float, weather_fog: bool = False) -> bool:
        train = self.get_train(journey_id)
        if train:
            train.inject_disruption(additional_delay_min, weather_fog)
            return True
        return False

    async def stream_train_events(
        self,
        journey_id: str,
        tick_interval_sec: float = 1.0,
        speed_multiplier: float = 10.0,
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Asynchronous generator yielding live train status events periodically.
        Ideal for WebSocket broadcasts and SSE streaming.
        """
        train = self.get_train(journey_id)
        if not train:
            train = self.start_train(journey_id=journey_id)

        sim_seconds_per_tick = tick_interval_sec * speed_multiplier

        while not train.is_completed:
            event = train.tick(elapsed_sim_seconds=sim_seconds_per_tick)
            yield event
            await asyncio.sleep(tick_interval_sec)


# Global singleton simulator instance
simulator_manager = TrainSimulatorManager()
