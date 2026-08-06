import asyncio
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from dataclasses import asdict
from datetime import UTC, date, datetime
from decimal import Decimal
from typing import Any, cast
from uuid import UUID, uuid4

import pytest
from app.auth.models import ApplicationRole, CurrentUser
from app.core.config import Environment, Settings
from app.core.errors import ApiError
from app.db.principal import DatabasePrincipal
from app.db.protocols import Database
from app.main import create_app
from app.repositories.interfaces import DatabaseRow
from app.repositories.models import NormalizedSourceWrite, RawSourceRecordWrite
from app.schemas.scholarship import CatalogFilters, LifecycleTransition, ScholarshipSort
from app.services.catalog import CatalogAdminService, CatalogService
from app.services.ingestion import (
    FetchPolicy,
    FixtureSourceAdapter,
    IngestionOrchestrator,
    RawSourceRecord,
    SourceFetchError,
    normalize_source_record,
)
from fastapi.testclient import TestClient

NOW = datetime(2026, 8, 6, 12, tzinfo=UTC)
ADMIN = CurrentUser(id=UUID("10000000-0000-0000-0000-000000000001"), role=ApplicationRole.ADMIN)


def _scholarship_row(
    *, scholarship_id: UUID | None = None, status: str = "published", version: int = 1
) -> DatabaseRow:
    return {
        "id": scholarship_id or uuid4(),
        "provider_id": uuid4(),
        "provider_name": "Fixture Foundation",
        "provider_website_url": "https://fixtures.example/",
        "title": "Science Award",
        "description": "A deterministic public record.",
        "amount": Decimal("10000.00"),
        "currency": "USD",
        "funding_type": "partial",
        "funding_summary": None,
        "study_levels": ["undergraduate"],
        "fields_of_study": ["Science"],
        "destination_countries": ["US"],
        "nationality_requirements": [],
        "residency_requirements": [],
        "required_documents": [],
        "deadline": date(2027, 5, 31),
        "deadline_at": None,
        "deadline_timezone": None,
        "eligibility_summary": None,
        "source_url": "https://fixtures.example/scholarships/science",
        "application_url": None,
        "status": status,
        "reviewer_notes": None,
        "verified_at": NOW if status in {"published", "in_review"} else None,
        "published_at": NOW if status == "published" else None,
        "data_version": version,
        "created_at": NOW,
        "updated_at": NOW,
    }


def _requirement() -> DatabaseRow:
    return {
        "id": uuid4(),
        "constraint_type": "hard",
        "field": "study_level",
        "operator": "in",
        "value": ["undergraduate"],
        "source_evidence": {},
        "position": 0,
        "version": 1,
    }


class FakeScholarships:
    def __init__(self, rows: list[DatabaseRow]) -> None:
        self.rows = rows
        self.last_cursor: dict[str, str] | None = None
        self.last_filters: CatalogFilters | None = None
        self.requirement_rows = [_requirement()]

    async def list_published(
        self,
        filters: CatalogFilters,
        *,
        cursor: dict[str, str] | None,
        limit: int,
    ) -> list[DatabaseRow]:
        self.last_filters = filters
        self.last_cursor = cursor
        return self.rows[:limit]

    async def get_published(self, scholarship_id: UUID) -> DatabaseRow | None:
        return next((row for row in self.rows if row["id"] == scholarship_id), None)

    async def requirements(self, scholarship_id: UUID) -> list[DatabaseRow]:
        del scholarship_id
        return self.requirement_rows

    async def provenance(self, scholarship_id: UUID) -> list[DatabaseRow]:
        del scholarship_id
        return [
            {
                "source": "fixture",
                "source_record_id": "fixture-001",
                "source_url": "https://fixtures.example/scholarships/science",
                "source_version": "baseline",
                "first_seen_at": NOW,
                "last_seen_at": NOW,
                "trusted": False,
            }
        ]


