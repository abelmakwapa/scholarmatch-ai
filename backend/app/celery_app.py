"""Celery application configuration for async job processing."""

import os
from typing import Any

from celery import Celery, Task
from celery.schedules import crontab

# Create Celery app
celery_app = Celery(
    "scholarship_matcher",
    broker=os.environ.get("CELERY_BROKER_URL", "redis://localhost:6379/0"),
    backend=os.environ.get("CELERY_RESULT_BACKEND", "redis://localhost:6379/1"),
    include=[
        "app.services.jobs.application_jobs",
        "app.services.jobs.embedding_jobs",
        "app.services.jobs.matching_jobs",
        "app.services.jobs.document_jobs",
        "app.services.jobs.notification_jobs",
        "app.services.jobs.scheduler_jobs",
    ],
)

# Configure Celery
celery_app.conf.update(
    # Task serialization
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    # Named queues for different job types
    task_queues={
        "ingestion": {
            "exchange": "ingestion",
            "routing_key": "ingestion",
        },
        "embeddings": {
            "exchange": "embeddings",
            "routing_key": "embeddings",
        },
        "matching": {
            "exchange": "matching",
            "routing_key": "matching",
        },
        "document_processing": {
            "exchange": "document_processing",
            "routing_key": "document_processing",
        },
        "notifications": {
            "exchange": "notifications",
            "routing_key": "notifications",
        },
    },
    # Default retry policy
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    # Rate limits per queue
    task_annotations={
        "app.services.jobs.notification_jobs.send_deadline_reminder": {
            "rate_limit": "100/m"
        },
    },
    # Beat scheduler for periodic tasks
    beat_schedule={
        "check-scholarship-expiry": {
            "task": "app.services.jobs.scheduler_jobs.check_scholarship_expiry",
            "schedule": crontab(minute=0, hour=6),  # Daily at 6 AM UTC
        },
        "refresh-freshness-checks": {
            "task": "app.services.jobs.scheduler_jobs.refresh_freshness_checks",
            "schedule": crontab(minute=0, hour=2),  # Daily at 2 AM UTC
        },
        "generate-deadline-reminders": {
            "task": "app.services.jobs.scheduler_jobs.generate_deadline_reminders",
            "schedule": crontab(minute=0, hour=8),  # Daily at 8 AM UTC
        },
        "cleanup-old-jobs": {
            "task": "app.services.jobs.scheduler_jobs.cleanup_old_jobs",
            "schedule": crontab(minute=0, hour=3, day_of_week=0),  # Weekly on Sunday at 3 AM
        },
    },
)


def register_task(name: str, **options: Any) -> Any:
    """Decorator to register a task with default options."""

    def _wrap(func: Task) -> Task:
        return celery_app.task(name=name, bind=True, **options)(func)

    return _wrap


__all__ = ["celery_app", "register_task"]
