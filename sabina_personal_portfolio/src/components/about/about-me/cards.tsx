// Karty stránky /about — stavba, pohyb na hover a živé kresby v pozadí.
// Vzhled je ve styles.module.scss (sekce „Karty").
//
//  - BuildCard: karta se „postaví" jako bloky na homepage (BuildFrame
//    z Info): ořezové značky sjedou k rohům, čárkovaný obvod se obtáhne,
//    štítek s rozměrem, plocha se odhalí shora a obsah vyjede. Až pak se
//    dokreslí kresba v pozadí. Nadpis se při tom vyskicuje (obrys → výplň,
//    SketchText z Info) a popisek se napíše (TypeText). Na hover se karta
//    jemně natočí za myší (pružina) a kresba se pod kurzorem rozsvítí
//    zeleně („baterka"). Kresby v klidu běží 2,5× pomaleji; najetím se
//    krátce rozjedou rychleji a usadí na plné rychlosti, odjetím se ještě
//    pohnou a zpomalí zpátky (playbackRate CSS animací — bez skoku).
//  - ShuffleTags: štítky jsou vidět pořád — při stavbě stojí zamíchané
//    a přeskládají se na svá místa (framer `layout`), pak se samy
//    zamíchají jednou za 3–5 s (ne pod myší). S myší je kurzor odtlačuje
//    (každý štítek na pružině), na dotyku zůstává jen míchání.
//  - Na hover dál: zelený nadtitulek se „dekóduje" z náhodných znaků,
//    ikona v kroužku se přitáhne ke kurzoru a překreslí, kresba v pozadí
//    se natočí v perspektivě a magneticky posune za kurzorem.
//  - ArtIcon: kresby přes celou kartu — glóbus se točí, disky se vznášejí,
//    rozeta se otáčí, spirála se vine dál (neustálé vzdělávání), terč
//    vysílá vlny (co umím nejlíp).

import { createContext, useContext, useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import {
  animate,
  motion,
  useInView,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { BuildFrame, BuildGrid, SketchText, useBlockBuild } from "@/components/home/info/reveal";
import TypeText from "@/components/common/type-text";
import { useMedia } from "@/lib/fluid";
import { mapRange } from "@/lib/math";
import styles from "./styles.module.scss";

/* ------------------------------------------------------------- stavba ---- */

// Délka stavby jedné karty (s) a rozestup mezi kartami v řadě.
const BUILD_TIME = 1.15;
const BUILD_STAGGER = 0.08;
// Kdy (podíl stavby) vyjede obsah, kdy se začne kreslit kresba, okno
// skici nadpisu a kdy se začne psát popisek.
const CONTENT_AT: [number, number] = [0.45, 0.72];
const ART_AT = 0.62;
const TITLE_AT: [number, number] = [0.45, 1];
const TYPE_AT = 0.7;
// Rychlost kreseb (× rychlosti v CSS): v klidu, aktivní, náraz při najetí
// a při odjetí; časy [s, rychlost] od začátku přechodu.
const ART_IDLE = 0.4;
const ART_ACTIVE = 1;
const ART_IN: [number, number][] = [
  [0.22, 2.6],
  [1.1, ART_ACTIVE],
];
const ART_OUT: [number, number][] = [
  [0.2, 1.7],
  [1.5, ART_IDLE],
];
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

// Stavba karty a ukazatel pro obsah uvnitř (nadpis, popisek, ikona).
type CardBuildState = {
  progress: MotionValue<number>;
  live: boolean;
  typed: boolean;
  /** Kurzor nad kartou (souřadnice okna), mimo kartu null. */
  pointer: MotionValue<[number, number] | null>;
  /** Roste s každým najetím — spouští mikroanimace na hover. */
  hoverKey: number;
};
const CardBuildContext = createContext<CardBuildState | null>(null);

/** Nadpis karty: při stavbě se vyskicuje (obrys, pak výplň). */
export function CardSketch({ children }: { children: ReactNode }) {
  const build = useContext(CardBuildContext);
  if (!build?.live) return <>{children}</>;
  return (
    <SketchText progress={build.progress} from={TITLE_AT[0]} to={TITLE_AT[1]}>
      {children}
    </SketchText>
  );
}

/** Popisek karty: při stavbě se napíše (zástupný text se označí a přepíše). */
export function CardType({ text }: { text: string }) {
  const build = useContext(CardBuildContext);
  if (!build?.live) return <>{text}</>;
  return <TypeText segments={[{ text }]} placeholder="Text" play={build.typed} typeSpeed={12} />;
}

// Dekódování nadtitulku: znaky se postupně „zachytí" zleva, zbytek mezitím
// probliká náhodnými znaky.
const SCRAMBLE_GLYPHS = "ABCDEFGHIJKLMNOPRSTUVZ#%&*+/<>=";
const SCRAMBLE_TIME = 520;

/** Zelený nadtitulek: na hover se dekóduje z náhodných znaků. */
export function CardScramble({ text }: { text: string }) {
  const build = useContext(CardBuildContext);
  const ref = useRef<HTMLSpanElement>(null);
  const hoverKey = build?.hoverKey ?? 0;
  useEffect(() => {
    const el = ref.current;
    if (!el || !hoverKey) return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / SCRAMBLE_TIME, 1);
      const fixed = Math.floor(t * text.length);
      el.textContent = Array.from(text)
        .map((ch, i) =>
          i < fixed || ch === " " ? ch : SCRAMBLE_GLYPHS[Math.floor(Math.random() * SCRAMBLE_GLYPHS.length)],
        )
        .join("");
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      el.textContent = text;
    };
  }, [hoverKey, text]);
  if (!build?.live) return <>{text}</>;
  return (
    <span ref={ref} aria-label={text}>
      {text}
    </span>
  );
}

