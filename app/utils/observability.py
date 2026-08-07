"""
Observability module for ScholarMatch.
Provides structured logging, tracing, and metrics instrumentation.
"""
import logging
import time
import uuid
from typing import Optional, Dict, Any, Callable
from functools import wraps
from contextlib import contextmanager

try:
    import sentry_sdk
    from sentry_sdk.integrations.logging import LoggingIntegration
    SENTRY_AVAILABLE = True
except ImportError:
    SENTRY_AVAILABLE = False

try:
    from opentelemetry import trace
    from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
    OTEL_AVAILABLE = True
except ImportError:
    OTEL_AVAILABLE = False

from app.config import settings

# Structured logger setup
logger = logging.getLogger("scholarmatch")
logger.setLevel(logging.INFO)

class StructuredFormatter(logging.Formatter):
    """Custom formatter for structured JSON-like logs."""
    def format(self, record: logging.LogRecord) -> str:
        log_entry = {
            "timestamp": self.formatTime(record),
            "level": record.levelname,
            "message": record.getMessage(),
            "correlation_id": getattr(record, "correlation_id", None),
            "entity_id": getattr(record, "entity_id", None),
            "duration_ms": getattr(record, "duration_ms", None),
            "outcome": getattr(record, "outcome", None),
            "retry_count": getattr(record, "retry_count", None),
            "dependency_status": getattr(record, "dependency_status", None),
        }
        # Redact sensitive fields automatically
        if "password" in str(record.msg):
            log_entry["message"] = "[REDACTED]"
        return str(log_entry)

handler = logging.StreamHandler()
handler.setFormatter(StructuredFormatter())
logger.addHandler(handler)

def get_correlation_id() -> str:
    """Generate or retrieve current correlation ID."""
    # In real impl, this would come from request context
    return str(uuid.uuid4())

@contextmanager
def instrument_request(endpoint: str, correlation_id: Optional[str] = None):
    """Context manager to instrument API requests with timing and outcome."""
    cid = correlation_id or get_correlation_id()
    start_time = time.time()
    outcome = "success"
    
    try:
        yield cid
        outcome = "success"
    except Exception as e:
        outcome = "error"
        raise
    finally:
        duration_ms = (time.time() - start_time) * 1000
        extra = {
            "correlation_id": cid,
            "duration_ms": round(duration_ms, 2),
            "outcome": outcome,
            "endpoint": endpoint
        }
        logger.info(f"Request completed: {endpoint}", extra=extra)

@contextmanager
def instrument_job(job_name: str, correlation_id: Optional[str] = None, retry_count: int = 0):
    """Context manager to instrument background jobs."""
    cid = correlation_id or get_correlation_id()
    start_time = time.time()
    outcome = "success"
    dependency_status = {}
    
    try:
        yield cid
    except Exception as e:
        outcome = "error"
        dependency_status["error"] = str(e)
        raise
    finally:
        duration_ms = (time.time() - start_time) * 1000
        extra = {
            "correlation_id": cid,
            "duration_ms": round(duration_ms, 2),
            "outcome": outcome,
            "job_name": job_name,
            "retry_count": retry_count,
            "dependency_status": dependency_status
        }
        logger.info(f"Job completed: {job_name}", extra=extra)

def init_observability():
    """Initialize Sentry and OpenTelemetry based on environment config."""
    if settings.SENTRY_DSN and SENTRY_AVAILABLE:
        sentry_sdk.init(
            dsn=settings.SENTRY_DSN,
            traces_sample_rate=settings.SENTRY_TRACES_SAMPLE_RATE,
            integrations=[LoggingIntegration()],
            before_send=lambda event, hint: redact_sensitive(event)
        )
        
    if settings.OTEL_ENABLED and OTEL_AVAILABLE:
        # OTEL setup would go here
        pass

def redact_sensitive(data: Dict[str, Any]) -> Dict[str, Any]:
    """Redact sensitive values from telemetry data."""
    sensitive_keys = ["password", "token", "secret", "api_key", "ssn", "credit_card"]
    if isinstance(data, dict):
        for key in list(data.keys()):
            if any(s in key.lower() for s in sensitive_keys):
                data[key] = "[REDACTED]"
            elif isinstance(data[key], dict):
                data[key] = redact_sensitive(data[key])
    return data

def track_metric(metric_name: str, value: float, tags: Optional[Dict[str, str]] = None):
    """Emit a metric to the configured backend."""
    # Placeholder for Prometheus/Datadog integration
    extra = {"metric_name": metric_name, "value": value, "tags": tags or {}}
    logger.debug(f"Metric emitted: {metric_name}", extra=extra)
