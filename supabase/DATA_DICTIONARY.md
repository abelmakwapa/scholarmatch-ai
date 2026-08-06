# ScholarMatch persistence data dictionary

All UUIDs are generated with `gen_random_uuid()` unless the row identity is the Supabase Auth
user ID. All timestamps are `timestamptz` and are stored in UTC by PostgreSQL. Status columns
use explicit check constraints so invalid or differently-cased states cannot enter the database.

| Table | Ownership and purpose | Key relationships | Mutation and retention behavior |
| --- | --- | --- | --- |
| `profiles` | One private student profile per `auth.users` identity. | `id` is both the primary key and an `auth.users.id` foreign key. | User deletion cascades. `updated_at` tracks edits; matching-relevant changes advance `data_version`. |
| `scholarship_providers` | Shared normalized provider catalog. | Referenced by `scholarships.provider_id`. | Providers cannot be deleted while scholarships reference them. Admins can insert/update but not delete. |
| `scholarships` | Shared normalized scholarship catalog and provenance entry point. | Belongs to one provider; referenced by requirements, matches, and applications. | Admins update lifecycle state. Requirements and derived matches cascade on deletion; applications restrict deletion so tracked history is not silently lost. |
| `scholarship_requirements` | Ordered, versioned hard/soft eligibility rules. | Belongs to one scholarship. | Cascades with scholarship. Admin replacement can delete/insert requirements; direct user mutation is denied. |
| `matches` | Private materialized deterministic eligibility and scoring result. | Belongs to a profile and scholarship; unique per pair. | Profile or scholarship deletion removes derived matches. Only owners can read; backend service authorization controls writes. |
| `match_recalculation_jobs` | Private workload checkpoint for calculations above the synchronous limit. | Belongs to a profile; unique by profile input version and algorithm version. | Profile deletion cascades. Owners may read status; only the authorized backend match worker may mutate jobs. |
| `applications` | Private application tracking state, checklist, history, and reminder. | Belongs to a profile and scholarship; unique per pair. | Profile deletion cascades. Scholarship deletion is restricted. Owner CRUD is allowed by RLS. |
| `profile_documents` | Private document metadata; object bytes remain in private Supabase Storage. | Belongs to a profile; storage bucket/path is unique. | Profile deletion cascades metadata. A deletion tombstone coordinates object and derived-content cleanup. |
| `notification_preferences` | One private notification configuration per profile. | `profile_id` is the primary key and references `profiles.id`. | Profile deletion cascades. Owner CRUD is allowed by RLS. |
| `ingestion_runs` | Admin-only ingestion queue/history with sanitized counters and errors. | Optional self-reference identifies the original run; `created_by` references Auth. | Retry source uses `ON DELETE SET NULL`. Admins can insert/update, but not delete. |
| `audit_events` | Append-only administrative catalog/ingestion audit trail. | Actor references Auth with `ON DELETE SET NULL`; target is a polymorphic UUID. | A trigger rejects updates and deletes. Admins can insert/select only. |
| `idempotency_keys` | Backend-only durable request replay state. | Belongs directly to an Auth actor; unique by actor, operation, and key. | User deletion cascades. Only the service role can access rows, and Python service authorization further limits use. |
| `ingestion_raw_records` | Immutable JSON objects returned by an approved adapter; never exposed through the public API. | Belongs to an ingestion run; unique within that run by source, source record ID, and content hash. | Updates/deletes are rejected. Run deletion is restricted. Service role only. |
| `scholarship_sources` | Current source identity and explainable fingerprint for a normalized scholarship. | Belongs to one scholarship and references the latest immutable raw record. | Source URL and source-record identity are unique. Public responses receive only a sanitized projection. |
| `scholarship_field_history` | Immutable field-level changes detected between source versions. | Belongs to a scholarship and optionally references raw evidence and an admin actor. | Append-only. Admin read only; ingestion service writes. |
| `ingestion_quarantine` | Immutable rejected or ambiguous source records with safe reason codes. | Belongs to a run, optionally references raw evidence, and may list bounded candidate UUIDs. | Append-only. Admin read only; raw payload remains service-role only. |
| `ingestion_items` | Durable per-record processing checkpoint and dead-letter state. | Belongs to a run and one immutable raw record; may reference the resulting scholarship. | State and attempt counters support resumable batches. |

## Column dictionary

All tables use UUID primary keys. `created_at` records insertion time and mutable records also have
trigger-maintained `updated_at`; both are non-null `timestamptz`. Optional below means SQL `NULL` is
allowed. JSON values are constrained to the documented top-level shape.

### `profiles`

- `id`: Auth user UUID and row owner. `full_name`, `country`: display name and ISO 3166-1 alpha-2
  country. `study_level`: `undergraduate`, `postgraduate`, `doctoral`, or `other`.
- `field_of_study`, `goals`: optional academic profile fields. `gpa` and `gpa_scale` are both null
  for unknown GPA, or both present with `gpa <= gpa_scale`.
- `nationality_country`, `residence_country`, `date_of_birth`, `requires_financial_aid`, and
  `willing_to_relocate` are nullable so unknown remains distinct from explicit `false`.
  `interests` and `target_countries` are bounded arrays. `institution_name` and
  `experience_months` provide deterministic institution and experience evidence. `data_version`
  is the matching-input revision.

### `scholarship_providers`

- `id`: generated UUID. `name`: case-insensitively unique provider name. `website_url`: optional
  HTTPS URL. `canonical_name`: normalized provider identity for deterministic upserts. `status`:
  `active` or `inactive`.

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
  `verified_at`, `published_at`: optional lifecycle instants. `data_version`: positive catalog
  revision. `source_fingerprint`: optional SHA-256 of documented normalized identity fields.

