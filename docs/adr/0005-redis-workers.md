# ADR-0005: Use Redis-backed background workers

- Status: Accepted
- Date: 2026-07-28

## Context

Ingestion, document processing, embeddings, rematching, and notifications are slow or retryable and should not block API requests.

## Decision

Use Celery workers backed by managed Redis. API and workers share domain/service code but run as separate processes. Redis may also hold short-lived caches, rate-limit counters, and idempotency records; PostgreSQL remains the durable source of truth.

## Consequences

Long-running work gains retries and independent scaling. Production requires queue-age monitoring, bounded retry policy, dead-letter handling, and idempotent tasks. Losing Redis may delay work but must not lose authoritative application state.

