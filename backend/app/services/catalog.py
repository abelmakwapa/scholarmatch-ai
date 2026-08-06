from __future__ import annotations

import base64
import json
from datetime import date, datetime
from typing import Any, Never
from uuid import UUID

from app.auth.models import CurrentUser
from app.core.errors import ApiError
from app.db.principal import DatabasePrincipal, ServicePurpose
from app.db.protocols import Database
from app.repositories.models import AuditEventWrite, RequirementWrite, ScholarshipWrite
from app.schemas.scholarship import (
    AdminScholarshipPatch,
    AdminScholarshipResponse,
    AdminScholarshipWrite,
    CatalogFilters,
    LifecycleTransition,
    ProviderResponse,
    RequirementResponse,
    ScholarshipPage,
    ScholarshipProvenance,
    ScholarshipResponse,
    ScholarshipSort,
)

_TRANSITIONS: dict[str, dict[str, str]] = {
    "draft": {"submit_for_review": "in_review", "archive": "archived"},
    "in_review": {"review": "in_review", "publish": "published", "archive": "archived"},
    "published": {
        "unpublish": "unpublished",
        "expire": "expired",
        "archive": "archived",
    },
    "unpublished": {"submit_for_review": "in_review", "archive": "archived"},
    "expired": {"archive": "archived"},
    "archived": {},
}
_NULL_CURSOR = "__NULL__"


def _encode_cursor(value: str, row_id: UUID, sort: ScholarshipSort) -> str:
    payload = json.dumps(
        {"value": value, "id": str(row_id), "sort": sort.value}, separators=(",", ":")
    ).encode()
    return base64.urlsafe_b64encode(payload).decode().rstrip("=")


def _decode_cursor(value: str | None, sort: ScholarshipSort) -> dict[str, str] | None:
    if value is None:
        return None
    try:
        padding = "=" * (-len(value) % 4)
        payload = json.loads(base64.urlsafe_b64decode(value + padding))
        row_id = str(UUID(payload["id"]))
        cursor_value = str(payload["value"])
        if payload["sort"] != sort.value or len(cursor_value) > 100:
            raise ValueError
    except (ValueError, TypeError, KeyError, json.JSONDecodeError):
        raise ApiError(
            status_code=400,
            code="INVALID_CURSOR",
            message="The pagination cursor is invalid for this sort order.",
        ) from None
    return {"value": cursor_value, "id": row_id}


def _cursor_value(row: dict[str, Any], sort: ScholarshipSort) -> str:
    if "cursor_value" in row:
        value = row["cursor_value"]
    elif sort is ScholarshipSort.DEADLINE_ASC:
        value = row.get("deadline")
    elif sort is ScholarshipSort.RECENTLY_PUBLISHED:
        value = row.get("published_at")
    elif sort is ScholarshipSort.AMOUNT_DESC:
        value = row.get("amount")
    else:
        value = str(row["title"]).lower()
    if value is None:
        return _NULL_CURSOR
    return value.isoformat() if isinstance(value, date | datetime) else str(value)


def _requirements(rows: list[dict[str, Any]]) -> list[RequirementResponse]:
    return [RequirementResponse.model_validate(row) for row in rows]


def _public_response(
    row: dict[str, Any],
    *,
    requirements: list[dict[str, Any]] | None = None,
    provenance: list[dict[str, Any]] | None = None,
) -> ScholarshipResponse:
    payload = dict(row)
    payload["provider"] = ProviderResponse(
        id=row["provider_id"],
        name=str(row["provider_name"]),
        website_url=row.get("provider_website_url"),
    )
    payload["requirements"] = _requirements(requirements or [])
    payload["provenance"] = [
        ScholarshipProvenance.model_validate(item) for item in (provenance or [])
    ]
    return ScholarshipResponse.model_validate(payload)


