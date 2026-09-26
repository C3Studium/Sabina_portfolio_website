-- Legacy tables — close the anon write hole, drop the IP columns.
--
--   ############################################################
--   #  DO NOT RUN THIS WITHOUT READING IT.                     #
--   #  It is DESTRUCTIVE and IRREVERSIBLE on live client data. #
--   #  Section 2 drops two columns from `reviews` for good.    #
--   #  There is no down-migration; a restore means a backup.   #
--   ############################################################
--
-- Take a snapshot first (Supabase -> Database -> Backups, or `pg_dump -t
-- public.reviews`). Run section 0 (read-only checks) and read its output before
-- running anything else. Sections 1-3 are safe to run together; section 4 is
-- separate on purpose and must not be run yet — see its header.
--
-- Unlike 0001-0003 this file does not create the CMS's own tables. It operates
-- on the three tables that predate the CMS — `people`, `reviews`, `total` —
-- which the CMS reads once, through scripts/cms-migrate.js, and then leaves
-- alone.
--
-- ---------------------------------------------------------------------------
-- What is wrong today
-- ---------------------------------------------------------------------------
-- NEXT_PUBLIC_SUPABASE_ANON_KEY is public by design, and on this project it is
-- public in fact. The site deployed at www.prochazkagroup.cz serves it inside
-- /_next/static/chunks/124-cfa0a1d10f00a8e5.js — checked on 2026-08-27 by
-- fetching that chunk over plain HTTP with no credentials. The same chunk still
-- contains the compiled hook: `from("reviews")`, `"people"`, `"total"`. So the
-- write path is not merely reachable, it is published, and it sits in the cache
-- of everyone who has visited the site.
--
-- (This branch's build no longer ships it: a production build of `Remodel`
-- puts the key in 0 of 98 client chunks and 0 of 14 prerendered pages, because
-- nothing in the browser graph references it any more. That stops the next
-- deploy from re-publishing the key. It does not un-publish the one already
-- out there, which is why the key should also be ROTATED in the Supabase
-- dashboard after this file runs.)
--
-- On these three tables the key currently carries write rights. Probed on
-- 2026-08-27 with a deliberately mistyped id, so the statement could not
-- succeed even if permission were granted:
--
--   POST  /rest/v1/reviews  {"id":"not-a-bigint"}  -> 400 22P02 (type error)
--   POST  /rest/v1/people   {"id":"not-a-bigint"}  -> 400 22P02 (type error)
--   POST  /rest/v1/total    {"id":"not-a-uuid"}    -> 400 22P02 (type error)
--   PATCH /rest/v1/reviews?id=eq.-999999           -> 204 (no row matched)
--   PATCH /rest/v1/people?id=eq.-999999            -> 204 (no row matched)
--
-- A type error and a 204, never a 401. Permission is granted; only the payload
-- stopped the write. So anyone can insert a row into `reviews`, and `reviews`
-- has no `approved` column — on the old site such a row was live immediately.
--
-- And `reviews.ip_list` is world-readable. 12 of 37 rows carry an IP address
-- (`list_of_all_ips` is null in all 37). An IP address identifies a person:
-- that is personal data, published, with no stated lawful basis and no notice
-- to the people it belongs to.
--
-- SPEC.md:57 — "No key with write rights reaches the browser. Ever." This file
-- is what makes that true. Code cannot: deleting the site's write helpers
-- (src/hooks/useReviewForm.js, useFetchDatabase.js, supabaseClient.js — all
-- three now gone, all three had zero importers) removes the caller, not the
-- permission. The probes above still return exactly what they returned before
-- that deletion. Only the GRANTs below change the answer.
--
-- ---------------------------------------------------------------------------
-- What this will break if the assumptions are wrong
-- ---------------------------------------------------------------------------
-- The assumptions, each with the check that tests it in section 0:
--
--   A. Nothing in this repository writes to these tables any more.
--      Verified by `grep -rn "from('people')\|from('reviews')\|from('total')"
--      src/` -> 0 matches, and by grep for `supabaseClient` -> 0 matches.
--      If some other deploy, a Zapier/n8n job, an old preview build still
--      pinned to a previous commit, or a form on another domain shares this
--      anon key and inserts here, IT WILL START FAILING WITH HTTP 401 the
--      moment section 1 runs. Section 0.1 is how you look for such a writer
--      before you find out the hard way.
--
--   B. Nothing on the public site READS these tables. The site reads
--      cms_document (src/cms/server/site/read.js). The only anon reader left
--      in the repo is scripts/cms-migrate.js, which is GET-only by
--      construction (scripts/cms-migrate.js:189-201) and is a developer tool,
--      not a page. Sections 1-3 therefore LEAVE ANON SELECT IN PLACE, so a
--      wrong assumption here cannot take the site down.
--
--   C. Nobody has read the IP columns since they were written. They are
--      referenced by no component and by nothing in the CMS —
--      scripts/cms-migrate.js:43-45 already drops them on the way in, on the
--      stated position that there is no lawful basis for carrying them
--      forward. Section 2 finishes that decision at the source rather than
--      leaving the original copy world-readable behind a script that merely
--      declines to copy it. If they are in fact evidence in a live dispute,
--      export them to a private store BEFORE running section 2; after it
--      there is nothing to export.
--
-- ---------------------------------------------------------------------------
-- Section 0 — READ-ONLY CHECKS. Run these first, on their own.
-- ---------------------------------------------------------------------------
-- Nothing here modifies anything. Read every result before continuing.

