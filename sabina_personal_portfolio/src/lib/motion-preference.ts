// Kolik pohybu web dělá — volba NÁVŠTĚVNÍKA, ne systému.
//
// macOS (a každý systém) umí „Omezit pohyb". Web ho dřív poslouchal všude:
// bez úvodu, bez přechodů, bannery stály, scéna projektů nenastoupila — a kdo
// má volbu zapnutou (často aniž by to věděl), viděl web rozbitý. Od 2026-11-17
// se systémová volba NEPOUŽÍVÁ. Místo ní se návštěvník při prvním načtení
// zeptá (providers/MotionChoice) a jeho odpověď drží localStorage:
//
//   motion-preference = "full"     plný pohyb (výchozí, když nic nezvolil)
//   motion-preference = "reduced"  klidnější verze
//
// Pohyb čte ~40 míst: vlastní kód přes matchMedia, framer-motion
// (useReducedMotion, MotionConfig), engine valecms (prefersReducedMotion)
// a ~20 bloků @media v SCSS. Aby se nemusela přepisovat všechna a nedalo se
// na nějaké zapomenout, dělá volbu jediný skript v <head> (BOOT, _document):
//
//   1. `<html data-motion="full|reduced">` — SCSS místo @media píše
//      `:global(html[data-motion="reduced"])` (mixin reduced-motion).
//   2. `window.matchMedia("(prefers-reduced-motion: reduce)")` vrací vlastní
//      objekt, jehož `matches` je volba návštěvníka. Tím to vidí i framer
//      a valecms, aniž by o tom věděly. Ostatní dotazy jdou dál na původní
//      matchMedia.
//
// Skript běží dřív než jakýkoli styl či skript stránky, takže nic nestihne
// přečíst systémovou hodnotu. Změna volby se hlásí posluchačům `change`
// (DepthRibbon, PerformanceProvider…); enginy, které čtou jen při mountu
// (FlexCarousel), dostanou novou hodnotu po obnovení stránky — proto
// `setMotionChoice` stránku obnoví.

export type MotionChoice = "full" | "reduced";

export const MOTION_KEY = "motion-preference";

type MotionBridge = {
  /** Co říká systém (jen informace; web se jím neřídí). */
  system: boolean;
  /** Přepne volbu a ohlásí změnu všem, kdo poslouchají `change`. */
  set: (next: MotionChoice) => void;
};

declare global {
  interface Window {
    __motion?: MotionBridge;
  }
}

/** Inline skript do <head> (viz výš). Bez závislostí, bez modulů, ES5. */
export const BOOT = `(function(){try{
var K="${MOTION_KEY}",Q="(prefers-reduced-motion: reduce)";
var stored=null;try{stored=localStorage.getItem(K)}catch(e){}
var reduced=stored==="reduced";
var root=document.documentElement;root.setAttribute("data-motion",reduced?"reduced":"full");
var orig=window.matchMedia;if(typeof orig!=="function")return;
var sys=false;try{sys=orig.call(window,Q).matches}catch(e){}
var ls=[];
var mql={media:Q,matches:reduced,onchange:null,
addEventListener:function(t,f){if(t==="change"&&f)ls.push(f)},
removeEventListener:function(t,f){ls=ls.filter(function(x){return x!==f})},
addListener:function(f){if(f)ls.push(f)},
removeListener:function(f){ls=ls.filter(function(x){return x!==f})},
dispatchEvent:function(){return true}};
var norm=function(s){return String(s).replace(/\\s+/g,"").toLowerCase()};
window.matchMedia=function(s){return norm(s)===norm(Q)?mql:orig.call(window,s)};
window.__motion={system:sys,set:function(next){var m=next==="reduced";mql.matches=m;
root.setAttribute("data-motion",m?"reduced":"full");
var ev={matches:m,media:Q,type:"change"};
ls.slice().forEach(function(f){try{f(ev)}catch(e){}});
if(typeof mql.onchange==="function")try{mql.onchange(ev)}catch(e){}}};
}catch(e){}})();`;

/** Uložená volba, nebo null (návštěvník ještě nevolil). */
export const readMotionChoice = (): MotionChoice | null => {
  if (typeof window === "undefined") return null;
  try {
    const v = localStorage.getItem(MOTION_KEY);
    return v === "full" || v === "reduced" ? v : null;
  } catch {
    return null;
  }
};

/** Co o pohybu říká systém — jen pro text widgetu a diagnostiku. */
export const systemReducedMotion = (): boolean =>
  typeof window !== "undefined" ? Boolean(window.__motion?.system) : false;

/**
 * Uloží volbu. Přechod na klidnější verzi stránku obnoví: část scén čte
 * pohyb jen při mountu a úvod má hrát rovnou v nové podobě.
 */
export const setMotionChoice = (next: MotionChoice) => {
  try {
    localStorage.setItem(MOTION_KEY, next);
  } catch {
    /* soukromý režim bez úložiště: volba platí jen do zavření */
  }
  const before = document.documentElement.getAttribute("data-motion");
  window.__motion?.set(next);
  if (before !== next) window.location.reload();
};
