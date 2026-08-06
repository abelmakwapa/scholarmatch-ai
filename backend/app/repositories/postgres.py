from collections.abc import Sequence
from dataclasses import asdict
from datetime import datetime
from decimal import Decimal
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
    NormalizedSourceWrite,
    ProfileWrite,
    RawSourceRecordWrite,
    RequirementWrite,
    ScholarshipWrite,
)
from app.schemas.scholarship import CatalogFilters, ScholarshipSort


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
            select scholarships.*, scholarship_providers.name as provider_name,
              scholarship_providers.website_url as provider_website_url
            from public.scholarships
            join public.scholarship_providers
              on scholarship_providers.id = scholarships.provider_id
            where scholarships.id = %s
              and scholarships.status = 'published'
              and scholarship_providers.status = 'active'
              and (scholarships.deadline is null or scholarships.deadline >= current_date)
            """,
            (scholarship_id,),
        )
        return self._row(await cursor.fetchone())

    async def list_published(
        self,
        filters: CatalogFilters,
        *,
        cursor: dict[str, str] | None,
        limit: int = 20,
    ) -> list[DatabaseRow]:
        clauses = [
            "s.status = 'published'",
            "p.status = 'active'",
            "(s.deadline is null or s.deadline >= current_date)",
        ]
        parameters: list[object] = []
        if filters.query:
            clauses.append(
                "(to_tsvector('simple', coalesce(s.title, '') || ' ' || "
                "coalesce(s.description, '') || ' ' || coalesce(s.funding_summary, '')) "
                "@@ plainto_tsquery('simple', %s) or p.name ilike '%%' || %s || '%%')"
            )
            parameters.extend([filters.query, filters.query])
        array_filters = {
            "study_levels": filters.study_level,
            "fields_of_study": filters.field_of_study,
            "destination_countries": filters.destination,
            "nationality_requirements": filters.nationality,
            "residency_requirements": filters.residency,
        }
        for column, value in array_filters.items():
            if value is not None:
                clauses.append(f"s.{column} @> array[%s]::text[]")
                parameters.append(value)
        if filters.funding_type is not None:
            clauses.append("s.funding_type = %s")
            parameters.append(filters.funding_type.value)
        if filters.currency is not None:
            clauses.append("s.currency = %s")
            parameters.append(filters.currency)
        if filters.deadline_from is not None:
            clauses.append("s.deadline >= %s")
            parameters.append(filters.deadline_from)
        if filters.deadline_to is not None:
            clauses.append("s.deadline <= %s")
            parameters.append(filters.deadline_to)
        if filters.verified is True:
            clauses.append("s.verified_at is not null")
        elif filters.verified is False:
            clauses.append("s.verified_at is null")

        order_by: str
        cursor_select: str
        if filters.sort is ScholarshipSort.DEADLINE_ASC:
            if cursor:
                if cursor["value"] == "__NULL__":
                    clauses.append("s.deadline is null and s.id > %s")
                    parameters.append(cursor["id"])
                else:
                    clauses.append(
                        "(s.deadline > %s::date or (s.deadline = %s::date and s.id > %s) "
                        "or s.deadline is null)"
                    )
                    parameters.extend([cursor["value"], cursor["value"], cursor["id"]])
            order_by = "s.deadline asc nulls last, s.id"
            cursor_select = "s.deadline"
        elif filters.sort is ScholarshipSort.RECENTLY_PUBLISHED:
            if cursor:
                if cursor["value"] == "__NULL__":
                    clauses.append("s.published_at is null and s.id < %s")
                    parameters.append(cursor["id"])
                else:
                    clauses.append(
                        "(s.published_at < %s::timestamptz "
                        "or (s.published_at = %s::timestamptz and s.id < %s) "
                        "or s.published_at is null)"
                    )
                    parameters.extend([cursor["value"], cursor["value"], cursor["id"]])
            order_by = "s.published_at desc nulls last, s.id desc"
            cursor_select = "s.published_at"
        elif filters.sort is ScholarshipSort.AMOUNT_DESC:
            if cursor:
                if cursor["value"] == "__NULL__":
                    clauses.append("s.amount is null and s.id < %s")
                    parameters.append(cursor["id"])
                else:
                    clauses.append(
                        "(s.amount < %s::numeric or (s.amount = %s::numeric and s.id < %s) "
                        "or s.amount is null)"
                    )
                    parameters.extend([cursor["value"], cursor["value"], cursor["id"]])
            order_by = "s.amount desc nulls last, s.id desc"
            cursor_select = "s.amount"
        else:
            if cursor:
                clauses.append("(lower(s.title), s.id) > (%s, %s)")
                parameters.extend([cursor["value"], cursor["id"]])
            order_by = "lower(s.title), s.id"
            cursor_select = "lower(s.title)"

        statement = f"""
            select s.*, p.name as provider_name, p.website_url as provider_website_url,
              {cursor_select} as cursor_value
            from public.scholarships s
            join public.scholarship_providers p on p.id = s.provider_id
            where {" and ".join(clauses)}
            order by {order_by}
            limit %s
        """
        parameters.append(limit)
        result = await self._connection.execute(statement, parameters)
        return [dict(row) for row in await result.fetchall()]

    async def requirements(self, scholarship_id: UUID) -> list[DatabaseRow]:
        cursor = await self._connection.execute(
            """
            select * from public.scholarship_requirements
            where scholarship_id = %s order by position, id
            """,
            (scholarship_id,),
        )
        return [dict(row) for row in await cursor.fetchall()]

    async def provenance(self, scholarship_id: UUID) -> list[DatabaseRow]:
        cursor = await self._connection.execute(
            """
            select ss.source, ss.source_record_id, ss.canonical_url as source_url,
              rr.source_version, ss.first_seen_at, ss.last_seen_at, ss.trusted
            from public.scholarship_sources ss
            join public.ingestion_raw_records rr on rr.id = ss.raw_record_id
            where ss.scholarship_id = %s and ss.active
            order by ss.last_seen_at desc, ss.id
            """,
            (scholarship_id,),
        )
        return [dict(row) for row in await cursor.fetchall()]


class PostgresCatalogAdminRepository(_PostgresRepository):
    async def upsert_provider(self, name: str, website_url: str | None) -> UUID:
        canonical_name = " ".join(name.split()).casefold()
        provider_cursor = await self._connection.execute(
            """
            insert into public.scholarship_providers (name, canonical_name, website_url)
            values (%s, %s, %s)
            on conflict (canonical_name) do update set
              website_url = coalesce(excluded.website_url, scholarship_providers.website_url)
            returning id
            """,
            (name, canonical_name, website_url),
        )
        provider = await provider_cursor.fetchone()
        if provider is None:
            raise RuntimeError("Provider upsert returned no row")
        return UUID(str(provider["id"]))

    async def get(self, scholarship_id: UUID) -> DatabaseRow | None:
        cursor = await self._connection.execute(
            """
            select s.*, p.name as provider_name, p.website_url as provider_website_url
            from public.scholarships s
            join public.scholarship_providers p on p.id = s.provider_id
            where s.id = %s
            """,
            (scholarship_id,),
        )
        return self._row(await cursor.fetchone())

    async def list_all(self, *, limit: int = 20) -> list[DatabaseRow]:
        cursor = await self._connection.execute(
            """
            select s.*, p.name as provider_name, p.website_url as provider_website_url
            from public.scholarships s
            join public.scholarship_providers p on p.id = s.provider_id
            order by s.updated_at desc, s.id
            limit %s
            """,
            (limit,),
        )
        return [dict(row) for row in await cursor.fetchall()]

    async def create(self, scholarship: ScholarshipWrite) -> DatabaseRow:
        provider_id = await self.upsert_provider(
            scholarship.provider_name, scholarship.provider_website_url
        )
        values = asdict(scholarship)
        values["provider_id"] = provider_id
        cursor = await self._connection.execute(
            """
            insert into public.scholarships (
              provider_id, title, description, amount, currency, funding_type,
              funding_summary, study_levels, fields_of_study, destination_countries,
              nationality_requirements, residency_requirements, required_documents,
              deadline, deadline_at, deadline_timezone, eligibility_summary, source_url,
              application_url, reviewer_notes, source_fingerprint, status
            ) values (
              %(provider_id)s, %(title)s, %(description)s, %(amount)s, %(currency)s,
              %(funding_type)s, %(funding_summary)s, %(study_levels)s,
              %(fields_of_study)s, %(destination_countries)s, %(nationality_requirements)s,
              %(residency_requirements)s, %(required_documents)s, %(deadline)s,
              %(deadline_at)s, %(deadline_timezone)s, %(eligibility_summary)s,
              %(source_url)s, %(application_url)s, %(reviewer_notes)s,
              %(source_fingerprint)s, 'draft'
            ) returning *
            """,
            values,
        )
        row = self._row(await cursor.fetchone())
        if row is None:
            raise RuntimeError("Scholarship insert returned no row")
        row["provider_name"] = scholarship.provider_name
        row["provider_website_url"] = scholarship.provider_website_url
        return row

    async def update(
        self, scholarship_id: UUID, expected_version: int, changes: dict[str, object]
    ) -> DatabaseRow | None:
        allowed = {
            "title",
            "description",
            "amount",
            "currency",
            "funding_type",
            "funding_summary",
            "study_levels",
            "fields_of_study",
            "destination_countries",
            "nationality_requirements",
            "residency_requirements",
            "required_documents",
            "deadline",
            "deadline_at",
            "deadline_timezone",
            "eligibility_summary",
            "application_url",
            "reviewer_notes",
        }
        selected = [(key, value) for key, value in changes.items() if key in allowed]
        if not selected:
            return await self.get(scholarship_id)
        assignments = ", ".join(f"{key} = %s" for key, _ in selected)
        parameters = [value.value if hasattr(value, "value") else value for _, value in selected]
        requires_review = any(key != "reviewer_notes" for key, _ in selected)
        parameters.extend([requires_review, requires_review])
        parameters.extend([scholarship_id, expected_version])
        cursor = await self._connection.execute(
            f"""
            update public.scholarships
            set {assignments},
              status = case when %s and status = 'published' then 'in_review' else status end,
              verified_at = case when %s and status = 'published' then null else verified_at end,
              data_version = data_version + 1
            where id = %s and data_version = %s and status <> 'archived'
            returning *
            """,
            parameters,
        )
        return self._row(await cursor.fetchone())

    async def transition(
        self,
        scholarship_id: UUID,
        expected_version: int,
        *,
        from_status: str,
        to_status: str,
        mark_verified: bool,
        clear_verification: bool,
        reviewer_notes: str | None,
    ) -> DatabaseRow | None:
        cursor = await self._connection.execute(
            """
            update public.scholarships set
              status = %s,
              reviewer_notes = coalesce(%s, reviewer_notes),
              verified_at = case when %s then statement_timestamp()
                                 when %s then null else verified_at end,
              published_at = case when %s = 'published' then statement_timestamp()
                                  else published_at end,
              data_version = data_version + 1
            where id = %s and data_version = %s and status = %s
            returning *
            """,
            (
                to_status,
                reviewer_notes,
                mark_verified,
                clear_verification,
                to_status,
                scholarship_id,
                expected_version,
                from_status,
            ),
        )
        return self._row(await cursor.fetchone())

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
              source, source_url, dry_run, original_run_id, created_by,
              adapter_version, source_version, idempotency_key, batch_size
            ) values (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            on conflict (source, idempotency_key) where idempotency_key is not null
            do update set source = excluded.source
            returning *
            """,
            (
                run.source,
                run.source_url,
                run.dry_run,
                run.original_run_id,
                run.created_by,
                run.adapter_version,
                run.source_version,
                run.idempotency_key,
                run.batch_size,
            ),
        )
        row = self._row(await cursor.fetchone())
        if row is None:
            raise RuntimeError("Ingestion run insert returned no row")
        return row

    async def get(self, run_id: UUID) -> DatabaseRow | None:
        cursor = await self._connection.execute(
            "select * from public.ingestion_runs where id = %s",
            (run_id,),
        )
        return self._row(await cursor.fetchone())

    async def list_recent(self, *, limit: int = 20) -> list[DatabaseRow]:
        cursor = await self._connection.execute(
            "select * from public.ingestion_runs order by created_at desc, id limit %s",
            (limit,),
        )
        return [dict(row) for row in await cursor.fetchall()]

    async def claim(self, run_id: UUID) -> DatabaseRow | None:
        cursor = await self._connection.execute(
            """
            update public.ingestion_runs set
              status = 'running',
              started_at = coalesce(started_at, statement_timestamp()),
              last_heartbeat_at = statement_timestamp(),
              attempt_count = attempt_count + 1
            where id = %s and status in ('queued', 'partial')
            returning *
            """,
            (run_id,),
        )
        return self._row(await cursor.fetchone())

    async def store_raw(
        self, run_id: UUID, position: int, batch_number: int, record: RawSourceRecordWrite
    ) -> DatabaseRow:
        values = asdict(record)
        values["run_id"] = run_id
        cursor = await self._connection.execute(
            """
            insert into public.ingestion_raw_records (
              run_id, source, source_record_id, source_url, source_version,
              content_sha256, payload, fetched_at, terms_checked_at, robots_allowed
            ) values (
              %(run_id)s, %(source)s, %(source_record_id)s, %(source_url)s,
              %(source_version)s, %(content_sha256)s, %(payload)s, %(fetched_at)s,
              %(terms_checked_at)s, %(robots_allowed)s
            )
            on conflict (run_id, source, source_record_id, content_sha256) do nothing
            returning *
            """,
            {**values, "payload": Jsonb(record.payload)},
        )
        row = self._row(await cursor.fetchone())
        if row is None:
            existing = await self._connection.execute(
                """
                select * from public.ingestion_raw_records
                where run_id = %s and source = %s and source_record_id = %s
                  and content_sha256 = %s
                """,
                (run_id, record.source, record.source_record_id, record.content_sha256),
            )
            row = self._row(await existing.fetchone())
        if row is None:
            raise RuntimeError("Raw source record insert returned no row")
        await self._connection.execute(
            """
            insert into public.ingestion_items (run_id, raw_record_id, batch_number, position)
            values (%s, %s, %s, %s)
            on conflict (run_id, raw_record_id) do nothing
            """,
            (run_id, row["id"], batch_number, position),
        )
        return row

    async def apply_normalized(
        self,
        run_id: UUID,
        raw_record_id: UUID,
        normalized: NormalizedSourceWrite,
        *,
        dry_run: bool,
    ) -> str:
        source_cursor = await self._connection.execute(
            """
            select ss.id as source_link_id, ss.scholarship_id, s.*,
              p.name as provider_name, p.website_url as provider_website_url
            from public.scholarship_sources ss
            join public.scholarships s on s.id = ss.scholarship_id
            join public.scholarship_providers p on p.id = s.provider_id
            where ss.canonical_url = %s
            for update of ss, s
            """,
            (normalized.canonical_url,),
        )
        existing = self._row(await source_cursor.fetchone())
        if existing is None:
            candidates_cursor = await self._connection.execute(
                """
                select distinct scholarship_id from public.scholarship_sources
                where fingerprint = %s and canonical_url <> %s and active
                limit 21
                """,
                (normalized.fingerprint, normalized.canonical_url),
            )
            candidates = [
                UUID(str(row["scholarship_id"])) for row in await candidates_cursor.fetchall()
            ]
            if candidates:
                await self.reject(
                    run_id,
                    raw_record_id,
                    reason_code="AMBIGUOUS_DUPLICATE",
                    safe_summary="Fingerprint matched a different canonical source URL.",
                    fingerprint=normalized.fingerprint,
                    candidates=candidates[:20],
                )
                return "duplicate"
            if dry_run:
                await self._complete_item(run_id, raw_record_id, None)
                return "created"
            row = await PostgresCatalogAdminRepository(self._connection).create(
                normalized.scholarship
            )
            scholarship_id = UUID(str(row["id"]))
            await PostgresCatalogAdminRepository(self._connection).replace_requirements(
                scholarship_id, normalized.requirements
            )
            raw_cursor = await self._connection.execute(
                "select fetched_at from public.ingestion_raw_records where id = %s",
                (raw_record_id,),
            )
            raw = await raw_cursor.fetchone()
            if raw is None:
                raise RuntimeError("Raw record not found")
            await self._connection.execute(
                """
                insert into public.scholarship_sources (
                  scholarship_id, raw_record_id, source, source_record_id, canonical_url,
                  fingerprint, trusted, first_seen_at, last_seen_at
                ) values (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    scholarship_id,
                    raw_record_id,
                    normalized.source,
                    normalized.source_record_id,
                    normalized.canonical_url,
                    normalized.fingerprint,
                    normalized.trusted,
                    raw["fetched_at"],
                    raw["fetched_at"],
                ),
            )
            if normalized.trusted:
                await self._connection.execute(
                    """
                    update public.scholarships set status = 'published',
                      verified_at = statement_timestamp(), published_at = statement_timestamp()
                    where id = %s
                    """,
                    (scholarship_id,),
                )
            await self._complete_item(run_id, raw_record_id, scholarship_id)
            return "created"

        scholarship_id = UUID(str(existing["scholarship_id"]))
        fields = asdict(normalized.scholarship)
        fields.pop("provider_name")
        fields.pop("provider_website_url")
        fields.pop("source_fingerprint")
        changed = {
            key: value
            for key, value in fields.items()
            if self._comparable(existing.get(key)) != self._comparable(value)
        }
        provider_changed = " ".join(str(existing["provider_name"]).split()).casefold() != " ".join(
            normalized.scholarship.provider_name.split()
        ).casefold() or (
            normalized.scholarship.provider_website_url is not None
            and existing.get("provider_website_url") != normalized.scholarship.provider_website_url
        )
        requirements_cursor = await self._connection.execute(
            """
            select constraint_type, field, operator, value, source_evidence,
              reviewer_notes, position
            from public.scholarship_requirements
            where scholarship_id = %s order by position, id
            """,
            (scholarship_id,),
        )
        existing_requirements = [dict(row) for row in await requirements_cursor.fetchall()]
        normalized_requirements = [asdict(item) for item in normalized.requirements]
        requirements_changed = existing_requirements != normalized_requirements
        normalized_changed = bool(changed) or requirements_changed or provider_changed
        if dry_run:
            await self._complete_item(run_id, raw_record_id, scholarship_id)
            return "updated" if normalized_changed else "unchanged"
        if provider_changed:
            changed["provider_id"] = await PostgresCatalogAdminRepository(
                self._connection
            ).upsert_provider(
                normalized.scholarship.provider_name,
                normalized.scholarship.provider_website_url,
            )
        raw_cursor = await self._connection.execute(
            "select fetched_at from public.ingestion_raw_records where id = %s",
            (raw_record_id,),
        )
        raw = await raw_cursor.fetchone()
        if raw is None:
            raise RuntimeError("Raw record not found")
        await self._connection.execute(
            """
            update public.scholarship_sources set raw_record_id = %s, fingerprint = %s,
              last_seen_at = %s, active = true
            where id = %s
            """,
            (
                raw_record_id,
                normalized.fingerprint,
                raw["fetched_at"],
                existing["source_link_id"],
            ),
        )
        if normalized_changed:
            for field_name, new_value in changed.items():
                await self._connection.execute(
                    """
                    insert into public.scholarship_field_history (
                      scholarship_id, raw_record_id, field_name, old_value, new_value,
                      change_source
                    ) values (%s, %s, %s, %s, %s, 'ingestion')
                    """,
                    (
                        scholarship_id,
                        raw_record_id,
                        field_name,
                        Jsonb(self._json_value(existing.get(field_name))),
                        Jsonb(self._json_value(new_value)),
                    ),
                )
            if requirements_changed:
                await self._connection.execute(
                    """
                    insert into public.scholarship_field_history (
                      scholarship_id, raw_record_id, field_name, old_value, new_value,
                      change_source
                    ) values (%s, %s, 'requirements', %s, %s, 'ingestion')
                    """,
                    (
                        scholarship_id,
                        raw_record_id,
                        Jsonb(existing_requirements),
                        Jsonb(normalized_requirements),
                    ),
                )
            assignments = ", ".join(f"{key} = %s" for key in changed)
            assignments = f"{assignments}, " if assignments else ""
            await self._connection.execute(
                f"""
                update public.scholarships set {assignments}source_fingerprint = %s,
                  status = case when %s then status else 'in_review' end,
                  verified_at = case when %s then verified_at else null end,
                  data_version = data_version + 1
                where id = %s
                """,
                [
                    *list(changed.values()),
                    normalized.fingerprint,
                    normalized.trusted,
                    normalized.trusted,
                    scholarship_id,
                ],
            )
            if requirements_changed:
                await PostgresCatalogAdminRepository(self._connection).replace_requirements(
                    scholarship_id, normalized.requirements
                )
        await self._complete_item(run_id, raw_record_id, scholarship_id)
        return "updated" if normalized_changed else "unchanged"

    async def reject(
        self,
        run_id: UUID,
        raw_record_id: UUID | None,
        *,
        reason_code: str,
        safe_summary: str,
        fingerprint: str | None = None,
        candidates: Sequence[UUID] = (),
    ) -> None:
        await self._connection.execute(
            """
            insert into public.ingestion_quarantine (
              run_id, raw_record_id, reason_code, safe_summary, fingerprint,
              candidate_scholarship_ids
            ) values (%s, %s, %s, %s, %s, %s)
            """,
            (run_id, raw_record_id, reason_code, safe_summary, fingerprint, list(candidates)),
        )
        if raw_record_id is not None:
            await self._connection.execute(
                """
                update public.ingestion_items set status = 'rejected',
                  safe_error_code = %s, safe_error_summary = %s
                where run_id = %s and raw_record_id = %s
                """,
                (reason_code, safe_summary, run_id, raw_record_id),
            )

    async def advance(
        self,
        run_id: UUID,
        *,
        resume_cursor: int,
        counters: dict[str, int],
        status: str,
        safe_errors: list[dict[str, object]] | None = None,
    ) -> DatabaseRow:
        cursor = await self._connection.execute(
            """
            update public.ingestion_runs set
              resume_cursor = %s, counters = %s, status = %s,
              safe_errors = coalesce(%s, safe_errors),
              last_heartbeat_at = statement_timestamp(),
              completed_at = case when %s in ('completed', 'failed', 'dead_lettered')
                                  then statement_timestamp() else null end
            where id = %s
            returning *
            """,
            (
                resume_cursor,
                Jsonb(counters),
                status,
                Jsonb(safe_errors) if safe_errors is not None else None,
                status,
                run_id,
            ),
        )
        row = self._row(await cursor.fetchone())
        if row is None:
            raise RuntimeError("Ingestion run update returned no row")
        return row

    async def fail_item(
        self,
        run_id: UUID,
        raw_record_id: UUID,
        *,
        safe_error_code: str,
        safe_error_summary: str,
    ) -> bool:
        cursor = await self._connection.execute(
            """
            update public.ingestion_items set
              attempt_count = attempt_count + 1,
              status = case when attempt_count + 1 >= 3 then 'dead_letter' else 'pending' end,
              safe_error_code = %s,
              safe_error_summary = %s
            where run_id = %s and raw_record_id = %s
            returning status
            """,
            (safe_error_code, safe_error_summary, run_id, raw_record_id),
        )
        row = await cursor.fetchone()
        return row is not None and row["status"] == "dead_letter"

    async def _complete_item(
        self, run_id: UUID, raw_record_id: UUID, scholarship_id: UUID | None
    ) -> None:
        await self._connection.execute(
            """
            update public.ingestion_items set status = 'completed', scholarship_id = %s
            where run_id = %s and raw_record_id = %s
            """,
            (scholarship_id, run_id, raw_record_id),
        )

    @staticmethod
    def _comparable(value: object) -> object:
        if isinstance(value, Decimal):
            return value
        if isinstance(value, list):
            return tuple(value)
        return value

    @staticmethod
    def _json_value(value: object) -> object:
        if isinstance(value, Decimal):
            return str(value)
        if isinstance(value, UUID):
            return str(value)
        if isinstance(value, datetime):
            return value.isoformat()
        if hasattr(value, "isoformat"):
            return value.isoformat()
        return value


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
