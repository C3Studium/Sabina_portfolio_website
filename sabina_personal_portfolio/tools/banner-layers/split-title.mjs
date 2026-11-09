// Rozdělení banneru na podklad a nadpis — pro scénu „zvětšit nadpis"
// v Procesu (krok 04). Bere box nadpisu z rozkladu analyze.mjs (JSON):
//
//     node split-title.mjs ../../public/assets/banners/jordan_banner4.png 17 18 19
//
// Čísla jsou indexy textových vrstev nadpisu (viz layers/<jméno>.json).
// Písmo se v jejich boxu (s rezervou) vyřízne podle jasu proti podkladu —
// mapa vrstev je na malý banner moc hrubá. Funguje pro světlé písmo na
// tmavém klidném pozadí.
// Výstup do public/assets/banners/split/:
//   <jméno>_title.png  jen nadpis (průhledné okolí, okraj písma rozšířený
//                      o pár px, ať zůstane i vyhlazení hran)
//   <jméno>_base.png   banner bez nadpisu — díra se dopočítá z okolí
//                      (normalizovaná konvoluce ve více měřítkách)
//   <jméno>_title.json box nadpisu (0–1) — kolem jeho středu se pak škáluje

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const here = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(here, "../../public");
const outDir = path.join(publicDir, "assets/banners/split");

/* ---------- Nastavení ---------- */

// O kolik px (v originále) se díra v podkladu rozšíří kolem písma.
const GROW = 2;
// Rezerva kolem boxu nadpisu (podíl banneru) — OCR občas utne první písmeno.
const MARGIN = 0.03;
// Jas nad podkladem: od kolika je pixel písmo (0 → 1 průhlednosti).
const MATTE = [28, 80];
// Měřítka doplnění díry (sigma rozmazání, px) — od nejjemnějšího.
const SIGMAS = [2, 4, 8, 16, 32];

/* ---------- Pomůcky ---------- */

const raw = (buf, width, height, channels) => sharp(buf, { raw: { width, height, channels } });

// POZOR: sharp vrací jednokanálový obraz jako tříkanálový — proto
// extractChannel(0), jinak by indexy v bufferu nesouhlasily.
async function blurRaw(buf, width, height, channels, sigma) {
  let img = raw(buf, width, height, channels).blur(sigma);
  if (channels === 1) img = img.extractChannel(0);
  const { data } = await img.raw().toBuffer({ resolveWithObject: true });
  return data;
}

/* ---------- Běh ---------- */

const [file, ...indexArgs] = process.argv.slice(2);
if (!file || !indexArgs.length) {
  console.error("Použití: node split-title.mjs <banner.png> <index vrstvy> [...]");
  process.exit(1);
}
const name = path.basename(file).replace(/\.[^.]+$/, "");
const indices = new Set(indexArgs.map(Number));
const layersJson = JSON.parse(fs.readFileSync(path.join(publicDir, "assets/banners/layers", `${name}.json`), "utf8"));

const original = sharp(path.resolve(file)).ensureAlpha();
const { data: img, info } = await original.raw().toBuffer({ resolveWithObject: true });
const { width, height } = info;

// Box nadpisu (sjednocení boxů vybraných vrstev, 0–1) s rezervou, v px.
const boxes = layersJson.layers.filter((_, i) => indices.has(i)).map((l) => l.box);
const bx0 = Math.min(...boxes.map((b) => b[0]));
const by0 = Math.min(...boxes.map((b) => b[1]));
const bx1 = Math.max(...boxes.map((b) => b[0] + b[2]));
const by1 = Math.max(...boxes.map((b) => b[1] + b[3]));
const px0 = Math.max(0, Math.floor((bx0 - MARGIN) * width));
const py0 = Math.max(0, Math.floor((by0 - MARGIN) * height));
const px1 = Math.min(width, Math.ceil((bx1 + MARGIN) * width));
const py1 = Math.min(height, Math.ceil((by1 + MARGIN) * height));

// Jas a podklad: medián tmavších 40 % pixelů v boxu.
const lum = (i) => 0.2126 * img[i * 4] + 0.7152 * img[i * 4 + 1] + 0.0722 * img[i * 4 + 2];
const inBox = [];
for (let y = py0; y < py1; y++) for (let x = px0; x < px1; x++) inBox.push(y * width + x);
const dark = [...inBox].sort((p, q) => lum(p) - lum(q)).slice(0, Math.floor(inBox.length * 0.4));
const median = (c) => {
  const v = dark.map((i) => img[i * 4 + c]).sort((p, q) => p - q);
  return v[Math.floor(v.length / 2)];
};
const bg = [median(0), median(1), median(2)];
const bgLum = 0.2126 * bg[0] + 0.7152 * bg[1] + 0.0722 * bg[2];

