// Obrysová verze prvku na canvasu — pro hover loga.
//
// Obrázek (podpis „S"): vykreslí se do skrytého plátna, z pixelů se nechají
// jen ty na kraji tvaru a vnitřní půjdou na průhlednost 0. Kraj se ještě
// rozseká na tečky, aby obrys vypadal jako tečkovaný obrys písmen v nadpisu
// (MeasureText). Barvy pixelů zůstávají — podpis je pořád limetkový.
//
// Text (`data-outline`): každé písmeno se nakreslí jen tečkovaným obrysem,
// v barvě `textColor`. Poloha písmen se čte z DOMu (Range), písmo
// z computed stylu — stejně jako v MeasureText.
//
// Obojí se připraví jednou (a znovu při změně velikosti nebo písma) do
// jednoho plátna; hover pak jen mění jeho krytí.

export type OutlineSettings = {
  /** Od jaké průhlednosti (0–255) je pixel obrázku „uvnitř" tvaru. */
  threshold: number;
  /** Šířka okraje, který z tvaru zůstane (CSS px). */
  edge: number;
  /** Tečkování okraje obrázku: [tečka, mezera] v CSS px; `null` = plný okraj. */
  imageDots: [number, number] | null;
  /** Barva obrysu textu. */
  textColor: string;
  /** Tloušťka obrysu textu, resp. průměr jeho teček (CSS px). */
  textDot: number;
  /** Rozestup teček obrysu textu (CSS px); 0 = plná linka. */
  textGap: number;
  /** Přesah plátna kolem prvku (CSS px). */
  bleed: number;
};

export type Outline = {
  build: () => void;
  /** Krytí obrysové verze 0–1. */
  draw: (progress: number) => void;
  destroy: () => void;
};

const segment = (value: string) =>
  typeof Intl === "undefined" || typeof Intl.Segmenter === "undefined"
    ? Array.from(value)
    : Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(value), (p) => p.segment);

/**
 * Obrázek → plátno jen s okrajovými pixely tvaru. Vnitřní pixely mají
 * průhlednost 0, okrajové si drží svou barvu. Velikost `w × h` je v CSS px,
 * plátno má `w·dpr × h·dpr`. `null`, když obrázek není načtený nebo je
 * z cizí domény bez CORS (pixely nejdou přečíst).
 *
 * Sdílené s preloaderem (src/motion/logo-intro.ts), který obrys loga kreslí.
 */
export function edgeCanvas(
  img: HTMLImageElement,
  cssW: number,
  cssH: number,
  dpr: number,
  settings: Pick<OutlineSettings, "threshold" | "edge" | "imageDots">,
): HTMLCanvasElement | null {
  const w = Math.round(cssW * dpr);
  const h = Math.round(cssH * dpr);
  if (!w || !h || !img.complete || !img.naturalWidth) return null;
  const scratch = document.createElement("canvas");
  scratch.width = w;
  scratch.height = h;
  const sctx = scratch.getContext("2d", { willReadFrequently: true });
  if (!sctx) return null;
  sctx.drawImage(img, 0, 0, w, h);
  let pixels: ImageData;
  try {
    pixels = sctx.getImageData(0, 0, w, h);
  } catch {
    // Obrázek z cizí domény bez CORS — plátno je „zašpiněné", pixely nečitelné.
    return null;
  }
  const src = pixels.data;
  const out = new ImageData(w, h);
  const dst = out.data;
  const band = Math.max(1, Math.round(settings.edge * dpr));
  const inside = (px: number, py: number) =>
    px >= 0 && py >= 0 && px < w && py < h && src[(py * w + px) * 4 + 3] > settings.threshold;
  const [on, off] = settings.imageDots ?? [1, 0];
  const period = on + off;

  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      if (!inside(px, py)) continue;
      // Okraj = uvnitř tvaru, ale do `band` px od něčeho venku.
      let edge = false;
      for (let dy = -band; dy <= band && !edge; dy++) {
        for (let dx = -band; dx <= band; dx++) {
          if (dx * dx + dy * dy > band * band) continue;
          if (!inside(px + dx, py + dy)) {
            edge = true;
            break;
          }
        }
      }
      if (!edge) continue;
      // Tečkování: šikmé pruhy přes celý obrázek rozsekají okraj na
      // krátké úseky — na křivkách podpisu z nich jsou tečky.
      if (settings.imageDots && ((px + py) / dpr) % period >= on) continue;
      const i = (py * w + px) * 4;
      dst[i] = src[i];
      dst[i + 1] = src[i + 1];
      dst[i + 2] = src[i + 2];
      dst[i + 3] = src[i + 3];
    }
  }
  sctx.putImageData(out, 0, 0);
  return scratch;
}

