-- =============================================================================
-- StudyOS · 0003 — profiles (+ notifications) and the sign-up trigger
-- =============================================================================
-- `profiles` holds one row per auth.users record (src/types/auth.ts ProfileRow).
-- A row is created automatically by handle_new_user() on sign-up; the app's
-- ensureProfile() is only a safety net for older accounts and OAuth metadata.
-- Onboarding choices (board / class / stream / daily goal) are stored on the
-- profile itself — the app never keeps a separate onboarding table.
-- =============================================================================

create table public.profiles (
  id                 uuid primary key references auth.users (id) on delete cascade,
  full_name          text,
  username           text,
  avatar_url         text,
  bio                text,
  board_id           uuid references public.boards (id) on delete set null,
  class_id           uuid references public.classes (id) on delete set null,
  stream_id          uuid references public.streams (id) on delete set null,
  school             text,
  target_exam        text,
  exam_date          date,
  daily_goal_minutes integer not null default 120,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- Private, per-user notifications (nothing in the current UI reads them yet,
-- but the rows exist for future use and stay owner-only under RLS).
create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  title      text not null,
  body       text,
  link       text,
  read       boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.notifications enable row level security;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- handle_new_user: mirror the OAuth / sign-up metadata into a fresh profile.
-- security definer + fixed search_path, as required for auth triggers.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture'),
    case
      when new.email is not null then
        regexp_replace(lower(split_part(new.email, '@', 1)), '[^a-z0-9._-]', '', 'g')
      else null
    end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
