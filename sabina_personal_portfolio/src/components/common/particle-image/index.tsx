import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import styles from "./styles.module.scss";

// Částice vázané na neprůhledné pixely obrázku.
//
// ROZDÍL PROTI BĚŽNÉMU "particle image": ten rodí částice rovnoměrně po
// celém plátně a obrázek použije jen na obarvení. Tady se z obrázku
// nejdřív na CPU přečte pixelová mapa (getImageData), vyberou se pixely
// nad alfa prahem a ty se zapečou do SPAWN ATLASU — textury pozic. Sim
// shader pak při zrození i znovuzrození sáhne do atlasu, takže částice
// nemůže vzniknout mimo motiv. Žádné zamítací smyčky v shaderu.

export interface ParticleImageProps {
  /** Obrázek, ze kterého se čte maska i barva. */
  src: string;
  /**
   * Prvek, jehož box má vrstva PŘESNĚ kopírovat — typicky samotný <img>.
   * Velikost se bere z DOMu (offsetWidth/Height) a hlídá ji ResizeObserver,
   * takže plátno sedí na fotku i po resize. Spoléhat na to, že rodič
   * obrázek obalí, nestačí — tak to bylo posunuté a zmenšené.
   */
  targetRef: React.RefObject<HTMLElement | null>;
  className?: string;

  /* ---------- Hustota a vzhled ---------- */
  /** Počet částic, zaokrouhlí se nahoru na čtvercovou mřížku simulace. */
  particleCount?: number;
  /** Průměr částice v CSS pixelech. */
  particleSize?: number;
  /** Vrcholová průhlednost. Násobí se ještě alfou zdrojového pixelu. */
  particleOpacity?: number;
  /** Sčítací míchání — částice pak spíš svítí, než že by fotku překrývaly. */
  additive?: boolean;
  /**
   * Kolik pixelů plátna přesahuje fotku na KAŽDOU stranu.
   * Plátno je rastr a mimo svůj box nenakreslí nic, takže bez přesahu
   * částice na jeho hraně končí rovným řezem. CSS to nespraví — kreslicí
   * plocha musí být fyzicky větší. Silueta zůstává na svém místě, protože
   * shader dostane rozměr fotky zvlášť (uImageRect).
   */
  bleed?: number;

  /* ---------- Maska ---------- */
  /** Alfa, od které se pixel počítá jako součást motivu (0-255). */
  alphaThreshold?: number;

  /* ---------- Proudění ---------- */
  /** Rychlost vývoje pole proudění. */
  speed?: number;
  /** Frekvence pole: nižší = delší a plynulejší proudy. */
  noiseScale?: number;
  /** Zrychlení podél pole každý snímek. */
  noiseStrength?: number;
  /** Kolik rychlosti si částice nechá: nižší = dřív se usadí. */
  damping?: number;
  /** Snímky života. Krátký = drží se siluety, dlouhý = odplouvá pryč. */
  lifespan?: number;

  /* ---------- Kurzor ---------- */
  /** Nechá kurzor táhnout částice s sebou. */
  cursorInteraction?: boolean;
  /** Kolik své rychlosti kurzor předá okolním částicím. */
  cursorStrength?: number;
  /** Dosah kurzoru v CSS pixelech. */
  cursorRadius?: number;

  /* ---------- Běh a výkon ---------- */
  /** Strop device pixel ratio. */
  dpr?: number;
  /** Zmrazí simulaci na místě. */
  paused?: boolean;
}

const GLSL_HASH = `
#define HASH_SCALE vec3(0.1031, 0.11369, 0.13787)

vec3 hash33(vec3 p) {
  p = fract(p * HASH_SCALE);
  p += dot(p, p.yxz + 19.19);
  return -1.0 + 2.0 * fract(vec3(
    (p.x + p.y) * p.z,
    (p.x + p.z) * p.y,
    (p.y + p.z) * p.x
  ));
}
`;

