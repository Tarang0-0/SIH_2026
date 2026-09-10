"""Shared HTTP client with connection pooling and keep-alive for external services."""

from __future__ import annotations

import asyncio
from typing import Optional

import httpx

_client: Optional[httpx.AsyncClient] = None
_client_loop: Optional[asyncio.AbstractEventLoop] = None


def get_http_client(timeout: float = 15.0) -> httpx.AsyncClient:
    """Return a shared AsyncClient with connection pooling, bound to the current loop."""
    global _client, _client_loop
    current_loop = None
    try:
        current_loop = asyncio.get_running_loop()
    except RuntimeError:
        pass

    if _client is None or _client.is_closed or _client_loop != current_loop:
        _client = httpx.AsyncClient(
            timeout=httpx.Timeout(timeout, connect=5.0),
            follow_redirects=False,
            limits=httpx.Limits(max_keepalive_connections=20, max_connections=50),
        )
        _client_loop = current_loop
    return _client


async def close_http_client() -> None:
    """Close the shared AsyncClient if active."""
    global _client, _client_loop
    if _client is not None and not _client.is_closed:
        await _client.aclose()
    _client = None
    _client_loop = None
