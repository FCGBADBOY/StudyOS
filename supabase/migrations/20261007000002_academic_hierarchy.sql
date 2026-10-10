-- =============================================================================
-- StudyOS · 0002 — academic hierarchy: boards -> classes -> streams -> subjects -> chapters
-- =============================================================================
-- Nothing is hard-coded to CBSE: every level is data. subjects.board_id and
-- subjects.stream_id are nullable so a subject can be shared across boards
-- and streams (e.g. English & Mathematics belong to Science, Commerce and
-- Humanities at once — the app includes subjects whose stream_id is null in
-- every stream, see src/services/academic.service.ts getStreams()).
--
-- Columns consumed by the app (src/types/academic.ts):
--   boards(id, slug, name, short_name, description, display_order)
--   classes(id, slug, name, description, display_order, senior)
--   streams(id, slug, name, description, display_order)
--   subjects(id, slug, class_id, stream_id, board_id, name, code, description, display_order)
--   chapters(id, subject_id, slug, name, chapter_number, description,
--            display_order, difficulty, estimated_minutes, topics)
-- =============================================================================

create table public.boards (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  name          text not null,
  short_name    text not null,
  description   text,
  display_order integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.classes (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  name          text not null,
  description   text,
  display_order integer not null default 0,
  senior        boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.streams (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  name          text not null,
  description   text,
  display_order integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.subjects (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null,
  class_id      uuid not null references public.classes (id) on delete cascade,
  board_id      uuid references public.boards (id) on delete set null,
  stream_id     uuid references public.streams (id) on delete set null,
  name          text not null,
  code          text,
  description   text,
  display_order integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint subjects_class_slug_key unique (class_id, slug)
);

create table public.chapters (
  id                uuid primary key default gen_random_uuid(),
  subject_id        uuid not null references public.subjects (id) on delete cascade,
  slug              text not null,
  name              text not null,
  chapter_number    integer not null default 0,
  description       text,
  display_order     integer not null default 0,
  difficulty        text not null default 'Moderate'
                    check (difficulty in ('Easy', 'Moderate', 'Hard')),
  estimated_minutes integer not null default 120,
  topics            text[] not null default '{}',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint chapters_subject_slug_key unique (subject_id, slug)
);

-- ---------------------------------------------------------------------------
-- Row Level Security is enabled at creation; policies live in 0009_rls_indexes.
-- Academic data is publicly readable (policy added in 0009).
-- ---------------------------------------------------------------------------
alter table public.boards enable row level security;
alter table public.classes enable row level security;
alter table public.streams enable row level security;
alter table public.subjects enable row level security;
alter table public.chapters enable row level security;

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
create trigger boards_set_updated_at
  before update on public.boards
  for each row execute function public.set_updated_at();

create trigger classes_set_updated_at
  before update on public.classes
  for each row execute function public.set_updated_at();

create trigger streams_set_updated_at
  before update on public.streams
  for each row execute function public.set_updated_at();

create trigger subjects_set_updated_at
  before update on public.subjects
  for each row execute function public.set_updated_at();

create trigger chapters_set_updated_at
  before update on public.chapters
  for each row execute function public.set_updated_at();
