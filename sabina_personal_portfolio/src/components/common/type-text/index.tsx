// TypeText — text, který někdo „napíše" (engine.ts, z GhostType jen psaní).
//
//     <TypeText
//       as="span"
//       segments={[{ text: "mají " }, { text: "smysl.", className: styles.accent }]}
//       placeholder="Nadpis"
//       play={typing}
//     />
//
// `play` false → zástupný text, true → označí ho, smaže a napíše skutečný.
// `still` → rovnou hotový text (Studio, omezený pohyb). Rozměr drží
// neviditelný sizer s celým textem (i zástupným), takže se layout nehýbe.
// Celý text je i ve skrytém spanu pro čtečky a vyhledávače.

import { useEffect, useRef, useSyncExternalStore, type CSSProperties } from "react";
import { createTyper, type TypeCaret, type TypeSegment, type TypeSettings, type Typer } from "./engine";
import styles from "./styles.module.scss";

/* ---------- Nastavení ---------- */

const settings = {
  accentColor: "#bec948",
  typeSpeed: 38,
  selectDelay: 380,
  caretHold: 900,
  caret: "bar" as TypeCaret,
  caretBlink: true,
};

/* ---------- Prostředí ---------- */

const REDUCED = "(prefers-reduced-motion: reduce)";
const subscribeReduced = (notify: () => void) => {
  const media = window.matchMedia(REDUCED);
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
};
const readReduced = () => window.matchMedia(REDUCED).matches;

/* ---------- Komponenta ---------- */

type Tag = "span" | "p" | "div" | "h2" | "h3";

type TypeTextProps = {
  segments: TypeSegment[];
  placeholder?: string;
  play: boolean;
  still?: boolean;
  /** Rychlost psaní (ms na znak), výchozí z nastavení. */
  typeSpeed?: number;
  /** Jak dlouho je zástupný text označený před smazáním (ms). */
  selectDelay?: number;
  /** Jak dlouho stříška po dopsání ještě stojí (ms). */
  caretHold?: number;
  as?: Tag;
  className?: string;
  style?: CSSProperties;
  onDone?: () => void;
} & Record<string, unknown>;

export default function TypeText({
  segments,
  placeholder = "",
  play,
  still = false,
  typeSpeed = settings.typeSpeed,
  selectDelay = settings.selectDelay,
  caretHold = settings.caretHold,
  as = "span",
  className,
  style,
  onDone,
  ...rest
}: TypeTextProps) {
  const lineRef = useRef<HTMLSpanElement>(null);
  const typerRef = useRef<Typer | null>(null);
  const reduced = useSyncExternalStore(subscribeReduced, readReduced, () => false);
  const full = segments.map((segment) => segment.text).join("");

  const settingsRef = useRef<TypeSettings>({ ...settings, segments, placeholder, typeSpeed, selectDelay, caretHold, onDone });
  useEffect(() => {
    settingsRef.current = { ...settings, segments, placeholder, typeSpeed, selectDelay, caretHold, onDone };
  });

  useEffect(() => {
    const line = lineRef.current;
    if (!line || still) return;
    const typer = createTyper(line, settingsRef);
    typerRef.current = typer;
    return () => {
      typer.destroy();
      typerRef.current = null;
    };
  }, [still]);

  // Jiný text = znovu podle stavu.
  useEffect(() => {
    const typer = typerRef.current;
    if (!typer) return;
    if (reduced) typer.finish();
    else if (play) typer.play();
    else typer.reset();
  }, [play, reduced, full]);

  const Tag = as as unknown as "span";

  if (still) {
    return (
      <Tag className={className} style={style} {...rest}>
        {segments.map((segment, i) => (
          <span key={i} className={segment.className}>
            {segment.text}
          </span>
        ))}
      </Tag>
    );
  }

  return (
    <Tag className={[styles.root, className].filter(Boolean).join(" ")} style={style} {...rest}>
      <span className={styles.hidden}>{full}</span>
      <span className={styles.grid} aria-hidden="true">
        <span className={styles.sizer}>
          {segments.map((segment, i) => (
            <span key={i} className={segment.className}>
              {segment.text}
            </span>
          ))}
        </span>
        <span className={styles.sizer}>{placeholder}</span>
        <span ref={lineRef} className={styles.line} />
      </span>
    </Tag>
  );
}
