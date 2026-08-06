begin;

create extension if not exists pg_trgm;

create or replace function private.reject_immutable_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'immutable ingestion record cannot be changed' using errcode = '55000';
end;
$$;

alter table public.scholarship_providers add column canonical_name text;
update public.scholarship_providers
set canonical_name = lower(regexp_replace(trim(name), '\s+', ' ', 'g'));
alter table public.scholarship_providers
  alter column canonical_name set not null,
  add constraint scholarship_providers_canonical_name_length check (
    char_length(canonical_name) between 1 and 300
  );
create unique index scholarship_providers_canonical_name_key
  on public.scholarship_providers (canonical_name);
create index scholarship_providers_name_search_idx
  on public.scholarship_providers using gin (name gin_trgm_ops);

alter table public.scholarships
  add column source_fingerprint text,
  add constraint scholarships_source_fingerprint_check check (
    source_fingerprint is null or source_fingerprint ~ '^[a-f0-9]{64}$'
  );

create index scholarships_status_published_idx
  on public.scholarships (status, published_at desc nulls last, id desc);
create index scholarships_status_title_idx
  on public.scholarships (status, lower(title), id);

alter table public.scholarships
  drop constraint scholarships_study_levels_check,
  add constraint scholarships_study_levels_check check (
    study_levels <@ array[
      'secondary', 'undergraduate', 'postgraduate', 'doctoral', 'vocational', 'other'
    ]::text[]
  );

alter table public.ingestion_runs
  drop constraint ingestion_runs_status_check,
  add column adapter_version text not null default 'unknown',
  add column source_version text,
  add column idempotency_key text,
  add column batch_size integer not null default 100,
  add column resume_cursor integer not null default 0,
  add column attempt_count integer not null default 0,
  add column last_heartbeat_at timestamptz,
  add constraint ingestion_runs_status_check check (
    status in ('queued', 'running', 'partial', 'completed', 'failed', 'dead_lettered', 'cancelled')
  ),
  add constraint ingestion_runs_idempotency_key_check check (
    idempotency_key is null or (
      char_length(idempotency_key) between 1 and 128
      and idempotency_key ~ '^[A-Za-z0-9._~-]+$'
    )
  ),
  add constraint ingestion_runs_batch_size_check check (batch_size between 1 and 500),
  add constraint ingestion_runs_resume_cursor_check check (resume_cursor >= 0),
  add constraint ingestion_runs_attempt_count_check check (attempt_count >= 0);

create unique index ingestion_runs_source_idempotency_key
  on public.ingestion_runs (source, idempotency_key)
  where idempotency_key is not null;
create unique index ingestion_runs_one_active_source_idx
  on public.ingestion_runs (source)
  where status in ('queued', 'running', 'partial');

create table public.ingestion_raw_records (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.ingestion_runs (id) on delete restrict,
  source text not null check (char_length(source) between 1 and 100),
  source_record_id text not null check (char_length(source_record_id) between 1 and 500),
  source_url text not null check (source_url ~ '^https://'),
  source_version text not null check (char_length(source_version) between 1 and 200),
  content_sha256 text not null check (content_sha256 ~ '^[a-f0-9]{64}$'),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  fetched_at timestamptz not null,
  terms_checked_at timestamptz not null,
  robots_allowed boolean not null,
  created_at timestamptz not null default statement_timestamp(),
  unique (run_id, source, source_record_id, content_sha256)
);

create index ingestion_raw_records_run_idx
  on public.ingestion_raw_records (run_id, created_at, id);
create index ingestion_raw_records_source_record_idx
  on public.ingestion_raw_records (source, source_record_id, created_at desc);

create table public.scholarship_sources (
  id uuid primary key default gen_random_uuid(),
  scholarship_id uuid not null references public.scholarships (id) on delete cascade,
  raw_record_id uuid not null references public.ingestion_raw_records (id) on delete restrict,
  source text not null check (char_length(source) between 1 and 100),
  source_record_id text not null check (char_length(source_record_id) between 1 and 500),
  canonical_url text not null check (canonical_url ~ '^https://'),
  fingerprint text not null check (fingerprint ~ '^[a-f0-9]{64}$'),
  trusted boolean not null default false,
  active boolean not null default true,
  first_seen_at timestamptz not null,
  last_seen_at timestamptz not null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique (source, source_record_id),
  unique (canonical_url),
  check (last_seen_at >= first_seen_at)
);

create index scholarship_sources_scholarship_active_idx
  on public.scholarship_sources (scholarship_id, active, last_seen_at desc);
create index scholarship_sources_fingerprint_idx
  on public.scholarship_sources (fingerprint, active, scholarship_id);

