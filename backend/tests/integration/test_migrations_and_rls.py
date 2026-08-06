import asyncio
import json
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import replace
from typing import Any
from uuid import UUID, uuid4

import psycopg
import pytest
from app.auth.models import ApplicationRole, CurrentUser
from app.db.principal import DatabasePrincipal
from app.db.unit_of_work import PostgresDatabase
from app.repositories.models import ProfileWrite
from app.services.ingestion import IngestionOrchestrator
from psycopg import errors, sql
from psycopg.rows import DictRow, dict_row

from tests.integration.conftest import BOOTSTRAP, MIGRATIONS, apply_sql_file

pytestmark = pytest.mark.postgres

OWNER_ID = UUID("10000000-0000-0000-0000-000000000001")
OTHER_ID = UUID("10000000-0000-0000-0000-000000000002")
ADMIN_ID = UUID("10000000-0000-0000-0000-000000000003")
PUBLISHED_PROVIDER_ID = UUID("20000000-0000-0000-0000-000000000001")
DRAFT_PROVIDER_ID = UUID("20000000-0000-0000-0000-000000000002")
PUBLISHED_SCHOLARSHIP_ID = UUID("30000000-0000-0000-0000-000000000001")
DRAFT_SCHOLARSHIP_ID = UUID("30000000-0000-0000-0000-000000000002")

TABLES = {
    "profiles",
    "scholarship_providers",
    "scholarships",
    "scholarship_requirements",
    "matches",
    "applications",
    "profile_documents",
    "notification_preferences",
    "ingestion_runs",
    "audit_events",
    "idempotency_keys",
    "ingestion_raw_records",
    "scholarship_sources",
    "scholarship_field_history",
    "ingestion_quarantine",
    "ingestion_items",
    "match_recalculation_jobs",
}

FOUNDATION_TABLES = TABLES - {
    "ingestion_raw_records",
    "scholarship_sources",
    "scholarship_field_history",
    "ingestion_quarantine",
    "ingestion_items",
    "match_recalculation_jobs",
}

EXPECTED_POLICIES = {
    "applications_owner_delete",
    "applications_owner_insert",
    "applications_owner_select",
    "applications_owner_update",
    "audit_events_admin_insert",
    "audit_events_admin_select",
    "ingestion_runs_admin_insert",
    "ingestion_runs_admin_select",
    "ingestion_runs_admin_update",
    "matches_owner_select",
    "notification_preferences_owner_delete",
    "notification_preferences_owner_insert",
    "notification_preferences_owner_select",
    "notification_preferences_owner_update",
    "profile_documents_owner_delete",
    "profile_documents_owner_insert",
    "profile_documents_owner_select",
    "profile_documents_owner_update",
    "profiles_owner_delete",
    "profiles_owner_insert",
    "profiles_owner_select",
    "profiles_owner_update",
    "scholarship_providers_admin_insert",
    "scholarship_providers_admin_update",
    "scholarship_providers_catalog_select",
    "scholarship_requirements_admin_delete",
    "scholarship_requirements_admin_insert",
    "scholarship_requirements_admin_update",
    "scholarship_requirements_catalog_select",
    "scholarships_admin_insert",
    "scholarships_admin_update",
    "scholarships_catalog_select",
    "scholarship_sources_catalog_select",
    "scholarship_field_history_admin_select",
    "ingestion_quarantine_admin_select",
    "ingestion_items_admin_select",
    "match_recalculation_jobs_owner_select",
}

AUTHORIZATION_POLICIES = EXPECTED_POLICIES - {
    "scholarship_sources_catalog_select",
    "scholarship_field_history_admin_select",
    "ingestion_quarantine_admin_select",
    "ingestion_items_admin_select",
    "match_recalculation_jobs_owner_select",
}
CATALOG_TABLES = TABLES - {"match_recalculation_jobs"}
CATALOG_POLICIES = EXPECTED_POLICIES - {"match_recalculation_jobs_owner_select"}


