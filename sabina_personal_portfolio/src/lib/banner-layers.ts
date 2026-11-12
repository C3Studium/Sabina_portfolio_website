// Rozklad banneru na vrstvy SESKUPENÉ jako ve Figmě.
//
// Surový rozklad (tools/banner-layers → public/assets/banners/layers) má
// každý řádek textu a každý tvar zvlášť — Gummylife má 11 textových vrstev.
// Tady se z nich staví vrstvy, jak je má grafik v souboru:
//   Nadpis      — největší text a řádky, které k němu patří
//   Podnadpis   — blok textu hned pod nadpisem
//   Logo        — malý text u horní hrany
//   Tlačítko    — popisek uvnitř malého tvaru, i s tím tvarem
//   Detaily     — ostatní drobný text dohromady
//   Objekty     — fotky / objekty (jeden → jeho název, víc → „Produkty")
//   Tvary       — zbylé tvary dohromady
//   Pozadí
//
// Odkud se vrstvy berou (splitGrouped dole): 3D vizuál ze Studia s vlastními
// vrstvami → hotový rozklad podle jména souboru → rozklad podle barev přímo
// v prohlížeči (pro jakýkoli nahraný obrázek).
//
// Rozklad se hledá i k obrázku nahranému do CMS (…/gummylife-banner1.png):
// podle jména se najde tentýž banner v public/assets/banners. Pixely se čtou
// z místního souboru (stejný původ — canvas se nezamkne).

import { loadLayers } from "@/motion/intro/layered";
import { groupLayers, type GroupKind, type LayerGroup } from "./banner-groups";

export type { GroupKind, LayerGroup } from "./banner-groups";
export type GroupedLayer = LayerGroup & { url: string };
export type GroupedSplit = { width: number; height: number; layers: GroupedLayer[] };

/** Místní banner k adrese (i k obrázku nahranému do CMS), nebo null. */
export function localBanner(src: string) {
  const local = src.match(/^\/assets\/banners\/([\w.-]+)\.(?:png|jpe?g|webp)$/i);
  if (local) return `/assets/banners/${local[1]}.png`;
  // Nahraný soubor: …/<hash>-gummylife-banner1.png → gummylife_banner1
  const uploaded = src.match(/([a-z]+)[-_]banner[-_]?(\d+)\.(?:png|jpe?g|webp)(?:\?.*)?$/i);
  return uploaded ? `/assets/banners/${uploaded[1].toLowerCase()}_banner${uploaded[2]}.png` : null;
}

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new window.Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

const cache = new Map<string, Promise<GroupedSplit | null>>();

/** Hotový rozklad (tools/banner-layers) seskupený jako ve Figmě, nebo null. */
function precomputed(local: string): Promise<GroupedSplit | null> {
  return (async (): Promise<GroupedSplit | null> => {
    const found = await loadLayers(local);
    if (!found) return null;
    const { data, map } = found;
    const image = await loadImage(local);
    const w = map.naturalWidth;
    const h = map.naturalHeight;
    const read = (source: CanvasImageSource) => {
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return null;
      ctx.drawImage(source, 0, 0, w, h);
      return ctx.getImageData(0, 0, w, h);
    };
    const mapData = read(map);
    const imgData = read(image);
    if (!mapData || !imgData) return null;
    const groups = groupLayers(data.layers);
    // Index surové vrstvy → skupina.
    const owner = new Int16Array(256).fill(-1);
    groups.forEach((group, g) => group.members.forEach((m) => (owner[m] = g)));
    const outs = groups.map(() => new ImageData(w, h));
    for (let p = 0; p < mapData.data.length; p += 4) {
      const g = owner[mapData.data[p]];
      if (g < 0) continue;
      const out = outs[g].data;
      out[p] = imgData.data[p];
      out[p + 1] = imgData.data[p + 1];
      out[p + 2] = imgData.data[p + 2];
      out[p + 3] = 255;
    }
    const layers: GroupedLayer[] = [];
    for (let g = 0; g < groups.length; g++) {
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d")?.putImageData(outs[g], 0, 0);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve));
      if (blob) layers.push({ ...groups[g], url: URL.createObjectURL(blob) });
    }
    return { width: data.width, height: data.height, layers };
  })().catch(() => null);
}

/* ------------------------------------------------------- 3D vizuály ---- */

