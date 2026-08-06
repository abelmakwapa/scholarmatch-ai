import hashlib
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from dataclasses import asdict
from datetime import UTC, datetime
from typing import cast
from uuid import UUID, uuid4

from app.auth.models import ApplicationRole, CurrentUser
from app.core.config import Environment, Settings
from app.db.principal import DatabasePrincipal
from app.db.protocols import Database, UserUnitOfWork
from app.main import create_app
from app.repositories.interfaces import DatabaseRow
from app.repositories.models import DocumentWrite, ProfileWrite
from app.services.storage import PrivateDocumentStorage, StorageError
from app.services.work_queue import WorkQueue
from fastapi.testclient import TestClient


class FakeProfiles:
    def __init__(self) -> None:
        self.rows: dict[UUID, DatabaseRow] = {}

    async def get(self, profile_id: UUID) -> DatabaseRow | None:
        return self.rows.get(profile_id)

    async def upsert(self, profile_id: UUID, profile: ProfileWrite) -> DatabaseRow:
        now = datetime.now(UTC)
        previous = self.rows.get(profile_id)
        row: DatabaseRow = {
            "id": profile_id,
            **asdict(profile),
            "created_at": previous["created_at"] if previous else now,
            "updated_at": now,
        }
        self.rows[profile_id] = row
        return row


class FakeDocuments:
    def __init__(self) -> None:
        self.rows: dict[UUID, DatabaseRow] = {}

    def _owned(self, document_id: UUID, profile_id: UUID) -> DatabaseRow | None:
        row = self.rows.get(document_id)
        if row is None or row["profile_id"] != profile_id or row.get("deleted_at") is not None:
            return None
        return row

    async def list_for_profile(self, profile_id: UUID, *, limit: int = 20) -> list[DatabaseRow]:
        return [
            row
            for row in self.rows.values()
            if row["profile_id"] == profile_id and row.get("deleted_at") is None
        ][:limit]

    async def usage_for_profile(self, profile_id: UUID) -> tuple[int, int]:
        rows = await self.list_for_profile(profile_id, limit=1000)
        return len(rows), sum(int(row["size_bytes"]) for row in rows)

    async def get_for_profile(self, document_id: UUID, profile_id: UUID) -> DatabaseRow | None:
        return self._owned(document_id, profile_id)

    async def create(self, document: DocumentWrite) -> DatabaseRow:
        now = datetime.now(UTC)
        row: DatabaseRow = {
            **asdict(document),
            "status": "uploaded",
            "scan_status": "pending",
            "created_at": now,
            "updated_at": now,
            "deleted_at": None,
        }
        self.rows[document.id] = row
        return row

    async def rename(
        self, document_id: UUID, profile_id: UUID, display_name: str
    ) -> DatabaseRow | None:
        row = self._owned(document_id, profile_id)
        if row is not None:
            row["display_name"] = display_name
            row["updated_at"] = datetime.now(UTC)
        return row

    async def replace(
        self, document_id: UUID, profile_id: UUID, document: DocumentWrite
    ) -> DatabaseRow | None:
        row = self._owned(document_id, profile_id)
        if row is not None:
            row.update(asdict(document))
            row["status"] = "uploaded"
            row["updated_at"] = datetime.now(UTC)
        return row

    async def soft_delete(self, document_id: UUID, profile_id: UUID) -> DatabaseRow | None:
        row = self._owned(document_id, profile_id)
        if row is not None:
            row["status"] = "deleted"
            row["deleted_at"] = datetime.now(UTC)
        return row


class FakeUnitOfWork:
    def __init__(self, profiles: FakeProfiles, documents: FakeDocuments) -> None:
        self.profiles = profiles
        self.documents = documents


class FakeDatabase:
    def __init__(self) -> None:
        self.profiles = FakeProfiles()
        self.documents = FakeDocuments()

    @asynccontextmanager
    async def unit_of_work(self, principal: DatabasePrincipal) -> AsyncIterator[UserUnitOfWork]:
        del principal
        yield cast(UserUnitOfWork, FakeUnitOfWork(self.profiles, self.documents))


