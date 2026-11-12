// Karta recenze nakreslená do 2D plátna — stejný vzhled jako DOM karta
// v CTA (.review), aby se dala jako textura ohýbat v ScrollBend (3D). Stejný
// postup jako text karet v galerii hera (FlexCarousel/hover.ts): DOM se
// nekopíruje, karta se nakreslí jeho rozměry a písmem; skutečný text je pro
// čtečky ve skrytém seznamu ScrollBend.
//
// Souřadnice v CSS px karty (kontext škálovaný na dpr), velikosti odvozené
// z výšky karty — karta vypadá stejně v každé velikosti okna.

import type { MarkedLine } from "../lines";
import { ACCENT, SNOW, SNOW_RGB } from "@/lib/palette";

export type ReviewCardData = {
  text: MarkedLine;
  name: string;
  role: string;
  stars: number;
  /** Monogram firmy (bez loga). */
  monogram: string;
  stats: { value: string; label: string }[];
};

/* ---------- Vzhled (jako .review v styles.module.scss) ---------- */

const COLOR = {
  card: "#232323",
  text: SNOW,
  muted: SNOW,
  line: `rgba(${SNOW_RGB}, 0.15)`,
  accent: ACCENT,
};

// Uvozovky a hvězda — tytéž cesty jako ikony v DOM kartě. Path2D až
// v prohlížeči (na serveru neexistuje).
const QUOTE_PATH =
  "M0 24V13.4C0 6 3.9 1.3 11.2 0l1.3 3.9C8.2 5.3 6 7.7 5.8 11h5.4v13H0Zm18.8 0V13.4C18.8 6 22.7 1.3 30 0l1.3 3.9c-4.3 1.4-6.5 3.8-6.7 7.1H30v13H18.8Z";
const STAR_PATH = "m12 2.6 2.9 5.9 6.5.9-4.7 4.6 1.1 6.4-5.8-3-5.8 3 1.1-6.4L2.6 9.4l6.5-.9z";

type Ctx = CanvasRenderingContext2D & { letterSpacing?: string };

const font = (ctx: Ctx, family: string, size: number, weight = 400, spacing = 0) => {
  ctx.font = `${weight} ${size}px ${family}`;
  if ("letterSpacing" in ctx) ctx.letterSpacing = `${spacing}px`;
};

/** Text s barevnými úseky zalomený do šířky; vrací spodní hranu. */
function wrapRuns(ctx: Ctx, runs: MarkedLine, x: number, y: number, width: number, lineHeight: number) {
  const words = runs.flatMap(([run, marked]) =>
    run
      .split(/\s+/)
      .filter(Boolean)
      .map((word) => ({ word, marked })),
  );
  const space = ctx.measureText(" ").width;
  let cx = x;
  let cy = y;
  for (const { word, marked } of words) {
    const w = ctx.measureText(word).width;
    if (cx > x && cx + w > x + width) {
      cx = x;
      cy += lineHeight;
    }
    ctx.fillStyle = marked ? COLOR.accent : COLOR.text;
    ctx.fillText(word, cx, cy);
    cx += w + space;
  }
  return cy;
}

/**
 * Nakreslí kartu do nového plátna (šířka × výška v CSS px).
 *
 * `textScale`: písmo (a řádky textu) větší než v základním rozvržení, které
 * počítá s vysokou kartou na šířku (pás na výšku). Telefon má kartu nízkou,
 * písmo podle výšky by tam mělo pár pixelů.
 */
export function drawReviewCard(data: ReviewCardData, width: number, height: number, family: string, dpr = 2, textScale = 1) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  const ctx = canvas.getContext("2d") as Ctx | null;
  if (!ctx) return canvas;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.textBaseline = "top";
  const QUOTE = new Path2D(QUOTE_PATH);
  const STAR = new Path2D(STAR_PATH);

  const u = height / 100; // 1 % výšky karty
  const t = u * textScale; // jednotka písma
  const padX = width * 0.07;
  const padY = u * 5.5;
  const inner = width - padX * 2;

  // Podklad (zaoblení dělá shader ScrollBend).
  ctx.fillStyle = COLOR.card;
  ctx.fillRect(0, 0, width, height);

  // Uvozovky.
  const quote = u * 5.4;
  ctx.save();
  ctx.translate(padX, padY);
  ctx.scale(quote / 24, quote / 24);
  ctx.fillStyle = COLOR.accent;
  ctx.fill(QUOTE);
  ctx.restore();

  // Text recenze.
  font(ctx, family, t * 2.65, 300);
  wrapRuns(ctx, data.text, padX, padY + quote + u * 3.6, inner, t * 2.65 * 1.62);

  // Čísla dole (dva sloupce s předělem).
  const statsTop = height - padY - u * 9.5;
  ctx.fillStyle = COLOR.line;
  ctx.fillRect(padX, statsTop - u * 4.5, inner, 1);
  const col = inner / Math.max(1, data.stats.length);
  data.stats.forEach((stat, i) => {
    const cx = padX + col * i + col / 2;
    ctx.textAlign = "center";
    font(ctx, family, u * 5, 200);
    ctx.fillStyle = COLOR.text;
    ctx.fillText(stat.value, cx, statsTop);
    // Prázdný popisek (opakoval text recenze, cta/index.tsx) se nekreslí.
    if (stat.label) {
      // Popisek se vejde do svého sloupce (větší písmo na telefonu).
      font(ctx, family, t * 1.7, 300, t * 0.27);
      const wide = ctx.measureText(stat.label.toUpperCase()).width;
      if (wide > col * 0.9) {
        const k = (col * 0.9) / wide;
        font(ctx, family, t * 1.7 * k, 300, t * 0.27 * k);
      }
      ctx.fillStyle = COLOR.muted;
      ctx.fillText(stat.label.toUpperCase(), cx, statsTop + u * 6.6);
    }
    if (i > 0) {
      ctx.fillStyle = COLOR.line;
      ctx.fillRect(padX + col * i, statsTop - u * 1.2, 1, u * 10);
    }
  });
  ctx.textAlign = "left";

  // Autor: kroužek s monogramem, jméno a pozice, hvězdičky.
  const authorTop = statsTop - u * 4.5 - u * 2.6 - u * 8.8;
  ctx.fillStyle = COLOR.line;
  ctx.fillRect(padX, authorTop - u * 2.6, inner, 1);
  const avatar = u * 4.4;
  const ay = authorTop + avatar;
  ctx.strokeStyle = `rgba(${SNOW_RGB}, 0.35)`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(padX + avatar, ay, avatar, 0, Math.PI * 2);
  ctx.stroke();
  font(ctx, family, t * 1.7, 500, t * 0.2);
  ctx.fillStyle = COLOR.text;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(data.monogram.toUpperCase(), padX + avatar, ay);
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  const nx = padX + avatar * 2 + width * 0.035;
  font(ctx, family, t * 2.1, 600, t * 0.17);
  ctx.fillText(data.name.toUpperCase(), nx, ay - t * 2.6);
  font(ctx, family, t * 2.1, 300);
  ctx.fillStyle = COLOR.muted;
  ctx.fillText(data.role, nx, ay + t * 0.5);
  const star = u * 2.2 * Math.sqrt(textScale);
  ctx.fillStyle = COLOR.accent;
  for (let i = 0; i < data.stars; i++) {
    ctx.save();
    ctx.translate(padX + inner - (data.stars - i) * (star + u * 0.4), ay - star / 2);
    ctx.scale(star / 24, star / 24);
    ctx.fill(STAR);
    ctx.restore();
  }

  return canvas;
}
