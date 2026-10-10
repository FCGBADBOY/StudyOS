-- =============================================================================
-- StudyOS 0011 - content workflow, versioning, reports & audit trail
-- =============================================================================
-- Adds the publishing lifecycle the Admin Portal drives:
--
--   draft -> pending_review -> approved -> published -> archived
--          \-> rejected
--
-- Backwards compatible by construction:
--   * `is_published` still exists and is derived from `status`, because the
--     student app reads it directly (src/services/resource.service.ts,
--     academic.service.ts) and must keep working untouched.
--   * existing rows are mapped once: is_published = true  -> 'published'
--                                    is_published = false -> 'draft'
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Resource workflow columns
-- ---------------------------------------------------------------------------

alter table public.resources
  add column if not exists status text not null default 'published',
  add column if not exists created_by uuid references auth.users (id) on delete set null,
  add column if not exists updated_by uuid references auth.users (id) on delete set null,
  add column if not exists reviewed_by uuid references auth.users (id) on delete set null,
  add column if not exists published_at timestamptz,
  add column if not exists review_note text,
  add column if not exists tags text[] not null default '{}';

alter table public.resources
  drop constraint if exists resources_status_check;

alter table public.resources
  add constraint resources_status_check
  check (status in (
    'draft', 'pending_review', 'approved', 'published', 'rejected', 'archived'
  ));

-- One-time backfill so every pre-existing row has a coherent status.
update public.resources
   set status = case when is_published then 'published' else 'draft' end,
       published_at = case when is_published then created_at else null end
 where status = 'published' and not is_published
    or (is_published and published_at is null);

create index if not exists resources_status_idx on public.resources (status);
create index if not exists resources_created_by_idx on public.resources (created_by);
create index if not exists resources_tags_idx on public.resources using gin (tags);

-- ---------------------------------------------------------------------------
-- 2. status <-> is_published sync
-- ---------------------------------------------------------------------------
-- Students only ever see published resources (existing RLS policy), so
-- publishing/archiving from the admin UI flips that flag automatically.
-- ---------------------------------------------------------------------------

create or replace function public.sync_resource_status()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.is_published := (new.status = 'published');

  if new.status = 'published' and (old.status is distinct from 'published') then
    new.published_at := coalesce(new.published_at, now());
  end if;

  if new.status is distinct from old.status then
    new.reviewed_at := case when new.status in ('published', 'rejected', 'archived')
                            then now() else new.reviewed_at end;
  end if;

  return new;
end;
$$;

-- reviewed_at is written above; add it alongside the other audit columns.
alter table public.resources
  add column if not exists reviewed_at timestamptz;

drop trigger if exists resources_sync_status on public.resources;
create trigger resources_sync_status
  before insert or update on public.resources
  for each row execute function public.sync_resource_status();

-- ---------------------------------------------------------------------------
-- 3. Academic hierarchy soft-archive
-- ---------------------------------------------------------------------------
-- Admins archive instead of deleting rows that other tables reference.
-- ---------------------------------------------------------------------------

alter table public.boards     add column if not exists is_archived boolean not null default false;
alter table public.classes    add column if not exists is_archived boolean not null default false;
alter table public.streams    add column if not exists is_archived boolean not null default false;
alter table public.subjects   add column if not exists is_archived boolean not null default false;
alter table public.chapters   add column if not exists is_archived boolean not null default false;

create index if not exists boards_archived_idx   on public.boards   (is_archived);
create index if not exists classes_archived_idx  on public.classes  (is_archived);
create index if not exists subjects_archived_idx on public.subjects (is_archived);
create index if not exists chapters_archived_idx on public.chapters (is_archived);

-- Students no longer see archived hierarchy rows; seed data stays visible
-- because is_archived defaults to false.
drop policy if exists "boards are publicly readable" on public.boards;
create policy "boards are publicly readable"
  on public.boards for select to anon, authenticated
  using (not is_archived);

drop policy if exists "classes are publicly readable" on public.classes;
create policy "classes are publicly readable"
  on public.classes for select to anon, authenticated
  using (not is_archived);

drop policy if exists "streams are publicly readable" on public.streams;
create policy "streams are publicly readable"
  on public.streams for select to anon, authenticated
  using (not is_archived);

drop policy if exists "subjects are publicly readable" on public.subjects;
create policy "subjects are publicly readable"
  on public.subjects for select to anon, authenticated
  using (not is_archived);

drop policy if exists "chapters are publicly readable" on public.chapters;
create policy "chapters are publicly readable"
  on public.chapters for select to anon, authenticated
  using (not is_archived);

-- ---------------------------------------------------------------------------
-- 4. Resource version history (spec: never silently overwrite published work)
-- ---------------------------------------------------------------------------

create table if not exists public.resource_versions (
  id             uuid primary key default gen_random_uuid(),
  resource_id    uuid not null references public.resources (id) on delete cascade,
  version        integer not null,
  snapshot       jsonb not null,
  change_summary text,
  changed_by     uuid references auth.users (id) on delete set null,
  created_at     timestamptz not null default now(),
  constraint resource_versions_resource_version_key unique (resource_id, version)
);

