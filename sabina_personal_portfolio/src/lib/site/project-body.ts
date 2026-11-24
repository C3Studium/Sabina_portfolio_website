// Tělo dokumentu `project` → Project — ČISTÉ, i pro prohlížeč.
//
// Server (site/projects.ts, getStaticProps) i živý náhled ve Studiu
// ([slug].tsx přes useLiveBody) převádějí tělo touhle jednou funkcí. Živý
// náhled dostává rozepsaný formulář editoru dokumentu a překresluje se z něj
// při psaní — kdyby měl vlastní převod, náhled by jednou ukazoval něco jiného
// než web.
//
// Proto tu nesmí být nic serverového: hodnoty polí z `@c3studium/valecms/
// site/values.js` (čisté), ne z `server/site`.
import { documentId, imageValue, numberValue, plainText, slugValue, stringValue } from '@c3studium/valecms/site/values.js'
import type { PageSeo } from '@c3studium/valecms/server/site'

import { projectSlug } from '../cms/slug.ts'
import { studyFrom } from './study.ts'
import type { Project, ProjectImage, ProjectTone } from './projects'

type Data = Record<string, unknown>

/** Řádek, ze kterého tělo pochází — jako spread, nikdy jako klíč s undefined. */
const provenance = (data: Data): { id?: string } => {
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
 * Projekt z těla dokumentu. `seo` dodá volající: na serveru `seoOf(data)`
 * (čte serverové výchozí hodnoty), v živém náhledu to, co stránka už má —
 * SEO se v rámu nezobrazuje.
 */
export const projectFrom = (data: Data, seo: PageSeo): Project => {
    const title = stringValue(data.title)
    return {
        ...provenance(data),
        // Prázdný slug = adresa z názvu, stejně jako `paths` v konfiguraci.
        slug: slugValue(data.slug) || projectSlug({ title }),
        title,
        tagline: stringValue(data.tagline),
        perex: stringValue(data.perex),
        goals: Array.isArray(data.goals) ? data.goals.map((goal) => stringValue(goal)).filter(Boolean) : [],
        shared: Array.isArray(data.shared) ? data.shared.map((item) => stringValue(item)).filter(Boolean) : [],
        body: stringValue(data.body),
        bodyText: plainText(data.body),
        cover: asImage(data.cover, title),
        gallery: Array.isArray(data.gallery)
            ? data.gallery.map((entry) => asImage(entry, title)).filter((p): p is ProjectImage => p !== null)
            : [],
        tone: asTone(data.tone),
        order: numberValue(data.order) ?? 100,
        featured: data.featured === true,
        cardCta: stringValue(data.cardCta),
        study: studyFrom(data, title, numberValue(data.order) ?? 100),
        seo,
    }
}