const GLSL_NOISE = `
float flowNoise(vec3 p) {
  const float K1 = 0.333333333;
  const float K2 = 0.166666667;

  vec3 cell = floor(p + (p.x + p.y + p.z) * K1);
  vec3 d0 = p - (cell - (cell.x + cell.y + cell.z) * K2);
  vec3 edge = step(vec3(0.0), d0 - d0.yzx);
  vec3 o1 = edge * (1.0 - edge.zxy);
  vec3 o2 = 1.0 - edge.zxy * (1.0 - edge);
  vec3 d1 = d0 - (o1 - K2);
  vec3 d2 = d0 - (o2 - 2.0 * K2);
  vec3 d3 = d0 - (1.0 - 3.0 * K2);

  vec4 falloff =
    max(0.6 - vec4(dot(d0, d0), dot(d1, d1), dot(d2, d2), dot(d3, d3)), 0.0);
  vec4 weights = falloff * falloff * falloff * falloff * vec4(
    dot(d0, hash33(cell)),
    dot(d1, hash33(cell + o1)),
    dot(d2, hash33(cell + o2)),
    dot(d3, hash33(cell + 1.0))
  );

  return dot(vec4(31.316), weights);
}
`;

const QUAD_VERT = `precision highp float;

in vec3 position;
in vec2 uv;

out vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}`;

// Zrození. uSpawn je atlas platných pozic; náhodné uv do něj vrátí
// souřadnici pixelu, který na obrázku opravdu je.
const SEED_FRAG = `precision highp float;

uniform sampler2D uSpawn;
uniform vec2 uResolution;
uniform float uLifespan;
// Kde v plátně leží samotná fotka: xy = odsazení, zw = rozměr, obojí
// v pixelech kreslicího bufferu. Plátno je o "bleed" větší na každou
// stranu, aby měly částice kam odplout — bez toho je ořízne jeho hrana.
uniform vec4 uImageRect;

in vec2 vUv;

layout(location = 0) out vec4 outMotion;
layout(location = 1) out vec4 outLife;

${GLSL_HASH}

void main() {
  vec3 r = hash33(vec3(vUv * 512.0, 1.0));
  vec3 j = hash33(vec3(vUv * 91.7, 7.3));

  vec2 birth = texture(uSpawn, fract(r.xy * 0.5 + 0.5)).xy;
  float span = uLifespan * (0.25 + 0.75 * fract(j.z * 0.5 + 0.5));

  outMotion = vec4(uImageRect.xy + birth * uImageRect.zw, j.xy * 0.25);
  // life.zw nese uv zrození — z něj se v bodovém shaderu bere barva.
  outLife = vec4(fract(r.z * 0.5 + 0.5) * span, span, birth);
}`;

const SIM_FRAG = `precision highp float;

uniform sampler2D tMotion;
uniform sampler2D tLife;
uniform sampler2D uSpawn;
uniform vec2 uResolution;
uniform float uTime;
uniform float uNoiseScale;
uniform float uNoiseStrength;
uniform float uDamping;
uniform float uLifespan;
// Kde v plátně leží samotná fotka: xy = odsazení, zw = rozměr, obojí
// v pixelech kreslicího bufferu. Plátno je o "bleed" větší na každou
// stranu, aby měly částice kam odplout — bez toho je ořízne jeho hrana.
uniform vec4 uImageRect;
uniform vec2 uPointer;
uniform vec2 uPointerVelocity;
uniform float uPointerStrength;
uniform float uPointerFalloff;

in vec2 vUv;

layout(location = 0) out vec4 outMotion;
layout(location = 1) out vec4 outLife;

${GLSL_HASH}
${GLSL_NOISE}

void main() {
  vec4 motion = texture(tMotion, vUv);
  vec4 life = texture(tLife, vUv);

  vec2 pos = motion.xy;
  vec2 vel = motion.zw;
  float age = life.x + 1.0;
  float span = life.y;
  vec2 seed = life.zw;

  float angle =
    flowNoise(vec3(pos * uNoiseScale, uTime * 20.0 + age * 0.05)) * 6.2831853;
  // Kurzor částicím předává svou rychlost — netlačí je pryč, táhne je
  // s sebou. Sleduje se na window, protože vrstva má pointer-events: none.
  vec2 offset = pos - uPointer;
  float proximity = uPointerFalloff / (dot(offset, offset) + uPointerFalloff);
  vec2 wake = uPointerVelocity * proximity * uPointerStrength;

  vel = vel * uDamping + vec2(cos(angle), sin(angle)) * uNoiseStrength + wake;
  pos += vel;

  bool spent = age >= span
    || pos.x < 0.0 || pos.x > uResolution.x
    || pos.y < 0.0 || pos.y > uResolution.y;

  if (spent) {
    // Znovuzrození jde OPĚT přes atlas, jinak by se pole časem rozlilo
    // mimo motiv a efekt by přestal kopírovat fotku.
    vec3 rebirth = hash33(vec3(seed, uTime + age));
    float nextSpan = uLifespan * (0.25 + 0.75 * fract(rebirth.z * 0.5 + 0.5));
    vec2 birth = texture(uSpawn, fract(rebirth.xy * 0.5 + 0.5)).xy;
    outMotion = vec4(uImageRect.xy + birth * uImageRect.zw, 0.0, 0.0);
    outLife = vec4(0.0, nextSpan, birth);
  } else {
    outMotion = vec4(pos, vel);
    outLife = vec4(age, span, seed);
  }
}`;