def _schema_state(database_url: str) -> tuple[set[str], set[str], set[str]]:
    with psycopg.connect(database_url) as connection:
        tables = {
            row[0]
            for row in connection.execute(
                "select tablename from pg_tables where schemaname = 'public'"
            ).fetchall()
        }
        rls_tables = {
            row[0]
            for row in connection.execute(
                "select relname from pg_class c join pg_namespace n on n.oid = c.relnamespace "
                "where n.nspname = 'public' and c.relrowsecurity"
            ).fetchall()
        }
        policies = {
            row[0]
            for row in connection.execute(
                "select policyname from pg_policies where schemaname = 'public'"
            ).fetchall()
        }
    return tables, rls_tables, policies


def test_migrations_apply_from_empty(isolated_database_url: str) -> None:
    with psycopg.connect(isolated_database_url, autocommit=True) as connection:
        apply_sql_file(connection, BOOTSTRAP)
        for migration in MIGRATIONS:
            apply_sql_file(connection, migration)

    tables, rls_tables, policies = _schema_state(isolated_database_url)
    assert tables == TABLES
    assert rls_tables == TABLES
    assert policies == EXPECTED_POLICIES


def test_authorization_migration_applies_to_previous_state(isolated_database_url: str) -> None:
    foundation, authorization, *_ = MIGRATIONS
    with psycopg.connect(isolated_database_url, autocommit=True) as connection:
        apply_sql_file(connection, BOOTSTRAP)
        apply_sql_file(connection, foundation)
    _, rls_before, policies_before = _schema_state(isolated_database_url)
    assert rls_before == set()
    assert policies_before == set()

    with psycopg.connect(isolated_database_url, autocommit=True) as connection:
        apply_sql_file(connection, authorization)
    _, rls_after, policies_after = _schema_state(isolated_database_url)
    assert rls_after == FOUNDATION_TABLES
    assert policies_after == AUTHORIZATION_POLICIES


def test_profile_document_migration_applies_to_previous_state(
    isolated_database_url: str,
) -> None:
    foundation, authorization, vertical_slice, _, _ = MIGRATIONS
    with psycopg.connect(isolated_database_url, autocommit=True) as connection:
        apply_sql_file(connection, BOOTSTRAP)
        apply_sql_file(connection, foundation)
        apply_sql_file(connection, authorization)
        apply_sql_file(connection, vertical_slice)
        columns = {
            row[0]
            for row in connection.execute(
                "select column_name from information_schema.columns "
                "where table_schema = 'public' and table_name = 'profiles'"
            ).fetchall()
        }
    assert {"gpa_scale", "date_of_birth", "target_countries"} <= columns


def test_catalog_ingestion_migration_applies_to_previous_state(
    isolated_database_url: str,
) -> None:
    foundation, authorization, vertical_slice, catalog_ingestion, _ = MIGRATIONS
    with psycopg.connect(isolated_database_url, autocommit=True) as connection:
        apply_sql_file(connection, BOOTSTRAP)
        apply_sql_file(connection, foundation)
        apply_sql_file(connection, authorization)
        apply_sql_file(connection, vertical_slice)
        apply_sql_file(connection, catalog_ingestion)

    tables, rls_tables, policies = _schema_state(isolated_database_url)
    assert tables == CATALOG_TABLES
    assert rls_tables == CATALOG_TABLES
    assert policies == CATALOG_POLICIES


def test_matching_migration_applies_to_previous_state(
    isolated_database_url: str,
) -> None:
    *previous, matching = MIGRATIONS
    with psycopg.connect(isolated_database_url, autocommit=True) as connection:
        apply_sql_file(connection, BOOTSTRAP)
        for migration in previous:
            apply_sql_file(connection, migration)
        apply_sql_file(connection, matching)
        profile_columns = {
            row[0]
            for row in connection.execute(
                "select column_name from information_schema.columns "
                "where table_schema = 'public' and table_name = 'profiles'"
            ).fetchall()
        }
        match_columns = {
            row[0]
            for row in connection.execute(
                "select column_name from information_schema.columns "
                "where table_schema = 'public' and table_name = 'matches'"
            ).fetchall()
        }

    tables, rls_tables, policies = _schema_state(isolated_database_url)
    assert {"institution_name", "experience_months"} <= profile_columns
    assert {"eligibility_status", "missing_profile_fields"} <= match_columns
    assert "match_recalculation_jobs" in tables
    assert "match_recalculation_jobs" in rls_tables
    assert "match_recalculation_jobs_owner_select" in policies


