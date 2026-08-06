from contextlib import AbstractAsyncContextManager
from typing import Protocol

from app.db.principal import DatabasePrincipal
from app.repositories.interfaces import (
    AuditEventRepository,
    CatalogAdminRepository,
    DocumentRepository,
    IngestionRunRepository,
    ProfileRepository,
    ScholarshipReadRepository,
)


class UserUnitOfWork(Protocol):
    @property
    def profiles(self) -> ProfileRepository: ...

    @property
    def documents(self) -> DocumentRepository: ...

    @property
    def scholarships(self) -> ScholarshipReadRepository: ...

    @property
    def catalog_admin(self) -> CatalogAdminRepository: ...

    @property
    def ingestion(self) -> IngestionRunRepository: ...

    @property
    def audit(self) -> AuditEventRepository: ...


class Database(Protocol):
    def unit_of_work(
        self, principal: DatabasePrincipal
    ) -> AbstractAsyncContextManager[UserUnitOfWork]: ...
