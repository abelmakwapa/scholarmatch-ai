from typing import Annotated, cast
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, status
from fastapi.responses import JSONResponse

from app.auth.dependencies import get_current_user
from app.auth.models import CurrentUser
from app.core.errors import ApiError
from app.schemas.match import MatchDetail, MatchPage, RecalculationResponse
from app.services.matches import MatchingService

router = APIRouter()


def _service(request: Request) -> MatchingService:
    service = cast(MatchingService | None, getattr(request.app.state, "matching_service", None))
    if service is None:
        raise ApiError(
            status_code=503,
            code="MATCHING_SERVICE_UNAVAILABLE",
            message="Deterministic matching is temporarily unavailable.",
        )
    return service


@router.get("/matches", response_model=MatchPage, tags=["Matches"])
async def list_matches(
    user: Annotated[CurrentUser, Depends(get_current_user)],
    service: Annotated[MatchingService, Depends(_service)],
    cursor: Annotated[str | None, Query(max_length=500)] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> MatchPage:
    return await service.list(user, cursor=cursor, limit=limit)


@router.post(
    "/matches/recalculate",
    response_model=RecalculationResponse,
    responses={
        status.HTTP_202_ACCEPTED: {
            "model": RecalculationResponse,
            "description": "A deterministic calculation job was accepted.",
        }
    },
    tags=["Matches"],
)
async def recalculate_matches(
    user: Annotated[CurrentUser, Depends(get_current_user)],
    service: Annotated[MatchingService, Depends(_service)],
) -> RecalculationResponse | JSONResponse:
    result = await service.recalculate(user)
    if result.mode == "accepted":
        return JSONResponse(
            status_code=status.HTTP_202_ACCEPTED,
            content=result.model_dump(mode="json"),
        )
    return result


@router.get(
    "/matches/{scholarship_id}",
    response_model=MatchDetail,
    tags=["Matches"],
)
async def get_match(
    scholarship_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    service: Annotated[MatchingService, Depends(_service)],
) -> MatchDetail:
    return await service.get(user, scholarship_id)
