// Případová studie z dokumentu projektu — SERVER ONLY.
//
// Pole záložky „Případová studie" (src/lib/valecms.types.ts, `study*`) →
// StudyContent, jak ho kreslí components/study. Bez díla na Titulní studie
// není (null) a stránka projektu ukáže dosavadní detail.
//
// Úmluva textu (stejná jako hvězdičky v blocích): odstavce odděluje prázdný
// řádek, **dvě hvězdičky** = tučně, *jedna* = zeleně.
//
// Plus 3D vizuály (typ `visual3d`): obrázek a volitelně jeho vrstvy. Detail
// díla si vizuál najde podle adresy obrázku.
import { imageValue, numberValue, stringValue } from '@c3studium/valecms/server/site'

import type { StudyChapter, StudyContent, StudyImage, StudyOutput, StudyPart, StudyWork } from '../../components/study/content'

type Data = Record<string, unknown>
type Reader = (args: Record<string, unknown>) => Promise<Record<string, unknown>[]>

const obj = (value: unknown): Data => (value && typeof value === 'object' && !Array.isArray(value) ? (value as Data) : {})
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : [])

/** „Text **tučně** a *zeleně*" → úseky StudyPart. */
export const parts = (text: string): StudyPart[] => {
    const out: StudyPart[] = []
    for (const piece of text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/)) {
        if (!piece) continue
        if (piece.startsWith('**') && piece.endsWith('**')) out.push([piece.slice(2, -2).trim(), 'bold'])
        else if (piece.startsWith('*') && piece.endsWith('*')) out.push([piece.slice(1, -1).trim(), true])
        else {
            const plain = piece.replace(/\s+/g, ' ').trim()
            if (plain) out.push([plain, false])
        }
    }
    return out
}

/** Odstavce (prázdný řádek mezi nimi) → úseky po odstavcích. */
export const paragraphs = (text: string): StudyPart[][] =>
    text
        .split(/\n\s*\n/)
        .map((p) => parts(p))
        .filter((p) => p.length)

// Rozměr chybí jen u starých záznamů médií — výchozí poměr banneru na výšku.
const FALLBACK_SIZE = { width: 1000, height: 1250 }

export const studyImage = (value: unknown, alt: string): StudyImage | null => {
    const picture = imageValue(value)
    if (!picture?.url) return null
    const width = Number(picture.width)
    const height = Number(picture.height)
    const sized = Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0
    return {
        src: String(picture.src ?? picture.url),
        alt: stringValue(picture.alt) || alt,
        width: sized ? width : FALLBACK_SIZE.width,
        height: sized ? height : FALLBACK_SIZE.height,
    }
}

const works = (value: unknown, brand: string): StudyWork[] =>
    list(value)
        .map((entry) => {
            const row = obj(entry)
            const name = stringValue(row.name)
            const image = studyImage(row.image, `${brand} — ${name}`)
            return image ? { image, name: name || brand, tag: stringValue(row.tag) } : null
        })
        .filter((w): w is StudyWork => w !== null)

const chapter = (value: unknown, brand: string, fallbackLabel: string): StudyChapter => {
    const row = obj(value)
    // Řádek = úsek nadpisu; celý v hvězdičkách = zeleně.
    const heading: StudyPart[] = stringValue(row.heading)
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line): StudyPart => (/^\*[^*].*\*$/.test(line) ? [line.slice(1, -1).trim(), true] : [line.replace(/\*/g, ''), false]))
    return {
        label: stringValue(row.label) || fallbackLabel,
        heading,
        text: paragraphs(stringValue(row.text)),
        asides: list(row.asides).map((a) => parts(stringValue(a))).filter((p) => p.length),
        works: works(row.works, brand),
    }
}

const formatOf = (image: StudyImage) =>
    `${image.width === image.height ? 'Post' : image.height / image.width > 1.6 ? 'Story' : 'Banner'} · ${image.width} × ${image.height}`

