-- Tři role — admin, owner, member.
--
-- Run after 0010. Re-runnable.
--
-- ---------------------------------------------------------------------------
-- Co se mění a proč
-- ---------------------------------------------------------------------------
-- Doteď byly role dvě, `owner` a `editor`, a `owner` znamenal „smí všechno".
-- Klient ale potřebuje být na svém webu vidět jako MAJITEL, aniž by tím dostal
-- správu uživatelů, nastavení, archiv a pole, která rozbíjejí adresy stránek.
-- Slovo „vlastník" tedy přestává být oprávněním a stává se popiskem.
--
--   admin   vývojář. Účet z CMS_ADMIN_EMAIL. Vidí a smí všechno.
--   owner   majitel. Dnes přesně to co member — je to titul, ne pravomoc.
--   member  člen redakce.
--
-- `owner` a `member` mají záměrně shodná práva. Až se budou lišit, změní se to
-- na jednom místě v server/auth.js, ne rozsypáním nových kontrol po handlerech.
--
-- ---------------------------------------------------------------------------
-- Jak se převádí, co už v tabulce je
-- ---------------------------------------------------------------------------
-- `owner` -> `admin`, ne -> `owner`. Vypadá to zpětně, ale je to ta opatrná
-- volba: dnešní `owner` je jediný účet s plnými právy a odebrat mu je migrací
-- by znamenalo, že po nasazení nemá kdo spravovat uživatele. Kdo má být
-- majitelem v novém smyslu, se založí nebo přepne ručně — vědomě, ne mlčky.
--
-- `editor` -> `member`. Totéž jiným slovem.

-- Trigger dolů jako první, nahoru jako poslední.
--
-- `cms_user_last_owner_guard` je DEFERRABLE INITIALLY DEFERRED, takže UPDATE
-- níž mu nechá viset události do konce transakce — a `ALTER TABLE` na téže
-- tabulce pak skončí na `55006: cannot ALTER TABLE ... pending trigger events`.
-- Změřeno: první verze téhle migrace na tom spadla. Sundat ho je zároveň
-- správně věcně: mezi UPDATE a novou definicí funkce by hlídal roli, kterou
-- řádky zrovna nemají.
drop trigger if exists cms_user_last_owner_guard on public.cms_user;

alter table public.cms_user drop constraint if exists cms_user_role_check;

update public.cms_user set role = 'admin'  where role = 'owner';
update public.cms_user set role = 'member' where role = 'editor';

alter table public.cms_user
  add constraint cms_user_role_check check (role in ('admin', 'owner', 'member'));

alter table public.cms_user alter column role set default 'member';

-- ---------------------------------------------------------------------------
-- Poslední admin nesmí zmizet
-- ---------------------------------------------------------------------------
-- Stejná pojistka jako dřív, jen hlídá roli, která teď nese práva. Bez ní by
-- šlo posledního admina degradovat a nikdo by pak nemohl spravovat uživatele —
-- z aplikace by nevedla cesta zpět.
create or replace function public.cms_guard_last_owner()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1 from public.cms_user
    where role = 'admin' and disabled_at is null
  ) then
    raise exception 'cms_user: the last active admin cannot be demoted, disabled or deleted'
      using errcode = 'check_violation';
  end if;
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- První účet je admin
-- ---------------------------------------------------------------------------
-- Jméno funkce zůstává. Přejmenovat ji by znamenalo měnit i grant, revoke a
-- volání v server/auth.js kvůli slovu — a to slovo popisuje, co dělá: zakládá
-- prvního uživatele, když je tabulka prázdná. Co se změnilo, je role, kterou mu
-- dá.
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
         'admin'
  where not exists (select 1 from public.cms_user)
  returning cms_user.id, cms_user.email::text, cms_user.role;
$$;

comment on column public.cms_user.role is
  'admin = vývojář (účet z CMS_ADMIN_EMAIL, plná práva), owner = majitel (titul, '
  'práva jako member), member = člen redakce.';

drop trigger if exists cms_user_last_owner_guard on public.cms_user;
create constraint trigger cms_user_last_owner_guard
  after update or delete on public.cms_user
  deferrable initially deferred
  for each row execute function public.cms_guard_last_owner();
