-- =============================================================================
-- StudyOS · 0001 — extensions & shared helpers
-- =============================================================================
-- gen_random_uuid() is built into PostgreSQL >= 13; pgcrypto is installed when
-- possible so older local databases behave identically.
-- =============================================================================

do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pgcrypto') then
    if exists (select 1 from pg_namespace where nspname = 'extensions') then
      execute 'create extension pgcrypto with schema extensions';
    else
      execute 'create extension pgcrypto';
    end if;
  end if;
end
$$;

grant usage on schema public to anon, authenticated;

-- Shared BEFORE UPDATE trigger keeping every updated_at honest.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
