# Migration rollback notes

Supabase migrations are forward-only in shared environments. Prefer a corrective migration over
rewriting or deleting an applied migration. Take a database backup before any destructive rollback.

## `20260806000400_catalog_ingestion_pipeline.sql`

Prefer a forward repair after any ingestion run has started. Stop workers and export
`ingestion_raw_records`, `scholarship_sources`, `scholarship_field_history`,
`ingestion_quarantine`, and `ingestion_items`; their provenance cannot be reconstructed from the
normalized catalog alone. Drop the immutable and `updated_at` triggers, then drop tables in order:

1. `ingestion_items`, `ingestion_quarantine`, and `scholarship_field_history`.
2. `scholarship_sources`, then `ingestion_raw_records`.

Remove the ingestion-run indexes, columns, and expanded status constraint only after mapping every
`partial` and `dead_lettered` row to an earlier terminal state. Remove
`scholarships.source_fingerprint` and the provider canonical/search fields only if no later feature
uses them. Restore the earlier study-level constraint only after mapping `secondary` and
`vocational` records. Finally drop `private.reject_immutable_mutation()` if it is unused. Never
delete raw or quarantined evidence merely to make a rollback succeed.

## `20260806000300_profile_documents_vertical_slice.sql`

Prefer a forward repair. Before dropping the new profile columns, export values that must be
retained. Map document states back to the earlier vocabulary, resolve deletion tombstones, restore
the original indexes and status constraint, then remove `deleted_at`. Convert every GPA to the 0–4
scale before dropping `gpa_scale`; conversion cannot be inferred safely. Finally remove the added
profile fields and restore the earlier study-level constraint. Remove the private Storage bucket
only after every object has been verified deleted; bucket deletion is intentionally not automated.

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
