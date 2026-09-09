// Překryv při prvním načtení: nápis a proužek, který doběhne.
//
// Když doběhne, otevře bránu — sekce pod ním si přes `useGate()` přečtou `go`
// a spustí své animace. Respektuje "omezit pohyb": komu to systém hlásí, tomu
// se překryv neukáže vůbec a brána se otevře hned.
//
// Je to schválně to nejjednodušší, co dává smysl. Přepiš si to.

import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'

import { useGate } from './LoadProvider'
import styles from './Preloader.module.scss'

const DURATION = 1.1

export default function Preloader() {
    const { setGate } = useGate()
    const reduced = useReducedMotion()
    const [showing, setShowing] = useState(!reduced)

    // Brána se otevírá, jakmile překryv ZAČNE odcházet, ne až zmizí: sekce mají
    // nastupovat, zatímco se prolíná pryč. Kdyby čekaly na konec, byla by mezi
    // nimi prodleva. `showing` se překlopí na začátku odchodu, takže stačí
    // sledovat ho — a při omezeném pohybu je od začátku false.
    useEffect(() => {
        if (!showing) setGate('go')
    }, [showing, setGate])

    return (
        <AnimatePresence>
            {showing ? (
                <motion.div
                    className={styles.overlay}
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.4, ease: 'easeOut' }}
                    aria-hidden="true"
                >
                    <span className={styles.label}>Načítání</span>
                    <span className={styles.track}>
                        <motion.span
                            className={styles.bar}
                            initial={{ scaleX: 0 }}
                            animate={{ scaleX: 1 }}
                            transition={{ duration: DURATION, ease: 'easeInOut' }}
                            onAnimationComplete={() => setShowing(false)}
                        />
                    </span>
                </motion.div>
            ) : null}
        </AnimatePresence>
    )
}
