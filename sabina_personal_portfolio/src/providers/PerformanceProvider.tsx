// Co ten prohlížeč unese.
//
// Animace, shadery a velké obrázky mají smysl na stroji, který na ně má. Na
// pomalé lince nebo na telefonu se čtyřmi jádry stojí víc, než přinesou —
// a tenhle poskytovatel je to jediné místo, kde se to zjišťuje. Sekce se pak
// ptají jeho, ne každá zvlášť `navigator`, což by znamenalo pět různých
// prahů rozesetých po komponentách.
//
// Všechno se měří až na klientovi: server o síti ani o zařízení neví nic,
// a hádat to z hlavičky User-Agent je způsob, jak se splést u každého desátého.

import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import { readMotionLevel, subscribeMotion, type MotionChoice } from '@/lib/motion-preference'

type Perf = {
    slowNetwork: boolean
    lowPower: boolean
    mobile: boolean
    touch: boolean
    /** Klidnější verze (volba návštěvníka „Bez pohybu", lib/motion-preference). */
    reducedMotion: boolean
    /** Úroveň pohybu: "some" = bez samovolného pohybu (částice, střídání
     *  bannerů, jízda scény, autoplay stojí; odpověď na uživatele zůstává). */
    motion: MotionChoice
    heavy: boolean
}

const PerformanceContext = createContext<Perf | null>(null)

/** Network Information API (jen Chromium) — co se z něj čte. */
type NetworkInfo = {
    effectiveType?: string
    saveData?: boolean
    addEventListener?: (type: 'change', fn: () => void) => void
    removeEventListener?: (type: 'change', fn: () => void) => void
}

export function PerformanceProvider({ children }: { children: ReactNode }) {
    const [slowNetwork, setSlowNetwork] = useState(false)
    const [lowPower, setLowPower] = useState(false)
    const [mobile, setMobile] = useState(false)
    const [touch, setTouch] = useState(false)
    // Začíná na false a mění se až po mountu, stejně jako ostatní. Framer
    // Motion má useReducedMotion, ten ale na klientovi zná odpověď hned
    // při prvním renderu — server ji nezná, a to je hydratační chyba.
    const [reducedMotion, setReducedMotion] = useState(false)

    useEffect(() => {
        const connection = (navigator as Navigator & { connection?: NetworkInfo }).connection
        if (connection) {
            const check = () => setSlowNetwork(
                ['slow-2g', '2g', '3g'].includes(connection.effectiveType ?? '') || connection.saveData === true,
            )
            check()
            connection.addEventListener?.('change', check)
            return () => connection.removeEventListener?.('change', check)
        }
        return undefined
    }, [])

    useEffect(() => {
        // Jádra a paměť jsou hrubý odhad, ne měřítko. Stačí ale na rozhodnutí
        // "pustit tuhle animaci vůbec", což je jediné, k čemu to tu slouží.
        // Chybějící údaj NENÍ „4": Safari (Mac i iPad) a Firefox `deviceMemory`
        // vůbec nemají a starší Safari ani `hardwareConcurrency` — s náhradou 4
        // vycházel každý Mac jako slabý stroj a přišel o shader pozadí
        // i částice. Slabý je jen stroj, který nízké číslo doopravdy hlásí;
        // bez údajů se dotyk (telefon, tablet) bere jako slabý a počítač jako
        // schopný.
        const cores = navigator.hardwareConcurrency
        const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory
        const coarse = window.matchMedia?.('(pointer: coarse)').matches
        const reportedLow = (typeof cores === 'number' && cores <= 4) || (typeof memory === 'number' && memory <= 4)
        const unknown = typeof cores !== 'number' && typeof memory !== 'number'
        // Údaje zařízení zná jen prohlížeč — nastavují se po mountu (záměr,
        // server je nezná; viz komentář u reducedMotion).
        // eslint-disable-next-line react-hooks/set-state-in-effect -- údaje zařízení po mountu
        setLowPower(reportedLow || (unknown && Boolean(coarse)))

        setTouch(Boolean(coarse) || navigator.maxTouchPoints > 0)
        setMobile(window.matchMedia?.('(max-width: 900px)').matches ?? false)
    }, [])

    useEffect(() => {
        const media = window.matchMedia?.('(prefers-reduced-motion: reduce)')
        if (!media) return undefined
        const check = () => setReducedMotion(media.matches)
        check()
        media.addEventListener('change', check)
        return () => media.removeEventListener('change', check)
    }, [])

    // Atribut je v HTML dřív než hydratace (BOOT v <head>), server ho nezná —
    // na serveru „full", což je i výchozí hodnota, takže se nic nerozejde.
    const motion = useSyncExternalStore(subscribeMotion, readMotionLevel, () => 'full' as const)

    const value = useMemo(
        () => ({ slowNetwork, lowPower, mobile, touch, reducedMotion, motion, heavy: !slowNetwork && !lowPower }),
        [slowNetwork, lowPower, mobile, touch, reducedMotion, motion],
    )

    return <PerformanceContext.Provider value={value}>{children}</PerformanceContext.Provider>
}

/**
 * `const { heavy } = usePerformance()` a pak `{heavy ? <Shader /> : null}`.
 *
 * Mimo poskytovatele vrací hodnoty, které nic nevypínají: komponenta použitá
 * bez něj se má vykreslit celá, ne v úsporném režimu.
 */
export function usePerformance(): Perf {
    return useContext(PerformanceContext) ?? {
        slowNetwork: false, lowPower: false, mobile: false, touch: false, reducedMotion: false, motion: 'full', heavy: true,
    }
}
