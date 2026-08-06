from collections.abc import Sequence
from dataclasses import asdict
from datetime import datetime
from uuid import UUID

from psycopg import AsyncConnection
from psycopg.rows import DictRow
from psycopg.types.json import Jsonb

from app.repositories.interfaces import DatabaseRow
from app.repositories.models import (
    ApplicationWrite,
    AuditEventWrite,
    DocumentWrite,
    IngestionRunWrite,
    MatchWrite,
    ProfileWrite,
    RequirementWrite,
)


class _PostgresRepository:
    def __init__(self, connection: AsyncConnection[DictRow]) -> None:
        self._connection = connection

    @staticmethod
    def _row(row: DictRow | None) -> DatabaseRow | None:
        return dict(row) if row is not None else None


class PostgresProfileRepository(_PostgresRepository):
    async def get(self, profile_id: UUID) -> DatabaseRow | None:
        cursor = await self._connection.execute(
            "select * from public.profiles where id = %s",
            (profile_id,),
        )
        return self._row(await cursor.fetchone())

    async def upsert(self, profile_id: UUID, profile: ProfileWrite) -> DatabaseRow:
        cursor = await self._connection.execute(
            """
            insert into public.profiles (
              id, full_name, country, study_level, field_of_study, gpa, gpa_scale,
              nationality_country, residence_country, date_of_birth, interests,
              target_countries, goals, requires_financial_aid, willing_to_relocate,
              data_version
            ) values (
              %(id)s, %(full_name)s, %(country)s, %(study_level)s,
              %(field_of_study)s, %(gpa)s, %(gpa_scale)s, %(nationality_country)s,
              %(residence_country)s, %(date_of_birth)s, %(interests)s,
              %(target_countries)s, %(goals)s, %(requires_financial_aid)s,
              %(willing_to_relocate)s, %(data_version)s
            )
            on conflict (id) do update set
              full_name = excluded.full_name,
              country = excluded.country,
              study_level = excluded.study_level,
              field_of_study = excluded.field_of_study,
              gpa = excluded.gpa,
              gpa_scale = excluded.gpa_scale,
              nationality_country = excluded.nationality_country,
              residence_country = excluded.residence_country,
              date_of_birth = excluded.date_of_birth,
              interests = excluded.interests,
              target_countries = excluded.target_countries,
              goals = excluded.goals,
              requires_financial_aid = excluded.requires_financial_aid,
              willing_to_relocate = excluded.willing_to_relocate,
              data_version = excluded.data_version
            returning *
            """,
            {
                "id": profile_id,
                "full_name": profile.full_name,
                "country": profile.country,
                "study_level": profile.study_level,
                "field_of_study": profile.field_of_study,
                "gpa": profile.gpa,
                "gpa_scale": profile.gpa_scale,
                "nationality_country": profile.nationality_country,
                "residence_country": profile.residence_country,
                "date_of_birth": profile.date_of_birth,
                "interests": Jsonb(profile.interests),
                "target_countries": profile.target_countries,
                "goals": profile.goals,
                "requires_financial_aid": profile.requires_financial_aid,
                "willing_to_relocate": profile.willing_to_relocate,
                "data_version": profile.data_version,
            },
        )
        row = self._row(await cursor.fetchone())
        if row is None:
            raise RuntimeError("Profile upsert returned no row")
        return row


class PostgresScholarshipReadRepository(_PostgresRepository):
    async def get_published(self, scholarship_id: UUID) -> DatabaseRow | None:
        cursor = await self._connection.execute(
            """
            select scholarships.*, scholarship_providers.name as provider_name
            from public.scholarships
            join public.scholarship_providers
              on scholarship_providers.id = scholarships.provider_id
            where scholarships.id = %s and scholarships.status = 'published'
            """,
            (scholarship_id,),
        )
        return self._row(await cursor.fetchone())

    async def list_published(self, *, limit: int = 20) -> list[DatabaseRow]:
        cursor = await self._connection.execute(
            """
            select scholarships.*, scholarship_providers.name as provider_name
            from public.scholarships
            join public.scholarship_providers
              on scholarship_providers.id = scholarships.provider_id
            where scholarships.status = 'published'
            order by scholarships.deadline nulls last, scholarships.id
            limit %s
            """,
            (limit,),
        )
        return [dict(row) for row in await cursor.fetchall()]


