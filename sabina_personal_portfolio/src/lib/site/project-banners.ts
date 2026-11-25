// Bannery do vrstvy za portrétem (motion/intro/IntroBanners) — z PUBLIKOVANÝCH
// projektů, stejně jako karty v heru.
//
// Dřív měly O mně, výzva ke spolupráci (CTA) a 404 seznamy bannerů natvrdo
// v kódu a v nich i projekty, které ve Studiu skryté nebo v archivu jsou
// (Samurai, MistrPet). Teď se berou jen z projektů, které web opravdu čte
// (getProjects: publikované, nearchivované) — skrytý projekt zmizí všude.
//
// Čisté (bez serverových importů), volá se v komponentách.
import type { Project } from './projects'

/**
 * Adresy bannerů: z každého projektu titulní obrázek, galerie a výstupy
 * studie (nejvýš `perProject`), po kolech — nejdřív první obrázek každého
 * projektu, pak druhý… — ať se ve vrstvě střídají všechny projekty.
 */
export const projectBanners = (projects: Project[] | null | undefined, perProject = 4): string[] => {
    const lists = (projects ?? []).map((project) => {
        const all = [
            project.cover?.src,
            ...(project.gallery ?? []).map((image) => image?.src),
            ...(project.study?.outputs ?? []).map((output) => output.image?.src),
        ].filter((src): src is string => typeof src === 'string' && src.length > 0)
        return [...new Set(all)].slice(0, perProject)
    })
    const seen = new Set<string>()
    const out: string[] = []
    for (let round = 0; round < perProject; round++) {
        for (const list of lists) {
            const src = list[round]
            if (!src || seen.has(src)) continue
            seen.add(src)
            out.push(src)
        }
    }
    return out
}
