// Projekty a case study.
//
// Projekt je DOKUMENT typu `project` (src/lib/valecms.types.ts), ne blok textu:
// jeden záznam je jedna karta na /projects a zároveň jedna stránka
// /projects/[slug]. Blok siteCopy tu drží jen to, co je hlasem stránky —
// nadpis a úvod nad řadou karet. Čtečku typu registruje src/lib/site/projects.ts.
import { defineBlock, defineList, definePage, f } from '@c3studium/valecms/site'

// Klíče bloků téhle stránky. Tvar `<stránka>.<sekce>` = `page` v getSiteCopy.
// Komponenty i seed se odkazují jen na ně; keys.ts je pouze rozcestník.
export const PROJECTS = {
    list: 'projects.list',
} as const

// Obě routy čtou tentýž zdroj. Jednou pojmenovaný, aby se `paths` níž nemohly
// rozejít s tím, co seznam vykresluje.
const sources = {
    projects: { type: 'project' },
}

// Deklarace `f.labels` v types/index.d.ts se rozchází s během (chce `path`,
// běh bere `{ from, count, pad }` a bez argumentu vrací všechny popisky).
// Klíč jako ne-literál sáhne na obecný podpis, ne na ten rozjetý.
const allLabels = f['labels' as string]

export const projectsPage = definePage({
    route: '/projects',
    title: 'Projekty',
    copy: 'projects',
    sources,
    blocks: [
        defineBlock({
            at: 'list',
            key: PROJECTS.list,
            title: 'Seznam — nadpis a úvod',
            fields: {
                title: f.text('title'),
                // Nadpis je dva řádky zalomené natvrdo („Práce," / „která") a
                // zvýrazněný konec („funguje") stojí zvlášť — accent je pole
                // proto, aby šel přepsat bez hledání hvězdiček uvnitř textu.
                headline: f.rawLines('headline'),
                accent: f.accent(),
                // Úvod je čtyři řádky pod sebou a počet řádků je obsah, ne
                // sazba — proto položky, ne odstavec.
                lead: allLabels(),
                docId: f.docId(),
            },
        }),
        defineList({ at: 'projects', source: 'projects', title: 'Projekty' }),
    ],
})

// Jedna stránka na projekt. `paths` je to, čím je routa dosažitelná: routa je
// šablona a publikace potřebuje vědět, že má přegenerovat `/projects/gummylife`.
// Stejný `copy` jako seznam — blok `projects.list` je tím dostupný i tady a
// publikace textů seznamu sáhne i na detaily.
export const projectPage = definePage({
    route: '/projects/[slug]',
    title: 'Projekt — detail',
    copy: 'projects',
    sources,
    paths: {
        // Slug přichází tolerantně — `{ current }` nebo holý řetězec (viz
        // fieldTypes.js) — a `slugValue` z knihovny je server-only, kdežto tenhle
        // soubor čte i prohlížeč. Proto se normalizuje tady znovu.
        projects: (body: { slug?: unknown } | null | undefined) => {
            const raw = body?.slug
            const slug = raw && typeof raw === 'object' ? (raw as { current?: unknown }).current : raw
            return typeof slug === 'string' && slug ? `/projects/${slug}` : null
        },
    },
    // Detail vykresluje jen pole dokumentu — název, podtitul, obrázek, text —
    // a kliknutí na kterékoli z nich otevře záznam celý (editableDoc). Žádný
    // blok siteCopy tu proto není: nemá co držet.
    blocks: [],
})

export const projectPages = [projectPage]
