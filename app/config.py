"""
Configuration settings for ScholarMatch.
"""
import os
from typing import List, Optional

class Settings:
    # Security
    SECRET_KEY: str = os.getenv("SECRET_KEY", "dev-secret-key-change-in-production")
    CORS_ORIGINS: str = os.getenv("CORS_ORIGINS", "https://scholarmatch.org")
    
    # Sentry/Observability
    SENTRY_DSN: Optional[str] = os.getenv("SENTRY_DSN")
    SENTRY_TRACES_SAMPLE_RATE: float = float(os.getenv("SENTRY_TRACES_SAMPLE_RATE", "0.1"))
    OTEL_ENABLED: bool = os.getenv("OTEL_ENABLED", "false").lower() == "true"
    
    # Redis
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    
    # Rate Limits
    RATE_LIMIT_AUTH: int = int(os.getenv("RATE_LIMIT_AUTH", "10"))
    RATE_LIMIT_AI: int = int(os.getenv("RATE_LIMIT_AI", "30"))
    RATE_LIMIT_UPLOAD: int = int(os.getenv("RATE_LIMIT_UPLOAD", "20"))
    
    # Request Limits
    MAX_REQUEST_SIZE_MB: int = int(os.getenv("MAX_REQUEST_SIZE_MB", "10"))
    
    # Celery
    CELERY_BROKER_URL: str = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/1")
    CELERY_RESULT_BACKEND: str = os.getenv("CELERY_RESULT_BACKEND", "redis://localhost:6379/1")
    
    # Email Provider
    EMAIL_PROVIDER_API_KEY: Optional[str] = os.getenv("EMAIL_PROVIDER_API_KEY")
    EMAIL_FROM_ADDRESS: str = os.getenv("EMAIL_FROM_ADDRESS", "noreply@scholarmatch.org")
    
    # AI/Embedding
    EMBEDDING_MODEL_NAME: str = os.getenv("EMBEDDING_MODEL_NAME", "text-embedding-3-small")
    QWEN_API_KEY: Optional[str] = os.getenv("QWEN_API_KEY")
    QWEN_TIMEOUT_SECONDS: int = int(os.getenv("QWEN_TIMEOUT_SECONDS", "30"))
    QWEN_MAX_RETRIES: int = int(os.getenv("QWEN_MAX_RETRIES", "3"))
    
    # Retention
    ACCOUNT_DELETION_GRACE_DAYS: int = int(os.getenv("ACCOUNT_DELETION_GRACE_DAYS", "30"))

settings = Settings()
