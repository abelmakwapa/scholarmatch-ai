from dataclasses import dataclass
from enum import StrEnum
from uuid import UUID

from app.auth.models import ApplicationRole, CurrentUser


class DatabaseRole(StrEnum):
    AUTHENTICATED = "authenticated"
    SERVICE_ROLE = "service_role"


class Capability(StrEnum):
    PROFILE = "profile"
    DOCUMENTS = "documents"
    MATCH_READ = "match_read"
    MATCH_WRITE = "match_write"
    APPLICATIONS = "applications"
    NOTIFICATIONS = "notifications"
    CATALOG_READ = "catalog_read"
    CATALOG_WRITE = "catalog_write"
    INGESTION = "ingestion"
    AUDIT = "audit"
    IDEMPOTENCY = "idempotency"


class ServicePurpose(StrEnum):
    MATCH_WORKER = "match_worker"
    INGESTION_WORKER = "ingestion_worker"
    IDEMPOTENCY = "idempotency"


_USER_CAPABILITIES = frozenset(
    {
        Capability.PROFILE,
        Capability.DOCUMENTS,
        Capability.MATCH_READ,
        Capability.APPLICATIONS,
        Capability.NOTIFICATIONS,
        Capability.CATALOG_READ,
    }
)

_SERVICE_CAPABILITIES: dict[ServicePurpose, frozenset[Capability]] = {
    ServicePurpose.MATCH_WORKER: frozenset(
        {
            Capability.PROFILE,
            Capability.CATALOG_READ,
            Capability.MATCH_READ,
            Capability.MATCH_WRITE,
        }
    ),
    ServicePurpose.INGESTION_WORKER: frozenset(
        {
            Capability.CATALOG_READ,
            Capability.CATALOG_WRITE,
            Capability.INGESTION,
            Capability.AUDIT,
        }
    ),
    ServicePurpose.IDEMPOTENCY: frozenset({Capability.IDEMPOTENCY}),
}


class RepositoryAuthorizationError(RuntimeError):
    """A repository was requested outside an explicitly authorized scope."""


@dataclass(frozen=True, slots=True)
class DatabasePrincipal:
    database_role: DatabaseRole
    subject: UUID | None
    application_role: ApplicationRole | None
    capabilities: frozenset[Capability]
    authorization_reason: str

    @classmethod
    def for_user(cls, user: CurrentUser) -> "DatabasePrincipal":
        capabilities = _USER_CAPABILITIES
        if user.role is ApplicationRole.ADMIN:
            capabilities = capabilities | {
                Capability.CATALOG_WRITE,
                Capability.INGESTION,
                Capability.AUDIT,
            }
        return cls(
            database_role=DatabaseRole.AUTHENTICATED,
            subject=user.id,
            application_role=user.role,
            capabilities=frozenset(capabilities),
            authorization_reason="verified_user_request",
        )

    @classmethod
    def for_service(
        cls, purpose: ServicePurpose, *, authorization_reason: str
    ) -> "DatabasePrincipal":
        reason = authorization_reason.strip()
        if not reason or len(reason) > 200:
            raise ValueError("A concise service authorization reason is required")
        return cls(
            database_role=DatabaseRole.SERVICE_ROLE,
            subject=None,
            application_role=None,
            capabilities=_SERVICE_CAPABILITIES[purpose],
            authorization_reason=reason,
        )

    def require(self, capability: Capability) -> None:
        if capability not in self.capabilities:
            raise RepositoryAuthorizationError(
                f"Repository capability '{capability.value}' is not authorized"
            )

    def database_claims(self) -> dict[str, object]:
        if self.database_role is DatabaseRole.SERVICE_ROLE:
            return {
                "role": DatabaseRole.SERVICE_ROLE.value,
                "app_metadata": {"service_reason": self.authorization_reason},
            }
        if self.subject is None or self.application_role is None:
            raise RepositoryAuthorizationError("Authenticated database principal is incomplete")
        return {
            "sub": str(self.subject),
            "role": DatabaseRole.AUTHENTICATED.value,
            "app_metadata": {"role": self.application_role.value},
        }
