from contextlib import AbstractAsyncContextManager
from typing import Protocol

from app.db.principal import DatabasePrincipal
from app.repositories.interfaces import DocumentRepository, ProfileRepository


class UserUnitOfWork(Protocol):
    @property
    def profiles(self) -> ProfileRepository: ...

    @property
    def documents(self) -> DocumentRepository: ...


class Database(Protocol):
    def unit_of_work(
        self, principal: DatabasePrincipal
    ) -> AbstractAsyncContextManager[UserUnitOfWork]: ...
