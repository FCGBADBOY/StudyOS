-- =============================================================================
-- StudyOS · 0009 — Row Level Security policies, grants & indexes
-- =============================================================================
-- Rules:
--   * academic content (boards, classes, streams, subjects, chapters),
--     published resources, the PYQ archive and exam templates are readable by
--     everyone (anon + authenticated) — no hard-coded board logic anywhere;
--   * everything that belongs to a student is readable and writable only by
--     its owner (auth.uid()); the UI never sends a user id, RLS takes it from
--     the session;
--   * the database owner (postgres / service role) keeps full access for
--     migrations and server work.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Belt & braces: make sure every table has RLS enabled.
-- ---------------------------------------------------------------------------
alter table public.boards enable row level security;
alter table public.classes enable row level security;
alter table public.streams enable row level security;
alter table public.subjects enable row level security;
alter table public.chapters enable row level security;
alter table public.profiles enable row level security;
alter table public.notifications enable row level security;
alter table public.resources enable row level security;
alter table public.pyq_questions enable row level security;
alter table public.study_history enable row level security;
alter table public.question_attempts enable row level security;
alter table public.user_chapter_progress enable row level security;
alter table public.user_resource_progress enable row level security;
alter table public.mistakes enable row level security;
alter table public.bookmarks enable row level security;
alter table public.study_sessions enable row level security;
alter table public.exams enable row level security;
alter table public.exam_templates enable row level security;

-- ---------------------------------------------------------------------------
-- Public, read-only academic content
-- ---------------------------------------------------------------------------
create policy "boards are publicly readable"
  on public.boards for select to anon, authenticated using (true);

create policy "classes are publicly readable"
  on public.classes for select to anon, authenticated using (true);

create policy "streams are publicly readable"
  on public.streams for select to anon, authenticated using (true);

create policy "subjects are publicly readable"
  on public.subjects for select to anon, authenticated using (true);

create policy "chapters are publicly readable"
  on public.chapters for select to anon, authenticated using (true);

-- Draft / unpublished resources stay invisible to clients.
create policy "published resources are publicly readable"
  on public.resources for select to anon, authenticated using (is_published);

create policy "pyq questions are publicly readable"
  on public.pyq_questions for select to anon, authenticated using (true);

create policy "exam templates are publicly readable"
  on public.exam_templates for select to anon, authenticated using (true);

-- ---------------------------------------------------------------------------
-- Private, owner-only rows
-- ---------------------------------------------------------------------------
create policy "profiles are owner-only"
  on public.profiles for all to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "notifications are owner-only"
  on public.notifications for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "study history is owner-only"
  on public.study_history for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "question attempts are owner-only"
  on public.question_attempts for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "chapter progress is owner-only"
  on public.user_chapter_progress for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "resource progress is owner-only"
  on public.user_resource_progress for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "mistakes are owner-only"
  on public.mistakes for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "bookmarks are owner-only"
  on public.bookmarks for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "study sessions are owner-only"
  on public.study_sessions for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "exams are owner-only"
  on public.exams for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Grants (RLS does the actual filtering; grants keep PostgREST in the loop).
-- ---------------------------------------------------------------------------
grant select on
  public.boards, public.classes, public.streams, public.subjects, public.chapters,
  public.resources, public.pyq_questions, public.exam_templates
to anon, authenticated;

grant select, insert, update, delete on
  public.profiles, public.notifications, public.study_history,
  public.question_attempts, public.user_chapter_progress, public.user_resource_progress,
  public.mistakes, public.bookmarks, public.study_sessions, public.exams
to authenticated;

-- ---------------------------------------------------------------------------
-- Indexes: foreign keys, slugs, owner + date columns, lower() lookups.
-- ---------------------------------------------------------------------------
create index if not exists boards_display_order_idx on public.boards (display_order);
create index if not exists classes_display_order_idx on public.classes (display_order);
create index if not exists streams_display_order_idx on public.streams (display_order);

