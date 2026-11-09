// Rozklad bannerů na vrstvy pro úvod webu — spouští se ručně, jednou na
// obrázek (ne při buildu, ne na serveru):
//
//     cd tools/banner-layers && npm install && npm run analyze
//     npm run analyze -- ../../public/assets/banners/samurai_banner1.png
//
// Bez argumentů vezme bannery, které web opravdu ukazuje (seed projektů
// a záloha v heru). Modely (≈ 400 MB) se stáhnou při prvním běhu do .cache.
//
// Co se hledá — jako když grafik rozebírá hotový návrh na vrstvy:
//   text     PaddleOCR najde řádky (i velkou sazbu na fotce), Tesseract
//            (čeština) je přečte kvůli popiskům; pixely písma = Otsu v boxu
//   objekty  BiRefNet oddělí hlavní motiv od pozadí, DETR pojmenuje, co v něm
//            je (osoba, láhev, pes…), hloubka (Depth Anything) dořízne
//            objekty mimo motiv
//   tvary    zbytek se rozdělí podle barev (k-means), souvislé ploché
//            oblasti rozumné velikosti jsou tvary (tlačítka, odznaky, klíny)
//   pozadí   vše ostatní
//
// Výstup vedle bannerů, ve `public/assets/banners/layers/`:
//   <jméno>.png   mapa RGBA ve zmenšeném rozlišení:
//                   R = index vrstvy (pořadí stavby, 0 = pozadí)
//                   G = postup uvnitř vrstvy 0–255 (kdy se pixel objeví)
//                   B = síla linky pro skicu 0–255 (hrany + hranice vrstev)
//                   A = 255 (průhlednost by prohlížeč přednásobil a RGB zničil)
//   <jméno>.json  vrstvy: druh, popisek, box, průměrná barva

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import Ocr from "@gutenye/ocr-node";
import { createWorker } from "tesseract.js";
import { env, pipeline, RawImage } from "@huggingface/transformers";
import { blur3, components, edges, kmeans, nearest, otsu, rankNormalize } from "./lib/pixels.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const publicDir = path.join(root, "public");
const outDir = path.join(publicDir, "assets/banners/layers");
env.cacheDir = path.join(here, ".cache");

/* ---------- Nastavení ---------- */

const SETTINGS = {
  // Delší strana mapy vrstev (px). Banner je na webu ~500 px vysoký, při
  // dpr 2 tedy ~1000.
  mapSize: 1024,
  // Modely.
  saliencyModel: "onnx-community/BiRefNet_lite",
  depthModel: "onnx-community/depth-anything-v2-small",
  detectModel: "Xenova/detr-resnet-50",
  detectThreshold: 0.75,
  // Detekce přes víc než tuhle část plochy je spíš scéna než objekt.
  detectMaxArea: 0.45,
  // Nejmenší vrstvy (podíl plochy).
  minObject: 0.004,
  minShape: 0.0025,
  maxShape: 0.3,
  maxShapes: 6,
  // Kolik barev pro hledání tvarů a jak „plochá" musí oblast být.
  colors: 6,
  shapeFlatness: 26,
  shapeSolidity: 0.3,
  // Nejvíc vrstev (shader má pole pevné délky).
  maxLayers: 32,
};

// Popisky objektů česky (COCO → web). Co tu není, zůstane anglicky.
const CZ = {
  person: "osoba", bottle: "láhev", "wine glass": "sklenice", cup: "hrnek", dog: "pes", cat: "kočka",
  couch: "pohovka", chair: "židle", bed: "postel", laptop: "notebook", "cell phone": "telefon", book: "kniha",
  orange: "pomeranč", apple: "jablko", banana: "banán", "potted plant": "rostlina", "teddy bear": "plyšák",
  car: "auto", bicycle: "kolo", handbag: "kabelka", tie: "kravata", clock: "hodiny", vase: "váza",
  "dining table": "stůl", tv: "obrazovka", keyboard: "klávesnice", bowl: "miska", cake: "dort",
};

/* ---------- Vstup ---------- */

const defaults = () => {
  const sources = [path.join(root, "scripts/seed/projects.mjs"), path.join(root, "src/components/home/hero/index.tsx")];
  const found = new Set();
  for (const file of sources) {
    if (!fs.existsSync(file)) continue;
    for (const m of fs.readFileSync(file, "utf8").matchAll(/\/assets\/banners\/[\w.-]+\.(?:png|jpe?g|webp)/g)) found.add(m[0]);
  }
  return [...found].map((src) => path.join(publicDir, src));
};

