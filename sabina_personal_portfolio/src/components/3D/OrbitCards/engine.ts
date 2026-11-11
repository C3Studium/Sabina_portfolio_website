// OrbitCards — shader a chování.
//
// Tady žije všechno, co se děje mimo React: WebGL plátno, instancované
// karty, shadery (zaoblení, rozostření podle hloubky, stín, ztmavení)
// a pohyb karet po dráze (pružiny, setrvačnost, brzda) s ovládáním myší,
// dotykem, kolečkem a klávesnicí. React komponenta v index.tsx jen předá
// nastavení přes ref a volá controller.
//
// Vychází z React Bits „SpinShutter", ale karty už neobíhají po kruhu:
// jedou po DRÁZE, která od přední karty ubíhá do hloubky (jako dřívější
// nakloněná řada v heru). Poloha karty je číslo slotu s: 0 = vpředu,
// kladné = dál vzadu, záporné = už projela kolem přední pozice. Vidět je
// jen okno přední části dráhy, zbytek zhasne do stínu.

import * as THREE from "three";
import { SNOW } from "@/lib/palette";

export interface OrbitCardsItem {
  src: string;
  alt: string;
  title?: string;
  subtitle?: string;
  href?: string;
  /** Text tlačítka v panelu nad kartou. */
  cta?: string;
}

/**
 * Karta pod myší, jak ji vidí HTML vrstva nad plátnem. Souřadnice jsou
 * v px vůči kořeni komponenty, y dolů (jako CSS).
 */
export interface OverlayState {
  /** Index položky (items), ne karty — karty se opakují. */
  item: number;
  /** Ohraničující obdélník natočené karty na obrazovce. */
  box: { left: number; top: number; right: number; bottom: number };
  /** Levý dolní roh karty a úhel její spodní hrany (rad) — kotva panelu. */
  anchor: { x: number; y: number; angle: number; width: number };
  /** 0–1: jak moc je karta „v hoveru" (plynule náběh i doběh). */
  focus: number;
  /** Skutečný rozměr obrázku v px — pro popisek rámečku. */
  natural: { width: number; height: number };
}

/** Cokoli, z čeho jde přečíst postup 0–1 (typicky MotionValue). */
export interface ProgressSource {
  get: () => number;
}

/** Nastavení, která engine čte každý snímek přes ref. */
export interface Settings {
  count: number;
  aspect: number;
  angle: number;
  gap: number;
  orbit: number;
  stack: number;
  arch: number;
  lag: number;
  bounce: number;
  cardYaw: number;
  cardLean: number;
  jitter: number;
  radius: number;
  tilt: number;
  roll: number;
  distance: number;
  scale: number;
  cardHeight: number;
  anchor: number;
  visible: number;
  shade: number;
  exit: number;
  dim: number;
  dimHover: number;
  speed: number;
  aperture: number;
  haze: number;
  shadow: number;
  intro: boolean;
  progress: ProgressSource | null;
  pauseOnHover: boolean;
  draggable: boolean;
  wheel: boolean;
  captions: boolean;
  fitParent: boolean;
  backgroundColor: string;
  paused: boolean;
  dpr: number;
  reduced: boolean;
  held: boolean;
}

export interface Controller {
  sync: () => void;
  /** Probudí smyčku bez přepočtu — pro změnu postupu ze scrollu. */
  wake: () => void;
  step: (direction: number) => void;
  show: (card: number) => void;
  release: () => void;
  replay: () => void;
  destroy: () => void;
}

export interface Callbacks {
  onFeature: (item: number) => void;
  onPick: (item: number) => void;
  onSelect: (item: number) => void;
  /** Každý snímek: karta pod myší pro HTML vrstvu, nebo null. */
  onOverlay?: (state: OverlayState | null) => void;
}

export interface Overlay {
  caption: HTMLElement;
  title: HTMLElement;
  subtitle: HTMLElement;
}

interface Layer {
  image: HTMLImageElement;
  ready: boolean;
  drawn: boolean;
  shown: boolean;
  fade: number;
}

interface Card {
  /** Slot na dráze: 0 = vpředu, kladné = vzadu. */
  s: number;
  /** Rychlost, kterou karta dohání svůj cílový slot (vlastní pružina). */
  sv: number;
  /** Karta už má polohu — první snímek se jen usadí bez animace. */
  placed: boolean;
  /** 0–1: hover. Karta se narovná a zesvětlí (dim → dimHover). */
  focus: number;
  alpha: number;
  shade: number;
  /** Střed karty na obrazovce (px, y nahoru) a půlvýška v px. */
  x: number;
  y: number;
  hh: number;
  /** Střed karty v prostoru kamery (po natočení scény). */
  wx: number;
  wy: number;
  wz: number;
  /** Natočení karty v radiánech: kolem svislé osy, předklon, náklon. */
  yaw: number;
  pitch: number;
  roll: number;
  lift: number;
  /** Rohy karty na obrazovce (x0,y0 … x3,y3) — pro trefování kurzorem. */
  corners: Float32Array;
}

