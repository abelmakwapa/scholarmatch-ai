import asyncio
from collections.abc import AsyncIterator, Mapping
from contextlib import asynccontextmanager
from dataclasses import asdict
from datetime import UTC, date, datetime
from decimal import Decimal
from typing import Any, cast
from uuid import UUID, uuid4

import pytest
from app.auth.models import ApplicationRole, CurrentUser
from app.core.config import Environment, Settings
from app.db.principal import DatabasePrincipal
from app.db.protocols import Database
from app.main import create_app
from app.repositories.interfaces import DatabaseRow
from app.repositories.models import MatchJobWrite, MatchWrite
from app.schemas.match import (
    NormalizedRule,
    RuleField,
    RuleOperator,
    RuleOutcome,
    RuleSource,
    RuleStrength,
    ScoringWeights,
)
from app.services.matches import MatchingService
from app.services.matching_engine import ALGORITHM_VERSION, calculate_match, evaluate_eligibility
from app.services.work_queue import WorkQueue
from fastapi.testclient import TestClient
from hypothesis import given
from hypothesis import strategies as st
from pydantic import ValidationError

TODAY = date(2026, 8, 6)
NOW = datetime(2026, 8, 6, 12, tzinfo=UTC)
USER = CurrentUser(id=UUID("10000000-0000-0000-0000-000000000001"), role=ApplicationRole.USER)


def _profile(**changes: object) -> DatabaseRow:
    row: DatabaseRow = {
        "id": USER.id,
        "full_name": "Ada Student",
        "country": "BW",
        "study_level": "undergraduate",
        "field_of_study": "Computer Science",
        "gpa": 4.0,
        "gpa_scale": 5.0,
        "nationality_country": "BW",
        "residence_country": "BW",
        "date_of_birth": date(2005, 8, 6),
        "interests": ["artificial intelligence", "public health"],
        "target_countries": ["US", "GB"],
        "goals": "Use artificial intelligence for public health",
        "requires_financial_aid": True,
        "willing_to_relocate": True,
        "institution_name": "University of Botswana",
        "experience_months": 12,
        "data_version": 3,
        "created_at": NOW,
        "updated_at": NOW,
    }
    row.update(changes)
    return row


def _scholarship(
    *,
    scholarship_id: UUID | None = None,
    version: int = 2,
    deadline: date | None = date(2027, 1, 31),
    requirements: list[DatabaseRow] | None = None,
) -> DatabaseRow:
    return {
        "id": scholarship_id or uuid4(),
        "provider_name": "Deterministic Foundation",
        "title": "AI and Public Health Award",
        "description": "Support for computer science students working in public health.",
        "funding_type": "full",
        "study_levels": ["undergraduate"],
        "fields_of_study": ["Computer Science"],
        "required_documents": ["cv", "transcript"],
        "eligibility_summary": "For eligible computer science students.",
        "deadline": deadline,
        "data_version": version,
        "requirements": requirements or [],
    }


def _rule(
    field: RuleField,
    operator: RuleOperator,
    value: object,
    *,
    strength: RuleStrength = RuleStrength.HARD,
    rule_id: UUID | None = None,
) -> NormalizedRule:
    return NormalizedRule(
        id=rule_id or uuid4(),
        field=field,
        operator=operator,
        value=value,
        strength=strength,
        source=RuleSource(name="curated-fixture", source_url="https://example.invalid/rule"),
        version=1,
    )


