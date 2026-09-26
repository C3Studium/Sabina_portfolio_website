// Projekty portfolia — SERVER ONLY.
//
// Čtečka dokumentů typu `project` a její registrace pro `sources` v konfiguraci.
// Bydlí tady a ne v knihovně, protože „projekt" je slovník tohohle webu: knihovna
// zná jen `siteCopy` a `review`, cokoli dalšího si pojmenuje a přečte projekt sám
// (příručka 4.6).
//
// Import jen z `getStaticProps` / `getStaticPaths`. Komponenty si odsud smí vzít
// jedině `import type`.
import {
    documentId,
    imageValue,
    numberValue,
    readPublished,
    registerSources,
    slugValue,
    stringValue,
    plainText,
    viewOf,
} from '@c3studium/valecms/server/site'

/** Co si stránka přečetla z preview cookie: publikovaný web, koncept, nebo okamžik. */
export type View = { draft: boolean; at: string | null }

/**
 * `viewOf(context)` pro TypeScript.
 *
 * Běh bere celý kontext `getStaticProps` a čte z něj `draftMode` a
 * `previewData`; deklarace v types/index.d.ts ale slibuje jen `{ draft, at }`,
 * takže přímé volání s kontextem neprojde. Jedno přetypování tady místo dvou
 * v každé stránce.
 */
export const viewFrom = (context: unknown): View => viewOf(context as { draft?: boolean }) as View

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
    /** richText jako HTML; `bodyText` je totéž bez značek. */
    body: string
    bodyText: string
    cover: ProjectImage | null
    gallery: ProjectImage[]
    tone: ProjectTone
    order: number
}

/**
 * Čtečka, kterou stránka dostane od `readerFor(view)`. V deklaracích knihovny
 * je `unknown`, protože knihovna nechce slibovat tvar; tady se říká to málo,
 * co se z ní opravdu volá.
 */
export type Reader = (args: Record<string, unknown>) => Promise<Record<string, unknown>[]>

/** Řádek, ze kterého tělo pochází — jako spread, nikdy jako klíč s undefined. */
const provenance = (data: Record<string, unknown>): { id?: string } => {
    const id = documentId(data)
    return id ? { id } : {}
}

const asImage = (value: unknown, fallbackAlt: string): ProjectImage | null => {
    const picture = imageValue(value)
    if (!picture?.url) return null
    return {
        src: String(picture.src ?? picture.url),
        url: String(picture.url),
        // Alt, který editor napsal k assetu; bez něj název projektu — lepší
        // než prázdno u obrázku, který je hlavním obsahem karty.
        alt: stringValue(picture.alt) || fallbackAlt,
        ...(Number.isFinite(picture.width) && Number.isFinite(picture.height)
            ? { width: Number(picture.width), height: Number(picture.height) }
            : {}),
    }
}

const asTone = (value: unknown): ProjectTone => (value === 'light' ? 'light' : 'dark')

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

    return rows
        .map((data) => {
            const title = stringValue(data.title)
            return {
                ...provenance(data),
                slug: slugValue(data.slug),
                title,
                tagline: stringValue(data.tagline),
                perex: stringValue(data.perex),
                body: stringValue(data.body),
                bodyText: plainText(data.body),
                cover: asImage(data.cover, title),
                gallery: Array.isArray(data.gallery)
                    ? data.gallery.map((entry) => asImage(entry, title)).filter((p): p is ProjectImage => p !== null)
                    : [],
                tone: asTone(data.tone),
                order: numberValue(data.order) ?? 100,
            }
        })
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
