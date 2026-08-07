"""Job service modules for Celery tasks."""

from app.services.jobs.application_jobs import (
    create_application,
    transition_application_status,
    update_application_checklist,
)
from app.services.jobs.document_jobs import (
    process_document_scan,
    cleanup_deleted_document,
)
from app.services.jobs.embedding_jobs import (
    generate_profile_embedding,
    generate_scholarship_embedding,
)
from app.services.jobs.matching_jobs import (
    calculate_match_scores,
    reindex_embeddings,
)
from app.services.jobs.notification_jobs import (
    send_deadline_reminder,
    send_transactional_email,
    retry_failed_notification,
)
from app.services.jobs.scheduler_jobs import (
    check_scholarship_expiry,
    refresh_freshness_checks,
    generate_deadline_reminders,
    cleanup_old_jobs,
)

__all__ = [
    # Application jobs
    "create_application",
    "transition_application_status",
    "update_application_checklist",
    # Document jobs
    "process_document_scan",
    "cleanup_deleted_document",
    # Embedding jobs
    "generate_profile_embedding",
    "generate_scholarship_embedding",
    # Matching jobs
    "calculate_match_scores",
    "reindex_embeddings",
    # Notification jobs
    "send_deadline_reminder",
    "send_transactional_email",
    "retry_failed_notification",
    # Scheduler jobs
    "check_scholarship_expiry",
    "refresh_freshness_checks",
    "generate_deadline_reminders",
    "cleanup_old_jobs",
]
