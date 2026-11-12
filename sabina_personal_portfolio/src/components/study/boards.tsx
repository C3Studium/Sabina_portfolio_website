// Artboardy případové studie (plátno je v index.tsx).
//
// Každá kapitola má vlastní asymetrické rozvržení na mřížce: velký
// dvoubarevný nadpis v úzkém sloupci, díla v širokém. Díla nese vždy
// jeden jednoduchý prvek z webu, který scroll posouvá:
//
//   Titulní    tři story do hloubky (dolly) — vpředu největší, scroll je
//              rozjede různou rychlostí
//   Pro rodiče balíček karet (jako na homepage) — scroll střídá přední
//   Kampaně    pás od nové kolekce po Black Friday — scroll jím projede,
//              pod ním mapa celého pásu po druzích kampaní
//   Důvěra     kolotoč čtyř bannerů — scroll ho otočí
//   Výstupy    editor: plocha s formáty (tah, zoom, výběr), Vrstvy,
//              Vlastnosti, výzva
//
// Sabinin text se pod nadpisem VYPISUJE (Typed), když kamera k artboardu
// dojede. Přes díla jsou nalepené POZNÁMKY (světlý lístek s páskou) s
// krátkými postřehy navíc. Na výšku se text pod nadpis nevejde — jde do
// poznámek místo postřehů.
//
// Text je ostrý: velikosti v px artboardu (cqw), s minimem na obrazovce
// `X / var(--cam-s)`; kamera stojí na celých px (index.tsx).
// Vrstvy artboardu (`data-z`) se při přejezdu kamery zvednou nad sebe.
// NDA: žádné názvy písem ani kódy barev klienta.

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import Image from "next/image";
import { motion, useMotionValueEvent, useTransform, type MotionStyle, type MotionValue } from "framer-motion";
import type { StudyContent, StudyPart, StudyWork } from "./content";
import { useInspect } from "./inspector";
import MeasureText from "@/components/common/measure-text";
import styles from "./styles.module.scss";

export const ENTRANCE = [0.22, 1, 0.36, 1] as const;
export const clamp01 = (v: number) => Math.min(Math.max(v, 0), 1);
export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
/** Úsek [a, b] průběhu → 0–1. */
export const span = (v: number, a: number, b: number) => clamp01((v - a) / (b - a));

export type Rect = { x: number; y: number; w: number; h: number };

export type BoardProps = {
  c: StudyContent;
  /** Průběh zastávky artboardu ze scrollu (0–1). */
  act: MotionValue<number>;
  /** Rozměr artboardu ve světových px. */
  rect: Rect;
  go: boolean;
  reduce: boolean;
  /** Kamera už k artboardu dojela (nebo je za ním). */
  seen: boolean;
  /** Průběh scrollu celé studie (useScroll) — vstup pro nativní osu scrollu. */
  progress: MotionValue<number>;
  /** Kde v `progress` stání artboardu leží: act 0 → range[0], act 1 → range[1]. */
  range: [number, number];
  /** Safari na dotyku: pohyby děl jedou na nativní ose scrollu (viz useBoardMotion). */
  native: boolean;
};

/**
 * Plynulý pohyb ze scrollu stání artboardu jako `transform` řetězec.
 * Na dotyku (`native`) z nativní osy scrollu: `useTransform(progress, časy,
 * snímky)` → framer-motion ho předá Safari a ten dílo posouvá ve stejném
 * snímku jako scroll. Jinak motion hodnota z `act` (JS, plynule s pružinou
 * kamery na počítači). Snímky navzorkované přes stání (SAMPLES bodů).
 */
const SAMPLES = 24;
function useBoardMotion({ act, progress, range, native }: Pick<BoardProps, "act" | "progress" | "range" | "native">, fn: (v: number) => string) {
  const js = useTransform(act, fn);
  const [p0, p1] = range;
  const times: number[] = [];
  const frames: string[] = [];
  if (p0 > 0) {
    times.push(0);
    frames.push(fn(0));
  }
  for (let i = 0; i <= SAMPLES; i++) {
    times.push(p0 + ((p1 - p0) * i) / SAMPLES);
    frames.push(fn(i / SAMPLES));
  }
  if (p1 < 1) {
    times.push(1);
    frames.push(fn(1));
  }
  const nat = useTransform(progress, times, frames);
  return native ? nat : js;
}

export function Parts({ parts }: { parts: StudyPart[] }) {
  return parts.map(([text, marked], i) => (
    <span key={i}>
      {i > 0 && !/^[.,;:!?]/.test(text) ? " " : null}
      {marked === true ? <span className={styles.accent}>{text}</span> : marked === "bold" ? <b>{text}</b> : text}
    </span>
  ));
}

/**
 * Z průběhu zastávky jen DISKRÉTNÍ stav (index díla vpředu, prahy). React
 * se překreslí, až se hodnota změní — ne v každém snímku scrollu. Plynulé
 * posuny jedou přes motion hodnoty (`useTransform(act, …)` → style), bez
 * Reactu. Dřív se celý artboard překresloval každý snímek a na iPhonu se
 * díla při scrollu „klepala" (React nestíhal, posuny dorážely pozdě).
 */
function useActState<T extends string | number | boolean | null>(act: MotionValue<number>, fn: (v: number) => T): T {
  const [state, setState] = useState(() => fn(act.get()));
  useMotionValueEvent(act, "change", (v) => {
    const next = fn(v);
    setState((prev) => (Object.is(prev, next) ? prev : next));
  });
  return state;
}

const pad2 = (n: number) => String(n).padStart(2, "0");
const aspectOf = (w: StudyWork) => w.image.width / w.image.height;

/* ------------------------------------------------------- společné ---- */

/**
 * Text, který se vypisuje (jako psaní), když `on`. Nevypsaná část drží místo
 * (visibility), takže se rozvržení nehýbe; čtečky dostanou celý text.
 */
