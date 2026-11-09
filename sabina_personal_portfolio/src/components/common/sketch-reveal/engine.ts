// SketchReveal — engine. Zjednodušená stavba obrázku po vzoru bannerů
// v úvodu (src/motion/intro/layered.ts), ale bez rozkladu offline: jedna
// vrstva a všechno se počítá v shaderu za běhu z obrázku samého.
//
//   linky   obrys siluety (hrana průhlednosti) + výrazné hrany uvnitř
//           (Sobel na jasu); slabé hrany (textura, vlasy) se nekreslí
//   postup  zvlášť pro skicu a výplň: shora dolů, zdola nahoru, nebo
//           od středu ven; s jemným šumem proti pruhům
//   t 0–1   skica (zelené linky) → výplň (skutečné barvy se prolnou,
//           linka pod nimi zmizí); zpátky (1 → 0) totéž pozpátku
//
// Obrázek musí být ze stejného původu (WebGL čte pixely).

export type SketchOrigin = "down" | "up" | "center";

export type SketchSettings = {
  /** Barva linek. */
  accent: string;
  /** Části t (0–1): kdy se kreslí skica a kdy výplň. */
  sketch: [number, number];
  fill: [number, number];
  /** Měkkost čela odhalení (v jednotkách postupu). */
  soft: number;
  /** Šum proti pruhům na čele. */
  dither: number;
  /** Které hrany jasu se kreslí (síla Sobelu: od–do). */
  edge: [number, number];
  /** Hrana siluety (změna průhlednosti: od–do). */
  silhouette: [number, number];
  lineAlpha: number;
  /** Odkud se kreslí skica a odkud výplň: "down" = shora, "up" = zdola,
   *  "center" = od středu (`center`) ven. */
  sketchFrom: SketchOrigin;
  fillFrom: SketchOrigin;
  /** Střed pro "center" (0–1 v obrázku) a dosah: 1 = nejvzdálenější roh,
   *  méně = výplň dojde k okraji postavy dřív (rohy bývají průhledné). */
  center: [number, number];
  reach: number;
  /** Strop rozlišení plátna. */
  maxDpr: number;
};

const VERTEX = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = vec2(aPos.x * 0.5 + 0.5, 0.5 - aPos.y * 0.5);
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FRAGMENT = `#version 300 es
precision highp float;
uniform sampler2D uImage;
uniform vec2 uTexel;
uniform float uSketch;
uniform float uFill;
uniform float uSoft;
uniform float uDither;
uniform float uLineAlpha;
uniform float uSketchFrom;
uniform float uFillFrom;
uniform vec2 uCenter;
uniform float uAspect;
uniform float uReach;
uniform vec2 uEdge;
uniform vec2 uSilhouette;
uniform vec3 uAccent;
in vec2 vUv;
out vec4 outColor;

float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
float reveal(float t, float p, float w) { return clamp((t * (1.0 + w) - p) / w, 0.0, 1.0); }
// Postup pixelu podle počátku: 0 = shora, 1 = zdola, 2 = od středu ven.
float progressFrom(float origin) {
  if (origin < 0.5) return vUv.y;
  if (origin < 1.5) return 1.0 - vUv.y;
  return length((vUv - uCenter) * vec2(uAspect, 1.0)) / uReach;
}
// Textura je přednásobená: jas i průhlednost jdou rovnou z jednoho vzorku.
vec2 la(vec2 uv) {
  vec4 c = texture(uImage, uv);
  return vec2(dot(c.rgb, vec3(0.2126, 0.7152, 0.0722)), c.a);
}

void main() {
  vec4 color = texture(uImage, vUv);
  vec2 dx = vec2(uTexel.x, 0.0);
  vec2 dy = vec2(0.0, uTexel.y);
  vec2 tl = la(vUv - dx - dy), tc = la(vUv - dy), tr = la(vUv + dx - dy);
  vec2 ml = la(vUv - dx), mr = la(vUv + dx);
  vec2 bl = la(vUv - dx + dy), bc = la(vUv + dy), br = la(vUv + dx + dy);
  vec2 gx = (tr + 2.0 * mr + br) - (tl + 2.0 * ml + bl);
  vec2 gy = (bl + 2.0 * bc + br) - (tl + 2.0 * tc + tr);
  float inner = smoothstep(uEdge.x, uEdge.y, length(vec2(gx.x, gy.x)));
  float outline = smoothstep(uSilhouette.x, uSilhouette.y, length(vec2(gx.y, gy.y)));
  float line = max(inner, outline);

  float noise = (ign(gl_FragCoord.xy) - 0.5) * uDither;
  float sketch = reveal(uSketch, clamp(progressFrom(uSketchFrom) + noise, 0.0, 1.0), uSoft * 0.5);
  float fill = reveal(uFill, clamp(progressFrom(uFillFrom) + noise, 0.0, 1.0), uSoft);

  vec4 base = color * fill;
  float lineA = line * sketch * (1.0 - fill) * uLineAlpha;
  outColor = base * (1.0 - lineA) + vec4(uAccent * lineA, lineA);
}`;

