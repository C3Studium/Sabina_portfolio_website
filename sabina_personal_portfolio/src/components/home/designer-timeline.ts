// Časy umělé myši v Procesu (třetí komponenta) — sdílené mezi choreografií
// myši (info/choreography.ts) a Procesem, který podle nich píše texty.
//
// Zadané ve vh scrollu přišpendleného úseku Procesu a převedené na jeho
// podíly (0–1). Úsek má PINNED vh (process/styles .container − 100vh).
//
// Myš sem donese portrét (vyjíždění Procesu + prvních ~35vh), pak napíše
// nadpis, text, přidá nápovědu posunu a odejde; teprve potom se rozjede
// kamera dolly (úvod → kroky 01–06 → výzva → CTA, ~313vh na jednotku
// váhy úseku, process/steps.ts). Myš celkem
// ~255vh scrollu od chvíle, kdy Proces začne vyjíždět.

/** Časy níž jsou ve vh PŮVODNÍ osy; skutečný úsek je 2,25× kratší —
 *  podíly zůstávají, jen se celá sekce projede rychleji. */
const PACE = 2.25;
/** Delší závěr (2026-11-12, přání klientky): výzva a CTA mají o 1,4 váhy
 *  úseku víc (process/steps.ts WEIGHTS) — o tolik se prodlouží jízda, ať
 *  ostatní kroky mají scroll beze změny (~139vh skutečného scrollu na váhu). */
const SLOW_END = 438;
const DESIGN_PINNED = 3438 + SLOW_END;

/** Jízda dolly v původní ose (vh): od rozjezdu kamery po příjezd k CTA. */
const DOLLY_FROM = 154;
const DOLLY_TO = 3378 + SLOW_END;
/** Jízda dolly ve skutečném scrollu (vh), bez pauz. */
export const DOLLY_TRAVEL_VH = (DOLLY_TO - DOLLY_FROM) / PACE;

/** Pauza po každém postaveném kroku (kroky 01–06 a výzva; vh skutečného
 *  scrollu): kamera i krok stojí a tlačítka „Rozbalit detail" mají čas se
 *  ukázat (process/steps.ts, segAt). */
export const STEP_HOLD_VH = 50;
export const STEP_HOLDS = 7;
const HOLDS_VH = STEP_HOLD_VH * STEP_HOLDS;

/** Přišpendlený úsek Procesu (vh) — process/styles .container − 100vh. */
export const PROCESS_PINNED = Math.round(DESIGN_PINNED / PACE + HOLDS_VH);

const at = (vh: number) => vh / PACE / PROCESS_PINNED;
const span = (a: number, b: number) => [at(a), at(b)] as const;

export const PROCESS = {
  /** Portrét dosedne na místo (let končí). */
  flightEnd: at(35),
  /** Přejezd na nadpis, najetí (rámeček). */
  toHeadline: span(38.5, 52.5),
  headlineClick: at(59.5),
  /** Text pod nadpisem. */
  toLead: span(77, 87.5),
  leadClick: at(94.5),
  /** Nápověda posunu („Objevujte posunutím") pod textem. */
  toHint: span(108.5, 119),
  hintClick: at(124),
  /** Myš odejde, panely zhasnou. */
  leave: span(133, 150.5),
  /** Kamera dolly se rozjede až potom… */
  dollyStart: at(DOLLY_FROM),
  /** …a u CTA (poslední dlaždice) stojí tady — zbytek je chvíle na CTA,
   *  než sekce odjede. Jízda je o pauzy po krocích delší. */
  dollyEnd: at(DOLLY_TO) + HOLDS_VH / PROCESS_PINNED,
};