alter table public.resource_versions enable row level security;

create index if not exists resource_versions_resource_idx
  on public.resource_versions (resource_id, version desc);

-- Snapshot a row whenever a published resource is about to change.
create or replace function public.snapshot_resource_version()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next integer;
begin
  if tg_op = 'INSERT' then
    insert into public.resource_versions (resource_id, version, snapshot, change_summary, changed_by)
    values (new.id, 1, to_jsonb(new) - 'id', 'Created', auth.uid());
    return new;
  end if;

  -- Only versions that matter: a change to content that is (or was) live.
  if old.status in ('published', 'approved')
     and (old.title is distinct from new.title
       or old.description is distinct from new.description
       or old.resource_type is distinct from new.resource_type
       or old.file_path is distinct from new.file_path
       or old.thumbnail_url is distinct from new.thumbnail_url
       or old.tags is distinct from new.tags
       or old.status is distinct from new.status) then

    select coalesce(max(version), 0) + 1
      into v_next
      from public.resource_versions
     where resource_id = new.id;

    insert into public.resource_versions (resource_id, version, snapshot, change_summary, changed_by)
    values (new.id, v_next, to_jsonb(new) - 'id',
            'Status: ' || old.status || ' -> ' || new.status, auth.uid());
  end if;

  return new;
end;
$$;

revoke all on function public.snapshot_resource_version() from public;
grant execute on function public.snapshot_resource_version() to postgres, service_role;

drop trigger if exists resources_snapshot_version on public.resources;
create trigger resources_snapshot_version
  after insert or update on public.resources
  for each row execute function public.snapshot_resource_version();

-- ---------------------------------------------------------------------------
-- 5. Reports (student -> moderation queue)
-- ---------------------------------------------------------------------------

create table if not exists public.reports (
  id              uuid primary key default gen_random_uuid(),
  reporter_id     uuid references auth.users (id) on delete set null,
  report_type     text not null
                  check (report_type in (
                    'incorrect_question', 'wrong_answer', 'broken_resource',
                    'inappropriate_content', 'duplicate_content', 'other'
                  )),
  item_type       text not null
                  check (item_type in ('resource', 'pyq_question', 'chapter', 'subject', 'user')),
  item_id         uuid,
  item_title      text not null,
  description     text,
  status          text not null default 'open'
                  check (status in ('open', 'investigating', 'resolved', 'dismissed')),
  resolution_note text,
  resolved_by     uuid references auth.users (id) on delete set null,
  resolved_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.reports enable row level security;

create index if not exists reports_status_idx   on public.reports (status, created_at desc);
create index if not exists reports_type_idx     on public.reports (report_type);
create index if not exists reports_reporter_idx on public.reports (reporter_id);

drop trigger if exists reports_set_updated_at on public.reports;
create trigger reports_set_updated_at
  before update on public.reports
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 6. Audit log (spec: actor, action, entity, metadata, created_at)
-- ---------------------------------------------------------------------------

create table if not exists public.audit_logs (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references auth.users (id) on delete set null,
  action      text not null,
  entity_type text not null,
  entity_id   uuid,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

alter table public.audit_logs enable row level security;

create index if not exists audit_logs_created_idx on public.audit_logs (created_at desc);
create index if not exists audit_logs_actor_idx   on public.audit_logs (actor_id, created_at desc);
create index if not exists audit_logs_entity_idx  on public.audit_logs (entity_type, entity_id);

-- Single entry point so every admin action lands in the log with the real
-- session user. SECURITY DEFINER because callers must not need INSERT rights
-- on audit_logs (which would let them forge entries for other actors).
create or replace function public.log_admin_action(
  p_action text,
  p_entity_type text,
  p_entity_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.has_permission('audit.view') and not public.is_admin_user() then
    raise exception 'Not authorized to write audit entries.' using errcode = '42501';
  end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), p_action, p_entity_type, p_entity_id,
          -- never let secrets reach the log
          case when p_metadata ? 'password' or p_metadata ? 'token'
                    or p_metadata ? 'service_key'
               then '{}'::jsonb else coalesce(p_metadata, '{}'::jsonb) end)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.log_admin_action(text, text, uuid, jsonb) from public;
grant execute on function public.log_admin_action(text, text, uuid, jsonb)
  to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7. Platform settings (only settings that are actually backed by a row)
-- ---------------------------------------------------------------------------

create table if not exists public.platform_settings (
  key        text primary key,
  value      jsonb not null,
  label      text not null,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.platform_settings enable row level security;

drop trigger if exists platform_settings_set_updated_at on public.platform_settings;
create trigger platform_settings_set_updated_at
  before update on public.platform_settings
  for each row execute function public.set_updated_at();

insert into public.platform_settings (key, value, label) values
  ('upload',    '{"max_file_mb": 50, "allowed_types": ["pdf", "png", "jpg", "jpeg", "webp"]}', 'Upload settings'),
  ('content',   '{"default_status": "draft", "require_review": true}',                        'Content defaults'),
  ('platform',  '{"student_signups": true, "report_email": ""}',                              'Platform settings')
on conflict (key) do nothing;
