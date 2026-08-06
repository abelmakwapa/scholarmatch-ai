import base64
import json
from collections.abc import Callable, Mapping, Sequence
from datetime import UTC, datetime
from decimal import Decimal, InvalidOperation
from typing import Any
from uuid import UUID

from pydantic import ValidationError

from app.auth.models import CurrentUser
from app.core.errors import ApiError
from app.db.principal import DatabasePrincipal, ServicePurpose
from app.db.protocols import Database
from app.repositories.models import MatchJobWrite, MatchWrite
from app.schemas.match import (
    MatchDetail,
    MatchListItem,
    MatchPage,
    MatchScholarshipSummary,
    RecalculationResponse,
    RuleOutcome,
    RuleResult,
    ScoreComponent,
    ScoringWeights,
)
from app.services.matching_engine import ALGORITHM_VERSION, calculate_match, normalize_requirement
from app.services.work_queue import WorkQueue


def _encode_cursor(score: object, row_id: object) -> str:
    payload = json.dumps({"score": str(score), "id": str(row_id)}, separators=(",", ":")).encode()
    return base64.urlsafe_b64encode(payload).decode().rstrip("=")


def _decode_cursor(value: str | None) -> dict[str, str] | None:
    if value is None:
        return None
    try:
        payload = json.loads(base64.urlsafe_b64decode(value + "=" * (-len(value) % 4)))
        score = Decimal(str(payload["score"]))
        if score < 0 or score > 1:
            raise ValueError
        return {"score": str(score), "id": str(UUID(str(payload["id"])))}
    except (ValueError, TypeError, KeyError, json.JSONDecodeError, InvalidOperation):
        raise ApiError(
            status_code=400,
            code="INVALID_CURSOR",
            message="The match pagination cursor is invalid.",
        ) from None


def _summary(row: Mapping[str, Any]) -> MatchScholarshipSummary:
    return MatchScholarshipSummary(
        id=UUID(str(row["scholarship_id"])),
        title=str(row["title"]),
        provider=str(row["provider_name"]),
        deadline=row.get("deadline"),
        funding_type=str(row["funding_type"]),
    )


def _list_item(row: Mapping[str, Any]) -> MatchListItem:
    return MatchListItem(
        id=UUID(str(row["id"])),
        scholarship=_summary(row),
        rank_score=float(row["total_score"]),
        confidence=float(row["confidence"]),
        eligibility=RuleOutcome(str(row["eligibility_status"])),
        missing_profile_fields=list(row.get("missing_profile_fields") or []),
        algorithm_version=str(row["algorithm_version"]),
        profile_data_version=int(row["profile_data_version"]),
        scholarship_data_version=int(row["scholarship_data_version"]),
        calculated_at=row["calculated_at"],
    )


