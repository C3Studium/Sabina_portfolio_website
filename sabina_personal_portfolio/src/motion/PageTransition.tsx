// Přechod mezi stránkami — prosté prolnutí.
//
// `router.events` a ne stav odvozený z `asPath`: událost přijde dřív, než se
// stránka vymění, takže se překryv stihne objevit přes tu starou. Odvozený stav
// by ho ukázal až přes novou a bylo by vidět bliknutí.
//
// Je to schválně to nejjednodušší, co dává smysl. Přepiš si to.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'

import styles from './PageTransition.module.scss'

export default function PageTransition() {
    const router = useRouter()
    const reduced = useReducedMotion()
    const [covering, setCovering] = useState(false)

    useEffect(() => {
        if (reduced) return undefined
        const start = () => setCovering(true)
        const stop = () => setCovering(false)
        router.events.on('routeChangeStart', start)
        router.events.on('routeChangeComplete', stop)
        // Bez tohohle by zrušený přechod nechal překryv na obrazovce napořád.
        router.events.on('routeChangeError', stop)
        return () => {
            router.events.off('routeChangeStart', start)
            router.events.off('routeChangeComplete', stop)
            router.events.off('routeChangeError', stop)
        }
    }, [router.events, reduced])

    return (
        <AnimatePresence>
            {covering ? (
                <motion.div
                    className={styles.veil}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25, ease: 'easeInOut' }}
                    aria-hidden="true"
                />
            ) : null}
        </AnimatePresence>
    )
}
