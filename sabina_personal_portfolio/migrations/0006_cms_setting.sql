-- Stored configuration — cms_setting.
--
-- Run after 0005_cms_api_key.sql (Supabase SQL editor, or psql with the
-- connection string from Project Settings -> Database). Re-runnable: every
-- object is created with IF NOT EXISTS.
--
-- Until now "settings" in this system meant environment variables, and
-- src/cms/server/settings.js reports them without ever returning one. That file
-- answers "what is this deployment configured to do". This table answers a
-- different question — "what has an owner chosen" — and the two are kept apart
-- deliberately: an environment variable is set by whoever deploys, cannot be
-- changed from a browser, and takes a redeploy to move; a row here is changed
-- by an owner from /studio/settings and takes effect on the next request.
--
-- One row per key, the value as jsonb. A key/value table rather than a column
-- per setting because the alternative is a migration every time somebody wants
-- a corner moved, and because the shape of each value is already validated in
-- JavaScript by the module that owns it (src/cms/server/manageWidget.js) —
-- restating it as SQL columns would create a second definition that drifts.
--
-- NOTHING SECRET GOES IN THIS TABLE. Not an API token, not a password, not a
-- webhook URL with a key in it. Values here are read by an endpoint that does
-- not require a session (handlers/widget.js explains why a corner and a colour
-- do not), so a secret stored here is a secret published. If a future setting
-- needs a secret, it needs its own table and its own owner-only read path.

create extension if not exists pgcrypto with schema extensions;   -- gen_random_uuid


-- ---------------------------------------------------------------------------
-- cms_setting
-- ---------------------------------------------------------------------------
-- `key` is the primary key and is a stable dotted/underscored identifier the
-- code writes literally, never something a user types. `value` is jsonb rather
-- than text so a malformed write fails at the database rather than at the first
-- JSON.parse three requests later.
--
-- `updated_by` is ON DELETE SET NULL, like cms_api_key.created_by: a setting
-- must not be reset because the person who chose it left.

create table if not exists public.cms_setting (
  key        text primary key check (key ~ '^[a-z][a-z0-9_.]{0,63}$'),
  value      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.cms_user (id) on delete set null
);

create or replace function public.cms_setting_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists cms_setting_touch on public.cms_setting;
create trigger cms_setting_touch
  before update on public.cms_setting
  for each row execute function public.cms_setting_touch();


-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
-- Identical to cms_user, cms_session and cms_api_key, and for the same reason
-- even though the values are not secret: the ONE path that reads this table is
-- src/cms/server, through the service-role client, so a browser-held anon key
-- has no business touching it. Making it anon-readable would be a second read
-- path with its own policy to keep in step — and a policy is what would have to
-- be right the day somebody stores something here that should not be public.
--
-- RLS is enabled with no policy created: belt and braces behind the revoke.

alter table public.cms_setting enable row level security;

revoke all on public.cms_setting from public, anon, authenticated;
grant all  on public.cms_setting to service_role;
