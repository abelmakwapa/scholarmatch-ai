# ADR-0002: Use Supabase PostgreSQL as the source of truth

- Status: Accepted
- Date: 2026-07-28

## Context

ScholarMatch needs relational data, authentication, row-level authorization, and private document storage while the team is small.

## Decision

Use Supabase PostgreSQL for durable application data, Supabase Auth for identity, Row-Level Security for user-owned rows, and private Supabase Storage for documents. The backend verifies JWTs and applies role checks in addition to RLS.

## Consequences

The MVP has one transactional source of truth and a managed operational surface. Migrations and RLS policy tests are mandatory. Service-role credentials remain server-only, and provider-specific access stays behind repository/storage interfaces.

