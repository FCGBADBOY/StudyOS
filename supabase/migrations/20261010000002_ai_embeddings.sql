-- =============================================================================
-- StudyOS · 0011 — RAG: pgvector, document_chunks, embedding_jobs, search RPCs
-- =============================================================================
-- The retrieval layer for the AI Tutor. Academic content (notes, revision
-- notes, formula sheets, important questions, PYQ solutions, approved admin
-- copy) is chunked at *logical* boundaries by the embedding worker
-- (supabase/functions/_shared/retrieval/chunk.ts) and stored here as vectors.
--
--   document_chunks -> one row per meaningful chunk, with full academic metadata
--   embedding_jobs  -> async pipeline (pending → processing → completed/failed)
--                      so an admin's browser is never blocked by a big PDF
--
-- EMBEDDING DIMENSION
-- -------------------
-- The dimension is NOT hard-coded to a guess. It is read from the
-- `studyos.embedding_dim` setting when the migration runs and defaults to
-- 1536 — the dimension of the default server-side embedding model
-- (`AI_EMBEDDING_MODEL=text-embedding-3-small`, see .env.example).
-- To use a different model, set the dimension BEFORE applying this file:
--
--   alter database "<your-db>" set studyos.embedding_dim = '768';   -- e.g. MiniLM
--
-- and export the matching AI_EMBEDDING_DIM / AI_EMBEDDING_MODEL to the edge
-- functions. public.studyos_embedding_dim() exposes the live value and the
-- embedding worker refuses to write vectors of the wrong size.
-- =============================================================================

-- pgvector (Supabase ships it; install locally when missing).
do $$
begin
  if not exists (select 1 from pg_extension where extname = 'vector') then
    begin
      execute 'create extension vector with schema extensions';
    exception when others then
      execute 'create extension vector';
    end if;
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Admin capability — reused from the role system added by
-- 20261010000001_admin_roles_permissions.sql (`profiles.role` + has_permission()).
-- Nothing is redefined here: embedding jobs are visible to any staff role
-- via public.is_admin_user(), AI analytics via has_permission('analytics.view').
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- document_chunks
-- ---------------------------------------------------------------------------
create table public.document_chunks (
  id             uuid primary key default gen_random_uuid(),
  resource_id    uuid references public.resources (id) on delete cascade,
  chapter_id     uuid references public.chapters (id) on delete cascade,
  subject_id     uuid references public.subjects (id) on delete set null,
  board_id       uuid references public.boards (id) on delete set null,
  class_id       uuid references public.classes (id) on delete set null,
  content        text not null check (char_length(content) between 1 and 8000),
  chunk_index    integer not null default 0 check (chunk_index >= 0),
  token_count    integer not null default 0 check (token_count >= 0),
  section_title  text,
  -- logical boundary the chunker chose: heading | subtopic | paragraph |
  -- definition | formula | example | question | solution | chapter_description
  content_kind   text not null default 'paragraph',
  -- denormalised resource_type so retrieval can filter without a join
  source_type    text,
  embedding      vector,
  -- keyword leg of the hybrid search (english stems), maintained automatically
  content_tsv    tsvector generated always as (to_tsvector('english', content)) stored,
  metadata       jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint document_chunks_resource_chunk_key unique (resource_id, chunk_index),
  constraint document_chunks_resource_or_chapter_check
    check (resource_id is not null or chapter_id is not null)
);

alter table public.document_chunks enable row level security;

create trigger document_chunks_set_updated_at
  before update on public.document_chunks
  for each row execute function public.set_updated_at();

-- Apply the configured embedding dimension (see header comment).
do $$
declare
  v_dim integer := null;
begin
  begin
    v_dim := nullif(current_setting('studyos.embedding_dim', true), '')::integer;
  exception when others then
    v_dim := null;
  end;
  if v_dim is null or v_dim < 8 or v_dim > 8192 then
    v_dim := 1536; -- default server-side embedding model
  end if;
  execute format('alter table public.document_chunks alter column embedding type vector(%s)', v_dim);
end
$$;

-- ---------------------------------------------------------------------------
-- embedding_jobs — asynchronous embedding pipeline with bounded retries.
-- ---------------------------------------------------------------------------
create table public.embedding_jobs (
  id            uuid primary key default gen_random_uuid(),
  resource_id   uuid references public.resources (id) on delete cascade,
  chapter_id    uuid references public.chapters (id) on delete cascade,
  status        text not null default 'pending'
                check (status in ('pending', 'processing', 'completed', 'failed')),
  scope         text not null default 'resource'
                check (scope in ('resource', 'chapter', 'rebuild_all')),
  attempts      integer not null default 0 check (attempts >= 0),
  max_attempts  integer not null default 3 check (max_attempts between 1 and 10),
  last_error    text,
  chunks_total  integer not null default 0,
  chunks_done   integer not null default 0,
  requested_by  uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  completed_at  timestamptz,
  constraint embedding_jobs_scope_target_check
    check (scope = 'rebuild_all' or resource_id is not null or chapter_id is not null)
);

