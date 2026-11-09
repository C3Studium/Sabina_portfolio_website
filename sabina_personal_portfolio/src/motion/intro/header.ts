// Stavba hlavičky — navazuje na konec loga (logo.ts).
//
// Z rámečku loga vyběhne linka přes celou lištu (s ryskami na hranách
// odkazů). Kde linka mine odkaz, ten se postaví: rámeček se rozevře
// z linky, nad ním pořadové číslo, text se obtáhne tečkami a odkaz
// naskočí — jeden po druhém, jak linka běží. Na jejím konci tlačítko:
// ořezové značky sjedou k rohům, pod ním kóta šířky, kolem šipky se
// obtáhne kruh, text tečkami, a tlačítko naskočí. Rámečky zůstanou a na
// konci zhasnou postupně za rámečkem loga (headerOut).
//
// Prvky hlavičky jsou pod oponou neviditelné, dokud jim vrstva nedá
// `data-intro-in` (reveal) — viz header/styles.module.scss.

import {
  at,
  clamp01,
  dot,
  frame,
  glyphRuns,
  guide,
  label,
  lerp,
  linear,
  rectOf,
  reveal,
  specks,
  stage,
  strokeGlyphs,
  textNode,
  type Box,
  type Glyphs,
  type Layer,
  type Look,
} from "./draw";
import type { LogoFrame } from "./logo";
import { HEADER, LOGO, headerOut } from "./timeline";

type Item = { el: HTMLElement; box: Box; glyphs: Glyphs | null; start: number };

