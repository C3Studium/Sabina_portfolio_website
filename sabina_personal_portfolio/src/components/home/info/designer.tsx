// Info — „grafik před vámi": výběr vrstvy a panel vrstev jako v editoru.
// Kurzor umělé myši je společná komponenta (common/design-cursor).
//
// Polohy a stavy jsou MotionValues, které počítá choreografie ze scrollu
// (choreography.ts) — tady se jen kreslí. Výběr, panel vrstev i letící
// portrét leží ve `position: fixed` v portálu do <body> — přecházejí přes
// hranice sekcí (hero → Info → Proces).

import { useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, type MotionValue } from "framer-motion";
import type { Shortcut } from "./choreography";
import styles from "./styles.module.scss";

const subscribeNothing = () => () => {};
const onClient = () => true;
const onServer = () => false;

function Portal({ children }: { children: ReactNode }) {
  const client = useSyncExternalStore(subscribeNothing, onClient, onServer);
  return client ? createPortal(children, document.body) : null;
}

type SelectionProps = {
  x: MotionValue<number>;
  y: MotionValue<number>;
  width: MotionValue<number>;
  height: MotionValue<number>;
  opacity: MotionValue<number>;
  label: MotionValue<string>;
  /** "select" = výběr s úchyty, "hover" = najetí (čárkovaný rámeček jako
   *  pilulky), "marquee" = výběr tažením (průsvitný obdélník). */
  variant?: "select" | "hover" | "marquee";
};

/** Výběr vrstvy jako v editoru: rámeček, čtvercové úchyty, popisek rozměru. */
export function DesignSelection({ x, y, width, height, opacity, label, variant = "select" }: SelectionProps) {
  return (
    <Portal>
      <motion.div
        className={styles.designSelection}
        data-variant={variant}
        style={{ x, y, width, height, opacity }}
        aria-hidden="true"
      >
        {variant === "select" ? (
          <>
            <span className={styles.designHandle} data-at="tl" />
            <span className={styles.designHandle} data-at="tr" />
            <span className={styles.designHandle} data-at="br" />
            <span className={styles.designHandle} data-at="bl" />
            <motion.span className={styles.designSelectionLabel}>{label}</motion.span>
          </>
        ) : null}
      </motion.div>
    </Portal>
  );
}

export type LayerRow = { id: string; kind: "image" | "text" | "frame" | "pill" | "bar"; name: string };

const ICONS: Record<LayerRow["kind"], string> = {
  image: "◩",
  text: "T",
  frame: "#",
  pill: "◖",
  bar: "▭",
};

/**
 * Panely editoru vlevo nahoře (pevně, portál): vrstvy a pod nimi toast se
 * zkratkou, kterou myš právě použila. Měřítko a průhlednost píše
 * choreografie (měřítko vede, průhlednost následuje — a při odchodu
 * obráceně).
 */
export function ToolPanels({
  rows,
  active,
  shortcut,
  opacity,
  scale,
  x,
  y,
  className,
}: {
  rows: LayerRow[];
  active: string | null;
  shortcut: Shortcut;
  opacity: MotionValue<number>;
  scale: MotionValue<number>;
  /** Posun panelů (px) — Info je na tabletu přesouvá do Procesu. */
  x?: MotionValue<number>;
  y?: MotionValue<number>;
  /** Vlastní poloha pro sekci (Proces má na tabletu panel jinde než Info). */
  className?: string;
}) {
  return (
    <Portal>
      <motion.div
        className={className ? `${styles.toolPanels} ${className}` : styles.toolPanels}
        style={{ opacity, scale, x, y }}
        aria-hidden="true"
      >
        <LayersPanel rows={rows} active={active} />
        <ShortcutToast active={shortcut} />
      </motion.div>
    </Portal>
  );
}

/**
 * Panel vrstev: nové vrstvy přibývají NAHOŘE (jako v editoru), aktivní je
 * zvýrazněná, smazané odjedou. `rows` je pořadí vzniku.
 */
function LayersPanel({ rows, active }: { rows: LayerRow[]; active: string | null }) {
  return (
    <div className={styles.layersPanel}>
      <span className={styles.layersTitle}>Vrstvy</span>
      <ul className={styles.layersList}>
        <AnimatePresence initial={false}>
          {[...rows].reverse().map((row) => (
            <motion.li
              key={row.id}
              layout
              className={styles.layersRow}
              data-active={row.id === active ? "" : undefined}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0, x: -12 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            >
              <span className={styles.layersIcon}>{ICONS[row.kind]}</span>
              <span className={styles.layersName}>{row.name}</span>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </div>
  );
}

/* ---------- Zkratky ---------- */

// Na macOS ⌘, jinde Ctrl. Na serveru a v prvním snímku Ctrl.
const subscribeNothing2 = () => () => {};
const readMac = () => /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent);
const useMac = () => useSyncExternalStore(subscribeNothing2, readMac, () => false);

/**
 * Toast se zkratkou, kterou umělá myš právě používá — vyskočí pod panelem
 * vrstev, když se akce děje (duplikování, mazání, výběr, psaní), a zmizí.
 */
function ShortcutToast({ active }: { active: Shortcut }) {
  const mac = useMac();
  const mod = mac ? "⌘" : "Ctrl";
  const list: Record<Exclude<Shortcut, null>, { label: string; keys: string[] }> = {
    duplicate: { label: "Duplikovat", keys: [mod, "D"] },
    delete: { label: "Smazat", keys: [mac ? "⌫" : "Delete"] },
    select: { label: "Vybrat víc", keys: ["Shift", "tah"] },
    text: { label: "Psát text", keys: ["T"] },
    send: { label: "Odeslat", keys: [mod, "Enter"] },
  };
  const current = active ? list[active] : null;
  return (
    <AnimatePresence>
      {current ? (
        <motion.div
          key={active}
          className={styles.shortcutToast}
          initial={{ opacity: 0, y: -8, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -6, scale: 0.96 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        >
          <span className={styles.shortcutKeys}>
            {current.keys.map((k, i) => (
              <span key={i} className={styles.shortcutKeys}>
                {i > 0 ? <span className={styles.shortcutPlus}>+</span> : null}
                <kbd className={styles.keycap}>{k}</kbd>
              </span>
            ))}
          </span>
          <span className={styles.shortcutLabel}>{current.label}</span>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

/**
 * Portrét, který myš nese z Info na místo portrétu v Procesu — kopie ve
 * `position: fixed`, aby ji neořízla žádná sekce. Polohu a rozměr píše
 * choreografie; originály jsou během letu schované.
 */
export function FlightImage({
  src,
  x,
  y,
  width,
  height,
  opacity,
}: {
  src: string;
  x: MotionValue<number>;
  y: MotionValue<number>;
  width: MotionValue<number>;
  height: MotionValue<number>;
  opacity: MotionValue<number>;
}) {
  return (
    <Portal>
      <motion.img
        src={src}
        alt=""
        className={styles.flightImage}
        style={{ x, y, width, height, opacity }}
        aria-hidden="true"
      />
    </Portal>
  );
}
