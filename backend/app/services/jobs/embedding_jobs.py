"""Embedding generation Celery tasks."""

import hashlib
import logging
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from celery.exceptions import Retry

from app.celery_app import register_task
from app.db.unit_of_work import PostgresDatabase

logger = logging.getLogger(__name__)


@register_task(
    "app.services.jobs.embedding_jobs.generate_profile_embedding",
    queue="embeddings",
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=300,
    retry_jitter=True,
    max_retries=3,
    time_limit=60,
)
def generate_profile_embedding(
    self: Any,
    profile_id: str,
    data_version: int,
    embedding_version: str = "v1",
    model_name: str = "text-embedding-3-small",
) -> dict[str, Any]:
    """Generate embedding for a user profile.
    
    Args:
        profile_id: UUID of the profile
        data_version: Profile data version
        embedding_version: Version of embedding schema
        model_name: Name of embedding model
        
    Returns:
        Dict with embedding status
    """
    database = PostgresDatabase.from_settings(self.app.conf)
    
    async def _run():
        async with database.unit_of_work(database._principal) as uow:
            # Get profile
            profile = await uow.profiles.get(UUID(profile_id))
            if not profile:
                return {"error": "profile_not_found"}
            
            # Check if already up to date
            existing = await uow._connection.execute(
                """
                select id, content_hash from public.entity_embeddings
                where entity_type = 'profile' and entity_id = %s
                  and embedding_version = %s and model_name = %s
                """,
                (UUID(profile_id), embedding_version, model_name),
            )
            emb_row = await existing.fetchone()
            
            # Build canonical text (privacy-minimized)
            text_parts = []
            if profile.get("study_level"):
                text_parts.append(f"Study level: {profile['study_level']}")
            if profile.get("field_of_study"):
                text_parts.append(f"Field: {profile['field_of_study']}")
            if profile.get("country"):
                text_parts.append(f"Country: {profile['country']}")
            if profile.get("goals"):
                text_parts.append(f"Goals: {profile['goals'][:500]}")
            if profile.get("interests"):
                text_parts.append(f"Interests: {', '.join(profile['interests'][:10])}")
            
            canonical_text = ". ".join(text_parts)
            content_hash = hashlib.sha256(canonical_text.encode()).hexdigest()
            
            # Skip if unchanged
            if emb_row and emb_row.get("content_hash") == content_hash:
                return {"status": "unchanged", "embedding_id": str(emb_row["id"])}
            
            # Generate embedding (stub - would call embedding provider)
            # In production: call embedding API here
            embedding_vector = [0.0] * 1536  # Placeholder
            
            if emb_row:
                # Update existing
                await uow._connection.execute(
                    """
                    update public.entity_embeddings
                    set embedding = %s, content_hash = %s, updated_at = %s
                    where id = %s
                    """,
                    (embedding_vector, content_hash, datetime.now(UTC), emb_row["id"]),
                )
                return {"status": "updated", "embedding_id": str(emb_row["id"])}
            else:
                # Insert new
                cursor = await uow._connection.execute(
                    """
                    insert into public.entity_embeddings
                    (entity_type, entity_id, model_name, dimensions, content_hash,
                     embedding_version, entity_data_version, embedding)
                    values ('profile', %s, %s, %s, %s, %s, %s, %s)
                    returning id
                    """,
                    (UUID(profile_id), model_name, len(embedding_vector), content_hash,
                     embedding_version, data_version, embedding_vector),
                )
                row = await cursor.fetchone()
                return {"status": "created", "embedding_id": str(row["id"])}
    
    import asyncio
    return asyncio.run(_run())


@register_task(
    "app.services.jobs.embedding_jobs.generate_scholarship_embedding",
    queue="embeddings",
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=300,
    retry_jitter=True,
    max_retries=3,
    time_limit=60,
)
def generate_scholarship_embedding(
    self: Any,
    scholarship_id: str,
    data_version: int,
    embedding_version: str = "v1",
    model_name: str = "text-embedding-3-small",
) -> dict[str, Any]:
    """Generate embedding for a scholarship.
    
    Args:
        scholarship_id: UUID of the scholarship
        data_version: Scholarship data version
        embedding_version: Version of embedding schema
        model_name: Name of embedding model
        
    Returns:
        Dict with embedding status
    """
    database = PostgresDatabase.from_settings(self.app.conf)
    
    async def _run():
        async with database.unit_of_work(database._principal) as uow:
            # Get scholarship
            result = await uow._connection.execute(
                """
                select s.*, p.name as provider_name
                from public.scholarships s
                join public.scholarship_providers p on p.id = s.provider_id
                where s.id = %s
                """,
                (UUID(scholarship_id),),
            )
            scholarship = await result.fetchone()
            
            if not scholarship:
                return {"error": "scholarship_not_found"}
            
            # Check if already up to date
            existing = await uow._connection.execute(
                """
                select id, content_hash from public.entity_embeddings
                where entity_type = 'scholarship' and entity_id = %s
                  and embedding_version = %s and model_name = %s
                """,
                (UUID(scholarship_id), embedding_version, model_name),
            )
            emb_row = await existing.fetchone()
            
            # Build canonical text (normalized facts only, no raw documents)
            text_parts = []
            if scholarship.get("title"):
                text_parts.append(f"Title: {scholarship['title']}")
            if scholarship.get("description"):
                text_parts.append(f"Description: {scholarship['description'][:500]}")
            if scholarship.get("funding_type"):
                text_parts.append(f"Funding: {scholarship['funding_type']}")
            if scholarship.get("study_levels"):
                text_parts.append(f"Study levels: {', '.join(scholarship['study_levels'])}")
            if scholarship.get("fields_of_study"):
                text_parts.append(f"Fields: {', '.join(scholarship['fields_of_study'])}")
            if scholarship.get("eligibility_summary"):
                text_parts.append(f"Eligibility: {scholarship['eligibility_summary'][:500]}")
            
            canonical_text = ". ".join(text_parts)
            content_hash = hashlib.sha256(canonical_text.encode()).hexdigest()
            
            # Skip if unchanged
            if emb_row and emb_row.get("content_hash") == content_hash:
                return {"status": "unchanged", "embedding_id": str(emb_row["id"])}
            
            # Generate embedding (stub)
            embedding_vector = [0.0] * 1536  # Placeholder
            
            if emb_row:
                await uow._connection.execute(
                    """
                    update public.entity_embeddings
                    set embedding = %s, content_hash = %s, updated_at = %s
                    where id = %s
                    """,
                    (embedding_vector, content_hash, datetime.now(UTC), emb_row["id"]),
                )
                return {"status": "updated", "embedding_id": str(emb_row["id"])}
            else:
                cursor = await uow._connection.execute(
                    """
                    insert into public.entity_embeddings
                    (entity_type, entity_id, model_name, dimensions, content_hash,
                     embedding_version, entity_data_version, embedding)
                    values ('scholarship', %s, %s, %s, %s, %s, %s, %s)
                    returning id
                    """,
                    (UUID(scholarship_id), model_name, len(embedding_vector), content_hash,
                     embedding_version, data_version, embedding_vector),
                )
                row = await cursor.fetchone()
                return {"status": "created", "embedding_id": str(row["id"])}
    
    import asyncio
    return asyncio.run(_run())
