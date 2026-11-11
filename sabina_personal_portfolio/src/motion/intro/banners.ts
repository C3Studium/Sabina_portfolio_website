// Bannery v úvodu — vpravo v heru, pod nadpisem, tam, kde se pak objeví
// portrét. Dva náhodně vybrané bannery z projektů se postaví s přesností
// jako logo: ořezové značky → rámeček s rozměrem → mřížka a kóty → banner
// sám se STAVÍ PO VRSTVÁCH jako v grafickém editoru (layered.ts: skica,
// výplň, pozpátku ven; rozklad z tools/banner-layers). Banner bez rozkladu
// dostane náhradní rastr z teček a obraz. Kolem nich slova a tvary ze
// sazby (pero, kruh, čtverec, trojúhelník…), každý připojený vynášecí
// linkou k banneru. Odcházejí s druhým přelitím nadpisu.
//
// Kreslí se na vlastní plátno přes panel hera (souřadnice okna se
// převádějí na plátno), hodiny sdílí s oponou (clock.ts).

import {
  at,
  clamp01,
  dot,
  easeOut,
  fontFamily,
  frame,
  guide,
  label,
  lerp,
  linear,
  pad,
  random,
  rectOf,
  stage,
  type Box,
  type Look,
  type Pt,
} from "./draw";
import { createLayered, loadLayers, type Layered } from "./layered";
import { BANNERS } from "./timeline";
import { viewFrame } from "@/lib/fluid";
import { SNOW } from "@/lib/palette";

/* ---------- Nastavení ---------- */

const SETTINGS = {
  // Výšky bannerů (část výšky okna) a mezera mezi nimi (px).
  heights: [0.56, 0.43],
  gutter: 28,
  // Krytí obrazu banneru — ztlumené, stojí za portrétem. Popisky, rámečky,
  // slova a tvary kolem mají plné krytí (výrazné detaily, tlumený obraz).
  alpha: 0.4,
};

// Běžné poměry stran pro popisek; jinak se vypíše desetinně.
const RATIOS: [number, string][] = [
  [9 / 16, "9 : 16"],
  [4 / 5, "4 : 5"],
  [2 / 3, "2 : 3"],
  [3 / 4, "3 : 4"],
  [1, "1 : 1"],
];
const ratioLabel = (aspect: number) =>
  RATIOS.find(([value]) => Math.abs(value - aspect) / value < 0.03)?.[1] ?? aspect.toFixed(2);

/** Slova ze sazby — vybere se jich pár náhodně. */
const WORDS = ["Aa", "Kerning", "Baseline", "Grid", "CMYK", "300 DPI", "Bleed 3 mm", "Layout", "Branding", "#BEC948", "Typografie", "Vizuál"];
const SHAPES = ["circle", "square", "triangle", "pen"] as const;
type ShapeKind = (typeof SHAPES)[number];

type Banner = {
  box: Box;
  image: HTMLImageElement | null;
  halftone: HTMLCanvasElement | null;
  layered: Layered | null;
  start: number;
  end: number;
};

/** Banner pro úvod: `src` z CMS/seedu (podle něj se hledá rozklad), `url` k načtení. */
export type BannerSource = { src: string; url: string };

type Item =
  | { kind: "word"; text: string; size: number; weight: number; accent: boolean; box: Box; anchor: Pt; start: number; out: number }
  | { kind: ShapeKind; box: Box; anchor: Pt; start: number; out: number; turn: number };

// Rastr z teček: světlá místa obrázku = velké tečky. Jednou při rozvržení.
const halftoneOf = (img: HTMLImageElement, box: Box, dpr: number) => {
  if (!img.complete || !img.naturalWidth) return null;
  const cell = 6;
  const cols = Math.max(1, Math.floor(box.w / cell));
  const rows = Math.max(1, Math.floor(box.h / cell));
  const sample = document.createElement("canvas");
  sample.width = cols;
  sample.height = rows;
  const sctx = sample.getContext("2d", { willReadFrequently: true });
  if (!sctx) return null;
  sctx.drawImage(img, 0, 0, cols, rows);
  let data: Uint8ClampedArray;
  try {
    data = sctx.getImageData(0, 0, cols, rows).data;
  } catch {
    return null;
  }
  const out = document.createElement("canvas");
  out.width = Math.round(box.w * dpr);
  out.height = Math.round(box.h * dpr);
  const octx = out.getContext("2d");
  if (!octx) return null;
  octx.scale(dpr, dpr);
  octx.fillStyle = SNOW;
  const sx = box.w / cols;
  const sy = box.h / rows;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = (y * cols + x) * 4;
      const lum = (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
      const r = (cell / 2) * 0.9 * Math.sqrt(lum);
      if (r < 0.35) continue;
      dot(octx, (x + 0.5) * sx, (y + 0.5) * sy, r);
    }
  }
  return out;
};

