begin;

create extension if not exists pgcrypto;

create schema if not exists private;
revoke all on schema private from public;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = statement_timestamp();
  return new;
end;
$$;

create or replace function private.reject_audit_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'audit events are append-only' using errcode = '55000';
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null check (char_length(full_name) between 1 and 200),
  country text not null check (country ~ '^[A-Z]{2}$'),
  study_level text not null check (
    study_level in ('undergraduate', 'postgraduate', 'doctoral', 'other')
  ),
  field_of_study text check (field_of_study is null or char_length(field_of_study) <= 200),
  gpa numeric(4, 3) check (gpa is null or (gpa >= 0 and gpa <= 4)),
  interests jsonb not null default '[]'::jsonb check (
    jsonb_typeof(interests) = 'array' and jsonb_array_length(interests) <= 50
  ),
  goals text check (goals is null or char_length(goals) <= 4000),
  data_version integer not null default 1 check (data_version > 0),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp()
);

create table public.scholarship_providers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 300),
  website_url text check (website_url is null or website_url ~ '^https://'),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp()
);

create unique index scholarship_providers_name_key
  on public.scholarship_providers (lower(name));

create table public.scholarships (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.scholarship_providers (id) on delete restrict,
  title text not null check (char_length(title) between 1 and 300),
  description text check (description is null or char_length(description) <= 20000),
  amount numeric(14, 2) check (amount is null or amount >= 0),
  currency text check (currency is null or currency ~ '^[A-Z]{3}$'),
  funding_type text not null default 'other' check (
    funding_type in ('full', 'partial', 'tuition', 'stipend', 'research', 'other')
  ),
  funding_summary text check (
    funding_summary is null or char_length(funding_summary) <= 2000
  ),
  study_levels text[] not null default '{}'::text[] check (
    study_levels <@ array['undergraduate', 'postgraduate', 'doctoral', 'other']::text[]
  ),
  fields_of_study text[] not null default '{}'::text[],
  destination_countries text[] not null default '{}'::text[] check (
    cardinality(destination_countries) <= 250
  ),
  nationality_requirements text[] not null default '{}'::text[] check (
    cardinality(nationality_requirements) <= 250
  ),
  residency_requirements text[] not null default '{}'::text[] check (
    cardinality(residency_requirements) <= 250
  ),
  required_documents text[] not null default '{}'::text[] check (
    cardinality(required_documents) <= 100
  ),
  deadline date,
  deadline_at timestamptz,
  deadline_timezone text check (
    deadline_timezone is null or char_length(deadline_timezone) <= 100
  ),
  eligibility_summary text check (
    eligibility_summary is null or char_length(eligibility_summary) <= 4000
  ),
  source_url text not null unique check (source_url ~ '^https://'),
  application_url text check (application_url is null or application_url ~ '^https://'),
  status text not null default 'draft' check (
    status in ('draft', 'in_review', 'published', 'unpublished', 'expired', 'archived')
  ),
  reviewer_notes text check (reviewer_notes is null or char_length(reviewer_notes) <= 5000),
  verified_at timestamptz,
  published_at timestamptz,
  data_version integer not null default 1 check (data_version > 0),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  check (deadline_at is null or deadline is not null)
);

create index scholarships_provider_id_idx on public.scholarships (provider_id);
create index scholarships_status_deadline_idx
  on public.scholarships (status, deadline nulls last, id);
create index scholarships_status_verified_idx
  on public.scholarships (status, verified_at desc nulls last, id);
create index scholarships_status_currency_amount_idx
  on public.scholarships (status, currency, amount desc nulls last, id);
create index scholarships_status_funding_type_idx
  on public.scholarships (status, funding_type, id);
create index scholarships_study_levels_idx on public.scholarships using gin (study_levels);
create index scholarships_fields_of_study_idx on public.scholarships using gin (fields_of_study);
create index scholarships_destination_countries_idx
  on public.scholarships using gin (destination_countries);
create index scholarships_nationality_requirements_idx
  on public.scholarships using gin (nationality_requirements);
create index scholarships_residency_requirements_idx
  on public.scholarships using gin (residency_requirements);
create index scholarships_search_idx on public.scholarships using gin (
  to_tsvector(
    'simple',
    coalesce(title, '') || ' ' || coalesce(description, '') || ' ' || coalesce(funding_summary, '')
  )
);

