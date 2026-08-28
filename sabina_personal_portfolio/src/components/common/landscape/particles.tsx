import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

// GPGPU pole částic. Stav (pozice, rychlost, věk) žije ve dvou float
// texturách, které se každý snímek prohazují — díky tomu unese stovky
// tisíc částic. Pohyb řídí flow field ze simplex šumu, kurzor do něj
// vráží svou rychlostí.
//
// Oproti obrázkové předloze tu není žádná textura ani pozadí: vrstva leží
// nad terénem a musí zůstat průhledná.

const HASH = `
vec3 hash33(vec3 p) {
  p = fract(p * vec3(0.1031, 0.11369, 0.13787));
  p += dot(p, p.yxz + 19.19);
  return -1.0 + 2.0 * fract(vec3(
    (p.x + p.y) * p.z,
    (p.x + p.z) * p.y,
    (p.y + p.z) * p.x
  ));
}
`;

const NOISE = `
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

  vec4 falloff = max(0.6 - vec4(dot(d0, d0), dot(d1, d1), dot(d2, d2), dot(d3, d3)), 0.0);
  vec4 weights = falloff * falloff * falloff * falloff * vec4(
    dot(d0, hash33(cell)),
    dot(d1, hash33(cell + o1)),
    dot(d2, hash33(cell + o2)),
    dot(d3, hash33(cell + 1.0))
  );

  return dot(vec4(31.316), weights);
}
`;

// Stejná výšková funkce jako v terénním shaderu — bez ní by se částice
// vlnily podle něčeho jiného, než co je vidět. shuffle je jiný hash než
// hash33 výš, ale musí sedět přesně, jinak hřebeny nesouhlasí.
const TERRAIN = `
float shuffle(vec2 seed) {
  vec3 drift = fract(vec3(seed.xyx) * vec3(0.1031, 0.1030, 0.0973));
  drift += dot(drift, drift.yzx + 33.33);
  return fract((drift.x + drift.y) * drift.z);
}

float swell(vec2 p) {
  vec2 base = floor(p);
  vec2 slide = fract(p);
  slide = slide * slide * (3.0 - 2.0 * slide);
  float a = shuffle(base);
  float b = shuffle(base + vec2(1.0, 0.0));
  float c = shuffle(base + vec2(0.0, 1.0));
  float d = shuffle(base + vec2(1.0, 1.0));
  return mix(mix(a, b, slide.x), mix(c, d, slide.x), slide.y);
}

float terrainHeight(vec2 p) {
  mat2 twist = mat2(0.86, 0.51, -0.51, 0.86);
  float wt = uTerrainTime * uWaveSpeed;
  vec2 q = p * uTerrScale;
  float lift = swell(q + vec2(0.0, wt)) * 1.0;
  q = twist * q * 2.64;
  lift += swell(q + vec2(-wt * 1.7, wt * 0.6)) * 0.32 * uTerrDetail;
  q = twist * q * 2.31;
  lift += swell(q + vec2(wt * 2.3, -wt * 1.1)) * 0.08 * uTerrDetail;
  return lift * uTerrElevation;
}

// Pixel -> světová pozice na zemi. Paprsek se otočí stejně jako v terénu
// a protne rovinu y = 0.
vec2 screenToWorld(vec2 pos) {
  vec2 field = vec2(pos.x - 0.5 * uResolution.x,
                    0.5 * uResolution.y - pos.y) / max(uResolution.y, 1.0);
  vec3 dir = normalize(vec3(field, uFocal));
  float ct = cos(uPitch);
  float st = sin(uPitch);
  vec2 yz = vec2(ct * dir.y + st * dir.z, -st * dir.y + ct * dir.z);
  float down = min(yz.x, -0.001);
  float travel = -uAltitude / down;
  // Kamera se může posunout ve světě (uCamPan), takže se výsledek vrací
  // v ABSOLUTNÍCH souřadnicích. Jinak by proudění po hřebenech zůstalo
  // viset na místě, zatímco terén pod ním odjede stranou.
  return uCamPan + vec2(dir.x, yz.y) * travel;
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

const SEED_FRAG = `precision highp float;

uniform vec2 uResolution;
uniform float uLifespan;

in vec2 vUv;

layout(location = 0) out vec4 outMotion;
layout(location = 1) out vec4 outLife;

${HASH}