create table public.scholarship_field_history (
  id uuid primary key default gen_random_uuid(),
  scholarship_id uuid not null references public.scholarships (id) on delete cascade,
  raw_record_id uuid references public.ingestion_raw_records (id) on delete restrict,
  field_name text not null check (char_length(field_name) between 1 and 100),
  old_value jsonb,
  new_value jsonb,
  change_source text not null check (change_source in ('ingestion', 'administrator')),
  changed_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default statement_timestamp(),
  check (old_value is distinct from new_value)
);

create index scholarship_field_history_scholarship_idx
  on public.scholarship_field_history (scholarship_id, created_at desc, id);

create table public.ingestion_quarantine (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.ingestion_runs (id) on delete cascade,
  raw_record_id uuid references public.ingestion_raw_records (id) on delete restrict,
  reason_code text not null check (reason_code ~ '^[A-Z][A-Z0-9_]+$'),
  safe_summary text not null check (char_length(safe_summary) between 1 and 1000),
  fingerprint text check (fingerprint is null or fingerprint ~ '^[a-f0-9]{64}$'),
  candidate_scholarship_ids uuid[] not null default '{}'::uuid[] check (
    cardinality(candidate_scholarship_ids) <= 20
  ),
  created_at timestamptz not null default statement_timestamp()
);

create index ingestion_quarantine_run_idx
  on public.ingestion_quarantine (run_id, created_at, id);
create index ingestion_quarantine_reason_idx
  on public.ingestion_quarantine (reason_code, created_at desc);

create table public.ingestion_items (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.ingestion_runs (id) on delete cascade,
  raw_record_id uuid not null references public.ingestion_raw_records (id) on delete cascade,
  batch_number integer not null check (batch_number >= 0),
  position integer not null check (position >= 0),
  status text not null default 'pending' check (
    status in ('pending', 'processing', 'completed', 'rejected', 'dead_letter')
  ),
  attempt_count integer not null default 0 check (attempt_count between 0 and 20),
  scholarship_id uuid references public.scholarships (id) on delete set null,
  safe_error_code text check (
    safe_error_code is null or safe_error_code ~ '^[A-Z][A-Z0-9_]+$'
  ),
  safe_error_summary text check (
    safe_error_summary is null or char_length(safe_error_summary) <= 1000
  ),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique (run_id, raw_record_id),
  unique (run_id, position)
);

create index ingestion_items_claim_idx
  on public.ingestion_items (run_id, status, position, id)
  where status in ('pending', 'processing');
create index ingestion_items_dead_letter_idx
  on public.ingestion_items (run_id, status, updated_at desc)
  where status = 'dead_letter';

create trigger scholarship_sources_set_updated_at
before update on public.scholarship_sources
for each row execute function private.set_updated_at();

create trigger ingestion_items_set_updated_at
before update on public.ingestion_items
for each row execute function private.set_updated_at();

create trigger ingestion_raw_records_immutable
before update or delete on public.ingestion_raw_records
for each row execute function private.reject_immutable_mutation();

create trigger scholarship_field_history_immutable
before update or delete on public.scholarship_field_history
for each row execute function private.reject_immutable_mutation();

create trigger ingestion_quarantine_immutable
before update or delete on public.ingestion_quarantine
for each row execute function private.reject_immutable_mutation();

alter table public.ingestion_raw_records enable row level security;
alter table public.scholarship_sources enable row level security;
alter table public.scholarship_field_history enable row level security;
alter table public.ingestion_quarantine enable row level security;
alter table public.ingestion_items enable row level security;

revoke all on public.ingestion_raw_records from public, anon, authenticated;
revoke all on public.scholarship_sources from public, anon, authenticated;
revoke all on public.scholarship_field_history from public, anon, authenticated;
revoke all on public.ingestion_quarantine from public, anon, authenticated;
revoke all on public.ingestion_items from public, anon, authenticated;

grant select on public.scholarship_sources to authenticated;
grant select on public.scholarship_field_history to authenticated;
grant select on public.ingestion_quarantine to authenticated;
grant select on public.ingestion_items to authenticated;
grant all on public.ingestion_raw_records to service_role;
grant all on public.scholarship_sources to service_role;
grant all on public.scholarship_field_history to service_role;
grant all on public.ingestion_quarantine to service_role;
grant all on public.ingestion_items to service_role;

create policy scholarship_sources_catalog_select on public.scholarship_sources
for select to authenticated
using (
  private.is_application_admin()
  or exists (
    select 1 from public.scholarships
    join public.scholarship_providers
      on scholarship_providers.id = scholarships.provider_id
    where scholarships.id = scholarship_sources.scholarship_id
      and scholarships.status = 'published'
      and scholarship_providers.status = 'active'
  )
);

create policy scholarship_field_history_admin_select on public.scholarship_field_history
for select to authenticated using (private.is_application_admin());

create policy ingestion_quarantine_admin_select on public.ingestion_quarantine
for select to authenticated using (private.is_application_admin());

create policy ingestion_items_admin_select on public.ingestion_items
for select to authenticated using (private.is_application_admin());

commit;
