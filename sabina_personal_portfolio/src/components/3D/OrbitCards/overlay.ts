// OrbitCards — HTML vrstva nad 3D kartou.
//
// Karta je ve WebGL, ale rámeček, text a tlačítko jsou obyčejné 2D:
// engine každý snímek nahlásí, kde na obrazovce karta pod myší leží
// (OverlayState), a tahle vrstva podle toho:
//  - na 2D plátno nakreslí rámeček ve stylu MeasureText — čárkovaný
//    obdélník kolem karty, drobky, dvě tečky obíhající obvod a popisek
//    se skutečným rozměrem banneru. Rohy nekreslí: kurzor se do nich sám
//    rozpadne (karta je zaregistrovaná v RefContextu),
//  - posune HTML panel (titulek, text, odkaz) na spodní hranu karty a
//    natočí ho podle ní, takže sedí na kartě i v nakloněné scéně.
//
// Vlastní smyčka rAF běží jen, dokud je co ukazovat. Pozice se zapisují
// rovnou do stylu — žádný React render za snímek.

import type { OverlayState } from "./engine";

export interface OverlayOptions {
  /** Barva rámečku, drobků a popisku (jako markColor v MeasureText). */
  markColor: string;
  /** Okraj rámečku kolem karty v px — stejný jako u rect() pro kurzor. */
  pad: number;
  /** Počet drobků kolem rámečku. */
  specks: number;
  /** Jak dlouho se rámeček při najetí kreslí kolem dokola (s). */
  drawIn: number;
  /** Ukazuje se nová položka — React podle toho vymění obsah panelu. */
  onItem: (item: number | null) => void;
}

export interface OverlayController {
  update: (state: OverlayState | null) => void;
  /** Obdélník pro kurzor v souřadnicích okna, nebo null. */
  rect: () => { left: number; top: number; right: number; bottom: number } | null;
  destroy: () => void;
}

// Stejný hash jako v MeasureText — drobky jsou náhodné, ale stálé.
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

