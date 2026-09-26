// Přechod mezi stránkami — prosté prolnutí.
//
// `router.events` a ne stav odvozený z `asPath`: událost přijde dřív, než se
// stránka vymění, takže se překryv stihne objevit přes tu starou. Odvozený stav
// by ho ukázal až přes novou a bylo by vidět bliknutí.
//
// Při zapnutém "omezit pohyb" se přechod nevypíná, jen se zjednoduší: závoj
// naskočí a zmizí rovnou, bez prolnutí. Rozdíl je celý v těch dvou objektech
// níž, jinde se na preferenci nesahá.
//
// Je to schválně to nejjednodušší, co dává smysl. Přepiš si to.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { motion, useReducedMotion } from 'framer-motion'

import styles from './PageTransition.module.scss'

// Přepínač pro místní zkoušení. `NEXT_PUBLIC_REDUCE_MOTION_MODE=true` vynutí
// tlumenou variantu, `false` plnou, prázdno nechá rozhodnout systém.
//
// `NODE_ENV` je při překladu konstanta, takže se z produkčního buildu celá tahle
// větev vyhodí i s tou proměnnou. Nastavit ji na hostingu proto nezmůže nic —
// a je to tak správně: o tlumeném pohybu rozhoduje nastavení návštěvníka, ne
// naše env. Kdyby to šlo přepnout z produkce, přebíjeli bychom mu přístupnost.
const FORCED_MOTION =
    process.env.NODE_ENV === 'production' ? '' : process.env.NEXT_PUBLIC_REDUCE_MOTION_MODE

function useMotionPreference() {
    const system = useReducedMotion()
    if (FORCED_MOTION === 'true') return true
    if (FORCED_MOTION === 'false') return false
    return system
}

// Všechny časy v sekundách.
//
// `fade`    — náběh i odchod závoje; 0 znamená naskočit a zmizet rovnou
// `minHold` — nejkratší doba, po kterou závoj zůstane, i když se stránka
//             vymění dřív. Bez ní by přechod nebyl vidět: Next.js doběhne
//             často za sto milisekund, takže by závoj vykoukl na pár procent
//             krytí a hned zase zhasl.
//
// Křivka se sem nedává: při nulovém trvání nemá co dělat, a jako řetězec
// v objektu by se rozšířila na `string`, což framerovu typu `Easing` nesedí.
const FULL_TRANSITION = {
    fade: 0.25,
    minHold: 0.32,
}

// Překrytí zůstává, mizí jen prolnutí. Uživatel má poznat, že se stránka
// mění — nemá jen přijít o animaci.
const REDUCED_TRANSITION = {
    fade: 0,
    minHold: 0.18,
}

export default function PageTransition() {
    const router = useRouter()
    const reduced = useMotionPreference()
    const transition = reduced ? REDUCED_TRANSITION : FULL_TRANSITION

    // 'idle' = nic, 'covering' = závoj drží, 'leaving' = prolíná se pryč.
    const [phase, setPhase] = useState('idle')

    // Stejně jako u preloaderu tu nesmí být `<AnimatePresence>`: jeho odchod
    // se při potlačených animacích nedokončí a závoj by zůstal viset přes
    // celou stránku. Odmountování řídí časovač, ten doběhne vždycky.
    useEffect(() => {
        let shownAt = 0
        let hide = 0
        let drop = 0

        const start = () => {
            window.clearTimeout(hide)
            window.clearTimeout(drop)
            shownAt = Date.now()
            setPhase('covering')
        }

        const stop = () => {
            const left = Math.max(0, transition.minHold * 1000 - (Date.now() - shownAt))
            hide = window.setTimeout(() => setPhase('leaving'), left)
            drop = window.setTimeout(() => setPhase('idle'), left + transition.fade * 1000)
        }

        router.events.on('routeChangeStart', start)
        router.events.on('routeChangeComplete', stop)
        // Bez tohohle by zrušený přechod nechal závoj na obrazovce napořád.
        router.events.on('routeChangeError', stop)

        return () => {
            window.clearTimeout(hide)
            window.clearTimeout(drop)
            router.events.off('routeChangeStart', start)
            router.events.off('routeChangeComplete', stop)
            router.events.off('routeChangeError', stop)
        }
    }, [router.events, transition])

    if (phase === 'idle') return null

    return (
        <motion.div
            className={styles.veil}
            // `initial` nesmí záviset na presetu: vykresluje se do atributu
            // style a server o omezeném pohybu neví. Nulové trvání závoj
            // stejně srazí na plné krytí hned v prvním snímku.
            initial={{ opacity: 0 }}
            animate={{ opacity: phase === 'leaving' ? 0 : 1 }}
            transition={{ duration: transition.fade, ease: 'easeInOut' }}
            aria-hidden="true"
        />
    )
}
