// FlexCarousel — textová vrstva karty kreslená DO SCÉNY.
//
// Každá karta má vlastní 2D plátno (→ textura → obdélník přes kartu, před
// čočkou, takže se ohýbá s kartou). Na něm je VŽDY: tmavý přechod zespodu,
// název projektu, obor a výzva (text + šipka) — text nezávisí na hoveru.
//
// Hover animuje JEN výzvu, stejně jako odkazy v hlavičce (MeasureText
// „nav"): kolem ní se dokreslí čárkovaný rámeček, naskočí rohové tečky,
// drobky, obíhající tečky a popisek s rozměrem, text zezelená.
//
// Souřadnice: plátno pokrývá kartu + MARGIN na každou stranu, v CSS px
// (kontext je škálovaný na dpr). Kreslí se v ZÁKLADNÍ velikosti karty —
// zmáčknutí při rychlém pohybu jen roztáhne texturu, nepřekresluje.

import type { FlexItem } from "./engine";
import { ACCENT, SNOW, SNOW_RGB } from "@/lib/palette";

/** Okraj plátna kolem karty v px — místo pro rámeček výzvy a drobky. */
// Rámeček karty (odsazení 10 px) + drobky až ~18 px ven + popisek nad ním.
export const MARGIN = 40;
/** Odsazení rámečku karty od karty v px. */
const CARD_PAD = 10;
const MARK = `rgba(${SNOW_RGB}, 0.9)`;

// Stejný hash jako v MeasureText — drobky náhodné, ale stálé.
const noise = (...values: number[]) => {
  let h = 2166136261;
  for (const value of values) {
    h = Math.imul(h ^ (value | 0), 16777619);
    h ^= h >>> 13;
    h = Math.imul(h, 0x5bd1e995);
    h ^= h >>> 15;
  }
  return (h >>> 0) / 4294967296;
};

const clamp01 = (v: number) => Math.min(Math.max(v, 0), 1);
const easeOut = (v: number) => 1 - Math.pow(1 - clamp01(v), 3);

const mix = (a: number[], b: number[], t: number) =>
  `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(",")})`;

export interface CardLayerDraw {
  item: FlexItem;
  index: number;
  /** Základní rozměr karty v px. */
  cw: number;
  ch: number;
  /** 0–1: hover karty (řídí jen výzvu). */
  focus: number;
  /** Skutečný rozměr obrázku — popisek rámečku karty. */
  natural: [number, number];
  /** Sekundy od začátku hoveru (dokreslení rámečků). */
  since: number;
  /** Globální čas v s (drobky, obíhající tečky). */
  time: number;
  dpr: number;
  font: string;
}

type Frame = { x1: number; y1: number; x2: number; y2: number };

const clamp = (lo: number, v: number, hi: number) => Math.min(hi, Math.max(lo, v));

// Písmo karty podle její šířky. Na šířku (telefon, tablet, notebook) v poměru
// karty, jak vychází na monitoru (karta 496px → 38 / 21 / 15,5px) — vysoké
// dolní meze dřív nechávaly text na notebooku skoro monitorový. Na výšku
// původní meze, tam jde o čitelnost na telefonu.
function cardType(cw: number) {
  const md = window.matchMedia("(orientation: landscape)").matches;
  if (md) {
    return {
      // Dolní meze platí jen u úzké karty (telefon na šířku) — na notebooku
      // je poměr nad nimi.
      pad: clamp(10, cw * 0.0685, 34),
      titleSize: clamp(12, cw * 0.0766, 38),
      textSize: clamp(9, cw * 0.0423, 21),
      ctaSize: clamp(7.5, cw * 0.03125, 15.5),
    };
  }
  return {
    pad: clamp(20, cw * 0.085, 34),
    titleSize: clamp(25, cw * 0.11, 38),
    textSize: clamp(16, cw * 0.06, 21),
    ctaSize: clamp(13, cw * 0.043, 15.5),
  };
}

