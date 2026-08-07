from collections.abc import Awaitable, Callable
from typing import Protocol, cast

from fastapi import Request

from app.auth.models import ApplicationRole, CurrentUser
from app.core.errors import ApiError


class AccessTokenVerifier(Protocol):
    async def verify(self, token: str) -> CurrentUser: ...


async def get_current_user(request: Request) -> CurrentUser:
    # Check for demo mode first (development only)
    demo_user = getattr(request.state, "demo_user", None)
    if demo_user is not None and getattr(request.app.state, "demo_mode_active", False):
        return demo_user
    
    authorization = request.headers.get("Authorization", "")
    scheme, separator, token = authorization.partition(" ")
    if separator != " " or scheme.lower() != "bearer" or not token.strip():
        raise ApiError(
            status_code=401,
            code="AUTHENTICATION_REQUIRED",
            message="A valid bearer access token is required.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    verifier = cast(AccessTokenVerifier | None, getattr(request.app.state, "jwt_verifier", None))
    if verifier is None:
        raise ApiError(
            status_code=503,
            code="AUTHENTICATION_UNAVAILABLE",
            message="Authentication is temporarily unavailable.",
        )
    return await verifier.verify(token.strip())


def require_role(
    *allowed_roles: ApplicationRole,
) -> Callable[[Request], Awaitable[CurrentUser]]:
    allowed = frozenset(allowed_roles)
    if not allowed:
        raise ValueError("At least one application role is required")

    async def dependency(request: Request) -> CurrentUser:
        user = await get_current_user(request)
        # In demo mode, also check for demo admin user
        demo_admin_user = getattr(request.state, "demo_admin_user", None)
        if (
            demo_admin_user is not None
            and getattr(request.app.state, "demo_mode_active", False)
            and ApplicationRole.ADMIN in allowed
        ):
            return demo_admin_user
        if user.role not in allowed:
            raise ApiError(
                status_code=403,
                code="INSUFFICIENT_ROLE",
                message="You do not have permission to perform this action.",
            )
        return user

    return dependency
