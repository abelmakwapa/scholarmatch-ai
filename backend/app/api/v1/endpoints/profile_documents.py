from typing import Annotated, cast
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, Request, Response, UploadFile, status

from app.auth.dependencies import get_current_user
from app.auth.models import CurrentUser
from app.core.errors import ApiError
from app.schemas.user import (
    DocumentPage,
    DocumentRename,
    DocumentResponse,
    DocumentType,
    DocumentUploadPolicy,
    ProfileResponse,
    ProfileUpdate,
    SignedDocumentUrlResponse,
)
from app.services.documents import DocumentService, UploadPayload
from app.services.profile import ProfileService

router = APIRouter()


def _profile_service(request: Request) -> ProfileService:
    service = cast(ProfileService | None, getattr(request.app.state, "profile_service", None))
    if service is None:
        raise ApiError(
            status_code=503,
            code="PROFILE_SERVICE_UNAVAILABLE",
            message="The profile service is temporarily unavailable.",
        )
    return service


def _document_service(request: Request) -> DocumentService:
    service = cast(DocumentService | None, getattr(request.app.state, "document_service", None))
    if service is None:
        raise ApiError(
            status_code=503,
            code="DOCUMENT_SERVICE_UNAVAILABLE",
            message="The private document service is temporarily unavailable.",
        )
    return service


async def _upload_payload(file: UploadFile, maximum_size: int) -> UploadPayload:
    content = await file.read(maximum_size + 1)
    await file.close()
    return UploadPayload(
        filename=file.filename or "",
        mime_type=file.content_type or "application/octet-stream",
        content=content,
    )


@router.get(
    "/profile",
    response_model=ProfileResponse,
    tags=["Profile"],
    summary="Get the authenticated student's profile",
)
async def get_profile(
    user: Annotated[CurrentUser, Depends(get_current_user)],
    service: Annotated[ProfileService, Depends(_profile_service)],
) -> ProfileResponse:
    return await service.get(user)


@router.put(
    "/profile",
    response_model=ProfileResponse,
    tags=["Profile"],
    summary="Create or partially update the authenticated student's profile",
    openapi_extra={
        "requestBody": {
            "content": {
                "application/json": {
                    "examples": {
                        "create": {
                            "value": {
                                "full_name": "Ada Student",
                                "country": "BW",
                                "study_level": "undergraduate",
                                "gpa": 4.2,
                                "gpa_scale": 5,
                                "interests": ["computer science"],
                                "requires_financial_aid": False,
                            }
                        },
                        "partial_update": {"value": {"field_of_study": "Computer Science"}},
                        "explicit_unknown": {"value": {"willing_to_relocate": None}},
                    }
                }
            }
        }
    },
)
async def update_profile(
    patch: ProfileUpdate,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    service: Annotated[ProfileService, Depends(_profile_service)],
) -> ProfileResponse:
    return await service.update(user, patch)


@router.get(
    "/profile/documents/policy",
    response_model=DocumentUploadPolicy,
    tags=["Documents"],
)
async def get_document_policy(
    _: Annotated[CurrentUser, Depends(get_current_user)],
    service: Annotated[DocumentService, Depends(_document_service)],
) -> DocumentUploadPolicy:
    return service.policy()


@router.get(
    "/profile/documents",
    response_model=DocumentPage,
    tags=["Documents"],
)
async def list_documents(
    user: Annotated[CurrentUser, Depends(get_current_user)],
    service: Annotated[DocumentService, Depends(_document_service)],
) -> DocumentPage:
    return await service.list(user)


@router.post(
    "/profile/documents",
    response_model=DocumentResponse,
    status_code=status.HTTP_202_ACCEPTED,
    tags=["Documents"],
    summary="Upload a private document for malware scanning and processing",
)
async def upload_document(
    file: Annotated[UploadFile, File(description="Private document bytes")],
    document_type: Annotated[DocumentType, Form()],
    checksum_sha256: Annotated[str, Form(pattern=r"^[a-fA-F0-9]{64}$")],
    user: Annotated[CurrentUser, Depends(get_current_user)],
    service: Annotated[DocumentService, Depends(_document_service)],
    display_name: Annotated[str | None, Form(min_length=1, max_length=200)] = None,
) -> DocumentResponse:
    payload = await _upload_payload(file, service.policy().maximum_size_bytes)
    return await service.create(
        user,
        document_type=document_type,
        display_name=display_name,
        expected_checksum=checksum_sha256,
        payload=payload,
    )


@router.patch(
    "/profile/documents/{document_id}",
    response_model=DocumentResponse,
    tags=["Documents"],
)
async def rename_document(
    document_id: UUID,
    rename: DocumentRename,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    service: Annotated[DocumentService, Depends(_document_service)],
) -> DocumentResponse:
    return await service.rename(user, document_id, rename.display_name)


@router.put(
    "/profile/documents/{document_id}",
    response_model=DocumentResponse,
    status_code=status.HTTP_202_ACCEPTED,
    tags=["Documents"],
)
async def replace_document(
    document_id: UUID,
    file: Annotated[UploadFile, File(description="Replacement private document bytes")],
    checksum_sha256: Annotated[str, Form(pattern=r"^[a-fA-F0-9]{64}$")],
    user: Annotated[CurrentUser, Depends(get_current_user)],
    service: Annotated[DocumentService, Depends(_document_service)],
) -> DocumentResponse:
    payload = await _upload_payload(file, service.policy().maximum_size_bytes)
    return await service.replace(
        user,
        document_id,
        expected_checksum=checksum_sha256,
        payload=payload,
    )


@router.delete(
    "/profile/documents/{document_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["Documents"],
)
async def delete_document(
    document_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    service: Annotated[DocumentService, Depends(_document_service)],
) -> Response:
    await service.delete(user, document_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/profile/documents/{document_id}/download-url",
    response_model=SignedDocumentUrlResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Documents"],
)
async def create_download_url(
    document_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    service: Annotated[DocumentService, Depends(_document_service)],
) -> SignedDocumentUrlResponse:
    return await service.create_download_url(user, document_id)
