import os

os.environ.setdefault("SUPABASE_URL", "https://example.invalid")
os.environ.setdefault("SUPABASE_ANON_KEY", "test-public-value")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-server-value")
os.environ.setdefault("QWEN_API_KEY", "test-qwen-value")

from api.main import app  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402


def test_health_check() -> None:
    response = TestClient(app).get("/healthz")

    assert response.status_code == 200
    assert response.json()["status"] == "healthy"
    assert response.headers["X-Request-ID"]
