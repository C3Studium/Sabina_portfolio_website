// TextMorph — slovo, které se umí kapalně přelít do jiného (WebGL, viz engine.ts).
// Převzaté z TextMorph, přestavěné na řízenou komponentu: slovo mění
// rodič přes `index`, ne časovač uvnitř.
//
// ZATÍM NEPOUŽITÉ — uložené pro další místo. Použití:
//
//     const [set, setSet] = useState(0);
//     <TextMorph words={["lepší", "větší"]} index={set} />
//     // přechod: setSet((s) => (s + 1) % 2)
//
// Uvnitř <MeasureText> (slovo pak kreslí MeasureText a morf jen přechod):
// stačí ho dát místo `<span data-measure>` — platné slovo `data-measure`
// nese samo — a přepínat `index` třeba z `onGlance` MeasureTextu.
// Samostatně (bez MeasureText) WebGL po přechodu zhasne a slovo zůstane
// jako obyčejný text.
//
// DOM: všechna slova leží přes sebe v jedné buňce mřížky, takže řádek drží
// šířku nejdelšího a nic neposkakuje. Platné slovo je skutečný text
// (`data-measure` — čte ho MeasureText a vyhledávače), ostatní jsou
// neviditelná a skrytá čtečkám.
//
// V klidu plátno nekreslí nic: slovo kreslí MeasureText (nebo se ukáže samo
// jako text). Přechod je předávka ve třech krocích, aby se dvě kreslení
// nikdy nepotkala:
//   1. `data-morphing="running"` — MeasureText slovo schová, kreslí WebGL
//   2. konec přechodu: `data-morphing="settled"` a `data-measure` se přesune
//      na nové slovo; WebGL dál drží poslední snímek
//   3. MeasureText nové slovo přeměří, ukáže ho a atribut smaže — v tomtéž
//      snímku tady na to plátno zhasne (MutationObserver)

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Morph, MorphSettings } from "./engine";
import styles from "./styles.module.scss";

/* ---------- Nastavení ---------- */

const settings: MorphSettings = {
  // "liquid" = písmena se slijí, "blur" = rozmazání a posun.
  morph: "liquid",
  // Barva, do které se písmena během přechodu zabarví, a kolik jí.
  morphColor: "#c2ce4a",
  tint: 1,
  // Délka přechodu (s) a rozestup písmen v něm.
  duration: 1.1,
  stagger: 0.25,
  staggerFrom: "start",
  // Jak moc nespárovaná písmena cestují k novému slovu.
  travel: 0.5,
  // Lepivost a nafouknutí při slévání.
  goo: 0.1,
  swell: 0.02,
  softness: 0.8,
  // Zvětšení písmen během přechodu.
  scale: 0.04,
  // Rozlišení polí vzdáleností. Nadpis má 17rem, plné rozlišení by
  // přípravu slov zbytečně zdrželo — kapalina je měkká i tak. Malé písmo
  // (pod 48 px) jde vždy v plném.
  quality: 0.5,
  // Stejná písmena obou slov se jen přesunou. Pro stejný text v jiném řezu
  // (prop `pairLetters={false}`) se slijí všechna.
  pairLetters: true,
};

// Když MeasureText předávku nedokončí (není živý, slovo mimo záběr),
// plátno zhasne samo po téhle době (ms).
const SETTLE_TIMEOUT = 600;

/* ---------- Prostředí ---------- */

const REDUCED = "(prefers-reduced-motion: reduce)";
const subscribeReduced = (notify: () => void) => {
  const media = window.matchMedia(REDUCED);
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
};
const readReduced = () => window.matchMedia(REDUCED).matches;
const readReducedOnServer = () => false;

// Neviditelná náhradní slova jen v prohlížeči: v HTML ze serveru má <h1>
// jen platné slovo, aby vyhledávač nečetl „lepší větší výsledky prodeje".
const subscribeNothing = () => () => {};
const onClient = () => true;
const onServer = () => false;

/* ---------- Komponenta ---------- */

type TextMorphProps = {
  /** Slova, mezi kterými se přelévá. */
  words: string[];
  /** Které slovo má platit. Změna spustí přechod. */
  index: number;
  /** Třída pro každé slovo zvlášť — např. jiný řez písma pro druhé slovo. */
  wordClassNames?: (string | undefined)[];
  /** `false` = stejná písmena se nepárují (stejný text v jiném řezu). */
  pairLetters?: boolean;
  /**
   * `false` = platné slovo nenese `data-measure` — pro TextMorph uvnitř
   * MeasureText, který ho kreslit nemá (např. jméno v logu hlavičky).
   * Předávka pak jde cestou „samostatně" (SETTLE_TIMEOUT).
   */
  measure?: boolean;
  className?: string;
};

