from typing import Annotated, cast
from uuid import UUID

from fastapi import APIRouter, Depends, Header, Query, Request, status

from app.auth.dependencies import require_role
from app.auth.models import ApplicationRole, CurrentUser
from app.core.errors import ApiError
from app.schemas.scholarship import IngestionRunCreate, IngestionRunResponse
from app.services.ingestion import IngestionAdminService

router = APIRouter()


def _service(request: Request) -> IngestionAdminService:
    service = cast(
        IngestionAdminService | None,
        getattr(request.app.state, "ingestion_admin_service", None),
    )
    if service is None:
        raise ApiError(
            status_code=503,
            code="INGESTION_SERVICE_UNAVAILABLE",
            message="The ingestion service is temporarily unavailable.",
        )
    return service


@router.get(
    "/admin/ingestion-runs",
    response_model=list[IngestionRunResponse],
    tags=["Admin ingestion"],
)
async def list_ingestion_runs(
    user: Annotated[CurrentUser, Depends(require_role(ApplicationRole.ADMIN))],
    service: Annotated[IngestionAdminService, Depends(_service)],
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> list[IngestionRunResponse]:
    return await service.list(user, limit=limit)


@router.post(
    "/admin/ingestion-runs",
    response_model=IngestionRunResponse,
    status_code=status.HTTP_202_ACCEPTED,
    tags=["Admin ingestion"],
)
async def create_ingestion_run(
    payload: IngestionRunCreate,
    idempotency_key: Annotated[
        str,
        Header(
            alias="Idempotency-Key", min_length=1, max_length=128, pattern=r"^[A-Za-z0-9._~-]+$"
        ),
    ],
    user: Annotated[CurrentUser, Depends(require_role(ApplicationRole.ADMIN))],
    service: Annotated[IngestionAdminService, Depends(_service)],
) -> IngestionRunResponse:
    return await service.create(user, payload, idempotency_key=idempotency_key)


@router.get(
    "/admin/ingestion-runs/{run_id}",
    response_model=IngestionRunResponse,
    tags=["Admin ingestion"],
)
async def get_ingestion_run(
    run_id: UUID,
    user: Annotated[CurrentUser, Depends(require_role(ApplicationRole.ADMIN))],
    service: Annotated[IngestionAdminService, Depends(_service)],
) -> IngestionRunResponse:
    return await service.get(user, run_id)


@router.post(
    "/admin/ingestion-runs/{run_id}/retry",
    response_model=IngestionRunResponse,
    status_code=status.HTTP_202_ACCEPTED,
    tags=["Admin ingestion"],
)
async def retry_ingestion_run(
    run_id: UUID,
    idempotency_key: Annotated[
        str,
        Header(
            alias="Idempotency-Key", min_length=1, max_length=128, pattern=r"^[A-Za-z0-9._~-]+$"
        ),
    ],
    user: Annotated[CurrentUser, Depends(require_role(ApplicationRole.ADMIN))],
    service: Annotated[IngestionAdminService, Depends(_service)],
) -> IngestionRunResponse:
    return await service.retry(user, run_id, idempotency_key=idempotency_key)
