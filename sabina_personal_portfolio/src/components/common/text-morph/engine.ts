// WebGL přechod mezi slovy — převzaté z TextMorph a zúžené na řízený přechod.
//
// Každé slovo se jednou rasterizuje do pole vzdáleností (SDF): pro každý pixel
// „jak daleko je k hraně písmene". Shader pak mezi dvěma slovy míchá tahle
// pole — písmena se slijí jako kapalina, společná písmena (Š, Í) se jen
// přesunou na nové místo.
//
// Proti originálu:
//  - Žádné vlastní spouštění (auto/hover/click), časovače ani sledování
//    záběru. Přechod spustí komponenta voláním `morphTo(z, do, hotovo)`.
//  - Hodiny přechodu jede framer `animate(0 → 1)`, ne ruční rAF smyčka.
//  - V klidu plátno nekreslí nic — klidové písmo kreslí někdo jiný
//    (MeasureText). Kreslí se jen během přechodu.
//  - Písmo včetně `text-transform` se čte z DOMu (nadpis je verzálkami).
//
// Modul se načítá líně — three.js se stáhne, až když je co morfovat.

import * as THREE from "three";
import { animate } from "framer-motion";
import { SNOW } from "@/lib/palette";

export type MorphSettings = {
  /** "liquid" = písmena se slijí, "blur" = rozmazání a posun. */
  morph: "liquid" | "blur";
  /** Barva, do které se písmena během přechodu zabarví. */
  morphColor: string;
  /** Kolik barvy přechodu (0–1). */
  tint: number;
  /** Délka přechodu (s). */
  duration: number;
  /** Rozestup písmen v přechodu (0–0,9). */
  stagger: number;
  staggerFrom: "start" | "end" | "center" | "edges" | "random";
  /** Jak moc nespárovaná písmena cestují k novému slovu (0–1). */
  travel: number;
  /** Lepivost slévání (0–1). */
  goo: number;
  /** Nafouknutí při slévání (0–0,5). */
  swell: number;
  softness: number;
  /** Zvětšení písmen během přechodu (−0,5–0,5). */
  scale: number;
  /** Rozlišení polí vzdáleností (0,5–1) u velkého písma; malé jde vždy v plném. */
  quality: number;
  /** Stejná písmena obou slov se jen přesunou (true), nebo se slijí všechna (false). */
  pairLetters: boolean;
};

export type Morph = {
  /** Přeměří a znovu připraví pole slov (resize, písmo). */
  build: () => void;
  /** Přechod ze slova `from` na `to`; `done` se zavolá s posledním snímkem na plátně. */
  morphTo: (from: number, to: number, done: () => void) => void;
  /** Smaže plátno — klidový stav kreslí někdo jiný. */
  clear: () => void;
  /** Má engine WebGL kontext? (Prohlížeč ho smí vzít — pak jen výměna.) */
  alive: () => boolean;
  destroy: () => void;
};

type Glyph = {
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
  cx: number;
  ax: number;
  ay: number;
  u: number;
  v: number;
  du: number;
  dv: number;
};

type WordField = {
  glyphs: Glyph[];
  texture: THREE.DataTexture | null;
  left: number;
  right: number;
  depth: number;
};

type Part = { text: string; left: number; top: number; right: number; bottom: number };

type Cell = {
  parts: Part[];
  left: number;
  top: number;
  right: number;
  bottom: number;
  ax: number;
  ay: number;
};

const MAX_GLYPHS = 64;

/* ---------- Shadery (beze změny z originálu) ---------- */

const vertexShader = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const visit = (side: "A" | "B", row: number, body: string) => `
  for (int i = 0; i < ${MAX_GLYPHS}; i++) {
    if (i >= uCount${side}) break;
    vec4 r = uRect${side}[i];
    vec2 q = (p - r.xy) / r.zw;
    if (q.x < 0.0 || q.y < 0.0 || q.x > 1.0 || q.y > 1.0) continue;
    vec4 m = texelFetch(uGlyphs, ivec2(i, ${row}), 0);
    vec4 g = texelFetch(uGlyphs, ivec2(i, ${row + 1}), 0);
    vec2 f = textureLod(uAtlas${side}, m.xy + q * m.zw, 0.0).rg;
    ${body}
  }
`;

