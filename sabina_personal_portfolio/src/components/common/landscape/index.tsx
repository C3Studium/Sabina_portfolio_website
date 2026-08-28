import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import ParticleField from "./particles";
import styles from "./styles.module.scss";

// Originál bral `cn` z "@/lib/utils". Ten tu není a jedinou jeho úlohou
// je slepit třídy, takže stačí tohle.
const joinClasses = (...parts: Array<string | undefined | false>) =>
  parts.filter(Boolean).join(" ");

export interface LandscapeProps {
  /** How fast the camera flies forward */
  speed?: number;
  /** How fast the terrain itself undulates while the camera stays put */
  waveSpeed?: number;
  /** Camera height above sea level */
  altitude?: number;
  /** Field of view, lower is more telephoto */
  focal?: number;
  /** Downward tilt of the camera, in radians */
  pitch?: number;
  /** Camera pan along world X. Positive shifts the view right. */
  offsetX?: number;
  /** Camera pan along world Y. Adds on top of altitude. */
  offsetY?: number;
  /** Camera pan along world Z. With a top-down pitch this shifts the view up the screen. */
  offsetZ?: number;
  /** Height of the terrain */
  elevation?: number;
  /** Size of the landforms, lower is broader */
  scale?: number;
  /** How much fine detail rides on top of the landforms */
  detail?: number;
  /** Ray marching steps, higher is cleaner and slower */
  steps?: number;
  /** Samples per pixel used to smooth the silhouette, 1 to 4 */
  samples?: number;
  /** How far the camera can see */
  distance?: number;
  /** Distance at which the terrain starts dissolving into the sky */
  fogStart?: number;
  /** Distance over which the depth gradient completes */
  rampDistance?: number;
  /** Colour of the nearest ground */
  color?: string;
  /** Colour of the middle distance */
  midColor?: string;
  /** Colour of the far ground */
  farColor?: string;
  /** Colour of the light catching the ridges */
  rimColor?: string;
  /** How tightly the rim clings to the crests */
  rimPower?: number;
  /** Brightness of the rim */
  rimStrength?: number;
  /** Colour of the scanner rings sweeping outward */
  ringColor?: string;
  /** How close together the rings are */
  ringSpacing?: number;
  /** How fast the rings travel */
  ringSpeed?: number;
  /** Thickness of each ring */
  ringWidth?: number;
  /** Brightness of the rings */
  ringStrength?: number;
  /** Overall brightness before the highlight rolloff */
  gain?: number;
  /** Film grain strength, 0 to 1 */
  grain?: number;
  /** Anchor the grain to the terrain surface instead of the screen */
  grainSurface?: boolean;
  /** How fine the surface-anchored grain is, in cells per world unit */
  grainDensity?: number;
  /** Grain refreshes per second */
  grainRate?: number;
  /** How many hover-reactive particles float over the terrain, 0 = off */
  particles?: number;
  /** Particle diameter in device pixels */
  particleSize?: number;
  /** Particle colour */
  particleColor?: string;
  /** How fast the flow field driving the particles evolves */
  particleSpeed?: number;
  /** Flow field frequency: lower means longer, smoother currents */
  particleNoiseScale?: number;
  /** Acceleration applied along the flow field each frame */
  particleNoiseStrength?: number;
  /** Velocity retained each frame: lower settles faster */
  particleDamping?: number;
  /** Frames a particle lives before it respawns */
  particleLifespan?: number;
  /** Particle alpha */
  particleOpacity?: number;
  /** Radius of the pointer influence, in CSS pixels */
  hoverRadius?: number;
  /** How much pointer momentum transfers to nearby particles */
  hoverPush?: number;
  /** How hard the scanner rings shove particles outward, 0 = off */
  ringPush?: number;
  /** How strongly the glowing ridges steer the particles, 0 = off */
  ridgeFlow?: number;
  /** Corner darkening, 0 to 1 */
  vignette?: number;
  /** Sky colour, or "transparent" to show the page through */
  backgroundColor?: string;
  /** Master alpha */
  opacity?: number;
  /** Let the pointer steer the camera */
  cursorInteraction?: boolean;
  /** How far the pointer swings the heading */
  cursorSteer?: number;
  /** Freeze the animation */
  paused?: boolean;
  /** Scale back resolution when the frame budget slips */
  adaptiveQuality?: boolean;
  /** Frame rate the quality meter aims to hold */
  targetFps?: number;
  /** Upper device pixel ratio bound */
  dpr?: number;
  className?: string;
  children?: ReactNode;
}

