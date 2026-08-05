from app.core.config import Environment, Settings
from app.main import create_app
from fastapi.testclient import TestClient


def test_health_check() -> None:
    application = create_app(settings=Settings(_env_file=None, environment=Environment.TEST))
    response = TestClient(application).get(
        "/healthz", headers={"X-Request-ID": "health-test-request"}
    )

    assert response.status_code == 200
    assert response.json()["status"] == "healthy"
    assert response.headers["X-Request-ID"] == "health-test-request"
