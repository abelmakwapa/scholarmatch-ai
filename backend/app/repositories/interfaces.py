from collections.abc import Sequence
from datetime import datetime
from typing import Any, Protocol
from uuid import UUID

from app.repositories.models import (
    ApplicationWrite,
    AuditEventWrite,
    DocumentWrite,
    IngestionRunWrite,
    MatchJobWrite,
    MatchWrite,
    NormalizedSourceWrite,
    ProfileWrite,
    RawSourceRecordWrite,
    RequirementWrite,
    ScholarshipWrite,
)
from app.schemas.scholarship import CatalogFilters

DatabaseRow = dict[str, Any]


class ProfileRepository(Protocol):
    async def get(self, profile_id: UUID) -> DatabaseRow | None: ...

    async def upsert(self, profile_id: UUID, profile: ProfileWrite) -> DatabaseRow: ...


class ScholarshipReadRepository(Protocol):
    async def get_published(self, scholarship_id: UUID) -> DatabaseRow | None: ...

    async def list_published(
        self,
        filters: CatalogFilters,
        *,
        cursor: dict[str, str] | None,
        limit: int = 20,
    ) -> list[DatabaseRow]: ...

    async def requirements(self, scholarship_id: UUID) -> list[DatabaseRow]: ...

    async def provenance(self, scholarship_id: UUID) -> list[DatabaseRow]: ...

    async def list_for_matching(self, *, limit: int) -> list[DatabaseRow]: ...

    async def count_for_matching(self) -> int: ...


class CatalogAdminRepository(Protocol):
    async def get(self, scholarship_id: UUID) -> DatabaseRow | None: ...

    async def list_all(self, *, limit: int = 20) -> list[DatabaseRow]: ...

    async def create(self, scholarship: ScholarshipWrite) -> DatabaseRow: ...

    async def update(
        self, scholarship_id: UUID, expected_version: int, changes: dict[str, Any]
    ) -> DatabaseRow | None: ...

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
    ) -> DatabaseRow | None: ...

    async def replace_requirements(
        self, scholarship_id: UUID, requirements: Sequence[RequirementWrite]
    ) -> list[DatabaseRow]: ...


class MatchReadRepository(Protocol):
    async def get(self, profile_id: UUID, scholarship_id: UUID) -> DatabaseRow | None: ...

    async def list_for_profile(
        self,
        profile_id: UUID,
        *,
        cursor: dict[str, str] | None,
        limit: int = 20,
    ) -> list[DatabaseRow]: ...

    async def list_current(
        self,
        profile_id: UUID,
        *,
        profile_data_version: int,
        algorithm_version: str,
    ) -> list[DatabaseRow]: ...


class MatchWriteRepository(Protocol):
    async def upsert(self, match: MatchWrite) -> DatabaseRow: ...

    async def delete(self, profile_id: UUID, scholarship_id: UUID) -> None: ...

    async def create_job(self, job: MatchJobWrite) -> DatabaseRow: ...


class ApplicationRepository(Protocol):
    async def get(self, application_id: UUID, profile_id: UUID) -> DatabaseRow | None: ...

    async def create(self, application: ApplicationWrite) -> DatabaseRow: ...


class DocumentRepository(Protocol):
    async def list_for_profile(self, profile_id: UUID, *, limit: int = 20) -> list[DatabaseRow]: ...

    async def usage_for_profile(self, profile_id: UUID) -> tuple[int, int]: ...

    async def get_for_profile(self, document_id: UUID, profile_id: UUID) -> DatabaseRow | None: ...

    async def create(self, document: DocumentWrite) -> DatabaseRow: ...

    async def rename(
        self, document_id: UUID, profile_id: UUID, display_name: str
    ) -> DatabaseRow | None: ...

    async def replace(
        self, document_id: UUID, profile_id: UUID, document: DocumentWrite
    ) -> DatabaseRow | None: ...

    async def soft_delete(self, document_id: UUID, profile_id: UUID) -> DatabaseRow | None: ...


class NotificationPreferenceRepository(Protocol):
    async def get(self, profile_id: UUID) -> DatabaseRow | None: ...

    async def upsert(
        self,
        profile_id: UUID,
        *,
        deadline_reminders_enabled: bool,
        product_updates_enabled: bool,
        reminder_days: Sequence[int],
        timezone: str,
    ) -> DatabaseRow: ...


class IngestionRunRepository(Protocol):
    async def create(self, run: IngestionRunWrite) -> DatabaseRow: ...

    async def get(self, run_id: UUID) -> DatabaseRow | None: ...

    async def list_recent(self, *, limit: int = 20) -> list[DatabaseRow]: ...

    async def claim(self, run_id: UUID) -> DatabaseRow | None: ...

    async def store_raw(
        self, run_id: UUID, position: int, batch_number: int, record: RawSourceRecordWrite
    ) -> DatabaseRow: ...

    async def apply_normalized(
        self,
        run_id: UUID,
        raw_record_id: UUID,
        normalized: NormalizedSourceWrite,
        *,
        dry_run: bool,
    ) -> str: ...

    async def reject(
        self,
        run_id: UUID,
        raw_record_id: UUID | None,
        *,
        reason_code: str,
        safe_summary: str,
        fingerprint: str | None = None,
        candidates: Sequence[UUID] = (),
    ) -> None: ...

    async def fail_item(
        self,
        run_id: UUID,
        raw_record_id: UUID,
        *,
        safe_error_code: str,
        safe_error_summary: str,
    ) -> bool: ...

    async def advance(
        self,
        run_id: UUID,
        *,
        resume_cursor: int,
        counters: dict[str, int],
        status: str,
        safe_errors: list[dict[str, Any]] | None = None,
    ) -> DatabaseRow: ...


class AuditEventRepository(Protocol):
    async def append(self, event: AuditEventWrite) -> DatabaseRow: ...


class IdempotencyRepository(Protocol):
    async def get(self, actor_id: UUID, operation: str, key: str) -> DatabaseRow | None: ...

    async def reserve(
        self,
        *,
        actor_id: UUID,
        operation: str,
        key: str,
        request_hash: str,
        expires_at: datetime,
    ) -> DatabaseRow: ...
