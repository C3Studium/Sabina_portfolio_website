-- API keys the CMS issues — cms_api_key.
--
-- Run after 0002_cms_auth.sql (Supabase SQL editor, or psql with the connection
-- string from Project Settings -> Database). Re-runnable: every object is
-- created with IF NOT EXISTS or replaced.
--
-- Numbered 0005 rather than 0004 on purpose: 0004 is being written in parallel
-- to close the legacy-table grants the audit found. Two migrations claiming one
-- number is a merge conflict in the one place a merge conflict must not be
-- resolved by guessing.
--
-- The table exists so an outside system can READ this site's published content
-- without a person's session behind it. What it is not is a second way in:
-- src/cms/server/handlers/content.js is the only route that accepts a key, and
-- the port it constructs (src/cms/server/contentApi.js) has two read methods on
-- it. Nothing here grants a key anything; the grant is the shape of that port.
--
-- Posture is cms_session's, unchanged and for the same reason: the table holds
-- a SHA-256 of the token and never the token, and no browser-held key may touch
-- it at all — `revoke all ... from anon, authenticated`, with no policy ever
-- created, so the privilege system denies it before RLS is consulted. A leaked
-- key table must be a list of digests, not a set of working credentials.

create extension if not exists pgcrypto with schema extensions;   -- gen_random_uuid


-- ---------------------------------------------------------------------------
-- cms_api_key
-- ---------------------------------------------------------------------------
-- `name` is what an owner recognises the key by in the Studio; it is required,
-- because "which system is this one for" is the question asked at revocation
-- time and an unnamed key cannot answer it.
--
-- There is deliberately NO column holding a prefix or the first characters of
-- the token. A prefix is a real usability feature elsewhere and it is not worth
-- it here: the promise this table makes is that it stores a digest and nothing
-- else, and a promise with an exception in it is harder to verify than one
-- without. Keys are told apart by their name.
--
-- `created_by` is ON DELETE SET NULL, like cms_user.created_by: an integration
-- must not stop working because the owner who set it up left the company.
--
-- `revoked_at` rather than a delete, so the list can still say a key existed
-- and was turned off, and so revocation has something to refuse rather than a
-- row that is simply absent.

create table if not exists public.cms_api_key (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (length(btrim(name)) between 1 and 60),
  token_hash   text not null unique,
  created_at   timestamptz not null default now(),
  created_by   uuid references public.cms_user (id) on delete set null,
  last_used_at timestamptz,
  revoked_at   timestamptz,

  -- The same tripwire as cms_session_token_hash_is_digest: a SHA-256 is 64 hex
  -- characters and an issued token is not, so a bug that ever wrote the real
  -- token into this column fails on insert instead of silently working.
  constraint cms_api_key_token_hash_is_digest
    check (token_hash ~ '^[a-f0-9]{64}$')
);

-- The lookup every content request makes: digest -> key, live ones only.
create index if not exists cms_api_key_live_idx
  on public.cms_api_key (token_hash) where revoked_at is null;


-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
-- Identical to cms_user and cms_session. RLS is enabled and no policy is
-- created, which is belt and braces: the revoke already denies anon and
-- authenticated, and an enabled-with-no-policy table denies them again if some
-- future migration hands out a table-level grant by accident.

alter table public.cms_api_key enable row level security;

revoke all on public.cms_api_key from public, anon, authenticated;
grant all  on public.cms_api_key to service_role;
