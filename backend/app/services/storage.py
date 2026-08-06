import asyncio
import json
from collections.abc import Mapping
from typing import Protocol
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urljoin
from urllib.request import Request, urlopen


class StorageError(RuntimeError):
    """A client-safe storage failure without provider response details."""


class PrivateDocumentStorage(Protocol):
    async def upload(
        self,
        *,
        bucket: str,
        object_path: str,
        content: bytes,
        mime_type: str,
    ) -> None: ...

    async def delete(self, *, bucket: str, object_path: str) -> None: ...

    async def create_signed_download_url(
        self, *, bucket: str, object_path: str, expires_in: int
    ) -> str: ...


class SupabasePrivateDocumentStorage:
    """Backend-only adapter for a private Supabase Storage bucket."""

    def __init__(
        self, base_url: str, service_role_key: str, *, timeout_seconds: float = 10
    ) -> None:
        self._base_url = base_url.rstrip("/")
        self._service_role_key = service_role_key
        self._timeout_seconds = timeout_seconds

    def _headers(self, *, mime_type: str | None = None) -> dict[str, str]:
        headers = {
            "Authorization": f"Bearer {self._service_role_key}",
            "apikey": self._service_role_key,
        }
        if mime_type is not None:
            headers["Content-Type"] = mime_type
        return headers

    def _object_url(self, action: str, bucket: str, object_path: str) -> str:
        encoded = f"{quote(bucket, safe='')}/{quote(object_path, safe='/')}"
        return f"{self._base_url}/storage/v1/object/{action}{encoded}"

    @staticmethod
    def _execute(request: Request, timeout: float) -> bytes:
        try:
            with urlopen(request, timeout=timeout) as response:  # noqa: S310
                return bytes(response.read())
        except (HTTPError, URLError, TimeoutError, OSError) as exc:
            raise StorageError("Private document storage is temporarily unavailable.") from exc

    async def upload(
        self,
        *,
        bucket: str,
        object_path: str,
        content: bytes,
        mime_type: str,
    ) -> None:
        request = Request(
            self._object_url("", bucket, object_path),
            data=content,
            headers={**self._headers(mime_type=mime_type), "x-upsert": "false"},
            method="POST",
        )
        await asyncio.to_thread(self._execute, request, self._timeout_seconds)

    async def delete(self, *, bucket: str, object_path: str) -> None:
        request = Request(
            self._object_url("", bucket, object_path),
            headers=self._headers(),
            method="DELETE",
        )
        await asyncio.to_thread(self._execute, request, self._timeout_seconds)

    async def create_signed_download_url(
        self, *, bucket: str, object_path: str, expires_in: int
    ) -> str:
        request = Request(
            self._object_url("sign/", bucket, object_path),
            data=json.dumps({"expiresIn": expires_in}).encode(),
            headers=self._headers(mime_type="application/json"),
            method="POST",
        )
        raw = await asyncio.to_thread(self._execute, request, self._timeout_seconds)
        try:
            payload = json.loads(raw)
            signed_url = _signed_url(payload)
        except (json.JSONDecodeError, TypeError, ValueError) as exc:
            raise StorageError("Private document storage returned an invalid response.") from exc
        return urljoin(f"{self._base_url}/", signed_url)


def _signed_url(payload: object) -> str:
    if not isinstance(payload, Mapping):
        raise TypeError("invalid response")
    value = payload.get("signedURL") or payload.get("signedUrl")
    if not isinstance(value, str) or not value:
        raise ValueError("missing signed URL")
    return value
