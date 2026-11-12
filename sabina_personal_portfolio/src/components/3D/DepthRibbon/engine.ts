// DepthRibbon — engine (three.js, bez Reactu).
//
// Karty stojí na uzavřené prostorové křivce (smyčka, uzel, vlna) a kamera po
// ní jede. Občas odjede do přehledu celé křivky, podržením myši taky. Klik
// kartu přiblíží v plném rozlišení, další klik ji vrátí.
//
// POMĚR STRAN: každá karta má poměr svého obrázku (`aShape`). Do atlasu se
// obrázek kreslí celý, roztažený přes čtvercový slot — karta ho zase srovná
// na správný poměr, takže se nic neořízne ani nezdeformuje. Poměr se bere
// z rozměrů v CMS a po načtení ze skutečného souboru.
//
// Vychází z „Depth Ribbon" (React Bits Pro), upravené pro tenhle web.

import * as THREE from "three";
// Popisek a hover rámeček karty — stejná kresba jako galerie v heru úvodní
// stránky (FlexCarousel), jen na vlastním 2D plátně nad kartou.
import { MARGIN as LABEL_MARGIN, drawCardLayer } from "../FlexCarousel/hover";
import { createGlyphLayer } from "./glyphs";

export type DepthRibbonPath = "loop" | "knot" | "wave" | "ring";
export type DepthRibbonTour = "cycle" | "ride" | "overview";
export type DepthRibbonOrder = "sequence" | "shuffle";

export interface DepthRibbonItem {
  src: string;
  alt: string;
  title?: string;
  subtitle?: string;
  /** Kam vede odkaz u přiblížené karty. */
  href?: string;
  /** Skupina (projekt) — „další/předchozí" skáče po skupinách. */
  group?: number;
  /** Text výzvy na kartě (popisek `labels`). */
  cta?: string;
  /** Rozměry obrázku, pokud je známe předem (jinak se čtou po načtení). */
  width?: number;
  height?: number;
}

export interface RibbonSettings {
  count: number;
  path: DepthRibbonPath;
  tour: DepthRibbonTour;
  order: DepthRibbonOrder;
  interval: number;
  speed: number;
  cardSize: number;
  /** Nejširší karta jako násobek výšky (`cardSize`) — strop pro obrázky na šířku. */
  maxWidth: number;
  radius: number;
  offset: number;
  fov: number;
  fog: number;
  thread: number;
  shadow: number;
  accentColor: string;
  focusOnClick: boolean;
  holdToReveal: boolean;
  interactive: boolean;
  draggable: boolean;
  wheel: boolean;
  pauseOnHover: boolean;
  seed: number;
  paused: boolean;
  dpr: number;
  reduced: boolean;
  /** Studio: hlásit boxy karet (onBoxes) pro neviditelné klikací cíle. */
  editing: boolean;
  /**
   * Úběžník (kam kamera míří) jako podíl šířky a výšky plátna. 0,5 / 0,5 =
   * střed; menší Y ho zvedne, takže jízda vyplní i horní část. Přiblížená
   * karta jde vždy na střed.
   */
  vanishX: number;
  vanishY: number;
  /**
   * Klidový pohled. `ride` = kamera jede po dráze a dívá se dopředu.
   * `row` = kamera stojí z boku a hlavní karta je na středu, další karty
   * ubíhají doprava jako řada; posun (kolečko, tah) kameru odtáhne do
   * přehledu celé dráhy a po zastavení se vrátí na nejbližší kartu.
   */
  view: "ride" | "row";
  /** `row`: šikmost pohledu v radiánech (0 = přesně z boku). */
  rowAngle: number;
  /** `row`: kolik výšky plátna zabere hlavní karta. */
  rowFill: number;
  /** `row`: jak daleko do přehledu odtáhne nejrychlejší posun (0–1). */
  scope: number;
  /** `row`: o kolik je hlavní karta větší než sousedky (0,6 = o 60 %). */
  rowScale: number;
  /** Mezera mezi hranami karet (světové jednotky). 0 = karty po jedné jednotce bez ohledu na šířku. */
  spacing: number;
  /** `row`: krytí neaktivních karet (hlavní a karta pod myší jsou plné). */
  rowDim: number;
  /** `row`: krytí karet dál od hlavní (zadní část kruhu); ukážou se až při odtažení. */
  rowBack: number;
  /** `row`: po kolika sekundách klidu jet na další projekt (0 = vypnuto). */
  autoplay: number;
  /** Glyfy ze sazby při posunu (jako u bannerů na úvodní stránce). */
  glyphs: boolean;
  /** O kolik pod dráhou vede pravítko (0 = nit středem karet bez dílků). */
  rulerDrop: number;
  /** Popisek karty a rámeček při hoveru (jako galerie na úvodní stránce). */
  labels: boolean;
}

export interface RibbonBox {
  item: number;
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface RibbonCallbacks {
  /** Přiblížená položka, -1 = nic. */
  onFocus: (item: number) => void;
  /** Položka, ke které kamera právě jede (pro počítadlo). */
  onCurrent: (item: number) => void;
  /** Jen při `editing`: boxy viditelných karet v px vůči kořeni. */
  onBoxes?: (boxes: RibbonBox[]) => void;
  /** `row`: klik na hlavní kartu (otevřít projekt). */
  onSelect?: (item: number) => void;
}

export interface RibbonController {
  sync: () => void;
  travel: (cards: number) => void;
  step: (direction: 1 | -1) => void;
  focus: (item: number) => void;
  release: () => void;
  reveal: (show: boolean) => void;
  destroy: () => void;
}

interface Pose {
  target: THREE.Vector3;
  dir: THREE.Vector3;
  r: number;
}

interface Focus {
  card: number;
  item: number;
  e: number;
  v: number;
  target: number;
  from: Pose;
  handoff: number;
  handoffV: number;
  dir: THREE.Vector3;
  aspect: number;
  aspectV: number;
}

const MAX_CARDS = 240;
export const MAX_ITEMS = 48;
const SUB = 8;
const TAU = Math.PI * 2;
// Karta „vpředu" (největší celá na obrazovce): o tolik karet před pozicí
// kamery na křivce. Bližší už mizí v mlze u objektivu.
const LEAD = 1.6;
// Poměr karty, dokud obrázek nemá rozměry (typický banner na výšku).
const DEFAULT_SHAPE = 0.6;
// `row`: odtažení při posunu — o kolik dál couvne kamera a jak se zvedne.
const SCOPE_BACK = 2.4;
const SCOPE_RISE = 0.35;
// Rychlost jízdy (karty/s), od které se kamera začne odtahovat, a kdy naplno.
// Zub kolečka dělá ~2–3 karty/s, takže klidné scrollování nic neodtáhne.
const SCOPE_SPEED_FROM = 5;
// `autoplay`: jak dlouho (s) po zásahu návštěvníka scéna sama nejede.
const AUTOPLAY_HOLD = 3;
// Nástup scény: délka (s), pauza před ním (s) a o kolik karet kruh dojede.
const INTRO_LENGTH = 2.6;
const INTRO_DELAY = 0.25;
const INTRO_CARDS = 8;
const smoothstep01 = (t: number) => t * t * (3 - 2 * t);
const SCOPE_SPEED_FULL = 14;
// Jemnost tvaru dráhy a rozestup dílků pravítka (světové jednotky).
const RAW_STEPS = 4096;
const RULER_STEP = 0.1;
// Nejužší karta (px), nad kterou se v klidu ukáže popisek.
const LABEL_MIN_WIDTH = 200;

export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const wrap = (value: number, count: number) => ((value % count) + count) % count;

const seeded = (seed: number) => {
  let state = Math.imul(Math.floor(seed) + 3, 2654435761) >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 4294967296;
  };
};

const springTo = (value: number, velocity: number, target: number, dt: number, response: number) => {
  const omega = TAU / Math.max(response, 0.02);
  const substeps = Math.max(1, Math.ceil(dt / (1 / 120)));
  const h = dt / substeps;
  let v = velocity;
  let x = value;
  for (let i = 0; i < substeps; i++) {
    v += (omega * omega * (target - x) - 2 * omega * v) * h;
    x += v * h;
  }
  return [x, v] as const;
};

// Vlnky prstence: kolik vln na obvod a jak vysoké (vůči poloměru 1).
const RING_WAVES = 3;
const RING_LIFT = 0.07;

const pathPoint = (path: DepthRibbonPath, t: number, out: THREE.Vector3) => {
  if (path === "ring") {
    // Velký prstenec s jemnou vlnou nahoru a dolů. Z boku je to mírně
    // prohnutá řada, z přehledu čistý kruh bez křížení. Z je zrcadlené:
    // vpravo od směru jízdy je vnějšek kruhu — tam stojí kamera v `row`.
    return out.set(Math.cos(t), Math.sin(RING_WAVES * t) * RING_LIFT, -Math.sin(t));
  }
  if (path === "knot") {
    return out.set(
      Math.sin(t) + 2 * Math.sin(2 * t),
      -Math.sin(3 * t) * 0.85,
      Math.cos(t) - 2 * Math.cos(2 * t),
    );
  }
  if (path === "wave") {
    return out.set(Math.cos(t) * 2.6, Math.sin(3 * t) * 0.55, Math.sin(t) * 2.6);
  }
  return out.set(Math.sin(t) * 2.8, Math.cos(t) * 0.5, Math.sin(2 * t) * 1.45);
};

const makePose = (): Pose => ({ target: new THREE.Vector3(), dir: new THREE.Vector3(0, 0, 1), r: 1 });

const copyPose = (from: Pose, to: Pose) => {
  to.target.copy(from.target);
  to.dir.copy(from.dir);
  to.r = from.r;
  return to;
};

const blendPose = (a: Pose, b: Pose, e: number, out: Pose) => {
  const t = clamp(e, 0, 1);
  out.target.lerpVectors(a.target, b.target, t);
  out.dir.copy(a.dir).lerp(b.dir, t);
  if (out.dir.lengthSq() < 1e-6) out.dir.copy(b.dir);
  out.dir.normalize();
  out.r = Math.exp(Math.log(a.r) + (Math.log(b.r) - Math.log(a.r)) * t);
  return out;
};

