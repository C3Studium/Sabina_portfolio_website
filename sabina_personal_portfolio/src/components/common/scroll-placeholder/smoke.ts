// WebGL kouř pro jeden řádek textu — převzaté ze SmokeType a zúžené na to,
// co potřebuje nápověda posunu.
//
// Proti originálu tři rozdíly:
//  - Nemá vlastní smyčku ani časování. Stav snímku (fáze, hodiny 0–1, čas
//    proudění) mu posílá komponenta z framer-motion přes `draw()`. Kdy se
//    kreslí, tedy rozhoduje framer; tady se jen kreslí.
//  - Jeden řádek, libovolně otočený. Pořadí písmen se počítá podél osy od
//    prvního k poslednímu písmenu, ne po vodorovných pásech — svislý text
//    s rotate(180deg) by jinak pořadí i směr kouře převrátil.
//  - Poloha písmen se měří v layoutu (offsetLeft/offsetTop), ne přes
//    getBoundingClientRect: plátno je dítě kořene a otáčí se s ním, takže
//    musí kreslit v jeho vlastních, neotočených souřadnicích.
//
// Modul se načítá líně (`import()` v komponentě) — three.js se tak stáhne,
// až když kouř opravdu poběží, a server ho nevidí vůbec.

import * as THREE from "three";

export type SmokeFrom = "top" | "bottom" | "center" | "edges";
export type SmokeDrift = "up" | "down";

/** Vzhled kouře; čte se jednou při vytvoření a při každém měření. */
export type SmokeConfig = {
  smokeColor: string;
  /** Kam se písmena při rozplynutí odnášejí (na obrazovce). */
  drift: SmokeDrift;
  rise: number;
  turbulence: number;
  softness: number;
  density: number;
  quality: number;
  /** Jakou část fáze trvá jedno písmeno; zbytek je rozestup mezi nimi. */
  letter: number;
  /**
   * Ztenčení hran plně srazených písmen (gama na pokrytí, 1 = beze změny).
   * Text z plátna vychází o kus tučnější než ten z DOMu — prohlížeč písmo
   * vyhlazuje jinak —, a při předávce by bylo vidět, jak text ztuční.
   */
  edge?: number;
};

/** Jeden snímek, jak ho spočítá komponenta z hodnoty smyčky. */
export type SmokeFrame = {
  phase: "dissolve" | "condense" | "none";
  /** Postup fáze 0–1. */
  clock: number;
  /** Odkud fronta po textu postupuje (na obrazovce). */
  from: SmokeFrom;
  /** Čas proudění v sekundách — jen pro pohyb šmouh, ne pro postup fáze. */
  time: number;
  /** Krytí plně srazených písmen; při prolnutí s DOM textem klesá k nule. */
  letterLayer: number;
};

export type Smoke = {
  measure: () => void;
  draw: (frame: SmokeFrame) => void;
  destroy: () => void;
};

const LEVELS = 5;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

let colorContext: CanvasRenderingContext2D | null = null;

const parseColor = (
  value: string,
  fallback: [number, number, number],
): [number, number, number] => {
  const direct = value.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
  if (direct) return [Number(direct[1]) / 255, Number(direct[2]) / 255, Number(direct[3]) / 255];
  if (!colorContext) colorContext = document.createElement("canvas").getContext("2d");
  if (!colorContext) return fallback;
  colorContext.fillStyle = "#010203";
  colorContext.fillStyle = value;
  const read = String(colorContext.fillStyle);
  if (read === "#010203" && value.trim().toLowerCase() !== "#010203") return fallback;
  if (read.startsWith("#")) {
    const hex = read.slice(1);
    return [
      parseInt(hex.slice(0, 2), 16) / 255,
      parseInt(hex.slice(2, 4), 16) / 255,
      parseInt(hex.slice(4, 6), 16) / 255,
    ];
  }
  const parts = read.match(/[\d.]+/g);
  if (!parts || parts.length < 3) return fallback;
  return [Number(parts[0]) / 255, Number(parts[1]) / 255, Number(parts[2]) / 255];
};

/* ---------- Shadery ---------- */

const passVertex = `
out vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

// Jeden krok pyramidy rozostření: zmenšit a rozmazat.
const downFragment = `
precision highp float;
uniform sampler2D uSource;
uniform vec2 uTexel;
in vec2 vUv;
out vec4 fragColor;

