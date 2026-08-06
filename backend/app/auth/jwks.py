import asyncio
import json
from collections.abc import Awaitable, Callable, Mapping
from dataclasses import dataclass
from time import monotonic
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

JWKSFetcher = Callable[[], Awaitable[Mapping[str, object]]]


class JWKSUnavailableError(RuntimeError):
    """The signing-key source is unavailable and no safe cached key can be used."""


class UnknownSigningKeyError(ValueError):
    """The token references a key ID absent from a successfully refreshed JWKS."""


@dataclass(frozen=True, slots=True)
class JWKSCachePolicy:
    fresh_seconds: float = 300
    max_stale_seconds: float = 3600

    def __post_init__(self) -> None:
        if self.fresh_seconds <= 0 or self.max_stale_seconds < 0:
            raise ValueError("JWKS cache durations must be non-negative")


class UrlLibJWKSFetcher:
    def __init__(self, url: str, *, timeout_seconds: float = 5.0, max_bytes: int = 262_144):
        self._url = url
        self._timeout_seconds = timeout_seconds
        self._max_bytes = max_bytes

    async def __call__(self) -> Mapping[str, object]:
        return await asyncio.to_thread(self._fetch)

    def _fetch(self) -> Mapping[str, object]:
        request = Request(
            self._url,
            headers={"Accept": "application/json", "User-Agent": "ScholarMatch-API/0.1"},
        )
        try:
            with urlopen(request, timeout=self._timeout_seconds) as response:
                content_length = response.headers.get("Content-Length")
                if content_length is not None and int(content_length) > self._max_bytes:
                    raise JWKSUnavailableError("JWKS response is too large")
                body = response.read(self._max_bytes + 1)
        except (HTTPError, URLError, OSError, ValueError) as exc:
            raise JWKSUnavailableError("JWKS endpoint is unavailable") from exc
        if len(body) > self._max_bytes:
            raise JWKSUnavailableError("JWKS response is too large")
        try:
            payload = json.loads(body)
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise JWKSUnavailableError("JWKS response is invalid") from exc
        if not isinstance(payload, dict):
            raise JWKSUnavailableError("JWKS response is invalid")
        return payload


class JWKSCache:
    def __init__(
        self,
        fetcher: JWKSFetcher,
        *,
        policy: JWKSCachePolicy | None = None,
        clock: Callable[[], float] = monotonic,
    ) -> None:
        self._fetcher = fetcher
        self._policy = policy or JWKSCachePolicy()
        self._clock = clock
        self._keys: dict[str, dict[str, Any]] = {}
        self._fresh_until = 0.0
        self._stale_until = 0.0
        self._refresh_lock = asyncio.Lock()

    async def get(self, key_id: str) -> Mapping[str, Any]:
        now = self._clock()
        cached = self._keys.get(key_id)
        if cached is not None and now < self._fresh_until:
            return cached

        async with self._refresh_lock:
            now = self._clock()
            cached = self._keys.get(key_id)
            if cached is not None and now < self._fresh_until:
                return cached
            try:
                refreshed = self._normalize(await self._fetcher())
            except Exception as exc:
                if cached is not None and now < self._stale_until:
                    return cached
                raise JWKSUnavailableError("Signing keys are temporarily unavailable") from exc

            self._keys = refreshed
            self._fresh_until = now + self._policy.fresh_seconds
            self._stale_until = self._fresh_until + self._policy.max_stale_seconds
            key = refreshed.get(key_id)
            if key is None:
                raise UnknownSigningKeyError("Unknown signing key")
            return key

    @staticmethod
    def _normalize(payload: Mapping[str, object]) -> dict[str, dict[str, Any]]:
        raw_keys = payload.get("keys")
        if not isinstance(raw_keys, list):
            raise JWKSUnavailableError("JWKS response has no key set")
        normalized: dict[str, dict[str, Any]] = {}
        for candidate in raw_keys:
            if not isinstance(candidate, dict):
                continue
            key_id = candidate.get("kid")
            key_type = candidate.get("kty")
            if isinstance(key_id, str) and key_id and isinstance(key_type, str) and key_type:
                normalized[key_id] = dict(candidate)
        if not normalized:
            raise JWKSUnavailableError("JWKS response has no usable signing keys")
        return normalized
