begin;

create or replace function private.is_application_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin';
$$;

revoke all on function private.is_application_admin() from public;
grant usage on schema private to authenticated, service_role;
grant execute on function private.is_application_admin() to authenticated, service_role;

alter table public.profiles enable row level security;
alter table public.scholarship_providers enable row level security;
alter table public.scholarships enable row level security;
alter table public.scholarship_requirements enable row level security;
alter table public.matches enable row level security;
alter table public.applications enable row level security;
alter table public.profile_documents enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.ingestion_runs enable row level security;
alter table public.audit_events enable row level security;
alter table public.idempotency_keys enable row level security;

revoke all on all tables in schema public from public, anon, authenticated;

grant select, insert, update, delete on public.profiles to authenticated;
grant select on public.matches to authenticated;
grant select, insert, update, delete on public.applications to authenticated;
grant select, insert, update, delete on public.profile_documents to authenticated;
grant select, insert, update, delete on public.notification_preferences to authenticated;

grant select, insert, update on public.scholarship_providers to authenticated;
grant select, insert, update on public.scholarships to authenticated;
grant select, insert, update, delete on public.scholarship_requirements to authenticated;
grant select, insert, update on public.ingestion_runs to authenticated;
grant select, insert on public.audit_events to authenticated;

grant all on all tables in schema public to service_role;

create policy profiles_owner_select on public.profiles
for select to authenticated
using (id = auth.uid());

create policy profiles_owner_insert on public.profiles
for insert to authenticated
with check (id = auth.uid());

create policy profiles_owner_update on public.profiles
for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy profiles_owner_delete on public.profiles
for delete to authenticated
using (id = auth.uid());

create policy profile_documents_owner_select on public.profile_documents
for select to authenticated
using (profile_id = auth.uid());

create policy profile_documents_owner_insert on public.profile_documents
for insert to authenticated
with check (profile_id = auth.uid());

create policy profile_documents_owner_update on public.profile_documents
for update to authenticated
using (profile_id = auth.uid())
with check (profile_id = auth.uid());

create policy profile_documents_owner_delete on public.profile_documents
for delete to authenticated
using (profile_id = auth.uid());

create policy matches_owner_select on public.matches
for select to authenticated
using (profile_id = auth.uid());

create policy applications_owner_select on public.applications
for select to authenticated
using (profile_id = auth.uid());

create policy applications_owner_insert on public.applications
for insert to authenticated
with check (profile_id = auth.uid());

create policy applications_owner_update on public.applications
for update to authenticated
using (profile_id = auth.uid())
with check (profile_id = auth.uid());

create policy applications_owner_delete on public.applications
for delete to authenticated
using (profile_id = auth.uid());

create policy notification_preferences_owner_select on public.notification_preferences
for select to authenticated
using (profile_id = auth.uid());

create policy notification_preferences_owner_insert on public.notification_preferences
for insert to authenticated
with check (profile_id = auth.uid());

create policy notification_preferences_owner_update on public.notification_preferences
for update to authenticated
using (profile_id = auth.uid())
with check (profile_id = auth.uid());

create policy notification_preferences_owner_delete on public.notification_preferences
for delete to authenticated
using (profile_id = auth.uid());

create policy scholarship_providers_catalog_select on public.scholarship_providers
for select to authenticated
using (
  private.is_application_admin()
  or exists (
    select 1
    from public.scholarships
    where scholarships.provider_id = scholarship_providers.id
      and scholarships.status = 'published'
  )
);

create policy scholarship_providers_admin_insert on public.scholarship_providers
for insert to authenticated
with check (private.is_application_admin());

create policy scholarship_providers_admin_update on public.scholarship_providers
for update to authenticated
using (private.is_application_admin())
with check (private.is_application_admin());

create policy scholarships_catalog_select on public.scholarships
for select to authenticated
using (status = 'published' or private.is_application_admin());

create policy scholarships_admin_insert on public.scholarships
for insert to authenticated
with check (private.is_application_admin());

create policy scholarships_admin_update on public.scholarships
for update to authenticated
using (private.is_application_admin())
with check (private.is_application_admin());

create policy scholarship_requirements_catalog_select on public.scholarship_requirements
for select to authenticated
using (
  private.is_application_admin()
  or exists (
    select 1
    from public.scholarships
    where scholarships.id = scholarship_requirements.scholarship_id
      and scholarships.status = 'published'
  )
);

create policy scholarship_requirements_admin_insert on public.scholarship_requirements
for insert to authenticated
with check (private.is_application_admin());

create policy scholarship_requirements_admin_update on public.scholarship_requirements
for update to authenticated
using (private.is_application_admin())
with check (private.is_application_admin());

create policy scholarship_requirements_admin_delete on public.scholarship_requirements
for delete to authenticated
using (private.is_application_admin());

create policy ingestion_runs_admin_select on public.ingestion_runs
for select to authenticated
using (private.is_application_admin());

create policy ingestion_runs_admin_insert on public.ingestion_runs
for insert to authenticated
with check (private.is_application_admin() and created_by = auth.uid());

create policy ingestion_runs_admin_update on public.ingestion_runs
for update to authenticated
using (private.is_application_admin())
with check (private.is_application_admin());

create policy audit_events_admin_select on public.audit_events
for select to authenticated
using (private.is_application_admin());

create policy audit_events_admin_insert on public.audit_events
for insert to authenticated
with check (private.is_application_admin() and actor_id = auth.uid());

commit;