// Plátno má stejný poměr stran jako obrázek, takže uv sedí 1:1 a žádné
// přepočítávání na "cover" tu není potřeba.
const POINT_VERT = `precision highp float;

in vec3 position;

uniform sampler2D tMotion;
uniform sampler2D tLife;
uniform sampler2D uImage;
uniform vec2 uResolution;
uniform float uPointSize;
uniform float uOpacity;

out vec3 vTint;
out float vAlpha;

void main() {
  vec4 motion = texture(tMotion, position.xy);
  vec4 life = texture(tLife, position.xy);

  float ratio = life.x / max(life.y, 1.0);
  float fade =
    smoothstep(0.0, 0.05, ratio) * (1.0 - smoothstep(0.85, 1.0, ratio));

  vec4 src = texture(uImage, life.zw);
  vTint = src.rgb;
  // Alfa zdroje se propíše i do částice — na měkkém okraji vlasů tak
  // částice slábnou stejně jako fotka.
  vAlpha = fade * uOpacity * src.a;

  vec2 ndc = motion.xy / uResolution * 2.0 - 1.0;
  gl_Position = vec4(ndc.x, -ndc.y, 0.0, 1.0);
  // POZOR: dřív tu bylo smoothstep(1.0, 0.5, ratio), tedy edge0 > edge1 —
  // to je podle GLSL specifikace NEDEFINOVANÉ. Na běžných ovladačích to
  // vychází takhle, ale spoléhat se na to nemá cenu. Význam je stejný:
  // první polovinu života má částice plnou velikost, druhou se zmenšuje
  // k nule. Proto je viditelná hustota zhruba poloviční proti počtu.
  gl_PointSize = (1.0 - smoothstep(0.5, 1.0, ratio)) * uPointSize * fade;
}`;

const POINT_FRAG = `precision highp float;

in vec3 vTint;
in float vAlpha;

out vec4 fragColor;

void main() {
  float mask = 1.0 - smoothstep(0.3, 0.5, length(gl_PointCoord - 0.5));
  fragColor = vec4(vTint, vAlpha * mask);
}`;

// Kolik různých pozic se z obrázku zapeče. Odvozuje se od počtu platných
// pixelů, ne z pevného čísla:
//  - větší atlas než informace ve zdroji nemá smysl, pozice by se jen
//    opakovaly,
//  - menší atlas ale hustotu ZASTROPUJE — o jednu pozici se pak dělí víc
//    částic, rodí se na stejném pixelu a přidávat je přestane pomáhat.
function atlasSideFor(validCount: number): number {
  return Math.min(1024, Math.max(128, Math.ceil(Math.sqrt(validCount))));
}

interface Source {
  image: THREE.Texture;
  spawn: THREE.DataTexture;
  /** Podíl pixelů nad prahem. Pod 1 % nemá smysl nic kreslit. */
  coverage: number;
}

