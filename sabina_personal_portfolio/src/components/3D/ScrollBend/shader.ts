// ScrollBend — shader a chování pásu (bez Reactu). Komponenta je v index.tsx.
//
// Pás obrázků (svisle nebo vodorovně) kreslí three.js ortograficky: každý
// obrázek je mřížka, kterou vertex shader prohne „čočkou" podle rychlosti
// pohybu (vypouklé / vyduté / podle směru). Fragment shader dělá zaoblení,
// cover ořez, zhasínání k okrajům, stín a lehkou barevnou aberaci.
//
// Chování: tažení s setrvačností, kolečko (volitelně), klávesy, přichycení
// na obrázek (snap), automatický posun nebo krokování (`autoAdvance`), pružná
// odezva prohnutí. Smyčka kreslí, jen dokud se něco hýbe.
//
// Převzaté z ScrollBend. Přidané:
//   `autoAdvance` — co N sekund se pás přichytí na další obrázek (při
//                   přechodu je vidět prohnutí)
//   `canvas` u položky — místo obrázku hotové 2D plátno (karta nakreslená
//                   jako DOM, viz FlexCarousel/hover.ts) → textura, která se
//                   ohýbá s pásem

import * as THREE from "three";

export type ScrollBendOrientation = "vertical" | "horizontal";
export type ScrollBendMode = "convex" | "concave" | "direction";

export interface ScrollBendItem {
  /** Obrázek, nebo u `canvas` jen stálý klíč položky. */
  src: string;
  alt?: string;
  /** Nakreslená karta (2D plátno) místo obrázku. */
  canvas?: HTMLCanvasElement;
}

export interface Settings {
  items: ScrollBendItem[];
  orientation: ScrollBendOrientation;
  bend: ScrollBendMode;
  strength: number;
  maxBend: number;
  restBend: number;
  axisBias: number;
  lensRadius: number;
  response: number;
  wobble: number;
  itemSize: number;
  aspectRatio: number;
  gap: number;
  radius: number;
  autoScroll: number;
  /** Co kolik sekund klidu se pás přichytí na další obrázek (0 = vypnuto). */
  autoAdvance: number;
  pauseOnHover: boolean;
  wheelSpeed: number;
  dragSpeed: number;
  inertia: number;
  snap: boolean;
  infinite: boolean;
  fade: number;
  shade: number;
  aberration: number;
  paused: boolean;
  quality: number;
  reduced: boolean;
}

export interface Controller {
  sync: () => void;
  destroy: () => void;
  next: () => void;
  previous: () => void;
  goTo: (index: number) => void;
  impulse: (velocity: number) => void;
}

interface Picture {
  src: string;
  image: HTMLImageElement | HTMLCanvasElement;
  texture: THREE.Texture | null;
  aspect: number;
  ready: number;
}

interface Slot {
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  center: THREE.Vector2;
  map: { value: THREE.Texture };
  aspect: { value: number };
  ready: { value: number };
}

interface Press {
  id: number;
  start: number;
  origin: number;
  scale: number;
  samples: { t: number; p: number }[];
}

interface Layout {
  vertical: boolean;
  span: number;
  tileWidth: number;
  tileHeight: number;
  length: number;
  stride: number;
}

/* ---------- Nastavení ---------- */

const LIMIT = 0.45;
const FLOW = 2400;
const SETTLE = 0.22;
const STEP = 0.16;
const BRAKE = 0.13;
const BOUNCE = 0.11;
const DETENT = 0.12;
const WHEEL_IDLE = 0.14;
const RESUME = 1.1;
const EASE_IN = 0.6;
const SMOOTHING = 0.07;
const MARGIN = 3;
const MAX_SLOTS = 64;
const MAX_TEXTURE = 2048;
const SPREAD = 18;
const TAU = Math.PI * 2;

/* ---------- Pomůcky ---------- */

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const finite = (value: number, fallback: number) => (Number.isFinite(value) ? value : fallback);
const mod = (value: number, size: number) => ((value % size) + size) % size;

const soften = (value: number) => {
  const knee = LIMIT * 0.8;
  const size = Math.abs(value);
  if (size <= knee) return value;
  return Math.sign(value) * (knee + (LIMIT - knee) * Math.tanh((size - knee) / (LIMIT - knee)));
};

const makeBlank = () => {
  const texture = new THREE.DataTexture(new Uint8Array(4), 1, 1);
  texture.needsUpdate = true;
  return texture;
};

const makeGeometry = (upright: boolean) =>
  upright ? new THREE.PlaneGeometry(1, 1, 24, 48) : new THREE.PlaneGeometry(1, 1, 48, 24);

export const normalise = (items: (string | ScrollBendItem)[]): ScrollBendItem[] =>
  items
    .map((item) => (typeof item === "string" ? { src: item } : { src: item?.src, alt: item?.alt, canvas: item?.canvas }))
    .filter((item): item is ScrollBendItem => typeof item.src === "string" && item.src.length > 0);