create table public.scholarship_requirements (
  id uuid primary key default gen_random_uuid(),
  scholarship_id uuid not null references public.scholarships (id) on delete cascade,
  constraint_type text not null check (constraint_type in ('hard', 'soft')),
  field text not null check (
    field in (
      'study_level', 'field_of_study', 'destination', 'nationality', 'residency',
      'gpa', 'experience', 'document', 'other'
    )
  ),
  operator text not null check (
    operator in ('equals', 'not_equals', 'in', 'not_in', 'gte', 'lte', 'contains', 'exists')
  ),
  value jsonb not null,
  source_evidence jsonb not null default '{}'::jsonb check (
    jsonb_typeof(source_evidence) = 'object'
  ),
  reviewer_notes text check (reviewer_notes is null or char_length(reviewer_notes) <= 3000),
  position integer not null default 0 check (position >= 0),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique (scholarship_id, position)
);

create index scholarship_requirements_lookup_idx
  on public.scholarship_requirements (scholarship_id, field, position);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  scholarship_id uuid not null references public.scholarships (id) on delete cascade,
  total_score numeric(6, 5) not null check (total_score >= 0 and total_score <= 1),
  confidence numeric(6, 5) not null check (confidence >= 0 and confidence <= 1),
  score_breakdown jsonb not null default '[]'::jsonb check (jsonb_typeof(score_breakdown) = 'array'),
  requirement_evidence jsonb not null default '[]'::jsonb check (
    jsonb_typeof(requirement_evidence) = 'array'
  ),
  deterministic_explanation jsonb not null default '{}'::jsonb check (
    jsonb_typeof(deterministic_explanation) = 'object'
  ),
  ai_explanation jsonb check (ai_explanation is null or jsonb_typeof(ai_explanation) = 'object'),
  explanation_status text not null default 'pending' check (
    explanation_status in ('pending', 'ready', 'unavailable')
  ),
  algorithm_version text not null check (char_length(algorithm_version) between 1 and 100),
  embedding_version text check (
    embedding_version is null or char_length(embedding_version) <= 100
  ),
  profile_data_version integer not null check (profile_data_version > 0),
  scholarship_data_version integer not null check (scholarship_data_version > 0),
  stale_reasons jsonb not null default '[]'::jsonb check (jsonb_typeof(stale_reasons) = 'array'),
  calculated_at timestamptz not null default statement_timestamp(),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique (profile_id, scholarship_id)
);

create index matches_profile_score_idx
  on public.matches (profile_id, total_score desc, id);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  scholarship_id uuid not null references public.scholarships (id) on delete restrict,
  status text not null default 'saved' check (
    status in (
      'saved', 'preparing', 'ready', 'submitted', 'interview', 'awarded',
      'unsuccessful', 'withdrawn'
    )
  ),
  notes text check (notes is null or char_length(notes) <= 10000),
  checklist jsonb not null default '[]'::jsonb check (jsonb_typeof(checklist) = 'array'),
  status_history jsonb not null default '[]'::jsonb check (jsonb_typeof(status_history) = 'array'),
  reminder jsonb check (reminder is null or jsonb_typeof(reminder) = 'object'),
  deadline_at timestamptz,
  deadline_timezone text check (
    deadline_timezone is null or char_length(deadline_timezone) <= 100
  ),
  submitted_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique (profile_id, scholarship_id)
);

create index applications_profile_created_idx
  on public.applications (profile_id, created_at desc, id);
create index applications_profile_deadline_idx
  on public.applications (profile_id, deadline_at nulls last, id);
create index applications_profile_status_idx
  on public.applications (profile_id, status, updated_at desc);

create table public.profile_documents (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  storage_bucket text not null check (char_length(storage_bucket) between 1 and 100),
  storage_object_path text not null check (char_length(storage_object_path) between 1 and 1024),
  document_type text not null check (
    document_type in (
      'transcript', 'cv', 'recommendation_letter', 'personal_statement',
      'identity_document', 'financial_document', 'other'
    )
  ),
  display_name text not null check (char_length(display_name) between 1 and 200),
  original_filename text not null check (char_length(original_filename) between 1 and 255),
  mime_type text not null check (char_length(mime_type) between 1 and 255),
  size_bytes bigint not null check (size_bytes > 0),
  checksum_sha256 text not null check (checksum_sha256 ~ '^[a-f0-9]{64}$'),
  status text not null default 'pending' check (
    status in ('pending', 'scanning', 'processing', 'ready', 'rejected', 'failed')
  ),
  scan_status text not null default 'pending' check (
    scan_status in ('pending', 'clean', 'infected', 'failed')
  ),
  replaced_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique (storage_bucket, storage_object_path)
);

