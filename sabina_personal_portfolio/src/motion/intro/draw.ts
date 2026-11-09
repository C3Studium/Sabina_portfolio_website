// Společné kreslení úvodu — měřicí jazyk webu (MeasureText) pro preloader.
// Rámečky (i lomené tvary), tečky, drobky, popisky a obrysy písmen; vše
// v CSS px (kontext má nastavené měřítko `dpr`).

export type Box = { x: number; y: number; w: number; h: number };
export type Span = [number, number];
export type Pt = [number, number];
export type Look = { accent: string; mark: string };

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
/** Postup úseku 0–1 s křivkou in-out. */
export const stage = (t: number, [a, b]: Span) => easeInOut(clamp01((t - a) / (b - a)));
/** Postup úseku 0–1 bez křivky. */
export const linear = (t: number, [a, b]: Span) => clamp01((t - a) / (b - a));
/** Úsek posunutý o `start` — `at(s, 0.1, 0.4)` = [s + 0.1, s + 0.4]. */
export const at = (start: number, a: number, b: number): Span => [start + a, start + b];

/** Deterministické „náhodné" číslo 0–1 ze vstupů — drobky bez uloženého stavu. */
export const noise = (...values: number[]) => {
  let h = 2166136261;
  for (const value of values) {
    h = Math.imul(h ^ (value | 0), 16777619);
    h ^= h >>> 13;
    h = Math.imul(h, 0x5bd1e995);
    h ^= h >>> 15;
  }
  return (h >>> 0) / 4294967296;
};

/** Náhoda s vlastním semínkem — každé načtení jiná, v rámci úvodu stálá. */
export const random = (seed: number) => {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
};

export const pad = (b: Box, px: number): Box => ({ x: b.x - px, y: b.y - px, w: b.w + px * 2, h: b.h + px * 2 });
export const lerpBox = (a: Box, b: Box, t: number): Box => ({
  x: lerp(a.x, b.x, t),
  y: lerp(a.y, b.y, t),
  w: lerp(a.w, b.w, t),
  h: lerp(a.h, b.h, t),
});
export const rectOf = (el: Element): Box => {
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
};

export const dot = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number) => {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
};

export const corners = (b: Box): Pt[] => [
  [b.x, b.y],
  [b.x + b.w, b.y],
  [b.x + b.w, b.y + b.h],
  [b.x, b.y + b.h],
];

export const boundsOf = (pts: Pt[]): Box => {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
};

export const lerpPoly = (a: Pt[], b: Pt[], t: number): Pt[] =>
  a.map(([x, y], i) => [lerp(x, b[i][0], t), lerp(y, b[i][1], t)]);

const perimeter = (pts: Pt[]) =>
  pts.reduce((sum, p, i) => {
    const q = pts[(i + 1) % pts.length];
    return sum + Math.hypot(q[0] - p[0], q[1] - p[1]);
  }, 0);

/**
 * Lomený obrys (po směru hodin) nakreslený jen do `p` (0–1) délky —
 * linka „obchází" tvar. Styl čáry nastavuje volající. Vrací počet vrcholů,
 * ke kterým už linka došla.
 */
export const tracePoly = (ctx: CanvasRenderingContext2D, pts: Pt[], p: number) => {
  const total = perimeter(pts);
  let left = total * clamp01(p);
  let reached = 1;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i <= pts.length && left > 0; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i % pts.length];
    const len = Math.hypot(x1 - x0, y1 - y0);
    const u = len ? Math.min(1, left / len) : 1;
    ctx.lineTo(lerp(x0, x1, u), lerp(y0, y1, u));
    left -= len;
    if (u >= 1 && i < pts.length) reached = i + 1;
  }
  ctx.stroke();
  return reached;
};

/** Bod na obvodu ve vzdálenosti `d` a vnější normála. */
const pointAt = (pts: Pt[], total: number, d: number): [number, number, number, number] => {
  let s = ((d % total) + total) % total;
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[(i + 1) % pts.length];
    const len = Math.hypot(x1 - x0, y1 - y0);
    if (s <= len && len > 0) {
      const u = s / len;
      // Po směru hodin (y dolů) je vnější normála (dy, -dx).
      return [lerp(x0, x1, u), lerp(y0, y1, u), (y1 - y0) / len, -(x1 - x0) / len];
    }
    s -= len;
  }
  return [pts[0][0], pts[0][1], 0, -1];
};