/* ---------- Shadery ---------- */

const vertexShader = /* glsl */ `
uniform vec2 uView;
uniform vec2 uTile;
uniform vec2 uCenter;
uniform float uMargin;
uniform float uK;
uniform float uBias;
uniform float uLens;
uniform float uVertical;
out vec2 vLocal;
out vec2 vScreen;

void main() {
  vec2 local = position.xy * (uTile + 2.0 * uMargin);
  vec2 p = uCenter + local;
  float r = length(p) / uLens;
  float f = max(1.0 - r * r, 0.0);
  float m = uK * f * f;
  vec2 gain = mix(vec2(1.0 + uBias * m, 1.0 + m), vec2(1.0 + m, 1.0 + uBias * m), uVertical);
  vec2 q = p * gain;
  vLocal = local;
  vScreen = q;
  gl_Position = vec4(q / (0.5 * uView), 0.0, 1.0);
}
`;

const fragmentShader = /* glsl */ `
uniform sampler2D uMap;
uniform float uImageAspect;
uniform float uReady;
uniform vec2 uTile;
uniform vec2 uView;
uniform float uCorner;
uniform float uVertical;
uniform float uFade;
uniform float uShade;
uniform float uSpread;
uniform float uLens;
uniform vec4 uPlaceholder;
in vec2 vLocal;
in vec2 vScreen;
out vec4 fragColor;

vec2 cover(vec2 local) {
  float tileAspect = uTile.x / uTile.y;
  vec2 scale = uImageAspect > tileAspect ? vec2(tileAspect / uImageAspect, 1.0) : vec2(1.0, uImageAspect / tileAspect);
  return local / uTile * scale + 0.5;
}

void main() {
  vec2 extent = 0.5 * uTile;
  float corner = min(uCorner, min(extent.x, extent.y));
  vec2 d = abs(vLocal) - extent + corner;
  float sd = length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - corner;
  float mask = clamp(0.5 - sd / max(fwidth(sd), 1e-4), 0.0, 1.0);
  float along = mix(vScreen.x, vScreen.y, uVertical);
  float span = mix(uView.x, uView.y, uVertical);
  float reach = clamp(abs(along) / (0.5 * span), 0.0, 1.0);
  float fade = uFade > 0.0 ? smoothstep(0.0, uFade, 0.5 * (1.0 - reach)) : 1.0;
  vec4 base = texture(uMap, cover(vLocal));
  vec3 rgb = base.rgb;
  if (uSpread > 0.001) {
    float dist = length(vScreen);
    vec2 shift = vScreen / max(dist, 1.0) * uSpread * min(dist / uLens, 1.0);
    rgb.r = texture(uMap, cover(vLocal + shift)).r;
    rgb.b = texture(uMap, cover(vLocal - shift)).b;
  }
  vec4 image = vec4(rgb * (1.0 - uShade * reach * reach), base.a);
  vec4 color = mix(uPlaceholder, image, smoothstep(0.0, 1.0, uReady));
  fragColor = color * (mask * fade);
}
`;

/* ---------- Pás ---------- */

