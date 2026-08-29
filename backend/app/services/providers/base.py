"""
RailETA — Abstract Base Train Data Provider Interface
Problem Statement 26028: Dynamic Forecast of ETA for Coaching Trains

Decouples the ETA forecasting engine, REST endpoints, and WebSocket streaming
from specific underlying data sources (Historical, Replay, or Live CRIS feeds).
"""

from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
from datetime import datetime

from app.schemas.event import CanonicalTrainEvent

class BaseTrainDataProvider(ABC):
    """
    Abstract interface for train data providers.
    All data access in RailETA must flow through this canonical provider boundary.
    """

    @abstractmethod
    async def get_active_trains(self) -> List[Dict[str, Any]]:
        """
        Retrieves the list of active trains in the network with current running state.
        Returns:
            List of dictionaries containing train summary and latest telemetry.
        """
        pass

    @abstractmethod
    async def get_route_topology(self, train_number: str) -> List[Dict[str, Any]]:
        """
        Retrieves the ordered sequence of stations, timetable schedules, and distances
        for a specific train route.
        """
        pass

    @abstractmethod
    async def get_latest_running_state(self, journey_id: str) -> Optional[Dict[str, Any]]:
        """
        Retrieves the active running telemetry (current station, delay, speed, coordinates)
        for an active journey.
        """
        pass

    @abstractmethod
    async def search_trains(self, query: str) -> List[Dict[str, Any]]:
        """
        Searches trains by train number, train name, or station code.
        """
        pass

    @abstractmethod
    async def update_running_state(self, event: CanonicalTrainEvent) -> bool:
        """
        Updates the journey running state upon receipt of a validated telemetry event.
        """
        pass

    @abstractmethod
    def get_data_source_mode(self) -> str:
        """
        Returns the data provenance classification: REAL, SIMULATED, SYNTHETIC, or DERIVED.
        """
        pass
