"""Server-side authentication for operator and model-administration routes."""

from __future__ import annotations

import base64
import hashlib
import hmac
import os
import secrets
import time
from typing import Optional

from fastapi import Header, HTTPException


SESSION_TTL_SECONDS = 3600


def _secret() -> str:
    return os.getenv("RAILPULSE_ADMIN_TOKEN", "").strip()


def extract_token(authorization: Optional[str], x_admin_token: Optional[str]) -> str:
    if x_admin_token and x_admin_token.strip():
        return x_admin_token.strip()
    if authorization:
        scheme, _, value = authorization.partition(" ")
        if scheme.lower() == "bearer":
            return value.strip()
    return ""


def issue_session_token() -> str:
    secret = _secret()
    if not secret:
        raise RuntimeError("RAILPULSE_ADMIN_TOKEN is not configured")
    expires = int(time.time()) + SESSION_TTL_SECONDS
    payload = f"railtrackr-admin:{expires}:{secrets.token_urlsafe(18)}"
    signature = hmac.new(secret.encode(), payload.encode(), hashlib.sha256).hexdigest()
    encoded = base64.urlsafe_b64encode(f"{payload}.{signature}".encode()).decode().rstrip("=")
    return encoded


def token_is_valid(token: str) -> bool:
    secret = _secret()
    if not secret or not token:
        return False
    if hmac.compare_digest(token, secret):
        return True
    try:
        padded = token + "=" * (-len(token) % 4)
        decoded = base64.urlsafe_b64decode(padded.encode()).decode()
        payload, signature = decoded.rsplit(".", 1)
        prefix, expires_text, _nonce = payload.split(":", 2)
        if prefix != "railtrackr-admin" or int(expires_text) < int(time.time()):
            return False
        expected = hmac.new(secret.encode(), payload.encode(), hashlib.sha256).hexdigest()
        return hmac.compare_digest(signature, expected)
    except (ValueError, TypeError, UnicodeError):
        return False


def require_admin(
    authorization: Optional[str] = Header(default=None),
    x_admin_token: Optional[str] = Header(default=None),
) -> bool:
    if not _secret():
        raise HTTPException(
            status_code=503,
            detail="Admin operations are disabled until RAILPULSE_ADMIN_TOKEN is configured",
        )
    if not token_is_valid(extract_token(authorization, x_admin_token)):
        raise HTTPException(status_code=401, detail="Valid admin credentials are required")
    return True


def credentials_are_valid(username: str, password: str) -> bool:
    configured_username = os.getenv("RAILPULSE_ADMIN_USERNAME", "").strip()
    configured_password = os.getenv("RAILPULSE_ADMIN_PASSWORD", "")
    return bool(
        configured_username
        and configured_password
        and hmac.compare_digest(username, configured_username)
        and hmac.compare_digest(password, configured_password)
    )