class FakeStorage:
    def __init__(self) -> None:
        self.objects: dict[tuple[str, str], bytes] = {}
        self.fail_upload = False
        self.fail_download = False
        self.fail_delete = False
        self.last_expiry: int | None = None

    async def upload(
        self,
        *,
        bucket: str,
        object_path: str,
        content: bytes,
        mime_type: str,
    ) -> None:
        del mime_type
        if self.fail_upload:
            raise StorageError("provider secret detail")
        self.objects[(bucket, object_path)] = content

    async def delete(self, *, bucket: str, object_path: str) -> None:
        if self.fail_delete:
            raise StorageError("provider secret detail")
        self.objects.pop((bucket, object_path), None)

    async def create_signed_download_url(
        self, *, bucket: str, object_path: str, expires_in: int
    ) -> str:
        if self.fail_download:
            raise StorageError("provider secret detail")
        assert (bucket, object_path) in self.objects
        self.last_expiry = expires_in
        return "https://storage.example.invalid/signed/redacted"


class FakeQueue:
    def __init__(self) -> None:
        self.keys: set[str] = set()

    def _add(self, key: str) -> bool:
        previous = key in self.keys
        self.keys.add(key)
        return not previous

    async def enqueue_rematch(
        self, profile_id: UUID, data_version: int, *, idempotency_key: str
    ) -> bool:
        del profile_id, data_version
        return self._add(idempotency_key)

    async def enqueue_document_scan(self, document_id: UUID, *, idempotency_key: str) -> bool:
        del document_id
        return self._add(idempotency_key)

    async def enqueue_document_cleanup(self, document_id: UUID, *, idempotency_key: str) -> bool:
        del document_id
        return self._add(idempotency_key)

    async def enqueue_storage_delete(
        self, bucket: str, object_path: str, *, idempotency_key: str
    ) -> bool:
        del bucket, object_path
        return self._add(idempotency_key)


class StaticVerifier:
    def __init__(self, user: CurrentUser) -> None:
        self.user = user

    async def verify(self, token: str) -> CurrentUser:
        assert token == "test-token"
        return self.user


def _client(
    *, maximum_size: int = 1024, maximum_count: int = 2, quota: int = 2048
) -> tuple[TestClient, FakeDatabase, FakeStorage, FakeQueue, StaticVerifier]:
    user = CurrentUser(id=uuid4(), role=ApplicationRole.USER)
    verifier = StaticVerifier(user)
    database = FakeDatabase()
    storage = FakeStorage()
    queue = FakeQueue()
    settings = Settings(
        _env_file=None,
        environment=Environment.TEST,
        cors_allowed_origins=["http://localhost:3000"],
        private_document_bucket="profile-documents",
        document_max_size_bytes=maximum_size,
        document_max_count=maximum_count,
        document_quota_bytes=quota,
        document_download_ttl_seconds=60,
    )
    app = create_app(
        settings=settings,
        jwt_verifier=verifier,
        database=cast(Database, database),
        document_storage=cast(PrivateDocumentStorage, storage),
        work_queue=cast(WorkQueue, queue),
        readiness_checks={},
    )
    return TestClient(app), database, storage, queue, verifier


def _auth() -> dict[str, str]:
    return {"Authorization": "Bearer test-token"}


def _create_profile(client: TestClient) -> dict[str, object]:
    response = client.put(
        "/api/v1/profile",
        headers=_auth(),
        json={
            "full_name": "Ada Student",
            "country": "bw",
            "study_level": "undergraduate",
            "gpa": 4.2,
            "gpa_scale": 5,
            "interests": ["Computer Science"],
            "requires_financial_aid": False,
        },
    )
    assert response.status_code == 200, response.text
    return cast(dict[str, object], response.json())


def _pdf() -> tuple[bytes, str]:
    content = b"%PDF-1.7 safe test document"
    return content, hashlib.sha256(content).hexdigest()


