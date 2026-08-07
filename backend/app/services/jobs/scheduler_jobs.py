"""Scheduler Celery tasks for periodic maintenance."""

import logging
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

from celery.schedules import crontab

from app.celery_app import register_task
from app.db.unit_of_work import PostgresDatabase
from app.services.jobs.notification_jobs import send_deadline_reminder

logger = logging.getLogger(__name__)


@register_task(
    "app.services.jobs.scheduler_jobs.check_scholarship_expiry",
    queue="ingestion",
    time_limit=300,
)
def check_scholarship_expiry(self: Any) -> dict[str, int]:
    """Check and handle expired scholarships.
    
    Returns:
        Dict with counts of processed scholarships
    """
    database = PostgresDatabase.from_settings(self.app.conf)
    
    async def _run():
        async with database.unit_of_work(database._principal) as uow:
            now = datetime.now(UTC).date()
            
            # Find scholarships past deadline
            cursor = await uow._connection.execute(
                """
                select id, title, deadline from public.scholarships
                where deadline < %s and status = 'published'
                """,
                (now,),
            )
            expired = await cursor.fetchall()
            
            expired_count = 0
            for scholarship in expired:
                # Could auto-archive or flag for review
                logger.info(f"Scholarship expired: {scholarship['title']} ({scholarship['deadline']})")
                expired_count += 1
            
            return {"expired_count": expired_count}
    
    import asyncio
    return asyncio.run(_run())


@register_task(
    "app.services.jobs.scheduler_jobs.refresh_freshness_checks",
    queue="ingestion",
    time_limit=600,
)
def refresh_freshness_checks(self: Any) -> dict[str, int]:
    """Trigger freshness checks for stale scholarships.
    
    Returns:
        Dict with count of scholarships needing refresh
    """
    database = PostgresDatabase.from_settings(self.app.conf)
    
    async def _run():
        async with database.unit_of_work(database._principal) as uow:
            stale_threshold = datetime.now(UTC) - timedelta(days=30)
            
            # Find scholarships not recently verified
            cursor = await uow._connection.execute(
                """
                select s.id, s.title, s.last_verified_at, ss.canonical_url
                from public.scholarships s
                join public.scholarship_sources ss on ss.scholarship_id = s.id and ss.active
                where (s.last_verified_at is null or s.last_verified_at < %s)
                  and s.status = 'published'
                limit 100
                """,
                (stale_threshold,),
            )
            stale = await cursor.fetchall()
            
            # Enqueue ingestion jobs for stale sources
            for scholarship in stale:
                logger.info(f"Scheduling freshness check: {scholarship['title']}")
                # Would enqueue ingestion task here
            
            return {"stale_count": len(stale)}
    
    import asyncio
    return asyncio.run(_run())


@register_task(
    "app.services.jobs.scheduler_jobs.generate_deadline_reminders",
    queue="notifications",
    time_limit=600,
)
def generate_deadline_reminders(self: Any) -> dict[str, int]:
    """Generate deadline reminders for upcoming applications.
    
    Returns:
        Dict with count of reminders sent
    """
    database = PostgresDatabase.from_settings(self.app.conf)
    
    async def _run():
        async with database.unit_of_work(database._principal) as uow:
            now = datetime.now(UTC)
            reminders_sent = 0
            
            # Get user reminder day preferences (default: 30, 14, 7 days before)
            cursor = await uow._connection.execute(
                """
                select np.profile_id, np.reminder_days, np.deadline_reminders_enabled,
                       a.id as application_id, a.deadline_at, s.title as scholarship_title
                from public.applications a
                join public.profiles p on p.id = a.profile_id
                join public.notification_preferences np on np.profile_id = p.id
                join public.scholarships s on s.id = a.scholarship_id
                where a.status in ('saved', 'preparing', 'ready', 'submitted')
                  and a.deadline_at is not null
                  and a.deadline_at > %s
                  and np.deadline_reminders_enabled = true
                """,
                (now,),
            )
            applications = await cursor.fetchall()
            
            for app in applications:
                if not app["deadline_at"]:
                    continue
                    
                deadline = app["deadline_at"]
                if isinstance(deadline, str):
                    deadline = datetime.fromisoformat(deadline.replace("Z", "+00:00"))
                
                days_until = (deadline - now).days
                
                # Check if we should send reminder based on user's preferred days
                reminder_days = app.get("reminder_days", [30, 14, 7])
                if days_until in reminder_days:
                    # Generate idempotency key
                    idempotency_key = f"deadline_{app['application_id']}_{days_until}"
                    
                    # Enqueue reminder task
                    send_deadline_reminder.delay(
                        profile_id=str(app["profile_id"]),
                        application_id=str(app["application_id"]),
                        scholarship_title=app["scholarship_title"],
                        deadline_at=deadline.isoformat(),
                        days_until_deadline=days_until,
                        idempotency_key=idempotency_key,
                    )
                    reminders_sent += 1
            
            return {"reminders_sent": reminders_sent}
    
    import asyncio
    return asyncio.run(_run())


@register_task(
    "app.services.jobs.scheduler_jobs.cleanup_old_jobs",
    queue="ingestion",
    time_limit=300,
)
def cleanup_old_jobs(self: Any) -> dict[str, int]:
    """Clean up old completed/failed jobs.
    
    Returns:
        Dict with counts of cleaned up jobs
    """
    database = PostgresDatabase.from_settings(self.app.conf)
    
    async def _run():
        async with database.unit_of_work(database._principal) as uow:
            cutoff = datetime.now(UTC) - timedelta(days=30)
            
            # Archive old completed jobs
            result = await uow._connection.execute(
                """
                update public.job_queue
                set status = 'cancelled'
                where status in ('completed', 'failed', 'dead_lettered')
                  and completed_at < %s
                """,
                (cutoff,),
            )
            archived_count = result.rowcount or 0
            
            # Clean old notification logs
            result = await uow._connection.execute(
                """
                delete from public.notification_delivery_log
                where created_at < %s
                  and status in ('delivered', 'bounced', 'dead_lettered')
                """,
                (cutoff,),
            )
            deleted_count = result.rowcount or 0
            
            return {"archived_jobs": archived_count, "deleted_notifications": deleted_count}
    
    import asyncio
    return asyncio.run(_run())
