// Kreslení MeasureText — převzaté z TechText a předělané na „měřicí" vzhled.
//
// Jedno plátno přes celý nadpis, ne jedno na slovo. Měřitelná slova jsou
// v nadpisu označená `data-measure`; engine z nich sebere všechna písmena do
// jednoho seznamu. Výběr (rámeček) tak žije v jednom prostoru a mezi slovy
// PŘEJÍŽDÍ — z „lepší" šikmo dolů do „výsledky" — místo aby v jednom slově
// zhasl a v druhém se rozsvítil.
//
// Proti originálu dál:
//  - Písmo neurčuje plátno, ale DOM. Skutečná slova zůstávají v <h1> (SEO,
//    čtečky, Studio), jen průhledná; poloha každého písmene se čte z DOMu
//    přes Range. Řádky nadpisu při vstupu jedou a prolínají se — plátno je
//    mimo ně, proto si každý snímek dočte posun a krytí každého slova.
//  - Fyzika písmen (tažení, šťouchnutí) jede na framer motion values se
//    `spring` animacemi místo ručního integrátoru.
//  - Smyčku nevlastní. Komponenta volá `tick(dt)` z `useAnimationFrame`.
//  - Vzhled: obrys písmene tečkovaný (kulaté tečky místo čárek), rámeček
//    čárkovaný a tenký, rohy jako kulaté tečky (tytéž, na které se rozpadne
//    kurzor), drobky kolem rámečku kulaté a křížky, popisky písmem webu.
//  - Bez myši se po písmenech rozhlíží jeden „pohled" jako oko čtenáře.
//
// Režimy `intro` a odhalování plochou (`reveal: "area"`) z originálu tu nejsou
// — nadpis má vlastní vstup přes bránu opony a hover je po písmenech.

import { animate, motionValue, type MotionValue } from "framer-motion";
import type { SnapRect } from "@/providers/RefContext";

export type SweepPace = {
  /** Jak dlouho se pohled zdrží na písmenu (s, od–do). */
  dwell: [number, number];
  /** Jak dlouho trvá pohled jinam (s, od–do). */
  gap: [number, number];
  /** Pravděpodobnost, že zůstane ve stejném slově. */
  stay: number;
  /** Pravděpodobnost, že se po písmenu na chvíli podívá jinam. */
  glance: number;
  /** Prodleva před prvním pohledem po načtení (s). */
  start: number;
  /** Jak pomalu rámeček doklouže k sousednímu písmenu (s, časová konstanta). */
  glide: number;
  /** Jak pomalu rámeček přejede do jiného slova (s, časová konstanta). */
  travel: number;
  /** Jak pomalu se písmeno přepne na obrys a zpět (s, časová konstanta). */
  fade: number;
};

export type MeasureSettings = {
  /** Obrys písmene pod kurzorem: "dotted" | "dashed" | "solid". */
  lineStyle: "dotted" | "dashed" | "solid";
  dashLength: number;
  dashGap: number;
  strokeWidth: number;
  /** Počet drobků kolem rámečku. */
  specks: number;
  selection: boolean;
  labels: boolean;
  guides: boolean;
  draggable: boolean;
  clickKick: boolean;
  /** Bez myši nad písmeny se po nich rozhlíží jeden „pohled". */
  sweep: boolean;
  /** Tempo toho pohledu. */
  sweepPace: SweepPace;
  /** Rychlost teček obíhajících rámeček. */
  speed: number;
  /** 0 = písmena se vrací bez zhoupnutí, 1 = hodně pružně. */
  bounce: number;
  /** Síla šťouchnutí jako násobek velikosti písma (px/s). */
  kick: number;
  /** Barva rámečku, popisků a vodítek. Písmena mají barvu svého slova. */
  markColor: string;
  /** Přesah plátna kolem nadpisu v em — místo pro popisky, drobky a vodítka. */
  bleed: number;

  /**
   * Co rámeček (a kurzor) obejme: "glyph" = písmeno pod myší (nadpis),
   * "word" = celé slovo, resp. jeho prvek s `data-measure-frame` (odkazy
   * menu). Obrys dostane v obou případech jen písmeno pod myší.
   */
  frame: "glyph" | "word";
  /** Okraj rámečku kolem písmene / slova (px). */
  framePad: number;
  /** Jak blízko písmene se počítá zásah (px, jen pro "glyph"). */
  hit: number;
  /** Měřítko drobků, popisků a rohových teček (1 = nadpis). */
  markScale: number;
  /** Kolik plného písma zůstane pod obrysem (0 = jen obrys, 1 = celé). */
  outlineFill: number;
  /** Barva obrysu; bez ní barva slova. */
  outlineColor?: string;
  /** Písmeno pod myší se mění na obrys (nadpis). `false` = písmena zůstávají plná (menu). */
  letterOutline: boolean;
  /** Celé slovo pod myší se přebarví na tuhle barvu (menu). */
  hoverTint?: string;
  /**
   * Barva písmen. Bez ní se čte z CSS při měření — jenže v devu se styly
   * modulů můžou načíst až po prvním měření a do písmen se pak „zapeče"
   * výchozí modrá barva odkazu. Kde je barva známá, je jistější ji zadat.
   */
  ink?: string;
  /** Kde je popisek s rozměrem: nad rámečkem, nebo pod ním (u horního okraje okna). */
  labelSide?: "top" | "bottom";
};

export type MeasureEvents = {
  /** Samostatný pohled se „podíval jinam" — nic není vybrané, je pauza. */
  onGlance?: () => void;
};

type Sprite = { image: HTMLCanvasElement; left: number; top: number; width: number; height: number };