def _seed(database_url: str) -> None:
    with psycopg.connect(database_url) as connection:
        connection.execute(
            "insert into auth.users (id) values (%s), (%s), (%s)",
            (OWNER_ID, OTHER_ID, ADMIN_ID),
        )
        connection.execute(
            "insert into public.profiles (id, full_name, country, study_level) values "
            "(%s, 'Owner', 'BW', 'undergraduate'), "
            "(%s, 'Other', 'ZA', 'postgraduate'), "
            "(%s, 'Administrator', 'BW', 'other')",
            (OWNER_ID, OTHER_ID, ADMIN_ID),
        )
        connection.execute(
            "insert into public.scholarship_providers (id, name, canonical_name) values "
            "(%s, 'Published Provider', 'published provider'), "
            "(%s, 'Draft Provider', 'draft provider')",
            (PUBLISHED_PROVIDER_ID, DRAFT_PROVIDER_ID),
        )
        connection.execute(
            "insert into public.scholarships (id, provider_id, title, source_url, status) "
            "values (%s, %s, 'Published Award', 'https://example.org/published', 'published')",
            (PUBLISHED_SCHOLARSHIP_ID, PUBLISHED_PROVIDER_ID),
        )
        connection.execute(
            "insert into public.scholarships (id, provider_id, title, source_url, status) "
            "values (%s, %s, 'Draft Award', 'https://example.org/draft', 'draft')",
            (DRAFT_SCHOLARSHIP_ID, DRAFT_PROVIDER_ID),
        )
        connection.execute(
            "insert into public.scholarship_requirements "
            "(scholarship_id, constraint_type, field, operator, value, position) values "
            "(%s, 'hard', 'study_level', 'equals', '\"undergraduate\"', 0), "
            "(%s, 'soft', 'field_of_study', 'contains', '\"science\"', 0)",
            (PUBLISHED_SCHOLARSHIP_ID, DRAFT_SCHOLARSHIP_ID),
        )
        for profile_id in (OWNER_ID, OTHER_ID):
            connection.execute(
                "insert into public.matches "
                "(profile_id, scholarship_id, total_score, confidence, algorithm_version, "
                "profile_data_version, scholarship_data_version) "
                "values (%s, %s, 0.8, 0.9, 'v1', 1, 1)",
                (profile_id, PUBLISHED_SCHOLARSHIP_ID),
            )
            connection.execute(
                "insert into public.match_recalculation_jobs "
                "(profile_id, profile_data_version, algorithm_version) values (%s, 1, 'v1')",
                (profile_id,),
            )
            connection.execute(
                "insert into public.applications (profile_id, scholarship_id) values (%s, %s)",
                (profile_id, PUBLISHED_SCHOLARSHIP_ID),
            )
            connection.execute(
                "insert into public.profile_documents "
                "(profile_id, storage_bucket, storage_object_path, document_type, display_name, "
                "original_filename, mime_type, size_bytes, checksum_sha256) "
                "values (%s, 'private-documents', %s, 'cv', 'CV', 'cv.pdf', "
                "'application/pdf', 100, %s)",
                (profile_id, f"{profile_id}/cv.pdf", "a" * 64),
            )
            connection.execute(
                "insert into public.notification_preferences (profile_id) values (%s)",
                (profile_id,),
            )
        ingestion_id = connection.execute(
            "insert into public.ingestion_runs (source, created_by) values ('manual', %s) "
            "returning id",
            (ADMIN_ID,),
        ).fetchone()
        assert ingestion_id is not None
        connection.execute(
            "insert into public.audit_events "
            "(actor_id, action, target_type, target_id, target_name, summary) "
            "values (%s, 'ingestion.created', 'ingestion_run', %s, 'Manual run', 'Created run')",
            (ADMIN_ID, ingestion_id[0]),
        )
        connection.execute(
            "insert into public.idempotency_keys "
            "(actor_id, operation, key, request_hash, expires_at) "
            "values (%s, 'application.create', 'owner-key', %s, now() + interval '1 day')",
            (OWNER_ID, "b" * 64),
        )


