// Dokumenty úvodní stránky — SERVER ONLY.
//
// Čtečky typů z src/lib/valecms.types.ts, které úvodní stránka drží jako
// `sources` (src/lib/cms/home.ts): nástroje, statistiky, služby, kroky procesu
// a recenze. Projekty čte src/lib/site/projects.ts, sociální sítě
// src/lib/site/globals.ts (patička je pod každou routou).
//
// Stejná pravidla jako u projektů: `read` se předává dovnitř (koncept / archiv
// přepíná Studio), `id` dokumentu jen při čtení konceptu, a nic nespadne —
// prázdná nebo nedostupná databáze dá prázdný seznam a komponenta ukáže zálohu.
//
// Komponenty si odsud smí vzít jedině `import type`.
import {
    documentId,
    imageValue,
    numberValue,
    readPublished,
    registerSources,
    stringValue,
} from '@c3studium/valecms/server/site'

import { decodeMarked, type MarkedLine } from './marks.ts'

export type { MarkedLine }

export type Reader = (args: Record<string, unknown>) => Promise<Record<string, unknown>[]>

/** Obrázek pro komponentu: tvar `CmsImage` z components/home/lines.tsx. */
export type DocImage = { src: string; alt: string; width?: number; height?: number }

type Doc = { id?: string }

export type StackItem = Doc & { title: string; icon: DocImage | null }
export type StatItem = Doc & { value: string; label: string; icon: DocImage | null }
/** Karta služby. Prázdné `number` / `label` / `cta` = záloha komponenty
 *  (pořadí, „Co nabízím", „Zobrazit příklady"). */
export type Service = Doc & {
    number: string
    label: string
    title: string
    icon: DocImage | null
    lead: string
    points: string[]
    cta: string
}
export type ProcessDetail = { label: string; value: string }
export type ProcessStep = Doc & {
    stage: string
    title: string
    /** Text kroku s tučnými frázemi (`*…*` v uloženém textu). */
    text: MarkedLine
    /** Ručně psaná poznámka po řádcích. */
    note: string[]
    images: DocImage[]
    details: ProcessDetail[]
}
export type Reference = Doc & {
    name: string
    role: string
    logo: DocImage | null
    text: MarkedLine
    stars: number
}

const provenance = (data: Record<string, unknown>): Doc => {
    const id = documentId(data)
    return id ? { id } : {}
}

const asImage = (value: unknown, fallbackAlt = ''): DocImage | null => {
    const picture = imageValue(value)
    if (!picture?.url) return null
    return {
        src: String(picture.src ?? picture.url),
        alt: stringValue(picture.alt) || fallbackAlt,
        ...(Number.isFinite(picture.width) && Number.isFinite(picture.height)
            ? { width: Number(picture.width), height: Number(picture.height) }
            : {}),
    }
}

const asImages = (value: unknown, fallbackAlt = ''): DocImage[] =>
    Array.isArray(value)
        ? value.map((entry) => asImage(entry, fallbackAlt)).filter((p): p is DocImage => p !== null)
        : []

const asStrings = (value: unknown): string[] =>
    Array.isArray(value) ? value.map((entry) => stringValue(entry)).filter(Boolean) : []

/** Publikované dokumenty typu, seřazené podle `order` (a pak podle `by`). */
const readSorted = async (type: string, read: Reader, by: (data: Record<string, unknown>) => string) => {
    const rows = await read({ type, sort: { field: 'data.order', direction: 'asc' }, perPage: 100 })
    // Dotaz řadí přes jsonb; seřadit ještě jednou je levné a výsledek nezávisí
    // na tom, jak databáze porovnává čísla v JSON.
    return [...rows].sort(
        (a, b) => (numberValue(a.order) ?? 100) - (numberValue(b.order) ?? 100) || by(a).localeCompare(by(b), 'cs'),
    )
}

type Options = { read?: Reader }

export type HeroWord = Doc & {
    /** Ve kterém nadpisu: 'hero' (úvod) nebo 'cta' (výzva). */
    place: string
    /** Druhá podoba (úvod: při načtení; výzva: ve smyčce); '' = záloha z kódu. */
    intro: string
    /** Podoba, která v nadpisu stojí. */
    final: string
}

