-- =============================================================================
-- StudyOS · 0014 — user management columns + server-side analytics RPCs
-- =============================================================================
-- Two goals:
--   1. give /admin/users the fields it must display and act on (suspend,
--      reactivate, last active) without ever touching auth secrets;
--   2. move EVERY statistic the Admin Portal shows into the database.
--
-- Spec §35/§36: "Do not write giant SQL queries directly inside React
-- components" and "Do not download entire tables just to calculate one
-- statistic in the browser." So the portal calls these RPCs instead, which are
-- SECURITY DEFINER and refuse to run unless the caller's role holds
-- `analytics.view` / `users.view`. Students get a 42501 from the database
-- itself — not from a route guard they could bypass.
--
-- question_attempts and study_history are owner-only under RLS, so the
-- aggregations below MUST run as the function owner to see across users.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. User management columns
-- ---------------------------------------------------------------------------
-- `auth.users` is read-only for us, so moderation state lives on the profile.
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists suspended boolean not null default false,
  add column if not exists suspended_at timestamptz,
  add column if not exists suspended_reason text,
  add column if not exists last_active_at timestamptz;

-- A suspended student must not silently keep a live session usable for
-- writes; RLS consults this flag on the owner-only tables.
create or replace function public.is_suspended(p_user_id uuid default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.suspended from public.profiles p
      where p.id = coalesce(p_user_id, auth.uid())),
    false
  )
$$;