class MatchingService:
    def __init__(
        self,
        database: Database,
        queue: WorkQueue,
        *,
        weights: ScoringWeights,
        immediate_limit: int,
        clock: Callable[[], datetime] | None = None,
    ) -> None:
        self._database = database
        self._queue = queue
        self._weights = weights
        self._immediate_limit = immediate_limit
        self._clock = clock or (lambda: datetime.now(UTC))
        self._worker = DatabasePrincipal.for_service(
            ServicePurpose.MATCH_WORKER,
            authorization_reason="calculate deterministic scholarship matches",
        )

    async def list(
        self,
        user: CurrentUser,
        *,
        cursor: str | None,
        limit: int,
    ) -> MatchPage:
        decoded = _decode_cursor(cursor)
        async with self._database.unit_of_work(DatabasePrincipal.for_user(user)) as uow:
            rows = await uow.matches.list_for_profile(user.id, cursor=decoded, limit=limit + 1)
        has_more = len(rows) > limit
        page_rows = rows[:limit]
        next_cursor = (
            _encode_cursor(page_rows[-1]["total_score"], page_rows[-1]["id"])
            if has_more and page_rows
            else None
        )
        return MatchPage(
            data=[_list_item(row) for row in page_rows],
            next_cursor=next_cursor,
            has_more=has_more,
            limit=limit,
        )

    async def get(self, user: CurrentUser, scholarship_id: UUID) -> MatchDetail:
        async with self._database.unit_of_work(DatabasePrincipal.for_user(user)) as uow:
            row = await uow.matches.get(user.id, scholarship_id)
        if row is None:
            raise ApiError(status_code=404, code="MATCH_NOT_FOUND", message="Match not found.")
        item = _list_item(row)
        explanation = row.get("deterministic_explanation") or {}
        evidence = row.get("requirement_evidence") or []
        breakdown = row.get("score_breakdown") or []
        try:
            return MatchDetail(
                **item.model_dump(),
                rule_results=[RuleResult.model_validate(result) for result in evidence],
                score_breakdown=[ScoreComponent.model_validate(result) for result in breakdown],
                reasons=list(explanation.get("reasons") or []),
            )
        except ValidationError:
            raise ApiError(
                status_code=409,
                code="MATCH_RECALCULATION_REQUIRED",
                message="This stored match must be recalculated with the current algorithm.",
            ) from None

    async def recalculate(self, user: CurrentUser) -> RecalculationResponse:
        async with self._database.unit_of_work(DatabasePrincipal.for_user(user)) as uow:
            profile = await uow.profiles.get(user.id)
            documents = await uow.documents.list_for_profile(user.id, limit=1000)
        if profile is None:
            raise ApiError(
                status_code=409,
                code="PROFILE_REQUIRED",
                message="Complete a profile before calculating matches.",
            )
        profile_version = int(profile["data_version"])
        async with self._database.unit_of_work(self._worker) as uow:
            candidate_count = await uow.scholarships.count_for_matching()
            current_rows = await uow.matches.list_current(
                user.id,
                profile_data_version=profile_version,
                algorithm_version=ALGORITHM_VERSION,
            )
            if len(current_rows) == candidate_count:
                return RecalculationResponse(
                    mode="existing",
                    candidate_count=candidate_count,
                    calculated_count=0,
                    reused_count=len(current_rows),
                    excluded_count=sum(
                        row.get("eligibility_status") == RuleOutcome.INELIGIBLE.value
                        for row in current_rows
                    ),
                    profile_data_version=profile_version,
                    algorithm_version=ALGORITHM_VERSION,
                )
            if candidate_count > self._immediate_limit:
                job = await uow.match_writer.create_job(
                    MatchJobWrite(
                        profile_id=user.id,
                        profile_data_version=profile_version,
                        algorithm_version=ALGORITHM_VERSION,
                        candidate_count=candidate_count,
                    )
                )
                job_id = UUID(str(job["id"]))
                try:
                    await self._queue.enqueue_match_calculation(
                        job_id,
                        idempotency_key=(
                            f"match-job:{user.id}:{profile_version}:{ALGORITHM_VERSION}"
                        ),
                    )
                except Exception:
                    raise ApiError(
                        status_code=503,
                        code="MATCH_QUEUE_UNAVAILABLE",
                        message="The match calculation could not be queued safely.",
                    ) from None
                return RecalculationResponse(
                    mode="accepted",
                    job_id=job_id,
                    candidate_count=candidate_count,
                    calculated_count=0,
                    reused_count=0,
                    excluded_count=0,
                    profile_data_version=profile_version,
                    algorithm_version=ALGORITHM_VERSION,
                )
            candidates = await uow.scholarships.list_for_matching(limit=self._immediate_limit)
            current = {UUID(str(row["scholarship_id"])): row for row in current_rows}
            calculated, reused, excluded = await self._calculate_immediately(
                uow,
                profile=profile,
                documents=documents,
                candidates=candidates,
                current=current,
            )
        return RecalculationResponse(
            mode="immediate",
            candidate_count=candidate_count,
            calculated_count=calculated,
            reused_count=reused,
            excluded_count=excluded,
            profile_data_version=profile_version,
            algorithm_version=ALGORITHM_VERSION,
        )

    async def _calculate_immediately(
        self,
        uow: Any,
        *,
        profile: Mapping[str, Any],
        documents: Sequence[Mapping[str, Any]],
        candidates: Sequence[Mapping[str, Any]],
        current: Mapping[UUID, Mapping[str, Any]],
    ) -> tuple[int, int, int]:
        now = self._clock()
        calculated = 0
        reused = 0
        excluded = 0
        for scholarship in candidates:
            scholarship_id = UUID(str(scholarship["id"]))
            if scholarship_id in current:
                reused += 1
                continue
            try:
                rules = [
                    normalize_requirement(requirement)
                    for requirement in scholarship.get("requirements") or []
                ]
            except (ValueError, ValidationError):
                raise ApiError(
                    status_code=500,
                    code="INVALID_NORMALIZED_REQUIREMENT",
                    message="A normalized scholarship rule is invalid.",
                ) from None
            result = calculate_match(
                profile,
                scholarship,
                rules,
                documents,
                weights=self._weights,
                reference_date=now.date(),
            )
            if result.eligibility.outcome is RuleOutcome.INELIGIBLE:
                excluded += 1
            rule_results = (
                result.eligibility.hard_rule_results + result.eligibility.soft_rule_results
            )
            await uow.match_writer.upsert(
                MatchWrite(
                    profile_id=UUID(str(profile["id"])),
                    scholarship_id=scholarship_id,
                    total_score=result.total_score,
                    confidence=result.confidence,
                    score_breakdown=[item.model_dump(mode="json") for item in result.components],
                    requirement_evidence=[item.model_dump(mode="json") for item in rule_results],
                    deterministic_explanation={
                        "eligibility": result.eligibility.outcome.value,
                        "reasons": result.eligibility.reasons,
                        "missing_profile_fields": result.eligibility.missing_profile_fields,
                        "formula_version": result.algorithm_version,
                    },
                    ai_explanation=None,
                    explanation_status="unavailable",
                    algorithm_version=result.algorithm_version,
                    embedding_version=None,
                    profile_data_version=int(profile["data_version"]),
                    scholarship_data_version=int(scholarship["data_version"]),
                    eligibility_status=result.eligibility.outcome.value,
                    missing_profile_fields=result.eligibility.missing_profile_fields,
                    stale_reasons=[],
                    calculated_at=now,
                )
            )
            calculated += 1
        return calculated, reused, excluded
