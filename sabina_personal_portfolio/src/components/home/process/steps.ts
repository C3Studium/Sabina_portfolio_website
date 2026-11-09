// Časy kroků dolly v Procesu — sdílené mezi kreslením kroků (index.tsx)
// a umělou myší (designer.ts).
//
// Scroll dolly (PROCESS.dollyStart → dollyEnd) je rozdělený na ÚSEKY, jeden
// na každou další dlaždici: kroky 01–06, výzva a CTA. Úseky mají VÁHY —
// bohatší kroky dostanou víc scrollu. V úseku kamera nejdřív odletí
// k dlaždici (vždy stejně dlouhý let, TRAVEL_UNITS) a pak u ní stojí —
// v té době krok „edituje" umělá myš a staví se jeho vrstvy.
//
// Průběh úseků `seg` je v celých číslech úseků (0 → SEGMENTS), časy kroku
// jsou podíly jeho úseku (s ∈ 0–1); let končí v travelOf(krok).

import { clamp01, type Window } from "@/components/home/info/choreography";

/** Úseků dolly: kroky 01–06, výzva (07) a CTA (08). */
export const SEGMENTS = 8;

/** Délky úseků vůči sobě; index 0 = úsek k dlaždici 1 (krok 01). */
export const WEIGHTS = [1.5, 1, 1.2, 1.2, 1.8, 2, 0.8, 0.8];
export const TOTAL_WEIGHT = WEIGHTS.reduce((sum, w) => sum + w, 0);

/** Let kamery k další dlaždici — stejně dlouhý v každém úseku (v jednotkách váhy). */
const TRAVEL_UNITS = 0.35;

/** Jakou část úseku k dlaždici `tile` (1–8) kamera letí. */
export const travelOf = (tile: number) => TRAVEL_UNITS / (WEIGHTS[tile - 1] ?? 1);

const glide = (t: number) => t * t * (3 - 2 * t);

/** Průběh scrollu dolly (0–1) → úseky (0 → SEGMENTS), podle vah. */
export const segAt = (p: number) => {
  const target = clamp01(p) * TOTAL_WEIGHT;
  let acc = 0;
  for (let i = 0; i < SEGMENTS; i++) {
    if (target <= acc + WEIGHTS[i]) return i + (target - acc) / WEIGHTS[i];
    acc += WEIGHTS[i];
  }
  return SEGMENTS;
};

/** Poloha kamery (v dlaždicích: 0 úvod, 1–6 kroky, 7 výzva, 8 CTA). */
export const cameraAt = (seg: number) => {
  if (seg <= 0) return 0;
  if (seg >= SEGMENTS) return SEGMENTS;
  const k = Math.floor(seg);
  return k + glide(clamp01((seg - k) / travelOf(k + 1)));
};

/** Průběh kroku (dlaždice 1–8) v jeho úseku. */
export const stepAt = (seg: number, step: number) => clamp01(seg - (step - 1));

/* ---------- Společné pro všechny kroky ---------- */

/** Číslo a název kroku se postaví rámečkem, ještě když kamera přilétá. */
export const HEAD = {
  number: [0.08, 0.3] as Window,
  label: [0.14, 0.34] as Window,
};

/** Ručně psaná poznámka na konci kroku. */
export const NOTE: Window = [0.84, 0.97];

/* ---------- Kroky ---------- */

// 01 Seznámení (let končí v ~0,23): myš napíše text, nástrojem Rámeček
// nakreslí kartu zadání a celou ji vyplní — napíše nadpis a pak řádek po
// řádku (linka, popisek, hodnota), jako ve Figmě. Fotka se postaví jako
// banner (vrstvy), zelený lístek myš dotáhne zprava.
export const S1 = {
  toText: [0.25, 0.28] as Window,
  textClick: 0.29,
  toCard: [0.35, 0.38] as Window,
  draw: [0.38, 0.45] as Window,
  cardIn: [0.44, 0.49] as Window,
  /** Nadpis karty: najetí a klik (pak se píše). */
  toTitle: [0.49, 0.51] as Window,
  titleClick: 0.52,
  /** Řádky karty: začátek prvního, rozestup. */
  rowsStart: 0.55,
  rowLen: 0.055,
  photo: [0.74, 0.84] as Window,
  toNote: [0.8, 0.83] as Window,
  noteDrag: [0.83, 0.9] as Window,
  leave: [0.92, 0.97] as Window,
};

/** Řádek i karty zadání: linka, klik a psaní popisku, pak hodnoty. */
export const briefRow = (i: number) => {
  const a = S1.rowsStart + i * S1.rowLen;
  return { line: [a, a + 0.012] as Window, label: a + 0.008, value: a + 0.03, end: a + S1.rowLen };
};

