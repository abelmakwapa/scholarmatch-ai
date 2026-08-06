import hashlib
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from pathlib import PurePath
from typing import Any
from uuid import UUID, uuid4

from app.auth.models import CurrentUser
from app.core.errors import ApiError
from app.db.principal import DatabasePrincipal
from app.db.protocols import Database
from app.repositories.models import DocumentWrite
from app.schemas.user import (
    DocumentPage,
    DocumentResponse,
    DocumentStatus,
    DocumentType,
    DocumentUploadPolicy,
    SignedDocumentUrlResponse,
)
from app.services.storage import PrivateDocumentStorage, StorageError
from app.services.work_queue import WorkQueue

_MIME_EXTENSIONS: dict[str, frozenset[str]] = {
    "application/pdf": frozenset({".pdf"}),
    "application/msword": frozenset({".doc"}),
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": frozenset({".docx"}),
    "image/jpeg": frozenset({".jpg", ".jpeg"}),
    "image/png": frozenset({".png"}),
}


def _has_expected_signature(mime_type: str, content: bytes) -> bool:
    signatures = {
        "application/pdf": (b"%PDF-",),
        "application/msword": (bytes.fromhex("D0CF11E0A1B11AE1"),),
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document": (
            b"PK\x03\x04",
            b"PK\x05\x06",
            b"PK\x07\x08",
        ),
        "image/jpeg": (b"\xff\xd8\xff",),
        "image/png": (b"\x89PNG\r\n\x1a\n",),
    }
    return content.startswith(signatures[mime_type])


@dataclass(frozen=True, slots=True)
class DocumentLimits:
    bucket: str
    maximum_size_bytes: int
    maximum_document_count: int
    total_quota_bytes: int
    download_ttl_seconds: int


@dataclass(frozen=True, slots=True)
class UploadPayload:
    filename: str
    mime_type: str
    content: bytes = field(repr=False)


def _safe_file(
    payload: UploadPayload, expected_checksum: str, maximum_size: int
) -> tuple[str, str]:
    filename = PurePath(payload.filename).name.strip()
    if not filename or "\x00" in filename or len(filename) > 255 or filename != payload.filename:
        raise ApiError(
            status_code=422,
            code="INVALID_FILENAME",
            message="The uploaded filename is invalid.",
        )
    if not payload.content:
        raise ApiError(status_code=422, code="EMPTY_FILE", message="The uploaded file is empty.")
    if len(payload.content) > maximum_size:
        raise ApiError(
            status_code=413,
            code="DOCUMENT_TOO_LARGE",
            message="The uploaded file exceeds the maximum allowed size.",
        )
    extension = PurePath(filename).suffix.lower()
    allowed = _MIME_EXTENSIONS.get(payload.mime_type)
    if allowed is None or extension not in allowed:
        raise ApiError(
            status_code=415,
            code="UNSUPPORTED_DOCUMENT_TYPE",
            message="The file MIME type and extension are not allowed.",
        )
    if not _has_expected_signature(payload.mime_type, payload.content):
        raise ApiError(
            status_code=415,
            code="DOCUMENT_SIGNATURE_MISMATCH",
            message="The file content does not match its declared MIME type.",
        )
    actual_checksum = hashlib.sha256(payload.content).hexdigest()
    if actual_checksum != expected_checksum.lower():
        raise ApiError(
            status_code=422,
            code="CHECKSUM_MISMATCH",
            message="The uploaded file checksum does not match.",
        )
    return filename, actual_checksum