@pytest.mark.parametrize(
    ("rule", "expected"),
    [
        (_rule(RuleField.COUNTRY, RuleOperator.EQUALS, "BW"), RuleOutcome.ELIGIBLE),
        (_rule(RuleField.NATIONALITY, RuleOperator.IN, ["BW", "ZA"]), RuleOutcome.ELIGIBLE),
        (_rule(RuleField.RESIDENCY, RuleOperator.NOT_IN, ["US"]), RuleOutcome.ELIGIBLE),
        (
            _rule(RuleField.DESTINATION, RuleOperator.IN, ["US"]),
            RuleOutcome.ELIGIBLE,
        ),
        (
            _rule(RuleField.STUDY_LEVEL, RuleOperator.EQUALS, "postgraduate"),
            RuleOutcome.INELIGIBLE,
        ),
        (
            _rule(RuleField.FIELD_OF_STUDY, RuleOperator.CONTAINS, "computer"),
            RuleOutcome.ELIGIBLE,
        ),
        (
            _rule(RuleField.GPA, RuleOperator.GTE, {"score": 3.2, "scale": 4.0}),
            RuleOutcome.ELIGIBLE,
        ),
        (_rule(RuleField.AGE, RuleOperator.LTE, 21), RuleOutcome.ELIGIBLE),
        (
            _rule(RuleField.DATE_OF_BIRTH, RuleOperator.GTE, "2005-01-01"),
            RuleOutcome.ELIGIBLE,
        ),
        (
            _rule(RuleField.INSTITUTION, RuleOperator.CONTAINS, "Botswana"),
            RuleOutcome.ELIGIBLE,
        ),
        (
            _rule(RuleField.EXPERIENCE_MONTHS, RuleOperator.GTE, 12),
            RuleOutcome.ELIGIBLE,
        ),
    ],
)
def test_curated_rule_matrix(rule: NormalizedRule, expected: RuleOutcome) -> None:
    result = evaluate_eligibility(_profile(), _scholarship(), [rule], reference_date=TODAY)

    assert result.outcome is expected
    assert result.hard_rule_results[0].outcome is expected
    assert result.hard_rule_results[0].source.name == "curated-fixture"
    assert result.hard_rule_results[0].rule_version == 1


def test_missing_evidence_is_unknown_and_contradiction_is_confirmed_failure() -> None:
    missing = evaluate_eligibility(
        _profile(gpa=None, gpa_scale=None),
        _scholarship(),
        [_rule(RuleField.GPA, RuleOperator.GTE, {"score": 3.0, "scale": 4.0})],
        reference_date=TODAY,
    )
    assert missing.outcome is RuleOutcome.UNKNOWN
    assert missing.missing_profile_fields == ["gpa", "gpa_scale"]
    assert missing.reasons == ["PROFILE_EVIDENCE_MISSING"]

    exists = evaluate_eligibility(
        _profile(institution_name=None),
        _scholarship(),
        [_rule(RuleField.INSTITUTION, RuleOperator.EXISTS, True)],
        reference_date=TODAY,
    )
    assert exists.outcome is RuleOutcome.UNKNOWN

    contradictory = evaluate_eligibility(
        _profile(),
        _scholarship(),
        [
            _rule(RuleField.COUNTRY, RuleOperator.EQUALS, "BW"),
            _rule(RuleField.COUNTRY, RuleOperator.EQUALS, "ZA"),
        ],
        reference_date=TODAY,
    )
    assert contradictory.outcome is RuleOutcome.INELIGIBLE
    assert [item.outcome for item in contradictory.hard_rule_results] == [
        RuleOutcome.ELIGIBLE,
        RuleOutcome.INELIGIBLE,
    ]


def test_gpa_scale_policy_boundaries_expiry_and_invalid_weights() -> None:
    threshold = _rule(
        RuleField.GPA,
        RuleOperator.GTE,
        {"score": 3.2, "scale": 4.0},
    )
    equal_ratio = evaluate_eligibility(
        _profile(gpa=4.0, gpa_scale=5.0),
        _scholarship(),
        [threshold],
        reference_date=TODAY,
    )
    below_ratio = evaluate_eligibility(
        _profile(gpa=3.99, gpa_scale=5.0),
        _scholarship(),
        [threshold],
        reference_date=TODAY,
    )
    expired = evaluate_eligibility(
        _profile(),
        _scholarship(deadline=date(2026, 8, 5)),
        [],
        reference_date=TODAY,
    )

    assert equal_ratio.outcome is RuleOutcome.ELIGIBLE
    assert below_ratio.outcome is RuleOutcome.INELIGIBLE
    assert expired.outcome is RuleOutcome.INELIGIBLE
    assert expired.reasons == ["SCHOLARSHIP_EXPIRED"]
    with pytest.raises(ValidationError, match="sum to 1.0"):
        ScoringWeights(academic_fit=0.5)


