-- CMS authentication — cms_user, cms_session, and the end of the magic-link
-- allowlist. See src/cms/AUTH.md for the design this implements.
--
-- Run after 0001_cms_tables.sql (Supabase SQL editor, or psql with the
-- connection string from Project Settings -> Database). Re-runnable: every
-- object is created with IF NOT EXISTS, replaced, or dropped first.
--
-- Posture, in one sentence: no browser-held key may touch either table. Not
-- "policies restrict it" — the grants are revoked outright and no policy is
-- ever created, so anon and authenticated are denied by the privilege system
-- before RLS is even consulted. A password hash that anon can select is a
-- password hash that will be cracked offline at leisure.
--
-- What this migration therefore also does: it takes the write verbs away from
-- `authenticated` on cms_document and cms_media. Those grants existed so a
-- magic-link session could write through PostgREST; there is no such session
-- any more. Every write now arrives as service_role from behind /api/cms/*.
-- The one thing that stays open is the public read of PUBLISHED documents on
-- the public column set — the site's own pages depend on it.

create extension if not exists pgcrypto with schema extensions;   -- gen_random_uuid
create extension if not exists citext   with schema extensions;   -- case-insensitive email


-- ---------------------------------------------------------------------------
-- cms_user
-- ---------------------------------------------------------------------------
-- The only account table this system has. Supabase Auth is no longer involved:
-- a Supabase session proved that an address receives mail, which is not the
-- question anyone was asking, and it forced a second allowlist table to answer
-- the real one. One table, one source of truth.
--
-- `email` is citext so "Jan@…" and "jan@…" cannot both exist. The server also
-- lowercases before every read and write, so uniqueness does not depend on the
-- extensions schema being on the caller's search_path.
--
-- `created_by` is self-referential: it records the owner who invited an editor.
-- ON DELETE SET NULL rather than CASCADE — removing the person who did the
-- inviting must not remove the people they invited.

create table if not exists public.cms_user (
  id            uuid primary key default gen_random_uuid(),
  email         extensions.citext not null unique,
  password_hash text not null,
  name          text not null default '',
  role          text not null default 'editor' check (role in ('owner', 'editor')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  last_login_at timestamptz,
  disabled_at   timestamptz,
  created_by    uuid references public.cms_user (id) on delete set null,

  -- The stored format is scrypt$N$r$p$salt$hash (src/cms/server/password.js).
  -- The check is not cryptography, it is a tripwire: a bug that ever wrote a
  -- plaintext password into this column fails loudly instead of silently.
  constraint cms_user_password_hash_format
    check (password_hash ~ '^scrypt\$[0-9]+\$[0-9]+\$[0-9]+\$[A-Za-z0-9_-]+\$[A-Za-z0-9_-]+$')
);

create index if not exists cms_user_role_idx on public.cms_user (role) where disabled_at is null;


-- ---------------------------------------------------------------------------
-- cms_session
-- ---------------------------------------------------------------------------
-- Sessions are stored rather than stateless because removing a user has to end
-- their access immediately, and a self-contained JWT cannot be withdrawn before
-- it expires.
--
-- THE TOKEN IS NOT IN THIS TABLE. `token_hash` is a SHA-256 of it, and the
-- check constraint below is what makes that a guarantee rather than a habit:
-- 64 lowercase hex characters is the shape of a SHA-256 digest and is not the
-- shape of the base64url token the browser holds. A leaked session table is
-- therefore not a set of working credentials.

create table if not exists public.cms_session (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.cms_user (id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  user_agent text,
  ip_hash    text,

  constraint cms_session_token_hash_is_digest
    check (token_hash ~ '^[a-f0-9]{64}$')
);

create index if not exists cms_session_user_idx on public.cms_session (user_id);

-- Expired rows are dead weight; this index makes the sweep cheap.
create index if not exists cms_session_expires_idx on public.cms_session (expires_at);


-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------
-- Re-declared rather than assumed from 0001 so this file can be read on its own.
-- The body is identical, so replacing it is a no-op for the existing triggers.

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

drop trigger if exists cms_user_touch on public.cms_user;
create trigger cms_user_touch
  before update on public.cms_user
  for each row execute function public.cms_touch_updated_at();


-- ---------------------------------------------------------------------------
-- The system must not be able to lock itself out
-- ---------------------------------------------------------------------------
-- An owner cannot demote, disable or delete themselves while they are the only
-- one. AUTH.md puts this rule on the server, and the server does enforce it
-- with a clear error message — but "there is always an owner" is an invariant
-- of the data, not of one code path, so it is also a constraint here. Any
-- future script, migration or console session gets the same answer.
--
-- DEFERRABLE INITIALLY DEFERRED so a transaction that promotes a new owner and
-- demotes the old one succeeds regardless of statement order; only the state at
-- commit is judged.

create or replace function public.cms_guard_last_owner()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1 from public.cms_user
    where role = 'owner' and disabled_at is null
  ) then
    raise exception 'cms_user: the last active owner cannot be demoted, disabled or deleted'
      using errcode = 'check_violation';
  end if;
  return null;
end;
$$;

drop trigger if exists cms_user_last_owner_guard on public.cms_user;
create constraint trigger cms_user_last_owner_guard
  after update or delete on public.cms_user
  deferrable initially deferred
  for each row execute function public.cms_guard_last_owner();


-- ---------------------------------------------------------------------------
-- Bootstrap — a seed, not a back door
-- ---------------------------------------------------------------------------
-- CMS_ADMIN_EMAIL / CMS_ADMIN_PASSWORD create the first owner and nothing else.
-- The environment value is hashed by the server and thrown away; it is never
-- stored, never logged, and never compared against anything.
--
-- `where not exists (select 1 from cms_user)` is the whole of the "not a back
-- door" guarantee, and it is here rather than in JavaScript for two reasons.
-- It is atomic — the test and the insert cannot be interleaved by a second
-- request — and it is unconditional: once any account exists, this function
-- returns zero rows forever, so leaving the variables set in Vercel grants
-- nothing and rotating them grants nothing. Changing the password in the admin
-- cannot be undone from the environment.
--
-- Returns the created row, or no rows when it was inert. The server tells those
-- two apart and logs only the first.

create or replace function public.cms_bootstrap_owner(
  p_email         text,
  p_password_hash text,
  p_name          text
)
returns table (id uuid, email text, role text)
language sql
volatile
set search_path = public, extensions, pg_temp
as $$
  insert into public.cms_user (email, password_hash, name, role)
  select lower(p_email)::extensions.citext,
         p_password_hash,
         coalesce(nullif(btrim(p_name), ''), split_part(lower(p_email), '@', 1)),
         'owner'
  where not exists (select 1 from public.cms_user)
  returning cms_user.id, cms_user.email::text, cms_user.role;
$$;


-- ---------------------------------------------------------------------------
-- Session resolution
-- ---------------------------------------------------------------------------
-- One function so that "this session is usable" has one definition. Four
-- conditions, all of them data: the digest matches, the session was not
-- revoked, it has not expired, and the account behind it is not disabled.
--
-- The last one is why this is a function and not four `if` statements in
-- JavaScript. "Disabling a user ends their access immediately" is the reason
-- sessions are stored at all; the check belongs where it cannot be forgotten
-- by the next caller.

create or replace function public.cms_resolve_session(p_token_hash text)
returns table (
  session_id uuid,
  user_id    uuid,
  email      text,
  name       text,
  role       text,
  expires_at timestamptz
)
language sql
stable
set search_path = public, extensions, pg_temp
as $$
  select s.id, u.id, u.email::text, u.name, u.role, s.expires_at
  from public.cms_session s
  join public.cms_user u on u.id = s.user_id
  where s.token_hash = p_token_hash
    and s.revoked_at is null
    and s.expires_at > now()
    and u.disabled_at is null;
$$;


-- ---------------------------------------------------------------------------
-- Grants — cms_user, cms_session
-- ---------------------------------------------------------------------------
-- RLS is enabled and NO POLICY IS CREATED. That alone denies anon and
-- authenticated, but Supabase grants privileges on new public tables to both
-- roles by default, and a privilege that exists is a privilege that one
-- mistaken policy turns into a leak. So the grants go too.

alter table public.cms_user    enable row level security;
alter table public.cms_session enable row level security;

revoke all on public.cms_user    from public, anon, authenticated;
revoke all on public.cms_session from public, anon, authenticated;

grant all on public.cms_user    to service_role;
grant all on public.cms_session to service_role;

-- Functions are EXECUTE-to-PUBLIC by default, which would let any browser key
-- call cms_resolve_session() and confirm a digest, or call the bootstrap.
revoke all on function public.cms_bootstrap_owner(text, text, text) from public, anon, authenticated;
revoke all on function public.cms_resolve_session(text)             from public, anon, authenticated;
revoke all on function public.cms_guard_last_owner()                from public, anon, authenticated;

grant execute on function public.cms_bootstrap_owner(text, text, text) to service_role;
grant execute on function public.cms_resolve_session(text)             to service_role;


-- ---------------------------------------------------------------------------
-- Retire the allowlist
-- ---------------------------------------------------------------------------
-- Every policy that called cms_is_editor() goes first, then the function, then
-- the table. Dropped in that order rather than with CASCADE so that a policy
-- this migration did not expect to find causes a visible failure instead of
-- being silently removed.

drop policy if exists cms_document_editor_read   on public.cms_document;
drop policy if exists cms_document_editor_insert on public.cms_document;
drop policy if exists cms_document_editor_update on public.cms_document;
drop policy if exists cms_document_editor_delete on public.cms_document;

drop policy if exists cms_media_editor_insert on public.cms_media;
drop policy if exists cms_media_editor_update on public.cms_media;
drop policy if exists cms_media_editor_delete on public.cms_media;

drop policy if exists cms_storage_editor_insert on storage.objects;
drop policy if exists cms_storage_editor_update on storage.objects;
drop policy if exists cms_storage_editor_delete on storage.objects;

drop function if exists public.cms_is_editor();
drop table    if exists public.cms_editor;


-- ---------------------------------------------------------------------------
-- Authorship now points at cms_user
-- ---------------------------------------------------------------------------
-- created_by/updated_by referenced auth.users. The ids the server writes are
-- cms_user ids now, so without this every create would fail on a foreign key.
--
-- The UPDATE below is a no-op on any project where this runs in order — the CMS
-- tables have never held a row authored by a Supabase user. It exists so that
-- re-running the file, or running it on a project that did briefly use the
-- magic-link build, cannot fail on an orphaned reference. An author id that
-- names a deleted account is worth nothing; NULL says the same thing honestly.

update public.cms_document set created_by = null
  where created_by is not null
    and not exists (select 1 from public.cms_user u where u.id = cms_document.created_by);
update public.cms_document set updated_by = null
  where updated_by is not null
    and not exists (select 1 from public.cms_user u where u.id = cms_document.updated_by);
update public.cms_media set created_by = null
  where created_by is not null
    and not exists (select 1 from public.cms_user u where u.id = cms_media.created_by);

alter table public.cms_document drop constraint if exists cms_document_created_by_fkey;
alter table public.cms_document drop constraint if exists cms_document_updated_by_fkey;
alter table public.cms_media    drop constraint if exists cms_media_created_by_fkey;

alter table public.cms_document add constraint cms_document_created_by_fkey
  foreign key (created_by) references public.cms_user (id) on delete set null;
alter table public.cms_document add constraint cms_document_updated_by_fkey
  foreign key (updated_by) references public.cms_user (id) on delete set null;
alter table public.cms_media add constraint cms_media_created_by_fkey
  foreign key (created_by) references public.cms_user (id) on delete set null;


-- ---------------------------------------------------------------------------
-- Policies — cms_document, cms_media, storage
-- ---------------------------------------------------------------------------
-- What is left after the editor policies are gone: one public read of published
-- documents on the public column set, one public read of media rows, one public
-- read of the media bucket. Everything else is service_role, which bypasses RLS
-- and only exists behind /api/cms/*.
--
-- The write grants to `authenticated` go with the policies. Leaving a grant in
-- place with no policy to satisfy is a trap for whoever adds the next policy.

revoke insert, update, delete on public.cms_document from authenticated;
revoke insert, update, delete on public.cms_media    from authenticated;

-- Re-asserted from 0001 so this file describes the finished state rather than a
-- diff against it. Column-level, because RLS filters rows and cannot hide
-- columns: `draft`, `created_by`, `updated_by` and `legacy_*` are absent, so no
-- browser key reads unpublished edits or author ids whatever policy matches.
grant select (id, type, data, status, published_at, created_at, updated_at)
  on public.cms_document to anon, authenticated;
grant select (id, bucket, path, url, mime, width, height, alt, created_at)
  on public.cms_media to anon, authenticated;

drop policy if exists cms_document_public_read on public.cms_document;
create policy cms_document_public_read
  on public.cms_document
  for select
  to anon, authenticated
  using (status = 'published');

drop policy if exists cms_media_public_read on public.cms_media;
create policy cms_media_public_read
  on public.cms_media
  for select
  to anon, authenticated
  using (true);

drop policy if exists cms_storage_public_read on storage.objects;
create policy cms_storage_public_read
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'cms-media');


-- ---------------------------------------------------------------------------
-- Housekeeping
-- ---------------------------------------------------------------------------
-- Sessions expire; the rows do not remove themselves. Called opportunistically
-- by the server on sign-in, which is often enough for a table that grows by one
-- row per login. Revoked rows are kept for 30 days so "who was signed in when"
-- survives an incident.

create or replace function public.cms_prune_sessions()
returns integer
language sql
volatile
set search_path = public, pg_temp
as $$
  with gone as (
    delete from public.cms_session
    where expires_at < now() - interval '7 days'
       or (revoked_at is not null and revoked_at < now() - interval '30 days')
    returning 1
  )
  select count(*)::integer from gone;
$$;

revoke all on function public.cms_prune_sessions() from public, anon, authenticated;
grant execute on function public.cms_prune_sessions() to service_role;


-- ---------------------------------------------------------------------------
-- The first owner
-- ---------------------------------------------------------------------------
-- Nothing to run by hand. Set CMS_ADMIN_EMAIL and CMS_ADMIN_PASSWORD and sign
-- in; the first sign-in attempt seeds the owner and then the pair is inert
-- forever. Change the password in the admin afterwards — the environment copy
-- stops meaning anything the moment the row exists, so it is only ever as good
-- as the first login.
--
-- Recovery, if a project ever ends up with accounts but no usable owner. The
-- constraint trigger above makes that unreachable through the application, so
-- getting there takes direct SQL, and getting out takes direct SQL too — the
-- environment pair deliberately will not do it, because a seed that reactivates
-- whenever the owner list looks wrong is exactly the back door AUTH.md rules
-- out. Promote someone who already exists:
--
--   update public.cms_user set role = 'owner', disabled_at = null
--   where email = 'someone@prochazkagroup.cz';
--
-- Or empty the table and let the seed run again on the next sign-in:
--
--   alter table public.cms_user disable trigger cms_user_last_owner_guard;
--   delete from public.cms_user;
--   alter table public.cms_user enable trigger cms_user_last_owner_guard;
