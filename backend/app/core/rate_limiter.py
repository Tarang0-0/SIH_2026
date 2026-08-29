"""
RailETA — High-Throughput Token Bucket & Sliding Window Rate Limiter
Problem Statement 26028: Dynamic Forecast of ETA for Coaching Trains

Protects public API endpoints from denial-of-service, bot abuse, and excessive external API billing.
Uses in-memory thread-safe sliding window tracking with automatic TTL bucket cleanup.
"""

import time
import threading
from typing import Dict, List, Tuple
from fastapi import Request, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse, Response


class InMemoryRateLimiter:
    """
    Sliding window in-memory rate limiter per IP address with thread safety and automatic TTL eviction.
    """
    def __init__(self, default_limit: int = 300, window_seconds: int = 60):
        self.default_limit = default_limit
        self.window_seconds = window_seconds
        self.requests: Dict[str, List[float]] = {}
        self.lock = threading.Lock()
        self._last_cleanup = time.time()

    def is_allowed(self, client_ip: str, limit: int = None) -> Tuple[bool, int, int]:
        """
        Checks if client IP is within limit.
        Returns: (allowed: bool, remaining_requests: int, retry_after_seconds: int)
        """
        max_req = limit or self.default_limit
        now = time.time()
        cutoff = now - self.window_seconds
        
        with self.lock:
            # Self-healing periodic cleanup every 60s
            if now - self._last_cleanup > 60:
                self._cleanup_locked(now, cutoff)

            if client_ip not in self.requests:
                self.requests[client_ip] = [now]
                return True, max_req - 1, 0
            
            # Prune timestamps older than window
            timestamps = [ts for ts in self.requests[client_ip] if ts > cutoff]
            self.requests[client_ip] = timestamps
            
            if len(timestamps) >= max_req:
                oldest = timestamps[0]
                retry_after = int(max(1, self.window_seconds - (now - oldest)))
                return False, 0, retry_after
            
            self.requests[client_ip].append(now)
            remaining = max(0, max_req - len(self.requests[client_ip]))
            return True, remaining, 0

    def _cleanup_locked(self, now: float, cutoff: float):
        """Internal helper to prune stale IPs while holding the lock."""
        self._last_cleanup = now
        stale_ips = [ip for ip, ts in self.requests.items() if not ts or max(ts) <= cutoff]
        for ip in stale_ips:
            del self.requests[ip]

    def cleanup(self):
        """Prunes stale IP entries (external call)."""
        now = time.time()
        cutoff = now - self.window_seconds
        with self.lock:
            self._cleanup_locked(now, cutoff)


rate_limiter = InMemoryRateLimiter(default_limit=300, window_seconds=60)


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    FastAPI Middleware enforcing IP rate limits across all routes.
    Exempts static docs and health checks.
    """
    async def dispatch(self, request: Request, call_next) -> Response:
        path = request.url.path
        
        # Exempt health checks, docs, websocket handshakes, and root route
        if path in ["/health", "/api/v1/health", "/docs", "/openapi.json", "/redoc", "/"] or path.startswith("/ws"):
            return await call_next(request)
        
        client_ip = request.client.host if request.client else "127.0.0.1"
        
        # Generous limit for ML inference & simulation endpoints (120/min), standard 300/min for others
        limit = 120 if ("/eta" in path or "/simulate" in path or "/inject" in path) else 300
        
        allowed, remaining, retry_after = rate_limiter.is_allowed(client_ip, limit=limit)
        
        if not allowed:
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={
                    "error": "Rate limit exceeded",
                    "message": f"Too many requests. Please try again in {retry_after} seconds.",
                    "retry_after_seconds": retry_after
                },
                headers={
                    "Retry-After": str(retry_after),
                    "X-RateLimit-Limit": str(limit),
                    "X-RateLimit-Remaining": "0"
                }
            )
        
        response: Response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(limit)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        return response
