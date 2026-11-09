// Info — stavební kousky nástupu sekce řízeného scrollem.
//
// Stejný jazyk jako stavba bannerů v heru (motion/intro: banners.ts,
// layered.ts), jen v DOMu:
//
//   1. ořezové značky sjedou k rohům
//   2. čárkovaný rámeček se obtáhne po obvodu, v rozích naskočí zelené
//      tečky, nad ním popisek (rozměr nebo štítek vrstvy „T · …")
//   3. obsah se nakreslí zelenou konturou — měkké čelo, ne tvrdý řez
//   4. skutečný obsah se stejně měkce prolne přes konturu, kontura zmizí
//   5. rámeček, značky a popisek zhasnou — zůstane čistý obsah
//
// Všechno bere `progress` (MotionValue 0–1 přišpendleného úseku Info)
// a vlastní okno [from, to] v něm — nástup jde se scrollem tam i zpátky.
// Průhlednosti a masky se počítají FUNKCÍ, ne rozsahem: rozsah Framer
// Motion u opacity převádí na nativní scroll animaci, která v přišpendlené
// sekci počítá špatně (viz hero).

import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { motion, useTransform, type MotionValue } from "framer-motion";
import styles from "./styles.module.scss";

/** 0–1 podle polohy `p` v okně [from, to]. */
export const span = (from: number, to: number) => (p: number) =>
  Math.min(Math.max((p - from) / (to - from), 0), 1);

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Části okna jedné stavby (podíly délky okna). */
const PHASE = {
  marks: [0, 0.25],
  trace: [0.05, 0.45],
  label: [0.28, 0.45],
  sketch: [0.2, 0.6],
  fill: [0.45, 0.9],
  out: [0.85, 1],
} as const;

/** Měkkost čela odhalení (podíl rozměru) — jako `soft` v layered.ts. */
const SOFT = 0.18;

/**
 * Maska odhalující ve směru `dir` s měkkým čelem: 0 = nic, 1 = celé.
 * Jako čelo výplně v shaderu bannerů — žádný tvrdý řez.
 */
export const softMask = (v: number, dir = "90deg") => {
  const pos = v * (1 + SOFT);
  return `linear-gradient(${dir}, #000 ${((pos - SOFT) * 100).toFixed(2)}%, transparent ${(pos * 100).toFixed(2)}%)`;
};

/** Úsek fáze v okně [from, to]. */
const phase = (from: number, to: number, [a, b]: readonly [number, number]) => {
  const len = to - from;
  return span(from + len * a, from + len * b);
};

/** Rozměr rodiče (ResizeObserver) — pro rámečky kreslené v SVG. */
function useParentBox<T extends Element>() {
  const ref = useRef<T>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const parent = ref.current?.parentElement;
    if (!parent) return;
    const measure = () => setBox({ w: parent.offsetWidth, h: parent.offsetHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(parent);
    return () => observer.disconnect();
  }, []);
  return [ref, box] as const;
}

type FrameProps = {
  progress: MotionValue<number>;
  from: number;
  to: number;
  /** Štítek vrstvy (zeleně, např. „T · Vizuály, které"). */
  tag?: string;
  /** Rozměr „Š × V PX" (bíle) — u velkých bloků. */
  size?: boolean;
  /** Ořezové značky v rozích. */
  marks?: boolean;
  /** Pilulka: zaoblené rohy, bez teček v rozích. */
  round?: boolean;
  /** Odsazení rámečku od obsahu (px). */
  pad?: number;
  /** Zůstat i po stavbě (jen značky a popisek zhasnou). */
  keep?: boolean;
};

/**
 * Rámeček stavby kolem rodiče (rodič musí být pozicovaný): ořezové značky,
 * čárkovaný obvod obtažený od levého horního rohu po směru hodin, zelené
 * tečky v rozích, popisek nad ním. Na konci okna zhasne.
 */
