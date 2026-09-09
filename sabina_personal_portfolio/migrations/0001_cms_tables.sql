-- CMS persistence layer — cms_document, cms_media, cms_editor.
--
-- Run once against the Supabase project (SQL editor, or psql with the
-- connection string from Project Settings -> Database). It is written to be
-- re-runnable: every object is created with IF NOT EXISTS or dropped first.
--
-- Posture: RLS is on for every table and the default is DENY. The anon key
-- currently has read+write on every legacy table in this project; nothing
-- here may reproduce that. Reads of PUBLISHED documents are public, and only
-- through a restricted column grant so `draft` and `created_by` are never
-- visible to anon. Everything else — drafts, writes, media mutations — needs
-- either an authenticated editor session or the service role, which only the
-- server holds.

create extension if not exists pgcrypto with schema extensions;   -- gen_random_uuid
create extension if not exists pg_trgm with schema extensions;    -- search index


-- ---------------------------------------------------------------------------
-- Editor allowlist
-- ---------------------------------------------------------------------------
-- Supabase Auth will happily mint a session for any email that asks for a
-- magic link. "Authenticated" is therefore not the same as "allowed to edit".
-- This table is the single source of truth for who is an editor; both the RLS
-- policies below and the API layer check it. It is deliberately unreadable by
-- anon and authenticated — only the service role (BYPASSRLS) touches it.

create table if not exists public.cms_editor (
  email      text primary key,
  name       text,
  created_at timestamptz not null default now()
);

alter table public.cms_editor enable row level security;
revoke all on public.cms_editor from anon, authenticated;
-- No policies at all: deny-by-default for every role except service_role.

