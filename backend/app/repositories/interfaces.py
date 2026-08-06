from collections.abc import Sequence
from datetime import datetime
from typing import Any, Protocol
from uuid import UUID

from app.repositories.models import (
    ApplicationWrite,
    AuditEventWrite,
    DocumentWrite,
    IngestionRunWrite,
    MatchWrite,
    ProfileWrite,
    RequirementWrite,
)

DatabaseRow = dict[str, Any]


class ProfileRepository(Protocol):
    async def get(self, profile_id: UUID) -> DatabaseRow | None: ...

    async def upsert(self, profile_id: UUID, profile: ProfileWrite) -> DatabaseRow: ...


class ScholarshipReadRepository(Protocol):
    async def get_published(self, scholarship_id: UUID) -> DatabaseRow | None: ...

    async def list_published(self, *, limit: int = 20) -> list[DatabaseRow]: ...


class CatalogAdminRepository(Protocol):
    async def replace_requirements(
        self, scholarship_id: UUID, requirements: Sequence[RequirementWrite]
    ) -> list[DatabaseRow]: ...


class MatchReadRepository(Protocol):
    async def list_for_profile(self, profile_id: UUID, *, limit: int = 20) -> list[DatabaseRow]: ...


class MatchWriteRepository(Protocol):
    async def upsert(self, match: MatchWrite) -> DatabaseRow: ...


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
