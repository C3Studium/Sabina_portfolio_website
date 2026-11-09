// Stavba formuláře v kontaktním modálu — při každém otevření, bez myši.
//
//   1. nadpis formuláře a text pod ním se srazí z kouře (SmokeText — týž
//      kouř jako „Objevujte posunutím"), text o kousek po nadpisu
//   2. ještě během textu se postupně postaví pole — jméno, telefon, typ
//      projektu, zpráva — pak souhlas a tlačítko: rámeček se štítkem,
//      kontura, výplň (BuildFrame + SketchText, jako výzva v CTA a portrét)
//   3. pod formulářem přijedou zprava kontakty (telefon, e-mail, …)
//   4. tlačítko postavené → MeasureText; kurzor do pole jména
//
// Každá část má vlastní postup 0–1 (MotionValue). Po zavření se vše vrátí
// na 0 přes `reset` (AnimatePresence onExitComplete), takže další otevření
// hraje znovu.
//
// Kdy NEhraje (`still`): omezený pohyb a Studio (modál jako povrch) —
// formulář je hned celý. Jakmile návštěvník sám klikne, píše nebo vstoupí
// do pole, stavba se okamžitě dokončí: nesmí překážet tomu, kdo už ví.

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import { animate, useMotionValue, type MotionValue } from "framer-motion";

/* ---------- Nastavení (sekundy) ---------- */

// Text a formulář jsou hotové do ~1,8 s od otevření, kontakty pod nimi
// dojedou do ~2 s.

// Čekání po otevření, než panel naběhne.
const START_DELAY = 0.25;
// Sražení nadpisu a textu z kouře; text začne o `LEAD_DELAY` později.
const TITLE = 0.7;
const LEAD = 0.85;
const LEAD_DELAY = 0.15;
// Pole se začnou stavět ještě během textu, jedno po druhém.
const PARTS_DELAY = 0.35;
const STAGGER = 0.08;
// Stavba jedné části (rámeček → kontura → výplň → rámeček zhasne).
const BUILD = 0.8;
// Kontakty pod formulářem: začnou, když je tlačítko zhruba v půlce stavby.
const CHANNELS = 0.6;
const CHANNELS_AT = 0.5;

const EASE_SMOKE = [0.25, 0.6, 0.3, 1] as const;

/** Části, které se staví, v pořadí stavby. */
export const PARTS = ["name", "phone", "type", "message", "consent", "button"] as const;
export type PartKey = (typeof PARTS)[number];

type Values = {
  title: MotionValue<number>;
  lead: MotionValue<number>;
  part: Record<PartKey, MotionValue<number>>;
  channels: MotionValue<number>;
};
const every = (v: Values) => [v.title, v.lead, ...PARTS.map((key) => v.part[key]), v.channels];

/* ---------- Prostředí ---------- */

const QUERY = "(prefers-reduced-motion: reduce)";
const subscribeMedia = (notify: () => void) => {
  const media = window.matchMedia(QUERY);
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
};
const readSkip = () => window.matchMedia(QUERY).matches;

/* ---------- Hook ---------- */

export type FormBuild = {
  /** Bez stavby — formulář je hned celý. Po dokončení stavby se NEmění:
   *  přepnutí by obaly přestavělo a pole by ztratilo fokus i obsah. */
  still: boolean;
  /** Sražení nadpisu a textu 0–1 (SmokeText). */
  title: MotionValue<number>;
  lead: MotionValue<number>;
  /** Stavba pole / souhlasu / tlačítka 0–1 (SketchText). */
  part: Record<PartKey, MotionValue<number>>;
  /** Příjezd kontaktů pod formulářem 0–1 (úseky se překrývají). */
  channels: MotionValue<number>;
  /** Tlačítko je postavené (MeasureText smí běžet). */
  built: boolean;
  /** Zpět do výchozího stavu — volat, až modál odejde (onExitComplete). */
  reset: () => void;
};

