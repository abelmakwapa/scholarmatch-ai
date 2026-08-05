from app.core.config import Environment, Settings
from app.main import create_app
from fastapi import FastAPI
from fastapi.testclient import TestClient


def test_validation_errors_use_sanitized_stable_envelope() -> None:
    application = create_app(settings=Settings(_env_file=None, environment=Environment.TEST))

    @application.get("/_test/items/{item_id}")
    async def validated_route(item_id: int) -> dict[str, int]:
        return {"item_id": item_id}

    response = TestClient(application).get("/_test/items/not-an-integer")
    payload = response.json()

    assert response.status_code == 422
    assert payload["error"]["code"] == "VALIDATION_ERROR"
    assert payload["error"]["message"] == "The request failed validation."
    assert payload["error"]["details"] == [
        {
            "code": "int_parsing",
            "field": "path.item_id",
            "message": "Invalid value.",
        }
    ]
    assert payload["error"]["request_id"] == response.headers["X-Request-ID"]
    assert "not-an-integer" not in response.text


def test_unexpected_exceptions_do_not_expose_internal_details() -> None:
    application: FastAPI = create_app(
        settings=Settings(_env_file=None, environment=Environment.TEST)
    )

    @application.get("/_test/explode")
    async def exploding_route() -> None:
        raise RuntimeError("SUPABASE_SERVICE_ROLE_KEY=do-not-expose")

    response = TestClient(application, raise_server_exceptions=False).get("/_test/explode")

    assert response.status_code == 500
    assert response.json()["error"]["code"] == "INTERNAL_ERROR"
    assert response.json()["error"]["message"] == "An unexpected error occurred."
    assert response.json()["error"]["request_id"] == response.headers["X-Request-ID"]
    assert "do-not-expose" not in response.text
    assert "Traceback" not in response.text


def test_not_found_uses_the_stable_error_envelope() -> None:
    application = create_app(settings=Settings(_env_file=None, environment=Environment.TEST))

    response = TestClient(application).get("/does-not-exist")

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "HTTP_404"
    assert response.json()["error"]["message"] == "Not Found"
    assert response.json()["error"]["request_id"] == response.headers["X-Request-ID"]