void main() {
  vec4 a = texture(uSource, vUv + uTexel * vec2(-1.0, -1.0));
  vec4 b = texture(uSource, vUv + uTexel * vec2(1.0, -1.0));
  vec4 c = texture(uSource, vUv + uTexel * vec2(-1.0, 1.0));
  vec4 d = texture(uSource, vUv + uTexel * vec2(1.0, 1.0));
  vec4 e = texture(uSource, vUv + uTexel * vec2(-2.0, 0.0));
  vec4 f = texture(uSource, vUv + uTexel * vec2(2.0, 0.0));
  vec4 g = texture(uSource, vUv + uTexel * vec2(0.0, -2.0));
  vec4 h = texture(uSource, vUv + uTexel * vec2(0.0, 2.0));
  fragColor = (a + b + c + d) * 0.15 + (e + f + g + h) * 0.05 + texture(uSource, vUv) * 0.2;
}
`;

const smokeFragment = `
precision highp float;
uniform sampler2D uL0;
uniform sampler2D uL1;
uniform sampler2D uL2;
uniform sampler2D uL3;
uniform sampler2D uL4;
uniform sampler2D uL5;
uniform sampler2D uNoise;
uniform vec2 uResolution;
uniform float uEm;
uniform float uTime;
uniform float uClock;
uniform float uLetter;
uniform float uMode;
uniform float uExit;
uniform vec2 uStart;
uniform vec2 uEnd;
uniform vec2 uDrift;
uniform float uRise;
uniform float uTurbulence;
uniform float uSoftness;
uniform float uDensity;
uniform float uLetterLayer;
uniform float uEdge;
uniform vec3 uText;
uniform vec3 uSmoke;
out vec4 fragColor;

vec2 flow(vec2 q, float t) {
  vec4 a = texture(uNoise, q * 0.045 + vec2(t * 0.011, -t * 0.019));
  vec4 b = texture(uNoise, q * 0.11 + vec2(-t * 0.017, -t * 0.031) + a.ba * 0.5);
  return (a.rg - 0.5) * 1.6 + (b.rg - 0.5) * 0.8;
}

float level(vec2 uv, int i) {
  if (i <= 0) return texture(uL0, uv).r;
  if (i == 1) return texture(uL1, uv).r;
  if (i == 2) return texture(uL2, uv).r;
  if (i == 3) return texture(uL3, uv).r;
  if (i == 4) return texture(uL4, uv).r;
  return texture(uL5, uv).r;
}

float blurred(vec2 p, float amount) {
  vec2 uv = p / uResolution;
  if (uv.x < -0.02 || uv.y < -0.02 || uv.x > 1.02 || uv.y > 1.02) return 0.0;
  float l = clamp(amount, 0.0, ${LEVELS}.0);
  int i = int(floor(l));
  float m = mix(level(uv, i), level(uv, min(i + 1, ${LEVELS})), fract(l));
  return min(m * (1.0 + l * 0.55), 1.0);
}

// Pořadí bodu podél řádku: 0 = začíná první, 1 = poslední.
// uMode 0 = od uStart k uEnd, 1 = od středu ven, 2 = od krajů dovnitř.
float orderFor(vec2 p) {
  vec2 axis = uEnd - uStart;
  float u = clamp(dot(p - uStart, axis) / max(dot(axis, axis), 1.0), 0.0, 1.0);
  if (uMode > 0.5 && uMode < 1.5) return abs(u - 0.5) * 2.0;
  if (uMode > 1.5) return 1.0 - abs(u - 0.5) * 2.0;
  return u;
}

float progressFor(vec2 p) {
  float local = clamp((uClock - orderFor(p) * (1.0 - uLetter)) / max(uLetter, 0.05), 0.0, 1.0);
  return uExit > 0.5 ? 1.0 - local : local;
}