export function BuildFrame({ progress, from, to, tag, size, marks = false, round = false, pad = 0, keep = false }: FrameProps) {
  const id = useId().replace(/:/g, "");
  const [ref, box] = useParentBox<SVGSVGElement>();
  const w = Math.max(box.w + pad * 2 - 1, 0);
  const h = Math.max(box.h + pad * 2 - 1, 0);
  const rx = round ? h / 2 : 0;
  // Rozměry pro výpočty v motion values — čtou se při každé změně postupu,
  // takže po změně velikosti vždy aktuální (ne ze zachyceného renderu).
  const per = 2 * (w + h) || 1;
  const geom = useRef({ w, h, corners: [0, 0, 0, 0] });
  useEffect(() => {
    geom.current = { w, h, corners: [0, w / per, (w + h) / per, (2 * w + h) / per] };
  }, [w, h, per]);

  const out = useTransform(progress, (p) => 1 - phase(from, to, PHASE.out)(p));
  const marksIn = useTransform(progress, (p) => easeOut(phase(from, to, PHASE.marks)(p)));
  const trace = useTransform(progress, (p) => easeInOut(phase(from, to, PHASE.trace)(p)));
  const labelIn = useTransform(progress, (p) => phase(from, to, PHASE.label)(p));
  const frameOpacity = useTransform([out, trace] as const, ([o, t]: number[]) => (keep ? 1 : o) * (t > 0 ? 1 : 0));
  const marksOpacity = useTransform([out, marksIn] as const, ([o, m]: number[]) => o * m);
  const labelOpacity = useTransform([out, labelIn] as const, ([o, l]: number[]) => o * l);

  // Ořezové značky: z dálky (16 px) sjedou k rohům (5 px).
  const marksPath = useTransform(marksIn, (m) => {
    const { w, h } = geom.current;
    const gap = 16 - 11 * m;
    const arm = 9;
    const x0 = 0.5;
    const y0 = 0.5;
    const x1 = w + 0.5;
    const y1 = h + 0.5;
    return [
      [x0, y0, -1, -1],
      [x1, y0, 1, -1],
      [x1, y1, 1, 1],
      [x0, y1, -1, 1],
    ]
      .map(
        ([cx, cy, sx, sy]) =>
          `M${cx + sx * gap} ${cy}H${cx + sx * (gap + arm)}M${cx} ${cy + sy * gap}V${cy + sy * (gap + arm)}`,
      )
      .join("");
  });

  // Tečky v rozích naskočí, jak k nim obtahování dojde (podíl obvodu).
  const dotAt = (i: number) => ([t, o]: number[]) =>
    t > 0 && t >= geom.current.corners[i] - 1e-3 ? (keep ? 1 : o) : 0;
  const dot0 = useTransform([trace, out] as const, dotAt(0));
  const dot1 = useTransform([trace, out] as const, dotAt(1));
  const dot2 = useTransform([trace, out] as const, dotAt(2));
  const dot3 = useTransform([trace, out] as const, dotAt(3));
  const dotOpacity = [dot0, dot1, dot2, dot3];

  const label = [tag, size && box.w ? `${Math.round(box.w)} × ${Math.round(box.h)} PX` : null].filter(Boolean).join(" · ");

  return (
    <>
      <svg
        ref={ref}
        className={styles.buildFrame}
        style={{ inset: -pad, width: `calc(100% + ${pad * 2}px)`, height: `calc(100% + ${pad * 2}px)` } as CSSProperties}
        aria-hidden="true"
      >
        {box.w > 0 ? (
          <>
            <defs>
              <mask id={`trace-${id}`} maskUnits="userSpaceOnUse" x={-20} y={-20} width={w + 40} height={h + 40}>
                <motion.rect
                  x={0.5}
                  y={0.5}
                  width={w}
                  height={h}
                  rx={rx}
                  fill="none"
                  stroke="#fff"
                  strokeWidth={3}
                  style={{ pathLength: trace }}
                />
              </mask>
            </defs>
            {marks ? <motion.path className={styles.buildMarks} d={marksPath} style={{ opacity: marksOpacity }} /> : null}
            <motion.rect
              className={styles.buildGuide}
              x={0.5}
              y={0.5}
              width={w}
              height={h}
              rx={rx}
              mask={`url(#trace-${id})`}
              style={{ opacity: frameOpacity }}
            />
            {round
              ? null
              : [
                  [0.5, 0.5],
                  [w + 0.5, 0.5],
                  [w + 0.5, h + 0.5],
                  [0.5, h + 0.5],
                ].map(([cx, cy], i) => (
                  <motion.circle key={i} className={styles.buildDot} cx={cx} cy={cy} r={2.4} style={{ opacity: dotOpacity[i] }} />
                ))}
          </>
        ) : null}
      </svg>
      {label ? (
        <motion.span
          className={styles.buildLabel}
          data-tag={tag ? "" : undefined}
          style={{ opacity: labelOpacity, left: -pad, top: -pad }}
          aria-hidden="true"
        >
          {label}
        </motion.span>
      ) : null}
    </>
  );
}