// Vizuály ze Studia (typ `visual3d`, src/lib/site/study.ts). Stránka je
// zaregistruje (registerVisuals) a detail díla si vizuál najde podle souboru.
export type VisualLayerDef = { url: string; name: string; kind: GroupKind };
export type VisualDef = { src: string; width: number; height: number; layers: VisualLayerDef[] };

const visuals = new Map<string, VisualDef>();

/** Klíč souboru: jméno bez cesty a dotazu (nahrané soubory mají v názvu otisk). */
const fileKey = (src: string) => {
  try {
    return decodeURIComponent(src.split("?")[0].split("/").pop() ?? "").toLowerCase();
  } catch {
    return src.toLowerCase();
  }
};

/** Zaregistruje 3D vizuály stránky (opakované volání je v pořádku). */
export function registerVisuals(list: VisualDef[] | null | undefined) {
  for (const v of list ?? []) {
    const key = fileKey(v.src);
    const prev = visuals.get(key);
    if (prev && JSON.stringify(prev) === JSON.stringify(v)) continue;
    visuals.set(key, v);
    cache.delete(`manual:${key}`);
  }
}

const loadCross = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

/** Box neprůhledných pixelů (0–1), nebo celý obrázek, když se pixely číst nedají. */
const alphaBox = (img: HTMLImageElement): [number, number, number, number] => {
  const w = Math.min(img.naturalWidth, 400);
  const h = Math.max(1, Math.round((img.naturalHeight / img.naturalWidth) * w));
  try {
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return [0, 0, 1, 1];
    ctx.drawImage(img, 0, 0, w, h);
    const { data } = ctx.getImageData(0, 0, w, h);
    let x0 = w;
    let y0 = h;
    let x1 = -1;
    let y1 = -1;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        if (data[(y * w + x) * 4 + 3] < 16) continue;
        if (x < x0) x0 = x;
        if (y < y0) y0 = y;
        if (x > x1) x1 = x;
        if (y > y1) y1 = y;
      }
    if (x1 < 0) return [0, 0, 1, 1];
    return [x0 / w, y0 / h, (x1 - x0 + 1) / w, (y1 - y0 + 1) / h];
  } catch {
    return [0, 0, 1, 1];
  }
};

/** Vrstvy nahrané ve Studiu (odspodu nahoru). */
async function manualSplit(v: VisualDef): Promise<GroupedSplit | null> {
  const layers: GroupedLayer[] = [];
  for (const layer of v.layers) {
    const img = await loadCross(layer.url).catch(() => null);
    if (!img) continue;
    layers.push({ name: layer.name, kind: layer.kind, members: [], box: alphaBox(img), url: layer.url });
  }
  return layers.length ? { width: v.width, height: v.height, layers } : null;
}

/* ------------------------------------------------- rozklad automaticky -- */

// Obrázek bez hotového rozkladu se rozloží podle barev přímo v prohlížeči:
// k-means na zmenšené kopii → každý pixel do nejbližší barvy → vrstva na
// barvu. Pozadí = barva, která nejvíc sahá na okraje; ostatní odzadu podle
// plochy. Dohromady pokryjí celý obrázek, takže složené vypadají jako celek.
const AUTO = { clusters: 5, sample: 140, maxSide: 1600, rounds: 10 };

