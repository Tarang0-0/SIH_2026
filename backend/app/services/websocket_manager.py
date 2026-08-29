import json
import logging
import asyncio
import threading
from typing import Dict, List, Set, Any, Optional
from fastapi import WebSocket

logger = logging.getLogger("raileta.websocket")

class ConnectionManager:
    """
    Manages active WebSocket client connections for real-time train ETA broadcasting.
    Supports journey-specific subscriptions and global stream subscriptions.
    Thread-safe and async-safe connection pool management under concurrent load.
    """
    def __init__(self):
        # journey_id -> set of WebSockets
        self.active_journey_connections: Dict[str, Set[WebSocket]] = {}
        # Global stream WebSockets (receives all trains updates)
        self.global_connections: Set[WebSocket] = set()
        # Main server event loop reference for cross-thread dispatching
        self.main_loop: Optional[asyncio.AbstractEventLoop] = None
        # Thread lock protecting dictionary and set mutations
        self._lock = threading.Lock()

    def set_event_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        """Store the primary server event loop."""
        self.main_loop = loop

    async def connect(self, websocket: WebSocket, journey_id: str = "global") -> None:
        """Accepts and registers a new WebSocket client (thread-safe)."""
        await websocket.accept()
        # Capture the current running event loop if not set
        if self.main_loop is None or self.main_loop.is_closed():
            try:
                self.main_loop = asyncio.get_running_loop()
            except RuntimeError:
                pass

        with self._lock:
            if journey_id in ("global", "live-stream"):
                self.global_connections.add(websocket)
                logger.info(f"WebSocket client connected to global stream (total: {len(self.global_connections)})")
            else:
                if journey_id not in self.active_journey_connections:
                    self.active_journey_connections[journey_id] = set()
                self.active_journey_connections[journey_id].add(websocket)
                logger.info(f"WebSocket client connected to journey '{journey_id}' (total: {len(self.active_journey_connections[journey_id])})")

    def disconnect(self, websocket: WebSocket, journey_id: str = "global") -> None:
        """Removes a disconnected WebSocket client (thread-safe, sync callable)."""
        with self._lock:
            if journey_id in ("global", "live-stream"):
                self.global_connections.discard(websocket)
                logger.info(f"WebSocket client disconnected from global stream (remaining: {len(self.global_connections)})")
            else:
                if journey_id in self.active_journey_connections:
                    self.active_journey_connections[journey_id].discard(websocket)
                    if not self.active_journey_connections[journey_id]:
                        del self.active_journey_connections[journey_id]
                    logger.info(f"WebSocket client disconnected from journey '{journey_id}'")

    async def broadcast_to_journey(self, journey_id: str, message: Dict[str, Any]) -> None:
        """Broadcasts prediction payload to clients subscribed to a specific journey and the global stream."""
        data_str = json.dumps(message, default=str)
        
        target_sockets = []
        with self._lock:
            if journey_id in self.active_journey_connections:
                target_sockets = list(self.active_journey_connections[journey_id])

        dead_sockets: Set[WebSocket] = set()
        for connection in target_sockets:
            try:
                await connection.send_text(data_str)
            except Exception as e:
                logger.warning(f"Error sending message to client on journey {journey_id}: {e}")
                dead_sockets.add(connection)

        if dead_sockets:
            with self._lock:
                if journey_id in self.active_journey_connections:
                    for dead in dead_sockets:
                        self.active_journey_connections[journey_id].discard(dead)

        # Also broadcast to global stream subscribers
        await self.broadcast_global(message)

    async def broadcast_global(self, message: Dict[str, Any]) -> None:
        """Broadcasts message to all clients connected to the global stream."""
        with self._lock:
            if not self.global_connections:
                return
            global_sockets = list(self.global_connections)
            
        data_str = json.dumps(message, default=str)
        dead_sockets: Set[WebSocket] = set()
        for connection in global_sockets:
            try:
                await connection.send_text(data_str)
            except Exception as e:
                logger.warning(f"Error broadcasting to global client: {e}")
                dead_sockets.add(connection)
                
        if dead_sockets:
            with self._lock:
                for dead in dead_sockets:
                    self.global_connections.discard(dead)

    def sync_broadcast(self, journey_id: str, message: Dict[str, Any]) -> None:
        """
        Thread-safe broadcast helper for synchronous contexts or worker threads.
        Dispatches coroutine to the main server loop if active.
        """
        if self.main_loop is not None and self.main_loop.is_running():
            asyncio.run_coroutine_threadsafe(self.broadcast_to_journey(journey_id, message), self.main_loop)
            return

        try:
            loop = asyncio.get_running_loop()
            asyncio.create_task(self.broadcast_to_journey(journey_id, message))
        except RuntimeError:
            try:
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    asyncio.create_task(self.broadcast_to_journey(journey_id, message))
                else:
                    loop.run_until_complete(self.broadcast_to_journey(journey_id, message))
            except Exception as e:
                logger.warning(f"Unable to sync_broadcast: {e}")

# Global singleton connection manager
ws_manager = ConnectionManager()
