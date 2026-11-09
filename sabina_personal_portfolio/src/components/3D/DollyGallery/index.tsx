// DollyGallery — „dolly" kamera: dlaždice stojí v hloubce za sebou, střídavě
// vlevo a vpravo, a kamera jimi projíždí. Nejbližší se zvětší, proletí kolem
// a zhasne, další se vynoří z dálky. Čisté CSS 3D (perspective +
// translate3d), žádné WebGL.
//
// Převzaté z DollyGallery (obrázky, kolečko, tažení, klávesy, autoScroll).
// Úpravy pro web:
//   `items`  — místo obrázků libovolný obsah (celé sekce jako dlaždice)
//   `fit`    — velikost dlaždice jako podíl rámu galerie ({ width, height })
//   `offset` — poloha kamery zvenku (MotionValue v dlaždicích: 0 = první
//              u kamery, 1 = druhá…), např. ze scrollu stránky. Kolečko,
//              tažení, klávesy a autoScroll jsou pak vypnuté — galerie
//              nesmí brát scroll stránce.
//   `onFrame` — každý vykreslený snímek: kde stojí všechny dlaždice (i ty
//              schované). Podle toho kreslí DollyLine křivku v prostoru.
//   `tiles`   — volby jednotlivých dlaždic: vlastní velikost (`fit`)
//              a poloha (`x`, `y` — podíl velikosti dlaždice, 0 = střed)
//              místo střídání do stran. Např. poslední dlaždice přes celý
//              rám uprostřed = „portál", který se přiblíží a vyplní obraz.
//
// Každá dlaždice dostává CSS proměnné pro vlastní animace obsahu:
//   --dolly-t      vzdálenost od kamery v rozestupech (1 = o krok dál,
//                  0 = u kamery, záporná = proletěla kolem)
//   --dolly-scale  měřítko z perspektivy (1 u kamery, menší v dálce) —
//                  např. `border-width: calc(1px / var(--dolly-scale))`
//                  drží na obrazovce stejnou tloušťku rámečku.
//
//     <DollyGallery images={["/a.jpg", "/b.jpg"]} />
//     <DollyGallery items={sections} offset={scrollOffset} infinite={false}
//                   fit={{ width: 0.66, height: 1 }} parallaxX={0} parallaxY={0} />

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import type { MotionValue } from "framer-motion";
import styles from "./styles.module.scss";

export interface DollyGalleryImage {
  src: string;
  alt?: string;
}

/** Dlaždice v jednom snímku, v souřadnicích rámu galerie: x/y = posun
 *  středu dlaždice od středu rámu (px), depth = vzdálenost před kamerou
 *  (px, záporná = proletěla kolem). Promítnutí jako v CSS:
 *  měřítko = perspective / (perspective + depth). */
export type DollyTile = { index: number; x: number; y: number; depth: number; alpha: number };

export type DollyFrame = {
  width: number;
  height: number;
  perspective: number;
  /** Rozestup dlaždic do hloubky (px). */
  step: number;
  tileWidth: number;
  tileHeight: number;
  tiles: DollyTile[];
};

/** Volby jedné dlaždice (podle pořadí v `items` / `images`). */
export type DollyTileOptions = {
  /** Vlastní velikost — podíl rámu galerie. */
  fit?: { width: number; height: number };
  /** Pevná poloha místo střídání do stran (podíl velikosti dlaždice). */
  x?: number;
  y?: number;
};

