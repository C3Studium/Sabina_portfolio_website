// Stránka 404 — v řeči webu:
//   - za číslem se dokola staví a rozplývají ztlumené bannery z projektů
//     (IntroBanners, stejná vrstva jako za portrétem v heru),
//   - obří tenké „404" s měřicím rámečkem (jako nadpis hera),
//   - konstrukce z tvarů (kruh, čtverec, trojúhelník) s vodítky,
//   - štítek s adresou, která neexistuje, a velká tlačítka dál.
// Bez pohybu (reduced motion) bannery nestaví a tvary stojí.

import { useRef, useSyncExternalStore } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import MeasureText from "@/components/common/measure-text";
import IntroBanners from "@/motion/intro/IntroBanners";
import { useGate } from "@/motion/LoadProvider";
import { PORTRAIT_TABLET, useMedia } from "@/lib/fluid";
import styles from "./styles.module.scss";

const EASE = [0.22, 1, 0.36, 1] as const;

// Adresa, kterou návštěvník hledal. 404 je předgenerovaná (server zná jen
// „/404"), proto až v prohlížeči — jinak hydratační chyba.
const subscribeNothing = () => () => {};
const usePathname = () =>
  useSyncExternalStore(
    subscribeNothing,
    () => window.location.pathname,
    () => "",
  );

// Bannery za číslem — jako v pozadí výzvy na úvodní stránce.
const BANNERS = [
  "/assets/banners/vecicky_banner16.png",
  "/assets/banners/vikio_banner8.png",
  "/assets/banners/vlnenezbozi_banner2.png",
  "/assets/banners/gummylife_banner1.png",
  "/assets/banners/samurai_banner1.png",
  "/assets/banners/jordan_banner4.png",
];

const LINKS = [
  { href: "/", label: "Úvod" },
  { href: "/projects", label: "Portfolio" },
  { href: "/about", label: "O mně" },
];

function Arrow() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M5 12h13M12 5.5 18.5 12 12 18.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Grid() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <path d="M4 4h6.5v6.5H4zM13.5 4H20v6.5h-6.5zM4 13.5h6.5V20H4zM13.5 13.5H20V20h-6.5z" strokeLinejoin="round" />
    </svg>
  );
}

/** Konstrukce za číslem: tvary s vodítky, pomalu se hýbou ve smyčce. */
function Construct() {
  return (
    <svg className={styles.construct} viewBox="0 0 900 420" fill="none" aria-hidden="true">
      <path className={styles.guide} d="M0 330H900" />
      <path className={styles.guideFlow} d="M60 352H840" />
      <path className={styles.guide} d="M60 342v20M840 342v20" />
      <g className={styles.spin}>
        <circle className={styles.dash} cx="190" cy="190" r="150" />
        <path className={styles.faint} d="M190 190H340" />
        <circle className={styles.dot} cx="340" cy="190" r="5" />
      </g>
      <g className={styles.sway}>
        <path className={styles.line} d="M470 40 610 180 470 320 330 180Z" />
        <path className={styles.faint} d="M470 40V320M330 180H610" />
      </g>
      <g className={styles.float}>
        <path className={styles.accent} d="M730 70 830 250H630Z" />
        <path className={styles.faint} d="M730 70V250M630 250 780 160M830 250 680 160" />
      </g>
    </svg>
  );
}

export default function NotFound() {
  const reduce = Boolean(useReducedMotion());
  const { go } = useGate();
  const tall = useMedia(PORTRAIT_TABLET);
  const areaRef = useRef<HTMLDivElement>(null);
  const show = reduce || go;
  const path = usePathname().slice(0, 48);
  const rise = (delay: number) => ({
    initial: reduce ? false : { opacity: 0, y: 24 },
    animate: show ? { opacity: 1, y: 0 } : undefined,
    transition: { duration: 0.9, ease: EASE, delay },
  });
  return (
    <section className={styles.page} aria-labelledby="not-found-title">
      {/* Bannery: pole za číslem, kolem kterého se rozmístí. */}
      <div ref={areaRef} className={styles.bannerArea} aria-hidden="true" />
      {!reduce && go ? (
        <IntroBanners
          sources={BANNERS}
          area={areaRef}
          show
          delay={0.4}
          pace={1.8}
          scale={tall ? 1.1 : 1}
          across={tall ? 0.96 : undefined}
          baseline={tall ? 1 : undefined}
          className={styles.banners}
        />
      ) : null}
      <div className={styles.veil} aria-hidden="true" />
      <Construct />

      {/* Rohové značky jako u výřezu na plátně. */}
      <span className={styles.corners} aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </span>

      <div className={styles.inner}>
        <motion.p className={styles.eyebrow} {...rise(0.1)}>
          <span aria-hidden="true" />
          Chyba 404 · stránka nenalezena
        </motion.p>
        <motion.div {...rise(0.2)}>
          <MeasureText sweep={show}>
            <h1 id="not-found-title" className={styles.code}>
              <span data-measure="">404</span>
            </h1>
          </MeasureText>
        </motion.div>
        <motion.p className={styles.path} {...rise(0.3)}>
          <span className={styles.pathLabel}>Adresa</span>
          <code>{path || " "}</code>
          <span className={styles.pathState}>neexistuje</span>
        </motion.p>
        <motion.p className={styles.lead} {...rise(0.4)}>
          Tahle stránka se <strong>ztratila z plátna.</strong>
          <br />
          Možná se přesunula, nebo nikdy neexistovala.
        </motion.p>
        <motion.div className={styles.actions} {...rise(0.55)}>
          <Link href="/" className={styles.primary}>
            <span>Zpět na úvod</span>
            <span className={styles.disc}>
              <Arrow />
            </span>
          </Link>
          <Link href="/projects" className={styles.secondary}>
            <Grid />
            <span>Prohlédnout projekty</span>
          </Link>
        </motion.div>
        <motion.nav className={styles.links} aria-label="Kam dál" {...rise(0.7)}>
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href}>
              {link.label}
            </Link>
          ))}
        </motion.nav>
      </div>
    </section>
  );
}
