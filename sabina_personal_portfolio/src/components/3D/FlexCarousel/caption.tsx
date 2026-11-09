// FlexCarousel — popisek aktivní karty a válcové počítadlo.
//
// Samostatný soubor bez WebGL: popisek se dá vykreslit i MIMO komponentu
// (hero ho má v pravém rohu pod šipkami) a import ho netáhne s enginem.

import type { CSSProperties } from "react";
import type { FlexItem } from "./engine";
import styles from "./styles.module.scss";

// Válec číslic: každá číslice je sloupec 0–9 posunutý o 10 % na číslici.
export const Digits = ({ value }: { value: number }) => (
  <span className={styles.digits}>
    {String(value)
      .padStart(2, "0")
      .split("")
      .map((digit, index) => (
        <span key={index} className={styles.digit}>
          <span className={styles.reel} style={{ transform: `translateY(${-Number(digit) * 10}%)` }}>
            {"0123456789".split("").map((n) => (
              <span key={n}>{n}</span>
            ))}
          </span>
        </span>
      ))}
  </span>
);

type FlexCaptionProps = {
  item: FlexItem | undefined;
  /** Index aktivní položky (od nuly). */
  index: number;
  total: number;
  /** Zarovnání: "center" pod kartou, "end" v rohu. */
  align?: "center" | "end";
  className?: string;
  style?: CSSProperties;
};

// Titulek se při změně karty vymění s náběhem (key = index), počítadlo
// dojede válcem.
export function FlexCaption({ item, index, total, align = "center", className, style }: FlexCaptionProps) {
  if (!item) return null;
  return (
    <div
      className={[styles.cornerCaption, className].filter(Boolean).join(" ")}
      data-align={align}
      style={style}
      aria-hidden="true"
    >
      <span key={index} className={styles.title}>
        {item.title || item.alt}
        {item.subtitle ? <span className={styles.subtitle}>{item.subtitle}</span> : null}
      </span>
      <span className={styles.count}>
        <Digits value={index + 1} />
        <span className={styles.slash}>/</span>
        <span>{String(total).padStart(2, "0")}</span>
      </span>
    </div>
  );
}
