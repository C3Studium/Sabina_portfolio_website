// Vlastní kurzor — tečka, která jede za myší s vlastní setrvačností, a nad
// zaregistrovanými prvky se rozloží do čtyř teček v jejich rozích.
//
// Tečky jsou ve skutečnosti vždycky čtyři. Mimo cíl míří všechny na myš a jedou
// po stejných pružinách, takže leží přesně přes sebe a vypadají jako jedna.
// Nad prvkem z RefContextu dostane každá za cíl jiný roh jeho obdélníku —
// rozjedou se od sebe a obejmou ho. Žádné přepínání vzhledu, jen jiné cíle.
//
// Pozice myši i cíle jsou motion values, tečky jedou po pružinách
// (`springValue`) a framer je píše do transformu bez překreslení. React stav
// je jen „vidět / nevidět" a „rozloženo / jedna tečka".
//
// Jen pro myš: zapíná se podle `(hover: hover) and (pointer: fine)`. Na dotyku
// se nic neregistruje a tečky zůstávají skryté i stylem.
//
// Další stavy podle oblasti pod myší (`data-cursor`):
//   "user" — Info a Proces, kde staví umělá myš „Sabina": návštěvník je
//            taky „uživatel v editoru" — za běžným (systémovým) kurzorem
//            jede jmenovka „Vy"; tvar kurzoru se nemění
//   "drag" — 3D scéna v heru: čtyři tečky se rozestoupí do čtverečku kolem
//            myši a vedle velká jmenovka „Táhnout" (jak scénu ovládat)
// Jinde zůstává tečka.

import { useEffect, useRef, useState } from "react";
import {
  motion,
  motionValue,
  springValue,
  useAnimationFrame,
  useReducedMotion,
  type MotionValue,
} from "framer-motion";
import { useRefRegistry, type RefTarget, type SnapRect } from "@/providers/RefContext";
import DesignCursor from "@/components/common/design-cursor";
import styles from "./styles.module.scss";

// Tíha teček.
//   mass      — setrvačnost: vyšší = pomalejší rozjezd i dojezd, „těžší" tečka
//   stiffness — jak silně ji cíl táhne: vyšší = dřív u cíle
//   damping   — tlumení: nad 2·√(stiffness·mass) ≈ 29 už nepřekmitne
const SPRING = { mass: 0.9, stiffness: 240, damping: 32 };

// Strop pro vstup: myš smí pružinám zadat nový cíl nejvýš 120× za sekundu.
//
// Herní myši hlásí pohyb i 1000× za sekundu a každé `mousemove` by jinak
// znamenalo `set()` na motion values a přeplánování pružin. Tečky samotné se
// kreslí ve smyčce frameru, tedy podle obnovovací frekvence displeje — tohle
// omezuje, jak často se mění CÍL, ne kolik snímků se kreslí.
const MAX_FPS = 120;
const MIN_INTERVAL = 1000 / MAX_FPS; // ≈ 8,33 ms mezi dvěma přijatými pohyby

// Rohy obdélníku jako zlomky jeho šířky a výšky, po směru hodin.
const CORNERS = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
] as const;

// Okraj kolem boxu prvku, který nemá vlastní `rect()`.
const ELEMENT_PAD = 8;

// Rozložené tečky jsou menší — jedna se „rozpadne" na čtyři.
const SPLIT_SCALE = 0.6;

// Oblasti s jiným kurzorem a jejich jmenovky.
const REGION = "[data-cursor]";
const USER_NAME = "Vy";
const DRAG_LABEL = "Táhnout";
// O kolik se tečky nad scénou rozestoupí od myši (px, do každého rohu).
const DRAG_SPREAD = 11;

type Dot = {
  x: MotionValue<number>;
  y: MotionValue<number>;
  springX: MotionValue<number>;
  springY: MotionValue<number>;
};

const createDot = (): Dot => {
  const x = motionValue(0);
  const y = motionValue(0);
  return { x, y, springX: springValue(x, SPRING), springY: springValue(y, SPRING) };
};

