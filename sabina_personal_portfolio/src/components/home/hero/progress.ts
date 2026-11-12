// Průběh přišpendleného hera (0–1) pro ostatní sekce — umělá myš v Info
// (info/choreography.ts) podle něj chytá galerii a portrét ještě předtím,
// než Info začne vyjíždět. Píše ho hero ze svého useScroll.

import { motionValue } from "framer-motion";

export const heroProgress = motionValue(0);

/**
 * Tempo hera po úsecích. Časy (heroAt) se dál píšou ve vh PŮVODNÍ osy
 * (772vh: do 370 scéna s kartami, 370–489 myš smaže scénu a jde pro
 * portrét, 489–772 přelet portrétu do Info) a každý úsek se přepočte na
 * svou skutečnou délku ve scrollu:
 *   karty      370vh → 164vh  (2,25× rychleji)
 *   smazání    119vh → 180vh  (pomaleji — ať je vidět, co myš dělá)
 *   přelet     283vh → 125vh  (2,25× rychleji; posledních 100vh přes
 *                              hero vyjíždí Info, margin-top −100vh)
 * Délky mají dohromady HERO_PINNED — musí sedět na hero/styles .container
 * (HERO_PINNED + 100vh).
 */
const SPANS: readonly (readonly [from: number, to: number, length: number])[] = [
  [0, 370, 164],
  [370, 489, 180],
  [489, 772, 125],
];

/** Přišpendlený úsek hera (vh) — hero/styles .container − 100vh. */
export const HERO_PINNED = SPANS.reduce((sum, [, , length]) => sum + length, 0);

/** Bod původní osy (vh) → skutečná poloha ve scrollu (vh). */
const paced = (vh: number) => {
  let out = 0;
  for (const [from, to, length] of SPANS) {
    if (vh <= from) break;
    out += (length * (Math.min(vh, to) - from)) / (to - from);
  }
  return out;
};

/** Bod časové osy hera zadaný ve vh původní osy → průběh 0–1. Jen body,
 *  ne délky: délka by se přepočetla tempem prvního úseku, ne svého. */
export const heroAt = (vh: number) => paced(vh) / HERO_PINNED;