// 02 Koncept: myš napíše text, karta písma se postaví, první barvu myš
// postaví a další tři zduplikuje (Ctrl/⌘ + D) a přebarví.
export const S2 = {
  toText: [0.37, 0.42] as Window,
  textClick: 0.44,
  type: [0.48, 0.64] as Window,
  toSwatch: [0.58, 0.62] as Window,
  swatch: [0.6, 0.7] as Window,
  swatchClick: 0.64,
  dupStart: 0.7,
  dupLen: 0.05,
  leave: [0.88, 0.95] as Window,
};

/** Okno duplikátu barvy i (1–3): [chycení, puštění, konec]. */
export const swatchDup = (i: number) => {
  const a = S2.dupStart + (i - 1) * S2.dupLen;
  return { a, drop: a + S2.dupLen * 0.6, b: a + S2.dupLen };
};

/** Duplikát obrázku: k originálu, tah kopie na místo, k úchytu, změna rozměru. */
export type DupWindows = { toSource: Window; drag: Window; toHandle: Window; resize: Window };

// 03 Tvorba: text se nakreslí sám, myš vloží hlavní vizuál (postaví se
// jako banner v heru), pak ho dvakrát zduplikuje (Ctrl/⌘ + D), kopii
// dotáhne na místo a za úchyt jí změní rozměr na poměr varianty — kopie
// se pak přepíše na skutečnou variantu.
export const S3 = {
  text: [0.24, 0.42] as Window,
  toMain: [0.32, 0.36] as Window,
  mainClick: 0.37,
  main: [0.37, 0.5] as Window,
  top: { toSource: [0.52, 0.55], drag: [0.55, 0.61], toHandle: [0.61, 0.63], resize: [0.63, 0.7] } as DupWindows,
  bottom: { toSource: [0.71, 0.74], drag: [0.74, 0.8], toHandle: [0.8, 0.82], resize: [0.82, 0.89] } as DupWindows,
  leave: [0.91, 0.97] as Window,
};

// 04 Doladění: text a vizuál se postaví, klient napíše „Můžeme zkusit dát
// nadpis větší?". Myš si zprávu označí, v bublině Já napíše odpověď (čeká
// s textovým kurzorem, než dopíše), klikne na nadpis ve vizuálu — u
// obrázku se otevře panel Text — klikne do velikosti písma, napíše nové
// číslo a nadpis se zvětší (z TITLE_FROM na 1).
export const S4 = {
  text: [0.26, 0.42] as Window,
  shot: [0.3, 0.46] as Window,
  client: [0.4, 0.5] as Window,
  clientType: 0.5,
  toClient: [0.52, 0.56] as Window,
  clientClick: 0.57,
  toMe: [0.6, 0.64] as Window,
  meClick: 0.65,
  me: [0.64, 0.7] as Window,
  meType: 0.69,
  toTitle: [0.73, 0.77] as Window,
  titleClick: 0.78,
  panel: [0.78, 0.81] as Window,
  toSize: [0.81, 0.85] as Window,
  sizeClick: 0.86,
  sizeType: 0.87,
  grow: [0.89, 0.93] as Window,
  panelOut: [0.95, 0.98] as Window,
  leave: [0.95, 0.99] as Window,
};

/** Nadpis ve vizuálu kroku 04 před zvětšením (podíl konečné velikosti). */
export const TITLE_FROM = 0.75;
/** Velikost písma v panelu Text: před a po (TITLE_FROM = FROM / TO). */
export const FONT_SIZE = { from: "48", to: "64" };
/** Panel Text u obrázku: o kolik px nad jeho horní hranou a vpravo od něj. */
export const TEXT_PANEL_OFFSET = { above: 80, right: 30 };

