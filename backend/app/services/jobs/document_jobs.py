"""Document processing Celery tasks."""

import logging
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from celery.exceptions import Retry

from app.celery_app import register_task
from app.db.unit_of_work import PostgresDatabase

logger = logging.getLogger(__name__)


@register_task(
    "app.services.jobs.document_jobs.process_document_scan",
    queue="document_processing",
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=300,
    retry_jitter=True,
    max_retries=3,
    time_limit=120,
)
def process_document_scan(
    self: Any,
    document_id: str,
    profile_id: str,
) -> dict[str, Any]:
    """Process document scan (virus check, metadata extraction).
    
    Args:
        document_id: UUID of the document
        profile_id: UUID of the profile (for ownership check)
        
    Returns:
        Dict with scan status
    """
    database = PostgresDatabase.from_settings(self.app.conf)
    
    async def _run():
        async with database.unit_of_work(database._principal) as uow:
            # Get document
            doc = await uow.documents.get_for_profile(UUID(document_id), UUID(profile_id))
            if not doc:
                return {"error": "document_not_found"}
            
            # Simulate virus scan (stub)
            # In production: call ClamAV or similar
            scan_status = "clean"
            
            # Update document status
            await uow._connection.execute(
                """
                update public.profile_documents
                set scan_status = %s, updated_at = %s
                where id = %s and profile_id = %s
                """,
                (scan_status, datetime.now(UTC), UUID(document_id), UUID(profile_id)),
            )
            
            return {"status": "completed", "scan_result": scan_status}
    
    import asyncio
    return asyncio.run(_run())


@register_task(
    "app.services.jobs.document_jobs.cleanup_deleted_document",
    queue="document_processing",
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=300,
    retry_jitter=True,
    max_retries=3,
    time_limit=60,
)
def cleanup_deleted_document(
    self: Any,
    document_id: str,
    bucket: str,
    object_path: str,
) -> dict[str, Any]:
    """Clean up storage for deleted document.
    
    Args:
        document_id: UUID of the document
        bucket: Storage bucket name
        object_path: Object path in storage
        
    Returns:
        Dict with cleanup status
    """
    from app.services.storage import StorageService
    
    database = PostgresDatabase.from_settings(self.app.conf)
    
    async def _run():
        # Delete from storage
        storage = StorageService()
        try:
            await storage.delete_object(bucket, object_path)
        except Exception as exc:
            logger.warning(f"Storage delete failed: {exc}")
            # Don't fail - just log
        
        # Remove database record
        async with database.unit_of_work(database._principal) as uow:
            await uow._connection.execute(
                "delete from public.profile_documents where id = %s",
                (UUID(document_id),),
            )
        
        return {"status": "deleted"}
    
    import asyncio
    return asyncio.run(_run())
