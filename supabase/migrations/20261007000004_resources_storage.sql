-- =============================================================================
-- StudyOS · 0004 — resources + storage buckets
-- =============================================================================
-- `resources` rows describe *what* a resource is; Supabase Storage holds the
-- file itself (path convention: resources/<board>/<class>/<subject>/<chapter>/<file>,
-- avatars/<user-id>/avatar.<ext>). The app reads files through signed URLs
-- (resource.service.ts) and public URLs for avatars (profile.service.ts).
--
-- Columns consumed by the app (src/types/resources.ts ResourceRow):
--   id, chapter_id, title, description, resource_type, file_path,
--   thumbnail_url, page_count, question_count, file_size_bytes,
--   author_name, source_name, is_published, created_at, updated_at
-- =============================================================================

create table public.resources (
  id               uuid primary key default gen_random_uuid(),
  chapter_id       uuid not null references public.chapters (id) on delete cascade,
  title            text not null,
  description      text,
  resource_type    text not null default 'notes'
                   check (resource_type in (
                     'notes', 'revision_notes', 'formula_sheet', 'diagram',
                     'sample_paper', 'important_questions', 'reference_material',
                     'video', 'other'
                   )),
  file_path        text,
  thumbnail_url    text,
  page_count       integer,
  question_count   integer,
  file_size_bytes  bigint,
  author_name      text,
  source_name      text,
  is_published     boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table public.resources enable row level security;

create trigger resources_set_updated_at
  before update on public.resources
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Storage buckets
--   avatars   — public (profile.service.ts uses getPublicUrl)
--   resources — private (resource.service.ts uses createSignedUrl)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true),
       ('resources', 'resources', false)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Storage object policies
-- ---------------------------------------------------------------------------
drop policy if exists "avatars are publicly readable" on storage.objects;
create policy "avatars are publicly readable"
  on storage.objects for select
  to public
  using (bucket_id = 'avatars');

drop policy if exists "avatar owners may upload" on storage.objects;
create policy "avatar owners may upload"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatar owners may update" on storage.objects;
create policy "avatar owners may update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatar owners may delete" on storage.objects;
create policy "avatar owners may delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Resource files are private: the app hands out short-lived signed URLs, so
-- reads need no object policy, but authenticated students may manage uploads.
drop policy if exists "resources are readable by authenticated users" on storage.objects;
create policy "resources are readable by authenticated users"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'resources');

drop policy if exists "authenticated users may upload resources" on storage.objects;
create policy "authenticated users may upload resources"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'resources');

drop policy if exists "authenticated users may update resources" on storage.objects;
create policy "authenticated users may update resources"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'resources');

drop policy if exists "authenticated users may delete resources" on storage.objects;
create policy "authenticated users may delete resources"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'resources');
