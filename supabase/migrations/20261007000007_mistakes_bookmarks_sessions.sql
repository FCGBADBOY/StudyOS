-- =============================================================================
-- StudyOS · 0007 — mistake book, bookmarks & planner sessions
-- =============================================================================
-- All three are strictly private: the UI never sends a user id, RLS takes it
-- from the session (src/services/mistakebook.service.ts, bookmark.service.ts,
-- planner.service.ts).
--
--   mistakes          -> MistakeBook rows (embeds chapters + pyq_questions.marks)
--   bookmarks         -> favourites keyed by stable strings
--                        (chapter:<subject>:<slug>, resource:<id>, pyq:<subject>:<year>)
--   study_sessions    -> planner rows; `priority` mirrors the UI vocabulary
--                        ('High' | 'Medium' | 'Low')
-- =============================================================================

create table public.mistakes (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  question_id    uuid references public.pyq_questions (id) on delete set null,
  chapter_id     uuid references public.chapters (id) on delete set null,
  question_text  text not null,
  mistake_type   text not null default 'other'
                 check (mistake_type in (
                   'conceptual', 'calculation', 'formula', 'sign_error',
                   'careless', 'memory', 'other'
                 )),
  student_answer text,
  correct_answer text,
  explanation    text,
  notes          text,
  review_count   integer not null default 0,
  resolved       boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table public.bookmarks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  target_type text not null default 'chapter'
              check (target_type in ('resource', 'chapter', 'pyq', 'question')),
  target_key  text not null,
  resource_id uuid references public.resources (id) on delete cascade,
  chapter_id  uuid references public.chapters (id) on delete cascade,
  question_id uuid references public.pyq_questions (id) on delete cascade,
  created_at  timestamptz not null default now(),
  constraint bookmarks_user_target_key unique (user_id, target_key)
);

create table public.study_sessions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  subject_id       uuid references public.subjects (id) on delete set null,
  chapter_id       uuid references public.chapters (id) on delete set null,
  title            text not null,
  description      text,
  scheduled_date   date not null,
  start_time       time,
  duration_minutes integer not null default 45 check (duration_minutes > 0),
  priority         text not null default 'Medium'
                   check (priority in ('High', 'Medium', 'Low')),
  completed        boolean not null default false,
  completed_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table public.mistakes enable row level security;
alter table public.bookmarks enable row level security;
alter table public.study_sessions enable row level security;

create trigger mistakes_set_updated_at
  before update on public.mistakes
  for each row execute function public.set_updated_at();

create trigger study_sessions_set_updated_at
  before update on public.study_sessions
  for each row execute function public.set_updated_at();