/** Přelévaná slova v pořadí, v jakém stojí v nadpisu (obě místa). */
export const getHeroWords = async ({ read = readPublished as Reader }: Options = {}): Promise<HeroWord[]> =>
    (await readSorted('heroWord', read, (d) => stringValue(d.final)))
        .map((data) => ({
            ...provenance(data),
            place: stringValue(data.place) || 'hero',
            intro: stringValue(data.intro).trim(),
            final: stringValue(data.final).trim(),
        }))
        .filter((word) => word.final)

export const getStack = async ({ read = readPublished as Reader }: Options = {}): Promise<StackItem[]> =>
    (await readSorted('stackItem', read, (d) => stringValue(d.title)))
        .map((data) => {
            const title = stringValue(data.title)
            return { ...provenance(data), title, icon: asImage(data.icon, '') }
        })
        .filter((item) => item.title)

export const getStats = async ({ read = readPublished as Reader }: Options = {}): Promise<StatItem[]> =>
    (await readSorted('statItem', read, (d) => stringValue(d.value)))
        .map((data) => ({
            ...provenance(data),
            value: stringValue(data.value),
            label: stringValue(data.label),
            icon: asImage(data.icon, ''),
        }))
        .filter((item) => item.value)

export const getServices = async ({ read = readPublished as Reader }: Options = {}): Promise<Service[]> =>
    (await readSorted('service', read, (d) => stringValue(d.title)))
        .map((data) => {
            const title = stringValue(data.title)
            return {
                ...provenance(data),
                number: stringValue(data.number),
                label: stringValue(data.label),
                title,
                icon: asImage(data.icon, ''),
                lead: stringValue(data.lead),
                points: asStrings(data.points),
                cta: stringValue(data.cta),
            }
        })
        .filter((item) => item.title)

const STAGE_ORDER = ['start', '01', '02', '03', '04', '05', '06', 'callout']

export const getProcessSteps = async ({ read = readPublished as Reader }: Options = {}): Promise<ProcessStep[]> => {
    const rows = await read({ type: 'processStep', perPage: 50 })
    const steps = rows
        .map((data) => {
            const title = stringValue(data.title)
            return {
                ...provenance(data),
                stage: stringValue(data.stage),
                title,
                text: decodeMarked(stringValue(data.text)),
                note: stringValue(data.note)
                    .split('\n')
                    .map((line) => line.trim())
                    .filter(Boolean),
                images: asImages(data.images, title),
                details: Array.isArray(data.details)
                    ? data.details.map((entry) => ({
                          label: stringValue((entry as Record<string, unknown>)?.label),
                          value: stringValue((entry as Record<string, unknown>)?.value),
                      }))
                    : [],
            }
        })
        .filter((step) => STAGE_ORDER.includes(step.stage))
    // Jeden dokument na krok: kdyby jich editor založil víc, platí první.
    return STAGE_ORDER.map((stage) => steps.find((step) => step.stage === stage)).filter(
        (step): step is ProcessStep => Boolean(step),
    )
}

const clampStars = (value: unknown) => {
    const n = Math.round(numberValue(value) ?? 5)
    return Math.min(5, Math.max(1, n))
}

export const getReferences = async ({ read = readPublished as Reader }: Options = {}): Promise<Reference[]> =>
    (await readSorted('reference', read, (d) => stringValue(d.name)))
        .map((data) => {
            const name = stringValue(data.name)
            return {
                ...provenance(data),
                name,
                role: stringValue(data.role),
                logo: asImage(data.logo, ''),
                text: decodeMarked(stringValue(data.text)),
                stars: clampStars(data.stars),
            }
        })
        .filter((item) => item.name && item.text.length)

// Co znamenají typy ve `sources` v cms/home.ts.
//
// Funkce, ne volání při načtení modulu: stránka ji volá ve svém
// `getStaticProps`, a díky tomu Next celý tenhle modul ze stránky pro prohlížeč
// vyřízne (import použitý jen v getStaticProps se do klientského balíku
// nedostane; holý `import '…'` kvůli vedlejšímu efektu by se dostal i se
// serverovou knihovnou). Registrace je idempotentní — přepíše tytéž čtečky.
export const registerHomeSources = () =>
    registerSources({
        heroWord: (_options, read) => getHeroWords({ read: read as Reader }),
        stackItem: (_options, read) => getStack({ read: read as Reader }),
        statItem: (_options, read) => getStats({ read: read as Reader }),
        service: (_options, read) => getServices({ read: read as Reader }),
        processStep: (_options, read) => getProcessSteps({ read: read as Reader }),
        reference: (_options, read) => getReferences({ read: read as Reader }),
    })
