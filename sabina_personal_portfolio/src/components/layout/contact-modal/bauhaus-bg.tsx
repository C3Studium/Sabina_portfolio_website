// Bauhaus pozadí formuláře kontaktního modálu — schválně skromné, hlavní je
// formulář: soustředné oblouky z pravého dolního rohu (za tlačítkem Dál).
// Zelené jsou čárkované a čárky po nich pomalu plují (každý jinam), tenký
// uhlový oblouk stojí. Nic nekříží text. Stojí úplně vzadu (z-index -100)
// a naskočí až nakonec, když je formulář postavený.

import styles from "./bauhaus-bg.module.scss";

// Čtvrtoblouk o poloměru r kolem pravého dolního rohu (1400 800).
const arc = (r: number) => `M${1400 - r} 800 A${r} ${r} 0 0 1 1400 ${800 - r}`;

export default function BauhausBg({ className }: { className?: string }) {
  return (
    <svg
      className={[styles.bg, className].filter(Boolean).join(" ")}
      viewBox="0 0 1400 800"
      preserveAspectRatio="xMaxYMax slice"
      fill="none"
      aria-hidden="true"
    >
      <path className={styles.dashBold} d={arc(330)} pathLength={100} />
      <path className={styles.dashThin} d={arc(250)} pathLength={100} />
      <path className={styles.line} d={arc(410)} pathLength={1} />
    </svg>
  );
}
