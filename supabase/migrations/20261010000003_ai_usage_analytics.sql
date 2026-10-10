-- =============================================================================
-- StudyOS · 0012 — AI usage metering, rate limiting & product analytics
-- =============================================================================
--   ai_usage  -> one row per (user, day, feature): request counts + tokens.
--                The edge functions read it to enforce server-side daily
--                limits and write to it after every call.
--   ai_events -> low-cardinality telemetry for the Admin → AI dashboard:
--                feature, subject/chapter, latency, retrieval outcome, status.
--
-- Privacy: no prompts, no answers, no free text are recorded — only the
-- dimensions needed to answer "what is being used, is it fast, is retrieval
-- working". Every row is owner-only; admins see aggregates only.
-- =============================================================================

create table public.ai_usage (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  day          date not null default current_date,
  feature      text not null,
  requests     integer not null default 0 check (requests >= 0),
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint ai_usage_user_day_feature_key unique (user_id, day, feature)
);

create table public.ai_events (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid references auth.users (id) on delete set null,
  conversation_id    uuid references public.ai_conversations (id) on delete set null,
  feature            text not null,
  subject_id         uuid references public.subjects (id) on delete set null,
  chapter_id         uuid references public.chapters (id) on delete set null,
  question_type      text,
  response_latency_ms integer check (response_latency_ms >= 0),
  retrieval_used     boolean not null default false,
  source_count       integer not null default 0 check (source_count >= 0),
  no_source          boolean not null default false,
  provider           text,
  model              text,
  status             text not null default 'ok'
                     check (status in ('ok', 'error', 'rate_limited', 'blocked', 'no_provider')),
  error_code         text,
  created_at         timestamptz not null default now()
);

alter table public.ai_usage enable row level security;
alter table public.ai_events enable row level security;

create trigger ai_usage_set_updated_at
  before update on public.ai_usage
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: owners read their own metering/telemetry, admins read everything
-- (aggregate dashboards only — never message content).
-- ---------------------------------------------------------------------------
drop policy if exists "ai usage is owner-or-admin" on public.ai_usage;
create policy "ai usage is owner-or-admin"
  on public.ai_usage for select to authenticated
  using (user_id = auth.uid() or public.has_permission('analytics.view'));

drop policy if exists "ai usage is owner-writable" on public.ai_usage;
create policy "ai usage is owner-writable"
  on public.ai_usage for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "ai usage updates are owner-only" on public.ai_usage;
create policy "ai usage updates are owner-only"
  on public.ai_usage for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "ai events are owner-or-admin" on public.ai_events;
create policy "ai events are owner-or-admin"
  on public.ai_events for select to authenticated
  using (user_id = auth.uid() or public.has_permission('analytics.view'));

drop policy if exists "ai events are insertable by owner" on public.ai_events;
create policy "ai events are insertable by owner"
  on public.ai_events for insert to authenticated
  with check (user_id = auth.uid());

grant select, insert, update on public.ai_usage to authenticated;
grant select, insert on public.ai_events to authenticated;

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
create index if not exists ai_usage_day_idx on public.ai_usage (day desc);
create index if not exists ai_usage_user_day_idx on public.ai_usage (user_id, day desc);
create index if not exists ai_events_created_idx on public.ai_events (created_at desc);
create index if not exists ai_events_feature_idx on public.ai_events (feature, created_at desc);
create index if not exists ai_events_user_idx on public.ai_events (user_id, created_at desc);
create index if not exists ai_events_status_idx on public.ai_events (status, created_at desc);

-- ---------------------------------------------------------------------------
-- ai_usage_today() — the signed-in student's own quota usage (for the UI).
-- SECURITY INVOKER: RLS narrows it to auth.uid() anyway.
-- ---------------------------------------------------------------------------
create or replace function public.ai_usage_today()
returns table (
  feature       text,
  requests      integer,
  input_tokens  integer,
  output_tokens integer
)
language sql
stable
set search_path = public
as $$
  select u.feature, u.requests, u.input_tokens, u.output_tokens
    from public.ai_usage u
   where u.user_id = auth.uid()
     and u.day = current_date
   order by u.requests desc;
$$;

grant execute on function public.ai_usage_today() to authenticated;