// Ikona v kroužku: přitahuje ji kurzor (do MAGNET_RANGE px, nejvýš o
// MAGNET_PULL px), při najetí se překreslí.
const MAGNET_RANGE = 220;
const MAGNET_PULL = 9;
const MAGNET_SPRING = { stiffness: 200, damping: 15, mass: 0.6 };

export function CardBadge({ className, children }: { className: string; children: ReactNode }) {
  const build = useContext(CardBuildContext);
  const ref = useRef<HTMLSpanElement>(null);
  const x = useSpring(0, MAGNET_SPRING);
  const y = useSpring(0, MAGNET_SPRING);
  const scale = useSpring(1, MAGNET_SPRING);
  const dummy = useMotionValue<[number, number] | null>(null);
  useMotionValueEvent(build?.pointer ?? dummy, "change", (p) => {
    const el = ref.current;
    if (!el || !p) {
      x.set(0);
      y.set(0);
      scale.set(1);
      return;
    }
    const box = el.getBoundingClientRect();
    const cx = box.left + box.width / 2 - x.get();
    const cy = box.top + box.height / 2 - y.get();
    const dx = p[0] - cx;
    const dy = p[1] - cy;
    const dist = Math.hypot(dx, dy);
    const k = Math.max(0, 1 - dist / MAGNET_RANGE);
    const pull = Math.min(dist, MAGNET_PULL * 2) * k * 0.5;
    x.set(dist ? (dx / dist) * pull : 0);
    y.set(dist ? (dy / dist) * pull : 0);
    scale.set(1 + 0.1 * k);
  });
  if (!build?.live) {
    return (
      <span className={className} aria-hidden="true">
        {children}
      </span>
    );
  }
  return (
    <motion.span ref={ref} className={className} style={{ x, y, scale }} aria-hidden="true">
      {/* Nový klíč při každém najetí = ikona se překreslí (CSS). */}
      <span key={build.hoverKey} className={styles.cardBadgeIcon} data-redraw={build.hoverKey ? "" : undefined}>
        {children}
      </span>
    </motion.span>
  );
}
// Natočení za myší (°) a jeho pružina.
const TILT = 4;
const TILT_SPRING = { stiffness: 170, damping: 20, mass: 0.6 };
// Kresba v pozadí: natočení v perspektivě (°) a magnetický posun (px) za
// kurzorem; měkčí pružina s dojezdem (při najetí i odjetí se zhoupne).
const ART_TILT = 14;
const ART_SHIFT = 16;
const ART_SPRING = { stiffness: 90, damping: 11, mass: 0.9 };

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

