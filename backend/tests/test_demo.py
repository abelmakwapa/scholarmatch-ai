"""
Tests for demo mode functionality.

These tests verify that demo mode works correctly and is properly isolated
from production authentication flows.
"""

import os
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.auth.models import ApplicationRole
from app.core.config import Environment, LogLevel, Settings
from app.demo import (
    configure_demo_mode,
    create_demo_settings,
    create_demo_user,
    is_demo_mode_enabled,
)
from app.main import create_app


class TestDemoModeConfiguration:
    """Test demo mode configuration and detection."""

    def test_demo_mode_disabled_by_default(self) -> None:
        """Demo mode should be disabled by default."""
        with patch.dict(os.environ, {}, clear=False):
            # Remove if present
            os.environ.pop("SCHOLARMATCH_DEMO_MODE", None)
            assert is_demo_mode_enabled() is False

    def test_demo_mode_enabled_with_true(self) -> None:
        """Demo mode should be enabled when set to 'true'."""
        with patch.dict(os.environ, {"SCHOLARMATCH_DEMO_MODE": "true"}, clear=False):
            assert is_demo_mode_enabled() is True

    def test_demo_mode_case_insensitive(self) -> None:
        """Demo mode should work with case-insensitive values."""
        for value in ["TRUE", "True", "tRuE"]:
            with patch.dict(os.environ, {"SCHOLARMATCH_DEMO_MODE": value}, clear=False):
                assert is_demo_mode_enabled() is True

    def test_demo_mode_disabled_with_false(self) -> None:
        """Demo mode should be disabled when set to 'false'."""
        for value in ["false", "FALSE", "False", "0", "no", ""]:
            with patch.dict(os.environ, {"SCHOLARMATCH_DEMO_MODE": value}, clear=False):
                assert is_demo_mode_enabled() is False

    def test_create_demo_user_default_role(self) -> None:
        """Demo user should have USER role by default."""
        user = create_demo_user()
        assert user.role == ApplicationRole.USER
        assert user.id is not None

    def test_create_demo_user_admin_role(self) -> None:
        """Demo user can be created with ADMIN role."""
        user = create_demo_user(ApplicationRole.ADMIN)
        assert user.role == ApplicationRole.ADMIN
        assert user.id is not None

    def test_demo_user_ids_are_unique(self) -> None:
        """Each demo user creation should generate a unique ID."""
        user1 = create_demo_user()
        user2 = create_demo_user()
        assert user1.id != user2.id


class TestDemoSettings:
    """Test demo settings configuration."""

    def test_create_demo_settings(self) -> None:
        """Demo settings should be valid and development-oriented."""
        settings = create_demo_settings()
        assert settings.environment == Environment.DEVELOPMENT
        assert settings.log_level == LogLevel.DEBUG
        assert "localhost" in settings.database_url.get_secret_value()
        assert "localhost" in settings.redis_url
        assert len(settings.cors_allowed_origins) > 0
        assert "*" not in settings.cors_allowed_origins

    def test_demo_settings_use_env_database_url(self) -> None:
        """Demo settings should respect DATABASE_URL environment variable."""
        custom_url = "postgresql://user:pass@custom-host:5432/custom_db"
        with patch.dict(os.environ, {"DATABASE_URL": custom_url}, clear=False):
            settings = create_demo_settings()
            assert custom_url in settings.database_url.get_secret_value()


class TestDemoEndpoints:
    """Test demo-specific endpoints."""

    @pytest.fixture
    def demo_client(self) -> TestClient:
        """Create a test client with demo mode enabled (no database)."""
        with patch.dict(os.environ, {"SCHOLARMATCH_DEMO_MODE": "true"}, clear=False):
            settings = Settings(
                environment=Environment.DEVELOPMENT,
                project_name="ScholarMatch (Demo Test)",
                log_level=LogLevel.DEBUG,
                database_url=None,
                redis_url=None,
                cors_allowed_origins=["http://localhost:3000"],
            )
            app = create_app(
                settings=settings,
                database=None,
                document_storage=None,
                work_queue=None,
            )
            configure_demo_mode(app)
            with TestClient(app, raise_server_exceptions=False) as client:
                yield client

    @pytest.fixture
    def normal_client(self) -> TestClient:
        """Create a test client with demo mode disabled (no database)."""
        with patch.dict(os.environ, {}, clear=False):
            os.environ.pop("SCHOLARMATCH_DEMO_MODE", None)
            settings = Settings(
                environment=Environment.DEVELOPMENT,
                project_name="ScholarMatch (Demo Test)",
                log_level=LogLevel.INFO,
                database_url=None,
                redis_url=None,
                cors_allowed_origins=["http://localhost:3000"],
            )
            app = create_app(
                settings=settings,
                database=None,
                document_storage=None,
                work_queue=None,
            )
            with TestClient(app, raise_server_exceptions=False) as client:
                yield client

    def test_demo_status_endpoint_enabled(self, demo_client: TestClient) -> None:
        """Demo status endpoint should return enabled status."""
        response = demo_client.get("/demo/status")
        assert response.status_code == 200
        data = response.json()
        assert data["demo_mode_enabled"] is True
        assert "warnings" in data
        assert len(data["warnings"]) > 0

    def test_demo_status_endpoint_disabled(self, normal_client: TestClient) -> None:
        """Demo status endpoint should return 404 when demo mode is off."""
        # When demo mode is disabled, demo endpoints are not registered
        response = normal_client.get("/demo/status")
        assert response.status_code == 404

    def test_demo_whoami_endpoint(self, demo_client: TestClient) -> None:
        """Demo whoami endpoint should return user context."""
        response = demo_client.get("/demo/whoami")
        assert response.status_code == 200
        data = response.json()
        assert data["demo_mode"] is True
        assert "user" in data
        assert data["user"]["role"] == "user"
        assert "admin_user" in data
        assert data["admin_user"]["role"] == "admin"

    def test_demo_whoami_disabled(self, normal_client: TestClient) -> None:
        """Demo whoami should return 404 when demo mode is disabled."""
        response = normal_client.get("/demo/whoami")
        assert response.status_code == 404

    def test_demo_reset_endpoint(self, demo_client: TestClient) -> None:
        """Demo reset endpoint should succeed."""
        response = demo_client.post("/demo/reset")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "reset_complete"

    def test_demo_reset_disabled(self, normal_client: TestClient) -> None:
        """Demo reset should return 404 when demo mode is disabled."""
        response = normal_client.post("/demo/reset")
        assert response.status_code == 404

    def test_demo_mode_response_header(self, demo_client: TestClient) -> None:
        """Demo mode responses should include X-Demo-Mode header."""
        response = demo_client.get("/demo/status")
        assert response.headers.get("X-Demo-Mode") == "enabled"


