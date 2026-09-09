-- The content archive, layers 1 and 4 — cms_document_revision, cms_media_archive.
--
-- Run after 0006_cms_setting.sql (Supabase SQL editor, or psql with the
-- connection string from Project Settings -> Database). Re-runnable: every
-- object is created with IF NOT EXISTS or dropped before it is created.
--
-- Numbered 0007. 0004 and 0006 already exist, so this is the next free number
-- rather than the next number after the last one anybody remembers.
--
-- ---------------------------------------------------------------------------
-- Why now, and what is being lost while this is not run
-- ---------------------------------------------------------------------------
-- src/cms/server/documents.js `publish()` writes `data` in place. Every publish
-- therefore destroys the body the previous publish put there, and no amount of
-- later work can bring one back: there is nowhere it was written down. This
-- file is the place it starts being written down, which means the archive's
-- history begins on the day this migration runs and contains nothing from
-- before it. That is a property of the situation, not of the design, and it is
-- the reason src/cms/ARCHIVE.md puts revisions first in the order of work.
--
-- ---------------------------------------------------------------------------
-- One row per transition, not per edit
-- ---------------------------------------------------------------------------
-- The four transitions that change what a visitor sees — publish, unpublish,
-- archive, restore — are one choke point in handlers/documents.js, the same
-- place on-demand revalidation hooks into. A draft write (PUT /documents/:id,
-- PATCH /documents/:id/field) changes `draft` and nothing public, so it writes
-- no row here: an archive that recorded keystrokes would be a different, larger
-- and less useful thing than one that records what the site said.
--
-- Volume grows with the number of transitions, not with the size of the site.
-- One publish is one body, not 125.
--
-- ---------------------------------------------------------------------------
-- No foreign key from the revision to the document
-- ---------------------------------------------------------------------------
-- `document_id` is a plain uuid. Both available foreign keys are wrong here:
--
--   on delete cascade   deleting a document would destroy its history, silently
--                       and automatically. ARCHIVE.md's settled position is
--                       that nothing is ever deleted automatically and that all
--                       destruction lives in the Archive screen, deliberate and
--                       confirmed. A cascade is exactly the automatic deletion
--                       that position rules out.
--   on delete restrict  a document that has ever been published could then
--                       never be deleted at all, which turns "we keep history"
--                       into "you may not tidy up".
--
-- So the revision outlives the row it describes, and carries `type` itself so
-- the archive can still say what the thing was after the document is gone.
--
-- `changed_by` does have a foreign key, `on delete set null`, matching
-- cms_api_key.created_by and cms_setting.updated_by: history must not be
-- destroyed because the person who made it left, and an orphaned uuid is worse
-- than a null because it looks like an answer.

create extension if not exists pgcrypto with schema extensions;   -- gen_random_uuid


-- ---------------------------------------------------------------------------
-- cms_document_revision
-- ---------------------------------------------------------------------------
-- `body` is the document's published body AFTER the transition, and `status` /
-- `archived_at` are the state it left the document in. That combination is what
-- makes layer 2 — "what was published at time T" — a query rather than a stored
-- snapshot: for each document, the last revision with changed_at <= T, kept if
-- `status = 'published' and archived_at is null`.
--
-- `reason` is the transition's name, constrained to the four. It is not free
-- text: a note field would collect prose and stop being answerable, and the one
-- question this column has to answer — "was this taken down or filed away" — is
-- a question about which transition ran.
--
-- `build_id` is the identity of the code that was deployed when the transition
-- happened (src/cms/server/buildId.js). It is what lets the Archive say
-- "content from 3 March, replayed by today's code; the code then was abc1234"
-- instead of the false "this is how the site looked". Nullable, because a
-- deployment that cannot name itself must still record the content.

create table if not exists public.cms_document_revision (
  id          uuid primary key default gen_random_uuid(),
  document_id uuid not null,
  type        text not null,
  body        jsonb not null default '{}'::jsonb,
  status      text not null check (status in ('draft', 'published')),
  archived_at timestamptz,
  changed_at  timestamptz not null default now(),
  changed_by  uuid references public.cms_user (id) on delete set null,
  reason      text not null check (reason in ('publish', 'unpublish', 'archive', 'restore')),
  build_id    text
);

-- The timeline of one document, and the "as of T" lookup, are the same index:
-- both walk backwards from an instant within one document_id.
create index if not exists cms_document_revision_document_idx
  on public.cms_document_revision (document_id, changed_at desc);

-- The Archive's Změny subpage: every transition, newest first, across the site.
create index if not exists cms_document_revision_changed_idx
  on public.cms_document_revision (changed_at desc);

-- Layer 2 replays one content type at a time (`reviews` with its own limit,
-- consultants for the dynamic routes), and only published revisions can be
-- shown. Partial on exactly that predicate, for the same reason 0003's live
-- index is partial: Postgres uses a partial index only for a query it can prove
-- the WHERE clause covers.
create index if not exists cms_document_revision_published_idx
  on public.cms_document_revision (type, changed_at desc)
  where status = 'published' and archived_at is null;