class FakeCatalogAdmin:
    def __init__(self, row: DatabaseRow) -> None:
        self.row = row

    async def get(self, scholarship_id: UUID) -> DatabaseRow | None:
        return self.row if self.row["id"] == scholarship_id else None

    async def list_all(self, *, limit: int) -> list[DatabaseRow]:
        return [self.row][:limit]

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
        if (
            self.row["id"] != scholarship_id
            or self.row["data_version"] != expected_version
            or self.row["status"] != from_status
        ):
            return None
        self.row["status"] = to_status
        self.row["data_version"] = expected_version + 1
        self.row["reviewer_notes"] = reviewer_notes
        if mark_verified:
            self.row["verified_at"] = NOW
        elif clear_verification:
            self.row["verified_at"] = None
        if to_status == "published":
            self.row["published_at"] = NOW
        return self.row


class FakeAudit:
    def __init__(self) -> None:
        self.events: list[object] = []

    async def append(self, event: object) -> DatabaseRow:
        self.events.append(event)
        return {"id": uuid4()}


class CatalogUnitOfWork:
    def __init__(
        self,
        scholarships: FakeScholarships,
        admin: FakeCatalogAdmin | None = None,
        audit: FakeAudit | None = None,
    ) -> None:
        self.scholarships = scholarships
        self.catalog_admin = admin
        self.audit = audit


class CatalogDatabase:
    def __init__(
        self,
        scholarships: FakeScholarships,
        admin: FakeCatalogAdmin | None = None,
        audit: FakeAudit | None = None,
    ) -> None:
        self.uow = CatalogUnitOfWork(scholarships, admin, audit)

    @asynccontextmanager
    async def unit_of_work(self, principal: DatabasePrincipal) -> AsyncIterator[object]:
        del principal
        yield self.uow


class StaticVerifier:
    def __init__(self, user: CurrentUser) -> None:
        self.user = user

    async def verify(self, token: str) -> CurrentUser:
        del token
        return self.user


def test_public_catalog_is_anonymous_and_admin_routes_enforce_role() -> None:
    repository = FakeScholarships([_scholarship_row(), _scholarship_row()])
    database = CatalogDatabase(repository)
    settings = Settings(
        _env_file=None,
        environment=Environment.TEST,
        cors_allowed_origins=["http://localhost:3000"],
    )
    app = create_app(
        settings=settings,
        jwt_verifier=StaticVerifier(CurrentUser(id=uuid4(), role=ApplicationRole.USER)),
        database=cast(Database, database),
        readiness_checks={},
    )
    with TestClient(app) as client:
        public = client.get("/api/v1/scholarships", params={"q": "science", "limit": 1})
        invalid_sort = client.get("/api/v1/scholarships", params={"sort": "amount_desc"})
        forbidden = client.get(
            "/api/v1/admin/scholarships",
            headers={"Authorization": "Bearer user-token"},
        )
    assert public.status_code == 200
    assert public.json()["has_more"] is True
    assert invalid_sort.status_code == 422
    assert invalid_sort.json()["error"]["code"] == "VALIDATION_ERROR"
    assert forbidden.status_code == 403
    assert forbidden.json()["error"]["code"] == "INSUFFICIENT_ROLE"


def test_catalog_cursor_detail_and_stable_sort_binding() -> None:
    first = _scholarship_row()
    second = _scholarship_row()
    repository = FakeScholarships([first, second])
    service = CatalogService(cast(Database, CatalogDatabase(repository)))

    page = asyncio.run(
        service.list(
            CatalogFilters(query="science", sort=ScholarshipSort.DEADLINE_ASC),
            cursor=None,
            limit=1,
        )
    )
    assert page.has_more is True
    assert page.next_cursor is not None
    assert page.data[0].id == first["id"]
    assert repository.last_filters is not None and repository.last_filters.query == "science"

    asyncio.run(
        service.list(
            CatalogFilters(sort=ScholarshipSort.DEADLINE_ASC),
            cursor=page.next_cursor,
            limit=1,
        )
    )
    assert repository.last_cursor == {
        "value": "2027-05-31",
        "id": str(first["id"]),
    }

    detail = asyncio.run(service.get(cast(UUID, first["id"])))
    assert detail.requirements[0].field == "study_level"
    assert detail.provenance[0].source_version == "baseline"

    with pytest.raises(ApiError, match="INVALID_CURSOR") as error:
        asyncio.run(
            service.list(
                CatalogFilters(sort=ScholarshipSort.TITLE_ASC),
                cursor=page.next_cursor,
                limit=1,
            )
        )
    assert error.value.status_code == 400