@contextmanager
def _principal_connection(
    database_url: str,
    *,
    role: str,
    subject: UUID | None = None,
    application_role: str = "user",
) -> Iterator[psycopg.Connection[DictRow]]:
    with psycopg.connect(database_url, row_factory=dict_row) as connection:
        with connection.transaction():
            connection.execute(sql.SQL("set local role {}").format(sql.Identifier(role)))
            claims: dict[str, Any] = {"role": role, "app_metadata": {"role": application_role}}
            if subject is not None:
                claims["sub"] = str(subject)
            connection.execute(
                "select set_config('request.jwt.claims', %s, true)",
                (json.dumps(claims),),
            )
            yield connection


def _count(connection: psycopg.Connection[DictRow], table: str) -> int:
    row = connection.execute(
        sql.SQL("select count(*) as count from public.{}").format(sql.Identifier(table))
    ).fetchone()
    assert row is not None
    return int(row["count"])


def test_rls_access_matrix(migrated_database_url: str) -> None:
    _seed(migrated_database_url)

    for table in TABLES:
        with pytest.raises(errors.InsufficientPrivilege):
            with _principal_connection(migrated_database_url, role="anon") as anonymous:
                _count(anonymous, table)

    user_expected = {
        "profiles": 1,
        "scholarship_providers": 1,
        "scholarships": 1,
        "scholarship_requirements": 1,
        "matches": 1,
        "applications": 1,
        "profile_documents": 1,
        "notification_preferences": 1,
        "ingestion_runs": 0,
        "audit_events": 0,
        "scholarship_sources": 0,
        "scholarship_field_history": 0,
        "ingestion_quarantine": 0,
        "ingestion_items": 0,
        "match_recalculation_jobs": 1,
    }
    for subject in (OWNER_ID, OTHER_ID):
        with _principal_connection(
            migrated_database_url, role="authenticated", subject=subject
        ) as user:
            assert {table: _count(user, table) for table in user_expected} == user_expected
        with pytest.raises(errors.InsufficientPrivilege):
            with _principal_connection(
                migrated_database_url, role="authenticated", subject=subject
            ) as user:
                _count(user, "idempotency_keys")
        with pytest.raises(errors.InsufficientPrivilege):
            with _principal_connection(
                migrated_database_url, role="authenticated", subject=subject
            ) as user:
                _count(user, "ingestion_raw_records")

    with _principal_connection(
        migrated_database_url,
        role="authenticated",
        subject=ADMIN_ID,
        application_role="admin",
    ) as administrator:
        assert _count(administrator, "profiles") == 1
        assert _count(administrator, "matches") == 0
        assert _count(administrator, "applications") == 0
        assert _count(administrator, "profile_documents") == 0
        assert _count(administrator, "notification_preferences") == 0
        assert _count(administrator, "scholarship_providers") == 2
        assert _count(administrator, "scholarships") == 2
        assert _count(administrator, "scholarship_requirements") == 2
        assert _count(administrator, "ingestion_runs") == 1
        assert _count(administrator, "audit_events") == 1
        assert _count(administrator, "scholarship_sources") == 0
        assert _count(administrator, "scholarship_field_history") == 0
        assert _count(administrator, "ingestion_quarantine") == 0
        assert _count(administrator, "ingestion_items") == 0
        assert _count(administrator, "match_recalculation_jobs") == 0
    with pytest.raises(errors.InsufficientPrivilege):
        with _principal_connection(
            migrated_database_url,
            role="authenticated",
            subject=ADMIN_ID,
            application_role="admin",
        ) as administrator:
            _count(administrator, "idempotency_keys")
    with pytest.raises(errors.InsufficientPrivilege):
        with _principal_connection(
            migrated_database_url,
            role="authenticated",
            subject=ADMIN_ID,
            application_role="admin",
        ) as administrator:
            _count(administrator, "ingestion_raw_records")

    with _principal_connection(migrated_database_url, role="service_role") as service:
        assert {table: _count(service, table) for table in TABLES} == {
            "profiles": 3,
            "scholarship_providers": 2,
            "scholarships": 2,
            "scholarship_requirements": 2,
            "matches": 2,
            "applications": 2,
            "profile_documents": 2,
            "notification_preferences": 2,
            "ingestion_runs": 1,
            "audit_events": 1,
            "idempotency_keys": 1,
            "ingestion_raw_records": 0,
            "scholarship_sources": 0,
            "scholarship_field_history": 0,
            "ingestion_quarantine": 0,
            "ingestion_items": 0,
            "match_recalculation_jobs": 2,
        }


