begin;

alter table public.profiles drop constraint profiles_study_level_check;
alter table public.profiles add constraint profiles_study_level_check check (
  study_level in (
    'secondary', 'undergraduate', 'postgraduate', 'doctoral', 'vocational', 'other'
  )
);

alter table public.profiles
  alter column gpa type numeric(6, 3),
  add column gpa_scale numeric(6, 3),
  add column nationality_country text,
  add column residence_country text,
  add column date_of_birth date,
  add column target_countries text[] not null default '{}'::text[],
  add column requires_financial_aid boolean,
  add column willing_to_relocate boolean;

update public.profiles set gpa_scale = 4 where gpa is not null;

alter table public.profiles
  drop constraint profiles_gpa_check,
  add constraint profiles_gpa_and_scale_check check (
    (gpa is null and gpa_scale is null)
    or (
      gpa is not null and gpa_scale is not null
      and gpa >= 0 and gpa_scale > 0 and gpa_scale <= 100 and gpa <= gpa_scale
    )
  ),
  add constraint profiles_nationality_country_check check (
    nationality_country is null or nationality_country ~ '^[A-Z]{2}$'
  ),
  add constraint profiles_residence_country_check check (
    residence_country is null or residence_country ~ '^[A-Z]{2}$'
  ),
  add constraint profiles_date_of_birth_check check (
    date_of_birth is null or date_of_birth between date '1900-01-01' and current_date
  ),
  add constraint profiles_target_countries_check check (cardinality(target_countries) <= 50);

alter table public.profile_documents drop constraint profile_documents_status_check;

update public.profile_documents
set status = case status
  when 'pending' then 'uploaded'
  when 'processing' then 'scanning'
  when 'failed' then 'rejected'
  else status
end;

alter table public.profile_documents
  add column deleted_at timestamptz,
  alter column status set default 'uploaded',
  add constraint profile_documents_status_check check (
    status in ('uploaded', 'scanning', 'ready', 'rejected', 'deleted')
  ),
  add constraint profile_documents_deleted_state_check check (
    (status = 'deleted') = (deleted_at is not null)
  );

drop index public.profile_documents_profile_created_idx;
drop index public.profile_documents_profile_status_idx;

create index profile_documents_active_profile_created_idx
  on public.profile_documents (profile_id, created_at desc, id)
  where deleted_at is null;
create index profile_documents_active_profile_status_idx
  on public.profile_documents (profile_id, status, id)
  where deleted_at is null;

do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public)
    values ('profile-documents', 'profile-documents', false)
    on conflict (id) do update set public = false;
  end if;
end;
$$;

commit;