def test_administrator_review_publish_and_version_checks() -> None:
    row = _scholarship_row(status="draft")
    scholarships = FakeScholarships([row])
    admin = FakeCatalogAdmin(row)
    audit = FakeAudit()
    service = CatalogAdminService(
        cast(Database, CatalogDatabase(scholarships, admin=admin, audit=audit))
    )
    scholarship_id = cast(UUID, row["id"])

    reviewed = asyncio.run(
        service.transition(
            ADMIN,
            scholarship_id,
            LifecycleTransition(
                action="submit_for_review", expected_data_version=1, reviewer_notes="Checked"
            ),
        )
    )
    assert reviewed.status == "in_review"
    with pytest.raises(ApiError, match="SCHOLARSHIP_REVIEW_REQUIRED"):
        asyncio.run(
            service.transition(
                ADMIN,
                scholarship_id,
                LifecycleTransition(action="publish", expected_data_version=2),
            )
        )
    verified = asyncio.run(
        service.transition(
            ADMIN,
            scholarship_id,
            LifecycleTransition(
                action="review", expected_data_version=2, reviewer_notes="Source verified"
            ),
        )
    )
    assert verified.verified_at == NOW
    published = asyncio.run(
        service.transition(
            ADMIN,
            scholarship_id,
            LifecycleTransition(action="publish", expected_data_version=3),
        )
    )
    assert published.status == "published"
    assert len(audit.events) == 3

    with pytest.raises(ApiError, match="SCHOLARSHIP_VERSION_CONFLICT") as error:
        asyncio.run(
            service.transition(
                ADMIN,
                scholarship_id,
                LifecycleTransition(action="unpublish", expected_data_version=3),
            )
        )
    assert error.value.status_code == 409


class FakeIngestionRepository:
    def __init__(self) -> None:
        self.runs: dict[UUID, DatabaseRow] = {}
        self.sources: dict[str, NormalizedSourceWrite] = {}
        self.raw: list[RawSourceRecordWrite] = []
        self.rejections: list[str] = []
        self.history: list[str] = []

    def add_run(self, *, batch_size: int = 100, source_version: str = "baseline") -> UUID:
        run_id = uuid4()
        self.runs[run_id] = {
            "id": run_id,
            "source": "fixture",
            "adapter_version": "1.0.0",
            "source_version": source_version,
            "dry_run": False,
            "status": "queued",
            "counters": {},
            "safe_errors": [],
            "original_run_id": None,
            "batch_size": batch_size,
            "resume_cursor": 0,
            "attempt_count": 0,
            "started_at": None,
            "completed_at": None,
            "created_at": NOW,
            "updated_at": NOW,
        }
        return run_id

    async def get(self, run_id: UUID) -> DatabaseRow | None:
        return self.runs.get(run_id)

    async def claim(self, run_id: UUID) -> DatabaseRow | None:
        row = self.runs[run_id]
        if row["status"] not in {"queued", "partial"}:
            return None
        row["status"] = "running"
        row["attempt_count"] = int(row["attempt_count"]) + 1
        row["started_at"] = NOW
        return row

    async def store_raw(
        self,
        run_id: UUID,
        position: int,
        batch_number: int,
        record: RawSourceRecordWrite,
    ) -> DatabaseRow:
        del run_id, position, batch_number
        self.raw.append(record)
        return {"id": uuid4(), **asdict(record)}

    async def apply_normalized(
        self,
        run_id: UUID,
        raw_record_id: UUID,
        normalized: NormalizedSourceWrite,
        *,
        dry_run: bool,
    ) -> str:
        del run_id, raw_record_id, dry_run
        existing = self.sources.get(normalized.canonical_url)
        if existing is not None:
            if existing.fingerprint == normalized.fingerprint:
                return "unchanged"
            self.sources[normalized.canonical_url] = normalized
            self.history.append(normalized.canonical_url)
            return "updated"
        if any(item.fingerprint == normalized.fingerprint for item in self.sources.values()):
            self.rejections.append("AMBIGUOUS_DUPLICATE")
            return "duplicate"
        self.sources[normalized.canonical_url] = normalized
        return "created"

    async def reject(
        self,
        run_id: UUID,
        raw_record_id: UUID | None,
        *,
        reason_code: str,
        safe_summary: str,
        fingerprint: str | None = None,
        candidates: object = (),
    ) -> None:
        del run_id, raw_record_id, safe_summary, fingerprint, candidates
        self.rejections.append(reason_code)

    async def advance(
        self,
        run_id: UUID,
        *,
        resume_cursor: int,
        counters: dict[str, int],
        status: str,
        safe_errors: list[dict[str, object]] | None = None,
    ) -> DatabaseRow:
        row = self.runs[run_id]
        row.update(
            resume_cursor=resume_cursor,
            counters=counters,
            status=status,
            safe_errors=safe_errors or [],
            completed_at=NOW if status in {"completed", "failed", "dead_lettered"} else None,
        )
        return row

    async def fail_item(
        self,
        run_id: UUID,
        raw_record_id: UUID,
        *,
        safe_error_code: str,
        safe_error_summary: str,
    ) -> bool:
        del run_id, raw_record_id, safe_error_code, safe_error_summary
        return False


