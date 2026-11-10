import { useEffect, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { NAV_ITEMS } from "../nav-items";
import styles from "./styles.module.scss";

// Jednoduché menu pro okna, kde se navigace do hlavičky nevejde (na výšku
// do 1180px, na šířku pod 900px — header/styles). Vstup a odchod jako
// kontaktní modal: rozmazané pozadí, karta se zvětší z 0,96 a položky
// najedou po ose x jedna po druhé; odchod je tentýž pohyb obráceně a rychleji.
const EASE_OUT = [0.22, 1, 0.36, 1] as const;
const EASE_IN = [0.4, 0, 1, 1] as const;
const BACKDROP = {
  hidden: { opacity: 0 },
  shown: { opacity: 1, transition: { duration: 0.3, ease: "easeOut" } },
  exit: { opacity: 0, transition: { duration: 0.28, ease: "easeIn", delay: 0.3 } },
} as const;
const PANEL = {
  hidden: { opacity: 0, scale: 0.96 },
  shown: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.5, ease: EASE_OUT, delayChildren: 0.12, staggerChildren: 0.055 },
  },
  exit: {
    opacity: 0,
    scale: 0.985,
    transition: { duration: 0.3, ease: EASE_IN, delay: 0.14, staggerChildren: 0.025, staggerDirection: -1 },
  },
} as const;
const ITEM = {
  hidden: { opacity: 0, x: "2.4vw" },
  shown: { opacity: 1, x: "0vw", transition: { duration: 0.6, ease: EASE_OUT } },
  exit: { opacity: 0, x: "1.6vw", transition: { duration: 0.22, ease: EASE_IN } },
} as const;

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M5 12h13M12 5.5 18.5 12 12 18.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const noop = () => () => {};

type MenuProps = {
  id: string;
  open: boolean;
  onClose: () => void;
  /** Výzva dole v menu — zavře menu a otevře kontaktní modal. */
  onContact: () => void;
  ctaLabel: string;
};

export default function Menu({ id, open, onClose, onContact, ctaLabel }: MenuProps) {
  // Portál do <body>: hlavička se při přechodu mezi stránkami posouvá
  // (transform), a fixed prvek uvnitř transformovaného rodiče by jel s ní.
  // Až na klientovi (na serveru žádné <body> není) — bez setState v efektu.
  const mounted = useSyncExternalStore(noop, () => true, () => false);

  // Escape zavírá a pod otevřeným menu stojí scroll — Lenis i body, stejně
  // jako u kontaktního modalu.
  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const lenis = window.lenisInstance;
    lenis?.stop();
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKey);
    return () => {
      lenis?.start();
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKey);
    };
  }, [open, onClose]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className={styles.backdrop}
          onClick={onClose}
          variants={BACKDROP}
          initial="hidden"
          animate="shown"
          exit="exit"
        >
          <motion.div
            id={id}
            className={styles.panel}
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            onClick={(event) => event.stopPropagation()}
            variants={PANEL}
          >
            <div className={styles.glow} aria-hidden="true" />

            <motion.button
              type="button"
              className={styles.close}
              onClick={onClose}
              aria-label="Zavřít menu"
              variants={ITEM}
            >
              <CloseIcon />
            </motion.button>

            <nav className={styles.nav} aria-label="Hlavní navigace">
              {NAV_ITEMS.map((item, index) => (
                <motion.a
                  key={item.href}
                  className={styles.link}
                  href={item.href}
                  onClick={onClose}
                  variants={ITEM}
                >
                  <span className={styles.linkIndex} aria-hidden="true">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className={styles.linkLabel}>{item.label}</span>
                </motion.a>
              ))}
            </nav>

            <motion.button
              type="button"
              className={styles.cta}
              onClick={() => {
                onClose();
                onContact();
              }}
              variants={ITEM}
            >
              <span>{ctaLabel}</span>
              <span className={styles.ctaArrow} aria-hidden="true">
                <ArrowIcon />
              </span>
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