type Word = {
  el: HTMLElement;
  /** Kde slovo leželo při měření (vůči kořeni). */
  anchor: { x: number; y: number };
  /** O kolik se od měření posunulo (vstup řádku) — dočítá se každý snímek. */
  shift: { x: number; y: number };
  /** Krytí slova včetně předků (vstup řádku) — dočítá se každý snímek. */
  alpha: number;
  size: number;
  baseline: number;
  xHeight: number;
  capHeight: number;
  left: number;
  right: number;
  /** Box rámečku slova (prvek s `data-measure-frame`, jinak slovo), při měření. */
  box: { x: number; y: number; w: number; h: number };
  /** Kolik je slovo přebarvené na `hoverTint` (0–1). */
  tint: number;
  /** Slovo právě kreslí TextMorph (přelévá se) — písmo se tady nekreslí. */
  hidden: boolean;
};

type Glyph = {
  word: number;
  /** Znak, jak se vykreslí (po text-transform). */
  char: string;
  /** Pero na účaří, v souřadnicích kořene (při měření). */
  x: number;
  baseline: number;
  /** Inkoust písmene, v souřadnicích kořene (při měření). */
  box: { x1: number; y1: number; x2: number; y2: number };
  ox: MotionValue<number>;
  oy: MotionValue<number>;
  /** 0 = plné písmeno, 1 = obrys. */
  outline: number;
  fill: Sprite;
  dashes: Sprite;
  /** Plné písmeno v barvě `hoverTint` (jen když je zadaná). */
  tinted: Sprite;
};

type Engine = {
  measure: () => void;
  tick: (dt: number) => void;
  /** Box písmene pod myší v souřadnicích okna — pro kurzor. */
  focusRect: () => SnapRect | null;
  /** Zapne/vypne samostatný pohled za běhu (např. až po preloaderu). */
  setSweep: (on: boolean) => void;
  destroy: () => void;
};

const SPRING = 320;
const KICK_DECAY = 0.62;

const approach = (current: number, target: number, dt: number, seconds: number) =>
  current + (target - current) * (1 - Math.exp(-dt / seconds));

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const between = ([from, to]: [number, number]) => from + Math.random() * (to - from);

const noise = (...values: number[]) => {
  let h = 2166136261;
  for (const value of values) {
    h = Math.imul(h ^ (value | 0), 16777619);
    h ^= h >>> 13;
    h = Math.imul(h, 0x5bd1e995);
    h ^= h >>> 15;
  }
  return (h >>> 0) / 4294967296;
};

const signed = (value: number) => (value > 0 ? `+${value}` : value < 0 ? `−${-value}` : "0");

const segment = (value: string) =>
  typeof Intl === "undefined" || typeof Intl.Segmenter === "undefined"
    ? Array.from(value)
    : Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(value), (p) => p.segment);

const EMPTY_SPRITE = (): Sprite => ({
  image: document.createElement("canvas"),
  left: 0,
  top: 0,
  width: 0,
  height: 0,
});