const landscapeVertex = `
varying vec2 vPlane;

void main() {
  vPlane = uv;
  gl_Position = vec4(position.xy * 2.0, 0.0, 1.0);
}
`;

const gridOffsets = (samples: number) => {
  if (samples <= 1) return [[0, 0]];
  if (samples === 2)
    return [
      [-0.25, 0.25],
      [0.25, -0.25],
    ];
  if (samples === 3)
    return [
      [0, -0.3],
      [-0.28, 0.18],
      [0.28, 0.18],
    ];
  return [
    [-0.375, -0.125],
    [-0.125, 0.375],
    [0.125, -0.375],
    [0.375, 0.125],
  ];
};

const buildLandscapeFragment = (steps: number, samples: number) => `
precision highp float;

varying vec2 vPlane;

uniform vec2 uCanvas;
uniform float uClock;
uniform float uSpeed;
uniform float uWaveSpeed;
uniform float uAltitude;
uniform float uFocal;
uniform float uPitch;
uniform vec2 uCamPan;
uniform float uElevation;
uniform float uScale;
uniform float uDetail;
uniform float uDistance;
uniform float uFogStart;
uniform float uRamp;
uniform vec3 uNearC;
uniform vec3 uMidC;
uniform vec3 uFarC;
uniform vec3 uRim;
uniform float uRimPower;
uniform float uRimGain;
uniform vec3 uRingC;
uniform float uRingSpacing;
uniform float uRingSpeed;
uniform float uRingWidth;
uniform float uRingGain;
uniform float uGain;
uniform float uGrain;
uniform float uGrainSurface;
uniform float uGrainDensity;
uniform float uGrainRate;
uniform float uVignette;
uniform vec3 uBackdrop;
uniform float uBackdropAlpha;
uniform float uOpacity;
uniform vec2 uSteer;

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

float terrain(vec2 p) {
  mat2 twist = mat2(0.86, 0.51, -0.51, 0.86);

  // Vlnění terénu. Každá oktáva se unáší JINÝM směrem a JINOU rychlostí —
  // kdyby jely stejně, byl by to jen posun celého pole, k nerozeznání od
  // letu kamery. Rozdílné směry teprve dělají to, že se povrch převaluje.
  float wt = uClock * uWaveSpeed;

  vec2 q = p * uScale;
  float lift = swell(q + vec2(0.0, wt)) * 1.0;
  q = twist * q * 2.64;
  lift += swell(q + vec2(-wt * 1.7, wt * 0.6)) * 0.32 * uDetail;
  q = twist * q * 2.31;
  lift += swell(q + vec2(wt * 2.3, -wt * 1.1)) * 0.08 * uDetail;
  return lift * uElevation;
}

float softClip(float x) {
  float fall = exp(-2.0 * max(x, 0.0));
  return (1.0 - fall) / (1.0 + fall);
}

vec4 trace(vec2 field) {
  float t = uClock;

  // uCamPan posouvá kameru ve světových osách X (.x) a Z (.y). Osa Y se
  // přičítá do uAltitude už v JS, aby shader nepotřeboval další uniform.
  vec3 eye =
    vec3(uSteer.x * 6.0 + uCamPan.x, uAltitude, t * uSpeed * 3.0 + uCamPan.y);

  vec3 dir = normalize(vec3(field, uFocal));

  float tilt = uPitch + uSteer.y * 0.25;
  float ct = cos(tilt);
  float st = sin(tilt);
  dir.yz = mat2(ct, -st, st, ct) * dir.yz;

  float yaw = uSteer.x * 0.35;
  float cy = cos(yaw);
  float sy = sin(yaw);
  dir.xz = mat2(cy, -sy, sy, cy) * dir.xz;

  float travelled = 0.4;
  float back = travelled;
  float landed = -1.0;
  float stride = 0.08;

  for (int i = 0; i < ${steps}; i++) {
    vec3 probe = eye + dir * travelled;
    float gap = probe.y - terrain(probe.xz);
    if (gap < 0.0) {
      landed = travelled;
      break;
    }
    back = travelled;
    travelled += max(gap * 0.55, stride);
    stride *= 1.035;
    if (travelled > uDistance) break;
  }

  if (landed <= 0.0) return vec4(0.0);

  float low = back;
  float high = landed;
  for (int j = 0; j < 6; j++) {
    float mid = 0.5 * (low + high);
    vec3 probe = eye + dir * mid;
    if (probe.y - terrain(probe.xz) < 0.0) {
      high = mid;
    } else {
      low = mid;
    }
  }

  float depth = high;
  vec3 spot = eye + dir * depth;

  float nudge = 0.0025 * max(depth, 1.0);
  float slopeX =
    terrain(spot.xz + vec2(nudge, 0.0)) - terrain(spot.xz - vec2(nudge, 0.0));
  float slopeZ =
    terrain(spot.xz + vec2(0.0, nudge)) - terrain(spot.xz - vec2(0.0, nudge));
  vec3 normal = normalize(vec3(-slopeX, 2.0 * nudge, -slopeZ));

  float ramp = clamp(depth / max(uRamp, 0.001), 0.0, 1.0);
  vec3 base = ramp < 0.5
    ? mix(uNearC, uMidC, smoothstep(0.0, 1.0, ramp * 2.0))
    : mix(uMidC, uFarC, smoothstep(0.0, 1.0, (ramp - 0.5) * 2.0));

  float facing = clamp(dot(normal, -dir), 0.0, 1.0);
  base += uRim * pow(1.0 - facing, uRimPower) * uRimGain;

  // Zrno ukotvené k POVRCHU. Vzorkuje se ve světových souřadnicích
  // dopadu paprsku a kvantuje do buněk, takže buňka drží svou hodnotu,
  // dokud na ni míří stejný kus terénu — zrno pak sedí na zemi a vlní
  // se s ní. Zrno v main() je proti tomu vázané na pixel a po povrchu
  // klouže. Mlha ho ztlumí sama, protože base se dole násobí solid.
  if (uGrainSurface > 0.5) {
    float gtick = floor(t * max(uGrainRate, 1.0));
    vec2 gcell = floor(spot.xz * max(uGrainDensity, 0.001));
    base += (shuffle(gcell + gtick * 13.0) - 0.5) * uGrain;
  }

  float wave = sin(depth * uRingSpacing - t * uRingSpeed);
  float ring = smoothstep(1.0 - max(uRingWidth, 0.001), 1.0, wave);
  base += uRingC * ring * uRingGain;

  base = vec3(
    softClip(base.r * uGain),
    softClip(base.g * uGain),
    softClip(base.b * uGain)
  );

  float haze = smoothstep(uFogStart, uDistance, depth);
  float solid = 1.0 - haze;

  return vec4(base * solid, solid);
}

void main() {
  vec2 pixel = vPlane * uCanvas;
  vec2 field = (pixel - 0.5 * uCanvas) / max(uCanvas.y, 1.0);
  float texel = 1.0 / max(uCanvas.y, 1.0);

  vec4 acc = vec4(0.0);
${gridOffsets(samples)
  .map(
    ([ox, oy]) =>
      `  acc += trace(field + vec2(${ox.toFixed(3)}, ${oy.toFixed(3)}) * texel);`,
  )
  .join("\n")}
  acc /= ${samples}.0;

  // Kolik z pixelu pokrývá terén: 0 = čistá obloha, 1 = plná zem.
  // Zrno se přimíchá jen sem. Původně jelo přes celý framebuffer
  // (na obloze na 25 %), což vypadalo jako šum přes monitor.
  float ground = acc.a;

  float rest = uBackdropAlpha * (1.0 - acc.a);
  vec3 rgb = acc.rgb + uBackdrop * rest;
  float alpha = acc.a + rest;

  float vig = smoothstep(1.4, 0.25, length(field));
  float shade = (1.0 - uVignette) + uVignette * vig;
  rgb *= shade;
  alpha *= shade;
  ground *= shade;

  float tick = floor(uClock * max(uGrainRate, 1.0));
  float speck = shuffle(pixel + tick * 17.0) - 0.5;
  float sparkle = shuffle(pixel * 1.37 + tick * 5.11) - 0.5;
  // Když jede zrno na povrchu, tohle se vypne, ať se nesčítají.
  rgb += speck * uGrain * ground * (1.0 - uGrainSurface);
  rgb += sparkle * 0.0035 * ground;
  rgb = clamp(rgb, vec3(0.0), vec3(alpha));

  gl_FragColor = vec4(rgb, alpha) * uOpacity;
}
`;

