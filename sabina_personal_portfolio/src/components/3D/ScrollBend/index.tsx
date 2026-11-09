// ScrollBend — pás karet, který se při pohybu prohne jako čočka (WebGL,
// three.js). Shader a chování jsou v shader.ts, tady jen React: propy,
// předání enginu přes ref, ruční ovládání (ref) a přístupnost.
//
//     <div style={{ height: 640 }}><ScrollBend items={[{ src: "/a.jpg" }]} /></div>
//     <ScrollBend ref={strip} autoScroll={0} autoAdvance={3} />
//     strip.current?.next();   strip.current?.impulse(2400);
//
// Položky můžou být obrázky, nebo nakreslené karty (`canvas` — jako DOM
// karta překreslená do 2D plátna, viz FlexCarousel/hover.ts). Text karet je
// pro čtečky ve skrytém seznamu (`alt`).

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from "react";
import {
  clamp,
  createStrip,
  normalise,
  type Controller,
  type ScrollBendItem,
  type ScrollBendMode,
  type ScrollBendOrientation,
  type Settings,
} from "./shader";
import styles from "./styles.module.scss";

export type { ScrollBendItem, ScrollBendMode, ScrollBendOrientation } from "./shader";

export interface ScrollBendHandle {
  next: () => void;
  previous: () => void;
  goTo: (index: number) => void;
  impulse: (velocity: number) => void;
}

export interface ScrollBendProps {
  items?: (string | ScrollBendItem)[];
  orientation?: ScrollBendOrientation;
  bend?: ScrollBendMode;
  strength?: number;
  maxBend?: number;
  restBend?: number;
  axisBias?: number;
  lensRadius?: number;
  response?: number;
  wobble?: number;
  itemSize?: number;
  aspectRatio?: number;
  gap?: number;
  radius?: number;
  autoScroll?: number;
  /** Co kolik sekund klidu přichytit další kartu (0 = vypnuto). */
  autoAdvance?: number;
  pauseOnHover?: boolean;
  wheelSpeed?: number;
  dragSpeed?: number;
  inertia?: number;
  snap?: boolean;
  infinite?: boolean;
  fade?: number;
  shade?: number;
  aberration?: number;
  paused?: boolean;
  quality?: number;
  onIndexChange?: (index: number) => void;
  className?: string;
  style?: CSSProperties;
  ariaLabel?: string;
}

const subscribeToMotion = (notify: () => void) => {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
};
const readMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const ScrollBend = forwardRef<ScrollBendHandle, ScrollBendProps>(function ScrollBend(
  {
    items = [],
    orientation = "vertical",
    bend = "direction",
    strength = 1,
    maxBend = 0.38,
    restBend = 0,
    axisBias = 0.75,
    lensRadius = 1,
    response = 0.32,
    wobble = 0.25,
    itemSize = 0.68,
    aspectRatio,
    gap = 16,
    radius = 18,
    autoScroll = 50,
    autoAdvance = 0,
    pauseOnHover = false,
    wheelSpeed = 1,
    dragSpeed = 1,
    inertia = 0.55,
    snap = true,
    infinite = true,
    fade = 0.16,
    shade = 0.22,
    aberration = 0.4,
    paused = false,
    quality = 1,
    onIndexChange,
    className,
    style,
    ariaLabel = "Galerie",
  },
  ref,
) {
  const rootRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<Controller | null>(null);
  const indexRef = useRef(onIndexChange);
  const [failed, setFailed] = useState(false);
  const reduced = useSyncExternalStore(subscribeToMotion, readMotion, () => false);
  const list = useMemo(() => normalise(items), [items]);
  const tileAspect = aspectRatio ?? (orientation === "horizontal" ? 0.78 : 1.35);
  const settings: Settings = {
    items: list,
    orientation,
    bend,
    strength,
    maxBend,
    restBend,
    axisBias,
    lensRadius,
    response,
    wobble,
    itemSize,
    aspectRatio: tileAspect,
    gap,
    radius,
    autoScroll,
    autoAdvance,
    pauseOnHover,
    wheelSpeed,
    dragSpeed,
    inertia,
    snap,
    infinite,
    fade,
    shade,
    aberration,
    paused,
    quality,
    reduced,
  };
  const settingsRef = useRef<Settings>(settings);

  // Engine čte nastavení každý snímek — po renderu ho jen přepsat.
  useEffect(() => {
    settingsRef.current = settings;
    indexRef.current = onIndexChange;
    controllerRef.current?.sync();
  });

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const controller = createStrip(root, settingsRef, (index) => indexRef.current?.(index));
    if (!controller) {
      const frame = requestAnimationFrame(() => setFailed(true));
      return () => cancelAnimationFrame(frame);
    }
    controllerRef.current = controller;
    return () => {
      controller.destroy();
      controllerRef.current = null;
    };
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      next: () => controllerRef.current?.next(),
      previous: () => controllerRef.current?.previous(),
      goTo: (index: number) => controllerRef.current?.goTo(index),
      impulse: (velocity: number) => controllerRef.current?.impulse(velocity),
    }),
    [],
  );

  const horizontal = orientation === "horizontal";

  return (
    <div
      ref={rootRef}
      role="region"
      aria-roledescription="carousel"
      aria-label={ariaLabel}
      tabIndex={0}
      className={[styles.root, className].filter(Boolean).join(" ")}
      style={{ touchAction: horizontal ? "pan-y" : "pan-x", WebkitTapHighlightColor: "transparent", ...style }}
    >
      {/* Bez WebGL: obyčejný posuvný seznam (obrázky jako pozadí). */}
      {failed ? (
        <div className={styles.fallback} data-horizontal={horizontal ? "" : undefined} style={{ gap }} aria-hidden="true">
          {list.map((item, index) => (
            <div
              key={`${index}-${item.src}`}
              className={styles.fallbackItem}
              style={{
                width: horizontal ? undefined : `${clamp(itemSize, 0.05, 1) * 100}%`,
                height: horizontal ? `${clamp(itemSize, 0.05, 1) * 100}%` : undefined,
                aspectRatio: String(clamp(tileAspect, 0.2, 5)),
                borderRadius: radius,
                backgroundImage: `url(${JSON.stringify(item.canvas ? item.canvas.toDataURL() : item.src)})`,
              }}
            />
          ))}
        </div>
      ) : null}
      <ul className={styles.hidden}>
        {list.map((item, index) => (
          <li key={`${index}-${item.src}`}>{item.alt ?? `Položka ${index + 1} z ${list.length}`}</li>
        ))}
      </ul>
    </div>
  );
});

ScrollBend.displayName = "ScrollBend";

export { ScrollBend };
export default ScrollBend;
