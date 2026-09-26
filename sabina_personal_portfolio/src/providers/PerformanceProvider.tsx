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

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

type Perf = {
    slowNetwork: boolean
    lowPower: boolean
    mobile: boolean
    touch: boolean
    heavy: boolean
}

const PerformanceContext = createContext<Perf | null>(null)

export function PerformanceProvider({ children }: { children: ReactNode }) {
    const [slowNetwork, setSlowNetwork] = useState(false)
    const [lowPower, setLowPower] = useState(false)
    const [mobile, setMobile] = useState(false)
    const [touch, setTouch] = useState(false)

    useEffect(() => {
        const connection = (navigator as any)?.connection
        if (connection) {
            const check = () => setSlowNetwork(
                ['slow-2g', '2g', '3g'].includes(connection.effectiveType) || connection.saveData === true,
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
        const cores = navigator.hardwareConcurrency || 4
        const memory = (navigator as any)?.deviceMemory || 4
        setLowPower(cores <= 4 || memory <= 4)

        const coarse = window.matchMedia?.('(pointer: coarse)').matches
        setTouch(Boolean(coarse) || navigator.maxTouchPoints > 0)
        setMobile(window.matchMedia?.('(max-width: 900px)').matches ?? false)
    }, [])

    const value = useMemo(
        () => ({ slowNetwork, lowPower, mobile, touch, heavy: !slowNetwork && !lowPower }),
        [slowNetwork, lowPower, mobile, touch],
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
        slowNetwork: false, lowPower: false, mobile: false, touch: false, heavy: true,
    }
}