const files = process.argv.slice(2).length ? process.argv.slice(2).map((f) => path.resolve(f)) : defaults();
fs.mkdirSync(outDir, { recursive: true });

/* ---------- Modely (jednou pro všechny obrázky) ---------- */

const log = (...args) => console.log(...args);
log(`Bannerů: ${files.length}. Načítám modely…`);
const saliency = await pipeline("background-removal", SETTINGS.saliencyModel, { dtype: "fp32" });
const depthEstimator = await pipeline("depth-estimation", SETTINGS.depthModel, { dtype: "fp32" });
const detector = await pipeline("object-detection", SETTINGS.detectModel, { dtype: "fp32" });
const paddle = await Ocr.create();
const tesseract = await createWorker(["ces", "eng"], 1, { cachePath: env.cacheDir });
await tesseract.setParameters({ tessedit_pageseg_mode: "7" });

const plain = (text) =>
  text.normalize("NFD").replace(/\p{M}/gu, "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const similar = (a, b) => {
  const x = plain(a);
  const y = plain(b);
  if (!x || !y) return 0;
  const d = Array.from({ length: x.length + 1 }, (_, i) => [i, ...Array(y.length).fill(0)]);
  for (let j = 1; j <= y.length; j++) d[0][j] = j;
  for (let i = 1; i <= x.length; i++)
    for (let j = 1; j <= y.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1));
  return 1 - d[x.length][y.length] / Math.max(x.length, y.length);
};

/* ---------- Jeden banner ---------- */