export function createMeasure(
  root: HTMLElement,
  canvas: HTMLCanvasElement,
  settings: MeasureSettings,
  events: MeasureEvents = {},
): Engine | null {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  let dpr = 1;
  let bleed = 0;
  let width = 1;
  let height = 1;
  let labelFont = "";
  let words: Word[] = [];
  let glyphs: Glyph[] = [];
  let ready = false;
  let destroyed = false;

  let pulse = 0;
  let placed = false;
  let focus = -1;
  let dragging = -1;
  let guideAlpha = 0;
  const pointer = { x: 0, y: 0, inside: false };
  const lens = { x: 0, y: 0 };
  const grab = { x: 0, y: 0 };
  const press = { x: 0, y: 0, time: 0, index: -1 };
  const frame = { x1: 0, y1: 0, x2: 0, y2: 0, alpha: 0, index: -1, glide: 0.08 };
  // Samostatný pohled: písmeno, na které se dívá, a kdy se pohne dál.
  const look = { index: -1, next: settings.sweepPace.start };
  // Samostatný pohled smí běžet (nastavení × přepínač zvenku, `setSweep`).
  let sweepOn = settings.sweep;

  // Běžící pružiny písmen — aby šly při odmountování zastavit. Doběhlé se samy vyřadí.
  const motions = new Set<ReturnType<typeof animate>>();
  const track = (controls: ReturnType<typeof animate>) => {
    motions.add(controls);
    controls.then(() => motions.delete(controls));
  };

  const damping = 2 * Math.sqrt(SPRING) * (1 - clamp01(settings.bounce) * 0.96);
  const spring = (velocity = 0, delay = 0) =>
    ({ type: "spring", stiffness: SPRING, damping, mass: 1, velocity, delay }) as const;

  // Kde písmeno právě je: změřené místo + posun slova (vstup) + vlastní posun.
  const dx = (g: Glyph) => words[g.word].shift.x + g.ox.get();
  const dy = (g: Glyph) => words[g.word].shift.y + g.oy.get();

  /* ---------- Měření ---------- */

  const sprite = (glyph: Glyph, font: string, ink: string, outline: boolean): Sprite => {
    const pad = Math.ceil(settings.strokeWidth * 2 + 4);
    const left = glyph.box.x1 - pad;
    const top = glyph.box.y1 - pad;
    const w = glyph.box.x2 - glyph.box.x1 + pad * 2;
    const h = glyph.box.y2 - glyph.box.y1 + pad * 2;
    const image = document.createElement("canvas");
    image.width = Math.max(1, Math.ceil(w * dpr));
    image.height = Math.max(1, Math.ceil(h * dpr));
    const c = image.getContext("2d");
    const art = { image, left, top, width: image.width / dpr, height: image.height / dpr };
    if (!c) return art;
    c.setTransform(dpr, 0, 0, dpr, -left * dpr, -top * dpr);
    c.font = font;
    c.textBaseline = "alphabetic";
    if (outline) {
      c.lineJoin = "round";
      c.strokeStyle = settings.outlineColor ?? ink;
      if (settings.lineStyle === "dotted") {
        // Nulové čárky s kulatým koncem jsou kulaté tečky vycentrované na
        // obrysu. Bez vykrojení vnitřku — tečky mají být celé.
        c.lineWidth = settings.strokeWidth * 1.6;
        c.lineCap = "round";
        c.setLineDash([0, settings.dashLength + settings.dashGap]);
        c.strokeText(glyph.char, glyph.x, glyph.baseline);
      } else {
        c.lineWidth = settings.strokeWidth * 2;
        c.lineCap = "butt";
        if (settings.lineStyle === "dashed") c.setLineDash([settings.dashLength, settings.dashGap]);
        c.strokeText(glyph.char, glyph.x, glyph.baseline);
        c.setLineDash([]);
        c.globalCompositeOperation = "destination-out";
        c.fillText(glyph.char, glyph.x, glyph.baseline);
        c.globalCompositeOperation = "source-over";
      }
    } else {
      c.fillStyle = ink;
      c.fillText(glyph.char, glyph.x, glyph.baseline);
    }
    return art;
  };

  // Měřítko obalu na obrazovce vůči rozvržení (transformace předků, např.
  // zmenšené plátno případové studie). Na homepage 1. Obdélníky z
  // getBoundingClientRect se jím dělí, aby vše bylo v px rozvržení.
  const zoomOf = (rect: DOMRect) => (root.offsetWidth ? rect.width / root.offsetWidth : 1) || 1;

  const measure = () => {
    if (destroyed) return;
    ready = false;
    width = root.offsetWidth;
    height = root.offsetHeight;
    const spans = Array.from(root.querySelectorAll<HTMLElement>("[data-measure]"));
    // Prvky jen s rámečkem (logo, tlačítko): `data-measure-frame` bez
    // měřeného textu uvnitř. Písmo se nekreslí — zůstává v DOMu, kde ho
    // může měnit CSS — ale rámeček s rozměrem a drobky dostanou stejně.
    const frameOnly = Array.from(root.querySelectorAll<HTMLElement>("[data-measure-frame]")).filter(
      (el) => !el.querySelector("[data-measure]"),
    );
    if (!width || !height || (!spans.length && !frameOnly.length)) return;

    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const origin = root.getBoundingClientRect();
    const k = zoomOf(origin);
    const lang = document.documentElement.lang || undefined;
    const previous = glyphs;
    const nextWords: Word[] = [];
    const nextGlyphs: Glyph[] = [];
    const fonts: { font: string; ink: string }[] = [];
    let biggest = 16;

    spans.forEach((span) => {
      const node = span.firstChild;
      if (!(node instanceof Text)) return;
      const style = getComputedStyle(span);
      const size = parseFloat(style.fontSize) || 16;
      biggest = Math.max(biggest, size);
      const font = `${style.fontStyle} ${style.fontWeight} ${size}px ${style.fontFamily}`;
      labelFont = `500 ${Math.max(8, Math.round(11 * settings.markScale))}px ${style.fontFamily}`;
      // Barva písmen: zadaná, jinak z obalu — slovo samo je průhledné.
      const ink = settings.ink ?? getComputedStyle(span.parentElement ?? root).color;
      const shape = (value: string) =>
        style.textTransform === "uppercase"
          ? value.toLocaleUpperCase(lang)
          : style.textTransform === "lowercase"
            ? value.toLocaleLowerCase(lang)
            : value;

      ctx.font = font;
      // measureText měří vůči AKTUÁLNÍMU účaří kontextu. Kreslení popisků ho
      // každý snímek přepíná na "bottom"/"middle" — bez návratu by každé další
      // měření (resize, výměna slova) posadilo písmena o kus níž.
      ctx.textBaseline = "alphabetic";
      ctx.textAlign = "left";
      if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
      const metrics = ctx.measureText("Hg");
      const ascent = metrics.fontBoundingBoxAscent || size * 0.8;
      const descent = metrics.fontBoundingBoxDescent || size * 0.2;

      const anchorRect = span.getBoundingClientRect();
      const wordIndex = nextWords.length;
      const firstGlyph = nextGlyphs.length;
      let baseline = 0;
      let index = 0;
      for (const part of segment(node.data)) {
        const range = document.createRange();
        range.setStart(node, index);
        range.setEnd(node, index + part.length);
        index += part.length;
        if (!part.trim()) continue;
        const r = range.getBoundingClientRect();
        const x = (r.left - origin.left) / k;
        const top = (r.top - origin.top) / k;
        baseline = top + (r.height / k) * (ascent / (ascent + descent));
        const char = shape(part);
        const m = ctx.measureText(char);
        // Rozpohybovaná písmena si drží svůj posun i přes nové měření.
        const kept = previous[nextGlyphs.length];
        const same = kept?.char === char;
        nextGlyphs.push({
          word: wordIndex,
          char,
          x,
          baseline,
          box: {
            x1: x - m.actualBoundingBoxLeft,
            y1: baseline - m.actualBoundingBoxAscent,
            x2: x + m.actualBoundingBoxRight,
            y2: baseline + m.actualBoundingBoxDescent,
          },
          ox: same ? kept.ox : motionValue(0),
          oy: same ? kept.oy : motionValue(0),
          outline: 0,
          fill: EMPTY_SPRITE(),
          dashes: EMPTY_SPRITE(),
          tinted: EMPTY_SPRITE(),
        });
        fonts.push({ font, ink });
      }
      const own = nextGlyphs.slice(firstGlyph);
      if (!own.length) return;
      // Rámeček slova: prvek označený `data-measure-frame` (odkaz s
      // odsazením), jinak slovo samo. Uvnitř kořene, jinak by ujel.
      const framer = span.closest<HTMLElement>("[data-measure-frame]");
      const frameRect = (framer && root.contains(framer) ? framer : span).getBoundingClientRect();
      nextWords.push({
        box: {
          x: (frameRect.left - origin.left) / k,
          y: (frameRect.top - origin.top) / k,
          w: frameRect.width / k,
          h: frameRect.height / k,
        },
        el: span,
        anchor: { x: (anchorRect.left - origin.left) / k, y: (anchorRect.top - origin.top) / k },
        shift: { x: 0, y: 0 },
        alpha: 1,
        tint: 0,
        hidden: false,
        size,
        baseline,
        xHeight: baseline - ctx.measureText("x").actualBoundingBoxAscent,
        capHeight: baseline - ctx.measureText("H").actualBoundingBoxAscent,
        left: Math.min(...own.map((g) => g.box.x1)),
        right: Math.max(...own.map((g) => g.box.x2)),
      });
    });

    // Rámeček bez textu: slovo s jedním prázdným „písmenem" přes celý prvek.
    // Výběr, rámeček, popisek i kurzor s ním pracují jako s každým jiným
    // slovem; kreslit není co.
    for (const el of frameOnly) {
      const r = el.getBoundingClientRect();
      const x = (r.left - origin.left) / k;
      const y = (r.top - origin.top) / k;
      const rw = r.width / k;
      const rh = r.height / k;
      const size = parseFloat(getComputedStyle(el).fontSize) || 16;
      biggest = Math.max(biggest, size);
      nextGlyphs.push({
        word: nextWords.length,
        char: "",
        x,
        baseline: y + rh,
        box: { x1: x, y1: y, x2: x + rw, y2: y + rh },
        ox: motionValue(0),
        oy: motionValue(0),
        outline: 0,
        fill: EMPTY_SPRITE(),
        dashes: EMPTY_SPRITE(),
        tinted: EMPTY_SPRITE(),
      });
      fonts.push({ font: "", ink: "" });
      nextWords.push({
        el,
        box: { x, y, w: r.width, h: r.height },
        anchor: { x, y },
        shift: { x: 0, y: 0 },
        alpha: 1,
        tint: 0,
        hidden: false,
        size,
        baseline: y + r.height,
        xHeight: y,
        capHeight: y,
        left: x,
        right: x + r.width,
      });
    }
    if (!nextGlyphs.length) return;

    // Plátno kryje celý nadpis s přesahem pro popisky a drobky.
    bleed = Math.round(biggest * settings.bleed);
    Object.assign(canvas.style, {
      left: `${-bleed}px`,
      top: `${-bleed}px`,
      width: `${width + bleed * 2}px`,
      height: `${height + bleed * 2}px`,
    });
    canvas.width = Math.round((width + bleed * 2) * dpr);
    canvas.height = Math.round((height + bleed * 2) * dpr);

    nextGlyphs.forEach((glyph, i) => {
      if (!glyph.char) return; // rámeček bez textu
      glyph.fill = sprite(glyph, fonts[i].font, fonts[i].ink, false);
      glyph.dashes = sprite(glyph, fonts[i].font, fonts[i].ink, true);
      if (settings.hoverTint) glyph.tinted = sprite(glyph, fonts[i].font, settings.hoverTint, false);
    });
    words = nextWords;
    glyphs = nextGlyphs;
    dragging = -1;
    frame.index = -1;
    look.index = -1;
    ready = true;
    // Slova se schovají, až je čím je nahradit — do té doby zůstávají vidět.
    root.dataset.live = "";
  };

  // Posun a krytí každého slova právě teď: řádky nadpisu při vstupu jedou
  // nahoru a prolínají se, plátno mimo ně by jinak stálo a svítilo dřív.
  const follow = () => {
    const origin = root.getBoundingClientRect();
    const k = zoomOf(origin);
    for (const word of words) {
      const r = word.el.getBoundingClientRect();
      word.shift.x = (r.left - origin.left) / k - word.anchor.x;
      word.shift.y = (r.top - origin.top) / k - word.anchor.y;
      let alpha = 1;
      for (let el: HTMLElement | null = word.el.parentElement; el && el !== root; el = el.parentElement) {
        alpha *= parseFloat(getComputedStyle(el).opacity) || 0;
      }

      // Předávka s TextMorph: během přechodu slovo kreslí WebGL a tady se
      // schová. Po přechodu (`settled`) se ukáže, až když je přeměřené nové
      // slovo — staré měření patří prvku, který už `data-measure` nemá.
      // Atribut se smaže tady, v tomtéž snímku, kdy se slovo zase kreslí;
      // TextMorph na to zhasne své plátno.
      // `hidden` je zvlášť od `alpha`: schová se jen písmo, rámeček kolem
      // slova (tlačítko) během přechodu zůstává.
      let hidden = false;
      const morph = word.el.closest<HTMLElement>("[data-morphing]");
      if (morph) {
        const fresh = word.el.hasAttribute("data-measure");
        if (morph.dataset.morphing === "settled" && fresh) delete morph.dataset.morphing;
        else hidden = true;
      }
      word.alpha = alpha;
      word.hidden = hidden;
    }
  };

  /* ---------- Vstup ---------- */

  // Box rámečku slova právě teď (měřené místo + posun).
  const wordBox = (word: Word) => ({
    x1: word.box.x + word.shift.x,
    y1: word.box.y + word.shift.y,
    x2: word.box.x + word.box.w + word.shift.x,
    y2: word.box.y + word.box.h + word.shift.y,
  });

  // Nejbližší písmeno k bodu, jinak -1.
  //  "glyph": do `settings.hit` px od inkoustu písmene (nadpis).
  //  "word":  bod musí ležet v rámečku slova (odkaz i s odsazením) — pak
  //           písmeno toho slova nejblíž vodorovně. Sedí to přesně na box,
  //           nad kterým se rozpadá kurzor.
  const glyphAt = (x: number, y: number) => {
    let inside = -1;
    if (settings.frame === "word") {
      inside = words.findIndex((word) => {
        if (word.alpha < 0.5) return false;
        const b = wordBox(word);
        return x >= b.x1 && x <= b.x2 && y >= b.y1 && y <= b.y2;
      });
      if (inside < 0) return -1;
    }
    let best = -1;
    let bestDistance = Infinity;
    glyphs.forEach((glyph, i) => {
      // Schované slovo (zrovna se přelévá) nejde chytit ani vybrat.
      // V režimu „glyph" ani přelévané slovo (obrys písmene by nebylo vidět);
      // v režimu „word" ano — rámeček kolem tlačítka má během přechodu zůstat.
      if (settings.frame === "glyph" && words[glyph.word].hidden) return;
      if (inside >= 0 && glyph.word !== inside) return;
      const x1 = glyph.box.x1 + dx(glyph);
      const x2 = glyph.box.x2 + dx(glyph);
      const y1 = glyph.box.y1 + dy(glyph);
      const y2 = glyph.box.y2 + dy(glyph);
      const ex = x < x1 ? x1 - x : x > x2 ? x - x2 : 0;
      const ey = inside >= 0 ? 0 : y < y1 ? y1 - y : y > y2 ? y - y2 : 0;
      const d = Math.hypot(ex, ey);
      if (d < bestDistance) {
        bestDistance = d;
        best = i;
      }
    });
    return inside >= 0 || bestDistance < settings.hit ? best : -1;
  };

  // Kam má rámeček (a kurzor) pro dané písmeno: jeho inkoust, nebo celé slovo.
  const targetBox = (glyph: Glyph) => {
    const pad = settings.framePad;
    if (settings.frame === "word") {
      const b = wordBox(words[glyph.word]);
      return { x1: b.x1 - pad, y1: b.y1 - pad, x2: b.x2 + pad, y2: b.y2 + pad };
    }
    return {
      x1: glyph.box.x1 + dx(glyph) - pad,
      y1: glyph.box.y1 + dy(glyph) - pad,
      x2: glyph.box.x2 + dx(glyph) + pad,
      y2: glyph.box.y2 + dy(glyph) + pad,
    };
  };

  const locate = (event: PointerEvent) => {
    const rect = root.getBoundingClientRect();
    const k = zoomOf(rect);
    pointer.x = (event.clientX - rect.left) / k;
    pointer.y = (event.clientY - rect.top) / k;
  };

  // Vlna od šťouchnutého písmene po jeho slově: sousedé dostanou slabší
  // kopanec o kus později.
  const kick = (index: number) => {
    const word = glyphs[index].word;
    const strength = words[word].size * settings.kick;
    const push = (i: number, velocity: number, delay: number) => {
      const glyph = glyphs[i];
      if (!glyph || glyph.word !== word) return;
      track(animate(glyph.oy, 0, spring(glyph.oy.getVelocity() - velocity, delay)));
    };
    push(index, strength, 0);
    for (let d = 1; d < glyphs.length; d++) {
      const velocity = strength * Math.pow(KICK_DECAY, d);
      if (velocity < 30) break;
      push(index - d, velocity, d * 0.055);
      push(index + d, velocity, d * 0.055);
    }
  };

  const onMove = (event: PointerEvent) => {
    locate(event);
    pointer.inside = true;
    if (dragging >= 0) {
      const glyph = glyphs[dragging];
      glyph.ox.set(pointer.x - grab.x);
      glyph.oy.set(pointer.y - grab.y);
    }
  };
  const onLeave = () => {
    if (dragging < 0) pointer.inside = false;
  };
  const onDown = (event: PointerEvent) => {
    locate(event);
    pointer.inside = true;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const index = glyphAt(pointer.x, pointer.y);
    Object.assign(press, { x: pointer.x, y: pointer.y, time: performance.now(), index });
    if (settings.draggable && index >= 0) {
      const glyph = glyphs[index];
      glyph.ox.stop();
      glyph.oy.stop();
      dragging = index;
      grab.x = pointer.x - glyph.ox.get();
      grab.y = pointer.y - glyph.oy.get();
      root.setPointerCapture?.(event.pointerId);
    }
  };
  const onUp = (event: PointerEvent) => {
    if (dragging >= 0) {
      // Puštěné písmeno se vrací pružinou a nese si rychlost z ruky.
      const glyph = glyphs[dragging];
      track(animate(glyph.ox, 0, spring(glyph.ox.getVelocity())));
      track(animate(glyph.oy, 0, spring(glyph.oy.getVelocity())));
      dragging = -1;
      root.releasePointerCapture?.(event.pointerId);
      const rect = root.getBoundingClientRect();
      pointer.inside =
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom;
    }
    // Krátké kliknutí bez tažení = šťouchnutí.
    if (
      event.type === "pointerup" &&
      press.index >= 0 &&
      settings.clickKick &&
      performance.now() - press.time < 450
    ) {
      const rect = root.getBoundingClientRect();
      const k = zoomOf(rect);
      const moved = Math.hypot((event.clientX - rect.left) / k - press.x, (event.clientY - rect.top) / k - press.y);
      if (moved < 6) kick(press.index);
    }
    press.index = -1;
  };

  root.addEventListener("pointermove", onMove, { passive: true });
  root.addEventListener("pointerenter", onMove, { passive: true });
  root.addEventListener("pointerdown", onDown, { passive: true });
  root.addEventListener("pointerup", onUp, { passive: true });
  root.addEventListener("pointercancel", onUp, { passive: true });
  root.addEventListener("pointerleave", onLeave, { passive: true });

  /* ---------- Samostatný pohled ---------- */

  // Oko čtenáře: většinou o písmeno dál, občas o dvě nebo zpět, občas skok
  // do jiného slova, občas chvíli nikam.
  const lookOn = () => {
    const pace = settings.sweepPace;
    if (look.index >= 0 && Math.random() < pace.glance) {
      look.index = -1;
      look.next = pulse + between(pace.gap);
      // Pauza: nic není vybrané — chvíle pro výměnu slov (TextMorph).
      events.onGlance?.();
      return;
    }
    // Vybírá se jen z viditelných slov (přelévané je schované).
    const shown = (g: Glyph) => words[g.word].alpha >= 0.5 && !words[g.word].hidden;
    const here = glyphs[look.index];
    if (here && shown(here) && Math.random() < pace.stay) {
      const same = glyphs.map((g, i) => (g.word === here.word ? i : -1)).filter((i) => i >= 0);
      const at = same.indexOf(look.index);
      const roll = Math.random();
      const step = roll < 0.6 ? 1 : roll < 0.75 ? 2 : -1;
      look.index = same[at + step] ?? same[Math.floor(Math.random() * same.length)];
    } else {
      const others = words
        .map((_, w) => w)
        .filter((w) => w !== here?.word && words[w].alpha >= 0.5 && !words[w].hidden);
      const target = others.length ? others[Math.floor(Math.random() * others.length)] : 0;
      const pool = glyphs.map((g, i) => (g.word === target && shown(g) ? i : -1)).filter((i) => i >= 0);
      look.index = pool[Math.floor(Math.random() * pool.length)] ?? -1;
    }
    look.next = pulse + between(pace.dwell);
  };

  /* ---------- Kreslení ---------- */

  const blit = (art: Sprite, x: number, y: number) => {
    if (art.width) ctx.drawImage(art.image, art.left + x, art.top + y, art.width, art.height);
  };

  const perimeterPoint = (distance: number, w: number, h: number): [number, number, number, number] => {
    const p = 2 * (w + h);
    let d = ((distance % p) + p) % p;
    if (d < w) return [frame.x1 + d, frame.y1, 0, -1];
    d -= w;
    if (d < h) return [frame.x2, frame.y1 + d, 1, 0];
    d -= h;
    if (d < w) return [frame.x2 - d, frame.y2, 0, 1];
    d -= w;
    return [frame.x1, frame.y2 - d, -1, 0];
  };

  const dot = (x: number, y: number, radius: number) => {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  };

  // Drobky kolem rámečku: kulaté tečky a křížky, které naskočí, blikne
  // a zmizí; po obvodu k tomu běží dvě tečky s ocáskem.
  const drawSpecks = (a: number) => {
    const w = frame.x2 - frame.x1;
    const h = frame.y2 - frame.y1;
    if (w < 2 || h < 2) return;
    const perimeter = 2 * (w + h);
    const seed = frame.index + 1;
    const s = settings.markScale;
    ctx.fillStyle = settings.markColor;
    ctx.strokeStyle = settings.markColor;
    ctx.lineWidth = 1;

    for (let k = 0; k < settings.specks; k++) {
      const period = 0.5 + noise(seed, k, 11) * 1.2;
      const t = pulse / period + noise(seed, k, 17);
      const cycle = Math.floor(t);
      const life = t - cycle;
      if (life > 0.7) continue;
      const [px, py, nx, ny] = perimeterPoint(noise(seed, k, cycle) * perimeter, w, h);
      const pick = noise(seed, k, cycle, 2);
      // Menší drobky tečkami, ale ne pod 1 px — pod tím by zmizely.
      const r = Math.max(0.8, (pick < 0.5 ? 1 : pick < 0.8 ? 1.5 : pick < 0.93 ? 2.5 : 4) * s);
      const out = (6 + Math.floor(noise(seed, k, cycle, 1) * 5) * 3) * s;
      const x = px + nx * out;
      const y = py + ny * out;
      const tone = noise(seed, k, cycle, 3);
      const blink = life < 0.06 || (life > 0.32 && life < 0.36) ? 0.35 : 1;
      ctx.globalAlpha = a * (0.3 + 0.55 * tone) * blink;
      if (tone < 0.3) {
        // Křížek — značka měření.
        const arm = r + 1.5 * s;
        ctx.beginPath();
        ctx.moveTo(x - arm, y);
        ctx.lineTo(x + arm, y);
        ctx.moveTo(x, y - arm);
        ctx.lineTo(x, y + arm);
        ctx.stroke();
      } else {
        dot(x, y, r);
      }
    }

    for (let j = 0; j < 2; j++) {
      const head = (pulse * 0.42 * settings.speed + j * 0.5) * perimeter;
      for (let i = 0; i < 4; i++) {
        const [x, y] = perimeterPoint(head - i * 6 * s, w, h);
        ctx.globalAlpha = a * [0.95, 0.55, 0.32, 0.16][i];
        dot(x, y, Math.max(0.8, (i === 0 ? 1.6 : 1.1) * s));
      }
    }
    ctx.globalAlpha = 1;
  };

  const drawFrame = () => {
    const glyph = glyphs[frame.index];
    if (!glyph || frame.alpha < 0.01) return;
    const a = frame.alpha * words[glyph.word].alpha;
    const ox = glyph.ox.get();
    const oy = glyph.oy.get();
    const moved = Math.hypot(ox, oy);
    const ink = getInk(glyph);

    ctx.strokeStyle = settings.markColor;
    ctx.fillStyle = settings.markColor;
    ctx.lineWidth = 1;

    // Odtažené písmeno: čárkovaná stopa od domova a kroužek na místě, kam patří.
    if (moved > 1) {
      const hx = (glyph.box.x1 + glyph.box.x2) / 2 + words[glyph.word].shift.x;
      const hy = (glyph.box.y1 + glyph.box.y2) / 2 + words[glyph.word].shift.y;
      ctx.globalAlpha = 0.45 * a;
      ctx.setLineDash([2, 4]);
      ctx.beginPath();
      ctx.moveTo(hx, hy);
      ctx.lineTo(hx + ox, hy + oy);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 0.8 * a;
      ctx.beginPath();
      ctx.arc(hx, hy, 3, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Tenký čárkovaný rámeček.
    ctx.globalAlpha = 0.4 * a;
    ctx.setLineDash([3, 3]);
    ctx.strokeRect(frame.x1, frame.y1, frame.x2 - frame.x1, frame.y2 - frame.y1);
    ctx.setLineDash([]);

    // Rohy. Když je myš nad písmenem, kreslí je kurzor (rozpadne se do nich),
    // takže tady jen při samostatném pohledu.
    if (!hovering()) {
      ctx.fillStyle = ink;
      ctx.globalAlpha = a;
      for (const [cx, cy] of [
        [frame.x1, frame.y1],
        [frame.x2, frame.y1],
        [frame.x2, frame.y2],
        [frame.x1, frame.y2],
      ]) {
        dot(cx, cy, Math.max(1.5, 3 * settings.markScale));
      }
      ctx.fillStyle = settings.markColor;
    }

    if (settings.specks > 0) drawSpecks(a);

    if (!settings.labels) return;
    const s = settings.markScale;
    ctx.font = labelFont;
    ctx.textAlign = "left";
    const below = settings.labelSide === "bottom";
    ctx.textBaseline = below ? "top" : "bottom";
    ctx.globalAlpha = 0.75 * a;
    // Slovo měří celý rámeček (rozměr odkazu), písmeno svůj inkoust.
    const label =
      moved > 1
        ? `${signed(Math.round(ox))} · ${signed(Math.round(-oy))} PX`
        : settings.frame === "word"
          ? `${Math.round(frame.x2 - frame.x1)} × ${Math.round(frame.y2 - frame.y1)} PX`
          : `${glyph.char} · ${Math.round(glyph.box.x2 - glyph.box.x1)} × ${Math.round(glyph.box.y2 - glyph.box.y1)} PX`;
    if ("letterSpacing" in ctx) ctx.letterSpacing = `${1.5 * s}px`;
    ctx.fillText(label, frame.x1, below ? frame.y2 + 7 * s : frame.y1 - 9 * s);
    if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
    ctx.globalAlpha = 1;
  };

  // Typografická vodítka přes slovo s výběrem: účaří, střední výška, verzálky.
  const drawGuides = (alpha: number, word: Word) => {
    const pad = Math.max(12, word.size * 0.12);
    const x1 = word.left - pad + word.shift.x;
    const x2 = word.right + pad + word.shift.x;
    ctx.strokeStyle = settings.markColor;
    ctx.fillStyle = settings.markColor;
    ctx.lineWidth = 1;
    ctx.font = labelFont;
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    const a = alpha * word.alpha;
    for (const [y, label] of [
      [word.baseline, "účaří"],
      [word.xHeight, "střední výška"],
      [word.capHeight, "verzálky"],
    ] as const) {
      const ly = y + word.shift.y;
      ctx.globalAlpha = a * 0.35;
      ctx.setLineDash([1, 4]);
      ctx.beginPath();
      ctx.moveTo(x1, ly);
      ctx.lineTo(x2, ly);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = a * 0.7;
      dot(x1, ly, 1.5);
      dot(x2, ly, 1.5);
      ctx.fillText(label.toUpperCase(), x2 + 8, ly);
    }
    ctx.globalAlpha = 1;
  };

  // Barva písmene = barva jeho slova (čte se z jeho sprite při měření).
  const inks = new WeakMap<Glyph, string>();
  const getInk = (glyph: Glyph) => {
    let ink = inks.get(glyph);
    if (!ink) {
      ink = settings.ink ?? getComputedStyle(words[glyph.word].el.parentElement ?? root).color;
      inks.set(glyph, ink);
    }
    return ink;
  };

  // Myš je nad některým písmenem (ne jen někde nad nadpisem).
  let hoverIndex = -1;
  const hovering = () => hoverIndex >= 0 || dragging >= 0;

  const tick = (dt: number) => {
    if (!ready || destroyed) return;
    dt = Math.min(0.05, Math.max(0.001, dt));
    pulse += dt;
    follow();

    // Myš: výběr jede za ní s malým zpožděním, ať nepřeskakuje na každý pixel.
    if (pointer.inside) {
      if (!placed) {
        lens.x = pointer.x;
        lens.y = pointer.y;
      }
      lens.x = approach(lens.x, pointer.x, dt, 0.05);
      lens.y = approach(lens.y, pointer.y, dt, 0.05);
    }
    placed = pointer.inside;
    hoverIndex = pointer.inside ? glyphAt(lens.x, lens.y) : -1;

    // Samostatný pohled jen bez myši nad písmeny. Po jejím odchodu chvíli
    // počká, než se zase rozhlédne.
    if (hovering() || !sweepOn) {
      look.index = -1;
      look.next = pulse + between(settings.sweepPace.gap);
    } else if (pulse >= look.next) {
      lookOn();
    }

    focus = dragging >= 0 ? dragging : hovering() ? hoverIndex : look.index;
    // Samostatný pohled je pomalý a líný, myš svižná.
    const pace = hovering() ? null : settings.sweepPace;

    if (focus >= 0 && settings.selection) {
      const glyph = glyphs[focus];
      const { x1: bx1, y1: by1, x2: bx2, y2: by2 } = targetBox(glyph);
      if (frame.index < 0 || frame.alpha < 0.02) {
        Object.assign(frame, { x1: bx1, y1: by1, x2: bx2, y2: by2 });
      } else if (focus !== frame.index) {
        // Nové písmeno: k sousedovi rámeček doklouže, do jiného slova přejede
        // pomaleji — je to delší cesta.
        const jump = glyphs[frame.index]?.word !== glyph.word;
        frame.glide = !pace ? 0.08 : jump ? pace.travel : pace.glide;
      }
      const glide = focus === dragging ? 0.02 : frame.glide;
      frame.x1 = approach(frame.x1, bx1, dt, glide);
      frame.y1 = approach(frame.y1, by1, dt, glide);
      frame.x2 = approach(frame.x2, bx2, dt, glide);
      frame.y2 = approach(frame.y2, by2, dt, glide);
      frame.index = focus;
    }
    frame.alpha = approach(frame.alpha, focus >= 0 && settings.selection ? 1 : 0, dt, pace?.fade ?? 0.1);
    guideAlpha = approach(guideAlpha, settings.guides && focus >= 0 ? 1 : 0, dt, 0.14);

    glyphs.forEach((glyph, i) => {
      const target = settings.letterOutline && i === focus && i !== dragging ? 1 : 0;
      glyph.outline = approach(glyph.outline, target, dt, pace?.fade ?? 0.09);
    });

    // Přebarvení celého slova pod myší (menu): slovo zezelená naráz, ne po písmenech.
    if (settings.hoverTint) {
      const tinted = hovering() && focus >= 0 ? glyphs[focus].word : -1;
      words.forEach((word, w) => {
        word.tint = approach(word.tint, w === tinted ? 1 : 0, dt, 0.12);
      });
    }

    root.style.cursor =
      dragging >= 0
        ? "grabbing"
        : hoverIndex >= 0 && settings.draggable
          ? "grab"
          : hoverIndex >= 0 && settings.clickKick
            ? "pointer"
            : "";

    // Plátno v souřadnicích kořene: bod (0, 0) je levý horní roh nadpisu.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, bleed * dpr, bleed * dpr);

    // Duchové odtažených písmen na jejich místě.
    for (const glyph of glyphs) {
      const moved = Math.hypot(glyph.ox.get(), glyph.oy.get());
      const shift = words[glyph.word].shift;
      if (moved > 1) {
        ctx.globalAlpha = Math.min(1, moved / 24) * 0.55 * words[glyph.word].alpha;
        blit(glyph.dashes, shift.x, shift.y);
      }
    }
    const focused = glyphs[frame.index];
    if (guideAlpha > 0.005 && focused) drawGuides(guideAlpha, words[focused.word]);
    for (const glyph of glyphs) {
      const alpha = words[glyph.word].alpha;
      if (alpha <= 0.001 || words[glyph.word].hidden) continue;
      const x = dx(glyph);
      const y = dy(glyph);
      // Pod obrysem zůstane část plného písma (`outlineFill`) — u malého
      // písma menu by samotné tečky text rozpustily.
      const fill = 1 - glyph.outline * (1 - settings.outlineFill);
      if (fill > 0.001) {
        ctx.globalAlpha = fill * alpha;
        blit(glyph.fill, x, y);
      }
      // Barva slova se pokládá PŘES plné písmeno, ne místo něj: prolnutí dvou
      // poloprůhledných kopií by na hranách písmen na okamžik zesláblo.
      const tint = words[glyph.word].tint;
      if (tint > 0.001 && fill > 0.001) {
        ctx.globalAlpha = tint * fill * alpha;
        blit(glyph.tinted, x, y);
      }
      if (glyph.outline > 0.001) {
        ctx.globalAlpha = glyph.outline * alpha;
        blit(glyph.dashes, x, y);
      }
    }
    ctx.globalAlpha = 1;
    drawFrame();
  };

  const focusRect = (): SnapRect | null => {
    const glyph = glyphs[hovering() ? focus : -1];
    if (!glyph || !settings.selection) return null;
    const origin = root.getBoundingClientRect();
    const k = zoomOf(origin);
    const b = targetBox(glyph);
    return {
      left: origin.left + b.x1 * k,
      top: origin.top + b.y1 * k,
      right: origin.left + b.x2 * k,
      bottom: origin.top + b.y2 * k,
    };
  };

  // Nové měření při změně velikosti, písma (next/font dorazí později) a textu.
  const resizeObserver = new ResizeObserver(measure);
  resizeObserver.observe(root);
  let pending = false;
  const textObserver = new MutationObserver(() => {
    if (pending) return;
    pending = true;
    queueMicrotask(() => {
      pending = false;
      measure();
    });
  });
  // `data-measure` se stěhuje mezi slovy TextMorph — to je taky nový text.
  textObserver.observe(root, {
    subtree: true,
    characterData: true,
    childList: true,
    attributes: true,
    attributeFilter: ["data-measure"],
  });
  document.fonts?.ready.then(measure).catch(() => {});
  // Po načtení stránky ještě jednou — v devu přicházejí styly modulů pozdě.
  if (document.readyState !== "complete") window.addEventListener("load", measure, { once: true });
  measure();

  return {
    measure,
    tick,
    focusRect,
    setSweep: (on: boolean) => {
      const next = settings.sweep && on;
      // Po zapnutí chvíli počkat — `start` jako po načtení.
      if (next && !sweepOn) look.next = pulse + settings.sweepPace.start;
      sweepOn = next;
    },
    destroy: () => {
      destroyed = true;
      resizeObserver.disconnect();
      textObserver.disconnect();
      window.removeEventListener("load", measure);
      motions.forEach((motion) => motion.stop());
      root.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerenter", onMove);
      root.removeEventListener("pointerdown", onDown);
      root.removeEventListener("pointerup", onUp);
      root.removeEventListener("pointercancel", onUp);
      root.removeEventListener("pointerleave", onLeave);
      root.style.cursor = "";
      delete root.dataset.live;
    },
  };
}