export function createOutline(target: HTMLElement, canvas: HTMLCanvasElement, settings: OutlineSettings): Outline | null {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // Hotová obrysová verze celého prvku; kreslí se z ní jen s jiným krytím.
  const art = document.createElement("canvas");
  const actx = art.getContext("2d", { willReadFrequently: true });
  if (!actx) return null;

  let dpr = 1;
  let ready = false;
  let destroyed = false;
  let last = 0;

  // Obrázek → jen okrajové pixely (sdílený helper níž).
  const outlineImage = (img: HTMLImageElement, x: number, y: number) => {
    const edges = edgeCanvas(img, img.offsetWidth, img.offsetHeight, dpr, settings);
    if (edges) actx.drawImage(edges, Math.round(x * dpr), Math.round(y * dpr));
  };

  // Text → tečkovaný obrys písmen na jejich místech v DOMu.
  const outlineText = (span: HTMLElement, origin: DOMRect) => {
    const node = span.firstChild;
    if (!(node instanceof Text)) return;
    const style = getComputedStyle(span);
    const size = parseFloat(style.fontSize) || 16;
    const lang = document.documentElement.lang || undefined;
    actx.save();
    actx.setTransform(dpr, 0, 0, dpr, settings.bleed * dpr, settings.bleed * dpr);
    actx.font = `${style.fontStyle} ${style.fontWeight} ${size}px ${style.fontFamily}`;
    actx.textBaseline = "alphabetic";
    actx.textAlign = "left";
    const metrics = actx.measureText("Hg");
    const ascent = metrics.fontBoundingBoxAscent || size * 0.8;
    const descent = metrics.fontBoundingBoxDescent || size * 0.2;
    actx.strokeStyle = settings.textColor;
    // U malého písma tenčí linka — 1 px kolem 16px slova by ho jen ztučnil
    // místo obrysu. Plná tloušťka od 24 px výš.
    actx.lineWidth = settings.textDot * Math.min(1, Math.max(0.55, size / 24));
    actx.lineCap = "round";
    actx.lineJoin = "round";
    // Mezera 0 = plná linka; jinak nulové čárky s kulatým koncem = tečky.
    actx.setLineDash(settings.textGap > 0 ? [0, settings.textGap] : []);
    let index = 0;
    for (const part of segment(node.data)) {
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
      actx.strokeText(char, r.left - origin.left, r.top - origin.top + (r.height * ascent) / (ascent + descent));
    }
    actx.restore();
  };

  const build = () => {
    if (destroyed) return;
    ready = false;
    const w = target.offsetWidth;
    const h = target.offsetHeight;
    if (!w || !h) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const b = settings.bleed;
    Object.assign(canvas.style, {
      left: `${-b}px`,
      top: `${-b}px`,
      width: `${w + b * 2}px`,
      height: `${h + b * 2}px`,
    });
    canvas.width = art.width = Math.round((w + b * 2) * dpr);
    canvas.height = art.height = Math.round((h + b * 2) * dpr);
    actx.clearRect(0, 0, art.width, art.height);

    const origin = target.getBoundingClientRect();
    for (const img of Array.from(target.querySelectorAll("img"))) {
      const r = img.getBoundingClientRect();
      outlineImage(img, r.left - origin.left + b, r.top - origin.top + b);
    }
    for (const span of Array.from(target.querySelectorAll<HTMLElement>("[data-outline]"))) {
      outlineText(span, origin);
    }
    ready = true;
    draw(last);
  };

  const draw = (progress: number) => {
    last = progress;
    if (!ready) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (progress <= 0.001) return;
    ctx.globalAlpha = Math.min(1, progress);
    ctx.drawImage(art, 0, 0);
    ctx.globalAlpha = 1;
  };

  // Přestavět při změně velikosti, po načtení obrázku a písma.
  const resize = new ResizeObserver(build);
  resize.observe(target);
  const images = Array.from(target.querySelectorAll("img"));
  images.forEach((img) => img.addEventListener("load", build));
  document.fonts?.ready.then(build).catch(() => {});
  build();

  return {
    build,
    draw,
    destroy: () => {
      destroyed = true;
      resize.disconnect();
      images.forEach((img) => img.removeEventListener("load", build));
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    },
  };
}
