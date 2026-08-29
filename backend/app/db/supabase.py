import logging
from typing import Optional
from supabase import create_client, Client
from app.core.config import settings

logger = logging.getLogger("raileta.db")

class SupabaseClientManager:
    _client: Optional[Client] = None

    @classmethod
    def get_client(cls) -> Optional[Client]:
        if cls._client is None:
            try:
                if settings.SUPABASE_URL and "mock.supabase.co" not in settings.SUPABASE_URL:
                    cls._client = create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY)
                    logger.info("Connected to Supabase PostgreSQL.")
                else:
                    logger.warning("Supabase URL not configured or set to mock. Running in offline/mock database mode.")
                    cls._client = None
            except Exception as e:
                logger.error(f"Failed to initialize Supabase client: {e}")
                cls._client = None
        return cls._client

def get_db():
    return SupabaseClientManager.get_client()