// 05 Předání (delší úsek, let končí v ~0,19): myš napíše text; story se
// postaví jako banner a myš ji natáhne z 1080 × 1350 na 1080 × 1920; formát
// na výšku dotáhne zprava, zduplikuje ho dolů a stáhne na čtverec 1:1
// (kopie se přepíše na čtverec); pomalu se napíšou fialové popisky; myš
// klikne na formáty (fialový rámeček ořezu), klikne na Exportovat a odešle
// e-mail s podklady.
export const S5 = {
  toText: [0.2, 0.23] as Window,
  textClick: 0.24,
  story: [0.28, 0.36] as Window,
  toHandle: [0.36, 0.38] as Window,
  stretch: [0.38, 0.44] as Window,
  toPortrait: [0.45, 0.47] as Window,
  portraitDrag: [0.47, 0.53] as Window,
  square: { toSource: [0.53, 0.55], drag: [0.55, 0.6], toHandle: [0.6, 0.61], resize: [0.61, 0.66] } as DupWindows,
  captions: [
    [0.67, 0.73],
    [0.71, 0.77],
    [0.75, 0.81],
  ] as Window[],
  marks: [
    { to: [0.81, 0.825] as Window, click: 0.83 },
    { to: [0.835, 0.85] as Window, click: 0.855 },
    { to: [0.86, 0.875] as Window, click: 0.88 },
  ],
  /** Tlačítko Exportovat se postaví (rámeček, výplň), než na něj myš klikne. */
  exportIn: [0.78, 0.84] as Window,
  toExport: [0.885, 0.9] as Window,
  exportClick: 0.905,
  mail: [0.905, 0.92] as Window,
  toSend: [0.92, 0.935] as Window,
  sendClick: 0.94,
  fly: [0.94, 0.965] as Window,
  leave: [0.965, 0.995] as Window,
};

/** Story kroku 05: výška (px formátu při šířce 1080) před a po natažení. */
export const STORY = { width: 1080, from: 1350, to: 1920 };

// 06 Další projekty (let končí v ~0,18): myš napíše text, vloží banner
// (postaví se vrstvami), nástrojem Rámeček nakreslí snímek prezentace
// a napíše jeho nadpis; fotka a graf na snímku se postaví samy. Karta
// identity značky se postaví, myš klikne na logo, postaví první barvu
// a další tři zduplikuje (Ctrl/⌘ + D). Na konci fialové popisky.
export const S6 = {
  toText: [0.2, 0.23] as Window,
  textClick: 0.24,
  toBanner: [0.3, 0.33] as Window,
  bannerClick: 0.34,
  banner: [0.34, 0.44] as Window,
  toSlide: [0.45, 0.48] as Window,
  draw: [0.48, 0.53] as Window,
  slideIn: [0.52, 0.56] as Window,
  toSlideTitle: [0.56, 0.58] as Window,
  slideTitleClick: 0.59,
  slideImage: [0.6, 0.68] as Window,
  bars: [0.63, 0.7] as Window,
  brand: [0.66, 0.74] as Window,
  toLogo: [0.72, 0.75] as Window,
  logoClick: 0.76,
  toChip: [0.77, 0.79] as Window,
  chip: [0.79, 0.83] as Window,
  chipClick: 0.8,
  dupStart: 0.83,
  dupLen: 0.03,
  captions: [
    [0.86, 0.91],
    [0.89, 0.94],
    [0.92, 0.97],
  ] as Window[],
  leave: [0.93, 0.98] as Window,
};

/** Okno duplikátu barvy identity i (1–3): [chycení, puštění, konec]. */
export const chipDup = (i: number) => {
  const a = S6.dupStart + (i - 1) * S6.dupLen;
  return { a, drop: a + S6.dupLen * 0.6, b: a + S6.dupLen };
};

// 07 Výzva (bez čísla): velký bílo-zelený text, řádky se postaví rámečkem.
export const CALLOUT = {
  eyebrow: [0.2, 0.4] as Window,
  lines: [
    [0.28, 0.52],
    [0.36, 0.6],
  ] as Window[],
  lead: [0.5, 0.75] as Window,
};

/* ---------- Linka ---------- */

/** Kotva linky (index v LINE), u které je dlaždice: úvod 0, kroky 2–7, výzva 8, CTA 9. */
const nodeOf = (tile: number) => (tile <= 0 ? 0 : tile + 1);

/**
 * Kam až je linka nakreslená (v kotvách) podle průběhu úseků. Roste plynule
 * se scrollem: k uzlu kroku dojde, když kamera ke kroku dorazí, a během
 * editace kroku se protahuje do půlky cesty k dalšímu.
 */
export const lineHead = (seg: number) => {
  if (seg <= 0) return 0;
  if (seg >= SEGMENTS) return nodeOf(SEGMENTS);
  const k = Math.floor(seg);
  const f = seg - k;
  const travel = travelOf(k + 1);
  const from = k === 0 ? 0 : nodeOf(k) + (nodeOf(k + 1) - nodeOf(k)) * 0.5;
  const at = nodeOf(k + 1);
  const to = k + 1 >= SEGMENTS ? at : at + (nodeOf(k + 2) - at) * 0.5;
  return f < travel ? from + (at - from) * (f / travel) : at + (to - at) * ((f - travel) / (1 - travel));
};
