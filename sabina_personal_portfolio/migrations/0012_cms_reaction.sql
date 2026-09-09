-- Líbí se — cms_reaction.
--
-- Run after 0011. Re-runnable.
--
-- ---------------------------------------------------------------------------
-- Proč vlastní tabulka a ne číslo v dokumentu
-- ---------------------------------------------------------------------------
-- `review.likes` a `consultant.stats.likes` v těle dokumentu už existují a nesou
-- počty přenesené ze staré databáze. Přičítat do nich by ale znamenalo, že první
-- publikování dokumentu ty liky zahodí: `publish()` přepíše `data` obsahem
-- `draft`, a koncept vznikl dřív, než návštěvníci klikali. Schéma to samo
-- předvídá — u počítadel stojí „Udržuje web, ne editor".
--
-- Takže: každý like je řádek tady, a to, co web ukazuje, je součet výchozí
-- hodnoty z dokumentu a řádků z téhle tabulky. Editor ani publikování nemají co
-- rozbít, protože se dotýkají jen té výchozí hodnoty.
--
-- ---------------------------------------------------------------------------
-- Jeden hlas na jednu adresu, bez ukládání adresy
-- ---------------------------------------------------------------------------
-- Stará tabulka `reviews` držela `ip_list` s holou IP adresou — osobní údaj bez
-- uvedeného právního titulu, který migrace 0004 odstraňuje. Duplicitu ale
-- pozná stejně dobře otisk: `ip_hash` je sha256 z adresy a serverové soli
-- (CMS_IP_HASH_SALT), tedy totéž, co tenhle projekt už dělá v omezovači pokusů
-- o přihlášení. Ze samotného otisku se adresa zpětně nedá získat, a bez soli ho
-- nejde ani předpočítat pro celý rozsah IPv4.
--
-- Unikátní index přes trojici je to, co drží „jenom jeden": druhý pokus skončí
-- konfliktem, ne druhým řádkem, a server na něj odpoví počtem, ne chybou.

create table if not exists public.cms_reaction (
  id          uuid primary key default gen_random_uuid(),
  -- Ne cizí klíč na cms_document: reakce má přežít archivaci i tvrdé smazání
  -- toho, k čemu patří, aby počet nešel snížit tím, že se něco uklidí. Typ je
  -- tu proto, aby dvě různé věci nemohly sdílet jedno id.
  target_type text not null check (target_type in ('review', 'consultant')),
  target_id   uuid not null,
  ip_hash     text not null,
  created_at  timestamptz not null default now(),

  unique (target_type, target_id, ip_hash)
);

create index if not exists cms_reaction_target_idx
  on public.cms_reaction (target_type, target_id);

-- Čtení počtů dělá server službním klíčem, stejně jako všechno ostatní pod
-- /api/cms. Anonymní klíč sem nesmí — ani číst, protože seznam otisků je
-- přesně to, co by se nemělo dát stáhnout a porovnávat.
alter table public.cms_reaction enable row level security;
revoke all on public.cms_reaction from public, anon, authenticated;

comment on table public.cms_reaction is
  'Jeden like = jeden řádek. Počet, který web ukazuje, je výchozí hodnota '
  'v dokumentu plus počet řádků tady.';
comment on column public.cms_reaction.ip_hash is
  'sha256(IP + CMS_IP_HASH_SALT). Adresa se neukládá — viz hlavička migrace.';