class CatalogService:
    def __init__(self, database: Database) -> None:
        self._database = database
        self._principal = DatabasePrincipal.for_service(
            ServicePurpose.PUBLIC_CATALOG,
            authorization_reason="serve active published scholarship catalog",
        )

    async def list(
        self,
        filters: CatalogFilters,
        *,
        cursor: str | None,
        limit: int,
    ) -> ScholarshipPage:
        decoded = _decode_cursor(cursor, filters.sort)
        async with self._database.unit_of_work(self._principal) as uow:
            rows = await uow.scholarships.list_published(filters, cursor=decoded, limit=limit + 1)
        has_more = len(rows) > limit
        page_rows = rows[:limit]
        next_cursor = None
        if has_more and page_rows:
            last = page_rows[-1]
            next_cursor = _encode_cursor(
                _cursor_value(last, filters.sort), UUID(str(last["id"])), filters.sort
            )
        return ScholarshipPage(
            data=[_public_response(row) for row in page_rows],
            next_cursor=next_cursor,
            has_more=has_more,
            limit=limit,
        )

    async def get(self, scholarship_id: UUID) -> ScholarshipResponse:
        async with self._database.unit_of_work(self._principal) as uow:
            row = await uow.scholarships.get_published(scholarship_id)
            if row is None:
                raise ApiError(
                    status_code=404,
                    code="SCHOLARSHIP_NOT_FOUND",
                    message="Scholarship not found.",
                )
            requirements = await uow.scholarships.requirements(scholarship_id)
            provenance = await uow.scholarships.provenance(scholarship_id)
        return _public_response(row, requirements=requirements, provenance=provenance)


