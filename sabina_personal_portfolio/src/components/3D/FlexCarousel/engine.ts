// FlexCarousel — shader a chování.
//
// Ploché karty v řadě, které celé projdou „čočkou": scéna se nejdřív
// vykreslí do textury a celoobrazovkový shader ji pak ohne kolem
// zaobleného obdélníku uprostřed (zakřivení okrajů, rozklad barev na
// hranách). Řada se táhne, hází setrvačností a dosedá na kartu.
//
// Převzato z React Bits „FlexCarousel" (ogl), převedeno do TypeScriptu a
// rozšířené o totéž co OrbitCards:
//  - ztlumení karet (dim) a slabší ztlumení karty pod myší (dimHover),
//  - hover sledovaný na window (nadpis hera ani jiné prvky nad galerií
//    ho nepřeruší),
//  - hlášení karty pod myší HTML vrstvě (../OrbitCards/overlay.ts).

import { Mesh, Plane, Program, RenderTarget, Renderer, Texture, Triangle } from "ogl";
import type { OverlayState } from "../OrbitCards/engine";
import { MARGIN, drawCardLayer } from "./hover";

export interface FlexItem {
  src: string;
  alt: string;
  title?: string;
  subtitle?: string;
  href?: string;
  /** Text tlačítka v panelu nad kartou. */
  cta?: string;
}

export type Curl = "twist" | "rise" | "fall";
export type IntroKind = "rise" | "bloom" | "spin" | "deal" | "fade" | "none";
export type Fit = "natural" | "portrait" | "square" | "landscape";

export interface FlexSettings {
  intro: IntroKind;
  /** Úvod čeká, dokud je `true` (scéna zůstane neviditelná). */
  hold: boolean;
  /** Rychlost úvodu (1 = výchozí délka, 2 = dvakrát rychleji). */
  introSpeed: number;
  cardHeight: number;
  gap: number;
  radius: number;
  fit: Fit;
  /** Pevný poměr karet šířka/výška (přebije `fit`), 0 = podle `fit`. */
  aspect: number;
  lensWidth: number;
  lensHeight: number;
  tilt: number;
  roundness: number;
  bend: number;
  reach: number;
  curl: Curl;
  dispersion: number;
  liquid: number;
  followCursor: boolean;
  squeeze: number;
  focusOnClick: boolean;
  autoplay: boolean;
  interval: number;
  captureWheel: boolean;
  dim: number;
  dimHover: number;
  /** Rozostření na okrajích čočky v px (kde se karty ohýbají). */
  edgeBlur: number;
  hover: boolean;
  /**
   * Posun řady ze scrollu jako podíl šířky kontejneru (typicky MotionValue
   * z useScroll). Přičítá se k poloze řady jen při kreslení — dojezd,
   * tažení i šipky dál pracují s vlastní polohou.
   */
  drift: { get: () => number } | null;
}

export interface FlexCallbacks {
  onActive: (index: number) => void;
  onRevealed: () => void;
  onFocusOpen: (open: boolean) => void;
  onSelect: (index: number) => void;
  onOverlay?: (state: OverlayState | null) => void;
  /**
   * Obdélníky všech kreslených karet (px vůči kontejneru, před ohybem čočky)
   * každý snímek — pro klikací boxy nad kartami (Studio, `editTarget`).
   */
  onBoxes?: (boxes: { index: number; left: number; top: number; right: number; bottom: number }[]) => void;
}

export interface FlexEngine {
  wake: () => void;
  setItems: (items: FlexItem[]) => void;
  /** Posun o kartu: 1 = další, -1 = předchozí (ruční ovládání). */
  step: (direction: number) => void;
  destroy: () => void;
}

export const BEND_PRESETS = {
  liquid: { lensWidth: 0.74, lensHeight: 1.18, tilt: 62, roundness: 1, bend: 0.34, reach: 0.38, curl: "twist", dispersion: 0.45, liquid: 0, followCursor: false },
  ribbon: { lensWidth: 0.8, lensHeight: 0.8, tilt: 0, roundness: 1, bend: 0.34, reach: 0.34, curl: "twist", dispersion: 0.4, liquid: 0, followCursor: false },
  vortex: { lensWidth: 0.7, lensHeight: 0.95, tilt: 30, roundness: 1, bend: 0.46, reach: 0.3, curl: "twist", dispersion: 0.5, liquid: 0, followCursor: false },
  arch: { lensWidth: 0.8, lensHeight: 0.8, tilt: 0, roundness: 1, bend: 0.3, reach: 0.36, curl: "rise", dispersion: 0.4, liquid: 0, followCursor: false },
} as const;

export type Preset = keyof typeof BEND_PRESETS;

const FIT_ASPECT: Partial<Record<Fit, number>> = { portrait: 0.75, square: 1, landscape: 4 / 3 };
const TAPS = 12;
const PIXEL_BUDGET = 4.5e6;
const INTRO_DURATION: Record<string, number> = { rise: 2.1, bloom: 1.6, spin: 2.2, deal: 1.5, fade: 0.35 };

const wrap = (value: number, size: number) => ((((value + size / 2) % size) + size) % size) - size / 2;
const clamp01 = (value: number) => Math.min(Math.max(value, 0), 1);
const easeOut = (value: number) => 1 - Math.pow(1 - clamp01(value), 3);
const easeOutQuint = (value: number) => 1 - Math.pow(1 - clamp01(value), 5);
const easeInOut = (value: number) => {
  const t = clamp01(value);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};

/* ---------- Shadery ---------- */

// Jedna karta = jeden obdélník v pixelech kontejneru (uRect: střed, rozměr).
const cardVertex = `#version 300 es
in vec3 position;
in vec2 uv;
uniform vec4 uRect;
uniform vec2 uResolution;
out vec2 vUv;
out vec2 vLocal;
void main() {
  vUv = uv;
  vLocal = vec2(position.x, -position.y) * uRect.zw;
  vec2 px = uRect.xy + vLocal;
  gl_Position = vec4(px.x / uResolution.x * 2.0 - 1.0, 1.0 - px.y / uResolution.y * 2.0, 0.0, 1.0);
}
`;