/** Studie z těla projektu, nebo null (bez díla na Titulní). */
export const studyFrom = (data: Data, title: string, order: number): StudyContent | null => {
    const cover = chapter(data.studyCover, title, 'Titulní')
    if (!cover.works.length) return null
    const stack = chapter(data.studyStack, title, 'Kapitola 2')
    const strip = chapter(data.studyStrip, title, 'Kapitola 3')
    const ring = chapter(data.studyRing, title, 'Kapitola 4')
    // Kapitola bez děl si je půjčí z Titulní, ať rozvržení nespadne.
    for (const ch of [stack, strip, ring]) if (!ch.works.length) ch.works = cover.works
    const outputs: StudyOutput[] = list(data.studyOutputs)
        .map((entry) => {
            const row = obj(entry)
            const caption = stringValue(row.caption)
            const image = studyImage(row.image, `${title} — ${caption}`)
            return image ? { image, caption: caption || title, format: formatOf(image) } : null
        })
        .filter((o): o is StudyOutput => o !== null)
    const cta = obj(data.studyCta)
    const lead = stringValue(cta.lead)
    const leadAccent = stringValue(cta.leadAccent)
    return {
        index: String(order).padStart(2, '0'),
        kind: stringValue(data.studyKind) || stringValue(data.tagline),
        title,
        meta: list(data.studyMeta)
            .map((entry) => {
                const row = obj(entry)
                return { label: stringValue(row.label), value: stringValue(row.value) }
            })
            .filter((m) => m.label && m.value),
        chapters: {
            cover: { ...cover, heading: [[title, true]] },
            play: stack,
            campaigns: strip,
            trust: ring,
        },
        // Bez výstupů editor ukáže všechna díla kapitol.
        outputs: outputs.length
            ? outputs
            : [...cover.works, ...stack.works, ...strip.works, ...ring.works]
                  .filter((w, i, all) => all.findIndex((x) => x.image.src === w.image.src) === i)
                  .map((w) => ({ image: w.image, caption: w.name, format: formatOf(w.image) })),
        cta: {
            lead: [
                ...(lead ? ([[lead, false]] as StudyPart[]) : []),
                ...(leadAccent ? ([[leadAccent, true]] as StudyPart[]) : []),
            ],
            button: stringValue(cta.button) || 'Začněme spolu',
            status: parts(stringValue(cta.status) || 'Odpovím do *24 hodin*'),
        },
    }
}

/* ------------------------------------------------------------ 3D vizuály -- */

export type Visual3dLayer = { url: string; name: string; kind: 'background' | 'shape' | 'object' | 'text' | 'button' }
/** Vizuál z typu `visual3d`: adresa celého obrázku a jeho vrstvy (prázdné = rozklad automaticky). */
export type Visual3d = { src: string; width: number; height: number; layers: Visual3dLayer[] }

const KINDS = new Set(['background', 'shape', 'object', 'text', 'button'])

/** Publikované 3D vizuály (nebo koncepty přes `read` náhledu Studia). */
export const getVisuals = async ({ read }: { read: Reader }): Promise<Visual3d[]> => {
    let rows: Record<string, unknown>[] = []
    try {
        rows = await read({ type: 'visual3d', sort: { field: 'data.order', direction: 'asc' }, perPage: 200 })
    } catch {
        return []
    }
    return rows
        .map((data) => {
            const image = studyImage(data.image, stringValue(data.title))
            if (!image) return null
            const layers = list(data.layers)
                .map((entry, i) => {
                    const row = obj(entry)
                    const picture = imageValue(row.image)
                    if (!picture?.url) return null
                    const kind = stringValue(row.kind)
                    return {
                        url: String(picture.src ?? picture.url),
                        name: stringValue(row.name) || `Vrstva ${i + 1}`,
                        kind: (KINDS.has(kind) ? kind : 'shape') as Visual3dLayer['kind'],
                    }
                })
                .filter((l): l is Visual3dLayer => l !== null)
            return { src: image.src, width: image.width, height: image.height, layers, order: numberValue(data.order) ?? 100 }
        })
        .filter((v): v is Visual3d & { order: number } => v !== null)
        .map(({ src, width, height, layers }) => ({ src, width, height, layers }))
}