const literal = (hex: string, fallback: string) => {
  const shade = new THREE.Color();
  try {
    shade.setStyle(hex, THREE.LinearSRGBColorSpace);
  } catch {
    shade.setStyle(fallback, THREE.LinearSRGBColorSpace);
  }
  return shade;
};

const repaint = (target: THREE.Color, hex: string) => {
  try {
    target.setStyle(hex, THREE.LinearSRGBColorSpace);
  } catch {
    return;
  }
};

const clamp = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, value));

const subscribeToScreen = (notify: () => void) => {
  if (typeof window === "undefined") return () => {};
  const media = window.matchMedia("(min-resolution: 2dppx)");
  media.addEventListener("change", notify);
  window.addEventListener("resize", notify);
  return () => {
    media.removeEventListener("change", notify);
    window.removeEventListener("resize", notify);
  };
};

const readScreenDpr = () =>
  typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;

const isClear = (paint: string) =>
  paint === "transparent" || paint === "none" || paint === "";

interface PointerState {
  x: number;
  y: number;
  inside: boolean;
}

interface TerrainViewProps {
  speed: number;
  waveSpeed: number;
  altitude: number;
  focal: number;
  pitch: number;
  offsetX: number;
  offsetY: number;
  offsetZ: number;
  elevation: number;
  scale: number;
  detail: number;
  steps: number;
  samples: number;
  distance: number;
  fogStart: number;
  rampDistance: number;
  color: string;
  midColor: string;
  farColor: string;
  rimColor: string;
  rimPower: number;
  rimStrength: number;
  ringColor: string;
  ringSpacing: number;
  ringSpeed: number;
  ringWidth: number;
  ringStrength: number;
  gain: number;
  grain: number;
  grainSurface: boolean;
  grainDensity: number;
  grainRate: number;
  vignette: number;
  backgroundColor: string;
  opacity: number;
  cursorInteraction: boolean;
  cursorSteer: number;
  paused: boolean;
  adaptiveQuality: boolean;
  targetFps: number;
  ceiling: number;
  readPointer: () => PointerState;
}

