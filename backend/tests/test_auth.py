import asyncio
from collections.abc import Callable, Mapping
from datetime import UTC, datetime, timedelta
from typing import Annotated, Any
from uuid import uuid4

import jwt
import pytest
from app.auth.dependencies import get_current_user, require_role
from app.auth.jwks import JWKSCache, JWKSCachePolicy, JWKSUnavailableError
from app.auth.jwt import JWTVerifier
from app.auth.models import ApplicationRole, CurrentUser
from app.core.config import Environment, Settings
from app.core.errors import ApiError
from app.main import create_app
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import Depends
from fastapi.testclient import TestClient
from jwt.algorithms import RSAAlgorithm

ISSUER = "https://project.supabase.co/auth/v1"
AUDIENCE = "authenticated"
KEY_ID = "primary-key"
ADMIN_DEPENDENCY = require_role(ApplicationRole.ADMIN)


class MutableClock:
    def __init__(self) -> None:
        self.value = 1_000.0

    def __call__(self) -> float:
        return self.value


class StaticFetcher:
    def __init__(self, payload: Mapping[str, object]) -> None:
        self.payload = payload
        self.calls = 0
        self.failure: Exception | None = None

    async def __call__(self) -> Mapping[str, object]:
        self.calls += 1
        if self.failure is not None:
            raise self.failure
        return self.payload


def _key_pair(key_id: str = KEY_ID) -> tuple[rsa.RSAPrivateKey, dict[str, Any]]:
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    public_jwk = RSAAlgorithm.to_jwk(private_key.public_key(), as_dict=True)
    assert isinstance(public_jwk, dict)
    public_jwk.update({"kid": key_id, "alg": "RS256", "use": "sig"})
    return private_key, public_jwk


def _token(
    private_key: rsa.RSAPrivateKey,
    *,
    key_id: str = KEY_ID,
    subject: str | None = None,
    issuer: str = ISSUER,
    audience: str = AUDIENCE,
    expires_delta: timedelta = timedelta(minutes=5),
    role: str = "user",
) -> str:
    now = datetime.now(UTC)
    return jwt.encode(
        {
            "sub": subject or str(uuid4()),
            "iss": issuer,
            "aud": audience,
            "iat": now,
            "exp": now + expires_delta,
            "app_metadata": {"role": role},
        },
        private_key,
        algorithm="RS256",
        headers={"kid": key_id},
    )


def _verifier(fetcher: StaticFetcher, *, clock: MutableClock | None = None) -> JWTVerifier:
    return JWTVerifier(
        JWKSCache(
            fetcher,
            policy=JWKSCachePolicy(fresh_seconds=10, max_stale_seconds=20),
            clock=clock or MutableClock(),
        ),
        issuer=ISSUER,
        audience=AUDIENCE,
        allowed_algorithms=("RS256",),
    )


def _api_error(token: str, verifier: JWTVerifier) -> ApiError:
    with pytest.raises(ApiError) as error:
        asyncio.run(verifier.verify(token))
    return error.value


def test_verifies_signature_registered_claims_subject_and_admin_role() -> None:
    private_key, public_jwk = _key_pair()
    subject = uuid4()
    fetcher = StaticFetcher({"keys": [public_jwk]})

    user = asyncio.run(
        _verifier(fetcher).verify(
            _token(private_key, subject=str(subject), role=ApplicationRole.ADMIN.value)
        )
    )

    assert user == CurrentUser(id=subject, role=ApplicationRole.ADMIN)
    assert fetcher.calls == 1


@pytest.mark.parametrize(
    ("build_token", "expected_code"),
    [
        (lambda key: _token(key, audience="another-api"), "INVALID_ACCESS_TOKEN"),
        (
            lambda key: _token(key, issuer="https://attacker.example/auth/v1"),
            "INVALID_ACCESS_TOKEN",
        ),
        (
            lambda key: _token(key, expires_delta=timedelta(seconds=-1)),
            "INVALID_ACCESS_TOKEN",
        ),
        (lambda key: _token(key, subject="not-a-uuid"), "INVALID_ACCESS_TOKEN"),
    ],
)
def test_rejects_invalid_registered_claims(
    build_token: Callable[[rsa.RSAPrivateKey], str], expected_code: str
) -> None:
    private_key, public_jwk = _key_pair()

    error = _api_error(build_token(private_key), _verifier(StaticFetcher({"keys": [public_jwk]})))

    assert error.status_code == 401
    assert error.code == expected_code


def test_rejects_invalid_signature() -> None:
    trusted_key, public_jwk = _key_pair()
    untrusted_key, _ = _key_pair()
    del trusted_key

    error = _api_error(_token(untrusted_key), _verifier(StaticFetcher({"keys": [public_jwk]})))

    assert error.status_code == 401
    assert error.message == "The access token is invalid or expired."


def test_cached_key_survives_short_refresh_failure_but_not_unknown_or_too_stale() -> None:
    private_key, public_jwk = _key_pair()
    clock = MutableClock()
    fetcher = StaticFetcher({"keys": [public_jwk]})
    verifier = _verifier(fetcher, clock=clock)
    token = _token(private_key)
    asyncio.run(verifier.verify(token))

    clock.value += 11
    fetcher.failure = JWKSUnavailableError("offline")
    assert asyncio.run(verifier.verify(token)).role is ApplicationRole.USER

    unknown_token = _token(private_key, key_id="rotated-key")
    unknown_error = _api_error(unknown_token, verifier)
    assert unknown_error.status_code == 503
    assert unknown_error.code == "AUTH_KEYS_UNAVAILABLE"

    clock.value += 20
    stale_error = _api_error(token, verifier)
    assert stale_error.status_code == 503
    assert stale_error.code == "AUTH_KEYS_UNAVAILABLE"


def test_current_user_and_role_dependencies_return_safe_envelopes() -> None:
    private_key, public_jwk = _key_pair()
    verifier = _verifier(StaticFetcher({"keys": [public_jwk]}))
    application = create_app(
        settings=Settings(environment=Environment.TEST),
        readiness_checks={},
        jwt_verifier=verifier,
    )

    @application.get("/private")
    async def private(
        user: Annotated[CurrentUser, Depends(get_current_user)],
    ) -> dict[str, str]:
        return {"user_id": str(user.id)}

    @application.get("/admin")
    async def admin(
        user: Annotated[CurrentUser, Depends(ADMIN_DEPENDENCY)],
    ) -> dict[str, str]:
        return {"role": user.role.value}

    with TestClient(application, raise_server_exceptions=False) as client:
        missing = client.get("/private")
        forbidden = client.get("/admin", headers={"Authorization": f"Bearer {_token(private_key)}"})
        allowed = client.get(
            "/admin",
            headers={
                "Authorization": f"Bearer {_token(private_key, role=ApplicationRole.ADMIN.value)}"
            },
        )

    assert missing.status_code == 401
    assert missing.json()["error"]["code"] == "AUTHENTICATION_REQUIRED"
    assert forbidden.status_code == 403
    assert forbidden.json()["error"]["code"] == "INSUFFICIENT_ROLE"
    assert allowed.status_code == 200
    assert allowed.json() == {"role": "admin"}
    for response in (missing, forbidden):
        assert "traceback" not in response.text.lower()
        assert "select " not in response.text.lower()