/**
 * Obsah, který se postaví jako vrstva banneru: (rámeček se štítkem,)
 * zelená kontura s měkkým čelem zleva, pak přes ni stejně měkce skutečný
 * obsah; kontura zhasne. Obrys je TENTÝŽ obsah podruhé (`ghost`, výchozí =
 * children) přebarvený na konturu — sedí přesně na písmena i ikony.
 * `still` = bez stavby, jen obsah (editační rám Studia: žádné zdvojení).
 */
export function SketchText({
  progress,
  from,
  to,
  ghost,
  tag,
  still = false,
  as = "span",
  className,
  style,
  children,
  ...rest
}: {
  progress: MotionValue<number>;
  from: number;
  to: number;
  ghost?: ReactNode;
  /** Štítek vrstvy — rámeček kolem textu jako v bannerech („T · …"). */
  tag?: string;
  still?: boolean;
  as?: "span" | "p" | "a" | "li";
  className?: string;
  style?: Record<string, unknown>;
  children: ReactNode;
} & Record<string, unknown>) {
  const sketch = useTransform(progress, (p) => easeOut(phase(from, to, PHASE.sketch)(p)));
  const fill = useTransform(progress, (p) => easeInOut(phase(from, to, PHASE.fill)(p)));
  const outlineMask = useTransform(sketch, (v) => softMask(v));
  const outlineOpacity = useTransform(fill, (f) => 1 - f);
  // Hotová výplň bez masky: maska ořezává i to, co z prvku přesahuje
  // (rozbalený seznam, stín), a postavený obsah se má chovat jako obyčejný.
  const fillMask = useTransform(fill, (v) => (v >= 1 ? "none" : softMask(v)));
  const Tag = motion[as] as typeof motion.span;
  if (still) {
    return (
      <Tag className={className} style={style} {...rest}>
        {children}
      </Tag>
    );
  }
  return (
    <Tag className={[styles.sketchText, className].filter(Boolean).join(" ")} style={style} {...rest}>
      {tag ? <BuildFrame progress={progress} from={from} to={to} tag={tag} pad={6} /> : null}
      <motion.span
        className={styles.sketchOutline}
        style={{ maskImage: outlineMask, WebkitMaskImage: outlineMask, opacity: outlineOpacity }}
        aria-hidden="true"
      >
        {ghost ?? children}
      </motion.span>
      <motion.span className={styles.sketchFill} style={{ maskImage: fillMask, WebkitMaskImage: fillMask }}>
        {children}
      </motion.span>
    </Tag>
  );
}

/** Řádek nadpisu: zvolna se usadí zespodu a postaví se jako SketchText. */
export function RiseLine({
  progress,
  from,
  to,
  ghost,
  tag,
  className,
  children,
}: {
  progress: MotionValue<number>;
  from: number;
  to: number;
  ghost?: ReactNode;
  tag?: string;
  className?: string;
  children: ReactNode;
}) {
  const t = useTransform(progress, span(from, to));
  const y = useTransform(t, (v) => `${(1 - easeOut(v)) * 0.2}em`);
  return (
    <SketchText
      progress={progress}
      from={from}
      to={to}
      ghost={ghost}
      tag={tag}
      className={className}
      style={{ display: "block", y }}
    >
      {children}
    </SketchText>
  );
}

type PillProps = {
  progress: MotionValue<number>;
  from: number;
  to: number;
  /** `true` = bez stavby (editační rám Studia). */
  still?: boolean;
  className?: string;
  children: ReactNode;
} & Record<string, unknown>;

/**
 * Pilulka jako vrstva banneru: čárkovaný obrys se obtáhne, obsah se
 * nakreslí konturou a pak se měkce prolne plná pilulka.
 */
export function BuildPill({ progress, from, to, still = false, className, children, ...rest }: PillProps) {
  const sketch = useTransform(progress, (p) => easeOut(phase(from, to, PHASE.sketch)(p)));
  const fill = useTransform(progress, (p) => easeInOut(phase(from, to, PHASE.fill)(p)));
  const outlineMask = useTransform(sketch, (v) => softMask(v));
  const outlineOpacity = useTransform(fill, (f) => 1 - f);
  const fillMask = useTransform(fill, (v) => softMask(v));

  if (still) {
    return (
      <li className={[styles.buildPill, className].filter(Boolean).join(" ")} {...rest}>
        <span className={styles.pillSolid}>
          <span className={styles.pillFill} aria-hidden="true" />
          <span className={styles.pillBody}>{children}</span>
        </span>
      </li>
    );
  }
  return (
    <li className={[styles.buildPill, className].filter(Boolean).join(" ")} {...rest}>
      <BuildFrame progress={progress} from={from} to={to} round />
      <motion.span
        className={`${styles.pillBody} ${styles.sketchOutline}`}
        style={{ maskImage: outlineMask, WebkitMaskImage: outlineMask, opacity: outlineOpacity }}
        aria-hidden="true"
      >
        {children}
      </motion.span>
      <motion.span className={styles.pillSolid} style={{ maskImage: fillMask, WebkitMaskImage: fillMask }}>
        <span className={styles.pillFill} aria-hidden="true" />
        <span className={styles.pillBody}>{children}</span>
      </motion.span>
    </li>
  );
}

