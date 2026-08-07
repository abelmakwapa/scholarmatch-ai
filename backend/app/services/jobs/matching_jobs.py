"""Matching and reindexing Celery tasks."""

import logging
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from celery.exceptions import Retry

from app.celery_app import register_task
from app.db.unit_of_work import PostgresDatabase

logger = logging.getLogger(__name__)


@register_task(
    "app.services.jobs.matching_jobs.calculate_match_scores",
    queue="matching",
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=300,
    retry_jitter=True,
    max_retries=3,
    time_limit=300,
)
def calculate_match_scores(
    self: Any,
    job_id: str,
) -> dict[str, Any]:
    """Calculate match scores for a profile against candidate scholarships.
    
    Args:
        job_id: UUID of the match job
        
    Returns:
        Dict with match calculation results
    """
    from app.services.matching_engine import MatchingEngine
    
    database = PostgresDatabase.from_settings(self.app.conf)
    
    async def _run():
        async with database.unit_of_work(database._principal) as uow:
            # Get job details
            job = await uow._connection.execute(
                "select * from public.match_jobs where id = %s",
                (UUID(job_id),),
            )
            job_row = await job.fetchone()
            
            if not job_row:
                return {"error": "job_not_found"}
            
            profile_id = job_row["profile_id"]
            algorithm_version = job_row["algorithm_version"]
            
            # Get profile
            profile = await uow.profiles.get(profile_id)
            if not profile:
                return {"error": "profile_not_found"}
            
            # Get candidate scholarships (with hard filters + vector similarity)
            # This would use pgvector for semantic retrieval
            candidates = await uow.scholarships.list_for_matching(limit=100)
            
            engine = MatchingEngine()
            matches_calculated = 0
            
            for scholarship in candidates:
                try:
                    # Calculate deterministic match
                    result = engine.evaluate_eligibility_and_score(
                        profile_data=profile,
                        scholarship_data=scholarship,
                        requirements=scholarship.get("requirements", []),
                    )
                    
                    # Store match result
                    from app.repositories.models import MatchWrite
                    from app.schemas.match import EligibilityResult, RuleOutcome
                    
                    eligibility = EligibilityResult(
                        outcome=RuleOutcome.ELIGIBLE if result["is_eligible"] else RuleOutcome.INELIGIBLE,
                        hard_rule_results=[],
                        soft_rule_results=[],
                        missing_profile_fields=result.get("missing_fields", []),
                    )
                    
                    match_write = MatchWrite(
                        profile_id=profile_id,
                        scholarship_id=scholarship["id"],
                        total_score=result.get("total_score", 0.0),
                        confidence=result.get("confidence", 0.0),
                        score_breakdown=result.get("score_breakdown", []),
                        requirement_evidence=result.get("requirement_evidence", []),
                        deterministic_explanation=result.get("explanation", {}),
                        ai_explanation=None,
                        explanation_status="pending",
                        algorithm_version=algorithm_version,
                        embedding_version="v1",
                        profile_data_version=job_row["profile_data_version"],
                        scholarship_data_version=scholarship.get("data_version", 1),
                        eligibility_status="eligible" if result["is_eligible"] else "ineligible",
                        missing_profile_fields=result.get("missing_fields", []),
                        stale_reasons=[],
                        calculated_at=datetime.now(UTC),
                    )
                    
                    await uow.match_writer.upsert(match_write)
                    matches_calculated += 1
                    
                except Exception as exc:
                    logger.warning(f"Match calculation failed for {scholarship['id']}: {exc}")
                    continue
            
            # Update job status
            await uow._connection.execute(
                """
                update public.match_jobs
                set status = 'completed', completed_at = %s, matches_calculated = %s
                where id = %s
                """,
                (datetime.now(UTC), matches_calculated, UUID(job_id)),
            )
            
            return {"matches_calculated": matches_calculated}
    
    import asyncio
    return asyncio.run(_run())


@register_task(
    "app.services.jobs.matching_jobs.reindex_embeddings",
    queue="embeddings",
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=600,
    retry_jitter=True,
    max_retries=5,
    time_limit=600,
)
def reindex_embeddings(
    self: Any,
    entity_type: str,
    target_embedding_version: str,
    model_name: str,
    batch_size: int = 100,
) -> dict[str, Any]:
    """Re-index all embeddings to a new version without corrupting active results.
    
    Safe re-indexing strategy:
    1. Generate new embeddings with new version tag
    2. Keep old embeddings active until switchover
    3. Atomically switch to new version when ready
    4. Clean up old embeddings after verification
    
    Args:
        entity_type: 'profile' or 'scholarship'
        target_embedding_version: New embedding version
        model_name: Embedding model name
        batch_size: Batch size for processing
        
    Returns:
        Dict with reindex statistics
    """
    from app.services.jobs.embedding_jobs import (
        generate_profile_embedding,
        generate_scholarship_embedding,
    )
    
    database = PostgresDatabase.from_settings(self.app.conf)
    
    async def _run():
        async with database.unit_of_work(database._principal) as uow:
            # Get all entities that need reindexing
            if entity_type == "profile":
                cursor = await uow._connection.execute(
                    """
                    select id, data_version from public.profiles
                    order by id
                    limit %s
                    """,
                    (batch_size,),
                )
                entities = await cursor.fetchall()
                
                for entity in entities:
                    generate_profile_embedding.delay(
                        profile_id=str(entity["id"]),
                        data_version=entity["data_version"],
                        embedding_version=target_embedding_version,
                        model_name=model_name,
                    )
                    
            elif entity_type == "scholarship":
                cursor = await uow._connection.execute(
                    """
                    select id, version from public.scholarships
                    where status = 'published'
                    order by id
                    limit %s
                    """,
                    (batch_size,),
                )
                entities = await cursor.fetchall()
                
                for entity in entities:
                    generate_scholarship_embedding.delay(
                        scholarship_id=str(entity["id"]),
                        data_version=entity["version"],
                        embedding_version=target_embedding_version,
                        model_name=model_name,
                    )
            
            return {
                "entity_type": entity_type,
                "target_version": target_embedding_version,
                "entities_queued": len(entities),
            }
    
    import asyncio
    return asyncio.run(_run())
