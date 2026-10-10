-- =============================================================================
-- StudyOS 0010 - roles, permissions and server-side authorization
-- =============================================================================
-- Adds the Admin Portal role system on top of the existing profiles table.
--
-- Roles (profiles.role):
--   student        -> default, the existing student experience
--   content_editor -> writes study resources / PYQs, cannot publish
--   moderator      -> reviews reports and content, cannot change roles
--   admin          -> manages content, users, reports, analytics
--   super_admin    -> everything, including granting admin roles
--
-- SECURITY MODEL (important):
--   * The frontend role check is cosmetic only. Every privileged action is
--     enforced by Row Level Security policies that call has_permission(), and
--     by the BEFORE UPDATE trigger below, so a student who edits localStorage
--     or patches their own profile row still cannot grant themselves a role.
--   * profiles.role can only change when the *database session* already holds
--     users.change_role, and only super_admin can grant super_admin.
--   * All helper functions are SECURITY DEFINER so they can read profiles
--     (which stays owner-only for students) without leaking that table.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Role column
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists role text not null default 'student';

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('student', 'content_editor', 'moderator', 'admin', 'super_admin'));

create index if not exists profiles_role_idx on public.profiles (role);

-- ---------------------------------------------------------------------------
-- 2. Permission catalog (role -> permission matrix)
-- ---------------------------------------------------------------------------

create table if not exists public.role_permissions (
  role       text not null
             check (role in ('student', 'content_editor', 'moderator', 'admin', 'super_admin')),
  permission text not null,
  created_at timestamptz not null default now(),
  primary key (role, permission)
);

alter table public.role_permissions enable row level security;

-- Students may read the matrix (it contains no secrets) but never write it.
drop policy if exists "role permissions are publicly readable" on public.role_permissions;
create policy "role permissions are publicly readable"
  on public.role_permissions for select
  to anon, authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- 3. Authorization helpers
-- ---------------------------------------------------------------------------

-- The role of the caller. Falls back to 'student' for anon / unknown users so
-- a missing profile can never read as "no role" (which would fail closed on
-- every public policy while also hiding the mistake of a null role).
create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.role from public.profiles p where p.id = auth.uid()),
    'student'
  )
$$;

revoke all on function public.current_app_role() from public;
grant execute on function public.current_app_role() to anon, authenticated;