def test_scoring_is_deterministic_versioned_and_separates_confidence() -> None:
    rule_id = UUID("40000000-0000-0000-0000-000000000001")
    rules = [
        _rule(
            RuleField.GPA,
            RuleOperator.GTE,
            {"score": 3.2, "scale": 4.0},
            rule_id=rule_id,
        )
    ]
    documents = [{"document_type": "cv", "status": "ready"}]
    first = calculate_match(
        _profile(),
        _scholarship(scholarship_id=UUID("30000000-0000-0000-0000-000000000001")),
        rules,
        documents,
        weights=ScoringWeights(),
        reference_date=TODAY,
    )
    second = calculate_match(
        _profile(),
        _scholarship(scholarship_id=UUID("30000000-0000-0000-0000-000000000001")),
        rules,
        documents,
        weights=ScoringWeights(),
        reference_date=TODAY,
    )
    incomplete = calculate_match(
        _profile(gpa=None, gpa_scale=None, interests=[], goals=None),
        _scholarship(scholarship_id=UUID("30000000-0000-0000-0000-000000000001")),
        rules,
        documents,
        weights=ScoringWeights(),
        reference_date=TODAY,
    )

    assert first.model_dump() == second.model_dump()
    assert first.algorithm_version == ALGORITHM_VERSION
    assert {component.formula_version for component in first.components} == {ALGORITHM_VERSION}
    assert first.components[0].name == "academic_fit"
    assert first.components[0].score == 1.0
    assert first.confidence > incomplete.confidence
    assert first.total_score != first.confidence


@given(
    experience=st.integers(min_value=0, max_value=1200),
    threshold=st.integers(min_value=0, max_value=1200),
)
def test_experience_gte_rule_is_monotonic(experience: int, threshold: int) -> None:
    result = evaluate_eligibility(
        _profile(experience_months=experience),
        _scholarship(),
        [_rule(RuleField.EXPERIENCE_MONTHS, RuleOperator.GTE, threshold)],
        reference_date=TODAY,
    )
    expected = RuleOutcome.ELIGIBLE if experience >= threshold else RuleOutcome.INELIGIBLE
    assert result.outcome is expected


class FakeProfiles:
    def __init__(self, row: DatabaseRow | None) -> None:
        self.row = row

    async def get(self, profile_id: UUID) -> DatabaseRow | None:
        return self.row if self.row is not None and self.row["id"] == profile_id else None


class FakeDocuments:
    async def list_for_profile(self, profile_id: UUID, *, limit: int = 20) -> list[DatabaseRow]:
        del profile_id, limit
        return [{"document_type": "cv", "status": "ready"}]


class FakeScholarships:
    def __init__(self, rows: list[DatabaseRow]) -> None:
        self.rows = rows

    async def count_for_matching(self) -> int:
        return len(self.rows)

    async def list_for_matching(self, *, limit: int) -> list[DatabaseRow]:
        return self.rows[:limit]


class FakeMatches:
    def __init__(self, scholarships: FakeScholarships) -> None:
        self.scholarships = scholarships
        self.rows: dict[tuple[UUID, UUID], DatabaseRow] = {}
        self.jobs: dict[tuple[UUID, int, str], DatabaseRow] = {}

    def _joined(self, row: Mapping[str, Any]) -> DatabaseRow:
        scholarship = next(
            item for item in self.scholarships.rows if item["id"] == row["scholarship_id"]
        )
        return {
            **row,
            "title": scholarship["title"],
            "provider_name": scholarship["provider_name"],
            "deadline": scholarship["deadline"],
            "funding_type": scholarship["funding_type"],
        }

    async def get(self, profile_id: UUID, scholarship_id: UUID) -> DatabaseRow | None:
        row = self.rows.get((profile_id, scholarship_id))
        return self._joined(row) if row is not None else None

    async def list_for_profile(
        self,
        profile_id: UUID,
        *,
        cursor: dict[str, str] | None,
        limit: int = 20,
    ) -> list[DatabaseRow]:
        rows = [
            self._joined(row)
            for (owner_id, _), row in self.rows.items()
            if owner_id == profile_id and row["eligibility_status"] != "ineligible"
        ]
        rows.sort(key=lambda row: (-Decimal(str(row["total_score"])), UUID(str(row["id"]))))
        if cursor is not None:
            score = Decimal(cursor["score"])
            row_id = UUID(cursor["id"])
            rows = [
                row
                for row in rows
                if Decimal(str(row["total_score"])) < score
                or (Decimal(str(row["total_score"])) == score and UUID(str(row["id"])) > row_id)
            ]
        return rows[:limit]

    async def list_current(
        self,
        profile_id: UUID,
        *,
        profile_data_version: int,
        algorithm_version: str,
    ) -> list[DatabaseRow]:
        current_versions = {row["id"]: row["data_version"] for row in self.scholarships.rows}
        return [
            row
            for (owner_id, scholarship_id), row in self.rows.items()
            if owner_id == profile_id
            and row["profile_data_version"] == profile_data_version
            and row["algorithm_version"] == algorithm_version
            and row["scholarship_data_version"] == current_versions.get(scholarship_id)
        ]

    async def upsert(self, match: MatchWrite) -> DatabaseRow:
        key = (match.profile_id, match.scholarship_id)
        row: DatabaseRow = {
            "id": self.rows.get(key, {}).get("id", uuid4()),
            **asdict(match),
            "created_at": self.rows.get(key, {}).get("created_at", NOW),
            "updated_at": NOW,
        }
        self.rows[key] = row
        return row

    async def create_job(self, job: MatchJobWrite) -> DatabaseRow:
        key = (job.profile_id, job.profile_data_version, job.algorithm_version)
        row = self.jobs.setdefault(
            key,
            {
                "id": uuid4(),
                **asdict(job),
                "status": "queued",
                "created_at": NOW,
                "updated_at": NOW,
            },
        )
        return row


