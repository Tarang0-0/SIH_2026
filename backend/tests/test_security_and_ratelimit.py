import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.security import verify_admin_credentials, ADMIN_SESSION_TOKEN
from app.core.rate_limiter import rate_limiter

client = TestClient(app)

def test_security_http_headers_present():
    """Verify that OWASP-recommended security headers are attached to API responses."""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.headers.get("X-Frame-Options") == "DENY"
    assert response.headers.get("X-Content-Type-Options") == "nosniff"
    assert response.headers.get("X-XSS-Protection") == "1; mode=block"
    assert "strict-origin-when-cross-origin" in response.headers.get("Referrer-Policy", "")

def test_admin_authentication_success():
    """Verify that valid admin credentials generate a valid secure session token."""
    response = client.post("/api/v1/auth/admin-login", json={
        "username": "admin",
        "password": "admin2026"
    })
    assert response.status_code == 200
    data = response.json()
    assert data["authenticated"] is True
    assert "access_token" in data
    assert data["token_type"] == "Bearer"

def test_admin_authentication_invalid_credentials():
    """Verify that invalid credentials are rejected with 401 Unauthorized."""
    response = client.post("/api/v1/auth/admin-login", json={
        "username": "admin",
        "password": "wrongpassword"
    })
    assert response.status_code == 401
    assert "detail" in response.json()

def test_rate_limiter_rate_limit_headers():
    """Verify that rate limit headers are included in API responses."""
    response = client.get("/api/v1/trains")
    assert response.status_code == 200
    assert "X-RateLimit-Limit" in response.headers
    assert "X-RateLimit-Remaining" in response.headers

def test_rate_limiter_blocks_excessive_traffic():
    """Verify that excessive traffic on a specific IP receives 429 Too Many Requests."""
    test_ip = "192.168.100.50"
    
    # Fill up the token bucket for test_ip
    for _ in range(60):
        rate_limiter.is_allowed(test_ip, limit=60)
        
    allowed, remaining, retry_after = rate_limiter.is_allowed(test_ip, limit=60)
    assert allowed is False
    assert remaining == 0
    assert retry_after > 0