/**
 * Pás lišty statistik: rámeček přes celou šířku se obtáhne, pak se zleva
 * měkce prolne tmavá výplň.
 */
export function SketchBar({
  progress,
  from,
  to,
  className,
}: {
  progress: MotionValue<number>;
  from: number;
  to: number;
  className?: string;
}) {
  const fill = useTransform(progress, (p) => easeInOut(phase(from, to, PHASE.fill)(p)));
  const fillMask = useTransform(fill, (v) => softMask(v));
  return (
    <>
      <BuildFrame progress={progress} from={from} to={to} size />
      <motion.span className={className} style={{ maskImage: fillMask, WebkitMaskImage: fillMask }} aria-hidden="true" />
    </>
  );
}

/**
 * Velký blok (karty služeb) jako banner: ořezové značky, rámeček s
 * rozměrem a štítkem, mřížka třetin; obsah se pak měkce prolne shora.
 * `frame` patří do pozicovaného obalu, `reveal` jde na obsah (maska), aby
 * 3D natočení obsahu zůstalo nedotčené.
 */
export function useBlockBuild(progress: MotionValue<number>, from: number, to: number) {
  const fill = useTransform(progress, (p) => easeInOut(phase(from, to, PHASE.fill)(p)));
  const mask = useTransform(fill, (v) => softMask(v, "180deg"));
  const grid = useTransform(progress, (p) => {
    const g = easeOut(phase(from, to, [0.1, 0.35])(p));
    const gone = phase(from, to, [0.6, 0.85])(p);
    return g * (1 - gone);
  });
  return { mask, grid };
}

/** Mřížka třetin uvnitř bloku (jako mřížka v bannerech). */
export function BuildGrid({ opacity }: { opacity: MotionValue<number> }) {
  return (
    <motion.span className={styles.buildGrid} style={{ opacity }} aria-hidden="true">
      <span />
      <span />
      <span />
      <span />
    </motion.span>
  );
}

/* ---------- Pilulka jako odkaz hlavičky v preloaderu ---------- */

type NavPillProps = {
  progress: MotionValue<number>;
  /** Okno stavby obsahu. */
  build: readonly [number, number];
  /**
   * Duplikát (Alt-tah v editoru): okno [chycení, puštění], kdy se pilulka
   * jako KOPIE předchozí táhne z jejího místa na své. Pak se přepíše na
   * vlastní obsah. Bez něj se staví jako odkaz hlavičky (linka, rámeček
   * se rozevře, číslo, kontura, výplň).
   */
  dup?: readonly [number, number];
  /** Obsah předchozí pilulky — kopie během tahu. */
  copy?: ReactNode;
  /** Okno odchodu (rámeček naskočí, pilulka zhasne). */
  out?: readonly [number, number];
  /** Okamžik smazání (Delete) — pilulka zmizí. */
  removeAt?: number;
  index: number;
  still?: boolean;
  className?: string;
  children: ReactNode;
} & Record<string, unknown>;

