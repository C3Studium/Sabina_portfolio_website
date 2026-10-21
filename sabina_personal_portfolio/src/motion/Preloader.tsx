// Opona při prvním načtení — varianta Default (scéna). Mechaniku dělá engine
// z knihovny: držení stránky od prvního snímku (`data-preload` z `_document`),
// hodiny, Lenis, brána (`ground` → `go`), Studio, tlumený pohyb.
//
// Tady je jen to, co je vidět: nápis a tenký proužek. Odchod je prolnutí
// (`reveal.mode: 'fade'`). Barvy přes --preloader-bg / --preloader-fg.

import { Preloader as PreloaderEngine, useProgressRef } from "@c3studium/valecms/motion";
import type { PreloaderSceneProps } from "@c3studium/valecms/motion";

import styles from "./Preloader.module.scss";

function Scene({ phase, progress }: PreloaderSceneProps) {
  // Zápis mimo render: proužek se mění každý snímek.
  const bar = useProgressRef<HTMLSpanElement>(progress, (el, v) => {
    el.style.transform = `scaleX(${v / 100})`;
  });

  return (
    <div className={styles.overlay} data-phase={phase}>
      <span className={styles.label}>Načítání</span>
      <span className={styles.track}>
        <span className={styles.bar} ref={bar} />
      </span>
    </div>
  );
}

export default function Preloader() {
  // `duration` jsou milisekundy hodin; `stalls: false` = proužek jede plynule.
  return <PreloaderEngine scene={Scene} duration={1600} stalls={false} reveal={{ mode: "fade", duration: 0.6 }} />;
}
