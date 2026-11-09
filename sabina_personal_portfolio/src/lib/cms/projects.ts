// Projekty a case study.
//
// Projekt je DOKUMENT typu `project` (src/lib/valecms.types.ts), ne blok textu:
// jeden záznam je jedna karta na /projects a zároveň jedna stránka
// /projects/[slug]. Blok siteCopy tu drží jen to, co je hlasem stránky —
// nadpis a úvod nad řadou karet. Čtečku typu registruje src/lib/site/projects.ts.
import { defineBlock, defineList, definePage, f } from '@c3studium/valecms/site'

import { projectSlug } from './slug.ts'

// Klíče bloků téhle stránky. Tvar `<stránka>.<sekce>` = `page` v getSiteCopy.
// Komponenty i seed se odkazují jen na ně; keys.ts je pouze rozcestník.
export const PROJECTS = {
    list: 'projects.list',
    // Drobné popisky obou rout: 0 nápověda posunu, 1 odkaz karty, 2 štítek
    // nad názvem v detailu, 3 popisek odkazu na další projekt, 4 nadpis cílů.
    labels: 'projects.labels',
} as const

// Čtečka popisku podle indexu položky (viz poznámka u `f.label` v cms/home.ts).
const label = (f as unknown as { label: (index: number) => ReturnType<typeof f.text> }).label

// Jeden blok na obou routách — `copy: 'projects'` ho dává oběma a publikace
// přegeneruje seznam i detaily.
const labelsBlock = () =>
    defineBlock({
        at: 'labels',
        key: PROJECTS.labels,
        title: 'Projekty — popisky',
        fields: {
            scrollHint: label(0),
            cardLink: label(1),
            eyebrow: label(2),
            nextLabel: label(3),
            goalsTitle: label(4),
            docId: f.docId(),
        },
    })

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
        labelsBlock(),
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
        // Prázdný slug = adresa z názvu (viz cms/slug.ts). Tatáž funkce jako
        // ve čtečce, jinak by publikace přegenerovala jinou stránku, než na
        // kterou vede karta.
        projects: (body: { slug?: unknown; title?: unknown } | null | undefined) => {
            const slug = projectSlug(body)
            return slug ? `/projects/${slug}` : null
        },
    },
    // Detail vykresluje pole dokumentu — název, podtitul, obrázek, text —
    // a kliknutí na kterékoli z nich otevře záznam celý (editableDoc). Z bloků
    // jen popisky („Case study", „Další projekt").
    blocks: [labelsBlock()],
})

export const projectPages = [projectPage]
