// Sekce úvodní stránky jako samostatné okno (popup) s křížkem.
//
// Odkazy v hlavičce Reference / Služby / Spolupráce neskáčou na kotvu,
// ale otevřou celou sekci přes obrazovku — každou s jiným nástupem a
// odchodem:
//   references  CTA s recenzemi — opona zespodu; obsah se postaví svým
//               nástupem (průběh 0 → 1) a při zavření se rozebere pozpátku
//   services    Služby (Info) — panel vyjede zprava a usadí se
//   process     Spolupráce (Proces) — kruhové odhalení ze středu
//
// Info a Proces jsou na stránce přišpendlené a řízené scrollem; v okně
// (`popup`) stojí hotové a jen nastoupí — Proces přejíždí kamerou dolly
// mezi kroky tlačítky 1–5. Lenis stránky po dobu otevření stojí;
// `data-lenis-prevent` mu nedovolí kolečko v okně (užší okno se posouvá).
//
// Obsah ze Studia: na úvodní stránce `content` z pageProps, jinde ho okno
// načte z /api/home-content (do té doby zálohy sekcí z kódu).

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, animate, motion, useMotionValue, type Variants } from "framer-motion";
import Info from "@/components/home/info";
import Process from "@/components/home/process";
import Cta from "@/components/home/cta";
import { InfoStacked, ProcessStacked } from "@/components/home/stacked";
import { useStacked } from "@/lib/fluid";
import type { HomeContent } from "@/lib/site/home-content";
import { RefProvider } from "@/providers/RefContext";
import { SECTION_OPEN_EVENT, type SectionKey } from "./open";
import styles from "./styles.module.scss";

const EASE = [0.22, 1, 0.36, 1] as const;

// Nástup a odchod panelu — pro každou sekci jiný.
const PANELS: Record<SectionKey, Variants> = {
  // Opona zespodu nahoru, odchod opět dolů.
  references: {
    hidden: { clipPath: "inset(100% 0% 0% 0%)" },
    shown: { clipPath: "inset(0% 0% 0% 0%)", transition: { duration: 0.9, ease: EASE } },
    exit: { clipPath: "inset(100% 0% 0% 0%)", transition: { duration: 0.6, ease: [0.65, 0, 0.35, 1] } },
  },
  // Zprava, s lehkým natočením a zmenšením; odchod doleva a zhasne.
  services: {
    hidden: { x: "100%", rotate: 2, scale: 0.96, opacity: 0.6 },
    shown: { x: "0%", rotate: 0, scale: 1, opacity: 1, transition: { duration: 0.85, ease: EASE } },
    exit: { x: "-12%", scale: 0.94, opacity: 0, transition: { duration: 0.5, ease: [0.65, 0, 0.35, 1] } },
  },
  // Kruh ze středu, odchod se zase stáhne do bodu.
  process: {
    hidden: { clipPath: "circle(0% at 50% 50%)" },
    shown: { clipPath: "circle(150% at 50% 50%)", transition: { duration: 1.05, ease: EASE } },
    exit: { clipPath: "circle(0% at 50% 50%)", transition: { duration: 0.6, ease: [0.65, 0, 0.35, 1] } },
  },
};

// Telefon: všechna okna stejně — krátký výjezd zespodu, bez ořezů a natáčení.
const SIMPLE: Variants = {
  hidden: { y: "6%", opacity: 0 },
  shown: { y: "0%", opacity: 1, transition: { duration: 0.35, ease: EASE } },
  exit: { y: "4%", opacity: 0, transition: { duration: 0.25, ease: [0.65, 0, 0.35, 1] } },
};

const LABELS: Record<SectionKey, string> = {
  references: "Reference",
  services: "Služby",
  process: "Spolupráce",
};

// Jak dlouho se CTA postaví (s) a za kolik se při zavření rozebere.
const CTA_BUILD = 3.4;
const CTA_UNBUILD = 1.1;

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
    </svg>
  );
}

// Obsah úvodní stránky pro okna mimo ni (pages/api/home-content.ts) —
// jednou za návštěvu, sdílený všemi okny.
let fetched: Promise<HomeContent | null> | null = null;
const fetchContent = () =>
  (fetched ??= fetch("/api/home-content")
    .then((res) => (res.ok ? (res.json() as Promise<HomeContent>) : null))
    .catch(() => {
      fetched = null;
      return null;
    }));