type BuildCardProps = {
  /** Pořadí karty v řadě — rozestup stavby. */
  index: number;
  /** Štítek nad rámečkem stavby (jako vrstvy na homepage). */
  tag: string;
  /** Kresba v pozadí karty. */
  art: string;
  /** Ve Studiu / bez pohybu: karta stojí hotová, bez náklonu. */
  still: boolean;
  /** Smí se už stavět? (Stránka staví karty až po úvodu.) */
  ready?: boolean;
  /** Rozvržení obsahu (panel má mřížku). */
  contentClassName?: string;
  children: ReactNode;
};

export function BuildCard({ index, tag, art, still, ready = true, contentClassName, children }: BuildCardProps) {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.3 });
  const reduce = useReducedMotion();
  const live = !still && !reduce;

  const progress = useMotionValue(live ? 0 : 1);
  useEffect(() => {
    if (!live || !inView || !ready) return;
    const controls = animate(progress, 1, { duration: BUILD_TIME, ease: "linear", delay: index * BUILD_STAGGER });
    return () => controls.stop();
  }, [live, inView, ready, progress, index]);

  const { mask, grid } = useBlockBuild(progress, 0, 1);
  const contentIn = useTransform(progress, CONTENT_AT, [0, 1]);
  const contentY = useTransform(contentIn, (v) => `${((1 - easeOut(v)) * 1.4).toFixed(3)}vh`);

  // Kresba se dokreslí (CSS `data-built`), až je plocha skoro odhalená;
  // popisek se začne psát o kus později.
  const [built, setBuilt] = useState(!live);
  const [typed, setTyped] = useState(!live);
  useMotionValueEvent(progress, "change", (v) => {
    if (v >= ART_AT && !built) setBuilt(true);
    if (v >= TYPE_AT && !typed) setTyped(true);
  });

  // Rychlost kreseb: CSS animace v kartě dostanou playbackRate (změna
  // rychlosti tak drží rozběhnutou fázi, nic neposkočí).
  const faceRef = useRef<HTMLDivElement>(null);
  const rate = useRef(ART_IDLE);
  const rateTween = useRef(0);
  const artAnimations = () =>
    (faceRef.current?.getAnimations({ subtree: true }) ?? []).filter(
      (a) => typeof CSSAnimation !== "undefined" && a instanceof CSSAnimation,
    );
  const setRate = (value: number) => {
    rate.current = value;
    for (const a of artAnimations()) a.playbackRate = value;
  };
  const speedTo = (steps: [number, number][]) => {
    cancelAnimationFrame(rateTween.current);
    const points: [number, number][] = [[0, rate.current], ...steps];
    const start = performance.now();
    const tick = (now: number) => {
      const t = (now - start) / 1000;
      let i = 1;
      while (i < points.length && t > points[i][0]) i++;
      if (i >= points.length) {
        setRate(points[points.length - 1][1]);
        return;
      }
      const [t0, r0] = points[i - 1];
      const [t1, r1] = points[i];
      setRate(r0 + (r1 - r0) * easeInOut((t - t0) / Math.max(t1 - t0, 1e-3)));
      rateTween.current = requestAnimationFrame(tick);
    };
    rateTween.current = requestAnimationFrame(tick);
  };
  // V klidu pomalu — i animace, které vzniknou až se stavbou (vlny terče).
  useEffect(() => {
    if (!live) return;
    for (const a of artAnimations()) a.playbackRate = rate.current;
    return () => cancelAnimationFrame(rateTween.current);
  }, [live, built]);

  // Náklon za myší a pozice „baterky" (CSS --mx / --my na zelené vrstvě
  // kresby — v jejích souřadnicích, kresba je větší než karta a posunutá).
  const rotateX = useSpring(0, TILT_SPRING);
  const rotateY = useSpring(0, TILT_SPRING);
  const glowRef = useRef<HTMLSpanElement>(null);
  const pointer = useMotionValue<[number, number] | null>(null);
  const [hoverKey, setHoverKey] = useState(0);
  const artRotateX = useSpring(0, ART_SPRING);
  const artRotateY = useSpring(0, ART_SPRING);
  const artX = useSpring(0, ART_SPRING);
  const artY = useSpring(0, ART_SPRING);
  const onMove = (event: PointerEvent<HTMLElement>) => {
    if (!live || event.pointerType !== "mouse") return;
    const box = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - box.left) / box.width;
    const y = (event.clientY - box.top) / box.height;
    pointer.set([event.clientX, event.clientY]);
    artRotateY.set((x - 0.5) * ART_TILT);
    artRotateX.set((0.5 - y) * ART_TILT * 0.8);
    artX.set((x - 0.5) * ART_SHIFT);
    artY.set((y - 0.5) * ART_SHIFT * 0.7);
    const glow = glowRef.current;
    if (glow) {
      const g = glow.getBoundingClientRect();
      glow.style.setProperty("--mx", `${(((event.clientX - g.left) / g.width) * 100).toFixed(1)}%`);
      glow.style.setProperty("--my", `${(((event.clientY - g.top) / g.height) * 100).toFixed(1)}%`);
    }
    rotateY.set((x - 0.5) * TILT);
    rotateX.set((0.5 - y) * TILT * 0.8);
  };
  const onEnter = (event: PointerEvent<HTMLElement>) => {
    if (!live || event.pointerType !== "mouse") return;
    speedTo(ART_IN);
    setHoverKey((k) => k + 1);
  };
  const onLeave = (event: PointerEvent<HTMLElement>) => {
    rotateX.set(0);
    rotateY.set(0);
    pointer.set(null);
    artRotateX.set(0);
    artRotateY.set(0);
    artX.set(0);
    artY.set(0);
    if (live && event.pointerType === "mouse") speedTo(ART_OUT);
  };

  return (
    <article
      ref={ref}
      className={styles.card}
      data-measure-frame=""
      data-built={built || undefined}
      onPointerEnter={onEnter}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
    >
      {live ? <BuildFrame progress={progress} from={0} to={1} tag={tag} size marks /> : null}
      <motion.div
        ref={faceRef}
        className={styles.cardFace}
        style={live ? { rotateX, rotateY, maskImage: mask, WebkitMaskImage: mask } : undefined}
      >
        {/* Kresba v pozadí (tlumená + zelená pod „baterkou"), natáčená
            v perspektivě a posouvaná za kurzorem. */}
        <motion.div
          className={styles.cardArtRig}
          style={live ? { rotateX: artRotateX, rotateY: artRotateY, x: artX, y: artY } : undefined}
          aria-hidden="true"
        >
          <span className={styles.cardArt}>
            <ArtIcon name={art} />
          </span>
          <span ref={glowRef} className={styles.cardArtGlow}>
            <ArtIcon name={art} />
          </span>
        </motion.div>
        <motion.div
          className={`${styles.cardContent} ${contentClassName ?? ""}`}
          style={live ? { opacity: contentIn, y: contentY } : undefined}
        >
          <CardBuildContext.Provider value={{ progress, live, typed, pointer, hoverKey }}>
            {children}
          </CardBuildContext.Provider>
        </motion.div>
      </motion.div>
      {live ? <BuildGrid opacity={grid} /> : null}
    </article>
  );
}