alter table public.embedding_jobs enable row level security;

create trigger embedding_jobs_set_updated_at
  before update on public.embedding_jobs
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
--   document_chunks  — public academic content only. The policy mirrors the
--                      underlying resource permission: an unpublished/draft
--                      resource's chunks are invisible to anon + authenticated
--                      clients (and RLS stays on for the search RPC, which is
--                      `security invoker`). The service-role edge functions
--                      enforce the same rule in SQL regardless.
--   embedding_jobs   — admin-only (public.is_admin(), added in migration 0015).
-- ---------------------------------------------------------------------------
drop policy if exists "published chunks are readable" on public.document_chunks;
create policy "published chunks are readable"
  on public.document_chunks for select to anon, authenticated
  using (
    (resource_id is null and chapter_id is not null)
    or exists (
      select 1 from public.resources r
      where r.id = document_chunks.resource_id and r.is_published
    )
  );

drop policy if exists "embedding jobs are admin-only" on public.embedding_jobs;
create policy "embedding jobs are admin-only"
  on public.embedding_jobs for select to authenticated
  using (public.is_admin_user());

grant select on public.document_chunks to anon, authenticated;
grant select on public.embedding_jobs to authenticated;

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
create index if not exists document_chunks_chapter_idx on public.document_chunks (chapter_id);
create index if not exists document_chunks_subject_idx on public.document_chunks (subject_id);
create index if not exists document_chunks_resource_idx on public.document_chunks (resource_id);
create index if not exists document_chunks_board_idx on public.document_chunks (board_id);
create index if not exists document_chunks_class_idx on public.document_chunks (class_id);
create index if not exists document_chunks_source_type_idx on public.document_chunks (source_type);
create index if not exists document_chunks_tsv_idx on public.document_chunks using gin (content_tsv);
create index if not exists document_chunks_metadata_idx on public.document_chunks using gin (metadata jsonb_path_ops);

-- Vector index: HNSW (better recall than IVFFlat, works on empty tables, no
-- rebuild needed as data arrives). Falls back to IVFFlat on old pgvector builds.
do $$
begin
  execute 'create index if not exists document_chunks_embedding_hnsw_idx
             on public.document_chunks using hnsw (embedding vector_cosine_ops)';
exception when others then
  execute 'create index if not exists document_chunks_embedding_ivfflat_idx
             on public.document_chunks using ivfflat (embedding vector_cosine_ops) with (lists = 100)';
end
$$;

create index if not exists embedding_jobs_status_idx on public.embedding_jobs (status, updated_at desc);
create index if not exists embedding_jobs_resource_idx on public.embedding_jobs (resource_id);
create index if not exists embedding_jobs_chapter_idx on public.embedding_jobs (chapter_id);

-- ---------------------------------------------------------------------------
-- studyos_embedding_dim() — the dimension this database expects. The embedding
-- worker compares it with AI_EMBEDDING_DIM and refuses mismatched vectors.
-- ---------------------------------------------------------------------------
create or replace function public.studyos_embedding_dim()
returns integer
language sql
stable
as $$
  select coalesce(
    nullif((
      select a.atttypmod
        from pg_attribute a
       where a.attrelid = 'public.document_chunks'::regclass
         and a.attname = 'embedding'
    ), -1),
    case when coalesce(nullif(current_setting('studyos.embedding_dim', true), ''), '1536')::integer < 8
         then 1536
         else current_setting('studyos.embedding_dim', true)::integer end
  );
$$;

