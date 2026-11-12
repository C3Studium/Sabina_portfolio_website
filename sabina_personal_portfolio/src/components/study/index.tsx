// Případová studie projektu (/projects/[slug], když má projekt ve Studiu
// vyplněnou záložku „Případová studie"; obsah převádí src/lib/site/study.ts).
//
// PLÁTNO NÁVRHÁŘE přes celou obrazovku. Studie je jedno plátno s artboardy
// projektu; scroll vede kameru po zastávkách:
//   Titulní → Pro rodiče → Kampaně → Důvěra → Výstupy
// Každý artboard zabere skoro celou obrazovku (~92 %). Na zastávce kamera
// stojí a scroll řídí, co se na artboardu děje (boards.tsx); při přejezdu
// (dlouhém, jemném) se plátno lehce natočí do izometrie a artboardy se
// rozloží na své vrstvy (`data-z`).
//
// Na konci se kamera oddálí na celé plátno a nastoupí výzva (Finale) —
// obměna CTA z homepage: bez recenzí, jen velké tlačítko uprostřed.
//
// Texty jsou poznámky nalepené přes díla přímo na artboardech. Žádný
// umělý kurzor. Rozhraní: pravítko vlevo (y) ve světových px, dole
// pravítko kapitol (klik = skok).
//
// Ostrý text: na zastávce je svět plochý (bez 3D kontextu a will-change)
// a kamera stojí na celých px — prohlížeč text vykreslí v cílové velikosti.
//
// NDA: na plátně nejsou názvy písem ani kódy barev klienta.

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import {
  animate,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { useGate } from "@/motion/LoadProvider";
import { FULL, PORTRAIT_PHONE, PORTRAIT_TABLET, useMedia, viewportHeight } from "@/lib/fluid";
import { ACCENT_RGB } from "@/lib/palette";
import { STUDY_TEMPLATE, type StudyBoard, type StudyContent, type StudyImage } from "./content";
import { InspectContext, InspectorDock } from "./inspector";
import { editableDoc } from "@c3studium/valecms/edit";
import { registerVisuals, type VisualDef } from "@/lib/banner-layers";
import { CampaignsBoard, CoverBoard, ENTRANCE, OutputsBoard, Parts, PlayBoard, TrustBoard, easeInOut, span, type BoardProps, type Rect } from "./boards";
import MeasureText from "@/components/common/measure-text";
import { SketchText } from "@/components/home/info/reveal";
import { openContact } from "@/components/layout/contact-modal/open";
import { chapterAt, drawChapters, drawRuler, type Chapter } from "./rulers";
import StudyColumn from "./column";
import styles from "./styles.module.scss";

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/* ---------- Nastavení ---------- */

// Artboardy na šířku mají poměr volné plochy obrazovky (~1,9 : 1), aby
// zabraly skoro celou šířku i výšku.
// Na výšku: telefon 1000 × 1800 (~0,56 : 1), tablet širší 1400 × 1800
// (~0,78 : 1) — úzký artboard by na tabletu zabral jen půlku šířky.
const LAYOUT: Record<"wide" | "tall" | "tablet", Record<StudyBoard, Rect>> = {
  wide: {
    cover: { x: 0, y: 0, w: 1900, h: 1000 },
    play: { x: 2150, y: 0, w: 1900, h: 1000 },
    campaigns: { x: 0, y: 1250, w: 1900, h: 1000 },
    trust: { x: 2150, y: 1250, w: 1900, h: 1000 },
    outputs: { x: 1075, y: 2500, w: 1900, h: 1000 },
  },
  tall: {
    cover: { x: 0, y: 0, w: 1000, h: 1800 },
    play: { x: 0, y: 2000, w: 1000, h: 1800 },
    campaigns: { x: 0, y: 4000, w: 1000, h: 1800 },
    trust: { x: 0, y: 6000, w: 1000, h: 1800 },
    outputs: { x: 0, y: 8000, w: 1000, h: 1600 },
  },
  tablet: {
    cover: { x: 0, y: 0, w: 1400, h: 1800 },
    play: { x: 0, y: 2000, w: 1400, h: 1800 },
    campaigns: { x: 0, y: 4000, w: 1400, h: 1800 },
    trust: { x: 0, y: 6000, w: 1400, h: 1800 },
    outputs: { x: 0, y: 8000, w: 1400, h: 1600 },
  },
};

const BOARDS: StudyBoard[] = ["cover", "play", "campaigns", "trust", "outputs"];
const LAST = BOARDS.length - 1;
// Krok scrollu (vh) a jeho část, kdy kamera stojí a scroll řídí artboard;
// zbytek je přejezd (dlouhý, ať je jemný). Po Výstupech ještě jeden krok:
// oddálení na celé plátno (END) a výzva.
const STEP_VH = 170;
const DWELL = 0.5;
const END = LAST + 1;
const TOTAL = END + 1;
// Rámování celého plátna na konci.
const OVERVIEW = { fw: 0.86, fh: 0.78, fx: 0.5, fy: 0.52 };
// Přejezd je PLOCHÝ: jen odjezd kamery (podíl měřítka), bez 3D náklonu —
// ten rozmazával text, a kdo dojede scrollem napůl, viděl by ho rozmazaný.
const ISO = { pull: 0.14 };
// Po zastavení scrollu uprostřed přejezdu kamera dosedne na nejbližší
// zastávku (ms klidu, s doby dojezdu).
const SETTLE = { idle: 220, duration: 1.1 };
// Nástup stránky: přílet kamery z přehledu na titulní (s). Pomalý rozjezd,
// dlouhé dosednutí; artboardy se mezitím objeví (styles .board, --k).
const FLY_IN = { duration: 2.1, delay: 0.55, ease: [0.65, 0, 0.2, 1] as [number, number, number, number] };
// Rámování artboardu (podíl obrazovky) na šířku / na výšku.
// Na výšku svisle celé okno — místo nahoře a dole určí `roomy`.
const FRAME = { wide: { fw: 0.94, fh: 0.86, fx: 0.5, fy: 0.535 }, tall: { fw: 0.92, fh: 0.96, fx: 0.5, fy: 0.5 } };
// Nad artboardem plave hlavička a nad ním štítek s názvem (.boardName) —
// rámování jim nechá místo, jinak štítek zajede pod logo a roh artboardu
// pod tlačítko hlavičky. Dole pravítko kapitol (jeho horní hrana, px).
const ROOM = { label: 34, gap: 10 };
// Drobné písmo a prvky (`X / var(--cam-s)`) mají na obrazovce stálou
// velikost. Když artboard na malé obrazovce klesne pod ~0,53 skutečné
// velikosti, přerostly by ho — pod tím se zmenšují s ním, nejvýš na 0,75×.
const UI = { from: 0.37, to: 0.53, least: 0.75 };
const uiK = (s: number) => UI.least + (1 - UI.least) * Math.min(Math.max((s - UI.from) / (UI.to - UI.from), 0), 1);

/** Rámování zúžené shora o hlavičku se štítkem a zdola o pravítko kapitol (`floor`). */
const roomy = (f: (typeof FRAME)["wide"], H: number, head: number, floor: number): (typeof FRAME)["wide"] => {
  const top = Math.max(H * (f.fy - f.fh / 2), head + ROOM.label);
  const bottom = Math.min(H * (f.fy + f.fh / 2), floor - ROOM.gap);
  return { ...f, fh: (bottom - top) / H, fy: (top + bottom) / 2 / H };
};

const BOARD_NAME: Record<StudyBoard, string> = {
  cover: "Titulní",
  play: "Pro rodiče",
  campaigns: "Kampaně",
  trust: "Důvěra",
  outputs: "Výstupy",
};

/** Názvy zastávek: kapitoly podle obsahu (štítek), ostatní pevně. */
const boardNames = (c: StudyContent): Record<StudyBoard, string> => ({
  ...BOARD_NAME,
  play: c.chapters.play.label || BOARD_NAME.play,
  campaigns: c.chapters.campaigns.label || BOARD_NAME.campaigns,
  trust: c.chapters.trust.label || BOARD_NAME.trust,
});
const chaptersOf = (names: Record<StudyBoard, string>): Chapter[] => [...BOARDS.map((board, i) => ({ at: i, label: names[board] })), { at: END, label: "Spolupráce" }];

/* ---------- Kamera ---------- */

type Cam = { cx: number; cy: number; s: number; fx: number; fy: number };

const fit = (r: Rect, W: number, H: number, f: (typeof FRAME)["wide"]): Cam => ({
  cx: r.x + r.w / 2,
  cy: r.y + r.h / 2,
  s: Math.min((W * f.fw) / r.w, (H * f.fh) / r.h),
  fx: f.fx,
  fy: f.fy,
});

const boundsOf = (layout: Record<StudyBoard, Rect>): Rect => {
  const rects = Object.values(layout);
  const x0 = Math.min(...rects.map((r) => r.x));
  const y0 = Math.min(...rects.map((r) => r.y));
  const x1 = Math.max(...rects.map((r) => r.x + r.w));
  const y1 = Math.max(...rects.map((r) => r.y + r.h));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
};

/** Kde na cestě jsme: zastávka, průběh jejího stání, přejezd k další a výzva na konci. */
const where = (x: number) => {
  const i = Math.min(Math.floor(x), END);
  const f = x - i;
  if (i >= END) return { i, act: 1, travel: 0, end: span(f, 0, 0.55) };
  return { i, act: span(f, 0, DWELL), travel: span(f, DWELL, 1), end: 0 };
};

/** Kamera v bodě cesty x (0…TOTAL) — přesně jako apply(), bez náletu a zaokrouhlení. */
const cameraAt = (cams: Cam[], W: number, H: number, x: number, reduce: boolean) => {
  const { i, travel } = where(Math.min(Math.max(x, 0), TOTAL));
  const e = easeInOut(travel);
  const m = reduce ? 0 : Math.sin(Math.PI * e);
  const a = cams[i];
  const b = cams[Math.min(i + 1, END)];
  const s = Math.exp(Math.log(a.s) * (1 - e) + Math.log(b.s) * e) * (1 - ISO.pull * m);
  const cx = a.cx + (b.cx - a.cx) * e;
  const cy = a.cy + (b.cy - a.cy) * e;
  return { tx: W * (a.fx + (b.fx - a.fx) * e) - cx * s, ty: H * (a.fy + (b.fy - a.fy) * e) - cy * s, s };
};
const camTransform = ({ tx, ty, s }: { tx: number; ty: number; s: number }) =>
  `translate(${tx.toFixed(2)}px, ${ty.toFixed(2)}px) scale(${s.toFixed(5)})`;

// Safari na dotyku (iPhone, iPad): kameru jede nativní časová osa scrollu.
// framer-motion ji použije sám, když `useTransform(scrollYProgress, časy,
// snímky)` míří rovnou do `style.transform` (useScroll s cílem a offsetem
// „start start / end end"). Safari pak plátno posouvá ve stejném snímku
// jako scroll — kamera v JS (scroll událost → pružina → transform) na
// iPhonu ~každý 8. snímek nestihla a scéna se „cukala". Cesta kamery je
// navzorkovaná: stání 2 body, přejezd CAM_SAMPLES bodů (mezi nimi lineárně).
const NATIVE_CAMERA = "(hover: none) and (pointer: coarse)";
const CAM_SAMPLES = 24;
const IDENTITY = "translate(0px, 0px) scale(1)";
type CamFrames = { key: string; times: number[]; frames: string[] };

const cameraFrames = (cams: Cam[], W: number, H: number, reduce: boolean, key: string): CamFrames => {
  const xs: number[] = [];
  for (let i = 0; i < END; i++) {
    xs.push(i, i + DWELL);
    for (let k = 1; k < CAM_SAMPLES; k++) xs.push(i + DWELL + ((1 - DWELL) * k) / CAM_SAMPLES);
  }
  xs.push(END, TOTAL);
  return { key, times: xs.map((x) => x / TOTAL), frames: xs.map((x) => camTransform(cameraAt(cams, W, H, x, reduce))) };
};

/* ---------- Výzva na konci ---------- */

// Obměna CTA z homepage (home/cta): stejná řeč — tenké zelené verzálky,
// kroužek se šipkou, rámeček MeasureText a tenké křivky — ale bez recenzí,
// portrétu a bannerů. Jen věta, velké tlačítko uprostřed a stav.
const CLICK_SLOP = 6;

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M5 12h13M12 5.5 18.5 12 12 18.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ActionBody({ label, measure }: { label: string; measure: boolean }) {
  const words = label.split(/\s+/).filter(Boolean);
  return (
    <span className={styles.finaleBody}>
      <span className={styles.finaleLabel}>
        {measure
          ? words.map((word, i) => (
              <span key={i}>
                <span data-measure="">{word}</span>
                {i < words.length - 1 ? " " : null}
              </span>
            ))
          : label}
      </span>
      <span className={styles.finaleDisc} data-measure-frame={measure ? "" : undefined} aria-hidden="true">
        <ArrowIcon />
      </span>
    </span>
  );
}

function Finale({ c, p }: { c: StudyContent; p: MotionValue<number> }) {
  const veil = useTransform(p, (v) => easeInOut(span(v, 0, 0.35)));
  const stageScale = useTransform(p, (v) => 0.85 + 0.15 * easeInOut(span(v, 0.05, 0.5)));
  const draw = useTransform(p, (v) => easeInOut(span(v, 0.25, 0.85)));
  const statusIn = useTransform(p, (v) => span(v, 0.75, 0.95));
  const [on, setOn] = useState(false);
  const [built, setBuilt] = useState(false);
  useMotionValueEvent(p, "change", (v) => {
    setOn(v > 0.3);
    setBuilt(v >= 0.8);
  });
  // MeasureText si při stisku zachytí ukazatel — klik se čte na obalu.
  const press = useRef<{ x: number; y: number } | null>(null);
  return (
    <motion.div className={styles.finale} style={{ opacity: veil }} data-on={on || undefined}>
      <motion.div className={styles.finaleStage} style={{ scale: stageScale }} aria-hidden="true" />
      <svg className={styles.finaleSwoosh} viewBox="0 0 1000 600" preserveAspectRatio="none" aria-hidden="true">
        <motion.path d="M140 470c40-150 150-230 300-250" style={{ pathLength: draw }} />
        <motion.path d="M590 390c80 30 130 80 170 150" style={{ pathLength: draw }} />
        <motion.circle cx="760" cy="540" r="4.5" style={{ opacity: draw }} />
      </svg>
      <div className={styles.finaleInner}>
        <SketchText as="p" progress={p} from={0.1} to={0.45} className={styles.finaleLead}>
          <Parts parts={c.cta.lead} />
        </SketchText>
        <div
          className={styles.finaleHit}
          data-contact-zone=""
          onPointerDown={(e) => {
            const onButton = (e.target as Element).closest?.("button");
            press.current = e.button === 0 && onButton ? { x: e.clientX, y: e.clientY } : null;
          }}
          onPointerUp={(e) => {
            const start = press.current;
            press.current = null;
            if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) <= CLICK_SLOP) openContact();
          }}
        >
          <MeasureText enabled={built} sweep={built} className={styles.finaleMeasure}>
            <button type="button" className={styles.finaleAction} onClick={(e) => e.detail === 0 && openContact()}>
              <SketchText progress={p} from={0.3} to={0.8} style={{ display: "block" }} ghost={<ActionBody label={c.cta.button} measure={false} />}>
                <ActionBody label={c.cta.button} measure />
              </SketchText>
            </button>
          </MeasureText>
        </div>
        <motion.p className={styles.finaleStatus} style={{ opacity: statusIn }}>
          <span className={styles.finaleDot} aria-hidden="true" />
          <Parts parts={c.cta.status} />
        </motion.p>
      </div>
    </motion.div>
  );
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/* ---------- Plátno ---------- */

