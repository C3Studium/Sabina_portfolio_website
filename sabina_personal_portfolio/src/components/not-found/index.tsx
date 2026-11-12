// Stránka 404 — v řeči webu: obří tenké „404" s měřicím rámečkem (jako
// nadpis hera), kolem konstrukce z tvarů (kruh, čtverec, trojúhelník)
// s čárkovanými vodítky, krátká věta a dvě cesty dál.

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import MeasureText from "@/components/common/measure-text";
import { useGate } from "@/motion/LoadProvider";
import styles from "./styles.module.scss";

const EASE = [0.22, 1, 0.36, 1] as const;

function Arrow() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M5 12h13M12 5.5 18.5 12 12 18.5" strokeLinecap="round" strokeLinejoin="round" />
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
  const show = reduce || go;
  const rise = (delay: number) => ({
    initial: reduce ? false : { opacity: 0, y: 24 },
    animate: show ? { opacity: 1, y: 0 } : undefined,
    transition: { duration: 0.9, ease: EASE, delay },
  });
  return (
    <section className={styles.page} aria-labelledby="not-found-title">
      <Construct />
      <div className={styles.inner}>
        <motion.p className={styles.eyebrow} {...rise(0.1)}>
          <span aria-hidden="true" />
          Chyba 404
        </motion.p>
        <motion.div {...rise(0.2)}>
          <MeasureText sweep={show}>
            <h1 id="not-found-title" className={styles.code}>
              <span data-measure="">404</span>
            </h1>
          </MeasureText>
        </motion.div>
        <motion.p className={styles.lead} {...rise(0.35)}>
          Tahle stránka se <strong>ztratila z plátna.</strong>
          <br />
          Možná se přesunula, nebo nikdy neexistovala.
        </motion.p>
        <motion.div className={styles.actions} {...rise(0.5)}>
          <Link href="/" className={styles.primary}>
            <span>Zpět na úvod</span>
            <span className={styles.disc}>
              <Arrow />
            </span>
          </Link>
          <Link href="/projects" className={styles.secondary}>
            Prohlédnout projekty
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
