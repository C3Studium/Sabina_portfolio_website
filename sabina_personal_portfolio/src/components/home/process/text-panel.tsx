// Panel Text (pevně, u obrázku kroku 04 — polohu píše designer.ts) — jako
// panel vlastností v Figmě, když je vybraná textová vrstva. Otevře se v kroku 04, když myš klikne na
// nadpis ve vizuálu; myš pak klikne do velikosti písma a přepíše ji
// (TypeText: číslo se označí, smaže a napíše nové). Měřítko a průhlednost
// píše designer.ts (měřítko vede, průhlednost následuje — jako Vrstvy).

import { useSyncExternalStore, type ReactNode, type Ref } from "react";
import { createPortal } from "react-dom";
import { motion, type MotionValue } from "framer-motion";
import TypeText from "@/components/common/type-text";
import styles from "./styles.module.scss";

const subscribeNothing = () => () => {};

function Portal({ children }: { children: ReactNode }) {
  const client = useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false,
  );
  return client ? createPortal(children, document.body) : null;
}

export function TextPanel({
  opacity,
  scale,
  x,
  y,
  font,
  weight,
  size,
  focused,
  typed,
  sizeRef,
  onTyped,
}: {
  opacity: MotionValue<number>;
  scale: MotionValue<number>;
  /** Poloha levého horního rohu v okně (px) — u obrázku, píše designer.ts. */
  x: MotionValue<number>;
  y: MotionValue<number>;
  font: string;
  weight: string;
  /** Velikost písma před a po přepsání. */
  size: { from: string; to: string };
  /** Pole velikosti je aktivní (myš do něj klikla). */
  focused: boolean;
  /** Nové číslo se píše. */
  typed: boolean;
  sizeRef?: Ref<HTMLSpanElement>;
  /** Číslo je dopsané (myš pak přestane čekat). */
  onTyped?: () => void;
}) {
  return (
    <Portal>
      <motion.div className={styles.textPanel} style={{ opacity, scale, x, y }} aria-hidden="true" data-text-panel="">
        <span className={styles.textPanelTitle}>Text</span>
        <span className={styles.textPanelField} data-wide="">
          {font}
          <span className={styles.textPanelCaret}>▾</span>
        </span>
        <div className={styles.textPanelRow}>
          <span className={styles.textPanelField}>
            {weight}
            <span className={styles.textPanelCaret}>▾</span>
          </span>
          <span ref={sizeRef} className={styles.textPanelField} data-active={focused ? "" : undefined}>
            <TypeText segments={[{ text: size.to }]} placeholder={size.from} play={typed} typeSpeed={90} onDone={onTyped} />
            <span className={styles.textPanelCaret}>▾</span>
          </span>
        </div>
        <div className={styles.textPanelRow}>
          <span className={styles.textPanelField}>
            <span className={styles.textPanelLabel}>Řádkování</span> 110 %
          </span>
          <span className={styles.textPanelField}>
            <span className={styles.textPanelLabel}>Prostrkání</span> 0 %
          </span>
        </div>
      </motion.div>
    </Portal>
  );
}