const liquid = (side: "A" | "B") => `
    float v = mix(f.r, f.g, g.y) * g.x + g.z;
    d${side} = min(d${side}, v);
    float k = exp(-max(v, 0.0) / uBand);
    w${side} += k;
    a${side} += k * g.w;
`;

const blurred = `
    float v = f.r * g.x;
    float e = 0.7 * uPixel + g.y;
    float c = (1.0 - smoothstep(-e, e, v)) * g.z;
    keep *= 1.0 - c;
    wsum += c;
    asum += c * g.w;
`;

const fragmentShader = `
uniform sampler2D uAtlasA;
uniform sampler2D uAtlasB;
uniform sampler2D uGlyphs;
uniform vec4 uRectA[${MAX_GLYPHS}];
uniform vec4 uRectB[${MAX_GLYPHS}];
uniform int uCountA;
uniform int uCountB;
uniform int uMode;
uniform float uCap;
uniform float uGoo;
uniform float uSwell;
uniform float uBand;
uniform float uPixel;
uniform vec2 uSize;
uniform vec3 uInk;
uniform float uInkAlpha;
uniform vec3 uTint;
uniform float uTintAmount;
varying vec2 vUv;

float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

void main() {
  vec2 p = vec2(vUv.x, 1.0 - vUv.y) * uSize;
  float alpha = 0.0;
  float act = 0.0;
  if (uMode == 1) {
    float keep = 1.0;
    float wsum = 0.0;
    float asum = 0.0;
    ${visit("A", 0, blurred)}
    ${visit("B", 2, blurred)}
    alpha = 1.0 - keep;
    act = wsum > 0.0 ? asum / wsum : 0.0;
  } else {
    float dA = uCap;
    float wA = 0.0;
    float aA = 0.0;
    float dB = uCap;
    float wB = 0.0;
    float aB = 0.0;
    ${visit("A", 0, liquid("A"))}
    ${visit("B", 2, liquid("B"))}
    aA = wA > 0.0 ? aA / wA : 0.0;
    aB = wB > 0.0 ? aB / wB : 0.0;
    act = mix(aA, aB, smoothstep(-uBand, uBand, dA - dB));
    float d = smin(dA, dB, max(uGoo * act, 0.0001)) - uSwell * act;
    float aa = max(fwidth(d), 0.0001) * 0.7;
    alpha = clamp(0.5 - d / (2.0 * aa), 0.0, 1.0);
  }
  vec3 color = mix(uInk, uTint, clamp(uTintAmount * act * act, 0.0, 1.0));
  float coverage = alpha * uInkAlpha;
  gl_FragColor = vec4(color * coverage, coverage);
}
`;

/* ---------- Pomocné funkce (z originálu) ---------- */

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const smooth = (t: number) => {
  const x = clamp(t, 0, 1);
  return x * x * x * (x * (x * 6 - 15) + 10);
};

const ramp = (from: number, to: number, value: number) => {
  const x = clamp((value - from) / (to - from), 0, 1);
  return x * x * (3 - 2 * x);
};

const splitGraphemes = (value: string) =>
  typeof Intl !== "undefined" && "Segmenter" in Intl
    ? Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(value), (p) => p.segment)
    : Array.from(value);

let probe: CanvasRenderingContext2D | null = null;

const readColor = (value: string): [number, number, number, number] | null => {
  if (!value) return null;
  if (typeof CSS !== "undefined" && !CSS.supports("color", value)) return null;
  if (!probe) {
    const surface = document.createElement("canvas");
    surface.width = 1;
    surface.height = 1;
    probe = surface.getContext("2d", { willReadFrequently: true });
  }
  if (!probe) return null;
  probe.clearRect(0, 0, 1, 1);
  probe.fillStyle = "#000";
  probe.fillStyle = value;
  probe.fillRect(0, 0, 1, 1);
  const data = probe.getImageData(0, 0, 1, 1).data;
  return [data[0] / 255, data[1] / 255, data[2] / 255, data[3] / 255];
};

