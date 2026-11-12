// DepthRibbon — glyfy při posunu.
//
// Slova a tvary ze sazby, jak je kreslí úvod u bannerů na úvodní stránce
// (motion/intro/banners.ts): slovo v rámečku s rozměrem (obrys → plné),
// kruh s poloměrem, čtverec a trojúhelník s vodítky k vrcholům, křivka pera
// s úchyty. Každý glyf je připojený tečkovanou vynášecí linkou ke kartě.
//
// Glyfy žijí ve 3D (světové souřadnice u dráhy), takže jedou se scénou
// a mají hloubku, ale kreslí se 2D na vlastní plátno NAD kartami — jako
// další vrstva. Rodí se při posunu, nakreslí se, chvíli vydrží a zhasnou.

import * as THREE from "three";
import { SHAPES, WORDS } from "@/motion/intro/banners";
import { ACCENT, SNOW_RGB } from "@/lib/palette";

const MARK = `rgba(${SNOW_RGB}, 0.9)`;

/** Kolik glyfů smí žít najednou. */
const MAX_ALIVE = 20;
/** Životnost v s a jak dlouho trvá nakreslení / zhasnutí. */
const LIFE = 3.2;
const DRAW_IN = 0.8;
const FADE_OUT = 0.9;

// Slova a tvary z úvodu u bannerů + pár dalších grafických detailů (graf,
// vzorník barev, mřížka, kóta, proklad).
const EXTRA = ["chart", "grid", "dims", "kerning"] as const;
// Smlouvy s klienty nedovolí ukazovat barvy (HEX), písma ani postup —
// glyfy jsou jen obecné pojmy ze sazby, bez konkrétních hodnot.
const PUBLIC_WORDS = WORDS.filter((word) => !word.startsWith("#"));
type Kind = "word" | (typeof SHAPES)[number] | (typeof EXTRA)[number];

interface Glyph {
  kind: Kind;
  text: string;
  weight: number;
  /** Velikost ve světových jednotkách (výška písma / průměr tvaru). */
  size: number;
  pos: THREE.Vector3;
  drift: THREE.Vector3;
  age: number;
  card: number;
  /** 1 = nad řadou, -1 = pod ní (kam vede vynášecí linka). */
  side: number;
  turn: number;
}

/** Bod na obrazovce (px vůči plátnu) a kolik px je jedna světová jednotka. */
export type Projected = { x: number; y: number; scale: number; depth: number };

export interface GlyphFrame {
  dt: number;
  dpr: number;
  width: number;
  height: number;
  project: (point: THREE.Vector3) => Projected | null;
  /** Kotva vynášecí linky na kartě (hrana blíž glyfu), nebo null. */
  anchor: (card: number, side: number, x: number) => [number, number] | null;
  /** Mlha podle hloubky (0–1). */
  fog: (depth: number) => number;
}

export interface GlyphLayer {
  spawn: (pos: THREE.Vector3, drift: THREE.Vector3, card: number, side: number) => void;
  /** Vrací true, dokud nějaký glyf žije. */
  draw: (frame: GlyphFrame) => boolean;
  clear: () => void;
  destroy: () => void;
}

const clamp01 = (v: number) => Math.min(Math.max(v, 0), 1);
const easeOut = (v: number) => 1 - Math.pow(1 - clamp01(v), 3);
const pick = <T,>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)];

