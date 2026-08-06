from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from psycopg import Error
from psycopg import errors as pg_errors

from app.core.errors import ApiError


def map_database_error(exc: Error) -> ApiError:
    if isinstance(exc, pg_errors.UniqueViolation):
        return ApiError(
            status_code=409,
            code="RESOURCE_CONFLICT",
            message="The requested resource conflicts with existing data.",
        )
    if isinstance(exc, pg_errors.ForeignKeyViolation):
        return ApiError(
            status_code=409,
            code="RELATED_RESOURCE_CONFLICT",
            message="A related resource does not exist or cannot be changed.",
        )
    if isinstance(
        exc,
        pg_errors.CheckViolation | pg_errors.NotNullViolation | pg_errors.InvalidTextRepresentation,
    ):
        return ApiError(
            status_code=422,
            code="DATABASE_VALIDATION_ERROR",
            message="The data failed persistence validation.",
        )
    if isinstance(exc, pg_errors.InsufficientPrivilege):
        return ApiError(
            status_code=403,
            code="DATA_ACCESS_DENIED",
            message="You do not have permission to access this data.",
        )
    if isinstance(exc, pg_errors.SerializationFailure | pg_errors.DeadlockDetected):
        return ApiError(
            status_code=503,
            code="DATABASE_RETRY_REQUIRED",
            message="The operation could not be completed safely. Retry later.",
            headers={"Retry-After": "1"},
        )
    return ApiError(
        status_code=503,
        code="DATABASE_UNAVAILABLE",
        message="The persistence service is temporarily unavailable.",
    )


@asynccontextmanager
async def translate_database_errors() -> AsyncIterator[None]:
    try:
        yield
    except Error as exc:
        raise map_database_error(exc) from None
