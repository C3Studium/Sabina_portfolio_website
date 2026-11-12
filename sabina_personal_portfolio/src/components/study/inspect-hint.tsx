// Proklik obrázku do inspektoru (Náhled / Vrstvy / Pixely) odkudkoli z webu.
//
//   <InspectRoot>…</InspectRoot>       — drží otevřený obrázek a kreslí
//                                         inspektor přes celou stránku (portál:
//                                         předci s 3D transformací by jinak
//                                         rozbili `position: fixed`).
//   <InspectHint image={…} />          — vrstva PŘES obrázek (jako sourozenec
//                                         uvnitř jeho rámu, ne obal — nerozbije
//                                         rozvržení ani animace). Klik otevře
//                                         inspektor, najetím se rám zvětší
//                                         (CSS `scale`, skládá se s animovaným
//                                         `transform`) a dokola se kolem obrázku
//                                         objevuje štítek „Rozbalit detail"
//                                         s linkou k obrázku, pokaždé jinde.
//
// Ve Studiu (`disabled`) nic — klik patří editoru.

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { InspectContext, Inspector, useInspect } from "./inspector";
import type { StudyImage } from "./content";
import styles from "./inspect-hint.module.scss";

/* ---------- Nastavení ---------- */

const HINT = {
  // Jak dlouho štítek stojí a za jak dlouho přijde další (s).
  show: 2.4,
  every: 4.2,
  // Kde stojí štítek: kousek za hranou obrázku (podíl půlky rámu, 1 = hrana).
  out: 1.45,
  // Kam míří linka: kousek uvnitř obrázku.
  into: 0.55,
};

/* ---------- Kořen ---------- */

const subscribeNothing = () => () => {};

export function InspectRoot({ children }: { children: ReactNode }) {
  // Obrázek a jeho prvek — detail se nalepí vedle něj.
  const [shown, setShown] = useState<{ image: StudyImage; anchor: HTMLElement | null } | null>(null);
  const open = useCallback((image: StudyImage, anchor?: HTMLElement | null) => setShown({ image, anchor: anchor ?? null }), []);
  // Portál jen v prohlížeči (na serveru document není).
  const mounted = useSyncExternalStore(subscribeNothing, () => true, () => false);
  const close = useCallback(() => setShown(null), []);
  return (
    <InspectContext.Provider value={open}>
      {children}
      {mounted ? createPortal(<Inspector image={shown?.image ?? null} anchor={shown?.anchor} onClose={close} />, document.body) : null}
    </InspectContext.Provider>
  );
}

/* ---------- Vrstva přes obrázek ---------- */

type Spot = { key: number; px: number; py: number; tx: number; ty: number };

// Náhodné místo štítku kolem obrázku a bod na obrázku, kam míří linka.
const randomSpot = (key: number): Spot => {
  const angle = Math.random() * Math.PI * 2;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  // Na obdélník: větší z obou složek dosáhne hrany.
  const edge = 1 / Math.max(Math.abs(cos), Math.abs(sin));
  return {
    key,
    px: 50 + cos * edge * 50 * HINT.out,
    py: 50 + sin * edge * 50 * HINT.out,
    tx: 50 + cos * edge * 50 * HINT.into,
    ty: 50 + sin * edge * 50 * HINT.into,
  };
};

export function InspectHint({
  image,
  disabled = false,
  label = "Rozbalit detail",
  delay,
}: {
  image: StudyImage;
  disabled?: boolean;
  label?: string;
  /** Za kolik sekund se ukáže první štítek (jinak náhodně 0,6–3 s). Pro
   *  štítky, které se zapnou až po stavbě obrázku (Proces). */
  delay?: number;
}) {
  const open = useInspect();
  const ref = useRef<HTMLButtonElement>(null);
  const [spot, setSpot] = useState<Spot | null>(null);
  const [visible, setVisible] = useState(false);

  // Rám obrázku (rodič) dostane značku — CSS ho pak umí zvětšit.
  useEffect(() => {
    const host = ref.current?.parentElement;
    if (!host || disabled) return;
    host.setAttribute("data-inspect-host", "");
    return () => {
      host.removeAttribute("data-inspect-host");
      host.removeAttribute("data-inspect-hover");
    };
  }, [disabled]);

  // Smyčka štítku jen na obrazovce.
  useEffect(() => {
    const el = ref.current;
    if (!el || disabled) return;
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: "60px" });
    io.observe(el);
    return () => io.disconnect();
  }, [disabled]);

  useEffect(() => {
    if (!visible || disabled) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let n = 0;
    let hide = 0;
    const tick = () => {
      n += 1;
      setSpot(randomSpot(n));
      window.clearTimeout(hide);
      hide = window.setTimeout(() => setSpot(null), HINT.show * 1000);
    };
    // Každý obrázek začíná jindy, aby štítky neblikaly naráz.
    const first = window.setTimeout(tick, delay !== undefined ? delay * 1000 : 600 + Math.random() * 2400);
    const loop = window.setInterval(tick, HINT.every * 1000);
    return () => {
      window.clearTimeout(first);
      window.clearTimeout(hide);
      window.clearInterval(loop);
      setSpot(null);
    };
  }, [visible, disabled, delay]);

  if (disabled || !open) return null;

  const hover = (on: boolean) => {
    const host = ref.current?.parentElement;
    if (!host) return;
    if (on) host.setAttribute("data-inspect-hover", "");
    else host.removeAttribute("data-inspect-hover");
  };

  return (
    <button
      ref={ref}
      type="button"
      className={styles.hint}
      aria-label={`${label}: ${image.alt}`}
      onClick={(event) => {
        event.stopPropagation();
        hover(false);
        // Kotva = obal obrázku (štítek leží přes celý formát).
        open(image, event.currentTarget.parentElement);
      }}
      onPointerEnter={() => hover(true)}
      onPointerLeave={() => hover(false)}
    >
      <AnimatePresence>
        {spot ? (
          <motion.span key={spot.key} className={styles.callout} aria-hidden="true" exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
            <svg className={styles.lineSvg} width="100%" height="100%" preserveAspectRatio="none">
              <motion.line
                x1={`${spot.px}%`}
                y1={`${spot.py}%`}
                x2={`${spot.tx}%`}
                y2={`${spot.ty}%`}
                className={styles.line}
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
              />
            </svg>
            <motion.span
              className={styles.target}
              style={{ left: `${spot.tx}%`, top: `${spot.ty}%` }}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 380, damping: 18, delay: 0.55 }}
            />
            <motion.span
              className={styles.pill}
              style={{ left: `${spot.px}%`, top: `${spot.py}%` }}
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
            >
              <span className={styles.plus}>+</span>
              {label}
            </motion.span>
          </motion.span>
        ) : null}
      </AnimatePresence>
    </button>
  );
}
