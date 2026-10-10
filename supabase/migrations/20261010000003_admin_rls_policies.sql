-- =============================================================================
-- StudyOS 0012 - Admin Portal RLS policies & grants
-- =============================================================================
-- Every admin capability below is gated by has_permission() inside a Row
-- Level Security policy, so the check runs in the database for every query.
-- The React guard (src/admin/guards) only decides what to *render*.
--
-- Policies for the same command are OR-ed by Postgres, so we keep the existing
-- public/student policies and add admin policies alongside them.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0. Profiles: admins may read the directory; students stay owner-only
-- ---------------------------------------------------------------------------

drop policy if exists "admins may read profiles" on public.profiles;
create policy "admins may read profiles"
  on public.profiles for select
  to authenticated
  using (public.has_permission('users.view'));

-- Role/status changes come from the user-management screen only.
drop policy if exists "admins may update profiles" on public.profiles;
create policy "admins may update profiles"
  on public.profiles for update
  to authenticated
  using (public.has_permission('users.change_role'))
  with check (public.has_permission('users.change_role'));

-- ---------------------------------------------------------------------------
-- 1. Academic hierarchy: read for staff, write for academic.manage
-- ---------------------------------------------------------------------------

drop policy if exists "staff may insert boards" on public.boards;
create policy "staff may insert boards"
  on public.boards for insert to authenticated
  with check (public.has_permission('academic.manage'));

drop policy if exists "staff may update boards" on public.boards;
create policy "staff may update boards"
  on public.boards for update to authenticated
  using (public.has_permission('academic.manage'))
  with check (public.has_permission('academic.manage'));

drop policy if exists "staff may delete boards" on public.boards;
create policy "staff may delete boards"
  on public.boards for delete to authenticated
  using (public.has_permission('academic.manage'));

drop policy if exists "staff may insert classes" on public.classes;
create policy "staff may insert classes"
  on public.classes for insert to authenticated
  with check (public.has_permission('academic.manage'));

drop policy if exists "staff may update classes" on public.classes;
create policy "staff may update classes"
  on public.classes for update to authenticated
  using (public.has_permission('academic.manage'))
  with check (public.has_permission('academic.manage'));

drop policy if exists "staff may delete classes" on public.classes;
create policy "staff may delete classes"
  on public.classes for delete to authenticated
  using (public.has_permission('academic.manage'));

drop policy if exists "staff may insert streams" on public.streams;
create policy "staff may insert streams"
  on public.streams for insert to authenticated
  with check (public.has_permission('academic.manage'));

drop policy if exists "staff may update streams" on public.streams;
create policy "staff may update streams"
  on public.streams for update to authenticated
  using (public.has_permission('academic.manage'))
  with check (public.has_permission('academic.manage'));

drop policy if exists "staff may delete streams" on public.streams;
create policy "staff may delete streams"
  on public.streams for delete to authenticated
  using (public.has_permission('academic.manage'));

drop policy if exists "staff may insert subjects" on public.subjects;
create policy "staff may insert subjects"
  on public.subjects for insert to authenticated
  with check (public.has_permission('academic.manage'));

drop policy if exists "staff may update subjects" on public.subjects;
create policy "staff may update subjects"
  on public.subjects for update to authenticated
  using (public.has_permission('academic.manage'))
  with check (public.has_permission('academic.manage'));

drop policy if exists "staff may delete subjects" on public.subjects;
create policy "staff may delete subjects"
  on public.subjects for delete to authenticated
  using (public.has_permission('academic.manage'));

drop policy if exists "staff may insert chapters" on public.chapters;
create policy "staff may insert chapters"
  on public.chapters for insert to authenticated
  with check (public.has_permission('academic.manage'));

drop policy if exists "staff may update chapters" on public.chapters;
create policy "staff may update chapters"
  on public.chapters for update to authenticated
  using (public.has_permission('academic.manage'))
  with check (public.has_permission('academic.manage'));

drop policy if exists "staff may delete chapters" on public.chapters;
create policy "staff may delete chapters"
  on public.chapters for delete to authenticated
  using (public.has_permission('academic.manage'));

-- Staff must be able to see archived rows too (students cannot).
drop policy if exists "staff may read archived hierarchy" on public.boards;
create policy "staff may read archived hierarchy"
  on public.boards for select to authenticated
  using (public.has_permission('academic.view'));

drop policy if exists "staff may read archived classes" on public.classes;
create policy "staff may read archived classes"
  on public.classes for select to authenticated
  using (public.has_permission('academic.view'));

drop policy if exists "staff may read archived streams" on public.streams;
create policy "staff may read archived streams"
  on public.streams for select to authenticated
  using (public.has_permission('academic.view'));

drop policy if exists "staff may read archived subjects" on public.subjects;
create policy "staff may read archived subjects"
  on public.subjects for select to authenticated
  using (public.has_permission('academic.view'));

drop policy if exists "staff may read archived chapters" on public.chapters;
create policy "staff may read archived chapters"
  on public.chapters for select to authenticated
  using (public.has_permission('academic.view'));

-- ---------------------------------------------------------------------------
-- 2. Resources: editors/admins see and write every status, students stay on
--    the existing "is_published only" policy.
-- ---------------------------------------------------------------------------

drop policy if exists "staff may read all resources" on public.resources;
create policy "staff may read all resources"
  on public.resources for select to authenticated
  using (public.has_permission('content.view'));

drop policy if exists "editors may insert resources" on public.resources;
create policy "editors may insert resources"
  on public.resources for insert to authenticated
  with check (public.has_permission('content.create'));

