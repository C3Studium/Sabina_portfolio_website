// MeasureText — obal nadpisu, jehož označená slova se dají „měřit": písmeno
// pod kurzorem se přepne na tečkovaný obrys a obejme ho rámeček s rozměry,
// písmena jdou chytit a odtáhnout a kliknutí jimi pošle vlnu po slově. Bez myši
// se po písmenech rozhlíží jeden pohled jako oko čtenáře a mezi slovy přejíždí.
// Inspirované TechText, vzhled je vlastní (viz engine.ts).
//
// Použití: obal kolem nadpisu, měřitelná slova v něm označit `data-measure`:
//
//     <MeasureText>
//       <h1>Grafika pro <span data-measure>lepší</span> …</h1>
//     </MeasureText>
//
// Jedno plátno přes celý nadpis — proto obal, a ne komponenta na slovo.
// Skutečný text zůstává v DOMu a určuje rozvržení, jen označená slova jsou
// průhledná; plátno kreslí jejich písmena přesně na jejich místa. Nadpis tak
// zůstává nadpisem pro vyhledávače, čtečky i Studio.
//
// Kurzor: obal se zapíše do RefContextu a hlásí box písmene pod myší.
// Kurzor se do jeho rohů rozpadne ze své jedné tečky na čtyři.
//
// Jen pro myš a bez omezeného pohybu. Jinak (a s `enabled={false}`, např.
// v editačním rámu Studia) zůstane obyčejný nadpis.

import { useEffect, useId, useRef, useSyncExternalStore, type ReactNode } from "react";
import { useAnimationFrame, useInView } from "framer-motion";
import { usePerformance } from "@/providers/PerformanceProvider";
import { useRefRegistry } from "@/providers/RefContext";
import { createMeasure, type MeasureSettings } from "./engine";
import styles from "./styles.module.scss";

/* ---------- Nastavení ---------- */

// Nadpis hera: velké písmo, rámeček kolem písmene pod myší, samostatný pohled.
const headline: MeasureSettings = {
  /* Obrys písmene pod kurzorem */
  lineStyle: "dotted",
  dashLength: 4,
  dashGap: 2,
  strokeWidth: 1.5,

  /* Výběr */
  selection: true,
  labels: true,
  // Drobky kolem rámečku.
  specks: 15,
  // Vodítka účaří / střední výšky / verzálek přes slovo s výběrem.
  guides: false,
  // Barva rámečku, popisků a vodítek; písmena mají barvu svého slova.
  markColor: "rgba(255, 255, 255, 0.9)",

  /* Pohyb */
  draggable: true,
  // Kliknutí na písmeno pošle vlnu po slově. Vypnuté.
  clickKick: false,
  // Síla šťouchnutí jako násobek velikosti písma (px/s).
  kick: 11,
  // 0 = písmena se vrací bez zhoupnutí, 1 = hodně pružně.
  bounce: 0.4,

  /* Samostatný pohled */
  // Bez myši nad písmeny se po nich rozhlíží jeden pohled — jako oko
  // čtenáře: většinou o písmeno dál, občas zpět nebo do druhého slova,
  // občas se na chvíli podívá jinam. Mezi slovy rámeček přejíždí.
  sweep: true,
  sweepPace: {
    // Jak dlouho se zdrží na písmenu (s, od–do).
    dwell: [1.6, 3.4],
    // Jak dlouho se dívá jinam, když se podívá (s, od–do).
    gap: [2.4, 4.5],
    // Pravděpodobnost, že zůstane ve stejném slově.
    stay: 0.7,
    // Pravděpodobnost, že se po písmenu na chvíli podívá jinam.
    glance: 0.12,
    // Prodleva po načtení, než se poprvé rozhlédne (s).
    start: 2,
    // Jak pomalu rámeček doklouže k sousednímu písmenu (s).
    glide: 0.32,
    // Jak pomalu rámeček přejede do druhého slova (s).
    travel: 0.55,
    // Jak pomalu se písmeno přepne na obrys a zpět (s).
    fade: 0.3,
  },
  // Rychlost teček obíhajících rámeček.
  speed: 0.5,

  /* Plátno */
  // Přesah plátna kolem nadpisu v em — místo pro popisky a drobky.
  bleed: 0.35,

  /* Rámeček */
  // Rámeček (a kurzor) obejme písmeno pod myší, 6 px kolem jeho inkoustu.
  frame: "glyph",
  framePad: 6,
  // Zásah písmene do 28 px od jeho inkoustu.
  hit: 28,
  // Drobky, popisky a rohové tečky v plné velikosti.
  markScale: 1,
  // Pod obrysem nezůstane nic z plného písma.
  outlineFill: 0,
  // Písmeno pod myší se mění na tečkovaný obrys; slovo se nepřebarvuje.
  letterOutline: true,
};

