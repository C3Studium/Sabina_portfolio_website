// SketchReveal — vstup a odchod obrázku jako stavba v grafickém editoru:
// zelené linky (obrys + výrazné hrany) → klidné prolnutí barev. Odchod je
// totéž pozpátku. Zjednodušená verze stavby bannerů z úvodu — jedna
// vrstva, všechno se počítá v shaderu (engine.ts), bez přípravy offline.
//
//     <SketchReveal show={visible} delay={1} className={styles.layer}>
//       <Image … />            ← první <img> uvnitř je předloha
//       <Particles … />        ← cokoli dalšího naskočí s obrázkem
//     </SketchReveal>
//
// Plátno kreslí jen PŘECHODY. Hotový obrázek je skutečný obsah (`children`):
// na konci vstupu se prolne přes stejný obraz na plátně a plátno se schová;
// při odchodu se obsah schová v tomtéž snímku, kdy plátno převezme hotový
// stav, a stavba běží pozpátku. Plátno leží `position: absolute; inset: 0`
// v nejbližším pozicovaném rodiči — ten musí mít rozměr obrázku.
//
// Bez WebGL, s omezeným pohybem nebo `enabled={false}` se obsah jen ukáže.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { animate, useMotionValue, useMotionValueEvent } from "framer-motion";
import { createSketch, fillAt, type Sketch, type SketchSettings } from "./engine";
import styles from "./styles.module.scss";

/* ---------- Nastavení ---------- */

const settings: SketchSettings = {
  accent: "#bec948",
  // Části průběhu: skica do 30 %, výplň od 15 % do konce — linky jsou vidět
  // jen krátce, barvy je hned přebírají.
  sketch: [0, 0.3],
  fill: [0.15, 1],
  soft: 0.18,
  dither: 0.03,
  // Jen výrazné hrany uvnitř (oči, rty, límec, ruce), plný obrys siluety.
  edge: [0.32, 0.62],
  silhouette: [0.15, 0.45],
  // Ztlumené — v úvodu je hlavní nadpis, linky portrétu jsou podklad.
  lineAlpha: 0.45,
  // Skica od hlavy dolů, barvy od středu ven (střed o kus výš — postava
  // stojí v dolní části obrázku); dosah 0,8 = výplň dojde k okraji postavy,
  // ne do průhledných rohů.
  sketchFrom: "down",
  fillFrom: "center",
  center: [0.5, 0.45],
  reach: 0.8,
  maxDpr: 1.5,
};

// Délky (s) vstupu a odchodu a prolnutí skutečného obsahu přes plátno.
// Vstup pomalý, ale linky jen krátce (výplň začne skoro hned); odchod
// 1,6× rychleji než první verze (1,1 s).
const DURATION_IN = 1.6;
const DURATION_OUT = 1.1 / 1.6;
const HANDOFF = 0.4;

/* ---------- Komponenta ---------- */

type SketchRevealProps = {
  /** Má být obrázek vidět? Změna spustí vstup / odchod. */
  show: boolean;
  /** Zpoždění (s) PRVNÍHO vstupu. */
  delay?: number;
  /** `false` = bez stavby, obsah se jen ukáže / schová. */
  enabled?: boolean;
  /** Třída obalu obsahu (rozložení obrázku). */
  className?: string;
  /** Hlásí, kdy je hotový obsah vidět (konec vstupu / začátek odchodu). */
  onVisible?: (visible: boolean) => void;
  /** Při vstupu: výplň barvami je poprvé vidět (po skice) — pro navazující nástupy. */
  onFillStart?: () => void;
  children: ReactNode;
};

export default function SketchReveal({
  show,
  delay = 0,
  enabled = true,
  className,
  onVisible,
  onFillStart,
  children,
}: SketchRevealProps) {
  const layerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sketchRef = useRef<Sketch | null>(null);
  const firstRef = useRef(true);
  const progress = useMotionValue(0);
  // Engine běží (obrázek načtený, WebGL je).
  const [ready, setReady] = useState(false);
  // Stavba doběhla — skutečný obsah je vidět; `covered` = plátno už schované.
  const [built, setBuilt] = useState(false);
  const [covered, setCovered] = useState(false);

  // Engine nad prvním <img> uvnitř, až je dekódovaný.
  useEffect(() => {
    if (!enabled) return;
    const canvas = canvasRef.current;
    const image = layerRef.current?.querySelector("img");
    if (!canvas || !image) return;
    let cancelled = false;
    let sketch: Sketch | null = null;
    const observer = new ResizeObserver(() => sketch?.resize());
    image
      .decode()
      .catch(() => {})
      .then(() => {
        if (cancelled || !image.naturalWidth) return;
        sketch = createSketch(canvas, image, settings);
        sketchRef.current = sketch;
        if (!sketch) return;
        sketch.render(progress.get());
        observer.observe(canvas);
        setReady(true);
      });
    return () => {
      cancelled = true;
      observer.disconnect();
      sketch?.destroy();
      sketchRef.current = null;
    };
  }, [enabled, progress]);

  // Vstup a odchod: průběh 0 ↔ 1, vždy od toho, kde právě je.
  useEffect(() => {
    if (!enabled || !ready) return;
    const from = progress.get();
    const first = show && firstRef.current;
    if (show) firstRef.current = false;
    let timer = 0;
    const controls = animate(progress, show ? 1 : 0, {
      duration: show ? DURATION_IN * (1 - from) : DURATION_OUT * from,
      delay: first ? delay : 0,
      ease: "linear",
      onComplete: () => {
        if (!show) return;
        setBuilt(true);
        timer = window.setTimeout(() => setCovered(true), HANDOFF * 1000);
      },
    });
    return () => {
      controls.stop();
      window.clearTimeout(timer);
    };
  }, [show, enabled, ready, delay, progress]);

  // Každý snímek průběhu kreslí plátno. Jakmile průběh opustí 1 (odchod),
  // obsah se schová a plátno převezme — v jednom snímku.
  const lastRef = useRef(0);
  useMotionValueEvent(progress, "change", (value) => {
    sketchRef.current?.render(value);
    // Výplň je poprvé vidět (průběh roste přes práh). Začátek úseku výplně
    // nestačí — po křivce je tam výplň ještě nulová.
    const seen = 0.05;
    if (fillAt(lastRef.current, settings) < seen && fillAt(value, settings) >= seen) onFillStart?.();
    lastRef.current = value;
    if (value < 1) {
      setBuilt(false);
      setCovered(false);
    }
  });

  const staged = enabled && ready;
  const visible = staged ? show && built : show;

  useEffect(() => {
    onVisible?.(visible);
    // Bez stavby (fallback) žádná výplň není — začátek „výplně" je ukázání.
    if (visible && !staged) onFillStart?.();
  }, [visible, staged, onVisible, onFillStart]);

  return (
    <>
      <div ref={layerRef} className={[styles.layer, className].filter(Boolean).join(" ")} data-hidden={visible ? undefined : ""}>
        {children}
      </div>
      {enabled && (
        <canvas
          ref={canvasRef}
          className={styles.canvas}
          // Schované jen pod hotovým obsahem. Se `show=false` se ukáže v tomtéž
          // renderu, kdy se obsah schová — drží poslední (hotový) snímek.
          data-covered={staged && !(covered && show) ? undefined : ""}
          aria-hidden="true"
        />
      )}
    </>
  );
}