create index if not exists subjects_class_id_idx on public.subjects (class_id);
create index if not exists subjects_board_id_idx on public.subjects (board_id);
create index if not exists subjects_stream_id_idx on public.subjects (stream_id);
create index if not exists subjects_slug_idx on public.subjects (slug);
create index if not exists subjects_name_lower_idx on public.subjects (lower(name));

create index if not exists chapters_subject_id_idx on public.chapters (subject_id);
create index if not exists chapters_slug_idx on public.chapters (slug);
create index if not exists chapters_name_lower_idx on public.chapters (lower(name));

create index if not exists resources_chapter_id_idx on public.resources (chapter_id);
create index if not exists resources_published_idx on public.resources (is_published);
create index if not exists resources_type_idx on public.resources (resource_type);
create index if not exists resources_title_lower_idx on public.resources (lower(title));

create index if not exists pyq_questions_chapter_id_idx on public.pyq_questions (chapter_id);
create index if not exists pyq_questions_subject_id_idx on public.pyq_questions (subject_id);
create index if not exists pyq_questions_board_id_idx on public.pyq_questions (board_id);
create index if not exists pyq_questions_class_id_idx on public.pyq_questions (class_id);
create index if not exists pyq_questions_year_idx on public.pyq_questions (year);
create index if not exists pyq_questions_group_key_idx on public.pyq_questions (group_key);
create index if not exists pyq_questions_concepts_idx on public.pyq_questions using gin (concepts);
create index if not exists pyq_questions_text_lower_idx on public.pyq_questions (lower(question_text));

create index if not exists profiles_board_id_idx on public.profiles (board_id);
create index if not exists profiles_class_id_idx on public.profiles (class_id);
create index if not exists profiles_stream_id_idx on public.profiles (stream_id);

create index if not exists notifications_user_created_idx on public.notifications (user_id, created_at desc);

create index if not exists study_history_user_occurred_idx on public.study_history (user_id, occurred_at desc);
create index if not exists study_history_subject_id_idx on public.study_history (subject_id);
create index if not exists study_history_chapter_id_idx on public.study_history (chapter_id);
create index if not exists study_history_resource_id_idx on public.study_history (resource_id);

create index if not exists question_attempts_user_attempted_idx on public.question_attempts (user_id, attempted_at desc);
create index if not exists question_attempts_question_id_idx on public.question_attempts (question_id);

create index if not exists user_chapter_progress_user_idx on public.user_chapter_progress (user_id);
create index if not exists user_chapter_progress_chapter_idx on public.user_chapter_progress (chapter_id);
create index if not exists user_chapter_progress_last_studied_idx on public.user_chapter_progress (last_studied_at desc);

create index if not exists user_resource_progress_user_idx on public.user_resource_progress (user_id);
create index if not exists user_resource_progress_resource_idx on public.user_resource_progress (resource_id);

create index if not exists mistakes_user_created_idx on public.mistakes (user_id, created_at desc);
create index if not exists mistakes_chapter_id_idx on public.mistakes (chapter_id);
create index if not exists mistakes_question_id_idx on public.mistakes (question_id);
create index if not exists mistakes_type_idx on public.mistakes (mistake_type);

create index if not exists bookmarks_user_created_idx on public.bookmarks (user_id, created_at desc);
create index if not exists bookmarks_resource_id_idx on public.bookmarks (resource_id);
create index if not exists bookmarks_chapter_id_idx on public.bookmarks (chapter_id);

create index if not exists study_sessions_user_date_idx on public.study_sessions (user_id, scheduled_date, start_time);
create index if not exists study_sessions_subject_id_idx on public.study_sessions (subject_id);
create index if not exists study_sessions_title_lower_idx on public.study_sessions (lower(title));

create index if not exists exams_user_date_idx on public.exams (user_id, exam_date);
create index if not exists exams_subject_id_idx on public.exams (subject_id);

create index if not exists exam_templates_board_class_idx on public.exam_templates (board_id, class_id);