const hex = (color: string): [number, number, number] => {
  const m = color.match(/#([0-9a-f]{6})/i);
  return m ? ([0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16) / 255) as [number, number, number]) : [1, 1, 1];
};

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const part = (t: number, [a, b]: [number, number]) => ease(clamp01((t - a) / (b - a)));

/** Kolik výplně je při průběhu `t` vidět (0–1, po křivce). */
export const fillAt = (t: number, settings: SketchSettings) => part(t, settings.fill);

export type Sketch = {
  /** Nakreslí stav `t` (0 = nic, 1 = hotový obrázek). */
  render(t: number): void;
  /** Přeměří plátno podle jeho CSS velikosti. */
  resize(): void;
  destroy(): void;
};

export function createSketch(canvas: HTMLCanvasElement, image: HTMLImageElement, settings: SketchSettings): Sketch | null {
  const gl = canvas.getContext("webgl2", { premultipliedAlpha: true, alpha: true, antialias: false });
  if (!gl) return null;
  const shader = (type: number, source: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, source);
    gl.compileShader(s);
    return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
  };
  const vs = shader(gl.VERTEX_SHADER, VERTEX);
  const fs = shader(gl.FRAGMENT_SHADER, FRAGMENT);
  if (!vs || !fs) return null;
  const program = gl.createProgram()!;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  gl.useProgram(program);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(program, "aPos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const texture = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  const at = (name: string) => gl.getUniformLocation(program, name);
  gl.uniform1i(at("uImage"), 0);
  gl.uniform1f(at("uSoft"), settings.soft);
  gl.uniform1f(at("uDither"), settings.dither);
  gl.uniform1f(at("uLineAlpha"), settings.lineAlpha);
  const origin = (from: SketchOrigin) => (from === "down" ? 0 : from === "up" ? 1 : 2);
  gl.uniform1f(at("uSketchFrom"), origin(settings.sketchFrom));
  gl.uniform1f(at("uFillFrom"), origin(settings.fillFrom));
  gl.uniform2fv(at("uCenter"), settings.center);
  gl.uniform2fv(at("uEdge"), settings.edge);
  gl.uniform2fv(at("uSilhouette"), settings.silhouette);
  gl.uniform3fv(at("uAccent"), hex(settings.accent));
  const uTexel = at("uTexel");
  const uAspect = at("uAspect");
  const uReach = at("uReach");
  const uSketch = at("uSketch");
  const uFill = at("uFill");

  let last = 0;
  const render = (t: number) => {
    last = t;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (t <= 0) return;
    gl.uniform1f(uSketch, part(t, settings.sketch));
    gl.uniform1f(uFill, part(t, settings.fill));
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, settings.maxDpr);
    const width = Math.max(1, Math.round(canvas.clientWidth * dpr));
    const height = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    // Hrany po jednom pixelu plátna, ať je obrázek jakkoli velký.
    gl.uniform2f(uTexel, 1 / width, 1 / height);
    // Vzdálenost od středu v poměru stran; nejvzdálenější roh = 1.
    const aspect = width / height;
    const [cx, cy] = settings.center;
    const reach = Math.max(
      ...[
        [0, 0],
        [1, 0],
        [0, 1],
        [1, 1],
      ].map(([x, y]) => Math.hypot((x - cx) * aspect, y - cy)),
    );
    gl.uniform1f(uAspect, aspect);
    gl.uniform1f(uReach, reach * settings.reach);
    render(last);
  };
  resize();

  return {
    render,
    resize,
    destroy: () => {
      gl.deleteTexture(texture);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    },
  };
}