/** Čárkovaný obrys s tečkami ve vrcholech — postupně podle `p`, krytí `a`. */
export const framePoly = (
  ctx: CanvasRenderingContext2D,
  pts: Pt[],
  p: number,
  a: number,
  look: Look,
  dotSize = 2.5,
  /** Krytí čárkované linky (0–1, násobí se `a`). */
  lineAlpha = 0.55,
  lineWidth = 1,
) => {
  if (p <= 0.001 || a <= 0.001) return;
  ctx.globalAlpha = lineAlpha * a;
  ctx.strokeStyle = look.mark;
  ctx.lineWidth = lineWidth;
  ctx.setLineDash([3, 3]);
  const reached = tracePoly(ctx, pts, p);
  ctx.setLineDash([]);
  ctx.globalAlpha = a;
  ctx.fillStyle = look.accent;
  // Splývající vrcholy (obdélník přepsaný do lomeného tvaru) by kreslily
  // tečku dvakrát přes sebe — krytí by zhoustlo.
  let last: Pt | null = null;
  for (const pt of pts.slice(0, reached)) {
    if (last && Math.hypot(pt[0] - last[0], pt[1] - last[1]) < 0.5) continue;
    dot(ctx, pt[0], pt[1], dotSize);
    last = pt;
  }
  ctx.globalAlpha = 1;
};

export const frame = (ctx: CanvasRenderingContext2D, b: Box, p: number, a: number, look: Look, dotSize = 2.5) =>
  framePoly(ctx, corners(b), p, a, look, dotSize);

/** Drobky kolem obrysu a dvě obíhající tečky — jako u MeasureText. */
export const specks = (
  ctx: CanvasRenderingContext2D,
  shape: Box | Pt[],
  a: number,
  t: number,
  color: string,
  seed: number,
  count: number,
  scale = 1,
) => {
  if (a <= 0.001) return;
  const pts = Array.isArray(shape) ? shape : corners(shape);
  const per = perimeter(pts);
  if (per < 1) return;
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  for (let k = 0; k < count; k++) {
    const period = 0.5 + noise(seed, k, 11) * 1.2;
    const u = t / period + noise(seed, k, 17);
    const cycle = Math.floor(u);
    if (u - cycle > 0.7) continue;
    const [px, py, nx, ny] = pointAt(pts, per, noise(seed, k, cycle) * per);
    const out = (4 + Math.floor(noise(seed, k, cycle, 1) * 5) * 2.5) * scale;
    const r = (noise(seed, k, cycle, 2) < 0.6 ? 0.9 : 1.6) * scale;
    const x = px + nx * out;
    const y = py + ny * out;
    const tone = noise(seed, k, cycle, 3);
    ctx.globalAlpha = a * (0.3 + 0.55 * tone);
    if (tone < 0.3) {
      const arm = r + 1.2 * scale;
      ctx.beginPath();
      ctx.moveTo(x - arm, y);
      ctx.lineTo(x + arm, y);
      ctx.moveTo(x, y - arm);
      ctx.lineTo(x, y + arm);
      ctx.stroke();
    } else {
      dot(ctx, x, y, r);
    }
  }
  for (let j = 0; j < 2; j++) {
    const head = (t * 0.2 + j * 0.5) * per;
    for (let i = 0; i < 4; i++) {
      const [x, y] = pointAt(pts, per, head - i * 4);
      ctx.globalAlpha = a * [0.95, 0.55, 0.32, 0.16][i];
      dot(ctx, x, y, (i === 0 ? 1.2 : 0.9) * scale);
    }
  }
  ctx.globalAlpha = 1;
};

let bodyFont = "";
export const fontFamily = () => (bodyFont ||= getComputedStyle(document.body).fontFamily);

/** Popisek písmem webu, verzálky s prostrkáním. */
export const label = (
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  a: number,
  color: string,
  size = 9,
  baseline: CanvasTextBaseline = "top",
  align: CanvasTextAlign = "left",
) => {
  if (a <= 0.001) return;
  ctx.globalAlpha = a;
  ctx.fillStyle = color;
  ctx.font = `500 ${size}px ${fontFamily()}`;
  ctx.textBaseline = baseline;
  ctx.textAlign = align;
  if ("letterSpacing" in ctx) ctx.letterSpacing = `${size * 0.12}px`;
  ctx.fillText(text, x, y);
  if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
  ctx.textAlign = "left";
  ctx.globalAlpha = 1;
};

/** Čárkovaná linka z bodu do bodu, nakreslená do `p`. */
export const guide = (
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  p: number,
  a: number,
  color: string,
  dash: [number, number] = [2, 4],
) => {
  if (p <= 0.001 || a <= 0.001) return;
  ctx.globalAlpha = a;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.setLineDash(dash);
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(lerp(x0, x1, p), lerp(y0, y1, p));
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
};

/* ---------- Písmena z DOMu ---------- */

export type GlyphRun = { char: string; x: number; baseline: number; box: Box };
export type Glyphs = { runs: GlyphRun[]; font: string; size: number };

const segment = (value: string) =>
  typeof Intl === "undefined" || typeof Intl.Segmenter === "undefined"
    ? Array.from(value)
    : Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(value), (p) => p.segment);

