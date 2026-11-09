// DesignCursor — kurzor spolupracovníka jako v grafickém editoru (Figma,
// Adobe): šipka a jmenovka. Šipka stojí přesně na pozici, jmenovka za ní
// jede na pružině (useSpring) — při rychlém pohybu se odtrhne a zase
// dojede, jako by ji kurzor táhl za sebou.
//
//     <DesignCursor x={x} y={y} opacity={o} name="Sabina" />          umělá myš
//     <DesignCursor x={x} y={y} opacity={o} name="Vy" tone="light" />   návštěvník
//
// `text` = textový kurzor (I) místo šipky — když myš píše do textu.
//
// Jmenovka umí měnit podobu plynule: `morph` přelije text (TextMorph),
// `size` ji zvětší/zmenší a `tone` přebarví — např. velké zelené „Táhnout"
// nad 3D scénou se po jejím smazání přelije na malé bílé „Vy".
//
// Polohy jsou souřadnice okna (MotionValues). Kreslí se ve `position: fixed`
// v portálu do <body>, aby kurzor mohl přejít přes hranice sekcí.

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { motion, useSpring, useTransform, type MotionValue } from "framer-motion";
import TextMorph from "@/components/common/text-morph";
import styles from "./styles.module.scss";
import { fluidRatio, useLandscapeFluid } from "@/lib/fluid";

/* ---------- Nastavení ---------- */

// Pružina jmenovky: nižší tuhost = víc se při rychlém pohybu odtrhne.
const TAG_SPRING = { stiffness: 190, damping: 19, mass: 0.7 };
// Kde jmenovka sedí vůči špičce šipky (px).
const TAG_OFFSET = { x: 15, y: 21 };
// Velká jmenovka (nápověda): zvětšení a odstup od kurzoru.
const LARGE = { scale: 1.9, offset: { x: 26, y: 26 } };
// Větší kurzor (umělá myš „Sabina"): zvětšení šipky i jmenovky a odstup
// jmenovky od větší šipky.
const BIG = { scale: 1.35, offset: { x: 21, y: 29 } };
// Barvy podle tónu a délka přechodu mezi podobami.
const TONES = {
  accent: { background: "#bec948", color: "#141414" },
  light: { background: "#ffffff", color: "#141414" },
};
const CHANGE = { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const };

/* ---------- Portál ---------- */

const subscribeNothing = () => () => {};
const onClient = () => true;
const onServer = () => false;

function Portal({ children }: { children: ReactNode }) {
  const client = useSyncExternalStore(subscribeNothing, onClient, onServer);
  return client ? createPortal(children, document.body) : null;
}

/* ---------- Přelévaná jmenovka ---------- */

/**
 * TextMorph drží šířku nejdelšího slova (řádek se nehýbe). Jmenovka se ale má
 * stáhnout na nové slovo — tady se slova změří a šířka dojede na aktuální.
 */
function MorphLabel({ words, index }: { words: string[]; index: number }) {
  const measureRef = useRef<HTMLSpanElement>(null);
  const [widths, setWidths] = useState<number[] | null>(null);
  const key = words.join("|");

  useLayoutEffect(() => {
    const read = () => {
      const node = measureRef.current;
      if (!node) return;
      setWidths(Array.from(node.children, (child) => (child as HTMLElement).getBoundingClientRect().width));
    };
    read();
    // Písmo se může dočíst později a slova pak mají jinou šířku.
    document.fonts?.ready.then(read);
  }, [key]);

  const width = widths ? widths[((index % words.length) + words.length) % words.length] : undefined;
  return (
    <motion.span
      className={styles.morphLabel}
      initial={false}
      animate={width === undefined ? {} : { width }}
      transition={CHANGE}
    >
      <TextMorph words={words} index={index} measure={false} />
      <span ref={measureRef} className={styles.morphMeasure} aria-hidden="true">
        {words.map((word, i) => (
          <span key={i}>{word}</span>
        ))}
      </span>
    </motion.span>
  );
}

/* ---------- Komponenta ---------- */

