// Text, který se jednou srazí z kouře — týž kouř jako nápověda
// „Objevujte posunutím" (scroll-placeholder/smoke.ts), jen bez smyčky.
//
// Postup řídí volající: `progress` 0–1 (framer MotionValue). 0 = text není,
// 1 = text celý. Mezi tím kreslí WebGL fázi sražení s čelem od prvního
// písmene; na 1 převezme text ostrý DOM a plátno se zahodí (WebGL kontextů
// je v prohlížeči málo, modál nesmí držet dva navíc).
//
// Kde kouř nejde — slabý stroj, žádné WebGL2, modul ještě nedorazil — text
// jen prolne krytím podle `progress`. `still` = bez animace (omezený pohyb,
// Studio): obyčejný text, jeden textový uzel, aby ho šlo upravit na místě.

import { useEffect, useMemo, useRef, type RefObject } from "react";
import { frameData, motion, useMotionValue, useMotionValueEvent, type MotionValue } from "framer-motion";
import { usePerformance } from "@/providers/PerformanceProvider";
import type { Smoke, SmokeConfig } from "@/components/common/scroll-placeholder/smoke";
import styles from "./styles.module.scss";

// Vzhled kouře — jako nápověda posunu, jen písmena přijíždějí kratší
// cestou (text tu stojí v bloku, ne na volné ploše).
const SMOKE: SmokeConfig = {
  smokeColor: "#bec948",
  drift: "down",
  rise: 0.2,
  turbulence: 1,
  softness: 1,
  density: 1.5,
  quality: 1,
  letter: 0.3,
  edge: 1.18,
};
// Tempo proudění šmouh (jako `speed` nápovědy).
const FLOW = 1.15;

// Grafémy, ne UTF-16 jednotky — „í" s kombinační čárkou je jedno písmeno.
const segment = (value: string) =>
  typeof Intl === "undefined" || typeof Intl.Segmenter === "undefined"
    ? Array.from(value)
    : Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(value), (part) => part.segment);

type SmokeTextProps = {
  text: string;
  progress: MotionValue<number>;
  still?: boolean;
  as?: "p" | "span" | "div" | "h2" | "h3";
  className?: string;
} & Record<string, unknown>;

export default function SmokeText({ text, progress, still = false, as = "p", className, ...rest }: SmokeTextProps) {
  // Jeden typ značky pro TS — všechny povolené jsou blokové HTML prvky.
  const Tag = as as "p";
  const { heavy } = usePerformance();
  const rootRef = useRef<HTMLElement>(null);
  const faceRef = useRef<HTMLSpanElement>(null);
  const smokeRef = useRef<Smoke | null>(null);
  const face = useMotionValue(still || progress.get() >= 1 ? 1 : 0);

  // Slova jako nezalomitelné celky, uvnitř písmena — řádky se lámou jen
  // v mezerách, jako u obyčejného textu.
  const words = useMemo(() => text.split(/(\s+)/).filter(Boolean).map((part) => (/^\s+$/.test(part) ? null : segment(part))), [text]);

  const paint = () => {
    const p = Math.min(1, Math.max(0, progress.get()));
    const smoke = smokeRef.current;
    if (p >= 1) {
      // Hotovo: text drží DOM, plátno pryč.
      face.jump(1);
      if (smoke) {
        smoke.destroy();
        smokeRef.current = null;
      }
      return;
    }
    if (!smoke) {
      face.set(p);
      return;
    }
    face.jump(0);
    smoke.draw(
      p <= 0
        ? { phase: "none", clock: 0, from: "top", time: 0, letterLayer: 1 }
        : { phase: "condense", clock: p, from: "top", time: (frameData.timestamp / 1000) * FLOW, letterLayer: 1 },
    );
  };
  useMotionValueEvent(progress, "change", paint);

  // Kouř se staví hned při připojení (modál se otevřel), ať je hotový,
  // než sražení začne. Modul je líný — three.js se stáhne až tady.
  useEffect(() => {
    if (still || !heavy) return;
    const root = rootRef.current;
    const faceEl = faceRef.current;
    if (!root || !faceEl) return;
    let cancelled = false;
    import("@/components/common/scroll-placeholder/smoke").then(({ createSmoke }) => {
      if (cancelled || progress.get() >= 1) return;
      smokeRef.current = createSmoke(root, faceEl, SMOKE);
      paint();
    });
    return () => {
      cancelled = true;
      smokeRef.current?.destroy();
      smokeRef.current = null;
    };
    // `paint` čte jen refy a motion values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [still, heavy, progress]);

  // Jiný text = jiná písmena na plátně.
  useEffect(() => {
    smokeRef.current?.measure();
  }, [words]);

  if (still) {
    return (
      <Tag className={className} {...rest}>
        {text}
      </Tag>
    );
  }

  return (
    <Tag ref={rootRef as RefObject<HTMLParagraphElement>} className={[styles.root, className].filter(Boolean).join(" ")} {...rest}>
      <motion.span ref={faceRef} className={styles.face} style={{ opacity: face }}>
        {words.map((glyphs, i) =>
          glyphs ? (
            <span key={i} className={styles.word}>
              {glyphs.map((glyph, j) => (
                <span key={j} data-glyph="">
                  {glyph}
                </span>
              ))}
            </span>
          ) : (
            " "
          ),
        )}
      </motion.span>
    </Tag>
  );
}
