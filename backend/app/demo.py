"""
Demo utilities for local development and testing.

This module provides authentication bypass mechanisms for local development only.
NEVER enable these in production or staging environments.

Usage:
    # Set environment variable to enable demo mode
    export SCHOLARMATCH_DEMO_MODE=true
    
    # Run the backend with demo mode enabled
    cd /workspace/backend
    uvicorn app.main:app --reload --env-file .env.development

    # Or use the demo script directly
    python -m app.demo
"""

import os
from datetime import UTC, datetime, timedelta
from uuid import uuid4

from fastapi import FastAPI, Request, Response
from fastapi.responses import JSONResponse

from app.auth.models import ApplicationRole, CurrentUser
from app.core.config import Environment, LogLevel, Settings


def is_demo_mode_enabled() -> bool:
    """Check if demo mode is enabled via environment variable."""
    return os.getenv("SCHOLARMATCH_DEMO_MODE", "false").lower() == "true"


def create_demo_user(role: ApplicationRole = ApplicationRole.USER) -> CurrentUser:
    """Create a demo user for testing purposes."""
    return CurrentUser(
        id=uuid4(),
        role=role,
    )


async def demo_auth_middleware(request: Request, call_next):
    """
    Demo authentication middleware that bypasses JWT verification.
    
    When SCHOLARMATCH_DEMO_MODE=true, this middleware injects a fake authenticated
    user into the request state, allowing API access without valid tokens.
    
    SECURITY WARNING: This must NEVER be enabled in production.
    """
    if not is_demo_mode_enabled():
        return await call_next(request)
    
    # Check if request already has auth header (prefer real auth if provided)
    auth_header = request.headers.get("Authorization")
    if auth_header:
        return await call_next(request)
    
    # Inject demo user into request state
    # The get_current_user dependency will check request.state.demo_user
    request.state.demo_user = create_demo_user(ApplicationRole.USER)
    
    # Allow admin routes too by default in demo mode
    request.state.demo_admin_user = create_demo_user(ApplicationRole.ADMIN)
    
    response = await call_next(request)
    response.headers["X-Demo-Mode"] = "enabled"
    return response


def setup_demo_endpoints(app: FastAPI) -> None:
    """Add demo-specific endpoints for testing."""
    
    @app.get("/demo/whoami", tags=["Demo"])
    async def demo_whoami(request: Request) -> JSONResponse:
        """Return the current demo user context."""
        if not is_demo_mode_enabled():
            return JSONResponse(
                status_code=400,
                content={"error": "Demo mode is not enabled. Set SCHOLARMATCH_DEMO_MODE=true"}
            )
        
        user = getattr(request.state, "demo_user", None)
        admin_user = getattr(request.state, "demo_admin_user", None)
        
        return JSONResponse(content={
            "demo_mode": True,
            "user": {
                "id": str(user.id) if user else None,
                "role": user.role.value if user else None,
            },
            "admin_user": {
                "id": str(admin_user.id) if admin_user else None,
                "role": admin_user.role.value if admin_user else None,
            },
            "message": "Demo mode is active. All API calls are authenticated as demo users."
        })
    
    @app.get("/demo/status", tags=["Demo"])
    async def demo_status() -> JSONResponse:
        """Return demo mode status and configuration."""
        return JSONResponse(content={
            "demo_mode_enabled": is_demo_mode_enabled(),
            "environment": os.getenv("SCHOLARMATCH_ENVIRONMENT", "development"),
            "warnings": [
                "Demo mode bypasses authentication",
                "Do not use with production data",
                "Disable before deploying to staging/production"
            ] if is_demo_mode_enabled() else []
        })
    
    @app.post("/demo/reset", tags=["Demo"])
    async def demo_reset() -> JSONResponse:
        """
        Reset demo state (placeholder for future cleanup operations).
        
        In demo mode, you can call this to clear any cached test data.
        Currently a no-op but reserved for future use.
        """
        if not is_demo_mode_enabled():
            return JSONResponse(
                status_code=400,
                content={"error": "Demo mode is not enabled"}
            )
        
        return JSONResponse(content={
            "status": "reset_complete",
            "message": "Demo state has been reset (no persistent data to clear)"
        })


def configure_demo_mode(app: FastAPI) -> None:
    """
    Configure the FastAPI app for demo mode.
    
    Call this after creating the app but before including routers.
    """
    if is_demo_mode_enabled():
        # Add demo auth middleware early in the chain
        app.middleware("http")(demo_auth_middleware)
        
        # Add demo endpoints
        setup_demo_endpoints(app)
        
        # Override JWT verifier requirement in demo mode
        # This allows routes to work without real JWT tokens
        app.state.demo_mode_active = True


def create_demo_settings() -> Settings:
    """Create settings optimized for demo/local development."""
    return Settings(
        environment=Environment.DEVELOPMENT,
        project_name="ScholarMatch (Demo)",
        log_level=LogLevel.DEBUG,
        # Use local/test database
        database_url=os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/scholarmatch_demo"),
        # Disable external dependencies in demo mode
        redis_url=os.getenv("REDIS_URL", "redis://localhost:6379/0"),
        # Demo-friendly CORS (must be explicit origins, not wildcard)
        cors_allowed_origins=["http://localhost:3000", "http://localhost:8000"],
        # Shorter timeouts for local testing
        jwks_cache_ttl_seconds=60,
        jwks_max_stale_seconds=120,
    )


if __name__ == "__main__":
    import uvicorn
    
    print("=" * 60)
    print("ScholarMatch Demo Mode")
    print("=" * 60)
    print()
    
    if is_demo_mode_enabled():
        print("✓ Demo mode is ENABLED")
        print("  - Authentication is bypassed")
        print("  - Demo user injected automatically")
        print("  - Visit /demo/whoami to see current user context")
        print()
        print("⚠️  WARNING: Do not use in production!")
        print()
    else:
        print("✗ Demo mode is DISABLED")
        print("  Set SCHOLARMATCH_DEMO_MODE=true to enable")
        print()
    
    print("Starting server...")
    print("  API docs: http://localhost:8000/docs")
    print("  Demo status: http://localhost:8000/demo/status")
    print("  Demo whoami: http://localhost:8000/demo/whoami")
    print("=" * 60)
    
    # Import and run the app
    from app.main import create_app
    
    app = create_app(settings=create_demo_settings())
    configure_demo_mode(app)
    
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