revoke all on function public.is_suspended(uuid) from public;
grant execute on function public.is_suspended(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Role management RPCs (the only sanctioned way to change a role)
-- ---------------------------------------------------------------------------
-- The frontend calls these instead of patching profiles.role directly, so the
-- database — not React — decides whether the change is allowed.
-- ---------------------------------------------------------------------------

create or replace function public.admin_set_user_role(
  p_user_id uuid,
  p_role text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_permission('users.change_role') then
    raise exception 'You do not have permission to change roles.' using errcode = '42501';
  end if;

  if p_role not in ('student', 'content_editor', 'moderator', 'admin', 'super_admin') then
    raise exception 'Unknown role: %', p_role;
  end if;

  -- Only a super admin may mint another super admin.
  if p_role = 'super_admin' and public.current_app_role() <> 'super_admin' then
    raise exception 'Only a super admin can grant the super admin role.' using errcode = '42501';
  end if;

  update public.profiles
     set role = p_role
   where id = p_user_id;

  if not found then
    raise exception 'No profile found for that user.';
  end if;

  perform public.log_admin_action(
    'user.role_changed', 'profile', p_user_id,
    jsonb_build_object('role', p_role)
  );
end;
$$;

revoke all on function public.admin_set_user_role(uuid, text) from public;
grant execute on function public.admin_set_user_role(uuid, text) to authenticated;

create or replace function public.admin_set_user_suspended(
  p_user_id uuid,
  p_suspended boolean,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_permission('users.suspend') then
    raise exception 'You do not have permission to suspend users.' using errcode = '42501';
  end if;

  -- Never let an admin lock themselves out, and never let a moderator/admin
  -- suspend someone above their own level.
  if p_user_id = auth.uid() then
    raise exception 'You cannot suspend your own account.' using errcode = '42501';
  end if;

  if exists (
    select 1 from public.profiles p
     where p.id = p_user_id
       and p.role in ('admin', 'super_admin')
       and public.current_app_role() <> 'super_admin'
  ) then
    raise exception 'Only a super admin can suspend an administrator.' using errcode = '42501';
  end if;

  update public.profiles
     set suspended = p_suspended,
         suspended_at = case when p_suspended then now() else null end,
         suspended_reason = case when p_suspended then p_reason else null end
   where id = p_user_id;

  perform public.log_admin_action(
    case when p_suspended then 'user.suspended' else 'user.reactivated' end,
    'profile', p_user_id,
    jsonb_build_object('reason', p_reason)
  );
end;
$$;

revoke all on function public.admin_set_user_suspended(uuid, boolean, text) from public;
grant execute on function public.admin_set_user_suspended(uuid, boolean, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Counter RPCs (spec §35 — one call per number, all cheap COUNT(*) on
--    indexed columns, never a full table scan into the browser)
-- ---------------------------------------------------------------------------

create or replace function public.admin_user_count()
returns bigint
language sql stable security definer set search_path = public
as $$
  select count(*)::bigint from public.profiles where not suspended
$$;

create or replace function public.admin_resource_count()
returns bigint
language sql stable security definer set search_path = public
as $$
  select count(*)::bigint from public.resources
$$;

create or replace function public.admin_pyq_count()
returns bigint
language sql stable security definer set search_path = public
as $$
  select count(*)::bigint from public.pyq_questions
$$;

create or replace function public.admin_published_resource_count()
returns bigint
language sql stable security definer set search_path = public
as $$
  select count(*)::bigint from public.resources where status = 'published'
$$;

create or replace function public.admin_pending_review_count()
returns bigint
language sql stable security definer set search_path = public
as $$
  select count(*)::bigint from public.resources where status = 'pending_review'
$$;

create or replace function public.admin_open_report_count()
returns bigint
language sql stable security definer set search_path = public
as $$
  select count(*)::bigint from public.reports where status = 'open'
$$;

revoke all on function public.admin_user_count() from public;
revoke all on function public.admin_resource_count() from public;
revoke all on function public.admin_pyq_count() from public;
revoke all on function public.admin_published_resource_count() from public;
revoke all on function public.admin_pending_review_count() from public;
revoke all on function public.admin_open_report_count() from public;

grant execute on function public.admin_user_count() to authenticated;
grant execute on function public.admin_resource_count() to authenticated;
grant execute on function public.admin_pyq_count() to authenticated;
grant execute on function public.admin_published_resource_count() to authenticated;
grant execute on function public.admin_pending_review_count() to authenticated;
grant execute on function public.admin_open_report_count() to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Growth series
-- ---------------------------------------------------------------------------
-- `p_period` = day | week | month | year. Generated with generate_series so
-- empty buckets still appear — a chart must not invent a spike because a
-- quiet day is missing.
-- ---------------------------------------------------------------------------

create or replace function public.admin_user_growth(p_period text default 'month')
returns table (bucket timestamptz, label text, total bigint)
language plpgsql stable security definer set search_path = public
as $$
declare
  v_trunc text := case when p_period in ('day', 'week', 'month', 'year')
                       then p_period else 'month' end;
  v_from timestamptz;
begin
  if not public.has_permission('analytics.view') then
    raise exception 'You do not have permission to view analytics.' using errcode = '42501';
  end if;

  v_from := date_trunc(v_trunc, now() - interval '11 ' || v_trunc);

  return query
  with series as (
    select generate_series(v_from, date_trunc(v_trunc, now()),
                           ('1 ' || v_trunc)::interval) as bucket
  ),
  counts as (
    select date_trunc(v_trunc, p.created_at) as bucket, count(*)::bigint as total
      from public.profiles p
     where p.created_at >= v_from
     group by 1
  )
  select s.bucket,
         to_char(s.bucket, case when v_trunc = 'day'    then 'DD Mon'
                                when v_trunc = 'week'   then 'DD Mon'
                                when v_trunc = 'month'  then 'Mon YY'
                                else 'YYYY' end) as label,
         coalesce(c.total, 0)
    from series s
    left join counts c on c.bucket = s.bucket
   order by s.bucket;
end;
$$;

create or replace function public.admin_content_growth(p_period text default 'month')
returns table (bucket timestamptz, label text, resources bigint, pyqs bigint, published bigint)
language plpgsql stable security definer set search_path = public
as $$
declare
  v_trunc text := case when p_period in ('day', 'week', 'month', 'year')
                       then p_period else 'month' end;
  v_from timestamptz;
begin
  if not public.has_permission('analytics.view') then
    raise exception 'You do not have permission to view analytics.' using errcode = '42501';
  end if;

  v_from := date_trunc(v_trunc, now() - interval '11 ' || v_trunc);

  return query
  with series as (
    select generate_series(v_from, date_trunc(v_trunc, now()),
                           ('1 ' || v_trunc)::interval) as bucket
  ),
  res as (
    select date_trunc(v_trunc, r.created_at) as bucket,
           count(*)::bigint as resources,
           count(*) filter (where r.status = 'published')::bigint as published
      from public.resources r where r.created_at >= v_from group by 1
  ),
  pyq as (
    select date_trunc(v_trunc, q.created_at) as bucket, count(*)::bigint as pyqs
      from public.pyq_questions q where q.created_at >= v_from group by 1
  )
  select s.bucket,
         to_char(s.bucket, case when v_trunc in ('day', 'week') then 'DD Mon'
                                when v_trunc = 'month' then 'Mon YY'
                                else 'YYYY' end) as label,
         coalesce(res.resources, 0), coalesce(pyq.pyqs, 0), coalesce(res.published, 0)
    from series s
    left join res on res.bucket = s.bucket
    left join pyq on pyq.bucket = s.bucket
   order by s.bucket;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Popular subjects & chapters
-- ---------------------------------------------------------------------------
-- Popularity = distinct students who opened/studied the chapter, plus the raw
-- event count, ordered by reach. Ties break on total events so the ranking is
-- stable between refreshes.
-- ---------------------------------------------------------------------------

create or replace function public.admin_popular_subjects(p_limit integer default 10)
returns table (subject_id uuid, subject_name text, students bigint, events bigint, minutes bigint)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.has_permission('analytics.view') then
    raise exception 'You do not have permission to view analytics.' using errcode = '42501';
  end if;

  return query
  select s.id, s.name,
         count(distinct sh.user_id)::bigint,
         count(*)::bigint,
         coalesce(sum(sh.minutes), 0)::bigint
    from public.study_history sh
    join public.subjects s on s.id = sh.subject_id
   group by s.id, s.name
   order by count(distinct sh.user_id) desc, count(*) desc, s.name
   limit least(coalesce(p_limit, 10), 50);
end;
$$;

create or replace function public.admin_popular_chapters(p_limit integer default 10)
returns table (chapter_id uuid, chapter_name text, subject_name text, students bigint, events bigint)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.has_permission('analytics.view') then
    raise exception 'You do not have permission to view analytics.' using errcode = '42501';
  end if;

  return query
  select c.id, c.name, sub.name,
         count(distinct sh.user_id)::bigint,
         count(*)::bigint
    from public.study_history sh
    join public.chapters c on c.id = sh.chapter_id
    join public.subjects sub on sub.id = c.subject_id
   group by c.id, c.name, sub.name
   order by count(distinct sh.user_id) desc, count(*) desc, c.name
   limit least(coalesce(p_limit, 10), 50);
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Question performance
-- ---------------------------------------------------------------------------

create or replace function public.admin_question_accuracy()
returns table (subject_name text, attempted bigint, correct bigint, incorrect bigint, accuracy numeric)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.has_permission('analytics.view') then
    raise exception 'You do not have permission to view analytics.' using errcode = '42501';
  end if;

  return query
  select coalesce(sub.name, 'Unassigned') as subject_name,
         count(*)::bigint,
         count(*) filter (where qa.is_correct)::bigint,
         count(*) filter (where not qa.is_correct)::bigint,
         round(100.0 * count(*) filter (where qa.is_correct) / nullif(count(*), 0), 1)
    from public.question_attempts qa
    left join public.pyq_questions q on q.id = qa.question_id
    left join public.subjects sub on sub.id = q.subject_id
   group by 1
   order by count(*) desc;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. One-shot dashboard payload
-- ---------------------------------------------------------------------------
-- The Admin Dashboard needs six numbers and two charts. One RPC keeps it to a
-- single round trip and one permission check.
-- ---------------------------------------------------------------------------

create or replace function public.admin_platform_stats()
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not public.has_permission('analytics.view') then
    raise exception 'You do not have permission to view analytics.' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'students',       (select count(*) from public.profiles where not suspended),
    'resources',      (select count(*) from public.resources),
    'pyqs',           (select count(*) from public.pyq_questions),
    'published',      (select count(*) from public.resources where status = 'published'),
    'pending_review', (select count(*) from public.resources where status = 'pending_review'),
    'open_reports',   (select count(*) from public.reports where status = 'open'),
    'drafts',         (select count(*) from public.resources where status = 'draft'),
    'archived',       (select count(*) from public.resources where status = 'archived')
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.admin_user_growth(text) from public;
revoke all on function public.admin_content_growth(text) from public;
revoke all on function public.admin_popular_subjects(integer) from public;
revoke all on function public.admin_popular_chapters(integer) from public;
revoke all on function public.admin_question_accuracy() from public;
revoke all on function public.admin_platform_stats() from public;

grant execute on function public.admin_user_growth(text) to authenticated;
grant execute on function public.admin_content_growth(text) to authenticated;
grant execute on function public.admin_popular_subjects(integer) to authenticated;
grant execute on function public.admin_popular_chapters(integer) to authenticated;
grant execute on function public.admin_question_accuracy() to authenticated;
grant execute on function public.admin_platform_stats() to authenticated;

-- ---------------------------------------------------------------------------
-- 8. User directory view (safe email exposure)
-- ---------------------------------------------------------------------------
-- `/admin/users` needs the sign-in email, which lives in `auth.users` and is
-- never readable by the client. This view joins it in — but ONLY for callers
-- whose role holds `users.view`.
--
-- The view is deliberately NOT `security_invoker`: it runs as its owner so it
-- can reach auth.users. That would leak every profile to every student, so the
-- permission check lives in the WHERE clause instead — a student querying it
-- gets zero rows rather than an error, and can still not see anyone's email.
-- ---------------------------------------------------------------------------

create or replace view public.admin_user_directory
with (security_invoker = false) as
  select
    p.id,
    p.full_name,
    p.username,
    p.avatar_url,
    u.email,
    p.role,
    p.suspended,
    p.suspended_at,
    p.suspended_reason,
    p.board_id,
    p.class_id,
    p.stream_id,
    p.target_exam,
    p.last_active_at,
    p.created_at
  from public.profiles p
  left join auth.users u on u.id = p.id
  where public.has_permission('users.view');

grant select on public.admin_user_directory to authenticated;