class IngestionDatabase:
    def __init__(self, repository: FakeIngestionRepository) -> None:
        self.repository = repository

    @asynccontextmanager
    async def unit_of_work(self, principal: DatabasePrincipal) -> AsyncIterator[object]:
        del principal
        yield type("Uow", (), {"ingestion": self.repository})()


class RecordsAdapter:
    name = "fixture"
    version = "1.0.0"
    source_version = "baseline"
    trusted = False
    permission_granted = True
    robots_allowed = True
    terms_checked_at = NOW
    fetch_policy = FetchPolicy(timeout_seconds=1, max_retries=1)

    def __init__(
        self,
        payloads: list[dict[str, Any]] | None = None,
        *,
        error: Exception | None = None,
    ) -> None:
        self.payloads = payloads or []
        self.error = error

    async def fetch(self, *, start_at: int) -> AsyncIterator[RawSourceRecord]:
        for payload in self.payloads[start_at:]:
            yield RawSourceRecord(
                source_record_id=str(payload["id"]),
                source_url=str(payload["source_url"]),
                payload=payload,
                fetched_at=NOW,
            )
        if self.error is not None:
            raise self.error


def _fixture_payload() -> dict[str, Any]:
    record = RawSourceRecord(
        source_record_id="ignored",
        source_url="https://fixtures.example/ignored",
        payload={},
        fetched_at=NOW,
    )
    del record
    return {
        "id": "one",
        "source_url": "https://fixtures.example/award?utm_source=test",
        "provider": {"name": "Fixture Foundation"},
        "title": "Fixture Award",
        "amount": "1000",
        "currency": "USD",
        "deadline": "2027-12-31",
        "study_levels": ["bachelor"],
        "destination_countries": ["BW"],
        "requirements": [],
    }


def test_normalization_change_duplicate_invalid_deadline_and_requirement() -> None:
    adapter = RecordsAdapter()
    payload = _fixture_payload()
    record = RawSourceRecord("one", str(payload["source_url"]), payload, NOW)
    normalized = normalize_source_record(adapter, record)
    assert normalized.canonical_url == "https://fixtures.example/award"
    assert normalized.scholarship.study_levels == ["undergraduate"]

    changed = dict(payload)
    changed["amount"] = "2000"
    changed_record = RawSourceRecord("one", str(payload["source_url"]), changed, NOW)
    assert normalize_source_record(adapter, changed_record).fingerprint != normalized.fingerprint

    invalid = dict(payload)
    invalid["deadline"] = "2027-02-30"
    with pytest.raises(ValueError, match="INVALID_DEADLINE"):
        normalize_source_record(
            adapter, RawSourceRecord("invalid", str(payload["source_url"]), invalid, NOW)
        )

    invalid_requirement = dict(payload)
    invalid_requirement["requirements"] = [
        {"field": "sql", "operator": "execute", "summary": "invalid"}
    ]
    with pytest.raises(ValueError, match="INVALID_REQUIREMENT"):
        normalize_source_record(
            adapter,
            RawSourceRecord("requirement", str(payload["source_url"]), invalid_requirement, NOW),
        )


