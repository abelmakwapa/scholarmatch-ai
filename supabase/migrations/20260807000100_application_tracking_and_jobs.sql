begin;

-- Application tracking enhancements: status history, checklist items, private notes
-- Notification delivery tracking with dead-letter handling
-- Redis/Celery job infrastructure support tables

-- Add application_status_history table for append-only status tracking
create table public.application_status_history (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  status text not null check (
    status in (
      'saved', 'preparing', 'ready', 'submitted', 'interview', 'awarded',
      'unsuccessful', 'withdrawn'
    )
  ),
  actor_id uuid not null,
  reason text check (reason is null or char_length(reason) <= 1000),
  created_at timestamptz not null default statement_timestamp()
);

create index application_status_history_application_idx
  on public.application_status_history (application_id, created_at desc, id);

-- Add application_checklist_items table for structured checklist tracking
create table public.application_checklist_items (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  item_key text not null check (char_length(item_key) between 1 and 100),
  description text not null check (char_length(description) between 1 and 500),
  completed boolean not null default false,
  required boolean not null default false,
  notes text check (notes is null or char_length(notes) <= 1000),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique (application_id, item_key)
);

create index application_checklist_items_application_idx
  on public.application_checklist_items (application_id, created_at desc);

-- Add application_private_notes table for user-owned notes
create table public.application_private_notes (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  author_id uuid not null,
  content text not null check (char_length(content) between 1 and 5000),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz
);

create index application_private_notes_application_idx
  on public.application_private_notes (application_id, created_at desc);

-- Add notification_delivery_log table for tracking email/notification delivery
create table public.notification_delivery_log (
  id uuid primary key default gen_random_uuid(),
  recipient_profile_id uuid not null references public.profiles (id) on delete cascade,
  channel text not null check (channel in ('email', 'push', 'sms')),
  template_name text not null check (char_length(template_name) between 1 and 100),
  subject text check (subject is null or char_length(subject) <= 500),
  body_hash text not null check (char_length(body_hash) = 64),
  scheduled_at timestamptz not null,
  sent_at timestamptz,
  delivered_at timestamptz,
  bounced_at timestamptz,
  status text not null default 'pending' check (
    status in ('pending', 'sent', 'delivered', 'bounced', 'failed', 'dead_lettered')
  ),
  error_code text check (error_code is null or char_length(error_code) <= 100),
  error_message text check (error_message is null or char_length(error_message) <= 2000),
  retry_count integer not null default 0 check (retry_count >= 0 and retry_count <= 10),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  idempotency_key text check (idempotency_key is null or char_length(idempotency_key) <= 200),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp()
);

create index notification_delivery_log_recipient_status_idx
  on public.notification_delivery_log (recipient_profile_id, status, scheduled_at);

create index notification_delivery_log_scheduled_pending_idx
  on public.notification_delivery_log (scheduled_at, id)
  where status = 'pending';

create index notification_delivery_log_dead_letter_idx
  on public.notification_delivery_log (id)
  where status = 'dead_lettered';

create index notification_delivery_log_idempotency_idx
  on public.notification_delivery_log (idempotency_key)
  where idempotency_key is not null;

-- Add notification_preferences extended fields for quiet hours
alter table public.notification_preferences
  add column if not exists quiet_hours_start integer check (
    quiet_hours_start is null or (quiet_hours_start >= 0 and quiet_hours_start < 24)
  ),
  add column if not exists quiet_hours_end integer check (
    quiet_hours_end is null or (quiet_hours_end >= 0 and quiet_hours_end < 24)
  );

-- Add job_queue table for Celery-like job management (if not using external queue)
create table public.job_queue (
  id uuid primary key default gen_random_uuid(),
  queue_name text not null check (char_length(queue_name) between 1 and 100),
  task_name text not null check (char_length(task_name) between 1 and 200),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  correlation_id text check (correlation_id is null or char_length(correlation_id) <= 100),
  idempotency_key text check (idempotency_key is null or char_length(idempotency_key) <= 200),
  status text not null default 'pending' check (
    status in ('pending', 'running', 'completed', 'failed', 'dead_lettered', 'cancelled')
  ),
  priority integer not null default 0 check (priority >= 0 and priority <= 10),
  retry_count integer not null default 0 check (retry_count >= 0),
  max_retries integer not null default 3 check (max_retries >= 0),
  next_retry_at timestamptz,
  time_limit_seconds integer check (time_limit_seconds is null or time_limit_seconds > 0),
  started_at timestamptz,
  completed_at timestamptz,
  error_code text check (error_code is null or char_length(error_code) <= 100),
  error_message text check (error_message is null or char_length(error_message) <= 5000),
  worker_id text check (worker_id is null or char_length(worker_id) <= 100),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp()
);

