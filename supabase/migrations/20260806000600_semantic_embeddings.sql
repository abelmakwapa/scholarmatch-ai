begin;

-- Enable pgvector extension
create extension if not exists vector;

-- Embedding model registry
create table public.embedding_models (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 1 and 100),
  provider text not null check (provider in ('qwen', 'openai', 'azure')),
  dimensions integer not null check (dimensions > 0 and dimensions <= 4096),
  status text not null default 'inactive' check (status in ('active', 'inactive', 'deprecated')),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp()
);

create index embedding_models_status_idx on public.embedding_models (status);

-- Entity embedding storage for profiles
create table public.profile_embeddings (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  model_id uuid not null references public.embedding_models (id),
  dimensions integer not null,
  content_hash text not null check (char_length(content_hash) between 1 and 128),
  entity_data_version integer not null check (entity_data_version > 0),
  embedding_version integer not null default 1 check (embedding_version > 0),
  embedding vector not null,
  canonical_input text not null check (char_length(canonical_input) <= 8000),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique (profile_id, model_id, embedding_version)
);

create index profile_embeddings_lookup_idx
  on public.profile_embeddings (profile_id, model_id, embedding_version);
create index profile_embeddings_version_idx
  on public.profile_embeddings (model_id, embedding_version);

-- Entity embedding storage for scholarships
create table public.scholarship_embeddings (
  id uuid primary key default gen_random_uuid(),
  scholarship_id uuid not null references public.scholarships (id) on delete cascade,
  model_id uuid not null references public.embedding_models (id),
  dimensions integer not null,
  content_hash text not null check (char_length(content_hash) between 1 and 128),
  entity_data_version integer not null check (entity_data_version > 0),
  embedding_version integer not null default 1 check (embedding_version > 0),
  embedding vector not null,
  canonical_input text not null check (char_length(canonical_input) <= 8000),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique (scholarship_id, model_id, embedding_version)
);

create index scholarship_embeddings_lookup_idx
  on public.scholarship_embeddings (scholarship_id, model_id, embedding_version);
create index scholarship_embeddings_version_idx
  on public.scholarship_embeddings (model_id, embedding_version);

-- Re-indexing job tracking for safe migration to new embedding versions
create table public.embedding_reindex_jobs (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('profile', 'scholarship')),
  source_model_id uuid references public.embedding_models (id),
  target_model_id uuid not null references public.embedding_models (id),
  target_embedding_version integer not null check (target_embedding_version > 0),
  status text not null default 'queued' check (
    status in ('queued', 'running', 'completed', 'failed', 'cancelled')
  ),
  total_count integer not null default 0 check (total_count >= 0),
  processed_count integer not null default 0 check (processed_count >= 0),
  failed_count integer not null default 0 check (failed_count >= 0),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  check (completed_at is null or started_at is not null),
  check (processed_count + failed_count <= total_count)
);

create index embedding_reindex_jobs_status_idx
  on public.embedding_reindex_jobs (status, created_at);

-- Update matches table to support AI explanations
alter table public.matches
  add column ai_explanation jsonb,
  add column explanation_status text not null default 'unavailable' check (
    explanation_status in ('pending', 'ready', 'unavailable', 'failed')
  ),
  add column explanation_cache_key text,
  add column explanation_model text,
  add column explanation_prompt_version text,
  add column explanation_tokens_used integer check (explanation_tokens_used >= 0),
  add column explanation_cost_micros bigint check (explanation_cost_micros >= 0),
  add column explanation_last_attempt timestamptz,
  add column explanation_retry_count integer not null default 0 check (explanation_retry_count >= 0);

create index matches_explanation_status_idx
  on public.matches (explanation_status, explanation_last_attempt)
  where explanation_status in ('pending', 'failed');

-- Track Qwen explanation cache
create table public.explanation_cache (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  input_hash text not null check (char_length(input_hash) between 1 and 128),
  model_name text not null check (char_length(model_name) between 1 and 100),
  prompt_version text not null check (char_length(prompt_version) between 1 and 50),
  explanation jsonb not null,
  tokens_used integer not null check (tokens_used >= 0),
  cost_micros bigint check (cost_micros >= 0),
  created_at timestamptz not null default statement_timestamp(),
  unique (match_id, model_name, prompt_version)
);

create index explanation_cache_lookup_idx
  on public.explanation_cache (match_id, input_hash);

-- Helper functions
create or replace function private.generate_content_hash(
  p_profile_data_version integer,
  p_interests jsonb,
  p_goals text,
  p_study_level text,
  p_field_of_study text,
  p_country text,
  p_nationality text,
  p_residence text
) returns text language plpgsql stable as $$
declare
  v_input text;
begin
  v_input := format('%s|%s|%s|%s|%s|%s|%s|%s',
    p_profile_data_version,
    coalesce(p_interests::text, ''),
    coalesce(p_goals, ''),
    coalesce(p_study_level, ''),
    coalesce(p_field_of_study, ''),
    coalesce(p_country, ''),
    coalesce(p_nationality, ''),
    coalesce(p_residence, '')
  );
  return encode(digest(v_input, 'sha256'), 'hex');
end;
$$;

create or replace function private.generate_scholarship_content_hash(
  p_data_version integer,
  p_title text,
  p_description text,
  p_fields_of_study text[],
  p_eligibility_summary text,
  p_destination_countries text[]
) returns text language plpgsql stable as $$
declare
  v_input text;
begin
  v_input := format('%s|%s|%s|%s|%s|%s',
    p_data_version,
    coalesce(p_title, ''),
    coalesce(p_description, ''),
    array_to_string(p_fields_of_study, ','),
    coalesce(p_eligibility_summary, ''),
    array_to_string(p_destination_countries, ',')
  );
  return encode(digest(v_input, 'sha256'), 'hex');
end;
$$;

-- RLS policies
alter table public.embedding_models enable row level security;
alter table public.profile_embeddings enable row level security;
alter table public.scholarship_embeddings enable row level security;
alter table public.embedding_reindex_jobs enable row level security;
alter table public.explanation_cache enable row level security;

revoke all on public.embedding_models from public, anon, authenticated;
revoke all on public.profile_embeddings from public, anon, authenticated;
revoke all on public.scholarship_embeddings from public, anon, authenticated;
revoke all on public.embedding_reindex_jobs from public, anon, authenticated;
revoke all on public.explanation_cache from public, anon, authenticated;

grant select on public.embedding_models to authenticated;
grant all on public.embedding_models to service_role;

grant select on public.profile_embeddings to authenticated;
grant all on public.profile_embeddings to service_role;

grant select on public.scholarship_embeddings to authenticated;
grant all on public.scholarship_embeddings to service_role;

grant select on public.embedding_reindex_jobs to authenticated;
grant all on public.embedding_reindex_jobs to service_role;

grant select on public.explanation_cache to authenticated;
grant all on public.explanation_cache to service_role;

-- Policies for authenticated users
create policy embedding_models_owner_select on public.embedding_models
  for select to authenticated using (true);

create policy profile_embeddings_owner_select on public.profile_embeddings
  for select to authenticated using (true);

create policy scholarship_embeddings_read on public.scholarship_embeddings
  for select to authenticated using (true);

create policy embedding_reindex_jobs_read on public.embedding_reindex_jobs
  for select to authenticated using (true);

create policy explanation_cache_owner_select on public.explanation_cache
  for select to authenticated using (true);

commit;
