# ADR-0003: Use pgvector for semantic retrieval

- Status: Accepted
- Date: 2026-07-28

## Context

Matching requires semantic candidate retrieval, but operating a separate vector database would add synchronization and infrastructure overhead.

## Decision

Store profile and scholarship embeddings in PostgreSQL with pgvector. Use one embedding model for both sides and persist the model name and embedding version with every vector.

## Consequences

Vector and transactional data remain colocated and consistent. An embedding model change creates a new version and controlled re-index. Retrieval never bypasses deterministic hard-eligibility filters, and index performance must be measured as the catalog grows.

