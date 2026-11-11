// OutlineHover — při hoveru se prvek prolne do své obrysové verze.
//
// Obrázky uvnitř prvku se rozloží na canvasu: vnitřní pixely zmizí, zůstane
// jen tečkovaný okraj v původní barvě. Text označený `data-outline` dostane
// tečkovaný obrys v `textColor`. Je to tentýž jazyk jako obrys písmen
// v nadpisu (MeasureText), jen pro logo.
//
// Použití: plátno jako poslední dítě prvku, který má `position: relative`;
// originál prvku se schová přes CSS proměnnou `--outline` (0–1), např.
//
//     .brandMark, .brand [data-outline] { opacity: calc(1 - var(--outline, 0)); }
//
//     <a ref={ref} className={styles.brand}>
//       <img … /> <span data-outline>Sabina</span>
//       <OutlineHover targetRef={ref} />
//     </a>
//
// Jen pro myš; na dotyku se nic nevykreslí.

import { useEffect, useRef, useSyncExternalStore, type RefObject } from "react";
import { animate, motionValue } from "framer-motion";
import { usePerformance } from "@/providers/PerformanceProvider";
import { createOutline, type OutlineSettings } from "./engine";
import styles from "./styles.module.scss";
import { SNOW } from "@/lib/palette";

/* ---------- Nastavení ---------- */

const settings: OutlineSettings & { duration: number } = {
  // Pixel s krytím nad tímhle (0–255) patří k tvaru podpisu.
  threshold: 110,
  // Okraj, který z podpisu zůstane (px).
  edge: 1.2,
  // Okraj plný, ne rozsekaný na tečky ([tečka, mezera] v px by ho tečkoval).
  imageDots: null,
  // Text loga: bílý plný obrys (mezera 0 = plná linka, > 0 = tečky).
  textColor: SNOW,
  textDot: 1,
  textGap: 0,
  // Přesah plátna kolem loga (px), aby obrys na hranách neuřízl.
  bleed: 4,
  // Délka prolnutí do obrysu a zpět (s).
  duration: 0.35,
};

const EASE = [0.22, 1, 0.36, 1] as const;

/* ---------- Prostředí ---------- */

const FINE = "(hover: hover) and (pointer: fine)";
const subscribeFine = (notify: () => void) => {
  const media = window.matchMedia(FINE);
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
};
const readFine = () => window.matchMedia(FINE).matches;
const readFineOnServer = () => false;

/* ---------- Komponenta ---------- */

export default function OutlineHover({ targetRef }: { targetRef: RefObject<HTMLElement | null> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fine = useSyncExternalStore(subscribeFine, readFine, readFineOnServer);
  const { reducedMotion } = usePerformance();

  useEffect(() => {
    const target = targetRef.current;
    const canvas = canvasRef.current;
    if (!fine || !target || !canvas) return;
    const outline = createOutline(target, canvas, settings);
    if (!outline) return;

    // Postup prolnutí jako motion value: plátno i CSS proměnná se píší
    // z jedné hodnoty, takže originál a obrys nikdy neujedou jeden druhému.
    const progress = motionValue(0);
    const stop = progress.on("change", (p) => {
      outline.draw(p);
      target.style.setProperty("--outline", p.toFixed(3));
    });
    let running: ReturnType<typeof animate> | null = null;
    const to = (value: number) => {
      running?.stop();
      running = animate(progress, value, reducedMotion ? { duration: 0 } : { duration: settings.duration, ease: EASE });
    };
    const enter = () => to(1);
    const leave = () => to(0);
    target.addEventListener("pointerenter", enter);
    target.addEventListener("pointerleave", leave);

    return () => {
      running?.stop();
      stop();
      target.removeEventListener("pointerenter", enter);
      target.removeEventListener("pointerleave", leave);
      target.style.removeProperty("--outline");
      outline.destroy();
    };
  }, [fine, reducedMotion, targetRef]);

  return fine ? <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" /> : null;
}
