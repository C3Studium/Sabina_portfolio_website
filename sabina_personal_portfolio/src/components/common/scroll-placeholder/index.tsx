// Nápověda posunu — tečka, linka a popisek v nekonečné smyčce. Svislá
// (výchozí) nebo vodorovná (`orientation="horizontal"`: tečka jede zleva
// doprava, text vpravo od linky, kouř postupuje od prvního písmene).
//
// Dvě vrstvy pohybu:
//  - Hodiny: motion value `cycle` běží 0 → 1 dokola (framer `animate`
//    s `repeat: Infinity`). Říkají jen KDY — kdy má tečka vyrazit dolů a kdy
//    nahoru. Z nich je `target`: 0 = nahoře, 1 = dole.
//  - Pružina: `travel = useSpring(target)` je skutečná poloha tečky. Vyrazí
//    rychle a dosedá pomalu, jako stlačovaná pružina — ne rovnoměrná smyčka.
//
// Text nemá vlastní časy ani křivku. Postup kouře se čte přímo z `travel`:
// cestou dolů je to postup rozplynutí, cestou nahoru postup sražení. Text
// proto začíná, zrychluje i dosedá přesně s tečkou.
//
// Průběh jedné smyčky (časy v `settings` níž):
//   1. rest  — klid nahoře, tečka nad linkou, text celý a čitelný
//   2. move  — tečka sjíždí dolů, text se rozplývá shora dolů
//   3. delay — konec se drží: tečka dole, text pryč
//   4. move  — tečka vyjíždí nahoru, text se sráží zespodu nahoru
//   5. delay — konec se drží: tečka nahoře, text celý; pak smyčka znovu
//
// Kouř kreslí WebGL (smoke.ts, převzaté ze SmokeType). Kde nejde — slabý
// stroj, žádné WebGL2 —, text místo kouře jen prolne krytím ve stejném
// rytmu. Při omezeném pohybu, na dotyku a mimo záběr smyčka stojí.

import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import {
  animate,
  calcGeneratorDuration,
  frameData,
  spring,
  motion,
  useInView,
  useMotionValue,
  useMotionValueEvent,
  useSpring,
  useTransform,
  type AnimationPlaybackControls,
} from "framer-motion";
import { useGate } from "@/motion/LoadProvider";
import { usePerformance } from "@/providers/PerformanceProvider";
import type { Smoke, SmokeConfig, SmokeFrom } from "./smoke";
import styles from "./styles.module.scss";

/* ---------- Nastavení ---------- */

const settings = {
  /* Smyčka — sekundy při speed 1, v pořadí, jak jdou po sobě */
  // Klid nahoře s celým textem, než se tečka rozjede.
  rest: 1.6,
  // Jak dlouho tečka vizuálně jede dolů i nahoru (`visualDuration` pružiny).
  // Pružina pak ještě chvíli dosedá — to je ten pomalý konec.
  move: 1.5,
  // Pauza po každé cestě (dole i nahoře): konečný stav se drží, než začne
  // další. Platí pro tečku i text zároveň a `speed` ji nezkracuje.
  delay: 0.25,
  // Násobek tempa pohybu i proudění kouře.
  speed: 1.15,

  /* Pružina */
  // 0 = dosedne bez překmitu. Vyšší hodnota = tečka na konci zhoupne
  // (a text se s ní na okamžik vrátí o kousek zpět).
  bounce: 0,

  /* Kouř */
  // Odkud fronta po textu postupuje (na obrazovce): "top" | "bottom" | "center" | "edges".
  dissolveFrom: "top" as SmokeFrom,
  condenseFrom: "bottom" as SmokeFrom,
  // Kam se písmena při rozplynutí odnášejí; při sražení přijíždějí odtamtud.
  drift: "down",
  // Jakou část cesty trvá jedno písmeno; zbytek je rozestup mezi písmeny.
  letter: 0.3,
  // Ztenčení hran srazených WebGL písmen, aby při předávce seděla na ostrý
  // DOM text (1 = beze změny). Vyladěné měřením v prohlížeči.
  edge: 1.18,
  smokeColor: "#bec948",
  rise: 0.25,
  turbulence: 1,
  softness: 1,
  density: 1.5,
  // Násobek rozlišení plátna (0,25–1). Nižší = levnější a měkčí.
  quality: 1,
} satisfies SmokeConfig & Record<string, unknown>;

/* ---------- Odvozené časy ---------- */

// Pružina tečky. `restDelta` 0,003 = zhruba půl pixelu na lince; pod tím
// pružina dosedne přesně na cíl a skončí.
const SPRING = {
  visualDuration: settings.move / settings.speed,
  bounce: settings.bounce,
  restDelta: 0.003,
  restSpeed: 0.01,
};

