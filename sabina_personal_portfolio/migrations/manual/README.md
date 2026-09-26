# Ruční migrace

Co leží tady, `valecms migrate` **nepustí**. Čte jen číslované soubory
o složku výš.

Není to odkladiště. Je to jediné správné místo pro SQL, které si žádá,
aby ho člověk před spuštěním přečetl — protože je destruktivní, protože
platí jen pro jeden konkrétní projekt, nebo protože se pouští po částech
a ne celé najednou.

Automatické spuštění takového souboru je chyba i tehdy, když projde:
příkaz, který se nezeptá, nemá jak poznat, že tenhle projekt je ten,
pro který to bylo psáno.

## 0004_legacy_lockdown.sql

Jednorázová oprava pro původní Supabase projekt ProchazkaGroup. Pracuje
nad tabulkami `people`, `reviews`, `total`, které tam byly **před** CMS:
odebírá anonymnímu klíči zápis a maže dva sloupce s IP adresami.

Na jakémkoli jiném projektu tyhle tabulky nejsou a soubor spadne hned
v úvodní kontrole — `relation "public.reviews" does not exist`. To není
porucha, to je ta správná odpověď.

Spouští se ručně, po sekcích, v SQL Editoru, a až po záloze. Návod je
v hlavičce souboru; sekce 4 má vlastní varování a nepouští se zatím vůbec.