// Přesná euklidovská transformace vzdáleností (Felzenszwalb) — základ SDF.
const edt = (grid: Float64Array, width: number, height: number) => {
  const n = Math.max(width, height);
  const f = new Float64Array(n);
  const z = new Float64Array(n + 1);
  const v = new Uint16Array(n);
  const pass = (offset: number, stride: number, length: number) => {
    for (let q = 0; q < length; q++) f[q] = grid[offset + q * stride];
    v[0] = 0;
    z[0] = -1e20;
    z[1] = 1e20;
    let k = 0;
    for (let q = 1; q < length; q++) {
      let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      while (s <= z[k]) {
        k--;
        s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      }
      k++;
      v[k] = q;
      z[k] = s;
      z[k + 1] = 1e20;
    }
    k = 0;
    for (let q = 0; q < length; q++) {
      while (z[k + 1] < q) k++;
      const r = q - v[k];
      grid[offset + q * stride] = f[v[k]] + r * r;
    }
  };
  for (let x = 0; x < width; x++) pass(x, width, height);
  for (let y = 0; y < height; y++) pass(y * width, 1, width);
};

const boxBlur = (src: Float32Array, width: number, height: number, radius: number) => {
  const r = Math.max(1, Math.round(radius));
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  const norm = 1 / (2 * r + 1);
  for (let y = 0; y < height; y++) {
    const row = y * width;
    let sum = 0;
    for (let k = -r; k <= r; k++) sum += src[row + clamp(k, 0, width - 1)];
    for (let x = 0; x < width; x++) {
      tmp[row + x] = sum * norm;
      sum += src[row + Math.min(width - 1, x + r + 1)] - src[row + Math.max(0, x - r)];
    }
  }
  for (let x = 0; x < width; x++) {
    let sum = 0;
    for (let k = -r; k <= r; k++) sum += tmp[clamp(k, 0, height - 1) * width + x];
    for (let y = 0; y < height; y++) {
      out[y * width + x] = sum * norm;
      sum += tmp[Math.min(height - 1, y + r + 1) * width + x] - tmp[Math.max(0, y - r) * width + x];
    }
  }
  return out;
};

const signedField = (alpha: Uint8ClampedArray, width: number, height: number, scale: number) => {
  const size = width * height;
  const outer = new Float64Array(size);
  const inner = new Float64Array(size);
  for (let i = 0; i < size; i++) {
    const a = alpha[i * 4 + 3] / 255;
    if (a >= 1) {
      outer[i] = 0;
      inner[i] = 1e20;
    } else if (a <= 0) {
      outer[i] = 1e20;
      inner[i] = 0;
    } else {
      const d = 0.5 - a;
      outer[i] = d > 0 ? d * d : 0;
      inner[i] = d < 0 ? d * d : 0;
    }
  }
  edt(outer, width, height);
  edt(inner, width, height);
  const out = new Float32Array(size);
  for (let i = 0; i < size; i++) out[i] = (Math.sqrt(outer[i]) - Math.sqrt(inner[i])) / scale;
  return out;
};

// Spáruje stejná písmena obou slov (nejdelší společná podposloupnost), aby
// se „Š" a „Í" jen přesunula místo slití.
const pairUp = (a: Glyph[], b: Glyph[], reach: number) => {
  const n = a.length;
  const m = b.length;
  const stride = m + 1;
  const length = new Int16Array((n + 1) * stride);
  const cost = new Float32Array((n + 1) * stride);
  const choice = new Uint8Array((n + 1) * stride);
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      const at = i * stride + j;
      let bestLength = length[at + stride];
      let bestCost = cost[at + stride];
      let best = 0;
      if (length[at + 1] > bestLength || (length[at + 1] === bestLength && cost[at + 1] < bestCost)) {
        bestLength = length[at + 1];
        bestCost = cost[at + 1];
        best = 1;
      }
      if (a[i].text === b[j].text && Math.abs(a[i].ax - b[j].ax) <= reach) {
        const nextLength = length[at + stride + 1] + 1;
        const nextCost = cost[at + stride + 1] + Math.abs(a[i].ax - b[j].ax);
        if (nextLength > bestLength || (nextLength === bestLength && nextCost < bestCost)) {
          bestLength = nextLength;
          bestCost = nextCost;
          best = 2;
        }
      }
      length[at] = bestLength;
      cost[at] = bestCost;
      choice[at] = best;
    }
  }
  const pairs = new Int16Array(n).fill(-1);
  const taken = new Uint8Array(m);
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    const pick = choice[i * stride + j];
    if (pick === 2) {
      pairs[i] = j;
      taken[j] = 1;
      i++;
      j++;
    } else if (pick === 0) i++;
    else j++;
  }
  return { pairs, taken };
};

