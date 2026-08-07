"""Application tracking Celery tasks."""

import logging
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from celery.exceptions import Retry

from app.celery_app import register_task
from app.db.unit_of_work import PostgresDatabase
from app.repositories.application_models import (
    ALLOWED_TRANSITIONS,
    ChecklistItem,
    StatusHistoryEntry,
    is_valid_transition,
)

logger = logging.getLogger(__name__)


@register_task(
    "app.services.jobs.application_jobs.create_application",
    queue="matching",
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=300,
    retry_jitter=True,
    max_retries=3,
    time_limit=30,
)
def create_application(
    self: Any,
    profile_id: str,
    scholarship_id: str,
    idempotency_key: str,
    initial_status: str = "saved",
) -> dict[str, str]:
    """Create a new application with idempotency support.
    
    Args:
        profile_id: UUID of the user profile
        scholarship_id: UUID of the scholarship
        idempotency_key: Key for deduplication
        initial_status: Initial status (default: saved)
        
    Returns:
        Dict with application_id and status
    """
    from psycopg.errors import UniqueViolation
    
    database = PostgresDatabase.from_settings(self.app.conf)
    
    try:
        async def _run():
            async with database.unit_of_work(database._principal) as uow:
                # Check idempotency
                existing = await uow.idempotency.get(
                    actor_id=UUID(profile_id),
                    operation="create_application",
                    key=idempotency_key,
                )
                if existing:
                    return {"application_id": str(existing["result"]["application_id"]), "status": "idempotent"}
                
                # Create application
                from app.repositories.models import ApplicationWrite
                app_write = ApplicationWrite(
                    profile_id=UUID(profile_id),
                    scholarship_id=UUID(scholarship_id),
                    status=initial_status,  # type: ignore
                )
                row = await uow.applications.create(app_write)
                
                # Record initial status history
                await uow._connection.execute(
                    """
                    insert into public.application_status_history 
                    (application_id, status, actor_id, created_at)
                    values (%s, %s, %s, %s)
                    """,
                    (row["id"], initial_status, UUID(profile_id), datetime.now(UTC)),
                )
                
                # Store idempotency record
                await uow.idempotency.reserve(
                    actor_id=UUID(profile_id),
                    operation="create_application",
                    key=idempotency_key,
                    request_hash=idempotency_key,
                    expires_at=datetime.now(UTC).replace(year=datetime.now(UTC).year + 1),
                )
                
                return {"application_id": str(row["id"]), "status": row["status"]}
        
        import asyncio
        return asyncio.run(_run())
        
    except UniqueViolation:
        # Application already exists for this profile/scholarship
        return {"error": "application_exists", "status": "conflict"}
    except Exception as exc:
        logger.warning(f"Create application failed: {exc}")
        raise Retry(exc=exc)


@register_task(
    "app.services.jobs.application_jobs.transition_application_status",
    queue="matching",
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=300,
    retry_jitter=True,
    max_retries=3,
    time_limit=30,
)
def transition_application_status(
    self: Any,
    application_id: str,
    profile_id: str,
    from_status: str,
    to_status: str,
    actor_id: str,
    reason: str | None = None,
    idempotency_key: str | None = None,
) -> dict[str, Any]:
    """Transition application status with validation.
    
    Args:
        application_id: UUID of the application
        profile_id: UUID of the profile (for ownership check)
        from_status: Current status
        to_status: Target status
        actor_id: UUID of the actor making the change
        reason: Optional reason for transition
        idempotency_key: Optional key for idempotency
        
    Returns:
        Dict with new status and transition details
    """
    # Validate transition
    if not is_valid_transition(from_status, to_status):
        return {
            "error": "invalid_transition",
            "message": f"Cannot transition from {from_status} to {to_status}",
            "allowed_transitions": [
                f"{f} -> {t}" for f, t in ALLOWED_TRANSITIONS if f == from_status
            ],
        }
    
    database = PostgresDatabase.from_settings(self.app.conf)
    
    async def _run():
        async with database.unit_of_work(database._principal) as uow:
            # Get current application
            app_row = await uow._connection.execute(
                "select * from public.applications where id = %s and profile_id = %s",
                (UUID(application_id), UUID(profile_id)),
            )
            app = await app_row.fetchone()
            
            if not app:
                return {"error": "not_found", "status": "not_found"}
            
            if app["status"] != from_status:
                return {
                    "error": "status_mismatch",
                    "current_status": app["status"],
                    "expected_status": from_status,
                }
            
            # Update status
            update_data = {
                "status": to_status,
                "updated_at": datetime.now(UTC),
            }
            if to_status == "submitted":
                update_data["submitted_at"] = datetime.now(UTC)
            
            cursor = await uow._connection.execute(
                """
                update public.applications set status = %(status)s, updated_at = %(updated_at)s, submitted_at = %(submitted_at)s
                where id = %(id)s and profile_id = %(profile_id)s
                returning *
                """,
                {**update_data, "id": UUID(application_id), "profile_id": UUID(profile_id)},
            )
            updated = await cursor.fetchone()
            
            # Record status history (trigger handles this, but we can also do it here)
            await uow._connection.execute(
                """
                insert into public.application_status_history 
                (application_id, status, actor_id, reason, created_at)
                values (%s, %s, %s, %s, %s)
                """,
                (UUID(application_id), to_status, UUID(actor_id), reason, datetime.now(UTC)),
            )
            
            return {
                "application_id": str(updated["id"]),
                "previous_status": from_status,
                "new_status": to_status,
                "transitioned_at": str(updated["updated_at"]),
            }
    
    import asyncio
    return asyncio.run(_run())


@register_task(
    "app.services.jobs.application_jobs.update_application_checklist",
    queue="matching",
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=300,
    retry_jitter=True,
    max_retries=3,
    time_limit=30,
)
def update_application_checklist(
    self: Any,
    application_id: str,
    profile_id: str,
    item_key: str,
    completed: bool,
    notes: str | None = None,
) -> dict[str, Any]:
    """Update a checklist item for an application.
    
    Args:
        application_id: UUID of the application
        profile_id: UUID of the profile (for ownership check)
        item_key: Key identifying the checklist item
        completed: Completion status
        notes: Optional notes
        
    Returns:
        Dict with updated item details
    """
    database = PostgresDatabase.from_settings(self.app.conf)
    
    async def _run():
        async with database.unit_of_work(database._principal) as uow:
            # Verify application ownership
            app_row = await uow._connection.execute(
                "select id from public.applications where id = %s and profile_id = %s",
                (UUID(application_id), UUID(profile_id)),
            )
            app = await app_row.fetchone()
            
            if not app:
                return {"error": "not_found", "status": "not_found"}
            
            # Upsert checklist item
            cursor = await uow._connection.execute(
                """
                insert into public.application_checklist_items
                (application_id, item_key, description, completed, notes)
                values (%s, %s, %s, %s, %s)
                on conflict (application_id, item_key) do update set
                  completed = excluded.completed,
                  notes = excluded.notes,
                  updated_at = statement_timestamp()
                returning *
                """,
                (UUID(application_id), item_key, item_key.replace("_", " ").title(), completed, notes),
            )
            item = await cursor.fetchone()
            
            return {
                "item_key": item["item_key"],
                "description": item["description"],
                "completed": item["completed"],
                "updated_at": str(item["updated_at"]),
            }
    
    import asyncio
    return asyncio.run(_run())
