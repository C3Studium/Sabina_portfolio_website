// Úvodní stránka — hero, info, proces, výzva.
//
// Dvě vrstvy obsahu:
//
//   bloky textů (siteCopy, page 'index')  hlas sekcí — nadpisy, úvody,
//       popisky, tlačítka. Jeden blok na sekci, položky adresované pořadím.
//   dokumenty (sources)  věci, kterých je víc a přidávají se: projekty v galerii
//       hera, nástroje a statistiky (modul Nabídka), služby, kroky procesu,
//       recenze. Čtečky jsou v src/lib/site/home.ts a site/projects.ts.
import { defineBlock, defineList, definePage, f } from '@c3studium/valecms/site'
import type { Reader } from '@c3studium/valecms/site'

// Klíče bloků téhle stránky. Tvar `<stránka>.<sekce>` = `page` v getSiteCopy.
// Komponenty i seed se odkazují jen na ně; keys.ts je pouze rozcestník.
export const HOME = {
    hero: 'index.hero',
    info: 'index.info',
    process: 'index.process',
    cta: 'index.cta',
} as const

// Deklarace balíčku (types/index.d.ts) popisují `f.label` a `f.plain`
// s parametrem `path`, který implementace (src/site/fields.js) nemá: čtou index
// položky. Než se deklarace srovnají, mluví se tu s implementací napřímo —
// pouhé přetypování, za běhu se nic nemění.
const { label, plain } = f as unknown as {
    label: (index: number) => Reader
    plain: () => Reader
}

// `siteCopy` má pole `gallery`, ale žádnou čtečku `f.gallery`. `f.text` je holé
// `block[path] || ''`, takže pole obrázků projde beze změny.
const gallery = () => f.text('gallery')

// Zdroje dokumentů. Jméno vlevo je klíč v `content`, typ vpravo říká, kterou
// čtečku `registerSources` zavolat.
const sources = {
    projects: { type: 'project' },
    heroWords: { type: 'heroWord' },
    stack: { type: 'stackItem' },
    stats: { type: 'statItem' },
    services: { type: 'service' },
    process: { type: 'processStep' },
    references: { type: 'reference' },
}

// Pořadí položek v blocích je smlouva mezi seedem (scripts/seed/home.mjs),
// tímhle souborem a komponentou — kdo přehazuje, přehazuje trojí.
export const homepage = definePage({
    route: '/',
    title: 'Domů',
    copy: 'index',
    sources,
    blocks: [
        defineBlock({
            at: 'hero',
            key: HOME.hero,
            title: 'Úvod',
            fields: {
                // 0–2 řádky nadpisu (anotace `lines` na <h1>), 3 nápověda posunu.
                labels: f.markedLabels(),
                labelMark: f.markName('items.*.label'),
                scrollHint: label(3),
                // Zelená slova (obě podoby) jsou dokumenty `heroWord` — položky
                // 4+ bloku se už nečtou.
                portrait: f.image(),
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
                // 0 popisek nad nástroji, 1 tlačítko pod nadpisem, 2 štítek
                // karet služeb, 3 odkaz „Zobrazit příklady".
                toolsLabel: label(0),
                cta: label(1),
                cardLabel: label(2),
                cardCta: label(3),
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
                // 0–1 řádky nadpisu, 2 nápověda posunu. Kroky jsou dokumenty.
                labels: f.markedLabels(),
                labelMark: f.markName('items.*.label'),
                lead: plain(),
                scrollHint: label(2),
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
                // 0 podtitul, 2 stav „odpovím do", 5–6 claim v patě.
                labels: f.markedLabels(),
                labelMark: f.markName('items.*.label'),
                action: label(1),
                // Čísla pod recenzí — ručně psaná, ne počítaná.
                stats: f.rows({ from: 3, count: 2, pick: ['value', 'label'] }),
                portrait: f.image({ alt: 'none' }),
                // Bannery vpravo, v pořadí zobrazení.
                gallery: gallery(),
                docId: f.docId(),
            },
        }),
        defineList({ at: 'projects', source: 'projects', title: 'Projekty' }),
        defineList({ at: 'heroWords', source: 'heroWords', title: 'Zelená slova' }),
        defineList({ at: 'stack', source: 'stack', title: 'Stack' }),
        defineList({ at: 'stats', source: 'stats', title: 'Stats' }),
        defineList({ at: 'services', source: 'services', title: 'Služby' }),
        // `steps`, ne `process`: `at` je klíč v `content` a `process` už je blok.
        defineList({ at: 'steps', source: 'process', title: 'Proces' }),
        defineList({ at: 'references', source: 'references', title: 'Recenze' }),
    ],
})