// Odkazy menu: rámeček s rozměrem a drobky jako u nadpisu, jen zmenšené.
// Rámeček obejme celý odkaz (jeho box i s odsazením, `data-measure-frame`)
// — přesně tam, kam se rozpadne kurzor — a celý název zezelená. Bez
// obrysu písmen, samostatného pohledu, tažení i šťouchnutí (odkazy se klikají).
const nav: MeasureSettings = {
  ...headline,
  // Písmena zůstávají plná — celý název odkazu naráz z bílé zezelená.
  letterOutline: false,
  ink: "#ffffff",
  hoverTint: "#bec948",
  specks: 9,
  markScale: 0.6,
  draggable: false,
  clickKick: false,
  sweep: false,
  frame: "word",
  framePad: 0,
  hit: 0,
  // Písmo menu je malé — přesah plátna v em musí být větší, ať se popisek
  // nad odkazem a drobky kolem vejdou.
  bleed: 2.6,
};

// Tlačítko v hlavičce: stejný rámeček s rozměrem a drobky jako u odkazů,
// kolem celého tlačítka (5 px, jako rohy kurzoru). Text tlačítka se nekreslí
// — tlačítko má `data-measure-frame` bez měřeného textu, popisek zůstává
// v DOMu a hover (zvětšení) mu dělá CSS.
const cta: MeasureSettings = {
  ...nav,
  hoverTint: undefined,
  framePad: 5,
  // Tlačítko je u horního okraje okna — popisek nad ním by uřízl okraj.
  labelSide: "bottom",
};

// Logo: totéž kolem celého loga (10 px, jako rohy kurzoru). Zezelenání
// jména dělá CSS, text zůstává v DOMu.
const brand: MeasureSettings = {
  ...cta,
  framePad: 10,
};

// Odkazy v patičce: jako menu, jen písmo má barvu svého odkazu (ne bílou).
const link: MeasureSettings = {
  ...nav,
  ink: undefined,
};

const PRESETS = { headline, nav, link, cta, brand } satisfies Record<string, MeasureSettings>;

export type MeasureVariant = keyof typeof PRESETS;

/* ---------- Prostředí ---------- */

const FINE = "(hover: hover) and (pointer: fine)";
const subscribeFine = (notify: () => void) => {
  const media = window.matchMedia(FINE);
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
};
const readFine = () => window.matchMedia(FINE).matches;
const readFineOnServer = () => false;

/* ---------- Komponenta ---------- */

type MeasureTextProps = {
  children: ReactNode;
  /** `false` = jen obyčejný obsah, bez plátna (např. v editačním rámu Studia). */
  enabled?: boolean;
  /**
   * Samostatný pohled se „podíval jinam" — chvíli není vybrané nic. Vhodná
   * chvíle např. pro výměnu slov přes TextMorph (common/text-morph).
   */
  onGlance?: () => void;
  /** Sada nastavení: "headline" (nadpis hera), "nav" (odkazy menu), "cta" (tlačítko), "brand" (logo), "link" (odkazy patičky). */
  variant?: MeasureVariant;
  /** Smí běžet samostatný pohled? Např. `false` během preloaderu, `true` po něm. */
  sweep?: boolean;
  className?: string;
};

export default function MeasureText({
  children,
  enabled = true,
  onGlance,
  variant = "headline",
  sweep = true,
  className,
}: MeasureTextProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<ReturnType<typeof createMeasure>>(null);
  // Poslední `onGlance` v refu — engine se kvůli nové funkci nesmí stavět znovu.
  const glanceRef = useRef(onGlance);
  useEffect(() => {
    glanceRef.current = onGlance;
  }, [onGlance]);
  const sweepRef = useRef(sweep);
  useEffect(() => {
    sweepRef.current = sweep;
    engineRef.current?.setSweep(sweep);
  }, [sweep]);

  const key = `measure-text:${useId()}`;
  const registry = useRefRegistry();
  const { reducedMotion } = usePerformance();
  const fine = useSyncExternalStore(subscribeFine, readFine, readFineOnServer);
  const live = enabled && fine && !reducedMotion;
  const inView = useInView(rootRef, { margin: "80px" });

  useEffect(() => {
    if (!live) return;
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;

    const engine = createMeasure(root, canvas, PRESETS[variant], {
      onGlance: () => glanceRef.current?.(),
    });
    if (!engine) return;
    engineRef.current = engine;
    engine.setSweep(sweepRef.current);
    registry.register(key, root, { rect: engine.focusRect });
    return () => {
      registry.register(key, null);
      engine.destroy();
      engineRef.current = null;
    };
  }, [live, key, registry, variant]);

  // Smyčka frameru; mimo záběr se nekreslí nic.
  useAnimationFrame((_, delta) => {
    if (inView) engineRef.current?.tick(delta / 1000);
  });

  return (
    <div ref={rootRef} className={[styles.root, className].filter(Boolean).join(" ")}>
      {children}
      {live ? <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" /> : null}
    </div>
  );
}