// TADY se děje to, na co ses ptal: obrázek se vykreslí do 2D canvasu,
// přečte se getImageData a z alfa kanálu vznikne seznam platných pixelů.
// Ten se pak převzorkuje do čtvercové textury pozic, kterou už čte GPU.
function useImageSource(src: string, alphaThreshold: number): Source | null {
  const [source, setSource] = useState<Source | null>(null);

  useEffect(() => {
    let active = true;

    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.src = src;

    img
      .decode()
      .then(() => {
        if (!active) return;

        const w = img.naturalWidth;
        const h = img.naturalHeight;
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;

        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return;
        ctx.drawImage(img, 0, 0);
        const { data } = ctx.getImageData(0, 0, w, h);

        // 1) Posbírej indexy pixelů, které patří k motivu.
        const total = w * h;
        const valid = new Uint32Array(total);
        let count = 0;
        for (let i = 0; i < total; i++) {
          if (data[i * 4 + 3] > alphaThreshold) valid[count++] = i;
        }
        if (count === 0 || !active) return;

        // 2) Rovnoměrným krokem seznamem vyber side^2 pozic.
        //    Krok, ne náhoda — náhodný výběr s opakováním dělá shluky
        //    a řídká místa, kdežto krok rozloží částice po siluetě rovnoměrně.
        const side = atlasSideFor(count);
        const cells = side * side;
        const atlas = new Float32Array(cells * 4);
        for (let c = 0; c < cells; c++) {
          const pixel = valid[Math.floor((c * count) / cells)];
          atlas[c * 4] = ((pixel % w) + 0.5) / w;
          atlas[c * 4 + 1] = (Math.floor(pixel / w) + 0.5) / h;
          atlas[c * 4 + 3] = 1;
        }

        const spawn = new THREE.DataTexture(
          atlas,
          side,
          side,
          THREE.RGBAFormat,
          THREE.FloatType,
        );
        spawn.minFilter = THREE.NearestFilter;
        spawn.magFilter = THREE.NearestFilter;
        spawn.wrapS = THREE.ClampToEdgeWrapping;
        spawn.wrapT = THREE.ClampToEdgeWrapping;
        spawn.needsUpdate = true;

        const image = new THREE.Texture(img);
        // flipY false, aby v = 0 byl horní řádek — stejná orientace,
        // v jaké přišla data z getImageData i v jaké se počítá pozice.
        image.flipY = false;
        image.colorSpace = THREE.SRGBColorSpace;
        image.minFilter = THREE.LinearFilter;
        image.magFilter = THREE.LinearFilter;
        image.generateMipmaps = false;
        image.needsUpdate = true;

        setSource({ image, spawn, coverage: count / total });
      })
      .catch(() => {
        /* nenačtený obrázek jen znamená, že se efekt nevykreslí */
      });

    return () => {
      active = false;
    };
  }, [src, alphaThreshold]);

  useEffect(() => {
    return () => {
      source?.image.dispose();
      source?.spawn.dispose();
    };
  }, [source]);

  return source;
}

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