/* ---------- Engine ---------- */

export function createMorph(root: HTMLElement, settings: MorphSettings): Morph | null {
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.cssText = "position:absolute;pointer-events:none;display:block";
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, premultipliedAlpha: true, antialias: false });
  } catch {
    return null;
  }
  root.appendChild(canvas);
  renderer.setClearColor(0x000000, 0);

  const mask = document.createElement("canvas");
  const mctx = mask.getContext("2d", { willReadFrequently: true });
  const limit = Math.max(512, Math.min(4096, renderer.capabilities.maxTextureSize));

  const far = THREE.DataUtils.toHalfFloat(4000);
  const empty = new THREE.DataTexture(new Uint16Array([far, far]), 1, 1, THREE.RGFormat, THREE.HalfFloatType);
  empty.needsUpdate = true;
  const glyphData = new Float32Array(MAX_GLYPHS * 4 * 4);
  const glyphTexture = new THREE.DataTexture(glyphData, MAX_GLYPHS, 4, THREE.RGBAFormat, THREE.FloatType);
  glyphTexture.magFilter = THREE.NearestFilter;
  glyphTexture.minFilter = THREE.NearestFilter;
  glyphTexture.generateMipmaps = false;
  glyphTexture.needsUpdate = true;
  const slots = () => Array.from({ length: MAX_GLYPHS }, () => new THREE.Vector4(0, 0, 1, 1));
  const uniforms = {
    uAtlasA: { value: empty as THREE.Texture },
    uAtlasB: { value: empty as THREE.Texture },
    uGlyphs: { value: glyphTexture },
    uRectA: { value: slots() },
    uRectB: { value: slots() },
    uCountA: { value: 0 },
    uCountB: { value: 0 },
    uMode: { value: 0 },
    uCap: { value: 8 },
    uGoo: { value: 8 },
    uSwell: { value: 2 },
    uBand: { value: 4 },
    uPixel: { value: 0.5 },
    uSize: { value: new THREE.Vector2(1, 1) },
    uInk: { value: new THREE.Color(1, 1, 1) },
    uInkAlpha: { value: 1 },
    uTint: { value: new THREE.Color(1, 1, 1) },
    uTintAmount: { value: 0.3 },
  };
  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  material.blending = THREE.CustomBlending;
  material.blendSrc = THREE.OneFactor;
  material.blendDst = THREE.OneMinusSrcAlphaFactor;
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  quad.frustumCulled = false;
  const scene = new THREE.Scene();
  scene.add(quad);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  let words: WordField[] = [];
  let fieldKey = "";
  let generation = 0;
  let planKey = "";
  let plan: { pairs: Int16Array; taken: Uint8Array } | null = null;
  let width = 1;
  let height = 1;
  let padX = 0;
  let padY = 0;
  let ratio = 1;
  let fontPx = 16;
  let cap = 8;
  let seed = 1;
  let destroyed = false;
  let running: ReturnType<typeof animate> | null = null;
  // Prohlížeč smí WebGL kontext vzít (moc současných scén — bere nejstarší).
  // Pak se plátno schová (jinak ukáže ikonu ztraceného kontextu) a slova se
  // vyměňují bez přelití. Po obnovení kontextu zase normálně.
  let lost = false;
  let finish: (() => void) | null = null;
  const onLost = (event: Event) => {
    event.preventDefault();
    lost = true;
    canvas.style.display = "none";
    running?.stop();
    running = null;
    const done = finish;
    finish = null;
    done?.();
  };
  const onRestored = () => {
    lost = false;
    canvas.style.display = "block";
    empty.needsUpdate = true;
    glyphTexture.needsUpdate = true;
    build(true);
  };
  canvas.addEventListener("webglcontextlost", onLost);
  canvas.addEventListener("webglcontextrestored", onRestored);

  const sizers = () => Array.from(root.querySelectorAll<HTMLElement>("[data-morph-word]"));

  // Kde DOM položil každé písmeno slova (vůči kořeni, s okrajem plátna).
  const measure = (sizer: HTMLElement, origin: DOMRect, range: Range, shape: (s: string) => string) => {
    const parts: Part[] = [];
    const node = sizer.firstChild;
    if (!node || node.nodeType !== 3) return parts;
    const text = (node as Text).data;
    let offset = 0;
    for (const part of splitGraphemes(text)) {
      const length = part.length;
      if (/\S/.test(part)) {
        range.setStart(node, offset);
        range.setEnd(node, offset + length);
        const box = range.getClientRects()[0];
        if (box && box.width > 0) {
          parts.push({
            text: shape(part),
            left: box.left - origin.left + padX,
            top: box.top - origin.top + padY,
            right: box.right - origin.left + padX,
            bottom: box.bottom - origin.top + padY,
          });
        }
      }
      offset += length;
    }
    return parts;
  };

  // Slovo → atlas se dvěma poli vzdáleností (ostré a rozmazané).
  const rasterize = (parts: Part[], font: string, ascent: number): WordField => {
    const field: WordField = { glyphs: [], texture: null, left: width / 2, right: width / 2, depth: 1 };
    if (!mctx || parts.length === 0) return field;
    const margin = Math.ceil(fontPx * 0.25);
    const size = Math.ceil(parts.length / MAX_GLYPHS);
    const cells: Cell[] = [];
    for (let i = 0; i < parts.length; i += size) {
      const group = parts.slice(i, i + size);
      cells.push({
        parts: group,
        left: Math.min(...group.map((part) => part.left)),
        top: Math.min(...group.map((part) => part.top)),
        right: Math.max(...group.map((part) => part.right)),
        bottom: Math.max(...group.map((part) => part.bottom)),
        ax: 0,
        ay: 0,
      });
    }
    const row = limit / ratio;
    let x = 0;
    let y = 0;
    let line = 0;
    let atlasWidth = 0;
    for (const cell of cells) {
      const w = cell.right - cell.left + margin * 2;
      const h = cell.bottom - cell.top + margin * 2;
      if (x > 0 && x + w > row) {
        x = 0;
        y += line;
        line = 0;
      }
      cell.ax = x;
      cell.ay = y;
      x += w;
      line = Math.max(line, h);
      atlasWidth = Math.max(atlasWidth, x);
    }
    const atlasHeight = y + line;
    const r = ratio * Math.min(1, limit / Math.max(1, atlasWidth * ratio), limit / Math.max(1, atlasHeight * ratio));
    const cw = Math.max(1, Math.ceil(atlasWidth * r));
    const ch = Math.max(1, Math.ceil(atlasHeight * r));
    mask.width = cw;
    mask.height = ch;
    mctx.setTransform(1, 0, 0, 1, 0, 0);
    mctx.clearRect(0, 0, cw, ch);
    mctx.setTransform(r, 0, 0, r, 0, 0);
    mctx.font = font;
    mctx.fillStyle = SNOW;
    mctx.textBaseline = "alphabetic";
    for (const cell of cells) {
      for (const part of cell.parts) {
        mctx.fillText(part.text, cell.ax + margin + part.left - cell.left, cell.ay + margin + part.top - cell.top + ascent);
      }
    }
    const sharp = signedField(mctx.getImageData(0, 0, cw, ch).data, cw, ch, r);
    const ceiling = margin * 0.92;
    let depth = 1;
    for (let i = 0; i < sharp.length; i++) {
      if (-sharp[i] > depth) depth = -sharp[i];
      if (sharp[i] > ceiling) sharp[i] = ceiling;
    }
    const radius = Math.max(1, fontPx * r * 0.05);
    const soft = boxBlur(boxBlur(boxBlur(sharp, cw, ch, radius), cw, ch, radius), cw, ch, radius);
    const data = new Uint16Array(cw * ch * 2);
    for (let i = 0; i < cw * ch; i++) {
      data[i * 2] = THREE.DataUtils.toHalfFloat(sharp[i]);
      data[i * 2 + 1] = THREE.DataUtils.toHalfFloat(soft[i]);
    }
    const texture = new THREE.DataTexture(data, cw, ch, THREE.RGFormat, THREE.HalfFloatType);
    texture.flipY = false;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;
    field.texture = texture;
    field.depth = depth;
    field.left = Math.min(...cells.map((cell) => cell.left));
    field.right = Math.max(...cells.map((cell) => cell.right));
    field.glyphs = cells.map((cell) => {
      const w = cell.right - cell.left + margin * 2;
      const h = cell.bottom - cell.top + margin * 2;
      return {
        text: cell.parts.map((part) => part.text).join(""),
        x: cell.left - margin,
        y: cell.top - margin,
        w,
        h,
        cx: (cell.left + cell.right) / 2,
        ax: cell.left,
        ay: cell.top,
        u: (cell.ax * r) / cw,
        v: (cell.ay * r) / ch,
        du: (w * r) / cw,
        dv: (h * r) / ch,
      };
    });
    return field;
  };

  const colours = () => {
    const ink = readColor(getComputedStyle(root).color) ?? [1, 1, 1, 1];
    uniforms.uInk.value.setRGB(ink[0], ink[1], ink[2], THREE.LinearSRGBColorSpace);
    uniforms.uInkAlpha.value = ink[3];
    const tint = readColor(settings.morphColor) ?? [1, 1, 1, 1];
    uniforms.uTint.value.setRGB(tint[0], tint[1], tint[2], THREE.LinearSRGBColorSpace);
  };

  const build = (force = false) => {
    if (destroyed) return;
    const rect = root.getBoundingClientRect();
    const style = getComputedStyle(root);
    fontPx = parseFloat(style.fontSize) || 16;
    // Snížené rozlišení šetří jen u velkého písma; malé (tlačítko) by se
    // v polovičním rozlišení rozmazalo, a jeho pole jsou levná i v plném.
    const q = fontPx < 48 ? 1 : clamp(settings.quality, 0.5, 1);
    const nextRatio = Math.min(window.devicePixelRatio || 1, 2) * q;
    padX = Math.ceil(fontPx * 0.25);
    padY = Math.ceil(fontPx * 0.3);
    // Šířka a výška z layoutu, ne z getBoundingClientRect — řádek nadpisu
    // se při vstupu posouvá, ale velikost slova se nemění.
    const nextWidth = Math.max(1, root.offsetWidth + padX * 2);
    const nextHeight = Math.max(1, root.offsetHeight + padY * 2);
    // Každé slovo smí mít vlastní řez (rovný → kurzíva): písmo se čte
    // z jeho vlastního prvku, ne z kořene.
    const fontOf = (el: HTMLElement) => {
      const s = getComputedStyle(el);
      return `${s.fontStyle} ${s.fontWeight} ${s.fontSize} ${s.fontFamily}`;
    };
    const texts = sizers().map((sizer) => `${sizer.textContent ?? ""}\u0002${fontOf(sizer)}`);
    const key = [nextWidth.toFixed(1), nextHeight.toFixed(1), nextRatio, texts.join("\u0001"), style.letterSpacing, style.textTransform].join("|");
    if (!force && key === fieldKey) return;
    fieldKey = key;
    generation++;
    width = nextWidth;
    height = nextHeight;
    ratio = nextRatio;
    cap = Math.ceil(fontPx * 0.25) * 0.92;
    canvas.style.left = `${-padX}px`;
    canvas.style.top = `${-padY}px`;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    renderer.setPixelRatio(1);
    renderer.setSize(Math.max(1, Math.round(width * ratio)), Math.max(1, Math.round(height * ratio)), false);
    uniforms.uSize.value.set(width, height);
    for (const word of words) word.texture?.dispose();
    words = [];
    if (!mctx) return;
    // Nadpis je verzálkami jen v CSS; v DOMu je text, jak ho napsal editor.
    const lang = document.documentElement.lang || undefined;
    const range = document.createRange();
    words = sizers().map((sizer) => {
      const s = getComputedStyle(sizer);
      const shape = (value: string) =>
        s.textTransform === "uppercase"
          ? value.toLocaleUpperCase(lang)
          : s.textTransform === "lowercase"
            ? value.toLocaleLowerCase(lang)
            : value;
      const font = fontOf(sizer);
      mctx.font = font;
      mctx.textBaseline = "alphabetic";
      const ascent = mctx.measureText("Hxg").fontBoundingBoxAscent || fontPx * 0.92;
      return rasterize(measure(sizer, rect, range, shape), font, ascent);
    });
    range.detach();
    colours();
  };

  const carry = (value: number, low: number, high: number, toLow: number, toHigh: number) => {
    const span = high - low;
    return span > 0.001 ? toLow + ((value - low) / span) * (toHigh - toLow) : (toLow + toHigh) / 2;
  };

  const hash = (n: number) => {
    const x = Math.sin(n * 12.9898 + seed * 78.233) * 43758.5453;
    return x - Math.floor(x);
  };

  const shuffle = (x: number) => {
    const i = Math.floor(x);
    const f = x - i;
    const e = f * f * (3 - 2 * f);
    return hash(i) * (1 - e) + hash(i + 1) * e;
  };

  const along = (word: WordField, x: number) => {
    const span = word.right - word.left;
    return span > 0.001 ? clamp((x - word.left) / span, 0, 1) : 0.5;
  };

  const progress = (u: number, t: number, knots: number) => {
    const stagger = clamp(settings.stagger, 0, 0.9);
    const from = settings.staggerFrom;
    const order =
      from === "end"
        ? 1 - u
        : from === "center"
          ? Math.abs(u - 0.5) * 2
          : from === "edges"
            ? 1 - Math.abs(u - 0.5) * 2
            : from === "random"
              ? shuffle(u * knots)
              : u;
    return smooth((t - order * stagger) / (1 - stagger));
  };

  const write = (row: number, index: number, glyph: Glyph, scale: number, a: number, b: number, act: number) => {
    const uv = (row * MAX_GLYPHS + index) * 4;
    glyphData[uv] = glyph.u;
    glyphData[uv + 1] = glyph.v;
    glyphData[uv + 2] = glyph.du;
    glyphData[uv + 3] = glyph.dv;
    const state = uv + MAX_GLYPHS * 4;
    glyphData[state] = scale;
    glyphData[state + 1] = a;
    glyphData[state + 2] = b;
    glyphData[state + 3] = act;
  };

  const put = (slot: THREE.Vector4, glyph: Glyph, dx: number, dy: number, scale: number) => {
    const mx = width / 2;
    const my = height / 2;
    slot.set(mx + (glyph.x + dx - mx) * scale, my + (glyph.y + dy - my) * scale, glyph.w * scale, glyph.h * scale);
  };

  const layout = (fromIndex: number, toIndex: number, t: number) => {
    const a = words[fromIndex] ?? null;
    const b = words[toIndex] ?? null;
    const blur = settings.morph === "blur";
    const travel = clamp(settings.travel, 0, 1);
    const zoom = clamp(settings.scale, -0.5, 0.5);
    const softness = clamp(settings.softness, 0, 1);
    const haze = softness * 0.14 * fontPx;
    const lift = fontPx * 0.12;
    const knots = Math.max(a ? a.glyphs.length : 0, b ? b.glyphs.length : 0, 2) - 1;
    // Bez párování (stejný text, jiný řez) se slévají všechna písmena —
    // spárované by se jen posunula a zůstala v řezu původního slova.
    if (a && b && settings.pairLetters) {
      const key = `${generation}:${fromIndex}:${toIndex}`;
      if (key !== planKey) {
        planKey = key;
        plan = pairUp(a.glyphs, b.glyphs, fontPx * 2.5);
      }
    } else plan = null;
    let countA = 0;
    if (a) {
      const reach = a.depth * 1.12 + 0.5;
      for (let i = 0; i < a.glyphs.length && countA < MAX_GLYPHS; i++) {
        const glyph = a.glyphs[i];
        const j = plan && b ? plan.pairs[i] : -1;
        const partner = j >= 0 && b ? b.glyphs[j] : null;
        if (partner && b) {
          const p = progress((along(a, glyph.cx) + along(b, partner.cx)) / 2, t, knots);
          put(uniforms.uRectA.value[countA], glyph, (partner.ax - glyph.ax) * p, (partner.ay - glyph.ay) * p, 1);
          write(0, countA, glyph, 1, 0, blur ? 1 : 0, Math.sin(Math.PI * p) * 0.35);
        } else {
          const e = ramp(0, 0.62, progress(along(a, glyph.cx), t, knots));
          const dx = b ? (carry(glyph.cx, a.left, a.right, b.left, b.right) - glyph.cx) * travel * e : 0;
          const scale = 1 + zoom * e;
          if (blur) {
            put(uniforms.uRectA.value[countA], glyph, dx, -lift * e, scale);
            write(0, countA, glyph, scale, haze * e, 1 - e, Math.sin(Math.PI * e) * 0.8);
          } else {
            put(uniforms.uRectA.value[countA], glyph, dx, 0, scale);
            write(0, countA, glyph, scale, ramp(0, 0.6, e) * softness, reach * Math.pow(e, 1.25), Math.sin(Math.PI * e));
          }
        }
        countA++;
      }
    }
    let countB = 0;
    if (b) {
      const reach = b.depth * 1.12 + 0.5;
      for (let j = 0; j < b.glyphs.length && countB < MAX_GLYPHS; j++) {
        if (plan && plan.taken[j]) continue;
        const glyph = b.glyphs[j];
        const p = progress(along(b, glyph.cx), t, knots);
        const e = a ? ramp(0.38, 1, p) : p;
        const rest = 1 - e;
        const dx = a ? (carry(glyph.cx, b.left, b.right, a.left, a.right) - glyph.cx) * travel * rest : 0;
        const scale = 1 - zoom * rest;
        if (blur) {
          put(uniforms.uRectB.value[countB], glyph, dx, lift * rest, scale);
          write(2, countB, glyph, scale, haze * rest, e, Math.sin(Math.PI * e) * 0.8);
        } else {
          put(uniforms.uRectB.value[countB], glyph, dx, 0, scale);
          write(2, countB, glyph, scale, rest * softness, reach * Math.pow(rest, 0.85), Math.sin(Math.PI * e));
        }
        countB++;
      }
    }
    uniforms.uCountA.value = countA;
    uniforms.uCountB.value = countB;
    glyphTexture.needsUpdate = true;
  };

  const draw = (fromIndex: number, toIndex: number, t: number) => {
    if (lost) return;
    layout(fromIndex, toIndex, t);
    uniforms.uAtlasA.value = words[fromIndex]?.texture ?? empty;
    uniforms.uAtlasB.value = words[toIndex]?.texture ?? empty;
    uniforms.uMode.value = settings.morph === "blur" ? 1 : 0;
    uniforms.uGoo.value = clamp(settings.goo, 0, 1) * fontPx;
    uniforms.uSwell.value = clamp(settings.swell, 0, 0.5) * fontPx;
    uniforms.uBand.value = Math.max(0.5, fontPx * 0.05);
    uniforms.uPixel.value = 1 / ratio;
    uniforms.uCap.value = cap;
    uniforms.uTintAmount.value = clamp(settings.tint, 0, 1);
    renderer.render(scene, camera);
  };

  const clear = () => {
    if (destroyed || lost) return;
    renderer.setRenderTarget(null);
    renderer.clear();
  };

  // Přeměření při změně velikosti a po dorazení písma.
  const resizer = new ResizeObserver(() => build());
  resizer.observe(root);
  document.fonts?.ready.then(() => build(true)).catch(() => {});
  build(true);

  return {
    build: () => build(true),
    morphTo: (fromIndex, toIndex, done) => {
      running?.stop();
      // Bez kontextu jen výměna (`done` hned, slovo ukáže DOM).
      if (lost) {
        done();
        return;
      }
      if (!words.length) build(true);
      seed += 1;
      finish = done;
      // Hodiny přechodu: framer animuje číslo 0 → 1, každý snímek se kreslí.
      running = animate(0, 1, {
        duration: clamp(settings.duration, 0.05, 10),
        ease: "linear",
        onUpdate: (t) => draw(fromIndex, toIndex, t),
        onComplete: () => {
          draw(fromIndex, toIndex, 1);
          running = null;
          finish = null;
          done();
        },
      });
    },
    clear,
    alive: () => !lost,
    destroy: () => {
      destroyed = true;
      running?.stop();
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      resizer.disconnect();
      for (const word of words) word.texture?.dispose();
      empty.dispose();
      glyphTexture.dispose();
      material.dispose();
      quad.geometry.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
}