void main() {
  vec3 birth = hash33(vec3(vUv * 512.0, 1.0));
  vec3 jitter = hash33(vec3(vUv * 91.7, 7.3));

  vec2 origin = fract(birth.xy * 0.5 + 0.5);
  float span = uLifespan * (0.25 + 0.75 * fract(jitter.z * 0.5 + 0.5));

  // Věk se rozhodí po celé délce života, jinak by celé pole zmizelo
  // a naráz se znovu objevilo.
  outMotion = vec4(origin * uResolution, jitter.xy * 0.25);
  outLife = vec4(fract(birth.z * 0.5 + 0.5) * span, span, birth.xy);
}`;

const SIM_FRAG = `precision highp float;

uniform sampler2D tMotion;
uniform sampler2D tLife;
uniform vec2 uResolution;
uniform vec2 uPointer;
uniform vec2 uPointerVelocity;
uniform float uTime;
uniform float uNoiseScale;
uniform float uNoiseStrength;
uniform float uDamping;
uniform float uLifespan;
uniform float uPointerStrength;
uniform float uPointerFalloff;
uniform float uRingSpacing;
uniform float uRingSpeed;
uniform float uRingWidth;
uniform float uRingPush;
uniform float uAltitude;
uniform float uFocal;
uniform float uPitch;
uniform vec2 uCamPan;
uniform float uTerrainTime;
uniform float uTerrScale;
uniform float uTerrElevation;
uniform float uTerrDetail;
uniform float uWaveSpeed;
uniform float uRidgeFlow;

in vec2 vUv;

layout(location = 0) out vec4 outMotion;
layout(location = 1) out vec4 outLife;

${HASH}
${NOISE}
${TERRAIN}

void main() {
  vec4 motion = texture(tMotion, vUv);
  vec4 life = texture(tLife, vUv);

  vec2 pos = motion.xy;
  vec2 vel = motion.zw;
  float age = life.x + 1.0;
  float span = life.y;
  vec2 seed = life.zw;

  // Flow field: šum dá úhel, ten se převede na zrychlení.
  float angle = flowNoise(vec3(pos * uNoiseScale, uTime * 20.0 + age * 0.05)) * 6.2831853;
  vec2 flow = vec2(cos(angle), sin(angle)) * uNoiseStrength;

  // Kurzor předává částicím svou rychlost, ne jen odpuzuje.
  vec2 offset = pos - uPointer;
  float proximity = uPointerFalloff / (dot(offset, offset) + uPointerFalloff);
  vec2 wake = uPointerVelocity * proximity * uPointerStrength;

  // Prstence z terénního shaderu jsou funkcí VZDÁLENOSTI paprsku, ne
  // pozice na obrazovce. Pro kameru mířící dolů se ale vzdálenost dá
  // z pixelu dopočítat: depth = výška / cos(úhlu od svislice), a ten
  // úhel plyne z odchylky pixelu od středu dělené ohniskovou.
  // Prstenec pak částice odstrčí od středu, jak se přes ně přelévá.
  vec2 field = (pos - 0.5 * uResolution) / max(uResolution.y, 1.0);
  float depth = uAltitude * sqrt(1.0 + dot(field, field) / max(uFocal * uFocal, 0.0001));
  // Síla je DERIVACE vlny, ne její vrchol. Kdyby se tlačilo jen ven,
  // prstenec by fungoval jako trvalý vítr a za pár sekund by vymetl
  // střed obrazu — což přesně dělal. Takhle částice před hřebenem
  // vystrčí a za ním stáhne zpátky, takže se jen zavlní a nikam neodplují.
  float phase = depth * uRingSpacing - uTime * 20.0 * uRingSpeed;
  vec2 outward = normalize(field + vec2(1e-5));
  vec2 ringForce = outward * cos(phase) * uRingPush;

  // Výboj na hřebenech: rim se v terénu chytá na SVAZÍCH, takže svítí
  // tam, kde je velký gradient výšky. Ten se tu spočítá dopřednými
  // diferencemi a částice pak tečou PODÉL hřebene (kolmo na gradient),
  // s mírným tahem nahoru k jeho vrcholu. Sílu škáluje strmost, takže
  // v plochých místech se neděje nic.
  vec2 ridgeForce = vec2(0.0);
  if (uRidgeFlow > 0.0001) {
    vec2 world = screenToWorld(pos);
    float e = 0.35;
    float h0 = terrainHeight(world);
    float hx = terrainHeight(world + vec2(e, 0.0));
    float hy = terrainHeight(world + vec2(0.0, e));
    vec2 grad = vec2(hx - h0, hy - h0) / e;
    float steep = clamp(length(grad) * 2.0, 0.0, 1.0);
    vec2 along = normalize(vec2(-grad.y, grad.x) + vec2(1e-5));
    vec2 uphill = normalize(grad + vec2(1e-5));
    ridgeForce = (along * 0.8 + uphill * 0.2) * steep * uRidgeFlow;
  }

  vel = vel * uDamping + flow + wake + ringForce + ridgeForce;
  pos += vel;

  bool spent = age >= span
    || pos.x < 0.0 || pos.x > uResolution.x
    || pos.y < 0.0 || pos.y > uResolution.y;

  if (spent) {
    vec3 rebirth = hash33(vec3(seed, uTime + age));
    float nextSpan = uLifespan * (0.25 + 0.75 * fract(rebirth.z * 0.5 + 0.5));
    outMotion = vec4(fract(rebirth.xy * 0.5 + 0.5) * uResolution, 0.0, 0.0);
    outLife = vec4(0.0, nextSpan, rebirth.xy);
  } else {
    outMotion = vec4(pos, vel);
    outLife = vec4(age, span, seed);
  }
}`;

const POINT_VERT = `precision highp float;