-- 0.1  Who can write today? Expect anon/authenticated to appear with INSERT,
--      UPDATE or DELETE — that is the hole. After section 1, re-run this and
--      expect SELECT only.
select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('people', 'reviews', 'total')
  and grantee in ('anon', 'authenticated', 'public')
order by table_name, grantee, privilege_type;

-- 0.2  Is RLS even on, and what policies exist? These tables predate the CMS
--      and may have none at all, in which case the grants above are the only
--      thing governing access. Section 3 turns RLS on regardless.
select c.relname, c.relrowsecurity as rls_enabled
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in ('people', 'reviews', 'total');

select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public' and tablename in ('people', 'reviews', 'total')
order by tablename, policyname;

-- 0.3  What is about to be destroyed. Expect 12 and 0 (as of 2026-08-27).
--      If `with_ip` has grown since, someone is still writing IPs here and
--      assumption A is wrong — stop and find the writer.
select count(*) as total_rows,
       count(ip_list) as with_ip,
       count(list_of_all_ips) as with_ip_list,
       max(created_at) as newest_review
from public.reviews;

-- 0.4  Has anything been inserted since the last known-good state? 37 reviews,
--      13 people. A higher count means an unmoderated insert already happened
--      through the hole this file closes — read the new rows before you decide
--      whether they are genuine.
select (select count(*) from public.reviews) as reviews,
       (select count(*) from public.people)  as people,
       (select count(*) from public.total)   as total;


-- ---------------------------------------------------------------------------
-- Section 1 — revoke every write verb
-- ---------------------------------------------------------------------------
-- The grant is the primary control and it is unconditional: a role without
-- INSERT cannot insert, whatever policies say. `public` is revoked too because
-- a grant to PUBLIC reaches anon by inheritance and would otherwise survive a
-- revoke aimed only at the named roles.
--
-- SELECT is deliberately not touched here. See section 4.

revoke insert, update, delete, truncate, references, trigger
  on public.people, public.reviews, public.total
  from anon, authenticated, public;


-- ---------------------------------------------------------------------------
-- Section 2 — drop the IP columns
-- ---------------------------------------------------------------------------
-- IRREVERSIBLE. Both columns and every value in them are gone after this.
--
-- This is the same decision scripts/cms-migrate.js:43-45 already encodes for
-- the copy that reaches the CMS, applied to the original. Dropping the columns
-- rather than nulling them is the point: a nulled column is a column something
-- can start filling again, and the whole finding was that a public key could
-- write to this table.

alter table public.reviews drop column if exists ip_list;
alter table public.reviews drop column if exists list_of_all_ips;


-- ---------------------------------------------------------------------------
-- Section 3 — RLS on, read-only policy, no write policy at all
-- ---------------------------------------------------------------------------
-- Belt and braces behind section 1. Every existing policy on these tables is
-- dropped by name from the catalogue, because this file cannot know what a
-- table predating it was given; then exactly one policy is created, for SELECT.
-- No INSERT/UPDATE/DELETE policy is created, so even if a future migration
-- re-grants a write verb by accident, RLS still denies the row.
--
-- service_role bypasses RLS, so the server and scripts/cms-migrate.js's
-- cms_document writes are unaffected.

