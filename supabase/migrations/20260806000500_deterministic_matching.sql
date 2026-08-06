begin;

alter table public.profiles
  add column institution_name text,
  add column experience_months integer,
  add constraint profiles_institution_name_check check (
    institution_name is null or char_length(institution_name) between 1 and 300
  ),
  add constraint profiles_experience_months_check check (
    experience_months is null or experience_months between 0 and 1200
  );

alter table public.scholarship_requirements
  drop constraint scholarship_requirements_field_check,
  add constraint scholarship_requirements_field_check check (
    field in (
      'country', 'destination', 'nationality', 'residency', 'study_level',
      'field_of_study', 'gpa', 'age', 'date_of_birth', 'institution',
      'experience', 'experience_months', 'document', 'other'
    )
  );

alter table public.matches
  add column eligibility_status text not null default 'unknown',
  add column missing_profile_fields text[] not null default '{}'::text[],
  add constraint matches_eligibility_status_check check (
    eligibility_status in ('eligible', 'ineligible', 'unknown')
  ),
  add constraint matches_missing_profile_fields_check check (
    cardinality(missing_profile_fields) <= 50
  );

create index matches_profile_version_idx
  on public.matches (
    profile_id, profile_data_version, algorithm_version,
    scholarship_data_version, scholarship_id
  );
create index matches_ranked_profile_score_idx
  on public.matches (profile_id, total_score desc, id)
  where eligibility_status <> 'ineligible';

create table public.match_recalculation_jobs (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  profile_data_version integer not null check (profile_data_version > 0),
  algorithm_version text not null check (char_length(algorithm_version) between 1 and 100),
  status text not null default 'queued' check (
    status in ('queued', 'running', 'completed', 'failed', 'cancelled')
  ),
  counters jsonb not null default '{"candidates":0,"calculated":0,"reused":0,"excluded":0}'::jsonb
    check (jsonb_typeof(counters) = 'object'),
  safe_errors jsonb not null default '[]'::jsonb check (jsonb_typeof(safe_errors) = 'array'),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique (profile_id, profile_data_version, algorithm_version),
  check (completed_at is null or started_at is not null)
);

create index match_recalculation_jobs_profile_created_idx
  on public.match_recalculation_jobs (profile_id, created_at desc, id);
create index match_recalculation_jobs_claim_idx
  on public.match_recalculation_jobs (status, created_at, id)
  where status = 'queued';

create trigger match_recalculation_jobs_set_updated_at
before update on public.match_recalculation_jobs
for each row execute function private.set_updated_at();

alter table public.match_recalculation_jobs enable row level security;
revoke all on public.match_recalculation_jobs from public, anon, authenticated;
grant select on public.match_recalculation_jobs to authenticated;
grant all on public.match_recalculation_jobs to service_role;

create policy match_recalculation_jobs_owner_select on public.match_recalculation_jobs
for select to authenticated
using (profile_id = auth.uid());

commit;
