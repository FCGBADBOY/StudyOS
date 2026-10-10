-- =============================================================================
-- StudyOS · 0013 — AI-generated quizzes & flashcards
-- =============================================================================
-- Output of the ai-quiz / ai-flashcards edge functions. Rows are private to
-- the student who generated them (RLS owner-only) and every payload carries a
-- `generated: true` marker so the UI can label AI material honestly — generated
-- practice is never presented as a real previous-year question.
--
--   generated_quizzes   -> one row per quiz, questions live in `items` jsonb
--                          (score / accuracy / time are filled on completion)
--   generated_flashcards-> one row per deck, cards live in `items` jsonb
-- =============================================================================

create table public.generated_quizzes (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  conversation_id uuid references public.ai_conversations (id) on delete set null,
  title           text not null default 'AI quiz',
  subject_id      uuid references public.subjects (id) on delete set null,
  chapter_id      uuid references public.chapters (id) on delete set null,
  difficulty      text not null default 'medium'
                  check (difficulty in ('easy', 'medium', 'hard')),
  question_type   text not null default 'mixed'
                  check (question_type in ('mcq', 'short_answer', 'numerical', 'mixed')),
  -- [{ id, question, options[], answer, explanation, marks, source, generated }]
  items           jsonb not null default '[]'::jsonb,
  question_count  integer not null default 0 check (question_count >= 0),
  score           integer check (score is null or score >= 0),
  correct_count   integer check (correct_count is null or correct_count >= 0),
  accuracy        numeric(5, 2) check (accuracy is null or accuracy between 0 and 100),
  time_spent_seconds integer check (time_spent_seconds is null or time_spent_seconds >= 0),
  completed_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table public.generated_flashcards (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  conversation_id uuid references public.ai_conversations (id) on delete set null,
  title           text not null default 'AI flashcards',
  subject_id      uuid references public.subjects (id) on delete set null,
  chapter_id      uuid references public.chapters (id) on delete set null,
  source_type     text not null default 'chat'
                  check (source_type in ('chapter', 'resource', 'mistakes', 'pyq', 'chat')),
  -- [{ id, question, answer, difficulty, source, generated }]
  items           jsonb not null default '[]'::jsonb,
  card_count      integer not null default 0 check (card_count >= 0),
  reviewed_count  integer not null default 0 check (reviewed_count >= 0),
  mastered_count  integer not null default 0 check (mastered_count >= 0),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.generated_quizzes enable row level security;
alter table public.generated_flashcards enable row level security;

create trigger generated_quizzes_set_updated_at
  before update on public.generated_quizzes
  for each row execute function public.set_updated_at();

create trigger generated_flashcards_set_updated_at
  before update on public.generated_flashcards
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS — owner-only in both directions; no admin backdoor (admins see
-- aggregates in ai_events, never individual students' material).
-- ---------------------------------------------------------------------------
drop policy if exists "generated quizzes are owner-only" on public.generated_quizzes;
create policy "generated quizzes are owner-only"
  on public.generated_quizzes for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "generated flashcards are owner-only" on public.generated_flashcards;
create policy "generated flashcards are owner-only"
  on public.generated_flashcards for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert, update, delete on public.generated_quizzes to authenticated;
grant select, insert, update, delete on public.generated_flashcards to authenticated;

create index if not exists generated_quizzes_user_created_idx
  on public.generated_quizzes (user_id, created_at desc);
create index if not exists generated_quizzes_chapter_idx
  on public.generated_quizzes (chapter_id);
create index if not exists generated_flashcards_user_created_idx
  on public.generated_flashcards (user_id, created_at desc);
create index if not exists generated_flashcards_chapter_idx
  on public.generated_flashcards (chapter_id);
