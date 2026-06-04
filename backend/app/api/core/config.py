from pydantic_settings import BaseSettings, SettinsConfigDict
from functools import lru_cache

class Settings(BaseSettings):
    PROJECT_NAME: str = "ScholarMatch AI API"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = "developments"

    # Infrastructure
    SUPABASE_URL: str
    SUPABASE_KEY: str

    # AI Engine
    QWEN_API_KEY: str
    QWEN_API_URL: str = "https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/text-generation/generation"

    # Security
    CORS_ORIGINS: list[str] = ["http://localhost:3000"]

    model_config= SettinsConfigDict(env_file=".env", case_sensitive=True)

@lru_cache()
def get_settings():
    return Settings()

settings = get_settings 