create index job_queue_status_priority_idx
  on public.job_queue (status, priority desc, created_at asc)
  where status in ('pending', 'running');

create index job_queue_queue_status_idx
  on public.job_queue (queue_name, status, priority desc, created_at asc);

create index job_queue_correlation_idx
  on public.job_queue (correlation_id)
  where correlation_id is not null;

create index job_queue_idempotency_idx
  on public.job_queue (idempotency_key)
  where idempotency_key is not null;

create index job_queue_dead_letter_idx
  on public.job_queue (id)
  where status = 'dead_lettered';

create index job_queue_next_retry_idx
  on public.job_queue (next_retry_at, id)
  where status = 'pending' and next_retry_at is not null;

-- Add job_queue_events for audit trail of job state changes
create table public.job_queue_events (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.job_queue (id) on delete cascade,
  event_type text not null check (
    event_type in (
      'enqueued', 'started', 'completed', 'failed', 'retried',
      'dead_lettered', 'cancelled', 'timeout'
    )
  ),
  previous_status text,
  new_status text,
  error_code text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default statement_timestamp()
);

create index job_queue_events_job_idx
  on public.job_queue_events (job_id, created_at desc);

-- Trigger to update updated_at timestamps
create trigger application_checklist_items_set_updated_at
before update on public.application_checklist_items
for each row execute procedure private.set_updated_at();

create trigger application_private_notes_set_updated_at
before update on public.application_private_notes
for each row execute procedure private.set_updated_at();

create trigger notification_delivery_log_set_updated_at
before update on public.notification_delivery_log
for each row execute procedure private.set_updated_at();

create trigger job_queue_set_updated_at
before update on public.job_queue
for each row execute procedure private.set_updated_at();

-- Function to record application status transition
create or replace function private.record_application_status_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  actor_id_val uuid;
begin
  -- Extract actor from JWT claims if available
  begin
    actor_id_val := (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')::uuid;
  exception when others then
    actor_id_val := (current_setting('app.actor_id', true))::uuid;
  end;

  if actor_id_val is null then
    actor_id_val := '00000000-0000-0000-0000-000000000000'::uuid;
  end if;

  insert into public.application_status_history (application_id, status, actor_id, reason)
  values (new.id, new.status, actor_id_val, new.notes);

  return new;
end;
$$;

-- Trigger to record status history on application status change
create trigger applications_record_status_history
after update of status on public.applications
for each row
when (old.status is distinct from new.status)
execute procedure private.record_application_status_transition();

-- Function to enforce valid status transitions
create or replace function private.validate_application_status_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  valid_transitions record;
begin
  -- Define valid transitions
  -- (from_status, to_status) pairs
  if old.status = 'saved' and new.status not in ('preparing', 'withdrawn') then
    raise exception 'Invalid status transition from saved' using errcode = '23000';
  elsif old.status = 'preparing' and new.status not in ('saved', 'ready', 'withdrawn') then
    raise exception 'Invalid status transition from preparing' using errcode = '23000';
  elsif old.status = 'ready' and new.status not in ('preparing', 'submitted', 'withdrawn') then
    raise exception 'Invalid status transition from ready' using errcode = '23000';
  elsif old.status = 'submitted' and new.status not in ('interview', 'unsuccessful', 'withdrawn') then
    raise exception 'Invalid status transition from submitted' using errcode = '23000';
  elsif old.status = 'interview' and new.status not in ('awarded', 'unsuccessful', 'withdrawn') then
    raise exception 'Invalid status transition from interview' using errcode = '23000';
  elsif old.status = 'awarded' and new.status != 'withdrawn' then
    raise exception 'Invalid status transition from awarded' using errcode = '23000';
  elsif old.status = 'unsuccessful' and new.status != 'withdrawn' then
    raise exception 'Invalid status transition from unsuccessful' using errcode = '23000';
  elsif old.status = 'withdrawn' and new.status != 'saved' then
    raise exception 'Invalid status transition from withdrawn' using errcode = '23000';
  end if;

  return new;
end;
$$;

-- Trigger to validate status transitions before update
create trigger applications_validate_status_transition
before update of status on public.applications
for each row
when (old.status is distinct from new.status)
execute procedure private.validate_application_status_transition();

commit;