def test_rls_owner_mutations_admin_minimum_access_and_append_only_audit(
    migrated_database_url: str,
) -> None:
    _seed(migrated_database_url)

    with _principal_connection(
        migrated_database_url, role="authenticated", subject=OWNER_ID
    ) as owner:
        own_update = owner.execute(
            "update public.profiles set full_name = 'Owner Updated' where id = %s", (OWNER_ID,)
        )
        other_update = owner.execute(
            "update public.profiles set full_name = 'Stolen' where id = %s", (OTHER_ID,)
        )
        assert own_update.rowcount == 1
        assert other_update.rowcount == 0

    with pytest.raises(errors.InsufficientPrivilege):
        with _principal_connection(
            migrated_database_url, role="authenticated", subject=OWNER_ID
        ) as owner:
            owner.execute(
                "insert into public.profile_documents "
                "(profile_id, storage_bucket, storage_object_path, document_type, display_name, "
                "original_filename, mime_type, size_bytes, checksum_sha256) values "
                "(%s, 'private-documents', 'forbidden/path', 'cv', 'CV', 'cv.pdf', "
                "'application/pdf', 1, %s)",
                (OTHER_ID, "c" * 64),
            )

    with _principal_connection(
        migrated_database_url,
        role="authenticated",
        subject=ADMIN_ID,
        application_role="admin",
    ) as administrator:
        assert (
            administrator.execute(
                "insert into public.scholarship_providers (name, canonical_name) "
                "values ('Admin Provider', 'admin provider')"
            ).rowcount
            == 1
        )
        assert (
            administrator.execute(
                "insert into public.ingestion_runs (source, created_by) values ('admin', %s)",
                (ADMIN_ID,),
            ).rowcount
            == 1
        )
        assert (
            administrator.execute(
                "insert into public.audit_events "
                "(actor_id, action, target_type, target_id, target_name, summary) "
                "values (%s, 'verification.completed', 'verification', %s, 'Check', 'Verified')",
                (ADMIN_ID, PUBLISHED_SCHOLARSHIP_ID),
            ).rowcount
            == 1
        )
        assert (
            administrator.execute(
                "update public.profiles set full_name = 'Admin Override' where id = %s", (OWNER_ID,)
            ).rowcount
            == 0
        )
    with pytest.raises(errors.InsufficientPrivilege):
        with _principal_connection(
            migrated_database_url,
            role="authenticated",
            subject=ADMIN_ID,
            application_role="admin",
        ) as administrator:
            administrator.execute(
                "delete from public.scholarships where id = %s", (DRAFT_SCHOLARSHIP_ID,)
            )

    with pytest.raises(errors.ObjectNotInPrerequisiteState):
        with _principal_connection(migrated_database_url, role="service_role") as service:
            service.execute("delete from public.audit_events")


