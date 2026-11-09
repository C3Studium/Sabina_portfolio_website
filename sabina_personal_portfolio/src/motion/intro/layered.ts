// Banner rozložený na vrstvy — přehrávání. Rozklad dělá offline nástroj
// tools/banner-layers (text, objekty, tvary, pozadí → mapa + JSON vedle
// bannerů v public/assets/banners/layers). Tady se banner STAVÍ jako
// v grafickém editoru, vrstva po vrstvě v pořadí stavby:
//
//   5–31 %   skica: zelené linky (jen výrazné hrany + obrysy vrstev) se
//            kreslí podle postupu uvnitř vrstvy (text v pořadí čtení,
//            objekty shora a zezadu, pozadí od dálky, tvary od středu);
//            kolem vrstvy rámeček s popiskem jako v panelu vrstev
//   18–38 %  výplň: skutečné barvy vrstvy se klidně prolnou ve stejném
//            pořadí, linka pod nimi zmizí — žádné efekty navíc; v 38 % je
//            všechno hotové
//   87,5–100 % totéž pozpátku, poslední vrstva odchází první
//
// Mapa (PNG, RGBA): R = index vrstvy, G = postup 0–255, B = síla linky.
// Kreslí WebGL2 do vlastního plátna; banners.ts ho přenese na své 2D
// plátno (drawImage) a přes něj dokreslí rámečky.

import { clamp01, frame, label, linear, stage, type Box, type Look, type Span } from "./draw";

export type LayerInfo = {
  kind: "background" | "shape" | "object" | "text";
  label: string;
  /** Box v rozsahu 0–1 vůči banneru: x, y, šířka, výška. */
  box: [number, number, number, number];
  color: [number, number, number];
  area: number;
};

export type LayersData = {
  version: number;
  source: string;
  width: number;
  height: number;
  /** Šířka / výška originálu. */
  aspect: number;
  layers: LayerInfo[];
};

/* ---------- Nastavení ---------- */

const SETTINGS = {
  // Části života banneru (0–1).
  // Stavba i odchod 1,6× rychleji než první verze (skica 0,08–0,5,
  // výplň do 0,6, odchod 0,8–1): hotovo do ~38 %, odchod v posledních 12 %.
  sketch: [0.05, 0.31] as Span,
  /** Délka skici jedné vrstvy. */
  sketchLength: 0.1,
  fill: [0.18, 0.38] as Span,
  /** Délka výplně jedné vrstvy. */
  fillLength: 0.1,
  out: [0.875, 1] as Span,
  // Měkkost čela odhalení (v jednotkách postupu) a šum proti pruhům.
  soft: 0.22,
  dither: 0.04,
  // Které hrany se kreslí: síla linky z mapy pod/nad těmito mezemi (0–1).
  // Slabé hrany (textura fotky) by kreslily šum — zůstanou jen výrazné.
  edge: [0.42, 0.78] as [number, number],
  lineAlpha: 0.9,
  // Linka skici pod hotovou vrstvou: kolik jí zbude.
  lineRest: 0,
  // Štítky vrstev: nejmenší plocha a nejvíc kolik.
  tagMinArea: 0.006,
  tagMax: 7,
};

const MAX_LAYERS = 32;

/* ---------- Data ---------- */

/** Kde leží rozklad k banneru (jen bannery z public/assets/banners). */
export const layersFor = (src: string) => {
  const match = src.match(/^\/assets\/banners\/([\w.-]+)\.(?:png|jpe?g|webp)$/i);
  return match ? { json: `/assets/banners/layers/${match[1]}.json`, map: `/assets/banners/layers/${match[1]}.png` } : null;
};

const loadImage = (url: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });

/** Rozklad banneru, nebo `null`, když k němu není. */
export async function loadLayers(src: string) {
  const urls = layersFor(src);
  if (!urls) return null;
  try {
    const response = await fetch(urls.json);
    if (!response.ok) return null;
    const data = (await response.json()) as LayersData;
    const map = await loadImage(urls.map);
    return { data, map };
  } catch {
    return null;
  }
}