-- True when the caller holds at least one of the given roles.
create or replace function public.has_role(variadic p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_app_role() = any (p_roles)
$$;

revoke all on function public.has_role(text[]) from public;
grant execute on function public.has_role(text[]) to anon, authenticated;

-- True when the caller's role is granted the permission. This is the single
-- check every admin policy uses - never `role = 'admin'` in application code.
create or replace function public.has_permission(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.role_permissions rp
    where rp.role = public.current_app_role()
      and rp.permission = p_permission
  )
$$;

revoke all on function public.has_permission(text) from public;
grant execute on function public.has_permission(text) to anon, authenticated;

-- Convenience: any administrative role at all (used by the admin layout gate).
create or replace function public.is_admin_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_app_role() in ('content_editor', 'moderator', 'admin', 'super_admin')
$$;

revoke all on function public.is_admin_user() from public;
grant execute on function public.is_admin_user() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Seed the matrix
-- ---------------------------------------------------------------------------

delete from public.role_permissions;

insert into public.role_permissions (role, permission) values
  -- ---------------------------------------------------------------- content
  ('content_editor', 'content.view'),
  ('content_editor', 'content.create'),
  ('content_editor', 'content.edit'),
  ('content_editor', 'content.upload'),
  ('content_editor', 'content.submit'),
  ('content_editor', 'pyq.create'),
  ('content_editor', 'pyq.edit'),
  ('content_editor', 'pyq.import'),
  ('content_editor', 'academic.view'),

  -- -------------------------------------------------------------- moderator
  ('moderator', 'content.view'),
  ('moderator', 'content.moderate'),
  ('moderator', 'content.archive'),
  ('moderator', 'academic.view'),
  ('moderator', 'academic.manage'),
  ('moderator', 'reports.view'),
  ('moderator', 'reports.resolve'),
  ('moderator', 'analytics.view'),

  -- ----------------------------------------------------------------- admin
  ('admin', 'content.view'),
  ('admin', 'content.create'),
  ('admin', 'content.edit'),
  ('admin', 'content.upload'),
  ('admin', 'content.submit'),
  ('admin', 'content.publish'),
  ('admin', 'content.moderate'),
  ('admin', 'content.archive'),
  ('admin', 'content.delete'),
  ('admin', 'academic.view'),
  ('admin', 'academic.manage'),
  ('admin', 'pyq.create'),
  ('admin', 'pyq.edit'),
  ('admin', 'pyq.import'),
  ('admin', 'pyq.archive'),
  ('admin', 'reports.view'),
  ('admin', 'reports.resolve'),
  ('admin', 'users.view'),
  ('admin', 'users.change_role'),
  ('admin', 'users.suspend'),
  ('admin', 'analytics.view'),
  ('admin', 'audit.view'),
  ('admin', 'settings.manage'),

  -- ----------------------------------------------------------- super_admin
  ('super_admin', 'content.view'),
  ('super_admin', 'content.create'),
  ('super_admin', 'content.edit'),
  ('super_admin', 'content.upload'),
  ('super_admin', 'content.submit'),
  ('super_admin', 'content.publish'),
  ('super_admin', 'content.moderate'),
  ('super_admin', 'content.archive'),
  ('super_admin', 'content.delete'),
  ('super_admin', 'academic.view'),
  ('super_admin', 'academic.manage'),
  ('super_admin', 'pyq.create'),
  ('super_admin', 'pyq.edit'),
  ('super_admin', 'pyq.import'),
  ('super_admin', 'pyq.archive'),
  ('super_admin', 'reports.view'),
  ('super_admin', 'reports.resolve'),
  ('super_admin', 'users.view'),
  ('super_admin', 'users.change_role'),
  ('super_admin', 'users.suspend'),
  ('super_admin', 'analytics.view'),
  ('super_admin', 'audit.view'),
  ('super_admin', 'settings.manage'),
  ('super_admin', 'admin.manage');

-- ---------------------------------------------------------------------------
-- 5. Privilege-escalation guard
-- ---------------------------------------------------------------------------
-- profiles has an owner-only "for all" policy, which would otherwise let a
-- student UPDATE their own row and set role = 'super_admin'. RLS cannot do
-- column-level checks, so this trigger is the enforcement point. It runs as
-- SECURITY DEFINER and re-reads the caller's role from the database, so
-- client-supplied state is never trusted.
-- ---------------------------------------------------------------------------

create or replace function public.guard_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_current text;
begin
  if tg_op = 'INSERT' then
    -- Signups and the auth trigger always land on 'student'. Only a session
    -- that already holds users.change_role may create a privileged profile.
    if new.role is distinct from 'student'
       and not public.has_permission('users.change_role') then
      new.role := 'student';
    end if;
    return new;
  end if;

  if new.role is distinct from old.role then
    v_current := public.current_app_role();

    if not public.has_permission('users.change_role') then
      raise exception 'You are not allowed to change roles.'
        using errcode = '42501';
    end if;

    -- Only a super_admin may mint another super_admin.
    if new.role = 'super_admin' and v_current <> 'super_admin' then
      raise exception 'Only a super admin can grant the super admin role.'
        using errcode = '42501';
    end if;

    -- Nobody may silently demote or promote their own row.
    if v_actor is not null and v_actor = new.id then
      raise exception 'You cannot change your own role.'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.guard_profile_role() from public;
grant execute on function public.guard_profile_role() to postgres, service_role;

drop trigger if exists profiles_guard_role on public.profiles;
create trigger profiles_guard_role
  before insert or update on public.profiles
  for each row execute function public.guard_profile_role();