create index profile_documents_profile_created_idx
  on public.profile_documents (profile_id, created_at desc, id);
create index profile_documents_profile_status_idx
  on public.profile_documents (profile_id, status, id);

create table public.notification_preferences (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  deadline_reminders_enabled boolean not null default true,
  product_updates_enabled boolean not null default false,
  reminder_days integer[] not null default array[30, 14, 7]::integer[] check (
    cardinality(reminder_days) between 1 and 10
    and 0 <= all(reminder_days)
    and 365 >= all(reminder_days)
  ),
  timezone text not null default 'UTC' check (char_length(timezone) between 1 and 100),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp()
);

create table public.ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  source text not null check (char_length(source) between 1 and 100),
  source_url text check (source_url is null or source_url ~ '^https://'),
  dry_run boolean not null default false,
  status text not null default 'queued' check (
    status in ('queued', 'running', 'completed', 'failed', 'cancelled')
  ),
  counters jsonb not null default '{"fetched":0,"created":0,"updated":0,"duplicates":0,"rejected":0}'::jsonb check (
    jsonb_typeof(counters) = 'object'
  ),
  safe_errors jsonb not null default '[]'::jsonb check (jsonb_typeof(safe_errors) = 'array'),
  original_run_id uuid references public.ingestion_runs (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  check (completed_at is null or started_at is not null)
);

create index ingestion_runs_created_idx on public.ingestion_runs (created_at desc, id);
create index ingestion_runs_status_created_idx
  on public.ingestion_runs (status, created_at desc, id);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users (id) on delete set null,
  action text not null check (char_length(action) between 1 and 200),
  target_type text not null check (
    target_type in ('scholarship', 'ingestion_run', 'duplicate_group', 'verification')
  ),
  target_id uuid not null,
  target_name text not null check (char_length(target_name) between 1 and 300),
  summary text not null check (char_length(summary) between 1 and 2000),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default statement_timestamp()
);

create index audit_events_created_idx on public.audit_events (created_at desc, id);
create index audit_events_target_idx
  on public.audit_events (target_type, target_id, created_at desc);
create index audit_events_actor_idx
  on public.audit_events (actor_id, created_at desc) where actor_id is not null;

create table public.idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references auth.users (id) on delete cascade,
  operation text not null check (char_length(operation) between 1 and 200),
  key text not null check (char_length(key) between 1 and 128 and key ~ '^[A-Za-z0-9._~-]+$'),
  request_hash text not null check (request_hash ~ '^[a-f0-9]{64}$'),
  status text not null default 'processing' check (
    status in ('processing', 'completed', 'failed')
  ),
  response_status integer check (response_status is null or response_status between 100 and 599),
  response_body jsonb,
  expires_at timestamptz not null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique (actor_id, operation, key)
);

create index idempotency_keys_expires_idx on public.idempotency_keys (expires_at);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

create trigger scholarship_providers_set_updated_at
before update on public.scholarship_providers
for each row execute function private.set_updated_at();

create trigger scholarships_set_updated_at
before update on public.scholarships
for each row execute function private.set_updated_at();

create trigger scholarship_requirements_set_updated_at
before update on public.scholarship_requirements
for each row execute function private.set_updated_at();

create trigger matches_set_updated_at
before update on public.matches
for each row execute function private.set_updated_at();

create trigger applications_set_updated_at
before update on public.applications
for each row execute function private.set_updated_at();

create trigger profile_documents_set_updated_at
before update on public.profile_documents
for each row execute function private.set_updated_at();

create trigger notification_preferences_set_updated_at
before update on public.notification_preferences
for each row execute function private.set_updated_at();

create trigger ingestion_runs_set_updated_at
before update on public.ingestion_runs
for each row execute function private.set_updated_at();

create trigger idempotency_keys_set_updated_at
before update on public.idempotency_keys
for each row execute function private.set_updated_at();

create trigger audit_events_reject_mutation
before update or delete on public.audit_events
for each row execute function private.reject_audit_mutation();

commit;
