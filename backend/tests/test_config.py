import pytest
from app.core.config import ConfigurationError, Environment, Settings, get_settings
from pydantic import ValidationError


@pytest.mark.parametrize(
    "origins",
    [
        [],
        ["*"],
        ["https://example.com/path"],
        ["https://example.com", "https://example.com/"],
    ],
)
def test_cors_configuration_rejects_unsafe_origins(origins: list[str]) -> None:
    with pytest.raises(ValidationError):
        Settings(_env_file=None, cors_allowed_origins=origins)


def test_production_cors_requires_https() -> None:
    with pytest.raises(ValidationError):
        Settings(
            _env_file=None,
            environment=Environment.PRODUCTION,
            cors_allowed_origins=["http://app.example.com"],
        )


def test_startup_configuration_error_does_not_echo_invalid_value(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    unsafe_value = "https://user:do-not-print@example.com"
    monkeypatch.setenv("SUPABASE_URL", unsafe_value)
    get_settings.cache_clear()

    with pytest.raises(ConfigurationError) as caught:
        get_settings()

    assert unsafe_value not in str(caught.value)
    assert "do-not-print" not in str(caught.value)
    get_settings.cache_clear()


def test_database_url_validation_does_not_expose_credentials(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    unsafe_value = "mysql://database-user:database-secret@example.com/scholarmatch"
    monkeypatch.setenv("DATABASE_URL", unsafe_value)
    get_settings.cache_clear()

    with pytest.raises(ConfigurationError) as caught:
        get_settings()

    assert unsafe_value not in str(caught.value)
    assert "database-secret" not in str(caught.value)
    assert "database_url" in str(caught.value)
    get_settings.cache_clear()
