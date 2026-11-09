// Opona při prvním načtení — úvod webu. Mechaniku dělá engine z knihovny
// (@c3studium/valecms/motion): držení stránky, hodiny, brána, Lenis, Studio,
// tlumený pohyb. Tady je jen to, co je vidět, a časování.
//
// Odhalení je v režimu `none`: po krátkých hodinách je stránka vidět hned a
// úvod se hraje NA NÍ, ne na oponě. Opona je průhledná a kreslí měřicí
// vrstvy (src/motion/intro): stavbu loga, rámeček na nadpisu, stavbu
// hlavičky. Bannery kreslí hero pod nadpisem, ke stejným hodinám. Celé
// časování je v src/motion/intro/timeline.ts.
//
// Hlavička se neukazuje celá až na konci: její prvky naskakují jeden po
// druhém, jak je úvod postaví (`data-intro-in`).
//
// Při omezeném pohybu engine zkrátí hodiny a otevře hned, scéna nekreslí nic.

import { useEffect, useRef } from "react";
import { Preloader as PreloaderEngine } from "@c3studium/valecms/motion";
import type { PreloaderSceneProps } from "@c3studium/valecms/motion";
import { createIntro } from "./intro";
import type { LogoLook } from "./intro/logo";
import { CLOCK, END, GO, real } from "./intro/timeline";

import styles from "./Preloader.module.scss";

/* ---------- Nastavení ---------- */

const LOOK: LogoLook = {
  accent: "#bec948",
  mark: "rgba(255, 255, 255, 0.9)",
  // Okraj rámečku kolem „S".
  pad: 8,
  // Jako rámeček loga při hoveru (MeasureText "brand").
  brandPad: 10,
  specks: 10,
};

/* ---------- Scéna ---------- */

function Scene({ phase, reduced }: PreloaderSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (reduced) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const intro = createIntro(canvas, LOOK);
    return () => intro?.destroy();
  }, [reduced]);

  return (
    <div className={styles.overlay} data-phase={phase}>
      <canvas ref={canvasRef} className={styles.stage} aria-hidden="true" />
    </div>
  );
}

export default function Preloader() {
  // Skutečné sekundy (úvod je zpomalený, viz SLOW v timeline).
  const reveal = real(END) - CLOCK;
  return (
    <PreloaderEngine
      scene={Scene}
      // ms hodin; `groundBefore` = celé hodiny → `ground` hned na začátku,
      // aby „Grafika pro" nastoupila s prvním snímkem stránky.
      duration={CLOCK * 1000}
      stalls={false}
      groundBefore={CLOCK * 1000}
      finalBefore={0}
      // Lineárně: `goAt` se porovnává s průběhem PO křivce — s výchozí
      // (ease-in-out) by brána `go` přišla o skoro vteřinu dřív.
      reveal={{ mode: "none", duration: reveal, ease: [0, 0, 1, 1], goAt: (real(GO) - CLOCK) / reveal }}
      reduced={{ duration: 300, reveal: { duration: 0 } }}
    />
  );
}
