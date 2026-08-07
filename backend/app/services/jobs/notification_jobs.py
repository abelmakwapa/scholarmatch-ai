"""Notification delivery Celery tasks with email provider adapter."""

import hashlib
import logging
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

from celery.exceptions import Retry

from app.celery_app import register_task
from app.db.unit_of_work import PostgresDatabase
from app.repositories.application_models import (
    EmailProviderSendRequest,
    EmailProviderSendResult,
    NotificationDeliveryRecord,
)

logger = logging.getLogger(__name__)


class EmailProviderAdapter:
    """Adapter for email provider with bounded retries and rate limits.
    
    This is a fake/stub implementation for testing. In production,
    inject a real provider like SendGrid, SES, etc.
    """
    
    MAX_RETRIES = 3
    TIMEOUT_SECONDS = 10.0
    RATE_LIMIT_DELAY_MS = 50
    
    def __init__(self, api_key: str | None = None, from_email: str = "noreply@example.com") -> None:
        self._api_key = api_key
        self._from_email = from_email
        self._last_request_time: float = 0
    
    async def send(self, request: EmailProviderSendRequest) -> EmailProviderSendResult:
        """Send email via provider.
        
        Args:
            request: Email send request
            
        Returns:
            Result with message_id and status
        """
        import time
        import asyncio
        
        # Rate limiting
        elapsed = time.time() - self._last_request_time
        if elapsed < self.RATE_LIMIT_DELAY_MS / 1000:
            await asyncio.sleep((self.RATE_LIMIT_DELAY_MS / 1000) - elapsed)
        self._last_request_time = time.time()
        
        # Fake success in test mode
        import os
        if os.environ.get("EMAIL_PROVIDER_FAKE") == "true":
            return EmailProviderSendResult(
                message_id=f"fake-{datetime.now(UTC).isoformat()}",
                status="sent",
            )
        
        # TODO: Implement real provider integration
        # For now, return fake success
        return EmailProviderSendResult(
            message_id=f"msg-{UUID(int=int(datetime.now(UTC).timestamp() * 1e6))}",
            status="sent",
        )


