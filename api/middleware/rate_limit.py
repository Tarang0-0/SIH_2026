"""Lightweight, zero-dependency sliding window rate limiter middleware for FastAPI."""

from __future__ import annotations

import os
import time
from collections import defaultdict
from typing import Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response


class RateLimiterMiddleware(BaseHTTPMiddleware):
    """Protects endpoints from denial of service and API quota exhaustion."""

    def __init__(
        self,
        app,
        default_max_requests: int = 120,
        window_seconds: int = 60,
    ):
        super().__init__(app)
        self.default_max_requests = default_max_requests
        self.window_seconds = window_seconds
        self.requests: dict[str, list[float]] = defaultdict(list)

    def _max_requests(self) -> int:
        configured = os.getenv("RATE_LIMIT_PER_MINUTE", "").strip()
        if configured:
            try:
                return max(1, int(configured))
            except ValueError:
                pass
        return self.default_max_requests

    def _is_enabled(self) -> bool:
        return os.getenv("RATE_LIMIT_ENABLED", "true").strip().lower() not in {"false", "0", "no"}

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        path = request.url.path
        # Health check, documentation, and OpenAPI schemas are exempt
        if path in {"/health", "/docs", "/redoc", "/openapi.json"} or not self._is_enabled():
            return await call_next(request)

        trust_proxy_headers = os.getenv("RATE_LIMIT_TRUST_PROXY_HEADERS", "false").strip().lower() in {
            "1", "true", "yes", "on"
        }
        if trust_proxy_headers and request.headers.get("x-forwarded-for"):
            client_ip = request.headers["x-forwarded-for"].split(",")[0].strip()
        elif trust_proxy_headers and request.headers.get("cf-connecting-ip"):
            client_ip = request.headers["cf-connecting-ip"].strip()
        elif trust_proxy_headers and request.headers.get("x-real-ip"):
            client_ip = request.headers["x-real-ip"].strip()
        elif request.client:
            client_ip = request.client.host
        else:
            client_ip = "unknown"
        now = time.monotonic()
        window_start = now - self.window_seconds

        # Clean timestamps for current client
        timestamps = [t for t in self.requests[client_ip] if t > window_start]
        self.requests[client_ip] = timestamps

        # Periodic cleanup of idle IPs to prevent memory growth
        if len(self.requests) > 1000:
            for ip, ts in list(self.requests.items()):
                if not ts or ts[-1] <= window_start:
                    self.requests.pop(ip, None)

        max_limit = self._max_requests()
        if len(timestamps) >= max_limit:
            retry_after = int(self.window_seconds - (now - timestamps[0])) + 1
            return JSONResponse(
                status_code=429,
                content={
                    "detail": "Rate limit exceeded. Please try again later.",
                    "retry_after_seconds": max(1, retry_after),
                },
                headers={"Retry-After": str(max(1, retry_after))},
            )

        self.requests[client_ip].append(now)
        return await call_next(request)
