// Otázka na pohyb — kartička nad lištou cookies při každém plném načtení,
// dokud návštěvník nezvolí. Web se neřídí systémovým „Omezit pohyb" (viz
// lib/motion-preference); kolik pohybu chce, řekne návštěvník tady:
//
//   Plný pohyb    všechno (výchozí, když nic nezvolí)
//   Méně pohybu   nic se nehýbe samo — částice, střídání bannerů, jízda
//                 scény a autoplay stojí; odpověď na ruku a scroll zůstává
//   Bez pohybu    jen nutný pohyb (klidnější verze)
//
// Jen na šířku (monitory, notebooky, tablety na šířku): na výšku je web
// zjednodušený sám a kartička by jen překážela. Stojí nad lištou cookies
// (měří si její výšku), ukáže se až s bránou `go` jako ona.

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { useGate } from "@/motion/LoadProvider";
import { readMotionChoice, setMotionChoice, systemReducedMotion, type MotionChoice as Level } from "@/lib/motion-preference";
import styles from "./MotionChoice.module.scss";

const COOKIE_BANNER = '[role="dialog"][aria-label="Souhlas se soubory cookie"]';
const LANDSCAPE = "(orientation: landscape)";

export default function MotionChoice() {
  const { go } = useGate();
  const [open, setOpen] = useState(false);
  const [system, setSystem] = useState(false);
  const [lift, setLift] = useState(0);

  // Jen na klientovi, jen bez uložené volby a jen na šířku.
  useEffect(() => {
    const landscape = window.matchMedia(LANDSCAPE);
    const decide = () => {
      setOpen(readMotionChoice() === null && landscape.matches);
      setSystem(systemReducedMotion());
    };
    decide();
    landscape.addEventListener("change", decide);
    return () => landscape.removeEventListener("change", decide);
  }, []);

  // Výška lišty cookies pod kartičkou (když stojí); lišta přichází a odchází,
  // tak se hledá znovu při každé změně DOMu.
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

  const choose = (next: Level) => {
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
              Web je plný pohybu — 3D scény, přechody a animace. Kolik ho chcete?
              {system ? <span className={styles.note}> Váš systém má zapnuté omezení pohybu; web ho zatím nepoužívá.</span> : null}
            </p>
            <div className={styles.row}>
              <button type="button" className={`${styles.button} ${styles.primary}`} onClick={() => choose("full")}>
                Plný pohyb
              </button>
              <button type="button" className={styles.button} onClick={() => choose("some")} title="Nic se nehýbe samo od sebe — jen když na to sáhnete">
                Méně pohybu
              </button>
              <button type="button" className={styles.button} onClick={() => choose("reduced")} title="Jen nutný pohyb">
                Bez pohybu
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