const overlaps = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const inside = (a: Box, b: Box) => a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h;
const closest = (b: Box, [x, y]: Pt): Pt => [Math.min(Math.max(x, b.x), b.x + b.w), Math.min(Math.max(y, b.y), b.y + b.h)];
const center = (b: Box): Pt => [b.x + b.w / 2, b.y + b.h / 2];

export type BannersOptions = {
  /**
   * Levý okraj pole pro slova a tvary (část šířky okna). Bez něj 15 % okna
   * vlevo od bannerů, nejméně však od 45 % (hero).
   */
  fieldLeft?: number;
  /** Společná spodní linka bannerů (část výšky okna). Bez ní 0,8 (hero). */
  baseline?: number;
  /** Výšky bannerů × tohle (1 = SETTINGS.heights). */
  scale?: number;
  /**
   * Bannery přes rám (část šířky okna), vystředěné v něm — místo šířky
   * portrétu (×1,15) a středu na něm. Na výšku jako pozadí celé obrazovky.
   */
  across?: number;
};

export function createBanners(
  canvas: HTMLCanvasElement,
  area: HTMLElement,
  sources: BannerSource[],
  look: Look,
  options: BannersOptions = {},
) {
  const ctx = canvas.getContext("2d");
  if (!ctx || !sources.length) return null;

  // Náhoda pro celý úvod: které bannery, slova, tvary a kde. Rozmístění
  // má vlastní semínko — po změně velikosti okna vyjde stejně.
  const seed = Math.floor(Math.random() * 2 ** 32);
  const rng = random(seed);
  const shuffle = <T,>(list: T[], next = rng) => [...list].sort(() => next() - 0.5);
  const picked = shuffle(sources).slice(0, 2);
  const images = picked.map(({ url }) => {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    return img;
  });
  // Rozklad na vrstvy (když ho banner má) — přehrávač vznikne, až je
  // načtený obraz i mapa. `whenReady`: oba bannery jsou připravené (nebo
  // vypršel čas) — do té doby se stavba nespouští, ať nezačne náhradou.
  const players: (Layered | null)[] = picked.map(() => null);
  const aspects: (number | null)[] = picked.map(() => null);
  let stopped = false;
  const loaded = (img: HTMLImageElement) =>
    new Promise<void>((resolve) => {
      if (img.complete && img.naturalWidth) return resolve();
      img.addEventListener("load", () => resolve(), { once: true });
      img.addEventListener("error", () => resolve(), { once: true });
    });
  const settled = picked.map(({ src }, i) =>
    Promise.all([loaded(images[i]), loadLayers(src)]).then(([, found]) => {
      if (stopped) return;
      if (found && images[i].naturalWidth) {
        aspects[i] = found.data.aspect;
        players[i] = createLayered(images[i], found.map, found.data, look);
      }
      layoutBanners();
    }),
  );
  const whenReady = Promise.race([
    Promise.all(settled).then(() => undefined),
    new Promise<void>((resolve) => window.setTimeout(resolve, 3000)),
  ]);
  const words = shuffle(WORDS).slice(0, 4);
  const shapes = shuffle([...SHAPES]).slice(0, 3);

  let dpr = 1;
  let origin: Pt = [0, 0];
  let banners: Banner[] = [];
  let items: Item[] = [];
  let last = -1;

  const layout = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const own = canvas.getBoundingClientRect();
    origin = [own.left, own.top];
    canvas.width = Math.round(own.width * dpr);
    canvas.height = Math.round(own.height * dpr);
    layoutBanners();
    if (placed) placeItems();
    if (last >= 0) draw(last);
  };

  // Dva bannery vedle sebe, spodky na společné lince, každý ve svém poměru
  // stran (z rozkladu nebo z načteného obrázku; do té doby 9 : 16). Když už
  // banner běží, jeho box se nemění — přeskočil by.
  const layoutBanners = () => {
    // Výška rámu obsahu (strop 1440px) — portrét, ke kterému bannery stojí,
    // je 94 % jeho výšky.
    const vh = viewFrame().h;
    const region = rectOf(area);
    if (!region.w || !region.h) {
      banners = [];
      return;
    }
    const aspectOf = (i: number) =>
      aspects[i] ?? (images[i].naturalWidth ? images[i].naturalWidth / images[i].naturalHeight : 9 / 16);
    let heights = images.map((_, i) => vh * SETTINGS.heights[i] * (options.scale ?? 1));
    let widths = heights.map((h, i) => h * aspectOf(i));
    const gaps = SETTINGS.gutter * (images.length - 1);
    const total = () => widths.reduce((a, b) => a + b, 0) + gaps;
    const frame = viewFrame();
    const room = options.across !== undefined ? frame.w * options.across : region.w * 1.15;
    if (total() > room) {
      const k = (room - gaps) / (total() - gaps);
      heights = heights.map((h) => h * k);
      widths = widths.map((w) => w * k);
    }
    const base = vh * (options.baseline ?? 0.8);
    let x = options.across !== undefined ? frame.x + (frame.w - total()) / 2 : region.x + (region.w - total()) / 2;
    const previous = banners;
    banners = images.map((image, i) => {
      const box = { x, y: base - heights[i], w: widths[i], h: heights[i] };
      x += widths[i] + SETTINGS.gutter;
      const [start, end] = BANNERS.lives[i];
      if (last >= start && previous[i]) return { ...previous[i], layered: players[i] ?? previous[i].layered };
      return { box, image, halftone: halftoneOf(image, box, dpr), layered: players[i], start, end };
    });
  };

  // Písmo nadpisu (zhruba inkoust řádků) — slova a tvary se mu vyhnou.
  const headlineBoxes = () => {
    const h1 = document.querySelector("main h1");
    if (!h1) return [];
    const boxes: Box[] = [];
    const walker = document.createTreeWalker(h1, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.textContent?.trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const r of Array.from(range.getClientRects())) {
        boxes.push({ x: r.left, y: r.top + r.height * 0.16, w: r.width, h: r.height * 0.68 });
      }
    }
    // Další prvky, kterým se slova a tvary vyhnou (nápověda posunu).
    for (const el of Array.from(document.querySelectorAll("[data-intro-avoid]"))) boxes.push(rectOf(el));
    return boxes;
  };

  // Slova a tvary náhodně kolem bannerů, nepřekrývají se ani nadpis.
  // Rozmísťují se až těsně před svým vstupem — řádky nadpisu na začátku
  // ještě vyjíždějí a jejich poloha by nebyla konečná.
  let placed = false;
  const placeItems = () => {
    placed = true;
    items = [];
    const region = rectOf(area);
    if (!banners.length || !region.w) return;
    // Rám obsahu (strop 2560 × 1440, lib/fluid).
    const frame = viewFrame();
    const vw = frame.w;
    const vh = frame.h;
    const rnd = random(seed ^ 0x9e3779b9);
    const left =
      options.fieldLeft !== undefined
        ? frame.x + vw * options.fieldLeft
        : Math.max(frame.x + vw * 0.45, region.x - vw * 0.15);
    const field: Box = { x: left, y: frame.y + 100, w: 0, h: vh - 100 - 30 };
    field.w = frame.x + vw - 20 - field.x;
    const taken = [...banners.map((b) => pad(b.box, 22)), ...headlineBoxes()];
    const place = (w: number, h: number): Box | null => {
      for (let tries = 0; tries < 60; tries++) {
        const box = { x: field.x + rnd() * (field.w - w), y: field.y + rnd() * (field.h - h), w, h };
        if (!inside(box, field) || taken.some((other) => overlaps(pad(box, 14), other))) continue;
        taken.push(box);
        return box;
      }
      return null;
    };
    const anchorFor = (box: Box): Pt => {
      // Vynášecí linka k nejbližšímu banneru.
      const c = center(box);
      let best: Pt = c;
      let dist = Infinity;
      for (const b of banners) {
        const p = closest(b.box, c);
        const d = Math.hypot(p[0] - c[0], p[1] - c[1]);
        if (d < dist) {
          dist = d;
          best = p;
        }
      }
      return best;
    };
    const order = shuffle([...words.map((w) => ({ word: w })), ...shapes.map((s) => ({ shape: s }))], rnd);
    order.forEach((entry, i) => {
      const start = BANNERS.glyphsStart + i * BANNERS.glyphStagger;
      const out = BANNERS.glyphsOut + i * BANNERS.glyphOutStagger;
      if ("word" in entry) {
        const size = Math.round(13 + rnd() * 9);
        const weight = rnd() < 0.5 ? 300 : 500;
        ctx.font = `${weight} ${size}px ${fontFamily()}`;
        const w = ctx.measureText(entry.word).width;
        const box = place(w, size * 1.1);
        if (box) {
          items.push({ kind: "word", text: entry.word, size, weight, accent: rnd() < 0.3, box, anchor: anchorFor(box), start, out });
        }
      } else {
        const s = Math.round(34 + rnd() * 26);
        const box = place(s, s);
        if (box) items.push({ kind: entry.shape, box, anchor: anchorFor(box), start, out, turn: rnd() < 0.5 ? 0 : Math.PI / 4 });
      }
    });
  };

  // Ořezové značky kolem rohů.
  const cropMarks = (box: Box, p: number, a: number) => {
    if (p <= 0.001 || a <= 0.001) return;
    const gap = lerp(22, 6, p);
    const arm = 12;
    ctx.strokeStyle = look.mark;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.75 * a * p;
    ctx.beginPath();
    for (const [cx, cy, sx, sy] of [
      [box.x, box.y, -1, -1],
      [box.x + box.w, box.y, 1, -1],
      [box.x + box.w, box.y + box.h, 1, 1],
      [box.x, box.y + box.h, -1, 1],
    ]) {
      ctx.moveTo(cx + sx * gap, cy);
      ctx.lineTo(cx + sx * (gap + arm), cy);
      ctx.moveTo(cx, cy + sy * gap);
      ctx.lineTo(cx, cy + sy * (gap + arm));
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  };

  const drawBanner = (t: number, banner: Banner, index: number) => {
    const { box, start, end } = banner;
    // Fáze života banneru 0–1.
    const u = (t - start) / (end - start);
    if (u <= 0 || u >= 1) return;
    const leave = 1 - stage(u, BANNERS.frameOut);
    const marks = stage(u, BANNERS.marks) * leave;
    const frameIn = stage(u, BANNERS.frame);
    const frameA = leave;
    const grid = stage(u, BANNERS.grid) * (1 - stage(u, BANNERS.gridOut));
    const raster = linear(u, BANNERS.halftone);
    const rasterA = 1 - stage(u, BANNERS.image) * 0.85;
    const rasterOut = 1 - stage(u, BANNERS.halftoneOut);
    const image = stage(u, BANNERS.image) * (1 - stage(u, BANNERS.imageOut));

    cropMarks(box, marks, 1);

    // Mřížka: třetiny a ochranný okraj; bez obrázku i křížek „místo pro obraz".
    if (grid > 0.001) {
      const m = box.w * 0.08;
      ctx.strokeStyle = look.mark;
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 4]);
      ctx.globalAlpha = 0.4 * grid;
      ctx.beginPath();
      for (const f of [1 / 3, 2 / 3]) {
        ctx.moveTo(box.x + box.w * f, box.y);
        ctx.lineTo(box.x + box.w * f, box.y + box.h * grid);
        ctx.moveTo(box.x, box.y + box.h * f);
        ctx.lineTo(box.x + box.w * grid, box.y + box.h * f);
      }
      ctx.rect(box.x + m, box.y + m, (box.w - m * 2) * grid, box.h - m * 2);
      ctx.moveTo(box.x, box.y);
      ctx.lineTo(box.x + box.w * grid, box.y + box.h * grid);
      ctx.moveTo(box.x + box.w, box.y);
      ctx.lineTo(box.x + box.w * (1 - grid), box.y + box.h * grid);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }

    // Po vrstvách (rozklad), nebo náhradou rastr a obraz.
    if (banner.layered) {
      banner.layered.draw(ctx, box, u, dpr, SETTINGS.alpha);
    } else if (raster > 0.001 && rasterOut > 0.001 && banner.halftone) {
      // Rastr z teček, odhalovaný shora — hrana skenu je zelená linka.
      const edge = box.h * (raster * rasterOut);
      ctx.save();
      ctx.beginPath();
      ctx.rect(box.x, box.y, box.w, edge);
      ctx.clip();
      ctx.globalAlpha = 0.3 * rasterA;
      ctx.drawImage(banner.halftone, box.x, box.y, box.w, box.h);
      ctx.restore();
      if (raster < 1 || rasterOut < 1) {
        ctx.globalAlpha = 0.9;
        ctx.strokeStyle = look.accent;
        ctx.beginPath();
        ctx.moveTo(box.x - 6, box.y + edge);
        ctx.lineTo(box.x + box.w + 6, box.y + edge);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    // Plný obraz (náhrada) — tlumeně, ať nadpis přes něj zůstane čitelný.
    if (!banner.layered && image > 0.001 && banner.image?.complete && banner.image.naturalWidth) {
      ctx.globalAlpha = SETTINGS.alpha * image;
      ctx.drawImage(banner.image, box.x, box.y, box.w, box.h);
      ctx.globalAlpha = 1;
    }

    // Rámeček s rozměrem nad bannerem.
    frame(ctx, box, frameIn, frameA, look, 2.5);
    const settled = clamp01((frameIn - 0.8) / 0.2) * frameA;
    const layerCount = banner.layered ? ` · ${banner.layered.count} VRSTEV` : "";
    label(ctx, `${ratioLabel(box.w / box.h)} · ${Math.round(box.w)} × ${Math.round(box.h)} PX${layerCount}`, box.x, box.y - 8, 0.95 * settled, look.mark, 9, "bottom");
    label(ctx, String(index + 1).padStart(2, "0"), box.x + box.w, box.y - 8, 0.95 * settled, look.accent, 9, "bottom", "right");

    // Kóta výšky vlevo od prvního banneru.
    if (index === 0 && grid > 0.001) {
      const x = box.x - 14;
      const half = (box.h / 2) * grid;
      const cy = box.y + box.h / 2;
      ctx.strokeStyle = look.mark;
      ctx.globalAlpha = 0.6 * grid;
      ctx.beginPath();
      ctx.moveTo(x, cy - half);
      ctx.lineTo(x, cy + half);
      ctx.moveTo(x - 3, box.y);
      ctx.lineTo(x + 3, box.y);
      ctx.moveTo(x - 3, box.y + box.h);
      ctx.lineTo(x + 3, box.y + box.h);
      ctx.stroke();
      ctx.save();
      ctx.translate(x - 5, cy);
      ctx.rotate(-Math.PI / 2);
      label(ctx, `${Math.round(box.h)} PX`, 0, 0, 0.7 * grid, look.mark, 8, "bottom", "center");
      ctx.restore();
      ctx.globalAlpha = 1;
    }
  };

  // Společná linka spodků a kóta mezery mezi bannery.
  const drawShared = (t: number) => {
    if (banners.length < 2) return;
    const [a, b] = banners;
    const ua = (t - a.start) / (a.end - a.start);
    const ub = (t - b.start) / (b.end - b.start);
    const p = stage(ub, BANNERS.grid) * (1 - stage(ua, BANNERS.gridOut));
    if (p <= 0.001) return;
    const y = a.box.y + a.box.h;
    const x0 = a.box.x - 30;
    const x1 = b.box.x + b.box.w + 30;
    guide(ctx, x0, y, x1, y, p, 0.4, look.accent, [3, 3]);
    const gy = b.box.y + b.box.h * 0.25;
    const gx0 = a.box.x + a.box.w;
    const gx1 = b.box.x;
    ctx.strokeStyle = look.mark;
    ctx.globalAlpha = 0.7 * p;
    ctx.beginPath();
    ctx.moveTo(gx0, gy);
    ctx.lineTo(gx1, gy);
    ctx.moveTo(gx0, gy - 3);
    ctx.lineTo(gx0, gy + 3);
    ctx.moveTo(gx1, gy - 3);
    ctx.lineTo(gx1, gy + 3);
    ctx.stroke();
    ctx.globalAlpha = 1;
    label(ctx, `${Math.round(gx1 - gx0)}`, (gx0 + gx1) / 2, gy - 4, 0.7 * p, look.mark, 8, "bottom", "center");
  };

  const drawShape = (item: Exclude<Item, { kind: "word" }>, p: number, a: number) => {
    const { box } = item;
    const [cx, cy] = center(box);
    const r = box.w / 2;
    ctx.strokeStyle = look.mark;
    ctx.fillStyle = look.accent;
    ctx.lineWidth = 1;
    ctx.globalAlpha = a;
    const pathOf = (pts: Pt[]) => {
      // Lomená čára nakreslená do `p` své délky.
      const lens = pts.slice(1).map((q, i) => Math.hypot(q[0] - pts[i][0], q[1] - pts[i][1]));
      let left = lens.reduce((x, y) => x + y, 0) * p;
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length && left > 0; i++) {
        const u = Math.min(1, left / lens[i - 1]);
        ctx.lineTo(lerp(pts[i - 1][0], pts[i][0], u), lerp(pts[i - 1][1], pts[i][1], u));
        left -= lens[i - 1];
      }
      ctx.stroke();
    };
    const polygon = (n: number, turn: number): Pt[] => {
      const pts: Pt[] = [];
      for (let i = 0; i <= n; i++) {
        const ang = turn - Math.PI / 2 + (i / n) * Math.PI * 2;
        pts.push([cx + Math.cos(ang) * r, cy + Math.sin(ang) * r]);
      }
      return pts;
    };
    if (item.kind === "circle") {
      ctx.beginPath();
      ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p);
      ctx.stroke();
      ctx.setLineDash([2, 3]);
      ctx.globalAlpha = 0.5 * a * p;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + r * p, cy);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = a * p;
      dot(ctx, cx, cy, 1.6);
      label(ctx, `R ${Math.round(r)}`, cx + 4, cy - 3, 0.9 * a * p, look.mark, 7, "bottom");
    } else if (item.kind === "square" || item.kind === "triangle") {
      const n = item.kind === "square" ? 4 : 3;
      const pts = polygon(n, item.kind === "square" ? Math.PI / 4 + item.turn : 0);
      pathOf(pts);
      ctx.globalAlpha = a;
      pts.slice(0, Math.floor(p * n) + 1).slice(0, n).forEach(([x, y]) => dot(ctx, x, y, 1.8));
      // Těžiště a vodítka k vrcholům.
      ctx.setLineDash([1, 3]);
      ctx.globalAlpha = 0.35 * a * p;
      ctx.beginPath();
      pts.slice(0, n).forEach(([x, y]) => {
        ctx.moveTo(cx, cy);
        ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.setLineDash([]);
    } else {
      // Pero: křivka s úchyty jako v editoru.
      const p0: Pt = [box.x, box.y + box.h * 0.75];
      const p3: Pt = [box.x + box.w, box.y + box.h * 0.25];
      const c1: Pt = [box.x + box.w * 0.45, box.y + box.h * 1.05];
      const c2: Pt = [box.x + box.w * 0.55, box.y - box.h * 0.05];
      const steps = 40;
      const pts: Pt[] = [];
      for (let i = 0; i <= steps; i++) {
        const u = i / steps;
        const v = 1 - u;
        pts.push([
          v * v * v * p0[0] + 3 * v * v * u * c1[0] + 3 * v * u * u * c2[0] + u * u * u * p3[0],
          v * v * v * p0[1] + 3 * v * v * u * c1[1] + 3 * v * u * u * c2[1] + u * u * u * p3[1],
        ]);
      }
      pathOf(pts);
      ctx.globalAlpha = 0.5 * a * p;
      ctx.beginPath();
      ctx.moveTo(p0[0], p0[1]);
      ctx.lineTo(c1[0], c1[1]);
      ctx.moveTo(p3[0], p3[1]);
      ctx.lineTo(c2[0], c2[1]);
      ctx.stroke();
      ctx.globalAlpha = a;
      ctx.strokeRect(c1[0] - 2, c1[1] - 2, 4, 4);
      ctx.strokeRect(c2[0] - 2, c2[1] - 2, 4, 4);
      dot(ctx, p0[0], p0[1], 2);
      if (p > 0.98) dot(ctx, p3[0], p3[1], 2);
    }
    ctx.globalAlpha = 1;
  };

  const drawItem = (t: number, item: Item) => {
    const s = item.start;
    if (t < s) return;
    const a = 1 - stage(t, at(item.out, 0, 0.35));
    if (a <= 0.001) return;
    // Vynášecí linka od banneru k prvku, s tečkami na koncích.
    const lead = stage(t, at(s, 0, 0.3));
    const end = closest(pad(item.box, 6), item.anchor);
    guide(ctx, item.anchor[0], item.anchor[1], end[0], end[1], lead, 0.75 * a, look.mark, [1, 3]);
    ctx.fillStyle = look.accent;
    ctx.globalAlpha = a;
    dot(ctx, item.anchor[0], item.anchor[1], 1.8);
    if (lead > 0.98) dot(ctx, end[0], end[1], 1.4);
    ctx.globalAlpha = 1;

    if (item.kind === "word") {
      const box = pad(item.box, 5);
      frame(ctx, box, stage(t, at(s, 0.2, 0.5)), a * 0.8, look, 1.6);
      const font = `${item.weight} ${item.size}px ${fontFamily()}`;
      const baseline = item.box.y + item.size * 0.88;
      const outline = linear(t, at(s, 0.25, 0.6));
      const solid = stage(t, at(s, 0.55, 0.85));
      ctx.font = font;
      ctx.textBaseline = "alphabetic";
      ctx.textAlign = "left";
      if (outline > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(item.box.x - 2, item.box.y - item.size, (item.box.w + 4) * easeOut(outline), item.box.h + item.size * 2);
        ctx.clip();
        ctx.strokeStyle = item.accent ? look.accent : look.mark;
        ctx.lineWidth = 0.8;
        ctx.globalAlpha = 0.8 * a * (1 - solid);
        ctx.setLineDash([1, 1.6]);
        ctx.strokeText(item.text, item.box.x, baseline);
        ctx.setLineDash([]);
        ctx.restore();
      }
      ctx.globalAlpha = 0.9 * a * solid;
      ctx.fillStyle = item.accent ? look.accent : look.mark;
      ctx.fillText(item.text, item.box.x, baseline);
      ctx.globalAlpha = 1;
      label(ctx, `${item.size} PX · ${item.weight}`, box.x, box.y + box.h + 4, 0.9 * a * solid, look.mark, 7);
    } else {
      drawShape(item, stage(t, at(s, 0.2, 0.7)), a);
    }
  };

  const draw = (t: number) => {
    last = t;
    if (!placed && t >= BANNERS.glyphsStart - 0.05) placeItems();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, -origin[0] * dpr, -origin[1] * dpr);
    banners.forEach((banner, i) => drawBanner(t, banner, i));
    drawShared(t);
    items.forEach((item) => drawItem(t, item));
  };

  layout();
  // Obraz pro rastr se načte až po startu — pak se dopočítá jen rastr.
  const rasterize = () => {
    banners.forEach((banner) => {
      if (!banner.halftone && banner.image) banner.halftone = halftoneOf(banner.image, banner.box, dpr);
    });
  };
  images.forEach((img) => img.addEventListener("load", rasterize, { once: true }));
  window.addEventListener("resize", layout);

  return {
    draw,
    whenReady,
    destroy: () => {
      stopped = true;
      images.forEach((img) => img.removeEventListener("load", rasterize));
      players.forEach((player) => player?.destroy());
      window.removeEventListener("resize", layout);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    },
  };
}