def test_ingestion_created_changed_duplicate_and_quarantine() -> None:
    repository = FakeIngestionRepository()
    orchestrator = IngestionOrchestrator(cast(Database, IngestionDatabase(repository)))

    baseline_id = repository.add_run()
    baseline = asyncio.run(orchestrator.run_fixture_batch(baseline_id))
    assert baseline.status == "completed"
    assert baseline.counters["created"] == 2

    changed_id = repository.add_run(source_version="changed")
    changed = asyncio.run(orchestrator.run_batch(changed_id, FixtureSourceAdapter("changed")))
    assert changed.counters["updated"] == 1
    assert changed.counters["unchanged"] == 1
    assert len(repository.history) == 1

    first = _fixture_payload()
    second = dict(first)
    second["id"] = "two"
    second["source_url"] = "https://fixtures.example/second-url"
    duplicate_id = repository.add_run()
    duplicate = asyncio.run(orchestrator.run_batch(duplicate_id, RecordsAdapter([first, second])))
    assert duplicate.counters["duplicates"] == 1
    assert "AMBIGUOUS_DUPLICATE" in repository.rejections

    invalid = _fixture_payload()
    invalid["source_url"] = "https://fixtures.example/invalid-date"
    invalid["deadline"] = "not-a-date"
    invalid_id = repository.add_run()
    rejected = asyncio.run(orchestrator.run_batch(invalid_id, RecordsAdapter([invalid])))
    assert rejected.counters["rejected"] == 1
    assert "INVALID_DEADLINE" in repository.rejections


def test_ingestion_partial_retry_fetch_parse_dead_letter_and_concurrent_run() -> None:
    repository = FakeIngestionRepository()
    orchestrator = IngestionOrchestrator(cast(Database, IngestionDatabase(repository)))

    partial_id = repository.add_run(source_version="partial")
    first = asyncio.run(orchestrator.run_batch(partial_id, FixtureSourceAdapter("partial")))
    second = asyncio.run(orchestrator.run_batch(partial_id, FixtureSourceAdapter("partial")))
    finished = asyncio.run(orchestrator.run_batch(partial_id, FixtureSourceAdapter("partial")))
    assert (first.status, second.status, finished.status) == ("partial", "partial", "completed")
    assert finished.resume_cursor == 2

    failure_id = repository.add_run()
    failure_adapter = RecordsAdapter(error=SourceFetchError("private provider detail"))
    asyncio.run(orchestrator.run_batch(failure_id, failure_adapter))
    asyncio.run(orchestrator.run_batch(failure_id, failure_adapter))
    dead = asyncio.run(orchestrator.run_batch(failure_id, failure_adapter))
    assert dead.status == "dead_lettered"
    assert dead.safe_errors == [
        {
            "code": "SOURCE_FETCH_FAILED",
            "summary": "The approved source adapter could not complete its batch.",
            "count": 1,
        }
    ]
    assert "private provider detail" not in str(dead.safe_errors)

    parse_id = repository.add_run()
    parsed = asyncio.run(
        orchestrator.run_batch(parse_id, RecordsAdapter(error=RuntimeError("secret parser")))
    )
    assert parsed.safe_errors[0]["code"] == "SOURCE_PARSE_FAILED"
    assert "secret parser" not in str(parsed.safe_errors)

    concurrent_id = repository.add_run()
    repository.runs[concurrent_id]["status"] = "running"
    with pytest.raises(ApiError, match="INGESTION_RUN_NOT_CLAIMABLE") as error:
        asyncio.run(orchestrator.run_batch(concurrent_id, FixtureSourceAdapter()))
    assert error.value.status_code == 409


def test_unapproved_sources_are_never_fetched() -> None:
    repository = FakeIngestionRepository()
    orchestrator = IngestionOrchestrator(cast(Database, IngestionDatabase(repository)))
    adapter = RecordsAdapter([_fixture_payload()])
    adapter.permission_granted = False
    with pytest.raises(ApiError, match="SOURCE_NOT_APPROVED") as error:
        asyncio.run(orchestrator.run_batch(repository.add_run(), adapter))
    assert error.value.status_code == 403
    assert repository.raw == []
