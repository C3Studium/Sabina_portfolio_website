// Stavba loga — měřicí jazyk webu (MeasureText) na podpisu „S".
//
// Kreslí se přesně tam, kde stojí logo v hlavičce (`[data-brand-mark]`),
// ve skutečné velikosti — rozměry v popisku jsou pravdivé.
//
//   1. rámeček   čárkovaná linka obejde logo, v rozích tečky, popisek, drobky
//   2. linky     konstrukční linky přes hrany a střed loga k okrajům okna
//   3. obrys     okrajové pixely podpisu, odhalí se zleva
//   4. logo      plné logo přes obrys — ZŮSTANE: logo v hlavičce naskočí
//                na místě nakresleného (stejný obrázek), linky se stáhnou
//   Rámeček nezmizí: roztáhne se kolem celého loga, jméno se vylije
//   (TextMorph v hlavičce) a od rámečku vyběhne linka hlavičky (header.ts).
//   Zhasne až s ostatními rámečky hlavičky, jako první z nich.

import { edgeCanvas } from "@/components/common/outline-hover/engine";
import { clamp01, dot, frame, label, lerpBox, pad, rectOf, reveal, specks, stage, type Box, type Layer, type Look } from "./draw";
import { LOGO, headerOut } from "./timeline";

export type LogoLook = Look & {
  /** Okraj rámečku kolem „S" (px). */
  pad: number;
  /** Okraj rámečku kolem celého loga na konci (px) — jako hover loga. */
  brandPad: number;
  specks: number;
};

/** Rámeček loga v čase `t` — z něj vybíhá linka hlavičky. */
export type LogoFrame = (t: number) => Box | null;

export function createLogo(look: LogoLook): (Layer & { frameAt: LogoFrame }) | null {
  const markEl = document.querySelector<HTMLImageElement>("[data-brand-mark]");
  const brandEl = document.querySelector<HTMLElement>("[data-brand]");
  if (!markEl || !brandEl) return null;

  let vw = 1;
  let vh = 1;
  let mark: Box = { x: 0, y: 0, w: 0, h: 0 };
  let brand: Box = { x: 0, y: 0, w: 0, h: 0 };
  let edges: HTMLCanvasElement | null = null;

  const layout = () => {
    vw = window.innerWidth;
    vh = window.innerHeight;
    mark = rectOf(markEl);
    brand = rectOf(brandEl);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    // Okrajové pixely podpisu, plné (bez teček), v barvě loga.
    edges = edgeCanvas(markEl, mark.w, mark.h, dpr, { threshold: 110, edge: 1.2, imageDots: null });
  };

  // Logo z CMS se může načíst až po startu — pak teprve jde přečíst obrys.
  if (!markEl.complete) markEl.addEventListener("load", layout, { once: true });

  const frameAt: LogoFrame = (t) => {
    if (!mark.w || t < LOGO.frame[0] || t > headerOut(0)[1]) return null;
    return lerpBox(pad(mark, look.pad), pad(brand, look.brandPad), stage(t, LOGO.frameMove));
  };

  const draw = (ctx: CanvasRenderingContext2D, t: number) => {
    if (t >= LOGO.show) reveal(brandEl);
    if (!mark.w) return;

    const frameIn = stage(t, LOGO.frame);
    const lines = stage(t, LOGO.lines) * (1 - stage(t, LOGO.linesOut));
    const outline = stage(t, LOGO.outline) * (1 - stage(t, LOGO.outlineOut));
    const fill = stage(t, LOGO.fill);
    const fade = 1 - stage(t, headerOut(0));

    // 2. Konstrukční linky přes hrany a střed loga, rostou k okrajům.
    if (lines > 0.001) {
      const cx = mark.x + mark.w / 2;
      const cy = mark.y + mark.h / 2;
      ctx.strokeStyle = look.mark;
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 5]);
      ctx.globalAlpha = 0.32;
      ctx.beginPath();
      for (const y of [mark.y, cy, mark.y + mark.h]) {
        ctx.moveTo(cx - lines * cx, y);
        ctx.lineTo(cx + lines * (vw - cx), y);
      }
      for (const x of [mark.x, cx, mark.x + mark.w]) {
        ctx.moveTo(x, cy - lines * cy);
        ctx.lineTo(x, cy + lines * (vh - cy));
      }
      ctx.stroke();
      ctx.setLineDash([]);
      // Průsečíky linek s logem.
      ctx.globalAlpha = 0.85 * lines;
      ctx.fillStyle = look.mark;
      for (const y of [mark.y, cy, mark.y + mark.h]) {
        for (const x of [mark.x, cx, mark.x + mark.w]) dot(ctx, x, y, 1.2);
      }
      ctx.globalAlpha = 1;
    }

    // 3. Obrys podpisu, odhalovaný zleva (a zpátky stejnou cestou).
    if (outline > 0.001 && edges) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(mark.x - 2, mark.y - 2, (mark.w + 4) * outline, mark.h + 4);
      ctx.clip();
      ctx.drawImage(edges, mark.x, mark.y, mark.w, mark.h);
      ctx.restore();
    }

    // 4. Plné logo — kreslí se, dokud logo v hlavičce nedoběhne (průhlednost
    // 0,5 s), pak už stojí jen to skutečné. Stejný obrázek na stejném místě,
    // takže překryv není vidět.
    if (fill > 0.001 && t < LOGO.show + 0.3 && markEl.complete) {
      ctx.globalAlpha = fill;
      ctx.drawImage(markEl, mark.x, mark.y, mark.w, mark.h);
      ctx.globalAlpha = 1;
    }

    // 1. Rámeček — zůstává, roztáhne se kolem celého loga, zhasne na konci.
    const box = frameAt(t);
    if (box && frameIn > 0.001 && fade > 0.001) {
      frame(ctx, box, frameIn, fade, look);
      const settled = clamp01((frameIn - 0.8) / 0.2) * fade;
      specks(ctx, box, settled, t, look.mark, 7, look.specks);
      // Popisek pod rámečkem (nad ním by ho uřízl okraj okna).
      label(ctx, `${Math.round(box.w)} × ${Math.round(box.h)} PX`, box.x, box.y + box.h + 5, 0.75 * settled, look.mark);
    }
  };

  return {
    layout,
    draw,
    frameAt,
    finish: () => reveal(brandEl),
    destroy: () => markEl.removeEventListener("load", layout),
  };
}