def test_profile_partial_updates_completeness_and_data_version() -> None:
    client, _, _, queue, _ = _client()
    created = _create_profile(client)

    assert created["country"] == "BW"
    assert created["requires_financial_aid"] is False
    assert created["data_version"] == 1
    completeness = cast(dict[str, object], created["completeness"])
    assert completeness["version"] == "2026-08-06"
    assert completeness["required_completed"] == 3
    assert len(queue.keys) == 1

    name_only = client.put("/api/v1/profile", headers=_auth(), json={"full_name": "Ada Lovelace"})
    assert name_only.status_code == 200
    assert name_only.json()["data_version"] == 1
    assert len(queue.keys) == 1

    matching_change = client.put(
        "/api/v1/profile", headers=_auth(), json={"field_of_study": "Computing"}
    )
    assert matching_change.status_code == 200
    assert matching_change.json()["data_version"] == 2
    assert len(queue.keys) == 2

    same_change = client.put(
        "/api/v1/profile", headers=_auth(), json={"field_of_study": "Computing"}
    )
    assert same_change.status_code == 200
    assert same_change.json()["data_version"] == 2
    assert len(queue.keys) == 2


def test_profile_validation_and_explicit_unknown() -> None:
    client, _, _, _, _ = _client()

    invalid_country = client.put(
        "/api/v1/profile",
        headers=_auth(),
        json={"full_name": "Student", "country": "ZZ", "study_level": "undergraduate"},
    )
    assert invalid_country.status_code == 422
    assert invalid_country.json()["error"]["code"] == "VALIDATION_ERROR"

    missing_scale = client.put(
        "/api/v1/profile",
        headers=_auth(),
        json={
            "full_name": "Student",
            "country": "BW",
            "study_level": "undergraduate",
            "gpa": 3.5,
        },
    )
    assert missing_scale.status_code == 422
    assert missing_scale.json()["error"]["code"] == "INVALID_PROFILE_STATE"

    _create_profile(client)
    unknown = client.put("/api/v1/profile", headers=_auth(), json={"requires_financial_aid": None})
    assert unknown.status_code == 200
    assert unknown.json()["requires_financial_aid"] is None


def test_document_upload_owner_isolation_and_signed_url_expiry() -> None:
    client, database, storage, _, verifier = _client()
    _create_profile(client)
    content, checksum = _pdf()
    response = client.post(
        "/api/v1/profile/documents",
        headers=_auth(),
        data={"document_type": "cv", "checksum_sha256": checksum},
        files={"file": ("resume.pdf", content, "application/pdf")},
    )
    assert response.status_code == 202, response.text
    document_id = UUID(response.json()["id"])
    row = database.documents.rows[document_id]
    assert "resume" not in str(row["storage_object_path"])

    row["status"] = "ready"
    download = client.post(f"/api/v1/profile/documents/{document_id}/download-url", headers=_auth())
    assert download.status_code == 201
    assert download.json()["url"].startswith("https://storage.example.invalid/")
    assert storage.last_expiry == 60
    expires_at = datetime.fromisoformat(download.json()["expires_at"])
    remaining_seconds = (expires_at - datetime.now(UTC)).total_seconds()
    assert 55 <= remaining_seconds <= 60

    storage.fail_download = True
    unavailable = client.post(
        f"/api/v1/profile/documents/{document_id}/download-url", headers=_auth()
    )
    assert unavailable.status_code == 503
    assert unavailable.json()["error"]["code"] == "DOCUMENT_STORAGE_UNAVAILABLE"
    assert "secret" not in unavailable.text
    storage.fail_download = False

    verifier.user = CurrentUser(id=uuid4(), role=ApplicationRole.USER)
    other_user = client.post(
        f"/api/v1/profile/documents/{document_id}/download-url", headers=_auth()
    )
    assert other_user.status_code == 404
    assert "storage_object_path" not in other_user.text