export function NavPill({ progress, build, dup, copy, out, removeAt, index, still = false, className, children, ...rest }: NavPillProps) {
  const exit = useExit(progress, out ?? [2, 3]);
  const ref = useRef<HTMLLIElement>(null);
  // Rozteč pilulek (od předchozí) — o tolik se duplikát táhne. Obě osy:
  // na monitoru jsou pilulky pod sebou, na tabletu na výšku v řadě.
  const pitch = useRef({ x: 0, y: 0 });
  useEffect(() => {
    const el = ref.current;
    const prev = el?.previousElementSibling as HTMLElement | null;
    if (!el || !prev) return;
    const measure = () => {
      pitch.current = { x: el.offsetLeft - prev.offsetLeft, y: el.offsetTop - prev.offsetTop };
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const [from, to] = build;
  const at = (a: number, b: number) => phase(from, to, [a, b]);
  const shown = useTransform(progress, (p) => {
    const on = dup ? (p >= dup[0] ? 1 : 0) : p > from ? 1 : 0;
    return removeAt === undefined ? on : on * (1 - span(removeAt, removeAt + 0.004)(p));
  });
  const x = useTransform(progress, (p) =>
    dup ? -pitch.current.x * (1 - easeInOut(span(dup[0], dup[1])(p))) : 0,
  );
  const y = useTransform(progress, (p) =>
    dup ? -pitch.current.y * (1 - easeInOut(span(dup[0], dup[1])(p))) : 0,
  );
  const line = useTransform(progress, (p) => easeOut(at(0, 0.3)(p)));
  const lineOpacity = useTransform(progress, (p) => (p > from ? 1 - at(0.5, 0.75)(p) : 0));
  const open = useTransform(progress, (p) => easeInOut(at(0.12, 0.42)(p)));
  const frameOut = useTransform(progress, (p) => (p > from ? 1 - at(0.8, 1)(p) : 0));
  const number = useTransform(progress, (p) => at(0.2, 0.38)(p) * (1 - at(0.85, 1)(p)));
  const sketch = useTransform(progress, (p) => easeOut(at(0.3, 0.65)(p)));
  const fill = useTransform(progress, (p) => easeInOut(at(0.55, 0.95)(p)));
  const outlineMask = useTransform(sketch, (v) => softMask(v));
  const outlineOpacity = useTransform(fill, (f) => 1 - f);
  const fillMask = useTransform(fill, (v) => softMask(v));
  const copyLayer = useTransform(fill, (f) => (f >= 1 ? 0 : 1));
  const copyContent = useTransform(progress, (p) => 1 - at(0.15, 0.4)(p));

  if (still) {
    return (
      <li className={[styles.buildPill, className].filter(Boolean).join(" ")} {...rest}>
        <span className={styles.pillSolid}>
          <span className={styles.pillFill} aria-hidden="true" />
          <span className={styles.pillBody}>{children}</span>
        </span>
      </li>
    );
  }
  return (
    <motion.li
      ref={ref}
      className={[styles.buildPill, className].filter(Boolean).join(" ")}
      style={{ opacity: shown, x, y }}
      {...rest}
    >
      {dup ? (
        <>
          {/* Kopie předchozí pilulky — dokud se nepřepíše na vlastní. */}
          <motion.span className={styles.pillSolid} style={{ opacity: copyLayer }} aria-hidden="true">
            <span className={styles.pillFill} />
            <motion.span className={styles.pillBody} style={{ opacity: copyContent }}>
              {copy}
            </motion.span>
          </motion.span>
        </>
      ) : (
        <>
          {/* Linka přes střed (jako linka hlavičky) a rámeček, který se z ní rozevře. */}
          <motion.span className={styles.navLine} style={{ scaleX: line, opacity: lineOpacity }} aria-hidden="true" />
          <motion.span className={styles.navOpen} style={{ scaleY: open, opacity: frameOut }} aria-hidden="true" />
        </>
      )}
      <motion.span className={styles.navNumber} style={{ opacity: number }} aria-hidden="true">
        {String(index + 1).padStart(2, "0")}
      </motion.span>
      <motion.span
        className={`${styles.pillBody} ${styles.sketchOutline}`}
        style={{ maskImage: outlineMask, WebkitMaskImage: outlineMask, opacity: outlineOpacity }}
        aria-hidden="true"
      >
        {children}
      </motion.span>
      <motion.span
        className={styles.pillSolid}
        style={{ maskImage: fillMask, WebkitMaskImage: fillMask, opacity: exit.content }}
      >
        <span className={styles.pillFill} aria-hidden="true" />
        <span className={styles.pillBody}>{children}</span>
      </motion.span>
      {out ? <ExitFrame opacity={exit.frame} round pad={4} /> : null}
    </motion.li>
  );
}

/* ---------- Rámeček nakreslený tahem (nástroj Rámeček v editoru) ---------- */

/**
 * Rámeček, který se kreslí z levého horního rohu tahem do pravého dolního
 * (`draw` 0–1), s živým rozměrem v popisku; po nakreslení ořezové značky.
 * Celý zhasne v `fade` okně.
 */
export function DrawFrame({
  draw,
  marks,
  fade,
  label,
  pad = 10,
}: {
  draw: MotionValue<number>;
  marks: MotionValue<number>;
  fade: MotionValue<number>;
  label: string;
  pad?: number;
}) {
  const [ref, box] = useParentBox<SVGSVGElement>();
  const W = Math.max(box.w + pad * 2 - 1, 0);
  const H = Math.max(box.h + pad * 2 - 1, 0);
  const size = useRef({ W, H });
  useEffect(() => {
    size.current = { W, H };
  }, [W, H]);
  const w = useTransform(draw, (d) => Math.max(size.current.W * d, 0));
  const h = useTransform(draw, (d) => Math.max(size.current.H * d, 0));
  const right = useTransform(w, (v) => v + 0.5);
  const bottom = useTransform(h, (v) => v + 0.5);
  const shown = useTransform([draw, fade] as const, ([d, f]: number[]) => (d > 0 ? f : 0));
  const marksOpacity = useTransform([marks, fade] as const, ([m, f]: number[]) => m * f);
  const marksPath = useTransform(marks, (m) => {
    const { W, H } = size.current;
    const gap = 16 - 11 * m;
    const arm = 10;
    return [
      [0.5, 0.5, -1, -1],
      [W + 0.5, 0.5, 1, -1],
      [W + 0.5, H + 0.5, 1, 1],
      [0.5, H + 0.5, -1, 1],
    ]
      .map(
        ([cx, cy, sx, sy]) =>
          `M${cx + sx * gap} ${cy}H${cx + sx * (gap + arm)}M${cx} ${cy + sy * gap}V${cy + sy * (gap + arm)}`,
      )
      .join("");
  });
  const text = useTransform(
    draw,
    (d) => `${label} · ${Math.round(Math.max(box.w * d, 0))} × ${Math.round(Math.max(box.h * d, 0))} PX`,
  );
  return (
    <>
      <svg
        ref={ref}
        className={styles.buildFrame}
        style={{ inset: -pad, width: `calc(100% + ${pad * 2}px)`, height: `calc(100% + ${pad * 2}px)` }}
        aria-hidden="true"
      >
        {box.w > 0 ? (
          <motion.g style={{ opacity: shown }}>
            <motion.rect className={styles.buildGuide} x={0.5} y={0.5} width={w} height={h} />
            <motion.path className={styles.buildMarks} d={marksPath} style={{ opacity: marksOpacity }} />
            <circle className={styles.buildDot} cx={0.5} cy={0.5} r={2.6} />
            <motion.circle className={styles.buildDot} cx={right} cy={0.5} r={2.6} />
            <motion.circle className={styles.buildDot} cx={right} cy={bottom} r={2.6} />
            <motion.circle className={styles.buildDot} cx={0.5} cy={bottom} r={2.6} />
          </motion.g>
        ) : null}
      </svg>
      <motion.span className={styles.buildLabel} style={{ opacity: shown, left: -pad, top: -pad }} aria-hidden="true">
        {text}
      </motion.span>
    </>
  );
}

/* ---------- Odchod: rámeček se objeví a s obsahem zhasne ---------- */

/**
 * Odchod prvku jako obrácená stavba (bez myši): kolem prvku naskočí
 * čárkovaný rámeček s tečkami v rozích, obsah pod ním zhasne a nakonec
 * zhasne i rámeček. `content` jde na obsah (opacity), `frame` na ExitFrame.
 */
export function useExit(progress: MotionValue<number>, [a, b]: readonly [number, number]) {
  const len = b - a;
  const content = useTransform(progress, (p) => 1 - easeInOut(span(a + len * 0.25, a + len * 0.85)(p)));
  const frame = useTransform(
    progress,
    (p) => easeOut(span(a, a + len * 0.3)(p)) * (1 - span(a + len * 0.7, b)(p)),
  );
  return { content, frame };
}

/** Rámeček odchodu kolem pozicovaného rodiče. `round` = pilulka. */
export function ExitFrame({ opacity, round = false, pad = 6 }: { opacity: MotionValue<number>; round?: boolean; pad?: number }) {
  return (
    <motion.span
      className={styles.exitFrame}
      data-round={round ? "" : undefined}
      style={{ opacity, inset: -pad }}
      aria-hidden="true"
    >
      {round ? null : (
        <>
          <span data-at="tl" />
          <span data-at="tr" />
          <span data-at="br" />
          <span data-at="bl" />
        </>
      )}
    </motion.span>
  );
}

/** Smazání (Delete): obsah zmizí skoro hned — jako v editoru. */
export function useRemoved(progress: MotionValue<number>, at: number) {
  return useTransform(progress, (p) => 1 - span(at, at + 0.004)(p));
}
