import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/router";
import { AnimatePresence, motion } from "framer-motion";
import { NAV_ITEMS, currentNavIndex } from "../nav-items";
import { openSection } from "../section-popup/open";
import styles from "./styles.module.scss";

// Menu pro okna, kde se navigace do hlavičky nevejde (na výšku do 1180px,
// na šířku pod 900px — header/styles). Tmavý list přes celé okno v jazyce
// webu: tečková mřížka plátna, pravítko, a kolem položky, na které právě
// jste, měřicí rámeček s rohovými body a štítkem „Jste tady" (jako
// MeasureText). Najetím rámeček přejede na jinou položku a vrátí se.
//
// Nástup: list se rozvine shora dolů jako roleta, položky vyjedou zpod
// masky jedna po druhé. Odchod je jiný — obsah se rozostří a list se
// stáhne do vodorovné čáry uprostřed (jako vypnutá obrazovka).

const EASE_OUT = [0.22, 1, 0.36, 1] as const;
const EASE_IN = [0.65, 0, 0.35, 1] as const;

const SHEET = {
  hidden: { clipPath: "inset(0% 0% 100% 0%)" },
  shown: {
    clipPath: "inset(0% 0% 0% 0%)",
    transition: { duration: 0.75, ease: EASE_OUT, delayChildren: 0.25, staggerChildren: 0.06 },
  },
  exit: {
    clipPath: "inset(50% 0% 50% 0%)",
    transition: { duration: 0.5, ease: EASE_IN, delay: 0.18 },
  },
} as const;

// Obsah: při odchodu se rozostří a zhasne dřív, než se list stáhne.
const CONTENT = {
  hidden: { opacity: 1, filter: "blur(0px)" },
  shown: { opacity: 1, filter: "blur(0px)" },
  exit: { opacity: 0, filter: "blur(8px)", transition: { duration: 0.22, ease: "easeIn" } },
} as const;

// Položka zpod masky.
const RISE = {
  hidden: { y: "105%" },
  shown: { y: "0%", transition: { duration: 0.8, ease: EASE_OUT } },
  exit: { y: "0%" },
} as const;

const FADE = {
  hidden: { opacity: 0, y: 12 },
  shown: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE_OUT } },
  exit: { opacity: 1 },
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
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
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

function Sheet({ id, onClose, onContact, ctaLabel }: Omit<MenuProps, "open">) {
  const { pathname } = useRouter();
  // Kde návštěvník je — změří se jednou při otevření.
  const [active] = useState(() => currentNavIndex(pathname));
  const [hover, setHover] = useState<number | null>(null);
  const framed = hover ?? (active >= 0 ? active : null);
  const where = active >= 0 ? NAV_ITEMS[active].label : "Úvod";

  return (
    <motion.div
      id={id}
      className={styles.sheet}
      role="dialog"
      aria-modal="true"
      aria-label="Menu"
      variants={SHEET}
      initial="hidden"
      animate="shown"
      exit="exit"
    >
      <motion.div className={styles.content} variants={CONTENT}>
        <div className={styles.top}>
          <motion.p className={styles.eyebrow} variants={FADE}>
            <span className={styles.dot} aria-hidden="true" />
            Menu · {String(NAV_ITEMS.length).padStart(2, "0")}
          </motion.p>
          <motion.button
            type="button"
            className={styles.close}
            onClick={onClose}
            aria-label="Zavřít menu"
            variants={FADE}
          >
            <CloseIcon />
          </motion.button>
        </div>

        {/* Pravítko pod horní lištou — dílky jako na plátně studie. */}
        <motion.span className={styles.ruler} variants={FADE} aria-hidden="true" />

        <nav className={styles.nav} aria-label="Hlavní navigace" onPointerLeave={() => setHover(null)}>
          {NAV_ITEMS.map((item, index) => {
            const isActive = index === active;
            return (
              <a
                key={item.href}
                className={styles.link}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                data-active={isActive || undefined}
                // Sekce úvodní stránky: na ní doscrolluje, jinde otevře okno
                // (layout/section-popup/open.ts).
                data-no-veil={item.popup ? "" : undefined}
                onPointerEnter={() => setHover(index)}
                onFocus={() => setHover(index)}
                onBlur={() => setHover(null)}
                onClick={(event) => {
                  onClose();
                  if (!item.popup) return;
                  event.preventDefault();
                  openSection(item.popup, { fromMenu: true });
                }}
              >
                <span className={styles.linkIndex} aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className={styles.mask}>
                  <motion.span className={styles.linkLabel} variants={RISE}>
                    {item.label}
                    {framed === index ? (
                      <motion.span
                        layoutId="menu-frame"
                        className={styles.frame}
                        transition={{ type: "spring", stiffness: 420, damping: 34 }}
                        aria-hidden="true"
                      >
                        <i />
                        <i />
                        <i />
                        <i />
                        {isActive ? <b>Jste tady</b> : null}
                      </motion.span>
                    ) : null}
                  </motion.span>
                </span>
                <span className={styles.linkArrow} aria-hidden="true">
                  <ArrowIcon />
                </span>
              </a>
            );
          })}
        </nav>

        <motion.div className={styles.bottom} variants={FADE}>
          <p className={styles.where}>
            Jste na <span>{where}</span>
          </p>
          <button
            type="button"
            className={styles.cta}
            onClick={() => {
              onClose();
              onContact();
            }}
          >
            <span>{ctaLabel}</span>
            <span className={styles.ctaArrow} aria-hidden="true">
              <ArrowIcon />
            </span>
          </button>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

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
      {open ? <Sheet key="menu" id={id} onClose={onClose} onContact={onContact} ctaLabel={ctaLabel} /> : null}
    </AnimatePresence>,
    document.body,
  );
}
