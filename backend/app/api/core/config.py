from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

ENV_FILE = Path(__file__).resolve().parents[2] / ".env"


class Settings(BaseSettings):
    PROJECT_NAME: str = "ScholarMatch AI API"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = "development"

    # Infrastructure
    SUPABASE_URL: str
    SUPABASE_ANON_KEY: str
    SUPABASE_SERVICE_ROLE_KEY: str
    REDIS_URL: str = "redis://localhost:6379/0"

    # AI Engine
    QWEN_API_KEY: str
    QWEN_API_URL: str = (
        "https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/text-generation/generation"
    )

    # Security
    CORS_ORIGINS: list[str] = ["http://localhost:3000"]

    model_config = SettingsConfigDict(env_file=ENV_FILE, case_sensitive=True)


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
