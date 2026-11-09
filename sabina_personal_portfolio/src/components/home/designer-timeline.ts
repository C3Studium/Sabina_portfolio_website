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

/** Přišpendlený úsek Procesu (vh). */
export const PROCESS_PINNED = 3438;

const at = (vh: number) => vh / PROCESS_PINNED;
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
  dollyStart: at(154),
  /** …a u CTA (poslední dlaždice) stojí tady — zbytek je chvíle na CTA,
   *  než sekce odjede. */
  dollyEnd: at(3378),
};
