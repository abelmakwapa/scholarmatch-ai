from collections.abc import Awaitable, Callable

from app.core.config import Environment, Settings
from app.main import create_app
from fastapi import FastAPI
from fastapi.testclient import TestClient


def make_settings(
    *,
    environment: Environment = Environment.TEST,
    origins: list[str] | None = None,
) -> Settings:
    return Settings(
        _env_file=None,
        environment=environment,
        cors_allowed_origins=origins or ["http://localhost:3000"],
    )


def test_application_factory_starts_with_conventional_import_root() -> None:
    application = create_app(settings=make_settings())

    assert isinstance(application, FastAPI)
    assert application.title == "ScholarMatch AI API"
    assert application.version == "0.1.0"


def test_openapi_is_available_only_in_development() -> None:
    development = TestClient(
        create_app(settings=make_settings(environment=Environment.DEVELOPMENT))
    )
    production = TestClient(
        create_app(
            settings=make_settings(
                environment=Environment.PRODUCTION,
                origins=["https://app.example.com"],
            )
        )
    )

    assert development.get("/docs").status_code == 200
    assert development.get("/openapi.json").status_code == 200
    assert production.get("/docs").status_code == 404
    assert production.get("/redoc").status_code == 404
    assert production.get("/openapi.json").status_code == 404


def test_readiness_reports_ready_dependencies() -> None:
    async def ready() -> bool:
        return True

    application = create_app(
        settings=make_settings(), readiness_checks={"database": ready, "queue": ready}
    )
    response = TestClient(application).get("/readyz")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ready",
        "checks": {"database": "ready", "queue": "ready"},
    }


def test_readiness_returns_stable_error_when_a_dependency_fails() -> None:
    async def unavailable() -> bool:
        return False

    async def broken() -> bool:
        raise RuntimeError("connection string with a secret")

    checks: dict[str, Callable[[], Awaitable[bool]]] = {
        "database": unavailable,
        "queue": broken,
    }
    application = create_app(settings=make_settings(), readiness_checks=checks)
    response = TestClient(application).get("/readyz")
    payload = response.json()

    assert response.status_code == 503
    assert payload["error"]["code"] == "NOT_READY"
    assert {detail["field"] for detail in payload["error"]["details"]} == {
        "database",
        "queue",
    }
    assert "secret" not in response.text


def test_cors_preflight_allows_only_configured_origin() -> None:
    client = TestClient(create_app(settings=make_settings()))
    headers = {
        "Access-Control-Request-Method": "GET",
        "Origin": "http://localhost:3000",
    }

    allowed = client.options("/healthz", headers=headers)
    denied = client.options("/healthz", headers={**headers, "Origin": "https://untrusted.example"})

    assert allowed.status_code == 200
    assert allowed.headers["access-control-allow-origin"] == "http://localhost:3000"
    assert denied.status_code == 400
    assert denied.json()["error"]["code"] == "CORS_REJECTED"
    assert denied.json()["error"]["request_id"] == denied.headers["X-Request-ID"]
    assert "access-control-allow-origin" not in denied.headers
