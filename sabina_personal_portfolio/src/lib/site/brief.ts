// Poptávka (kontaktní formulář) z dokumentů Studia — modul „Poptávka":
// kroky `briefStep` a poslední krok `briefContact`. Čte se spolu s globálními
// bloky (globals.ts), protože modál je na každé stránce.
//
// Nikdy nespadne: chyba čtení dá prázdno a formulář jede na otázkách z kódu.

import { documentId, numberValue, readPublished, stringValue } from '@c3studium/valecms/server/site'

type Reader = (args: Record<string, unknown>) => Promise<Record<string, unknown>[]>

export type BriefOption = { label: string; icon: string }

export type BriefStep = {
    /** Id dokumentu — jen v konceptu (anotace Studia). */
    id?: string
    key: string
    label: string
    title: string
    hint: string
    multi: boolean
    options: BriefOption[]
}

export type BriefChannel = { label: string; kind: 'call' | 'email' | 'whatsapp' }

export type BriefContact = {
    id?: string
    title: string
    channels: BriefChannel[]
    doneTitle: string
    doneText: string
}

export type BriefCopy = {
    /** Prázdné = otázky z kódu. */
    steps: BriefStep[]
    contact: BriefContact | null
}

const KINDS = new Set(['call', 'email', 'whatsapp'])

const withId = (data: Record<string, unknown>, draft: boolean) => {
    const id = documentId(data)
    return draft && id ? { id } : {}
}

export const getBrief = async (read: Reader = readPublished as Reader, draft = false): Promise<BriefCopy> => {
    try {
        const [stepRows, contactRows] = await Promise.all([
            read({ type: 'briefStep', sort: { field: 'data.order', direction: 'asc' }, perPage: 20 }),
            read({ type: 'briefContact', perPage: 5 }),
        ])
        const steps = [...stepRows]
            .sort((a, b) => (numberValue(a.order) ?? 100) - (numberValue(b.order) ?? 100))
            .map((data, index) => {
                const label = stringValue(data.label).trim()
                return {
                    ...withId(data, draft),
                    // Klíč odpovědi: id dokumentu, jinak pořadí — jen pro
                    // párování odpovědí v jednom běhu formuláře.
                    key: documentId(data) || `step-${index}`,
                    label,
                    title: stringValue(data.title).trim(),
                    hint: stringValue(data.hint).trim(),
                    multi: data.multi === true,
                    options: (Array.isArray(data.options) ? data.options : [])
                        .map((entry) => {
                            const o = (entry ?? {}) as Record<string, unknown>
                            return { label: stringValue(o.label).trim(), icon: stringValue(o.icon).trim() || 'auto' }
                        })
                        .filter((o) => o.label),
                }
            })
            .filter((step) => step.label && step.title && step.options.length >= 2)

        const raw = contactRows[0]
        const contact = raw
            ? {
                  ...withId(raw, draft),
                  title: stringValue(raw.title).trim(),
                  channels: (Array.isArray(raw.channels) ? raw.channels : [])
                      .map((entry) => {
                          const c = (entry ?? {}) as Record<string, unknown>
                          const kind = stringValue(c.kind)
                          return { label: stringValue(c.label).trim(), kind: (KINDS.has(kind) ? kind : 'call') as BriefChannel['kind'] }
                      })
                      .filter((c) => c.label),
                  doneTitle: stringValue(raw.doneTitle).trim(),
                  doneText: stringValue(raw.doneText).trim(),
              }
            : null

        return { steps, contact }
    } catch {
        return { steps: [], contact: null }
    }
}
