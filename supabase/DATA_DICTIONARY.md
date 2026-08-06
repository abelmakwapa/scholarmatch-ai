# ScholarMatch persistence data dictionary

All UUIDs are generated with `gen_random_uuid()` unless the row identity is the Supabase Auth
user ID. All timestamps are `timestamptz` and are stored in UTC by PostgreSQL. Status columns
use explicit check constraints so invalid or differently-cased states cannot enter the database.

| Table | Ownership and purpose | Key relationships | Mutation and retention behavior |
| --- | --- | --- | --- |
| `profiles` | One private student profile per `auth.users` identity. | `id` is both the primary key and an `auth.users.id` foreign key. | User deletion cascades. `updated_at` tracks profile edits; `data_version` is reserved for future rematching invalidation. |
| `scholarship_providers` | Shared normalized provider catalog. | Referenced by `scholarships.provider_id`. | Providers cannot be deleted while scholarships reference them. Admins can insert/update but not delete. |
| `scholarships` | Shared normalized scholarship catalog and provenance entry point. | Belongs to one provider; referenced by requirements, matches, and applications. | Admins update lifecycle state. Requirements and derived matches cascade on deletion; applications restrict deletion so tracked history is not silently lost. |
| `scholarship_requirements` | Ordered, versioned hard/soft eligibility rules. | Belongs to one scholarship. | Cascades with scholarship. Admin replacement can delete/insert requirements; direct user mutation is denied. |
| `matches` | Private materialized match result; no calculation logic is implemented here. | Belongs to a profile and scholarship; unique per pair. | Profile or scholarship deletion removes derived matches. Only owners can read; backend service authorization controls writes. |
| `applications` | Private application tracking state, checklist, history, and reminder. | Belongs to a profile and scholarship; unique per pair. | Profile deletion cascades. Scholarship deletion is restricted. Owner CRUD is allowed by RLS. |
| `profile_documents` | Private document metadata; object bytes remain in private Supabase Storage. | Belongs to a profile; storage bucket/path is unique. | Profile deletion cascades metadata. Object deletion/storage cleanup remains a later service concern. |
| `notification_preferences` | One private notification configuration per profile. | `profile_id` is the primary key and references `profiles.id`. | Profile deletion cascades. Owner CRUD is allowed by RLS. |
| `ingestion_runs` | Admin-only ingestion queue/history with sanitized counters and errors. | Optional self-reference identifies the original run; `created_by` references Auth. | Retry source uses `ON DELETE SET NULL`. Admins can insert/update, but not delete. |
| `audit_events` | Append-only administrative catalog/ingestion audit trail. | Actor references Auth with `ON DELETE SET NULL`; target is a polymorphic UUID. | A trigger rejects updates and deletes. Admins can insert/select only. |
| `idempotency_keys` | Backend-only durable request replay state. | Belongs directly to an Auth actor; unique by actor, operation, and key. | User deletion cascades. Only the service role can access rows, and Python service authorization further limits use. |

## Column dictionary

All tables use UUID primary keys. `created_at` records insertion time and mutable records also have
trigger-maintained `updated_at`; both are non-null `timestamptz`. Optional below means SQL `NULL` is
allowed. JSON values are constrained to the documented top-level shape.

### `profiles`

- `id`: Auth user UUID and row owner. `full_name`, `country`: display name and ISO 3166-1 alpha-2
  country. `study_level`: `undergraduate`, `postgraduate`, `doctoral`, or `other`.
- `field_of_study`, `gpa`, `goals`: optional academic profile fields; GPA is bounded to 0–4.
  `interests`: bounded JSON array. `data_version`: positive revision used by future rematching.

### `scholarship_providers`

- `id`: generated UUID. `name`: case-insensitively unique provider name. `website_url`: optional
  HTTPS URL. `status`: `active` or `inactive`.

### `scholarships`

- `id`: generated UUID. `provider_id`: required provider. `title`, `description`: catalog copy.
- `amount`, `currency`: optional non-negative amount and ISO-style three-letter currency.
  `funding_type`: `full`, `partial`, `tuition`, `stipend`, `research`, or `other`.
  `funding_summary`: optional human-readable funding description.
- `study_levels`, `fields_of_study`, `destination_countries`, `nationality_requirements`,
  `residency_requirements`, `required_documents`: normalized filter arrays.
- `deadline`: source calendar date. `deadline_at`, `deadline_timezone`: optional normalized instant
  and source time zone. `eligibility_summary`: optional catalog summary.