-- ---------------------------------------------------------------------------
-- cms_media.archived_at
-- ---------------------------------------------------------------------------
-- media.js `remove()` deleted the row and then the object. An editor tidying
-- the library therefore destroyed history — every revision pointing at that
-- file became a revision pointing at nothing — with no error and no trace.
-- Removal becomes archival: the row stays, the object stays, the file leaves
-- the library.
--
-- A column and not a status, exactly as 0003 argued for documents: `archived_at`
-- is orthogonal to everything else the row says, a timestamp answers "when did
-- this leave the library" which a boolean cannot, and nothing that reads
-- cms_media has to learn a new value for a column it already understands.
--
-- Uploads are content-addressed (ports/storage.js buildObjectKey), so replacing
-- an image writes a NEW key and the old object is never overwritten. The
-- archive gets its real pictures from that property for free — this column is
-- what stops an editor from taking them away again.

alter table public.cms_media
  add column if not exists archived_at timestamptz;

create index if not exists cms_media_live_idx
  on public.cms_media (created_at desc)
  where archived_at is null;

-- Column grants are absolute: a column absent from the grant can neither be
-- selected nor named in a WHERE clause. Nothing public reads cms_media today,
-- but the grant already lists the other columns, and a public read that one day
-- filters archived files out must fail on the filter's logic rather than on a
-- permission error. Re-stated in full so this file describes the finished
-- column set; `size_bytes`, `updated_at` and `created_by` stay out.

grant select (id, bucket, path, url, mime, width, height, alt, created_at, archived_at)
  on public.cms_media to anon, authenticated;


-- ---------------------------------------------------------------------------
-- cms_media_archive
-- ---------------------------------------------------------------------------
-- What the archive knows about a file that cms_media cannot answer.
--
-- "Nahráno" and "publikováno" are two different dates and the Archive needs
-- both: a file is uploaded at one moment and first appears on the site at
-- another — sometimes weeks later, sometimes never. cms_media holds the first.
-- The second is not a fact about the upload at all; it is the first revision
-- with `status = 'published'` whose body mentions the file, so it is computed
-- when a revision is written (src/cms/server/mediaArchive.js) and stored here.
--
-- One row per file the archive has learned something about, created the first
-- time a published revision mentions it OR the moment it is archived —
-- whichever happens first. A row here therefore does NOT mean "archived";
-- `archived_at is not null` means that.
--
-- `uploaded_at` and `archived_at` are copies of cms_media.created_at and
-- cms_media.archived_at, written by the same call that sets them. cms_media is
-- authoritative if they ever disagree. They are duplicated because the Archive's
-- Média subpage answers "uploaded / published / archived" for one file in one
-- read, and because the file-backed development store (fileStore/client.js) has
-- no joins at all — a design that needed one would work against Supabase and
-- fail on the machine it is developed on.
--
-- `on delete cascade` is right here and wrong on the revision above: this row is
-- ABOUT a cms_media row rather than a record of something that happened, and
-- the only way a cms_media row is ever hard-deleted is a confirmed, owner-only
-- purge from the Archive, which means to destroy exactly this.

create table if not exists public.cms_media_archive (
  media_id           uuid primary key references public.cms_media (id) on delete cascade,
  uploaded_at        timestamptz,
  archived_at        timestamptz,
  first_published_at timestamptz
);

create index if not exists cms_media_archive_first_published_idx
  on public.cms_media_archive (first_published_at desc nulls last);


-- ---------------------------------------------------------------------------
-- Who may read this
-- ---------------------------------------------------------------------------
-- Nobody with a browser-held key. The archive contains everything that was ever
-- published, including what somebody later took down — that is its purpose and
-- it is exactly why it is not for every editor, let alone for anon. Same
-- posture as cms_api_key in 0005: the privilege system denies it before RLS is
-- consulted, and no policy is ever created, so service_role behind
-- /api/cms/archive/* is the only way in. handlers/archive.js checks for an
-- owner on every request.

revoke all on public.cms_document_revision from anon, authenticated;
revoke all on public.cms_media_archive from anon, authenticated;

alter table public.cms_document_revision enable row level security;
alter table public.cms_media_archive enable row level security;


-- ---------------------------------------------------------------------------
-- What this migration deliberately does NOT do
-- ---------------------------------------------------------------------------
-- No backfill. A row inserted here for a document published last month would
-- claim `body` was what the site said last month, and it is not — it is what
-- the site says now, because `data` was overwritten in place. A backfilled
-- archive is a confident untruth, which ARCHIVE.md names as worse than no
-- archive at all. The table starts empty and fills forward.
--
-- No automatic pruning. No trigger, no retention window, no cascade that could
-- reach a revision. Everything that destroys anything is one owner-only,
-- confirmed action in the Archive screen (src/cms/server/archive.js), and that
-- is the whole list.
--
-- Nothing here records `create({ status: 'published' })`, which is reachable
-- only from scripts/cms-migrate.js. That path writes documents in bulk under a
-- human's supervision and is not a transition an editor performs; if it ever
-- becomes one, it joins the four in handlers/documents.js rather than gaining a
-- second way to write this table.