-- SECURITY DEFINER so an editor's own session can test membership without
-- being able to read the allowlist itself. search_path is pinned so the
-- function cannot be hijacked by a shadowing schema.
create or replace function public.cms_is_editor()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.cms_editor e
    where lower(e.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

revoke all on function public.cms_is_editor() from public;
grant execute on function public.cms_is_editor() to authenticated;


-- ---------------------------------------------------------------------------
-- cms_document
-- ---------------------------------------------------------------------------
-- One row per document, body in JSONB. Adding a content type is a config
-- change in src/cms/schemas, never a migration — that is the whole point of
-- this shape.

create table if not exists public.cms_document (
  id            uuid primary key default gen_random_uuid(),
  type          text not null,
  status        text not null default 'draft' check (status in ('draft', 'published')),
  data          jsonb not null default '{}'::jsonb,
  draft         jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  published_at  timestamptz,
  created_by    uuid references auth.users (id) on delete set null,
  updated_by    uuid references auth.users (id) on delete set null,

  -- Provenance of migrated rows. The pair is what makes scripts/cms-migrate.js
  -- idempotent: a second run finds the existing document instead of duplicating
  -- it. NULL for anything authored in the Studio.
  legacy_source text,
  legacy_id     text,

  -- Search target. `jsonb #>> '{}'` renders the whole body as text and is
  -- immutable, which a generated column requires. Draft text is included so
  -- editors can find their unpublished work.
  search_text   text generated always as (
    lower(coalesce(data #>> '{}', '') || ' ' || coalesce(draft #>> '{}', ''))
  ) stored,

  constraint cms_document_published_has_data
    check (status <> 'published' or published_at is not null)
);

create unique index if not exists cms_document_legacy_key
  on public.cms_document (legacy_source, legacy_id)
  where legacy_source is not null;

create index if not exists cms_document_type_status_idx
  on public.cms_document (type, status, updated_at desc);

create index if not exists cms_document_data_gin
  on public.cms_document using gin (data jsonb_path_ops);

create index if not exists cms_document_search_idx
  on public.cms_document using gin (search_text extensions.gin_trgm_ops);


-- ---------------------------------------------------------------------------
-- cms_media
-- ---------------------------------------------------------------------------
-- Metadata mirror of whatever the StoragePort put in the bucket. The row is
-- the record of truth for alt text and dimensions; the bytes live in storage.
-- `bucket` is stored per-row rather than assumed so that a later MinIO/R2
-- migration can move assets a bucket at a time.

create table if not exists public.cms_media (
  id         uuid primary key default gen_random_uuid(),
  bucket     text not null,
  path       text not null,
  url        text not null,
  mime       text,
  size_bytes bigint,
  width      integer,
  height     integer,
  alt        text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,

  unique (bucket, path)
);

create index if not exists cms_media_created_at_idx
  on public.cms_media (created_at desc);


-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------

create or replace function public.cms_touch_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists cms_document_touch on public.cms_document;
create trigger cms_document_touch
  before update on public.cms_document
  for each row execute function public.cms_touch_updated_at();

drop trigger if exists cms_media_touch on public.cms_media;
create trigger cms_media_touch
  before update on public.cms_media
  for each row execute function public.cms_touch_updated_at();


-- ---------------------------------------------------------------------------
-- Grants — column-level, because RLS filters rows and cannot hide columns
-- ---------------------------------------------------------------------------
-- anon and authenticated get SELECT on the public column set only. `draft`,
-- `created_by`, `updated_by` and `legacy_*` are absent from the grant, so no
-- browser-held key can read unpublished edits or author ids no matter what
-- policy matches. Editors read drafts through /api/cms/*, which runs as
-- service_role and bypasses both grants and RLS.

alter table public.cms_document enable row level security;
alter table public.cms_media    enable row level security;

revoke all on public.cms_document from anon, authenticated;
revoke all on public.cms_media    from anon, authenticated;

grant select (id, type, data, status, published_at, created_at, updated_at)
  on public.cms_document to anon, authenticated;

grant select (id, bucket, path, url, mime, width, height, alt, created_at)
  on public.cms_media to anon, authenticated;

-- Write verbs exist for authenticated only, and every one of them is gated by
-- cms_is_editor() below. anon is granted no write verb at any point.
grant insert, update, delete on public.cms_document to authenticated;
grant insert, update, delete on public.cms_media    to authenticated;


-- ---------------------------------------------------------------------------
-- Policies — cms_document
-- ---------------------------------------------------------------------------

drop policy if exists cms_document_public_read   on public.cms_document;
drop policy if exists cms_document_editor_read   on public.cms_document;
drop policy if exists cms_document_editor_insert on public.cms_document;
drop policy if exists cms_document_editor_update on public.cms_document;
drop policy if exists cms_document_editor_delete on public.cms_document;

-- The one public read. Published rows, public columns, no session needed.
create policy cms_document_public_read
  on public.cms_document
  for select
  to anon, authenticated
  using (status = 'published');

create policy cms_document_editor_read
  on public.cms_document
  for select
  to authenticated
  using (public.cms_is_editor());

create policy cms_document_editor_insert
  on public.cms_document
  for insert
  to authenticated
  with check (public.cms_is_editor());

create policy cms_document_editor_update
  on public.cms_document
  for update
  to authenticated
  using (public.cms_is_editor())
  with check (public.cms_is_editor());

create policy cms_document_editor_delete
  on public.cms_document
  for delete
  to authenticated
  using (public.cms_is_editor());


-- ---------------------------------------------------------------------------
-- Policies — cms_media
-- ---------------------------------------------------------------------------
-- Media rows are readable by anyone: a published document referencing an
-- asset needs its url, dimensions and alt text to render. Mutations are
-- editor-only.

drop policy if exists cms_media_public_read   on public.cms_media;
drop policy if exists cms_media_editor_insert on public.cms_media;
drop policy if exists cms_media_editor_update on public.cms_media;
drop policy if exists cms_media_editor_delete on public.cms_media;

create policy cms_media_public_read
  on public.cms_media
  for select
  to anon, authenticated
  using (true);

create policy cms_media_editor_insert
  on public.cms_media
  for insert
  to authenticated
  with check (public.cms_is_editor());

create policy cms_media_editor_update
  on public.cms_media
  for update
  to authenticated
  using (public.cms_is_editor())
  with check (public.cms_is_editor());

create policy cms_media_editor_delete
  on public.cms_media
  for delete
  to authenticated
  using (public.cms_is_editor());


-- ---------------------------------------------------------------------------
-- Storage bucket
-- ---------------------------------------------------------------------------
-- Public-read bucket so <Image src> works without signing every URL. Writes
-- are editor-gated at the storage layer too, not only in the API — the anon
-- key must not be able to upload even if a handler is ever misrouted.
--
-- CMS_MEDIA_BUCKET must match this id.

insert into storage.buckets (id, name, public)
values ('cms-media', 'cms-media', true)
on conflict (id) do nothing;

drop policy if exists cms_storage_public_read   on storage.objects;
drop policy if exists cms_storage_editor_insert on storage.objects;
drop policy if exists cms_storage_editor_update on storage.objects;
drop policy if exists cms_storage_editor_delete on storage.objects;

create policy cms_storage_public_read
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'cms-media');

create policy cms_storage_editor_insert
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'cms-media' and public.cms_is_editor());

create policy cms_storage_editor_update
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'cms-media' and public.cms_is_editor())
  with check (bucket_id = 'cms-media' and public.cms_is_editor());

create policy cms_storage_editor_delete
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'cms-media' and public.cms_is_editor());


-- ---------------------------------------------------------------------------
-- Grant the first editor
-- ---------------------------------------------------------------------------
-- Nobody can edit until a row exists here. Run this yourself with the real
-- address; it is left commented because an email is a value this build has no
-- authority to invent.
--
--   insert into public.cms_editor (email, name)
--   values ('someone@example.com', 'Jméno')
--   on conflict (email) do nothing;