// Změří SKUTEČNÝ box obrázku v DOMu a drží ho aktuální.
//
// offsetLeft/Top jsou vůči offsetParent, což je tentýž pozicovaný rodič,
// v němž leží i tahle vrstva — takže se dají použít přímo jako inline
// left/top. Jsou to layoutové hodnoty, takže je transform na předkovi
// (hero jede na motion.div tracku) neovlivní.
function useTrackedBox(target: React.RefObject<HTMLElement | null>): Box | null {
  const [box, setBox] = useState<Box | null>(null);

  useEffect(() => {
    const element = target.current;
    if (!element) return;

    const measure = () => {
      const next: Box = {
        left: element.offsetLeft,
        top: element.offsetTop,
        width: element.offsetWidth,
        height: element.offsetHeight,
      };
      // Porovnání proti minulé hodnotě — bez něj by setState v
      // ResizeObserveru točil nekonečnou smyčku překreslení.
      setBox((prev) =>
        prev &&
        prev.left === next.left &&
        prev.top === next.top &&
        prev.width === next.width &&
        prev.height === next.height
          ? prev
          : next,
      );
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(element);
    // Rodič se může měnit, aniž by se změnil obrázek (výška v %), a jeho
    // změna posune i offsetLeft/Top. Proto se sleduje taky.
    if (element.parentElement) observer.observe(element.parentElement);
    window.addEventListener("resize", measure);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [target]);

  return box;
}

function useInView(ref: React.RefObject<Element | null>): boolean {
  const [inView, setInView] = useState(true);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.01 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return inView;
}

function gridFor(count: number): number {
  return Math.min(1024, Math.max(32, Math.ceil(Math.sqrt(Math.max(count, 1)))));
}

interface FieldProps {
  source: Source;
  particleCount: number;
  particleSize: number;
  particleOpacity: number;
  speed: number;
  noiseScale: number;
  noiseStrength: number;
  damping: number;
  lifespan: number;
  cursorInteraction: boolean;
  cursorStrength: number;
  cursorRadius: number;
  additive: boolean;
  bleed: number;
  paused: boolean;
}

function ParticleField({
  source,
  particleCount,
  particleSize,
  particleOpacity,
  speed,
  noiseScale,
  noiseStrength,
  damping,
  lifespan,
  cursorInteraction,
  cursorStrength,
  cursorRadius,
  additive,
  bleed,
  paused,
}: FieldProps) {
  const { gl } = useThree();
  const grid = useMemo(() => gridFor(particleCount), [particleCount]);
  const sim = useRef<{
    scene: THREE.Scene;
    camera: THREE.Camera;
    quad: THREE.Mesh;
    seed: THREE.RawShaderMaterial;
    step: THREE.RawShaderMaterial;
    buffers: THREE.WebGLRenderTarget[];
    front: number;
    seeded: boolean;
    release: () => void;
  } | null>(null);
  const clock = useRef(0);
  const pointer = useRef({
    x: -1e5,
    y: -1e5,
    lastX: -1e5,
    lastY: -1e5,
    vx: 0,
    vy: 0,
    engaged: false,
  });
  const frame = useRef(new THREE.Vector2(1, 1));

  // Materiál se vytváří deklarativně v JSX a sahá se na něj přes ref.
  // React Compiler zakazuje mutovat hodnotu vrácenou z useMemo, a uniformy
  // se přepisují každý snímek — ref je tady jediná průchozí cesta.
  // Stejný vzorec používá landscape/particles.tsx.
  const materialRef = useRef<THREE.RawShaderMaterial>(null);

  const uniforms = useMemo(
    () => ({
      tMotion: { value: null as THREE.Texture | null },
      tLife: { value: null as THREE.Texture | null },
      uImage: { value: null as THREE.Texture | null },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uPointSize: { value: 2 },
      uOpacity: { value: 0.6 },
    }),
    [],
  );

  const geometry = useMemo(() => {
    const total = grid * grid;
    const lookup = new Float32Array(total * 3);
    for (let i = 0; i < total; i++) {
      lookup[i * 3] = ((i % grid) + 0.5) / grid;
      lookup[i * 3 + 1] = (Math.floor(i / grid) + 0.5) / grid;
    }
    const buffer = new THREE.BufferGeometry();
    buffer.setAttribute("position", new THREE.BufferAttribute(lookup, 3));
    return buffer;
  }, [grid]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  useEffect(() => {
    const context = gl.getContext();
    const dataType =
      context.getExtension("EXT_color_buffer_float") !== null
        ? THREE.FloatType
        : THREE.HalfFloatType;

    const createBuffer = () =>
      new THREE.WebGLRenderTarget(grid, grid, {
        count: 2,
        type: dataType,
        format: THREE.RGBAFormat,
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
        wrapS: THREE.ClampToEdgeWrapping,
        wrapT: THREE.ClampToEdgeWrapping,
        depthBuffer: false,
        stencilBuffer: false,
        generateMipmaps: false,
      });

    const buffers = [createBuffer(), createBuffer()];

    const seed = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: QUAD_VERT,
      fragmentShader: SEED_FRAG,
      uniforms: {
        uSpawn: { value: null },
        uResolution: { value: new THREE.Vector2(1, 1) },
        uLifespan: { value: 260 },
        uImageRect: { value: new THREE.Vector4(0, 0, 1, 1) },
      },
      depthTest: false,
      depthWrite: false,
    });

    const step = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: QUAD_VERT,
      fragmentShader: SIM_FRAG,
      uniforms: {
        tMotion: { value: null },
        tLife: { value: null },
        uSpawn: { value: null },
        uResolution: { value: new THREE.Vector2(1, 1) },
        uTime: { value: 0 },
        uNoiseScale: { value: 0.004 },
        uNoiseStrength: { value: 0.04 },
        uDamping: { value: 0.96 },
        uLifespan: { value: 260 },
        uImageRect: { value: new THREE.Vector4(0, 0, 1, 1) },
        uPointer: { value: new THREE.Vector2(-1e5, -1e5) },
        uPointerVelocity: { value: new THREE.Vector2(0, 0) },
        uPointerStrength: { value: 0 },
        uPointerFalloff: { value: 10000 },
      },
      depthTest: false,
      depthWrite: false,
    });

    const plane = new THREE.PlaneGeometry(2, 2);
    const quad = new THREE.Mesh(plane, step);
    quad.frustumCulled = false;

    const scene = new THREE.Scene();
    scene.add(quad);

    sim.current = {
      scene,
      camera: new THREE.Camera(),
      quad,
      seed,
      step,
      buffers,
      front: 0,
      seeded: false,
      release: () => {
        buffers.forEach((buffer) => buffer.dispose());
        seed.dispose();
        step.dispose();
        plane.dispose();
      },
    };

    return () => {
      sim.current?.release();
      sim.current = null;
    };
  }, [gl, grid]);

  // Nový obrázek = nový atlas, takže se pole musí zasít znovu. Jinak by
  // částice dál obíhaly podle staré siluety.
  useEffect(() => {
    if (sim.current) sim.current.seeded = false;
  }, [source]);

  // Kurzor se sleduje na WINDOW, ne na plátně — vrstva má
  // pointer-events: none a leží nad fotkou, takže by se k ní žádná
  // událost nedostala. Klientské souřadnice se pak převedou na pixely
  // kreslicího bufferu podle aktuálního boxu plátna.
  useEffect(() => {
    if (!cursorInteraction) return;

    const canvas = gl.domElement;
    const tracker = pointer.current;

    const track = (event: PointerEvent) => {
      const bounds = canvas.getBoundingClientRect();
      const ratio = gl.getPixelRatio();
      const x = (event.clientX - bounds.left) * ratio;
      const y = (event.clientY - bounds.top) * ratio;
      if (!tracker.engaged) {
        tracker.lastX = x;
        tracker.lastY = y;
        tracker.engaged = true;
      }
      tracker.x = x;
      tracker.y = y;
    };

    window.addEventListener("pointermove", track, { passive: true });
    return () => {
      window.removeEventListener("pointermove", track);
      tracker.engaged = false;
      tracker.x = -1e5;
      tracker.y = -1e5;
      tracker.vx = 0;
      tracker.vy = 0;
    };
  }, [gl, cursorInteraction]);

  useFrame((state, delta) => {
    const active = sim.current;
    if (!active) return;

    const renderer = state.gl;
    const size = renderer.getDrawingBufferSize(frame.current);
    const width = Math.max(size.x, 1);
    const height = Math.max(size.y, 1);
    const ratio = renderer.getPixelRatio();

    const step = active.step.uniforms;
    step.uSpawn.value = source.spawn;
    step.uResolution.value.set(width, height);
    step.uNoiseScale.value = noiseScale;
    step.uNoiseStrength.value = noiseStrength;
    step.uDamping.value = damping;
    step.uLifespan.value = lifespan;

    // Fotka leží uprostřed plátna, odsazená o bleed na každou stranu.
    // Rozměry jdou v pixelech kreslicího bufferu, proto krát pixelRatio.
    const inset = bleed * ratio;
    step.uImageRect.value.set(
      inset,
      inset,
      Math.max(width - inset * 2, 1),
      Math.max(height - inset * 2, 1),
    );

    const cursor = pointer.current;
    if (cursorInteraction) {
      cursor.vx += (cursor.x - cursor.lastX - cursor.vx) * 0.15;
      cursor.vy += (cursor.y - cursor.lastY - cursor.vy) * 0.15;
    } else {
      cursor.vx = 0;
      cursor.vy = 0;
    }
    cursor.lastX = cursor.x;
    cursor.lastY = cursor.y;

    step.uPointer.value.set(cursor.x, cursor.y);
    step.uPointerVelocity.value.set(cursor.vx, cursor.vy);
    step.uPointerStrength.value = cursorInteraction ? cursorStrength : 0;
    step.uPointerFalloff.value = Math.max(cursorRadius * ratio, 1) ** 2;

    if (!paused) clock.current += delta * 0.05 * speed;
    step.uTime.value = clock.current;

    if (!active.seeded) {
      active.seed.uniforms.uSpawn.value = source.spawn;
      active.seed.uniforms.uResolution.value.set(width, height);
      active.seed.uniforms.uLifespan.value = lifespan;
      active.seed.uniforms.uImageRect.value.copy(step.uImageRect.value);
      active.quad.material = active.seed;
      active.buffers.forEach((buffer) => {
        renderer.setRenderTarget(buffer);
        renderer.render(active.scene, active.camera);
      });
      renderer.setRenderTarget(null);
      active.seeded = true;
    }

    if (!paused) {
      const read = active.buffers[active.front];
      const write = active.buffers[1 - active.front];
      step.tMotion.value = read.textures[0];
      step.tLife.value = read.textures[1];
      active.quad.material = active.step;
      renderer.setRenderTarget(write);
      renderer.render(active.scene, active.camera);
      renderer.setRenderTarget(null);
      active.front = 1 - active.front;
    }

    const material = materialRef.current;
    if (!material) return;

    const current = active.buffers[active.front];
    const points = material.uniforms;
    points.tMotion.value = current.textures[0];
    points.tLife.value = current.textures[1];
    points.uImage.value = source.image;
    points.uResolution.value.set(width, height);
    points.uPointSize.value = particleSize * ratio;
    points.uOpacity.value = particleOpacity;
  });

  return (
    <points geometry={geometry} frustumCulled={false}>
      <rawShaderMaterial
        ref={materialRef}
        glslVersion={THREE.GLSL3}
        vertexShader={POINT_VERT}
        fragmentShader={POINT_FRAG}
        uniforms={uniforms}
        transparent
        depthTest={false}
        depthWrite={false}
        blending={additive ? THREE.AdditiveBlending : THREE.NormalBlending}
      />
    </points>
  );
}

