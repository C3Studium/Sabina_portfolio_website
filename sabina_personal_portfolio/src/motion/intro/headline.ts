// Rámeček na nadpisu hera — jen v úvodu.
//
// Jeden bílý rámeček skáče po BÍLÉM textu nadpisu („Grafika pro"): jednou
// celé slovo, jindy písmeno nebo dvě, náhodně jako oko, které si text
// prohlíží. Před vstupem zelených slov se rámeček přelije do tvaru, který
// obejme všechna zelená slova najednou (lomený obrys přes jejich řádky),
// a uvnitř se tečkami obtáhnou slova, která právě přijdou. Když se slova
// vylijí (TextMorph), tečky zhasnou písmeno po písmenu — rámeček zůstane a
// slova dál obepíná. Jeden průběh, žádná smyčka: s druhým přelitím (`go`,
// už bez obrysu) se tvar přetvaruje na finální slova a rámeček zmizí.
//
// Vše se měří živě každý snímek — řádky během úvodu ještě vyjíždějí.

import {
  boundsOf,
  clamp01,
  corners,
  easeInOut,
  framePoly,
  glyphRuns,
  inkBox,
  label,
  lerpBox,
  lerpPoly,
  linear,
  pad,
  random,
  specks,
  stage,
  strokeGlyphs,
  textNode,
  type Box,
  type Layer,
  type Look,
  type Pt,
} from "./draw";
import { HEADLINE } from "./timeline";

/** Okraj rámečku kolem inkoustu písmen (px). */
const PAD = 10;
/**
 * Rámeček na bílém textu: přesně HOPS zastávek a přejezd mezi nimi trvá
 * GLIDE (s) — klidněji než přelití do zelených slov (HEADLINE.shape,
 * 0,5 s). Dřív tu bylo ~4 přeskoky po 0,14 s, které působily uspěchaně.
 */
const HOPS = 3;
const GLIDE = 0.8;
/**
 * Výraznost efektu — nadpis je v úvodu hlavní, portrét a bannery jen podklad
 * (ztlumené). Plná linka rámečku, větší a hustší tečky obrysu, plné popisky.
 */
const STRENGTH = { line: 0.95, lineWidth: 1.4, corner: 3, dot: 3.4, gap: 6, label: 1 };
/** Pravděpodobnost, že rámeček vezme celé slovo místo pár písmen. */
const WHOLE = 0.35;

type Target = { node: Text; from: number; to: number; text: string };
type Hop = { t: number; target: Target };

// Pásy řádků (jeden box na řádek) → lomený obrys po směru hodin, od levého
// horního rohu. Sousední pásy se potkají v polovině mezery mezi sebou.
const bandsOf = (boxes: Box[]): Box[] => {
  const rows: Box[] = [];
  for (const box of [...boxes].sort((a, b) => a.y - b.y)) {
    const row = rows.find((r) => Math.abs(r.y + r.h / 2 - (box.y + box.h / 2)) < Math.min(r.h, box.h) / 2);
    if (row) {
      const x = Math.min(row.x, box.x);
      const y = Math.min(row.y, box.y);
      row.w = Math.max(row.x + row.w, box.x + box.w) - x;
      row.h = Math.max(row.y + row.h, box.y + box.h) - y;
      row.x = x;
      row.y = y;
    } else {
      rows.push({ ...box });
    }
  }
  for (let i = 0; i < rows.length - 1; i++) {
    const a = rows[i];
    const b = rows[i + 1];
    // Pásy, které se vodorovně nepřekrývají, by daly zkřížený obrys —
    // pak jeden společný box.
    if (a.x > b.x + b.w || b.x > a.x + a.w) {
      return [boundsOf(rows.flatMap(corners))];
    }
    const m = (a.y + a.h + b.y) / 2;
    const bottom = b.y + b.h;
    a.h = m - a.y;
    b.y = m;
    b.h = bottom - m;
  }
  return rows;
};