/* ------------------------------------------------------------- štítky ---- */

const shuffled = (count: number) => {
  const order = Array.from({ length: count }, (_, i) => i);
  for (let i = count - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
};

function gcd(a: number, b: number): number {
  return b ? gcd(b, a % b) : a;
}

// Pevná „zamíchaná" permutace (stejná na serveru i v prohlížeči): krok
// nesoudělný s počtem, posunutý o 2.
const scrambled = (count: number) => {
  const step = [5, 7, 3, 11].find((s) => gcd(s, count) === 1 && s % count !== 1) ?? 1;
  return Array.from({ length: count }, (_, k) => (k * step + 2) % count);
};

const TAG_SPRING = { type: "spring", stiffness: 260, damping: 26, mass: 0.8 } as const;

// Odtlačování štítků kurzorem (jen myš): dosah, síla (px) a pružina.
const PUSH_RANGE = 130;
const PUSH_FORCE = 34;
const PUSH_SPRING = { stiffness: 210, damping: 16, mass: 0.6 };
// Samovolné zamíchání: prodleva (s) náhodně v tomhle rozsahu.
const SHUFFLE_EVERY: [number, number] = [3, 5];
const FINE = "(hover: hover) and (pointer: fine)";

/** Štítek: vlastní pružina, odtlačuje ho kurzor (pointer = souřadnice okna). */
function Pill({
  live,
  slot,
  pointer,
  children,
}: {
  live: boolean;
  slot: number;
  pointer: MotionValue<[number, number] | null>;
  children: ReactNode;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const x = useSpring(0, PUSH_SPRING);
  const y = useSpring(0, PUSH_SPRING);
  const rotate = useSpring(0, PUSH_SPRING);
  useMotionValueEvent(pointer, "change", (p) => {
    const el = ref.current;
    if (!el || !p) {
      x.set(0);
      y.set(0);
      rotate.set(0);
      return;
    }
    const box = el.getBoundingClientRect();
    const cx = box.left + box.width / 2 - x.get();
    const cy = box.top + box.height / 2 - y.get();
    const dx = cx - p[0];
    const dy = cy - p[1];
    const dist = Math.hypot(dx, dy) || 1;
    const k = Math.max(0, 1 - dist / PUSH_RANGE);
    const force = PUSH_FORCE * Math.pow(k, 1.5);
    x.set((dx / dist) * force);
    y.set((dy / dist) * force);
    rotate.set((dx / dist) * force * 0.25);
  });
  return (
    <motion.li layout={live} className={styles.tagSlot} transition={{ layout: { ...TAG_SPRING, delay: slot * 0.03 } }}>
      <motion.span ref={ref} className={styles.tag} style={live ? { x, y, rotate } : undefined}>
        {children}
      </motion.span>
    </motion.li>
  );
}

/**
 * Štítky panelu. Při stavbě stojí zamíchané a přeskládají se na místa;
 * pak se samy zamíchají jednou za 3–5 s (když nad nimi není myš). Myš je
 * odtlačuje, na dotyku zůstává jen míchání. Ve Studiu (`still`) bez pohybu
 * a v pořadí — anotace položek se váží na index.
 */
export function ShuffleTags({
  count,
  still,
  render,
}: {
  count: number;
  still: boolean;
  render: (index: number) => ReactNode;
}) {
  const ref = useRef<HTMLUListElement>(null);
  const inView = useInView(ref, { amount: 0.4 });
  const reduce = useReducedMotion();
  const fine = useMedia(FINE);
  const live = !still && !reduce;
  const sorted = Array.from({ length: count }, (_, i) => i);
  const [order, setOrder] = useState(() => (live ? scrambled(count) : sorted));
  const pointer = useMotionValue<[number, number] | null>(null);
  const hovering = useRef(false);

  // Při stavbě: zamíchané → na místa (až karta dostaví obsah).
  useEffect(() => {
    if (!live || !inView) return;
    const timer = window.setTimeout(() => setOrder(Array.from({ length: count }, (_, i) => i)), 1900);
    return () => window.clearTimeout(timer);
  }, [live, inView, count]);

  // Samovolné zamíchání jednou za chvíli (náhodně 3–5 s), jen když jsou
  // vidět a nejsou pod myší.
  useEffect(() => {
    if (!live || !inView) return;
    let timer = 0;
    const next = () => {
      timer = window.setTimeout(
        () => {
          if (!hovering.current) setOrder(shuffled(count));
          next();
        },
        mapRange(Math.random(), 0, 1, SHUFFLE_EVERY[0], SHUFFLE_EVERY[1]) * 1000 + 1500,
      );
    };
    next();
    return () => window.clearTimeout(timer);
  }, [live, inView, count]);

  return (
    <ul
      ref={ref}
      className={styles.tags}
      onPointerMove={(event) => {
        if (!live || !fine || event.pointerType !== "mouse") return;
        hovering.current = true;
        pointer.set([event.clientX, event.clientY]);
      }}
      onPointerLeave={() => {
        hovering.current = false;
        pointer.set(null);
      }}
    >
      {(live ? order : sorted).map((index, slot) => (
        <Pill key={index} live={live} slot={slot} pointer={pointer}>
          {render(index)}
        </Pill>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------- kresby ---- */

// Poledníky glóbu: stejná elipsa, každá s jiným posunem v otáčce.
const MERIDIANS = [0, 1, 2, 3];

// Archimédova spirála (střed 60 / 60) — „neustálé" vzdělávání.
const SPIRAL = (() => {
  const points: string[] = [];
  for (let i = 0; i <= 220; i++) {
    const t = (i / 220) * Math.PI * 6.2;
    const r = 3 + 2.15 * t;
    points.push(`${(60 + r * Math.cos(t)).toFixed(2)} ${(60 + r * Math.sin(t)).toFixed(2)}`);
  }
  return `M${points.join("L")}`;
})();

/** Živá linková kresba přes celou kartu. */
export function ArtIcon({ name }: { name: string }) {
  return (
    <svg viewBox="0 0 120 120" fill="none" stroke="currentColor" strokeWidth="0.8">
      {name === "globe" && (
        <g>
          <circle className={styles.artDraw} pathLength={1} cx="60" cy="60" r="44" />
          {MERIDIANS.map((k) => (
            <ellipse
              key={k}
              className={styles.artMeridian}
              style={{ animationDelay: `${-k * 2.5}s` }}
              cx="60"
              cy="60"
              rx="44"
              ry="44"
            />
          ))}
          <path className={styles.artDraw} pathLength={1} d="M16 60h88M24 38h72M24 82h72" />
        </g>
      )}
      {name === "discs" && (
        <g>
          {[0, 1, 2].map((k) => (
            <g key={k} className={styles.artDiscSlot} data-disc={k}>
              <g className={styles.artDisc} style={{ animationDelay: `${-k * 0.9}s` }}>
                <ellipse className={styles.artDraw} pathLength={1} cx="60" cy={30 + k * 22} rx="40" ry="12" />
                <path className={styles.artDraw} pathLength={1} d={`M20 ${30 + k * 22}v8c0 6.6 17.9 12 40 12s40-5.4 40-12v-8`} />
              </g>
            </g>
          ))}
        </g>
      )}
      {name === "rosette" && (
        <g>
          <circle className={styles.artRing} cx="60" cy="48" r="34" strokeDasharray="2 5" />
          <circle className={styles.artDraw} pathLength={1} cx="60" cy="48" r="28" />
          <circle className={styles.artDraw} pathLength={1} cx="60" cy="48" r="17" />
          <path
            className={`${styles.artDraw} ${styles.artRibbon}`}
            pathLength={1}
            d="M44 72 36 108l24-12 24 12-8-36"
            strokeLinejoin="round"
          />
        </g>
      )}
      {name === "spiral" && (
        <g className={styles.artSpiral}>
          <path className={styles.artDraw} pathLength={1} d={SPIRAL} />
          {/* Tečky, které po spirále pořád tečou ven. */}
          <path
            className={styles.artFlow}
            pathLength={100}
            d={SPIRAL}
            strokeDasharray="0.6 7.4"
            strokeLinecap="round"
            strokeWidth="2.2"
          />
        </g>
      )}
      {name === "target" && (
        <g>
          {[16, 30, 44].map((r) => (
            <circle key={r} className={styles.artDraw} pathLength={1} cx="60" cy="60" r={r} />
          ))}
          {/* Vlny z prostředka ven, dvě s posunem. */}
          {[0, 1].map((k) => (
            <circle key={k} className={styles.artPulse} style={{ animationDelay: `${-k * 1.8}s` }} cx="60" cy="60" r="16" />
          ))}
          <g className={styles.artCross}>
            <path className={styles.artDraw} pathLength={1} d="M60 8v20M60 92v20M8 60h20M92 60h20" />
          </g>
          <circle cx="60" cy="60" r="2.2" fill="currentColor" stroke="none" />
        </g>
      )}
    </svg>
  );
}
