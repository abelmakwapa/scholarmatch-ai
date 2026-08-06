from datetime import date
from typing import Annotated, cast
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, status
from fastapi.exceptions import RequestValidationError
from pydantic import ValidationError

from app.auth.dependencies import require_role
from app.auth.models import ApplicationRole, CurrentUser
from app.core.errors import ApiError
from app.schemas.scholarship import (
    AdminScholarshipPatch,
    AdminScholarshipResponse,
    AdminScholarshipWrite,
    CatalogFilters,
    FundingType,
    LifecycleTransition,
    ScholarshipPage,
    ScholarshipResponse,
    ScholarshipSort,
    StudyLevel,
)
from app.schemas.user import CountryCode
from app.services.catalog import CatalogAdminService, CatalogService

router = APIRouter()


def _catalog_service(request: Request) -> CatalogService:
    service = cast(CatalogService | None, getattr(request.app.state, "catalog_service", None))
    if service is None:
        raise ApiError(
            status_code=503,
            code="CATALOG_SERVICE_UNAVAILABLE",
            message="The scholarship catalog is temporarily unavailable.",
        )
    return service


def _admin_service(request: Request) -> CatalogAdminService:
    service = cast(
        CatalogAdminService | None, getattr(request.app.state, "catalog_admin_service", None)
    )
    if service is None:
        raise ApiError(
            status_code=503,
            code="CATALOG_ADMIN_UNAVAILABLE",
            message="Scholarship administration is temporarily unavailable.",
        )
    return service


@router.get(
    "/admin/scholarships",
    response_model=list[AdminScholarshipResponse],
    tags=["Admin ingestion"],
)
async def list_admin_scholarships(
    user: Annotated[CurrentUser, Depends(require_role(ApplicationRole.ADMIN))],
    service: Annotated[CatalogAdminService, Depends(_admin_service)],
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> list[AdminScholarshipResponse]:
    return await service.list_all(user, limit=limit)


@router.get(
    "/admin/scholarships/{scholarship_id}",
    response_model=AdminScholarshipResponse,
    tags=["Admin ingestion"],
)
async def get_admin_scholarship(
    scholarship_id: UUID,
    user: Annotated[CurrentUser, Depends(require_role(ApplicationRole.ADMIN))],
    service: Annotated[CatalogAdminService, Depends(_admin_service)],
) -> AdminScholarshipResponse:
    return await service.get(user, scholarship_id)


@router.get("/scholarships", response_model=ScholarshipPage, tags=["Scholarships"])
async def list_scholarships(
    service: Annotated[CatalogService, Depends(_catalog_service)],
    query: Annotated[str | None, Query(alias="q", min_length=1, max_length=200)] = None,
    study_level: Annotated[StudyLevel | None, Query()] = None,
    field_of_study: Annotated[str | None, Query(alias="field", max_length=200)] = None,
    destination: Annotated[CountryCode | None, Query()] = None,
    nationality: Annotated[CountryCode | None, Query()] = None,
    residency: Annotated[CountryCode | None, Query()] = None,
    funding_type: Annotated[FundingType | None, Query()] = None,
    currency: Annotated[str | None, Query(pattern=r"^[A-Z]{3}$")] = None,
    deadline_from: Annotated[date | None, Query()] = None,
    deadline_to: Annotated[date | None, Query()] = None,
    verified: Annotated[bool | None, Query()] = None,
    sort: Annotated[ScholarshipSort, Query()] = ScholarshipSort.DEADLINE_ASC,
    cursor: Annotated[str | None, Query(max_length=500)] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> ScholarshipPage:
    try:
        filters = CatalogFilters(
            query=query,
            study_level=study_level,
            field_of_study=field_of_study,
            destination=destination,
            nationality=nationality,
            residency=residency,
            funding_type=funding_type,
            currency=currency,
            deadline_from=deadline_from,
            deadline_to=deadline_to,
            verified=verified,
            sort=sort,
        )
    except ValidationError as exc:
        raise RequestValidationError(exc.errors()) from None
    return await service.list(filters, cursor=cursor, limit=limit)


@router.get(
    "/scholarships/{scholarship_id}",
    response_model=ScholarshipResponse,
    tags=["Scholarships"],
)
async def get_scholarship(
    scholarship_id: UUID,
    service: Annotated[CatalogService, Depends(_catalog_service)],
) -> ScholarshipResponse:
    return await service.get(scholarship_id)


@router.post(
    "/admin/scholarships",
    response_model=AdminScholarshipResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Admin ingestion"],
)
async def create_scholarship(
    payload: AdminScholarshipWrite,
    user: Annotated[CurrentUser, Depends(require_role(ApplicationRole.ADMIN))],
    service: Annotated[CatalogAdminService, Depends(_admin_service)],
) -> AdminScholarshipResponse:
    return await service.create(user, payload)


@router.patch(
    "/admin/scholarships/{scholarship_id}",
    response_model=AdminScholarshipResponse,
    tags=["Admin ingestion"],
)
async def update_scholarship(
    scholarship_id: UUID,
    payload: AdminScholarshipPatch,
    user: Annotated[CurrentUser, Depends(require_role(ApplicationRole.ADMIN))],
    service: Annotated[CatalogAdminService, Depends(_admin_service)],
) -> AdminScholarshipResponse:
    return await service.update(user, scholarship_id, payload)


@router.post(
    "/admin/scholarships/{scholarship_id}/lifecycle",
    response_model=AdminScholarshipResponse,
    tags=["Admin ingestion"],
)
async def transition_scholarship(
    scholarship_id: UUID,
    payload: LifecycleTransition,
    user: Annotated[CurrentUser, Depends(require_role(ApplicationRole.ADMIN))],
    service: Annotated[CatalogAdminService, Depends(_admin_service)],
) -> AdminScholarshipResponse:
    return await service.transition(user, scholarship_id, payload)