export function useFormBuild({
  active,
  disabled,
  panelRef,
}: {
  /** Modál je otevřený. */
  active: boolean;
  /** Stavbu vypnout (Studio). */
  disabled: boolean;
  panelRef: RefObject<HTMLElement | null>;
}): FormBuild {
  // Server o omezeném pohybu neví — hlásí „stavět"; modál tam stejně není otevřený.
  const skip = useSyncExternalStore(subscribeMedia, readSkip, () => false);
  const still = skip || disabled;
  const [built, setBuilt] = useState(false);

  // Hodnoty vznikají ve stavu „před stavbou": nic není vidět.
  const title = useMotionValue(0);
  const lead = useMotionValue(0);
  const part = {
    name: useMotionValue(0),
    phone: useMotionValue(0),
    type: useMotionValue(0),
    message: useMotionValue(0),
    consent: useMotionValue(0),
    button: useMotionValue(0),
  };
  const channels = useMotionValue(0);
  const values = useRef({ title, lead, part, channels });

  // Hotový formulář = všechny postupy na 1. Při přerušení a ve `still`.
  const complete = useCallback(() => every(values.current).forEach((value) => value.set(1)), []);
  useEffect(() => {
    if (still) complete();
  }, [still, complete]);

  useEffect(() => {
    if (!active || still) return;
    const panel = panelRef.current;
    if (!panel) return;
    const v = values.current;
    const stops: { stop: () => void }[] = [];
    let done = false;
    // Vždy od nuly — i když předtím platilo `still` (Studio, omezený
    // pohyb) a hodnoty zůstaly na 1. Panel je teď ještě průhledný.
    every(v).forEach((value) => value.jump(0));

    const to = (value: MotionValue<number>, delay: number, duration: number, ease: object | string) => {
      const controls = animate(value, 1, { delay, duration, ease } as never);
      stops.push(controls);
      return controls.then(() => undefined);
    };

    // Návštěvník převzal formulář → dostavět.
    const finish = () => {
      if (done) return;
      done = true;
      stops.forEach((s) => s.stop());
      complete();
      setBuilt(true);
    };
    panel.addEventListener("pointerdown", finish, true);
    panel.addEventListener("keydown", finish, true);
    panel.addEventListener("focusin", finish, true);

    const steps = [
      to(v.title, START_DELAY, TITLE, EASE_SMOKE),
      to(v.lead, START_DELAY + LEAD_DELAY, LEAD, EASE_SMOKE),
      ...PARTS.map((key, i) => to(v.part[key], START_DELAY + PARTS_DELAY + i * STAGGER, BUILD, "linear")),
      to(v.channels, START_DELAY + PARTS_DELAY + (PARTS.length - 1) * STAGGER + BUILD * CHANNELS_AT, CHANNELS, "linear"),
    ];
    Promise.all(steps).then(() => {
      if (done) return;
      done = true;
      setBuilt(true);
      // Kurzor do jména — `done` už stojí, takže to stavbu „nepřeruší".
      panel.querySelector<HTMLElement>('[data-build="name"]')?.focus({ preventScroll: true });
    });

    return () => {
      // Zavření: stavba zamrzne, jak je — modál právě odchází. Do
      // výchozího stavu ji vrátí `reset` po odchodu.
      done = true;
      stops.forEach((s) => s.stop());
      panel.removeEventListener("pointerdown", finish, true);
      panel.removeEventListener("keydown", finish, true);
      panel.removeEventListener("focusin", finish, true);
    };
  }, [active, still, panelRef, complete]);

  // `still` v refu: reset po odchodu nesmí schovat formulář, který se
  // stavět nebude (omezený pohyb, Studio).
  const stillRef = useRef(still);
  useEffect(() => {
    stillRef.current = still;
  }, [still]);
  const reset = useCallback(() => {
    if (stillRef.current) return;
    setBuilt(false);
    every(values.current).forEach((value) => value.set(0));
  }, []);

  return { still, title, lead, part, channels, built: still || built, reset };
}