in vec3 position;

uniform sampler2D tMotion;
uniform sampler2D tLife;
uniform vec2 uResolution;
uniform float uPointSize;
uniform float uOpacity;

out float vAlpha;

void main() {
  vec4 motion = texture(tMotion, position.xy);
  vec4 life = texture(tLife, position.xy);

  // Náběh i doběh, ať se částice nezjevují a nemizí skokem.
  float ratio = life.x / max(life.y, 1.0);
  float fade = smoothstep(0.0, 0.06, ratio) * (1.0 - smoothstep(0.8, 1.0, ratio));
  vAlpha = fade * uOpacity;

  vec2 ndc = motion.xy / uResolution * 2.0 - 1.0;
  gl_Position = vec4(ndc.x, -ndc.y, 0.0, 1.0);
  gl_PointSize = uPointSize * fade;
}`;

const POINT_FRAG = `precision highp float;

uniform vec3 uColor;

in float vAlpha;

out vec4 fragColor;

void main() {
  float mask = 1.0 - smoothstep(0.25, 0.5, length(gl_PointCoord - 0.5));
  fragColor = vec4(uColor, vAlpha * mask);
}`;

const OFFSCREEN = -100000;

// Simulace jede na čtvercové mřížce, takže počet se zaokrouhlí nahoru na
// druhou mocninu. 1024 x 1024 je strop, tedy zhruba milion částic.
function gridFor(count: number) {
  return Math.min(1024, Math.max(32, Math.ceil(Math.sqrt(Math.max(count, 1)))));
}

interface Simulation {
  scene: THREE.Scene;
  camera: THREE.Camera;
  quad: THREE.Mesh;
  seedMaterial: THREE.RawShaderMaterial;
  stepMaterial: THREE.RawShaderMaterial;
  buffers: THREE.WebGLRenderTarget[];
  front: number;
  seeded: boolean;
  release: () => void;
}

export interface ParticleFieldProps {
  count: number;
  size: number;
  color: string;
  opacity: number;
  speed: number;
  noiseScale: number;
  noiseStrength: number;
  damping: number;
  lifespan: number;
  cursorStrength: number;
  cursorRadius: number;
  ridgeFlow: number;
  ringSpacing: number;
  ringSpeed: number;
  ringWidth: number;
  ringPush: number;
  altitude: number;
  focal: number;
  pitch: number;
  camPanX: number;
  camPanZ: number;
  terrainScale: number;
  terrainElevation: number;
  terrainDetail: number;
  waveSpeed: number;
  paused: boolean;
}

export default function ParticleField({
  count,
  size,
  color,
  opacity,
  speed,
  noiseScale,
  noiseStrength,
  damping,
  lifespan,
  cursorStrength,
  cursorRadius,
  ridgeFlow,
  ringSpacing,
  ringSpeed,
  ringWidth,
  ringPush,
  altitude,
  focal,
  pitch,
  camPanX,
  camPanZ,
  terrainScale,
  terrainElevation,
  terrainDetail,
  waveSpeed,
  paused,
}: ParticleFieldProps) {
  const { gl } = useThree();
  const grid = useMemo(() => gridFor(count), [count]);
  const simulation = useRef<Simulation | null>(null);
  const clock = useRef(0);
  // Druhé hodiny pro terén. Vlastní clock je škálovaný přes speed, kdežto
  // terénní shader přičítá přímo min(delta, 0.05) — kdyby se použily ty
  // samé, hřebeny by se rozešly s tím, co je vidět.
  const terrainClock = useRef(0);
  const frame = useRef(new THREE.Vector2(1, 1));
  const pointer = useRef({
    x: OFFSCREEN,
    y: OFFSCREEN,
    lastX: OFFSCREEN,
    lastY: OFFSCREEN,
    vx: 0,
    vy: 0,
    engaged: false,
  });

  // Materiál drží ref na JSX elementu, ne useMemo. React Compiler má
  // zapnuté pravidlo neměnnosti a hodnotu vrácenou z hooku mutovat nelze;
  // přes ref to projde a je to i vzorec, který používá zbytek projektu.
  const materialRef = useRef<THREE.RawShaderMaterial>(null);

  const uniforms = useMemo(
    () => ({
      tMotion: { value: null },
      tLife: { value: null },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uPointSize: { value: 2 },
      uOpacity: { value: 0.5 },
      uColor: { value: new THREE.Color("#c8c8c0") },
    }),
    [],
  );

  useEffect(() => {
    const material = materialRef.current;
    if (!material) return;
    try {
      material.uniforms.uColor.value.setStyle(color, THREE.LinearSRGBColorSpace);
    } catch {
      return;
    }
  }, [color]);

  // Mřížka odkazů: každý bod si nese svou souřadnici ve stavové textuře.
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
    // Bez float render targetů by se stav neudržel; half float stačí.
    const floatCapable = context.getExtension("EXT_color_buffer_float") !== null;
    const dataType = floatCapable ? THREE.FloatType : THREE.HalfFloatType;

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

    const seedMaterial = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: QUAD_VERT,
      fragmentShader: SEED_FRAG,
      uniforms: {
        uResolution: { value: new THREE.Vector2(1, 1) },
        uLifespan: { value: 400 },
      },
      depthTest: false,
      depthWrite: false,
    });

    const stepMaterial = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: QUAD_VERT,
      fragmentShader: SIM_FRAG,
      uniforms: {
        tMotion: { value: null },
        tLife: { value: null },
        uResolution: { value: new THREE.Vector2(1, 1) },
        uPointer: { value: new THREE.Vector2(OFFSCREEN, OFFSCREEN) },
        uPointerVelocity: { value: new THREE.Vector2(0, 0) },
        uTime: { value: 0 },
        uNoiseScale: { value: 0.004 },
        uNoiseStrength: { value: 0.04 },
        uDamping: { value: 0.98 },
        uLifespan: { value: 400 },
        uPointerStrength: { value: 0.08 },
        uPointerFalloff: { value: 1000 },
        uRingSpacing: { value: 0.5 },
        uRingSpeed: { value: 1 },
        uRingWidth: { value: 0.2 },
        uRingPush: { value: 0 },
        uAltitude: { value: 12.5 },
        uFocal: { value: 0.5 },
        uPitch: { value: 0 },
        uCamPan: { value: new THREE.Vector2(0, 0) },
        uTerrainTime: { value: 0 },
        uTerrScale: { value: 0.1 },
        uTerrElevation: { value: 4 },
        uTerrDetail: { value: 2 },
        uWaveSpeed: { value: 0 },
        uRidgeFlow: { value: 0 },
      },
      depthTest: false,
      depthWrite: false,
    });

    const plane = new THREE.PlaneGeometry(2, 2);
    const quad = new THREE.Mesh(plane, stepMaterial);
    quad.frustumCulled = false;

    const scene = new THREE.Scene();
    scene.add(quad);

    simulation.current = {
      scene,
      camera: new THREE.Camera(),
      quad,
      seedMaterial,
      stepMaterial,
      buffers,
      front: 0,
      seeded: false,
      release: () => {
        buffers.forEach((buffer) => buffer.dispose());
        seedMaterial.dispose();
        stepMaterial.dispose();
        plane.dispose();
      },
    };

    return () => {
      simulation.current?.release();
      simulation.current = null;
    };
  }, [gl, grid]);

  // Vrstva má pointer-events: none a leží pod obsahem, takže se k ní
  // žádná událost nedostane — kurzor se proto sleduje na window a
  // přepočítává do pixelů kreslicího bufferu.
  useEffect(() => {
    const track = (event: PointerEvent) => {
      const ratio = gl.getPixelRatio();
      const x = event.clientX * ratio;
      const y = event.clientY * ratio;
      const p = pointer.current;
      if (!p.engaged) {
        p.lastX = x;
        p.lastY = y;
        p.engaged = true;
      }
      p.x = x;
      p.y = y;
    };

    const release = () => {
      const p = pointer.current;
      p.engaged = false;
      p.x = OFFSCREEN;
      p.y = OFFSCREEN;
      p.lastX = OFFSCREEN;
      p.lastY = OFFSCREEN;
      p.vx = 0;
      p.vy = 0;
    };

    window.addEventListener("pointermove", track, { passive: true });
    document.addEventListener("pointerleave", release);
    return () => {
      window.removeEventListener("pointermove", track);
      document.removeEventListener("pointerleave", release);
    };
  }, [gl]);

  useFrame((state, delta) => {
    const sim = simulation.current;
    if (!sim) return;

    const renderer = state.gl;
    const buffer = renderer.getDrawingBufferSize(frame.current);
    const width = Math.max(buffer.x, 1);
    const height = Math.max(buffer.y, 1);
    const ratio = renderer.getPixelRatio();

    const p = pointer.current;
    if (cursorStrength > 0) {
      p.vx += (p.x - p.lastX - p.vx) * 0.15;
      p.vy += (p.y - p.lastY - p.vy) * 0.15;
    } else {
      p.vx = 0;
      p.vy = 0;
    }
    p.lastX = p.x;
    p.lastY = p.y;

    const step = sim.stepMaterial.uniforms;
    step.uResolution.value.set(width, height);
    step.uNoiseScale.value = noiseScale;
    step.uNoiseStrength.value = noiseStrength;
    step.uDamping.value = damping;
    step.uLifespan.value = lifespan;
    step.uPointerStrength.value = cursorStrength;
    step.uPointerFalloff.value = Math.max(cursorRadius * ratio, 1) ** 2;
    step.uPointer.value.set(p.x, p.y);
    step.uPointerVelocity.value.set(p.vx, p.vy);
    // Stejné hodnoty jako terénní shader, ať prstence sedí na sobě.
    step.uRingSpacing.value = ringSpacing;
    step.uRingSpeed.value = ringSpeed;
    step.uRingWidth.value = ringWidth;
    step.uRingPush.value = ringPush;
    step.uAltitude.value = altitude;
    step.uFocal.value = Math.max(focal, 0.2);

    if (!paused) {
      clock.current += delta * 0.05 * speed;
      terrainClock.current += Math.min(delta, 0.05);
    }
    step.uTime.value = clock.current;
    step.uTerrainTime.value = terrainClock.current;
    step.uPitch.value = pitch;
    step.uCamPan.value.set(camPanX, camPanZ);
    step.uTerrScale.value = terrainScale;
    step.uTerrElevation.value = terrainElevation;
    step.uTerrDetail.value = terrainDetail;
    step.uWaveSpeed.value = waveSpeed;
    step.uRidgeFlow.value = ridgeFlow;

    // První snímek: obě textury se naplní výchozím stavem.
    if (!sim.seeded) {
      sim.seedMaterial.uniforms.uResolution.value.set(width, height);
      sim.seedMaterial.uniforms.uLifespan.value = lifespan;
      sim.quad.material = sim.seedMaterial;
      sim.buffers.forEach((target) => {
        renderer.setRenderTarget(target);
        renderer.render(sim.scene, sim.camera);
      });
      renderer.setRenderTarget(null);
      sim.seeded = true;
    }

    if (!paused) {
      const read = sim.buffers[sim.front];
      const write = sim.buffers[1 - sim.front];
      step.tMotion.value = read.textures[0];
      step.tLife.value = read.textures[1];
      sim.quad.material = sim.stepMaterial;
      renderer.setRenderTarget(write);
      renderer.render(sim.scene, sim.camera);
      // Zpátky na plátno, jinak by se přes něj kreslil i terén.
      renderer.setRenderTarget(null);
      sim.front = 1 - sim.front;
    }

    const material = materialRef.current;
    if (!material) return;

    const current = sim.buffers[sim.front];
    const points = material.uniforms;
    points.tMotion.value = current.textures[0];
    points.tLife.value = current.textures[1];
    points.uResolution.value.set(width, height);
    points.uPointSize.value = size * ratio;
    points.uOpacity.value = opacity;
  });

  if (count <= 0) return null;

  return (
    <points geometry={geometry} frustumCulled={false} renderOrder={1}>
      <rawShaderMaterial
        ref={materialRef}
        glslVersion={THREE.GLSL3}
        vertexShader={POINT_VERT}
        fragmentShader={POINT_FRAG}
        uniforms={uniforms}
        transparent
        depthTest={false}
        depthWrite={false}
      />
    </points>
  );
}