class FakeMatchingUnitOfWork:
    def __init__(
        self,
        profiles: FakeProfiles,
        documents: FakeDocuments,
        scholarships: FakeScholarships,
        matches: FakeMatches,
    ) -> None:
        self.profiles = profiles
        self.documents = documents
        self.scholarships = scholarships
        self.matches = matches
        self.match_writer = matches


class FakeMatchingDatabase:
    def __init__(self, profile: DatabaseRow, scholarships: list[DatabaseRow]) -> None:
        self.profiles = FakeProfiles(profile)
        self.documents = FakeDocuments()
        self.scholarships = FakeScholarships(scholarships)
        self.matches = FakeMatches(self.scholarships)
        self.uow = FakeMatchingUnitOfWork(
            self.profiles, self.documents, self.scholarships, self.matches
        )

    @asynccontextmanager
    async def unit_of_work(self, principal: DatabasePrincipal) -> AsyncIterator[object]:
        del principal
        yield self.uow


class FakeQueue:
    def __init__(self) -> None:
        self.keys: set[str] = set()

    async def enqueue_match_calculation(self, job_id: UUID, *, idempotency_key: str) -> bool:
        del job_id
        created = idempotency_key not in self.keys
        self.keys.add(idempotency_key)
        return created


class StaticVerifier:
    async def verify(self, token: str) -> CurrentUser:
        assert token == "match-token"
        return USER


def _requirement_row(
    field: str, operator: str, value: object, *, strength: str = "hard"
) -> DatabaseRow:
    return {
        "id": uuid4(),
        "constraint_type": strength,
        "field": field,
        "operator": operator,
        "value": value,
        "source_evidence": {"source": "curated-fixture"},
        "version": 1,
        "position": 0,
    }


def _matching_service(
    *, immediate_limit: int = 100
) -> tuple[MatchingService, FakeMatchingDatabase, FakeQueue]:
    eligible = _scholarship(
        scholarship_id=UUID("30000000-0000-0000-0000-000000000001"),
        requirements=[_requirement_row("country", "equals", "BW")],
    )
    ineligible = _scholarship(
        scholarship_id=UUID("30000000-0000-0000-0000-000000000002"),
        requirements=[_requirement_row("country", "equals", "ZA")],
    )
    database = FakeMatchingDatabase(_profile(), [eligible, ineligible])
    queue = FakeQueue()
    service = MatchingService(
        cast(Database, database),
        cast(WorkQueue, queue),
        weights=ScoringWeights(),
        immediate_limit=immediate_limit,
        clock=lambda: NOW,
    )
    return service, database, queue


