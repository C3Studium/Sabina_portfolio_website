// Souhlas se soubory cookie — stav, ne lišta.
//
// Vykreslení si napiš sám: lišta je součást vzhledu webu a každý ji chce jinou.
// Tenhle poskytovatel drží jen to, co je pod ní — jestli člověk rozhodl, co
// povolil a kdy. Díky tomu se dá stejný stav přečíst z lišty, z nastavení
// v patičce i z komponenty, která se ptá "smím načíst mapu?".
//
// Kategorie jsou startovní sada, ne kánon. `necessary` je zamčená schválně:
// bez sezení a ochrany formulářů web nefunguje, takže volba, která by je
// vypnula, je volba předstíraná.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

const STORAGE_KEY = 'cookie-consent'
// Půl roku. Po něm se zeptáme znovu — souhlas nemá platit navždy.
const CONSENT_DAYS = 180

export type CookieCategory = {
    id: string
    name: string
    description: string
    /** Nezbytné se vypnout nedají — volba, která web rozbije, je volba předstíraná. */
    locked?: boolean
}

export const COOKIE_CATEGORIES: CookieCategory[] = [
    { id: 'necessary', name: 'Nezbytné', description: 'Nutné pro fungování webu', locked: true },
    { id: 'functional', name: 'Funkční', description: 'Zapamatují si tvoje volby' },
    { id: 'analytics', name: 'Analytické', description: 'Měření návštěvnosti' },
    { id: 'marketing', name: 'Marketingové', description: 'Cílení reklamy' },
]

const DEFAULTS = Object.fromEntries(COOKIE_CATEGORIES.map((c) => [c.id, Boolean(c.locked)]))
const ALL = Object.fromEntries(COOKIE_CATEGORIES.map((c) => [c.id, true]))

type Preferences = Record<string, boolean>

type CookiesValue = {
    preferences: Preferences
    decided: boolean
    decidedAt: Date | null
    ready: boolean
    showBanner: boolean
    acceptAll: () => void
    rejectAll: () => void
    savePreferences: (next: Preferences) => void
    reset: () => void
    allows: (category: string) => boolean
    categories: CookieCategory[]
}

const CookiesContext = createContext<CookiesValue | null>(null)

// localStorage a ne cookie: souhlas se ukládá jen u návštěvníka a nemá důvod
// cestovat na server v každém požadavku. A čte se v efektu, ne při prvním
// vykreslení — server ho nemá jak znát a rozdíl by React ohlásil jako
// neshodu po hydrataci.
const read = () => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) return null
        const saved = JSON.parse(raw)
        const age = Date.now() - new Date(saved.at).getTime()
        if (age > CONSENT_DAYS * 86400000) return null
        return saved
    } catch {
        // Soukromé okno, vypnuté úložiště, poškozený zápis. Ptát se znovu je
        // správná odpověď na všechny tři.
        return null
    }
}

export function CookiesProvider({ children }: { children: ReactNode }) {
    const [preferences, setPreferences] = useState<Preferences>(DEFAULTS)
    const [decided, setDecided] = useState(false)
    const [decidedAt, setDecidedAt] = useState<Date | null>(null)
    const [ready, setReady] = useState(false)

    useEffect(() => {
        const saved = read()
        if (saved) {
            setPreferences({ ...DEFAULTS, ...saved.preferences })
            setDecided(true)
            setDecidedAt(new Date(saved.at))
        }
        // `ready` odděluje "ještě nevíme" od "rozhodl a odmítl". Bez toho by
        // lišta blikla na každém načtení i tomu, kdo ji dávno odbyl.
        setReady(true)
    }, [])

    const save = useCallback((next: Preferences) => {
        const at = new Date()
        const merged = { ...DEFAULTS, ...next }
        setPreferences(merged)
        setDecided(true)
        setDecidedAt(at)
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ preferences: merged, at: at.toISOString() }))
        } catch {
            // Neuložilo se — zeptáme se příště znovu. Horší než to je jen
            // spadnout uprostřed kliknutí na "souhlasím".
        }
    }, [])

    const value = useMemo(() => ({
        preferences,
        decided,
        decidedAt,
        ready,
        /** Má se lišta ukázat? */
        showBanner: ready && !decided,
        acceptAll: () => save(ALL),
        rejectAll: () => save(DEFAULTS),
        savePreferences: save,
        reset: () => {
            try { localStorage.removeItem(STORAGE_KEY) } catch {}
            setPreferences(DEFAULTS)
            setDecided(false)
            setDecidedAt(null)
        },
        /** `allows('analytics')` — jediná otázka, kterou komponenty potřebují. */
        allows: (category: string) => Boolean(preferences[category]),
        categories: COOKIE_CATEGORIES,
    }), [preferences, decided, decidedAt, ready, save])

    return <CookiesContext.Provider value={value}>{children}</CookiesContext.Provider>
}

/**
 * Mimo poskytovatele vrací stav, ve kterém nic není povoleno a lišta se
 * neukazuje: komponenta použitá bez něj se má chovat opatrně, ne spadnout.
 */
export function useCookies(): CookiesValue {
    return useContext(CookiesContext) ?? {
        preferences: DEFAULTS,
        decided: false,
        decidedAt: null,
        ready: false,
        showBanner: false,
        acceptAll: () => {},
        rejectAll: () => {},
        savePreferences: () => {},
        reset: () => {},
        allows: () => false,
        categories: COOKIE_CATEGORIES,
    }
}
