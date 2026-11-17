// Otázka na pohyb — kartička nad lištou cookies při každém plném načtení,
// dokud návštěvník nezvolí. Web se neřídí systémovým „Omezit pohyb" (viz
// lib/motion-preference); kdo chce klidnější verzi, řekne to tady.
//
// Stojí nad lištou cookies (měří si její výšku), ukáže se až s bránou `go`
// jako ona — ne přes oponu úvodu.

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { useGate } from "@/motion/LoadProvider";
import { readMotionChoice, setMotionChoice, systemReducedMotion } from "@/lib/motion-preference";
import styles from "./MotionChoice.module.scss";

const COOKIE_BANNER = '[role="dialog"][aria-label="Souhlas se soubory cookie"]';

export default function MotionChoice() {
  const { go } = useGate();
  const [open, setOpen] = useState(false);
  const [system, setSystem] = useState(false);
  const [lift, setLift] = useState(0);

  // Jen na klientovi a jen bez uložené volby.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- čtení úložiště po mountu
    setOpen(readMotionChoice() === null);
    setSystem(systemReducedMotion());
  }, []);

  // Výška lišty cookies pod kartičkou (když stojí); lišta přichází a odchází,
  // tak se hledá znovu při každé změně DOMu v <body>.
  useEffect(() => {
    if (!open) return undefined;
    let ro: ResizeObserver | null = null;
    const attach = () => {
      const el = document.querySelector<HTMLElement>(COOKIE_BANNER);
      ro?.disconnect();
      ro = null;
      if (!el) {
        setLift(0);
        return;
      }
      const measure = () => setLift(el.getBoundingClientRect().height + 12);
      measure();
      ro = new ResizeObserver(measure);
      ro.observe(el);
    };
    attach();
    const mo = new MutationObserver(attach);
    // Lišta cookies není přímý potomek <body> — hlídat celý strom.
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      mo.disconnect();
      ro?.disconnect();
    };
  }, [open]);

  const choose = (next: "full" | "reduced") => {
    setOpen(false);
    setMotionChoice(next);
  };

  return (
    <AnimatePresence>
      {open && go && (
        <motion.div
          className={styles.wrap}
          style={{ "--lift": `${lift}px` } as React.CSSProperties}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          role="dialog"
          aria-label="Množství pohybu na webu"
        >
          <div className={styles.card}>
            <p className={styles.text}>
              Web je plný pohybu — 3D scény, přechody a animace. Vyhovuje vám to, nebo chcete klidnější verzi?
              {system ? <span className={styles.note}> Váš systém má zapnuté omezení pohybu; web ho zatím nepoužívá.</span> : null}
            </p>
            <div className={styles.row}>
              <button type="button" className={`${styles.button} ${styles.primary}`} onClick={() => choose("full")}>
                Nechat pohyb
              </button>
              <button type="button" className={styles.button} onClick={() => choose("reduced")}>
                Méně pohybu
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
