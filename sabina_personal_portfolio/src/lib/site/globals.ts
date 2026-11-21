// Texty pod každou routou — hlavička, patička, kontaktní modál. SERVER ONLY.
//
// Globální bloky NEJSOU součástí obsahu stránky: `getPageContent` prochází jen
// bloky své routy a `defineGlobals` žádné `blocks` nebere. Každá stránka si je
// proto přečte tímhle ve svém `getStaticProps` a vrátí jako `props.globals`;
// `_app` je z pageProps předá hlavičce, patičce a modálu. Stránka bez
// `getStaticProps` (třeba 404) nepředá nic a komponenty sáhnou po záloze z kódu.
//
// Vrací se SUROVÝ tvar bloku, ne pojmenované props. Popisky jsou v `items`
// vázané pořadím a to pořadí musí znát ten, kdo píše anotaci `items.N.label`
// — tedy komponenta. Kdyby pozice překládala už čtečka, byla by dvě místa, kde
// se číslo opisuje (tady a v anotaci), a shodnout se musí ručně. Takhle je
// číslo jen v komponentě, hned vedle prvku, který ho čte.
import {
    documentId,
    getSiteCopy,
    getSiteSeo,
    imageValue,
    numberValue,
    readerFor,
    stringValue,
} from '@c3studium/valecms/server/site'

import { GLOBAL } from '../cms/layout.ts'
import type { SiteSeo } from '@c3studium/valecms/server/site'
import { SEO_FALLBACK, SHARE_IMAGE_PATH } from '../seo.ts'
import { getBrief, type BriefCopy } from './brief.ts'

/** Obrázek tak, jak ho tvaruje `imageValue` v knihovně — `src` i `url` je totéž. */
export type CopyImage = {
    src: string
    url: string
    alt: string
    width?: number
    height?: number
}

/** Jedna položka `items` bloku siteCopy. Vždy všechny čtyři klíče, i prázdné. */
export type CopyItem = {
    lead: string
    label: string
    value: string
    note: string
}

/**
 * Jeden globální blok, jak ho dostane komponenta.
 *
 * `docId` je jen v konceptu (`view.draft`): anotace se z něj skládá a bez něj
 * `editableIn(null)` vrací prázdno. Na veřejném webu se nevrací vůbec — props
 * statické stránky končí v HTML a identifikátor dokumentu tam nemá co dělat.
 */
export type GlobalBlock = {
    docId?: string
    title: string
    headline: string
    /** `bodyText`, ne `body`: sází se do odstavce bez značek. */
    body: string
    image: CopyImage | null
    items: CopyItem[]
}

/** Odkaz na sociální síť v patičce — dokument typu `socialLink`. */
export type SocialLink = {
    /** Id dokumentu — jen v konceptu, kvůli anotaci. */
    id?: string
    platform: string
    label: string
    url: string
    icon: CopyImage | null
}

/** Přepínače webu — dokument „Nastavení webu" (typ `siteSettings`). */
export type SiteSettings = {
    /** Sekce s recenzemi a odkaz Reference v navigaci. Bez dokumentu true. */
    showReviews: boolean
}

export const SETTINGS_DEFAULT: SiteSettings = { showReviews: true }

export type GlobalCopy = {
    header: GlobalBlock | null
    footer: GlobalBlock | null
    contact: GlobalBlock | null
    /** Kroky poptávky a poslední krok z modulu „Poptávka" (prázdné = z kódu). */
    brief: BriefCopy
    /** Prázdné = patička ukáže sítě z kódu. */
    socials: SocialLink[]
    /** SEO a ikony webu (Studio „SEO a ikony", jinak SEO_FALLBACK). */
    seo: SiteSeo
    /** Přepínače ze Studia („Nastavení webu"); bez dokumentu výchozí. */
    settings: SiteSettings
}

/** Co stránka předává dál z `viewOf(context)`. */
export type GlobalsView = { draft?: boolean; at?: string | null }

