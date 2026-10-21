# Seed — kontrakt souborů

Jeden soubor na stránku: `home.mjs`, `about.mjs`, `projects.mjs`, `layout.mjs`.
Runner `scripts/cms-seed.mjs` je načte všechny, nic jiného na databázi nesahá.

```js
// scripts/seed/home.mjs
export const blocks = [
    {
        // type: 'siteCopy' je výchozí; jiný typ (např. 'project') se uvede
        key: 'index.hero',        // = HOME.hero v src/lib/cms/keys.ts, NIKDY jinak
        page: 'index',            // = `copy` stránky v definePage
        title: 'Hero',            // jméno bloku ve Studiu
        headline: 'Sabina …',     // pole podle schématu siteCopy
        body: 'Text odstavce.',
        items: [{ label: 'Tlačítko', value: 'Kam vede', lead: '', note: '' }],
        // obrázek = ZNAČKA k nahrání: cesta v /public + alt. Runner soubor
        // nahraje do knihovny médií a značku nahradí { id, url, alt, width, height }.
        image: { image: '/assets/banners/hero.png', alt: 'Popis fotky' },
        gallery: [{ image: '/assets/rest/a.webp', alt: '…' }],
    },
]
```

Pravidla:

- **Texty doslova ty, které dnes stojí v kódu.** Po seedu se na webu nic nezmění;
  změní se jen to, že to jde upravit ve Studiu.
- **Klíče jen z `src/lib/cms/keys.ts`.** Runner klíč nekontroluje — kontrolou je,
  že komponenta a konfigurace berou tentýž export.
- **Existující blok se nechává být.** Runner je idempotentní; opakované spuštění
  založí jen to, co chybí.
- **Obrázky jen značkou** `{ image: '/assets/…', alt }`. Nikdy `url` napřímo —
  cílem je knihovna médií, ne odkaz na `/public`.
- Nasucho: `pnpm run cms:seed`. Zápis: `pnpm run cms:seed -- --write`.
  Jedna stránka: `-- --only=home`.
