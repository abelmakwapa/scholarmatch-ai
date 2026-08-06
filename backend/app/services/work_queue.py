from typing import Protocol
from uuid import UUID


class WorkQueue(Protocol):
    async def enqueue_rematch(
        self, profile_id: UUID, data_version: int, *, idempotency_key: str
    ) -> bool: ...

    async def enqueue_document_scan(self, document_id: UUID, *, idempotency_key: str) -> bool: ...

    async def enqueue_document_cleanup(
        self, document_id: UUID, *, idempotency_key: str
    ) -> bool: ...

    async def enqueue_storage_delete(
        self, bucket: str, object_path: str, *, idempotency_key: str
    ) -> bool: ...

    async def enqueue_ingestion_run(self, run_id: UUID, *, idempotency_key: str) -> bool: ...


class InMemoryWorkQueue:
    """Development/test adapter. Production must inject a durable queue adapter."""

    def __init__(self) -> None:
        self._keys: set[str] = set()

    def _reserve(self, key: str) -> bool:
        if key in self._keys:
            return False
        self._keys.add(key)
        return True

    async def enqueue_rematch(
        self, profile_id: UUID, data_version: int, *, idempotency_key: str
    ) -> bool:
        del profile_id, data_version
        return self._reserve(idempotency_key)

    async def enqueue_document_scan(self, document_id: UUID, *, idempotency_key: str) -> bool:
        del document_id
        return self._reserve(idempotency_key)

    async def enqueue_document_cleanup(self, document_id: UUID, *, idempotency_key: str) -> bool:
        del document_id
        return self._reserve(idempotency_key)

    async def enqueue_storage_delete(
        self, bucket: str, object_path: str, *, idempotency_key: str
    ) -> bool:
        del bucket, object_path
        return self._reserve(idempotency_key)

    async def enqueue_ingestion_run(self, run_id: UUID, *, idempotency_key: str) -> bool:
        del run_id
        return self._reserve(idempotency_key)