class CatalogAdminService:
    def __init__(self, database: Database) -> None:
        self._database = database

    async def list_all(self, user: CurrentUser, *, limit: int) -> list[AdminScholarshipResponse]:
        principal = DatabasePrincipal.for_user(user)
        async with self._database.unit_of_work(principal) as uow:
            rows = await uow.catalog_admin.list_all(limit=limit)
            responses: list[AdminScholarshipResponse] = []
            for row in rows:
                scholarship_id = UUID(str(row["id"]))
                requirements = await uow.scholarships.requirements(scholarship_id)
                responses.append(self._admin_response(row, requirements=requirements))
        return responses

    async def get(self, user: CurrentUser, scholarship_id: UUID) -> AdminScholarshipResponse:
        principal = DatabasePrincipal.for_user(user)
        async with self._database.unit_of_work(principal) as uow:
            row = await uow.catalog_admin.get(scholarship_id)
            if row is None:
                raise ApiError(
                    status_code=404,
                    code="SCHOLARSHIP_NOT_FOUND",
                    message="Scholarship not found.",
                )
            requirements = await uow.scholarships.requirements(scholarship_id)
        return self._admin_response(row, requirements=requirements)

    async def create(
        self, user: CurrentUser, request: AdminScholarshipWrite
    ) -> AdminScholarshipResponse:
        principal = DatabasePrincipal.for_user(user)
        async with self._database.unit_of_work(principal) as uow:
            values = request.model_dump(exclude={"requirements"})
            row = await uow.catalog_admin.create(ScholarshipWrite(**values))
            if request.requirements:
                await uow.catalog_admin.replace_requirements(
                    UUID(str(row["id"])),
                    [RequirementWrite(**item.model_dump()) for item in request.requirements],
                )
            await uow.audit.append(
                AuditEventWrite(
                    actor_id=user.id,
                    action="scholarship.created",
                    target_type="scholarship",
                    target_id=UUID(str(row["id"])),
                    target_name=request.title,
                    summary="Created draft scholarship.",
                    metadata={"data_version": 1},
                )
            )
            requirements = await uow.scholarships.requirements(UUID(str(row["id"])))
        return self._admin_response(row, requirements=requirements)

    async def update(
        self, user: CurrentUser, scholarship_id: UUID, patch: AdminScholarshipPatch
    ) -> AdminScholarshipResponse:
        changes = patch.changes()
        if not changes:
            raise ApiError(
                status_code=422,
                code="EMPTY_SCHOLARSHIP_UPDATE",
                message="At least one scholarship field must be provided.",
            )
        principal = DatabasePrincipal.for_user(user)
        async with self._database.unit_of_work(principal) as uow:
            current = await uow.catalog_admin.get(scholarship_id)
            if current is None:
                raise ApiError(
                    status_code=404,
                    code="SCHOLARSHIP_NOT_FOUND",
                    message="Scholarship not found.",
                )
            amount = changes.get("amount", current.get("amount"))
            currency = changes.get("currency", current.get("currency"))
            if (amount is None) != (currency is None):
                raise ApiError(
                    status_code=422,
                    code="INVALID_FUNDING_AMOUNT",
                    message="Amount and currency must be provided together.",
                )
            deadline = changes.get("deadline", current.get("deadline"))
            deadline_at = changes.get("deadline_at", current.get("deadline_at"))
            if deadline_at is not None and deadline is None:
                raise ApiError(
                    status_code=422,
                    code="INVALID_DEADLINE",
                    message="A deadline date is required when a deadline instant is provided.",
                )
            row = await uow.catalog_admin.update(
                scholarship_id, patch.expected_data_version, changes
            )
            if row is None:
                await self._raise_missing_or_conflict(uow, scholarship_id)
            assert row is not None
            await uow.audit.append(
                AuditEventWrite(
                    actor_id=user.id,
                    action="scholarship.updated",
                    target_type="scholarship",
                    target_id=scholarship_id,
                    target_name=str(row["title"]),
                    summary="Updated scholarship fields.",
                    metadata={"fields": sorted(changes)},
                )
            )
            refreshed = await uow.catalog_admin.get(scholarship_id)
            requirements = await uow.scholarships.requirements(scholarship_id)
        assert refreshed is not None
        return self._admin_response(refreshed, requirements=requirements)

    async def transition(
        self, user: CurrentUser, scholarship_id: UUID, request: LifecycleTransition
    ) -> AdminScholarshipResponse:
        principal = DatabasePrincipal.for_user(user)
        async with self._database.unit_of_work(principal) as uow:
            current = await uow.catalog_admin.get(scholarship_id)
            if current is None:
                raise ApiError(
                    status_code=404,
                    code="SCHOLARSHIP_NOT_FOUND",
                    message="Scholarship not found.",
                )
            current_status = str(current["status"])
            to_status = _TRANSITIONS.get(current_status, {}).get(request.action)
            if to_status is None:
                raise ApiError(
                    status_code=409,
                    code="INVALID_LIFECYCLE_TRANSITION",
                    message="The requested lifecycle transition is not allowed.",
                )
            if request.action == "publish":
                requirements = await uow.scholarships.requirements(scholarship_id)
                if not requirements or current.get("verified_at") is None:
                    raise ApiError(
                        status_code=409,
                        code="SCHOLARSHIP_REVIEW_REQUIRED",
                        message="A verified review and normalized requirements are required.",
                    )
                if current.get("deadline") is not None and current["deadline"] < date.today():
                    raise ApiError(
                        status_code=409,
                        code="SCHOLARSHIP_DEADLINE_EXPIRED",
                        message="A scholarship with a past deadline cannot be published.",
                    )
            row = await uow.catalog_admin.transition(
                scholarship_id,
                request.expected_data_version,
                from_status=current_status,
                to_status=to_status,
                mark_verified=request.action == "review",
                clear_verification=request.action == "submit_for_review",
                reviewer_notes=request.reviewer_notes,
            )
            if row is None:
                raise ApiError(
                    status_code=409,
                    code="SCHOLARSHIP_VERSION_CONFLICT",
                    message="The scholarship changed; reload it before retrying.",
                )
            await uow.audit.append(
                AuditEventWrite(
                    actor_id=user.id,
                    action=f"scholarship.{request.action}",
                    target_type="scholarship",
                    target_id=scholarship_id,
                    target_name=str(row["title"]),
                    summary=f"Transitioned scholarship to {to_status}.",
                    metadata={"from": current_status, "to": to_status},
                )
            )
            refreshed = await uow.catalog_admin.get(scholarship_id)
            requirements = await uow.scholarships.requirements(scholarship_id)
        assert refreshed is not None
        return self._admin_response(refreshed, requirements=requirements)

    @staticmethod
    async def _raise_missing_or_conflict(uow: Any, scholarship_id: UUID) -> Never:
        current = await uow.catalog_admin.get(scholarship_id)
        if current is None:
            raise ApiError(
                status_code=404,
                code="SCHOLARSHIP_NOT_FOUND",
                message="Scholarship not found.",
            )
        raise ApiError(
            status_code=409,
            code="SCHOLARSHIP_VERSION_CONFLICT",
            message="The scholarship changed; reload it before retrying.",
        )

    @staticmethod
    def _admin_response(
        row: dict[str, Any], *, requirements: list[dict[str, Any]]
    ) -> AdminScholarshipResponse:
        payload = _public_response(row, requirements=requirements).model_dump()
        payload["status"] = row["status"]
        payload["reviewer_notes"] = row.get("reviewer_notes")
        payload["allowed_transitions"] = sorted(_TRANSITIONS.get(str(row["status"]), {}))
        return AdminScholarshipResponse.model_validate(payload)
