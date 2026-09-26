-- Vícejazyčnost, vrstva 1 — cms_document_translation, cms_document_revision.lang.
--
-- Run after 0012_cms_reaction.sql (Supabase SQL editor, nebo psql s připojovacím
-- řetězcem z Project Settings -> Database). Re-runnable: každý objekt vzniká
-- s IF NOT EXISTS, politika se před vytvořením zahazuje.
--
-- Implementuje docs/I18N.md, oddíl 2. Kdo mění tvar níž, mění nejdřív ten
-- dokument — je to smlouva, podle které píše paralelně jádro i Studio.
--
-- ---------------------------------------------------------------------------
-- Proč vedlejší tabulka a ne sloupce v cms_document
-- ---------------------------------------------------------------------------
-- Dvě cesty, které se nabízejí, jsou obě dražší:
--
--   `data_en jsonb`     sloupec na jazyk znamená migraci pokaždé, když někdo
--                       v Nastavení přidá jazyk. Seznam jazyků přitom bydlí
--                       v `cms_setting` právě proto, aby se přidával bez
--                       nasazení.
--   řádek na jazyk      tedy `cms_document` s `lang`: změní se tím primární
--                       klíč dokumentu, a `id` je to, na co ukazuje
--                       `editable(doc.id, …)`, revize, reakce i recenze.
--                       Migrace dat u dvou běžících webů.
--
-- Takhle se nemigruje nic. Základní řádek `cms_document` JE výchozí jazyk
-- a zdroj všech nepřekládaných polí; překlad je overlay nad ním. Chybějící
-- překlad proto není větev v kódu, ale prázdný merge — a dokud nikdo druhý
-- jazyk nepřidá, tahle tabulka zůstane prázdná a nikdo do ní nesáhne.
--
-- ---------------------------------------------------------------------------
-- Proč má překlad vlastní `status` a `published_at`
-- ---------------------------------------------------------------------------
-- Protože se publikuje po jazycích (I18N.md, oddíl 1). Kdyby stav držel jen
-- základní řádek, znamenalo by publikování češtiny „pusť ven i rozdělanou
-- angličtinu" — a to je přesně ten druh tiché škody, kterou u textů na webu
-- nikdo nezpozoruje, dokud se na to někdo nezeptá v cizím jazyce.
--
-- `draft ?? data` je tady stejná Smlouva 3 jako u dokumentu, takže nad
-- překladem funguje náhled i „zahodit koncept" bez druhého pravidla.

create extension if not exists pgcrypto with schema extensions;   -- gen_random_uuid


-- ---------------------------------------------------------------------------
-- cms_document_translation
-- ---------------------------------------------------------------------------
-- Klíč je dvojice (dokument, jazyk) a ne vlastní `id`: druhý překlad téhož
-- dokumentu do téhož jazyka není nová věc, je to překlep. Databáze ho odmítne
-- dřív, než vzniknou dvě pravdy, mezi kterými by čtení muselo vybírat.
--
-- `on delete cascade` je tu správně a u revize (0007) by bylo špatně: tenhle
-- řádek NENÍ záznam o tom, co se stalo — je to část dokumentu. Když dokument
-- zmizí, překlad jeho polí nepopisuje nic a přežít nemá co.
--
-- `lang` je BCP 47 (`cs`, `en`, `de`, `pt-BR`). Kontrola je záměrně na tvar
-- a ne na seznam jazyků z `cms_setting`: seznam se mění z prohlížeče a cizí
-- klíč na něj by znamenal, že vypnutí jazyka v Nastavení maže obsah.
-- Nepoužívaný překlad má zůstat ležet — jazyk se vypíná a zapíná, ne překládá
-- znovu.
--
-- `updated_by` je ON DELETE SET NULL, jako cms_setting.updated_by: překlad
-- nesmí zmizet proto, že člověk, který ho napsal, odešel.

create table if not exists public.cms_document_translation (
  document_id  uuid not null references public.cms_document (id) on delete cascade,
  lang         text not null check (lang ~ '^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$'),
  data         jsonb not null default '{}'::jsonb,
  draft        jsonb,
  status       text not null default 'draft' check (status in ('draft','published')),
  published_at timestamptz,
  updated_at   timestamptz not null default now(),
  updated_by   uuid references public.cms_user (id) on delete set null,

  primary key (document_id, lang)
);

-- Veřejné čtení se ptá vždycky stejně: „překlady těchhle dokumentů do tohohle
-- jazyka, jen publikované". Primární klíč začíná `document_id`, takže na tenhle
-- dotaz nestačí; index je částečný přesně na ten predikát, ze stejného důvodu
-- jako živý index v 0003 — Postgres částečný index použije jen na dotaz,
-- o kterém umí dokázat, že ho WHERE pokrývá.
create index if not exists cms_document_translation_live_idx
  on public.cms_document_translation (lang, document_id)
  where status = 'published';