class PostgresCatalogAdminRepository(_PostgresRepository):
    async def replace_requirements(
        self, scholarship_id: UUID, requirements: Sequence[RequirementWrite]
    ) -> list[DatabaseRow]:
        await self._connection.execute(
            "delete from public.scholarship_requirements where scholarship_id = %s",
            (scholarship_id,),
        )
        if requirements:
            async with self._connection.cursor() as cursor:
                await cursor.executemany(
                    """
                    insert into public.scholarship_requirements (
                      scholarship_id, constraint_type, field, operator, value,
                      source_evidence, reviewer_notes, position
                    ) values (%s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    [
                        (
                            scholarship_id,
                            requirement.constraint_type,
                            requirement.field,
                            requirement.operator,
                            Jsonb(requirement.value),
                            Jsonb(requirement.source_evidence),
                            requirement.reviewer_notes,
                            requirement.position,
                        )
                        for requirement in requirements
                    ],
                )
        cursor = await self._connection.execute(
            """
            select * from public.scholarship_requirements
            where scholarship_id = %s
            order by position
            """,
            (scholarship_id,),
        )
        return [dict(row) for row in await cursor.fetchall()]


class PostgresMatchReadRepository(_PostgresRepository):
    async def list_for_profile(self, profile_id: UUID, *, limit: int = 20) -> list[DatabaseRow]:
        cursor = await self._connection.execute(
            """
            select * from public.matches
            where profile_id = %s
            order by total_score desc, id
            limit %s
            """,
            (profile_id, limit),
        )
        return [dict(row) for row in await cursor.fetchall()]


class PostgresMatchWriteRepository(_PostgresRepository):
    async def upsert(self, match: MatchWrite) -> DatabaseRow:
        cursor = await self._connection.execute(
            """
            insert into public.matches (
              profile_id, scholarship_id, total_score, confidence, score_breakdown,
              requirement_evidence, deterministic_explanation, ai_explanation,
              explanation_status, algorithm_version, embedding_version,
              profile_data_version, scholarship_data_version, stale_reasons, calculated_at
            ) values (
              %(profile_id)s, %(scholarship_id)s, %(total_score)s, %(confidence)s,
              %(score_breakdown)s, %(requirement_evidence)s, %(deterministic_explanation)s,
              %(ai_explanation)s, %(explanation_status)s, %(algorithm_version)s,
              %(embedding_version)s, %(profile_data_version)s,
              %(scholarship_data_version)s, %(stale_reasons)s, %(calculated_at)s
            )
            on conflict (profile_id, scholarship_id) do update set
              total_score = excluded.total_score,
              confidence = excluded.confidence,
              score_breakdown = excluded.score_breakdown,
              requirement_evidence = excluded.requirement_evidence,
              deterministic_explanation = excluded.deterministic_explanation,
              ai_explanation = excluded.ai_explanation,
              explanation_status = excluded.explanation_status,
              algorithm_version = excluded.algorithm_version,
              embedding_version = excluded.embedding_version,
              profile_data_version = excluded.profile_data_version,
              scholarship_data_version = excluded.scholarship_data_version,
              stale_reasons = excluded.stale_reasons,
              calculated_at = excluded.calculated_at
            returning *
            """,
            {
                "profile_id": match.profile_id,
                "scholarship_id": match.scholarship_id,
                "total_score": match.total_score,
                "confidence": match.confidence,
                "score_breakdown": Jsonb(match.score_breakdown),
                "requirement_evidence": Jsonb(match.requirement_evidence),
                "deterministic_explanation": Jsonb(match.deterministic_explanation),
                "ai_explanation": (
                    Jsonb(match.ai_explanation) if match.ai_explanation is not None else None
                ),
                "explanation_status": match.explanation_status,
                "algorithm_version": match.algorithm_version,
                "embedding_version": match.embedding_version,
                "profile_data_version": match.profile_data_version,
                "scholarship_data_version": match.scholarship_data_version,
                "stale_reasons": Jsonb(match.stale_reasons),
                "calculated_at": match.calculated_at,
            },
        )
        row = self._row(await cursor.fetchone())
        if row is None:
            raise RuntimeError("Match upsert returned no row")
        return row


class PostgresApplicationRepository(_PostgresRepository):
    async def get(self, application_id: UUID, profile_id: UUID) -> DatabaseRow | None:
        cursor = await self._connection.execute(
            "select * from public.applications where id = %s and profile_id = %s",
            (application_id, profile_id),
        )
        return self._row(await cursor.fetchone())

    async def create(self, application: ApplicationWrite) -> DatabaseRow:
        cursor = await self._connection.execute(
            """
            insert into public.applications (profile_id, scholarship_id, status, notes)
            values (%s, %s, %s, %s)
            returning *
            """,
            (
                application.profile_id,
                application.scholarship_id,
                application.status,
                application.notes,
            ),
        )
        row = self._row(await cursor.fetchone())
        if row is None:
            raise RuntimeError("Application insert returned no row")
        return row


class PostgresDocumentRepository(_PostgresRepository):
    async def list_for_profile(self, profile_id: UUID, *, limit: int = 20) -> list[DatabaseRow]:
        cursor = await self._connection.execute(
            """
            select * from public.profile_documents
            where profile_id = %s and deleted_at is null
            order by created_at desc, id
            limit %s
            """,
            (profile_id, limit),
        )
        return [dict(row) for row in await cursor.fetchall()]

    async def usage_for_profile(self, profile_id: UUID) -> tuple[int, int]:
        await self._connection.execute(
            "select pg_advisory_xact_lock(hashtextextended(%s::text, 0))",
            (profile_id,),
        )
        cursor = await self._connection.execute(
            """
            select
              count(*)::integer as document_count,
              coalesce(sum(size_bytes), 0)::bigint as bytes
            from public.profile_documents
            where profile_id = %s and deleted_at is null
            """,
            (profile_id,),
        )
        row = await cursor.fetchone()
        if row is None:
            return (0, 0)
        return (int(row["document_count"]), int(row["bytes"]))

    async def get_for_profile(self, document_id: UUID, profile_id: UUID) -> DatabaseRow | None:
        cursor = await self._connection.execute(
            """
            select * from public.profile_documents
            where id = %s and profile_id = %s and deleted_at is null
            """,
            (document_id, profile_id),
        )
        return self._row(await cursor.fetchone())

    async def create(self, document: DocumentWrite) -> DatabaseRow:
        cursor = await self._connection.execute(
            """
            insert into public.profile_documents (
              id, profile_id, storage_bucket, storage_object_path, document_type,
              display_name, original_filename, mime_type, size_bytes, checksum_sha256,
              status, scan_status
            ) values (
              %(id)s, %(profile_id)s, %(storage_bucket)s, %(storage_object_path)s,
              %(document_type)s, %(display_name)s, %(original_filename)s, %(mime_type)s,
              %(size_bytes)s, %(checksum_sha256)s, 'uploaded', 'pending'
            )
            returning *
            """,
            asdict(document),
        )
        row = self._row(await cursor.fetchone())
        if row is None:
            raise RuntimeError("Document insert returned no row")
        return row

    async def rename(
        self, document_id: UUID, profile_id: UUID, display_name: str
    ) -> DatabaseRow | None:
        cursor = await self._connection.execute(
            """
            update public.profile_documents set display_name = %s
            where id = %s and profile_id = %s and deleted_at is null
            returning *
            """,
            (display_name, document_id, profile_id),
        )
        return self._row(await cursor.fetchone())

    async def replace(
        self, document_id: UUID, profile_id: UUID, document: DocumentWrite
    ) -> DatabaseRow | None:
        cursor = await self._connection.execute(
            """
            update public.profile_documents set
              storage_bucket = %(storage_bucket)s,
              storage_object_path = %(storage_object_path)s,
              original_filename = %(original_filename)s,
              mime_type = %(mime_type)s,
              size_bytes = %(size_bytes)s,
              checksum_sha256 = %(checksum_sha256)s,
              status = 'uploaded',
              scan_status = 'pending',
              replaced_at = statement_timestamp()
            where id = %(id)s and profile_id = %(profile_id)s and deleted_at is null
            returning *
            """,
            asdict(document),
        )
        return self._row(await cursor.fetchone())

    async def soft_delete(self, document_id: UUID, profile_id: UUID) -> DatabaseRow | None:
        cursor = await self._connection.execute(
            """
            update public.profile_documents set
              status = 'deleted', deleted_at = statement_timestamp()
            where id = %s and profile_id = %s and deleted_at is null
            returning *
            """,
            (document_id, profile_id),
        )
        return self._row(await cursor.fetchone())


class PostgresNotificationPreferenceRepository(_PostgresRepository):
    async def get(self, profile_id: UUID) -> DatabaseRow | None:
        cursor = await self._connection.execute(
            "select * from public.notification_preferences where profile_id = %s",
            (profile_id,),
        )
        return self._row(await cursor.fetchone())

    async def upsert(
        self,
        profile_id: UUID,
        *,
        deadline_reminders_enabled: bool,
        product_updates_enabled: bool,
        reminder_days: Sequence[int],
        timezone: str,
    ) -> DatabaseRow:
        cursor = await self._connection.execute(
            """
            insert into public.notification_preferences (
              profile_id, deadline_reminders_enabled, product_updates_enabled,
              reminder_days, timezone
            ) values (%s, %s, %s, %s, %s)
            on conflict (profile_id) do update set
              deadline_reminders_enabled = excluded.deadline_reminders_enabled,
              product_updates_enabled = excluded.product_updates_enabled,
              reminder_days = excluded.reminder_days,
              timezone = excluded.timezone
            returning *
            """,
            (
                profile_id,
                deadline_reminders_enabled,
                product_updates_enabled,
                list(reminder_days),
                timezone,
            ),
        )
        row = self._row(await cursor.fetchone())
        if row is None:
            raise RuntimeError("Notification preference upsert returned no row")
        return row


class PostgresIngestionRunRepository(_PostgresRepository):
    async def create(self, run: IngestionRunWrite) -> DatabaseRow:
        cursor = await self._connection.execute(
            """
            insert into public.ingestion_runs (
              source, source_url, dry_run, original_run_id, created_by
            ) values (%s, %s, %s, %s, %s)
            returning *
            """,
            (run.source, run.source_url, run.dry_run, run.original_run_id, run.created_by),
        )
        row = self._row(await cursor.fetchone())
        if row is None:
            raise RuntimeError("Ingestion run insert returned no row")
        return row


class PostgresAuditEventRepository(_PostgresRepository):
    async def append(self, event: AuditEventWrite) -> DatabaseRow:
        cursor = await self._connection.execute(
            """
            insert into public.audit_events (
              actor_id, action, target_type, target_id, target_name, summary, metadata
            ) values (%s, %s, %s, %s, %s, %s, %s)
            returning *
            """,
            (
                event.actor_id,
                event.action,
                event.target_type,
                event.target_id,
                event.target_name,
                event.summary,
                Jsonb(event.metadata),
            ),
        )
        row = self._row(await cursor.fetchone())
        if row is None:
            raise RuntimeError("Audit event insert returned no row")
        return row


class PostgresIdempotencyRepository(_PostgresRepository):
    async def get(self, actor_id: UUID, operation: str, key: str) -> DatabaseRow | None:
        cursor = await self._connection.execute(
            """
            select * from public.idempotency_keys
            where actor_id = %s and operation = %s and key = %s
            """,
            (actor_id, operation, key),
        )
        return self._row(await cursor.fetchone())

    async def reserve(
        self,
        *,
        actor_id: UUID,
        operation: str,
        key: str,
        request_hash: str,
        expires_at: datetime,
    ) -> DatabaseRow:
        cursor = await self._connection.execute(
            """
            insert into public.idempotency_keys (
              actor_id, operation, key, request_hash, expires_at
            ) values (%s, %s, %s, %s, %s)
            returning *
            """,
            (actor_id, operation, key, request_hash, expires_at),
        )
        row = self._row(await cursor.fetchone())
        if row is None:
            raise RuntimeError("Idempotency reservation returned no row")
        return row