### `scholarship_requirements`

- `id`: generated UUID. `scholarship_id`: owning scholarship. `constraint_type`: `hard` or `soft`.
- `field`: normalized eligibility field; `operator`: normalized comparison operator; `value`: JSON
  operand evaluated by the versioned deterministic engine.
- `source_evidence`: JSON object containing provenance. `reviewer_notes`: optional admin note.
  `position`: unique order within the scholarship. `version`: positive requirement revision.

### `matches`

- `id`: generated UUID. `profile_id`, `scholarship_id`: unique private profile/catalog pair.
- `total_score`, `confidence`: bounded 0–1 materialized values. `score_breakdown` and
  `requirement_evidence`: JSON arrays. `deterministic_explanation`: JSON object;
  `ai_explanation`: optional JSON object.
- `explanation_status`: `pending`, `ready`, or `unavailable`. `algorithm_version`, optional
  `embedding_version`, `profile_data_version`, and `scholarship_data_version`: reproducibility
  metadata. `eligibility_status` preserves `eligible`, `ineligible`, or `unknown`, and
  `missing_profile_fields` records evidence gaps. `stale_reasons`: JSON array. `calculated_at`:
  computation time.

### `match_recalculation_jobs`

- `profile_id`, `profile_data_version`, and `algorithm_version` form the idempotent workload key.
- `status`: `queued`, `running`, `completed`, `failed`, or `cancelled`. `counters` stores bounded
  calculation totals and `safe_errors` stores sanitized worker failures only.
- `started_at` and `completed_at` record execution timing. Owner RLS is read-only; service-role
  access is additionally constrained by the Python `MATCH_WORKER` capability.

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
- `status`: `uploaded`, `scanning`, `ready`, `rejected`, or `deleted`. `scan_status`: `pending`,
  `clean`, `infected`, or `failed`. `replaced_at` records safe replacement and `deleted_at` is the
  cleanup tombstone. Active owner query indexes exclude tombstones.

### `notification_preferences`

- `profile_id`: owner and primary key. `deadline_reminders_enabled`, `product_updates_enabled`:
  channel choices. `reminder_days`: one to ten offsets bounded to 0–365. `timezone`: IANA-style
  time-zone name stored for later notification services.

### `ingestion_runs`

- `id`: generated UUID. `source`, optional `source_url`, `dry_run`: requested ingestion source.
- `adapter_version`, `source_version`: reproducibility identifiers. `idempotency_key`: source-scoped
  replay key. `batch_size`, `resume_cursor`, `attempt_count`, `last_heartbeat_at`: durable worker
  checkpoint fields.
- `status`: `queued`, `running`, `partial`, `completed`, `failed`, `dead_lettered`, or `cancelled`.
  `counters`: JSON object; `safe_errors`: sanitized JSON that must not contain credentials, raw
  payloads, exception text, or stack traces.
- `original_run_id`: optional retry lineage. `created_by`: nullable admin actor. `started_at`,
  `completed_at`: optional execution timeline.

### `ingestion_raw_records`

- `run_id`, `source`, `source_record_id`, `source_version`: immutable source/run identity.
- `source_url`: canonical HTTPS URL. `content_sha256`: payload digest. `payload`: raw JSON restricted
  to the backend service role.
- `fetched_at`, `terms_checked_at`, `robots_allowed`: source-compliance evidence.

### `scholarship_sources`

- `scholarship_id`, `raw_record_id`: normalized record and latest raw evidence.
- `source`, `source_record_id`, `canonical_url`: stable source identity. `fingerprint`: normalized
  SHA-256 used only to flag potential duplicates; it never triggers an automatic merge.
- `trusted`: permits automatic publication only for an explicitly trusted adapter. The included
  fixture adapter is not trusted. `active`, `first_seen_at`, `last_seen_at`: source lifecycle.

### `scholarship_field_history`

- `scholarship_id`, optional `raw_record_id`: changed record and evidence.
- `field_name`, `old_value`, `new_value`: one immutable normalized field change.
- `change_source`: `ingestion` or `administrator`; optional `changed_by` identifies the actor.

### `ingestion_quarantine`

- `run_id`, optional `raw_record_id`: run and evidence. `reason_code`, `safe_summary`: stable,
  non-sensitive rejection information.
- `fingerprint`, `candidate_scholarship_ids`: bounded duplicate-review context. A match creates
  review work and never silently merges records.

### `ingestion_items`

- `run_id`, `raw_record_id`, `batch_number`, `position`: deterministic resume identity.
- `status`: `pending`, `processing`, `completed`, `rejected`, or `dead_letter`.
- `attempt_count`, optional safe error fields, and optional `scholarship_id`: retry/result state.

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
- Match indexes support owner-scoped descending score/UUID pagination excluding only confirmed
  ineligible rows, version reuse checks, and profile/scholarship lookup. Recalculation-job indexes
  support owner history and deterministic queued-job claims.
- Application indexes support owner pagination, chronological deadlines, and status workspaces.
- Document, ingestion, and audit indexes support their documented owner/admin timelines.
- Raw-source, fingerprint, quarantine, and partial item indexes support the ingestion query shapes;
  raw JSON fields are deliberately not indexed.
- The idempotency expiry index supports bounded cleanup; the unique key supports replay lookup.

No vector index is included. Embedding persistence and semantic/LLM ranking remain intentionally
deferred until measured retrieval queries and an approved model policy exist.
