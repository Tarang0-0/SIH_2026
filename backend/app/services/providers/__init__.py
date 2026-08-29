"""
RailETA — Data Provider Registry & Factory
"""

from typing import Optional
from app.services.providers.base import BaseTrainDataProvider
from app.services.providers.historical import HistoricalTrainDataProvider
from app.services.providers.railradar import RailRadarTrainDataProvider

_provider_instance: Optional[BaseTrainDataProvider] = None

def get_train_data_provider() -> BaseTrainDataProvider:
    """
    Returns the active singleton BaseTrainDataProvider.
    Uses RailRadar with graceful local fallback.
    """
    global _provider_instance
    if _provider_instance is None:
        _provider_instance = RailRadarTrainDataProvider()
    return _provider_instance