def test_document_validation_quota_and_storage_failures_are_safe() -> None:
    client, _, storage, _, _ = _client(maximum_size=64, maximum_count=1, quota=64)
    _create_profile(client)
    content, checksum = _pdf()

    bad_mime = client.post(
        "/api/v1/profile/documents",
        headers=_auth(),
        data={"document_type": "cv", "checksum_sha256": checksum},
        files={"file": ("resume.exe", content, "application/pdf")},
    )
    assert bad_mime.status_code == 415

    bad_checksum = client.post(
        "/api/v1/profile/documents",
        headers=_auth(),
        data={"document_type": "cv", "checksum_sha256": "a" * 64},
        files={"file": ("resume.pdf", content, "application/pdf")},
    )
    assert bad_checksum.status_code == 422

    fake_pdf = b"not actually a PDF"
    bad_signature = client.post(
        "/api/v1/profile/documents",
        headers=_auth(),
        data={
            "document_type": "cv",
            "checksum_sha256": hashlib.sha256(fake_pdf).hexdigest(),
        },
        files={"file": ("resume.pdf", fake_pdf, "application/pdf")},
    )
    assert bad_signature.status_code == 415
    assert bad_signature.json()["error"]["code"] == "DOCUMENT_SIGNATURE_MISMATCH"

    oversized = b"%PDF-" + (b"x" * 64)
    too_large = client.post(
        "/api/v1/profile/documents",
        headers=_auth(),
        data={
            "document_type": "cv",
            "checksum_sha256": hashlib.sha256(oversized).hexdigest(),
        },
        files={"file": ("resume.pdf", oversized, "application/pdf")},
    )
    assert too_large.status_code == 413
    assert too_large.json()["error"]["code"] == "DOCUMENT_TOO_LARGE"

    storage.fail_upload = True
    failed = client.post(
        "/api/v1/profile/documents",
        headers=_auth(),
        data={"document_type": "cv", "checksum_sha256": checksum},
        files={"file": ("resume.pdf", content, "application/pdf")},
    )
    assert failed.status_code == 503
    assert failed.json()["error"]["code"] == "DOCUMENT_STORAGE_UNAVAILABLE"
    assert "secret" not in failed.text

    storage.fail_upload = False
    accepted = client.post(
        "/api/v1/profile/documents",
        headers=_auth(),
        data={"document_type": "cv", "checksum_sha256": checksum},
        files={"file": ("resume.pdf", content, "application/pdf")},
    )
    assert accepted.status_code == 202
    quota = client.post(
        "/api/v1/profile/documents",
        headers=_auth(),
        data={"document_type": "cv", "checksum_sha256": checksum},
        files={"file": ("second.pdf", content, "application/pdf")},
    )
    assert quota.status_code == 413
    assert quota.json()["error"]["code"] == "DOCUMENT_QUOTA_EXCEEDED"


def test_replace_and_delete_enqueue_scanning_and_derived_cleanup() -> None:
    client, database, storage, queue, _ = _client()
    _create_profile(client)
    content, checksum = _pdf()
    upload = client.post(
        "/api/v1/profile/documents",
        headers=_auth(),
        data={"document_type": "transcript", "checksum_sha256": checksum},
        files={"file": ("transcript.pdf", content, "application/pdf")},
    )
    document_id = UUID(upload.json()["id"])
    original_path = str(database.documents.rows[document_id]["storage_object_path"])

    replacement = b"%PDF-1.7 replacement"
    replacement_checksum = hashlib.sha256(replacement).hexdigest()
    replaced = client.put(
        f"/api/v1/profile/documents/{document_id}",
        headers=_auth(),
        data={"checksum_sha256": replacement_checksum},
        files={"file": ("replacement.pdf", replacement, "application/pdf")},
    )
    assert replaced.status_code == 202
    assert ("profile-documents", original_path) not in storage.objects
    assert any(key.startswith("document-derived-cleanup:") for key in queue.keys)

    storage.fail_delete = True
    deleted = client.delete(f"/api/v1/profile/documents/{document_id}", headers=_auth())
    assert deleted.status_code == 204
    assert database.documents.rows[document_id]["status"] == "deleted"
    assert any(key.startswith("storage-delete:") for key in queue.keys)
    assert any(key.endswith(":deleted") for key in queue.keys)