-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------
-- Stejný trigger jako u `cms_setting` v 0006 a u dokumentu v 0001, jenom se
-- nezakládá třetí funkce, která by dělala potřetí totéž: `cms_touch_updated_at()`
-- z 0001 už existuje a `set search_path` má v sobě. Tři kopie jedné dvouřádkové
-- funkce jsou tři místa, která se rozejdou.
--
-- Že tu opravdu je, se ověřuje níž — spuštění 0013 na databázi bez 0001 má
-- skončit větou, ne chybějícím razítkem, kterého si nikdo nevšimne.
do $$
begin
  if to_regprocedure('public.cms_touch_updated_at()') is null then
    raise exception 'public.cms_touch_updated_at() chybí — spusť nejdřív 0001_cms_tables.sql';
  end if;
end
$$;

drop trigger if exists cms_document_translation_touch on public.cms_document_translation;
create trigger cms_document_translation_touch
  before update on public.cms_document_translation
  for each row execute function public.cms_touch_updated_at();


-- ---------------------------------------------------------------------------
-- cms_document_revision.lang
-- ---------------------------------------------------------------------------
-- NULL = výchozí jazyk, tedy přesně to, co v tom sloupci má každá dosavadní
-- revize — a proto se nic nedoplňuje. Bez toho by archiv uměl jen okamžik
-- celého webu: „co web říkal 3. března" by v němčině vrátilo českou větu,
-- protože revize překladu by se nedala odlišit od revize základu.
--
-- Čtení bez jazyka proto od 0013 filtruje `lang is null` (server/site/archive.js).
-- Na dnešních datech to nemění ani jeden řádek; potřebné to je až ve chvíli,
-- kdy vedle základní revize leží revize překladu téhož dokumentu, jinak by
-- jedna zastínila druhou.

alter table public.cms_document_revision
  add column if not exists lang text;

-- Přehrání okamžiku v jednom jazyce. Částečný, protože revizí základu bude vždy
-- většina a ty už obsluhují indexy z 0007.
create index if not exists cms_document_revision_lang_idx
  on public.cms_document_revision (lang, changed_at desc)
  where lang is not null;


-- ---------------------------------------------------------------------------
-- Kdo sem smí
-- ---------------------------------------------------------------------------
-- Stejná pozice jako `cms_document` v 0001 a 0003: anonymní klíč přečte jen to,
-- co je publikované, a jen sloupce, které jsou v grantu. `draft` a `updated_by`
-- v něm nejsou — rozdělaný překlad je nezveřejněná práce a jméno editora není
-- věc pro návštěvníka.
--
-- Sloupcové granty jsou absolutní: sloupec, který v grantu není, nejde vybrat
-- ANI pojmenovat ve WHERE. Proto je v grantu i `status`, přestože jediná hodnota,
-- kterou přes politiku anon uvidí, je 'published' — grant dovoluje filtr napsat,
-- ne data přečíst.
--
-- Že řádek překladu nesmí odhalit skrytý dokument, drží `cms_document`: veřejné
-- čtení se ptá nejdřív na dokumenty (tam platí politika z 0003, tedy publikované
-- a nearchivované) a překlady dohledává k jejich `id`. Osamocený publikovaný
-- překlad staženého dokumentu tak nemá se čím spojit.

alter table public.cms_document_translation enable row level security;

revoke all on public.cms_document_translation from public, anon, authenticated;

grant select (document_id, lang, data, status, published_at, updated_at)
  on public.cms_document_translation to anon, authenticated;

drop policy if exists cms_document_translation_public_read on public.cms_document_translation;
create policy cms_document_translation_public_read
  on public.cms_document_translation
  for select
  to anon, authenticated
  using (status = 'published');

-- Zápis je jen přes service_role, tedy přes /api/cms/*, kde už někdo ověřil
-- přihlášení. Authenticated tu žádné psací sloveso nedostává ani jako v 0001,
-- protože překlady vznikly až po tom, co se Studio přestalo autentizovat proti
-- Supabase Auth (0004) — role `authenticated` dneska nikomu nepatří.
grant all on public.cms_document_translation to service_role;


-- ---------------------------------------------------------------------------
-- Co tahle migrace schválně NEDĚLÁ
-- ---------------------------------------------------------------------------
-- Nezakládá řádek pro výchozí jazyk. Čeština leží v `cms_document` a ten řádek
-- JE výchozí jazyk; kopie v téhle tabulce by byla druhá pravda o témž textu
-- a první věc, která se rozejde.
--
-- Nezná seznam jazyků. Ten bydlí v `cms_setting` pod klíčem `site.languages`
-- (I18N.md, oddíl 1) a mění se z Nastavení, bez migrace a bez nasazení.
--
-- Nepřidává `lang` do žádné cesty, která ho dneska nezná. Čtení bez `lang` sahá
-- na základní řádek a tahle tabulka se ho ani nedotkne — což je podmínka toho,
-- že se dva běžící weby po migraci chovají úplně stejně jako před ní.