// Tvar, který vrací `getSiteCopy` — knihovna ho typuje jako `any`, tady se
// zúží na to, co se doopravdy čte.
type RawBlock = {
    id?: string | null
    title?: string
    headline?: string
    bodyText?: string
    image?: CopyImage | null
    items?: CopyItem[]
}

const shapeBlock = (raw: RawBlock | undefined, draft: boolean): GlobalBlock | null => {
    if (!raw) return null
    return {
        // Spread, ne `docId: undefined`: getStaticProps `undefined` odmítá
        // a klíč s `null` by cestoval v HTML každé stránky pro nic.
        ...(draft && raw.id ? { docId: raw.id } : {}),
        title: raw.title || '',
        headline: raw.headline || '',
        body: raw.bodyText || '',
        image: raw.image ?? null,
        items: Array.isArray(raw.items) ? raw.items : [],
    }
}

/**
 * Tři bloky jedním dotazem — všechny bydlí pod `page: 'global'`, takže druhý
 * a třetí `select` by vracel tytéž řádky.
 *
 * Nikdy nespadne: čtečky knihovny odpovídají prázdnem místo výjimky, takže
 * nedostupná databáze dá `{ header: null, footer: null, contact: null }`
 * a web pojede na textech z kódu.
 */
export const getGlobalCopy = async (view: GlobalsView = {}): Promise<GlobalCopy> => {
    const { draft = false, at = null } = view
    const read = readerFor({ draft, at })
    const [copy, socials, seo, brief, settings] = await Promise.all([
        getSiteCopy({ page: 'global', read }),
        getSocialLinks(read),
        // Náhled pro sdílení z vlastní domény (pages/share-image.jpg.tsx):
        // obrázek v úložišti má hlavičky, které WhatsApp a Messenger odmítají.
        getSiteSeo({ read, fallback: SEO_FALLBACK, shareImagePath: SHARE_IMAGE_PATH }),
        getBrief(read as Reader, draft),
        getSiteSettings(read),
    ])

    return {
        header: shapeBlock(copy[GLOBAL.header], draft),
        footer: shapeBlock(copy[GLOBAL.footer], draft),
        contact: shapeBlock(copy[GLOBAL.contact], draft),
        brief,
        socials,
        seo,
        settings,
    }
}

type Reader = (args: Record<string, unknown>) => Promise<Record<string, unknown>[]>

/**
 * „Nastavení webu": první dokument typu `siteSettings`. Nikdy nespadne —
 * bez dokumentu i při chybě čtení platí výchozí hodnoty (reference vidět).
 */
const getSiteSettings = async (read: unknown): Promise<SiteSettings> => {
    let rows: Record<string, unknown>[] = []
    try {
        rows = await (read as Reader)({ type: 'siteSettings', perPage: 1 })
    } catch {
        return SETTINGS_DEFAULT
    }
    const data = rows[0]
    if (!data) return SETTINGS_DEFAULT
    return { showReviews: data.showReviews !== false }
}

/**
 * Sociální sítě v pořadí `order`. Nikdy nespadne — chyba čtení dá prázdný
 * seznam a patička ukáže sítě z kódu.
 */
const getSocialLinks = async (read: unknown): Promise<SocialLink[]> => {
    let rows: Record<string, unknown>[] = []
    try {
        rows = await (read as Reader)({ type: 'socialLink', sort: { field: 'data.order', direction: 'asc' }, perPage: 20 })
    } catch {
        return []
    }
    return [...rows]
        .sort((a, b) => (numberValue(a.order) ?? 100) - (numberValue(b.order) ?? 100))
        .map((data) => {
            const id = documentId(data)
            const picture = imageValue(data.icon)
            return {
                // Spread, ne `id: undefined` — getStaticProps undefined odmítá.
                ...(id ? { id } : {}),
                platform: stringValue(data.platform) || 'other',
                label: stringValue(data.label),
                url: stringValue(data.url),
                icon: picture?.url
                    ? { src: String(picture.src ?? picture.url), url: String(picture.url), alt: '' }
                    : null,
            }
        })
        .filter((link) => link.url)
}
