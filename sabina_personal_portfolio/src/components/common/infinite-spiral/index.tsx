// InfiniteSpiral — nekonečná spirála karet (obrázků) kolem svislé osy.
// Karty se točí po šroubovici: uprostřed největší a ostré, k okrajům menší,
// rozmazané a průhledné. Pohyb: sám od sebe (`auto`), se scrollem stránky
// (`scroll`), tažením (`drag`) nebo vším (`all`).
//
//     <div style={{ height: 600, position: "relative" }}>
//       <InfiniteSpiral items={[{ src: "/a.jpg", alt: "…" }]} animationMode="all" />
//     </div>
//
// Převzaté z InfiniteSpiral. Úpravy pro web:
//   - rozměr rámu z rozložení (offsetWidth/Height), ne z getBoundingClientRect —
//     uvnitř 3D transformací (DollyGallery) by obdélník byl promítnutý
//   - `renderImage` — vlastní obrázek karty (např. next/image s `fill`), ať
//     se velké bannery nestahují v plné velikosti

import { useEffect, useMemo, useRef, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import styles from "./styles.module.scss";

export type SpiralItem =
  | string
  | { src: string; alt?: string; href?: string; target?: string; label?: string; id?: string };

type Item = { src: string; alt: string; href?: string; target?: string; label?: string; id?: string };

export type InfiniteSpiralProps = {
  items?: SpiralItem[];
  /** Rychlost samovolného pohybu (karty za sekundu). */
  speed?: number;
  direction?: "up" | "down";
  animationMode?: "auto" | "scroll" | "drag" | "all";
  radius?: number;
  cardWidth?: number;
  cardHeight?: number;
  verticalSpacing?: number;
  perspective?: number;
  cardsPerTurn?: number;
  rotation?: number;
  cardTilt?: number;
  cardRadius?: number;
  centerScale?: number;
  edgeFade?: number;
  edgeBlur?: number;
  pauseOnHover?: boolean;
  imageFit?: CSSProperties["objectFit"];
  grayscale?: number;
  /** Vlastní obrázek karty (karta je pozicovaná, rozměr má z nastavení). */
  renderImage?: (item: Item, index: number) => ReactNode;
  className?: string;
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const modulo = (value: number, divisor: number) => ((value % divisor) + divisor) % divisor;
const smoothstep = (min: number, max: number, value: number) => {
  const x = clamp((value - min) / (max - min || 1), 0, 1);
  return x * x * (3 - 2 * x);
};

export default function InfiniteSpiral({
  items = [],
  speed = 0.55,
  direction = "up",
  animationMode = "auto",
  radius = 170,
  cardWidth = 100,
  cardHeight = 100,
  verticalSpacing = 60,
  perspective = 1000,
  cardsPerTurn = 7,
  rotation = 0,
  cardTilt = 0,
  cardRadius = 10,
  centerScale = 1.2,
  edgeFade = 0.3,
  edgeBlur = 6,
  pauseOnHover = true,
  imageFit = "cover",
  grayscale = 0,
  renderImage,
  className,
}: InfiniteSpiralProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLElement | null)[]>([]);
  const progressRef = useRef(0);
  const targetProgressRef = useRef(0);
  const autoSpeedRef = useRef(0);
  const hoveredRef = useRef(false);
  const visibleRef = useRef(true);
  const draggingRef = useRef(false);
  const lastPointerYRef = useRef(0);
  const dragMovedRef = useRef(false);

  const normalizedItems = useMemo<Item[]>(
    () =>
      items.map((item, index) =>
        typeof item === "string"
          ? { src: item, alt: `Obrázek spirály ${index + 1}` }
          : { alt: `Obrázek spirály ${index + 1}`, ...item },
      ),
    [items],
  );

  useEffect(() => {
    const root = rootRef.current;
    if (!root || normalizedItems.length === 0) return;

    let frameId = 0;
    let previousTime = performance.now();
    // Rozměr z rozložení — ve 3D transformaci (dolly) by obdélník byl promítnutý.
    let bounds = { width: root.offsetWidth, height: root.offsetHeight };
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const scrollEnabled = animationMode === "scroll" || animationMode === "all";
    const scrollSpeedMultiplier = Math.max(speed, 0) / 0.55;
    let lastScrollY = window.scrollY;

    const resizeObserver = new ResizeObserver(() => {
      bounds = { width: root.offsetWidth, height: root.offsetHeight };
    });
    resizeObserver.observe(root);

    const intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        visibleRef.current = entry.isIntersecting;
      },
      { threshold: 0.02 },
    );
    intersectionObserver.observe(root);

    const handleScroll = () => {
      const nextScrollY = window.scrollY;
      const scrollDelta = nextScrollY - lastScrollY;
      lastScrollY = nextScrollY;
      if (!scrollEnabled || !visibleRef.current || scrollDelta === 0) return;
      targetProgressRef.current += clamp(
        (scrollDelta * scrollSpeedMultiplier) / Math.max(verticalSpacing * 2, 1),
        -1.5,
        1.5,
      );
    };
    window.addEventListener("scroll", handleScroll, { passive: true });

    const render = (time: number) => {
      const delta = Math.min((time - previousTime) / 1000, 0.05);
      previousTime = time;

      const autoEnabled = animationMode === "auto" || animationMode === "all";
      const motionPaused = draggingRef.current || (pauseOnHover && hoveredRef.current);
      const directionMultiplier = direction === "down" ? -1 : 1;
      const desiredAutoSpeed =
        autoEnabled && visibleRef.current && !reducedMotion.matches && !motionPaused ? speed * directionMultiplier : 0;
      const speedBlend = 1 - Math.exp(-delta * 7);
      autoSpeedRef.current += (desiredAutoSpeed - autoSpeedRef.current) * speedBlend;
      targetProgressRef.current += autoSpeedRef.current * delta;

      const followBlend = 1 - Math.exp(-delta * (draggingRef.current ? 22 : 11));
      progressRef.current += (targetProgressRef.current - progressRef.current) * followBlend;

      const count = normalizedItems.length;
      const half = count / 2;
      const width = Math.max(bounds.width, 1);
      const height = Math.max(bounds.height, 1);
      const fit = Math.min(1, width / (cardWidth * 2.8), height / (cardHeight * 2.35));
      const responsiveRadius = Math.min(radius, Math.max(72, width * 0.36)) * fit;
      const fadeStart = clamp(1 - edgeFade, 0, 0.98);
      const turnSize = Math.max(cardsPerTurn, 1);

      cardRefs.current.forEach((card, index) => {
        if (!card) return;
        let offset = index - progressRef.current;
        offset = modulo(offset + half, count) - half;

        const edge = Math.min(Math.abs(offset) / Math.max(half, 1), 1);
        const opacity = 1 - smoothstep(fadeStart, 1, edge);
        const focus = 1 - Math.min(Math.abs(offset) / Math.max(turnSize * 0.65, 1), 1);
        const scale = (1 + (centerScale - 1) * focus) * fit;
        const angle = offset * (360 / turnSize) + rotation;
        const angleRadians = (angle * Math.PI) / 180;
        const x = Math.sin(angleRadians) * responsiveRadius;
        const z = Math.cos(angleRadians) * responsiveRadius;
        const depthScale = clamp(perspective / Math.max(perspective - z, 1), 0.72, 1.45);
        const visualScale = scale * depthScale;
        const depth = (z / Math.max(responsiveRadius, 1) + 1) / 2;
        const blur = edgeBlur * smoothstep(0.35, 1, edge);
        card.style.transform = `translate(-50%, -50%) translate3d(${x}px, ${offset * verticalSpacing * fit}px, 0) rotateZ(${cardTilt}deg) scale(${visualScale})`;
        card.style.opacity = opacity.toFixed(3);
        card.style.filter = blur > 0.01 ? `blur(${blur.toFixed(2)}px)` : "none";
        card.style.zIndex = String(Math.round(depth * 100000) + index);
        card.style.pointerEvents = opacity > 0.25 ? "auto" : "none";
      });

      frameId = requestAnimationFrame(render);
    };

    frameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      window.removeEventListener("scroll", handleScroll);
    };
  }, [
    normalizedItems,
    speed,
    direction,
    animationMode,
    radius,
    perspective,
    cardWidth,
    cardHeight,
    verticalSpacing,
    cardsPerTurn,
    rotation,
    cardTilt,
    centerScale,
    edgeFade,
    edgeBlur,
    pauseOnHover,
  ]);

  const dragEnabled = animationMode === "drag" || animationMode === "all";
  const rootStyle = {
    perspective: `${perspective}px`,
    "--infinite-spiral-card-width": `${cardWidth}px`,
    "--infinite-spiral-card-height": `${cardHeight}px`,
    "--infinite-spiral-card-radius": `${cardRadius}px`,
    cursor: dragEnabled ? "grab" : "default",
    touchAction: dragEnabled ? "pan-x" : "auto",
    userSelect: dragEnabled ? "none" : "auto",
  } as CSSProperties;

  const stopDragging = (event: PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    event.currentTarget.style.cursor = dragEnabled ? "grab" : "default";
  };

  return (
    <div
      ref={rootRef}
      className={[styles.root, className].filter(Boolean).join(" ")}
      style={rootStyle}
      onMouseEnter={() => {
        hoveredRef.current = true;
      }}
      onMouseLeave={() => {
        hoveredRef.current = false;
      }}
      onPointerDown={(event) => {
        if (!dragEnabled || event.button !== 0) return;
        draggingRef.current = true;
        dragMovedRef.current = false;
        lastPointerYRef.current = event.clientY;
        targetProgressRef.current = progressRef.current;
        event.currentTarget.setPointerCapture(event.pointerId);
        event.currentTarget.style.cursor = "grabbing";
      }}
      onPointerMove={(event) => {
        if (!draggingRef.current) return;
        const pointerDelta = event.clientY - lastPointerYRef.current;
        lastPointerYRef.current = event.clientY;
        if (Math.abs(pointerDelta) > 0.5) dragMovedRef.current = true;
        targetProgressRef.current -= pointerDelta / Math.max(verticalSpacing, 1);
      }}
      onPointerUp={stopDragging}
      onPointerCancel={stopDragging}
      onClickCapture={(event) => {
        if (!dragMovedRef.current) return;
        event.preventDefault();
        event.stopPropagation();
        dragMovedRef.current = false;
      }}
    >
      <div className={styles.stage} role="list" aria-label="Galerie ve spirále">
        {normalizedItems.map((item, index) => {
          const ref = (node: HTMLElement | null) => {
            cardRefs.current[index] = node;
          };
          const style = { width: cardWidth, height: cardHeight, borderRadius: cardRadius };
          const image = renderImage ? (
            renderImage(item, index)
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- obecná komponenta, zdroj dodá volající
            <img
              className={styles.image}
              src={item.src}
              alt={item.alt}
              loading={index < 6 ? "eager" : "lazy"}
              draggable={false}
              style={{
                width: cardWidth,
                height: cardHeight,
                maxWidth: "none",
                maxHeight: "none",
                objectFit: imageFit,
                filter: `grayscale(${clamp(grayscale, 0, 1)})`,
              }}
            />
          );
          return item.href ? (
            <a
              key={item.id ?? `${item.src}-${index}`}
              ref={ref}
              className={styles.item}
              style={style}
              href={item.href}
              target={item.target}
              rel={item.target === "_blank" ? "noreferrer" : undefined}
              role="listitem"
              aria-label={item.label ?? item.alt}
            >
              {image}
            </a>
          ) : (
            <div
              key={item.id ?? `${item.src}-${index}`}
              ref={ref}
              className={styles.item}
              style={style}
              role="listitem"
              aria-label={item.label ?? item.alt}
            >
              {image}
            </div>
          );
        })}
      </div>
    </div>
  );
}
