-- =============================================================================
-- StudyOS 0015 - Autonomous Academic Content Engine
-- =============================================================================
-- The engine keeps StudyOS's academic content maintained with minimal manual
-- data entry. It has two halves:
--
--   A. GENERATE  — syllabus discovery -> chapter maps -> original AI notes,
--                  revision material, formula/reaction sheets, quizzes.
--   B. COLLECT   — discover official / openly reusable question papers and
--                  sample papers, verify the source, import or link them,
--                  classify, deduplicate, validate, publish.
--
-- LEGALITY IS A FIRST-CLASS COLUMN, NOT A COMMENT. "Publicly available" is not
-- "free to redistribute": every external record carries `license_status` and
-- `redistribution_allowed`, and a document whose licence is unknown is stored
-- as metadata + a canonical URL (a "View Source" link) rather than copied into
-- Supabase Storage. See `src/content-engine/license.ts`, which is the single
-- implementation of that decision and is shared by the crawler and the UI.
--
-- SECURITY
--   * Reads that expose engine internals require `engine.view`.
--   * Anything that crawls, generates, approves or publishes requires
--     `engine.manage` (admin / super_admin) and, for publication, the existing
--     `content.publish` permission re-checked by `guard_resource_status()`.
--   * Students can only ever read *approved/published* generated content and
--     the provenance rows that power the "Source:" attribution block.
--   * The queue is written through `ce_*()` SECURITY DEFINER RPCs (or the
--     service-role edge function) — there is no INSERT policy, so a student
--     calling PostgREST directly cannot enqueue generation work.
--
-- Nothing here duplicates the academic hierarchy: boards/classes/streams/
-- subjects/chapters/resources/pyq_questions are reused as-is.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0. Permissions
-- ---------------------------------------------------------------------------
-- `engine.view`    — read the engine dashboards, queues, sources, reviews
-- `engine.manage`  — crawl, generate, approve, publish, change source policy

insert into public.role_permissions (role, permission) values
  ('content_editor', 'engine.view'),
  ('moderator',      'engine.view'),
  ('moderator',      'engine.manage'),
  ('admin',          'engine.view'),
  ('admin',          'engine.manage'),
  ('super_admin',    'engine.view'),
  ('super_admin',    'engine.manage')
on conflict (role, permission) do nothing;

-- ---------------------------------------------------------------------------
-- 1. Helpers
-- ---------------------------------------------------------------------------