def test_known_query_indexes_exist(migrated_database_url: str) -> None:
    expected = {
        "scholarships_status_deadline_idx",
        "scholarships_status_verified_idx",
        "scholarships_status_currency_amount_idx",
        "scholarships_status_funding_type_idx",
        "scholarships_search_idx",
        "scholarships_status_published_idx",
        "scholarships_status_title_idx",
        "matches_profile_score_idx",
        "applications_profile_created_idx",
        "applications_profile_deadline_idx",
        "applications_profile_status_idx",
        "profile_documents_active_profile_created_idx",
        "ingestion_runs_status_created_idx",
        "audit_events_target_idx",
        "idempotency_keys_expires_idx",
        "ingestion_runs_source_idempotency_key",
        "ingestion_runs_one_active_source_idx",
        "ingestion_raw_records_run_idx",
        "scholarship_sources_fingerprint_idx",
        "ingestion_quarantine_run_idx",
        "ingestion_items_claim_idx",
        "matches_profile_version_idx",
        "matches_ranked_profile_score_idx",
        "match_recalculation_jobs_profile_created_idx",
        "match_recalculation_jobs_claim_idx",
    }
    with psycopg.connect(migrated_database_url) as connection:
        actual = {
            row[0]
            for row in connection.execute(
                "select indexname from pg_indexes where schemaname = 'public'"
            ).fetchall()
        }
    assert expected <= actual


def test_catalog_query_plans_use_known_shape_indexes(migrated_database_url: str) -> None:
    queries = {
        "scholarships_status_deadline_idx": (
            "select id from public.scholarships where status = 'published' "
            "order by deadline nulls last, id limit 20"
        ),
        "scholarships_status_currency_amount_idx": (
            "select id from public.scholarships where status = 'published' "
            "and currency = 'USD' order by amount desc nulls last, id limit 20"
        ),
        "scholarships_status_published_idx": (
            "select id from public.scholarships where status = 'published' "
            "order by published_at desc nulls last, id desc limit 20"
        ),
        "scholarships_status_title_idx": (
            "select id from public.scholarships where status = 'published' "
            "order by lower(title), id limit 20"
        ),
        "scholarships_search_idx": (
            "select id from public.scholarships where "
            "to_tsvector('simple', coalesce(title, '') || ' ' || "
            "coalesce(description, '') || ' ' || coalesce(funding_summary, '')) "
            "@@ plainto_tsquery('simple', 'science')"
        ),
        "scholarships_study_levels_idx": (
            "select id from public.scholarships "
            "where study_levels @> array['undergraduate']::text[]"
        ),
        "matches_ranked_profile_score_idx": (
            "select id from public.matches "
            f"where profile_id = '{OWNER_ID}' and eligibility_status <> 'ineligible' "
            "order by total_score desc, id limit 20"
        ),
    }
    with psycopg.connect(migrated_database_url) as connection:
        connection.execute("set enable_seqscan = off")
        for index_name, query in queries.items():
            plan_rows = connection.execute(f"explain (format json) {query}").fetchall()
            assert index_name in json.dumps(plan_rows), query