const elementRect = (target: RefTarget): SnapRect => {
  const r = target.element.getBoundingClientRect();
  const pad = target.pad ?? ELEMENT_PAD;
  const x = typeof pad === "number" ? pad : pad.x;
  const y = typeof pad === "number" ? pad : pad.y;
  return {
    left: r.left - x,
    top: r.top - y,
    right: r.right + x,
    bottom: r.bottom + y,
  };
};

export default function Cursor() {
  const registry = useRefRegistry();
  // Čtyři tečky, vytvořené jednou. `springValue` není hook, takže je jde
  // vyrobit v poli — hooky v cyklu by pravidla Reactu nedovolila.
  const [dots] = useState(() => CORNERS.map(createDot));
  const [visible, setVisible] = useState(false);
  const [split, setSplit] = useState(false);
  const [mode, setMode] = useState<"user" | "drag" | null>(null);
  const modeRef = useRef<"user" | "drag" | null>(null);
  const user = mode === "user";
  const drag = mode === "drag";
  // Poloha myši pro jmenovku — ta za systémovým kurzorem jede na pružině
  // uvnitř DesignCursor (vlastní šipka se nekreslí).
  const [arrow] = useState(() => ({ x: motionValue(-100), y: motionValue(-100) }));
  const reduced = useReducedMotion();

  // Myš se už aspoň jednou pohnula — do té doby tečka nemá kde stát.
  const started = useRef(false);
  // Poslední známá pozice myši a cíl, nad kterým stojí.
  const pointer = useRef({ x: 0, y: 0 });
  const hovered = useRef<RefTarget | null>(null);
  const splitRef = useRef(false);

  // Zadá tečkám cíle: rohy obdélníku cíle, nebo všem čtyřem myš.
  const aim = () => {
    const target = hovered.current;
    // Nad scénou („drag") tečky drží u myši, i když je scéna sama cílem.
    const rect = target && modeRef.current !== "drag" ? (target.rect ? target.rect() : elementRect(target)) : null;

    dots.forEach((dot, i) => {
      if (rect) {
        const [fx, fy] = CORNERS[i];
        dot.x.set(rect.left + (rect.right - rect.left) * fx);
        dot.y.set(rect.top + (rect.bottom - rect.top) * fy);
      } else {
        // Nad scénou („drag") se tečky rozestoupí do čtverečku kolem myši.
        const spread = modeRef.current === "drag" ? DRAG_SPREAD : 0;
        const [fx, fy] = CORNERS[i];
        dot.x.set(pointer.current.x + (fx * 2 - 1) * spread);
        dot.y.set(pointer.current.y + (fy * 2 - 1) * spread);
      }
    });

    const next = Boolean(rect) || modeRef.current === "drag";
    if (next !== splitRef.current) {
      splitRef.current = next;
      setSplit(next);
    }
  };

  useEffect(() => {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    // ---------- Limiter ----------
    // Dva kusy stavu: čas posledního přijatého pohybu a případný odložený
    // zápis na konec okna. Poslední pozice myši je v `pointer`.
    let lastApplied = 0;
    let trailing = 0;

    // Jediné místo, které z myši zadává cíl. Bere vždy poslední pozici, ne
    // souřadnice z události, která ho vyvolala — ty už mohou být zastaralé.
    const apply = () => {
      trailing = 0;
      lastApplied = performance.now();
      aim();
    };

    // Jaká oblast je pod myší?
    const setRegion = (node: Element | null) => {
      const value = node?.closest?.(REGION)?.getAttribute("data-cursor");
      const next = value === "user" || value === "drag" ? value : null;
      if (next !== modeRef.current) {
        modeRef.current = next;
        setMode(next);
      }
    };

    const onMove = (event: MouseEvent) => {
      const { clientX, clientY } = event;
      pointer.current = { x: clientX, y: clientY };
      arrow.x.set(clientX);
      arrow.y.set(clientY);
      hovered.current = registry.hit(event.target as Node | null);
      setRegion(event.target as Element | null);

      if (!started.current) {
        started.current = true;
        // První pozice se nastaví skokem i na pružinách — `jump` zdroje
        // pružinu jen rozjede, takže by tečky připluly z rohu okna.
        dots.forEach((dot) => {
          dot.x.jump(clientX);
          dot.y.jump(clientY);
          dot.springX.jump(clientX);
          dot.springY.jump(clientY);
        });
        lastApplied = performance.now();
        setVisible(true);
        aim();
        return;
      }

      // Uplynulo celé okno? Zapsat hned („leading" hrana).
      const elapsed = performance.now() - lastApplied;
      if (elapsed >= MIN_INTERVAL) {
        apply();
        return;
      }

      // Jinak jsme uvnitř okna: událost se zahodí, ale `pointer` si ji pamatuje
      // a jeden odložený zápis na konci okna („trailing" hrana) ji doručí.
      // Bez něj by poslední pohyb před zastavením myši nikdy nedorazil a
      // tečka by stála kousek vedle. Plánuje se jen jednou na okno.
      if (!trailing) {
        trailing = window.setTimeout(apply, MIN_INTERVAL - elapsed);
      }
    };

    // Při scrollu se pod stojící myší vymění prvek, ale `mousemove` nepřijde.
    // Totéž, když stránka přepne oblast sama (hero po smazání scény) — to se
    // vykreslí až po scrollu, takže to hlídá i MutationObserver níž.
    const onScroll = () => {
      if (!started.current) return;
      const { x, y } = pointer.current;
      const under = document.elementFromPoint(x, y);
      hovered.current = registry.hit(under);
      setRegion(under);
      aim();
    };

    // `mouseout` bez `relatedTarget` je odchod z dokumentu, ne přechod mezi prvky.
    const onOut = (event: MouseEvent) => {
      if (!event.relatedTarget) setVisible(false);
    };
    const onOver = () => {
      if (started.current) setVisible(true);
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    const regions = new MutationObserver(onScroll);
    regions.observe(document.body, { subtree: true, attributes: true, attributeFilter: ["data-cursor"] });
    document.addEventListener("mouseout", onOut);
    document.addEventListener("mouseover", onOver);
    return () => {
      // Odložený zápis by po odmountování sahal na mrtvé motion values.
      if (trailing) window.clearTimeout(trailing);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("scroll", onScroll);
      regions.disconnect();
      document.removeEventListener("mouseout", onOut);
      document.removeEventListener("mouseover", onOver);
    };
    // `aim` čte jen refy a stabilní motion values, mezi rendery se nemění.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dots, registry, arrow]);

  // Nad cílem se jeho obdélník může hýbat i bez pohybu myši (písmeno po
  // šťouchnutí poskakuje, MeasureText přepne písmeno) — rohy se proto
  // přepočítávají každý snímek. Mimo cíl smyčka nic nedělá.
  useAnimationFrame(() => {
    if (hovered.current) aim();
  });

  // Pružiny jsou mimo React — při odmountování se musí odpojit ručně.
  useEffect(
    () => () =>
      dots.forEach((dot) => {
        dot.springX.destroy();
        dot.springY.destroy();
      }),
    [dots],
  );

  return (
    <>
      {dots.map((dot, i) => (
        <motion.div
          key={i}
          className={styles.dot}
          // Při omezeném pohybu jedou tečky přímo na cíl, bez pružin.
          // translate -50 % posadí na cíl střed tečky, ať je jakkoli velká.
          style={{
            x: reduced ? dot.x : dot.springX,
            y: reduced ? dot.y : dot.springY,
            translateX: "-50%",
            translateY: "-50%",
          }}
          initial={{ opacity: 0, scale: 1 }}
          animate={{ opacity: visible && !user ? 1 : 0, scale: split ? SPLIT_SCALE : 1 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          aria-hidden="true"
        />
      ))}
      {/* Jedna jmenovka pro oba stavy: nad scénou velké zelené „Táhnout"
          (tečky kolem myši), v oblasti uživatele malé bílé „Vy" za běžným
          kurzorem. Mezi nimi se text přelije, zmenší a přebarví. Vlastní
          šipka se nekreslí — systémový kurzor zůstává. */}
      <DesignCursor
        x={arrow.x}
        y={arrow.y}
        opacity={visible && (user || drag) ? 1 : 0}
        morph={{ words: [DRAG_LABEL, USER_NAME], index: drag ? 0 : 1 }}
        arrow={false}
        size={drag ? "large" : "normal"}
        tone={drag ? "accent" : "light"}
        zIndex={10000}
      />
    </>
  );
}