const TerrainView = ({
  speed,
  waveSpeed,
  altitude,
  focal,
  pitch,
  offsetX,
  offsetY,
  offsetZ,
  elevation,
  scale,
  detail,
  steps,
  samples,
  distance,
  fogStart,
  rampDistance,
  color,
  midColor,
  farColor,
  rimColor,
  rimPower,
  rimStrength,
  ringColor,
  ringSpacing,
  ringSpeed,
  ringWidth,
  ringStrength,
  gain,
  grain,
  grainSurface,
  grainDensity,
  grainRate,
  vignette,
  backgroundColor,
  opacity,
  cursorInteraction,
  cursorSteer,
  paused,
  adaptiveQuality,
  targetFps,
  ceiling,
  readPointer,
}: TerrainViewProps) => {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const clock = useRef(0);
  const glide = useRef({ x: 0, y: 0 });
  const budget = useRef({ frames: 0, span: 0, wins: 0, cap: 4 });
  const { gl, size } = useThree();

  const marches = Math.round(clamp(steps, 24, 200));
  const taps = Math.round(clamp(samples, 1, 4));

  const fragment = useMemo(
    () => buildLandscapeFragment(marches, taps),
    [marches, taps],
  );

  const uniforms = useMemo(
    () => ({
      uCanvas: { value: new THREE.Vector2(1, 1) },
      uClock: { value: 0 },
      uSpeed: { value: 1 },
      uWaveSpeed: { value: 0 },
      uAltitude: { value: 5.5 },
      uFocal: { value: 1.2 },
      uPitch: { value: 0 },
      uCamPan: { value: new THREE.Vector2(0, 0) },
      uElevation: { value: 3.2 },
      uScale: { value: 0.15 },
      uDetail: { value: 1 },
      uDistance: { value: 42 },
      uFogStart: { value: 22 },
      uRamp: { value: 35 },
      uNearC: { value: literal("#2e1065", "#2e1065") },
      uMidC: { value: literal("#0a0a0a", "#0a0a0a") },
      uFarC: { value: literal("#d946ef", "#d946ef") },
      uRim: { value: literal("#f0abfc", "#f0abfc") },
      uRimPower: { value: 4 },
      uRimGain: { value: 1.2 },
      uRingC: { value: literal("#a855f7", "#a855f7") },
      uRingSpacing: { value: 0.5 },
      uRingSpeed: { value: 2.5 },
      uRingWidth: { value: 0.04 },
      uRingGain: { value: 0.4 },
      uGain: { value: 1 },
      uGrain: { value: 0.05 },
      uGrainSurface: { value: 0 },
      uGrainDensity: { value: 25 },
      uGrainRate: { value: 24 },
      uVignette: { value: 0.2 },
      uBackdrop: { value: literal("#0a0a0a", "#0a0a0a") },
      uBackdropAlpha: { value: 1 },
      uOpacity: { value: 1 },
      uSteer: { value: new THREE.Vector2(0, 0) },
    }),
    [],
  );

  useEffect(() => {
    const material = materialRef.current;
    if (!material) return;
    material.fragmentShader = fragment;
    material.needsUpdate = true;
  }, [fragment]);

  useEffect(() => {
    const material = materialRef.current;
    if (!material) return;
    repaint(material.uniforms.uNearC.value, color);
    repaint(material.uniforms.uMidC.value, midColor);
    repaint(material.uniforms.uFarC.value, farColor);
    repaint(material.uniforms.uRim.value, rimColor);
    repaint(material.uniforms.uRingC.value, ringColor);
    const clear = isClear(backgroundColor);
    material.uniforms.uBackdropAlpha.value = clear ? 0 : 1;
    if (!clear) repaint(material.uniforms.uBackdrop.value, backgroundColor);
  }, [color, midColor, farColor, rimColor, ringColor, backgroundColor]);

  useFrame((_, delta) => {
    const material = materialRef.current;
    if (!material) return;

    const beat = Math.min(delta, 0.05);
    if (!paused) clock.current += beat;

    const ratio = gl.getPixelRatio();
    const set = material.uniforms;
    set.uCanvas.value.set(size.width * ratio, size.height * ratio);
    set.uClock.value = clock.current;
    set.uSpeed.value = speed;
    set.uWaveSpeed.value = waveSpeed;
    set.uAltitude.value = altitude + offsetY;
    set.uCamPan.value.set(offsetX, offsetZ);
    set.uFocal.value = Math.max(focal, 0.2);
    set.uPitch.value = pitch;
    set.uElevation.value = elevation;
    set.uScale.value = scale;
    set.uDetail.value = detail;
    set.uDistance.value = Math.max(distance, 4);
    set.uFogStart.value = Math.min(fogStart, distance - 1);
    set.uRamp.value = rampDistance;
    set.uRimPower.value = rimPower;
    set.uRimGain.value = rimStrength;
    set.uRingSpacing.value = ringSpacing;
    set.uRingSpeed.value = ringSpeed;
    set.uRingWidth.value = ringWidth;
    set.uRingGain.value = ringStrength;
    set.uGain.value = gain;
    set.uGrain.value = grain;
    set.uGrainSurface.value = grainSurface ? 1 : 0;
    set.uGrainDensity.value = grainDensity;
    set.uGrainRate.value = grainRate;
    set.uVignette.value = vignette;
    set.uOpacity.value = opacity;

    const pointer = readPointer();
    const ease = 1 - Math.exp(-beat * 3);
    const reach = cursorInteraction && pointer.inside ? cursorSteer : 0;
    const aimX = (pointer.x * 2 - 1) * reach;
    const aimY = (pointer.y * 2 - 1) * reach;
    glide.current.x += (aimX - glide.current.x) * ease;
    glide.current.y += (aimY - glide.current.y) * ease;
    set.uSteer.value.set(glide.current.x, glide.current.y);

    if (!adaptiveQuality) return;
    const meter = budget.current;
    meter.frames += 1;
    meter.span += delta;
    if (meter.span < 0.75) return;
    const fps = meter.frames / meter.span;
    meter.frames = 0;
    meter.span = 0;
    const roof = Math.min(ceiling, meter.cap);
    if (fps < targetFps * 0.85 && ratio > 0.6) {
      meter.wins = 0;
      meter.cap = Math.max(0.6, ratio * 0.9);
      gl.setPixelRatio(Math.max(0.6, ratio * 0.75));
    } else if (fps > targetFps * 0.98 && ratio < roof - 0.01) {
      meter.wins += 1;
      if (meter.wins >= 3) {
        meter.wins = 0;
        gl.setPixelRatio(Math.min(roof, ratio * 1.25));
      }
    } else {
      meter.wins = 0;
    }
  });

  return (
    <mesh frustumCulled={false}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={landscapeVertex}
        fragmentShader={fragment}
        uniforms={uniforms}
        transparent
        depthTest={false}
        depthWrite={false}
        premultipliedAlpha
      />
    </mesh>
  );
};