/* ---------- Shader ---------- */

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
uniform sampler2D uMap;
uniform vec4 uState[${MAX_LAYERS}];
uniform vec3 uAccent;
uniform float uSoft;
uniform float uDither;
uniform float uLineRest;
uniform float uLineAlpha;
uniform vec2 uEdge;
in vec2 vUv;
out vec4 outColor;

// Interleaved gradient noise — rozbije pruhy na čele odhalení.
float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
// Pixel s postupem p je při čase t odhalený (měkce, šířka w).
float reveal(float t, float p, float w) { return clamp((t * (1.0 + w) - p) / w, 0.0, 1.0); }

void main() {
  vec4 m = texture(uMap, vUv);
  int layer = min(int(m.r * 255.0 + 0.5), ${MAX_LAYERS - 1});
  vec4 s = uState[layer];
  float p = clamp(m.g + (ign(gl_FragCoord.xy) - 0.5) * uDither, 0.0, 1.0);

  float line = reveal(s.x, p, uSoft * 0.5) * smoothstep(uEdge.x, uEdge.y, m.b);
  float fill = reveal(s.y, p, uSoft);

  vec3 image = texture(uImage, vUv).rgb;
  vec4 base = vec4(image * fill, fill);

  // Zelená linka skici: plná, dokud vrstva není vyplněná, pak zmizí.
  float lineA = line * uLineAlpha * mix(1.0, uLineRest, fill);
  outColor = base * (1.0 - lineA) + vec4(uAccent * lineA, lineA);
}`;

const compile = (gl: WebGL2RenderingContext, type: number, source: string) => {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.warn("[layered]", gl.getShaderInfoLog(shader));
    return null;
  }
  return shader;
};

const hex = (color: string): [number, number, number] => {
  const m = color.match(/#([0-9a-f]{6})/i);
  if (m) return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16) / 255) as [number, number, number];
  const rgb = color.match(/[\d.]+/g)?.map(Number) ?? [255, 255, 255];
  return [rgb[0] / 255, rgb[1] / 255, rgb[2] / 255];
};

/* ---------- Časování vrstev ---------- */

type LayerTimes = { sketch: Span; fill: Span; fillOut: Span; sketchOut: Span };

const timesFor = (count: number): LayerTimes[] =>
  Array.from({ length: count }, (_, i) => {
    const k = count > 1 ? i / (count - 1) : 0;
    const back = 1 - k; // pozpátku: poslední vrstva odchází první
    const sketchStart = SETTINGS.sketch[0] + (SETTINGS.sketch[1] - SETTINGS.sketch[0] - SETTINGS.sketchLength) * k;
    const fillStart = SETTINGS.fill[0] + (SETTINGS.fill[1] - SETTINGS.fill[0] - SETTINGS.fillLength) * k;
    const outSpan = SETTINGS.out[1] - SETTINGS.out[0];
    const outStart = SETTINGS.out[0] + outSpan * 0.4 * back;
    return {
      sketch: [sketchStart, sketchStart + SETTINGS.sketchLength],
      fill: [fillStart, fillStart + SETTINGS.fillLength],
      fillOut: [outStart, outStart + outSpan * 0.3],
      sketchOut: [outStart + outSpan * 0.2, outStart + outSpan * 0.55],
    };
  });

/* ---------- Přehrávač ---------- */

export type Layered = {
  aspect: number;
  /** Počet vrstev (do popisku banneru). */
  count: number;
  /** Nakreslí banner do `box` v životní fázi `u` (0–1). */
  draw(ctx: CanvasRenderingContext2D, box: Box, u: number, dpr: number, alpha: number): void;
  destroy(): void;
};

export function createLayered(image: HTMLImageElement, map: HTMLImageElement, data: LayersData, look: Look): Layered | null {
  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl2", { premultipliedAlpha: true, alpha: true, preserveDrawingBuffer: true, antialias: false });
  if (!gl) return null;
  const vs = compile(gl, gl.VERTEX_SHADER, VERTEX);
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
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

  const texture = (unit: number, source: TexImageSource, nearest: boolean, raw: boolean) => {
    const tex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    // Mapa jsou data, ne obrázek: bez správy barev a přednásobení.
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, raw ? gl.NONE : gl.BROWSER_DEFAULT_WEBGL);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    const filter = nearest ? gl.NEAREST : gl.LINEAR;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return tex;
  };
  const imageTex = texture(0, image, false, false);
  const mapTex = texture(1, map, true, true);
  gl.uniform1i(gl.getUniformLocation(program, "uImage"), 0);
  gl.uniform1i(gl.getUniformLocation(program, "uMap"), 1);

  const layers = data.layers.slice(0, MAX_LAYERS);
  gl.uniform3fv(gl.getUniformLocation(program, "uAccent"), hex(look.accent));
  gl.uniform1f(gl.getUniformLocation(program, "uSoft"), SETTINGS.soft);
  gl.uniform1f(gl.getUniformLocation(program, "uDither"), SETTINGS.dither);
  gl.uniform1f(gl.getUniformLocation(program, "uLineRest"), SETTINGS.lineRest);
  gl.uniform1f(gl.getUniformLocation(program, "uLineAlpha"), SETTINGS.lineAlpha);
  gl.uniform2fv(gl.getUniformLocation(program, "uEdge"), SETTINGS.edge);
  const stateLoc = gl.getUniformLocation(program, "uState");
  const state = new Float32Array(MAX_LAYERS * 4);
  const times = timesFor(layers.length);

  // Štítky jen u vrstev, které stojí za řeč — text a větší objekty/tvary.
  const tagged = layers
    .map((layer, i) => ({ layer, i }))
    .filter(({ layer }) => layer.kind !== "background" && (layer.kind === "text" || layer.area >= SETTINGS.tagMinArea))
    .sort((a, b) => b.layer.area - a.layer.area)
    .slice(0, SETTINGS.tagMax);
  const tagText = (layer: LayerInfo) => {
    const lang = document.documentElement.lang || undefined;
    const text = layer.label.length > 22 ? `${layer.label.slice(0, 21)}…` : layer.label;
    if (layer.kind === "text") return `T · ${text}`;
    return text.toLocaleUpperCase(lang);
  };

  const render = (u: number, width: number, height: number) => {
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    layers.forEach((layer, i) => {
      const tm = times[i];
      state[i * 4] = stage(u, tm.sketch) * (1 - stage(u, tm.sketchOut));
      state[i * 4 + 1] = stage(u, tm.fill) * (1 - stage(u, tm.fillOut));
    });
    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform4fv(stateLoc, state);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };

  return {
    aspect: data.aspect,
    count: layers.length,
    draw: (ctx, box, u, dpr, alpha) => {
      if (u <= 0 || u >= 1) return;
      render(u, Math.max(1, Math.round(box.w * dpr)), Math.max(1, Math.round(box.h * dpr)));
      ctx.globalAlpha = alpha;
      ctx.drawImage(canvas, box.x, box.y, box.w, box.h);
      ctx.globalAlpha = 1;

      // Rámečky vrstev s popiskem — při skice a znovu při odchodu.
      for (const { layer, i } of tagged) {
        const tm = times[i];
        const shown = Math.max(
          stage(u, tm.sketch) * (1 - stage(u, [tm.fill[1], tm.fill[1] + 0.06])),
          stage(u, tm.fillOut) * (1 - stage(u, tm.sketchOut)),
        );
        if (shown <= 0.01) continue;
        const [x, y, w, h] = layer.box;
        const b = { x: box.x + x * box.w, y: box.y + y * box.h, w: w * box.w, h: h * box.h };
        frame(ctx, b, clamp01(linear(u, tm.sketch) * 1.6), shown * 0.6, { mark: look.accent, accent: look.accent }, 1.4);
        label(ctx, tagText(layer), b.x, b.y - 3, shown * 0.85, look.accent, 7, "bottom");
      }
    },
    destroy: () => {
      gl.deleteTexture(imageTex);
      gl.deleteTexture(mapTex);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    },
  };
}