// aCard: x = výška karty, y = položka, z = zvednutí (hover), w = viditelnost.
// aShape: poměr šířka / výška obrázku.
const cardVertexShader = `
attribute vec3 aCenter;
attribute vec4 aCard;
attribute float aShape;
uniform float uMargin;
uniform float uFogLength;
uniform float uFogStart;
uniform float uNearCut;
varying vec2 vLocal;
varying vec4 vCard;
varying float vFade;
varying float vShape;

void main() {
  vec4 view = modelViewMatrix * vec4(aCenter, 1.0);
  float depth = max(-view.z, 0.0);
  float size = aCard.x * (1.0 + 0.14 * aCard.z);
  vec2 corner = position.xy * uMargin;
  view.xy += corner * vec2(aShape, 1.0) * size;
  gl_Position = projectionMatrix * view;
  // Mlha začíná až za řadou (uFogStart) — karty vpředu jsou plné, ne průsvitné.
  float fog = exp(-pow(max(depth - uFogStart, 0.0) / uFogLength, 1.5));
  // uNearCut (row): karty blíž objektivu než řada zmizí — žádné duchy přes hlavní kartu.
  float near = smoothstep(max(0.25, uNearCut - 0.8), max(0.85, uNearCut), depth);
  vFade = fog * near * aCard.w;
  vLocal = corner;
  vCard = aCard;
  vShape = aShape;
}
`;

const cardFragmentShader = `
precision highp float;

uniform sampler2D uAtlas;
uniform vec2 uGrid;
uniform float uInset;
uniform float uLoaded[${MAX_ITEMS}];
uniform float uRadius;
uniform float uShadow;
uniform float uDim;
varying vec2 vLocal;
varying vec4 vCard;
varying float vFade;
varying float vShape;

float roundBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

void main() {
  if (vFade < 0.003) discard;
  vec2 halfSize = vec2(vShape, 1.0) * 0.5;
  vec2 p = vLocal * vec2(vShape, 1.0);
  float corner = clamp(uRadius, 0.0, 1.0) * min(halfSize.x, halfSize.y);
  float d = roundBox(p, halfSize, corner);
  float aa = fwidth(d) * 0.8;
  float card = 1.0 - smoothstep(-aa, aa, d);
  float soft = 0.07 + 0.12 * vCard.z;
  float sd = roundBox(p - vec2(0.0, -0.045 - 0.07 * vCard.z), halfSize - soft * 0.3, corner);
  float shade = (1.0 - smoothstep(-soft, soft, sd)) * uShadow * (0.55 + 0.35 * vCard.z);
  // Celý obrázek bez ořezu — v atlasu je roztažený přes slot, karta má jeho poměr.
  vec2 suv = clamp(vLocal + 0.5, 0.0, 1.0);
  float which = floor(vCard.y + 0.5);
  vec2 slot = vec2(mod(which, uGrid.x), floor(which / uGrid.x));
  float inner = 1.0 - 2.0 * uInset;
  vec2 atlasUv = vec2(
    (slot.x + uInset + suv.x * inner) / uGrid.x,
    1.0 - (slot.y + uInset + (1.0 - suv.y) * inner) / uGrid.y
  );
  vec3 image = texture2D(uAtlas, atlasUv).rgb;
  vec3 color = mix(vec3(0.08, 0.08, 0.08), image, uLoaded[int(which)]) * (1.0 + 0.08 * vCard.z);
  float fade = vFade * (1.0 - uDim);
  float alpha = card * fade;
  vec4 result = vec4(color * alpha, alpha);
  result += vec4(0.0, 0.0, 0.0, shade * fade) * (1.0 - alpha);
  if (result.a < 0.002) discard;
  gl_FragColor = result;
}
`;

const threadVertexShader = `
uniform float uFogLength;
uniform float uFogStart;
varying float vFade;

void main() {
  vec4 view = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * view;
  float depth = max(-view.z, 0.0);
  vFade = exp(-pow(max(depth - uFogStart, 0.0) / uFogLength, 1.5)) * smoothstep(0.4, 1.4, depth);
}
`;

const threadFragmentShader = `
precision highp float;
uniform vec3 uColor;
uniform float uOpacity;
varying float vFade;

void main() {
  float alpha = uOpacity * vFade;
  gl_FragColor = vec4(uColor * alpha, alpha);
}
`;

const photoVertexShader = `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const photoFragmentShader = `
precision highp float;

uniform sampler2D uImage;
uniform float uImageAspect;
uniform float uPlaneAspect;
uniform float uRadius;
uniform float uOpacity;
varying vec2 vUv;

float roundBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