void main() {
  vec2 p = gl_FragCoord.xy;
  float t = uTime;
  vec2 q = p / uEm;
  vec2 stream = flow(q, t);
  float billow = texture(uNoise, q * 0.07 + stream * 0.035 - vec2(0.0, t * 0.035)).g;
  vec2 fibre = q * vec2(0.62, 0.16) + stream * 0.05 - vec2(0.0, t * 0.09);
  float fine = texture(uNoise, fibre).b * 0.6 + texture(uNoise, fibre * 2.2 + vec2(0.31, 0.17)).a * 0.4;
  float streak = pow(1.0 - abs(fine * 2.0 - 1.0), 2.0);
  float body = (0.45 + 0.9 * billow) * (0.25 + 1.3 * streak);

  float prog = progressFor(p);
  float k = 1.0 - prog;
  // Bod p ukazuje písmo z místa p + posun, takže písmo samo se jeví posunuté
  // opačně. uDrift míří tam, odkud se čte; směr na obrazovce dopočítal JS.
  vec2 source = p + uDrift * uRise * uEm * k * k * 1.2 + stream * uTurbulence * uEm * 0.45 * k;
  float shape = blurred(source, k * uSoftness * ${LEVELS}.0);
  // Ztenčení hran jen u (skoro) srazených písmen, aby seděla na DOM text;
  // kouř zůstává, jak je.
  shape = pow(shape, mix(uEdge, 1.0, smoothstep(0.0, 0.25, k)));
  float texture_ = mix(1.0, body, smoothstep(0.05, 0.5, k));
  float appear = smoothstep(0.0, 0.45, prog);
  float alpha = clamp(shape * texture_ * appear * mix(1.0, 0.5 * uDensity, smoothstep(0.0, 0.7, k)), 0.0, 1.0);
  alpha *= mix(1.0, uLetterLayer, step(0.999, prog));

  vec3 tone = mix(uSmoke, uText, smoothstep(0.62, 0.98, prog));
  fragColor = vec4(tone * alpha, alpha);
}
`;

/* ---------- Šum ---------- */

// Data šumu jsou pro všechny instance stejná a jejich výpočet trvá desítky
// milisekund — počítají se jednou za běh stránky. Textura nad nimi patří
// vždy jednomu rendereru.
let noiseData: Uint8Array | null = null;

const buildNoiseData = () => {
  const size = 256;
  const data = new Uint8Array(size * size * 4);
  const lattice = (period: number, seed: number) => {
    const values = new Float32Array(period * period);
    let state = seed * 2654435761;
    for (let i = 0; i < values.length; i++) {
      state = (state ^ (state << 13)) >>> 0;
      state = (state ^ (state >>> 17)) >>> 0;
      state = (state ^ (state << 5)) >>> 0;
      values[i] = (state % 100000) / 100000;
    }
    return (x: number, y: number) => {
      const fx = x * period;
      const fy = y * period;
      const ix = Math.floor(fx);
      const iy = Math.floor(fy);
      const tx = fx - ix;
      const ty = fy - iy;
      const sx = tx * tx * tx * (tx * (tx * 6 - 15) + 10);
      const sy = ty * ty * ty * (ty * (ty * 6 - 15) + 10);
      const at = (a: number, b: number) =>
        values[(((b % period) + period) % period) * period + (((a % period) + period) % period)];
      const top = at(ix, iy) + (at(ix + 1, iy) - at(ix, iy)) * sx;
      const bottom = at(ix, iy + 1) + (at(ix + 1, iy + 1) - at(ix, iy + 1)) * sx;
      return top + (bottom - top) * sy;
    };
  };
  const channels = [0, 1, 2, 3].map((channel) =>
    [4, 8, 16, 32].map((period, octave) => lattice(period, channel * 13 + octave * 7 + 3)),
  );
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      for (let c = 0; c < 4; c++) {
        let sum = 0;
        let amplitude = 0.5;
        let total = 0;
        for (const octave of channels[c]) {
          sum += octave(u, v) * amplitude;
          total += amplitude;
          amplitude *= 0.5;
        }
        data[(y * size + x) * 4 + c] = Math.round((sum / total) * 255);
      }
    }
  }
  return data;
};

const buildNoise = () => {
  noiseData ??= buildNoiseData();
  const texture = new THREE.DataTexture(noiseData, 256, 256, THREE.RGBAFormat);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;
  return texture;
};

/* ---------- Měření ---------- */

// Poloha prvku v neotočených souřadnicích kořene. offsetLeft/offsetTop
// transformace ignorují — přesně to tu je potřeba.
const offsetWithin = (el: HTMLElement, root: HTMLElement) => {
  let x = 0;
  let y = 0;
  let node: HTMLElement | null = el;
  while (node && node !== root) {
    x += node.offsetLeft;
    y += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }
  return { x, y };
};

const centerOf = (rect: DOMRect) => ({
  x: rect.left + rect.width / 2,
  y: rect.top + rect.height / 2,
});

/* ---------- Renderer ---------- */

export function createSmoke(
  root: HTMLElement,
  face: HTMLElement,
  config: SmokeConfig,
): Smoke | null {
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  Object.assign(canvas.style, {
    position: "absolute",
    pointerEvents: "none",
    display: "block",
  });
  root.prepend(canvas);

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
    });
  } catch {
    canvas.remove();
    return null;
  }
  if (!renderer.capabilities.isWebGL2) {
    renderer.dispose();
    canvas.remove();
    return null;
  }
  renderer.setClearColor(0x000000, 0);
  renderer.autoClear = false;

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const plane = new THREE.PlaneGeometry(2, 2);
  const pass = (fragmentShader: string, uniforms: Record<string, THREE.IUniform>) =>
    new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms,
      vertexShader: passVertex,
      fragmentShader,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      premultipliedAlpha: true,
      blending: THREE.NoBlending,
    });

  const downMaterial = pass(downFragment, {
    uSource: { value: null },
    uTexel: { value: new THREE.Vector2() },
  });
  const smokeMaterial = pass(smokeFragment, {
    uL0: { value: null },
    uL1: { value: null },
    uL2: { value: null },
    uL3: { value: null },
    uL4: { value: null },
    uL5: { value: null },
    uNoise: { value: null },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uEm: { value: 40 },
    uTime: { value: 0 },
    uClock: { value: 0 },
    uLetter: { value: 0.3 },
    uMode: { value: 0 },
    uExit: { value: 0 },
    uStart: { value: new THREE.Vector2() },
    uEnd: { value: new THREE.Vector2(1, 0) },
    uDrift: { value: new THREE.Vector2(0, 1) },
    uRise: { value: 1 },
    uTurbulence: { value: 1 },
    uSoftness: { value: 1 },
    uDensity: { value: 1 },
    uLetterLayer: { value: 1 },
    uEdge: { value: 1 },
    uText: { value: new THREE.Vector3(1, 1, 1) },
    uSmoke: { value: new THREE.Vector3(1, 1, 1) },
  });
  const noise = buildNoise();
  smokeMaterial.uniforms.uNoise.value = noise;

  const quad = new THREE.Mesh(plane, smokeMaterial);
  quad.frustumCulled = false;
  const scene = new THREE.Scene();
  scene.add(quad);

  let sharp: THREE.CanvasTexture | null = null;
  let levels: THREE.WebGLRenderTarget[] = [];
  let ready = false;
  let dirty = false;
  let destroyed = false;
  let lastFrame: SmokeFrame | null = null;
  let em = 16;
  let width = 1;
  let height = 1;
  let textColor: [number, number, number] = [1, 1, 1];
  // Osa řádku v GL souřadnicích plátna, od horního a od spodního konce
  // na obrazovce, a směr „nahoru na obrazovce" v týchž souřadnicích.
  const axis = {
    top: new THREE.Vector2(),
    bottom: new THREE.Vector2(),
    up: new THREE.Vector2(0, 1),
  };

  const release = () => {
    levels.forEach((target) => target.dispose());
    levels = [];
    sharp?.dispose();
    sharp = null;
  };

  const raster = () => {
    ready = false;
    const glyphs = Array.from(face.querySelectorAll<HTMLElement>("[data-glyph]")).filter(
      (el) => el.textContent?.trim(),
    );
    const rootW = root.offsetWidth;
    const rootH = root.offsetHeight;
    // Skrytý kořen (mobil má nápovědu display: none) nemá co kreslit.
    if (!rootW || !rootH || !glyphs.length) return;

    const style = getComputedStyle(face);
    em = parseFloat(style.fontSize) || 16;
    const rise = clamp(config.rise, 0, 4);
    const turbulence = clamp(config.turbulence, 0, 3);
    // Okraj plátna kolem textu, aby kouř neskončil rovným řezem. Je stejný
    // ze všech stran: směr unášení se dopočítává až z otočení na obrazovce.
    const padX = em * (0.9 + turbulence * 0.3 + rise * 0.6);
    const padY = em * (0.9 + turbulence * 0.3 + rise * 0.9);
    const boxW = rootW + padX * 2;
    const boxH = rootH + padY * 2;
    Object.assign(canvas.style, {
      left: `${-padX}px`,
      top: `${-padY}px`,
      width: `${boxW}px`,
      height: `${boxH}px`,
    });

    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2) * clamp(config.quality, 0.25, 1);
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(boxW, boxH, false);
    width = Math.max(1, Math.round(boxW * pixelRatio));
    height = Math.max(1, Math.round(boxH * pixelRatio));

    const ink = document.createElement("canvas");
    ink.width = width;
    ink.height = height;
    const context = ink.getContext("2d");
    if (!context) return;

    context.fillStyle = "#ffffff";
    context.textBaseline = "alphabetic";
    context.font = `${style.fontStyle} ${style.fontWeight} ${em * pixelRatio}px ${style.fontFamily}`;
    const metrics = context.measureText("Hg");
    const ascent = metrics.fontBoundingBoxAscent || em * pixelRatio * 0.8;
    const descent = metrics.fontBoundingBoxDescent || em * pixelRatio * 0.2;
    const baseline = ascent / (ascent + descent);
    // Ve svislém řádku leží latinka bokem: horní strana písmen míří vpravo
    // (line-over je u vertical-rl i vertical-lr vpravo).
    const vertical = style.writingMode.startsWith("vertical");
    // `text-transform` mění jen to, co se vykreslí — v DOMu zůstává původní
    // text, takže se tady musí použít znovu.
    const lang = face.closest("[lang]")?.getAttribute("lang") ?? undefined;
    const shape = (glyph: string) =>
      style.textTransform === "uppercase"
        ? glyph.toLocaleUpperCase(lang)
        : style.textTransform === "lowercase"
          ? glyph.toLocaleLowerCase(lang)
          : glyph;

    for (const el of glyphs) {
      const { x, y } = offsetWithin(el, root);
      const left = (x + padX) * pixelRatio;
      const top = (y + padY) * pixelRatio;
      const w = el.offsetWidth * pixelRatio;
      const h = el.offsetHeight * pixelRatio;
      const glyph = shape(el.textContent ?? "");
      if (vertical) {
        context.save();
        context.translate(left + w, top);
        context.rotate(Math.PI / 2);
        context.fillText(glyph, 0, w * baseline);
        context.restore();
      } else {
        context.fillText(glyph, left, top + h * baseline);
      }
    }

    // Osa řádku: středy prvního a posledního písmene.
    const first = glyphs[0];
    const last = glyphs[glyphs.length - 1];
    const toGl = (el: HTMLElement) => {
      const { x, y } = offsetWithin(el, root);
      return new THREE.Vector2(
        (x + el.offsetWidth / 2 + padX) * pixelRatio,
        height - (y + el.offsetHeight / 2 + padY) * pixelRatio,
      );
    };
    const localA = toGl(first);
    const localB = toGl(last);
    const screenA = centerOf(first.getBoundingClientRect());
    const screenB = centerOf(last.getBoundingClientRect());

    // Otočení kořene na obrazovce: úhel mezi osou řádku v layoutu a tou,
    // kterou vrací prohlížeč po transformacích. Obojí v osách s y dolů.
    const layoutAngle = Math.atan2(-(localB.y - localA.y), localB.x - localA.x);
    const screenAngle = Math.atan2(screenB.y - screenA.y, screenB.x - screenA.x);
    const turn = glyphs.length > 1 ? screenAngle - layoutAngle : 0;
    // „Nahoru na obrazovce" převedené do GL souřadnic plátna (y nahoru).
    axis.up.set(-Math.sin(turn), Math.cos(turn));
    const aIsTop = screenA.y <= screenB.y;
    axis.top.copy(aIsTop ? localA : localB);
    axis.bottom.copy(aIsTop ? localB : localA);

    // Pyramida rozostření: ostrý text a pět čím dál menších, rozmazanějších kopií.
    release();
    sharp = new THREE.CanvasTexture(ink);
    sharp.minFilter = THREE.LinearFilter;
    sharp.magFilter = THREE.LinearFilter;
    sharp.generateMipmaps = false;
    sharp.colorSpace = THREE.NoColorSpace;
    sharp.premultiplyAlpha = true;
    sharp.needsUpdate = true;
    const scale = Math.max(1, (em * pixelRatio) / 60);
    let source: THREE.Texture = sharp;
    let sourceW = width;
    let sourceH = height;
    for (let i = 1; i <= LEVELS; i++) {
      const factor = i === 1 ? Math.max(1, Math.round(scale)) : 2;
      const w = Math.max(2, Math.round(sourceW / factor));
      const h = Math.max(2, Math.round(sourceH / factor));
      const target = new THREE.WebGLRenderTarget(w, h, {
        type: THREE.HalfFloatType,
        format: THREE.RGBAFormat,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        depthBuffer: false,
        stencilBuffer: false,
        generateMipmaps: false,
      });
      downMaterial.uniforms.uSource.value = source;
      downMaterial.uniforms.uTexel.value.set(
        (1 / sourceW) * Math.max(1, factor * 0.75),
        (1 / sourceH) * Math.max(1, factor * 0.75),
      );
      quad.material = downMaterial;
      renderer.setRenderTarget(target);
      renderer.render(scene, camera);
      levels.push(target);
      source = target.texture;
      sourceW = w;
      sourceH = h;
    }
    renderer.setRenderTarget(null);
    quad.material = smokeMaterial;
    textColor = parseColor(style.color, [1, 1, 1]);
    ready = true;
    dirty = true; // starý obsah plátna má jiný rozměr
  };

  const clear = () => {
    renderer.setRenderTarget(null);
    renderer.clear();
  };

  const draw = (frame: SmokeFrame) => {
    lastFrame = frame;
    if (destroyed || !ready) return;

    if (frame.phase === "none") {
      // Plátno se maže jednou, ne v každém snímku klidové části smyčky.
      if (dirty) clear();
      dirty = false;
      return;
    }

    const u = smokeMaterial.uniforms;
    const smoke = parseColor(config.smokeColor, textColor);
    u.uL0.value = sharp;
    for (let i = 1; i <= LEVELS; i++) u[`uL${i}`].value = levels[i - 1]?.texture ?? null;
    u.uResolution.value.set(width, height);
    u.uEm.value = em * renderer.getPixelRatio();
    u.uTime.value = frame.time;
    u.uClock.value = clamp(frame.clock, 0, 1);
    u.uLetter.value = clamp(config.letter, 0.05, 1);
    u.uExit.value = frame.phase === "dissolve" ? 1 : 0;
    u.uMode.value = frame.from === "center" ? 1 : frame.from === "edges" ? 2 : 0;
    u.uStart.value.copy(frame.from === "bottom" ? axis.bottom : axis.top);
    u.uEnd.value.copy(frame.from === "bottom" ? axis.top : axis.bottom);
    // Písmo se jeví posunuté proti uDrift. Má-li se odnášet dolů, čte se
    // z místa nad bodem — tedy uDrift = nahoru.
    u.uDrift.value.copy(axis.up).multiplyScalar(config.drift === "down" ? 1 : -1);
    u.uRise.value = clamp(config.rise, 0, 4);
    u.uTurbulence.value = clamp(config.turbulence, 0, 3);
    u.uSoftness.value = clamp(config.softness, 0.1, 1.5);
    u.uDensity.value = clamp(config.density, 0, 3);
    u.uLetterLayer.value = clamp(frame.letterLayer, 0, 1);
    u.uEdge.value = clamp(config.edge ?? 1, 0.5, 4);
    u.uText.value.set(...textColor);
    u.uSmoke.value.set(...smoke);

    clear();
    renderer.render(scene, camera);
    dirty = true;
  };

  const measure = () => {
    if (destroyed) return;
    raster();
    if (lastFrame) draw(lastFrame);
  };

  const resizeObserver = new ResizeObserver(measure);
  resizeObserver.observe(root);
  // Písmo z next/font může dorazit až po prvním měření a změní šířky písmen.
  document.fonts?.ready.then(measure).catch(() => {});

  raster();

  return {
    measure,
    draw,
    destroy: () => {
      destroyed = true;
      resizeObserver.disconnect();
      release();
      plane.dispose();
      downMaterial.dispose();
      smokeMaterial.dispose();
      noise.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
}
