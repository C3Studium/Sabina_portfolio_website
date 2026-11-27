// Rozepsaný blok textů ze Studia → tvar GlobalBlock, jaký dává getGlobalCopy.
//
// Pro živý náhled povrchu (Kontakt — defineSurface editor: 'split',
// src/lib/cms/layout.ts): editor posílá do rámu surové tělo dokumentu
// (useLiveBody) a komponenta se z něj překreslí při každém úhozu. Převod musí
// být stejný jako na serveru (valecms getSiteCopy + shapeBlock v globals.ts),
// jinak by náhled ukazoval něco jiného než web. Čisté — i pro prohlížeč.
import { imageValue, plainText, stringValue } from '@c3studium/valecms/site/values.js'

import type { CopyImage, CopyItem, GlobalBlock } from './globals'

const itemOf = (item: unknown): CopyItem => {
    const row = item && typeof item === 'object' ? (item as Record<string, unknown>) : {}
    return {
        lead: stringValue(row.lead),
        label: stringValue(row.label),
        value: stringValue(row.value),
        note: stringValue(row.note),
    }
}

export const liveGlobalBlock = (live: Record<string, unknown>, docId?: string | null): GlobalBlock => ({
    ...(docId ? { docId } : {}),
    title: stringValue(live.title),
    headline: stringValue(live.headline),
    body: plainText(live.body),
    image: (imageValue(live.image, stringValue(live.title)) as CopyImage | null) ?? null,
    items: Array.isArray(live.items) ? live.items.map(itemOf) : [],
})