const MAX_CARDS = 48;
const MAX_LAYERS = 32;
const CAPTION_ROOM = 76;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const smooth = (edge0: number, edge1: number, value: number) => {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

// Zalomí x do rozsahu [-n/2, n/2) — slot karty na nekonečném pásu.
const wrapHalf = (value: number, n: number) => {
  const half = n / 2;
  return ((((value + half) % n) + n) % n) - half;
};

// Stálé náhodné číslo -1..1 pro kartu a kanál — každá karta má svůj
// vlastní náklon, který se mezi snímky nemění.
const jitterOf = (card: number, channel: number) => {
  const v = Math.sin(card * 12.9898 + channel * 78.233) * 43758.5453;
  return (v - Math.floor(v)) * 2 - 1;
};

// Křivka úvodního příjezdu (ease-in-out, konec ještě trochu změkčený).
const entryCurve = (x: number) => {
  const t = clamp(x, 0, 1);
  const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  return 1 - Math.pow(1 - eased, 1.35);
};

export const subscribeToMotion = (notify: () => void) => {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
};

export const readMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const parseColor = (value: string) => {
  const hex = value.trim().replace("#", "");
  if (!/^[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(hex)) return null;
  const full = hex.length === 3 ? hex.replace(/./g, (c) => c + c) : hex;
  return [0, 2, 4].map(
    (offset) => Number.parseInt(full.slice(offset, offset + 2), 16) / 255,
  );
};

export const isLight = (value: string) => {
  const rgb = parseColor(value);
  if (!rgb) return false;
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2] > 0.6;
};

const springTo = (
  value: number,
  velocity: number,
  target: number,
  dt: number,
  response: number,
  ratio: number,
) => {
  const omega = (Math.PI * 2) / Math.max(response, 0.02);
  const substeps = Math.max(1, Math.ceil(dt / (1 / 240)));
  const h = dt / substeps;
  let v = velocity;
  let x = value;
  for (let i = 0; i < substeps; i++) {
    v += (omega * omega * (target - x) - 2 * ratio * omega * v) * h;
    x += v * h;
  }
  return [x, v] as const;
};

/* ---------- Shadery ---------- */

// Karta je skutečný obdélník v prostoru: vertex shader ji natočí
// (iRot), posune na její místo (iPos) a promítne perspektivou. w = z,
// takže se vLocal interpoluje perspektivně správně a obrázek na
// natočené kartě se nedeformuje.
//
// Všechny délky v shaderech jsou ve SVĚTOVÝCH jednotkách roviny karty
// (výška karty = 1), ne v pixelech — proto vyhlazení hran bere fwidth.
//
// iPos:   xyz = střed v prostoru kamery, w = nevyužité
// iRot:   x = yaw (svislá osa), y = předklon, z = náklon karty,
//         w = natočení celé scény (roll)
// iLook:  x = rozostření, y = alfa, z = vrstva obrázku, w = opar
// iShape: x = zaoblení, y = síla stínu, z = ztmavení (stín hloubky),
//         w = ztlumení obrázku (černý překryv)
const vertexShader = `
attribute vec4 iPos;
attribute vec4 iRot;
attribute vec4 iLook;
attribute vec4 iShape;
uniform vec2 uView;
uniform vec2 uOrigin;
uniform vec2 uHalf;
uniform float uF;
varying vec2 vLocal;
varying vec4 vLook;
varying vec4 vShape;

vec3 turn(vec3 p, vec4 r) {
  float c, s;
  // náklon karty kolem osy pohledu
  c = cos(r.z); s = sin(r.z);
  p.xy = vec2(p.x * c - p.y * s, p.x * s + p.y * c);
  // předklon: kladný = horní hrana odchází dozadu
  c = cos(r.y); s = sin(r.y);
  p.yz = vec2(p.y * c - p.z * s, p.y * s + p.z * c);
  // yaw: kladný = pravá hrana jde k divákovi
  c = cos(r.x); s = sin(r.x);
  p.xz = vec2(p.x * c + p.z * s, -p.x * s + p.z * c);
  // natočení celé scény
  c = cos(r.w); s = sin(r.w);
  p.xy = vec2(p.x * c - p.y * s, p.x * s + p.y * c);
  return p;
}

void main() {
  // Rezerva kolem karty na rozostření a stín.
  float shadowReach = iShape.y > 0.001 ? uHalf.y * 0.42 : 0.0;
  vec2 reach = uHalf + iLook.x * 1.4 + uHalf.y * 0.04 + shadowReach;
  vec2 local = position.xy * reach;
  vec3 p = iPos.xyz + turn(vec3(local, 0.0), iRot);
  float z = max(p.z, 0.05);
  vec2 px = uOrigin + p.xy * uF / z;
  vec2 ndc = px / uView * 2.0 - 1.0;
  gl_Position = vec4(ndc * z, 0.0, z);
  vLocal = local;
  vLook = iLook;
  vShape = iShape;
}
`;

const fragmentShader = `
precision highp float;
precision highp sampler2DArray;

uniform sampler2DArray uImages;
uniform float uLayerSize;
uniform float uFade[${MAX_LAYERS}];
uniform vec3 uBackground;
uniform vec3 uPlaceholder;
uniform vec2 uHalf;
varying vec2 vLocal;
varying vec4 vLook;
varying vec4 vShape;

const vec2 DISC[8] = vec2[8](
  vec2(0.2500, 0.0000), vec2(-0.3193, 0.2925), vec2(0.0489, -0.5569), vec2(0.4024, 0.5249),
  vec2(-0.7385, -0.1306), vec2(0.6996, -0.4450), vec2(-0.2340, 0.8705), vec2(-0.4463, -0.8593)
);

float roundBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

void main() {
  vec2 halfSize = uHalf;
  float radius = min(vShape.x, min(halfSize.x, halfSize.y));
  float blur = vLook.x;
  float alpha = vLook.y;
  int layer = int(vLook.z + 0.5);
  float sd = roundBox(vLocal, halfSize, radius);
  // Hrana je vždy ostrá — jen vyhlazení na pixel (fwidth). Rozostření
  // hloubky se týká obrázku uvnitř, ne obrysu karty.
  float soft = fwidth(sd) * 0.75;
  float coverage = 1.0 - smoothstep(-soft, soft, sd);

  vec2 uv = vLocal / (2.0 * halfSize);
  vec2 tuv = vec2(uv.x + 0.5, 0.5 - uv.y);
  vec2 gx = dFdx(tuv);
  vec2 gy = dFdy(tuv);
  vec3 color;
  if (blur < 0.45) {
    color = textureGrad(uImages, vec3(tuv, float(layer)), gx, gy).rgb;
  } else {
    vec2 reach = blur / (2.0 * halfSize);
    float texels = blur / (2.0 * halfSize.y) * uLayerSize;
    float lod = log2(max(texels * 0.55, 1.0));
    vec3 c = textureLod(uImages, vec3(tuv, float(layer)), lod).rgb;
    vec3 sum = c * c * 0.2;
    for (int k = 0; k < 8; k++) {
      vec3 s = textureLod(uImages, vec3(tuv + DISC[k] * reach * vec2(1.0, -1.0), float(layer)), lod).rgb;
      sum += s * s * 0.1;
    }
    color = sqrt(sum);
  }
  color = mix(uPlaceholder, color, uFade[layer]);
  // Stín hloubky: karty vzadu tmavnou, než úplně zmizí.
  color *= 1.0 - vShape.z;
  // Ztlumení obrázku (jako černý překryv s průhledností vShape.w);
  // karta pod myší má slabší ztlumení.
  color *= 1.0 - vShape.w;
  color = mix(color, uBackground, vLook.w);

  vec4 result = vec4(color, 1.0) * coverage * alpha;
  if (vShape.y > 0.001) {
    // Měkký stín za kartou, posunutý dolů.
    float drop = halfSize.y * 0.08;
    float spread = halfSize.y * 0.18;
    float shadowDistance = roundBox(vLocal + vec2(0.0, drop), halfSize * vec2(0.92, 0.92), radius);
    float back = (1.0 - smoothstep(-spread, spread, shadowDistance)) * 0.55;
    // Stín pod kartou: tmavá elipsa těsně pod spodní hranou, jako by
    // karta stála nad podlahou.
    vec2 g = (vLocal - vec2(0.0, -halfSize.y * 1.06)) / vec2(halfSize.x * 1.1, halfSize.y * 0.12);
    float under = (1.0 - smoothstep(0.15, 1.0, length(g))) * 0.75;
    float shade = max(back, under) * vShape.y * alpha;
    result += vec4(0.0, 0.0, 0.0, shade) * (1.0 - result.a);
  }
  if (result.a < 0.002) discard;
  gl_FragColor = result;
}
`;

/* ---------- Chování ---------- */

export const createOrbit = (
  root: HTMLElement,
  stage: HTMLElement,
  overlay: Overlay,
  settingsRef: { current: Settings },
  itemsRef: { current: OrbitCardsItem[] },
  startCard: number,
  callbacks: Callbacks,
): Controller | null => {
  const doc = root.ownerDocument;
  const view = doc.defaultView ?? window;
  const canvas = doc.createElement("canvas");
  canvas.style.cssText =
    "position:absolute;inset:0;width:100%;height:100%;display:block";
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: false,
      premultipliedAlpha: true,
      powerPreference: "high-performance",
    });
  } catch {
    return null;
  }
  stage.appendChild(canvas);
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1);
  const base = new THREE.PlaneGeometry(2, 2);
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.index = base.index;
  geometry.setAttribute("position", base.getAttribute("position"));
  const posData = new Float32Array(MAX_CARDS * 4);
  const rotData = new Float32Array(MAX_CARDS * 4);
  const lookData = new Float32Array(MAX_CARDS * 4);
  const shapeData = new Float32Array(MAX_CARDS * 4);
  const posAttribute = new THREE.InstancedBufferAttribute(posData, 4);
  const rotAttribute = new THREE.InstancedBufferAttribute(rotData, 4);
  const lookAttribute = new THREE.InstancedBufferAttribute(lookData, 4);
  const shapeAttribute = new THREE.InstancedBufferAttribute(shapeData, 4);
  posAttribute.setUsage(THREE.DynamicDrawUsage);
  rotAttribute.setUsage(THREE.DynamicDrawUsage);
  lookAttribute.setUsage(THREE.DynamicDrawUsage);
  shapeAttribute.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute("iPos", posAttribute);
  geometry.setAttribute("iRot", rotAttribute);
  geometry.setAttribute("iLook", lookAttribute);
  geometry.setAttribute("iShape", shapeAttribute);
  geometry.instanceCount = 0;

  const background = new THREE.Color(0, 0, 0);
  const placeholder = new THREE.Color(0.5, 0.5, 0.5);
  const fades = new Array<number>(MAX_LAYERS).fill(0);
  let layerSize = 512;
  let layerCount = 0;
  let layerAspect = 1;
  let layerData = new Uint8Array(layerSize * layerSize * 4);
  let images = new THREE.DataArrayTexture(layerData, layerSize, layerSize, 1);
  const sampler = doc.createElement("canvas");
  const samplerContext = sampler.getContext("2d", { willReadFrequently: true });

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uImages: { value: images },
      uLayerSize: { value: layerSize },
      uFade: { value: fades },
      uBackground: { value: background },
      uPlaceholder: { value: placeholder },
      uView: { value: new THREE.Vector2(1, 1) },
      uOrigin: { value: new THREE.Vector2(0, 0) },
      uHalf: { value: new THREE.Vector2(0.5, 0.5) },
      uF: { value: 300 },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    premultipliedAlpha: true,
    depthTest: false,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  scene.add(mesh);

  const cards: Card[] = Array.from({ length: MAX_CARDS }, () => ({
    s: 0,
    sv: 0,
    placed: false,
    focus: 0,
    alpha: 1,
    shade: 0,
    x: 0,
    y: 0,
    hh: 0,
    wx: 0,
    wy: 0,
    wz: 1,
    yaw: 0,
    pitch: 0,
    roll: 0,
    lift: 0,
    corners: new Float32Array(8),
  }));
  // Karty, které jsou tenhle snímek vidět, seřazené odzadu dopředu.
  const sorted: number[] = [];
  const projected = { x: 0, y: 0, z: 1, hw: 0, hh: 0, wx: 0, wy: 0 };

  let layers: Layer[] = [];
  let itemsKey = "";
  let captionsKey = "";
  let width = 0;
  let height = 0;
  let dpr = 1;
  let sized = false;
  // Poloha pásu ve slotech. Karta i stojí na slotu wrapHalf(i - pos).
  // Kladná rychlost = pos roste = karty jedou dopředu.
  let pos = 0;
  let velocity = 0;
  let aimTarget: number | null = null;
  let aimVelocity = 0;
  let aimResponse = 0.9;
  let brake = 0;
  let focusDepth = 0;
  let focusVelocity = 0;
  let focusReady = false;
  let selected: number | null = null;
  let hovered: number | null = null;
  // Karta, kterou právě ukazuje HTML vrstva (drží i během doběhu hoveru).
  let overlayCard: number | null = null;
  let featured = -1;
  let reportedFeature = -1;
  let captionShown = -1;
  let captionAlpha = 0;
  let paintedAlpha = -1;
  let pointerInside = false;
  let holdUntil = 0;
  let wheelAt = 0;
  let wheeling = false;
  let introAt = 0;
  let waitedSince = 0;
  let consumed = false;
  let raf = 0;
  let last = 0;
  let visible = false;
  let destroyed = false;
  let lost = false;
  let backgroundAt = -10;
  let press: {
    id: number;
    x: number;
    y: number;
    pos: number;
    moved: boolean;
    samples: { t: number; v: number }[];
  } | null = null;

  // Geometrie dráhy. Světové jednotky: výška karty = 1. Kamera stojí
  // v počátku a dívá se po +z, přední karta je ve vzdálenosti dist.
  const geo = {
    F: 300,
    cx: 0,
    cy: 0,
    aspect: 1,
    dist: 3,
    spacing: 1,
    dirX: 1,
    dirZ: 0,
    // Poloměr oběžné dráhy ve výškách karty, 0 = rovná dráha.
    orbit: 0,
    // Zhuštění rozestupů směrem dozadu a výška oblouku nad dráhou.
    stack: 0,
    arch: 0,
    tilt: 0,
    roll: 0,
    span: 4.5,
    zFront: 3,
    zMin: 3,
    zMax: 6,
    frontHalf: 40,
    // Kolik px na obrazovce je jeden slot a kterým směrem — pro tažení.
    slotPx: 100,
    slotUx: 1,
    slotUy: 0,
    key: "",
  };

  const clock = () => performance.now() / 1000;
  const itemCount = () =>
    Math.max(Math.min(itemsRef.current.length, MAX_LAYERS), 1);
  const cardCount = () => {
    const wanted = Math.round(settingsRef.current.count);
    return clamp(wanted > 0 ? wanted : itemsRef.current.length, 1, MAX_CARDS);
  };
  const itemOf = (card: number) => card % itemCount();
  const slotOf = (card: number, at: number) => wrapHalf(card - at, cardCount());

  const ensureTexture = (n: number, wantedSize: number) => {
    const grow = wantedSize > layerSize * 1.25;
    if (layerCount === n && !grow) return false;
    layerSize = layerCount === 0 || grow ? wantedSize : layerSize;
    layerCount = n;
    layerData = new Uint8Array(layerSize * layerSize * 4 * n);
    images.dispose();
    images = new THREE.DataArrayTexture(layerData, layerSize, layerSize, n);
    images.format = THREE.RGBAFormat;
    images.type = THREE.UnsignedByteType;
    images.colorSpace = THREE.NoColorSpace;
    images.minFilter = THREE.LinearMipmapLinearFilter;
    images.magFilter = THREE.LinearFilter;
    images.wrapS = THREE.ClampToEdgeWrapping;
    images.wrapT = THREE.ClampToEdgeWrapping;
    images.generateMipmaps = true;
    images.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    images.needsUpdate = true;
    material.uniforms.uImages.value = images;
    material.uniforms.uLayerSize.value = layerSize;
    layers.forEach((layer) => {
      layer.drawn = false;
      layer.shown = false;
    });
    return true;
  };

  const drawLayer = (index: number) => {
    const layer = layers[index];
    if (!layer || !layer.ready || layer.drawn || !samplerContext) return false;
    const image = layer.image;
    const iw = image.naturalWidth;
    const ih = image.naturalHeight;
    if (!iw || !ih) return false;
    const aspect = layerAspect;
    let sw = iw;
    let sh = ih;
    if (iw / ih > aspect) sw = ih * aspect;
    else sh = iw / aspect;
    sampler.width = layerSize;
    sampler.height = layerSize;
    try {
      samplerContext.drawImage(
        image,
        (iw - sw) / 2,
        (ih - sh) / 2,
        sw,
        sh,
        0,
        0,
        layerSize,
        layerSize,
      );
      const pixels = samplerContext.getImageData(0, 0, layerSize, layerSize).data;
      layerData.set(pixels, index * layerSize * layerSize * 4);
    } catch {
      return false;
    }
    layer.drawn = true;
    layer.shown = true;
    images.addLayerUpdate(index);
    images.needsUpdate = true;
    return true;
  };

  const loadImages = () => {
    const items = itemsRef.current.slice(0, MAX_LAYERS);
    const key = items.map((item) => item.src).join("\u0000");
    const captionKey = itemsRef.current
      .map((item) => `${item.title ?? item.alt}\u0001${item.subtitle ?? ""}`)
      .join("\u0000");
    if (captionKey !== captionsKey) {
      captionsKey = captionKey;
      captionShown = -1;
    }
    if (key === itemsKey) return;
    itemsKey = key;
    layers.forEach((layer) => {
      layer.image.onload = null;
    });
    layers = items.map((item) => {
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.decoding = "async";
      const layer: Layer = {
        image,
        ready: false,
        drawn: false,
        shown: false,
        fade: 0,
      };
      image.onload = () => {
        if (destroyed) return;
        const finish = () => {
          if (destroyed || layer.ready) return;
          layer.ready = true;
          schedule();
        };
        image.decode().then(finish, finish);
      };
      image.src = item.src;
      return layer;
    });
    layerCount = 0;
    fades.fill(0);
  };

  const readSize = () => {
    const settings = settingsRef.current;
    const nextWidth = Math.round(root.clientWidth);
    const nextHeight = Math.round(root.clientHeight);
    if (nextWidth < 2 || nextHeight < 2) {
      sized = false;
      return false;
    }
    const nextDpr = Math.min(
      view.devicePixelRatio || 1,
      Math.max(settings.dpr, 0.5),
    );
    if (sized && nextWidth === width && nextHeight === height && nextDpr === dpr)
      return false;
    sized = true;
    width = nextWidth;
    height = nextHeight;
    dpr = nextDpr;
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height, false);
    return true;
  };

  const syncColors = () => {
    const value = settingsRef.current.backgroundColor;
    if (parseColor(value)) {
      background.setStyle(value, THREE.NoColorSpace);
    } else {
      let node: HTMLElement | null = root;
      let found = false;
      while (node && !found) {
        const fill = view.getComputedStyle(node).backgroundColor;
        if (fill && fill !== "transparent" && !/rgba\([^)]*,\s*0\)$/.test(fill)) {
          background.setStyle(fill, THREE.NoColorSpace);
          found = true;
        }
        node = node.parentElement;
      }
      if (!found) {
        const ink = new THREE.Color();
        ink.setStyle(
          view.getComputedStyle(root).color || SNOW,
          THREE.NoColorSpace,
        );
        background.setHex(
          ink.r + ink.g + ink.b > 1.5 ? 0x0a0a0a : 0xffffff,
          THREE.NoColorSpace,
        );
      }
    }
    const light =
      background.r * 0.2126 + background.g * 0.7152 + background.b * 0.0722 >
      0.6;
    placeholder
      .copy(background)
      .lerp(new THREE.Color(light ? 0x000000 : 0xffffff), 0.08);
  };

  // Slot na dráze -> místo v prostoru a na obrazovce. Dráha je oblouk
  // velké oběžné dráhy (poloměr `orbit`): od přední karty vychází pod
  // úhlem `angle` a stáčí se dál do hloubky. `tilt` nakloní rovinu
  // dráhy kolem přední karty (kladný = vzdálené karty výš, jako by se
  // kamera dívala na dráhu shora), `roll` natočí celou scénu.
  //
  // Navíc: `stack` zhušťuje rozestupy směrem dozadu (řada se vzadu sbíhá
  // jako rozevřený balíček) a `arch` zvedá karty uprostřed viditelného
  // okna do mírného oblouku.
  const project = (s: number, lift: number) => {
    const ahead = Math.max(s, 0);
    const L = (s * geo.spacing) / (1 + geo.stack * ahead);
    let along = L;
    let inward = 0;
    if (geo.orbit > 0.01) {
      const theta = L / geo.orbit;
      along = geo.orbit * Math.sin(theta);
      inward = geo.orbit * (1 - Math.cos(theta));
    }
    let x = geo.dirX * along - geo.dirZ * inward;
    const depth = geo.dirZ * along + geo.dirX * inward;
    let y =
      depth * Math.sin(geo.tilt) +
      geo.arch * Math.sin(clamp(s / Math.max(geo.span, 1), 0, 1) * Math.PI);
    let z = geo.dist + depth * Math.cos(geo.tilt);
    if (lift) {
      const length = Math.hypot(x, y, z);
      const k = 1 - lift / length;
      x *= k;
      y *= k;
      z *= k;
    }
    const inv = geo.F / Math.max(z, 0.05);
    const cr = Math.cos(geo.roll);
    const sr = Math.sin(geo.roll);
    projected.wx = x * cr - y * sr;
    projected.wy = x * sr + y * cr;
    projected.x = geo.cx + projected.wx * inv;
    projected.y = geo.cy + projected.wy * inv;
    projected.z = z;
    projected.hh = 0.5 * inv;
    projected.hw = projected.hh * geo.aspect;
    return projected;
  };

  // Usadí viditelnou část dráhy do boxu: spočítá obrys karet od přední
  // (s = 0) po poslední viditelnou a podle něj měřítko a střed.
  //
  // S fitParent se scéna usazuje do boxu RODIČE, ne plátna. Plátno pak
  // může přesahovat (aby velké karty neořízla hrana) a velikost i poloha
  // karet se přesto řídí rodičem — `scale` znamená totéž co bez přesahu.
  const measure = () => {
    const settings = settingsRef.current;
    const captionRoom = settings.captions ? CAPTION_ROOM : 0;
    const n = cardCount();
    let areaX = 0;
    let areaY = 0;
    let areaW = width;
    let areaH = height;
    const parent = root.parentElement;
    if (settings.fitParent && parent) {
      const own = root.getBoundingClientRect();
      const box = parent.getBoundingClientRect();
      if (box.width > 2 && box.height > 2) {
        areaX = Math.round(box.left - own.left);
        areaY = Math.round(own.bottom - box.bottom);
        areaW = Math.round(box.width);
        areaH = Math.round(box.height);
      }
    }
    const key = [
      width,
      height,
      areaX,
      areaY,
      areaW,
      areaH,
      captionRoom,
      n,
      settings.aspect,
      settings.angle,
      settings.gap,
      settings.orbit,
      settings.stack,
      settings.arch,
      settings.tilt,
      settings.roll,
      settings.distance,
      settings.scale,
      settings.cardHeight,
      settings.anchor,
      settings.visible,
    ].join("|");
    if (key === geo.key) return;
    geo.key = key;
    geo.aspect = clamp(settings.aspect, 0.3, 2.5);
    geo.dist = clamp(settings.distance, 1, 20);
    geo.spacing = geo.aspect * (1 + Math.max(settings.gap, 0));
    const angle = (clamp(settings.angle, -85, 85) * Math.PI) / 180;
    geo.dirX = Math.cos(angle);
    geo.dirZ = Math.sin(angle);
    geo.orbit = Math.max(settings.orbit, 0);
    geo.stack = clamp(settings.stack, 0, 2);
    geo.arch = settings.arch;
    geo.tilt = (clamp(settings.tilt, -80, 80) * Math.PI) / 180;
    geo.roll = (clamp(settings.roll, -90, 90) * Math.PI) / 180;
    geo.span = clamp(settings.visible, 1, Math.max(n / 2 - 0.5, 1));
    geo.F = 1;
    geo.cx = 0;
    geo.cy = 0;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    let zMin = Infinity;
    let zMax = -Infinity;
    for (let s = 0; s <= geo.span + 1e-6; s += 0.25) {
      const p = project(s, 0);
      minX = Math.min(minX, p.x - p.hw);
      maxX = Math.max(maxX, p.x + p.hw);
      minY = Math.min(minY, p.y - p.hh);
      maxY = Math.max(maxY, p.y + p.hh);
      zMin = Math.min(zMin, p.z);
      zMax = Math.max(zMax, p.z);
    }
    const margin = Math.min(areaW, areaH) * 0.06 + 8;
    const availableW = Math.max(areaW - margin * 2, 40);
    const availableH = Math.max(areaH - captionRoom - margin * 2, 40);
    // Velikost: buď pevná výška přední karty jako podíl výšky boxu
    // (cardHeight), nebo — bez ní — celá viditelná řada vepsaná do boxu.
    // Pevná výška nezávisí na tvaru dráhy, takže změna stack/arch/gap
    // nezmění velikost karet.
    const frontAtUnit = 1 / geo.dist; // výška přední karty při F = 1
    const fit =
      settings.cardHeight > 0
        ? (settings.cardHeight * areaH) / frontAtUnit
        : Math.min(availableW / (maxX - minX), availableH / (maxY - minY));
    geo.F = fit * clamp(settings.scale, 0.2, 4);
    geo.cx = areaX + areaW / 2 - geo.F * ((minX + maxX) / 2);
    geo.cy =
      areaY +
      captionRoom +
      (areaH - captionRoom) / 2 -
      geo.F * ((minY + maxY) / 2);
    // Posun celé řady po dráze: přední karta se postaví tam, kde by
    // jinak stál slot `anchor` (1 = o kartu dál doprava), a karta před
    // ní zabere dosavadní přední místo. Jen vodorovně — svislý rozdíl
    // (oblouk, náklon) by řadu zvedl a přední kartu ořízla hlavička.
    if (settings.anchor) {
      const hx = project(0, 0).x;
      geo.cx += project(settings.anchor, 0).x - hx;
    }
    geo.zMin = zMin;
    geo.zMax = Math.max(zMax, zMin + 1e-3);
    const front = project(0, 0);
    geo.zFront = front.z;
    geo.frontHalf = front.hh;
    const fx = front.x;
    const fy = front.y;
    const next = project(1, 0);
    const vx = next.x - fx;
    const vy = next.y - fy;
    geo.slotPx = Math.max(Math.hypot(vx, vy), 20);
    geo.slotUx = vx / geo.slotPx;
    geo.slotUy = vy / geo.slotPx;
    if (!focusReady) {
      focusDepth = geo.zFront;
      focusReady = true;
    }
  };

  const schedule = () => {
    if (destroyed || lost || !visible || raf) return;
    raf = requestAnimationFrame(frame);
  };

  const hold = (seconds = 2.4) => {
    holdUntil = Math.max(holdUntil, clock() + seconds);
  };

  const aim = (value: number, response: number) => {
    if (aimTarget === null) aimVelocity = velocity;
    aimTarget = value;
    aimResponse = response;
    schedule();
  };

  // Karta nejblíž přední pozici (slot 0).
  const frontCard = (at: number) => {
    const n = cardCount();
    let best = 0;
    let bestDistance = Infinity;
    for (let i = 0; i < n; i++) {
      const distance = Math.abs(slotOf(i, at));
      if (distance < bestDistance) {
        bestDistance = distance;
        best = i;
      }
    }
    return best;
  };

  const show = (card: number) => {
    const n = cardCount();
    const index = ((Math.round(card) % n) + n) % n;
    selected = index;
    callbacks.onPick(itemOf(index));
    const reference = aimTarget ?? pos;
    aim(
      reference + slotOf(index, reference),
      settingsRef.current.reduced ? 0.06 : 0.95,
    );
    hold();
  };

  const step = (direction: number) => {
    const n = cardCount();
    const current = selected ?? frontCard(aimTarget ?? pos);
    show((current + (direction > 0 ? 1 : -1) + n) % n);
  };

  const release = () => {
    selected = null;
    hold(1.2);
    schedule();
  };

  const replay = () => {
    introAt = 0;
    waitedSince = 0;
    selected = null;
    aimTarget = null;
    velocity = 0;
    brake = 0;
    schedule();
  };

  // Rohy natočené karty na obrazovce — stejná matematika jako vertex
  // shader (turn + promítnutí), jen pro čtyři rohy.
  const cornerSigns = [-1, -1, 1, -1, 1, 1, -1, 1];
  const placeCorners = (card: Card) => {
    const hw = geo.aspect * 0.5;
    const hh = 0.5;
    const cz = Math.cos(card.roll), sz = Math.sin(card.roll);
    const cp = Math.cos(card.pitch), sp = Math.sin(card.pitch);
    const cy = Math.cos(card.yaw), sy = Math.sin(card.yaw);
    const cr = Math.cos(geo.roll), sr = Math.sin(geo.roll);
    for (let c = 0; c < 4; c++) {
      let x = cornerSigns[c * 2] * hw;
      let y = cornerSigns[c * 2 + 1] * hh;
      let z = 0;
      [x, y] = [x * cz - y * sz, x * sz + y * cz];
      [y, z] = [y * cp - z * sp, y * sp + z * cp];
      [x, z] = [x * cy + z * sy, -x * sy + z * cy];
      [x, y] = [x * cr - y * sr, x * sr + y * cr];
      const depth = Math.max(card.wz + z, 0.05);
      card.corners[c * 2] = geo.cx + ((card.wx + x) * geo.F) / depth;
      card.corners[c * 2 + 1] = geo.cy + ((card.wy + y) * geo.F) / depth;
    }
  };

  // Bod uvnitř konvexního čtyřúhelníku: na stejné straně všech hran.
  const insideQuad = (q: Float32Array, x: number, y: number) => {
    let sign = 0;
    for (let c = 0; c < 4; c++) {
      const ax = q[c * 2];
      const ay = q[c * 2 + 1];
      const bx = q[((c + 1) % 4) * 2];
      const by = q[((c + 1) % 4) * 2 + 1];
      const cross = (bx - ax) * (y - ay) - (by - ay) * (x - ax);
      if (cross === 0) continue;
      const side = cross > 0 ? 1 : -1;
      if (sign === 0) sign = side;
      else if (side !== sign) return false;
    }
    return true;
  };

  const hitTest = (clientX: number, clientY: number) => {
    const rect = root.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = height - (clientY - rect.top);
    for (let k = sorted.length - 1; k >= 0; k--) {
      const card = cards[sorted[k]];
      if (card.alpha < 0.35) continue;
      if (insideQuad(card.corners, x, y)) return sorted[k];
    }
    return null;
  };

  function frame(time: number) {
    raf = 0;
    if (destroyed || lost) return;
    if (!sized) {
      readSize();
      if (!sized) return;
    }
    const settings = settingsRef.current;
    const dt =
      last && time - last < 100
        ? Math.min(Math.max((time - last) / 1000, 0), 0.05)
        : 1 / 60;
    last = time;
    const now = clock();
    const reduced = settings.reduced;
    let busy = false;

    if (now - backgroundAt > 1.2) {
      backgroundAt = now;
      syncColors();
    }
    readSize();
    measure();
    const n = cardCount();
    const itemTotal = Math.max(layers.length, 1);

    /* Obrázky do texturového pole, jeden za snímek, od přední karty. */
    const aspect = geo.aspect;
    if (Math.abs(aspect - layerAspect) > 1e-3) {
      layerAspect = aspect;
      layers.forEach((layer) => {
        layer.drawn = false;
      });
    }
    // Vrstva je čtverec, obrázek se do ní roztáhne podle poměru karty —
    // rozlišení se proto bere z delší strany přední karty.
    const frontPixels =
      Math.max(geo.frontHalf * 2 * Math.max(aspect, 1), 1) * dpr;
    const wanted = clamp(Math.ceil(frontPixels / 128) * 128, 256, 1024);
    if (ensureTexture(itemTotal, wanted)) busy = true;
    const centreItem = itemOf(frontCard(pos));
    let drew = false;
    for (let offset = 0; offset < layers.length && !drew; offset++) {
      const index =
        (centreItem +
          (offset % 2 ? -(offset + 1) / 2 : offset / 2) +
          layers.length * 4) %
        layers.length;
      const layer = layers[index];
      if (layer && layer.ready && !layer.drawn) drew = drawLayer(index);
    }
    if (drew) busy = true;
    let allDrawn = true;
    for (let i = 0; i < layers.length; i++) {
      const layer = layers[i];
      if (!layer.drawn) allDrawn = false;
      if (layer.shown && layer.fade < 1) {
        layer.fade = reduced ? 1 : Math.min(1, layer.fade + dt / 0.45);
        busy = true;
      }
      fades[i] = layer.shown ? layer.fade : 0;
    }

    /* Úvodní příjezd odzadu dopředu.
       Se zdrojem postupu (scroll) ho řídí on — dá se i vrátit zpět.
       Bez něj běží v čase, jakmile jsou obrázky načtené. */
    let entry = 1;
    if (reduced) {
      entry = 1;
    } else if (settings.progress) {
      entry = clamp(settings.progress.get(), 0, 1);
    } else if (settings.intro) {
      if (!introAt) {
        if (!waitedSince) waitedSince = now;
        if (allDrawn || now - waitedSince > 2.2) introAt = now;
      }
      entry = introAt ? clamp((now - introAt) / 2.1, 0, 1) : 0;
      if (entry < 1) busy = true;
    }
    const settled = entry >= 0.999;
    // O kolik slotů dál vzadu karty jsou, než dojedou. Začínají za
    // viditelným oknem, takže vyjedou ze stínu.
    const behind = (1 - entryCurve(entry)) * (geo.span + 1.5);

    /* Pohyb pásu: tažení, dojezd na kartu, nebo pomalá jízda. */
    const touching = !!press || (settings.pauseOnHover && pointerInside);
    const stopped = settings.paused || settings.held || reduced || !settled;
    const holding = touching || selected !== null || now < holdUntil;
    const brakeTarget = stopped || holding ? 0 : 1;
    brake +=
      (brakeTarget - brake) *
      (1 - Math.exp(-dt / (brakeTarget > brake ? 1.1 : 0.35)));
    if (Math.abs(brakeTarget - brake) > 1e-3) busy = true;
    else brake = brakeTarget;

    if (wheeling && now - wheelAt > 0.16) {
      wheeling = false;
      if (aimTarget !== null) aimTarget = Math.round(aimTarget);
    }

    if (press && press.moved) {
      busy = true;
    } else if (aimTarget !== null) {
      [pos, aimVelocity] = springTo(
        pos,
        aimVelocity,
        aimTarget,
        dt,
        reduced ? 0.06 : aimResponse,
        0.94,
      );
      velocity = aimVelocity;
      if (Math.abs(pos - aimTarget) < 1e-4 && Math.abs(aimVelocity) < 1e-3) {
        pos = aimTarget;
        aimTarget = null;
        velocity = 0;
      } else {
        busy = true;
      }
    } else {
      const target = settings.speed * brake;
      velocity += (target - velocity) * (1 - Math.exp(-dt / 0.9));
      if (Math.abs(velocity - target) < 1e-5) velocity = target;
      pos += velocity * dt;
      if (Math.abs(velocity) > 1e-5 || Math.abs(target) > 1e-5) busy = true;
    }
    // Poloha drží v rozsahu [0, n), ať čísla nerostou do nekonečna.
    if (pos >= n || pos < 0) {
      const shift = Math.floor(pos / n) * n;
      pos -= shift;
      if (aimTarget !== null) aimTarget -= shift;
      if (press) press.pos -= shift;
    }

    /* Karty na dráze. */
    const shadeStrength = clamp(settings.shade, 0, 1);
    const exitSlots = clamp(settings.exit, 0, Math.max(n / 2 - geo.span - 1, 0));
    const lagSeconds = clamp(settings.lag, 0, 1);
    const damping = 1 - 0.55 * clamp(settings.bounce, 0, 1);
    const toRad = Math.PI / 180;
    const yawBase = clamp(settings.cardYaw, -80, 80) * toRad;
    const leanBase = clamp(settings.cardLean, -60, 60) * toRad;
    const jitterAmount = clamp(settings.jitter, 0, 45) * toRad;
    const lifted = selected !== null && selected < n ? selected : -1;
    sorted.length = 0;
    for (let i = 0; i < n; i++) {
      const card = cards[i];
      const rest = slotOf(i, pos);
      const target = rest + behind;

      // Každá karta dohání svůj slot vlastní pružinou. Čím dál vzadu,
      // tím pomalejší, takže se řada při tažení i scrollu rozvlní a
      // zadní karty dojíždějí za předními. `bounce` přidá překmit.
      // Skok přes konec pásu (karta se přesune dozadu) se neanimuje.
      if (reduced || !card.placed || Math.abs(target - card.s) > n / 3) {
        card.s = target;
        card.sv = 0;
        card.placed = true;
      } else {
        const response =
          0.12 + lagSeconds * clamp(target + 0.5, 0, geo.span + 2);
        [card.s, card.sv] = springTo(
          card.s,
          card.sv,
          target,
          dt,
          response,
          damping,
        );
        if (Math.abs(card.s - target) > 1e-4 || Math.abs(card.sv) > 1e-4) {
          busy = true;
        } else {
          card.s = target;
          card.sv = 0;
        }
      }
      const s = card.s;

      // Hover: karta pod myší (ne při tažení ani během příjezdu) plynule
      // náběhne do „focus" — narovná se a zesvětlí. Doběh je stejně měkký.
      const focusGoal =
        i === hovered && settled && !(press && press.moved) ? 1 : 0;
      card.focus +=
        (focusGoal - card.focus) * (reduced ? 1 : 1 - Math.exp(-dt / 0.16));
      if (Math.abs(focusGoal - card.focus) > 1e-3) busy = true;
      else card.focus = focusGoal;
      const liftGoal = i === lifted ? 0.3 : 0;
      card.lift +=
        (liftGoal - card.lift) * (reduced ? 1 : 1 - Math.exp(-dt / 0.22));
      if (Math.abs(card.lift - liftGoal) > 1e-4) busy = true;
      else card.lift = liftGoal;

      // Viditelnost: karta, která projela kolem přední pozice, jede ještě
      // `exit` slotů dál (třeba za fotku, která leží nad plátnem) a teprve
      // pak zmizí; vzadu poslední karty zhasnou do stínu. Během příjezdu
      // se neukáže karta, která by po dojetí stejně byla mimo.
      const front = smooth(-exitSlots - 0.65, -exitSlots, s);
      const back = 1 - smooth(geo.span - 1, geo.span + 0.15, s);
      const arriving = settled || rest > -exitSlots - 0.3 ? 1 : 0;
      card.alpha = front * back * arriving;
      card.shade = shadeStrength * smooth(0.4, geo.span, s);
      if (card.alpha < 0.002) continue;

      const p = project(s, card.lift);
      card.x = p.x;
      card.y = p.y;
      card.hh = p.hh;
      card.wx = p.wx;
      card.wy = p.wy;
      card.wz = p.z;

      // Natočení karty: základní (pravá hrana k divákovi, horní hrana
      // dozadu) plus vlastní náhodný náklon. Karta na přední pozici —
      // a vybraná karta — se narovná, čím blíž je, tím rovnější.
      const loose =
        (i === lifted ? 0 : smooth(0.05, 0.9, Math.abs(s))) * (1 - card.focus);
      card.yaw = (yawBase + jitterAmount * jitterOf(i, 1)) * loose;
      card.pitch = (leanBase + jitterAmount * 0.6 * jitterOf(i, 2)) * loose;
      // Karta pod myší se natočí čelem ke kameře úplně: kromě vlastního
      // náklonu vyrovná i natočení celé scény (roll), takže na obrazovce
      // stojí jako rovný obdélník a rámeček kolem ní sedí přesně.
      card.roll = jitterAmount * 0.5 * jitterOf(i, 3) * loose - geo.roll * card.focus;
      placeCorners(card);
      sorted.push(i);
    }
    sorted.sort((a, b) => cards[b].wz - cards[a].wz);

    let candidate =
      selected !== null && selected < n
        ? selected
        : hovered !== null && hovered < n
          ? hovered
          : frontCard(pos);
    if (selected === null && hovered === null && featured >= 0 && featured < n) {
      const current = Math.abs(slotOf(featured, pos));
      const next = Math.abs(slotOf(candidate, pos));
      if (candidate !== featured && current - next < 0.04) candidate = featured;
    }
    featured = candidate;
    const featuredItem = itemOf(featured);
    if (featuredItem !== reportedFeature && settled) {
      reportedFeature = featuredItem;
      callbacks.onFeature(featuredItem);
    }

    const focusTarget = !settled
      ? geo.zFront
      : selected !== null && selected < n && cards[selected].alpha > 0
        ? cards[selected].wz
        : hovered !== null && hovered < n && cards[hovered].alpha > 0
          ? cards[hovered].wz
          : geo.zFront;
    [focusDepth, focusVelocity] = springTo(
      focusDepth,
      focusVelocity,
      focusTarget,
      dt,
      reduced ? 0.04 : 0.42,
      1,
    );
    if (
      Math.abs(focusDepth - focusTarget) > 1e-4 ||
      Math.abs(focusVelocity) > 1e-4
    )
      busy = true;

    const aperture = clamp(settings.aperture, 0, 1);
    const depthRange = geo.zMax - geo.zMin;
    const span = Math.max(depthRange / geo.zMax, 0.05);
    const frontHeight = geo.frontHalf * 2;
    const blurScale = (aperture * 0.17 * frontHeight) / span;
    const blurLimit = frontHeight * 0.2;
    const haze = clamp(settings.haze, 0, 1);
    const shadow = clamp(settings.shadow, 0, 1);
    // Zaoblení je zadané v px u přední karty; v rovině karty je to pevná
    // délka, takže se se vzdáleností zmenšuje stejně jako karta.
    const pxPerUnit = Math.max(geo.frontHalf * 2, 1);
    const radius = Math.max(settings.radius, 0) / pxPerUnit;
    const dimBase = clamp(settings.dim, 0, 1);
    const dimHover = clamp(settings.dimHover, 0, 1);
    for (let k = 0; k < sorted.length; k++) {
      const index = sorted[k];
      const card = cards[index];
      const depth = clamp((card.wz - geo.zMin) / depthRange, 0, 1);
      // Rozostření se počítá v px a převádí na jednotky karty v její
      // vzdálenosti (px na jednotku = 2 * půlvýška v px).
      const blurPx = Math.min(
        (blurScale * Math.abs(card.wz - focusDepth)) / card.wz,
        blurLimit,
      );
      const o = k * 4;
      posData[o] = card.wx;
      posData[o + 1] = card.wy;
      posData[o + 2] = card.wz;
      posData[o + 3] = 0;
      rotData[o] = card.yaw;
      rotData[o + 1] = card.pitch;
      rotData[o + 2] = card.roll;
      rotData[o + 3] = geo.roll;
      lookData[o] = blurPx / Math.max(card.hh * 2, 1);
      lookData[o + 1] = card.alpha;
      lookData[o + 2] = itemOf(index) % itemTotal;
      lookData[o + 3] = haze * Math.pow(depth, 1.25) * 0.85;
      shapeData[o] = radius;
      shapeData[o + 1] = shadow * (1 - 0.55 * depth);
      shapeData[o + 2] = card.shade;
      shapeData[o + 3] = dimBase + (dimHover - dimBase) * card.focus;
    }
    geometry.instanceCount = sorted.length;
    posAttribute.needsUpdate = true;
    rotAttribute.needsUpdate = true;
    lookAttribute.needsUpdate = true;
    shapeAttribute.needsUpdate = true;

    const u = material.uniforms;
    u.uView.value.set(width, height);
    u.uOrigin.value.set(geo.cx, geo.cy);
    u.uHalf.value.set(geo.aspect * 0.5, 0.5);
    u.uF.value = geo.F;

    const fast = Math.abs(velocity) > 3 || (press !== null && press.moved);
    const showCaption = settings.captions && settled && !fast;
    if (captionShown !== featuredItem && captionAlpha < 0.02) {
      captionShown = featuredItem;
      const item = itemsRef.current[featuredItem];
      overlay.title.textContent = item ? (item.title ?? item.alt) : "";
      overlay.subtitle.textContent = item?.subtitle ?? "";
      overlay.subtitle.style.display = item?.subtitle ? "" : "none";
    }
    const captionGoal = showCaption && captionShown === featuredItem ? 1 : 0;
    captionAlpha +=
      (captionGoal - captionAlpha) *
      (reduced
        ? 1
        : 1 - Math.exp(-dt / (captionGoal > captionAlpha ? 0.2 : 0.09)));
    if (Math.abs(captionGoal - captionAlpha) < 0.003) captionAlpha = captionGoal;
    else busy = true;
    if (Math.abs(captionAlpha - paintedAlpha) > 0.002) {
      paintedAlpha = captionAlpha;
      overlay.caption.style.opacity = captionAlpha.toFixed(3);
    }

    emitOverlay(n);

    renderer.render(scene, camera);

    if (busy || press || (holdUntil > now && settled)) schedule();
  }

  // Karta pod myší pro HTML vrstvu. Rohy jsou v px s y nahoru (jako
  // WebGL), vrstva chce CSS (y dolů), proto height - y. Pořadí rohů:
  // levý dolní, pravý dolní, pravý horní, levý horní.
  function emitOverlay(n: number) {
    if (!callbacks.onOverlay) return;
    let card =
      hovered !== null && hovered < n && cards[hovered].alpha > 0.02
        ? hovered
        : overlayCard;
    if (card !== null && (card >= n || (card !== hovered && cards[card].focus < 0.005)))
      card = null;
    overlayCard = card;
    if (card === null) {
      callbacks.onOverlay(null);
      return;
    }
    const c = cards[card].corners;
    let left = Infinity;
    let right = -Infinity;
    let top = Infinity;
    let bottom = -Infinity;
    for (let k = 0; k < 4; k++) {
      const x = c[k * 2];
      const y = height - c[k * 2 + 1];
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
    const bx = c[0];
    const by = height - c[1];
    const ex = c[2];
    const ey = height - c[3];
    const item = itemOf(card);
    const image = layers[item]?.image;
    callbacks.onOverlay({
      item,
      box: { left, top, right, bottom },
      anchor: {
        x: bx,
        y: by,
        angle: Math.atan2(ey - by, ex - bx),
        width: Math.hypot(ex - bx, ey - by),
      },
      focus: cards[card].focus,
      natural: {
        width: image?.naturalWidth ?? 0,
        height: image?.naturalHeight ?? 0,
      },
    });
  }

  /* ---------- Ovládání ---------- */

  // Hover se sleduje na WINDOW, ne na ploše enginu. Nad kartami leží
  // prvky stránky (nadpis hera, portrét, HTML panel) — kdyby se hover
  // bral z událostí plochy, každý takový prvek by ho přerušil. Takhle
  // rozhoduje jen poloha kurzoru a to, která karta pod ní leží.
  const onHover = (event: PointerEvent) => {
    if (event.pointerType === "touch" || press) return;
    const settings = settingsRef.current;
    const rect = root.getBoundingClientRect();
    const inside =
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom;
    const hit = inside ? hitTest(event.clientX, event.clientY) : null;
    if (hit !== hovered || inside !== pointerInside) {
      pointerInside = inside;
      hovered = hit;
      schedule();
    }
    const cursor =
      hit !== null ? "pointer" : inside && settings.draggable ? "grab" : "";
    if (root.style.cursor !== cursor) root.style.cursor = cursor;
  };

  const onPageLeave = () => {
    if (press) return;
    pointerInside = false;
    hovered = null;
    root.style.cursor = "";
    hold(0.6);
    schedule();
  };

  const onMove = (event: PointerEvent) => {
    const settings = settingsRef.current;
    if (press && press.id === event.pointerId) {
      const dx = event.clientX - press.x;
      const dy = press.y - event.clientY;
      if (!press.moved && Math.hypot(dx, dy) > 6 && settings.draggable) {
        press.moved = true;
        aimTarget = null;
        selected = null;
        hovered = null;
        velocity = 0;
        root.style.cursor = "grabbing";
        try {
          stage.setPointerCapture(event.pointerId);
        } catch {}
      }
      if (press.moved) {
        // Tažení jen PO DRÁZE: pohyb kurzoru se promítne do směru, kterým
        // dráha běží na obrazovce, kolmá složka se zahodí. Scéna se
        // nenaklání. Táhnout dozadu = karty jedou s kurzorem dozadu.
        const along = dx * geo.slotUx + dy * geo.slotUy;
        pos = press.pos - along / geo.slotPx;
        const t = performance.now();
        press.samples.push({ t, v: pos });
        while (press.samples.length > 2 && t - press.samples[0].t > 110)
          press.samples.shift();
      }
    }
    schedule();
  };

  const onDown = (event: PointerEvent) => {
    if (!event.isPrimary || event.button > 0) return;
    consumed = false;
    press = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      pos,
      moved: false,
      samples: [{ t: performance.now(), v: pos }],
    };
    hold();
    schedule();
  };

  const finish = (event: PointerEvent) => {
    if (!press || press.id !== event.pointerId) return;
    const ended = press;
    press = null;
    try {
      if (stage.hasPointerCapture(event.pointerId))
        stage.releasePointerCapture(event.pointerId);
    } catch {}
    if (ended.moved) {
      consumed = true;
      const t = performance.now();
      const recent = ended.samples.filter((sample) => t - sample.t < 110);
      let fling = 0;
      if (recent.length > 1 && t - recent[recent.length - 1].t < 60) {
        const span = Math.max(
          (recent[recent.length - 1].t - recent[0].t) / 1000,
          1 / 120,
        );
        fling = (recent[recent.length - 1].v - recent[0].v) / span;
      }
      const settings = settingsRef.current;
      // Po puštění dojede na nejbližší kartu, se setrvačností hodu.
      const carry = settings.reduced ? 0 : clamp(fling, -8, 8) * 0.35;
      // aim() převezme rychlost z velocity, takže hod plynule dojede.
      velocity = settings.reduced ? 0 : clamp(fling, -8, 8);
      aimTarget = null;
      aim(Math.round(pos + carry), settings.reduced ? 0.06 : 0.8);
      root.style.cursor = settings.draggable ? "grab" : "";
      hold();
    }
    schedule();
  };

  const onClick = (event: MouseEvent) => {
    if (consumed) {
      consumed = false;
      return;
    }
    const card = hitTest(event.clientX, event.clientY);
    if (card === null) {
      if (selected !== null) release();
      return;
    }
    const atFront = Math.abs(slotOf(card, pos)) < 0.06;
    if (atFront) {
      callbacks.onSelect(itemOf(card));
    } else {
      show(card);
    }
  };

  // Opuštění plochy enginu. Hover tu neruší (řídí ho onHover) — myš mohla
  // jen přejet na prvek, který nad kartou leží.
  const onLeave = (event: PointerEvent) => {
    if (press && press.id === event.pointerId) return;
    if (selected !== null) {
      selected = null;
      hold(1.6);
    } else {
      hold(0.6);
    }
    schedule();
  };

  const onWheel = (event: WheelEvent) => {
    if (!settingsRef.current.wheel) return;
    event.preventDefault();
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? height : 1;
    const delta = clamp(
      (Math.abs(event.deltaX) > Math.abs(event.deltaY)
        ? event.deltaX
        : event.deltaY) * unit,
      -240,
      240,
    );
    selected = null;
    aim(
      (aimTarget ?? pos) + delta / 100,
      settingsRef.current.reduced ? 0.06 : 0.55,
    );
    wheeling = true;
    wheelAt = clock();
    hold();
  };

  const onKey = (event: KeyboardEvent) => {
    if (event.target !== root) return;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      step(1);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      step(-1);
    } else if (event.key === "Home") {
      event.preventDefault();
      show(0);
    } else if (event.key === "End") {
      event.preventDefault();
      show(cardCount() - 1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const card = selected ?? frontCard(pos);
      callbacks.onSelect(itemOf(card));
    } else if (event.key === "Escape") {
      if (selected !== null) {
        event.preventDefault();
        release();
      }
    }
  };

  stage.addEventListener("pointerdown", onDown);
  stage.addEventListener("pointermove", onMove);
  view.addEventListener("pointermove", onHover, { passive: true });
  doc.documentElement.addEventListener("pointerleave", onPageLeave);
  stage.addEventListener("pointerup", finish);
  stage.addEventListener("pointercancel", finish);
  stage.addEventListener("pointerleave", onLeave);
  stage.addEventListener("click", onClick);
  stage.addEventListener("wheel", onWheel, { passive: false });
  root.addEventListener("keydown", onKey);

  const resizer = new ResizeObserver(() => {
    if (readSize()) schedule();
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
            } else {
              if (raf) cancelAnimationFrame(raf);
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
    loadImages();
    schedule();
  };
  canvas.addEventListener("webglcontextlost", onLost);
  canvas.addEventListener("webglcontextrestored", onRestored);

  // Výchozí poloha: startovní karta vpředu.
  pos = clamp(Math.round(startCard), 0, cardCount() - 1);

  readSize();
  syncColors();
  loadImages();
  renderer.compile(scene, camera);
  schedule();

  return {
    sync: () => {
      readSize();
      syncColors();
      loadImages();
      geo.key = "";
      schedule();
    },
    wake: schedule,
    step,
    show,
    release,
    replay,
    destroy: () => {
      destroyed = true;
      if (raf) cancelAnimationFrame(raf);
      observer?.disconnect();
      resizer.disconnect();
      stage.removeEventListener("pointerdown", onDown);
      stage.removeEventListener("pointermove", onMove);
      view.removeEventListener("pointermove", onHover);
      doc.documentElement.removeEventListener("pointerleave", onPageLeave);
      stage.removeEventListener("pointerup", finish);
      stage.removeEventListener("pointercancel", finish);
      stage.removeEventListener("pointerleave", onLeave);
      stage.removeEventListener("click", onClick);
      stage.removeEventListener("wheel", onWheel);
      root.removeEventListener("keydown", onKey);
      root.style.cursor = "";
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      layers.forEach((layer) => {
        layer.image.onload = null;
      });
      images.dispose();
      material.dispose();
      geometry.dispose();
      base.dispose();
      renderer.dispose();
      if (!renderer.getContext().isContextLost()) renderer.forceContextLoss();
      canvas.remove();
    },
  };
};