export interface DollyGalleryProps {
  images?: (string | DollyGalleryImage)[];
  /** Vlastní obsah dlaždic (má přednost před `images`). */
  items?: ReactNode[];
  /** Nekonečná smyčka. S `items` se obsah ve smyčce kopíruje — u sekcí
   *  s refy proto `false`. */
  infinite?: boolean;
  itemWidth?: number;
  aspectRatio?: number;
  /** Velikost dlaždice jako podíl rámu (přebije itemWidth / aspectRatio). */
  fit?: { width: number; height: number };
  /** Volby jednotlivých dlaždic (velikost, pevná poloha). */
  tiles?: (DollyTileOptions | undefined)[];
  borderRadius?: number;
  grayscale?: number;
  perspective?: number;
  /** Rozestup dlaždic do hloubky (px). */
  spacing?: number;
  /** Jak daleko do stran se dlaždice střídají (podíl šířky dlaždice). */
  spread?: number;
  /** Náhodný posun nahoru/dolů (podíl výšky dlaždice). */
  scatter?: number;
  /** Kolik dlaždic dopředu je vidět (a jak zhasínají do dálky). */
  revealRange?: number;
  /** Jak rychle zhasne dlaždice, která proletěla kolem kamery. */
  passRange?: number;
  parallaxX?: number;
  parallaxY?: number;
  parallaxSmooth?: number;
  tilt?: number;
  pulse?: number;
  drift?: number;
  smooth?: number;
  wheelSpeed?: number;
  dragSpeed?: number;
  autoScroll?: number;
  pauseOnHover?: boolean;
  backgroundColor?: string;
  /** Poloha kamery zvenku, v dlaždicích (0 = první). Vypne vlastní ovládání. */
  offset?: MotionValue<number>;
  onIndexChange?: (index: number) => void;
  /** Každý vykreslený snímek (polohy všech dlaždic) — pro vrstvy navíc. */
  onFrame?: (frame: DollyFrame) => void;
  className?: string;
  tileClassName?: string;
  /** Popisek oblasti pro čtečky. */
  label?: string;
  children?: ReactNode;
}