async function analyze(file) {
  const name = path.basename(file).replace(/\.\w+$/, "");
  const started = performance.now();
  const meta = await sharp(file).metadata();
  const scale = SETTINGS.mapSize / Math.max(meta.width, meta.height);
  const w = Math.round(meta.width * scale);
  const h = Math.round(meta.height * scale);
  const n = w * h;

  // Obrázek ve velikosti mapy (průhlednost na bílou — bannery jsou plné).
  const rgb = await sharp(file).flatten({ background: "#ffffff" }).resize(w, h, { fit: "fill" }).raw().toBuffer();
  const luma = new Float32Array(n);
  for (let i = 0; i < n; i++) luma[i] = (0.2126 * rgb[i * 3] + 0.7152 * rgb[i * 3 + 1] + 0.0722 * rgb[i * 3 + 2]) / 255;
  const full = (await RawImage.read(file)).rgb();

  // Hlavní motiv (0–1).
  const [cut] = await saliency(full);
  const alpha = await sharp(Buffer.from(cut.data), { raw: { width: cut.width, height: cut.height, channels: cut.channels } })
    .extractChannel(cut.channels - 1)
    .resize(w, h, { fit: "fill" })
    .raw()
    .toBuffer();

  // Hloubka (0 = daleko, 1 = blízko).
  const { depth } = await depthEstimator(full);
  // `extractChannel`: sharp po změně velikosti vrací i šedou mapu jako RGB.
  const depthRaw = await sharp(Buffer.from(depth.data), { raw: { width: depth.width, height: depth.height, channels: 1 } })
    .resize(w, h, { fit: "fill" })
    .extractChannel(0)
    .raw()
    .toBuffer();
  let dMin = 255;
  let dMax = 0;
  for (const v of depthRaw) {
    if (v < dMin) dMin = v;
    if (v > dMax) dMax = v;
  }
  const near = new Float32Array(n);
  for (let i = 0; i < n; i++) near[i] = (depthRaw[i] - dMin) / Math.max(1, dMax - dMin);

  const label = new Int16Array(n).fill(-1);
  const layers = [];
  const add = (layer, pixels) => {
    let taken = 0;
    for (const i of pixels) if (label[i] === -1) taken++;
    if (!taken) return;
    const index = layers.length;
    for (const i of pixels) if (label[i] === -1) label[i] = index;
    layers.push(layer);
  };

  // --- Text ---
  const { texts, resizedImageWidth: rw, resizedImageHeight: rh } = await paddle.detect(file);
  const lines = texts
    .filter((t) => (t.mean ?? 0) > 0.6 && t.box?.length)
    .map((t) => {
      const xs = t.box.map((p) => (p[0] / rw) * w);
      const ys = t.box.map((p) => (p[1] / rh) * h);
      const x0 = Math.max(0, Math.floor(Math.min(...xs)) - 2);
      const y0 = Math.max(0, Math.floor(Math.min(...ys)) - 2);
      const x1 = Math.min(w - 1, Math.ceil(Math.max(...xs)) + 2);
      const y1 = Math.min(h - 1, Math.ceil(Math.max(...ys)) + 2);
      return { text: t.text, box: { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 } };
    })
    .sort((a, b) => a.box.y - b.box.y || a.box.x - b.box.x);

  for (const line of lines) {
    const { x, y, w: bw, h: bh } = line.box;
    // Popisek: Tesseract přečte výřez z originálu (diakritika), Paddle jistí.
    const sx = meta.width / w;
    const sy = meta.height / h;
    try {
      const crop = await sharp(file)
        .flatten({ background: "#ffffff" })
        .extract({
          left: Math.floor(x * sx),
          top: Math.floor(y * sy),
          width: Math.min(meta.width - Math.floor(x * sx), Math.ceil(bw * sx)),
          height: Math.min(meta.height - Math.floor(y * sy), Math.ceil(bh * sy)),
        })
        .png()
        .toBuffer();
      const { data } = await tesseract.recognize(crop);
      const read = data.text.trim().replace(/\s+/g, " ");
      if (data.confidence > 50 && similar(read, line.text) > 0.6) line.text = read;
    } catch {
      // necháme text z Paddle
    }

    // Pixely písma: Otsu na jasu v boxu, písmo je třída vzdálenější od okraje.
    const inside = [];
    const values = [];
    for (let yy = y; yy < y + bh; yy++)
      for (let xx = x; xx < x + bw; xx++) {
        inside.push(yy * w + xx);
        values.push(Math.round(luma[yy * w + xx] * 255));
      }
    const t = otsu(values);
    let ring = 0;
    let ringN = 0;
    for (let xx = x; xx < x + bw; xx++) {
      ring += luma[y * w + xx] + luma[(y + bh - 1) * w + xx];
      ringN += 2;
    }
    for (let yy = y; yy < y + bh; yy++) {
      ring += luma[yy * w + x] + luma[yy * w + x + bw - 1];
      ringN += 2;
    }
    const ringValue = (ring / ringN) * 255;
    const textIsDark = ringValue > t;
    const mask = new Uint8Array(n);
    for (const i of inside) {
      const v = luma[i] * 255;
      if (textIsDark ? v <= t : v > t) mask[i] = 1;
    }
    // Pryč drobný šum: písmeno má aspoň čtvrtinu výšky řádku nebo je u jiného.
    const glyphs = components(mask, w, h, 3).filter((c) => c.box.h >= bh * 0.18 || c.pixels.length > 12);
    const pixels = glyphs.flatMap((c) => Array.from(c.pixels));
    if (pixels.length < 12) continue;
    add({ kind: "text", label: line.text }, pixels);
  }

  // --- Objekty ---
  const detections = (await detector(full, { threshold: SETTINGS.detectThreshold }))
    .map((d) => ({
      label: d.label,
      score: d.score,
      box: {
        x: Math.max(0, Math.floor((d.box.xmin / meta.width) * w)),
        y: Math.max(0, Math.floor((d.box.ymin / meta.height) * h)),
        x1: Math.min(w - 1, Math.ceil((d.box.xmax / meta.width) * w)),
        y1: Math.min(h - 1, Math.ceil((d.box.ymax / meta.height) * h)),
      },
    }))
    .filter((d) => ((d.box.x1 - d.box.x) * (d.box.y1 - d.box.y)) / n < SETTINGS.detectMaxArea)
    .sort((a, b) => (a.box.x1 - a.box.x) * (a.box.y1 - a.box.y) - (b.box.x1 - b.box.x) * (b.box.y1 - b.box.y));

  const objects = [];
  for (const d of detections) {
    // V boxu: motiv, nebo to, co je podle hloubky blíž než okolí v boxu.
    const values = [];
    for (let yy = d.box.y; yy <= d.box.y1; yy++)
      for (let xx = d.box.x; xx <= d.box.x1; xx++) values.push(Math.round(near[yy * w + xx] * 255));
    const t = otsu(values);
    // Motiv (BiRefNet) má přednost; hloubka jen tam, kde ho v boxu skoro
    // není (sklo, věci mimo hlavní motiv).
    let salient = 0;
    for (let yy = d.box.y; yy <= d.box.y1; yy++)
      for (let xx = d.box.x; xx <= d.box.x1; xx++) if (alpha[yy * w + xx] > 127) salient++;
    const boxArea = (d.box.x1 - d.box.x + 1) * (d.box.y1 - d.box.y + 1);
    const byDepth = salient < boxArea * 0.15;
    const mask = new Uint8Array(n);
    for (let yy = d.box.y; yy <= d.box.y1; yy++)
      for (let xx = d.box.x; xx <= d.box.x1; xx++) {
        const i = yy * w + xx;
        if (label[i] === -1 && (byDepth ? near[i] * 255 > t : alpha[i] > 127)) mask[i] = 1;
      }
    // Největší souvislá část — objekt, ne jeho střepy.
    const parts = components(mask, w, h, 1).sort((a, b) => b.pixels.length - a.pixels.length);
    if (!parts.length || parts[0].pixels.length < n * SETTINGS.minObject) continue;
    objects.push({ kind: "object", label: CZ[d.label] ?? d.label, pixels: parts[0].pixels });
    for (const i of parts[0].pixels) label[i] = -2; // zabráno, pořadí se určí níž
  }
  // Zbytek motivu bez jména.
  const rest = new Uint8Array(n);
  for (let i = 0; i < n; i++) if (label[i] === -1 && alpha[i] > 127) rest[i] = 1;
  for (const c of components(rest, w, h, n * SETTINGS.minObject)) {
    objects.push({ kind: "object", label: "objekt", pixels: c.pixels });
    for (const i of c.pixels) label[i] = -2;
  }
  for (const o of objects) for (const i of o.pixels) label[i] = -1;

  // --- Tvary ---
  const objectPixel = new Uint8Array(n);
  for (const o of objects) for (const i of o.pixels) objectPixel[i] = 1;
  const candidates = [];
  for (let i = 0; i < n; i++) if (label[i] === -1 && !objectPixel[i]) candidates.push(i);
  const sample = [];
  const step = Math.max(1, Math.floor(candidates.length / 20000));
  for (let k = 0; k < candidates.length; k += step) {
    const i = candidates[k];
    sample.push([rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2]]);
  }
  const centers = sample.length ? kmeans(sample, SETTINGS.colors) : [];
  const cluster = new Int8Array(n).fill(-1);
  const counts = new Array(centers.length).fill(0);
  for (const i of candidates) {
    const j = nearest([rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2]], centers);
    cluster[i] = j;
    counts[j]++;
  }
  const base = counts.indexOf(Math.max(...counts));
  const shapes = [];
  centers.forEach((center, j) => {
    if (j === base) return;
    const mask = new Uint8Array(n);
    for (const i of candidates) if (cluster[i] === j) mask[i] = 1;
    for (const c of components(mask, w, h, n * SETTINGS.minShape)) {
      if (c.pixels.length > n * SETTINGS.maxShape) continue;
      const solidity = c.pixels.length / (c.box.w * c.box.h);
      if (solidity < SETTINGS.shapeSolidity) continue;
      // Plochost vůči vlastní průměrné barvě (střed shluku může táhnout
      // jinam — tmavé lahve a vínové tlačítko v jednom shluku).
      const own = [0, 0, 0];
      for (const i of c.pixels) for (let ch = 0; ch < 3; ch++) own[ch] += rgb[i * 3 + ch] / c.pixels.length;
      let spread = 0;
      for (const i of c.pixels) spread += Math.sqrt((rgb[i * 3] - own[0]) ** 2 + (rgb[i * 3 + 1] - own[1]) ** 2 + (rgb[i * 3 + 2] - own[2]) ** 2);
      if (spread / c.pixels.length > SETTINGS.shapeFlatness) continue;
      shapes.push({ kind: "shape", label: "tvar", pixels: c.pixels });
    }
  });
  shapes.sort((a, b) => b.pixels.length - a.pixels.length);

  // --- Pořadí stavby: pozadí → tvary → objekty (zezadu dopředu) → text ---
  const meanNear = (pixels) => pixels.reduce((s, i) => s + near[i], 0) / pixels.length;
  objects.sort((a, b) => meanNear(a.pixels) - meanNear(b.pixels));
  const texts_ = layers.map((layer, index) => ({ ...layer, pixels: Array.from(label.keys()).filter((i) => label[i] === index) }));
  const background = [];
  const keepShapes = shapes.slice(0, SETTINGS.maxShapes);
  const taken = new Uint8Array(n);
  for (const group of [texts_, objects, keepShapes]) for (const l of group) for (const i of l.pixels) taken[i] = 1;
  for (let i = 0; i < n; i++) if (!taken[i]) background.push(i);

  let ordered = [{ kind: "background", label: "pozadí", pixels: background }, ...keepShapes, ...objects, ...texts_];
  ordered = ordered.filter((l, k) => k === 0 || l.pixels.length);
  // Přes limit: nejmenší tvary a objekty spadnou do pozadí.
  while (ordered.length > SETTINGS.maxLayers) {
    let smallest = -1;
    ordered.forEach((l, k) => {
      if (k && l.kind !== "text" && (smallest < 0 || l.pixels.length < ordered[smallest].pixels.length)) smallest = k;
    });
    if (smallest < 0) break;
    ordered[0].pixels.push(...ordered[smallest].pixels);
    ordered.splice(smallest, 1);
  }

  // --- Mapa: index, postup, linky ---
  const map = Buffer.alloc(n * 4);
  const index = new Uint8Array(n);
  ordered.forEach((layer, k) => {
    for (const i of layer.pixels) index[i] = k;
  });

  const progress = new Float32Array(n);
  ordered.forEach((layer) => {
    const px = layer.pixels;
    if (!px.length) return;
    let x0 = w, y0 = h, x1 = 0, y1 = 0, cx = 0, cy = 0;
    for (const i of px) {
      const x = i % w;
      const y = (i - x) / w;
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
      cx += x;
      cy += y;
    }
    cx /= px.length;
    cy /= px.length;
    const raw = new Float32Array(px.length);
    px.forEach((i, k) => {
      const x = i % w;
      const y = (i - x) / w;
      const u = (x - x0) / Math.max(1, x1 - x0);
      const v = (y - y0) / Math.max(1, y1 - y0);
      if (layer.kind === "text") raw[k] = u + 0.12 * v; // čtecí pořadí
      else if (layer.kind === "shape") raw[k] = Math.hypot(x - cx, y - cy); // od středu
      else if (layer.kind === "object") raw[k] = 0.6 * v + 0.4 * (1 - near[i]); // shora a zezadu
      else raw[k] = 0.65 * (1 - near[i]) + 0.35 * v; // pozadí: od dálky
    });
    const ranked = rankNormalize(raw);
    px.forEach((i, k) => {
      progress[i] = ranked[k];
    });
    layer.box = [x0 / w, y0 / h, (x1 - x0 + 1) / w, (y1 - y0 + 1) / h];
    let r = 0, g = 0, b = 0;
    for (const i of px) {
      r += rgb[i * 3];
      g += rgb[i * 3 + 1];
      b += rgb[i * 3 + 2];
    }
    layer.color = [r, g, b].map((c) => Math.round(c / px.length));
    layer.area = +(px.length / n).toFixed(4);
  });

  const lines_ = edges(blur3(luma, w, h), w, h);
  for (let i = 0; i < n; i++) {
    const x = i % w;
    let e = lines_[i] < 0.12 ? 0 : Math.pow(lines_[i], 0.8);
    // Hranice vrstev jsou vždycky plná linka — obrys vrstvy.
    if ((x < w - 1 && index[i + 1] !== index[i]) || (i + w < n && index[i + w] !== index[i])) e = 1;
    map[i * 4] = index[i];
    map[i * 4 + 1] = Math.round(progress[i] * 255);
    map[i * 4 + 2] = Math.round(e * 255);
    map[i * 4 + 3] = 255;
  }

  await sharp(map, { raw: { width: w, height: h, channels: 4 } }).png({ compressionLevel: 9 }).toFile(path.join(outDir, `${name}.png`));
  const json = {
    version: 1,
    source: "/" + path.relative(publicDir, file).split(path.sep).join("/"),
    width: w,
    height: h,
    aspect: +(meta.width / meta.height).toFixed(5),
    layers: ordered.map(({ kind, label: text, box, color, area }) => ({ kind, label: text, box: box?.map((v) => +v.toFixed(4)), color, area })),
  };
  fs.writeFileSync(path.join(outDir, `${name}.json`), JSON.stringify(json, null, 2) + "\n");

  const summary = ordered.map((l) => `${l.kind}:${l.label}`).join(", ");
  log(`✓ ${name} ${w}×${h} — ${ordered.length} vrstev (${((performance.now() - started) / 1000).toFixed(1)} s)\n  ${summary}`);
}

for (const file of files) {
  if (!fs.existsSync(file)) {
    log(`✗ ${file} neexistuje`);
    continue;
  }
  await analyze(file);
}
await tesseract.terminate();