export default function SectionPopups({ content: pageContent = null }: { content?: HomeContent | null }) {
  const [active, setActive] = useState<SectionKey | null>(null);
  // Na úvodní stránce obsah z pageProps; jinde se načte, než se okno
  // poprvé otevře (chvíli po načtení stránky), a do té doby zálohy.
  const [loaded, setLoaded] = useState<HomeContent | null>(null);
  const content = pageContent ?? loaded;
  useEffect(() => {
    if (pageContent || loaded) return;
    let live = true;
    const timer = window.setTimeout(() => {
      fetchContent().then((data) => {
        if (live && data) setLoaded(data);
      });
    }, active ? 0 : 2000);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [pageContent, loaded, active]);
  const [closing, setClosing] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  // Průběh nástupu CTA — v okně ho neřídí scroll, ale čas.
  const ctaProgress = useMotionValue(0);
  const stacked = useStacked();

  useEffect(() => {
    const open = (event: Event) => {
      const key = (event as CustomEvent<SectionKey>).detail;
      if (!key) return;
      setClosing(false);
      setActive(key);
    };
    window.addEventListener(SECTION_OPEN_EVENT, open);
    return () => window.removeEventListener(SECTION_OPEN_EVENT, open);
  }, []);

  // CTA se po otevření postaví svým nástupem. Telefon bez nástupu: průběh
  // skočí rovnou na konec (CTA reaguje na změnu hodnoty).
  useEffect(() => {
    if (active !== "references") return;
    ctaProgress.set(0);
    if (stacked) {
      ctaProgress.set(1);
      return;
    }
    const controls = animate(ctaProgress, 1, { duration: CTA_BUILD, ease: "linear", delay: 0.45 });
    return () => controls.stop();
  }, [active, ctaProgress, stacked]);

  // Zavření: CTA se nejdřív rozebere pozpátku, Služby odscrollují zpět na
  // začátek stavby (krátce) — pak odejde panel. Telefon rovnou.
  const close = useCallback(() => {
    if (!active || closing) return;
    setClosing(true);
    if (active === "references" && !stacked) {
      animate(ctaProgress, 0, { duration: CTA_UNBUILD, ease: [0.65, 0, 0.35, 1] }).then(() => setActive(null));
      return;
    }
    setActive(null);
  }, [active, closing, ctaProgress, stacked]);

  // Escape zavírá, scroll stránky stojí, fokus na křížek.
  useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    const lenis = window.lenisInstance;
    lenis?.stop();
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    const focus = window.setTimeout(() => closeRef.current?.focus({ preventScroll: true }), 300);
    return () => {
      window.clearTimeout(focus);
      lenis?.start();
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [active, close]);

  let body: ReactNode = null;
  if (stacked && active !== "references") {
    // Telefon: Služby a Proces ve zjednodušené verzi (home/stacked) — bez
    // scén a dolly; okno jen vyjede zespodu. Reference zůstávají plné CTA
    // (rozvržení pro telefon, recenze ve 3D).
    body =
      active === "services" ? (
        <InfoStacked copy={content?.info} stack={content?.stack ?? null} stats={content?.stats ?? null} services={content?.services ?? null} />
      ) : active === "process" ? (
        <ProcessStacked copy={content?.process} steps={content?.steps ?? null} />
      ) : null;
  } else if (active === "references") {
    body = (
      <div className={styles.ctaStage}>
        <Cta
          copy={content?.cta}
          references={content?.references ?? null}
          words={content?.heroWords?.filter((word) => word.place === "cta") ?? null}
          progress={ctaProgress}
          instant={stacked}
        />
      </div>
    );
  } else if (active === "services") {
    body = (
      <Info
        copy={content?.info}
        stack={content?.stack ?? null}
        stats={content?.stats ?? null}
        services={content?.services ?? null}
        popup
      />
    );
  } else if (active === "process") {
    // Na konci dráhy běžné CTA jako na úvodní stránce — zastávka 7.
    body = (
      <Process
        copy={content?.process}
        steps={content?.steps ?? null}
        popup
        cta={(progress, still) => (
          <Cta
            copy={content?.cta}
            references={content?.references ?? null}
            words={content?.heroWords?.filter((word) => word.place === "cta") ?? null}
            progress={progress}
            still={still}
          />
        )}
      />
    );
  }

  return (
    <AnimatePresence>
      {active ? (
        <motion.div
          key={active}
          className={styles.popup}
          data-section={active}
          role="dialog"
          aria-modal="true"
          aria-label={LABELS[active]}
          variants={stacked ? SIMPLE : PANELS[active]}
          initial="hidden"
          animate="shown"
          exit="exit"
        >
          {/* Vlastní scroll okna — Info a Proces na něj napojí useScroll. */}
          <div ref={scrollerRef} className={styles.scroller} data-lenis-prevent="">
            {/* Vlastní registr prvků: sekce v okně se zapisují pod stejnými
                klíči jako na stránce (info-portrait, process-*) — bez
                odděleného registru by kopie v okně přepsala ty na stránce
                a při zavření je smazala. */}
            <RefProvider>{body}</RefProvider>
          </div>
          <span className={styles.label} aria-hidden="true">
            {LABELS[active]}
          </span>
          <button
            ref={closeRef}
            type="button"
            className={styles.close}
            aria-label="Zavřít"
            onClick={close}
          >
            <CloseIcon />
          </button>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
