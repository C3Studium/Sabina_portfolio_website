// Projekty portfolia — SERVER ONLY.
//
// Čtečka dokumentů typu `project` a její registrace pro `sources` v konfiguraci.
// Bydlí tady a ne v knihovně, protože „projekt" je slovník tohohle webu: knihovna
// zná jen `siteCopy` a `review`, cokoli dalšího si pojmenuje a přečte projekt sám
// (příručka 4.6).
//
// Import jen z `getStaticProps` / `getStaticPaths`. Komponenty si odsud smí vzít
// jedině `import type`.
import { readPublished, registerSources, seoOf, viewOf } from '@c3studium/valecms/server/site'

import { projectFrom } from './project-body.ts'
import type { StudyContent } from '../../components/study/content'
import type { PageSeo } from '@c3studium/valecms/server/site'

/** Co si stránka přečetla z preview cookie: publikovaný web, koncept, nebo okamžik. */
export type View = { draft: boolean; at: string | null }

/**
 * `viewOf` z kontextu `getStaticProps`. Do 0.1.50 deklarovala knihovna
 * `viewOf` obráceně (brala `{ draft, at }`, vracela `unknown`) a každé volání
 * chtělo přetypování; od 0.1.51 sedí typ s během a tohle je jen pojmenování
 * na jednom místě, aby obě stránky projektů četly pohled stejně.
 */
export const viewFrom = (context: { draftMode?: boolean; previewData?: unknown } | null | undefined): View => viewOf(context)

/** Obrázek, jak ho vrací `imageValue`: `src` i `url` je tatáž adresa. */
export type ProjectImage = {
    src: string
    url: string
    alt: string
    width?: number
    height?: number
}

export type ProjectTone = 'dark' | 'light'

export type Project = {
    /** Id dokumentu — jen při čtení pro Studio (koncept). Veřejná stránka ho nenese. */
    id?: string
    slug: string
    title: string
    tagline: string
    perex: string
    /** Cíle projektu, jeden na položku. */
    goals: string[]
    /** Co klient dovolil zveřejnit, jeden detail na položku. */
    shared: string[]
    /** richText jako HTML; `bodyText` je totéž bez značek. */
    body: string
    bodyText: string
    cover: ProjectImage | null
    gallery: ProjectImage[]
    tone: ProjectTone
    order: number
    /** Karta v galerii úvodní stránky. */
    featured: boolean
    /** Text tlačítka na kartě úvodní stránky; '' = výchozí z komponenty. */
    cardCta: string
    /** Případová studie (záložka „Případová studie"), nebo null = dosavadní detail. */
    study: StudyContent | null
    /** Přepis SEO stránky (záložka „SEO"); prázdné hodnoty = výchozí. */
    seo: PageSeo
}

/**
 * Čtečka, kterou stránka dostane od `readerFor(view)`. V deklaracích knihovny
 * je `unknown`, protože knihovna nechce slibovat tvar; tady se říká to málo,
 * co se z ní opravdu volá.
 */
export type Reader = (args: Record<string, unknown>) => Promise<Record<string, unknown>[]>

/**
 * Publikované projekty v pořadí `order`, pak podle názvu.
 *
 * `read` se předává dovnitř a nevybírá tady — je to jediný přepínač, kterým
 * náhled Studia přepíná na koncepty a Archiv na daný okamžik. Bez něj se čte
 * publikovaný stav, tedy to, co vidí návštěvník.
 *
 * Projekt bez `slug` se vynechává: nemá adresu, takže by karta vedla na 404.
 */
export const getProjects = async ({
    limit = 50,
    read = readPublished as Reader,
}: { limit?: number; read?: Reader } = {}): Promise<Project[]> => {
    const rows = await read({
        type: 'project',
        sort: { field: 'data.order', direction: 'asc' },
        perPage: limit,
    })

    // Převod těla je v project-body.ts — čistý, aby ho stejně použil i živý
    // náhled Studia v prohlížeči ([slug].tsx).
    return rows
        .map((data) => projectFrom(data, seoOf(data)))
        .filter((project) => project.title && project.slug)
        // Dotaz řadí přes jsonb; seřadit stránku ještě jednou je levné a
        // výsledek pak nezávisí na tom, jak databáze porovnává čísla v JSON.
        .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title, 'cs'))
}

/** Jeden projekt podle adresy, nebo `null`. */
export const getProject = async ({ slug, read }: { slug: string; read?: Reader }): Promise<Project | null> => {
    const projects = await getProjects({ read })
    return projects.find((project) => project.slug === slug) ?? null
}

// Co znamená `type: 'project'` ve `sources` v cms/projects.ts.
//
// Zapisuje se při načtení tohohle modulu, tedy dřív, než stránka zavolá
// `getPageContent`: obě routy pod /projects importují čtečku odsud a volají ji
// vedle něj. Neregistrovaný typ by neshodil build, jen by seznam zůstal prázdný
// a web by ukázal FALLBACK z komponent — přesně to, co se má stát bez databáze,
// a ne to, co se má stát s ní.
registerSources({
    project: (options, read) => getProjects({ ...options, read: read as Reader }),
})
