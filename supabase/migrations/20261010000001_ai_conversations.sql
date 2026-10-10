-- =============================================================================
-- StudyOS · 0010 — AI conversations + messages
-- =============================================================================
-- The AI Tutor persists its threads here. Two tables only:
--
--   ai_conversations -> one chat thread (title, focus subject/chapter, rolling
--                       summary of the older half of the conversation)
--   ai_messages      -> user / assistant / system turns with a `metadata`
--                       jsonb blob (sources, confidence, related questions,
--                       token counts, hint progress …)
--
-- Rules:
--   * strictly owner-only under RLS — a conversation and every message inside
--     it belongs to auth.uid(); the edge functions additionally scope their
--     queries by user id (defence in depth);
--   * NO provider credentials, API keys or private prompts are ever stored —
--     `metadata` holds display data only (see src/ai/types);
--   * `summary` + `summary_message_count` implement context-window management:
--     everything older than the recent window is folded into one paragraph.
-- =============================================================================

create table public.ai_conversations (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users (id) on delete cascade,
  title                 text not null default 'New chat'
                        check (char_length(title) between 1 and 160),
  subject_id            uuid references public.subjects (id) on delete set null,
  chapter_id            uuid references public.chapters (id) on delete set null,
  mode                  text not null default 'explain',
  summary               text,
  summary_message_count integer not null default 0 check (summary_message_count >= 0),
  message_count         integer not null default 0 check (message_count >= 0),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create table public.ai_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,
  role            text not null check (role in ('user', 'assistant', 'system')),
  content         text not null default '',
  mode            text,
  -- Display-only payload: { sources[], confidence, relatedQuestions[], hint, … }
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;

create trigger ai_conversations_set_updated_at
  before update on public.ai_conversations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS — owner only, on both tables. A message is only visible when BOTH the
-- message row and its parent conversation belong to the caller, so a leaked
-- conversation id can never expose another student's chat.
-- ---------------------------------------------------------------------------
drop policy if exists "ai conversations are owner-only" on public.ai_conversations;
create policy "ai conversations are owner-only"
  on public.ai_conversations for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "ai messages are owner-only" on public.ai_messages;
create policy "ai messages are owner-only"
  on public.ai_messages for all to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.ai_conversations c
      where c.id = conversation_id and c.user_id = auth.uid()
    )
  )
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.ai_conversations c
      where c.id = conversation_id and c.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Grants (RLS does the filtering) — the client reads/writes its own threads,
-- the edge functions work through the service role.
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on public.ai_conversations to authenticated;
grant select, insert, update, delete on public.ai_messages to authenticated;

-- ---------------------------------------------------------------------------
-- Indexes: recent-thread lists, title search, per-thread history.
-- ---------------------------------------------------------------------------
create index if not exists ai_conversations_user_updated_idx
  on public.ai_conversations (user_id, updated_at desc);
create index if not exists ai_conversations_user_created_idx
  on public.ai_conversations (user_id, created_at desc);
create index if not exists ai_conversations_title_lower_idx
  on public.ai_conversations (lower(title));
create index if not exists ai_conversations_subject_idx on public.ai_conversations (subject_id);
create index if not exists ai_conversations_chapter_idx on public.ai_conversations (chapter_id);

create index if not exists ai_messages_conversation_idx
  on public.ai_messages (conversation_id, created_at);
create index if not exists ai_messages_user_created_idx
  on public.ai_messages (user_id, created_at desc);
create index if not exists ai_messages_metadata_sources_idx
  on public.ai_messages using gin (metadata jsonb_path_ops);

-- ---------------------------------------------------------------------------
-- set_conversation_title: the edge function derives a short title from the
-- first message. Kept as an RPC so the client never writes server-generated
-- text fields directly.
-- ---------------------------------------------------------------------------
create or replace function public.ai_set_conversation_title(p_id uuid, p_title text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.ai_conversations
     set title = left(trim(p_title), 120)
   where id = p_id
     and user_id = auth.uid();
end;
$$;

grant execute on function public.ai_set_conversation_title(uuid, text) to authenticated;