// Průhlednost písma podle jasu nad podkladem (měkká, i vyhlazené hrany).
const alpha = new Float32Array(width * height);
for (const i of inBox) alpha[i] = Math.min(Math.max((lum(i) - bgLum - MATTE[0]) / (MATTE[1] - MATTE[0]), 0), 1);
const mask = Buffer.alloc(width * height);
for (let i = 0; i < width * height; i++) if (alpha[i] > 0.04) mask[i] = 255;
// Rozšíření díry o GROW px (kruhem). Ručně — morfologie sharpu (dilate)
// u jednokanálové masky roztahuje tmavou část, ne bílou.
const grown = Buffer.alloc(width * height);
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    if (!mask[y * width + x]) continue;
    for (let dy = -GROW; dy <= GROW; dy++) {
      for (let dx = -GROW; dx <= GROW; dx++) {
        if (dx * dx + dy * dy > GROW * GROW) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < width && ny < height) grown[ny * width + nx] = 255;
      }
    }
  }
}

// Nadpis: barva písma bez podkladu (na hranách se podklad odečte), alfa z masky.
const title = Buffer.alloc(width * height * 4);
for (let i = 0; i < width * height; i++) {
  const a = alpha[i];
  if (a <= 0) continue;
  for (let c = 0; c < 3; c++) {
    const pure = (img[i * 4 + c] - (1 - a) * bg[c]) / a;
    title[i * 4 + c] = Math.min(Math.max(Math.round(pure), 0), 255);
  }
  title[i * 4 + 3] = Math.round(a * 255);
}
fs.mkdirSync(outDir, { recursive: true });
await raw(title, width, height, 4).png().toFile(path.join(outDir, `${name}_title.png`));

// Podklad: díru (rozšířená maska) doplnit z okolí. Pro každé měřítko
// rozmazat (obraz × známé) a (známé) a vydělit — v díře zůstane průměr
// okolí. Bere se nejjemnější měřítko, které už má dost známých pixelů.
const known = Buffer.alloc(width * height * 3);
const weighted = Buffer.alloc(width * height * 3);
for (let i = 0; i < width * height; i++) {
  const k = grown[i] ? 0 : 255;
  for (let c = 0; c < 3; c++) {
    known[i * 3 + c] = k;
    weighted[i * 3 + c] = grown[i] ? 0 : img[i * 4 + c];
  }
}
const filled = new Float32Array(width * height * 3).fill(-1);
for (const sigma of SIGMAS) {
  const num = await blurRaw(weighted, width, height, 3, sigma);
  const den = await blurRaw(known, width, height, 3, sigma);
  for (let i = 0; i < width * height; i++) {
    if (!grown[i] || filled[i * 3] >= 0) continue;
    if (den[i * 3] < 40) continue;
    for (let c = 0; c < 3; c++) filled[i * 3 + c] = (num[i * 3 + c] / den[i * 3 + c]) * 255;
  }
}
const base = Buffer.from(img);
for (let i = 0; i < width * height; i++) {
  if (!grown[i]) continue;
  // Celá díra (i vyhlazený lem písma) se nahradí doplňkem z okolí.
  const t = 1;
  for (let c = 0; c < 3; c++) {
    const fill = filled[i * 3 + c] >= 0 ? filled[i * 3 + c] : img[i * 4 + c];
    base[i * 4 + c] = Math.round(img[i * 4 + c] * (1 - t) + fill * t);
  }
}
await raw(base, width, height, 4).png().toFile(path.join(outDir, `${name}_base.png`));

fs.writeFileSync(
  path.join(outDir, `${name}_title.json`),
  JSON.stringify({ source: `/assets/banners/${path.basename(file)}`, box: [bx0, by0, bx1 - bx0, by1 - by0] }, null, 2),
);
console.log(`✓ ${name}: ${width}×${height}, nadpis box`, [bx0, by0, bx1 - bx0, by1 - by0].map((v) => v.toFixed(3)).join(", "));