function Typed({ text, on, reduce, className, style }: { text: StudyPart[][]; on: boolean; reduce: boolean; className?: string; style?: CSSProperties }) {
  const parts = text.map((paragraph) => paragraph.map(([t, mark], i) => [i > 0 && !/^[.,;:!?]/.test(t) ? ` ${t}` : t, mark] as const));
  const total = parts.flat().reduce((n, [t]) => n + t.length, 0);
  const [count, setCount] = useState(0);
  const shown = reduce ? total : count;
  useEffect(() => {
    if (!on || reduce) return;
    let raf = 0;
    let last = performance.now();
    let n = 0;
    const tick = (now: number) => {
      n = Math.min(total, n + (now - last) * 0.12);
      last = now;
      setCount(Math.floor(n));
      if (n < total) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [on, reduce, total]);
  // Začátek každého úseku v celém textu (kolik znaků je před ním).
  const starts = parts.map((_, pi) => parts.slice(0, pi).flat().reduce((n, [t]) => n + t.length, 0));
  return (
    <div className={className ? `${styles.lead} ${className}` : styles.lead} style={style}>
      <div className={styles.srOnly}>
        {text.map((paragraph, i) => (
          <p key={i}>
            <Parts parts={paragraph} />
          </p>
        ))}
      </div>
      <div aria-hidden="true">
        {parts.map((paragraph, pi) => (
          <p key={pi}>
            {paragraph.map(([t, mark], i) => {
              const left = shown - starts[pi] - paragraph.slice(0, i).reduce((n, [u]) => n + u.length, 0);
              const visible = t.slice(0, Math.max(0, left));
              const caret = left >= 0 && left < t.length && shown < total;
              const body = (
                <>
                  {visible}
                  {caret ? <span className={styles.caret} /> : null}
                  <span className={styles.typedRest}>{t.slice(visible.length)}</span>
                </>
              );
              return mark === "bold" ? <b key={i}>{body}</b> : <span key={i}>{body}</span>;
            })}
          </p>
        ))}
      </div>
    </div>
  );
}

/** Nadpis kapitoly: číslo a název nahoře, pod ním zelená a světlá část (a text). */
function Heading({ no, label, parts, style, sweep, children }: { no: string; label: string; parts: StudyPart[]; style: CSSProperties; sweep: boolean; children?: ReactNode }) {
  return (
    <div className={styles.chHead} data-z="1" style={style}>
      <p className={styles.chKicker}>
        <span className={styles.chBar} aria-hidden="true" />
        {no} <span>{label}</span>
      </p>
      {/* Rámeček s rozměrem kolem písmen zelené části (MeasureText z hera). */}
      <MeasureText sweep={sweep}>
        <h2 className={styles.chTitle}>
          {parts.map(([text, green], i) => (
            <span key={i} className={styles.chLine}>
              <span data-green={green === true || undefined} style={{ transitionDelay: `${0.15 + i * 0.1}s` }}>
                {green === true ? <span data-measure="">{text}</span> : text}
              </span>
            </span>
          ))}
        </h2>
      </MeasureText>
      {children}
    </div>
  );
}

/** Poloha poznámky: zleva `x`, nebo zprava `r` (šířka má minimum na obrazovce). */
type NoteAt = { x: number; y: number; w: number; tilt?: number; r?: number };

/** Poznámka nalepená PŘES díla (poloha v px artboardu); nalepí se při `on`. */
function Note({ parts, at, on, small = false }: { parts: StudyPart[]; at: NoteAt; on: boolean; small?: boolean }) {
  return (
    <p
      className={styles.note}
      data-z="3"
      data-on={on || undefined}
      data-small={small || undefined}
      style={{ left: at.r !== undefined ? "auto" : at.x, right: at.r, top: at.y, "--w": `${at.w}px`, "--tilt": `${at.tilt ?? -1.5}deg` } as CSSProperties}
    >
      <span className={styles.noteTape} aria-hidden="true" />
      <Parts parts={parts} />
    </p>
  );
}

/**
 * Volba díla: klik nebo šipky ho přenesou dopředu a zvýrazní. Scroll na
 * jiné dílo volbu zruší (volba patří k místu, kde se stala).
 */
function usePick(scrolled: number, n: number) {
  const [state, setState] = useState<{ pick: number; at: number } | null>(null);
  const picked = state && state.at === scrolled ? state.pick : null;
  const current = picked ?? scrolled;
  const choose = (i: number) => setState({ pick: ((i % n) + n) % n, at: scrolled });
  return { current, picked, choose, step: (d: number) => choose(current + d) };
}

/**
 * Dílo na artboardu. S `onPick`: první klik ho přenese dopředu a zvýrazní
 * (zelený rámeček s názvem a rozměrem), další klik otevře detail.
 */
function Work({
  work,
  w,
  h,
  style,
  priority,
  className,
  picked = false,
  front = false,
  onPick,
}: {
  work: StudyWork;
  w: number;
  h: number;
  /** Může nést motion hodnoty (posun, rozměr) — mění se bez překreslení Reactu. */
  style?: MotionStyle;
  priority?: boolean;
  className?: string;
  picked?: boolean;
  /** Dílo vpředu — k němu se nalepí detail z tlačítka „Zobrazit detail". */
  front?: boolean;
  onPick?: () => void;
}) {
  const inspect = useInspect();
  const pick = onPick && !picked;
  return (
    <motion.button
      type="button"
      className={className ? `${styles.work} ${className}` : styles.work}
      style={{ width: w, height: h, ...style }}
      data-picked={picked || undefined}
      data-front={front || undefined}
      onClick={(e) => (pick ? onPick() : inspect?.(work.image, e.currentTarget))}
      aria-label={pick ? `Dopředu: ${work.name}` : `Detail: ${work.name}`}
    >
      <span className={styles.workImage}>
        <Image src={work.image.src} alt={work.image.alt} fill sizes={`${Math.ceil(w / 18)}vw`} priority={priority} draggable={false} />
      </span>
      {picked ? (
        <span className={styles.pickLabel} aria-hidden="true">
          {work.name} <i>{work.image.width} × {work.image.height}</i>
        </span>
      ) : null}
    </motion.button>
  );
}

/**
 * Horní hrana tlačítka detailu pod dílem — ale nejvýš tak, aby se celé
 * vešlo do artboardu (výška H): na malé obrazovce je tlačítko (stálé px)
 * větší díl artboardu a vylezlo by dolů. Výška jako `.detailButton`.
 */
const underWork = (y: number, H: number) => `min(${y}px, calc(${(H * 0.985).toFixed(1)}px - max(1.8cqw, 32px / var(--cam-s))))`;

/**
 * Viditelná cesta k detailu (klik na dílo není hned zřejmý): otevře kartu
 * detailu u díla vpředu na tomto artboardu.
 */
function DetailButton({ work, style }: { work: StudyWork; style: MotionStyle }) {
  const inspect = useInspect();
  return (
    <motion.button
      type="button"
      className={styles.detailButton}
      data-z="2"
      style={style}
      onClick={(e) => {
        const board = e.currentTarget.closest("[data-board]");
        inspect?.(work.image, board?.querySelector<HTMLElement>("[data-front]") ?? e.currentTarget);
      }}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7" />
      </svg>
      Zobrazit detail
      <span>náhled · vrstvy · pixely</span>
    </motion.button>
  );
}

function Arrow({ dir }: { dir: -1 | 1 }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={dir < 0 ? "M19 12H5M11 6l-6 6 6 6" : "M5 12h14M13 6l6 6-6 6"} />
    </svg>
  );
}

/** Šipky zpět / dál (předchozí a další dílo dopředu). */
function Steps({ onStep, label }: { onStep: (d: number) => void; label: string }) {
  return (
    <span className={styles.steps} role="group" aria-label={label}>
      <button type="button" onClick={() => onStep(-1)} aria-label="Předchozí dílo">
        <Arrow dir={-1} />
      </button>
      <button type="button" onClick={() => onStep(1)} aria-label="Další dílo">
        <Arrow dir={1} />
      </button>
    </span>
  );
}

/** Počítadlo a popisek díla vpředu: „02 / 04", šipky, název, druh a rozměr. */
function Counter({ i, n, work, style, onStep }: { i: number; n: number; work: StudyWork; style: CSSProperties; onStep: (d: number) => void }) {
  return (
    <div className={styles.counter} data-z="1" style={style}>
      <div className={styles.counterRow}>
        <p className={styles.counterNo}>
          <b>{pad2(i + 1)}</b> / {pad2(n)}
        </p>
        <Steps onStep={onStep} label="Díla kapitoly" />
      </div>
      <p className={styles.counterName}>{work.name}</p>
      <p className={styles.counterMeta}>
        <span>{work.tag}</span> {work.image.width} × {work.image.height}
      </p>
    </div>
  );
}

/** Okraj mřížky artboardu (px). */
const marginOf = (W: number, H: number) => Math.min(W, H) * 0.08;

/* ------------------------------------------------------- pozadí ------ */

// Každá kapitola má za díly VLASTNÍ velký tvar ze stejné rodiny (kruh,
// čtverec, trojúhelník, křivka pera) — větší než karty, sotva viditelný,
// ve smyčce v pohybu. Kreslí se v px artboardu, ořízne ho okraj artboardu.

const f1 = (n: number) => n.toFixed(1);

function Backdrop({ W, H, children }: { W: number; H: number; children: ReactNode }) {
  return (
    <svg className={styles.backdrop} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      {children}
    </svg>
  );
}

/** Titulní: oběžná dráha — velký čárkovaný kruh, menší proti němu, nitkový kříž. */
function BgOrbit({ W, H, cx, cy, r }: { W: number; H: number; cx: number; cy: number; r: number }) {
  const origin = { transformOrigin: `${f1(cx)}px ${f1(cy)}px` };
  return (
    <Backdrop W={W} H={H}>
      <path className={styles.cnFaint} d={`M0 ${f1(cy)} H${W} M${f1(cx)} 0 V${H}`} />
      <g className={styles.bgSpin} style={origin}>
        <circle className={styles.cnDash} cx={cx} cy={cy} r={r} />
        <path className={styles.cnLine} d={`M${f1(cx)} ${f1(cy)} L${f1(cx + r)} ${f1(cy)}`} />
        <circle className={styles.cnDot} cx={cx + r} cy={cy} r="5" />
      </g>
      <g className={styles.bgSpinBack} style={origin}>
        <circle className={styles.cnLine} cx={cx} cy={cy} r={r * 0.56} />
        <circle className={styles.cnDot} cx={cx} cy={cy - r * 0.56} r="4" />
        <circle className={styles.cnDot} cx={cx} cy={cy + r * 0.56} r="4" />
      </g>
      <circle className={styles.cnDot} cx={cx} cy={cy} r="5" />
    </Backdrop>
  );
}

/** Pro rodiče: velký kosočtverec s úhlopříčkami, uvnitř čtverec, kolébají se proti sobě. */
function BgDiamond({ W, H, cx, cy, r }: { W: number; H: number; cx: number; cy: number; r: number }) {
  const origin = { transformOrigin: `${f1(cx)}px ${f1(cy)}px` };
  const pts = [0, 1, 2, 3].map((i) => [cx + Math.cos((i / 4) * Math.PI * 2 - Math.PI / 2) * r, cy + Math.sin((i / 4) * Math.PI * 2 - Math.PI / 2) * r]);
  const s = r * 0.5;
  return (
    <Backdrop W={W} H={H}>
      <g className={styles.bgSway} style={origin}>
        <polygon className={styles.cnLine} points={pts.map((p) => p.map(f1).join(",")).join(" ")} />
        <path className={styles.cnFlowFaint} d={`M${f1(pts[0][0])} ${f1(pts[0][1])} L${f1(pts[2][0])} ${f1(pts[2][1])} M${f1(pts[1][0])} ${f1(pts[1][1])} L${f1(pts[3][0])} ${f1(pts[3][1])}`} />
        {pts.map(([x, y], i) => (
          <circle key={i} className={styles.cnDot} cx={x} cy={y} r="5" />
        ))}
      </g>
      <g className={styles.bgSwayBack} style={origin}>
        <rect className={styles.cnDash} x={cx - s} y={cy - s} width={s * 2} height={s * 2} />
      </g>
    </Backdrop>
  );
}

/** Kampaně: křivka pera přes celý artboard; úchyty se pomalu přelévají (SMIL). */
function BgCurve({ W, H, reduce }: { W: number; H: number; reduce: boolean }) {
  const p0 = [-W * 0.02, H * 0.94];
  const p3 = [W * 1.02, H * 0.1];
  const c1s = [[W * 0.36, H * 1.12], [W * 0.46, H * 0.86], [W * 0.3, H * 1.0]];
  const c2s = [[W * 0.62, H * -0.18], [W * 0.54, H * 0.12], [W * 0.7, H * -0.06]];
  const d = (k: number) => `M${f1(p0[0])} ${f1(p0[1])} C${f1(c1s[k][0])} ${f1(c1s[k][1])} ${f1(c2s[k][0])} ${f1(c2s[k][1])} ${f1(p3[0])} ${f1(p3[1])}`;
  const loop = [0, 1, 2, 0];
  const values = (pick: (k: number) => string) => loop.map(pick).join(";");
  const anim = (attr: string, pick: (k: number) => string) =>
    reduce ? null : <animate attributeName={attr} values={values(pick)} dur="18s" repeatCount="indefinite" calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1;0.45 0 0.55 1" />;
  const handle = (p: number[], cs: number[][]) => (
    <>
      <line className={styles.cnFaint} x1={p[0]} y1={p[1]} x2={cs[0][0]} y2={cs[0][1]}>
        {anim("x2", (k) => f1(cs[k][0]))}
        {anim("y2", (k) => f1(cs[k][1]))}
      </line>
      <rect className={styles.cnHandle} x={cs[0][0] - 7} y={cs[0][1] - 7} width="14" height="14">
        {anim("x", (k) => f1(cs[k][0] - 7))}
        {anim("y", (k) => f1(cs[k][1] - 7))}
      </rect>
    </>
  );
  return (
    <Backdrop W={W} H={H}>
      {/* Vodítka sazby: účaří, střední výška, verzálky. */}
      <path className={styles.cnFlowFaint} d={`M0 ${f1(H * 0.3)} H${W} M0 ${f1(H * 0.335)} H${W} M0 ${f1(H * 0.9)} H${W}`} />
      <path className={styles.cnLine} d={d(0)}>
        {anim("d", d)}
      </path>
      {handle(p0, c1s)}
      {handle(p3, c2s)}
    </Backdrop>
  );
}

/** Důvěra: velký trojúhelník s těžnicemi a dráha kolotoče, po které jede tečka. */
function BgTriangle({ W, H, cx, cy, r, orbit, reduce }: { W: number; H: number; cx: number; cy: number; r: number; orbit: { cy: number; rx: number; ry: number }; reduce: boolean }) {
  const pts = [0, 1, 2].map((i) => [cx + Math.cos((i / 3) * Math.PI * 2 - Math.PI / 2) * r, cy + Math.sin((i / 3) * Math.PI * 2 - Math.PI / 2) * r]);
  const ring = `M${f1(cx - orbit.rx)} ${f1(orbit.cy)} a${f1(orbit.rx)} ${f1(orbit.ry)} 0 1 0 ${f1(orbit.rx * 2)} 0 a${f1(orbit.rx)} ${f1(orbit.ry)} 0 1 0 ${f1(-orbit.rx * 2)} 0`;
  return (
    <Backdrop W={W} H={H}>
      <g className={styles.bgFloat}>
        <polygon className={styles.cnAccent} points={pts.map((p) => p.map(f1).join(",")).join(" ")} />
        <path className={styles.cnFaint} d={pts.map(([x, y]) => `M${f1(cx)} ${f1(cy)} L${f1(x)} ${f1(y)}`).join(" ")} />
      </g>
      <path className={styles.cnDash} d={ring} />
      {reduce ? null : (
        <circle className={styles.cnDot} r="6">
          <animateMotion dur="14s" repeatCount="indefinite" path={ring} />
        </circle>
      )}
    </Backdrop>
  );
}

/* ------------------------------------------------------- titulní ----- */

// Asymetrie: vlevo dole název (velký, zelený) a údaje, vpravo tři story
// do hloubky. Scroll je rozjede různou rychlostí — přední nejvíc (dolly).
// Klik nebo šipky přenesou story dopředu.

const DEPTH = [0.62, 0.8, 1];

/**
 * Konstrukce nad názvem: kruh, čtverec a trojúhelník s čárkovanými
 * vodítky (zjednodušené glyfy ze stránky Projekty). Je tu od začátku
 * a pomalu se pohybuje ve smyčce (CSS) — čárky plynou, kruh se otáčí,
 * čtverec se kolébá, trojúhelník se vznáší.
 */
function Construct({ style }: { style: CSSProperties }) {
  const sq = [0, 1, 2, 3].map((i) => {
    const a = (i / 4) * Math.PI * 2 - Math.PI / 2;
    return [270 + Math.cos(a) * 92, 160 + Math.sin(a) * 92];
  });
  const tri = [0, 1, 2].map((i) => {
    const a = (i / 3) * Math.PI * 2 - Math.PI / 2;
    return [440 + Math.cos(a) * 86, 172 + Math.sin(a) * 86];
  });
  const poly = (pts: number[][]) => pts.map((p) => p.map(f1).join(",")).join(" ");
  return (
    <svg className={styles.construct} data-z="1" style={style} viewBox="0 0 560 320" aria-hidden="true">
      {/* Kóta přes celou šířku. */}
      <g className={styles.cnGuide}>
        <path className={styles.cnFlow} d="M20 296 H540" />
        <path d="M20 288 V304 M540 288 V304" />
      </g>
      {/* Kruh s poloměrem. */}
      <g className={styles.cnSpin}>
        <circle className={styles.cnDash} cx="120" cy="160" r="92" />
        <path className={styles.cnFaint} d="M120 160 H212" />
        <circle className={styles.cnDot} cx="212" cy="160" r="3" />
      </g>
      <circle className={styles.cnDot} cx="120" cy="160" r="3" />
      {/* Čtverec na špičce s vodítky k vrcholům. */}
      <g className={styles.cnSway}>
        <polygon className={styles.cnLine} points={poly(sq)} />
        <path className={styles.cnFaint} d={sq.map(([x, y]) => `M270 160 L${f1(x)} ${f1(y)}`).join(" ")} />
        {sq.map(([x, y], i) => (
          <circle key={i} className={styles.cnDot} cx={x} cy={y} r="3" />
        ))}
      </g>
      {/* Trojúhelník (zeleně) s těžnicemi. */}
      <g className={styles.cnFloat}>
        <polygon className={styles.cnAccent} points={poly(tri)} />
        <path className={styles.cnFaint} d={tri.map(([x, y]) => `M440 172 L${f1(x)} ${f1(y)}`).join(" ")} />
      </g>
    </svg>
  );
}

const DRIFT = [30, 70, 130];

export function CoverBoard({ c, act, rect, go, reduce, seen, progress, range, native }: BoardProps) {
  const ch = c.chapters.cover;
  const { w: W, h: H } = rect;
  const portrait = H > W;
  const M = marginOf(W, H);
  const works = ch.works.slice(0, 3);
  const n = works.length;
  const { current, picked, choose, step } = usePick(n - 1, n);
  const front = portrait ? H * 0.46 : H * 0.8;
  // Místo s (0 vzadu … n−1 vpředu) podle vzdálenosti od díla vpředu.
  const slotOf = (k: number) => n - 1 - ((current - k + n) % n);
  const bySlot = works.map((_, s) => works.findIndex((__, k) => slotOf(k) === s));
  // Od předního (vpravo) doleva, každé další menší a z dvou třetin schované.
  const placed: { x: number; y: number; w: number; h: number }[] = [];
  let right = W - M;
  for (let s = n - 1; s >= 0; s--) {
    const k = bySlot[s];
    const h = front * DEPTH[s];
    const w = h * aspectOf(works[k]);
    const x = right - w;
    const top = portrait ? H * 0.38 : (H - front) / 2;
    placed[k] = { x, y: top + (front - h) * (s === 0 ? 0.15 : s === 1 ? 0.75 : 0.5), w, h };
    right = x + w * 0.38;
  }
  // Širší díla (4 : 5, čtverce) by řadou vyjela z artboardu vlevo — díla za
  // předním se k němu přisunou (víc se překryjí), přední stojí.
  const frontX = placed[bySlot[n - 1]].x;
  const leftmost = Math.min(...placed.map((p) => p.x));
  if (leftmost < M && frontX > M) {
    const k = (frontX - M) / (frontX - leftmost);
    placed.forEach((p) => {
      p.x = frontX - (frontX - p.x) * k;
    });
  }
  // Paralaxa děl při scrollu: `transform` z useBoardMotion (na dotyku nativní
  // osa scrollu, jinak motion hodnota) — bez překreslení Reactu.
  const driftK = portrait ? 0.7 : 1;
  const motionArgs = { act, progress, range, native };
  const drifts = [
    useBoardMotion(motionArgs, (v) => `translateY(${((0.5 - v) * DRIFT[0] * driftK).toFixed(1)}px)`),
    useBoardMotion(motionArgs, (v) => `translateY(${((0.5 - v) * DRIFT[1] * driftK).toFixed(1)}px)`),
    useBoardMotion(motionArgs, (v) => `translateY(${((0.5 - v) * DRIFT[2] * driftK).toFixed(1)}px)`),
  ];
  const drift = (s: number) => drifts[Math.min(s, drifts.length - 1)];
  const f = placed[current];
  const noteAt: NoteAt = portrait ? { x: W * 0.08, y: f.y + f.h * 0.6, w: W * 0.56, tilt: -1.8 } : { x: f.x - W * 0.06, y: f.y + f.h * 0.7, w: W * 0.12, tilt: -2.4 };
  const orbitX = portrait ? W * 0.62 : W * 0.68;
  return (
    <div className={styles.chBoard} onContextMenu={(e) => e.preventDefault()}>
      <BgOrbit W={W} H={H} cx={orbitX} cy={portrait ? H * 0.62 : H * 0.5} r={portrait ? W * 0.62 : H * 0.62} />
      <p className={styles.cvKick} data-z="1" style={{ left: M, top: M }}>
        <span className={styles.chBar} aria-hidden="true" />
        {c.index} <span>Případová studie</span>
      </p>
      {!portrait ? <Construct style={{ left: M, top: H * 0.15, width: W * 0.22 }} /> : null}
      <div className={styles.cvTitle} data-z="1" style={portrait ? { left: M, top: M * 1.9, right: M } : { left: M, bottom: M, width: W * 0.36 }}>
        <MeasureText sweep={go && seen}>
          <h1 className={styles.cvName}>
            <span className={styles.chLine}>
              <span data-green="">
                <span data-measure="">{c.title}</span>
              </span>
            </span>
          </h1>
        </MeasureText>
        <p className={styles.cvKind}>{c.kind}</p>
        {!portrait ? <Typed text={ch.text} on={go && seen} reduce={reduce} /> : null}
        <dl className={styles.cvMeta}>
          {c.meta.map((item) => (
            <div key={item.label}>
              <dt>{item.label}</dt>
              <dd>{item.value}</dd>
            </div>
          ))}
        </dl>
      </div>
      {works.map((work, k) => {
        const p = placed[k];
        const s = slotOf(k);
        return (
          <Work
            key={work.name}
            work={work}
            w={p.w}
            h={p.h}
            priority
            className={styles.depthWork}
            picked={picked === k}
            front={k === current}
            onPick={() => choose(k)}
            style={{ left: p.x, top: p.y, transform: drift(s), "--dim": (1 - DEPTH[s]) * 1.4, zIndex: s } as MotionStyle}
          />
        );
      })}
      <DetailButton work={works[current]} style={{ left: f.x, top: underWork(f.y + f.h + H * 0.022, H), transform: drift(n - 1) }} />
      <div className={styles.controls} data-z="2" style={portrait ? { right: M, top: H * 0.33 } : { right: M, top: M * 0.45 }}>
        <span className={styles.controlsNo}>
          <b>{pad2(current + 1)}</b> / {pad2(n)}
        </span>
        <Steps onStep={step} label="Story vpředu" />
      </div>
      <Note parts={portrait ? ch.text[0] : ch.asides[0]} at={noteAt} on={go} small={!portrait} />
    </div>
  );
}

/* ------------------------------------------------------- pro rodiče -- */

// Asymetrie zrcadlově: díla vlevo jako balíček karet (stejný princip jako
// CardSwap na homepage), nadpis vpravo nahoře, počítadlo vpravo dole.
// Scroll střídá kartu vpředu; klik nebo šipky ji vyberou.

const STACK = { dx: 0.03, dy: -0.036, scale: 0.05 };

export function PlayBoard({ c, act, rect, go, reduce, seen }: BoardProps) {
  const ch = c.chapters.play;
  const { w: W, h: H } = rect;
  const portrait = H > W;
  const M = marginOf(W, H);
  const works = ch.works;
  const n = works.length;
  const scrolledFront = useActState(act, (v) => Math.min(n - 1, Math.floor(span(v, 0.12, 0.92) * n)));
  const noteIn = useActState(act, (v) => v > 0.05);
  const note2In = useActState(act, (v) => v > 0.4);
  const { current: front, picked, choose, step } = usePick(scrolledFront, n);
  const ch0 = portrait ? H * 0.34 : H * 0.68;
  const cw = ch0 * aspectOf(works[0]);
  const base = portrait ? { x: M, y: H * 0.26 } : { x: M * 1.3, y: H * 0.24 };
  return (
    <div className={styles.chBoard}>
      <BgDiamond W={W} H={H} cx={base.x + cw * 0.62} cy={base.y + ch0 * 0.45} r={portrait ? W * 0.62 : H * 0.72} />
      <Heading no="02" label={ch.label} sweep={go && seen} parts={ch.heading} style={portrait ? { left: M, top: M, right: M } : { left: W * 0.57, top: M, width: W * 0.36 }}>
        {!portrait ? <Typed text={ch.text} on={go && seen} reduce={reduce} /> : null}
      </Heading>
      <div className={styles.stack} data-z="2">
        {works.map((work, k) => {
          const rank = (k - front + n) % n;
          return (
            <Work
              key={work.name + k}
              work={work}
              w={cw}
              h={ch0}
              className={styles.stackCard}
              picked={picked === k}
              front={k === front}
              onPick={() => choose(k)}
              style={
                {
                  left: base.x + rank * W * STACK.dx,
                  top: base.y + rank * H * STACK.dy * (portrait ? 0.6 : 1),
                  scale: `${1 - rank * STACK.scale}`,
                  zIndex: n - rank,
                  "--dim": rank * 0.22,
                } as CSSProperties
              }
            />
          );
        })}
      </div>
      <Note
        parts={portrait ? ch.text[0] : ch.asides[0]}
        small={!portrait}
        at={portrait ? { x: 0, r: M * 0.5, y: H * 0.24, w: W * 0.5, tilt: 1.6 } : { x: base.x + cw * 0.86, y: H * 0.2, w: W * 0.12, tilt: 2.2 }}
        on={noteIn}
      />
      <Note
        parts={portrait ? ch.text[1] : ch.asides[1]}
        small={!portrait}
        at={portrait ? { x: M * 0.5, y: H * 0.56, w: W * 0.6, tilt: -1.4 } : { x: M * 0.5, y: H * 0.76, w: W * 0.12, tilt: -2.6 }}
        on={note2In}
      />
      {/* Na výšku dole naproti počítadlu — pod díly ho kryje poznámka. */}
      <DetailButton work={works[front]} style={portrait ? { left: M, bottom: M } : { left: base.x, top: underWork(base.y + ch0 + H * 0.022, H) }} />
      <Counter i={front} n={n} work={works[front]} onStep={step} style={portrait ? { right: M, bottom: M } : { left: W * 0.57, bottom: M }} />
    </div>
  );
}

/* ------------------------------------------------------- kampaně ----- */

// Asymetrie: nadpis vlevo nahoře, přes celou šířku pás děl v pořadí od
// nové kolekce po Black Friday. Scroll pásem projede; klik nebo šipky
// přisunou dílo doprostřed a zvýrazní ho. Mapa pod pásem ukazuje druhy.

/** Šířka ovládání vpravo od mapy na obrazovce (detail + šipky, px) —
 *  na menší obrazovce je větší díl artboardu, mapa mu uhne. */
const MAP_CONTROLS = 360;

export function CampaignsBoard({ c, act, rect, go, reduce, seen, progress, range, native }: BoardProps) {
  const ch = c.chapters.campaigns;
  const { w: W, h: H } = rect;
  const portrait = H > W;
  const M = marginOf(W, H);
  const win = portrait ? { x: M, y: H * 0.3, w: W - 2 * M, h: H * 0.36 } : { x: M, y: H * 0.36, w: W - 2 * M, h: H * 0.42 };
  const gap = win.w * 0.018;
  // Okraj na začátku a konci pásu (pod zatmavením hran).
  const pad = win.w * 0.03;
  const items = ch.works.map((work) => ({ work, w: win.h * aspectOf(work) }));
  const xs: number[] = [];
  let acc = pad;
  items.forEach((it) => {
    xs.push(acc);
    acc += it.w + gap;
  });
  const total = acc - gap + pad;
  const max = Math.max(0, total - win.w);
  const shiftAt = (v: number) => max * easeInOut(span(v, 0.08, 0.92));
  const centreOf = (i: number) => xs[i] + items[i].w / 2;
  const nearest = (x: number) => items.reduce((best, _, i) => (Math.abs(centreOf(i) - x) < Math.abs(centreOf(best) - x) ? i : best), 0);
  const scrolledCurrent = useActState(act, (v) => nearest(shiftAt(v) + win.w / 2));
  const noteIn = useActState(act, (v) => v > 0.05);
  const { current, picked, choose, step } = usePick(scrolledCurrent, items.length);
  // Posun pásu: scrollem plynule přes motion hodnotu (bez Reactu), vybrané
  // dílo pevně doprostřed (přechod `translate` dělá CSS, data-glide).
  const pickedShift = picked === null ? 0 : Math.min(max, Math.max(0, centreOf(picked) - win.w / 2));
  const stripShift = useTransform(act, (v) => `${(-(picked === null ? shiftAt(v) : pickedShift)).toFixed(1)}px 0`);
  // Na dotyku pás jede po nativní ose scrollu (transform); vybrané dílo pevně.
  const stripNative = useBoardMotion({ act, progress, range, native: true }, (v) => `translateX(${(-shiftAt(v)).toFixed(1)}px)`);
  const stripStyle: MotionStyle = native
    ? { transform: picked === null ? stripNative : `translateX(${(-pickedShift).toFixed(1)}px)` }
    : { translate: stripShift };
  // Mapa: úseky stejného druhu za sebou.
  const groups: { tag: string; from: number; to: number }[] = [];
  items.forEach((it, i) => {
    const last = groups[groups.length - 1];
    if (last && last.tag === it.work.tag) last.to = xs[i] + it.w;
    else groups.push({ tag: it.work.tag, from: xs[i], to: xs[i] + it.w });
  });
  const currentGroup = groups.findIndex((g) => g.tag === items[current].work.tag);
  return (
    <div className={styles.chBoard}>
      <BgCurve W={W} H={H} reduce={reduce} />
      <Heading no="03" label={ch.label} sweep={go && seen} parts={ch.heading} style={portrait ? { left: M, top: M, right: M } : { left: M, top: M, width: W * 0.5 }} />
      {!portrait ? <Typed text={ch.text} on={go && seen} reduce={reduce} style={{ position: "absolute", left: W * 0.58, top: M * 1.55, width: W * 0.34, marginTop: 0 }} /> : null}
      <div className={styles.strip} data-z="2" style={{ left: win.x, top: win.y, width: win.w, height: win.h + H * 0.07 }}>
        <motion.div className={styles.stripTrack} data-glide={picked !== null || undefined} style={stripStyle}>
          {items.map((it, i) => (
            <figure key={it.work.name + i} className={styles.stripItem} data-picked={picked === i || undefined} style={{ left: xs[i], width: it.w }}>
              <Work work={it.work} w={it.w} h={win.h} picked={picked === i} front={i === current} onPick={() => choose(i)} />
              <figcaption>
                <span>{it.work.tag}</span> {it.work.name}
              </figcaption>
            </figure>
          ))}
        </motion.div>
      </div>
      <div className={styles.map} data-z="1" style={{ left: win.x, top: win.y + win.h + H * 0.1, width: portrait ? win.w : `calc(${win.w}px - max(${W * 0.24}px, ${MAP_CONTROLS}px / var(--cam-s)))` }}>
        {groups.map((g, i) => (
          <button
            type="button"
            key={g.tag}
            className={styles.mapGroup}
            data-on={i === currentGroup || undefined}
            onClick={() => choose(items.findIndex((it) => it.work.tag === g.tag))}
            style={{ left: `${(g.from / total) * 100}%`, width: `${((g.to - g.from) / total) * 100}%` }}
          >
            {g.tag}
          </button>
        ))}
      </div>
      <div className={styles.controls} data-z="2" style={portrait ? { right: M, top: win.y + win.h + H * 0.13 } : { right: M, top: win.y + win.h + H * 0.085 }}>
        {!portrait ? <DetailButton work={items[current].work} style={{ position: "relative" }} /> : null}
        <Steps onStep={step} label="Kampaně v pásu" />
      </div>
      {portrait ? <DetailButton work={items[current].work} style={{ left: win.x, top: win.y + win.h + H * 0.13 }} /> : null}
      <Note
        parts={portrait ? ch.text[0] : ch.asides[0]}
        small={!portrait}
        at={portrait ? { x: 0, r: M * 0.5, y: H * 0.23, w: W * 0.6, tilt: 1.4 } : { x: W * 0.4, y: H * 0.31, w: W * 0.13, tilt: 1.8 }}
        on={noteIn}
      />
    </div>
  );
}

/* ------------------------------------------------------- důvěra ------ */

// Asymetrie: kolotoč bannerů vlevo (přední největší, zadní tlumené),
// nadpis vpravo nahoře, počítadlo vpravo dole. Scroll kolotoč otočí;
// klik nebo šipky natočí vybraný banner dopředu.
// Kolotoč je promítnutý do roviny (x, měřítko) — text na plátně zůstane ostrý.

/** Karta kolotoče: poloha, velikost a hloubka z otočení (motion hodnota) — bez Reactu. */
function RingCard({
  work,
  k,
  n,
  turn,
  turnAt,
  pickedTurn,
  motionArgs,
  centre,
  R,
  cardH,
  H,
  picked,
  front,
  onPick,
}: {
  work: StudyWork;
  k: number;
  n: number;
  turn: MotionValue<number>;
  /** Otočení z průběhu stání (scroll). */
  turnAt: (v: number) => number;
  /** Vybraná karta (klik / šipky) — kolotoč stojí na ní. */
  pickedTurn: number | null;
  motionArgs: Pick<BoardProps, "act" | "progress" | "range" | "native">;
  centre: { x: number; y: number };
  R: number;
  cardH: number;
  H: number;
  picked: boolean;
  front: boolean;
  onPick: () => void;
}) {
  const aspect = aspectOf(work);
  const angle = (t: number) => ((k - t) / n) * Math.PI * 2;
  const depthOf = (t: number) => (Math.cos(angle(t)) + 1) / 2;
  const hOf = (t: number) => cardH * (0.62 + 0.38 * depthOf(t));
  const width = useTransform(turn, (t) => hOf(t) * aspect);
  const height = useTransform(turn, hOf);
  const left = useTransform(turn, (t) => centre.x + Math.sin(angle(t)) * R - (hOf(t) * aspect) / 2);
  const top = useTransform(turn, (t) => centre.y - hOf(t) / 2 - (1 - depthOf(t)) * H * 0.04);
  const zIndex = useTransform(turn, (t) => Math.round(depthOf(t) * 10));
  const dim = useTransform(turn, (t) => (1 - depthOf(t)) * 0.7);
  // Na dotyku: pevný box v plné velikosti, pohyb a zmenšení jen `transform`
  // na nativní ose scrollu (Safari ho posouvá se scrollem). Pořadí vrstev
  // se mění jen při křížení karet — diskrétně.
  const transformOf = (t: number) =>
    `translate(${(Math.sin(angle(t)) * R).toFixed(1)}px, ${(-(1 - depthOf(t)) * H * 0.04).toFixed(1)}px) scale(${(0.62 + 0.38 * depthOf(t)).toFixed(4)})`;
  const nativeTransform = useBoardMotion(motionArgs, (v) => transformOf(turnAt(v)));
  const nativeZ = useActState(motionArgs.act, (v) => Math.round(depthOf(pickedTurn ?? turnAt(v)) * 10));
  if (motionArgs.native) {
    const maxW = cardH * aspect;
    return (
      <Work
        work={work}
        w={maxW}
        h={cardH}
        className={styles.ringCard}
        picked={picked}
        front={front}
        onPick={onPick}
        style={
          {
            left: centre.x - maxW / 2,
            top: centre.y - cardH / 2,
            width: maxW,
            height: cardH,
            transform: pickedTurn === null ? nativeTransform : transformOf(pickedTurn),
            zIndex: nativeZ,
            "--dim": dim,
          } as MotionStyle
        }
      />
    );
  }
  return (
    <Work
      work={work}
      w={cardH * aspect}
      h={cardH}
      className={styles.ringCard}
      picked={picked}
      front={front}
      onPick={onPick}
      style={{ left, top, width, height, zIndex, "--dim": dim } as MotionStyle}
    />
  );
}

export function TrustBoard({ c, act, rect, go, reduce, seen, progress, range, native }: BoardProps) {
  const ch = c.chapters.trust;
  const { w: W, h: H } = rect;
  const portrait = H > W;
  const M = marginOf(W, H);
  const works = ch.works;
  const n = works.length;
  const turnAt = (v: number) => easeInOut(span(v, 0.1, 0.92)) * (n - 1);
  const scrolledFront = useActState(act, (v) => Math.round(turnAt(v)) % n);
  const noteIn = useActState(act, (v) => v > 0.05);
  const { current: front, picked, choose, step } = usePick(scrolledFront, n);
  // Otočení kolotoče: scrollem plynule (motion hodnota), výběr pevně.
  const turn = useTransform(act, (v) => picked ?? turnAt(v));
  const centre = portrait ? { x: W * 0.5, y: H * 0.44 } : { x: W * 0.3, y: H * 0.52 };
  const R = portrait ? W * 0.3 : W * 0.17;
  const cardH = portrait ? H * 0.3 : H * 0.62;
  return (
    <div className={styles.chBoard}>
      <BgTriangle
        W={W}
        H={H}
        cx={centre.x}
        cy={centre.y - H * 0.04}
        r={portrait ? W * 0.72 : H * 0.78}
        orbit={{ cy: centre.y + cardH * 0.5 + H * 0.04, rx: R * 1.7, ry: H * 0.05 }}
        reduce={reduce}
      />
      <Heading no="04" label={ch.label} sweep={go && seen} parts={ch.heading} style={portrait ? { left: M, top: M, right: M } : { left: W * 0.6, top: M, width: W * 0.33 }}>
        {!portrait ? <Typed text={ch.text} on={go && seen} reduce={reduce} /> : null}
      </Heading>
      <div className={styles.ring} data-z="2" data-glide={picked !== null || undefined}>
        {works.map((work, k) => (
          <RingCard
            key={work.name + k}
            work={work}
            k={k}
            n={n}
            turn={turn}
            turnAt={turnAt}
            pickedTurn={picked}
            motionArgs={{ act, progress, range, native }}
            centre={centre}
            R={R}
            cardH={cardH}
            H={H}
            picked={picked === k}
            front={k === front}
            onPick={() => choose(k)}
          />
        ))}
      </div>
      <Note
        parts={portrait ? ch.text[0] : ch.asides[0]}
        small={!portrait}
        at={portrait ? { x: 0, r: M * 0.5, y: H * 0.56, w: W * 0.6, tilt: -1.6 } : { x: centre.x + W * 0.1, y: H * 0.68, w: W * 0.12, tilt: -2.2 }}
        on={noteIn}
      />
      {/* Na výšku dole naproti počítadlu — pod díly ho kryje poznámka. */}
      <DetailButton work={works[front]} style={portrait ? { right: M, bottom: M } : { left: centre.x, top: underWork(centre.y + cardH / 2 + H * 0.025, H), translate: "-50% 0" }} />
      <Counter i={front} n={n} work={works[front]} onStep={step} style={portrait ? { left: M, bottom: M } : { left: W * 0.6, bottom: M }} />
    </div>
  );
}

/* ------------------------------------------------------- výstupy ----- */

type Placed = { i: number; x: number; y: number; w: number; h: number };

/**
 * Díla libovolných tvarů v řádcích (zarovnaných do šířky). Zkusí 1–4
 * řádky a vybere rozvržení s největší plochou děl, které se vejde.
 */
const justify = (aspects: number[], area: Rect, gap: number, caption: number): Placed[] => {
  const n = aspects.length;
  let best: Placed[] = [];
  let bestArea = -1;
  for (let r = 1; r <= Math.min(n, 4); r++) {
    // Rozdělení do r řádků s podobným součtem poměrů stran.
    const target = aspects.reduce((a, b) => a + b, 0) / r;
    const rows: number[][] = [[]];
    let acc = 0;
    aspects.forEach((a, i) => {
      const row = rows[rows.length - 1];
      if (row.length && acc + a / 2 > target && rows.length < r) {
        rows.push([]);
        acc = 0;
      }
      rows[rows.length - 1].push(i);
      acc += a;
    });
    const heights = rows.map((row) => (area.w - gap * (row.length - 1)) / row.reduce((s, i) => s + aspects[i], 0));
    const total = heights.reduce((a, b) => a + b, 0) + rows.length * caption + gap * (rows.length - 1);
    const k = Math.min(1, area.h / total);
    const placed: Placed[] = [];
    let y = area.y + (area.h - total * k) / 2;
    rows.forEach((row, ri) => {
      const h = heights[ri] * k;
      const width = row.reduce((s, i) => s + aspects[i] * h, 0) + gap * (row.length - 1);
      let x = area.x + (area.w - width) / 2;
      row.forEach((i) => {
        placed.push({ i, x, y, w: aspects[i] * h, h });
        x += aspects[i] * h + gap;
      });
      y += h + caption + gap;
    });
    const sum = placed.reduce((s, p) => s + p.w * p.h, 0);
    if (sum > bestArea) {
      bestArea = sum;
      best = placed;
    }
  }
  return best;
};


// Výstupy jsou EDITOR: vlastní malé rozhraní návrhového nástroje (ne kopie
// konkrétního programu). Nahoře lišta s nástroji, souborem, lidmi v souboru,
// zoomem a exportem; vlevo Vrstvy (formáty), vpravo Vlastnosti vybraného;
// uprostřed plocha, po které jde jezdit (tah), přibližovat (Ctrl + kolečko,
// − / +) a vybírat (klik), dvojklik otevře detail. Dole výzva ke spolupráci.
// Scroll na začátku přehraje, co dělá Sabina (projde formáty, exportuje);
// prvním dotykem plochy převezme ovládání návštěvník.

const EXPORT_AT = (i: number, n: number) => 0.42 + (i / n) * 0.3;
// Rám editoru (podíl artboardu): lišta, panely, pata s výzvou.
// Rozhraní je úzké — hlavní je plocha. Spodní lišta není (výzva je na konci).
const EDITOR = { bar: 0.05, left: 0.13, right: 0.14, rows: 0.1, row: 0.045 };
const ZOOM = { min: 0.4, max: 3 };


export function OutputsBoard({ c, act, rect }: BoardProps) {
  const inspect = useInspect();
  const items = c.outputs;
  const { w: W, h: H } = rect;
  const portrait = H > W;
  const bar = H * EDITOR.bar;
  const left = portrait ? 0 : W * EDITOR.left;
  const right = portrait ? 0 : W * EDITOR.right;
  const view = { x: left, y: bar, w: W - left - right, h: H - bar };
  const caption = Math.max(20, H * 0.028);
  const placed = justify(
    items.map((it) => it.image.width / it.image.height),
    { x: view.w * 0.06, y: view.h * 0.08, w: view.w * 0.88, h: view.h * 0.84 },
    view.w * 0.025,
    caption,
  );

  // Plocha: posun a přiblížení (px artboardu), výběr; Sabina do prvního dotyku.
  const viewRef = useRef<HTMLDivElement>(null);
  const [cam, setCam] = useState({ x: 0, y: 0, k: 1 });
  const [took, setTook] = useState(false);
  const [userSel, setUserSel] = useState<number | null>(null);
  // Tah: dílo (item ≥ 0) se posouvá po ploše, jinak se posouvá plocha.
  const drag = useRef<{ id: number; x: number; y: number; moved: number; item: number } | null>(null);
  const [moved, setMoved] = useState<Record<number, { x: number; y: number }>>({});
  const [order, setOrder] = useState<number[]>([]);
  const [dragging, setDragging] = useState(-1);
  const lastClick = useRef({ t: 0, i: -1 });
  const n = items.length;
  // Vše ze scrollu jen jako diskrétní stav (viz useActState) — EXPORT_AT roste
  // s pořadím, takže hotové jsou prvních `done`.
  const scripted = useActState(act, (v) => (v < 0.06 ? null : v < 0.38 ? Math.min(n - 1, Math.floor(((v - 0.06) / 0.32) * n)) : v > 0.8 ? 0 : null));
  const selected = took ? userSel : scripted;
  const done = useActState(act, (v) => items.filter((_, i) => v >= EXPORT_AT(i, n) + 0.04).length);
  const exported = items.map((_, i) => i < done);
  const busy = useActState(act, (v) => v > 0.4);

  /** Obrazovka → px artboardu (kamera plátna mění měřítko). */
  const ratio = () => {
    const el = viewRef.current;
    return el ? el.getBoundingClientRect().width / el.offsetWidth || 1 : 1;
  };
  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const hit = (e.target as HTMLElement).closest<HTMLElement>("[data-item]");
    const item = hit ? Number(hit.dataset.item) : -1;
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0, item };
    e.currentTarget.setPointerCapture(e.pointerId);
    setTook(true);
    if (item >= 0) {
      setUserSel(item);
      setDragging(item);
      setOrder((o) => [...o.filter((i) => i !== item), item]);
    }
  };
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const k = ratio();
    const dx = (e.clientX - d.x) / k;
    // Dílo jde táhnout i svisle (i na dotyk); plocha na dotyk jen do stran.
    const dyAll = (e.clientY - d.y) / k;
    const dy = e.pointerType === "mouse" || d.item >= 0 ? dyAll : 0;
    d.moved += Math.abs(dx) + Math.abs(dy);
    d.x = e.clientX;
    d.y = e.clientY;
    if (d.item >= 0) {
      const item = d.item;
      setMoved((m) => ({ ...m, [item]: { x: (m[item]?.x ?? 0) + dx / cam.k, y: (m[item]?.y ?? 0) + dy / cam.k } }));
      return;
    }
    setCam((cm) => ({ ...cm, x: cm.x + dx, y: cm.y + dy }));
  };
  const onUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    setDragging(-1);
    if (d.moved > 5) return;
    // Klik: výběr (skrz zachycení ukazatele — prvek pod bodem), dvojklik: detail.
    const hit = document
      .elementsFromPoint(e.clientX, e.clientY)
      .map((el) => (el as HTMLElement).closest<HTMLElement>("[data-item]"))
      .find(Boolean);
    const i = hit ? Number(hit.dataset.item) : -1;
    const now = performance.now();
    if (i >= 0 && lastClick.current.i === i && now - lastClick.current.t < 350) {
      inspect?.(items[i].image, hit);
      lastClick.current = { t: 0, i: -1 };
      return;
    }
    lastClick.current = { t: now, i };
    setUserSel(i >= 0 ? i : null);
  };
  const zoomBy = (factor: number, at?: { x: number; y: number }) => {
    setTook(true);
    setCam((cm) => {
      const k = Math.min(ZOOM.max, Math.max(ZOOM.min, cm.k * factor));
      const p = at ?? { x: view.w / 2, y: view.h / 2 };
      const f = k / cm.k;
      return { k, x: p.x - (p.x - cm.x) * f, y: p.y - (p.y - cm.y) * f };
    });
  };
  // Ctrl + kolečko / sevření nad plochou: přiblížení k bodu.
  useEffect(() => {
    const el = viewRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      e.stopPropagation();
      const r = el.getBoundingClientRect();
      const k = r.width / el.offsetWidth || 1;
      zoomBy(Math.exp(-e.deltaY * 0.0025), { x: (e.clientX - r.left) / k, y: (e.clientY - r.top) / k });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  });
  // Na střed: plocha zpět a díla na svá místa.
  const reset = () => {
    setCam({ x: 0, y: 0, k: 1 });
    setMoved({});
    setTook(true);
  };

  const stack = [...items.map((_, i) => i).filter((i) => !order.includes(i)), ...order];
  const sel = selected !== null ? items[selected] : null;
  const selBox = selected !== null ? placed.find((p) => p.i === selected) : undefined;

  return (
    <div className={styles.editor} data-portrait={portrait || undefined}>
      {/* ---------- Lišta ---------- */}
      <div className={styles.edBar} data-z="1" style={{ height: bar }}>
        <span className={styles.edTools}>
          <span className={styles.edMark} aria-hidden="true">
            S
          </span>
          {[
            ["V", "Výběr"],
            ["H", "Ruka"],
            ["F", "Rámeček"],
            ["C", "Komentář"],
          ].map(([key, label], i) => (
            <span key={key} className={styles.edTool} data-active={i === 0 || undefined} title={`${label} (${key})`}>
              {key}
            </span>
          ))}
        </span>
        <span className={styles.edFile}>
          <span>{c.title}</span> / <b>Výstupy</b>
        </span>
        <span className={styles.edRight}>
          <span className={styles.edPeople} aria-label="V souboru: Sabina a vy">
            <i data-who="s">S</i>
            <i data-who="vy">Vy</i>
          </span>
          <span className={styles.edZoom}>
            <button type="button" onClick={() => zoomBy(1 / 1.25)} aria-label="Oddálit">
              −
            </button>
            <button type="button" onClick={reset} title="Na střed">
              {Math.round(cam.k * 100)} %
            </button>
            <button type="button" onClick={() => zoomBy(1.25)} aria-label="Přiblížit">
              +
            </button>
          </span>
          <span className={styles.edExport} data-busy={(busy && done < n) || undefined}>
            {done >= n ? "Exportováno" : "Exportovat"}
            <i style={{ scale: `${done / n} 1` }} aria-hidden="true" />
          </span>
        </span>
      </div>

      {/* ---------- Vrstvy ---------- */}
      {!portrait ? (
        <aside className={styles.edLayers} data-z="1" style={{ top: bar, width: left, bottom: 0 }}>
          <p className={styles.edPanelHead}>
            Vrstvy <span>{n}</span>
          </p>
          <ul style={{ top: H * EDITOR.rows - bar }}>
            {items.map((item, i) => (
              <li
                key={i}
                style={{ height: H * EDITOR.row }}
                data-active={selected === i || undefined}
                data-done={exported[i] || undefined}
                onClick={() => {
                  setTook(true);
                  setUserSel(i);
                }}
              >
                <span className={styles.edFrameIcon} data-square={item.image.width === item.image.height || undefined} aria-hidden="true" />
                <span className={styles.edRowName}>
                  <span>{item.caption}</span>
                  <i>{item.format}</i>
                </span>
                <span className={styles.edCheck} aria-hidden="true" />
              </li>
            ))}
          </ul>
        </aside>
      ) : null}

      {/* ---------- Plocha ---------- */}
      <div
        ref={viewRef}
        className={styles.edView}
        style={{ left: view.x, top: view.y, width: view.w, height: view.h }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={() => {
          drag.current = null;
          setDragging(-1);
        }}
        data-dragging={dragging >= 0 || undefined}
      >
        <motion.div className={styles.edPlane} style={{ transform: `translate(${cam.x}px, ${cam.y}px) scale(${cam.k})`, "--v": act } as MotionStyle}>
          {placed.map((p, order) => {
            const item = items[p.i];
            const off = moved[p.i] ?? { x: 0, y: 0 };
            const z = stack.indexOf(p.i);
            return (
              <figure
                key={p.i}
                className={styles.edItem}
                data-item={p.i}
                data-selected={selected === p.i || undefined}
                data-dragging={dragging === p.i || undefined}
                style={{ left: p.x + off.x, top: p.y + off.y, width: p.w, zIndex: z + 1, "--k": cam.k, "--o": order * 0.01 } as CSSProperties}
              >
                <span className={styles.edImage} style={{ height: p.h }}>
                  <Image src={item.image.src} alt={item.image.alt} fill sizes="16vw" draggable={false} />
                </span>
                <figcaption style={{ height: caption, lineHeight: `${caption}px` }}>
                  <b>{item.caption}</b> {item.format}
                </figcaption>
                {selected === p.i ? (
                  <span className={styles.edSelect} style={{ height: p.h }} aria-hidden="true">
                    <i />
                    <i />
                    <i />
                    <i />
                    <b>
                      {item.image.width} × {item.image.height}
                    </b>
                  </span>
                ) : null}
              </figure>
            );
          })}
        </motion.div>
        <p className={styles.edHint} data-hide={took || undefined}>
          Táhněte díly i plochou · klik vybere · dvojklik otevře detail
        </p>
      </div>

      {/* ---------- Vlastnosti ---------- */}
      {!portrait ? (
        <aside className={styles.edProps} data-z="1" style={{ top: bar, width: right, bottom: 0 }}>
          <p className={styles.edPanelHead}>Vlastnosti</p>
          {sel && selBox ? (
            <div className={styles.edPropsBody}>
              <p className={styles.edPropName}>{sel.caption}</p>
              <p className={styles.edPropSub}>{sel.format}</p>
              <dl className={styles.edFields}>
                <div>
                  <dt>Š</dt>
                  <dd>{sel.image.width}</dd>
                </div>
                <div>
                  <dt>V</dt>
                  <dd>{sel.image.height}</dd>
                </div>
                <div>
                  <dt>X</dt>
                  <dd>{Math.round(selBox.x)}</dd>
                </div>
                <div>
                  <dt>Y</dt>
                  <dd>{Math.round(selBox.y)}</dd>
                </div>
              </dl>
              <p className={styles.edPropRow}>
                <span>Poměr</span>
                <b>{sel.image.width === sel.image.height ? "1 : 1" : sel.image.width > sel.image.height ? "na šířku" : "na výšku"}</b>
              </p>
              <p className={styles.edPropRow}>
                <span>Export</span>
                <b>PNG · 1×</b>
              </p>
              <button type="button" className={styles.edOpen} onClick={() => inspect?.(sel.image, viewRef.current?.querySelector<HTMLElement>(`[data-item="${selected}"]`) ?? null)}>
                Otevřít detail · vrstvy
              </button>
            </div>
          ) : (
            <p className={styles.edEmpty}>Nic nevybráno. Klikněte na formát na ploše nebo ve vrstvách.</p>
          )}
        </aside>
      ) : null}

    </div>
  );
}
