from collections.abc import Mapping
from http import HTTPStatus
from typing import TypedDict
from uuid import uuid4

from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


class ErrorDetail(TypedDict):
    code: str
    field: str
    message: str


class ApiError(Exception):
    """An expected error with a stable, client-safe API representation."""

    def __init__(
        self,
        *,
        status_code: int,
        code: str,
        message: str,
        details: list[ErrorDetail] | None = None,
        headers: Mapping[str, str] | None = None,
    ) -> None:
        super().__init__(code)
        self.status_code = status_code
        self.code = code
        self.message = message
        self.details = details or []
        self.headers = dict(headers or {})


def request_id_for(request: Request) -> str:
    return getattr(request.state, "request_id", str(uuid4()))


def error_response(
    request: Request,
    *,
    status_code: int,
    code: str,
    message: str,
    details: list[ErrorDetail] | None = None,
    headers: Mapping[str, str] | None = None,
) -> JSONResponse:
    request_id = request_id_for(request)
    response_headers = dict(headers or {})
    response_headers["X-Request-ID"] = request_id
    return JSONResponse(
        status_code=status_code,
        content={
            "error": {
                "code": code,
                "message": message,
                "details": details or [],
                "request_id": request_id,
            }
        },
        headers=response_headers,
    )


def _validation_message(error_type: str) -> str:
    if error_type == "missing":
        return "Field is required."
    return "Invalid value."


async def validation_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    if not isinstance(exc, RequestValidationError):
        raise TypeError("Unexpected exception handler registration")
    details: list[ErrorDetail] = [
        {
            "code": str(error["type"]),
            "field": ".".join(str(part) for part in error["loc"]),
            "message": _validation_message(str(error["type"])),
        }
        for error in exc.errors()
    ]
    return error_response(
        request,
        status_code=422,
        code="VALIDATION_ERROR",
        message="The request failed validation.",
        details=details,
    )


async def http_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    if not isinstance(exc, StarletteHTTPException):
        raise TypeError("Unexpected exception handler registration")
    try:
        message = HTTPStatus(exc.status_code).phrase
    except ValueError:
        message = "The request could not be completed."
    return error_response(
        request,
        status_code=exc.status_code,
        code=f"HTTP_{exc.status_code}",
        message=message,
        headers=exc.headers,
    )


async def api_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    if not isinstance(exc, ApiError):
        raise TypeError("Unexpected exception handler registration")
    return error_response(
        request,
        status_code=exc.status_code,
        code=exc.code,
        message=exc.message,
        details=exc.details,
        headers=exc.headers,
    )
