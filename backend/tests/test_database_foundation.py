from uuid import uuid4

import pytest
from app.auth.models import ApplicationRole, CurrentUser
from app.db.errors import map_database_error
from app.db.principal import (
    Capability,
    DatabasePrincipal,
    RepositoryAuthorizationError,
    ServicePurpose,
)
from psycopg import Error
from psycopg import errors as pg_errors


def test_user_principal_has_only_user_domain_capabilities() -> None:
    principal = DatabasePrincipal.for_user(CurrentUser(id=uuid4(), role=ApplicationRole.USER))

    assert Capability.PROFILE in principal.capabilities
    assert Capability.CATALOG_READ in principal.capabilities
    assert Capability.CATALOG_WRITE not in principal.capabilities
    assert principal.database_claims()["role"] == "authenticated"
    assert principal.database_claims()["app_metadata"] == {"role": "user"}


def test_admin_principal_gets_minimum_catalog_and_ingestion_capabilities() -> None:
    principal = DatabasePrincipal.for_user(CurrentUser(id=uuid4(), role=ApplicationRole.ADMIN))

    assert Capability.CATALOG_WRITE in principal.capabilities
    assert Capability.INGESTION in principal.capabilities
    assert Capability.AUDIT in principal.capabilities
    assert Capability.MATCH_WRITE not in principal.capabilities
    assert Capability.IDEMPOTENCY not in principal.capabilities


def test_service_principal_requires_a_purpose_and_is_narrowly_scoped() -> None:
    ingestion = DatabasePrincipal.for_service(
        ServicePurpose.INGESTION_WORKER, authorization_reason="scheduled catalog import"
    )

    assert ingestion.authorization_reason == "scheduled catalog import"
    assert ingestion.capabilities == frozenset(
        {Capability.CATALOG_READ, Capability.CATALOG_WRITE, Capability.INGESTION, Capability.AUDIT}
    )
    with pytest.raises(ValueError, match="reason"):
        DatabasePrincipal.for_service(ServicePurpose.INGESTION_WORKER, authorization_reason=" ")


def test_capability_failure_is_a_safe_authorization_error() -> None:
    principal = DatabasePrincipal.for_user(CurrentUser(id=uuid4(), role=ApplicationRole.USER))

    with pytest.raises(RepositoryAuthorizationError) as error:
        principal.require(Capability.CATALOG_WRITE)

    assert "catalog_write" in str(error.value)


@pytest.mark.parametrize(
    ("exception", "status", "code"),
    [
        (pg_errors.UniqueViolation("duplicate email secret@example.com"), 409, "RESOURCE_CONFLICT"),
        (
            pg_errors.ForeignKeyViolation("constraint internal_fk"),
            409,
            "RELATED_RESOURCE_CONFLICT",
        ),
        (
            pg_errors.CheckViolation("SQL: INSERT password=hunter2"),
            422,
            "DATABASE_VALIDATION_ERROR",
        ),
        (pg_errors.InsufficientPrivilege("policy private"), 403, "DATA_ACCESS_DENIED"),
        (
            pg_errors.OperationalError("postgresql://user:secret@host/db"),
            503,
            "DATABASE_UNAVAILABLE",
        ),
    ],
)
def test_database_errors_are_mapped_without_sql_details(
    exception: Exception, status: int, code: str
) -> None:
    assert isinstance(exception, Error)
    mapped = map_database_error(exception)

    assert mapped.status_code == status
    assert mapped.code == code
    assert "secret" not in mapped.message
    assert "insert" not in mapped.message.lower()