def test_fixture_ingestion_repository_round_trip(migrated_database_url: str) -> None:
    baseline_run = uuid4()
    changed_run = uuid4()
    with psycopg.connect(migrated_database_url) as connection:
        connection.execute(
            """
            insert into public.ingestion_runs (
              id, source, adapter_version, source_version, idempotency_key, batch_size
            ) values (%s, 'fixture', '1.0.0', 'baseline', 'integration-baseline', 100)
            """,
            (baseline_run,),
        )

    async def execute(run_id: UUID) -> Any:
        database = PostgresDatabase(migrated_database_url, min_size=1, max_size=2)
        orchestrator = IngestionOrchestrator(database)
        await database.open()
        try:
            return await orchestrator.run_fixture_batch(run_id)
        finally:
            await database.close()

    baseline = asyncio.run(execute(baseline_run))
    assert baseline.status == "completed"
    assert baseline.counters["created"] == 2

    with psycopg.connect(migrated_database_url) as connection:
        connection.execute(
            """
            insert into public.ingestion_runs (
              id, source, adapter_version, source_version, idempotency_key, batch_size
            ) values (%s, 'fixture', '1.0.0', 'changed', 'integration-changed', 100)
            """,
            (changed_run,),
        )
    changed = asyncio.run(execute(changed_run))
    assert changed.status == "completed"
    with psycopg.connect(migrated_database_url) as connection:
        changed_fields = connection.execute(
            "select field_name from public.scholarship_field_history order by field_name"
        ).fetchall()
    assert changed.counters["updated"] == 1, changed_fields
    assert changed.counters["unchanged"] == 1

    with psycopg.connect(migrated_database_url) as connection:
        counts = connection.execute(
            """
            select
              (select count(*) from public.ingestion_raw_records) as raw_count,
              (select count(*) from public.scholarship_sources) as source_count,
              (select count(*) from public.scholarships where status = 'published') as published,
              (select count(*) from public.scholarship_field_history) as history_count,
              (select count(*) from public.ingestion_items where status = 'completed') as completed
            """
        ).fetchone()
    assert counts == (4, 2, 0, 2, 4)


def test_unit_of_work_commits_and_rolls_back_multi_table_mutations(
    migrated_database_url: str,
) -> None:
    _seed(migrated_database_url)

    async def scenario() -> None:
        database = PostgresDatabase(migrated_database_url, min_size=1, max_size=2)
        principal = DatabasePrincipal.for_user(CurrentUser(id=OWNER_ID, role=ApplicationRole.USER))
        profile = ProfileWrite(
            full_name="Rolled Back",
            country="BW",
            study_level="undergraduate",
            field_of_study="Computer Science",
            gpa=3.5,
            gpa_scale=4,
            nationality_country=None,
            residence_country=None,
            date_of_birth=None,
            interests=["AI"],
            target_countries=[],
            goals="Graduate study",
            requires_financial_aid=None,
            willing_to_relocate=None,
            data_version=2,
        )
        await database.open()
        try:
            with pytest.raises(RuntimeError, match="force rollback"):
                async with database.unit_of_work(principal) as unit_of_work:
                    await unit_of_work.profiles.upsert(OWNER_ID, profile)
                    await unit_of_work.notifications.upsert(
                        OWNER_ID,
                        deadline_reminders_enabled=False,
                        product_updates_enabled=True,
                        reminder_days=[5, 1],
                        timezone="Africa/Gaborone",
                    )
                    raise RuntimeError("force rollback")

            async with database.unit_of_work(principal) as unit_of_work:
                rolled_back_profile = await unit_of_work.profiles.get(OWNER_ID)
                rolled_back_notifications = await unit_of_work.notifications.get(OWNER_ID)
            assert rolled_back_profile is not None
            assert rolled_back_profile["full_name"] == "Owner"
            assert rolled_back_notifications is not None
            assert rolled_back_notifications["timezone"] == "UTC"

            committed_profile = replace(profile, full_name="Committed")
            async with database.unit_of_work(principal) as unit_of_work:
                await unit_of_work.profiles.upsert(OWNER_ID, committed_profile)
                await unit_of_work.notifications.upsert(
                    OWNER_ID,
                    deadline_reminders_enabled=False,
                    product_updates_enabled=True,
                    reminder_days=[5, 1],
                    timezone="Africa/Gaborone",
                )

            async with database.unit_of_work(principal) as unit_of_work:
                committed = await unit_of_work.profiles.get(OWNER_ID)
                notifications = await unit_of_work.notifications.get(OWNER_ID)
            assert committed is not None
            assert committed["full_name"] == "Committed"
            assert notifications is not None
            assert notifications["timezone"] == "Africa/Gaborone"
        finally:
            await database.close()

    asyncio.run(scenario())