export function createCardOverlay(
  root: HTMLElement,
  canvas: HTMLCanvasElement,
  panel: HTMLElement,
  options: OverlayOptions,
): OverlayController | null {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  let state: OverlayState | null = null;
  let shownItem: number | null = null;
  let shownAt = 0;
  let raf = 0;
  let destroyed = false;
  let cssW = 0;
  let cssH = 0;
  let dpr = 1;
  let font = "";
  let panelShown = false;

  const resize = () => {
    const w = root.clientWidth;
    const h = root.clientHeight;
    const nextDpr = Math.min(window.devicePixelRatio || 1, 2);
    if (w === cssW && h === cssH && nextDpr === dpr) return;
    cssW = w;
    cssH = h;
    dpr = nextDpr;
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    font = `500 11px ${getComputedStyle(root).fontFamily}`;
  };

  const frame = (s: OverlayState) => ({
    x1: s.box.left - options.pad,
    y1: s.box.top - options.pad,
    x2: s.box.right + options.pad,
    y2: s.box.bottom + options.pad,
  });

  const dot = (x: number, y: number, r: number) => {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  };

  const draw = (s: OverlayState, time: number) => {
    const f = frame(s);
    const w = f.x2 - f.x1;
    const h = f.y2 - f.y1;
    const perimeter = 2 * (w + h);
    const a = s.focus;
    // Bod na obvodu (po směru hodin od levého horního rohu) a normála ven.
    const along = (distance: number): [number, number, number, number] => {
      let d = ((distance % perimeter) + perimeter) % perimeter;
      if (d < w) return [f.x1 + d, f.y1, 0, -1];
      d -= w;
      if (d < h) return [f.x2, f.y1 + d, 1, 0];
      d -= h;
      if (d < w) return [f.x2 - d, f.y2, 0, 1];
      d -= w;
      return [f.x1, f.y2 - d, -1, 0];
    };

    ctx.strokeStyle = options.markColor;
    ctx.fillStyle = options.markColor;
    ctx.lineWidth = 1;

    // Čárkovaný rámeček se při najetí „dokreslí" kolem dokola.
    const reveal = Math.min(1, (time - shownAt) / Math.max(options.drawIn, 0.01));
    const eased = 1 - Math.pow(1 - reveal, 3);
    ctx.globalAlpha = 0.4 * a;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    const steps = 48;
    for (let k = 0; k <= steps; k++) {
      const [x, y] = along((k / steps) * perimeter * eased);
      if (k === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    if (eased >= 1) ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);

    // Drobky: tečky a křížky, které naskočí, bliknou a zmizí.
    const seed = s.item + 1;
    for (let k = 0; k < options.specks; k++) {
      const period = 0.5 + noise(seed, k, 11) * 1.2;
      const t = time / period + noise(seed, k, 17);
      const cycle = Math.floor(t);
      const life = t - cycle;
      if (life > 0.7) continue;
      const [px, py, nx, ny] = along(noise(seed, k, cycle) * perimeter);
      const pick = noise(seed, k, cycle, 2);
      const r = pick < 0.5 ? 1 : pick < 0.8 ? 1.5 : pick < 0.93 ? 2.5 : 4;
      const out = 6 + Math.floor(noise(seed, k, cycle, 1) * 5) * 3;
      const x = px + nx * out;
      const y = py + ny * out;
      const tone = noise(seed, k, cycle, 3);
      const blink = life < 0.06 || (life > 0.32 && life < 0.36) ? 0.35 : 1;
      ctx.globalAlpha = a * eased * (0.3 + 0.55 * tone) * blink;
      if (tone < 0.3) {
        const arm = r + 1.5;
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

    // Dvě tečky s ocáskem obíhají obvod.
    for (let j = 0; j < 2; j++) {
      const head = (time * 0.21 + j * 0.5) * perimeter;
      for (let i = 0; i < 4; i++) {
        const [x, y] = along(head - i * 6);
        ctx.globalAlpha = a * eased * [0.95, 0.55, 0.32, 0.16][i];
        dot(x, y, i === 0 ? 1.6 : 1.1);
      }
    }

    // Popisek: skutečný rozměr banneru, jako „W × H PX" u MeasureText.
    if (s.natural.width && s.natural.height) {
      ctx.font = font;
      ctx.textAlign = "left";
      ctx.textBaseline = "bottom";
      ctx.globalAlpha = 0.75 * a * eased;
      if ("letterSpacing" in ctx) ctx.letterSpacing = "1.5px";
      ctx.fillText(`${s.natural.width} × ${s.natural.height} PX`, f.x1, f.y1 - 9);
      if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
    }
    ctx.globalAlpha = 1;
  };

  const placePanel = (s: OverlayState) => {
    const { x, y, angle, width } = s.anchor;
    panel.style.width = `${Math.max(width, 0)}px`;
    panel.style.transform = `translate(${x}px, ${y}px) rotate(${angle}rad)`;
    const show = s.focus > 0.5;
    if (show !== panelShown) {
      panelShown = show;
      panel.dataset.shown = show ? "true" : "false";
    }
  };

  const loop = (now: number) => {
    raf = 0;
    if (destroyed) return;
    resize();
    const time = now / 1000;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    const s = state;
    if (!s) {
      if (panelShown) {
        panelShown = false;
        panel.dataset.shown = "false";
      }
      return;
    }
    if (s.item !== shownItem) {
      shownItem = s.item;
      shownAt = time;
      options.onItem(s.item);
    }
    draw(s, time);
    placePanel(s);
    raf = requestAnimationFrame(loop);
  };

  return {
    update: (next) => {
      state = next;
      if (!next && shownItem !== null) {
        shownItem = null;
        options.onItem(null);
      }
      if (!raf && !destroyed) raf = requestAnimationFrame(loop);
    },
    rect: () => {
      const s = state;
      if (!s || s.focus < 0.05) return null;
      const f = frame(s);
      const box = root.getBoundingClientRect();
      return {
        left: box.left + f.x1,
        top: box.top + f.y1,
        right: box.left + f.x2,
        bottom: box.top + f.y2,
      };
    },
    destroy: () => {
      destroyed = true;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    },
  };
}