do $$
declare p record;
begin
  for p in
    select tablename, policyname
    from pg_policies
    where schemaname = 'public' and tablename in ('people', 'reviews', 'total')
  loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end
$$;

alter table public.people  enable row level security;
alter table public.reviews enable row level security;
alter table public.total   enable row level security;

create policy legacy_read_only on public.people  for select to anon, authenticated using (true);
create policy legacy_read_only on public.reviews for select to anon, authenticated using (true);
create policy legacy_read_only on public.total   for select to anon, authenticated using (true);

-- Assert the outcome rather than trusting that the statements above ran. Fails
-- the transaction if any write verb survived on any of the three tables.
do $$
declare leftover text;
begin
  select string_agg(format('%s:%s:%s', table_name, grantee, privilege_type), ', ')
    into leftover
  from information_schema.role_table_grants
  where table_schema = 'public'
    and table_name in ('people', 'reviews', 'total')
    and grantee in ('anon', 'authenticated', 'public')
    and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE');

  if leftover is not null then
    raise exception 'anon/authenticated still hold write grants: %', leftover;
  end if;
end
$$;


-- ---------------------------------------------------------------------------
-- Section 4 — DO NOT RUN YET. Revoking the last anon read.
-- ---------------------------------------------------------------------------
-- Anon SELECT is kept above for exactly one reason, and it is not the site.
--
-- The site does not read these tables. It reads cms_document, and as of
-- 2026-08-27 cms_document DOES NOT EXIST in this Supabase project — probed:
-- GET /rest/v1/cms_document -> 404 42P01. 0001-0003 have not been run here. The
-- content currently lives in the local file store (.cms-dev/store.json: 125
-- documents — 37 reviews, 14 consultants, 17 partners, 40 siteCopy, 10 qna,
-- 6 offers, 1 assistant).
--
-- So `people`/`reviews`/`total` are still the only production copy of that
-- content, and scripts/cms-migrate.js — which reads them with the anon key — is
-- the tool that will move it. Revoking anon SELECT now would break the
-- migration before it has been run.
--
-- Run these two statements ONLY after 0001-0003 have been applied here,
-- cms-migrate.js has been run with --write against this project, and the site
-- has been confirmed serving from cms_document. At that point these tables are
-- a historical copy that nothing reads, and the correct exposure for a
-- historical copy is none.
--
--   revoke select on public.people, public.reviews, public.total
--     from anon, authenticated, public;
--
--   drop policy if exists legacy_read_only on public.people;
--   drop policy if exists legacy_read_only on public.reviews;
--   drop policy if exists legacy_read_only on public.total;
--
-- Until then, what an anonymous reader can still see is recorded here so it is
-- a decision and not an accident:
--
--   people  (13 rows) — name, tel, mail, fb, ig, moto, pribeh, likes, reviews,
--                       src, alt. TELEPHONE NUMBERS AND E-MAIL ADDRESSES.
--                       Business contact details of the consultants, printed
--                       on the site's own consultant pages; the same fields
--                       ride in consultant.data, which 0001's public read
--                       policy and 0003's grant make world-readable by design.
--                       Publishing them is intended. Note the shape of the
--                       default, though: `data` is granted whole, so any field
--                       an editor adds to a consultant in the Studio is public
--                       from the moment it is published, whether or not anyone
--                       decided it should be. A field that must not be public
--                       needs its own place, not a corner of `data`.
--   reviews (37 rows) — customer_name, consultant_name, message, hashtag,
--                       likes, number, created_at. First names and review text
--                       the authors gave for publication; published on
--                       /recenze today. Personal data, lawfully published.
--                       ip_list and list_of_all_ips are gone after section 2 —
--                       they were the only fields here nobody consented to.
--   total   (1 row)   — aggregate counters. No personal data.
--
-- Nothing else in this project is exposed to anon: cms_document, cms_media and
-- cms_editor do not exist here yet, and when 0001 creates them the anon grant
-- is column-level and published-rows-only. email_interactions, which
-- src/pages/api/resend-enhanced.js writes with the service role, also does not
-- exist (404 42P01) — that route is writing nowhere.