@register_task(
    "app.services.jobs.notification_jobs.send_deadline_reminder",
    queue="notifications",
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=300,
    retry_jitter=True,
    max_retries=3,
    time_limit=30,
)
def send_deadline_reminder(
    self: Any,
    profile_id: str,
    application_id: str,
    scholarship_title: str,
    deadline_at: str,
    days_until_deadline: int,
    idempotency_key: str,
) -> dict[str, Any]:
    """Send deadline reminder email.
    
    Args:
        profile_id: UUID of the profile
        application_id: UUID of the application
        scholarship_title: Title of the scholarship
        deadline_at: ISO format deadline timestamp
        days_until_deadline: Days remaining until deadline
        idempotency_key: Key for deduplication
        
    Returns:
        Dict with delivery status
    """
    database = PostgresDatabase.from_settings(self.app.conf)
    
    async def _run():
        async with database.unit_of_work(database._principal) as uow:
            # Check idempotency
            existing = await uow._connection.execute(
                "select id from public.notification_delivery_log where idempotency_key = %s",
                (idempotency_key,),
            )
            if await existing.fetchone():
                return {"status": "duplicate", "idempotency_key": idempotency_key}
            
            # Get user's notification preferences and email
            profile = await uow.profiles.get(UUID(profile_id))
            if not profile:
                return {"error": "profile_not_found"}
            
            prefs = await uow.notifications.get(UUID(profile_id))
            if not prefs or not prefs.get("deadline_reminders_enabled"):
                return {"status": "opted_out"}
            
            # Check quiet hours
            now_utc = datetime.now(UTC)
            if prefs.get("quiet_hours_start") is not None and prefs.get("quiet_hours_end") is not None:
                # Convert to user's timezone and check quiet hours
                import zoneinfo
                tz = zoneinfo.ZoneInfo(prefs.get("timezone", "UTC"))
                local_time = now_utc.astimezone(tz)
                quiet_start = prefs["quiet_hours_start"]
                quiet_end = prefs["quiet_hours_end"]
                if quiet_start <= local_time.hour < quiet_end:
                    # Schedule for after quiet hours
                    return {"status": "scheduled_after_quiet_hours"}
            
            # Build email content
            subject = f"Application Deadline Reminder: {scholarship_title}"
            body_html = f"""
            <html>
            <body>
            <h2>Deadline Reminder</h2>
            <p>Your application for <strong>{scholarship_title}</strong> is due in {days_until_deadline} days.</p>
            <p>Deadline: {deadline_at}</p>
            <p>Please ensure all required documents are submitted before the deadline.</p>
            </body>
            </html>
            """
            body_text = f"""
Deadline Reminder

Your application for {scholarship_title} is due in {days_until_deadline} days.
Deadline: {deadline_at}

Please ensure all required documents are submitted before the deadline.
            """.strip()
            
            # Compute body hash for deduplication
            body_hash = hashlib.sha256(body_html.encode()).hexdigest()
            
            # Record pending notification
            cursor = await uow._connection.execute(
                """
                insert into public.notification_delivery_log
                (recipient_profile_id, channel, template_name, subject, body_hash, 
                 scheduled_at, status, idempotency_key, metadata)
                values (%s, 'email', 'deadline_reminder', %s, %s, %s, 'pending', %s, %s)
                returning id
                """,
                (
                    UUID(profile_id),
                    subject,
                    body_hash,
                    now_utc,
                    idempotency_key,
                    {"application_id": application_id, "days_until_deadline": days_until_deadline},
                ),
            )
            record = await cursor.fetchone()
            
            # Send email
            provider = EmailProviderAdapter()
            try:
                result = await provider.send(
                    EmailProviderSendRequest(
                        to_email=profile.get("email", ""),
                        subject=subject,
                        body_html=body_html,
                        body_text=body_text,
                        from_email=provider._from_email,
                        tags=["deadline_reminder", "application"],
                    )
                )
                
                # Update delivery log
                await uow._connection.execute(
                    """
                    update public.notification_delivery_log
                    set status = 'sent', sent_at = %s, metadata = metadata || %s
                    where id = %s
                    """,
                    (now_utc, {"message_id": result.message_id}, record["id"]),
                )
                
                return {
                    "status": "sent",
                    "notification_id": str(record["id"]),
                    "message_id": result.message_id,
                }
                
            except Exception as exc:
                logger.warning(f"Email send failed: {exc}")
                # Update as failed, will be retried
                await uow._connection.execute(
                    """
                    update public.notification_delivery_log
                    set status = 'failed', error_code = %s, error_message = %s, retry_count = retry_count + 1
                    where id = %s
                    """,
                    ("SEND_FAILED", str(exc)[:2000], record["id"]),
                )
                raise Retry(exc=exc)
    
    import asyncio
    return asyncio.run(_run())