// Obrázek „cover" do karty s lehkou paralaxou (uShift) a zaoblenými rohy.
// uDim = černý překryv (ztlumení), u karty pod myší slabší.
const cardFragment = `#version 300 es
precision highp float;
uniform sampler2D tMap;
uniform vec2 uSize;
uniform vec2 uImage;
uniform float uRadius;
uniform float uAlpha;
uniform float uReady;
uniform float uShift;
uniform float uDpr;
uniform float uDim;
uniform vec3 uPlaceholder;
in vec2 vUv;
in vec2 vLocal;
out vec4 fragColor;

float roundedBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

void main() {
  float sd = roundedBox(vLocal, uSize * 0.5, min(uRadius, min(uSize.x, uSize.y) * 0.5));
  float mask = clamp(0.5 - sd * uDpr, 0.0, 1.0);
  vec2 local = vLocal / uSize + 0.5;
  float cardAspect = uSize.x / uSize.y;
  float imageAspect = uImage.x / max(uImage.y, 1.0);
  vec2 scale = imageAspect > cardAspect ? vec2(cardAspect / imageAspect, 1.0) : vec2(1.0, imageAspect / cardAspect);
  scale /= 1.08;
  vec2 uv = vec2(local.x, 1.0 - local.y);
  uv = (uv - 0.5) * scale + 0.5;
  uv.x += uShift * (1.0 - scale.x) * 0.5;
  vec3 image = texture(tMap, uv).rgb;
  vec3 color = mix(uPlaceholder, image, uReady) * (1.0 - uDim);
  float alpha = mask * uAlpha;
  fragColor = vec4(color * alpha, alpha);
}
`;

// Hover vrstva: textura z 2D plátna (hover.ts) natažená na obdélník.
// Plátno má nepremultiplikovanou alfu, blend čeká premultiplikovanou.
const hoverFragment = `#version 300 es
precision highp float;
uniform sampler2D tMap;
uniform vec2 uSize;
uniform float uAlpha;
in vec2 vLocal;
out vec4 fragColor;
void main() {
  vec2 local = vLocal / uSize + 0.5;
  vec4 c = texture(tMap, vec2(local.x, 1.0 - local.y));
  fragColor = vec4(c.rgb * c.a, c.a) * uAlpha;
}
`;

const lensVertex = `#version 300 es
in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

// Čočka: posune vzorkování scény podle vzdálenosti od okraje zaobleného
// obdélníku (superelipsa), stočí okraje a na hranách rozloží barvy.
const lensFragment = `#version 300 es
precision highp float;
uniform sampler2D tScene;
uniform vec2 uResolution;
uniform float uDpr;
uniform vec2 uCenter;
uniform vec2 uHalf;
uniform float uAngle;
uniform float uExponent;
uniform float uInner;
uniform float uOuter;
uniform float uFlow;
uniform float uCurl;
uniform float uDispersion;
uniform float uStrength;
uniform float uSceneAlpha;
uniform float uEdgeBlur;
out vec4 fragColor;

