# Supabase persistence foundation

Migrations live in `migrations/` and are applied in lexical timestamp order. The first migration
creates the normalized PostgreSQL schema; the second adds grants and RLS policies; the third adds
the versioned profile inputs and private-document lifecycle; the fourth adds public catalog
provenance, immutable source records, resumable ingestion items, quarantine, and change history.
The test-only
`tests/bootstrap_local_postgres.sql` supplies the Supabase roles and Auth helper functions when the
suite runs against vanilla PostgreSQL. It is never applied to a Supabase project.

Use the Supabase CLI in a configured project to apply migrations:

```bash
supabase db reset
supabase db push
```

For backend integration tests, provide an isolated PostgreSQL administrator DSN through
`TEST_DATABASE_URL`. Tests create and remove temporary databases and must never point at a shared
or production database.

See [DATA_DICTIONARY.md](DATA_DICTIONARY.md) for ownership, relationships, and index rationale, and
[ROLLBACK.md](ROLLBACK.md) for recovery guidance.
