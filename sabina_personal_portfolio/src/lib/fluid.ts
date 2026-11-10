import { useSyncExternalStore } from "react";

// JS dvojče `fluid()` ze styles/system (_breakpoints.scss, mapa $fluid).
// Pro to, co se nedá napsat v CSS — WebGL částice, rozměry v enginech.
// Rozsah musí sedět s CSS: od nejmenšího notebooku (md) k hlavnímu monitoru.
export const FLUID = { from: 1200, to: 2560 } as const;

export type LandscapeFluid = {
  /** Na šířku a aspoň `from` široké — md a výš. Jinde (telefon, tablet,
   *  cokoli na výšku) je false. */
  on: boolean;
  /** Na šířku v jakékoli šířce — kde platí blok Responzivita na šířku. */
  landscape: boolean;
  /** Šířka okna (px) — pro poměr pod md. */
  width: number;
  /** 0 na `from`, 1 na `to` a výš — kde mezi notebookem a monitorem jsme. */
  t: number;
};

/** Hodnota pro `t`: `atFrom` na notebooku, `atTo` na monitoru, přímka mezi. */
export const lerp = (atFrom: number, atTo: number, t: number) => atFrom + (atTo - atFrom) * t;

const OFF: LandscapeFluid = { on: false, landscape: false, width: 0, t: 0 };
let snapshot: LandscapeFluid = OFF;

function read(): LandscapeFluid {
  // `on` podle okna (jako media dotazy v CSS), poměr podle šířky RÁMU —
  // fluid() v CSS jede ve vw rámu (od md nejvýš 16 : 9 podle výšky).
  const landscape = window.matchMedia("(orientation: landscape)").matches;
  const on = window.innerWidth >= FLUID.from && landscape;
  const w = Math.round(viewFrame().w);
  // Na setiny — stačí to a resize pak nerozbíjí memo každým pixelem.
  const t = Math.round(Math.min(Math.max((w - FLUID.from) / (FLUID.to - FLUID.from), 0), 1) * 100) / 100;
  if (snapshot.on !== on || snapshot.t !== t || snapshot.landscape !== landscape || snapshot.width !== w)
    snapshot = { on, landscape, width: w, t };
  return snapshot;
}

function subscribe(notify: () => void) {
  window.addEventListener("resize", notify);
  return () => window.removeEventListener("resize", notify);
}

/** Viz LandscapeFluid. Na serveru a do hydratace `on: false`. */
export function useLandscapeFluid(): LandscapeFluid {
  return useSyncExternalStore(subscribe, read, () => OFF);
}

// ---------------------------------------------------------------------------
// Na výšku. Dotazy musí sedět s CSS mixiny `v()` (styles/system, mapa $v).

/** Kompozice na výšku (tablet i telefon, od 320px) — CSS `@include xs-v`. */
export const PORTRAIT_TABLET = "(min-width: 320px) and (orientation: portrait)";

/** Telefon na výšku (pod 600px) — CSS bloky „Telefon na výšku" za blokem xs-v. */
export const PORTRAIT_PHONE = "(max-width: 599.98px) and (orientation: portrait)";

/** Platí media query? Na serveru a do hydratace false. */
export function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (notify) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", notify);
      return () => list.removeEventListener("change", notify);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

// ---------------------------------------------------------------------------
// Rám obsahu: vždy přes celou výšku okna, od notebooku na šířku nejvýš
// 16 : 9 podle výšky (širší okno má obsah uprostřed a po stranách pozadí).
// CSS to dělá přes --vw / --vh (styles/globals.scss a postcss plugin
// viewport-frame), JS přes tyhle pomůcky.
export type Frame = {
  /** Levý okraj rámu ve viewportu (0, dokud okno není širší než 16 : 9). */
  x: number;
  /** Horní okraj rámu — vždy 0, rám má výšku okna. */
  y: number;
  w: number;
  h: number;
};

/** Kde platí 16 : 9 podle výšky — stejný dotaz jako v globals.scss. */
const WIDE = `(min-width: ${FLUID.from}px) and (orientation: landscape)`;

/** Rám obsahu v px pro aktuální okno. */
export function viewFrame(): Frame {
  const h = window.innerHeight;
  const byHeight = window.matchMedia(WIDE).matches ? (h * 16) / 9 : Infinity;
  const w = Math.min(window.innerWidth, byHeight);
  return { x: (window.innerWidth - w) / 2, y: 0, w, h };
}

/** Délka v „vw rámu“ pro inline styl — jako `${n}vw`, jen ve 16 : 9 rámu. */
export const cvw = (n: number) => `calc(${n} * var(--vw))`;
/** Délka ve „vh rámu“ pro inline styl — jako `${n}vh`. */
export const cvh = (n: number) => `calc(${n} * var(--vh))`;

/**
 * Poměr jako `fluid(x, ratio)` v CSS: 1 na monitoru, `ratio` na md, pod md
 * dál v poměru šířky. Mimo šířku (na výšku) 1 — tam blok neplatí.
 */
export function fluidRatio(f: LandscapeFluid, ratio: number) {
  if (!f.landscape) return 1;
  if (f.on) return lerp(ratio, 1, f.t);
  return ratio * Math.min(f.width, FLUID.from) / FLUID.from;
}

/**
 * Poměr jako `fluid-scale(Xvh, ratio)` v CSS — přesně stejný vzorec: přímka od
 * `ratio` na md k 1 na monitoru, rychlost podle výšky rámu proti 1305px
 * (referenční okno), pod md drží `ratio`. Mimo šířku 1.
 */
export function fluidScaleRatio(f: LandscapeFluid, ratio: number) {
  if (!f.landscape || typeof window === "undefined") return 1;
  const h = viewFrame().h;
  const line = ratio + ((1 - ratio) * (Math.min(f.width, FLUID.to) - FLUID.from)) / (FLUID.to - FLUID.from) * (1305 / h);
  return Math.min(1, Math.max(ratio, line));
}
