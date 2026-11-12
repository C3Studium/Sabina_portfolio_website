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
    // Původní nadpis „Práce, která funguje" — stránka ho už nečte (nahradil
    // ho `intro`), klíč zůstává kvůli seedu a starému záznamu v databázi.
    list: 'projects.list',
    // Text pod scénou: 4 výzva, 5 nadpis sdílených detailů, 6 poznámka
    // o mlčenlivosti. Položky 0–3 (dřívější nadtitulek a kroky postupu)
    // v záznamu zůstaly, stránka je nečte.
    intro: 'projects.intro',
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

export const projectsPage = definePage({
    route: '/projects',
    title: 'Projekty',
    copy: 'projects',
    sources,
    blocks: [
        defineBlock({
            at: 'intro',
            key: PROJECTS.intro,
            title: 'Úvod — postup a sdílené detaily',
            fields: {
                // Položky 0–3 (nadtitulek a kroky postupu) se nečtou — smlouvy
                // s klienty nedovolí ukazovat postup; pořadí zbytku zůstává.
                cta: label(4),
                sharedTitle: label(5),
                note: label(6),
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
