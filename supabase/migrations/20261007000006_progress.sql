-- =============================================================================
-- StudyOS · 0006 — progress: study history, question attempts, chapter & resource progress
-- =============================================================================
-- Everything the dashboard / progress report / profile statistics show is
-- derived from these owner-only rows (src/services/progress.service.ts):
--   study_history         -> minutes studied + Recent Activity feed
--   question_attempts     -> questions solved + accuracy
--   user_chapter_progress -> syllabus completion (upserted on (user_id, chapter_id))
--   user_resource_progress-> "opened" bookkeeping (upserted on (user_id, resource_id))
-- =============================================================================

create table public.study_history (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  event_type  text not null
              check (event_type in (
                'resource_opened', 'chapter_studied', 'question_attempted', 'session_completed'
              )),
  subject_id  uuid references public.subjects (id) on delete set null,
  chapter_id  uuid references public.chapters (id) on delete set null,
  resource_id uuid references public.resources (id) on delete set null,
  question_id uuid references public.pyq_questions (id) on delete set null,
  title       text not null,
  minutes     integer not null default 0,
  questions   integer not null default 0,
  occurred_at timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

create table public.question_attempts (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  question_id       uuid not null references public.pyq_questions (id) on delete cascade,
  selected_answer   text,
  is_correct        boolean not null default false,
  time_taken_seconds integer,
  attempted_at      timestamptz not null default now(),
  created_at        timestamptz not null default now()
);

create table public.user_chapter_progress (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  chapter_id         uuid not null references public.chapters (id) on delete cascade,
  completion_percent integer not null default 0
                     check (completion_percent between 0 and 100),
  total_time_seconds integer not null default 0,
  last_studied_at    timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint user_chapter_progress_user_chapter_key unique (user_id, chapter_id)
);

create table public.user_resource_progress (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  resource_id       uuid not null references public.resources (id) on delete cascade,
  progress_percent  integer not null default 0
                    check (progress_percent between 0 and 100),
  completed         boolean not null default false,
  last_opened_at    timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint user_resource_progress_user_resource_key unique (user_id, resource_id)
);

alter table public.study_history enable row level security;
alter table public.question_attempts enable row level security;
alter table public.user_chapter_progress enable row level security;
alter table public.user_resource_progress enable row level security;

create trigger user_chapter_progress_set_updated_at
  before update on public.user_chapter_progress
  for each row execute function public.set_updated_at();

create trigger user_resource_progress_set_updated_at
  before update on public.user_resource_progress
  for each row execute function public.set_updated_at();