class DocumentService:
    def __init__(
        self,
        database: Database,
        storage: PrivateDocumentStorage,
        queue: WorkQueue,
        limits: DocumentLimits,
    ) -> None:
        self._database = database
        self._storage = storage
        self._queue = queue
        self._limits = limits

    def policy(self) -> DocumentUploadPolicy:
        extensions = sorted(
            {extension for values in _MIME_EXTENSIONS.values() for extension in values}
        )
        return DocumentUploadPolicy(
            allowed_mime_types=sorted(_MIME_EXTENSIONS),
            allowed_extensions=extensions,
            maximum_size_bytes=self._limits.maximum_size_bytes,
            maximum_document_count=self._limits.maximum_document_count,
            total_quota_bytes=self._limits.total_quota_bytes,
        )

    async def list(self, user: CurrentUser) -> DocumentPage:
        async with self._database.unit_of_work(DatabasePrincipal.for_user(user)) as uow:
            rows = await uow.documents.list_for_profile(user.id, limit=100)
            _, total_bytes = await uow.documents.usage_for_profile(user.id)
        return DocumentPage(
            items=[DocumentResponse.model_validate(row) for row in rows],
            total_bytes=total_bytes,
        )

    async def create(
        self,
        user: CurrentUser,
        *,
        document_type: DocumentType,
        display_name: str | None,
        expected_checksum: str,
        payload: UploadPayload,
    ) -> DocumentResponse:
        filename, checksum = _safe_file(payload, expected_checksum, self._limits.maximum_size_bytes)
        document_id = uuid4()
        object_path = f"{user.id}/{document_id}/{uuid4()}{PurePath(filename).suffix.lower()}"
        write = DocumentWrite(
            id=document_id,
            profile_id=user.id,
            storage_bucket=self._limits.bucket,
            storage_object_path=object_path,
            document_type=document_type.value,
            display_name=(display_name or PurePath(filename).stem)[:200],
            original_filename=filename,
            mime_type=payload.mime_type,
            size_bytes=len(payload.content),
            checksum_sha256=checksum,
        )
        uploaded = False
        try:
            async with self._database.unit_of_work(DatabasePrincipal.for_user(user)) as uow:
                if await uow.profiles.get(user.id) is None:
                    raise ApiError(
                        status_code=409,
                        code="PROFILE_REQUIRED",
                        message="Create a profile before uploading documents.",
                    )
                count, used_bytes = await uow.documents.usage_for_profile(user.id)
                self._check_quota(count + 1, used_bytes + len(payload.content))
                await self._storage.upload(
                    bucket=self._limits.bucket,
                    object_path=object_path,
                    content=payload.content,
                    mime_type=payload.mime_type,
                )
                uploaded = True
                row = await uow.documents.create(write)
                await self._enqueue_scan(document_id, checksum)
        except StorageError:
            raise self._storage_unavailable() from None
        except Exception:
            if uploaded:
                await self._delete_or_schedule(document_id, object_path, "create-compensation")
            raise
        return DocumentResponse.model_validate(row)

    async def rename(
        self, user: CurrentUser, document_id: UUID, display_name: str
    ) -> DocumentResponse:
        async with self._database.unit_of_work(DatabasePrincipal.for_user(user)) as uow:
            row = await uow.documents.rename(document_id, user.id, display_name)
        return self._owned_response(row)

    async def replace(
        self,
        user: CurrentUser,
        document_id: UUID,
        *,
        expected_checksum: str,
        payload: UploadPayload,
    ) -> DocumentResponse:
        filename, checksum = _safe_file(payload, expected_checksum, self._limits.maximum_size_bytes)
        new_path = f"{user.id}/{document_id}/{uuid4()}{PurePath(filename).suffix.lower()}"
        async with self._database.unit_of_work(DatabasePrincipal.for_user(user)) as uow:
            existing = await uow.documents.get_for_profile(document_id, user.id)
            if existing is None:
                raise self._not_found()
            old_path = str(existing["storage_object_path"])
            count, used_bytes = await uow.documents.usage_for_profile(user.id)
            self._check_quota(
                count, used_bytes - int(existing["size_bytes"]) + len(payload.content)
            )
            write = DocumentWrite(
                id=document_id,
                profile_id=user.id,
                storage_bucket=self._limits.bucket,
                storage_object_path=new_path,
                document_type=str(existing["document_type"]),
                display_name=str(existing["display_name"]),
                original_filename=filename,
                mime_type=payload.mime_type,
                size_bytes=len(payload.content),
                checksum_sha256=checksum,
            )
            try:
                await self._storage.upload(
                    bucket=self._limits.bucket,
                    object_path=new_path,
                    content=payload.content,
                    mime_type=payload.mime_type,
                )
            except StorageError:
                raise self._storage_unavailable() from None
            try:
                row = await uow.documents.replace(document_id, user.id, write)
                if row is not None:
                    await self._enqueue_derived_cleanup(document_id, checksum)
                    await self._enqueue_scan(document_id, checksum)
            except Exception:
                await self._delete_or_schedule(document_id, new_path, "replace-compensation")
                raise
        if row is None:
            await self._delete_or_schedule(document_id, new_path, "replace-missing")
            raise self._not_found()
        await self._delete_or_schedule(document_id, old_path, "replaced-object")
        return DocumentResponse.model_validate(row)

    async def delete(self, user: CurrentUser, document_id: UUID) -> None:
        async with self._database.unit_of_work(DatabasePrincipal.for_user(user)) as uow:
            existing = await uow.documents.get_for_profile(document_id, user.id)
            if existing is None:
                raise self._not_found()
            row = await uow.documents.soft_delete(document_id, user.id)
            if row is not None:
                await self._enqueue_derived_cleanup(document_id, "deleted")
        if row is None:
            raise self._not_found()
        await self._delete_or_schedule(
            document_id, str(existing["storage_object_path"]), "deleted-object"
        )

    async def create_download_url(
        self, user: CurrentUser, document_id: UUID
    ) -> SignedDocumentUrlResponse:
        async with self._database.unit_of_work(DatabasePrincipal.for_user(user)) as uow:
            row = await uow.documents.get_for_profile(document_id, user.id)
        if row is None:
            raise self._not_found()
        if row["status"] != DocumentStatus.READY.value:
            raise ApiError(
                status_code=409,
                code="DOCUMENT_NOT_READY",
                message="The document is not ready for download.",
            )
        try:
            url = await self._storage.create_signed_download_url(
                bucket=str(row["storage_bucket"]),
                object_path=str(row["storage_object_path"]),
                expires_in=self._limits.download_ttl_seconds,
            )
        except StorageError:
            raise self._storage_unavailable() from None
        return SignedDocumentUrlResponse(
            url=url,
            expires_at=datetime.now(UTC) + timedelta(seconds=self._limits.download_ttl_seconds),
        )

    def _check_quota(self, count: int, total_bytes: int) -> None:
        if (
            count > self._limits.maximum_document_count
            or total_bytes > self._limits.total_quota_bytes
        ):
            raise ApiError(
                status_code=413,
                code="DOCUMENT_QUOTA_EXCEEDED",
                message="The private document quota would be exceeded.",
            )

    async def _delete_or_schedule(self, document_id: UUID, object_path: str, reason: str) -> None:
        try:
            await self._storage.delete(bucket=self._limits.bucket, object_path=object_path)
        except StorageError:
            await self._queue.enqueue_storage_delete(
                self._limits.bucket,
                object_path,
                idempotency_key=f"storage-delete:{document_id}:{reason}",
            )

    async def _enqueue_scan(self, document_id: UUID, checksum: str) -> None:
        try:
            await self._queue.enqueue_document_scan(
                document_id, idempotency_key=f"document-scan:{document_id}:{checksum}"
            )
        except Exception:
            raise ApiError(
                status_code=503,
                code="DOCUMENT_PROCESSING_UNAVAILABLE",
                message="The document could not be queued safely. Retry later.",
            ) from None

    async def _enqueue_derived_cleanup(self, document_id: UUID, version: str) -> None:
        try:
            await self._queue.enqueue_document_cleanup(
                document_id,
                idempotency_key=f"document-derived-cleanup:{document_id}:{version}",
            )
        except Exception:
            raise ApiError(
                status_code=503,
                code="DOCUMENT_PROCESSING_UNAVAILABLE",
                message="The document cleanup could not be queued safely. Retry later.",
            ) from None

    @staticmethod
    def _owned_response(row: dict[str, Any] | None) -> DocumentResponse:
        if row is None:
            raise DocumentService._not_found()
        return DocumentResponse.model_validate(row)

    @staticmethod
    def _not_found() -> ApiError:
        return ApiError(
            status_code=404,
            code="DOCUMENT_NOT_FOUND",
            message="Document not found.",
        )

    @staticmethod
    def _storage_unavailable() -> ApiError:
        return ApiError(
            status_code=503,
            code="DOCUMENT_STORAGE_UNAVAILABLE",
            message="Private document storage is temporarily unavailable.",
        )