const polyOf = (bands: Box[]): Pt[] => {
  const right: Pt[] = [];
  const left: Pt[] = [];
  for (const b of bands) {
    right.push([b.x + b.w, b.y], [b.x + b.w, b.y + b.h]);
    left.push([b.x, b.y], [b.x, b.y + b.h]);
  }
  left.reverse();
  return [left[left.length - 1], ...right, ...left.slice(0, -1)];
};

// Obdélník přepsaný do stejné stavby vrcholů jako lomený obrys — aby se
// jeden dal plynule přelít do druhého.
const rectAs = (rect: Box, bands: Box[]): Pt[] => {
  const top = bands[0].y;
  const span = bands[bands.length - 1].y + bands[bands.length - 1].h - top || 1;
  const mapY = (y: number) => rect.y + ((y - top) / span) * rect.h;
  return polyOf(
    bands.map((b) => {
      const y = mapY(b.y);
      return { x: rect.x, y, w: rect.w, h: mapY(b.y + b.h) - y };
    }),
  );
};

export function createHeadline(look: Look): Layer | null {
  const h1 = Array.from(document.querySelectorAll<HTMLElement>("main h1")).find((el) =>
    el.querySelector("[data-morph-word]"),
  );
  if (!h1) return null;
  const measure = document.createElement("canvas").getContext("2d");
  if (!measure) return null;

  const roots = Array.from(
    new Set(Array.from(h1.querySelectorAll("[data-morph-word]"), (word) => word.parentElement!)),
  );

  // Bílá slova: textové uzly mimo zvýraznění, jen s písmeny (bez tečky).
  const words: Target[] = [];
  const walker = document.createTreeWalker(h1, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node as Text;
    if (text.parentElement?.closest(".hl, [data-morph-word]")) continue;
    for (const match of text.data.matchAll(/\p{L}+/gu)) {
      words.push({ node: text, from: match.index!, to: match.index! + match[0].length, text: match[0] });
    }
  }

  // Skoky rámečku — náhodně, každé načtení jinak, v rámci úvodu stálé.
  const rng = random(Math.floor(Math.random() * 2 ** 32));
  const pick = (previous: Target | null): Target => {
    for (let tries = 0; tries < 6; tries++) {
      const word = words[Math.floor(rng() * words.length)];
      const length = word.to - word.from;
      let target = word;
      if (length > 1 && rng() > WHOLE) {
        const size = 1 + Math.floor(rng() * Math.min(3, length - 1));
        const from = word.from + Math.floor(rng() * (length - size + 1));
        target = { node: word.node, from, to: from + size, text: word.node.data.slice(from, from + size) };
      }
      if (!previous || previous.node !== target.node || previous.from !== target.from || previous.to !== target.to) {
        return target;
      }
    }
    return words[0];
  };
  const hops: Hop[] = [];
  if (words.length) {
    // První zastávka stojí od začátku okna, každý další přejezd končí na
    // pravidelném dílku okna — poslední přesně s jeho koncem, kdy se
    // rámeček začne přelévat do zelených slov. Celková délka úvodu se
    // nemění.
    const [start, end] = HEADLINE.hops;
    const step = (end - start) / Math.max(HOPS - 1, 1);
    for (let i = 0; i < HOPS; i++) {
      const t = i === 0 ? start : Math.max(start, start + i * step - GLIDE);
      hops.push({ t, target: pick(hops.at(-1)?.target ?? null) });
    }
  }

  const boxOf = (target: Target) => {
    const glyphs = glyphRuns(measure, target.node, target.from, target.to);
    const ink = glyphs && inkBox(measure, glyphs);
    return ink ? pad(ink, PAD) : null;
  };

  // k-té slovo každého TextMorph (0 = první kombinace, 1 = finální slova).
  const wordsAt = (k: number) =>
    roots.flatMap((root) => {
      const span = root.querySelectorAll("[data-morph-word]")[k];
      const node = textNode(span ?? null);
      const glyphs = node && glyphRuns(measure, node);
      const ink = glyphs && inkBox(measure, glyphs);
      return glyphs && ink ? [{ glyphs, ink, text: node.data.trim() }] : [];
    });
  type Words = ReturnType<typeof wordsAt>;
  const shapeOf = (list: Words) => (list.length ? bandsOf(list.map(({ ink }) => pad(ink, PAD))) : []);

  const upper = (text: string) => text.toLocaleUpperCase(document.documentElement.lang || undefined);
  const names = (list: Words) => list.map(({ text }) => upper(text)).join(" / ");

  const draw = (ctx: CanvasRenderingContext2D, t: number) => {
    const fade = 1 - stage(t, HEADLINE.fade);
    if (t < HEADLINE.hops[0] || fade <= 0.001) return;

    const first = wordsAt(0);
    const bands = shapeOf(first);

    // Kde je rámeček na bílém textu (a co v něm je).
    let hopBox: Box | null = null;
    let hopText = "";
    if (hops.length) {
      let i = 0;
      while (i + 1 < hops.length && hops[i + 1].t <= t) i++;
      const current = boxOf(hops[i].target);
      const u = i > 0 ? easeInOut(clamp01((t - hops[i].t) / GLIDE)) : 1;
      const previous = i > 0 ? boxOf(hops[i - 1].target) : null;
      hopBox = previous && current ? lerpBox(previous, current, u) : current;
      hopText = u < 0.5 && i > 0 ? hops[i - 1].target.text : hops[i].target.text;
    }

    // Přelití do tvaru zelených slov; s druhým přelitím (`go`) se tvar
    // přetvaruje na finální slova. Jiný počet řádků = rovnou nový tvar.
    const shape = bands.length ? stage(t, HEADLINE.shape) : 0;
    const reshape = stage(t, HEADLINE.reshape);
    const final = reshape > 0 ? wordsAt(1) : [];
    const finalBands = shapeOf(final);
    let pts: Pt[] | null = null;
    if (bands.length && (shape > 0 || !hopBox)) {
      let goal = polyOf(bands);
      if (finalBands.length) {
        const next = polyOf(finalBands);
        goal = next.length === goal.length ? lerpPoly(goal, next, reshape) : next;
      }
      pts = hopBox && shape < 1 ? lerpPoly(rectAs(hopBox, bands), goal, shape) : goal;
    } else if (hopBox) {
      pts = corners(hopBox);
    }
    if (!pts) return;

    // Rámeček se při prvním skoku obtáhne; bez bílých slov až při přelití.
    const traceIn = hops.length ? linear(t, [HEADLINE.hops[0], HEADLINE.hops[0] + 0.3]) : linear(t, HEADLINE.shape);
    framePoly(ctx, pts, traceIn, fade, look, STRENGTH.corner, STRENGTH.line, STRENGTH.lineWidth);
    specks(ctx, pts, clamp01(traceIn * 2 - 1) * fade, t, look.mark, 51, 8);

    // Popisek nad levým horním vrcholem: na bílém textu co a jak velké, po
    // přelití která zelená slova obepíná.
    const bounds = boundsOf(pts);
    const size = `${Math.round(bounds.w)} × ${Math.round(bounds.h)} PX`;
    const before = 1 - clamp01((shape - 0.3) / 0.2);
    const after = clamp01((shape - 0.5) / 0.2);
    const [lx, ly] = pts[0];
    if (hopText) label(ctx, `${upper(hopText)} · ${size}`, lx, ly - 6, STRENGTH.label * before * fade, look.mark, 10, "bottom");
    if (first.length) {
      const text = reshape > 0.5 && final.length ? names(final) : names(first);
      label(ctx, `${text} · ${size}`, lx, ly - 6, STRENGTH.label * after * fade, look.accent, 10, "bottom");
    }

    // Tečkovaný obrys slov první kombinace — jen jednou, před prvním
    // přelitím. Zhasíná po písmenech v rytmu, jakým je přelévá TextMorph.
    if (t < HEADLINE.first + 1) {
      const wordsIn = linear(t, HEADLINE.words);
      for (const { glyphs } of first) {
        strokeGlyphs(ctx, glyphs, wordsIn, 1, look.accent, STRENGTH.dot, STRENGTH.gap, (i, n) => {
          const start = HEADLINE.first + 0.05 + (0.35 * i) / n;
          return 1 - linear(t, [start, start + 0.4]);
        });
      }
    }
  };

  return { layout: () => {}, draw };
}