// Skutečné časy v sekundách. `speed` zrychluje pohyb, ne pauzy.
const REST = settings.rest / settings.speed;
// Cesta trvá, dokud pružina opravdu NEDOSEDNE — ne jen `visualDuration`.
// Pomalý konec by jinak spolkl pauzu a další cesta by vyrazila z pohybu.
// Délku spočítá framer ze stejné pružiny, jakou pak jede `useSpring`.
const MOVE = calcGeneratorDuration(spring({ keyframes: [0, 1], ...SPRING })) / 1000;
const DELAY = settings.delay;

// Délka smyčky a okamžiky povelů jako zlomky 0–1 hodnoty `cycle`.
// Pořadí: rest | move dolů | delay | move nahoru | delay — a znovu.
const PERIOD = REST + MOVE + DELAY + MOVE + DELAY;
const GO_DOWN = REST / PERIOD;
const GO_UP = (REST + MOVE + DELAY) / PERIOD;

// Kam má tečka v daném bodě smyčky mířit: 1 dole, 0 nahoře.
const targetAt = (c: number): number => (c >= GO_DOWN && c < GO_UP ? 1 : 0);

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/* ---------- Prostředí ---------- */

// Mikroanimace jen pro myš a touchpad. Externí store místo stavu v efektu:
// server i první snímek klienta vrátí `false`, změnu (připojená myš) to
// zachytí bez dalšího kódu.
const FINE = "(hover: hover) and (pointer: fine)";
const subscribeFine = (notify: () => void) => {
  const media = window.matchMedia(FINE);
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
};
const readFine = () => window.matchMedia(FINE).matches;
const readFineOnServer = () => false;

// Rozdělení na grafémy, ne na UTF-16 jednotky — „í" s kombinační čárkou
// zůstane jedním písmenem.
const segment = (value: string) =>
  typeof Intl === "undefined" || typeof Intl.Segmenter === "undefined"
    ? Array.from(value)
    : Array.from(
        new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(value),
        (part) => part.segment,
      );

/* ---------- Komponenta ---------- */

type ScrollPlaceholderProps = {
  /** Text popisku, např. „Objevujte posunutím". */
  label: string;
  /** Anotace Studia pro popisek (`edit("items.3.label")`). Mimo Studio prázdná. */
  labelProps?: Record<string, string | undefined>;
  /** "vertical" = tečka shora dolů a svislý popisek, "horizontal" = zleva doprava. */
  orientation?: "vertical" | "horizontal";
  className?: string;
};