export default function TextMorph({
  words,
  index,
  wordClassNames,
  pairLetters = settings.pairLetters,
  measure = true,
  className,
}: TextMorphProps) {
  const rootRef = useRef<HTMLSpanElement>(null);
  const morphRef = useRef<Morph | null>(null);
  const runningRef = useRef(false);
  const fallbackRef = useRef(0);
  // Slovo, které je v DOMu platné. Mění se až na KONCI přechodu. -1 = nic
  // (slovo je schované a čeká na vstup — viz `index`).
  const [settled, setSettled] = useState(() => index);
  // Engine je načtený (nebo jisté, že nebude — bez WebGL). Do té doby se
  // s přechodem čeká, ať se vstup neodbude okamžitou výměnou.
  const [ready, setReady] = useState(false);
  const reduced = useSyncExternalStore(subscribeReduced, readReduced, readReducedOnServer);
  const mounted = useSyncExternalStore(subscribeNothing, onClient, onServer);
  // Které slovo je v DOMu skutečný text. Schované (-1) drží poslední slovo —
  // v HTML ze serveru tak vždycky stojí to cílové (vyhledávače, čtečky).
  const domIndex = settled >= 0 ? settled : words.length - 1;

  // Engine (a three.js) se načte až na klientovi, mimo první vykreslení.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let cancelled = false;
    let morph: Morph | null = null;
    import("./engine")
      .then(({ createMorph }) => {
        if (cancelled) return;
        morph = createMorph(root, { ...settings, pairLetters });
        morphRef.current = morph;
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    // Krok 3 předávky: MeasureText smazal `data-morphing` → zhasnout plátno.
    const watcher = new MutationObserver(() => {
      if (!root.dataset.morphing) morphRef.current?.clear();
    });
    watcher.observe(root, { attributes: true, attributeFilter: ["data-morphing"] });
    return () => {
      cancelled = true;
      watcher.disconnect();
      morph?.destroy();
      morphRef.current = null;
      delete root.dataset.morphing;
    };
  }, [pairLetters]);

  // Jiná slova = jiná pole vzdáleností.
  const key = words.join("\u0001");
  useEffect(() => {
    morphRef.current?.build();
  }, [key]);

  // Schované slovo (-1): `data-morphing="hidden"` — DOM text i MeasureText ho
  // nekreslí, dokud nepřijde vstupní přechod.
  useEffect(() => {
    const root = rootRef.current;
    if (!root || runningRef.current) return;
    if (settled < 0) root.dataset.morphing = "hidden";
    else if (root.dataset.morphing === "hidden") delete root.dataset.morphing;
  }, [settled]);

  // Změna `index` → přechod. Během běžícího přechodu se nová změna nechá
  // na potom: až doběhne, `settled` se změní a efekt se spustí znovu.
  // Z -1 je to vstup (slovo se vylije z ničeho), do -1 slovo zmizí rovnou.
  useEffect(() => {
    if (index === settled || runningRef.current) return;
    const root = rootRef.current;
    const morph = morphRef.current;
    const target = index < 0 ? -1 : ((index % words.length) + words.length) % words.length;
    if (!reduced && !ready) return;

    // Bez WebGL (i ztraceného), s omezeným pohybem nebo do schovaného
    // stavu: jen výměna.
    if (!root || !morph || !morph.alive() || reduced || target < 0) {
      const frame = requestAnimationFrame(() => {
        if (root && target >= 0 && root.dataset.morphing === "hidden") delete root.dataset.morphing;
        setSettled(target);
      });
      return () => cancelAnimationFrame(frame);
    }

    runningRef.current = true;
    root.dataset.morphing = "running";
    morph.morphTo(settled, target, () => {
      runningRef.current = false;
      root.dataset.morphing = "settled";
      setSettled(target);
      // Pojistka mimo efekt — jeho úklid při změně `settled` ji rušit nesmí.
      window.clearTimeout(fallbackRef.current);
      fallbackRef.current = window.setTimeout(() => {
        if (root.dataset.morphing === "settled") delete root.dataset.morphing;
      }, SETTLE_TIMEOUT);
    });
  }, [index, settled, reduced, ready, words.length]);

  useEffect(() => () => window.clearTimeout(fallbackRef.current), []);

  return (
    <span ref={rootRef} className={[styles.root, className].filter(Boolean).join(" ")}>
      {words.map((word, i) =>
        i !== domIndex && !mounted ? null : (
        <span
          key={i}
          data-morph-word=""
          data-measure={measure && i === domIndex ? "" : undefined}
          aria-hidden={i === domIndex ? undefined : true}
          className={[i === domIndex ? styles.current : styles.ghost, wordClassNames?.[i]]
            .filter(Boolean)
            .join(" ")}
        >
          {word}
        </span>
        ),
      )}
    </span>
  );
}