export const Landscape = ({
  speed = 1,
  // 0 = terén stojí a hýbe se jen kamera, tedy původní chování.
  waveSpeed = 0,
  altitude = 5.5,
  focal = 1.2,
  pitch = 0,
  offsetX = 0,
  offsetY = 0,
  offsetZ = 0,
  elevation = 3.2,
  scale = 0.15,
  detail = 1,
  steps = 80,
  samples = 2,
  distance = 42,
  fogStart = 22,
  rampDistance = 35,
  color = "#2e1065",
  midColor = "#0a0a0a",
  farColor = "#d946ef",
  rimColor = "#f0abfc",
  rimPower = 4,
  rimStrength = 1.2,
  ringColor = "#a855f7",
  ringSpacing = 0.5,
  ringSpeed = 2.5,
  ringWidth = 0.04,
  ringStrength = 0.4,
  gain = 1,
  grain = 0.05,
  // 0 = žádné částice, tedy původní chování.
  particles = 0,
  particleSize = 2.6,
  particleColor = "#bec948",
  particleSpeed = 1,
  particleNoiseScale = 0.0016,
  particleNoiseStrength = 0.05,
  particleDamping = 0.96,
  particleLifespan = 260,
  particleOpacity = 0.5,
  hoverRadius = 120,
  hoverPush = 0.1,
  ringPush = 0,
  ridgeFlow = 0,
  // false = zrno na obrazovce, tedy původní chování.
  grainSurface = false,
  grainDensity = 25,
  grainRate = 24,
  vignette = 0.2,
  backgroundColor = "#0a0a0a",
  opacity = 1,
  cursorInteraction = true,
  cursorSteer = 0.5,
  paused = false,
  adaptiveQuality = true,
  targetFps = 60,
  dpr = 1.75,
  className,
  children,
}: LandscapeProps) => {
  const shell = useRef<HTMLDivElement>(null);
  const pointer = useRef<PointerState>({ x: 0.5, y: 0.5, inside: false });
  const [awake, setAwake] = useState(true);

  const screenDpr = useSyncExternalStore(
    subscribeToScreen,
    readScreenDpr,
    () => 1,
  );
  const ceiling = Math.min(screenDpr, Math.max(dpr, 0.5));

  const readPointer = useCallback(() => pointer.current, []);

  useEffect(() => {
    const node = shell.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const watcher = new IntersectionObserver(
      ([entry]) => setAwake(entry.isIntersecting),
      { threshold: 0 },
    );
    watcher.observe(node);
    return () => watcher.disconnect();
  }, []);

  useEffect(() => {
    const node = shell.current;
    if (!node || !cursorInteraction) return;

    const track = (event: PointerEvent) => {
      const box = node.getBoundingClientRect();
      if (!box.width || !box.height) return;
      pointer.current.x = clamp((event.clientX - box.left) / box.width, 0, 1);
      pointer.current.y = clamp(
        1 - (event.clientY - box.top) / box.height,
        0,
        1,
      );
      pointer.current.inside = true;
    };

    const reset = () => {
      pointer.current.inside = false;
    };

    node.addEventListener("pointermove", track);
    node.addEventListener("pointerleave", reset);
    return () => {
      node.removeEventListener("pointermove", track);
      node.removeEventListener("pointerleave", reset);
    };
  }, [cursorInteraction]);

  return (
    <div ref={shell} className={joinClasses(styles.root, className)}>
      <div className={styles.canvasLayer}>
        <Canvas
          orthographic
          dpr={ceiling}
          frameloop={awake ? "always" : "demand"}
          gl={{
            antialias: false,
            alpha: true,
            powerPreference: "high-performance",
          }}
        >
          <TerrainView
            speed={speed}
            waveSpeed={waveSpeed}
            altitude={altitude}
            focal={focal}
            pitch={pitch}
            offsetX={offsetX}
            offsetY={offsetY}
            offsetZ={offsetZ}
            elevation={elevation}
            scale={scale}
            detail={detail}
            steps={steps}
            samples={samples}
            distance={distance}
            fogStart={fogStart}
            rampDistance={rampDistance}
            color={color}
            midColor={midColor}
            farColor={farColor}
            rimColor={rimColor}
            rimPower={rimPower}
            rimStrength={rimStrength}
            ringColor={ringColor}
            ringSpacing={ringSpacing}
            ringSpeed={ringSpeed}
            ringWidth={ringWidth}
            ringStrength={ringStrength}
            gain={gain}
            grain={grain}
            grainSurface={grainSurface}
            grainDensity={grainDensity}
            grainRate={grainRate}
            vignette={vignette}
            backgroundColor={backgroundColor}
            opacity={opacity}
            cursorInteraction={cursorInteraction}
            cursorSteer={cursorSteer}
            paused={paused}
            adaptiveQuality={adaptiveQuality}
            targetFps={targetFps}
            ceiling={ceiling}
            readPointer={readPointer}
          />
          <ParticleField
            count={particles}
            size={particleSize}
            color={particleColor}
            opacity={particleOpacity}
            speed={particleSpeed}
            noiseScale={particleNoiseScale}
            noiseStrength={particleNoiseStrength}
            damping={particleDamping}
            lifespan={particleLifespan}
            cursorRadius={hoverRadius}
            cursorStrength={hoverPush}
            ringSpacing={ringSpacing}
            ringSpeed={ringSpeed}
            ringWidth={ringWidth}
            ringPush={ringPush}
            ridgeFlow={ridgeFlow}
            altitude={altitude + offsetY}
            focal={focal}
            pitch={pitch}
            camPanX={offsetX}
            camPanZ={offsetZ}
            terrainScale={scale}
            terrainElevation={elevation}
            terrainDetail={detail}
            waveSpeed={waveSpeed}
            paused={paused}
          />
        </Canvas>
      </div>
      {children ? <div className={styles.content}>{children}</div> : null}
    </div>
  );
};

export default Landscape;
