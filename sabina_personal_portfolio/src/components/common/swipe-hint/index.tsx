// Nápověda pod pásem děl na telefonu (scroll-snap do strany): že jich je víc
// a že se táhne — počítadlo „02 / 14", linka s jezdcem podle posunu a popisek
// s šipkou, která poskakuje, dokud návštěvník poprvé netáhne (27. 11. 2026 —
// přání klientky: „ať vědí, že bannerů je víc"). Jen pro víc než jedno dílo.
import { useEffect, useState, type CSSProperties, type RefObject } from "react";
import styles from "./styles.module.scss";

const pad2 = (n: number) => String(n).padStart(2, "0");

type SwipeHintProps = {
  /** Vodorovně posuvný pás (overflow-x). */
  scroller: RefObject<HTMLElement | null>;
  /** Počet děl v pásu — nápověda jen pro víc než jedno. */
  count: number;
  /** Popisek vedle šipky. */
  label?: string;
  className?: string;
};

export default function SwipeHint({ scroller, count, label = "Táhněte do strany", className }: SwipeHintProps) {
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [moved, setMoved] = useState(false);

  useEffect(() => {
    const el = scroller.current;
    if (!el || count < 2) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const max = el.scrollWidth - el.clientWidth;
      setProgress(max > 0 ? el.scrollLeft / max : 0);
      // Dílo, jehož levá hrana je nejblíž levému okraji výhledu.
      const left = el.getBoundingClientRect().left;
      let best = 0;
      let bestDist = Infinity;
      Array.from(el.children).forEach((child, i) => {
        const dist = Math.abs((child as HTMLElement).getBoundingClientRect().left - left);
        if (dist < bestDist) {
          bestDist = dist;
          best = i;
        }
      });
      // Na konci pásu poslední dílo, i když k levé hraně nedojede.
      setIndex(max > 0 && el.scrollLeft >= max - 2 ? count - 1 : Math.min(best, count - 1));
      if (el.scrollLeft > 8) setMoved(true);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [scroller, count]);

  if (count < 2) return null;
  return (
    <div
      className={className ? `${styles.hint} ${className}` : styles.hint}
      style={{ "--progress": progress, "--thumb": 1 / count } as CSSProperties}
      data-moved={moved || undefined}
      aria-hidden="true"
    >
      <span className={styles.count}>
        <b>{pad2(index + 1)}</b> / {pad2(count)}
      </span>
      <span className={styles.track}>
        <span className={styles.thumb} />
      </span>
      <span className={styles.label}>
        {label}
        <svg viewBox="0 0 24 24" className={styles.arrow}>
          <path d="M5 12h13M13 6.5 18.5 12 13 17.5" />
        </svg>
      </span>
    </div>
  );
}