export default function ParticleImage({
  src,
  targetRef,
  className,
  particleCount = 60000,
  particleSize = 1.6,
  particleOpacity = 0.55,
  additive = false,
  bleed = 72,
  alphaThreshold = 24,
  speed = 1,
  noiseScale = 0.004,
  noiseStrength = 0.05,
  damping = 0.96,
  lifespan = 160,
  cursorInteraction = true,
  cursorStrength = 0.08,
  cursorRadius = 120,
  dpr = 1.5,
  paused = false,
}: ParticleImageProps) {
  const root = useRef<HTMLDivElement | null>(null);
  const source = useImageSource(src, alphaThreshold);
  const box = useTrackedBox(targetRef);
  const inView = useInView(root);

  // Dokud není box změřený, nemá smysl nic kreslit — plátno by se
  // roztáhlo podle rodiče a silueta by sedla mimo fotku.
  const ready = box !== null && box.width > 0 && box.height > 0;

  return (
    <div
      ref={root}
      className={[styles.root, className].filter(Boolean).join(" ")}
      style={
        ready
          ? {
              left: box.left - bleed,
              top: box.top - bleed,
              width: box.width + bleed * 2,
              height: box.height + bleed * 2,
            }
          : { opacity: 0, width: 0, height: 0 }
      }
      aria-hidden="true"
    >
      {ready && (
        <Canvas
          className={styles.canvas}
          dpr={[1, Math.min(Math.max(dpr, 1), 2)]}
          frameloop={inView && !paused ? "always" : "demand"}
          gl={{
            antialias: false,
            alpha: true,
            depth: false,
            powerPreference: "high-performance",
          }}
        >
          {source && source.coverage > 0.01 && (
            <ParticleField
              source={source}
              particleCount={particleCount}
              particleSize={particleSize}
              particleOpacity={particleOpacity}
              speed={speed}
              noiseScale={noiseScale}
              noiseStrength={noiseStrength}
              damping={damping}
              lifespan={lifespan}
              cursorInteraction={cursorInteraction}
              cursorStrength={cursorStrength}
              cursorRadius={cursorRadius}
              additive={additive}
              bleed={bleed}
              paused={paused}
            />
          )}
        </Canvas>
      )}
    </div>
  );
}
