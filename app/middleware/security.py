"""
Security middleware and utilities for ScholarMatch.
Implements rate limiting, SSRF protection, input sanitization, and secure headers.
"""
import re
import html
from typing import List, Optional, Dict, Any, Set
from urllib.parse import urlparse
from fastapi import Request, HTTPException, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
import redis.asyncio as redis

from app.config import settings

# Allowed outbound URLs for source fetching
ALLOWED_URL_SCHEMES = {"https"}
ALLOWED_URL_HOSTS = {
    "scholarships.org",
    "edu",
    "gov",
    "nonprofit.org"
}
BLOCKED_IP_RANGES = [
    "10.0.0.0/8",
    "172.16.0.0/12",
    "192.168.0.0/16",
    "127.0.0.0/8",
    "0.0.0.0/8",
    "169.254.0.0/16"  # Link-local
]

class RateLimitMiddleware(BaseHTTPMiddleware):
    """Redis-backed rate limiting for sensitive routes."""
    
    def __init__(self, app, redis_url: str = "redis://localhost"):
        super().__init__(app)
        self.redis = redis.from_url(redis_url)
        # Buckets: auth, ai, upload, ingestion, recalculation
        self.limits = {
            "auth": {"requests": 10, "window": 60},
            "ai": {"requests": 30, "window": 60},
            "upload": {"requests": 20, "window": 60},
            "ingestion": {"requests": 5, "window": 60},
            "recalculation": {"requests": 10, "window": 60},
            "default": {"requests": 100, "window": 60}
        }
    
    async def dispatch(self, request: Request, call_next):
        bucket = self._get_bucket(request)
        client_ip = request.client.host if request.client else "unknown"
        key = f"ratelimit:{bucket}:{client_ip}"
        
        limit_config = self.limits.get(bucket, self.limits["default"])
        window = limit_config["window"]
        max_requests = limit_config["requests"]
        
        current = await self.redis.incr(key)
        if current == 1:
            await self.redis.expire(key, window)
            
        if current > max_requests:
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={"error": "Rate limit exceeded", "bucket": bucket}
            )
            
        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(max_requests)
        response.headers["X-RateLimit-Remaining"] = str(max(0, max_requests - current))
        return response
    
    def _get_bucket(self, request: Request) -> str:
        path = request.url.path
        if "/auth" in path or "/login" in path:
            return "auth"
        if "/embed" in path or "/explain" in path or "/qwen" in path:
            return "ai"
        if "/upload" in path:
            return "upload"
        if "/ingest" in path:
            return "ingestion"
        if "/recalculate" in path or "/match" in path:
            return "recalculation"
        return "default"

def is_safe_url(url: str) -> bool:
    """Validate URL against allowlist and SSRF protections."""
    try:
        parsed = urlparse(url)
    except Exception:
        return False
        
    if parsed.scheme not in ALLOWED_URL_SCHEMES:
        return False
        
    hostname = parsed.hostname
    if not hostname:
        return False
        
    # Check against blocked IP ranges (simplified check)
    # In production, resolve DNS and check IPs
    if hostname.startswith("10.") or hostname.startswith("192.168.") or hostname.startswith("127."):
        return False
        
    # Allow edu/gov domains or explicit allowlist
    if hostname.endswith(".edu") or hostname.endswith(".gov"):
        return True
        
    return hostname in ALLOWED_URL_HOSTS

def sanitize_html(content: str) -> str:
    """Sanitize imported HTML/text to prevent XSS."""
    # Escape all HTML entities
    safe = html.escape(content)
    # Remove script-like patterns aggressively
    safe = re.sub(r'<script.*?>.*?</script>', '', safe, flags=re.IGNORECASE | re.DOTALL)
    safe = re.sub(r'on\w+=".*?"', '', safe, flags=re.IGNORECASE)
    return safe

def sanitize_spreadsheet_cell(value: str) -> str:
    """Prevent formula injection in spreadsheet exports."""
    if not value:
        return value
    # Prefix dangerous starting characters
    if value.startswith(('=', '+', '-', '@')):
        return "'" + value
    return value

async def security_headers_middleware(request: Request, call_next):
    """Add secure headers to responses."""
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["Content-Security-Policy"] = "default-src 'self'"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response

def validate_request_size(content: bytes, max_size_mb: int = 10) -> None:
    """Enforce request size limits."""
    max_bytes = max_size_mb * 1024 * 1024
    if len(content) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_PAYLOAD_TOO_LARGE,
            detail=f"Payload exceeds {max_size_mb}MB limit"
        )

def get_cors_origins() -> List[str]:
    """Return strict CORS origins from config."""
    if settings.CORS_ORIGINS:
        return settings.CORS_ORIGINS.split(",")
    return []
