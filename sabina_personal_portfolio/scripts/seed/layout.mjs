// Seed globálních bloků — hlavička, patička, kontaktní modál. Kontrakt viz README.md.
//
// Texty doslova ty, které dnes stojí v kódu (FALLBACK v komponentách pod
// src/components/layout/). Po seedu se na webu nic nezmění; změní se jen to,
// že to jde upravit ve Studiu.
//
// Pořadí `items` JE kontrakt: komponenty adresují řádky pozicí (konstanta
// `LINES` v každé z nich) a seed zakládá položky ve stejném pořadí. Přehodit
// je znamená přehodit obojí.
//
// Klíče = GLOBAL.* v src/lib/cms/layout.ts, page = `copy` z defineGlobals.
// Logo je jeden soubor na třech místech — runner ho nahraje jednou a značku
// nahradí týmž řádkem médií.

const LOGO = { image: '/assets/rest/logo.png', alt: 'Sabina Hudrmentová — logo' }

// Jméno a příjmení jako dvě půlky jedné položky, stejně ve všech třech blocích.
const BRAND = { label: 'Sabina', value: 'Hudrmentová' }

export const blocks = [
    {
        key: 'global.header', // = GLOBAL.header
        page: 'global',
        title: 'Hlavička',
        image: LOGO,
        items: [
            BRAND, // 0 značka
            { label: 'Domluvit spolupráci' }, // 1 tlačítko
        ],
    },
    {
        key: 'global.footer', // = GLOBAL.footer
        page: 'global',
        title: 'Patička',
        image: LOGO,
        items: [
            BRAND, // 0 značka
            { label: 'Strategie.' }, // 1–3 claim, poslední řádek zvýrazněný
            { label: 'Design.' },
            { label: 'Výsledky.' },
            { label: 'Právní informace' }, // 4 nadpis sloupce
            // 5–7 právní odkazy: label = text, value = cíl. Cíle jsou zatím
            // zástupné, stejně jako v kódu — až stránky vzniknou, přepíší se
            // ve Studiu, ne v kódu.
            { label: 'Zásady ochrany údajů', value: '#' },
            { label: 'Obchodní podmínky', value: '#' },
            { label: 'Cookies', value: '#' },
            { label: 'Sledujte mě' }, // 8 nadpis sloupce
            // 9–11 sítě: label čte čtečka obrazovky, value je cíl; ikony jsou
            // v kódu a váží se pořadím.
            { label: 'Instagram', value: '#' },
            { label: 'LinkedIn', value: '#' },
            { label: 'Behance', value: '#' },
            { label: '© 2026 Sabina Hudrmentová. Všechna práva vyhrazena.' }, // 12
            { label: 'Pojďme tvořit.' }, // 13 podpis
        ],
    },
    {
        key: 'global.contact', // = GLOBAL.contact
        page: 'global',
        title: 'Kontakt',
        image: LOGO,
        // Odstavec pod nadpisem. Nadpis sám („Pustíme se / do něčeho, / co
        // *funguje*?") zůstává v kódu — viz komentář v komponentě.
        body: 'Máte v hlavě projekt? Pojďme si o něm říct. Vyplňte formulář a ozvu se vám co nejdřív.',
        items: [
            BRAND, // 0 značka
            { label: 'Pojďme do toho spolu' }, // 1 eyebrow
            // 2–5 kanály: label, value, note. Telefon i e-mail jsou ZÁSTUPNÉ,
            // stejně jako v kódu — před spuštěním přepsat ve Studiu. Odkaz
            // (tel:, mailto:) si komponenta odvozuje z hodnoty sama.
            { label: 'Zavolejte mi', value: '+420 123 456 789' },
            { label: 'Napište mi', value: 'ahoj@sabinahudrmentova.cz' },
            { label: 'Dostupnost', value: 'Po – Pá   9:00 – 18:00', note: 'Obvykle odpovím do pár hodin' },
            { label: 'Domluvit schůzku', value: 'Vybrat termín online', note: 'Vyberte si čas, který vám vyhovuje' },
            { label: 'Poslat zprávu' }, // 6 eyebrow formuláře
            { label: 'Mám zájem o spolupráci.' }, // 7 nadpis formuláře
            { label: 'Nechte mi jméno a telefon — ozvu se vám osobně a probereme váš projekt.' }, // 8
            // 9–12 placeholdery polí — atributy, upravují se jen ve formuláři
            // povrchu. Osamocená hvězdička není značka zvýraznění (ta chce pár).
            { label: 'Vaše jméno *' },
            { label: 'Telefon *' },
            { label: 'Typ projektu (nepovinné)' },
            { label: 'Napište mi pár slov o projektu' },
            { label: 'Odeslat — ozvu se obratem' }, // 13 tlačítko
            { label: 'Vaše údaje jsou v bezpečí a nikdy je nikomu nepředám.' }, // 14
            { label: 'Zavřít' }, // 15 aria-label křížku
            // 16+ typy projektu — ocas seznamu, jediná část, kde je počet
            // položek obsah. Přidat šestý = přidat položku na konec.
            { label: 'Bannerová kampaň' },
            { label: 'Obsah pro sociální sítě' },
            { label: 'Vizuály pro e-shop' },
            { label: 'Kompletní vizuální identita' },
            { label: 'Něco jiného' },
        ],
    },
]