const DEFAULT_IMAGES = [
  "https://images.unsplash.com/photo-1518837695005-2083093ee35b?q=80&w=900&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1470770841072-f978cf4d019e?q=80&w=900&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1501785888041-af3ef285b470?q=80&w=900&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1472214103451-9374bd1c798e?q=80&w=900&auto=format&fit=crop",
];

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));
const wrap = (value: number, span: number) => ((value % span) + span) % span;
// Stabilní „náhoda" podle pořadí dlaždice — rozmístění je při každém
// vykreslení stejné.
const jitter = (k: number, salt: number) => {
  const x = Math.sin(k * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
};
const normalise = (image: string | DollyGalleryImage): DollyGalleryImage =>
  typeof image === "string" ? { src: image } : image;

const motionQuery = "(prefers-reduced-motion: reduce)";
const subscribeMotion = (notify: () => void) => {
  const query = window.matchMedia(motionQuery);
  query.addEventListener("change", notify);
  return () => query.removeEventListener("change", notify);
};
const readMotion = () => window.matchMedia(motionQuery).matches;

type Drag = { y: number; at: number };
type Entry = { image: DollyGalleryImage | null; node: ReactNode; index: number };

export function DollyGallery({
  images = DEFAULT_IMAGES,
  items,
  infinite = true,
  itemWidth = 340,
  aspectRatio = 4 / 5,
  fit,
  tiles: tileOptions,
  borderRadius = 7,
  grayscale = 1,
  perspective = 1000,
  spacing = 800,
  spread = 0.8,
  scatter = 0.1,
  revealRange = 1.5,
  passRange = 1,
  parallaxX = 0.12,
  parallaxY = 0.06,
  parallaxSmooth = 0.85,
  tilt = 4,
  pulse = 0.03,
  drift = 0.08,
  smooth = 0.85,
  wheelSpeed = 1,
  dragSpeed = 1.5,
  autoScroll = 0,
  pauseOnHover = true,
  backgroundColor = "transparent",
  offset,
  onIndexChange,
  onFrame,
  className,
  tileClassName,
  label = "Galerie",
  children,
}: DollyGalleryProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const slots = useRef<HTMLDivElement[]>([]);
  const target = useRef(0);
  const shown = useRef(0);
  const speed = useRef(0);
  const sway = useRef(0);
  const frame = useRef(0);
  const live = useRef(false);
  const stamp = useRef(0);
  const hovering = useRef(false);
  const visible = useRef(true);
  const dragging = useRef<Drag | null>(null);
  const flick = useRef(0);
  const aim = useRef({ x: 0, y: 0 });
  const eased = useRef({ x: 0, y: 0 });
  const lastIndex = useRef(-1);
  const indexChange = useRef(onIndexChange);
  const frameChange = useRef(onFrame);
  useEffect(() => {
    indexChange.current = onIndexChange;
    frameChange.current = onFrame;
  }, [onIndexChange, onFrame]);

  const [box, setBox] = useState({ width: 0, height: 0 });
  const reduced = useSyncExternalStore(subscribeMotion, readMotion, () => false);
  // Řízená zvenku (scroll) = žádné vlastní ovládání.
  const driven = Boolean(offset);
  const auto = driven ? 0 : autoScroll;

  const list = useMemo<Entry[]>(
    () =>
      items
        ? items.map((node, index) => ({ image: null, node, index }))
        : images.map((image, index) => ({ image: normalise(image), node: null, index })),
    [items, images],
  );

  const tileWidth = fit
    ? Math.max(40, box.width * fit.width)
    : Math.max(40, Math.min(itemWidth, box.width - 32));
  const tileHeight = fit ? Math.max(40, box.height * fit.height) : tileWidth / Math.max(0.1, aspectRatio);
  const step = Math.max(40, spacing);
  // Rozměr dlaždice: vlastní `fit` z voleb, jinak společný.
  const sizeOf = useCallback(
    (index: number) => {
      const own = tileOptions?.[index]?.fit;
      return own
        ? { width: Math.max(40, box.width * own.width), height: Math.max(40, box.height * own.height) }
        : { width: tileWidth, height: tileHeight };
    },
    [tileOptions, box.width, box.height, tileWidth, tileHeight],
  );

  // Smyčka: tolik kopií, aby v dohledu nikdy nechyběla dlaždice.
  const ring = useMemo(() => {
    if (!list.length) return [];
    if (!infinite) return list;
    const needed = Math.ceil(revealRange + passRange) + 2;
    const copies = Math.max(1, Math.ceil((needed + 1) / list.length));
    const out: Entry[] = [];
    for (let c = 0; c < copies; c++) out.push(...list);
    return out;
  }, [list, infinite, revealRange, passRange]);

  const cycle = ring.length * step;
  const reach = Math.max(0, (list.length - 1) * step);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const watch = new ResizeObserver(() => setBox({ width: root.clientWidth, height: root.clientHeight }));
    watch.observe(root);
    return () => watch.disconnect();
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof IntersectionObserver === "undefined") return;
    const watch = new IntersectionObserver(([entry]) => {
      visible.current = entry.isIntersecting;
    });
    watch.observe(root);
    return () => watch.disconnect();
  }, []);

  // Jeden snímek: každá dlaždice dostane polohu v hloubce, průhlednost
  // (zhasíná do dálky i za kamerou) a jemné naklonění při rychlém pohybu.
  const paint = useCallback(
    (at: number) => {
      if (!box.height || !ring.length) return;
      const half = cycle / 2;
      const rush = clamp(Math.abs(speed.current) / 2500, 0, 1);
      const px = eased.current.x;
      const py = eased.current.y;
      let nearest = -1;
      let nearestGap = Infinity;
      const tiles: DollyTile[] = [];
      for (let k = 0; k < ring.length; k++) {
        const slot = slots.current[k];
        const raw = k * step - at;
        const depth = infinite ? wrap(raw + half, cycle) - half : raw;
        const t = depth / step;
        const alpha =
          t >= 0
            ? 1 - clamp(t / Math.max(0.01, revealRange), 0, 1)
            : 1 - clamp(-t / Math.max(0.01, passRange), 0, 1);
        const own = tileOptions?.[ring[k].index];
        const size = sizeOf(ring[k].index);
        const side = k % 2 === 0 ? -1 : 1;
        const baseX =
          own?.x !== undefined ? own.x * size.width : side * spread * (0.7 + 0.3 * jitter(k, 1)) * tileWidth;
        const baseY =
          own?.y !== undefined ? own.y * size.height : (jitter(k, 2) * 2 - 1) * scatter * tileHeight;
        const x = baseX + px * parallaxX * tileWidth * alpha;
        const y = baseY + py * parallaxY * tileHeight * alpha + sway.current * drift * tileHeight;
        tiles.push({ index: ring[k].index, x, y, depth, alpha });
        if (!slot) continue;
        // Proměnné pro animace obsahu dlaždice (viz hlavička souboru).
        slot.style.setProperty("--dolly-t", t.toFixed(4));
        slot.style.setProperty("--dolly-scale", (perspective / Math.max(perspective + depth, 1)).toFixed(4));
        if (alpha <= 0.002 || -depth >= perspective * 0.95) {
          // I průhlednost: potomek s vlastním `visibility: visible` (blikající
          // kurzor psaní) by jinak prosvítal ze schované dlaždice.
          slot.style.visibility = "hidden";
          slot.style.opacity = "0";
          continue;
        }
        slot.style.visibility = "visible";
        const gap = Math.abs(depth);
        if (gap < nearestGap) {
          nearestGap = gap;
          nearest = ring[k].index;
        }
        const swell = 1 + pulse * rush * alpha;
        const rx = -py * tilt * rush * alpha;
        const ry = px * tilt * rush * alpha;
        slot.style.opacity = alpha.toFixed(3);
        slot.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, ${(-depth).toFixed(1)}px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) scale(${swell.toFixed(4)})`;
        // Bližší dlaždice nad vzdálenějšími (i když proletěla kolem).
        slot.style.zIndex = String(Math.round(10000 - depth));
        // Klikat jde jen na dlaždici u kamery.
        slot.style.pointerEvents = alpha > 0.9 ? "auto" : "none";
      }
      if (nearest >= 0 && nearest !== lastIndex.current) {
        lastIndex.current = nearest;
        indexChange.current?.(nearest);
      }
      frameChange.current?.({
        width: box.width,
        height: box.height,
        perspective,
        step,
        tileWidth,
        tileHeight,
        tiles,
      });
    },
    [
      box.width,
      box.height,
      ring,
      cycle,
      step,
      infinite,
      revealRange,
      passRange,
      perspective,
      spread,
      scatter,
      tileWidth,
      tileHeight,
      parallaxX,
      parallaxY,
      drift,
      pulse,
      tilt,
      tileOptions,
      sizeOf,
    ],
  );

  const settle = useCallback((value: number) => (infinite ? value : clamp(value, 0, reach)), [infinite, reach]);

  // Smyčka běží, jen dokud se něco hýbe — v klidu se zastaví.
  const wake = useCallback(() => {
    if (live.current) return;
    live.current = true;
    stamp.current = 0;
    const tick = (now: number) => {
      const dt = stamp.current ? Math.min(0.05, (now - stamp.current) / 1000) : 1 / 60;
      stamp.current = now;
      const drifting = auto !== 0 && visible.current && !(pauseOnHover && hovering.current) && !dragging.current;
      if (drifting) target.current = settle(target.current + auto * dt);
      if (Math.abs(flick.current) > 1) {
        target.current = settle(target.current + flick.current * dt);
        flick.current *= Math.pow(0.02, dt);
      } else {
        flick.current = 0;
      }
      const rate = 1.5 + (1 - clamp(smooth, 0, 1)) * 30;
      const ease = reduced ? 1 : 1 - Math.exp(-dt * rate);
      const next = shown.current + (target.current - shown.current) * ease;
      const moved = next - shown.current;
      shown.current = next;
      const velocity = reduced ? 0 : moved / dt;
      const blend = 1 - Math.exp(-dt * 8);
      speed.current += (velocity - speed.current) * blend;
      sway.current += (clamp(-velocity / 2500, -1, 1) - sway.current) * blend * 0.6;
      const pointerRate = 2 + (1 - clamp(parallaxSmooth, 0, 1)) * 40;
      const pointerEase = reduced ? 1 : 1 - Math.exp(-dt * pointerRate);
      eased.current.x += (aim.current.x - eased.current.x) * pointerEase;
      eased.current.y += (aim.current.y - eased.current.y) * pointerEase;
      paint(shown.current);
      const restless =
        Math.abs(target.current - shown.current) > 0.05 ||
        Math.abs(speed.current) > 1 ||
        Math.abs(sway.current) > 0.001 ||
        Math.abs(aim.current.x - eased.current.x) > 0.001 ||
        Math.abs(aim.current.y - eased.current.y) > 0.001;
      if (restless || drifting || flick.current !== 0) {
        frame.current = requestAnimationFrame(tick);
      } else {
        shown.current = target.current;
        speed.current = 0;
        sway.current = 0;
        paint(shown.current);
        live.current = false;
      }
    };
    frame.current = requestAnimationFrame(tick);
  }, [auto, pauseOnHover, settle, reduced, smooth, parallaxSmooth, paint]);

  useEffect(() => {
    target.current = settle(target.current);
    shown.current = settle(shown.current);
    paint(shown.current);
    wake();
    return () => {
      cancelAnimationFrame(frame.current);
      live.current = false;
    };
  }, [paint, settle, wake]);

  // Poloha zvenku (scroll): cíl kamery v px. Při prvním čtení skokem, ať
  // galerie po načtení uprostřed stránky nepřijíždí od začátku.
  useEffect(() => {
    if (!offset) return;
    const apply = (value: number, jump: boolean) => {
      target.current = settle(value * step);
      if (jump) shown.current = target.current;
      wake();
    };
    apply(offset.get(), true);
    return offset.on("change", (value) => apply(value, false));
  }, [offset, step, settle, wake]);

  // Kolečko (jen bez `offset`).
  useEffect(() => {
    const root = rootRef.current;
    if (!root || driven) return;
    const onWheel = (event: WheelEvent) => {
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? box.height : 1;
      const before = target.current;
      target.current = settle(before + event.deltaY * unit * wheelSpeed);
      if (!infinite && target.current === before) return;
      event.preventDefault();
      flick.current = 0;
      wake();
    };
    root.addEventListener("wheel", onWheel, { passive: false });
    return () => root.removeEventListener("wheel", onWheel);
  }, [box.height, wheelSpeed, settle, infinite, wake, driven]);

  const track = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    aim.current.x = clamp(((event.clientX - rect.left) / rect.width) * 2 - 1, -1, 1);
    aim.current.y = clamp(((event.clientY - rect.top) / rect.height) * 2 - 1, -1, 1);
  };
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (driven || event.button !== 0) return;
    dragging.current = { y: event.clientY, at: performance.now() };
    flick.current = 0;
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    // Bez paralaxy nemá pohyb myši co měnit — smyčka zůstane stát.
    if (!parallaxX && !parallaxY && !tilt && !dragging.current) return;
    track(event);
    const drag = dragging.current;
    if (!drag) {
      wake();
      return;
    }
    const dy = event.clientY - drag.y;
    const now = performance.now();
    const dt = Math.max(1, now - drag.at) / 1000;
    drag.y = event.clientY;
    drag.at = now;
    target.current = settle(target.current - dy * dragSpeed);
    flick.current = (-dy * dragSpeed) / dt;
    wake();
  };
  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    dragging.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    flick.current = clamp(flick.current, -4000, 4000);
    wake();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (driven) return;
    const jumps: Record<string, number> = {
      ArrowDown: step,
      ArrowUp: -step,
      ArrowRight: step,
      ArrowLeft: -step,
      PageDown: step,
      PageUp: -step,
      " ": step,
    };
    const jump = jumps[event.key];
    if (jump === undefined) return;
    event.preventDefault();
    target.current = settle(target.current + jump);
    wake();
  };

  const tileStyle = (index: number): CSSProperties => {
    const size = sizeOf(index);
    return {
      width: size.width,
      height: size.height,
      left: "50%",
      top: "50%",
      marginLeft: -size.width / 2,
      marginTop: -size.height / 2,
      borderRadius: items ? undefined : borderRadius,
    };
  };

  return (
    <div
      ref={rootRef}
      role="region"
      aria-roledescription="carousel"
      aria-label={label}
      tabIndex={driven ? undefined : 0}
      className={[styles.root, className].filter(Boolean).join(" ")}
      data-interactive={driven ? undefined : ""}
      style={{ backgroundColor }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerEnter={() => {
        hovering.current = true;
      }}
      onPointerLeave={() => {
        hovering.current = false;
        aim.current.x = 0;
        aim.current.y = 0;
        wake();
      }}
      onKeyDown={onKeyDown}
    >
      <div className={styles.stage} style={{ perspective: `${perspective}px` }}>
        {ring.map(({ image, node, index }, k) => (
          <div
            key={k}
            ref={(el) => {
              if (el) slots.current[k] = el;
              else delete slots.current[k];
            }}
            className={[styles.tile, image ? styles.imageTile : null, tileClassName].filter(Boolean).join(" ")}
            style={tileStyle(index)}
            aria-hidden={k >= list.length ? true : undefined}
          >
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element -- dlaždice z cizích zdrojů, velikost řídí engine
              <img
                src={image.src}
                alt={image.alt ?? `Obrázek ${index + 1}`}
                draggable={false}
                loading="lazy"
                style={{ filter: grayscale > 0 ? `grayscale(${clamp(grayscale, 0, 1)})` : undefined }}
                className={styles.image}
              />
            ) : (
              node
            )}
          </div>
        ))}
      </div>
      {children ? <div className={styles.content}>{children}</div> : null}
    </div>
  );
}

export default DollyGallery;
