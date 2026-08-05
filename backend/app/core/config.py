from enum import StrEnum
from functools import lru_cache
from pathlib import Path
from urllib.parse import urlsplit

from pydantic import SecretStr, ValidationError, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic_settings.exceptions import SettingsError

ENV_FILE = Path(__file__).resolve().parents[1] / ".env"


class Environment(StrEnum):
    DEVELOPMENT = "development"
    TEST = "test"
    STAGING = "staging"
    PRODUCTION = "production"


class LogLevel(StrEnum):
    DEBUG = "DEBUG"
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"


class ConfigurationError(RuntimeError):
    """A sanitized startup error safe to display in process logs."""


class Settings(BaseSettings):
    project_name: str = "ScholarMatch AI API"
    api_v1_prefix: str = "/api/v1"
    environment: Environment = Environment.DEVELOPMENT
    log_level: LogLevel = LogLevel.INFO

    supabase_url: str | None = None
    supabase_anon_key: SecretStr | None = None
    supabase_service_role_key: SecretStr | None = None
    qwen_api_key: SecretStr | None = None
    qwen_api_url: str = (
        "https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/text-generation/generation"
    )
    redis_url: str | None = None

    cors_allowed_origins: list[str] = ["http://localhost:3000"]

    model_config = SettingsConfigDict(
        env_file=ENV_FILE,
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="forbid",
    )

    @field_validator(
        "supabase_url",
        "supabase_anon_key",
        "supabase_service_role_key",
        "qwen_api_key",
        "redis_url",
        mode="before",
    )
    @classmethod
    def blank_optional_value_is_none(cls, value: object) -> object:
        return None if value == "" else value

    @field_validator("project_name")
    @classmethod
    def validate_project_name(cls, value: str) -> str:
        value = value.strip()
        if not value or len(value) > 100:
            raise ValueError("must contain between 1 and 100 characters")
        return value

    @field_validator("api_v1_prefix")
    @classmethod
    def validate_api_prefix(cls, value: str) -> str:
        if not value.startswith("/") or value == "/" or value.endswith("/"):
            raise ValueError("must start with '/' and must not end with '/'")
        return value

    @field_validator("supabase_url", "qwen_api_url")
    @classmethod
    def validate_http_url(cls, value: str | None) -> str | None:
        if value is None:
            return None
        parsed = urlsplit(value)
        if parsed.scheme not in {"http", "https"} or not parsed.hostname:
            raise ValueError("must be an absolute HTTP(S) URL")
        if parsed.username or parsed.password or parsed.fragment:
            raise ValueError("must not contain user information or a fragment")
        return value.rstrip("/")

    @field_validator("redis_url")
    @classmethod
    def validate_redis_url(cls, value: str | None) -> str | None:
        if value is None:
            return None
        parsed = urlsplit(value)
        if parsed.scheme not in {"redis", "rediss"} or not parsed.hostname:
            raise ValueError("must be an absolute Redis URL")
        return value

    @field_validator("cors_allowed_origins")
    @classmethod
    def validate_cors_origins(cls, origins: list[str]) -> list[str]:
        if not origins:
            raise ValueError("must contain at least one origin")

        normalized: list[str] = []
        for origin in origins:
            if origin == "*":
                raise ValueError("wildcard origins are not allowed")
            parsed = urlsplit(origin)
            if (
                parsed.scheme not in {"http", "https"}
                or not parsed.hostname
                or parsed.username
                or parsed.password
                or parsed.query
                or parsed.fragment
                or parsed.path not in {"", "/"}
            ):
                raise ValueError("each origin must be an HTTP(S) origin without a path")
            normalized_origin = origin.rstrip("/")
            if normalized_origin in normalized:
                raise ValueError("duplicate origins are not allowed")
            normalized.append(normalized_origin)
        return normalized

    @model_validator(mode="after")
    def validate_environment_policy(self) -> "Settings":
        if self.environment in {Environment.STAGING, Environment.PRODUCTION} and any(
            origin.startswith("http://") for origin in self.cors_allowed_origins
        ):
            raise ValueError("staging and production CORS origins must use HTTPS")
        return self

    @property
    def openapi_enabled(self) -> bool:
        return self.environment is Environment.DEVELOPMENT


def _validation_fields(exc: ValidationError) -> str:
    fields = {".".join(str(part) for part in error["loc"]) or "settings" for error in exc.errors()}
    return ", ".join(sorted(fields))


@lru_cache
def get_settings() -> Settings:
    try:
        return Settings()
    except ValidationError as exc:
        fields = _validation_fields(exc)
        raise ConfigurationError(
            f"Application configuration is invalid. Check: {fields}."
        ) from None
    except SettingsError:
        raise ConfigurationError(
            "Application configuration is invalid. Check environment value formatting."
        ) from None
