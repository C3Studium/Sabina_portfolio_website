// Zvýraznění v textu dokumentu — `*takhle*` → úseky [text, zvýrazněno].
//
// Tentýž zápis, jaký knihovna používá pro bloky textů (schemas/marks.js,
// HIGHLIGHT): pole s `options.mark: 'highlight'` ho ve Studiu ukazuje
// jako zvýraznění a překryv ho tak i zapisuje. Tady je jen dekodér pro čtení,
// ve tvaru, který kreslí `Lines` v components/home/lines.tsx.
//
// Úseky jsou fráze, ne slova: `Lines` dává mezi úseky jednu mezeru, takže
// „Začínáme *pochopením cílů,* cílové…" se kreslí stejně. Interpunkce hned za
// zavírací hvězdičkou („*výsledky*.") se přilepí ke zvýrazněnému úseku — Lines
// ji umí oddělit zase ven (`trailClass`), kdežto samostatný úsek by dostal
// mezeru před sebe.

export type Run = [string, boolean]
export type MarkedLine = Run[]

const PUNCTUATION = /^[.,;:!?…)]+/

export const decodeMarked = (value: string): MarkedLine => {
    const runs: MarkedLine = []
    String(value ?? '')
        .replace(/\s+/g, ' ')
        .split('*')
        .forEach((segment, index) => {
            const marked = index % 2 === 1
            let rest = segment
            // Interpunkce přilepená za zvýrazněním patří k němu.
            if (!marked && runs.length && runs[runs.length - 1][1] && !/^\s/.test(rest)) {
                const punct = rest.match(PUNCTUATION)?.[0] ?? ''
                if (punct) {
                    runs[runs.length - 1][0] += punct
                    rest = rest.slice(punct.length)
                }
            }
            const trimmed = rest.trim()
            if (trimmed) runs.push([trimmed, marked])
        })
    return runs
}
