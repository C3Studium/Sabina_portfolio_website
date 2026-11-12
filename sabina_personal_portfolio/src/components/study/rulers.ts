// Pravítka plátna kreslená do <canvas> (index.tsx) — každý snímek znovu
// podle kamery. Jednoduchá: bez podkladu, bílé (sněhové) dílky a čísla,
// zelený pás aktivního artboardu.
//
//   drawRuler    dílky a čísla ve světových px; vodorovně (nahoře) i svisle
//                (vlevo); pásy a značky (Sabina, vaše myš)
//   drawChapters spodní pravítko: celá cesta scrollu jako stupnice,
//                kapitoly jako hlavní dílky s názvy, zelený průběh
//
// `reveal` (0–1) = náběh: dílky se vykreslí od začátku pravítka ke konci.

import { ACCENT, ACCENT_RGB, SNOW_RGB } from "@/lib/palette";

export type RulerMark = { at: number; color: string };
export type RulerBand = { from: number; to: number; color: string };

const STEPS = [50, 100, 250, 500, 1000, 2500, 5000];
const LINE = (a: number) => `rgba(${SNOW_RGB}, ${a})`;

/** Plátno pravítka připravené na kreslení (velikost × DPR); null bez kontextu. */
function prepare(canvas: HTMLCanvasElement | null, vertical: boolean) {
  const ctx = canvas?.getContext("2d");
  if (!canvas || !ctx) return null;
  const dpr = window.devicePixelRatio || 1;
  const len = vertical ? canvas.clientHeight : canvas.clientWidth;
  const thick = vertical ? canvas.clientWidth : canvas.clientHeight;
  const w = Math.round(canvas.clientWidth * dpr);
  const h = Math.round(canvas.clientHeight * dpr);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
  if (vertical) {
    // Kreslí se jako vodorovné, otočené o 90° (osa x míří dolů).
    ctx.translate(thick, 0);
    ctx.rotate(Math.PI / 2);
  }
  ctx.font = "500 10px system-ui, sans-serif";
  ctx.textBaseline = "top";
  return { ctx, len, thick };
}

/**
 * Pravítko ve světových px: `offset` a `s` jsou posun a měřítko kamery na
 * této ose. `inner` = dílky od druhé hrany (svislé pravítko vlevo míří
 * k plátnu, vpravo).
 */
export function drawRuler(
  canvas: HTMLCanvasElement | null,
  vertical: boolean,
  offset: number,
  s: number,
  bands: RulerBand[],
  marks: RulerMark[],
  reveal = 1,
  inner = false,
) {
  const ready = prepare(canvas, vertical);
  if (!ready) return;
  const { ctx, len, thick } = ready;
  const edge = len * reveal;
  for (const band of bands) {
    const from = Math.max(0, band.from);
    const to = Math.min(edge, band.to);
    if (to <= from) continue;
    ctx.fillStyle = band.color;
    ctx.fillRect(from, inner ? 0 : thick - 3, to - from, 3);
  }
  const step = STEPS.find((v) => v * s >= 80) ?? STEPS[STEPS.length - 1];
  const minor = step / 5;
  const first = Math.floor(-offset / s / minor) * minor;
  ctx.strokeStyle = LINE(0.55);
  ctx.fillStyle = LINE(0.85);
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let v = first; v * s + offset < edge; v += minor) {
    const p = Math.round(v * s + offset) + 0.5;
    if (p < 0) continue;
    const major = Math.abs(v / step - Math.round(v / step)) < 1e-6;
    const tick = major ? thick * 0.55 : thick * 0.22;
    ctx.moveTo(p, inner ? 0 : thick);
    ctx.lineTo(p, inner ? tick : thick - tick);
    if (major) ctx.fillText(String(Math.round(v)), p + 3, inner ? thick - 12 : 1);
  }
  ctx.stroke();
  for (const mark of marks) {
    if (mark.at > edge) continue;
    ctx.fillStyle = mark.color;
    ctx.fillRect(Math.round(mark.at) - 0.5, 0, 1.5, thick);
  }
  // Hrana pravítka k plátnu.
  ctx.strokeStyle = LINE(0.35);
  ctx.beginPath();
  ctx.moveTo(0, inner ? 0.5 : thick - 0.5);
  ctx.lineTo(edge, inner ? 0.5 : thick - 0.5);
  ctx.stroke();
}

export type Chapter = { at: number; label: string };

/**
 * Spodní pravítko: stupnice celé cesty (0 … total), kapitoly jako hlavní
 * dílky s názvem, zelený průběh do `now`. `pad` = okraj vlevo a vpravo.
 */
export function drawChapters(canvas: HTMLCanvasElement | null, chapters: Chapter[], total: number, now: number, hover: number, reveal = 1, pad = 18) {
  const ready = prepare(canvas, false);
  if (!ready) return;
  const { ctx, len, thick } = ready;
  const span = len - pad * 2;
  const at = (v: number) => pad + (v / total) * span;
  const edge = len * reveal;
  ctx.strokeStyle = LINE(0.35);
  ctx.beginPath();
  ctx.moveTo(pad, 0.5);
  ctx.lineTo(Math.min(edge, len - pad), 0.5);
  ctx.stroke();
  ctx.fillStyle = `rgba(${ACCENT_RGB}, 0.9)`;
  ctx.fillRect(at(0), 0, Math.max(0, Math.min(edge, at(now)) - at(0)), 3);
  ctx.strokeStyle = LINE(0.45);
  ctx.beginPath();
  const minor = total / 90;
  for (let v = 0; v <= total + 1e-6; v += minor) {
    const p = Math.round(at(v)) + 0.5;
    if (p > edge) break;
    ctx.moveTo(p, 0);
    ctx.lineTo(p, thick * 0.2);
  }
  ctx.stroke();
  chapters.forEach((ch, i) => {
    const p = Math.round(at(ch.at)) + 0.5;
    if (p > edge) return;
    const passed = now >= ch.at - 0.02;
    ctx.strokeStyle = LINE(passed ? 0.95 : 0.6);
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, thick * 0.5);
    ctx.stroke();
    ctx.fillStyle = i === hover ? ACCENT : LINE(passed ? 0.95 : 0.6);
    ctx.fillText(`${String(i + 1).padStart(2, "0")} ${ch.label}`, p + 4, thick * 0.3);
  });
}

/** Kapitola pod bodem x (px plátna pravítka), nebo -1. */
export function chapterAt(canvas: HTMLCanvasElement, chapters: Chapter[], total: number, x: number, pad = 18) {
  const span = canvas.clientWidth - pad * 2;
  const v = ((x - pad) / span) * total;
  let best = -1;
  chapters.forEach((ch, i) => {
    if (v >= ch.at - 0.15) best = i;
  });
  return best;
}