async function autoSplit(src: string): Promise<GroupedSplit | null> {
  const img = await loadCross(src);
  const scale = Math.min(1, AUTO.maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const read = (cw: number, ch: number) => {
    const canvas = document.createElement("canvas");
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, cw, ch);
    return ctx.getImageData(0, 0, cw, ch); // Bez CORS hodí výjimku → null výš.
  };
  const sw = AUTO.sample;
  const sh = Math.max(1, Math.round((h / w) * sw));
  const small = read(sw, sh);
  const full = read(w, h);
  if (!small || !full) return null;

  // k-means: start „nejvzdálenější barvy" (deterministicky), pak pár kol.
  const px: number[][] = [];
  for (let p = 0; p < small.data.length; p += 4) if (small.data[p + 3] > 16) px.push([small.data[p], small.data[p + 1], small.data[p + 2]]);
  if (!px.length) return null;
  const dist = (a: number[], b: number[]) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
  const centers: number[][] = [px[0].slice()];
  while (centers.length < AUTO.clusters) {
    let best = px[0];
    let bestD = -1;
    for (const p of px) {
      const d = Math.min(...centers.map((c) => dist(p, c)));
      if (d > bestD) {
        bestD = d;
        best = p;
      }
    }
    centers.push(best.slice());
  }
  const k = centers.length;
  for (let round = 0; round < AUTO.rounds; round++) {
    const sum = centers.map(() => [0, 0, 0, 0]);
    for (const p of px) {
      let bi = 0;
      let bd = Infinity;
      for (let c = 0; c < k; c++) {
        const d = dist(p, centers[c]);
        if (d < bd) {
          bd = d;
          bi = c;
        }
      }
      sum[bi][0] += p[0];
      sum[bi][1] += p[1];
      sum[bi][2] += p[2];
      sum[bi][3] += 1;
    }
    sum.forEach((s, c) => {
      if (s[3]) centers[c] = [s[0] / s[3], s[1] / s[3], s[2] / s[3]];
    });
  }

  // Každý pixel plné velikosti do nejbližší barvy.
  const label = new Uint8Array(w * h);
  const count = new Array(k).fill(0);
  const edge = new Array(k).fill(0);
  const box = centers.map(() => [w, h, -1, -1]);
  const d = full.data;
  for (let i = 0, p = 0; i < w * h; i++, p += 4) {
    let bi = 0;
    let bd = Infinity;
    for (let c = 0; c < k; c++) {
      const cc = centers[c];
      const dd = (d[p] - cc[0]) ** 2 + (d[p + 1] - cc[1]) ** 2 + (d[p + 2] - cc[2]) ** 2;
      if (dd < bd) {
        bd = dd;
        bi = c;
      }
    }
    label[i] = bi;
    count[bi]++;
    const x = i % w;
    const y = (i / w) | 0;
    if (x === 0 || y === 0 || x === w - 1 || y === h - 1) edge[bi]++;
    const b = box[bi];
    if (x < b[0]) b[0] = x;
    if (y < b[1]) b[1] = y;
    if (x > b[2]) b[2] = x;
    if (y > b[3]) b[3] = y;
  }

  const used = centers.map((_, c) => c).filter((c) => count[c] > 0);
  const background = used.reduce((a, b) => (edge[b] > edge[a] ? b : a), used[0]);
  const rest = used.filter((c) => c !== background).sort((a, b) => count[b] - count[a]);
  const order = [background, ...rest];

  const layers: GroupedLayer[] = [];
  for (let j = 0; j < order.length; j++) {
    const c = order[j];
    const out = new ImageData(w, h);
    for (let i = 0, p = 0; i < w * h; i++, p += 4) {
      if (label[i] !== c) continue;
      out.data[p] = d[p];
      out.data[p + 1] = d[p + 1];
      out.data[p + 2] = d[p + 2];
      out.data[p + 3] = d[p + 3];
    }
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")?.putImageData(out, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve));
    if (!blob) continue;
    const b = box[c];
    const last = j === order.length - 1 && j > 1;
    layers.push({
      name: j === 0 ? "Pozadí" : j === 1 ? "Hlavní plocha" : last ? "Detaily" : `Barva ${j}`,
      kind: j === 0 ? "background" : last ? "text" : "shape",
      members: [],
      box: [b[0] / w, b[1] / h, (b[2] - b[0] + 1) / w, (b[3] - b[1] + 1) / h],
      url: URL.createObjectURL(blob),
    });
  }
  return layers.length ? { width: img.naturalWidth, height: img.naturalHeight, layers } : null;
}

/* ------------------------------------------------------------- vstup ---- */

const once = (key: string, run: () => Promise<GroupedSplit | null>) => {
  const hit = cache.get(key);
  if (hit) return hit;
  const job = run().catch(() => null);
  cache.set(key, job);
  return job;
};

/**
 * Obrázek rozložený na vrstvy (PNG s alfou na vrstvu), nebo null:
 *   1. 3D vizuál ze Studia s nahranými vrstvami,
 *   2. hotový rozklad (tools/banner-layers) podle jména souboru,
 *   3. rozklad podle barev v prohlížeči.
 */
export function splitGrouped(src: string): Promise<GroupedSplit | null> {
  const manual = visuals.get(fileKey(src));
  if (manual?.layers.length) return once(`manual:${fileKey(src)}`, () => manualSplit(manual));
  const local = localBanner(src);
  if (local) return once(local, async () => (await precomputed(local)) ?? (await autoSplit(src)));
  return once(`auto:${src}`, () => autoSplit(src));
}