void main() {
  vec2 frag = gl_FragCoord.xy / uDpr;
  vec2 uv = frag / uResolution;
  vec2 rel = frag - vec2(uCenter.x, uResolution.y - uCenter.y);
  float ca = cos(uAngle);
  float sa = sin(uAngle);
  vec2 local = vec2(ca * rel.x + sa * rel.y, -sa * rel.x + ca * rel.y);
  vec2 k = max(abs(local) / uHalf, vec2(1e-5));
  float nd = pow(pow(k.x, uExponent) + pow(k.y, uExponent), 1.0 / uExponent);
  vec2 grad = pow(k, vec2(uExponent - 1.0)) * sign(local) / uHalf * pow(nd, 1.0 - uExponent);
  float glen = max(length(grad), 1e-6);
  float edge = (nd - 1.0) / glen;
  vec2 outward = grad / glen;
  vec2 normal = vec2(ca * outward.x - sa * outward.y, sa * outward.x + ca * outward.y);
  vec2 along = vec2(-normal.y, normal.x);

  float t = clamp((edge + uInner) / (uInner + uOuter), 0.0, 1.0);
  float ramp = t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
  float slope = 16.0 * t * t * (1.0 - t) * (1.0 - t);
  float reachX = rel.x / (uResolution.x * 0.5);
  float side = smoothstep(0.02, 0.3, abs(reachX)) * (uCurl == 0.0 ? sign(reachX) : uCurl);
  float lift = ramp * side * uFlow * uStrength;
  vec2 swirl = along * along.y * side * slope * uFlow * uStrength * 0.35;
  vec2 drift = vec2(0.0, -lift) - swirl;
  vec2 shifted = uv + drift / uResolution;

  vec2 texels = uResolution * uDpr;
  vec2 gx = dFdx(shifted);
  vec2 gy = dFdy(shifted);
  gx *= min(1.0, 3.0 / max(length(gx * texels), 1e-4));
  gy *= min(1.0, 3.0 / max(length(gy * texels), 1e-4));

  // Okraje čočky (kde se karty ohýbají) se rozostří — čím dál od středu,
  // tím víc. Mipmapy scény + pár vzorků kolem, ať blur nemá schody.
  // Od začátku ohybu (t), ne až od jeho konce (ramp) — ohnutí je vidět
  // dřív, než ramp vyroste.
  float blurPx = smoothstep(0.0, 0.55, t) * uEdgeBlur;
  vec4 color;
  if (blurPx > 0.6) {
    float lod = log2(max(blurPx * uDpr * 0.5, 1.0));
    vec2 r = vec2(blurPx) / uResolution * 0.6;
    color = textureLod(tScene, shifted, lod) * 0.36;
    color += textureLod(tScene, shifted + vec2(r.x, 0.0), lod) * 0.16;
    color += textureLod(tScene, shifted - vec2(r.x, 0.0), lod) * 0.16;
    color += textureLod(tScene, shifted + vec2(0.0, r.y), lod) * 0.16;
    color += textureLod(tScene, shifted - vec2(0.0, r.y), lod) * 0.16;
  } else {
    color = textureGrad(tScene, shifted, gx, gy);
  }
  vec2 spread = vec2(0.0, side * slope * uFlow * uStrength) / uResolution * uDispersion;
  float spreadPx = length(spread * texels);
  if (color.a > 0.002 && spreadPx > 0.25) {
    vec3 base = color.rgb / color.a;
    vec3 sumColor = vec3(0.0);
    vec3 sumWeight = vec3(0.0);
    for (int i = 0; i < ${TAPS}; i++) {
      float s = (float(i) + 0.5) / float(${TAPS});
      // Na rozostřeném okraji i rozklad barev vzorkuje rozostřeně.
      vec4 c = blurPx > 0.6
        ? textureLod(tScene, shifted + spread * (s - 0.5), log2(max(blurPx * uDpr * 0.5, 1.0)))
        : textureGrad(tScene, shifted + spread * (s - 0.5), gx, gy);
      vec3 w = max(1.0 - abs(vec3(s) - vec3(0.15, 0.5, 0.85)) * 2.6, 0.0) * c.a;
      sumColor += c.rgb * (w / max(c.a, 0.002));
      sumWeight += w;
    }
    vec3 split = mix(base, sumColor / max(sumWeight, vec3(1e-4)), clamp(sumWeight * 2.0, 0.0, 1.0));
    color.rgb = mix(color.rgb, clamp(split, 0.0, 1.0) * color.a, smoothstep(0.25, 1.5, spreadPx));
  }

  fragColor = color * uSceneAlpha;
}
`;

/* ---------- Chování ---------- */

interface Slot {
  item: FlexItem;
  index: number;
  texture: Texture;
  aspect: number;
  loaded: boolean;
  failed: boolean;
  ready: number;
  color: number[];
  image: [number, number];
  /** 0–1: hover (ztlumení dim → dimHover, rámeček výzvy). */
  focus: number;
  /** Kdy začal hover (ms) — dokreslení rámečku výzvy. */
  hoverAt: number;
  /** Textová vrstva karty: plátno → textura (hover.ts). */
  layerCanvas: HTMLCanvasElement;
  layerTexture: Texture;
  /** Pod čím je vrstva nakreslená — překreslí se jen při změně. */
  layerKey: string;
  dispose: () => void;
}

interface Metrics {
  cardH: number;
  widths: number[];
  centers: number[];
  gap: number;
  loop: number;
}

interface Instance {
  index: number;
  rel: number;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

type CardEffect = (rel: number) => { alpha: number; x: number; y: number; scale: number };

export function createFlexCarousel(
  container: HTMLElement,
  settingsRef: { current: FlexSettings | null },
  itemsRef: { current: FlexItem[] },
  callbacks: FlexCallbacks,
): FlexEngine | null {
  const renderer = new Renderer({
    dpr: Math.min(window.devicePixelRatio || 1, 2),
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
    depth: false,
  });
  const gl = renderer.gl;
  if (!renderer.isWebgl2) {
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return null;
  }
  gl.clearColor(0, 0, 0, 0);
  const canvas = gl.canvas as HTMLCanvasElement;
  canvas.style.display = "block";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.setAttribute("aria-hidden", "true");
  container.prepend(canvas);

  const cardProgram = new Program(gl, {
    vertex: cardVertex,
    fragment: cardFragment,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      tMap: { value: new Texture(gl) },
      uRect: { value: [0, 0, 1, 1] },
      uResolution: { value: [1, 1] },
      uSize: { value: [1, 1] },
      uImage: { value: [1, 1] },
      uRadius: { value: 16 },
      uAlpha: { value: 1 },
      uReady: { value: 0 },
      uShift: { value: 0 },
      uDpr: { value: 1 },
      uDim: { value: 0 },
      uPlaceholder: { value: [0.5, 0.5, 0.5] },
    },
  });
  cardProgram.setBlendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  const cardMesh = new Mesh(gl, { geometry: new Plane(gl), program: cardProgram });

  // Textová vrstva karet: každá karta má vlastní plátno → texturu
  // (Slot.layer*), kreslí se přes kartu do téže render target, takže ji
  // čočka ohne s kartou. Program a obdélník jsou společné.
  const hoverProgram = new Program(gl, {
    vertex: cardVertex,
    fragment: hoverFragment,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      tMap: { value: new Texture(gl) },
      uRect: { value: [0, 0, 1, 1] },
      uResolution: { value: [1, 1] },
      uSize: { value: [1, 1] },
      uAlpha: { value: 0 },
    },
  });
  hoverProgram.setBlendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  const hoverMesh = new Mesh(gl, { geometry: new Plane(gl), program: hoverProgram });
  const hoverFont = getComputedStyle(container).fontFamily || "sans-serif";
  const cu = cardProgram.uniforms;

  const target = new RenderTarget(gl, {
    width: 2,
    height: 2,
    depth: false,
    minFilter: gl.LINEAR_MIPMAP_LINEAR,
    magFilter: gl.LINEAR,
  });

  const lensUniforms = {
    tScene: { value: target.texture },
    uResolution: { value: [1, 1] },
    uDpr: { value: 1 },
    uCenter: { value: [0, 0] },
    uHalf: { value: [1, 1] },
    uAngle: { value: 0 },
    uExponent: { value: 2 },
    uInner: { value: 60 },
    uOuter: { value: 80 },
    uFlow: { value: 0 },
    uCurl: { value: 0 },
    uDispersion: { value: 0 },
    uStrength: { value: 0 },
    uSceneAlpha: { value: 0 },
    uEdgeBlur: { value: 0 },
  };
  const lensMesh = new Mesh(gl, {
    geometry: new Triangle(gl),
    program: new Program(gl, {
      vertex: lensVertex,
      fragment: lensFragment,
      uniforms: lensUniforms,
      depthTest: false,
      depthWrite: false,
    }),
  });

  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  const anisotropy = renderer.getExtension("EXT_texture_filter_anisotropic") ? 8 : 0;

  let slots: Slot[] = [];
  let width = 1;
  let height = 1;
  let pos = 0;
  let vel = 0;
  let goal = 0;
  let mode: "spring" | "wheel" = "spring";
  let wheelAt = 0;
  let raf = 0;
  let last = performance.now();
  let visible = true;
  let alive = true;
  let dirty = true;
  let activeIndex = -1;
  let interactedAt = -Infinity;
  let autoplayAt = performance.now();
  let hasFocus = false;
  let deform = 0;
  let deformVel = 0;
  let layout: Metrics | null = null;
  let resnap = false;
  let hover = "";
  let lift = 1;
  let energy = 0;
  let lastPos = 0;
  // Karta pod myší (index slotu) a karta, kterou ukazuje HTML vrstva —
  // ta drží i během doběhu hoveru.
  let hoverSlot: number | null = null;
  let overlaySlot: number | null = null;
  // Rovná část čočky (střed a půlšířka v px). Hover bere jen karty, jejichž
  // střed leží v ní — na ohnutých kartách by rámeček neseděl.

  const lens = { x: 0, y: 0, vx: 0, vy: 0, ready: false };
  const pointer = {
    x: 0,
    y: 0,
    over: false,
    down: false,
    id: -1,
    startX: 0,
    startY: 0,
    startPos: 0,
    dragging: false,
    touch: false,
    samples: [] as { x: number; t: number }[],
  };
  const introState = { kind: "none" as IntroKind, t: 0, running: false, done: false, readyAt: 0 };
  const focus = { index: -1, pending: -1, t: 0, v: 0, target: 0 };
  let instances: Instance[] = [];

  const loadSlot = (item: FlexItem, index: number): Slot => {
    const texture = new Texture(gl, {
      generateMipmaps: true,
      minFilter: gl.LINEAR_MIPMAP_LINEAR,
      magFilter: gl.LINEAR,
      anisotropy,
    });
    const slot: Slot = {
      item,
      index,
      texture,
      aspect: 0.8,
      loaded: false,
      failed: false,
      ready: 0,
      color: [0.5, 0.5, 0.5],
      image: [1, 1],
      focus: 0,
      hoverAt: 0,
      layerCanvas: document.createElement("canvas"),
      layerTexture: new Texture(gl, { generateMipmaps: false, minFilter: gl.LINEAR, magFilter: gl.LINEAR }),
      layerKey: "",
      dispose: () => {},
    };
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.decoding = "async";
    image.onload = () => {
      if (!alive || !slots.includes(slot)) return;
      texture.image = image;
      texture.update();
      slot.image = [image.naturalWidth || 1, image.naturalHeight || 1];
      slot.aspect = slot.image[0] / slot.image[1];
      try {
        const probe = document.createElement("canvas");
        probe.width = 8;
        probe.height = 8;
        const ctx = probe.getContext("2d", { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(image, 0, 0, 8, 8);
          const data = ctx.getImageData(0, 0, 8, 8).data;
          const avg = [0, 0, 0];
          for (let i = 0; i < data.length; i += 4) {
            avg[0] += data[i];
            avg[1] += data[i + 1];
            avg[2] += data[i + 2];
          }
          slot.color = avg.map((v) => v / 64 / 255);
        }
      } catch {
        slot.color = [0.5, 0.5, 0.5];
      }
      slot.loaded = true;
      dirty = true;
      start();
    };
    image.onerror = () => {
      if (!alive) return;
      slot.failed = true;
      dirty = true;
      start();
    };
    image.src = item.src;
    slot.dispose = () => {
      image.onload = null;
      image.onerror = null;
      gl.deleteTexture(texture.texture);
      gl.deleteTexture(slot.layerTexture.texture);
    };
    return slot;
  };

  const setItems = (next: FlexItem[]) => {
    slots.forEach((slot) => slot.dispose());
    slots = next.map(loadSlot);
    activeIndex = -1;
    layout = null;
    resnap = true;
    focus.target = 0;
    focus.t = 0;
    focus.v = 0;
    focus.pending = -1;
    hoverSlot = null;
    overlaySlot = null;
    callbacks.onFocusOpen(false);
    introState.readyAt = performance.now();
    dirty = true;
    start();
  };

  const metrics = (s: FlexSettings): Metrics => {
    const cardH = Math.max(24, s.cardHeight * height);
    // Obrázek se do karty vždy ořízne „cover" (shader), takže pevný poměr
    // nic nedeformuje — jen ořízne přesah.
    const fixed = s.aspect > 0 ? s.aspect : FIT_ASPECT[s.fit];
    const widths = slots.map((slot) => (fixed || slot.aspect) * cardH);
    const centers: number[] = [];
    let cursor = 0;
    for (let i = 0; i < widths.length; i++) {
      centers.push(cursor + widths[i] / 2);
      cursor += widths[i] + s.gap;
    }
    return { cardH, widths, centers, gap: s.gap, loop: Math.max(cursor, 1) };
  };

  const nearest = (m: Metrics, at: number) => {
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < m.centers.length; i++) {
      const dist = Math.abs(wrap(m.centers[i] - at, m.loop));
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    }
    return best;
  };

  const snapPoint = (m: Metrics, at: number) => {
    const i = nearest(m, at);
    return at + wrap(m.centers[i] - at, m.loop);
  };

  const remap = (from: Metrics, to: Metrics, at: number) => {
    const i = nearest(from, at);
    const offset = wrap(at - from.centers[i], from.loop);
    const cycles = Math.round((at - offset - from.centers[i]) / from.loop);
    return cycles * to.loop + to.centers[i] + offset * (to.widths[i] / from.widths[i]);
  };

  const step = (m: Metrics, delta: number) => {
    let at = snapPoint(m, goal);
    let index = nearest(m, at);
    const n = m.centers.length;
    for (let k = 0; k < Math.abs(delta); k++) {
      const next = (index + (delta > 0 ? 1 : n - 1)) % n;
      const distance =
        delta > 0
          ? m.widths[index] / 2 + m.gap + m.widths[next] / 2
          : -(m.widths[next] / 2 + m.gap + m.widths[index] / 2);
      at += distance;
      index = next;
    }
    goal = at;
    mode = "spring";
    dirty = true;
    start();
  };

  const goTo = (m: Metrics, index: number) => {
    const i = ((index % m.centers.length) + m.centers.length) % m.centers.length;
    goal = goal + wrap(m.centers[i] - goal, m.loop);
    mode = "spring";
    dirty = true;
    start();
  };

  const openFocus = (index: number) => {
    focus.index = index;
    focus.pending = -1;
    focus.target = 1;
    callbacks.onFocusOpen(true);
    dirty = true;
    start();
  };

  const closeFocus = () => {
    focus.pending = -1;
    if (focus.target === 0) return false;
    focus.target = 0;
    callbacks.onFocusOpen(false);
    dirty = true;
    start();
    return true;
  };

  const skipIntro = () => {
    if (introState.running) introState.t = 1;
  };

  const introEffects = () => {
    const t = introState.running ? introState.t : introState.done ? 1 : 0;
    const e: { sceneAlpha: number; strength: number; card: CardEffect | null } = {
      sceneAlpha: 1,
      strength: 1,
      card: null,
    };
    if (!introState.done && !introState.running) {
      e.sceneAlpha = 0;
      e.strength = 0;
      return e;
    }
    if (t >= 1) return e;
    const kind = introState.kind;
    if (kind === "rise") {
      e.strength = easeInOut((t - 0.3) / 0.65);
      e.card = (rel) => {
        const delay = Math.min(Math.abs(rel) / (width * 0.6), 1) * 0.34;
        const local = clamp01((t - delay) / 0.6);
        return {
          alpha: clamp01(local * 4),
          x: 0,
          y: (1 - easeOutQuint(local)) * height * 0.62,
          scale: 0.5 + 0.5 * easeInOut((local - 0.18) / 0.82),
        };
      };
    } else if (kind === "bloom") {
      e.strength = easeInOut((t - 0.2) / 0.8);
      e.card = (rel) => {
        const delay = Math.min(Math.abs(rel) / (width * 0.6), 1) * 0.25;
        const local = easeOut((t - delay) / 0.55);
        return { alpha: local, x: 0, y: 0, scale: 0.92 + 0.08 * local };
      };
    } else if (kind === "spin") {
      e.sceneAlpha = easeOut(t / 0.25);
      e.strength = easeOut((t - 0.55) / 0.45);
    } else if (kind === "deal") {
      e.strength = easeOut((t - 0.45) / 0.5);
      e.card = (rel) => {
        const spread = Math.min(Math.abs(rel) / (width * 0.6), 1) * 0.3;
        const local = easeOut((t - 0.12 - spread) / 0.5);
        return { alpha: easeOut((t - spread) / 0.12), x: -rel * (1 - local), y: 0, scale: 1 };
      };
    } else {
      e.sceneAlpha = easeOut(t);
      e.strength = easeOut(t);
    }
    return e;
  };

  const beginIntro = (s: FlexSettings, m: Metrics) => {
    const kind: IntroKind = reducedMotion && s.intro !== "none" ? "fade" : s.intro;
    introState.kind = INTRO_DURATION[kind] ? kind : "none";
    introState.running = introState.kind !== "none";
    introState.done = !introState.running;
    introState.t = 0;
    if (introState.done) callbacks.onRevealed();
    if (introState.kind === "spin") {
      const distance = m.loop * 1.6 + width;
      pos = goal + distance;
      vel = -distance * 3;
      mode = "spring";
    }
  };

  const resize = () => {
    width = Math.max(1, container.clientWidth);
    height = Math.max(1, container.clientHeight);
    renderer.dpr = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(PIXEL_BUDGET / (width * height)));
    renderer.setSize(width, height);
    target.setSize(Math.max(2, Math.round(width * renderer.dpr)), Math.max(2, Math.round(height * renderer.dpr)));
    lensUniforms.tScene.value = target.texture;
    dirty = true;
    start();
  };

  // Karta pod myší pro HTML vrstvu: obdélník instance, která je nejblíž
  // středu (karty se ve smyčce opakují). y dolů, px vůči kontejneru.
  const emitOverlay = () => {
    if (!callbacks.onOverlay) return;
    let slot = hoverSlot !== null ? hoverSlot : overlaySlot;
    if (slot !== null && (slot >= slots.length || (slot !== hoverSlot && slots[slot].focus < 0.005)))
      slot = null;
    overlaySlot = slot;
    if (slot === null) {
      callbacks.onOverlay(null);
      return;
    }
    let best: Instance | null = null;
    for (const inst of instances) {
      if (inst.index !== slot) continue;
      if (!best || Math.abs(inst.rel) < Math.abs(best.rel)) best = inst;
    }
    if (!best) {
      callbacks.onOverlay(null);
      return;
    }
    callbacks.onOverlay({
      item: slot,
      box: { left: best.x0, top: best.y0, right: best.x1, bottom: best.y1 },
      anchor: { x: best.x0, y: best.y1, angle: 0, width: best.x1 - best.x0 },
      focus: slots[slot].focus,
      natural: { width: slots[slot].image[0], height: slots[slot].image[1] },
    });
  };

  const frame = (now: number) => {
    raf = 0;
    if (!alive) return;
    const s = settingsRef.current;
    const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
    last = now;
    if (!s || !slots.length) {
      if (visible) raf = requestAnimationFrame(frame);
      return;
    }

    const m = metrics(s);
    const n = slots.length;
    let animating = false;

    if (resnap) {
      goal = snapPoint(m, goal);
      pos = goal;
      vel = 0;
      resnap = false;
    } else if (layout && layout.loop !== m.loop) {
      pos = remap(layout, m, pos);
      goal = remap(layout, m, goal);
      pointer.startPos = pos + (pointer.x - pointer.startX);
      animating = true;
    }
    layout = m;

    if (!introState.running && !introState.done && !s.hold) {
      const allSettled = slots.every((slot) => slot.loaded || slot.failed);
      if (allSettled || now - introState.readyAt > 3500) {
        goal = snapPoint(m, goal);
        pos = goal;
        beginIntro(s, m);
      }
    }
    if (introState.running) {
      introState.t = Math.min(1, introState.t + (dt * (s.introSpeed || 1)) / (INTRO_DURATION[introState.kind] || 1));
      if (introState.t >= 1) {
        introState.running = false;
        introState.done = true;
        callbacks.onRevealed();
      }
      animating = true;
    }

    if (mode === "wheel" && now - wheelAt > 150) {
      goal = snapPoint(m, goal);
      mode = "spring";
    }
    if (!pointer.dragging) {
      const spinning = introState.running && introState.kind === "spin";
      const stiffness = spinning ? 9 : mode === "wheel" ? 80 : 55;
      const damping = 2 * Math.sqrt(stiffness);
      const steps = Math.ceil(dt / (1 / 240));
      const h = dt / steps;
      for (let i = 0; i < steps; i++) {
        const acc = stiffness * (goal - pos) - damping * vel;
        vel += acc * h;
        pos += vel * h;
      }
      if (Math.abs(goal - pos) < 0.05 && Math.abs(vel) < 0.5) {
        pos = goal;
        vel = 0;
      } else {
        animating = true;
      }
    } else {
      animating = true;
    }

    if (Math.abs(pos) > m.loop * 8) {
      const shift = Math.round(pos / m.loop) * m.loop;
      pos -= shift;
      goal -= shift;
      pointer.startPos -= shift;
    }

    // Poloha, ve které se řada KRESLÍ: vlastní poloha + posun ze scrollu.
    const shown = pos + (s.drift ? s.drift.get() * width : 0);
    const current = nearest(m, shown);
    if (current !== activeIndex) {
      activeIndex = current;
      callbacks.onActive(current);
    }

    if (focus.pending >= 0 && mode === "spring" && Math.abs(goal - pos) < 1.5 && Math.abs(vel) < 30) {
      if (current === focus.pending) openFocus(current);
      else focus.pending = -1;
    }

    if (
      s.autoplay &&
      !reducedMotion &&
      introState.done &&
      focus.target === 0 &&
      focus.t < 0.01 &&
      !pointer.over &&
      !pointer.down &&
      !hasFocus &&
      mode === "spring" &&
      Math.abs(goal - pos) < 1 &&
      now - interactedAt > 3000 &&
      now - autoplayAt > s.interval * 1000
    ) {
      autoplayAt = now;
      step(m, 1);
    }
    if (s.autoplay && !reducedMotion) animating = true;

    const travel = Math.abs(pos - lastPos) / dt;
    lastPos = pos;
    const energyTarget = reducedMotion ? 0 : Math.min(travel / 2600, 1);
    energy += (energyTarget - energy) * (1 - Math.exp(-dt / (energyTarget > energy ? 0.07 : 0.35)));
    if (energy > 0.001) animating = true;
    const liquidAmount = reducedMotion ? 0 : s.liquid;
    const push = Math.max(-1, Math.min(1, vel / 2200));
    const deformStiffness = 120;
    const deformDamping = 2 * Math.sqrt(deformStiffness) * 0.32;
    deformVel += (deformStiffness * (push - deform) - deformDamping * deformVel) * dt;
    deform += deformVel * dt;
    if (Math.abs(deform) > 0.0005 || Math.abs(deformVel) > 0.005) animating = true;

    const focusStiffness = 64;
    focus.v += (focusStiffness * (focus.target - focus.t) - 2 * Math.sqrt(focusStiffness) * focus.v) * dt;
    focus.t += focus.v * dt;
    if (Math.abs(focus.target - focus.t) < 0.0005 && Math.abs(focus.v) < 0.001) {
      focus.t = focus.target;
      focus.v = 0;
    } else {
      animating = true;
    }
    const focusAmount = clamp01(focus.t);
    const focusEase = easeInOut(focusAmount);
    const focusW = focus.index >= 0 && focus.index < n ? m.widths[focus.index] : m.cardH;
    const focusScale = Math.max(1, Math.min(1.3, (height * 0.84) / m.cardH, (width * 0.92) / focusW));
    const nextLift = 1 + (focusScale - 1) * focusEase;
    if (Math.abs(nextLift - lift) > 0.0005) {
      lift = nextLift;
      container.style.setProperty("--flex-carousel-lift", lift.toFixed(4));
    }

    // Hover: karta pod myší náběhne do „focus" (slabší ztlumení), ostatní
    // doběhnou zpět. Ne během tažení, úvodu ani přiblížení po kliknutí.
    const hoverable = s.hover && introState.done && !pointer.dragging && focus.target === 0;
    if (!hoverable) hoverSlot = null;
    for (let i = 0; i < n; i++) {
      const slot = slots[i];
      if (slot.loaded && slot.ready < 1) {
        slot.ready = Math.min(1, slot.ready + dt / 0.45);
        animating = true;
      }
      const goalFocus = i === hoverSlot ? 1 : 0;
      slot.focus += (goalFocus - slot.focus) * (reducedMotion ? 1 : 1 - Math.exp(-dt / 0.16));
      if (Math.abs(goalFocus - slot.focus) > 1e-3) animating = true;
      else slot.focus = goalFocus;
      // Rámeček má živé drobky a obíhající tečky — dokud je vidět, kreslí se.
      if (slot.focus > 0.005) animating = true;
    }

    const effects = introEffects();

    const homeX = width / 2;
    const homeY = height / 2;
    const follow = s.followCursor && pointer.over && !pointer.dragging && !pointer.touch && focus.target === 0;
    const aimX = follow ? pointer.x : homeX;
    const aimY = follow ? pointer.y : homeY;
    if (!lens.ready) {
      lens.x = homeX;
      lens.y = homeY;
      lens.ready = true;
    }
    const lensK = 110;
    const lensC = 2 * Math.sqrt(lensK) * 0.8;
    lens.vx += (lensK * (aimX - lens.x) - lensC * lens.vx) * dt;
    lens.vy += (lensK * (aimY - lens.y) - lensC * lens.vy) * dt;
    lens.x += lens.vx * dt;
    lens.y += lens.vy * dt;
    if (Math.abs(aimX - lens.x) + Math.abs(aimY - lens.y) > 0.2 || Math.abs(lens.vx) + Math.abs(lens.vy) > 0.5)
      animating = true;

    const cardH = m.cardH;
    let halfW = (s.lensWidth * width) / 2;
    let halfH = (s.lensHeight * width) / 2;
    const squash = Math.abs(deform) * liquidAmount;
    halfW *= 1 + squash * 0.16;
    halfH *= 1 - squash * 0.08;
    const lensX = lens.x - deform * 14 * liquidAmount;

    const waiting = !introState.done;
    if (dirty || animating || pointer.dragging) {
      dirty = false;
      instances = [];
      const dpr = renderer.dpr;
      cu.uResolution.value = [width, height];
      cu.uDpr.value = dpr;
      cu.uRadius.value = s.radius;
      const shrink = 1 - clamp01(s.squeeze) * energy;
      const draws: { i: number; rel: number; x: number; y: number; cw: number; ch: number; alpha: number }[] = [];
      for (let i = 0; i < n; i++) {
        const w = m.widths[i];
        const baseRel = wrap(m.centers[i] - shown, m.loop);
        for (let k = -3; k <= 3; k++) {
          const rel = baseRel + k * m.loop;
          if (Math.abs(rel) - w / 2 > width + 40) continue;
          const fx = effects.card ? effects.card(rel) : null;
          let x = homeX + rel + (fx ? fx.x : 0);
          let scale = shrink * (fx ? fx.scale : 1);
          let alpha = fx ? fx.alpha : 1;
          if (focusAmount > 0) {
            if (i === focus.index && Math.abs(rel) < w) {
              scale *= 1 + (focusScale - 1) * focusEase;
            } else {
              const order = Math.min(Math.abs(rel) / width, 1) * 0.25;
              const part = easeInOut(focusAmount * 1.25 - order);
              x += Math.sign(rel) * part * width * 0.7;
              alpha *= 1 - part;
            }
          }
          const cw = w * scale;
          if (alpha <= 0.001 || x + cw / 2 < -40 || x - cw / 2 > width + 40) continue;
          draws.push({ i, rel, x, y: homeY + (fx ? fx.y : 0), cw, ch: cardH * scale, alpha });
        }
      }
      draws.sort((a, b) => Math.abs(b.rel) - Math.abs(a.rel));
      let first = true;
      const dimBase = clamp01(s.dim);
      const dimHover = clamp01(s.dimHover);
      for (const draw of draws) {
        const slot = slots[draw.i];
        cu.tMap.value = slot.texture;
        cu.uRect.value = [draw.x, draw.y, draw.cw + 2, draw.ch + 2];
        cu.uSize.value = [draw.cw, draw.ch];
        cu.uImage.value = slot.image;
        cu.uAlpha.value = draw.alpha;
        cu.uReady.value = slot.ready;
        cu.uShift.value = reducedMotion ? 0 : Math.max(-1, Math.min(1, draw.rel / (width * 0.75)));
        cu.uDim.value = dimBase + (dimHover - dimBase) * slot.focus;
        cu.uPlaceholder.value = slot.color;
        renderer.render({ scene: cardMesh, target, clear: first });
        first = false;

        // Textová vrstva karty (název, obor, výzva — vždy vidět). Kreslí
        // se v základní velikosti karty a překreslí jen při změně rozměru
        // nebo během hoveru (rámeček výzvy je živý).
        const baseW = Math.round(m.widths[draw.i]);
        const baseH = Math.round(cardH);
        const live = slot.focus > 0.002;
        const key = `${baseW}x${baseH}@${dpr}${live ? "" : ":idle"}`;
        if (live || key !== slot.layerKey) {
          drawCardLayer(slot.layerCanvas, {
            item: slot.item,
            index: draw.i,
            cw: baseW,
            ch: baseH,
            focus: slot.focus,
            natural: slot.image,
            since: reducedMotion ? 10 : (now - slot.hoverAt) / 1000,
            time: now / 1000,
            dpr,
            font: hoverFont,
          });
          slot.layerTexture.image = slot.layerCanvas;
          slot.layerTexture.needsUpdate = true;
          slot.layerKey = key;
        }
        // Vrstva se škáluje spolu s kartou (zmáčknutí, úvod).
        const k = draw.cw / Math.max(baseW, 1);
        const hu = hoverProgram.uniforms;
        hu.tMap.value = slot.layerTexture;
        hu.uResolution.value = [width, height];
        hu.uRect.value = [draw.x, draw.y, (baseW + MARGIN * 2) * k, (baseH + MARGIN * 2) * k];
        hu.uSize.value = [(baseW + MARGIN * 2) * k, (baseH + MARGIN * 2) * k];
        hu.uAlpha.value = draw.alpha * slot.ready;
        renderer.render({ scene: hoverMesh, target, clear: false });
        instances.push({
          index: draw.i,
          rel: draw.rel,
          x0: draw.x - draw.cw / 2,
          x1: draw.x + draw.cw / 2,
          y0: draw.y - draw.ch / 2,
          y1: draw.y + draw.ch / 2,
        });
      }
      if (first) {
        renderer.bindFramebuffer(target);
        gl.viewport(0, 0, target.width, target.height);
        gl.clear(gl.COLOR_BUFFER_BIT);
      }

      renderer.bindFramebuffer();
      target.texture.bind();
      gl.generateMipmap(gl.TEXTURE_2D);

      lensUniforms.uResolution.value = [width, height];
      lensUniforms.uDpr.value = dpr;
      lensUniforms.uCenter.value = [lensX, lens.y];
      lensUniforms.uHalf.value = [Math.max(halfW, 1), Math.max(halfH, 1)];
      lensUniforms.uAngle.value = (s.tilt * Math.PI) / 180;
      lensUniforms.uExponent.value = 2 + Math.pow(1 - clamp01(s.roundness), 1.5) * 10;
      const spanW = Math.max(halfW, 1);
      const spanH = Math.max(halfH, 1);
      const inner = Math.max(4, s.reach * (spanW + spanH) * 0.5);
      lensUniforms.uInner.value = inner;
      lensUniforms.uOuter.value = inner * 1.6;
      // Ohyb začíná `inner` před okrajem čočky — do té doby jsou karty rovné.

      lensUniforms.uFlow.value = s.bend * (spanW + spanH) * 0.45;
      lensUniforms.uCurl.value = s.curl === "rise" ? 1 : s.curl === "fall" ? -1 : 0;
      lensUniforms.uDispersion.value = s.dispersion * 0.12 * (1 + Math.abs(deform) * liquidAmount * 1.2);
      lensUniforms.uStrength.value = effects.strength * (1 - focusEase);
      lensUniforms.uSceneAlpha.value = effects.sceneAlpha;
      lensUniforms.uEdgeBlur.value = reducedMotion ? 0 : Math.max(s.edgeBlur, 0);
      renderer.render({ scene: lensMesh });

      emitOverlay();
      callbacks.onBoxes?.(
        instances.map((inst) => ({ index: inst.index, left: inst.x0, top: inst.y0, right: inst.x1, bottom: inst.y1 })),
      );
    }

    let nextHover = "";
    if (pointer.over && !pointer.dragging && introState.done && s.focusOnClick) {
      const hit = instances.find(
        (inst) => pointer.x >= inst.x0 && pointer.x <= inst.x1 && pointer.y >= inst.y0 && pointer.y <= inst.y1,
      );
      if (focus.target > 0) nextHover = "close";
      else if (hit) nextHover = "open";
    }
    if (nextHover !== hover) {
      hover = nextHover;
      if (hover) container.setAttribute("data-hover", hover);
      else container.removeAttribute("data-hover");
    }

    if (visible && (animating || waiting || dirty || pointer.down)) raf = requestAnimationFrame(frame);
  };

  function start() {
    if (raf || !visible || !alive) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  const localPoint = (e: PointerEvent | MouseEvent): [number, number] => {
    const rect = container.getBoundingClientRect();
    return [e.clientX - rect.left, e.clientY - rect.top];
  };

  // Nejvrchnější instance pod bodem (kreslí se odzadu, poslední je nahoře).
  const hitAt = (x: number, y: number) => {
    for (let k = instances.length - 1; k >= 0; k--) {
      const inst = instances[k];
      if (x >= inst.x0 && x <= inst.x1 && y >= inst.y0 && y <= inst.y1) return inst;
    }
    return null;
  };

  // Hover na WINDOW: nad galerií leží prvky stránky (nadpis hera, HTML
  // panel) — hover z událostí kontejneru by každý z nich přerušil.
  const onHover = (e: PointerEvent) => {
    if (e.pointerType === "touch" || pointer.dragging) return;
    const [x, y] = localPoint(e);
    const inside = x >= 0 && y >= 0 && x <= width && y <= height;
    const hit = inside ? hitAt(x, y) : null;
    const next = hit ? hit.index : null;
    if (next !== hoverSlot) {
      hoverSlot = next;
      if (next !== null && slots[next]) slots[next].hoverAt = performance.now();
      dirty = true;
      start();
    }
  };

  const onPageLeave = () => {
    if (hoverSlot === null) return;
    hoverSlot = null;
    dirty = true;
    start();
  };

  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== undefined && e.button > 0) return;
    skipIntro();
    const [x, y] = localPoint(e);
    pointer.down = true;
    pointer.id = e.pointerId;
    pointer.touch = e.pointerType === "touch";
    pointer.startX = x;
    pointer.startY = y;
    pointer.x = x;
    pointer.y = y;
    pointer.startPos = pos;
    pointer.dragging = false;
    pointer.samples = [{ x, t: performance.now() }];
    interactedAt = performance.now();
    if (Math.abs(vel) > 40) {
      goal = pos;
      vel = 0;
    }
    dirty = true;
    start();
  };

  const onPointerMove = (e: PointerEvent) => {
    const [x, y] = localPoint(e);
    pointer.x = x;
    pointer.y = y;
    pointer.over = true;
    if (pointer.down && e.pointerId === pointer.id) {
      const dx = x - pointer.startX;
      const dy = y - pointer.startY;
      const slop = pointer.touch ? 10 : 5;
      if (!pointer.dragging) {
        if (pointer.touch && Math.abs(dy) > slop && Math.abs(dy) > Math.abs(dx)) {
          pointer.down = false;
          return;
        }
        if (Math.abs(dx) > slop) {
          pointer.dragging = true;
          pointer.startX = x;
          pointer.startPos = pos;
          hoverSlot = null;
          closeFocus();
          try {
            container.setPointerCapture(e.pointerId);
          } catch {
            pointer.dragging = true;
          }
          container.setAttribute("data-dragging", "");
        }
      }
      if (pointer.dragging) {
        pos = pointer.startPos - (x - pointer.startX);
        goal = pos;
        vel = 0;
        const now = performance.now();
        pointer.samples.push({ x, t: now });
        while (pointer.samples.length > 2 && now - pointer.samples[0].t > 100) pointer.samples.shift();
      }
    }
    dirty = true;
    start();
  };

  const onPointerUp = (e: PointerEvent) => {
    if (!pointer.down || e.pointerId !== pointer.id) return;
    pointer.down = false;
    container.removeAttribute("data-dragging");
    const s = settingsRef.current;
    if (!s) return;
    const m = metrics(s);
    interactedAt = performance.now();
    if (pointer.dragging) {
      pointer.dragging = false;
      const now = performance.now();
      const firstSample = pointer.samples[0];
      const lastSample = pointer.samples[pointer.samples.length - 1];
      let velocity = 0;
      if (firstSample && lastSample && lastSample.t > firstSample.t && now - lastSample.t < 70) {
        velocity = -((lastSample.x - firstSample.x) / (lastSample.t - firstSample.t)) * 1000;
      }
      vel = velocity;
      const landing = snapPoint(m, pos + velocity * 0.32);
      goal = landing;
      if (Math.abs(velocity) > 400 && Math.abs(landing - pos) < 1) step(m, velocity > 0 ? 1 : -1);
      mode = "spring";
      start();
      return;
    }
    if (closeFocus()) return;
    const [x, y] = localPoint(e);
    const hit = hitAt(x, y);
    if (!hit) return;
    // Karta pod myší ukazuje tlačítko „Zjistit víc" — klik na ni vede na
    // projekt, ať je zrovna uprostřed, nebo ne.
    if (hit.index === hoverSlot && s.hover) {
      callbacks.onSelect(hit.index);
      return;
    }
    if (hit.index === activeIndex && Math.abs(goal - pos) < 2) {
      callbacks.onSelect(hit.index);
      if (s.focusOnClick) openFocus(hit.index);
    } else {
      const rel = (hit.x0 + hit.x1) / 2 - width / 2;
      goal = snapPoint(m, pos + rel);
      mode = "spring";
      if (s.focusOnClick) focus.pending = hit.index;
      start();
    }
  };

  const onPointerLeave = () => {
    pointer.over = false;
    dirty = true;
    start();
  };

  const onPointerCancel = () => {
    pointer.down = false;
    pointer.dragging = false;
    container.removeAttribute("data-dragging");
    const s = settingsRef.current;
    if (!s) return;
    goal = snapPoint(metrics(s), pos);
    mode = "spring";
    start();
  };

  const onWheel = (e: WheelEvent) => {
    const s = settingsRef.current;
    if (!s || e.ctrlKey) return;
    let dx = e.deltaX;
    let dy = e.deltaY;
    if (e.shiftKey && Math.abs(dx) < Math.abs(dy)) {
      dx = dy;
      dy = 0;
    }
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? height : 1;
    const horizontal = Math.abs(dx) > Math.abs(dy);
    if (!horizontal && !s.captureWheel) return;
    e.preventDefault();
    skipIntro();
    interactedAt = performance.now();
    if (closeFocus()) return;
    const delta = Math.max(-120, Math.min(120, (horizontal ? dx : dy) * unit));
    goal += delta * 1.25;
    mode = "wheel";
    wheelAt = performance.now();
    start();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const s = settingsRef.current;
    if (!s) return;
    const m = metrics(s);
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      skipIntro();
      closeFocus();
      interactedAt = performance.now();
      step(m, 1);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      skipIntro();
      closeFocus();
      interactedAt = performance.now();
      step(m, -1);
    } else if (e.key === "Home") {
      e.preventDefault();
      closeFocus();
      goTo(m, 0);
    } else if (e.key === "End") {
      e.preventDefault();
      closeFocus();
      goTo(m, slots.length - 1);
    } else if (e.key === "Escape") {
      if (closeFocus()) e.preventDefault();
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (closeFocus() || activeIndex < 0) return;
      callbacks.onSelect(activeIndex);
      if (s.focusOnClick) openFocus(activeIndex);
    }
  };

  const onFocus = () => {
    hasFocus = true;
  };
  const onBlur = () => {
    hasFocus = false;
  };
  const onVisibility = () => {
    if (!document.hidden) start();
  };

  container.addEventListener("pointerdown", onPointerDown);
  container.addEventListener("pointermove", onPointerMove);
  container.addEventListener("pointerup", onPointerUp);
  container.addEventListener("pointerleave", onPointerLeave);
  container.addEventListener("pointercancel", onPointerCancel);
  container.addEventListener("wheel", onWheel, { passive: false });
  container.addEventListener("keydown", onKeyDown);
  container.addEventListener("focus", onFocus);
  container.addEventListener("blur", onBlur);
  window.addEventListener("pointermove", onHover, { passive: true });
  document.documentElement.addEventListener("pointerleave", onPageLeave);
  document.addEventListener("visibilitychange", onVisibility);

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);
  const intersectionObserver = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    start();
  });
  intersectionObserver.observe(container);

  resize();
  setItems(itemsRef.current);

  return {
    wake: () => {
      dirty = true;
      start();
    },
    setItems,
    step: (direction: number) => {
      const s = settingsRef.current;
      if (!s || !slots.length) return;
      skipIntro();
      closeFocus();
      interactedAt = performance.now();
      step(metrics(s), direction > 0 ? 1 : -1);
    },
    destroy: () => {
      alive = false;
      visible = false;
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      container.removeEventListener("pointerdown", onPointerDown);
      container.removeEventListener("pointermove", onPointerMove);
      container.removeEventListener("pointerup", onPointerUp);
      container.removeEventListener("pointerleave", onPointerLeave);
      container.removeEventListener("pointercancel", onPointerCancel);
      container.removeEventListener("wheel", onWheel);
      container.removeEventListener("keydown", onKeyDown);
      container.removeEventListener("focus", onFocus);
      container.removeEventListener("blur", onBlur);
      window.removeEventListener("pointermove", onHover);
      document.documentElement.removeEventListener("pointerleave", onPageLeave);
      document.removeEventListener("visibilitychange", onVisibility);
      slots.forEach((slot) => slot.dispose());
      slots = [];

      gl.getExtension("WEBGL_lose_context")?.loseContext();
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    },
  };
}
