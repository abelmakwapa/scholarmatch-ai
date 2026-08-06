# Migration rollback notes

Supabase migrations are forward-only in shared environments. Prefer a corrective migration over
rewriting or deleting an applied migration. Take a database backup before any destructive rollback.

## `20260806000200_authorization_policies.sql`

Rollback by revoking the grants introduced by the migration, dropping policies from all eleven
tables, disabling RLS only if the environment is being fully decommissioned, and dropping
`private.is_application_admin()`. Do not disable RLS as an incident workaround; deploy a corrected
policy migration instead.

## `20260806000100_persistence_foundation.sql`

The schema migration creates application tables, indexes, trigger functions, and the `private`
schema. A full rollback drops child tables first:

1. `idempotency_keys`, `audit_events`, `ingestion_runs`, `notification_preferences`,
   `profile_documents`, `applications`, and `matches`.
2. `scholarship_requirements`, then `scholarships`, then `scholarship_providers`.
3. `profiles`, trigger functions, and finally the `private` schema if no later migration uses it.

Dropping these tables permanently removes user and audit data. The `pgcrypto` extension and
Supabase-managed `auth` schema must not be removed. Restore from backup if a migration has accepted
production writes; down-migration SQL is intentionally not automated.
