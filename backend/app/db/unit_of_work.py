import json
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from psycopg import AsyncConnection, sql
from psycopg.rows import DictRow, dict_row
from psycopg_pool import AsyncConnectionPool

from app.core.config import ConfigurationError, Settings
from app.db.errors import translate_database_errors
from app.db.principal import Capability, DatabasePrincipal
from app.repositories.postgres import (
    PostgresApplicationRepository,
    PostgresAuditEventRepository,
    PostgresCatalogAdminRepository,
    PostgresDocumentRepository,
    PostgresIdempotencyRepository,
    PostgresIngestionRunRepository,
    PostgresMatchReadRepository,
    PostgresMatchWriteRepository,
    PostgresNotificationPreferenceRepository,
    PostgresProfileRepository,
    PostgresScholarshipReadRepository,
)


class PostgresUnitOfWork:
    def __init__(self, connection: AsyncConnection[DictRow], principal: DatabasePrincipal) -> None:
        self._connection = connection
        self._principal = principal

    @property
    def profiles(self) -> PostgresProfileRepository:
        self._principal.require(Capability.PROFILE)
        return PostgresProfileRepository(self._connection)

    @property
    def scholarships(self) -> PostgresScholarshipReadRepository:
        self._principal.require(Capability.CATALOG_READ)
        return PostgresScholarshipReadRepository(self._connection)

    @property
    def catalog_admin(self) -> PostgresCatalogAdminRepository:
        self._principal.require(Capability.CATALOG_WRITE)
        return PostgresCatalogAdminRepository(self._connection)

    @property
    def matches(self) -> PostgresMatchReadRepository:
        self._principal.require(Capability.MATCH_READ)
        return PostgresMatchReadRepository(self._connection)

    @property
    def match_writer(self) -> PostgresMatchWriteRepository:
        self._principal.require(Capability.MATCH_WRITE)
        return PostgresMatchWriteRepository(self._connection)

    @property
    def applications(self) -> PostgresApplicationRepository:
        self._principal.require(Capability.APPLICATIONS)
        return PostgresApplicationRepository(self._connection)

    @property
    def documents(self) -> PostgresDocumentRepository:
        self._principal.require(Capability.DOCUMENTS)
        return PostgresDocumentRepository(self._connection)

    @property
    def notifications(self) -> PostgresNotificationPreferenceRepository:
        self._principal.require(Capability.NOTIFICATIONS)
        return PostgresNotificationPreferenceRepository(self._connection)

    @property
    def ingestion(self) -> PostgresIngestionRunRepository:
        self._principal.require(Capability.INGESTION)
        return PostgresIngestionRunRepository(self._connection)

    @property
    def audit(self) -> PostgresAuditEventRepository:
        self._principal.require(Capability.AUDIT)
        return PostgresAuditEventRepository(self._connection)

    @property
    def idempotency(self) -> PostgresIdempotencyRepository:
        self._principal.require(Capability.IDEMPOTENCY)
        return PostgresIdempotencyRepository(self._connection)


class PostgresDatabase:
    def __init__(
        self,
        connection_string: str,
        *,
        min_size: int = 1,
        max_size: int = 10,
    ) -> None:
        self._pool: AsyncConnectionPool[AsyncConnection[DictRow]] = AsyncConnectionPool(
            conninfo=connection_string,
            min_size=min_size,
            max_size=max_size,
            open=False,
            kwargs={"row_factory": dict_row},
        )

    @classmethod
    def from_settings(cls, settings: Settings) -> "PostgresDatabase":
        if settings.database_url is None:
            raise ConfigurationError("Application configuration is invalid. Check: database_url.")
        return cls(settings.database_url.get_secret_value())

    async def open(self) -> None:
        await self._pool.open()
        await self._pool.wait()

    async def close(self) -> None:
        await self._pool.close()

    @asynccontextmanager
    async def unit_of_work(self, principal: DatabasePrincipal) -> AsyncIterator[PostgresUnitOfWork]:
        async with translate_database_errors():
            async with self._pool.connection() as connection:
                async with connection.transaction():
                    await self._configure_session(connection, principal)
                    yield PostgresUnitOfWork(connection, principal)

    @staticmethod
    async def _configure_session(
        connection: AsyncConnection[DictRow], principal: DatabasePrincipal
    ) -> None:
        await connection.execute(
            "select set_config('request.jwt.claims', %s, true)",
            (json.dumps(principal.database_claims(), separators=(",", ":")),),
        )
        await connection.execute(
            sql.SQL("set local role {}").format(sql.Identifier(principal.database_role.value))
        )
