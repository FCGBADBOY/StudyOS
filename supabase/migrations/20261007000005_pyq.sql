-- =============================================================================
-- StudyOS · 0005 — previous year questions + intelligence views
-- =============================================================================
-- `pyq_questions` holds the archive; the five views feed the PYQ Intelligence
-- dashboard (src/services/pyq.service.ts getPyqOverview()).
--
-- Columns consumed by the app (src/types/pyq.ts PyqQuestionRow):
--   id, chapter_id, subject_id, board_id, class_id, year, exam_type,
--   question_text, question_type, paper_set, marks, difficulty, source,
--   solution_resource_id, concepts, group_key, is_important, created_at
--
-- Questions that repeat across years share a `group_key`; the app derives the
-- "repeat rate" from those groups.
-- =============================================================================

create table public.pyq_questions (
  id                   uuid primary key default gen_random_uuid(),
  chapter_id           uuid references public.chapters (id) on delete set null,
  subject_id           uuid references public.subjects (id) on delete set null,
  board_id             uuid not null references public.boards (id) on delete cascade,
  class_id             uuid not null references public.classes (id) on delete cascade,
  year                 integer not null check (year between 1990 and 2100),
  exam_type            text not null default 'board',
  question_text        text not null,
  question_type        text not null default 'short_answer'
                       check (question_type in (
                         'MCQ', 'assertion_reason', 'short_answer', 'long_answer',
                         'numerical', 'case_study', 'other'
                       )),
  paper_set            text not null default 'Set 1',
  marks                integer not null default 1 check (marks > 0),
  difficulty           text not null default 'moderate'
                       check (difficulty in ('easy', 'moderate', 'hard')),
  source               text,
  solution_resource_id uuid references public.resources (id) on delete set null,
  concepts             text[] not null default '{}',
  group_key            text,
  is_important         boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

alter table public.pyq_questions enable row level security;

create trigger pyq_questions_set_updated_at
  before update on public.pyq_questions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Intelligence views (security_invoker so table RLS still applies).
-- Column names match src/types/pyq.ts exactly.
-- ---------------------------------------------------------------------------

-- Most frequently asked chapters.
create or replace view public.pyq_chapter_stats
with (security_invoker = true)
as
select
  q.chapter_id,
  ch.name as chapter_name,
  ch.slug as chapter_slug,
  s.id as subject_id,
  s.slug as subject_slug,
  s.name as subject_name,
  count(*)::integer as question_count,
  count(distinct q.year)::integer as years_covered,
  max(q.year)::integer as last_year,
  round(avg(q.marks))::integer as average_marks
from public.pyq_questions q
join public.chapters ch on ch.id = q.chapter_id
join public.subjects s on s.id = ch.subject_id
group by q.chapter_id, ch.name, ch.slug, s.id, s.slug, s.name;

-- Question frequency by year.
create or replace view public.pyq_year_stats
with (security_invoker = true)
as
select
  q.year,
  count(*)::integer as question_count
from public.pyq_questions q
group by q.year;

-- Marks distribution (drives the paper "sections" the UI builds).
create or replace view public.pyq_marks_stats
with (security_invoker = true)
as
select
  q.marks,
  count(*)::integer as question_count
from public.pyq_questions q
group by q.marks;

-- Difficulty distribution.
create or replace view public.pyq_difficulty_stats
with (security_invoker = true)
as
select
  q.difficulty,
  count(*)::integer as question_count
from public.pyq_questions q
group by q.difficulty;

-- Repeated concepts across years (one row per concept appearing on questions).
create or replace view public.pyq_concept_stats
with (security_invoker = true)
as
with resolved as (
  select
    q.year,
    q.created_at,
    q.marks,
    q.difficulty,
    coalesce(q.subject_id, ch.subject_id) as effective_subject_id,
    concept
  from public.pyq_questions q
  left join public.chapters ch on ch.id = q.chapter_id
  cross join lateral unnest(coalesce(q.concepts, '{}'::text[])) as x (concept)
)
select
  r.concept,
  count(*)::integer as question_count,
  r.effective_subject_id as subject_id,
  s.slug as subject_slug,
  round(avg(r.marks))::integer as average_marks,
  array_agg(distinct r.year order by r.year) as years,
  (array_agg(r.difficulty order by r.year desc, r.created_at desc))[1] as last_difficulty
from resolved r
left join public.subjects s on s.id = r.effective_subject_id
group by r.concept, r.effective_subject_id, s.slug;

grant select on public.pyq_chapter_stats to anon, authenticated;
grant select on public.pyq_year_stats to anon, authenticated;
grant select on public.pyq_marks_stats to anon, authenticated;
grant select on public.pyq_difficulty_stats to anon, authenticated;
grant select on public.pyq_concept_stats to anon, authenticated;