export function createGlyphLayer(host: HTMLElement, before: Element | null): GlyphLayer {
  const canvas = host.ownerDocument.createElement("canvas");
  canvas.style.cssText = "position:absolute;z-index:2;inset:0;width:100%;height:100%;pointer-events:none";
  host.insertBefore(canvas, before);
  const ctx = canvas.getContext("2d");
  const font = getComputedStyle(host).fontFamily || "sans-serif";
  const glyphs: Glyph[] = [];
  let drawn = false;

  const spawn: GlyphLayer["spawn"] = (pos, drift, card, side) => {
    if (glyphs.length >= MAX_ALIVE) return;
    const roll = Math.random();
    const word = roll < 0.34;
    glyphs.push({
      kind: word ? "word" : roll < 0.62 ? pick(SHAPES) : pick(EXTRA),
      text: pick(PUBLIC_WORDS),
      weight: pick([300, 400, 600]),
      size: word ? 0.055 + Math.random() * 0.05 : 0.18 + Math.random() * 0.16,
      pos: pos.clone(),
      drift: drift.clone(),
      age: 0,
      card,
      side,
      turn: Math.random() * Math.PI,
    });
  };

  // Tečka (vyplněná).
  const dot = (x: number, y: number, r: number) => {
    if (!ctx) return;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  };

  // Lomená čára nakreslená do `p` své délky.
  const path = (pts: [number, number][], p: number) => {
    if (!ctx) return;
    const lens = pts.slice(1).map((q, i) => Math.hypot(q[0] - pts[i][0], q[1] - pts[i][1]));
    let left = lens.reduce((a, b) => a + b, 0) * p;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length && left > 0; i++) {
      const u = Math.min(1, left / lens[i - 1]);
      ctx.lineTo(pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * u, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * u);
      left -= lens[i - 1];
    }
    ctx.stroke();
  };

  const label = (text: string, x: number, y: number, alpha: number, size = 8) => {
    if (!ctx || alpha <= 0.01) return;
    ctx.font = `500 ${size}px ${font}`;
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    ctx.fillStyle = MARK;
    ctx.globalAlpha = alpha;
    if ("letterSpacing" in ctx) ctx.letterSpacing = "1px";
    ctx.fillText(text, x, y);
    if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
  };

  // Jeden glyf v bodě (cx, cy), velikost `px` v pixelech. Vrací box pro linku.
  const drawGlyph = (g: Glyph, cx: number, cy: number, px: number, p: number, a: number) => {
    if (!ctx) return { x: cx, y: cy, w: 0, h: 0 };
    ctx.lineWidth = 1;
    ctx.strokeStyle = MARK;
    ctx.fillStyle = ACCENT;
    if (g.kind === "word") {
      const size = Math.max(9, px);
      ctx.font = `${g.weight} ${size}px ${font}`;
      const w = ctx.measureText(g.text).width;
      const x = cx - w / 2;
      const base = cy + size * 0.35;
      // Rámeček s rohovými tečkami — dokreslí se po obvodu.
      const box = { x: x - 5, y: cy - size * 0.7 - 4, w: w + 10, h: size * 1.15 + 8 };
      ctx.globalAlpha = 0.5 * a;
      ctx.setLineDash([3, 3]);
      path(
        [
          [box.x, box.y],
          [box.x + box.w, box.y],
          [box.x + box.w, box.y + box.h],
          [box.x, box.y + box.h],
          [box.x, box.y],
        ],
        easeOut(p * 1.4),
      );
      ctx.setLineDash([]);
      ctx.globalAlpha = a * clamp01(p * 2);
      [
        [box.x, box.y],
        [box.x + box.w, box.y],
        [box.x + box.w, box.y + box.h],
        [box.x, box.y + box.h],
      ].forEach(([qx, qy]) => dot(qx, qy, 1.6));
      // Písmo: tečkovaný obrys odkrývaný zleva, pak plné.
      const outline = clamp01((p - 0.2) / 0.5);
      const solid = clamp01((p - 0.55) / 0.35);
      ctx.textBaseline = "alphabetic";
      ctx.textAlign = "left";
      if (outline > 0 && solid < 1) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(x - 2, box.y, (w + 4) * easeOut(outline), box.h);
        ctx.clip();
        ctx.globalAlpha = 0.8 * a * (1 - solid);
        ctx.setLineDash([1, 1.6]);
        ctx.lineWidth = 0.8;
        ctx.strokeText(g.text, x, base);
        ctx.setLineDash([]);
        ctx.restore();
      }
      const accent = g.text.startsWith("#");
      ctx.globalAlpha = 0.9 * a * solid;
      ctx.fillStyle = accent ? ACCENT : MARK;
      ctx.fillText(g.text, x, base);
      return box;
    }
    const r = Math.max(8, px / 2);
    ctx.globalAlpha = a;
    if (g.kind === "circle") {
      ctx.beginPath();
      ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * easeOut(p));
      ctx.stroke();
      ctx.setLineDash([2, 3]);
      ctx.globalAlpha = 0.5 * a * p;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + r * p, cy);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = a * p;
      dot(cx, cy, 1.6);
      label(`R ${Math.round(r)}`, cx + 4, cy - 12, 0.9 * a * p, 7);
    } else if (g.kind === "square" || g.kind === "triangle") {
      const n = g.kind === "square" ? 4 : 3;
      const turn = g.kind === "square" ? Math.PI / 4 + g.turn : 0;
      const pts: [number, number][] = [];
      for (let i = 0; i <= n; i++) {
        const ang = turn - Math.PI / 2 + (i / n) * Math.PI * 2;
        pts.push([cx + Math.cos(ang) * r, cy + Math.sin(ang) * r]);
      }
      path(pts, easeOut(p));
      pts.slice(0, Math.min(n, Math.floor(p * n) + 1)).forEach(([qx, qy]) => dot(qx, qy, 1.8));
      // Těžiště a vodítka k vrcholům.
      ctx.setLineDash([1, 3]);
      ctx.globalAlpha = 0.35 * a * p;
      ctx.beginPath();
      pts.slice(0, n).forEach(([qx, qy]) => {
        ctx.moveTo(cx, cy);
        ctx.lineTo(qx, qy);
      });
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (g.kind === "chart") {
      // Sloupcový graf: osy, sloupce rostou postupně, popisek pod osou.
      const w = r * 2.2;
      const h = r * 1.4;
      const x0 = cx - w / 2;
      const y0 = cy + h / 2;
      path(
        [
          [x0, y0 - h],
          [x0, y0],
          [x0 + w, y0],
        ],
        easeOut(p * 1.5),
      );
      const bars = [0.45, 0.7, 0.55, 0.9, 0.75];
      const bw = (w / bars.length) * 0.5;
      bars.forEach((v, i) => {
        const grow = easeOut((p - 0.2 - i * 0.08) / 0.4);
        if (grow <= 0) return;
        const bx = x0 + (w / bars.length) * (i + 0.25);
        ctx.globalAlpha = a * (i === 3 ? 0.9 : 0.45);
        ctx.fillStyle = i === 3 ? ACCENT : MARK;
        ctx.fillRect(bx, y0 - h * v * grow, bw, h * v * grow);
      });
      ctx.fillStyle = ACCENT;
      label("HIERARCHIE", x0, y0 + 4, 0.8 * a * p, 7);
      return { x: x0, y: y0 - h, w, h };
    } else if (g.kind === "grid") {
      // Mřížka 3 × 3 (třetiny) s průsečíky.
      const s = r * 1.8;
      const x0 = cx - s / 2;
      const y0 = cy - s / 2;
      ctx.globalAlpha = 0.6 * a;
      ctx.strokeRect(x0, y0, s * easeOut(p * 1.4), s * easeOut(p * 1.4));
      ctx.setLineDash([2, 3]);
      for (let i = 1; i < 3; i++) {
        const t = clamp01((p - 0.3) / 0.5);
        path([[x0 + (s * i) / 3, y0], [x0 + (s * i) / 3, y0 + s]], t);
        path([[x0, y0 + (s * i) / 3], [x0 + s, y0 + (s * i) / 3]], t);
      }
      ctx.setLineDash([]);
      ctx.globalAlpha = a * clamp01((p - 0.6) / 0.3);
      for (let i = 1; i < 3; i++) for (let j = 1; j < 3; j++) dot(x0 + (s * i) / 3, y0 + (s * j) / 3, 1.8);
      label("MŘÍŽKA 3 × 3", x0, y0 + s + 4, 0.8 * a * p, 7);
      return { x: x0, y: y0, w: s, h: s };
    } else if (g.kind === "dims") {
      // Kóta: vodorovná čára se zarážkami a rozměrem.
      const w = r * 2.6 * easeOut(p);
      const x0 = cx - r * 1.3;
      path([[x0, cy], [x0 + w, cy]], 1);
      path([[x0, cy - 5], [x0, cy + 5]], 1);
      if (p > 0.95) path([[x0 + w, cy - 5], [x0 + w, cy + 5]], 1);
      dot(x0, cy, 1.6);
      label(`${g.weight * 3} PX`, cx - 12, cy - 13, 0.9 * a * p, 7);
      return { x: x0, y: cy - 6, w: r * 2.6, h: 12 };
    } else if (g.kind === "kerning") {
      // Proklad: dvojice písmen a závorka s hodnotou mezi nimi.
      const size = Math.max(12, r * 1.3);
      ctx.font = `300 ${size}px ${font}`;
      ctx.textBaseline = "alphabetic";
      ctx.textAlign = "left";
      const gap = size * 0.12 * (1 - easeOut(p));
      const aw = ctx.measureText("A").width;
      const x = cx - aw;
      ctx.globalAlpha = 0.9 * a;
      ctx.fillStyle = MARK;
      ctx.fillText("A", x - gap, cy + size * 0.35);
      ctx.fillText("V", x + aw * 0.82 + gap, cy + size * 0.35);
      ctx.globalAlpha = a * p;
      ctx.setLineDash([1, 2]);
      path([[cx, cy - size * 0.55], [cx, cy + size * 0.5]], p);
      ctx.setLineDash([]);
      ctx.fillStyle = ACCENT;
      label("KERNING", x - gap, cy + size * 0.5 + 4, 0.8 * a * p, 7);
      return { x: x - gap, y: cy - size * 0.55, w: aw * 2 + gap * 2, h: size * 1.05 };
    } else {
      // Pero: křivka s úchyty jako v editoru.
      const bx = cx - r;
      const by = cy - r * 0.6;
      const bw = r * 2;
      const bh = r * 1.2;
      const p0: [number, number] = [bx, by + bh * 0.75];
      const p3: [number, number] = [bx + bw, by + bh * 0.25];
      const c1: [number, number] = [bx + bw * 0.45, by + bh * 1.05];
      const c2: [number, number] = [bx + bw * 0.55, by - bh * 0.05];
      const pts: [number, number][] = [];
      for (let i = 0; i <= 32; i++) {
        const u = i / 32;
        const v = 1 - u;
        pts.push([
          v * v * v * p0[0] + 3 * v * v * u * c1[0] + 3 * v * u * u * c2[0] + u * u * u * p3[0],
          v * v * v * p0[1] + 3 * v * v * u * c1[1] + 3 * v * u * u * c2[1] + u * u * u * p3[1],
        ]);
      }
      path(pts, easeOut(p));
      ctx.globalAlpha = 0.5 * a * p;
      ctx.beginPath();
      ctx.moveTo(p0[0], p0[1]);
      ctx.lineTo(c1[0], c1[1]);
      ctx.moveTo(p3[0], p3[1]);
      ctx.lineTo(c2[0], c2[1]);
      ctx.stroke();
      ctx.globalAlpha = a;
      ctx.strokeRect(c1[0] - 2, c1[1] - 2, 4, 4);
      ctx.strokeRect(c2[0] - 2, c2[1] - 2, 4, 4);
      dot(p0[0], p0[1], 2);
      if (p > 0.98) dot(p3[0], p3[1], 2);
    }
    return { x: cx - r, y: cy - r, w: r * 2, h: r * 2 };
  };

  // Odchod glyfu: drobky (tečky a křížky jako u rámečků MeasureText)
  // rozprsknou od středu ven a zhasnou; `out` 0 → 1.
  const scatter = (cx: number, cy: number, px: number, out: number, seed: number) => {
    if (!ctx) return;
    const reach = Math.max(18, px * 0.9) * (0.4 + easeOut(out) * 1.4);
    ctx.lineWidth = 1;
    for (let i = 0; i < 9; i++) {
      const ang = seed * 7 + (i / 9) * Math.PI * 2 + Math.sin(seed + i) * 0.4;
      const dist = reach * (0.6 + ((i * 37) % 10) / 25);
      const x = cx + Math.cos(ang) * dist;
      const y = cy + Math.sin(ang) * dist;
      const alpha = (1 - out) * (0.45 + (i % 3) * 0.2);
      ctx.globalAlpha = alpha;
      if (i % 3 === 0) {
        ctx.strokeStyle = MARK;
        const arm = 3 * (1 - out * 0.5);
        ctx.beginPath();
        ctx.moveTo(x - arm, y);
        ctx.lineTo(x + arm, y);
        ctx.moveTo(x, y - arm);
        ctx.lineTo(x, y + arm);
        ctx.stroke();
      } else {
        ctx.fillStyle = i % 3 === 1 ? ACCENT : MARK;
        dot(x, y, 1.6 * (1 - out * 0.6));
      }
    }
    ctx.globalAlpha = 1;
  };

  const draw: GlyphLayer["draw"] = (frame) => {
    if (!ctx) return false;
    const pw = Math.max(1, Math.round(frame.width * frame.dpr));
    const ph = Math.max(1, Math.round(frame.height * frame.dpr));
    if (canvas.width !== pw || canvas.height !== ph) {
      canvas.width = pw;
      canvas.height = ph;
    } else if (!glyphs.length && !drawn) {
      return false;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, pw, ph);
    ctx.setTransform(frame.dpr, 0, 0, frame.dpr, 0, 0);
    drawn = glyphs.length > 0;

    for (let i = glyphs.length - 1; i >= 0; i--) {
      const g = glyphs[i];
      g.age += frame.dt;
      const leaving = clamp01((g.age - (LIFE - FADE_OUT)) / FADE_OUT);
      g.pos.addScaledVector(g.drift, frame.dt * (1 + leaving * 8));
      if (g.age >= LIFE) {
        glyphs.splice(i, 1);
        continue;
      }
      const at = frame.project(g.pos);
      if (!at) continue;
      // Odchod: tahy se stáhnou zpátky (kresba pozpátku), glyf odletí a kolem
      // se rozprsknou drobky — ne jen zhasnutí.
      const out = clamp01((g.age - (LIFE - FADE_OUT)) / FADE_OUT);
      const p = easeOut(g.age / DRAW_IN) * (1 - out * out * (3 - 2 * out));
      const fade = clamp01(g.age / 0.2) * (1 - Math.pow(out, 3));
      const a = fade * frame.fog(at.depth);
      if (a <= 0.01) continue;
      const box = drawGlyph(g, at.x, at.y, g.size * at.scale, p, a);
      if (out > 0) scatter(at.x, at.y, g.size * at.scale, out, g.turn);

      // Vynášecí linka od karty ke glyfu, s tečkami na koncích.
      const anchor = frame.anchor(g.card, g.side, at.x);
      if (anchor) {
        const ex = Math.min(Math.max(anchor[0], box.x), box.x + box.w);
        const ey = g.side > 0 ? box.y + box.h + 3 : box.y - 3;
        const lead = clamp01(g.age / 0.45);
        ctx.strokeStyle = MARK;
        ctx.globalAlpha = 0.6 * a;
        ctx.setLineDash([1, 3]);
        ctx.beginPath();
        ctx.moveTo(anchor[0], anchor[1]);
        ctx.lineTo(anchor[0] + (ex - anchor[0]) * lead, anchor[1] + (ey - anchor[1]) * lead);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = ACCENT;
        ctx.globalAlpha = a;
        dot(anchor[0], anchor[1], 1.8);
        if (lead > 0.98) dot(ex, ey, 1.4);
      }
    }
    ctx.globalAlpha = 1;
    return glyphs.length > 0;
  };

  return {
    spawn,
    draw,
    clear: () => {
      glyphs.length = 0;
    },
    destroy: () => {
      glyphs.length = 0;
      canvas.remove();
    },
  };
}
