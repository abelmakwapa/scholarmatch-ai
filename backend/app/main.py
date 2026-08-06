import re
from collections.abc import Awaitable, Callable, Mapping
from time import perf_counter
from uuid import uuid4

from fastapi import FastAPI, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.v1.router import api_router
from app.auth.jwks import JWKSCache, JWKSCachePolicy, UrlLibJWKSFetcher
from app.auth.jwt import JWTVerifier
from app.core.config import Settings, get_settings
from app.core.errors import (
    ApiError,
    ErrorDetail,
    api_exception_handler,
    error_response,
    http_exception_handler,
    validation_exception_handler,
)
from app.core.logging import configure_logging
from app.core.readiness import ReadinessCheck, default_readiness_checks, evaluate_readiness

APP_VERSION = "0.1.0"
REQUEST_ID_PATTERN = re.compile(r"^[A-Za-z0-9._-]{1,64}$")


def _request_id(request: Request) -> str:
    candidate = request.headers.get("X-Request-ID", "")
    if REQUEST_ID_PATTERN.fullmatch(candidate):
        return candidate
    return str(uuid4())


def _route_template(request: Request) -> str:
    route = request.scope.get("route")
    path = getattr(route, "path", None)
    return path if isinstance(path, str) else "<unmatched>"


def create_app(
    *,
    settings: Settings | None = None,
    readiness_checks: Mapping[str, ReadinessCheck] | None = None,
    jwt_verifier: JWTVerifier | None = None,
) -> FastAPI:
    config = settings or get_settings()
    logger = configure_logging(config.log_level.value)
    openapi_url = "/openapi.json" if config.openapi_enabled else None

    application = FastAPI(
        title=config.project_name,
        version=APP_VERSION,
        docs_url="/docs" if config.openapi_enabled else None,
        redoc_url="/redoc" if config.openapi_enabled else None,
        openapi_url=openapi_url,
    )
    application.state.settings = config
    configured_checks = (
        readiness_checks if readiness_checks is not None else default_readiness_checks(config)
    )
    application.state.readiness_checks = dict(configured_checks)
    if jwt_verifier is None and config.jwt_issuer is not None and config.jwks_url is not None:
        jwt_verifier = JWTVerifier(
            JWKSCache(
                UrlLibJWKSFetcher(
                    config.jwks_url,
                    timeout_seconds=config.jwks_http_timeout_seconds,
                ),
                policy=JWKSCachePolicy(
                    fresh_seconds=config.jwks_cache_ttl_seconds,
                    max_stale_seconds=config.jwks_max_stale_seconds,
                ),
            ),
            issuer=config.jwt_issuer,
            audience=config.supabase_jwt_audience,
        )
    application.state.jwt_verifier = jwt_verifier

    application.add_middleware(
        CORSMiddleware,
        allow_origins=config.cors_allowed_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
        expose_headers=["X-Request-ID"],
    )

    @application.middleware("http")
    async def request_context(
        request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        request.state.request_id = _request_id(request)
        started_at = perf_counter()
        response = await call_next(request)
        if (
            response.status_code == 400
            and request.method == "OPTIONS"
            and "Access-Control-Request-Method" in request.headers
        ):
            response = error_response(
                request,
                status_code=400,
                code="CORS_REJECTED",
                message="The cross-origin request was rejected.",
            )
        response.headers["X-Request-ID"] = request.state.request_id
        logger.info(
            "Request completed",
            extra={
                "event": "request.completed",
                "request_id": request.state.request_id,
                "method": request.method,
                "path": _route_template(request),
                "status_code": response.status_code,
                "duration_ms": round((perf_counter() - started_at) * 1000, 3),
            },
        )
        return response

    application.add_exception_handler(RequestValidationError, validation_exception_handler)
    application.add_exception_handler(StarletteHTTPException, http_exception_handler)
    application.add_exception_handler(ApiError, api_exception_handler)

    @application.exception_handler(Exception)
    async def unexpected_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        logger.error(
            "Unhandled request exception",
            extra={
                "event": "request.failed",
                "request_id": getattr(request.state, "request_id", None),
                "method": request.method,
                "path": _route_template(request),
                "exception_type": type(exc).__name__,
            },
        )
        return error_response(
            request,
            status_code=500,
            code="INTERNAL_ERROR",
            message="An unexpected error occurred.",
        )

    @application.get("/healthz", tags=["System"])
    async def health_check() -> dict[str, str]:
        return {"status": "healthy", "service": config.project_name, "version": APP_VERSION}

    @application.get("/readyz", tags=["System"])
    async def readiness_check(request: Request) -> Response:
        checks = await evaluate_readiness(application.state.readiness_checks)
        failed = sorted(name for name, ready in checks.items() if not ready)
        if failed:
            details: list[ErrorDetail] = [
                {"code": "UNAVAILABLE", "field": name, "message": "Dependency is not ready."}
                for name in failed
            ]
            return error_response(
                request,
                status_code=503,
                code="NOT_READY",
                message="The service is not ready.",
                details=details,
            )
        return JSONResponse(
            content={
                "status": "ready",
                "checks": {name: "ready" for name in sorted(checks)},
            }
        )

    application.include_router(api_router, prefix=config.api_v1_prefix)
    return application


app = create_app()
