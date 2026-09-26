// Lišta k souhlasu — nejmenší, co obstojí.
//
// Stav drží `CookiesProvider`; tenhle soubor je jen jeho obličej. Proto se dá
// přepsat celý, aniž by se cokoli jiného dozvědělo — a přepsat by se měl:
// vzhled téhle věci je vzhled webu, ne knihovny.
//
// Odmítnout musí být stejně snadné jako přijmout, jinak to není souhlas.
// Obě volby jsou tedy tlačítko vedle sebe; podrobnosti jsou až třetí.

import { useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'

import { useCookies } from './CookiesProvider'
import styles from './CookieBanner.module.scss'

export default function CookieBanner() {
    const { showBanner, categories, preferences, acceptAll, rejectAll, savePreferences } = useCookies()
    const [detail, setDetail] = useState(false)
    const [draft, setDraft] = useState(preferences)
    const reduced = useReducedMotion()

    const toggle = (id: string) => setDraft((prev) => ({ ...prev, [id]: !prev[id] }))

    return (
        <AnimatePresence>
            {showBanner && (
                <motion.div
                    className={styles.wrap}
                    initial={reduced ? { opacity: 0 } : { opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduced ? { opacity: 0 } : { opacity: 0, y: 24 }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                    // Lišta o souhlasu není hlášení, které by mělo skočit do
                    // řeči čtečce uprostřed věty — ale odejít se nedá bez ní.
                    role="dialog"
                    aria-label="Souhlas se soubory cookie"
                >
                    <div className={styles.card}>
                        <p className={styles.text}>
                            Používáme cookies, aby web fungoval a abychom věděli, co je na něm
                            k užitku. Bez souhlasu zůstanou jen ty nezbytné.
                        </p>

                        {detail && (
                            <div className={styles.list}>
                                {categories.map((category) => (
                                    <label key={category.id} className={styles.item}>
                                        <input
                                            type="checkbox"
                                            checked={Boolean(draft[category.id])}
                                            disabled={category.locked}
                                            onChange={() => toggle(category.id)}
                                        />
                                        <span>
                                            <span className={styles.name}>{category.name}</span>
                                            <span className={styles.note}>{category.description}</span>
                                        </span>
                                    </label>
                                ))}
                            </div>
                        )}

                        <div className={styles.row}>
                            {detail ? (
                                <button type="button" className={`${styles.button} ${styles.primary}`} onClick={() => savePreferences(draft)}>
                                    Uložit volbu
                                </button>
                            ) : (
                                <button type="button" className={`${styles.button} ${styles.primary}`} onClick={acceptAll}>
                                    Přijmout vše
                                </button>
                            )}
                            <button type="button" className={styles.button} onClick={rejectAll}>
                                Jen nezbytné
                            </button>
                            <button type="button" className={styles.plain} onClick={() => setDetail((open) => !open)}>
                                {detail ? 'Skrýt' : 'Nastavení'}
                            </button>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