class TestDemoAuthenticationBypass:
    """Test that demo mode properly bypasses authentication."""

    @pytest.fixture
    def demo_client(self) -> TestClient:
        """Create a test client with demo mode enabled (no database)."""
        with patch.dict(os.environ, {"SCHOLARMATCH_DEMO_MODE": "true"}, clear=False):
            settings = Settings(
                environment=Environment.DEVELOPMENT,
                project_name="ScholarMatch (Demo Test)",
                log_level=LogLevel.DEBUG,
                database_url=None,
                redis_url=None,
                cors_allowed_origins=["http://localhost:3000"],
            )
            app = create_app(
                settings=settings,
                database=None,
                document_storage=None,
                work_queue=None,
            )
            configure_demo_mode(app)
            with TestClient(app, raise_server_exceptions=False) as client:
                yield client

    def test_protected_endpoint_without_auth_in_demo_mode(self, demo_client: TestClient) -> None:
        """Protected endpoints should accept requests without auth in demo mode."""
        # Demo whoami endpoint works without any Authorization header
        response = demo_client.get("/demo/whoami")
        assert response.status_code == 200
        data = response.json()
        assert data["demo_mode"] is True
        assert data["user"]["id"] is not None

    def test_auth_header_takes_precedence_over_demo(self, demo_client: TestClient) -> None:
        """Real auth headers should take precedence over demo mode."""
        # When a real Authorization header is provided, demo mode won't inject users
        # The request will try to validate the token (and fail with invalid token)
        response = demo_client.get(
            "/demo/whoami",
            headers={"Authorization": "Bearer fake-token-for-testing"}
        )
        # Should fail auth validation since it's a fake token
        assert response.status_code == 401


class TestDemoSecurity:
    """Test demo mode security boundaries."""

    def test_demo_mode_not_exposed_in_normal_responses(self) -> None:
        """Normal API responses should not expose demo mode details."""
        with patch.dict(os.environ, {}, clear=False):
            os.environ.pop("SCHOLARMATCH_DEMO_MODE", None)
            settings = Settings(
                environment=Environment.DEVELOPMENT,
                project_name="ScholarMatch (Demo Test)",
                log_level=LogLevel.INFO,
                database_url=None,
                redis_url=None,
                cors_allowed_origins=["http://localhost:3000"],
            )
            app = create_app(
                settings=settings,
                database=None,
                document_storage=None,
                work_queue=None,
            )
            with TestClient(app, raise_server_exceptions=False) as client:
                response = client.get("/healthz")
                assert response.status_code == 200
                assert "X-Demo-Mode" not in response.headers

    def test_demo_warnings_included_when_enabled(self) -> None:
        """Demo mode should include security warnings."""
        with patch.dict(os.environ, {"SCHOLARMATCH_DEMO_MODE": "true"}, clear=False):
            settings = Settings(
                environment=Environment.DEVELOPMENT,
                project_name="ScholarMatch (Demo Test)",
                log_level=LogLevel.DEBUG,
                database_url=None,
                redis_url=None,
                cors_allowed_origins=["http://localhost:3000"],
            )
            app = create_app(
                settings=settings,
                database=None,
                document_storage=None,
                work_queue=None,
            )
            configure_demo_mode(app)
            with TestClient(app, raise_server_exceptions=False) as client:
                response = client.get("/demo/status")
                data = response.json()
                warnings = data["warnings"]
                assert any("bypass" in w.lower() for w in warnings)
                assert any("production" in w.lower() for w in warnings)
