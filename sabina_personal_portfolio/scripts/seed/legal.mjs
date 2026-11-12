// Seed právních stránek — /cookies, /ochrana-soukromi, /obchodni-podminky.
//
// Texty DOSLOVA ty z kódu (src/components/legal/terms.ts a výchozí hlavy
// komponent) — po seedu se na webu nic nezmění, jen to půjde upravit ve
// Studiu. Klíče z src/lib/cms/legal.ts.
//
// Hvězdičky (*…*) se tu nepoužívají: nic na těchto stránkách nekreslí
// zvýraznění, hvězdička by na stránku šla jako hvězdička.
import { COOKIES, PRIVACY, TERMS } from '../../src/lib/cms/legal.ts'
import { CookiesSections, PrivacySections, TermsSections } from '../../src/components/legal/terms.ts'

const line = (label) => ({ label, value: '', lead: '', note: '' })

const sections = (page, keys, list) =>
    list.map((section, i) => ({
        key: keys[i],
        page,
        title: section.title,
        body: section.content || '',
        items: [],
    }))

// Hlava ochrany soukromí a obchodních podmínek: položky podle PRIVACY_HERO
// (0 štítek, 1–3 řádky nadpisu, 4 úvod, 5 popisek obsahu); `title` = slova
// vedle štítku.
const legalHero = (key, page, { tag, words, heading, lead, indexLabel }) => ({
    key,
    page,
    title: words,
    items: [line(tag), ...heading.map(line), line(lead), line(indexLabel)],
})

export const blocks = [
    /* ---------- /cookies ---------- */
    {
        key: COOKIES.hero,
        page: 'cookies',
        title: 'Úvod stránky',
        body: 'Zde si můžete nastavit, ke kterým budeme mít přístup.',
        items: [line('Co jsou cookies'), line('a jak je používáme.')],
    },
    { key: COOKIES.index, page: 'cookies', title: 'Obsah', items: [] },
    ...sections('cookies', COOKIES.sections, CookiesSections),
    {
        key: COOKIES.manage,
        page: 'cookies',
        title: 'Chcete si přenastavit vaše cookies?',
        items: [line('Nastavit')],
    },

    /* ---------- /ochrana-soukromi ---------- */
    legalHero(PRIVACY.hero, 'ochrana-soukromi', {
        tag: 'GDPR',
        words: 'Ochrana soukromí',
        heading: ['Vše o ochraně,', 'použití vašich údajů', 'a informací.'],
        lead: 'Detaily a všechny podrobné informace',
        indexLabel: 'Obsah',
    }),
    ...sections('ochrana-soukromi', PRIVACY.sections, PrivacySections),

    /* ---------- /obchodni-podminky ---------- */
    legalHero(TERMS.hero, 'obchodni-podminky', {
        tag: 'VOP',
        words: 'Obchodní podmínky',
        heading: ['Jak spolu', 'budeme pracovat', 'od zadání po předání.'],
        lead: 'Objednávka, cena, korektury, předání a autorská práva',
        indexLabel: 'Obsah',
    }),
    ...sections('obchodni-podminky', TERMS.sections, TermsSections),
]