@register_task(
    "app.services.jobs.notification_jobs.send_transactional_email",
    queue="notifications",
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=300,
    retry_jitter=True,
    max_retries=3,
    time_limit=30,
)
def send_transactional_email(
    self: Any,
    to_email: str,
    subject: str,
    body_html: str,
    body_text: str | None,
    template_name: str,
    recipient_profile_id: str | None = None,
    idempotency_key: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Send transactional email.
    
    Args:
        to_email: Recipient email address
        subject: Email subject
        body_html: HTML body
        body_text: Plain text body (optional)
        template_name: Template identifier
        recipient_profile_id: Optional profile ID for tracking
        idempotency_key: Optional key for deduplication
        metadata: Optional metadata
        
    Returns:
        Dict with delivery status
    """
    database = PostgresDatabase.from_settings(self.app.conf)
    
    async def _run():
        # Check idempotency if key provided
        if idempotency_key:
            async with database.unit_of_work(database._principal) as uow:
                existing = await uow._connection.execute(
                    "select id from public.notification_delivery_log where idempotency_key = %s",
                    (idempotency_key,),
                )
                if await existing.fetchone():
                    return {"status": "duplicate", "idempotency_key": idempotency_key}
        
        body_hash = hashlib.sha256(body_html.encode()).hexdigest()
        now_utc = datetime.now(UTC)
        
        # Send email
        provider = EmailProviderAdapter()
        try:
            result = await provider.send(
                EmailProviderSendRequest(
                    to_email=to_email,
                    subject=subject,
                    body_html=body_html,
                    body_text=body_text,
                    from_email=provider._from_email,
                    tags=[template_name],
                )
            )
            
            # Record delivery if we have a profile
            if recipient_profile_id:
                async with database.unit_of_work(database._principal) as uow:
                    await uow._connection.execute(
                        """
                        insert into public.notification_delivery_log
                        (recipient_profile_id, channel, template_name, subject, body_hash,
                         scheduled_at, sent_at, status, idempotency_key, metadata)
                        values (%s, 'email', %s, %s, %s, %s, %s, 'sent', %s, %s)
                        """,
                        (
                            UUID(recipient_profile_id),
                            template_name,
                            subject,
                            body_hash,
                            now_utc,
                            now_utc,
                            idempotency_key,
                            metadata or {},
                        ),
                    )
            
            return {
                "status": "sent",
                "message_id": result.message_id,
            }
            
        except Exception as exc:
            logger.warning(f"Transactional email failed: {exc}")
            
            if recipient_profile_id:
                async with database.unit_of_work(database._principal) as uow:
                    await uow._connection.execute(
                        """
                        insert into public.notification_delivery_log
                        (recipient_profile_id, channel, template_name, subject, body_hash,
                         scheduled_at, status, error_code, error_message, idempotency_key, metadata)
                        values (%s, 'email', %s, %s, %s, %s, 'failed', %s, %s, %s, %s)
                        """,
                        (
                            UUID(recipient_profile_id),
                            template_name,
                            subject,
                            body_hash,
                            now_utc,
                            "SEND_FAILED",
                            str(exc)[:2000],
                            idempotency_key,
                            metadata or {},
                        ),
                    )
            
            raise Retry(exc=exc)
    
    import asyncio
    return asyncio.run(_run())


@register_task(
    "app.services.jobs.notification_jobs.retry_failed_notification",
    queue="notifications",
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=300,
    retry_jitter=True,
    max_retries=2,
    time_limit=30,
)
def retry_failed_notification(
    self: Any,
    notification_id: str,
) -> dict[str, Any]:
    """Retry a failed notification.
    
    Args:
        notification_id: UUID of the notification record
        
    Returns:
        Dict with retry status
    """
    database = PostgresDatabase.from_settings(self.app.conf)
    
    async def _run():
        async with database.unit_of_work(database._principal) as uow:
            # Get notification record
            record = await uow._connection.execute(
                "select * from public.notification_delivery_log where id = %s",
                (UUID(notification_id),),
            )
            row = await record.fetchone()
            
            if not row:
                return {"error": "not_found"}
            
            if row["retry_count"] >= 10:
                # Move to dead letter
                await uow._connection.execute(
                    """
                    update public.notification_delivery_log
                    set status = 'dead_lettered', updated_at = %s
                    where id = %s
                    """,
                    (datetime.now(UTC), UUID(notification_id)),
                )
                return {"status": "dead_lettered", "reason": "max_retries_exceeded"}
            
            # Reset to pending for retry
            await uow._connection.execute(
                """
                update public.notification_delivery_log
                set status = 'pending', error_code = null, error_message = null,
                    updated_at = %s, next_retry_at = null
                where id = %s
                """,
                (datetime.now(UTC), UUID(notification_id)),
            )
            
            # Re-enqueue the appropriate task based on template
            if row["template_name"] == "deadline_reminder":
                meta = row.get("metadata", {})
                send_deadline_reminder.delay(
                    profile_id=str(row["recipient_profile_id"]),
                    application_id=meta.get("application_id", ""),
                    scholarship_title=row.get("subject", "").replace("Application Deadline Reminder: ", ""),
                    deadline_at=meta.get("deadline_at", ""),
                    days_until_deadline=meta.get("days_until_deadline", 0),
                    idempotency_key=row.get("idempotency_key", str(UUID(int=int(datetime.now(UTC).timestamp() * 1e6))))),
                )
            
            return {"status": "requeued"}
    
    import asyncio
    return asyncio.run(_run())