export function drawCardLayer(canvas: HTMLCanvasElement, d: CardLayerDraw) {
  const W = d.cw + MARGIN * 2;
  const H = d.ch + MARGIN * 2;
  const pw = Math.max(2, Math.ceil(W * d.dpr));
  const ph = Math.max(2, Math.ceil(H * d.dpr));
  if (canvas.width !== pw || canvas.height !== ph) {
    canvas.width = pw;
    canvas.height = ph;
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(d.dpr, 0, 0, d.dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);

  /* ---------- Text karty (vždy) ---------- */
  const gh = Math.min(d.ch * 0.5, 300);
  const grad = ctx.createLinearGradient(0, MARGIN + d.ch - gh, 0, MARGIN + d.ch);
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(1, "rgba(0,0,0,0.72)");
  ctx.fillStyle = grad;
  ctx.fillRect(MARGIN, MARGIN + d.ch - gh, d.cw, gh);

  const { pad, titleSize, textSize, ctaSize } = cardType(d.cw);
  const left = MARGIN + pad;
  let base = MARGIN + d.ch - pad;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.globalAlpha = 1;

  // Výzva (odspodu nahoru: výzva, obor, název).
  if (d.item.href) {
    const label = (d.item.cta ?? "Zjistit víc").toUpperCase();
    const hover = d.focus;
    const ink = mix([255, 255, 255], [190, 201, 72], hover);
    ctx.font = `600 ${ctaSize}px ${d.font}`;
    if ("letterSpacing" in ctx) ctx.letterSpacing = `${ctaSize * 0.16}px`;
    const tw = ctx.measureText(label).width;
    ctx.fillStyle = ink;
    ctx.fillText(label, left, base);
    if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";

    // Šipka; při hoveru o kus popojede jako u odkazů.
    const arrow = 14;
    const gap = 12;
    const ax = left + tw + gap + arrow / 2 + hover * 3;
    const ay = base - ctaSize * 0.36;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1.6;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(ax - 7, ay);
    ctx.lineTo(ax + 7, ay);
    ctx.moveTo(ax + 2, ay - 5);
    ctx.lineTo(ax + 7, ay);
    ctx.lineTo(ax + 2, ay + 5);
    ctx.stroke();
    ctx.lineCap = "butt";

    // Box výzvy jako box odkazu v hlavičce: text + šipka s odsazením.
    const frame: Frame = {
      x1: left - 10,
      y1: base - ctaSize - 9,
      x2: left + tw + gap + arrow + 10,
      y2: base + 7,
    };
    if (hover > 0.001) {
      drawMeasureFrame(ctx, d, frame, hover, {
        scale: 0.6,
        seed: d.index + 101,
        label: `${Math.round(frame.x2 - frame.x1)} × ${Math.round(frame.y2 - frame.y1)} PX`,
        labelSize: 9,
        // Rámeček výzvy se dokreslí až po rámečku karty.
        delay: 0.18,
      });
    }
    // Místo nad rámečkem pro popisek s rozměrem.
    base = frame.y1 - 24;
  }
  if (d.item.subtitle) {
    ctx.font = `400 ${textSize}px ${d.font}`;
    ctx.fillStyle = SNOW;
    ctx.fillText(d.item.subtitle, left, base);
    base -= textSize * 1.75;
  }
  if (d.item.title) {
    ctx.font = `600 ${titleSize}px ${d.font}`;
    ctx.fillStyle = SNOW;
    ctx.fillText(d.item.title, left, base);
  }
  ctx.globalAlpha = 1;

  /* ---------- Rámeček karty (hover) ----------
     Jako rámeček kolem písmene v nadpisu (MeasureText): čárkovaný obvod
     kolem celé karty, rohové tečky, drobky, obíhající tečky a popisek se
     skutečným rozměrem banneru. */
  if (d.focus > 0.001) {
    const cardFrame: Frame = {
      x1: MARGIN - CARD_PAD,
      y1: MARGIN - CARD_PAD,
      x2: MARGIN + d.cw + CARD_PAD,
      y2: MARGIN + d.ch + CARD_PAD,
    };
    drawMeasureFrame(ctx, d, cardFrame, d.focus, {
      scale: 1,
      seed: d.index + 1,
      label:
        d.natural[0] > 1 && d.natural[1] > 1
          ? `${d.natural[0]} × ${d.natural[1]} PX`
          : `${Math.round(d.cw)} × ${Math.round(d.ch)} PX`,
      labelSize: 11,
      delay: 0,
    });
  }
}

// Rámeček výzvy ve stylu odkazu v hlavičce (MeasureText „nav"):
// čárkovaný obvod se dokreslí, rohové tečky, drobky, obíhající tečky
// a popisek s rozměrem nad rámečkem.
type FrameLook = {
  /** markScale jako v MeasureText: 1 = nadpis, 0.6 = odkazy hlavičky. */
  scale: number;
  seed: number;
  label: string;
  labelSize: number;
  /** Zpoždění dokreslení v s. */
  delay: number;
};

function drawMeasureFrame(
  ctx: CanvasRenderingContext2D,
  d: CardLayerDraw,
  f: Frame,
  hover: number,
  look: FrameLook,
) {
  const fw = f.x2 - f.x1;
  const fh = f.y2 - f.y1;
  const perimeter = 2 * (fw + fh);
  const along = (distance: number): [number, number, number, number] => {
    let p = ((distance % perimeter) + perimeter) % perimeter;
    if (p < fw) return [f.x1 + p, f.y1, 0, -1];
    p -= fw;
    if (p < fh) return [f.x2, f.y1 + p, 1, 0];
    p -= fh;
    if (p < fw) return [f.x2 - p, f.y2, 0, 1];
    p -= fw;
    return [f.x1, f.y2 - p, -1, 0];
  };
  const dot = (x: number, y: number, r: number) => {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  };
  const draw = easeOut((d.since - look.delay) / 0.4) * hover;
  const s = look.scale;
  if (draw <= 0.001) return;

  ctx.strokeStyle = MARK;
  ctx.fillStyle = MARK;
  ctx.lineWidth = 1;

  ctx.globalAlpha = 0.45 * hover;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  const steps = 40;
  for (let k = 0; k <= steps; k++) {
    const [x, y] = along((k / steps) * perimeter * draw);
    if (k === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  if (draw >= 0.999) ctx.closePath();
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.globalAlpha = draw;
  ctx.fillStyle = ACCENT;
  for (const [cx, cy] of [
    [f.x1, f.y1],
    [f.x2, f.y1],
    [f.x2, f.y2],
    [f.x1, f.y2],
  ]) {
    dot(cx, cy, Math.max(1.5, 3 * s));
  }
  ctx.fillStyle = MARK;

  const seed = look.seed;
  for (let k = 0; k < 9; k++) {
    const period = 0.5 + noise(seed, k, 11) * 1.2;
    const t = d.time / period + noise(seed, k, 17);
    const cycle = Math.floor(t);
    const life = t - cycle;
    if (life > 0.7) continue;
    const [px, py, nx, ny] = along(noise(seed, k, cycle) * perimeter);
    const pick = noise(seed, k, cycle, 2);
    const r = Math.max(0.8, (pick < 0.5 ? 1 : pick < 0.8 ? 1.5 : pick < 0.93 ? 2.5 : 4) * s);
    const out = (6 + Math.floor(noise(seed, k, cycle, 1) * 5) * 3) * s;
    const x = px + nx * out;
    const y = py + ny * out;
    const tone = noise(seed, k, cycle, 3);
    const blink = life < 0.06 || (life > 0.32 && life < 0.36) ? 0.35 : 1;
    ctx.globalAlpha = draw * (0.3 + 0.55 * tone) * blink;
    if (tone < 0.3) {
      const arm = r + 1.5 * s;
      ctx.beginPath();
      ctx.moveTo(x - arm, y);
      ctx.lineTo(x + arm, y);
      ctx.moveTo(x, y - arm);
      ctx.lineTo(x, y + arm);
      ctx.stroke();
    } else {
      dot(x, y, r);
    }
  }

  for (let j = 0; j < 2; j++) {
    const head = (d.time * 0.21 + j * 0.5) * perimeter;
    for (let i = 0; i < 4; i++) {
      const [x, y] = along(head - i * 6 * s);
      ctx.globalAlpha = draw * [0.95, 0.55, 0.32, 0.16][i];
      dot(x, y, Math.max(0.8, (i === 0 ? 1.6 : 1.1) * s));
    }
  }

  // Popisek: rozměr výzvy jako „W × H PX" u odkazů v hlavičce.
  ctx.font = `500 ${look.labelSize}px ${d.font}`;
  ctx.textBaseline = "bottom";
  ctx.globalAlpha = 0.8 * draw;
  if ("letterSpacing" in ctx) ctx.letterSpacing = "1.2px";
  ctx.fillText(look.label, f.x1, f.y1 - 7);
  if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
  ctx.textBaseline = "alphabetic";
  ctx.globalAlpha = 1;
}