void main() {
  vec2 p = (vUv - 0.5) * vec2(uPlaneAspect, 1.0);
  float d = roundBox(p, vec2(uPlaneAspect, 1.0) * 0.5, uRadius);
  float aa = fwidth(d);
  float cover = 1.0 - smoothstep(-aa, aa, d);
  vec2 uv = vUv - 0.5;
  if (uPlaneAspect < uImageAspect) {
    uv.x *= uPlaneAspect / uImageAspect;
  } else {
    uv.y *= uImageAspect / uPlaneAspect;
  }
  vec3 color = texture2D(uImage, uv + 0.5).rgb;
  float alpha = cover * uOpacity;
  gl_FragColor = vec4(color * alpha, alpha);
}
`;

const encodedColor = (value: string, fallback: string, target: THREE.Color) => {
  try {
    target.set(value);
  } catch {
    target.set(fallback);
  }
  const rgb = { r: 0, g: 0, b: 0 };
  target.getRGB(rgb, THREE.SRGBColorSpace);
  return target.setRGB(rgb.r, rgb.g, rgb.b);
};

export const createRibbon = (
  root: HTMLElement,
  stage: HTMLElement,
  settingsRef: { current: RibbonSettings },
  itemsRef: { current: DepthRibbonItem[] },
  callbacks: RibbonCallbacks,
  // Kde poslouchat kolečko — výchozí je plátno; stránka bez scrollu dá celou sekci.
  wheelHost: HTMLElement = stage,
): RibbonController | null => {
  const doc = root.ownerDocument;
  const canvas = doc.createElement("canvas");
  canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block";
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      premultipliedAlpha: true,
      powerPreference: "high-performance",
    });
  } catch {
    return null;
  }
  stage.appendChild(canvas);
  // Popisek karty (název, obor, výzva) a hover rámeček — 2D plátno, které
  // jezdí nad kartou. Myš propouští do scény.
  const label = doc.createElement("canvas");
  // z-index 2: nad plátnem s kartami.
  label.style.cssText =
    "position:absolute;z-index:2;left:0;top:0;pointer-events:none;opacity:0;will-change:transform,opacity";
  stage.appendChild(label);
  const labelFont = getComputedStyle(root).fontFamily || "sans-serif";
  let labelAlpha = 0;
  let labelCard = -1;
  let hoverAt = 0;
  // Glyfy ze sazby při posunu — vlastní plátno pod popiskem karty.
  const glyphLayer = createGlyphLayer(stage, label);
  renderer.setClearColor(0x000000, 0);

  const loaded = new Array<number>(MAX_ITEMS).fill(0);
  const fading = new Array<boolean>(MAX_ITEMS).fill(false);
  // Poměr šířka / výška každé položky.
  const shapes = new Float32Array(MAX_ITEMS).fill(DEFAULT_SHAPE);
  const margin = 1.4;
  const fogLength = { value: 16 };
  const fogStart = { value: 0 };
  const fogAt = (depth: number) => Math.exp(-Math.pow(Math.max(depth - fogStart.value, 0) / fogLength.value, 1.5));
  const accent = new THREE.Color(0xbec948);
  const cardUniforms = {
    uAtlas: { value: null as THREE.Texture | null },
    uGrid: { value: new THREE.Vector2(1, 1) },
    uInset: { value: 0.004 },
    uLoaded: { value: loaded },
    uMargin: { value: margin },
    uFogLength: fogLength,
    uFogStart: fogStart,
    uRadius: { value: 0.12 },
    uShadow: { value: 0.5 },
    uDim: { value: 0 },
    uNearCut: { value: 0 },
  };
  const cardMaterial = new THREE.ShaderMaterial({
    uniforms: cardUniforms,
    vertexShader: cardVertexShader,
    fragmentShader: cardFragmentShader,
    transparent: true,
    premultipliedAlpha: true,
    depthTest: false,
    depthWrite: false,
  });
  const base = new THREE.PlaneGeometry(1, 1);
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.index = base.index;
  geometry.setAttribute("position", base.getAttribute("position"));
  geometry.setAttribute("uv", base.getAttribute("uv"));
  const centers = new Float32Array(MAX_CARDS * 3);
  const cardData = new Float32Array(MAX_CARDS * 4);
  const shapeData = new Float32Array(MAX_CARDS).fill(DEFAULT_SHAPE);
  const centerAttribute = new THREE.InstancedBufferAttribute(centers, 3);
  const cardAttribute = new THREE.InstancedBufferAttribute(cardData, 4);
  const shapeAttribute = new THREE.InstancedBufferAttribute(shapeData, 1);
  centerAttribute.setUsage(THREE.DynamicDrawUsage);
  cardAttribute.setUsage(THREE.DynamicDrawUsage);
  shapeAttribute.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute("aCenter", centerAttribute);
  geometry.setAttribute("aCard", cardAttribute);
  geometry.setAttribute("aShape", shapeAttribute);
  geometry.instanceCount = 0;
  const cardsMesh = new THREE.Mesh(geometry, cardMaterial);
  cardsMesh.frustumCulled = false;
  cardsMesh.renderOrder = 1;

  const threadUniforms = {
    uFogLength: fogLength,
    uFogStart: fogStart,
    uColor: { value: accent },
    uOpacity: { value: 0.3 },
  };
  const threadMaterial = new THREE.ShaderMaterial({
    uniforms: threadUniforms,
    vertexShader: threadVertexShader,
    fragmentShader: threadFragmentShader,
    transparent: true,
    premultipliedAlpha: true,
    depthTest: false,
    depthWrite: false,
  });
  let threadGeometry = new THREE.BufferGeometry();
  const thread = new THREE.LineSegments(threadGeometry, threadMaterial);
  thread.frustumCulled = false;
  thread.renderOrder = 0;

  const photoUniforms = {
    uImage: { value: null as THREE.Texture | null },
    uImageAspect: { value: 1 },
    uPlaneAspect: { value: 1 },
    uRadius: { value: 0.06 },
    uOpacity: { value: 1 },
  };
  const photoMaterial = new THREE.ShaderMaterial({
    uniforms: photoUniforms,
    vertexShader: photoVertexShader,
    fragmentShader: photoFragmentShader,
    transparent: true,
    premultipliedAlpha: true,
    depthTest: false,
    depthWrite: false,
  });
  const photoGeometry = new THREE.PlaneGeometry(1, 1);
  const photo = new THREE.Mesh(photoGeometry, photoMaterial);
  photo.frustumCulled = false;
  photo.renderOrder = 2;
  photo.visible = false;

  const scene = new THREE.Scene();
  scene.add(thread, cardsMesh, photo);
  const camera = new THREE.PerspectiveCamera(60, 1, 0.05, 2000);

  let atlasCanvas: HTMLCanvasElement | null = null;
  let atlasTexture: THREE.CanvasTexture | null = null;
  let images: HTMLImageElement[] = [];
  const imageTextures = new Map<number, THREE.Texture>();
  let itemsKey = "";
  let pathKey = "";
  let assignKey = "";
  let colorKey = "";
  let samples = new Float32Array(0);
  // Tvar dráhy bez měřítka (buildPath) a rozložení karet po ní (layout).
  let rawKey = "";
  const raw = new Float64Array((RAW_STEPS + 1) * 3);
  const rawLengths = new Float64Array(RAW_STEPS + 1);
  let arcs = new Float64Array(1);
  let shifts = new Float32Array(0);
  let pathLen = 0;
  let layoutKey = "";
  let cardCount = 0;
  let boundRadius = 10;
  let assignment: number[] = [];
  const lifts: { value: number; velocity: number }[] = [];
  let order: number[] = [];
  let depths = new Float32Array(0);
  let width = 1;
  let height = 1;
  let dpr = 1;
  let s = 0;
  let velocity = 0;
  let rate = 1;
  let rateV = 0;
  let pull = 0;
  let pullV = 0;
  // `row`: odtažení do přehledu podle rychlosti jízdy (0–1) a ta rychlost.
  let stir = 0;
  let stirV = 0;
  // Nástup scény (načtení / přechod na stránku): kamera začíná v přehledu
  // celého kruhu, karty se rozsvítí, kruh dojede INTRO_CARDS karet na místo
  // a kamera se přitom přiblíží do řady. 0 → 1; -1 = ještě nezačal.
  let intro = -1;
  let introStart = 0;
  let introFrom = 0;
  let introTo = 0;
  const introRunning = () => intro >= 0 && intro < 1;
  // Karty se během prvních 30 % nástupu rozsvítí.
  const introFade = () => (intro < 0 ? 1 : smoothstep01(clamp(intro / 0.3, 0, 1)));
  let speedNow = 0;
  let lastS = 0;
  // `row`: hloubka, pod kterou karty mizí (viz uNearCut).
  let nearCut = 0;
  // `autoplay`: kdy naposledy zasáhl návštěvník (kolečko, tah, klik, klávesy,
  // šipky) a jak dlouho už scéna stojí na hlavní kartě.
  let userAt = -10;
  let autoClock = 0;
  let phase: "ride" | "overview" = "ride";
  let phaseClock = 0;
  let orbitYaw = 0;
  let orbitPitch = 0;
  let orbitYawV = 0;
  let orbitPitchV = 0;
  let holding = false;
  let peek = false;
  let hovered = -1;
  let focus: Focus | null = null;
  let current = -1;
  let boxesKey = "";
  let time = 0;
  let raf = 0;
  let last = 0;
  let visible = false;
  let destroyed = false;
  let lost = false;
  let pressTimer = 0;
  let pendingTravel = 0;
  let pendingYaw = 0;
  let wheelAt = -10;
  const pointer = { clientX: 0, clientY: 0, inside: false };
  let press: {
    id: number;
    x: number;
    y: number;
    lastX: number;
    lastY: number;
    moved: boolean;
    touch: boolean;
    samples: { t: number; d: number }[];
  } | null = null;
  const travelPose = makePose();
  const overviewPose = makePose();
  const basePose = makePose();
  const focusPose = makePose();
  const fromPose = makePose();
  const finalPose = makePose();
  const scopePose = makePose();
  // Úběžník na obrazovce (px) — kam padá střed projekce. Viz vanishX/Y.
  const vanish = { x: 0.5, y: 0.5 };
  const tmpA = new THREE.Vector3();
  const tmpB = new THREE.Vector3();
  const tmpC = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const tangent = new THREE.Vector3();
  const right = new THREE.Vector3();
  const lift = new THREE.Vector3();
  const view = new THREE.Vector3();

  // Výška karty s daným poměrem: na výšku plná, široké se zmenší, aby
  // nebyly širší než `maxWidth` × výška.
  const cardHeight = (shape: number) => {
    const settings = settingsRef.current;
    const size = clamp(settings.cardSize, 0.2, 1.5);
    const widest = clamp(settings.maxWidth, 0.5, 3);
    return size * Math.min(1, widest / Math.max(shape, 0.05));
  };
  const shapeOfCard = (card: number) => shapes[assignment[card] ?? 0] || DEFAULT_SHAPE;
  // `row`: hlavní karta je o `rowScale` větší než sousedky; při odtažení se
  // vyrovná. Přechod plynule podle vzdálenosti od středu (s + LEAD).
  const sizeOf = (card: number) => {
    const settings = settingsRef.current;
    const base = cardHeight(shapeOfCard(card));
    if (settings.view !== "row" || !cardCount) return base;
    let away = card - (s + LEAD);
    away = Math.abs(wrap(away + cardCount / 2, cardCount) - cardCount / 2);
    const w = clamp(1 - away, 0, 1);
    return base * (1 + clamp(settings.rowScale, 0, 2) * w * w * (3 - 2 * w) * (1 - stir));
  };
  const groupOf = (card: number) => {
    const item = assignment[wrap(card, cardCount)] ?? 0;
    return itemsRef.current[item]?.group ?? item;
  };

  // Bod na dráze podle vzdálenosti po dráze (světové jednotky, 0–pathLen).
  const pointAtArc = (arc: number, out: THREE.Vector3) => {
    const total = samples.length / 3;
    if (!total || pathLen <= 0) return out.set(0, 0, 0);
    const u = wrap((arc / pathLen) * total, total);
    const i0 = Math.floor(u);
    const f = u - i0;
    const i1 = (i0 + 1) % total;
    return out.set(
      samples[i0 * 3] + (samples[i1 * 3] - samples[i0 * 3]) * f,
      samples[i0 * 3 + 1] + (samples[i1 * 3 + 1] - samples[i0 * 3 + 1]) * f,
      samples[i0 * 3 + 2] + (samples[i1 * 3 + 2] - samples[i0 * 3 + 2]) * f,
    );
  };

  // Desetinný index karty → vzdálenost po dráze (mezi kartami lineárně).
  const arcAt = (value: number) => {
    if (!cardCount) return 0;
    const x = wrap(value, cardCount);
    const i0 = Math.floor(x);
    return arcs[i0] + (arcs[i0 + 1] - arcs[i0]) * (x - i0);
  };

  const pointAt = (value: number, out: THREE.Vector3) => pointAtArc(arcAt(value), out);

  // Střed karty: její místo v rozložení + odsun od zvětšené hlavní karty.
  const cardPosition = (index: number, out: THREE.Vector3) =>
    pointAtArc(arcs[index] + (shifts[index] ?? 0), out);

  // Počet karet na křivce. V pořadí `sequence` zaokrouhlený na celá kola položek.
  const cardTotal = () => {
    const settings = settingsRef.current;
    const count = clamp(Math.round(settings.count), 12, MAX_CARDS);
    if (settings.order !== "sequence") return count;
    const items = Math.max(1, Math.min(itemsRef.current.length, MAX_ITEMS));
    const rounds = Math.max(Math.ceil(12 / items), Math.round(count / items));
    return Math.min(rounds, Math.floor(MAX_CARDS / items)) * items;
  };

  // Tvar dráhy (bez měřítka) a počet karet. Rozložení karet po dráze a její
  // délka jsou v `layout()` — závisí na poměrech obrázků.
  const buildPath = () => {
    const settings = settingsRef.current;
    const count = cardTotal();
    const key = `${settings.path}|${count}`;
    if (key === pathKey) return false;
    pathKey = key;
    if (rawKey !== settings.path) {
      rawKey = settings.path;
      const point = new THREE.Vector3();
      for (let k = 0; k <= RAW_STEPS; k++) {
        pathPoint(settings.path, (k / RAW_STEPS) * TAU, point);
        raw[k * 3] = point.x;
        raw[k * 3 + 1] = point.y;
        raw[k * 3 + 2] = point.z;
        rawLengths[k] =
          k === 0
            ? 0
            : rawLengths[k - 1] +
              Math.hypot(
                raw[k * 3] - raw[(k - 1) * 3],
                raw[k * 3 + 1] - raw[(k - 1) * 3 + 1],
                raw[k * 3 + 2] - raw[(k - 1) * 3 + 2],
              );
      }
    }
    cardCount = count;
    s = wrap(s, count);
    arcs = new Float64Array(count + 1);
    shifts = new Float32Array(count);
    layoutKey = "";
    while (lifts.length < count) lifts.push({ value: 0, velocity: 0 });
    lifts.length = count;
    order = Array.from({ length: count }, (_, i) => i);
    depths = new Float32Array(count);
    if (focus && focus.card >= count) focus = null;
    return true;
  };

  // Rozložení karet po dráze. S `spacing` > 0 stojí karty podle skutečné
  // šířky se stejnou mezerou mezi hranami (široký banner nezajede do
  // sousedky); s 0 po jedné jednotce jako dřív. Délka dráhy = součet.
  const layout = () => {
    if (!cardCount) return;
    const settings = settingsRef.current;
    const gap = Math.max(0, settings.spacing);
    const items = Math.max(1, Math.min(itemsRef.current.length, MAX_ITEMS));
    let key = `${cardCount}|${gap}|${settings.cardSize}|${settings.maxWidth}|${settings.rulerDrop}|${assignKey}`;
    if (gap > 0) for (let i = 0; i < items; i++) key += `|${shapes[i].toFixed(4)}`;
    if (key === layoutKey) return;
    layoutKey = key;
    arcs[0] = 0;
    for (let i = 0; i < cardCount; i++) {
      if (gap <= 0) {
        arcs[i + 1] = i + 1;
        continue;
      }
      const next = (i + 1) % cardCount;
      const here = cardHeight(shapeOfCard(i)) * shapeOfCard(i);
      const there = cardHeight(shapeOfCard(next)) * shapeOfCard(next);
      arcs[i + 1] = arcs[i] + (here + there) / 2 + gap;
    }
    pathLen = arcs[cardCount];
    resample();
  };

  // Body dráhy po stejných kouscích (SUB na jednotku) v měřítku pathLen,
  // vystředěné; k tomu pravítko pod kartami.
  const resample = () => {
    const rawLength = rawLengths[RAW_STEPS];
    const total = Math.max(64, Math.ceil(pathLen * SUB));
    const scale = pathLen / rawLength;
    samples = new Float32Array(total * 3);
    let k = 0;
    let cx = 0;
    let cy = 0;
    let cz = 0;
    for (let j = 0; j < total; j++) {
      const at = (j / total) * rawLength;
      while (k < RAW_STEPS - 1 && rawLengths[k + 1] < at) k++;
      const span = rawLengths[k + 1] - rawLengths[k] || 1;
      const f = (at - rawLengths[k]) / span;
      for (let c = 0; c < 3; c++) {
        samples[j * 3 + c] = (raw[k * 3 + c] + (raw[(k + 1) * 3 + c] - raw[k * 3 + c]) * f) * scale;
      }
      cx += samples[j * 3];
      cy += samples[j * 3 + 1];
      cz += samples[j * 3 + 2];
    }
    cx /= total;
    cy /= total;
    cz /= total;
    boundRadius = 0;
    for (let j = 0; j < total; j++) {
      samples[j * 3] -= cx;
      samples[j * 3 + 1] -= cy;
      samples[j * 3 + 2] -= cz;
      boundRadius = Math.max(boundRadius, Math.hypot(samples[j * 3], samples[j * 3 + 1], samples[j * 3 + 2]));
    }
    buildRuler();
  };

  // Pravítka: linka pod řadou i nad ní (o `rulerDrop` od dráhy) s dílky
  // mířícími k řadě — spodní nahoru, horní dolů; drobné po desetině
  // jednotky, delší po půl a celé. Motiv měření jako rámečky jinde na webu.
  // S `rulerDrop` 0 jen nit středem karet.
  const buildRuler = () => {
    const settings = settingsRef.current;
    const drop = settings.rulerDrop > 0 ? settings.rulerDrop : 0;
    const total = samples.length / 3;
    const ticks = drop > 0 ? Math.floor(pathLen / RULER_STEP) : 0;
    const lines = drop > 0 ? [-drop, drop] : [0];
    const data = new Float32Array((total + ticks) * 6 * lines.length);
    let o = 0;
    for (const offset of lines) {
      for (let j = 0; j < total; j++) {
        const n = (j + 1) % total;
        data[o++] = samples[j * 3];
        data[o++] = samples[j * 3 + 1] + offset;
        data[o++] = samples[j * 3 + 2];
        data[o++] = samples[n * 3];
        data[o++] = samples[n * 3 + 1] + offset;
        data[o++] = samples[n * 3 + 2];
      }
      // Dílky k řadě: od spodní linky nahoru, od horní dolů.
      const toward = offset < 0 ? 1 : -1;
      for (let t = 0; t < ticks; t++) {
        const length = t % 10 === 0 ? 0.2 : t % 5 === 0 ? 0.11 : 0.05;
        pointAtArc(t * RULER_STEP, tmpA);
        data[o++] = tmpA.x;
        data[o++] = tmpA.y + offset;
        data[o++] = tmpA.z;
        data[o++] = tmpA.x;
        data[o++] = tmpA.y + offset + toward * length;
        data[o++] = tmpA.z;
      }
    }
    threadGeometry.dispose();
    threadGeometry = new THREE.BufferGeometry();
    threadGeometry.setAttribute("position", new THREE.BufferAttribute(data.subarray(0, o), 3));
    thread.geometry = threadGeometry;
  };

  // `row`: zvětšená hlavní karta (a při přechodu i její sousedka) odsune
  // ostatní o svůj přírůstek šířky, takže mezery zůstanou stejné.
  const updateShifts = () => {
    shifts.fill(0);
    if (settingsRef.current.view !== "row" || !cardCount) return;
    const center = s + LEAD;
    for (const c of [Math.floor(center), Math.floor(center) + 1]) {
      const card = wrap(c, cardCount);
      const shape = shapeOfCard(card);
      const grow = ((sizeOf(card) - cardHeight(shape)) * shape) / 2;
      if (grow <= 1e-5) continue;
      for (let i = 0; i < cardCount; i++) {
        if (i === card) continue;
        const d = wrap(i - card + cardCount / 2, cardCount) - cardCount / 2;
        shifts[i] += Math.sign(d) * grow;
      }
    }
  };

  // Které položky na kterých kartách. `sequence` jde po řadě (projekty
  // v pořadí, počítadlo pak dává smysl), `shuffle` míchá bez opakování vedle sebe.
  const assign = () => {
    const settings = settingsRef.current;
    const items = Math.max(1, Math.min(itemsRef.current.length, MAX_ITEMS));
    const key = `${cardCount}|${items}|${settings.seed}|${settings.order}`;
    if (key === assignKey) return;
    assignKey = key;
    if (settings.order === "sequence") {
      // Počet karet je násobek položek (cardTotal), takže křivka se uzavře
      // bez švu: po poslední položce zase první.
      assignment = Array.from({ length: cardCount }, (_, i) => i % items);
      return;
    }
    const random = seeded(settings.seed * 131 + 7);
    const list: number[] = [];
    while (list.length < cardCount) {
      const pass = Array.from({ length: items }, (_, i) => i);
      for (let i = pass.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [pass[i], pass[j]] = [pass[j], pass[i]];
      }
      if (list.length && items > 1 && pass[0] === list[list.length - 1]) {
        [pass[0], pass[1]] = [pass[1], pass[0]];
      }
      list.push(...pass);
    }
    assignment = list.slice(0, cardCount);
    if (items > 1 && assignment[0] === assignment[cardCount - 1]) {
      const swap = assignment.findIndex(
        (value, i) =>
          i > 0 &&
          i < cardCount - 1 &&
          value !== assignment[0] &&
          assignment[i - 1] !== assignment[cardCount - 1] &&
          assignment[i + 1] !== assignment[cardCount - 1],
      );
      if (swap > 0) [assignment[swap], assignment[cardCount - 1]] = [assignment[cardCount - 1], assignment[swap]];
    }
  };

  const buildAtlas = () => {
    const items = itemsRef.current.slice(0, MAX_ITEMS);
    const key = items.map((item) => item.src).join("\u0000");
    if (key === itemsKey) return;
    itemsKey = key;
    images.forEach((image) => {
      image.onload = null;
    });
    imageTextures.forEach((texture) => texture.dispose());
    imageTextures.clear();
    atlasTexture?.dispose();
    loaded.fill(0);
    fading.fill(false);
    shapes.fill(DEFAULT_SHAPE);
    items.forEach((item, index) => {
      if (item.width && item.height) shapes[index] = item.width / item.height;
    });
    const count = Math.max(items.length, 1);
    const cols = Math.ceil(Math.sqrt(count));
    const rows = Math.ceil(count / cols);
    // Čím méně položek, tím větší slot — strop drží atlas v limitu GPU.
    const limit = Math.min(renderer.capabilities.maxTextureSize || 4096, 4096);
    const slot = Math.max(128, Math.min(1024, Math.floor(limit / Math.max(cols, rows))));
    const canvasAtlas = doc.createElement("canvas");
    canvasAtlas.width = cols * slot;
    canvasAtlas.height = rows * slot;
    atlasCanvas = canvasAtlas;
    const context = canvasAtlas.getContext("2d");
    if (context) {
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
    }
    atlasTexture = new THREE.CanvasTexture(canvasAtlas);
    atlasTexture.colorSpace = THREE.NoColorSpace;
    atlasTexture.minFilter = THREE.LinearMipmapLinearFilter;
    atlasTexture.magFilter = THREE.LinearFilter;
    atlasTexture.generateMipmaps = true;
    atlasTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    cardUniforms.uAtlas.value = atlasTexture;
    cardUniforms.uGrid.value.set(cols, rows);
    cardUniforms.uInset.value = 1.5 / slot;
    images = items.map((item, index) => {
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.decoding = "async";
      image.onload = () => {
        if (destroyed || atlasCanvas !== canvasAtlas || !context) return;
        // Skutečný poměr souboru má přednost před rozměry z CMS.
        if (image.naturalWidth && image.naturalHeight) {
          shapes[index] = image.naturalWidth / image.naturalHeight;
        }
        // Celý obrázek přes celý slot (bez ořezu) — poměr vrátí karta.
        context.drawImage(image, (index % cols) * slot, Math.floor(index / cols) * slot, slot, slot);
        if (atlasTexture) atlasTexture.needsUpdate = true;
        fading[index] = true;
        schedule();
      };
      image.src = item.src;
      return image;
    });
  };

  const refreshColors = () => {
    const key = settingsRef.current.accentColor;
    if (key === colorKey) return;
    colorKey = key;
    encodedColor(key, "#bec948", accent);
  };

  const resize = () => {
    const settings = settingsRef.current;
    // Rozměr z LAYOUTU (clientWidth), ne z getBoundingClientRect: ten
    // započítá CSS transformace. Když se stránka zrovna přibližovala
    // (přechod, nástup), uložil se zmenšený rozměr, a protože transformace
    // ResizeObserver nespustí, zůstal: plátno se natáhlo na skutečný box,
    // ale popisek karty (2D) počítal se zmenšeným — seděl menší a vlevo nahoře.
    const nextDpr = Math.min(window.devicePixelRatio || 1, Math.max(settings.dpr, 0.5));
    const nextWidth = Math.max(1, root.clientWidth);
    const nextHeight = Math.max(1, root.clientHeight);
    if (nextWidth === width && nextHeight === height && nextDpr === dpr) return false;
    width = nextWidth;
    height = nextHeight;
    dpr = nextDpr;
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height, false);
    return true;
  };

  const verticalFov = () => {
    const baseFov = THREE.MathUtils.degToRad(clamp(settingsRef.current.fov, 30, 100));
    const aspect = width / height;
    if (aspect >= 1) return baseFov;
    const minimum = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(52) / 2) / aspect);
    return Math.min(Math.max(baseFov, minimum), THREE.MathUtils.degToRad(110));
  };

  const halfFov = () => {
    const vertical = verticalFov() / 2;
    const horizontal = Math.atan(Math.tan(vertical) * (width / height));
    return { vertical, horizontal };
  };

  const computeTravel = (out: Pose) => {
    const offset = clamp(settingsRef.current.offset, 0.3, 3);
    pointAt(s + 0.5, tmpA);
    pointAt(s - 0.5, tmpB);
    tangent.subVectors(tmpA, tmpB);
    if (tangent.lengthSq() < 1e-8) tangent.set(1, 0, 0);
    tangent.normalize();
    right.crossVectors(tangent, up);
    if (right.lengthSq() < 1e-6) right.set(1, 0, 0);
    right.normalize();
    lift.crossVectors(right, tangent).normalize();
    const wide = clamp((width / height - 0.5) / 0.7, 0, 1);
    pointAt(s, tmpC);
    tmpC
      .addScaledVector(lift, (1.05 - 0.5 * wide) * offset)
      .addScaledVector(right, (0.35 + 0.7 * wide) * offset);
    pointAt(s + 5.5, out.target);
    out.dir.subVectors(tmpC, out.target);
    out.r = Math.max(out.dir.length(), 0.01);
    out.dir.divideScalar(out.r);
    return out;
  };

  // `row`: kamera z boku na hlavní kartu (s + LEAD), šikmo o `rowAngle`,
  // takže karty před ní ubíhají doprava a ty za ní odjíždí vlevo k objektivu.
  // Vodorovná tečna — kamera se nikdy nenaklání se sklonem dráhy.
  const computeRow = (out: Pose) => {
    const settings = settingsRef.current;
    const at = s + LEAD;
    pointAt(at + 0.5, tmpA);
    pointAt(at - 0.5, tmpB);
    tangent.subVectors(tmpA, tmpB);
    tangent.y = 0;
    if (tangent.lengthSq() < 1e-8) tangent.set(1, 0, 0);
    tangent.normalize();
    right.crossVectors(tangent, up).normalize();
    const angle = clamp(settings.rowAngle, 0, 1.3);
    pointAt(at, out.target);
    out.dir
      .copy(right)
      .multiplyScalar(Math.cos(angle))
      .addScaledVector(tangent, -Math.sin(angle))
      // Skoro ve výšce řady: obzor na středu, řada i pravítko se stáčí symetricky.
      .addScaledVector(up, 0.05)
      .normalize();
    const { vertical } = halfFov();
    const size = clamp(settings.cardSize, 0.2, 1.5);
    out.r = size / (2 * Math.tan(vertical) * clamp(settings.rowFill, 0.2, 0.95));
    return out;
  };

  // `yawFrom`: natočení převzít od jiného pohledu (v `row` od kamery u karty),
  // aby odtažení do přehledu jelo rovně dozadu a kamera neobíhala.
  const computeOverview = (out: Pose, yawFrom?: Pose) => {
    const { vertical, horizontal } = halfFov();
    const yaw = yawFrom
      ? Math.atan2(yawFrom.dir.x, yawFrom.dir.z) + orbitYaw
      : orbitYaw + (settingsRef.current.reduced ? 0 : time * 0.05);
    const pitch = clamp(0.62 + orbitPitch, 0.05, 1.45);
    out.target.set(0, 0, 0);
    out.dir.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
    const card = clamp(settingsRef.current.cardSize, 0.2, 1.5) * 0.75;
    right.crossVectors(up, out.dir).normalize();
    lift.crossVectors(out.dir, right).normalize();
    const tanH = Math.tan(horizontal) * 0.9;
    const tanV = Math.tan(vertical) * 0.86;
    let reach = boundRadius * 0.5;
    for (let i = 0; i < cardCount; i++) {
      cardPosition(i, tmpA);
      const along = tmpA.dot(out.dir);
      reach = Math.max(
        reach,
        along + (Math.abs(tmpA.dot(right)) + card) / tanH,
        along + (Math.abs(tmpA.dot(lift)) + card) / tanV,
      );
    }
    out.r = reach;
    return out;
  };

  // Odstup kamery, aby přiblížená karta zabrala ~60 % výšky (nebo ~84 % šířky).
  const focusDistance = (cardH: number, imageAspect: number) => {
    const { vertical, horizontal } = halfFov();
    const byHeight = cardH / (2 * Math.tan(vertical) * 0.6);
    const byWidth = (cardH * imageAspect) / (2 * Math.tan(horizontal) * 0.84);
    return Math.max(byHeight, byWidth);
  };

  const project = (index: number) => {
    cardPosition(index, view).applyMatrix4(camera.matrixWorldInverse);
    const depth = -view.z;
    const focal = height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    return {
      depth,
      sx: width * vanish.x + (view.x * focal) / Math.max(depth, 1e-3),
      sy: height * vanish.y - (view.y * focal) / Math.max(depth, 1e-3),
      scale: focal / Math.max(depth, 1e-3),
    };
  };

  // Polovina rozměrů karty na obrazovce (px), nebo null, když není vidět.
  const screenBox = (i: number) => {
    const p = project(i);
    if (p.depth < 0.4) return null;
    const fog = fogAt(p.depth);
    if (fog < 0.2 || p.depth < nearCut * 0.9) return null;
    const shape = shapeOfCard(i);
    const halfH = (sizeOf(i) * (1 + 0.14 * Math.max(lifts[i]?.value ?? 0, 0)) * p.scale) / 2;
    if (halfH < 4) return null;
    return { sx: p.sx, sy: p.sy, halfW: halfH * shape, halfH };
  };

  const pick = (clientX: number, clientY: number) => {
    const settings = settingsRef.current;
    const rect = root.getBoundingClientRect();
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    for (let n = order.length - 1; n >= 0; n--) {
      const i = order[n];
      if (focus && i === focus.card) continue;
      const box = screenBox(i);
      if (!box) continue;
      const dx = Math.abs(px - box.sx);
      const dy = Math.abs(py - box.sy);
      if (dx > box.halfW || dy > box.halfH) continue;
      const corner = clamp(settings.radius, 0, 1) * Math.min(box.halfW, box.halfH);
      const qx = Math.max(dx - box.halfW + corner, 0);
      const qy = Math.max(dy - box.halfH + corner, 0);
      if (qx * qx + qy * qy <= corner * corner) return i;
    }
    return -1;
  };

  // Studio: boxy viditelných karet, od nejvzdálenější po nejbližší.
  const emitBoxes = () => {
    if (!settingsRef.current.editing || !callbacks.onBoxes) return;
    const boxes: RibbonBox[] = [];
    for (const i of order) {
      const box = screenBox(i);
      if (!box || box.halfH < 12) continue;
      const left = Math.round(box.sx - box.halfW);
      const top = Math.round(box.sy - box.halfH);
      const w = Math.round(box.halfW * 2);
      const h = Math.round(box.halfH * 2);
      if (left + w < 0 || top + h < 0 || left > width || top > height) continue;
      boxes.push({ item: assignment[i] ?? 0, left, top, width: w, height: h });
    }
    const key = boxes.map((b) => `${b.item}:${b.left},${b.top},${b.width},${b.height}`).join("|");
    if (key === boxesKey) return;
    boxesKey = key;
    callbacks.onBoxes(boxes);
  };

  // Glyfy při posunu (glyphs.ts): rodí se podle rychlosti jízdy kolem řady,
  // nad i pod ní, kousek před kartami; kotva vynášecí linky je hrana karty.
  let glyphBudget = 0;
  const glyphPoint = new THREE.Vector3();
  const glyphDrift = new THREE.Vector3();
  const projectTmp = new THREE.Vector3();
  const projectPoint = (point: THREE.Vector3) => {
    projectTmp.copy(point).applyMatrix4(camera.matrixWorldInverse);
    const depth = -projectTmp.z;
    if (depth < 0.3) return null;
    const focal = height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    return {
      x: width * vanish.x + (projectTmp.x * focal) / depth,
      y: height * vanish.y - (projectTmp.y * focal) / depth,
      scale: focal / depth,
      depth,
    };
  };
  const anchorOf = (card: number, side: number, x: number): [number, number] | null => {
    const box = screenBox(card);
    if (!box) return null;
    const left = box.sx - box.halfW + 6;
    const right = box.sx + box.halfW - 6;
    return [clamp(x, Math.min(left, right), Math.max(left, right)), side > 0 ? box.sy - box.halfH : box.sy + box.halfH];
  };
  // Kliknutí / dotyk mimo karty: shluk glyfů v tom místě (zpracuje se ve snímku).
  const bursts: { point: THREE.Vector3; card: number }[] = [];
  // Hlavní karta: při každé nové se kolem ní nakreslí pár glyfů.
  let glyphLead = -1;

  // Glyf kolem bodu `point` (svět), kotva = karta `card`.
  const spawnNear = (point: THREE.Vector3, card: number, spread: number, side?: number) => {
    const dir = side ?? (Math.random() < 0.5 ? 1 : -1);
    glyphPoint.copy(point);
    // Bokem po řadě a nahoru/dolů od bodu.
    glyphPoint.x += (Math.random() - 0.5) * spread;
    glyphPoint.y += dir * (0.15 + Math.random() * spread * 0.5);
    glyphPoint.addScaledVector(finalPose.dir, 0.15 + Math.random() * 0.35);
    glyphDrift.set(0, dir * 0.05, 0);
    glyphLayer.spawn(glyphPoint, glyphDrift, card, dir);
  };

  const drawGlyphs = (dt: number) => {
    const settings = settingsRef.current;
    const live = settings.glyphs && settings.view === "row" && !settings.editing && !settings.reduced && cardCount > 0;
    if (live) {
      const half = clamp(settings.cardSize, 0.2, 1.5) * 0.5;
      // Při posunu: čím rychleji, tím víc glyfů kolem řady.
      glyphBudget += dt * clamp((speedNow - 0.5) * 2.2, 0, 7);
      while (glyphBudget >= 1) {
        glyphBudget -= 1;
        const along = s + LEAD + (Math.random() * 5 - 2.5);
        pointAt(along, glyphPoint);
        const side = Math.random() < 0.5 ? 1 : -1;
        glyphPoint.y += side * (half + 0.3 + Math.random() * 0.45);
        glyphPoint.addScaledVector(finalPose.dir, 0.2 + Math.random() * 0.5);
        glyphDrift.set(0, side * 0.06, 0);
        glyphLayer.spawn(glyphPoint, glyphDrift, wrap(Math.round(along), cardCount), side);
      }
      // Nová hlavní karta: zvýraznit ji glyfy nad i pod ní.
      const lead = wrap(Math.round(s + LEAD), cardCount);
      if (lead !== glyphLead && stir < 0.2 && Math.abs(pendingTravel) < 0.05) {
        glyphLead = lead;
        const grown = sizeOf(lead) * 0.5;
        cardPosition(lead, tmpB);
        [1, -1, Math.random() < 0.5 ? 1 : -1].forEach((side) => {
          tmpA.copy(tmpB);
          tmpA.y += side * (grown + 0.1);
          spawnNear(tmpA, lead, 1.2, side);
        });
      }
      // Kliknutí / dotyk mimo karty.
      while (bursts.length) {
        const burst = bursts.shift()!;
        for (let i = 0; i < 5; i++) spawnNear(burst.point, burst.card, 1.6);
      }
    } else {
      glyphBudget = 0;
      bursts.length = 0;
    }
    return glyphLayer.draw({ dt, dpr, width, height, project: projectPoint, anchor: anchorOf, fog: fogAt });
  };

  // Bod ve světě pod pixelem (px, py vůči kořeni) v hloubce řady.
  const unproject = (px: number, py: number, out: THREE.Vector3) => {
    const depth = Math.max(finalPose.r, 0.5);
    const focal = height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    out.set(((px - width * vanish.x) * depth) / focal, (-(py - height * vanish.y) * depth) / focal, -depth);
    return out.applyMatrix4(camera.matrixWorld);
  };

  // Nejbližší viditelná karta k bodu na obrazovce (pro kotvu shluku).
  const nearestCard = (px: number, py: number) => {
    let best = wrap(Math.round(s + LEAD), cardCount);
    let bestD = Infinity;
    for (const i of order) {
      const box = screenBox(i);
      if (!box) continue;
      const d = Math.hypot(box.sx - px, box.sy - py);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  };

  // `row`: neaktivní karty ztlumené (`rowDim`), vzdálenější (zadní část
  // kruhu) skoro neviditelné (`rowBack`); hlavní a karta pod myší plné.
  // Při prudkém posunu (odtažení) se vše vyrovná.
  const centerWeight = (card: number) => {
    let away = card - (s + LEAD);
    away = Math.abs(wrap(away + cardCount / 2, cardCount) - cardCount / 2);
    const w = clamp(1 - away, 0, 1);
    return w * w * (3 - 2 * w);
  };
  const presence = (card: number) => {
    const settings = settingsRef.current;
    if (settings.view !== "row" || settings.editing || !cardCount) return 1;
    let away = card - (s + LEAD);
    away = Math.abs(wrap(away + cardCount / 2, cardCount) - cardCount / 2);
    const dim = clamp(settings.rowDim, 0, 1);
    const back = clamp(settings.rowBack, 0, dim);
    const near = clamp(1 - (away - 2.5) / 1.5, 0, 1);
    const base = back + (dim - back) * near;
    const active = Math.max(centerWeight(card), clamp(lifts[card]?.value ?? 0, 0, 1));
    const alpha = base + (1 - base) * active;
    return alpha + (1 - alpha) * stir;
  };

  // Popisek nad kartou: pod myší, jinak v `row` nad hlavní kartou — ta je
  // zvýrazněná stejně jako při hoveru (rámeček s rozměrem, drobky). Vrací
  // true, dokud se animuje.
  let labelLead = -1;
  let leadAt = 0;
  const drawLabel = (dt: number) => {
    const settings = settingsRef.current;
    const lead = wrap(Math.round(s + LEAD), cardCount);
    if (lead !== labelLead) {
      labelLead = lead;
      leadAt = time;
    }
    const resting = settings.view === "row" && !focus && !settings.editing;
    const card = !settings.labels ? -1 : hovered >= 0 ? hovered : resting ? lead : -1;
    const box = card >= 0 ? screenBox(card) : null;
    // Na hlavní kartě se popisek ukáže jen v klidu (při odtažení zhasne).
    // Na úzké kartě (telefon) se písmo popisku z úvodní stránky nevejde — v klidu bez popisku.
    const roomy = box ? box.halfW * 2 >= LABEL_MIN_WIDTH : false;
    const want = box ? (card === hovered ? 1 : roomy ? clamp(1 - stir * 5, 0, 1) : 0) : 0;
    labelAlpha += (want - labelAlpha) * (1 - Math.exp(-dt / 0.12));
    if (Math.abs(labelAlpha - want) < 0.003) labelAlpha = want;
    if (box) labelCard = card;
    label.style.opacity = labelAlpha.toFixed(3);
    if (labelCard < 0 || labelAlpha <= 0.001) return labelAlpha !== want;
    const shown = box ?? screenBox(labelCard);
    if (!shown) return false;
    const item = assignment[labelCard] ?? 0;
    const data = itemsRef.current[item];
    const image = images[item];
    const cw = Math.round(shown.halfW * 2);
    const ch = Math.round(shown.halfH * 2);
    const isLead = labelCard === lead && labelCard !== hovered;
    drawCardLayer(label, {
      item: {
        src: data?.src ?? "",
        alt: data?.alt ?? "",
        title: data?.title,
        subtitle: data?.subtitle,
        href: data?.href,
        cta: data?.cta,
      },
      index: labelCard,
      cw,
      ch,
      // Hlavní karta zvýrazněná jako při hoveru; karta pod myší podle hoveru.
      focus: isLead ? 1 : clamp(lifts[labelCard]?.value ?? 0, 0, 1),
      natural: [image?.naturalWidth ?? 0, image?.naturalHeight ?? 0],
      since: settings.reduced ? 10 : time - (isLead ? leadAt : hoverAt),
      time,
      dpr,
      font: labelFont,
    });
    label.style.width = `${cw + LABEL_MARGIN * 2}px`;
    label.style.height = `${ch + LABEL_MARGIN * 2}px`;
    label.style.transform = `translate(${(shown.sx - shown.halfW - LABEL_MARGIN).toFixed(1)}px, ${(shown.sy - shown.halfH - LABEL_MARGIN).toFixed(1)}px)`;
    // Rámeček je živý (drobky, obíhající tečky) — kreslit dál, dokud je vidět.
    return labelAlpha > 0.001 && !settings.reduced;
  };

  const schedule = () => {
    if (destroyed || lost || !visible || raf) return;
    raf = requestAnimationFrame(frame);
  };

  const prewarm = (which: number) => {
    const image = images[which];
    if (!image || !image.complete || !image.naturalWidth || imageTextures.has(which)) return;
    const texture = new THREE.Texture(image);
    texture.colorSpace = THREE.NoColorSpace;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = true;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    texture.needsUpdate = true;
    imageTextures.set(which, texture);
    renderer.initTexture(texture);
  };

  const focusCard = (index: number) => {
    if (index < 0 || index >= cardCount) return;
    const item = assignment[index] ?? 0;
    const image = images[item];
    if (!image || !image.complete || !image.naturalWidth) return;
    prewarm(item);
    const texture = imageTextures.get(item);
    if (!texture) return;
    photoUniforms.uImage.value = texture;
    photoUniforms.uImageAspect.value = image.naturalWidth / image.naturalHeight;
    cardPosition(index, tmpA);
    const direction = new THREE.Vector3().subVectors(camera.position, tmpA).normalize();
    focus = {
      card: index,
      item,
      e: 0,
      v: 0,
      target: 1,
      from: copyPose(finalPose, makePose()),
      handoff: 0,
      handoffV: 0,
      dir: direction,
      aspect: shapeOfCard(index),
      aspectV: 0,
    };
    hovered = -1;
    holding = false;
    peek = false;
    if (settingsRef.current.tour !== "overview") {
      phase = "ride";
      phaseClock = 0;
      pull = 0;
      pullV = 0;
    }
    s = index - LEAD;
    velocity = 0;
    pendingTravel = 0;
    callbacks.onFocus(item);
    schedule();
  };

  const release = () => {
    if (!focus || focus.target === 0) return;
    focus.target = 0;
    callbacks.onFocus(-1);
    schedule();
  };

  // Další / předchozí skupina (projekt): kamera dojede tak, aby první karta
  // skupiny byla ta, ke které jede (LEAD).
  const step = (direction: 1 | -1) => {
    if (!cardCount) return;
    if (focus && focus.target === 1) release();
    peek = false;
    if (phase === "overview") phase = "ride";
    phaseClock = 0;
    const startOf = (k: number) => {
      const group = groupOf(k);
      for (let n = 0; n < cardCount && groupOf(k - 1) === group; n++) k--;
      return k;
    };
    const from = Math.round(s + pendingTravel + LEAD);
    let target: number;
    if (direction > 0) {
      const group = groupOf(from);
      target = from;
      for (let n = 0; n < cardCount && groupOf(target) === group; n++) target++;
    } else {
      target = startOf(startOf(from) - 1);
    }
    pendingTravel = target - LEAD - s;
    velocity = 0;
    wheelAt = time;
    schedule();
  };

  function frame(now: number) {
    raf = 0;
    if (destroyed || lost) return;
    const settings = settingsRef.current;
    const dt = last ? Math.min(Math.max((now - last) / 1000, 0), 0.05) : 1 / 60;
    last = now;
    time += dt;
    let busy0 = false;
    const reduced = settings.reduced;
    refreshColors();
    buildPath();
    assign();
    layout();
    if (!cardCount) return;

    if (pointer.inside && !press && settings.interactive && !(focus && focus.target === 1)) {
      const candidate = pick(pointer.clientX, pointer.clientY);
      if (candidate !== hovered) {
        hovered = candidate;
        root.style.cursor = candidate >= 0 && settings.focusOnClick ? "pointer" : "";
        if (candidate >= 0) prewarm(assignment[candidate] ?? 0);
        hoverAt = time;
      }
    } else if (!pointer.inside || (focus && focus.target === 1)) {
      hovered = -1;
    }
    const hovering = settings.pauseOnHover && hovered >= 0;

    const tour = settings.tour;
    if (tour === "cycle" && !reduced && !settings.paused) {
      if (!focus && !hovering && !press && time - wheelAt > 1.2) phaseClock += dt;
      if (phase === "ride" && phaseClock >= Math.max(settings.interval, 2)) {
        phase = "overview";
        phaseClock = 0;
      } else if (phase === "overview" && phaseClock >= 3.8) {
        phase = "ride";
        phaseClock = 0;
      }
    } else {
      phase = "ride";
      phaseClock = 0;
    }
    const pullTarget = tour === "overview" || phase === "overview" || holding || peek ? 1 : 0;
    [pull, pullV] = springTo(pull, pullV, pullTarget, dt, reduced ? 0.05 : 1.7);

    const scrolled = time - wheelAt < 1.2;
    const stopped = hovering || !!focus || scrolled;
    [rate, rateV] = springTo(rate, rateV, stopped ? 0 : 1, dt, stopped ? 0.25 : 0.9);
    const cruise = reduced || settings.paused ? 0 : settings.speed;
    const dragging = !!press && press.moved && pull < 0.5;
    if (!dragging) {
      const glide = pendingTravel * (1 - Math.exp(-dt / (reduced ? 0.02 : 0.22)));
      pendingTravel -= glide;
      if (Math.abs(pendingTravel) < 1e-4) pendingTravel = 0;
      s += (cruise * Math.max(rate, 0) + velocity) * dt + glide;
      velocity *= Math.exp(-dt * 1.8);
    }
    if (pendingYaw !== 0) {
      const turn = pendingYaw * (1 - Math.exp(-dt / (reduced ? 0.02 : 0.16)));
      pendingYaw -= turn;
      if (Math.abs(pendingYaw) < 1e-4) pendingYaw = 0;
      orbitYaw += turn;
    }
    if (!(press && press.moved)) {
      orbitYaw += orbitYawV * dt;
      orbitPitch += orbitPitchV * dt;
      orbitYawV *= Math.exp(-dt * 2);
      orbitPitchV *= Math.exp(-dt * 2);
    }
    // Nástup: poloha řady jde po křivce z `introFrom` do `introTo` a přebíjí
    // jízdu, dojezd i autoplay, dokud neskončí.
    if (intro >= 0 && intro < 1) {
      intro = clamp((time - introStart) / INTRO_LENGTH, 0, 1);
      const travel = 1 - Math.pow(1 - smoothstep01(clamp((intro - 0.08) / 0.92, 0, 1)), 2.2);
      s = introFrom + (introTo - introFrom) * travel;
      velocity = 0;
      pendingTravel = 0;
      busy0 = true;
    }
    s = wrap(s, cardCount);
    updateShifts();

    // Rychlost jízdy (karty/s) — v `row` z ní roste odtažení do přehledu.
    let moved = s - lastS;
    if (moved > cardCount / 2) moved -= cardCount;
    if (moved < -cardCount / 2) moved += cardCount;
    lastS = s;
    speedNow += (Math.abs(moved) / Math.max(dt, 1e-3) - speedNow) * (1 - Math.exp(-dt / 0.12));

    const row = settings.view === "row";
    if (row) {
      // Autoplay: v klidu po `autoplay` s další projekt. Zásah návštěvníka
      // (i karta pod myší) ho na AUTOPLAY_HOLD s pozdrží.
      const interacting =
        !!press || hovered >= 0 || time - userAt < AUTOPLAY_HOLD || !!focus || pull > 0.05 || introRunning();
      if (settings.autoplay > 0 && !settings.editing && !settings.paused && !reduced) busy0 = true;
      if (settings.autoplay > 0 && !settings.editing && !settings.paused && !reduced && !interacting) {
        if (pendingTravel === 0 && Math.abs(velocity) < 0.35) autoClock += dt;
        if (autoClock >= settings.autoplay) {
          autoClock = 0;
          step(1);
        }
      } else {
        autoClock = 0;
      }
      // Po zastavení dojet na nejbližší kartu (hlavní karta přesně na středu).
      const idle = !press && time - wheelAt > 0.25 && Math.abs(velocity) < 0.35 && pendingTravel === 0;
      if (idle && !focus) {
        const off = Math.round(s + LEAD) - (s + LEAD);
        if (Math.abs(off) > 1e-3) {
          pendingTravel = off;
          velocity = 0;
        }
      }
      // Odtažení jen při prudkém posunu: běžné kolečko řadu jen posune.
      const hard = clamp((speedNow - SCOPE_SPEED_FROM) / (SCOPE_SPEED_FULL - SCOPE_SPEED_FROM), 0, 1);
      const stirTarget = reduced ? 0 : hard * hard * clamp(settings.scope, 0, 1);
      [stir, stirV] = springTo(stir, stirV, stirTarget, dt, stirTarget > stir ? 0.9 : 1.4);
      if (Math.abs(stir - stirTarget) > 1e-3 || Math.abs(stirV) > 1e-3) busy0 = true;
      // Nástup: kamera drží přehled a ke konci se plynule přiblíží do řady.
      if (introRunning()) {
        const held = 1 - smoothstep01(clamp((intro - 0.35) / 0.65, 0, 1));
        if (held > stir) {
          stir = held;
          stirV = 0;
        }
      }
    } else {
      stir = 0;
    }

    if (row) computeRow(travelPose);
    else computeTravel(travelPose);
    computeOverview(overviewPose, row ? travelPose : undefined);
    if (row) {
      // Odtažení při posunu: kamera couvne rovně od řady a trochu se zvedne —
      // je vidět delší kus oblouku, ne celý (obří) kruh. Podržení (pull)
      // pořád ukáže celou dráhu.
      copyPose(travelPose, scopePose);
      scopePose.dir.addScaledVector(up, SCOPE_RISE).normalize();
      scopePose.r *= SCOPE_BACK;
      blendPose(travelPose, scopePose, stir, fromPose);
      blendPose(fromPose, overviewPose, pull, basePose);
    } else {
      blendPose(travelPose, overviewPose, pull, basePose);
    }

    if (focus) {
      [focus.e, focus.v] = springTo(focus.e, focus.v, focus.target, dt, reduced ? 0.08 : 1.25);
      if (focus.target === 0) {
        [focus.handoff, focus.handoffV] = springTo(focus.handoff, focus.handoffV, 1, dt, reduced ? 0.05 : 0.6);
      }
      const cardShape = shapeOfCard(focus.card);
      [focus.aspect, focus.aspectV] = springTo(
        focus.aspect,
        focus.aspectV,
        focus.target ? photoUniforms.uImageAspect.value : cardShape,
        dt,
        reduced ? 0.08 : 1.1,
      );
      cardPosition(focus.card, focusPose.target);
      focusPose.dir.copy(focus.dir);
      focusPose.r = focusDistance(cardHeight(cardShape), photoUniforms.uImageAspect.value);
      const start = blendPose(focus.from, basePose, focus.handoff, fromPose);
      blendPose(start, focusPose, focus.e, finalPose);
      if (focus.target === 0 && focus.e < 0.002 && Math.abs(focus.v) < 0.02) {
        focus = null;
        photo.visible = false;
        copyPose(basePose, finalPose);
      }
    } else {
      copyPose(basePose, finalPose);
    }

    // Úběžník: posun výřezu (setViewOffset). Přiblížená karta i přehled
    // celé dráhy se vrací na střed.
    const centred = Math.max(focus ? clamp(focus.e, 0, 1) : 0, clamp(Math.max(pull, stir), 0, 1));
    vanish.x = clamp(settings.vanishX, 0.2, 0.8) + (0.5 - clamp(settings.vanishX, 0.2, 0.8)) * centred;
    vanish.y = clamp(settings.vanishY, 0.2, 0.8) + (0.5 - clamp(settings.vanishY, 0.2, 0.8)) * centred;
    camera.fov = THREE.MathUtils.radToDeg(verticalFov());
    camera.aspect = width / height;
    camera.near = Math.max(finalPose.r * 0.01, 0.05);
    camera.far = Math.max(finalPose.r * 6, boundRadius * 6, 50);
    camera.setViewOffset(width, height, (0.5 - vanish.x) * width, (0.5 - vanish.y) * height, width, height);
    camera.updateProjectionMatrix();
    camera.position.copy(finalPose.target).addScaledVector(finalPose.dir, finalPose.r);
    camera.up.set(0, 1, 0);
    camera.lookAt(finalPose.target);
    camera.updateMatrixWorld();

    fogLength.value = ((4 + finalPose.r) * 1.9) / clamp(settings.fog, 0.1, 4);
    // `row`: mlha až za hlavní řadou; při odtažení se vrací k objektivu.
    fogStart.value = row ? finalPose.r * (1 - stir * 0.7) : 0;
    const focusE = focus ? clamp(focus.e, 0, 1) : 0;
    cardUniforms.uDim.value = focusE * 0.65;
    nearCut = row ? finalPose.r * 0.7 * (1 - stir) * (1 - focusE) : 0;
    cardUniforms.uNearCut.value = nearCut;
    cardUniforms.uRadius.value = clamp(settings.radius, 0, 1);
    cardUniforms.uShadow.value = clamp(settings.shadow, 0, 1);
    threadUniforms.uOpacity.value =
      clamp(settings.thread, 0, 1) * Math.min(1, 1 + (dpr - 1) * 0.85) * (1 - focusE * 0.7);
    thread.visible = settings.thread > 0;

    let busy = !reduced && !settings.paused && (Math.abs(settings.speed) > 1e-4 || tour !== "ride");
    busy ||= Math.abs(velocity) > 1e-3 || Math.abs(pull - pullTarget) > 1e-3 || Math.abs(pullV) > 1e-3;
    busy ||= Math.abs(orbitYawV) + Math.abs(orbitPitchV) > 1e-3 || !!focus || !!press;
    busy ||= pendingTravel !== 0 || pendingYaw !== 0 || scrolled || busy0 || speedNow > 1e-3;

    const forward = tmpA.set(0, 0, -1).applyQuaternion(camera.quaternion);
    for (let i = 0; i < cardCount; i++) {
      cardPosition(i, tmpB);
      depths[i] = tmpB.sub(camera.position).dot(forward);
      const liftSpring = lifts[i];
      const liftTarget = i === hovered ? 1 : 0;
      [liftSpring.value, liftSpring.velocity] = springTo(
        liftSpring.value,
        liftSpring.velocity,
        liftTarget,
        dt,
        reduced ? 0.05 : 0.35,
      );
      if (Math.abs(liftSpring.value - liftTarget) > 1e-3 || Math.abs(liftSpring.velocity) > 1e-3) busy = true;
    }
    // Hlavní karta (row) a karta pod myší se kreslí poslední — vždy navrchu.
    if (settings.view === "row") depths[wrap(Math.round(s + LEAD), cardCount)] = -1e3;
    if (hovered >= 0) depths[hovered] = -2e3;
    order.sort((a, b) => depths[b] - depths[a] || a - b);
    order.forEach((i, slot) => {
      cardPosition(i, tmpB);
      const shape = shapeOfCard(i);
      centers[slot * 3] = tmpB.x;
      centers[slot * 3 + 1] = tmpB.y;
      centers[slot * 3 + 2] = tmpB.z;
      cardData[slot * 4] = sizeOf(i);
      cardData[slot * 4 + 1] = assignment[i] ?? 0;
      cardData[slot * 4 + 2] = Math.max(lifts[i].value, 0);
      cardData[slot * 4 + 3] = (focus && i === focus.card ? 0 : presence(i)) * introFade();
      shapeData[slot] = shape;
    });
    geometry.instanceCount = cardCount;
    centerAttribute.needsUpdate = true;
    cardAttribute.needsUpdate = true;
    shapeAttribute.needsUpdate = true;

    if (focus) {
      cardPosition(focus.card, photo.position);
      photo.quaternion.copy(camera.quaternion);
      const aspect = clamp(focus.aspect, 0.2, 5);
      const cardH = cardHeight(shapeOfCard(focus.card));
      photo.scale.set(cardH * aspect, cardH, 1);
      photo.visible = true;
      photoUniforms.uPlaneAspect.value = aspect;
      const corner = clamp(settings.radius, 0, 1) * Math.min(aspect, 1) * 0.5;
      photoUniforms.uRadius.value = corner + (0.03 - corner) * clamp(focus.e, 0, 1);
      const depth = Math.max(tmpC.subVectors(photo.position, camera.position).dot(forward), 0);
      const fog = fogAt(depth);
      photoUniforms.uOpacity.value = fog + (1 - fog) * clamp(focus.e, 0, 1);
    }

    for (let i = 0; i < MAX_ITEMS; i++) {
      if (fading[i] && loaded[i] < 1) {
        loaded[i] = reduced ? 1 : Math.min(1, loaded[i] + dt / 0.6);
        busy = true;
      }
    }

    renderer.render(scene, camera);

    const lead = assignment[wrap(Math.round(s + LEAD), cardCount)] ?? 0;
    if (lead !== current) {
      current = lead;
      callbacks.onCurrent(lead);
    }
    emitBoxes();
    if (drawGlyphs(dt)) busy = true;
    if (drawLabel(dt)) busy = true;

    if (busy || pointer.inside) schedule();
  }

  const locate = (event: PointerEvent) => {
    pointer.clientX = event.clientX;
    pointer.clientY = event.clientY;
  };

  const onMove = (event: PointerEvent) => {
    if (event.pointerType !== "touch") {
      pointer.inside = true;
      locate(event);
    }
    const settings = settingsRef.current;
    if (press && press.id === event.pointerId) {
      if (!press.moved && Math.hypot(event.clientX - press.x, event.clientY - press.y) > 6) {
        press.moved = true;
        window.clearTimeout(pressTimer);
        hovered = -1;
        root.style.cursor = "grabbing";
      }
      if (press.moved && settings.draggable) {
        const dx = event.clientX - press.lastX;
        const dy = event.clientY - press.lastY;
        const t = performance.now();
        if (pull > 0.5) {
          orbitYaw -= (dx / Math.max(width, 1)) * 3;
          orbitPitch += (dy / Math.max(height, 1)) * 1.6;
          press.samples.push({ t, d: dx });
        } else if (!focus) {
          // Tah do strany i nahoru/dolů — co je delší. Na dotyku jen do
          // strany, svislý tah nechává stránce (touch-action: pan-y) — kromě
          // stránky bez scrollu (`wheel`), tam patří scéně oba směry.
          const sideOnly = press.touch && !settings.wheel;
          const along = sideOnly || Math.abs(dx) > Math.abs(dy) ? -dx : -dy;
          const cards = (along / Math.max(height, 1)) * 7;
          s += cards;
          pendingTravel = 0;
          press.samples.push({ t, d: cards });
        }
        while (press.samples.length && t - press.samples[0].t > 100) press.samples.shift();
      }
      press.lastX = event.clientX;
      press.lastY = event.clientY;
    }
    schedule();
  };

  const onDown = (event: PointerEvent) => {
    const settings = settingsRef.current;
    if (!settings.interactive || !event.isPrimary || event.button > 0) return;
    userAt = time;
    press = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      moved: false,
      touch: event.pointerType === "touch",
      samples: [],
    };
    velocity = 0;
    orbitYawV = 0;
    orbitPitchV = 0;
    if (event.pointerType !== "touch") {
      try {
        stage.setPointerCapture(event.pointerId);
      } catch {}
    }
    window.clearTimeout(pressTimer);
    if (settings.holdToReveal && !focus) {
      pressTimer = window.setTimeout(() => {
        if (press && !press.moved && !focus) {
          holding = true;
          hovered = -1;
          root.style.cursor = "grabbing";
          schedule();
        }
      }, 300);
    }
    schedule();
  };

  const finish = (event: PointerEvent, cancelled: boolean) => {
    if (!press || press.id !== event.pointerId) return;
    const settings = settingsRef.current;
    const ended = press;
    press = null;
    window.clearTimeout(pressTimer);
    const wasHolding = holding;
    holding = false;
    try {
      if (stage.hasPointerCapture(event.pointerId)) stage.releasePointerCapture(event.pointerId);
    } catch {}
    if (ended.moved) {
      const now = performance.now();
      const recent = ended.samples.filter((sample) => now - sample.t < 100);
      if (recent.length > 1 && settings.draggable) {
        const span = Math.max((recent[recent.length - 1].t - recent[0].t) / 1000, 1 / 60);
        const speed = recent.reduce((sum, sample) => sum + sample.d, 0) / span;
        if (pull > 0.5) orbitYawV = clamp((-speed / Math.max(width, 1)) * 3, -3, 3);
        else if (!focus) velocity = clamp(speed, -30, 30);
      }
    } else if (!cancelled && !wasHolding && settings.view === "row" && !focus) {
      // `row`: klik na hlavní kartu otevře projekt, na jinou kartu k ní dojede.
      const index = pick(event.clientX, event.clientY);
      if (index >= 0) {
        let delta = index - Math.round(s + LEAD + pendingTravel);
        delta = wrap(delta + cardCount / 2, cardCount) - cardCount / 2;
        if (Math.abs(delta) < 0.5) callbacks.onSelect?.(assignment[index] ?? 0);
        else {
          pendingTravel = index - LEAD - s;
          pendingTravel = wrap(pendingTravel + cardCount / 2, cardCount) - cardCount / 2;
          velocity = 0;
          wheelAt = time;
        }
      } else {
        // Mimo karty: shluk glyfů v místě kliknutí / dotyku.
        const rect = root.getBoundingClientRect();
        const px = event.clientX - rect.left;
        const py = event.clientY - rect.top;
        bursts.push({ point: unproject(px, py, new THREE.Vector3()), card: nearestCard(px, py) });
      }
    } else if (!cancelled && !wasHolding) {
      if (focus && focus.target === 1) {
        release();
      } else if (settings.focusOnClick) {
        const index = pick(event.clientX, event.clientY);
        if (index >= 0) focusCard(index);
      }
    }
    root.style.cursor = "";
    schedule();
  };

  const onUp = (event: PointerEvent) => finish(event, false);
  const onCancel = (event: PointerEvent) => finish(event, true);
  const onLeave = (event: PointerEvent) => {
    if (press && press.id === event.pointerId) return;
    pointer.inside = false;
    hovered = -1;
    root.style.cursor = "";
    schedule();
  };

  const onWheel = (event: WheelEvent) => {
    const settings = settingsRef.current;
    if (!settings.wheel || !settings.interactive) return;
    event.preventDefault();
    userAt = time;
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? height : 1;
    const delta = clamp((event.deltaY + event.deltaX) * unit, -240, 240);
    wheelAt = time;
    if (settings.tour === "overview") {
      pendingYaw += delta * 0.0025;
    } else {
      if (focus && focus.target === 1) release();
      peek = false;
      if (phase === "overview") phase = "ride";
      phaseClock = 0;
      // Zhruba 0,6 karty na zub kolečka (120 px).
      pendingTravel += delta * 0.005;
    }
    schedule();
  };

  const onKey = (event: KeyboardEvent) => {
    if (!settingsRef.current.interactive) return;
    userAt = time;
    if (event.key === "Escape") {
      release();
      peek = false;
    } else if (event.key === "ArrowUp" || event.key === "ArrowRight") {
      event.preventDefault();
      step(1);
    } else if (event.key === "ArrowDown" || event.key === "ArrowLeft") {
      event.preventDefault();
      step(-1);
    } else if (event.key === "Enter" && event.target === root) {
      event.preventDefault();
      if (focus) release();
      else peek = !peek;
    }
    schedule();
  };

  stage.addEventListener("pointerdown", onDown);
  stage.addEventListener("pointermove", onMove);
  stage.addEventListener("pointerup", onUp);
  stage.addEventListener("pointercancel", onCancel);
  stage.addEventListener("pointerleave", onLeave);
  wheelHost.addEventListener("wheel", onWheel, { passive: false });
  root.addEventListener("keydown", onKey);

  const resizer = new ResizeObserver(() => {
    if (resize()) schedule();
  });
  resizer.observe(root);

  const observer =
    typeof IntersectionObserver === "undefined"
      ? null
      : new IntersectionObserver(
          ([entry]) => {
            visible = entry.isIntersecting;
            if (visible) {
              last = 0;
              schedule();
            } else if (raf) {
              cancelAnimationFrame(raf);
              raf = 0;
            }
          },
          { rootMargin: "80px" },
        );
  if (observer) observer.observe(root);
  else visible = true;

  const onLost = (event: Event) => {
    event.preventDefault();
    lost = true;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  };
  const onRestored = () => {
    lost = false;
    itemsKey = "";
    buildAtlas();
    schedule();
  };
  canvas.addEventListener("webglcontextlost", onLost);
  canvas.addEventListener("webglcontextrestored", onRestored);

  resize();
  buildPath();
  assign();
  layout();
  buildAtlas();
  // Start: první položka je ta, ke které kamera jede.
  // Start: první položka vpředu. V `row` na rovném úseku dráhy (čtvrtina
  // délky, celé kolo položek), ne v otočce na konci, kde se karty skládají.
  const items0 = Math.max(1, Math.min(itemsRef.current.length, MAX_ITEMS));
  const startCard =
    settingsRef.current.view === "row" && settingsRef.current.order === "sequence"
      ? Math.round((cardCount * 0.25) / items0) * items0
      : 0;
  s = wrap(startCard - LEAD, cardCount);
  lastS = s;
  // Nástup jen mimo Studio a bez omezeného pohybu; jinak scéna rovnou stojí.
  if (!settingsRef.current.editing && !settingsRef.current.reduced && settingsRef.current.view === "row") {
    intro = 0;
    introTo = s;
    introFrom = s - INTRO_CARDS;
    s = introFrom;
    lastS = s;
    stir = 1;
    // `time` jsou hodiny enginu (od 0), nástup začne po krátké pauze.
    introStart = INTRO_DELAY;
  }
  photo.visible = true;
  renderer.compile(scene, camera);
  photo.visible = false;
  // Bez úvodního průletu: scéna začíná rovnou v jízdě, přehled přijde až
  // po `interval` (tour="cycle"), nebo hned, když je tour="overview".
  if (settingsRef.current.tour === "overview") pull = 1;
  schedule();

  return {
    sync: () => {
      resize();
      buildPath();
      assign();
      layout();
      buildAtlas();
      last = 0;
      schedule();
    },
    travel: (cards: number) => {
      if (!focus) velocity += cards * 1.8;
      schedule();
    },
    // Šipky / tlačítka zvenku jsou zásah návštěvníka — autoplay počká.
    step: (direction: 1 | -1) => {
      userAt = time;
      step(direction);
    },
    focus: (item: number) => {
      // Nejbližší karta s touhle položkou před kamerou.
      for (let n = 0; n < cardCount; n++) {
        const card = wrap(Math.round(s + LEAD) + n, cardCount);
        if (assignment[card] === item) return focusCard(card);
      }
    },
    release,
    reveal: (show: boolean) => {
      peek = show;
      schedule();
    },
    destroy: () => {
      destroyed = true;
      if (raf) cancelAnimationFrame(raf);
      window.clearTimeout(pressTimer);
      observer?.disconnect();
      resizer.disconnect();
      stage.removeEventListener("pointerdown", onDown);
      stage.removeEventListener("pointermove", onMove);
      stage.removeEventListener("pointerup", onUp);
      stage.removeEventListener("pointercancel", onCancel);
      stage.removeEventListener("pointerleave", onLeave);
      wheelHost.removeEventListener("wheel", onWheel);
      root.removeEventListener("keydown", onKey);
      root.style.cursor = "";
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      images.forEach((image) => {
        image.onload = null;
      });
      imageTextures.forEach((texture) => texture.dispose());
      atlasTexture?.dispose();
      base.dispose();
      geometry.dispose();
      threadGeometry.dispose();
      photoGeometry.dispose();
      cardMaterial.dispose();
      threadMaterial.dispose();
      photoMaterial.dispose();
      renderer.dispose();
      if (!renderer.getContext().isContextLost()) renderer.forceContextLoss();
      canvas.remove();
      label.remove();
      glyphLayer.destroy();
    },
  };
};