- `source_url`: unique authoritative HTTPS source. `application_url`: optional external application
  URL. `reviewer_notes`: private admin notes.
- `status`: `draft`, `in_review`, `published`, `unpublished`, `expired`, or `archived`.
  `verified_at`, `published_at`: optional lifecycle instants. `data_version`: positive catalog revision.

### `scholarship_requirements`

- `id`: generated UUID. `scholarship_id`: owning scholarship. `constraint_type`: `hard` or `soft`.
- `field`: normalized eligibility field; `operator`: normalized comparison operator; `value`: JSON
  operand. No matching evaluation is implemented by the migration.
- `source_evidence`: JSON object containing provenance. `reviewer_notes`: optional admin note.
  `position`: unique order within the scholarship. `version`: positive requirement revision.

### `matches`

- `id`: generated UUID. `profile_id`, `scholarship_id`: unique private profile/catalog pair.
- `total_score`, `confidence`: bounded 0–1 materialized values. `score_breakdown` and
  `requirement_evidence`: JSON arrays. `deterministic_explanation`: JSON object;
  `ai_explanation`: optional JSON object.
- `explanation_status`: `pending`, `ready`, or `unavailable`. `algorithm_version`, optional
  `embedding_version`, `profile_data_version`, and `scholarship_data_version`: reproducibility
  metadata. `stale_reasons`: JSON array. `calculated_at`: computation time.

### `applications`

- `id`: generated UUID. `profile_id`: owner. `scholarship_id`: tracked scholarship; one row per
  profile/scholarship pair.
- `status`: `saved`, `preparing`, `ready`, `submitted`, `interview`, `awarded`, `unsuccessful`, or
  `withdrawn`. `notes`: optional private notes. `checklist`, `status_history`: JSON arrays.
- `reminder`: optional JSON object. `deadline_at`, `deadline_timezone`, `submitted_at`: optional
  timeline fields.

### `profile_documents`

- `id`: generated UUID. `profile_id`: owner. `storage_bucket`, `storage_object_path`: unique private
  object location; these values must never be returned as public URLs.
- `document_type`: normalized transcript/CV/letter/statement/identity/financial/other category.
  `display_name`, `original_filename`, `mime_type`, `size_bytes`, `checksum_sha256`: validated
  metadata only; file bytes are not stored here.
- `status`: `pending`, `scanning`, `processing`, `ready`, `rejected`, or `failed`. `scan_status`:
  `pending`, `clean`, `infected`, or `failed`. `replaced_at`: optional replacement time.

### `notification_preferences`

- `profile_id`: owner and primary key. `deadline_reminders_enabled`, `product_updates_enabled`:
  channel choices. `reminder_days`: one to ten offsets bounded to 0–365. `timezone`: IANA-style
  time-zone name stored for later notification services.

### `ingestion_runs`

- `id`: generated UUID. `source`, optional `source_url`, `dry_run`: requested ingestion source.
- `status`: `queued`, `running`, `completed`, `failed`, or `cancelled`. `counters`: JSON object;
  `safe_errors`: sanitized JSON array that must not contain credentials or raw stack traces.
- `original_run_id`: optional retry lineage. `created_by`: nullable admin actor. `started_at`,
  `completed_at`: optional execution timeline.

### `audit_events`

- `id`: generated UUID. `actor_id`: nullable admin actor. `action`: normalized application action.
- `target_type`: `scholarship`, `ingestion_run`, `duplicate_group`, or `verification`; `target_id`
  and `target_name` identify the affected record. `summary`, `metadata`: sanitized event context.
  `created_at` is the only audit timestamp because rows are append-only.

### `idempotency_keys`

- `id`: generated UUID. `actor_id`: owning Auth identity. `operation`, `key`: unique replay scope.
  `request_hash`: lowercase SHA-256 digest.
- `status`: `processing`, `completed`, or `failed`. `response_status`, `response_body`: optional
  replay result. `expires_at`: mandatory cleanup horizon.

## Index rationale

- Scholarship indexes correspond to the contract's published-status, deadline, verification,
  comparable currency/amount, funding type, array filters, source URL, and text-search queries.
- Match indexes support owner-scoped descending score pagination and profile/scholarship lookup.
- Application indexes support owner pagination, chronological deadlines, and status workspaces.
- Document, ingestion, and audit indexes support their documented owner/admin timelines.
- The idempotency expiry index supports bounded cleanup; the unique key supports replay lookup.

No vector index is included. Matching calculations and embedding persistence remain intentionally
deferred until measured retrieval queries exist.
