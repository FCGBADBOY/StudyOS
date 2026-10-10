-- =============================================================================
-- StudyOS · 0008 — exams & exam templates
-- =============================================================================
-- `exam_templates` are shared, board-level seeds; when a student finishes
-- onboarding the app copies them into their own `exams` calendar
-- (src/services/exam.service.ts assignExamsForProfile(), which inserts rows
-- directly under the owner-only RLS policy below). The clone_exam_templates()
-- RPC is an equivalent, race-safe helper any client may call instead.
--
-- Columns consumed by the app (src/types/planner.ts):
--   exams(id, user_id, subject_id, title, exam_date, total_marks, notes, color, created_at)
--   exam_templates(id, board_id, class_id, subject_id, title, exam_date, total_marks, notes, color)
-- =============================================================================

create table public.exams (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  subject_id  uuid references public.subjects (id) on delete set null,
  title       text not null,
  exam_date   date not null,
  total_marks integer,
  notes       text,
  color       text not null default 'brand'
              check (color in ('brand', 'accent', 'warning', 'danger')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.exam_templates (
  id          uuid primary key default gen_random_uuid(),
  board_id    uuid not null references public.boards (id) on delete cascade,
  class_id    uuid not null references public.classes (id) on delete cascade,
  subject_id  uuid references public.subjects (id) on delete set null,
  title       text not null,
  exam_date   date not null,
  total_marks integer,
  notes       text,
  color       text not null default 'brand'
              check (color in ('brand', 'accent', 'warning', 'danger')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.exams enable row level security;
alter table public.exam_templates enable row level security;

create trigger exams_set_updated_at
  before update on public.exams
  for each row execute function public.set_updated_at();

create trigger exam_templates_set_updated_at
  before update on public.exam_templates
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- clone_exam_templates: copy the seeded board/class exams into the calling
-- student's calendar. Idempotent — does nothing when exams already exist.
-- security definer so it works even if future policies tighten; it only ever
-- writes rows owned by auth.uid().
-- ---------------------------------------------------------------------------
create or replace function public.clone_exam_templates(p_board_id uuid, p_class_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_count integer := 0;
begin
  if v_user is null then
    return 0;
  end if;

  if exists (select 1 from public.exams where user_id = v_user) then
    return 0;
  end if;

  insert into public.exams (user_id, subject_id, title, exam_date, total_marks, notes, color)
  select v_user, t.subject_id, t.title, t.exam_date, t.total_marks, t.notes, t.color
  from public.exam_templates t
  where t.board_id = p_board_id
    and t.class_id = p_class_id;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function public.clone_exam_templates(uuid, uuid) to authenticated;