function Canvas({ c, docId }: { c: StudyContent; docId: string | null }) {
  const names = boardNames(c);
  const CHAPTERS = chaptersOf(names);
  const sectionRef = useRef<HTMLElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const lensRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const boardRefs = useRef<Partial<Record<StudyBoard, HTMLDivElement | null>>>({});
  const rulerLeft = useRef<HTMLCanvasElement>(null);
  const rulerBottom = useRef<HTMLCanvasElement>(null);
  const zoomRef = useRef<HTMLSpanElement>(null);
  const { go } = useGate();
  const reduce = Boolean(useReducedMotion());
  const tall = useMedia(PORTRAIT_TABLET);
  const phone = useMedia(PORTRAIT_PHONE);
  const layout = LAYOUT[tall ? (phone ? "tall" : "tablet") : "wide"];
  const bounds = boundsOf(layout);

  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end end"] });
  const target = useTransform(scrollYProgress, (v) => v * TOTAL);
  const pos = useSpring(target, { stiffness: 70, damping: 22, mass: 1 });
  // Dotyk: díla v artboardu (JS) za tuhou, kriticky tlumenou pružinou. Na
  // iPhonu přijde hodnota scrollu ~každý 8. snímek pozdě — bez pružiny dílo
  // ten snímek stojí a pak skočí (klepání); pružina z toho udělá plynulý
  // pohyb se zpožděním pár desítek ms (kamera stojí, není to vidět).
  const posTouch = useSpring(target, { stiffness: 380, damping: 42, mass: 0.6 });
  // Safari na dotyku: kamera na nativní ose scrollu (viz cameraFrames) a vše
  // ostatní (stavba artboardů, pravítka, zvednutí vrstev) jede přímo za
  // scrollem, ne za pružinou — jinak by se rozešlo s kamerou.
  const native = useMedia(NATIVE_CAMERA);
  const nativeRef = useRef(native);
  useIsoLayoutEffect(() => {
    nativeRef.current = native;
  }, [native]);
  const [camFrames, setCamFrames] = useState<CamFrames | null>(null);
  const camera = useTransform(scrollYProgress, camFrames?.times ?? [0, 1], camFrames?.frames ?? [IDENTITY, IDENTITY]);

  // Průběh každé zastávky (0–1) — artboard za námi stojí na 1, před námi na 0.
  const actCover = useMotionValue(0);
  const actPlay = useMotionValue(0);
  const actCampaigns = useMotionValue(0);
  const actTrust = useMotionValue(0);
  const actOutputs = useMotionValue(0);
  // Výzva na konci (0–1).
  const endIn = useMotionValue(0);
  const acts: Record<StudyBoard, MotionValue<number>> = {
    cover: actCover,
    play: actPlay,
    campaigns: actCampaigns,
    trust: actTrust,
    outputs: actOutputs,
  };

  // Nástup: kamera začne na přehledu celého plátna (artboardy se mezitím
  // po jednom objeví, styles .board) a přiletí na titulní. Obsah titulní
  // se začne stavět, až kamera dosedne (`arrived` → BoardProps.go).
  const flyIn = useMotionValue(reduce ? 1 : 0);
  const [arrived, setArrived] = useState(reduce);
  useEffect(() => {
    if (!go || reduce) return;
    // Nativní kamera (dotyk): bez náletu — transform plátna patří ose scrollu.
    if (native) {
      flyIn.set(1);
      const timer = window.setTimeout(() => setArrived(true), FLY_IN.delay * 1000);
      return () => window.clearTimeout(timer);
    }
    const controls = animate(flyIn, 1, {
      duration: FLY_IN.duration,
      delay: FLY_IN.delay,
      ease: FLY_IN.ease,
      onComplete: () => setArrived(true),
    });
    return () => controls.stop();
  }, [go, reduce, flyIn, native]);

  // Náběh pravítek po oponě.
  const rulerIn = useMotionValue(reduce ? 1 : 0);
  useEffect(() => {
    if (!go || reduce) return;
    const controls = animate(rulerIn, 1, { duration: 1.8, ease: [0.65, 0, 0.35, 1], delay: 0.3 });
    return () => controls.stop();
  }, [go, reduce, rulerIn]);

  const [stop, setStop] = useState<StudyBoard>("cover");
  const [hoverChapter, setHoverChapter] = useState(-1);

  const cams = useRef<Cam[]>([]);
  const live = useRef({ W: 0, H: 0, m: 0, x: 0, active: "cover" as StudyBoard | null, hover: -1 });
  // Co je na pravítkách nakreslené (klíč vstupů) — kreslí se jen při změně.
  const drawn = useRef({ left: "", chapters: "" });

  const apply = () => {
    const world = worldRef.current;
    const lens = lensRef.current;
    const frame = frameRef.current;
    if (!world || !lens || !frame || !cams.current.length) return;
    const L = live.current;
    const { W, H } = L;
    const isNative = nativeRef.current;
    const x = Math.min(Math.max((isNative ? posTouch : pos).get(), 0), TOTAL);
    const { i, act, travel, end } = where(x);
    const e = easeInOut(travel);
    const m = reduce ? 0 : Math.sin(Math.PI * e);
    const a = cams.current[i];
    const b = cams.current[Math.min(i + 1, END)];
    const s = Math.exp(Math.log(a.s) * (1 - e) + Math.log(b.s) * e) * (1 - ISO.pull * m);
    const cx = a.cx + (b.cx - a.cx) * e;
    const cy = a.cy + (b.cy - a.cy) * e;
    // Na zastávce celé px (ostrý text), při přejezdu plynule.
    const still = travel <= 0;
    const snap = (n: number) => (still ? Math.round(n) : n);
    let tx = snap(W * (a.fx + (b.fx - a.fx) * e) - cx * s);
    let ty = snap(H * (a.fy + (b.fy - a.fy) * e) - cy * s);
    let sNow = s;
    // Nástup: z přehledu celého plátna (kamera END) do právě spočtené.
    const f = flyIn.get();
    if (f < 1) {
      const o = cams.current[END];
      sNow = Math.exp(Math.log(o.s) * (1 - f) + Math.log(s) * f);
      const fx = o.fx + (a.fx + (b.fx - a.fx) * e - o.fx) * f;
      const fy = o.fy + (a.fy + (b.fy - a.fy) * e - o.fy) * f;
      const ox = o.cx + (cx - o.cx) * f;
      const oy = o.cy + (cy - o.cy) * f;
      tx = W * fx - ox * sNow;
      ty = H * fy - oy * sNow;
    }
    Object.assign(L, { m, x });
    // Na dotyku transform světa píše nativní osa scrollu (style.transform = camera).
    if (!isNative) world.style.transform = `translate(${tx.toFixed(2)}px, ${ty.toFixed(2)}px) scale(${sNow.toFixed(5)})`;
    // --cam-s = měřítko pro písmo a drobné prvky (`X / var(--cam-s)`): měřítko
    // zastávek, ne skutečné — při oddálení na celé plátno se text nezvětší
    // přes artboardy, ale zmenší se s nimi (přehled drží měřítko Výstupů).
    const textOf = (k: number) => cams.current[Math.min(k, LAST)].s;
    const textS = Math.exp(Math.log(textOf(i)) * (1 - e) + Math.log(textOf(i + 1)) * e);
    // Na malé obrazovce se drobné prvky zmenšují s artboardem (UI).
    // --cam-s a --m čte ~150 pravidel artboardů (písmo, stíny, obrysy), takže
    // každý zápis = přepočet stylu i layoutu celého plátna. Zapisují se jen
    // znatelné změny (0,3 % měřítka; na zastávce vždy přesně) — dřív každý
    // snímek scrollu, na iPhonu hlavní zdroj trhání.
    const camS = textS / uiK(textS);
    const camText = camS.toFixed(5);
    const lastCam = world.style.getPropertyValue("--cam-s");
    if (camText !== lastCam && (still || !lastCam || Math.abs(camS / Number(lastCam) - 1) > 0.003))
      world.style.setProperty("--cam-s", camText);
    const mText = m.toFixed(4);
    const lastM = world.style.getPropertyValue("--m");
    if (mText !== lastM && (still || m === 0 || !lastM || Math.abs(m - Number(lastM)) > 0.01)) {
      world.style.setProperty("--m", mText);
      frame.style.setProperty("--m", mText);
    }
    // Tečkovaná mřížka jede s kamerou. Na dotyku (nativní kamera) stojí jako
    // podklad — mřížka uvnitř zvětšovaného světa by byla obří GPU vrstva.
    if (!isNative) {
      const grid = 50 * sNow;
      frame.style.backgroundSize = `${grid.toFixed(2)}px ${grid.toFixed(2)}px`;
      frame.style.backgroundPosition = `${tx.toFixed(2)}px ${ty.toFixed(2)}px`;
    } else if (frame.style.backgroundSize) {
      frame.style.backgroundSize = "";
      frame.style.backgroundPosition = "";
    }
    if (zoomRef.current) zoomRef.current.textContent = `${Math.round(sNow * 100)} %`;

    BOARDS.forEach((board, k) => acts[board].set(k < i ? 1 : k > i ? 0 : act));
    endIn.set(end);
    const now = BOARDS[Math.min(travel > 0.5 ? i + 1 : i, LAST)];
    L.active = m < 0.02 && i <= LAST ? BOARDS[i] : null;
    setStop((prev) => (prev === now ? prev : now));

    // Pravítko vlevo: artboard zastávky zeleně.
    const reveal = rulerIn.get();
    const r = i <= LAST ? layout[BOARDS[i]] : bounds;
    const band = `rgba(${ACCENT_RGB}, ${0.9 * (1 - m)})`;
    // Pravítka (plátno 2D) kreslit jen při změně — při stání kamery levé
    // pravítko stojí, dřív se překreslovalo každý snímek scrollu.
    const leftKey = `${ty.toFixed(1)}|${s.toFixed(5)}|${m.toFixed(3)}|${reveal.toFixed(3)}|${i}`;
    if (leftKey !== drawn.current.left) {
      drawn.current.left = leftKey;
      drawRuler(rulerLeft.current, true, ty, s, [{ from: r.y * s + ty, to: (r.y + r.h) * s + ty, color: band }], [], reveal, true);
    }
    const chaptersKey = `${x.toFixed(4)}|${L.hover}|${reveal.toFixed(3)}`;
    if (chaptersKey !== drawn.current.chapters) {
      drawn.current.chapters = chaptersKey;
      drawChapters(rulerBottom.current, CHAPTERS, TOTAL, x, L.hover, reveal);
    }
  };

  useIsoLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const measure = () => {
      // Nové rozměry = nová plátna pravítek → nakreslit znovu.
      drawn.current = { left: "", chapters: "" };
      const W = frame.clientWidth;
      const H = frame.clientHeight;
      Object.assign(live.current, { W, H });
      const head = document.querySelector("header")?.getBoundingClientRect().bottom ?? 0;
      // Pravítko kapitol (na telefonu nad lištou s výzvou) — artboard nad ním.
      const ruler = rulerBottom.current?.getBoundingClientRect();
      const floor = ruler && ruler.height ? ruler.top - frame.getBoundingClientRect().top : H;
      const f = roomy(tall ? FRAME.tall : FRAME.wide, H, head, floor);
      cams.current = [...BOARDS.map((key) => fit(layout[key], W, H, f)), fit(bounds, W, H, OVERVIEW)];
      // Hodně malý artboard (telefon na šířku): styly schovají vedlejší
      // popisky, které by se do něj nevešly.
      frame.toggleAttribute("data-small", cams.current[0].s < UI.from + 0.05);
      // Nativní kamera: cesta navzorkovaná pro tenhle rozměr (klíč přemountuje svět).
      if (nativeRef.current) {
        const key = `${W}x${H}:${Math.round(f.fy * 1000)}:${Math.round(f.fh * 1000)}`;
        setCamFrames((prev) => (prev?.key === key ? prev : cameraFrames(cams.current, W, H, reduce, key)));
      }
      // Štítek zoomu vpravo dole ustoupí, když by ležel přes artboard
      // (úzké okno — artboard zabere skoro celou šířku).
      const badge = zoomRef.current?.parentElement;
      if (badge) {
        const cam = cams.current[0];
        const right = W * cam.fx + (layout.cover.w / 2) * cam.s;
        const bottom = H * cam.fy + (layout.cover.h / 2) * cam.s;
        const b = badge.getBoundingClientRect();
        const o = frame.getBoundingClientRect();
        const hit = right > b.left - o.left - 8 && bottom > b.top - o.top - 8;
        badge.toggleAttribute("data-hidden", hit);
      }
      apply();
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [tall, phone, native]);
  useMotionValueEvent(pos, "change", () => {
    if (!nativeRef.current) apply();
  });
  useMotionValueEvent(posTouch, "change", () => {
    if (nativeRef.current) apply();
  });
  useMotionValueEvent(rulerIn, "change", apply);
  useMotionValueEvent(flyIn, "change", apply);


  // Dosednutí: scroll se zastavil uprostřed přejezdu → dojet na bližší
  // konec (stání této zastávky, nebo začátek další).
  useEffect(() => {
    if (reduce) return;
    let timer = 0;
    // Prst na displeji: nedosedat. Kdo drží prst uprostřed přejezdu,
    // nescrolluje (žádné scroll události), a dosednutí by mu stránku
    // vytrhlo zpod prstu. Po puštění se počítá znovu (i doběh setrvačnosti
    // posílá scroll a odkládá ho).
    let touching = false;
    const settle = () => {
      if (touching) return;
      const section = sectionRef.current;
      if (!section) return;
      const x = target.get();
      const { i, travel } = where(x);
      if (travel <= 0.02 || travel >= 0.98) return;
      const to = travel > 0.5 ? i + 1 : i + DWELL;
      const top = section.getBoundingClientRect().top + window.scrollY;
      const y = top + (section.offsetHeight - viewportHeight()) * (to / TOTAL);
      if (window.lenisInstance) window.lenisInstance.scrollTo(y, { duration: SETTLE.duration });
      else window.scrollTo({ top: y, behavior: "smooth" });
    };
    const onScroll = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(settle, SETTLE.idle);
    };
    const onTouchStart = () => {
      touching = true;
      window.clearTimeout(timer);
    };
    const onTouchEnd = (event: TouchEvent) => {
      if (event.touches.length) return;
      touching = false;
      onScroll();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("touchcancel", onTouchEnd, { passive: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [reduce, target]);

  // Skok na kapitolu (pravítko dole).
  const jump = (k: number) => {
    const section = sectionRef.current;
    if (!section) return;
    const top = section.getBoundingClientRect().top + window.scrollY;
    const y = top + (section.offsetHeight - viewportHeight()) * (k / TOTAL);
    if (window.lenisInstance) window.lenisInstance.scrollTo(y, { duration: 1.8 });
    else window.scrollTo({ top: y, behavior: "smooth" });
  };

  const index = BOARDS.indexOf(stop);

  return (
    <section
      ref={sectionRef}
      className={styles.canvasSection}
      data-scroll-label="Úvod"
      // Ve Studiu: klik kamkoli na plátno otevře dokument projektu.
      {...editableDoc(docId, "project")}
      style={{ "--total": TOTAL, "--step-vh": STEP_VH } as CSSProperties}
    >
      {CHAPTERS.slice(1).map((ch) => (
        <span
          key={ch.label}
          className={styles.scrollMark}
          data-scroll-section=""
          data-scroll-label={ch.label}
          style={{ "--at": ch.at / TOTAL } as CSSProperties}
          aria-hidden="true"
        />
      ))}
      <div
        ref={frameRef}
        className={styles.canvasFrame}
        data-tall={tall || undefined}
        data-flat=""
        data-study-frame=""
        data-go={go || undefined}
      >
        {/* Jen prolnutí — pohyb dělá kamera (FLY_IN) a artboardy (.board). */}
        <motion.div
          className={styles.worldFade}
          initial={reduce ? false : { opacity: 0 }}
          animate={go ? { opacity: 1 } : undefined}
          transition={{ duration: 0.6, ease: ENTRANCE }}
        >
          <div ref={lensRef} className={styles.lens}>
            {/* Na dotyku `style.transform` = nativní osa scrollu (framer-motion);
                klíč přemountuje svět, když se cesta kamery přepočítá (rozměr). */}
            <motion.div
              key={native ? camFrames?.key ?? "native" : "js"}
              ref={worldRef}
              className={styles.world}
              data-native={native || undefined}
              style={native && camFrames ? { width: bounds.w, height: bounds.h, transform: camera } : { width: bounds.w, height: bounds.h }}
            >
              {BOARDS.map((board, k) => {
                const r = layout[board];
                // Obsah se staví až po příletu kamery (FLY_IN).
                const props: BoardProps = {
                  c,
                  act: acts[board],
                  rect: r,
                  go: go && arrived,
                  reduce,
                  seen: k <= index,
                  progress: scrollYProgress,
                  // Stání artboardu k: x od k do k + DWELL (where), x = p · TOTAL.
                  range: [k / TOTAL, (k + DWELL) / TOTAL],
                  // Díla uvnitř zvětšeného světa NEJEDOU nativně: každý nativně
                  // animovaný prvek je na iPhonu GPU vrstva v plném rozlišení
                  // (bez ohledu na zoom kamery) a stránka spadla do 1,5 s.
                  // Nativně jede jen kamera (jedna vrstva), díla motion hodnotami.
                  native: false,
                };
                return (
                  <div
                    key={board}
                    ref={(el) => {
                      boardRefs.current[board] = el;
                    }}
                    className={styles.board}
                    data-board={board}
                    data-active={stop === board || undefined}
                    data-seen={k <= index || undefined}
                    style={{ left: r.x, top: r.y, width: r.w, height: r.h, "--k": k } as CSSProperties}
                  >
                    <span className={styles.plate} aria-hidden="true" />
                    <p className={styles.boardName}>
                      <span>
                        {pad2(k + 1)} {names[board]}
                      </span>
                      <span>
                        {r.w} × {r.h} px
                      </span>
                    </p>
                    <div className={styles.boardFace}>
                      {board === "cover" && <CoverBoard {...props} />}
                      {board === "play" && <PlayBoard {...props} />}
                      {board === "campaigns" && <CampaignsBoard {...props} />}
                      {board === "trust" && <TrustBoard {...props} />}
                      {board === "outputs" && <OutputsBoard {...props} />}
                    </div>
                  </div>
                );
              })}
            </motion.div>
          </div>
        </motion.div>

        <Finale c={c} p={endIn} />

        {/* ---------- Pravítka ---------- */}
        <canvas ref={rulerLeft} className={styles.rulerLeft} aria-hidden="true" />
        <canvas
          ref={rulerBottom}
          className={styles.rulerBottom}
          role="navigation"
          aria-label="Kapitoly studie"
          onPointerMove={(e) => {
            const k = chapterAt(e.currentTarget, CHAPTERS, TOTAL, e.nativeEvent.offsetX);
            live.current.hover = k;
            if (k !== hoverChapter) {
              setHoverChapter(k);
              apply();
            }
          }}
          onPointerLeave={() => {
            live.current.hover = -1;
            setHoverChapter(-1);
            apply();
          }}
          onClick={(e) => {
            const k = chapterAt(e.currentTarget, CHAPTERS, TOTAL, e.nativeEvent.offsetX);
            if (k >= 0) jump(CHAPTERS[k].at);
          }}
        />
        <span className={styles.zoomBadge} aria-hidden="true">
          {c.title}.fig · <span ref={zoomRef}>100 %</span>
        </span>

      </div>
    </section>
  );
}

// Plátno a inspektor zadokovaný vpravo.
export default function Study({
  content = STUDY_TEMPLATE,
  visuals = null,
  docId = null,
}: {
  content?: StudyContent;
  /** 3D vizuály ze Studia — detail díla si podle obrázku vezme jejich vrstvy. */
  visuals?: VisualDef[] | null;
  /** Id dokumentu projektu (jen náhled Studia). */
  docId?: string | null;
}) {
  // Registrace je idempotentní; stačí před prvním otevřením detailu.
  registerVisuals(visuals);
  // Detail díla: obrázek a prvek díla, vedle kterého se karta nalepí.
  const [inspected, setInspected] = useState<{ image: StudyImage; anchor: HTMLElement | null } | null>(null);
  const close = useCallback(() => setInspected(null), []);
  const inspect = useCallback((image: StudyImage, anchor?: HTMLElement | null) => setInspected({ image, anchor: anchor ?? null }), []);
  // Telefon na výšku: čtivá stránka v jednom sloupci (column.tsx), bez plátna
  // a animací na scrollu. Server ji vykreslí pro všechny (text studie je
  // v HTML), větší obrazovky ji po hydrataci vymění za plátno — pod oponou
  // přechodu stránky, takže to není vidět.
  const canvas = useMedia(CANVAS_SCREEN);
  return (
    <InspectContext.Provider value={inspect}>
      {canvas ? <Canvas c={content} docId={docId} /> : <StudyColumn c={content} />}
      <InspectorDock image={inspected?.image ?? null} anchor={inspected?.anchor} onClose={close} />
    </InspectContext.Provider>
  );
}

/** Plné plátno všude kromě zjednodušené verze (STACKED: telefon na výšku i na šířku). */
const CANVAS_SCREEN = FULL;
