// Úvodní stránka — hero, info, proces, výzva. Rozepisuje agent „home".
import { defineBlock, definePage, f } from '@c3studium/valecms/site'
import type { Reader } from '@c3studium/valecms/site'

// Klíče bloků téhle stránky. Tvar `<stránka>.<sekce>` = `page` v getSiteCopy.
// Komponenty i seed se odkazují jen na ně; keys.ts je pouze rozcestník.
export const HOME = {
    hero: 'index.hero',
    info: 'index.info',
    process: 'index.process',
    cta: 'index.cta',
} as const

// Deklarace balíčku (types/index.d.ts) popisují `f.label`, `f.labels` a `f.plain`
// s parametrem `path`, který implementace (src/site/fields.js) nemá: čtou index
// položky, resp. volby. Než se deklarace srovnají, mluví se tu s implementací
// napřímo — pouhé přetypování, za běhu se nic nemění.
const { label, labels, plain } = f as unknown as {
    label: (index: number) => Reader
    labels: (options?: { from?: number; count?: number; pad?: boolean }) => Reader
    plain: () => Reader
}

// `siteCopy` má pole `gallery`, ale žádnou čtečku `f.gallery`. `f.text` je holé
// `block[path] || ''`, takže pole obrázků projde beze změny a adresa pro
// kontrolu anotací (`reads`) zůstává správná — což `f.from` neumí.
const gallery = () => f.text('gallery')

// Jedna sekce = jeden blok. Texty se zvýrazněním sedí v `items[].label` (jediné
// pole položky s deklarovaným zvýrazněním) a čtou se dekódované přes
// `markedLabels`; komponenta si z pole bere indexy. Pořadí položek je smlouva
// mezi seedem, tímhle souborem a komponentou — kdo přehazuje, přehazuje trojí.
export const homepage = definePage({
    route: '/',
    title: 'Domů',
    copy: 'index',
    sources: {},
    blocks: [
        defineBlock({
            at: 'hero',
            key: HOME.hero,
            title: 'Úvod',
            fields: {
                // Řádky nadpisu jsou položky 0–2: <h1> je sloupec spanů bez <br>,
                // což je přesně tvar pro anotaci `lines` (items.*.label).
                labels: f.markedLabels(),
                labelMark: f.markName('items.*.label'),
                scrollHint: label(3),
                // Čtyři karty ukázek: lead = klient, label = obor, value = tlačítko.
                cards: f.rows({ from: 4, count: 4, pick: ['lead', 'label', 'value'] }),
                portrait: f.image(),
                gallery: gallery(),
                docId: f.docId(),
            },
        }),
        defineBlock({
            at: 'info',
            key: HOME.info,
            title: 'Služby a nástroje',
            fields: {
                heading: f.lines('headline'),
                lead: plain(),
                toolsLabel: label(0),
                tools: labels({ from: 1, count: 4 }),
                cta: label(5),
                cardLabel: label(6),
                cardTitle: label(7),
                cardLead: label(8),
                tags: labels({ from: 9, count: 4 }),
                cardCta: label(13),
                stacked: f.rows({ from: 14, count: 3, pick: ['lead', 'label'] }),
                stats: f.rows({ from: 17, count: 5, pick: ['value', 'label'] }),
                // Portrét je tu dekorace (alt=""), nesmí zdědit titulek bloku.
                portrait: f.image({ alt: 'none' }),
                docId: f.docId(),
            },
        }),
        defineBlock({
            at: 'process',
            key: HOME.process,
            title: 'Jak probíhá spolupráce',
            fields: {
                eyebrow: f.text('title'),
                // Položky 0–1 jsou řádky nadpisu (viz hero), 3–7 texty kroků —
                // ty nesou tučné fráze jako zvýraznění, proto sedí v `label`.
                labels: f.markedLabels(),
                labelMark: f.markName('items.*.label'),
                lead: plain(),
                scrollHint: label(2),
                // Číslo a název kroku; text kroku je `labels[3 + i]`.
                steps: f.rows({ from: 3, count: 5, pick: ['lead', 'note'] }),
                portrait: f.image({ alt: 'none' }),
                // Sedm ukázek v pořadí, v jakém je track vykresluje (tvorba 3,
                // doladění 1, předání 3). Jeden soubor smí být v sadě dvakrát.
                gallery: gallery(),
                docId: f.docId(),
            },
        }),
        defineBlock({
            at: 'cta',
            key: HOME.cta,
            title: 'Výzva ke spolupráci',
            fields: {
                eyebrow: f.text('title'),
                heading: f.lines('headline'),
                // 0 podtitul, 2 stav „odpovím do", 3 text recenze, 6–7 claim v patě.
                labels: f.markedLabels(),
                labelMark: f.markName('items.*.label'),
                action: label(1),
                // Jméno a role autora recenze; její text je `labels[3]`.
                review: f.rows({ from: 3, count: 1, pick: ['value', 'note'] }),
                stats: f.rows({ from: 4, count: 2, pick: ['value', 'label'] }),
                portrait: f.image({ alt: 'none' }),
                gallery: gallery(),
                docId: f.docId(),
            },
        }),
    ],
})