export const createStrip = (
  root: HTMLDivElement,
  settingsRef: { current: Settings },
  report: (index: number) => void,
): Controller | null => {
  const doc = root.ownerDocument;
  const view = doc.defaultView ?? window;
  const canvas = doc.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none";
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
  root.prepend(canvas);
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  let blank = makeBlank();
  const shared = {
    uView: { value: new THREE.Vector2(1, 1) },
    uTile: { value: new THREE.Vector2(1, 1) },
    uMargin: { value: MARGIN },
    uK: { value: 0 },
    uBias: { value: 0.75 },
    uLens: { value: 1 },
    uVertical: { value: 1 },
    uCorner: { value: 18 },
    uFade: { value: 0.16 },
    uShade: { value: 0.22 },
    uSpread: { value: 0 },
    uPlaceholder: { value: new THREE.Vector4(0.06, 0.06, 0.06, 0.12) },
  };
  const slots: Slot[] = [];
  const pictures = new Map<string, Picture>();
  let uploads: Picture[] = [];
  let itemsKey: string | null = null;
  let vertical = true;
  let geometry = makeGeometry(vertical);
  let layout: Layout = { vertical: true, span: 1, tileWidth: 1, tileHeight: 1, length: 1, stride: 0 };
  let width = 0;
  let height = 0;
  let ratio = 0;
  let pos = 0;
  let shown = 0;
  let pending = 0;
  let momentum = 0;
  let drift = 0;
  let driftSign = 1;
  let land: { target: number; omega: number } | null = null;
  let landVelocity = 0;
  let press: Press | null = null;
  let measured = 0;
  let bend = clamp(finite(settingsRef.current.restBend, 0), -LIMIT, LIMIT);
  let bendVelocity = 0;
  let hovering = false;
  let looping = settingsRef.current.infinite;
  let lastInput = -1e9;
  let wheelAt = -1e9;
  let wheelMode: "free" | "detent" | null = null;
  let wheelOrigin = 0;
  let lastIndex = -1;
  let raf = 0;
  let last = 0;
  let ticking = false;
  let visible = true;
  let lost = false;
  let destroyed = false;

  const clock = () => view.performance.now() / 1000;
  const count = () => settingsRef.current.items.length;
  const bounded = () => !settingsRef.current.infinite;
  const upper = () => Math.max(0, (count() - 1) * layout.stride);
  const inertia = () => clamp(finite(settingsRef.current.inertia, 0.55), 0.02, 3);
  const wheelEase = () => (settingsRef.current.reduced ? 0 : 0.08 + 0.15 * inertia());

  const snapping = () => {
    const settings = settingsRef.current;
    return settings.snap && (finite(settings.autoScroll, 0) === 0 || settings.reduced);
  };

  const drifting = () => {
    const settings = settingsRef.current;
    const speed = finite(settings.autoScroll, 0);
    if (settings.reduced || settings.paused || speed === 0 || press || !count() || !layout.stride) return false;
    if (settings.pauseOnHover && hovering) return false;
    return !bounded() || upper() > (Math.abs(speed) * 0.25 + 1) * 4;
  };

  // Krokování: co `autoAdvance` sekund klidu další obrázek.
  const stepping = () => {
    const settings = settingsRef.current;
    const every = finite(settings.autoAdvance, 0);
    if (every <= 0 || settings.reduced || settings.paused || press || !count() || !layout.stride) return false;
    return !(settings.pauseOnHover && hovering);
  };

  const snapPoint = (value: number) => {
    if (!layout.stride) return value;
    const index = Math.round(value / layout.stride);
    return (bounded() ? clamp(index, 0, Math.max(0, count() - 1)) : index) * layout.stride;
  };

  const stretchLimit = () => Math.max(24, layout.span * 0.16);

  const stretch = (raw: number) => {
    const top = upper();
    const limit = stretchLimit();
    if (raw < 0) return (raw * limit) / (limit - raw);
    if (raw > top) {
      const over = raw - top;
      return top + (over * limit) / (over + limit);
    }
    return raw;
  };

  const unstretch = (value: number) => {
    const top = upper();
    const limit = stretchLimit();
    if (value < 0) {
      const over = Math.max(value, -limit * 0.98);
      return (over * limit) / (limit + over);
    }
    if (value > top) {
      const over = Math.min(value - top, limit * 0.98);
      return top + (over * limit) / (limit - over);
    }
    return value;
  };

  const cushion = (velocity: number) => {
    const edge = pos < 0 ? 0 : upper();
    const outward = (pos - edge) * velocity >= 0;
    if (!outward) return velocity;
    const room = Math.max(stretchLimit() - Math.abs(pos - edge), stretchLimit() * 0.1);
    const reach = (Math.abs(velocity) * BOUNCE) / Math.E;
    return (velocity * room) / (reach + room);
  };

  const velocityNow = () => {
    if (land) return landVelocity;
    const ease = wheelEase();
    return momentum + (ease > 0 ? pending / ease : 0) + drift;
  };

  const bendGoal = () => {
    const settings = settingsRef.current;
    const rest = clamp(finite(settings.restBend, 0), -LIMIT, LIMIT);
    if (settings.reduced) return rest;
    const amount =
      clamp((measured / FLOW) * clamp(finite(settings.strength, 1), 0, 5), -1, 1) *
      clamp(finite(settings.maxBend, 0.38), 0, LIMIT);
    if (settings.bend === "convex") return rest + Math.abs(amount);
    if (settings.bend === "concave") return rest - Math.abs(amount);
    return rest + amount;
  };

  const beginLand = (target: number, velocity: number, settle = SETTLE) => {
    momentum = 0;
    pending = 0;
    drift = 0;
    if (settingsRef.current.reduced) {
      pos = target;
      land = null;
      landVelocity = 0;
      return;
    }
    const distance = target - pos;
    let tau = settle;
    if (Math.abs(distance) > 0.5 && velocity * distance > 0) {
      const matched = Math.abs(distance / velocity);
      if (matched <= 0.8) tau = Math.max(0.1, matched);
    } else if (Math.abs(distance) > 0.5 && Math.abs(velocity) > 30) {
      tau = Math.min(settle, BRAKE);
    }
    land = { target, omega: 1 / tau };
    landVelocity = velocity;
  };

  const relayout = () => {
    const settings = settingsRef.current;
    const nextVertical = settings.orientation !== "horizontal";
    if (nextVertical !== vertical) {
      vertical = nextVertical;
      const previous = geometry;
      geometry = makeGeometry(vertical);
      slots.forEach((slot) => {
        slot.mesh.geometry = geometry;
      });
      previous.dispose();
      press = null;
    }
    const n = count();
    if (looping !== settings.infinite) {
      looping = settings.infinite;
      if (!looping && n > 0 && layout.stride > 0) {
        pos = mod(pos, n * layout.stride);
        if (land) land.target = snapPoint(mod(land.target, n * layout.stride));
      }
    }
    const span = vertical ? height : width;
    const size = clamp(finite(settings.itemSize, 0.68), 0.05, 1) * Math.min(width, height);
    const aspect = clamp(finite(settings.aspectRatio, 1.35), 0.2, 5);
    const tileWidth = vertical ? size : size * aspect;
    const tileHeight = vertical ? size / aspect : size;
    const length = vertical ? tileHeight : tileWidth;
    const stride = Math.max(4, length + clamp(finite(settings.gap, 16), 0, 4000));
    if (layout.stride > 0 && Math.abs(stride - layout.stride) > 1e-6) {
      const scale = stride / layout.stride;
      pos *= scale;
      shown *= scale;
      pending *= scale;
      momentum *= scale;
      landVelocity *= scale;
      if (land) land.target *= scale;
      if (press) press.origin *= scale;
    }
    layout = { vertical, span, tileWidth, tileHeight, length, stride };
  };

  const resize = () => {
    const nextWidth = Math.max(1, root.clientWidth);
    const nextHeight = Math.max(1, root.clientHeight);
    const nextRatio = Math.min(view.devicePixelRatio || 1, 2) * clamp(finite(settingsRef.current.quality, 1), 0.25, 1);
    if (nextWidth !== width || nextHeight !== height || Math.abs(nextRatio - ratio) > 1e-3) {
      width = nextWidth;
      height = nextHeight;
      ratio = nextRatio;
      renderer.setPixelRatio(ratio);
      renderer.setSize(width, height, false);
    }
    relayout();
  };

  const addSlot = () => {
    const center = new THREE.Vector2();
    const map: { value: THREE.Texture } = { value: blank };
    const aspect = { value: 1 };
    const ready = { value: 0 };
    const material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: { ...shared, uCenter: { value: center }, uMap: map, uImageAspect: aspect, uReady: ready },
      vertexShader,
      fragmentShader,
      transparent: true,
      premultipliedAlpha: true,
      depthTest: false,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false;
    mesh.matrixAutoUpdate = false;
    scene.add(mesh);
    const slot: Slot = { mesh, center, map, aspect, ready };
    slots.push(slot);
    return slot;
  };

  const loadPictures = () => {
    const items = settingsRef.current.items;
    const key = items.map((item) => item.src).join("\n");
    if (key === itemsKey) return;
    itemsKey = key;
    const wanted = new Set(items.map((item) => item.src));
    pictures.forEach((picture, src) => {
      if (wanted.has(src)) return;
      picture.texture?.dispose();
      pictures.delete(src);
    });
    uploads = uploads.filter((picture) => pictures.get(picture.src) === picture);
    const bySrc = new Map(items.map((item) => [item.src, item]));
    wanted.forEach((src) => {
      if (pictures.has(src)) return;
      // Nakreslená karta: plátno je hned hotové.
      const board = bySrc.get(src)?.canvas;
      if (board) {
        const picture: Picture = { src, image: board, texture: null, aspect: board.width / Math.max(1, board.height), ready: 0 };
        pictures.set(src, picture);
        uploads.push(picture);
        wake();
        return;
      }
      const image = doc.createElement("img");
      const picture: Picture = { src, image, texture: null, aspect: 1, ready: 0 };
      pictures.set(src, picture);
      const accept = () => {
        if (destroyed || pictures.get(src) !== picture || !image.naturalWidth || picture.texture) return;
        picture.aspect = image.naturalWidth / Math.max(1, image.naturalHeight);
        uploads.push(picture);
        wake();
      };
      image.crossOrigin = "anonymous";
      image.decoding = "async";
      image.src = src;
      image.decode().then(accept, () => {
        if (image.complete) accept();
      });
    });
  };

  const upload = () => {
    const picture = uploads.shift();
    if (!picture || pictures.get(picture.src) !== picture || picture.texture) return;
    const { image } = picture;
    const limit = Math.min(MAX_TEXTURE, renderer.capabilities.maxTextureSize);
    let texture: THREE.Texture;
    if (image instanceof HTMLCanvasElement) {
      texture = new THREE.CanvasTexture(image);
    } else if (Math.max(image.naturalWidth, image.naturalHeight) > limit) {
      const largest = Math.max(image.naturalWidth, image.naturalHeight);
      const scale = limit / largest;
      const board = doc.createElement("canvas");
      board.width = Math.max(1, Math.round(image.naturalWidth * scale));
      board.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = board.getContext("2d");
      if (context) {
        context.imageSmoothingQuality = "high";
        context.drawImage(image, 0, 0, board.width, board.height);
      }
      texture = new THREE.CanvasTexture(board);
    } else {
      texture = new THREE.Texture(image);
    }
    texture.colorSpace = THREE.NoColorSpace;
    texture.premultiplyAlpha = true;
    texture.generateMipmaps = true;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    texture.needsUpdate = true;
    renderer.initTexture(texture);
    picture.texture = texture;
  };

  const draw = () => {
    if (lost || destroyed || !width || !height) return;
    const settings = settingsRef.current;
    const n = settings.items.length;
    const lens = soften(bend);
    shared.uView.value.set(width, height);
    shared.uTile.value.set(layout.tileWidth, layout.tileHeight);
    shared.uK.value = lens;
    shared.uBias.value = clamp(finite(settings.axisBias, 0.75), 0, 1);
    const crossHalf = (layout.vertical ? layout.tileWidth : layout.tileHeight) * 0.5;
    shared.uLens.value = clamp(finite(settings.lensRadius, 1), 0.2, 3) * Math.hypot(layout.span * 0.5, crossHalf);
    shared.uVertical.value = layout.vertical ? 1 : 0;
    shared.uCorner.value = clamp(finite(settings.radius, 18), 0, 4000);
    shared.uFade.value = clamp(finite(settings.fade, 0.16), 0, 0.5);
    shared.uShade.value = clamp(finite(settings.shade, 0.22), 0, 1);
    shared.uSpread.value = clamp(finite(settings.aberration, 0.4), 0, 1) * Math.abs(lens) * SPREAD;
    let used = 0;
    if (n > 0 && layout.stride > 0) {
      const reach = (layout.span * 0.5) / Math.max(0.5, 1 + Math.min(0, lens)) + layout.length * 0.5 + 2;
      let first = Math.ceil((shown - reach) / layout.stride);
      let final = Math.floor((shown + reach) / layout.stride);
      if (!settings.infinite) {
        first = Math.max(first, 0);
        final = Math.min(final, n - 1);
      }
      for (let j = first; j <= final && used < MAX_SLOTS; j++) {
        const slot = slots[used] ?? addSlot();
        const along = j * layout.stride - shown;
        if (layout.vertical) slot.center.set(0, -along);
        else slot.center.set(along, 0);
        const picture = pictures.get(settings.items[mod(j, n)].src);
        const texture = picture?.texture ?? null;
        slot.map.value = texture ?? blank;
        slot.aspect.value = picture && texture ? picture.aspect : 1;
        slot.ready.value = picture && texture ? picture.ready : 0;
        slot.mesh.visible = true;
        used++;
      }
    }
    for (let i = used; i < slots.length; i++) slots[i].mesh.visible = false;
    renderer.render(scene, camera);
  };

  const announce = () => {
    const n = count();
    if (!n || !layout.stride) return;
    const nearest = Math.round(shown / layout.stride);
    const index = bounded() ? clamp(nearest, 0, n - 1) : mod(nearest, n);
    if (index === lastIndex) return;
    lastIndex = index;
    report(index);
  };

  const advance = (dt: number, time: number) => {
    const settings = settingsRef.current;
    const n = count();
    const before = shown;
    const top = upper();
    const limited = bounded();
    // Krokování: po `autoAdvance` s klidu další obrázek (přichycení prohne pás).
    if (stepping() && !land && pending === 0 && momentum === 0 && time - lastInput > settings.autoAdvance) {
      stepBy(1);
    }
    let goal = 0;
    if (drifting() && !land && time - lastInput > RESUME) {
      const speed = finite(settings.autoScroll, 0);
      if (limited) {
        const turn = Math.abs(speed) * 0.25 + 1;
        const heading = Math.sign(speed) * driftSign;
        if ((heading > 0 && pos >= top - turn) || (heading < 0 && pos <= turn)) driftSign = -driftSign;
        goal = speed * driftSign;
      } else {
        goal = speed;
      }
    }
    drift = goal + (drift - goal) * Math.exp(-dt / EASE_IN);
    if (Math.abs(drift - goal) < 0.01) drift = goal;
    if (!n || !layout.stride) {
      momentum = 0;
      pending = 0;
      land = null;
      landVelocity = 0;
    } else if (press) {
      momentum = 0;
      pending = 0;
    } else if (land) {
      const { target, omega } = land;
      const offset = pos - target;
      const lead = landVelocity + omega * offset;
      const decay = Math.exp(-omega * dt);
      pos = target + (offset + lead * dt) * decay;
      landVelocity = (landVelocity - omega * lead * dt) * decay;
      if (Math.abs(pos - target) < 0.08 && Math.abs(landVelocity) < 2) {
        pos = target;
        landVelocity = 0;
        land = null;
      }
    } else {
      const tau = inertia();
      const decay = Math.exp(-dt / tau);
      const travel = momentum * tau * (1 - decay);
      momentum *= decay;
      if (Math.abs(momentum) < 0.05) momentum = 0;
      const ease = wheelEase();
      let drain = ease > 0 ? pending * (1 - Math.exp(-dt / ease)) : pending;
      pending -= drain;
      if (Math.abs(pending) < 0.02) {
        drain += pending;
        pending = 0;
      }
      pos += travel + drain + drift * dt;
      if (limited && (pos < 0 || pos > top)) {
        beginLand(clamp(pos, 0, top), cushion((travel + drain) / Math.max(dt, 1e-4) + drift), BOUNCE);
      } else if (snapping() && time - wheelAt >= WHEEL_IDLE) {
        const rest = pos + pending + momentum * tau;
        let target = snapPoint(rest);
        if (wheelMode === "free") {
          const moved = rest - wheelOrigin;
          if (moved > layout.stride * DETENT) target = Math.max(target, snapPoint(wheelOrigin + layout.stride));
          else if (moved < -layout.stride * DETENT) target = Math.min(target, snapPoint(wheelOrigin - layout.stride));
        }
        wheelMode = null;
        if (Math.abs(target - pos) > 0.02 || momentum !== 0 || pending !== 0) {
          beginLand(target, momentum + (ease > 0 ? pending / ease : 0));
        }
      }
    }
    shown = pos;
    const velocity = dt > 0 ? (shown - before) / dt : 0;
    measured = settings.reduced ? 0 : velocity + (measured - velocity) * Math.exp(-dt / SMOOTHING);
    if (Math.abs(measured) < 0.5 && Math.abs(velocity) < 0.5) measured = 0;
    const target = bendGoal();
    if (settings.reduced) {
      bend = target;
      bendVelocity = 0;
      return;
    }
    const omega = TAU / clamp(finite(settings.response, 0.32), 0.05, 3);
    const zeta = 1 - 0.55 * clamp(finite(settings.wobble, 0.25), 0, 1);
    let remaining = dt;
    while (remaining > 1e-6) {
      const h = Math.min(remaining, 1 / 240);
      bendVelocity += (omega * omega * (target - bend) - 2 * zeta * omega * bendVelocity) * h;
      bend += bendVelocity * h;
      remaining -= h;
    }
    if (Math.abs(target - bend) < 1e-5 && Math.abs(bendVelocity) < 1e-4) {
      bend = target;
      bendVelocity = 0;
    }
  };

  const fadeIn = (dt: number) => {
    pictures.forEach((picture) => {
      if (picture.texture && picture.ready < 1) picture.ready = Math.min(1, picture.ready + dt / 0.6);
    });
  };

  const busy = () => {
    if (press || land || pending !== 0 || momentum !== 0 || uploads.length) return true;
    if (drifting() || drift !== 0 || measured !== 0 || stepping()) return true;
    if (Math.abs(bend - bendGoal()) > 1e-5 || bendVelocity !== 0) return true;
    for (const picture of pictures.values()) if (picture.texture && picture.ready < 1) return true;
    if (count() && layout.stride) {
      if (bounded() && (pos < 0 || pos > upper())) return true;
      if (snapping() && Math.abs(snapPoint(pos) - pos) > 0.02) return true;
    }
    return false;
  };

  const tick = (stamp: number) => {
    raf = 0;
    if (destroyed || lost) return;
    ticking = true;
    const time = stamp / 1000;
    const dt = last ? clamp(time - last, 0, 0.05) : 1 / 60;
    last = time;
    if (uploads.length) upload();
    advance(dt, time);
    fadeIn(dt);
    draw();
    announce();
    ticking = false;
    if (!raf && visible && !doc.hidden && busy()) raf = view.requestAnimationFrame(tick);
  };

  function wake() {
    if (destroyed || raf || ticking || lost || !visible || doc.hidden) return;
    last = 0;
    raf = view.requestAnimationFrame(tick);
  }

  const navigate = (target: number) => {
    lastInput = clock();
    wheelAt = -1e9;
    wheelMode = null;
    beginLand(target, velocityNow(), STEP);
    wake();
  };

  function stepBy(amount: number) {
    const n = count();
    if (!n || !layout.stride) return;
    const base = Math.round((land ? land.target : pos + pending) / layout.stride);
    const index = bounded() ? clamp(base + amount, 0, n - 1) : base + amount;
    navigate(index * layout.stride);
  }

  const goTo = (index: number) => {
    const n = count();
    if (!n || !layout.stride || !Number.isFinite(index)) return;
    const wanted = mod(Math.round(index), n);
    if (bounded()) {
      navigate(wanted * layout.stride);
      return;
    }
    const current = Math.round((land ? land.target : pos + pending) / layout.stride);
    let delta = wanted - mod(current, n);
    if (delta > n / 2) delta -= n;
    else if (delta < -n / 2) delta += n;
    navigate((current + delta) * layout.stride);
  };

  const impulse = (velocity: number) => {
    if (!Number.isFinite(velocity) || !count() || !layout.stride) return;
    const push = clamp(velocity, -20000, 20000);
    const speed = velocityNow() + push;
    lastInput = clock();
    wheelAt = -1e9;
    wheelMode = null;
    if (snapping() || settingsRef.current.reduced) {
      beginLand(snapPoint(pos + speed * inertia()), speed);
    } else {
      if (land) {
        momentum = landVelocity;
        land = null;
        landVelocity = 0;
      }
      momentum += push;
    }
    wake();
  };

  const release = (velocity: number) => {
    if (bounded() && (pos < 0 || pos > upper())) {
      beginLand(clamp(pos, 0, upper()), cushion(velocity), BOUNCE);
    } else if (snapping()) {
      beginLand(snapPoint(pos + velocity * inertia()), velocity);
    } else {
      momentum = velocity;
    }
  };

  const along = (event: PointerEvent) => (layout.vertical ? event.clientY : event.clientX);

  const onDown = (event: PointerEvent) => {
    const settings = settingsRef.current;
    if (!event.isPrimary || event.button > 0 || !finite(settings.dragSpeed, 1) || !count() || !layout.stride) return;
    const rect = root.getBoundingClientRect();
    const scale = layout.vertical
      ? root.clientHeight / Math.max(rect.height, 1)
      : root.clientWidth / Math.max(rect.width, 1);
    land = null;
    landVelocity = 0;
    momentum = 0;
    pending = 0;
    drift = 0;
    wheelMode = null;
    const time = clock();
    press = {
      id: event.pointerId,
      start: along(event),
      origin: bounded() ? unstretch(pos) : pos,
      scale,
      samples: [{ t: time, p: pos }],
    };
    lastInput = time;
    try {
      root.setPointerCapture(event.pointerId);
    } catch {}
    root.style.cursor = "grabbing";
    wake();
  };

  const onMove = (event: PointerEvent) => {
    if (!press || event.pointerId !== press.id) return;
    const speed = finite(settingsRef.current.dragSpeed, 1);
    const raw = press.origin - (along(event) - press.start) * press.scale * speed;
    pos = bounded() ? stretch(raw) : raw;
    const time = clock();
    press.samples.push({ t: time, p: pos });
    while (press.samples.length > 2 && time - press.samples[0].t > 0.1) press.samples.shift();
    lastInput = time;
    wake();
  };

  const finish = (event: PointerEvent) => {
    if (!press || event.pointerId !== press.id) return;
    const ended = press;
    press = null;
    try {
      if (root.hasPointerCapture(event.pointerId)) root.releasePointerCapture(event.pointerId);
    } catch {}
    root.style.cursor = "grab";
    const time = clock();
    const recent = ended.samples.filter((sample) => time - sample.t < 0.1);
    let velocity = 0;
    if (event.type === "pointerup" && recent.length > 1 && time - recent[recent.length - 1].t < 0.06) {
      const first = recent[0];
      const latest = recent[recent.length - 1];
      velocity = (latest.p - first.p) / Math.max(latest.t - first.t, 1 / 120);
    }
    lastInput = time;
    release(settingsRef.current.reduced ? 0 : clamp(velocity, -8000, 8000));
    wake();
  };

  const onEnter = (event: PointerEvent) => {
    if (event.pointerType === "touch") return;
    hovering = true;
    wake();
  };

  const onLeave = (event: PointerEvent) => {
    if (event.pointerType === "touch") return;
    hovering = false;
    wake();
  };

  const onWheel = (event: WheelEvent) => {
    const settings = settingsRef.current;
    const speed = finite(settings.wheelSpeed, 1);
    if (!speed || !count() || !layout.stride || event.ctrlKey) return;
    let raw: number;
    if (layout.vertical) {
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
      raw = event.deltaY;
    } else {
      raw = Math.abs(event.deltaX) >= Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    }
    if (!raw) return;
    if (press) {
      event.preventDefault();
      return;
    }
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? layout.span : 1;
    let delta = clamp(raw * unit, -240, 240) * speed;
    const time = clock();
    if (snapping()) {
      if (time - wheelAt > WHEEL_IDLE) wheelMode = null;
      if (wheelMode === null) {
        wheelOrigin = land ? land.target : snapPoint(pos + pending);
        wheelMode = Math.abs(delta) >= layout.stride * DETENT ? "detent" : "free";
      }
      if (wheelMode === "detent") {
        const base = land ? land.target : snapPoint(pos + pending);
        const steps = Math.sign(delta) * Math.max(1, Math.round(Math.abs(delta) / 120));
        const target = snapPoint(base + steps * layout.stride);
        if (target === base && !land && Math.abs(pos - base) < 0.5) return;
        event.preventDefault();
        wheelAt = time;
        lastInput = time;
        if (target !== base && Math.abs(base - pos) < layout.stride * 1.5) beginLand(target, velocityNow(), STEP);
        wake();
        return;
      }
    }
    if (land) {
      pending = land.target - pos;
      momentum = 0;
      land = null;
      landVelocity = 0;
    }
    if (bounded()) {
      const from = pos + pending;
      const to = clamp(from + delta, 0, upper());
      if (Math.abs(to - from) < 0.5) return;
      delta = to - from;
    }
    event.preventDefault();
    pending += delta;
    wheelAt = time;
    lastInput = time;
    wake();
  };

  const onKey = (event: KeyboardEvent) => {
    if (event.target !== root || event.altKey || event.ctrlKey || event.metaKey) return;
    const forward = layout.vertical ? "ArrowDown" : "ArrowRight";
    const backward = layout.vertical ? "ArrowUp" : "ArrowLeft";
    if (event.key === forward || event.key === "PageDown") {
      event.preventDefault();
      stepBy(1);
    } else if (event.key === backward || event.key === "PageUp") {
      event.preventDefault();
      stepBy(-1);
    } else if (event.key === "Home") {
      event.preventDefault();
      goTo(0);
    } else if (event.key === "End") {
      event.preventDefault();
      goTo(count() - 1);
    }
  };

  const onVisibility = () => {
    if (!doc.hidden) wake();
  };

  const onLost = (event: Event) => {
    event.preventDefault();
    lost = true;
    if (raf) view.cancelAnimationFrame(raf);
    raf = 0;
  };

  const onRestored = () => {
    lost = false;
    blank = makeBlank();
    geometry = makeGeometry(vertical);
    slots.forEach((slot) => {
      slot.mesh.geometry = geometry;
      slot.map.value = blank;
    });
    pictures.forEach((picture) => {
      if (!picture.texture) return;
      picture.texture = null;
      picture.ready = 0;
      uploads.push(picture);
    });
    draw();
    wake();
  };

  root.addEventListener("pointerdown", onDown);
  root.addEventListener("pointermove", onMove);
  root.addEventListener("pointerup", finish);
  root.addEventListener("pointercancel", finish);
  root.addEventListener("lostpointercapture", finish);
  root.addEventListener("pointerenter", onEnter);
  root.addEventListener("pointerleave", onLeave);
  root.addEventListener("wheel", onWheel, { passive: false });
  root.addEventListener("keydown", onKey);
  doc.addEventListener("visibilitychange", onVisibility);
  canvas.addEventListener("webglcontextlost", onLost);
  canvas.addEventListener("webglcontextrestored", onRestored);

  const resizer =
    typeof view.ResizeObserver === "function"
      ? new view.ResizeObserver(() => {
          resize();
          draw();
          wake();
        })
      : null;
  resizer?.observe(root);

  const intersection =
    typeof view.IntersectionObserver === "function"
      ? new view.IntersectionObserver(
          (entries) => {
            visible = entries.some((entry) => entry.isIntersecting);
            if (visible) {
              wake();
            } else if (raf) {
              view.cancelAnimationFrame(raf);
              raf = 0;
            }
          },
          { rootMargin: "80px" },
        )
      : null;
  intersection?.observe(root);

  loadPictures();
  resize();
  root.style.cursor = finite(settingsRef.current.dragSpeed, 1) ? "grab" : "";
  draw();
  wake();

  return {
    sync: () => {
      if (destroyed) return;
      loadPictures();
      resize();
      if (!press) root.style.cursor = finite(settingsRef.current.dragSpeed, 1) ? "grab" : "";
      draw();
      wake();
    },
    destroy: () => {
      destroyed = true;
      if (raf) view.cancelAnimationFrame(raf);
      raf = 0;
      root.removeEventListener("pointerdown", onDown);
      root.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerup", finish);
      root.removeEventListener("pointercancel", finish);
      root.removeEventListener("lostpointercapture", finish);
      root.removeEventListener("pointerenter", onEnter);
      root.removeEventListener("pointerleave", onLeave);
      root.removeEventListener("wheel", onWheel);
      root.removeEventListener("keydown", onKey);
      doc.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      resizer?.disconnect();
      intersection?.disconnect();
      root.style.cursor = "";
      pictures.forEach((picture) => picture.texture?.dispose());
      pictures.clear();
      uploads = [];
      slots.forEach((slot) => {
        scene.remove(slot.mesh);
        slot.mesh.material.dispose();
      });
      slots.length = 0;
      geometry.dispose();
      blank.dispose();
      renderer.dispose();
      if (!renderer.getContext().isContextLost()) renderer.forceContextLoss();
      canvas.remove();
    },
    next: () => stepBy(1),
    previous: () => stepBy(-1),
    goTo,
    impulse,
  };
};
