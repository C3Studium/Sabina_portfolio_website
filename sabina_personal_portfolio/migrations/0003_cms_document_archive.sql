-- Archiving — cms_document.archived_at.
--
-- Run after 0002_cms_auth.sql (Supabase SQL editor, or psql with the connection
-- string from Project Settings -> Database). Re-runnable: the column is added
-- with IF NOT EXISTS, the index likewise, and the policy is dropped before it is
-- created.
--
-- ---------------------------------------------------------------------------
-- Why a column and not a third `status`
-- ---------------------------------------------------------------------------
-- Contract 3 fixes `status` at 'draft' | 'published'. Three things key off that
-- pair: the public read path (src/cms/server/site/read.js), the RLS policy
-- below, and the anon column grant. Adding 'archived' would have to change all
-- three, and it would still be the wrong shape — it would make "archived" and
-- "never published" the same fact at the database level, so restoring a person
-- could not tell whether to put them back on the site or back in the drafts.
--
-- `archived_at` is orthogonal to `status` instead. A document keeps the publish
-- state it had, gains a filing date, and loses it again on restore. It is also
-- not consultant-specific: nothing below names a type, so every content type
-- gets archiving from this one migration.
--
-- ---------------------------------------------------------------------------
-- Where the rule is enforced
-- ---------------------------------------------------------------------------
-- In the policy, not only in the query. The site's read path does filter
-- `archived_at is null` itself, but that filter is a line of JavaScript someone
-- can drop; the policy is the thing that makes an archived consultant
-- unreachable with the anon key no matter what the read path asks for. Same
-- reasoning as `status = 'published'` in 0001: the database is the enforcement
-- and the query is the optimisation.

-- ---------------------------------------------------------------------------
-- The column
-- ---------------------------------------------------------------------------
-- NULL means "not archived". A timestamp rather than a boolean because "when
-- was this person taken off the site" is the question an editor actually asks
-- six months later, and a boolean cannot answer it.

alter table public.cms_document
  add column if not exists archived_at timestamptz;

-- The public read is `status = 'published' and archived_at is null`, so the
-- index is partial on exactly that predicate. Postgres can only use a partial
-- index for a query it can prove is covered by the WHERE clause, which is why
-- this repeats the policy rather than indexing the column on its own.
create index if not exists cms_document_live_idx
  on public.cms_document (type, updated_at desc)
  where status = 'published' and archived_at is null;

-- The Studio's archive view is the opposite query and is not covered by the
-- index above.
create index if not exists cms_document_archived_idx
  on public.cms_document (type, archived_at desc)
  where archived_at is not null;


-- ---------------------------------------------------------------------------
-- Grant
-- ---------------------------------------------------------------------------
-- Column-level grants are absolute: a column absent from the grant cannot be
-- selected AND cannot be named in a WHERE clause, so without this line the
-- site's own `archived_at=is.null` filter fails with a permission error rather
-- than filtering.
--
-- Granting it leaks nothing. The policy below denies anon every row where
-- `archived_at` is not null, so the only value anon can ever read from this
-- column is NULL — the grant lets the filter be written, not the data be seen.
--
-- Re-stated in full rather than as a diff so this file describes the finished
-- column set. `draft`, `created_by`, `updated_by` and `legacy_*` are still
-- absent, deliberately.

grant select (id, type, data, status, published_at, created_at, updated_at, archived_at)
  on public.cms_document to anon, authenticated;


-- ---------------------------------------------------------------------------
-- Policy
-- ---------------------------------------------------------------------------
-- The one public read, narrowed. Everything else on this table is service_role,
-- which bypasses RLS and lives only behind /api/cms/*, so the Studio keeps
-- seeing archived documents while the public site cannot.

drop policy if exists cms_document_public_read on public.cms_document;
create policy cms_document_public_read
  on public.cms_document
  for select
  to anon, authenticated
  using (status = 'published' and archived_at is null);


-- ---------------------------------------------------------------------------
-- Restore is not a re-publish
-- ---------------------------------------------------------------------------
-- 0001 carries `cms_document_published_has_data`: published rows must have a
-- published_at. Archiving does not touch either column, so an archived document
-- that was live goes straight back to live on restore, and one that was a draft
-- goes back to being a draft. That is the property the split into two columns
-- was for, and it is asserted here so a future migration that "simplifies"
-- archiving into `status` fails this file instead of silently unpublishing
-- everyone's archive.
do $$
begin
  if exists (
    select 1
    from information_schema.check_constraints
    where constraint_schema = 'public'
      and constraint_name = 'cms_document_published_has_data'
  ) then
    return;
  end if;
  raise exception 'cms_document_published_has_data is missing — run 0001_cms_tables.sql first';
end
$$;
