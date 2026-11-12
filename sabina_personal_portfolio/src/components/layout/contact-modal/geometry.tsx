// Konstrukční kresba na pozadí kontaktního modálu — týž jazyk jako tvary
// v úvodu (motion/intro/banners.ts): čárkovaný kruh s poloměrem, kosočtverec
// s úhlopříčkami, zelený trojúhelník s těžnicemi, kóta s koncovými ryskami
// a body ve vrcholech.
//  - "form": uhlové linky + zelený trojúhelník, za formulářem od pravé hrany,
//  - "dim":  jen sněhové čárkované linky, sotva viditelné v uhlovém sloupci.
// Smyčka: poloměr pomalu obíhá kruh, čárky kóty plují.

import styles from "./geometry.module.scss";

type Variant = "form" | "dim";

const DOTS: [number, number][] = [
  [150, 200],
  [312, 90],
  [412, 196],
  [304, 300],
  [208, 186],
];

export default function Geometry({ variant, className }: { variant: Variant; className?: string }) {
  return (
    <svg
      className={[styles.geo, className].filter(Boolean).join(" ")}
      data-variant={variant}
      viewBox="0 0 600 400"
      fill="none"
      aria-hidden="true"
    >
      {/* Kruh s poloměrem (poloměr obíhá). */}
      <circle className={styles.dashed} cx="150" cy="200" r="100" />
      <g className={styles.hand}>
        <path className={styles.dotted} d="M150 200 L221 129" />
        <circle className={styles.dot} cx="221" cy="129" r="3.2" />
      </g>

      {/* Kosočtverec s úhlopříčkami. */}
      <path className={styles.solid} d="M312 90 L412 196 L304 300 L208 186 Z" />
      <path className={styles.dotted} d="M312 90 L304 300 M208 186 L412 196" />

      {/* Trojúhelník s těžnicemi — jediný zelený tvar. */}
      <path className={styles.accent} d="M500 98 L432 236 L568 236 Z" />
      <path className={styles.dotted} d="M500 98 L500 190 M432 236 L500 190 M568 236 L500 190" />

      {/* Kóta. */}
      <path className={styles.measure} d="M40 330 L570 330" />
      <path className={styles.solid} d="M40 322 V338 M570 322 V338" />

      {DOTS.map(([x, y]) => (
        <circle key={`${x}-${y}`} className={styles.dot} cx={x} cy={y} r="3.2" />
      ))}
      <circle className={styles.accentDot} cx="300" cy="30" r="5" />
    </svg>
  );
}
