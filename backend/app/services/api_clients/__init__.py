"""
RailETA — External API & Dataset Clients Package
"""

from typing import Optional
from app.services.api_clients.railradar_client import RailRadarClient
from app.services.api_clients.historical_client import HistoricalDataClient

_railradar_client_instance: Optional[RailRadarClient] = None
_historical_client_instance: Optional[HistoricalDataClient] = None


def get_railradar_client() -> RailRadarClient:
    """Returns singleton RailRadar API Client."""
    global _railradar_client_instance
    if _railradar_client_instance is None:
        _railradar_client_instance = RailRadarClient()
    return _railradar_client_instance


def get_historical_client() -> HistoricalDataClient:
    """Returns singleton Historical Dataset Client."""
    global _historical_client_instance
    if _historical_client_instance is None:
        _historical_client_instance = HistoricalDataClient()
    return _historical_client_instance

__all__ = [
    "RailRadarClient",
    "HistoricalDataClient",
    "get_railradar_client",
    "get_historical_client",
]