export default function ScrollPlaceholder({
  label,
  labelProps,
  orientation = "vertical",
  className,
}: ScrollPlaceholderProps) {
  const horizontal = orientation === "horizontal";
  const rootRef = useRef<HTMLSpanElement>(null);
  const faceRef = useRef<HTMLSpanElement>(null);
  const smokeRef = useRef<Smoke | null>(null);
  const loopRef = useRef<AnimationPlaybackControls | null>(null);

  // V editačním rámu Studia se text píše přímo do DOMu. Rozsekaný na
  // písmena by se s Reactem pral, proto tam zůstává jeden textový uzel
  // a kouř se nespouští.
  const editing = Object.keys(labelProps ?? {}).length > 0;
  const glyphs = useMemo(() => segment(label), [label]);

  const { go } = useGate();
  const { heavy, reducedMotion } = usePerformance();
  const fine = useSyncExternalStore(subscribeFine, readFine, readFineOnServer);
  const inView = useInView(rootRef, { margin: "120px" });

  // Smyčka běží až po oponě, jen pro myš, bez omezeného pohybu a v záběru.
  const running = go && fine && !reducedMotion && inView;
  // Kouř navíc potřebuje stroj, který druhý WebGL kontext unese.
  const smokeWanted = running && heavy && !editing;

  /* ----- Hodiny a pružina ----- */

  const cycle = useMotionValue(0);
  const target = useTransform(cycle, targetAt);
  // Skutečná poloha tečky: 0 nahoře, 1 dole.
  const travel = useSpring(target, SPRING);

  useEffect(() => {
    if (running) {
      loopRef.current ??= animate(cycle, [0, 1], {
        duration: PERIOD,
        ease: "linear",
        repeat: Infinity,
      });
      loopRef.current.play();
      return;
    }
    // Mimo záběr jen pauza — po návratu smyčka naváže, kde přestala.
    // Jinak (omezený pohyb, dotyk, opona) rovnou do klidu, bez pružiny:
    // tečka nahoře, text celý.
    if (!inView && loopRef.current) {
      loopRef.current.pause();
      return;
    }
    loopRef.current?.stop();
    loopRef.current = null;
    cycle.jump(0);
    travel.jump(0);
  }, [running, inView, cycle, travel]);

  useEffect(() => () => loopRef.current?.stop(), []);

  /* ----- Tečka a linka ----- */

  // Ořez na 0–1: s `bounce` nad nulou pružina na konci přestřelí.
  const reach = useTransform(travel, clamp01);
  // Procenta v translate se počítají z vlastní výšky nosiče. Nosič začíná
  // tam, kde tečka stojí v klidu (nad linkou), a končí s linkou — 100 % =
  // tečka na jejím konci. Plnění má tentýž rozměr, takže jeho špička jde
  // přesně pod tečkou.
  const dotY = useTransform(reach, [0, 1], ["0%", "100%"]);

  /* ----- Text ----- */

  // Kdo právě drží text: ostrý DOM, nebo WebGL. Předávka je JEDEN snímek —
  // obě vrstvy kreslí totéž na stejném místě, takže se jen přepnou.
  // Prolínat je nejde: dvě poloprůhledné kopie přes sebe text ztenčí
  // (1 − 0,5 · 0,5 = 75 %) a dvě plné ho na hranách písmen ztuční. Obojí
  // bylo vidět jako mrknutí.
  //
  // `face` je napojené na styl PŘÍMO, ne přes odvozenou hodnotu: odvozená
  // se přepočítá až o snímek později, a WebGL by na jeden snímek kreslil
  // přes ještě viditelný DOM text — přesně to ztučnělé bliknutí.
  const face = useMotionValue(1);
  const holderRef = useRef<"dom" | "smoke">("dom");

  // Kouř se načte až ve chvíli, kdy má poprvé běžet. Pak už zůstává —
  // rozbíjet a znovu stavět WebGL při každém odjetí ze záběru by stálo víc.
  useEffect(() => {
    if (!smokeWanted || smokeRef.current) return;
    const root = rootRef.current;
    const faceEl = faceRef.current;
    if (!root || !faceEl) return;

    let cancelled = false;
    import("./smoke").then(({ createSmoke }) => {
      if (cancelled) return;
      smokeRef.current = createSmoke(root, faceEl, settings);
    });
    return () => {
      cancelled = true;
    };
  }, [smokeWanted]);

  useEffect(
    () => () => {
      smokeRef.current?.destroy();
      smokeRef.current = null;
    },
    [],
  );

  // Jiný text = jiná písmena na plátně.
  useEffect(() => {
    smokeRef.current?.measure();
  }, [glyphs]);

  // Snímek kouře. Čte se přímo z pružiny, takže text jede s tečkou:
  //   míří dolů  → rozplynutí, postup = travel
  //   míří nahoru → sražení,   postup = 1 − travel
  // Text drží DOM jen v úplném klidu nahoře — pružina dosedá přesně na 0.
  // Konečné stavy se tím drží samy: dole stojí travel = 1 (text pryč),
  // nahoře 0 (text celý), a nic se mezi cestami nevrací na začátek.
  const paint = () => {
    const goingDown = target.get() === 1;
    const t = clamp01(travel.get());

    // Bez kouře (slabý stroj, žádné WebGL2) text jen prolne podle tečky.
    const smoke = smokeRef.current;
    if (!smoke) {
      face.set(1 - t);
      return;
    }

    const holder = !goingDown && t === 0 ? "dom" : "smoke";

    if (holder !== holderRef.current) {
      holderRef.current = holder;
      face.jump(holder === "dom" ? 1 : 0);
    }

    // Čas proudění jde z frameru, ne z hodin: smyčka se na konci vrací na
    // nulu, proudění musí téct dál.
    const time = (frameData.timestamp / 1000) * settings.speed;
    smoke.draw(
      holder === "dom"
        ? { phase: "none", clock: 0, from: settings.condenseFrom, time, letterLayer: 1 }
        : goingDown
          ? { phase: "dissolve", clock: t, from: settings.dissolveFrom, time, letterLayer: 1 }
          : { phase: "condense", clock: 1 - t, from: settings.condenseFrom, time, letterLayer: 1 },
    );
  };

  // Kreslí se při každém pohybu pružiny a při povelu — povel dolů přepne
  // na WebGL ještě v tomtéž snímku, kdy se tečka rozjede.
  useMotionValueEvent(travel, "change", paint);
  useMotionValueEvent(target, "change", paint);

  return (
    <span
      className={[styles.hint, horizontal ? styles.horizontal : undefined, className].filter(Boolean).join(" ")}
    >
      <span className={styles.rail}>
        <span className={styles.track} />
        {/* Ořez na linku: plnění začíná u klidové tečky nad linkou, ale
            vidět je jen ta část, která už leží na lince. */}
        <span className={styles.fillClip}>
          <motion.span
            className={styles.fill}
            style={horizontal ? { scaleX: reach, originX: 0 } : { scaleY: reach, originY: 0 }}
          />
        </span>
        <motion.span className={styles.carrier} style={horizontal ? { x: dotY } : { y: dotY }}>
          <span className={styles.dot} />
        </motion.span>
      </span>

      {/* Kořen kouře: plátno se vloží sem a otáčí se s popiskem. */}
      <span ref={rootRef} className={styles.label}>
        <motion.span
          ref={faceRef}
          className={styles.face}
          style={editing ? undefined : { opacity: face }}
          {...labelProps}
        >
          {editing
            ? label
            : glyphs.map((glyph, index) => (
                <span key={index} data-glyph="">
                  {glyph}
                </span>
              ))}
        </motion.span>
      </span>
    </span>
  );
}
