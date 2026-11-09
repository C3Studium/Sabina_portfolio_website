// Průběh přišpendleného hera (0–1) pro ostatní sekce — umělá myš v Info
// (info/choreography.ts) podle něj chytá galerii a portrét ještě předtím,
// než Info začne vyjíždět. Píše ho hero ze svého useScroll.

import { motionValue } from "framer-motion";

export const heroProgress = motionValue(0);

/** Přišpendlený úsek hera (vh) — hero/styles .container − 100vh. Do 370vh
 *  scéna s kartami, od 370vh umělá myš (smaže scénu, odnese portrét). */
export const HERO_PINNED = 772;

/** Bod časové osy hera zadaný ve vh scrollu → průběh 0–1. */
export const heroAt = (vh: number) => vh / HERO_PINNED;
