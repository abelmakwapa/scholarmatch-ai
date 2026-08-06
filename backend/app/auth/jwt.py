from collections.abc import Mapping, Sequence
from typing import Any
from uuid import UUID

import jwt
from jwt import PyJWK
from jwt.exceptions import InvalidTokenError

from app.auth.jwks import JWKSCache, JWKSUnavailableError, UnknownSigningKeyError
from app.auth.models import ApplicationRole, CurrentUser
from app.core.errors import ApiError


class JWTVerifier:
    def __init__(
        self,
        jwks: JWKSCache,
        *,
        issuer: str,
        audience: str,
        allowed_algorithms: Sequence[str] = ("RS256", "ES256"),
    ) -> None:
        self._jwks = jwks
        self._issuer = issuer
        self._audience = audience
        self._allowed_algorithms = tuple(allowed_algorithms)

    async def verify(self, token: str) -> CurrentUser:
        try:
            header = jwt.get_unverified_header(token)
        except InvalidTokenError:
            raise self._invalid_token() from None

        key_id = header.get("kid")
        algorithm = header.get("alg")
        if not isinstance(key_id, str) or not key_id:
            raise self._invalid_token()
        if not isinstance(algorithm, str) or algorithm not in self._allowed_algorithms:
            raise self._invalid_token()

        try:
            jwk = await self._jwks.get(key_id)
            key_algorithm = jwk.get("alg")
            if key_algorithm is not None and key_algorithm != algorithm:
                raise ValueError("Signing-key algorithm mismatch")
            signing_key = PyJWK.from_dict(dict(jwk), algorithm=algorithm).key
            claims: dict[str, Any] = jwt.decode(
                token,
                key=signing_key,
                algorithms=[algorithm],
                audience=self._audience,
                issuer=self._issuer,
                options={"require": ["exp", "sub", "iss", "aud"]},
            )
        except JWKSUnavailableError:
            raise ApiError(
                status_code=503,
                code="AUTH_KEYS_UNAVAILABLE",
                message="Authentication keys are temporarily unavailable.",
            ) from None
        except (UnknownSigningKeyError, InvalidTokenError, ValueError, TypeError):
            raise self._invalid_token() from None

        subject = self._subject(claims)
        role = self._application_role(claims)
        return CurrentUser(id=subject, role=role)

    @staticmethod
    def _subject(claims: Mapping[str, Any]) -> UUID:
        subject = claims.get("sub")
        if not isinstance(subject, str) or not subject:
            raise JWTVerifier._invalid_token()
        try:
            return UUID(subject)
        except ValueError:
            raise JWTVerifier._invalid_token() from None

    @staticmethod
    def _application_role(claims: Mapping[str, Any]) -> ApplicationRole:
        app_metadata = claims.get("app_metadata")
        if isinstance(app_metadata, Mapping) and app_metadata.get("role") == "admin":
            return ApplicationRole.ADMIN
        return ApplicationRole.USER

    @staticmethod
    def _invalid_token() -> ApiError:
        return ApiError(
            status_code=401,
            code="INVALID_ACCESS_TOKEN",
            message="The access token is invalid or expired.",
            headers={"WWW-Authenticate": "Bearer"},
        )