-- update is allowed for anyone with content.edit; the status *transition* is
-- constrained by guard_resource_status() below (a student/editor cannot
-- jump to 'published' without content.publish).
drop policy if exists "editors may update resources" on public.resources;
create policy "editors may update resources"
  on public.resources for update to authenticated
  using (public.has_permission('content.edit'))
  with check (public.has_permission('content.edit'));

drop policy if exists "admins may delete resources" on public.resources;
create policy "admins may delete resources"
  on public.resources for delete to authenticated
  using (public.has_permission('content.delete'));

-- Staff can read the version history they are allowed to audit.
drop policy if exists "staff may read resource versions" on public.resource_versions;
create policy "staff may read resource versions"
  on public.resource_versions for select to authenticated
  using (public.has_permission('content.view'));

drop policy if exists "staff may write resource versions" on public.resource_versions;
create policy "staff may write resource versions"
  on public.resource_versions for insert to authenticated
  with check (public.has_permission('content.view'));

-- ---------------------------------------------------------------------------
-- 3. Publishing guard: only content.publish may reach 'published'
-- ---------------------------------------------------------------------------

create or replace function public.guard_resource_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'published' and old.status is distinct from 'published' then
    if not public.has_permission('content.publish') then
      raise exception 'You do not have permission to publish content.'
        using errcode = '42501';
    end if;
  end if;

  if new.status = 'pending_review' and old.status = 'published'
     and not public.has_permission('content.moderate') then
    raise exception 'Only a moderator or admin can unpublish published content.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function public.guard_resource_status() from public;
grant execute on function public.guard_resource_status() to postgres, service_role;

drop trigger if exists resources_guard_status on public.resources;
create trigger resources_guard_status
  before update on public.resources
  for each row execute function public.guard_resource_status();

-- ---------------------------------------------------------------------------
-- 4. PYQ archive: staff write, everyone still reads published questions
-- ---------------------------------------------------------------------------

drop policy if exists "editors may insert pyq questions" on public.pyq_questions;
create policy "editors may insert pyq questions"
  on public.pyq_questions for insert to authenticated
  with check (public.has_permission('pyq.create'));

drop policy if exists "editors may update pyq questions" on public.pyq_questions;
create policy "editors may update pyq questions"
  on public.pyq_questions for update to authenticated
  using (public.has_permission('pyq.edit'))
  with check (public.has_permission('pyq.edit'));

drop policy if exists "admins may delete pyq questions" on public.pyq_questions;
create policy "admins may delete pyq questions"
  on public.pyq_questions for delete to authenticated
  using (public.has_permission('pyq.archive'));

-- ---------------------------------------------------------------------------
-- 5. Reports: authenticated users file them, staff read, moderators resolve
-- ---------------------------------------------------------------------------

drop policy if exists "students may file reports" on public.reports;
create policy "students may file reports"
  on public.reports for insert to authenticated
  with check (coalesce(reporter_id, auth.uid()) = auth.uid());

drop policy if exists "staff may read reports" on public.reports;
create policy "staff may read reports"
  on public.reports for select to authenticated
  using (public.has_permission('reports.view'));

drop policy if exists "staff may update reports" on public.reports;
create policy "staff may update reports"
  on public.reports for update to authenticated
  using (public.has_permission('reports.resolve'))
  with check (public.has_permission('reports.resolve'));

drop policy if exists "admins may delete reports" on public.reports;
create policy "admins may delete reports"
  on public.reports for delete to authenticated
  using (public.has_permission('reports.resolve') and status in ('resolved', 'dismissed'));

-- ---------------------------------------------------------------------------
-- 6. Audit log: write via log_admin_action(), read with audit.view
-- ---------------------------------------------------------------------------

drop policy if exists "admins may read audit logs" on public.audit_logs;
create policy "admins may read audit logs"
  on public.audit_logs for select to authenticated
  using (public.has_permission('audit.view'));

-- No INSERT/UPDATE/DELETE policy exists, so direct writes are denied for
-- everyone; log_admin_action() (SECURITY DEFINER) is the only writer.

-- ---------------------------------------------------------------------------
-- 7. Platform settings
-- ---------------------------------------------------------------------------

drop policy if exists "staff may read platform settings" on public.platform_settings;
create policy "staff may read platform settings"
  on public.platform_settings for select to authenticated
  using (public.is_admin_user());

drop policy if exists "admins may update platform settings" on public.platform_settings;
create policy "admins may update platform settings"
  on public.platform_settings for update to authenticated
  using (public.has_permission('settings.manage'))
  with check (public.has_permission('settings.manage'));

-- ---------------------------------------------------------------------------
-- 8. Grants (PostgREST only routes tables the role can reach)
-- ---------------------------------------------------------------------------

grant select on public.profiles, public.role_permissions, public.reports,
  public.audit_logs, public.platform_settings, public.resource_versions
to authenticated;

grant insert, update on public.profiles, public.reports, public.platform_settings
to authenticated;

grant select, insert, update, delete on
  public.boards, public.classes, public.streams, public.subjects, public.chapters,
  public.resources, public.pyq_questions
to authenticated;

-- ---------------------------------------------------------------------------
-- 9. Storage: admin uploads live under resources/, staff-only writes
-- ---------------------------------------------------------------------------

drop policy if exists "authenticated users may upload resources" on storage.objects;
create policy "authenticated users may upload resources"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'resources'
    and public.has_permission('content.upload')
  );

drop policy if exists "authenticated users may update resources" on storage.objects;
create policy "authenticated users may update resources"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'resources'
    and public.has_permission('content.edit')
  );

drop policy if exists "authenticated users may delete resources" on storage.objects;
create policy "authenticated users may delete resources"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'resources'
    and public.has_permission('content.delete')
  );
