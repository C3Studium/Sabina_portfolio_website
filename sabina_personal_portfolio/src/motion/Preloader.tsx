// Překryv při prvním načtení: nápis a proužek, který doběhne.
//
// Když doběhne, otevře bránu — sekce pod ním si přes `useGate()` přečtou `go`
// a spustí své animace.
//
// Při zapnutém "omezit pohyb" se opona nevypíná, jen se zjednoduší: ukáže se
// stejně, jen kratší, bez prolnutí a bez rostoucího proužku. Rozdíl je celý
// v těch dvou objektech níž, jinde se na preferenci nesahá.
//
// Je to schválně to nejjednodušší, co dává smysl. Přepiš si to.

import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

import { useGate } from './LoadProvider'
import styles from './Preloader.module.scss'

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
// `hold`  — jak dlouho opona stojí, než začne odcházet
// `fade`  — prolnutí pryč; 0 znamená zmizet rovnou
// `bar`   — růst proužku; 0 znamená nakreslit ho rovnou plný
//
// Křivka se sem nedává: při nulovém trvání nemá co dělat, a jako řetězec
// v objektu by se rozšířila na `string`, což framerovu typu `Easing` nesedí.
const FULL_TRANSITION = {
    hold: 1.1,
    fade: 0.4,
    bar: 1.1,
}

// Kratší a bez pohybu: nulové trvání znamená skočit rovnou na cíl. Proužek
// se schválně nehýbe, růst je transformace a právě té se má "omezit pohyb"
// vyhnout. Opona ale zůstává — uživatel nemá přijít o to, že se stránka
// načítá, jen o tu animaci.
const REDUCED_TRANSITION = {
    hold: 0.5,
    fade: 0,
    bar: 0,
}

export default function Preloader() {
    const { setGate } = useGate()
    const reduced = useMotionPreference()

    // Na serveru `useReducedMotion()` vrací null, takže tam vyjde plná varianta.
    // Preset proto smí ovlivňovat jen ČASY, nikdy to, co se vykreslí: server o
    // preferenci neví, takže cokoli z ní odvozeného by se po hydrataci nepotkalo.
    // Vykreslený strom je díky tomu v obou variantách stejný a liší se až pohyb.
    const transition = reduced ? REDUCED_TRANSITION : FULL_TRANSITION

    // 'hold' = opona stojí, 'leaving' = prolíná se pryč, 'gone' = odmountováno.
    const [phase, setPhase] = useState('hold')

    // Postup opony řídí časovač, ne callbacky z animací. Když prohlížeč animace
    // potlačí kvůli "omezit pohyb", `onAnimationComplete` nedorazí a
    // `<AnimatePresence>` drží uzel v DOM, dokud odchod neskončí — tedy navždy.
    // Opona pak zůstane přes celou stránku. Časovač doběhne vždycky.
    useEffect(() => {
        // Brána se otevírá, jakmile opona ZAČNE odcházet, ne až zmizí: sekce
        // mají nastupovat, zatímco se prolíná pryč. Kdyby čekaly na konec,
        // byla by mezi nimi prodleva.
        const leave = window.setTimeout(() => {
            setPhase('leaving')
            setGate('go')
        }, transition.hold * 1000)

        const drop = window.setTimeout(
            () => setPhase('gone'),
            (transition.hold + transition.fade) * 1000,
        )

        return () => {
            window.clearTimeout(leave)
            window.clearTimeout(drop)
        }
    }, [transition, setGate])

    if (phase === 'gone') return null

    return (
        <motion.div
            className={styles.overlay}
            initial={false}
            animate={{ opacity: phase === 'leaving' ? 0 : 1 }}
            transition={{ duration: transition.fade, ease: 'easeOut' }}
            aria-hidden="true"
        >
            <span className={styles.label}>Načítání</span>
            <span className={styles.track}>
                {/* `initial` tu NESMÍ záviset na presetu. Vykresluje se do
                    atributu style, a server o omezeném pohybu neví — lišil by
                    se od klienta a hydratace by se rozešla. Nulové trvání
                    proužek stejně srazí na plný hned v prvním snímku. */}
                <motion.span
                    className={styles.bar}
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: transition.bar, ease: 'easeInOut' }}
                />
            </span>
        </motion.div>
    )
}