create or replace function public.ce_slugify(p_text text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  v text;
begin
  v := lower(coalesce(p_text, ''));
  v := regexp_replace(v, '[^a-z0-9]+', '-', 'g');
  v := regexp_replace(v, '^-+|-+$', '', 'g');
  return case when v = '' then 'item' else v end;
end;
$$;

create or replace function public.ce_require(p_permission text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_permission(p_permission) then
    raise exception 'You do not have permission to run the content engine.'
      using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.ce_slugify(text) from public;
grant execute on function public.ce_slugify(text) to authenticated;

revoke all on function public.ce_require(text) from public;
grant execute on function public.ce_require(text) to postgres, service_role;

-- ---------------------------------------------------------------------------
-- 2. Source registry — the allow-list the crawler is permitted to touch
-- ---------------------------------------------------------------------------

create table if not exists public.source_registry (
  id                    uuid primary key default gen_random_uuid(),
  board_id              uuid references public.boards (id) on delete set null,
  source_name           text not null,
  domain                text not null,
  base_url              text not null,
  source_type           text not null default 'other'
                        check (source_type in (
                          'official_board', 'official_academic', 'open_educational',
                          'institution', 'open_archive', 'community', 'other'
                        )),
  license_status        text not null default 'unknown'
                        check (license_status in (
                          'official', 'open_license', 'public_domain',
                          'permission_granted', 'unknown', 'restricted'
                        )),
  redistribution_allowed boolean not null default false,
  access_method         text not null default 'public'
                        check (access_method in ('public', 'link_only', 'manual')),
  enabled               boolean not null default false,
  priority              integer not null default 100,
  source_status         text not null default 'active'
                        check (source_status in ('active', 'unavailable', 'paused')),
  notes                 text,
  last_checked_at       timestamptz,
  last_success_at       timestamptz,
  last_failure_at       timestamptz,
  last_error            text,
  consecutive_failures  integer not null default 0,
  created_by            uuid references auth.users (id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint source_registry_domain_url_key unique (domain, base_url)
);

alter table public.source_registry enable row level security;

drop trigger if exists source_registry_set_updated_at on public.source_registry;
create trigger source_registry_set_updated_at
  before update on public.source_registry
  for each row execute function public.set_updated_at();

create index if not exists source_registry_enabled_idx
  on public.source_registry (enabled, priority) where enabled;
create index if not exists source_registry_board_idx on public.source_registry (board_id);

-- ---------------------------------------------------------------------------
-- 3. Source documents — one row per discovered document (stored OR linked)
-- ---------------------------------------------------------------------------
-- `storage_path IS NULL` means "metadata only": the file was never copied into
-- StudyOS because redistribution rights were unclear or absent. `retrieval_status`
-- is what the UI turns into "Download" vs "View Original".

create table if not exists public.source_documents (
  id                    uuid primary key default gen_random_uuid(),
  source_id             uuid not null references public.source_registry (id) on delete cascade,
  board_id              uuid references public.boards (id) on delete set null,
  class_id              uuid references public.classes (id) on delete set null,
  subject_id            uuid references public.subjects (id) on delete set null,
  chapter_id            uuid references public.chapters (id) on delete set null,
  academic_session      text,
  doc_kind              text not null default 'other'
                        check (doc_kind in (
                          'syllabus', 'curriculum', 'sample_paper', 'question_paper',
                          'marking_scheme', 'notification', 'reference', 'other'
                        )),
  title                 text not null,
  title_normalized      text not null default '',
  canonical_url         text not null,
  domain                text not null,
  publisher             text,
  source_type           text not null default 'other',
  license_status        text not null default 'unknown',
  redistribution_allowed boolean not null default false,
  access_method         text not null default 'public',
  official_status       text not null default 'unverified'
                        check (official_status in (
                          'verified_official', 'verified_source_archive',
                          'third_party', 'unverified'
                        )),
  retrieval_status      text not null default 'discovered'
                        check (retrieval_status in (
                          'discovered', 'stored', 'linked', 'blocked', 'failed', 'archived'
                        )),
  storage_path          text,
  file_hash             text,
  mime_type             text,
  size_bytes            bigint,
  http_status           integer,
  etag                  text,
  last_modified         text,
  duplicate_of          uuid references public.source_documents (id) on delete set null,
  retrieved_at          timestamptz,
  first_seen_at         timestamptz not null default now(),
  last_checked_at       timestamptz,
  link_status           text not null default 'unchecked'
                        check (link_status in ('unchecked', 'ok', 'broken', 'timeout', 'blocked')),
  link_http_status      integer,
  link_checked_at       timestamptz,
  meta                  jsonb not null default '{}'::jsonb,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint source_documents_url_key unique (source_id, canonical_url)
);

alter table public.source_documents enable row level security;

drop trigger if exists source_documents_set_updated_at on public.source_documents;
create trigger source_documents_set_updated_at
  before update on public.source_documents
  for each row execute function public.set_updated_at();

create index if not exists source_documents_kind_idx     on public.source_documents (doc_kind, retrieval_status);
create index if not exists source_documents_academic_idx on public.source_documents (board_id, class_id, subject_id);
create index if not exists source_documents_hash_idx     on public.source_documents (file_hash) where file_hash is not null;
create index if not exists source_documents_title_idx    on public.source_documents (title_normalized);
create index if not exists source_documents_link_idx     on public.source_documents (link_status) where link_status <> 'unchecked';
create index if not exists source_documents_session_idx  on public.source_documents (academic_session);

-- ---------------------------------------------------------------------------
-- 4. Source versions — hash / ETag change detection (never re-download the
--    same bytes twice, and only regenerate what a change actually touched)
-- ---------------------------------------------------------------------------

create table if not exists public.source_versions (
  id            uuid primary key default gen_random_uuid(),
  document_id   uuid not null references public.source_documents (id) on delete cascade,
  version_key   text not null,
  content_hash  text,
  size_bytes    bigint,
  http_status   integer,
  changed       boolean not null default true,
  discovered_at timestamptz not null default now(),
  constraint source_versions_document_key unique (document_id, version_key)
);

alter table public.source_versions enable row level security;
create index if not exists source_versions_document_idx on public.source_versions (document_id, discovered_at desc);

-- ---------------------------------------------------------------------------
-- 5. Crawl runs + items — what the crawler did, and what it refused to do
-- ---------------------------------------------------------------------------

create table if not exists public.crawl_runs (
  id                 uuid primary key default gen_random_uuid(),
  source_id          uuid references public.source_registry (id) on delete set null,
  trigger            text not null default 'manual'
                     check (trigger in ('manual', 'schedule', 'webhook')),
  status             text not null default 'running'
                     check (status in ('running', 'completed', 'failed', 'cancelled', 'paused')),
  started_at         timestamptz not null default now(),
  finished_at        timestamptz,
  pages_fetched      integer not null default 0,
  pages_skipped      integer not null default 0,
  documents_found    integer not null default 0,
  documents_stored   integer not null default 0,
  documents_linked   integer not null default 0,
  blocked_by_robots  integer not null default 0,
  rate_limited       integer not null default 0,
  errors             integer not null default 0,
  error_message      text,
  created_by         uuid references auth.users (id) on delete set null,
  created_at         timestamptz not null default now()
);

alter table public.crawl_runs enable row level security;
create index if not exists crawl_runs_started_idx on public.crawl_runs (started_at desc);

create table if not exists public.crawl_items (
  id           uuid primary key default gen_random_uuid(),
  run_id       uuid not null references public.crawl_runs (id) on delete cascade,
  url          text not null,
  depth        integer not null default 0,
  http_status  integer,
  outcome      text not null
               check (outcome in (
                 'fetched', 'skipped_robots', 'skipped_depth', 'skipped_domain',
                 'skipped_size', 'skipped_type', 'rate_limited', 'error', 'not_found'
               )),
  bytes        bigint,
  content_type text,
  document_id  uuid references public.source_documents (id) on delete set null,
  message      text,
  created_at   timestamptz not null default now()
);

alter table public.crawl_items enable row level security;
create index if not exists crawl_items_run_idx on public.crawl_items (run_id, created_at);

-- ---------------------------------------------------------------------------
-- 6. Syllabus discovery jobs + change sets (spec 7/8)
-- ---------------------------------------------------------------------------
-- Discovery never overwrites the syllabus. It produces a *diff* which an admin
-- approves; only then does `ce_apply_syllabus_changes()` touch the hierarchy.

create table if not exists public.syllabus_discovery_jobs (
  id               uuid primary key default gen_random_uuid(),
  source_id        uuid references public.source_registry (id) on delete set null,
  board_id         uuid not null references public.boards (id) on delete cascade,
  class_id         uuid references public.classes (id) on delete set null,
  subject_id       uuid references public.subjects (id) on delete set null,
  academic_session text,
  status           text not null default 'queued'
                   check (status in ('queued', 'running', 'completed', 'failed', 'cancelled')),
  stage            text not null default 'discover'
                   check (stage in ('discover', 'extract', 'normalize', 'compare', 'review', 'applied')),
  progress         integer not null default 0 check (progress between 0 and 100),
  found_subjects   integer not null default 0,
  found_chapters   integer not null default 0,
  added_count      integer not null default 0,
  renamed_count    integer not null default 0,
  removed_count    integer not null default 0,
  moved_count      integer not null default 0,
  unchanged_count  integer not null default 0,
  error            text,
  created_by       uuid references auth.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  started_at       timestamptz,
  finished_at      timestamptz,
  updated_at       timestamptz not null default now()
);

alter table public.syllabus_discovery_jobs enable row level security;

drop trigger if exists syllabus_jobs_set_updated_at on public.syllabus_discovery_jobs;
create trigger syllabus_jobs_set_updated_at
  before update on public.syllabus_discovery_jobs
  for each row execute function public.set_updated_at();

create index if not exists syllabus_jobs_status_idx on public.syllabus_discovery_jobs (status, created_at desc);

create table if not exists public.syllabus_change_sets (
  id               uuid primary key default gen_random_uuid(),
  job_id           uuid references public.syllabus_discovery_jobs (id) on delete cascade,
  board_id         uuid not null references public.boards (id) on delete cascade,
  class_id         uuid references public.classes (id) on delete set null,
  subject_id       uuid references public.subjects (id) on delete cascade,
  academic_session text,
  baseline         jsonb not null default '[]'::jsonb,
  discovered       jsonb not null default '[]'::jsonb,
  summary          jsonb not null default '{}'::jsonb,
  status           text not null default 'needs_review'
                   check (status in ('needs_review', 'approved', 'rejected', 'applied')),
  reviewed_by      uuid references auth.users (id) on delete set null,
  reviewed_at      timestamptz,
  applied_at       timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table public.syllabus_change_sets enable row level security;

drop trigger if exists syllabus_changes_set_updated_at on public.syllabus_change_sets;
create trigger syllabus_changes_set_updated_at
  before update on public.syllabus_change_sets
  for each row execute function public.set_updated_at();

create index if not exists syllabus_changes_status_idx on public.syllabus_change_sets (status, created_at desc);

create table if not exists public.syllabus_change_items (
  id              uuid primary key default gen_random_uuid(),
  change_set_id   uuid not null references public.syllabus_change_sets (id) on delete cascade,
  change_type     text not null
                  check (change_type in ('added', 'removed', 'renamed', 'moved', 'reordered', 'subject_changed')),
  entity          text not null check (entity in ('subject', 'chapter', 'topic')),
  existing_id     uuid,
  existing_name   text,
  discovered_name text,
  details         jsonb not null default '{}'::jsonb,
  applied         boolean not null default false,
  created_at      timestamptz not null default now()
);

alter table public.syllabus_change_items enable row level security;
create index if not exists syllabus_change_items_set_idx on public.syllabus_change_items (change_set_id);

-- ---------------------------------------------------------------------------
-- 7. Chapter maps (spec 9) — the structured foundation for generated notes
-- ---------------------------------------------------------------------------

create table if not exists public.chapter_maps (
  id                uuid primary key default gen_random_uuid(),
  chapter_id        uuid not null unique references public.chapters (id) on delete cascade,
  board_id          uuid references public.boards (id) on delete set null,
  class_id          uuid references public.classes (id) on delete set null,
  subject_id        uuid references public.subjects (id) on delete set null,
  academic_session  text,
  status            text not null default 'draft'
                    check (status in ('draft', 'generated', 'validated', 'approved', 'stale')),
  topics            jsonb not null default '[]'::jsonb,
  learning_objectives text[] not null default '{}',
  prerequisites     text[] not null default '{}',
  formulas          jsonb not null default '[]'::jsonb,
  important_concepts text[] not null default '{}',
  source_id         uuid references public.source_registry (id) on delete set null,
  generation_source text not null default 'syllabus',
  generation_model  text,
  prompt_version    text,
  generated_at      timestamptz,
  approved_at       timestamptz,
  created_by        uuid references auth.users (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

alter table public.chapter_maps enable row level security;

drop trigger if exists chapter_maps_set_updated_at on public.chapter_maps;
create trigger chapter_maps_set_updated_at
  before update on public.chapter_maps
  for each row execute function public.set_updated_at();

create index if not exists chapter_maps_subject_idx on public.chapter_maps (subject_id, status);

-- ---------------------------------------------------------------------------
-- 8. Content generation jobs — the single async queue (spec 40/62/63)
-- ---------------------------------------------------------------------------
-- No INSERT/UPDATE policy exists: the queue is written by ce_enqueue_job() /
-- ce_control_job() (SECURITY DEFINER) and by the service-role worker. A student
-- posting to PostgREST gets an RLS denial, so students can never trigger
-- generation, crawling or embedding spend.

create table if not exists public.content_generation_jobs (
  id               uuid primary key default gen_random_uuid(),
  job_type         text not null
                   check (job_type in (
                     'discover_syllabus', 'build_chapter_map', 'generate_notes',
                     'generate_revision', 'generate_formula_sheet', 'generate_quiz',
                     'generate_flashcards', 'generate_practice', 'extract_formulas',
                     'extract_reactions', 'discover_pyqs', 'discover_sample_papers',
                     'import_document', 'validate_content', 'rebuild_index',
                     'daily_maintenance', 'build_class', 'build_subject', 'build_chapter'
                   )),
  status           text not null default 'queued'
                   check (status in ('queued', 'running', 'paused', 'completed',
                                     'failed', 'cancelled', 'partial')),
  priority         integer not null default 100,
  board_id         uuid references public.boards (id) on delete set null,
  class_id         uuid references public.classes (id) on delete set null,
  stream_id        uuid references public.streams (id) on delete set null,
  subject_id       uuid references public.subjects (id) on delete set null,
  chapter_id       uuid references public.chapters (id) on delete set null,
  source_id        uuid references public.source_registry (id) on delete set null,
  document_id      uuid references public.source_documents (id) on delete set null,
  academic_session text,
  depth            text check (depth in ('quick', 'standard', 'detailed', 'exam_master')),
  params           jsonb not null default '{}'::jsonb,
  stage            text not null default 'queued',
  progress         integer not null default 0 check (progress between 0 and 100),
  steps_total      integer not null default 0,
  steps_done       integer not null default 0,
  result           jsonb not null default '{}'::jsonb,
  error            text,
  attempts         integer not null default 0,
  max_attempts     integer not null default 3,
  locked_at        timestamptz,
  locked_by        text,
  parent_job_id    uuid references public.content_generation_jobs (id) on delete set null,
  created_by       uuid references auth.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  started_at       timestamptz,
  finished_at      timestamptz,
  updated_at       timestamptz not null default now()
);

alter table public.content_generation_jobs enable row level security;

drop trigger if exists content_jobs_set_updated_at on public.content_generation_jobs;
create trigger content_jobs_set_updated_at
  before update on public.content_generation_jobs
  for each row execute function public.set_updated_at();

create index if not exists content_jobs_queue_idx
  on public.content_generation_jobs (priority, created_at)
  where status = 'queued';
create index if not exists content_jobs_status_idx  on public.content_generation_jobs (status, created_at desc);
create index if not exists content_jobs_scope_idx   on public.content_generation_jobs (board_id, class_id, subject_id, chapter_id);
create index if not exists content_jobs_parent_idx  on public.content_generation_jobs (parent_job_id);

-- ---------------------------------------------------------------------------
-- 9. Generated notes: documents -> sections -> items (spec 15)
-- ---------------------------------------------------------------------------
-- Structured on purpose: the mobile renderer can show a formula as a formula,
-- a warning as a warning, and a table as a table, instead of one text blob.

create table if not exists public.generated_notes (
  id                 uuid primary key default gen_random_uuid(),
  chapter_id         uuid not null references public.chapters (id) on delete cascade,
  board_id           uuid references public.boards (id) on delete set null,
  class_id           uuid references public.classes (id) on delete set null,
  subject_id         uuid references public.subjects (id) on delete set null,
  academic_session   text,
  note_type          text not null
                     check (note_type in (
                       'notes', 'quick_revision', 'formula_sheet', 'important_concepts',
                       'common_mistakes', 'practice_questions', 'flashcards', 'quiz',
                       'sample_paper'
                     )),
  depth              text not null default 'standard'
                     check (depth in ('quick', 'standard', 'detailed', 'exam_master')),
  title              text not null,
  status             text not null default 'generated'
                     check (status in (
                       'discovered', 'processing', 'generated', 'validation_failed',
                       'needs_review', 'approved', 'published', 'archived', 'blocked'
                     )),
  quality_score      integer check (quality_score between 0 and 100),
  quality_grade      text check (quality_grade in ('A', 'B', 'C', 'review')),
  word_count         integer not null default 0,
  -- provenance (metadata about generation, never hidden chain-of-thought)
  generation_source  text not null default 'ai'
                     check (generation_source in ('ai', 'imported', 'manual', 'hybrid')),
  source_references  jsonb not null default '[]'::jsonb,
  generation_model   text,
  prompt_version     text,
  syllabus_version   text,
  generation_version integer not null default 1,
  content_hash       text,
  job_id             uuid references public.content_generation_jobs (id) on delete set null,
  resource_id        uuid references public.resources (id) on delete set null,
  review_note        text,
  reviewed_by        uuid references auth.users (id) on delete set null,
  reviewed_at        timestamptz,
  published_at       timestamptz,
  created_by         uuid references auth.users (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

alter table public.generated_notes enable row level security;

drop trigger if exists generated_notes_set_updated_at on public.generated_notes;
create trigger generated_notes_set_updated_at
  before update on public.generated_notes
  for each row execute function public.set_updated_at();

create index if not exists generated_notes_chapter_idx on public.generated_notes (chapter_id, status);
create index if not exists generated_notes_status_idx  on public.generated_notes (status, updated_at desc);
create index if not exists generated_notes_type_idx    on public.generated_notes (note_type, depth);
create index if not exists generated_notes_job_idx     on public.generated_notes (job_id);

create table if not exists public.note_sections (
  id          uuid primary key default gen_random_uuid(),
  note_id     uuid not null references public.generated_notes (id) on delete cascade,
  section_key text not null,
  position    integer not null default 0,
  heading     text not null,
  summary     text,
  created_at  timestamptz not null default now(),
  constraint note_sections_key_unique unique (note_id, section_key)
);

alter table public.note_sections enable row level security;
create index if not exists note_sections_note_idx on public.note_sections (note_id, position);

create table if not exists public.note_items (
  id         uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.note_sections (id) on delete cascade,
  position   integer not null default 0,
  item_type  text not null
             check (item_type in (
               'heading', 'paragraph', 'definition', 'formula', 'derivation',
               'example', 'reaction', 'table', 'tip', 'warning', 'question',
               'answer', 'diagram'
             )),
  body       text not null default '',
  meta       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.note_items enable row level security;
create index if not exists note_items_section_idx on public.note_items (section_id, position);

-- Version history: a syllabus change creates a NEW generation instead of
-- silently destroying the previous one (spec 56).
create table if not exists public.generated_content_versions (
  id             uuid primary key default gen_random_uuid(),
  note_id        uuid not null references public.generated_notes (id) on delete cascade,
  version        integer not null,
  snapshot       jsonb not null,
  quality_score  integer,
  change_summary text,
  created_by     uuid references auth.users (id) on delete set null,
  created_at     timestamptz not null default now(),
  constraint generated_content_versions_key unique (note_id, version)
);

alter table public.generated_content_versions enable row level security;

-- ---------------------------------------------------------------------------
-- 10. Provenance — shown to students as "Source: / Original URL / Retrieved"
-- ---------------------------------------------------------------------------

create table if not exists public.source_provenance (
  id                    uuid primary key default gen_random_uuid(),
  entity_type           text not null
                        check (entity_type in (
                          'note', 'document', 'pyq_question', 'resource', 'paper', 'question'
                        )),
  entity_id             uuid not null,
  source_id             uuid references public.source_registry (id) on delete set null,
  document_id           uuid references public.source_documents (id) on delete set null,
  board_id              uuid references public.boards (id) on delete set null,
  class_id              uuid references public.classes (id) on delete set null,
  subject_id            uuid references public.subjects (id) on delete set null,
  chapter_id            uuid references public.chapters (id) on delete set null,
  source_name           text not null,
  domain                text,
  publisher             text,
  source_url            text,
  source_type           text,
  license_status        text not null default 'unknown'
                        check (license_status in (
                          'official', 'open_license', 'public_domain',
                          'permission_granted', 'unknown', 'restricted'
                        )),
  redistribution_allowed boolean not null default false,
  access_method         text not null default 'public',
  official_status       text not null default 'unverified'
                        check (official_status in (
                          'verified_official', 'verified_source_archive',
                          'third_party', 'unverified'
                        )),
  attribution           text,
  retrieved_at          timestamptz,
  created_at            timestamptz not null default now()
);

alter table public.source_provenance enable row level security;
create index if not exists source_provenance_entity_idx on public.source_provenance (entity_type, entity_id);
create index if not exists source_provenance_doc_idx    on public.source_provenance (document_id);

-- ---------------------------------------------------------------------------
-- 11. Content dependency graph (spec 44) — enables "only regenerate what a
--     change actually touched"
-- ---------------------------------------------------------------------------

create table if not exists public.content_dependencies (
  id               uuid primary key default gen_random_uuid(),
  depends_on_type  text not null,
  depends_on_id    uuid not null,
  dependent_type   text not null,
  dependent_id     uuid not null,
  relation         text not null default 'derived_from'
                   check (relation in ('derived_from', 'indexes', 'embeds', 'references', 'published_as')),
  created_at       timestamptz not null default now(),
  constraint content_dependencies_key unique
    (depends_on_type, depends_on_id, dependent_type, dependent_id, relation)
);

alter table public.content_dependencies enable row level security;
create index if not exists content_dependencies_target_idx
  on public.content_dependencies (dependent_type, dependent_id);
create index if not exists content_dependencies_source_idx
  on public.content_dependencies (depends_on_type, depends_on_id);

-- ---------------------------------------------------------------------------
-- 12. Validation results (spec 22/23/57)
-- ---------------------------------------------------------------------------

create table if not exists public.content_validation_results (
  id            uuid primary key default gen_random_uuid(),
  entity_type   text not null check (entity_type in ('note', 'document', 'pyq_import', 'paper', 'chapter_map')),
  entity_id     uuid not null,
  job_id        uuid references public.content_generation_jobs (id) on delete set null,
  checks_run    text[] not null default '{}',
  quality_score integer check (quality_score between 0 and 100),
  quality_grade text check (quality_grade in ('A', 'B', 'C', 'review')),
  passed        boolean not null default false,
  warnings      jsonb not null default '[]'::jsonb,
  errors        jsonb not null default '[]'::jsonb,
  coverage      jsonb not null default '{}'::jsonb,
  -- targeted repair (spec 37): how many passes, and which sections they touched
  repair_attempts   integer not null default 0,
  repaired_targets  jsonb not null default '[]'::jsonb,
  created_at    timestamptz not null default now()
);

alter table public.content_validation_results enable row level security;
create index if not exists content_validation_entity_idx
  on public.content_validation_results (entity_type, entity_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 13. PYQ discovery / import (spec 25-30) + paper metadata
-- ---------------------------------------------------------------------------

create table if not exists public.pyq_import_jobs (
  id                 uuid primary key default gen_random_uuid(),
  board_id           uuid references public.boards (id) on delete set null,
  class_id           uuid references public.classes (id) on delete set null,
  subject_id         uuid references public.subjects (id) on delete set null,
  source_id          uuid references public.source_registry (id) on delete set null,
  document_id        uuid references public.source_documents (id) on delete set null,
  academic_session   text,
  year               integer check (year between 1990 and 2100),
  exam_type          text not null default 'board',
  status             text not null default 'queued'
                     check (status in ('queued', 'running', 'extracting', 'classifying',
                                       'deduplicating', 'completed', 'failed', 'needs_review')),
  progress           integer not null default 0 check (progress between 0 and 100),
  questions_found    integer not null default 0,
  questions_imported integer not null default 0,
  duplicates_blocked integer not null default 0,
  low_confidence     integer not null default 0,
  job_id             uuid references public.content_generation_jobs (id) on delete set null,
  error              text,
  created_by         uuid references auth.users (id) on delete set null,
  created_at         timestamptz not null default now(),
  started_at         timestamptz,
  finished_at        timestamptz,
  updated_at         timestamptz not null default now()
);

alter table public.pyq_import_jobs enable row level security;

drop trigger if exists pyq_import_jobs_set_updated_at on public.pyq_import_jobs;
create trigger pyq_import_jobs_set_updated_at
  before update on public.pyq_import_jobs
  for each row execute function public.set_updated_at();

create index if not exists pyq_import_jobs_status_idx on public.pyq_import_jobs (status, created_at desc);

create table if not exists public.paper_metadata (
  id                        uuid primary key default gen_random_uuid(),
  document_id               uuid references public.source_documents (id) on delete cascade,
  source_id                 uuid references public.source_registry (id) on delete set null,
  board_id                  uuid references public.boards (id) on delete set null,
  class_id                  uuid references public.classes (id) on delete set null,
  subject_id                uuid references public.subjects (id) on delete set null,
  year                      integer check (year between 1990 and 2100),
  academic_session          text,
  exam_type                 text not null default 'unknown'
                            check (exam_type in ('board', 'sample', 'unit_test', 'mid_term',
                                                 'pre_board', 'other', 'unknown')),
  paper_set                 text not null default 'unknown',
  language                  text not null default 'unknown',
  marks                     integer,
  duration_minutes          integer,
  question_count            integer,
  official_status           text not null default 'unverified'
                            check (official_status in ('verified_official', 'verified_source_archive',
                                                       'third_party', 'unverified')),
  marking_scheme_document_id uuid references public.source_documents (id) on delete set null,
  sections                  jsonb not null default '[]'::jsonb,
  meta                      jsonb not null default '{}'::jsonb,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

alter table public.paper_metadata enable row level security;

drop trigger if exists paper_metadata_set_updated_at on public.paper_metadata;
create trigger paper_metadata_set_updated_at
  before update on public.paper_metadata
  for each row execute function public.set_updated_at();

create index if not exists paper_metadata_academic_idx on public.paper_metadata (board_id, class_id, subject_id, year);
create unique index if not exists paper_metadata_document_key on public.paper_metadata (document_id) where document_id is not null;

create table if not exists public.extracted_questions (
  id                 uuid primary key default gen_random_uuid(),
  paper_id           uuid references public.paper_metadata (id) on delete cascade,
  document_id        uuid references public.source_documents (id) on delete set null,
  board_id           uuid references public.boards (id) on delete set null,
  class_id           uuid references public.classes (id) on delete set null,
  subject_id         uuid references public.subjects (id) on delete set null,
  chapter_id         uuid references public.chapters (id) on delete set null,
  year               integer check (year between 1990 and 2100),
  question_number    text,
  question_text      text not null,
  question_type      text not null default 'other'
                     check (question_type in ('MCQ', 'assertion_reason', 'short_answer',
                                              'long_answer', 'numerical', 'case_study', 'other')),
  marks              integer,
  difficulty         text default 'moderate' check (difficulty in ('easy', 'moderate', 'hard')),
  topic              text,
  mapping_confidence numeric(5, 2),
  mapping_source     text default 'rule' check (mapping_source in ('ai', 'rule', 'manual')),
  needs_review       boolean not null default false,
  imported_question_id uuid references public.pyq_questions (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

alter table public.extracted_questions enable row level security;

drop trigger if exists extracted_questions_set_updated_at on public.extracted_questions;
create trigger extracted_questions_set_updated_at
  before update on public.extracted_questions
  for each row execute function public.set_updated_at();

create index if not exists extracted_questions_paper_idx  on public.extracted_questions (paper_id);
create index if not exists extracted_questions_chapter_idx on public.extracted_questions (chapter_id, year);
create index if not exists extracted_questions_review_idx on public.extracted_questions (needs_review) where needs_review;

-- ---------------------------------------------------------------------------
-- 14. Engine settings (spec 42/72) — one row, admin-controlled policy
-- ---------------------------------------------------------------------------

create table if not exists public.content_engine_settings (
  id                        boolean primary key default true check (id),
  daily_maintenance_enabled boolean not null default true,
  syllabus_check_enabled    boolean not null default true,
  source_check_interval_hours integer not null default 24 check (source_check_interval_hours between 1 and 720),
  -- Which licence categories the crawler is allowed to store files for.
  storable_licenses         text[] not null default array['official', 'open_license', 'public_domain', 'permission_granted'],
  -- Anything else stays metadata + link only. `restricted` is never stored.
  metadata_only_licenses    text[] not null default array['unknown'],
  blocked_licenses          text[] not null default array['restricted'],
  auto_approve              boolean not null default false,
  max_concurrent_jobs       integer not null default 3 check (max_concurrent_jobs between 1 and 10),
  rate_limit_ms             integer not null default 800 check (rate_limit_ms between 100 and 10000),
  max_crawl_depth           integer not null default 3 check (max_crawl_depth between 0 and 5),
  max_file_mb               integer not null default 25 check (max_file_mb between 1 and 200),
  updated_by                uuid references auth.users (id) on delete set null,
  updated_at                timestamptz not null default now()
);

alter table public.content_engine_settings enable row level security;

insert into public.content_engine_settings (id) values (true)
on conflict (id) do nothing;

drop trigger if exists content_engine_settings_set_updated_at on public.content_engine_settings;
create trigger content_engine_settings_set_updated_at
  before update on public.content_engine_settings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 15. RLS policies
-- ---------------------------------------------------------------------------

-- Source registry -------------------------------------------------------------
drop policy if exists "staff may read sources" on public.source_registry;
create policy "staff may read sources"
  on public.source_registry for select to authenticated
  using (public.has_permission('engine.view'));

drop policy if exists "admins may write sources" on public.source_registry;
create policy "admins may write sources"
  on public.source_registry for insert to authenticated
  with check (public.has_permission('engine.manage'));

drop policy if exists "admins may update sources" on public.source_registry;
create policy "admins may update sources"
  on public.source_registry for update to authenticated
  using (public.has_permission('engine.manage'))
  with check (public.has_permission('engine.manage'));

drop policy if exists "admins may delete sources" on public.source_registry;
create policy "admins may delete sources"
  on public.source_registry for delete to authenticated
  using (public.has_permission('engine.manage'));

-- Discovered documents --------------------------------------------------------
drop policy if exists "staff may read documents" on public.source_documents;
create policy "staff may read documents"
  on public.source_documents for select to authenticated
  using (public.has_permission('engine.view'));

drop policy if exists "admins may write documents" on public.source_documents;
create policy "admins may write documents"
  on public.source_documents for insert to authenticated
  with check (public.has_permission('engine.manage'));

drop policy if exists "admins may update documents" on public.source_documents;
create policy "admins may update documents"
  on public.source_documents for update to authenticated
  using (public.has_permission('engine.manage'))
  with check (public.has_permission('engine.manage'));

drop policy if exists "admins may delete documents" on public.source_documents;
create policy "admins may delete documents"
  on public.source_documents for delete to authenticated
  using (public.has_permission('engine.manage'));

-- Version + crawl telemetry (read-only for staff; written server-side) --------
drop policy if exists "staff may read source versions" on public.source_versions;
create policy "staff may read source versions"
  on public.source_versions for select to authenticated
  using (public.has_permission('engine.view'));

drop policy if exists "staff may read crawl runs" on public.crawl_runs;
create policy "staff may read crawl runs"
  on public.crawl_runs for select to authenticated
  using (public.has_permission('engine.view'));

drop policy if exists "staff may read crawl items" on public.crawl_items;
create policy "staff may read crawl items"
  on public.crawl_items for select to authenticated
  using (public.has_permission('engine.view'));

-- Syllabus discovery ----------------------------------------------------------
drop policy if exists "staff may read syllabus jobs" on public.syllabus_discovery_jobs;
create policy "staff may read syllabus jobs"
  on public.syllabus_discovery_jobs for select to authenticated
  using (public.has_permission('engine.view'));

drop policy if exists "staff may read syllabus change sets" on public.syllabus_change_sets;
create policy "staff may read syllabus change sets"
  on public.syllabus_change_sets for select to authenticated
  using (public.has_permission('engine.view'));

drop policy if exists "admins may review syllabus change sets" on public.syllabus_change_sets;
create policy "admins may review syllabus change sets"
  on public.syllabus_change_sets for update to authenticated
  using (public.has_permission('engine.manage'))
  with check (public.has_permission('engine.manage'));

drop policy if exists "staff may read syllabus change items" on public.syllabus_change_items;
create policy "staff may read syllabus change items"
  on public.syllabus_change_items for select to authenticated
  using (public.has_permission('engine.view'));

drop policy if exists "admins may update syllabus change items" on public.syllabus_change_items;
create policy "admins may update syllabus change items"
  on public.syllabus_change_items for update to authenticated
  using (public.has_permission('engine.manage'))
  with check (public.has_permission('engine.manage'));

-- Chapter maps: readable by any signed-in student, written by the engine ------
drop policy if exists "students may read chapter maps" on public.chapter_maps;
create policy "students may read chapter maps"
  on public.chapter_maps for select to authenticated
  using (true);

drop policy if exists "staff may write chapter maps" on public.chapter_maps;
create policy "staff may write chapter maps"
  on public.chapter_maps for insert to authenticated
  with check (public.has_permission('engine.manage'));

drop policy if exists "staff may update chapter maps" on public.chapter_maps;
create policy "staff may update chapter maps"
  on public.chapter_maps for update to authenticated
  using (public.has_permission('engine.manage'))
  with check (public.has_permission('engine.manage'));

-- Jobs: read for staff, write only through the RPCs / service role ------------
drop policy if exists "staff may read generation jobs" on public.content_generation_jobs;
create policy "staff may read generation jobs"
  on public.content_generation_jobs for select to authenticated
  using (public.has_permission('engine.view'));

-- Generated notes: students see approved/published only; staff see everything.
drop policy if exists "readers may read released notes" on public.generated_notes;
create policy "readers may read released notes"
  on public.generated_notes for select to authenticated
  using (
    status in ('approved', 'published')
    or public.has_permission('engine.view')
  );

drop policy if exists "staff may write generated notes" on public.generated_notes;
create policy "staff may write generated notes"
  on public.generated_notes for insert to authenticated
  with check (public.has_permission('engine.manage'));

drop policy if exists "staff may update generated notes" on public.generated_notes;
create policy "staff may update generated notes"
  on public.generated_notes for update to authenticated
  using (public.has_permission('engine.manage'))
  with check (public.has_permission('engine.manage'));

drop policy if exists "staff may delete generated notes" on public.generated_notes;
create policy "staff may delete generated notes"
  on public.generated_notes for delete to authenticated
  using (public.has_permission('engine.manage'));

-- Sections / items inherit the parent note's visibility.
drop policy if exists "readers may read note sections" on public.note_sections;
create policy "readers may read note sections"
  on public.note_sections for select to authenticated
  using (
    exists (
      select 1 from public.generated_notes n
      where n.id = note_id
        and (n.status in ('approved', 'published') or public.has_permission('engine.view'))
    )
  );

drop policy if exists "staff may write note sections" on public.note_sections;
create policy "staff may write note sections"
  on public.note_sections for insert to authenticated
  with check (public.has_permission('engine.manage'));

drop policy if exists "staff may delete note sections" on public.note_sections;
create policy "staff may delete note sections"
  on public.note_sections for delete to authenticated
  using (public.has_permission('engine.manage'));

drop policy if exists "readers may read note items" on public.note_items;
create policy "readers may read note items"
  on public.note_items for select to authenticated
  using (
    exists (
      select 1 from public.note_sections s
      join public.generated_notes n on n.id = s.note_id
      where s.id = section_id
        and (n.status in ('approved', 'published') or public.has_permission('engine.view'))
    )
  );

drop policy if exists "staff may write note items" on public.note_items;
create policy "staff may write note items"
  on public.note_items for insert to authenticated
  with check (public.has_permission('engine.manage'));

drop policy if exists "staff may delete note items" on public.note_items;
create policy "staff may delete note items"
  on public.note_items for delete to authenticated
  using (public.has_permission('engine.manage'));

drop policy if exists "staff may read note versions" on public.generated_content_versions;
create policy "staff may read note versions"
  on public.generated_content_versions for select to authenticated
  using (public.has_permission('engine.view'));

-- Provenance is deliberately public: it is the "Source / Original URL /
-- Retrieved / Redistribution" block students are shown (spec 51).
drop policy if exists "provenance is publicly readable" on public.source_provenance;
create policy "provenance is publicly readable"
  on public.source_provenance for select
  using (true);

drop policy if exists "staff may write provenance" on public.source_provenance;
create policy "staff may write provenance"
  on public.source_provenance for insert to authenticated
  with check (public.has_permission('engine.manage'));

-- Dependencies + validation ---------------------------------------------------
drop policy if exists "staff may read content dependencies" on public.content_dependencies;
create policy "staff may read content dependencies"
  on public.content_dependencies for select to authenticated
  using (public.has_permission('engine.view'));

drop policy if exists "staff may write content dependencies" on public.content_dependencies;
create policy "staff may write content dependencies"
  on public.content_dependencies for insert to authenticated
  with check (public.has_permission('engine.manage'));

drop policy if exists "staff may read validation results" on public.content_validation_results;
create policy "staff may read validation results"
  on public.content_validation_results for select to authenticated
  using (public.has_permission('engine.view'));

-- PYQ import + paper metadata -------------------------------------------------
drop policy if exists "staff may read pyq import jobs" on public.pyq_import_jobs;
create policy "staff may read pyq import jobs"
  on public.pyq_import_jobs for select to authenticated
  using (public.has_permission('engine.view'));

drop policy if exists "staff may read paper metadata" on public.paper_metadata;
create policy "staff may read paper metadata"
  on public.paper_metadata for select to authenticated
  using (public.has_permission('engine.view') or public.has_permission('pyq.import'));

drop policy if exists "staff may write paper metadata" on public.paper_metadata;
create policy "staff may write paper metadata"
  on public.paper_metadata for insert to authenticated
  with check (public.has_permission('engine.manage'));

drop policy if exists "staff may update paper metadata" on public.paper_metadata;
create policy "admins may update paper metadata"
  on public.paper_metadata for update to authenticated
  using (public.has_permission('engine.manage'))
  with check (public.has_permission('engine.manage'));

-- Extracted questions: released ones are readable, anything needing review is
-- staff-only (an unverified mapping must never reach a student).
drop policy if exists "readers may read released extracted questions" on public.extracted_questions;
create policy "readers may read released extracted questions"
  on public.extracted_questions for select to authenticated
  using (not needs_review or public.has_permission('engine.view'));

drop policy if exists "staff may write extracted questions" on public.extracted_questions;
create policy "staff may write extracted questions"
  on public.extracted_questions for insert to authenticated
  with check (public.has_permission('engine.manage'));

drop policy if exists "staff may update extracted questions" on public.extracted_questions;
create policy "staff may update extracted questions"
  on public.extracted_questions for update to authenticated
  using (public.has_permission('engine.manage'))
  with check (public.has_permission('engine.manage'));

-- Settings --------------------------------------------------------------------
drop policy if exists "staff may read engine settings" on public.content_engine_settings;
create policy "staff may read engine settings"
  on public.content_engine_settings for select to authenticated
  using (public.has_permission('engine.view'));

drop policy if exists "admins may update engine settings" on public.content_engine_settings;
create policy "admins may update engine settings"
  on public.content_engine_settings for update to authenticated
  using (public.has_permission('engine.manage'))
  with check (public.has_permission('engine.manage'));

-- ---------------------------------------------------------------------------
-- 16. Grants (PostgREST only routes tables the role can reach)
-- ---------------------------------------------------------------------------

grant select on
  public.source_registry, public.source_documents, public.source_versions,
  public.crawl_runs, public.crawl_items,
  public.syllabus_discovery_jobs, public.syllabus_change_sets, public.syllabus_change_items,
  public.chapter_maps, public.content_generation_jobs,
  public.generated_notes, public.note_sections, public.note_items,
  public.generated_content_versions, public.content_dependencies,
  public.content_validation_results, public.pyq_import_jobs,
  public.extracted_questions, public.content_engine_settings
to authenticated;

grant insert, update, delete on
  public.source_registry, public.source_documents,
  public.syllabus_change_sets, public.syllabus_change_items,
  public.chapter_maps, public.generated_notes,
  public.note_sections, public.note_items,
  public.content_dependencies, public.source_provenance,
  public.paper_metadata, public.extracted_questions,
  public.content_engine_settings
to authenticated;

-- Public attribution + paper catalogue (Library / PYQ screens are unauth'd).
grant select on public.source_provenance, public.paper_metadata to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 17. Coverage view (spec 67) — one row per board/class/subject
-- ---------------------------------------------------------------------------

create or replace view public.content_coverage
with (security_invoker = true)
as
select
  b.id                                                        as board_id,
  coalesce(b.name, 'Unknown board')                           as board_name,
  c.id                                                        as class_id,
  coalesce(c.name, 'Unknown class')                           as class_name,
  s.id                                                        as subject_id,
  s.name                                                      as subject_name,
  s.slug                                                      as subject_slug,
  count(*)::integer                                           as chapter_count,
  count(*) filter (where exists (
    select 1 from public.generated_notes n
    where n.chapter_id = ch.id and n.note_type = 'notes'
      and n.status in ('approved', 'published')))::integer      as with_notes,
  count(*) filter (where exists (
    select 1 from public.generated_notes n
    where n.chapter_id = ch.id and n.note_type = 'quick_revision'
      and n.status in ('approved', 'published')))::integer      as with_revision,
  count(*) filter (where exists (
    select 1 from public.generated_notes n
    where n.chapter_id = ch.id and n.note_type = 'formula_sheet'
      and n.status in ('approved', 'published')))::integer      as with_formulas,
  count(*) filter (where exists (
    select 1 from public.generated_notes n
    where n.chapter_id = ch.id and n.note_type = 'important_concepts'
      and n.status in ('approved', 'published')))::integer      as with_concepts,
  count(*) filter (where exists (
    select 1 from public.generated_notes n
    where n.chapter_id = ch.id and n.note_type = 'practice_questions'
      and n.status in ('approved', 'published')))::integer      as with_practice,
  count(*) filter (where exists (
    select 1 from public.generated_notes n
    where n.chapter_id = ch.id and n.note_type = 'quiz'
      and n.status in ('approved', 'published')))::integer      as with_quiz,
  count(*) filter (where exists (
    select 1 from public.generated_notes n
    where n.chapter_id = ch.id and n.note_type = 'flashcards'
      and n.status in ('approved', 'published')))::integer      as with_flashcards,
  count(*) filter (where exists (
    select 1 from public.pyq_questions q where q.chapter_id = ch.id))::integer as with_pyqs,
  count(*) filter (where exists (
    select 1 from public.paper_metadata p
    where p.subject_id = s.id))::integer                      as sample_papers,
  -- A chapter is "covered" when it has notes, revision material and PYQs.
  round(
    100.0 * count(*) filter (where
      exists (select 1 from public.generated_notes n
              where n.chapter_id = ch.id and n.note_type = 'notes'
                and n.status in ('approved', 'published'))
      and exists (select 1 from public.generated_notes n
                  where n.chapter_id = ch.id and n.note_type = 'quick_revision'
                    and n.status in ('approved', 'published'))
      and exists (select 1 from public.pyq_questions q where q.chapter_id = ch.id)
    ) / nullif(count(*), 0)
  , 1)::numeric(5, 1)                                        as coverage_percent
from public.chapters ch
join public.subjects s  on s.id = ch.subject_id
join public.classes  c  on c.id = s.class_id
left join public.boards b on b.id = coalesce(s.board_id, (select id from public.boards limit 1))
where not ch.is_archived and not s.is_archived
group by b.id, b.name, c.id, c.name, s.id, s.name, s.slug;

grant select on public.content_coverage to authenticated;

-- ---------------------------------------------------------------------------
-- 18. Engine RPCs
-- ---------------------------------------------------------------------------

-- Dashboard aggregates (spec 66). One round trip, all figures from the DB.
create or replace function public.ce_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v jsonb;
begin
  perform public.ce_require('engine.view');

  select jsonb_build_object(
    'coverage', coalesce((
      select round(avg(coverage_percent))::integer
      from public.content_coverage
      where chapter_count > 0), 0),
    'generated_notes', (select count(*) from public.generated_notes
                          where status in ('approved', 'published')),
    'notes_needing_review', (select count(*) from public.generated_notes
                               where status in ('generated', 'needs_review', 'validation_failed')),
    'verified_pyqs', (select count(*) from public.pyq_questions),
    'sample_papers', (select count(*) from public.paper_metadata),
    'discovered_documents', (select count(*) from public.source_documents),
    'stored_documents', (select count(*) from public.source_documents
                           where retrieval_status = 'stored'),
    'linked_documents', (select count(*) from public.source_documents
                           where retrieval_status = 'linked'),
    'needs_review', (select count(*) from public.syllabus_change_sets
                       where status = 'needs_review')
                  + (select count(*) from public.extracted_questions where needs_review)
                  + (select count(*) from public.generated_notes
                       where status in ('generated', 'needs_review', 'validation_failed')),
    'failed_jobs', (select count(*) from public.content_generation_jobs
                      where status = 'failed'),
    'running_jobs', (select count(*) from public.content_generation_jobs
                       where status in ('queued', 'running', 'paused')),
    'enabled_sources', (select count(*) from public.source_registry where enabled),
    'unavailable_sources', (select count(*) from public.source_registry
                              where source_status = 'unavailable'),
    'broken_links', (select count(*) from public.source_documents
                       where link_status in ('broken', 'timeout')),
    'maintenance', (select jsonb_build_object(
        'daily', daily_maintenance_enabled,
        'syllabus', syllabus_check_enabled,
        'intervalHours', source_check_interval_hours,
        'autoApprove', auto_approve
      ) from content_engine_settings where id)
  ) into v;

  return v;
end;
$$;

-- Coverage per board/class/subject (spec 67).
create or replace function public.ce_coverage(
  p_board_id uuid default null,
  p_class_id uuid default null
)
returns table (
  board_id uuid,
  board_name text,
  class_id uuid,
  class_name text,
  subject_id uuid,
  subject_name text,
  subject_slug text,
  chapter_count integer,
  with_notes integer,
  with_revision integer,
  with_formulas integer,
  with_concepts integer,
  with_practice integer,
  with_quiz integer,
  with_flashcards integer,
  with_pyqs integer,
  sample_papers integer,
  coverage_percent numeric
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  perform public.ce_require('engine.view');

  return query
  select
    v.board_id, v.board_name, v.class_id, v.class_name,
    v.subject_id, v.subject_name, v.subject_slug,
    v.chapter_count, v.with_notes, v.with_revision, v.with_formulas,
    v.with_concepts, v.with_practice, v.with_quiz, v.with_flashcards,
    v.with_pyqs, v.sample_papers, v.coverage_percent
  from public.content_coverage v
  where (p_board_id is null or v.board_id = p_board_id)
    and (p_class_id is null or v.class_id = p_class_id)
  order by v.board_name, v.class_name, v.subject_name;
end;
$$;

-- "Find Missing Content" (spec 68) — only what is genuinely absent.
create or replace function public.ce_missing_content(
  p_board_id uuid default null,
  p_class_id uuid default null,
  p_limit integer default 60
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v jsonb;
begin
  perform public.ce_require('engine.view');

  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into v
  from (
    select
      ch.id as chapter_id,
      ch.name as chapter_name,
      s.name as subject_name,
      c.name as class_name,
      b.name as board_name,
      ch.subject_id,
      ch.class_id,
      s.board_id,
      array_remove(array[
        case when not exists (select 1 from public.generated_notes n
                               where n.chapter_id = ch.id and n.note_type = 'notes'
                                 and n.status in ('approved', 'published', 'generated', 'needs_review'))
             then 'Detailed Notes' end,
        case when not exists (select 1 from public.generated_notes n
                               where n.chapter_id = ch.id and n.note_type = 'quick_revision'
                                 and n.status in ('approved', 'published', 'generated', 'needs_review'))
             then 'Quick Revision' end,
        case when not exists (select 1 from public.generated_notes n
                               where n.chapter_id = ch.id and n.note_type = 'formula_sheet'
                                 and n.status in ('approved', 'published', 'generated', 'needs_review'))
             then 'Formula Sheet' end,
        case when not exists (select 1 from public.generated_notes n
                               where n.chapter_id = ch.id and n.note_type = 'quiz'
                                 and n.status in ('approved', 'published', 'generated', 'needs_review'))
             then 'Quiz' end,
        case when not exists (select 1 from public.generated_notes n
                               where n.chapter_id = ch.id and n.note_type = 'flashcards'
                                 and n.status in ('approved', 'published', 'generated', 'needs_review'))
             then 'Flashcards' end,
        case when not exists (select 1 from public.pyq_questions q where q.chapter_id = ch.id)
             then 'PYQs' end
      ], null) as missing
    from public.chapters ch
    join public.subjects s on s.id = ch.subject_id
    join public.classes  c on c.id = s.class_id
    left join public.boards b on b.id = s.board_id
    where not ch.is_archived
      and not s.is_archived
      and (p_board_id is null or s.board_id = p_board_id)
      and (p_class_id is null or s.class_id = p_class_id)
    order by b.name, c.display_order, s.display_order, ch.display_order
    limit greatest(1, coalesce(p_limit, 60))
  ) t
  where jsonb_array_length(to_jsonb(t.missing)) > 0;

  return coalesce(v, '[]'::jsonb);
end;
$$;

-- Daily Content Health report (spec 69).
create or replace function public.ce_health()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v jsonb;
begin
  perform public.ce_require('engine.view');

  select jsonb_build_object(
    'generatedAt', now(),
    'sources', jsonb_build_object(
      'total', (select count(*) from public.source_registry),
      'enabled', (select count(*) from public.source_registry where enabled),
      'unavailable', (select count(*) from public.source_registry
                        where source_status = 'unavailable'),
      'stale', (select count(*) from public.source_registry
                  where enabled and (last_checked_at is null
                        or last_checked_at < now() - make_interval(hours => source_check_interval_hours)))
    ),
    'links', jsonb_build_object(
      'checked', (select count(*) from public.source_documents
                    where link_status <> 'unchecked'),
      'broken', (select count(*) from public.source_documents
                   where link_status in ('broken', 'timeout'))
    ),
    'content', jsonb_build_object(
      'missingChapters', (select count(*) from public.chapters ch
        where not ch.is_archived and not exists (
          select 1 from public.generated_notes n
          where n.chapter_id = ch.id and n.status in ('approved', 'published'))),
      'failedJobs', (select count(*) from public.content_generation_jobs
                       where status = 'failed'),
      'stalePapers', (select count(*) from public.source_documents
                        where doc_kind in ('sample_paper', 'question_paper')
                          and link_status = 'broken'),
      'failedEmbeddings', (select count(*) from public.embedding_jobs
                             where status = 'failed')
    ),
    'reviews', jsonb_build_object(
      'notes', (select count(*) from public.generated_notes
                  where status in ('generated', 'needs_review', 'validation_failed')),
      'syllabusChanges', (select count(*) from public.syllabus_change_sets
                            where status = 'needs_review'),
      'questionMappings', (select count(*) from public.extracted_questions where needs_review)
    )
  ) into v;

  return v;
end;
$$;

-- Queue control (spec 40/62/65). Students cannot reach this: there is no
-- INSERT policy on the jobs table, and this function re-checks the permission.
create or replace function public.ce_enqueue_job(
  p_job_type text,
  p_params jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.content_generation_jobs%rowtype;
begin
  perform public.ce_require('engine.manage');

  insert into public.content_generation_jobs (
    job_type, board_id, class_id, stream_id, subject_id, chapter_id,
    source_id, document_id, academic_session, depth, params,
    priority, steps_total, created_by
  )
  values (
    p_job_type,
    nullif(p_params->>'boardId', '')::uuid,
    nullif(p_params->>'classId', '')::uuid,
    nullif(p_params->>'streamId', '')::uuid,
    nullif(p_params->>'subjectId', '')::uuid,
    nullif(p_params->>'chapterId', '')::uuid,
    nullif(p_params->>'sourceId', '')::uuid,
    nullif(p_params->>'documentId', '')::uuid,
    nullif(p_params->>'academicSession', ''),
    case when p_params->>'depth' in ('quick','standard','detailed','exam_master')
         then p_params->>'depth' end,
    coalesce(p_params, '{}'::jsonb),
    coalesce(nullif(p_params->>'priority', '')::integer, 100),
    coalesce(nullif(p_params->>'stepsTotal', '')::integer, 0),
    auth.uid()
  )
  returning * into v_job;

  return to_jsonb(v_job);
end;
$$;

create or replace function public.ce_control_job(p_job_id uuid, p_action text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.content_generation_jobs%rowtype;
begin
  perform public.ce_require('engine.manage');

  if p_action not in ('run', 'pause', 'resume', 'cancel', 'retry') then
    raise exception 'Unknown job action.' using errcode = '22023';
  end if;

  update public.content_generation_jobs
  set status = case p_action
                 when 'run'    then 'queued'
                 when 'pause'  then 'paused'
                 when 'resume' then 'queued'
                 when 'cancel' then 'cancelled'
                 when 'retry'  then 'queued'
               end,
      error = case when p_action in ('run', 'retry', 'resume') then null else error end,
      priority = case when p_action = 'run' then 10 else priority end,
      locked_at = null,
      locked_by = null,
      updated_at = now()
  where id = p_job_id
  returning * into v_job;

  if v_job.id is null then
    raise exception 'That job no longer exists.' using errcode = 'P0002';
  end if;

  return to_jsonb(v_job);
end;
$$;

-- Review decision for generated notes (spec 50).
create or replace function public.ce_review_note(
  p_note_id uuid,
  p_decision text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_note public.generated_notes%rowtype;
  v_status text;
begin
  perform public.ce_require('engine.manage');

  v_status := case p_decision
    when 'approve'  then 'approved'
    when 'publish'  then 'published'
    when 'reject'   then 'blocked'
    when 'archive'  then 'archived'
    when 'reprocess'then 'processing'
    else null end;

  if v_status is null then
    raise exception 'Unknown review decision.' using errcode = '22023';
  end if;

  update public.generated_notes
  set status = v_status,
      review_note = coalesce(p_note, review_note),
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      published_at = case when v_status = 'published' then now() else published_at end,
      updated_at = now()
  where id = p_note_id
  returning * into v_note;

  if v_note.id is null then
    raise exception 'That note no longer exists.' using errcode = 'P0002';
  end if;

  return to_jsonb(v_note);
end;
$$;

-- Approve + apply a syllabus change set (spec 7/8).
-- Only the approved diff touches the hierarchy; nothing is overwritten silently.
create or replace function public.ce_apply_syllabus_changes(p_change_set_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_set public.syllabus_change_sets%rowtype;
  v_item public.syllabus_change_items%rowtype;
  v_added integer := 0;
  v_renamed integer := 0;
  v_reordered integer := 0;
  v_new_id uuid;
  v_slug text;
  v_order integer;
begin
  perform public.ce_require('engine.manage');

  select * into v_set from public.syllabus_change_sets where id = p_change_set_id;
  if v_set.id is null then
    raise exception 'That change set no longer exists.' using errcode = 'P0002';
  end if;
  if v_set.status = 'applied' then
    return to_jsonb(v_set);
  end if;
  if v_set.subject_id is null then
    raise exception 'This change set has no resolved subject.' using errcode = 'P0002';
  end if;

  for v_item in
    select * from public.syllabus_change_items
    where change_set_id = p_change_set_id and not applied
    order by created_at
  loop
    if v_item.entity = 'chapter' and v_item.change_type = 'added' then
      v_slug := public.ce_slugify(coalesce(v_item.discovered_name, v_item.existing_name));
      select display_order into v_order
      from public.chapters
      where subject_id = v_set.subject_id and slug = v_slug;

      if v_order is null then
        insert into public.chapters (
          subject_id, slug, name, chapter_number, display_order, topics
        ) values (
          v_set.subject_id,
          v_slug,
          coalesce(v_item.discovered_name, v_item.existing_name),
          coalesce(nullif(v_item.details->>'order', '')::integer, 0),
          coalesce(nullif(v_item.details->>'order', '')::integer, 0),
          '{}'
        ) returning id into v_new_id;
        v_added := v_added + 1;
      end if;

    elsif v_item.entity = 'chapter' and v_item.change_type = 'renamed'
          and v_item.existing_id is not null then
      update public.chapters
      set name = coalesce(v_item.discovered_name, name),
          updated_at = now()
      where id = v_item.existing_id and subject_id = v_set.subject_id;
      if found then v_renamed := v_renamed + 1; end if;

    elsif v_item.entity = 'chapter' and v_item.change_type in ('reordered', 'moved')
          and v_item.existing_id is not null then
      v_order := nullif(v_item.details->>'order', '')::integer;
      if v_order is not null then
        update public.chapters
        set display_order = v_order,
            chapter_number = case when v_order > 0 then v_order else chapter_number end,
            updated_at = now()
        where id = v_item.existing_id;
        if found then v_reordered := v_reordered + 1; end if;
      end if;
    end if;

    update public.syllabus_change_items set applied = true where id = v_item.id;
  end loop;

  update public.syllabus_change_sets
  set status = 'applied',
      applied_at = now(),
      reviewed_by = coalesce(reviewed_by, auth.uid()),
      reviewed_at = coalesce(reviewed_at, now()),
      summary = summary || jsonb_build_object(
        'appliedAdded', v_added, 'appliedRenamed', v_renamed, 'appliedReordered', v_reordered),
      updated_at = now()
  where id = p_change_set_id
  returning * into v_set;

  return jsonb_build_object(
    'changeSet', to_jsonb(v_set),
    'added', v_added,
    'renamed', v_renamed,
    'reordered', v_reordered
  );
end;
$$;

-- Atomic queue claim for the edge worker (spec 40/62). SECURITY DEFINER and
-- granted ONLY to the service role: an authenticated student can never pull a
-- job out of the queue, and two workers can never claim the same row.
create or replace function public.ce_claim_jobs(p_limit integer default 1, p_worker text default 'edge')
returns setof public.content_generation_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with claimed as (
    select id
    from public.content_generation_jobs
    where status = 'queued'
      and (locked_at is null or locked_at < now() - interval '15 minutes')
    order by priority asc, created_at asc
    limit greatest(1, least(coalesce(p_limit, 1), 20))
    for update skip locked
  )
  update public.content_generation_jobs j
  set status     = 'running',
      attempts   = j.attempts + 1,
      locked_at  = now(),
      locked_by  = left(coalesce(p_worker, 'edge'), 64),
      started_at = coalesce(j.started_at, now()),
      error      = null
  from claimed c
  where j.id = c.id
  returning j.*;
end;
$$;

revoke all on function public.ce_stats() from public;
revoke all on function public.ce_coverage(uuid, uuid) from public;
revoke all on function public.ce_missing_content(uuid, uuid, integer) from public;
revoke all on function public.ce_health() from public;
revoke all on function public.ce_enqueue_job(text, jsonb) from public;
revoke all on function public.ce_control_job(uuid, text) from public;
revoke all on function public.ce_review_note(uuid, text, text) from public;
revoke all on function public.ce_apply_syllabus_changes(uuid) from public;
revoke all on function public.ce_claim_jobs(integer, text) from public;
revoke all on function public.ce_claim_jobs(integer, text) from anon;
revoke all on function public.ce_claim_jobs(integer, text) from authenticated;

grant execute on function public.ce_stats() to authenticated;
grant execute on function public.ce_coverage(uuid, uuid) to authenticated;
grant execute on function public.ce_missing_content(uuid, uuid, integer) to authenticated;
grant execute on function public.ce_health() to authenticated;
grant execute on function public.ce_enqueue_job(text, jsonb) to authenticated;
grant execute on function public.ce_control_job(uuid, text) to authenticated;
grant execute on function public.ce_review_note(uuid, text, text) to authenticated;
grant execute on function public.ce_apply_syllabus_changes(uuid) to authenticated;
grant execute on function public.ce_claim_jobs(integer, text) to service_role;
