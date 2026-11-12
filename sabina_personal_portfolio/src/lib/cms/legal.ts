// Právní stránky — /cookies a /ochrana-soukromi. Model převzatý z webu
// Procházka Group (cms.config.js): ODDÍL je blok — nadpis (`title`) a odstavec
// (`body`) spolu, protože právní text se mění větou uprostřed odstavce.
// Kolik oddílů je a jejich kotvy (#rights) určuje kód (components/legal/
// terms.ts); Studio určuje, co říkají. Obsah (rejstřík) se neanotuje — tiskne
// tytéž nadpisy podruhé a pole smí psát jen jeden prvek.
import { defineBlock, defineBlockList, definePage, f } from '@c3studium/valecms/site'

// Čtečka položky podle indexu — za běhu bere číslo, typová deklarace balíčku
// říká string (stejné přetypování jako v cms/projects.ts).
const label = (f as unknown as { label: (index: number) => ReturnType<typeof f.text> }).label

const range = (prefix: string, ids: string[]) => ids.map((id) => `${prefix}.${id}`)

export const COOKIES = {
    hero: 'cookies.hero',
    // Slovo nad obsahem, vlastní blok: položky `cookies.hero` JSOU dva řádky
    // nadpisu a třetí by byl třetím řádkem <h1>.
    index: 'cookies.obsah',
    sections: range('cookies.sekce', ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10']),
    manage: 'cookies.sprava',
} as const

export const PRIVACY = {
    hero: 'ochrana-soukromi.hero',
    sections: range('ochrana-soukromi', ['privacy', 'data', 'use', 'sharing', 'legal-basis', 'retention', 'rights', 'international', 'dpo']),
} as const

/** Položky bloku `ochrana-soukromi.hero` podle pořadí. */
export const PRIVACY_HERO = Object.freeze({
    // Zvýrazněný štítek nadtitulku; slova vedle něj jsou `title` bloku.
    tag: 0,
    // <h1> — tři řádky, každý vlastní <span>.
    headingFrom: 1,
    headingCount: 3,
    lead: 4,
    // Slovo nad obsahem (na telefonu ho tiskne i rozbalovací řádek).
    indexLabel: 5,
})

export const cookiesPage = definePage({
    route: '/cookies',
    title: 'Zásady cookies',
    copy: 'cookies',
    sources: {},
    blocks: [
        // Nadpis: dva uložené řádky editované jako jeden blok (editableLines).
        defineBlock({
            at: 'hero',
            key: COOKIES.hero,
            title: 'Úvod stránky',
            fields: {
                heading: f.labels({ from: 0, count: 2, pad: true }),
                lead: f.plain('body'),
                docId: f.docId(),
            },
        }),
        defineBlock({
            at: 'index',
            key: COOKIES.index,
            title: 'Obsah — popisek',
            fields: {
                label: f.text('title'),
                docId: f.docId(),
            },
        }),
        defineBlockList({
            at: 'sections',
            keys: [...COOKIES.sections],
            title: 'Oddíly',
            fields: {
                heading: f.text('title'),
                // Holý text: druhý oddíl má nadpis bez odstavce a obalující <p>
                // by na stránku dal prázdný odstavec.
                body: f.plain('body'),
                docId: f.docId(),
            },
        }),
        //   items[0]  text tlačítka
        defineBlock({
            at: 'manage',
            key: COOKIES.manage,
            title: 'Správa předvoleb',
            fields: {
                heading: f.text('title'),
                cta: label(0),
                docId: f.docId(),
            },
        }),
    ],
})

export const privacyPage = definePage({
    route: '/ochrana-soukromi',
    title: 'Ochrana soukromí',
    copy: 'ochrana-soukromi',
    sources: {},
    blocks: [
        defineBlock({
            at: 'hero',
            key: PRIVACY.hero,
            title: 'Úvod stránky',
            fields: {
                tag: label(PRIVACY_HERO.tag),
                words: f.text('title'),
                heading: f.labels({ from: PRIVACY_HERO.headingFrom, count: PRIVACY_HERO.headingCount, pad: true }),
                lead: label(PRIVACY_HERO.lead),
                indexLabel: label(PRIVACY_HERO.indexLabel),
                docId: f.docId(),
            },
        }),
        defineBlockList({
            at: 'sections',
            keys: [...PRIVACY.sections],
            title: 'Oddíly',
            fields: {
                heading: f.text('title'),
                // Holý text: e-maily v něm dělá odkazy komponenta.
                body: f.plain('body'),
                docId: f.docId(),
            },
        }),
    ],
})

// Obchodní podmínky — stejný tvar jako ochrana soukromí (hlava + oddíly).
export const TERMS = {
    hero: 'obchodni-podminky.hero',
    sections: range('obchodni-podminky', ['uvod', 'objednavka', 'cena', 'spoluprace', 'predani', 'prava', 'mlcenlivost', 'odpovednost', 'zaver']),
} as const

export const termsPage = definePage({
    route: '/obchodni-podminky',
    title: 'Obchodní podmínky',
    copy: 'obchodni-podminky',
    sources: {},
    blocks: [
        defineBlock({
            at: 'hero',
            key: TERMS.hero,
            title: 'Úvod stránky',
            fields: {
                tag: label(PRIVACY_HERO.tag),
                words: f.text('title'),
                heading: f.labels({ from: PRIVACY_HERO.headingFrom, count: PRIVACY_HERO.headingCount, pad: true }),
                lead: label(PRIVACY_HERO.lead),
                indexLabel: label(PRIVACY_HERO.indexLabel),
                docId: f.docId(),
            },
        }),
        defineBlockList({
            at: 'sections',
            keys: [...TERMS.sections],
            title: 'Oddíly',
            fields: {
                heading: f.text('title'),
                body: f.plain('body'),
                docId: f.docId(),
            },
        }),
    ],
})

export const legalPages = [cookiesPage, privacyPage, termsPage]
