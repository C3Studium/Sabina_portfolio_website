// O mně. Rozepisuje agent „about".
import { defineBlock, definePage, f } from '@c3studium/valecms/site'

// Klíče bloků téhle stránky. Tvar `<stránka>.<sekce>` = `page` v getSiteCopy.
// Komponenty i seed se odkazují jen na ně; keys.ts je pouze rozcestník.
//
// Sekce about-me je jedna komponenta, ale pět bloků. Důvod je v schématu
// siteCopy: `headline` (jediné pole, které nese ruční zalomení i zvýraznění)
// je na bloku jen jedno, a nadpis „Něco / o mně" i motto pod ním ho potřebují
// oba. Karty a dva panely mají každý vlastní seznam položek, takže jeden blok
// by je slil do jednoho `items`.
export const ABOUT = {
    me: 'about.me',
    lead: 'about.lead',
    highlights: 'about.highlights',
    courses: 'about.courses',
    skills: 'about.skills',
} as const

// Panel ve spodní řadě: štítek, nadpis, popis a štítky. Dva panely, jeden tvar.
//
// `plain('body')`: argument vyžaduje jen typová deklarace balíčku, čtečka za
// běhu vždy čte `bodyText`. Popis se sází přímo do `<p>`, richText by tam
// vnesl vlastní `<p>`.
const panelFields = () => ({
    label: f.text('title'),
    heading: f.lines('headline'),
    text: f.plain('body'),
    tags: f.rows({ pick: ['label'] }),
    docId: f.docId(),
})

export const aboutPage = definePage({
    route: '/about',
    title: 'O mně',
    copy: 'about',
    sources: {},
    blocks: [
        defineBlock({
            at: 'me',
            key: ABOUT.me,
            title: 'O mně — úvod a portrét',
            fields: {
                eyebrow: f.text('title'),
                heading: f.lines('headline'),
                // `sizes` patří sem, ne k assetu: říká, jakou variantu má prohlížeč
                // stáhnout pro TOHLE použití fotky.
                image: f.image({ sizes: '(max-width: 1100px) 70vw, 56vw' }),
                docId: f.docId(),
            },
        }),
        defineBlock({
            at: 'lead',
            key: ABOUT.lead,
            title: 'O mně — motto',
            fields: {
                heading: f.lines('headline'),
                docId: f.docId(),
            },
        }),
        // Tři karty jako tři položky jednoho bloku: lead = štítek nad kartou,
        // label = titulek, note = podtitulek, value = popis. Ikony zůstávají
        // v kódu a váží se na pozici, takže POŘADÍ položek v CMS musí sedět
        // na pořadí karet v komponentě.
        defineBlock({
            at: 'highlights',
            key: ABOUT.highlights,
            title: 'O mně — karty',
            fields: {
                cards: f.rows({ from: 0, count: 3, pick: ['lead', 'label', 'note', 'value'] }),
                // Jméno značky, které pole `items.*.label` deklaruje — překryv ji
                // potřebuje znát, aby nad titulkem nabídl zvýraznění.
                titleMark: f.markName('items.*.label'),
                docId: f.docId(),
            },
        }),
        defineBlock({ at: 'courses', key: ABOUT.courses, title: 'O mně — kurzy', fields: panelFields() }),
        defineBlock({ at: 'skills', key: ABOUT.skills, title: 'O mně — specializace', fields: panelFields() }),
    ],
})