export function createHeader(look: Look, logoFrame: LogoFrame | null): Layer | null {
  const linkEls = Array.from(document.querySelectorAll<HTMLElement>('[data-intro="link"]'));
  const ctaEl = document.querySelector<HTMLElement>('[data-intro="cta"]');
  if (!linkEls.length && !ctaEl) return null;
  const measure = document.createElement("canvas").getContext("2d");
  if (!measure) return null;

  let links: Item[] = [];
  let cta: (Item & { ring: Box | null }) | null = null;
  let bar = { x0: 0, x1: 0, y: 0 };

  const layout = () => {
    // Odkazy schované na úzké obrazovce (`display: none`) mají nulový box.
    const visible = linkEls.map((el) => ({ el, box: rectOf(el) })).filter(({ box }) => box.w > 0);
    const ctaBox = ctaEl ? rectOf(ctaEl) : null;
    const end = logoFrame?.(LOGO.frameMove[1]);
    const x0 = end ? end.x + end.w : 0;
    const x1 = ctaBox && ctaBox.w ? ctaBox.x - 6 : window.innerWidth - 24;
    const y = visible.length
      ? visible.reduce((sum, { box }) => sum + box.y + box.h / 2, 0) / visible.length
      : ctaBox
        ? ctaBox.y + ctaBox.h / 2
        : 40;
    bar = { x0, x1, y };
    // Odkaz se začne stavět, když ho mine hlava linky.
    const startAt = (x: number) =>
      HEADER.bar[0] + (HEADER.bar[1] - HEADER.bar[0]) * clamp01((x - x0) / Math.max(1, x1 - x0));
    links = visible.map(({ el, box }) => ({
      el,
      box,
      glyphs: glyphRuns(measure, textNode(el.querySelector("[data-measure]")) ?? new Text("")),
      start: startAt(box.x),
    }));
    if (ctaEl && ctaBox && ctaBox.w) {
      const ringEl = ctaEl.querySelector("[data-intro-ring]");
      const labelNode = textNode(ctaEl.querySelector("[data-intro-label]"));
      cta = {
        el: ctaEl,
        box: ctaBox,
        glyphs: labelNode ? glyphRuns(measure, labelNode) : null,
        start: HEADER.bar[1],
        ring: ringEl ? rectOf(ringEl) : null,
      };
    } else {
      cta = null;
    }
  };

  const drawBar = (ctx: CanvasRenderingContext2D, t: number) => {
    const p = linear(t, HEADER.bar);
    const a = 1 - stage(t, headerOut(0));
    if (p <= 0 || a <= 0.001) return;
    const head = lerp(bar.x0, bar.x1, p);
    guide(ctx, bar.x0, bar.y, bar.x1, bar.y, p, 0.45 * a, look.mark, [2, 4]);
    // Rysky na hranách odkazů, jak je hlava mine.
    ctx.strokeStyle = look.mark;
    ctx.lineWidth = 1;
    for (const link of links) {
      for (const x of [link.box.x, link.box.x + link.box.w]) {
        if (x > head) continue;
        ctx.globalAlpha = 0.6 * a;
        ctx.beginPath();
        ctx.moveTo(x, bar.y - 4);
        ctx.lineTo(x, bar.y + 4);
        ctx.stroke();
      }
    }
    // Hlava linky se stopou, dokud běží.
    if (p < 1) {
      ctx.fillStyle = look.accent;
      for (let i = 0; i < 4; i++) {
        ctx.globalAlpha = a * [1, 0.55, 0.3, 0.15][i];
        dot(ctx, head - i * 5, bar.y, i === 0 ? 2.2 : 1.4);
      }
    }
    ctx.globalAlpha = 1;
  };

  const drawLink = (ctx: CanvasRenderingContext2D, t: number, link: Item, index: number) => {
    const { box, start: s } = link;
    if (t >= s + HEADER.link.show) reveal(link.el);
    if (t < s) return;
    const open = stage(t, at(s, 0, HEADER.link.open));
    const fade = 1 - stage(t, headerOut(index + 1));
    if (fade <= 0.001) return;
    // Rámeček se rozevře z linky (výška 0 → plná) kolem jejího středu.
    const h = box.h * open;
    const opened: Box = { x: box.x, y: bar.y - h / 2, w: box.w, h };
    frame(ctx, opened, 1, fade, look, 1.8);
    specks(ctx, opened, open * fade * 0.8, t, look.mark, 31 + index, 3, 0.6);
    label(ctx, String(index + 1).padStart(2, "0"), box.x, opened.y - 4, 0.7 * open * fade, look.accent, 8, "bottom");
    // Text tečkami, než naskočí skutečný; s ním zhasne.
    if (link.glyphs) {
      const textIn = linear(t, at(s, ...HEADER.link.text));
      const textOut = 1 - stage(t, at(s, HEADER.link.show, HEADER.link.show + 0.25));
      strokeGlyphs(ctx, link.glyphs, textIn, textOut, look.mark, 1.1, 2.2);
    }
  };

  const drawCta = (ctx: CanvasRenderingContext2D, t: number) => {
    if (!cta) return;
    const { box, start: s } = cta;
    if (t >= s + HEADER.cta.show) reveal(cta.el);
    if (t < s) return;
    const marks = stage(t, at(s, 0, HEADER.cta.marks));
    const fade = 1 - stage(t, headerOut(links.length + 1));
    if (fade <= 0.001) return;

    // Ořezové značky: sjedou z dálky k rohům.
    const gap = lerp(18, 5, marks);
    const arm = 8;
    ctx.strokeStyle = look.mark;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.8 * marks * fade;
    ctx.beginPath();
    for (const [cx, cy, sx, sy] of [
      [box.x, box.y, -1, -1],
      [box.x + box.w, box.y, 1, -1],
      [box.x + box.w, box.y + box.h, 1, 1],
      [box.x, box.y + box.h, -1, 1],
    ]) {
      ctx.moveTo(cx + sx * gap, cy);
      ctx.lineTo(cx + sx * (gap + arm), cy);
      ctx.moveTo(cx, cy + sy * gap);
      ctx.lineTo(cx, cy + sy * (gap + arm));
    }
    ctx.stroke();
    ctx.fillStyle = look.accent;
    for (const [x, y] of [
      [box.x, box.y],
      [box.x + box.w, box.y],
      [box.x + box.w, box.y + box.h],
      [box.x, box.y + box.h],
    ]) {
      ctx.globalAlpha = marks * fade;
      dot(ctx, x, y, 1.8);
    }

    // Kóta šířky pod tlačítkem — roste ze středu k oběma koncům.
    const dim = stage(t, at(s, 0.08, 0.4));
    const dy = box.y + box.h + 10;
    const cx = box.x + box.w / 2;
    const half = (box.w / 2) * dim;
    ctx.globalAlpha = 0.6 * fade;
    ctx.beginPath();
    ctx.moveTo(cx - half, dy);
    ctx.lineTo(cx + half, dy);
    if (dim > 0.98) {
      for (const x of [box.x, box.x + box.w]) {
        ctx.moveTo(x, dy - 3);
        ctx.lineTo(x, dy + 3);
      }
    }
    ctx.stroke();
    label(ctx, `${Math.round(box.w)} PX`, cx, dy + 4, 0.7 * dim * fade, look.mark, 8, "top", "center");

    // Kruh kolem šipky se obtáhne a zaměřovací kříž ve středu.
    if (cta.ring) {
      const ring = cta.ring;
      const rx = ring.x + ring.w / 2;
      const ry = ring.y + ring.h / 2;
      const r = ring.w / 2 + 5;
      const p = stage(t, at(s, 0.12, 0.45));
      ctx.globalAlpha = 0.6 * fade;
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.arc(rx, ry, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 0.8 * p * fade;
      ctx.beginPath();
      ctx.moveTo(rx - 4, ry);
      ctx.lineTo(rx + 4, ry);
      ctx.moveTo(rx, ry - 4);
      ctx.lineTo(rx, ry + 4);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    if (cta.glyphs) {
      const textOut = 1 - stage(t, at(s, HEADER.cta.show, HEADER.cta.show + 0.25));
      strokeGlyphs(ctx, cta.glyphs, linear(t, at(s, ...HEADER.cta.text)), textOut, look.accent, 1.1, 2.2);
    }
  };

  return {
    layout,
    draw: (ctx, t) => {
      drawBar(ctx, t);
      links.forEach((link, i) => drawLink(ctx, t, link, i));
      drawCta(ctx, t);
    },
    finish: () => {
      linkEls.forEach(reveal);
      reveal(ctaEl);
    },
  };
}
