// Brána — jediný stav, kterým se řídí, kdy smí stránka začít.
//
// `hold` znamená, že obrazovku drží preloader a nic pod ním se nemá rozjet.
// `go` je pokyn ke vstupu: sekce si ho přečtou a spustí své animace. Bez téhle
// jedné hodnoty by každá sekce hádala podle časovače a rozjely by se dřív, než
// se opona zvedne.
//
// Je to jednoduché schválně. Přepiš si to.

import { createContext, useContext, useMemo, useState } from 'react'
import type { Dispatch, ReactNode, SetStateAction } from 'react'

export type Gate = 'hold' | 'go'

type LoadValue = {
    gate: Gate
    setGate: Dispatch<SetStateAction<Gate>>
    /** Proběhl už preloader v tomhle sezení? */
    firstLoad: boolean
    setFirstLoad: Dispatch<SetStateAction<boolean>>
}

const LoadContext = createContext<LoadValue | null>(null)

export function LoadProvider({ children, gated = true }: { children: ReactNode; gated?: boolean }) {
    // Server i klient začínají na téže hodnotě, jinak by React hlásil rozdíl
    // po hydrataci. Preloader ji přepne na `go`, až domaluje.
    const [gate, setGate] = useState<Gate>(gated ? 'hold' : 'go')
    // Aby se opona neukazovala při každém přechodu, jen napoprvé.
    const [firstLoad, setFirstLoad] = useState(false)
    const value = useMemo(() => ({ gate, setGate, firstLoad, setFirstLoad }), [gate, firstLoad])
    return <LoadContext.Provider value={value}>{children}</LoadContext.Provider>
}

/**
 * `const { gate } = useGate()` a pak `animate={gate === 'go' ? …}`.
 *
 * Mimo LoadProvider vrací `go`, ne chybu: komponenta použitá na stránce bez
 * preloaderu se má vykreslit, ne spadnout.
 */
export function useGate(): LoadValue {
    return useContext(LoadContext) ?? { gate: 'go', setGate: () => {}, firstLoad: true, setFirstLoad: () => {} }
}