-- ---------------------------------------------------------------------------
-- search_document_chunks — hybrid retrieval (vector similarity + keyword rank)
-- with academic filters. `security invoker` so RLS is never bypassed: draft
-- resources stay invisible even though the function runs arbitrary SQL.
-- ---------------------------------------------------------------------------
create or replace function public.search_document_chunks(
  p_query          text   default null,
  p_embedding      vector default null,
  p_board_id       uuid   default null,
  p_class_id       uuid   default null,
  p_subject_id     uuid   default null,
  p_chapter_id     uuid   default null,
  p_resource_type  text   default null,
  p_limit          integer default 6
)
returns table (
  id             uuid,
  content        text,
  chunk_index    integer,
  token_count    integer,
  section_title  text,
  content_kind   text,
  resource_id    uuid,
  chapter_id     uuid,
  subject_id     uuid,
  board_id       uuid,
  class_id       uuid,
  resource_type  text,
  chapter_name   text,
  subject_name   text,
  resource_title text,
  metadata       jsonb,
  score          double precision
)
language sql
stable
set search_path = public
as $$
  with filtered as (
    select
      dc.*,
      ch.name  as chapter_name,
      s.name   as subject_name,
      r.title  as resource_title,
      coalesce(dc.source_type, r.resource_type) as effective_type
    from public.document_chunks dc
    left join public.resources r      on r.id = dc.resource_id
    left join public.chapters ch      on ch.id = dc.chapter_id
    left join public.subjects s       on s.id = dc.subject_id
    where (dc.resource_id is null or coalesce(r.is_published, false))
      and (p_board_id       is null or dc.board_id = p_board_id)
      and (p_class_id       is null or dc.class_id = p_class_id)
      and (p_subject_id     is null or dc.subject_id = p_subject_id)
      and (p_chapter_id     is null or dc.chapter_id = p_chapter_id)
      and (p_resource_type  is null or coalesce(dc.source_type, r.resource_type) = p_resource_type)
      and (
        p_query is null or length(trim(p_query)) = 0
        or dc.content_tsv @@ websearch_to_tsquery('english', p_query)
        or dc.content ilike '%' || left(regexp_replace(trim(p_query), '\s+', ' ', 'g'), 120) || '%'
      )
  ),
  scored as (
    select
      f.*,
      case
        when p_embedding is null then 0.0
        else coalesce(1 - (f.embedding <=> p_embedding), 0.0)
      end as vector_score,
      case
        when p_query is null or length(trim(p_query)) = 0 then 0.0
        else coalesce(ts_rank_cd(f.content_tsv, websearch_to_tsquery('english', p_query)), 0.0)
      end as keyword_score
    from filtered f
  )
  select
    sc.id, sc.content, sc.chunk_index, sc.token_count, sc.section_title, sc.content_kind,
    sc.resource_id, sc.chapter_id, sc.subject_id, sc.board_id, sc.class_id,
    sc.effective_type as resource_type,
    sc.chapter_name, sc.subject_name, sc.resource_title, sc.metadata,
    (
      case when p_embedding is null then sc.keyword_score
           else (0.7 * sc.vector_score) + (0.3 * least(sc.keyword_score, 1.0)) end
    )::double precision as score
  from scored sc
  order by score desc, sc.chunk_index
  limit least(greatest(coalesce(p_limit, 6), 1), 20);
$$;

-- ---------------------------------------------------------------------------
-- search_pyq_questions — the PYQ leg of hybrid retrieval. Pure keyword/label
-- search over the (public) archive with the same academic filters. Never
-- fabricates: it only returns rows that exist in pyq_questions.
-- ---------------------------------------------------------------------------
create or replace function public.search_pyq_questions(
  p_query         text   default null,
  p_board_id      uuid   default null,
  p_class_id      uuid   default null,
  p_subject_id    uuid   default null,
  p_chapter_id    uuid   default null,
  p_year          integer default null,
  p_marks         integer default null,
  p_limit         integer default 8
)
returns table (
  id            uuid,
  year          integer,
  exam_type     text,
  question_text text,
  question_type text,
  paper_set     text,
  marks         integer,
  difficulty    text,
  concepts      text[],
  chapter_id    uuid,
  chapter_name  text,
  subject_id    uuid,
  subject_name  text,
  board_id      uuid,
  score         double precision
)
language sql
stable
set search_path = public
as $$
  select
    q.id, q.year, q.exam_type, q.question_text, q.question_type, q.paper_set,
    q.marks, q.difficulty, q.concepts, q.chapter_id, ch.name as chapter_name,
    coalesce(q.subject_id, ch.subject_id) as subject_id, s.name as subject_name,
    q.board_id,
    case
      when p_query is null or length(trim(p_query)) = 0 then 1.0
      else greatest(
        coalesce(ts_rank_cd(
          to_tsvector('english', q.question_text || ' ' || array_to_string(coalesce(q.concepts, '{}'), ' ')),
          websearch_to_tsquery('english', p_query)
        ), 0.0),
        case when q.question_text ilike '%' || left(trim(p_query), 120) || '%' then 0.5 else 0.0 end
      )
    end::double precision as score
  from public.pyq_questions q
  left join public.chapters ch on ch.id = q.chapter_id
  left join public.subjects s  on s.id = coalesce(q.subject_id, ch.subject_id)
  where (p_board_id   is null or q.board_id = p_board_id)
    and (p_class_id   is null or q.class_id = p_class_id)
    and (p_subject_id is null or coalesce(q.subject_id, ch.subject_id) = p_subject_id)
    and (p_chapter_id is null or q.chapter_id = p_chapter_id)
    and (p_year       is null or q.year = p_year)
    and (p_marks      is null or q.marks = p_marks)
    and (
      p_query is null or length(trim(p_query)) = 0
      or to_tsvector('english', q.question_text || ' ' || array_to_string(coalesce(q.concepts, '{}'), ' '))
         @@ websearch_to_tsquery('english', p_query)
      or q.question_text ilike '%' || left(trim(p_query), 120) || '%'
      or exists (
        select 1 from unnest(coalesce(q.concepts, '{}')) c
        where c ilike '%' || left(trim(p_query), 120) || '%'
      )
    )
  order by score desc, q.year desc
  limit least(greatest(coalesce(p_limit, 8), 1), 50);
$$;

grant execute on function public.studyos_embedding_dim() to anon, authenticated;
grant execute on function public.search_document_chunks(text, vector, uuid, uuid, uuid, uuid, text, integer) to anon, authenticated;
grant execute on function public.search_pyq_questions(text, uuid, uuid, uuid, uuid, integer, integer, integer) to anon, authenticated;