def test_recalculation_is_idempotent_and_versions_invalidate_only_changed_input() -> None:
    (
        service,
        database,
        _,
    ) = _matching_service()

    first = asyncio.run(service.recalculate(USER))
    second = asyncio.run(service.recalculate(USER))
    database.scholarships.rows[0]["data_version"] = 3
    version_changed = asyncio.run(service.recalculate(USER))

    assert first.mode == "immediate"
    assert first.calculated_count == 2
    assert first.excluded_count == 1
    assert second.mode == "existing"
    assert second.reused_count == 2
    assert version_changed.mode == "immediate"
    assert version_changed.calculated_count == 1
    assert version_changed.reused_count == 1
    assert len(database.matches.rows) == 2


def test_match_list_keeps_unknown_excludes_only_ineligible_and_pages_ties_stably() -> None:
    service, database, _ = _matching_service()
    asyncio.run(service.recalculate(USER))
    eligible = database.matches.rows[(USER.id, database.scholarships.rows[0]["id"])]
    eligible["total_score"] = 0.75
    eligible["id"] = UUID("50000000-0000-0000-0000-000000000001")
    third = _scholarship(
        scholarship_id=UUID("30000000-0000-0000-0000-000000000003"),
        requirements=[_requirement_row("institution", "equals", "Unknown College")],
    )
    database.scholarships.rows.append(third)
    database.matches.rows[(USER.id, third["id"])] = {
        **eligible,
        "id": UUID("50000000-0000-0000-0000-000000000002"),
        "scholarship_id": third["id"],
        "eligibility_status": "unknown",
        "missing_profile_fields": ["institution_name"],
    }

    first_page = asyncio.run(service.list(USER, cursor=None, limit=1))
    second_page = asyncio.run(service.list(USER, cursor=first_page.next_cursor, limit=1))

    assert first_page.data[0].id == UUID("50000000-0000-0000-0000-000000000001")
    assert second_page.data[0].id == UUID("50000000-0000-0000-0000-000000000002")
    assert second_page.data[0].eligibility is RuleOutcome.UNKNOWN
    assert all(item.eligibility is not RuleOutcome.INELIGIBLE for item in first_page.data)


def test_match_api_returns_list_detail_existing_immediate_and_accepted_modes() -> None:
    service, database, _ = _matching_service()
    settings = Settings(
        _env_file=None,
        environment=Environment.TEST,
        cors_allowed_origins=["http://localhost:3000"],
    )
    application = create_app(
        settings=settings,
        jwt_verifier=StaticVerifier(),
        database=cast(Database, database),
        work_queue=cast(WorkQueue, FakeQueue()),
        readiness_checks={},
    )
    application.state.matching_service = service
    headers = {"Authorization": "Bearer match-token"}
    with TestClient(application) as client:
        immediate = client.post("/api/v1/matches/recalculate", headers=headers)
        existing = client.post("/api/v1/matches/recalculate", headers=headers)
        listed = client.get("/api/v1/matches", headers=headers)
        detail = client.get(
            f"/api/v1/matches/{database.scholarships.rows[0]['id']}", headers=headers
        )
        invalid_cursor = client.get(
            "/api/v1/matches", headers=headers, params={"cursor": "not-a-cursor"}
        )

    assert immediate.status_code == 200 and immediate.json()["mode"] == "immediate"
    assert existing.status_code == 200 and existing.json()["mode"] == "existing"
    assert listed.status_code == 200 and len(listed.json()["data"]) == 1
    assert detail.status_code == 200
    assert detail.json()["rule_results"][0]["reason_code"] == "RULE_CONFIRMED_PASS"
    assert detail.json()["score_breakdown"][0]["formula_version"] == ALGORITHM_VERSION
    assert invalid_cursor.status_code == 400
    assert invalid_cursor.json()["error"]["code"] == "INVALID_CURSOR"

    accepted_service, accepted_database, accepted_queue = _matching_service(immediate_limit=1)
    application.state.matching_service = accepted_service
    with TestClient(application) as client:
        accepted_http = client.post("/api/v1/matches/recalculate", headers=headers)
    accepted = accepted_http.json()
    repeated = asyncio.run(accepted_service.recalculate(USER))
    assert accepted_http.status_code == 202
    assert accepted["mode"] == "accepted" and accepted["job_id"] is not None
    assert str(repeated.job_id) == accepted["job_id"]
    assert len(accepted_database.matches.jobs) == 1
    assert len(accepted_queue.keys) == 1
