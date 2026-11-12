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
//
// Úvod je JEN na úvodní stránce. Kdo přijde rovnou na jinou stránku, dostane
// totéž co při přechodu mezi stránkami: stránka se jen prolne (žádná opona).
// Engine běží i tam — sundá `data-preload`, pod kterým je stránka schovaná
// od prvního snímku (_document), a pustí bránu.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { isScenePage } from "@/lib/scene-pages";
import { Preloader as PreloaderEngine } from "@c3studium/valecms/motion";
import type { PreloaderSceneProps } from "@c3studium/valecms/motion";
import { createIntro } from "./intro";
import type { LogoLook } from "./intro/logo";
import { CLOCK, END, GO, real } from "./intro/timeline";

import styles from "./Preloader.module.scss";
import { ACCENT, SNOW_RGB } from "@/lib/palette";

/* ---------- Nastavení ---------- */

const LOOK: LogoLook = {
  accent: ACCENT,
  mark: `rgba(${SNOW_RGB}, 0.9)`,
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

// Stránka se scénou (lib/scene-pages) úvod nemá: prázdná opona, která hned
// zmizí. Engine pořád musí běžet — sundá `data-preload`, pod kterým je
// stránka i hlavička schovaná od prvního snímku (_document).
function Blank() {
  return null;
}

export default function Preloader() {
  const router = useRouter();
  // Stránka prvního načtení — engine běží jednou, další navigace řeší závoj.
  const [first] = useState(() => router.pathname);
  if (isScenePage(first)) {
    return (
      <PreloaderEngine
        scene={Blank}
        duration={1}
        stalls={false}
        groundBefore={1}
        finalBefore={0}
        reveal={{ mode: "none", duration: 0 }}
        reduced={{ duration: 1, reveal: { duration: 0 } }}
      />
    );
  }
  // Jiná než úvodní stránka: jen prolnutí jako při přechodu (PageTransition).
  if (first !== "/") {
    return (
      <PreloaderEngine
        scene={Blank}
        duration={1}
        stalls={false}
        groundBefore={1}
        finalBefore={0}
        reveal={{ mode: "fade", duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
        reduced={{ duration: 1, reveal: { duration: 0.2 } }}
      />
    );
  }
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