type DesignCursorProps = {
  x: MotionValue<number>;
  y: MotionValue<number>;
  /** Viditelnost 0–1. */
  opacity: MotionValue<number> | number;
  /** Jmenovka (bez `morph`). */
  name?: string;
  /** Jmenovka, která se přelévá mezi slovy (TextMorph) podle `index`. */
  morph?: { words: string[]; index: number };
  /** "accent" = zelená jmenovka (Sabina), "light" = bílá (návštěvník). */
  tone?: "accent" | "light";
  /** Stisk tlačítka 0–1 (zmenší šipku, kroužek). */
  press?: MotionValue<number>;
  /** Duplikování (Alt-tah): u šipky „+". */
  duplicate?: MotionValue<number>;
  /** Vrstva nad stránkou (návštěvník nad umělou myší). */
  zIndex?: number;
  /** `false` = jen jmenovka (šipku nahrazují tečky kurzoru webu). */
  arrow?: boolean;
  /** "large" = výrazná jmenovka (nápověda, např. „Táhnout"). */
  size?: "normal" | "large";
  /** Textový kurzor (I) místo šipky — myš právě píše. */
  text?: boolean;
  /** Větší šipka i jmenovka (BIG) — umělá myš, ať je vidět. */
  big?: boolean;
};

export default function DesignCursor({
  x,
  y,
  opacity,
  name,
  morph,
  tone = "accent",
  press,
  duplicate,
  zIndex = 60,
  arrow = true,
  size = "normal",
  text = false,
  big = false,
}: DesignCursorProps) {
  const tagX = useSpring(x, TAG_SPRING);
  const tagY = useSpring(y, TAG_SPRING);
  const large = size === "large";
  const base = large ? LARGE.offset : big ? BIG.offset : TAG_OFFSET;
  // Šipka a jmenovka se na notebooku zmenšují s panely nástroje (fluid-ui,
  // $fluid ui-ratio 0.75) — odstup jmenovky od šipky s nimi.
  const fluid = useLandscapeFluid();
  const k = fluidRatio(fluid, 0.75);
  const offset = { x: base.x * k, y: base.y * k };
  const tagScale = large ? LARGE.scale : big ? BIG.scale : 1;
  // Odstup jmenovky jede plynule s velikostí.
  const offsetX = useSpring(offset.x, { stiffness: 160, damping: 22 });
  const offsetY = useSpring(offset.y, { stiffness: 160, damping: 22 });
  useEffect(() => {
    offsetX.set(offset.x);
    offsetY.set(offset.y);
  }, [offset.x, offset.y, offsetX, offsetY]);
  const tagLeft = useTransform([tagX, offsetX] as const, ([v, o]: number[]) => v + o);
  const tagTop = useTransform([tagY, offsetY] as const, ([v, o]: number[]) => v + o);
  const scale = useTransform(press ?? x, (p) => (press ? 1 - 0.12 * p : 1));
  const ring = useTransform(press ?? x, (p) => (press ? 0.4 + p * 0.9 : 0));
  const ringOpacity = useTransform(press ?? x, (p) => (press ? p * 0.55 : 0));

  return (
    <Portal>
      <motion.div
        className={styles.arrowLayer}
        data-tone={tone}
        data-big={big ? "" : undefined}
        style={{ x, y, opacity, zIndex }}
        aria-hidden="true"
      >
        {/* Šipka se při změně podoby prolne (např. tečky → šipka). */}
        <motion.div initial={false} animate={{ opacity: arrow ? 1 : 0 }} transition={CHANGE}>
          {press ? <motion.span className={styles.ring} style={{ scale: ring, opacity: ringOpacity }} /> : null}
          <motion.svg
            className={styles.arrow}
            viewBox="0 0 24 24"
            style={{ scale, originX: 0, originY: 0 }}
            initial={false}
            animate={{ opacity: text ? 0 : 1 }}
            transition={{ duration: 0.15 }}
          >
            <path d="M3 2.5 3 19.5 7.6 15.2 10.9 22.2 14 20.8 10.8 14 17 14Z" />
          </motion.svg>
          {/* Textový kurzor (I) — střed na pozici myši. */}
          <motion.svg
            className={styles.beam}
            viewBox="0 0 12 24"
            initial={false}
            animate={{ opacity: text ? 1 : 0 }}
            transition={{ duration: 0.15 }}
          >
            <path d="M3 2.5h2.2c.6 0 .8.3.8.8v17.4c0 .5-.2.8-.8.8H3M9 2.5H6.8c-.6 0-.8.3-.8.8v17.4c0 .5.2.8.8.8H9M4 12h4" />
          </motion.svg>
          {duplicate ? (
            <motion.span className={styles.plus} style={{ opacity: duplicate, scale: duplicate }}>
              +
            </motion.span>
          ) : null}
        </motion.div>
      </motion.div>
      <motion.span
        className={styles.tag}
        style={{ x: tagLeft, y: tagTop, opacity, zIndex, originX: 0, originY: 0 }}
        initial={false}
        animate={{ scale: tagScale, ...TONES[tone] }}
        transition={CHANGE}
        aria-hidden="true"
      >
        {morph ? <MorphLabel words={morph.words} index={morph.index} /> : name}
      </motion.span>
    </Portal>
  );
}