/**
 * Písmena textového uzlu, jak je položil DOM (souřadnice okna), a písmo
 * pro canvas. `from`/`to` omezí úsek (indexy do `node.data`).
 */
export const glyphRuns = (
  ctx: CanvasRenderingContext2D,
  node: Text,
  from = 0,
  to = node.data.length,
): Glyphs | null => {
  const el = node.parentElement;
  if (!el) return null;
  const style = getComputedStyle(el);
  const size = parseFloat(style.fontSize) || 16;
  const font = `${style.fontStyle} ${style.fontWeight} ${size}px ${style.fontFamily}`;
  const lang = document.documentElement.lang || undefined;
  ctx.font = font;
  ctx.textBaseline = "alphabetic";
  if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
  const m = ctx.measureText("Hg");
  const asc = m.fontBoundingBoxAscent || size * 0.8;
  const desc = m.fontBoundingBoxDescent || size * 0.2;
  const runs: GlyphRun[] = [];
  let index = from;
  for (const part of segment(node.data.slice(from, to))) {
    const range = document.createRange();
    range.setStart(node, index);
    range.setEnd(node, index + part.length);
    index += part.length;
    if (!part.trim()) continue;
    const r = range.getBoundingClientRect();
    const char =
      style.textTransform === "uppercase"
        ? part.toLocaleUpperCase(lang)
        : style.textTransform === "lowercase"
          ? part.toLocaleLowerCase(lang)
          : part;
    runs.push({
      char,
      x: r.left,
      baseline: r.top + (r.height * asc) / (asc + desc),
      box: { x: r.left, y: r.top, w: r.width, h: r.height },
    });
  }
  return { runs, font, size };
};

/** První neprázdný textový uzel prvku. */
export const textNode = (el: Element | null) =>
  el ? (Array.from(el.childNodes).find((n): n is Text => n instanceof Text && !!n.data.trim()) ?? null) : null;

/** Box inkoustu písmen (skutečná kresba, ne řádek). */
export const inkBox = (ctx: CanvasRenderingContext2D, glyphs: Glyphs): Box | null => {
  if (!glyphs.runs.length) return null;
  ctx.font = glyphs.font;
  ctx.textBaseline = "alphabetic";
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const run of glyphs.runs) {
    const m = ctx.measureText(run.char);
    x0 = Math.min(x0, run.x - m.actualBoundingBoxLeft);
    x1 = Math.max(x1, run.x + m.actualBoundingBoxRight);
    y0 = Math.min(y0, run.baseline - m.actualBoundingBoxAscent);
    y1 = Math.max(y1, run.baseline + m.actualBoundingBoxDescent);
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
};

/**
 * Tečkovaný obrys písmen. `p` 0–1 je postup přes písmena (každé naskočí
 * o kus později — stagger), `a` krytí, `fade(i, n)` volitelné krytí
 * jednotlivých písmen (zhasínání po písmenech).
 */
export const strokeGlyphs = (
  ctx: CanvasRenderingContext2D,
  glyphs: Glyphs,
  p: number,
  a: number,
  color: string,
  dotSize: number,
  gap: number,
  fade?: (i: number, n: number) => number,
) => {
  if (p <= 0.001 || a <= 0.001 || !glyphs.runs.length) return;
  ctx.font = glyphs.font;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
  ctx.strokeStyle = color;
  ctx.lineWidth = dotSize;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.setLineDash([0, gap]);
  const n = glyphs.runs.length;
  glyphs.runs.forEach((run, i) => {
    const local = clamp01(p * (n + 2) - i);
    const alpha = a * easeOut(local) * (fade ? fade(i, n) : 1);
    if (alpha <= 0.001) return;
    ctx.globalAlpha = alpha;
    ctx.strokeText(run.char, run.x, run.baseline);
  });
  ctx.setLineDash([]);
  ctx.lineCap = "butt";
  ctx.globalAlpha = 1;
};

/* ---------- Vrstvy ---------- */

/** Jedna vrstva úvodu na společném plátně. */
export type Layer = {
  /** Přeměřit (start, resize). */
  layout(): void;
  /** Nakreslit čas `t` (s od startu úvodu). */
  draw(ctx: CanvasRenderingContext2D, t: number): void;
  /** Konec úvodu — všechno, co mělo naskočit, naskočí. */
  finish?(): void;
  destroy?(): void;
};

/**
 * Prvek hlavičky naskočí (`data-intro-in`). Do té doby ho CSS pod oponou
 * drží neviditelný — viz header/styles.module.scss.
 */
export const reveal = (el: Element | null | undefined) => {
  if (el && !el.hasAttribute("data-intro-in")) el.setAttribute("data-intro-in", "");
};
