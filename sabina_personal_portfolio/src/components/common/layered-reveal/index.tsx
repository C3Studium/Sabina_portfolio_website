// LayeredReveal — obrázek se postaví jako bannery za portrétem v heru:
// vrstvu po vrstvě (motion/intro/layered.ts), zelené linky skici, klidná
// výplň barev, rámečky vrstev se štítky. Tady ale podle `progress`
// (MotionValue 0–1, třeba ze scrollu), ne podle času.
//
//     <LayeredReveal src="/assets/banners/jordan_banner3.png" progress={p}>
//       <Image … />            ← hotový obrázek (object-fit: cover)
//     </LayeredReveal>
//
// Potřebuje rozklad na vrstvy (tools/banner-layers → public/assets/banners/
// layers). Bez něj (nebo bez WebGL2) se obrázek jen prolne.
// Stav stavby hlásí `data-state` na obalu (empty / building / done) —
// např. stín rámečku se tak ukáže až s obrázkem.
// Plátno a WebGL kontext existují jen během stavby — prohlížeč jich
// unese omezeně a obrázků na stránce je víc. Na konci se plátno prolne do
// skutečného obrázku a uvolní se.

import { useEffect, useRef, type ReactNode } from "react";
import type { MotionValue } from "framer-motion";
import { createLayered, loadLayers, type Layered, type LayersData } from "@/motion/intro/layered";
import styles from "./styles.module.scss";
import { ACCENT, SNOW_RGB } from "@/lib/palette";

/* ---------- Nastavení ---------- */

// Barvy stavby — stejné jako u bannerů v heru (IntroBanners).
const LOOK = { accent: ACCENT, mark: `rgba(${SNOW_RGB}, 0.9)` };
// Kde v „životě" banneru (layered.ts) je stavba hotová.
const BUILT = 0.38;
// Poslední část průběhu: plátno se prolne do skutečného obrázku.
const HANDOFF = 0.88;

type Source = { image: HTMLImageElement; map: HTMLImageElement; data: LayersData };

const loadImage = (src: string) =>
  new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });

const clamp01 = (v: number) => Math.min(Math.max(v, 0), 1);

type LayeredRevealProps = {
  /** Banner z public/assets/banners (k němu se hledá rozklad). */
  src: string;
  /** Průběh stavby 0–1 (0 = nic, 1 = hotový obrázek)… */
  progress: MotionValue<number>;
  /** …nebo okno [od, do] v `progress`, ve kterém stavba proběhne. */
  at?: readonly [number, number];
  /** Hotový stav bez stavby (Studio, úzké okno). */
  still?: boolean;
  className?: string;
  children: ReactNode;
};

export default function LayeredReveal({ src, progress, at, still = false, className, children }: LayeredRevealProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Okno jako dvě čísla — pole by efekt restartovalo při každém renderu.
  const [from, to] = at ?? [0, 1];

  useEffect(() => {
    if (still) return;
    let source: Source | null = null;
    let missing = false;
    let loading = false;
    let dead = false;
    let player: Layered | null = null;

    const release = () => {
      player?.destroy();
      player = null;
    };

    const ensure = () => {
      if (loading || source || missing) return;
      loading = true;
      Promise.all([loadLayers(src), loadImage(src)]).then(([found, image]) => {
        if (dead) return;
        if (found && image) source = { image, map: found.map, data: found.data };
        else missing = true;
        apply(progress.get());
      });
    };

    const apply = (raw: number) => {
      const p = clamp01((raw - from) / (to - from));
      const box = boxRef.current;
      const content = contentRef.current;
      const canvas = canvasRef.current;
      if (!box || !content || !canvas) return;
      box.dataset.state = p <= 0 ? "empty" : p >= 1 ? "done" : "building";
      if (p <= 0 || p >= 1) {
        content.style.opacity = p >= 1 ? "1" : "0";
        canvas.style.opacity = "0";
        release();
        return;
      }
      if (!source) {
        // Bez rozkladu jen prolnutí; mezitím se načítá.
        content.style.opacity = missing ? String(p) : "0";
        canvas.style.opacity = "0";
        ensure();
        return;
      }
      if (!player) player = createLayered(source.image, source.map, source.data, LOOK);
      if (!player) {
        missing = true;
        content.style.opacity = String(p);
        return;
      }

      // Plátno v rozměru prvku (rozložení, ne obraz po 3D transformaci).
      const w = box.offsetWidth;
      const h = box.offsetHeight;
      if (!w || !h) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cw = Math.round(w * dpr);
      const ch = Math.round(h * dpr);
      if (canvas.width !== cw || canvas.height !== ch) {
        canvas.width = cw;
        canvas.height = ch;
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      // Jako object-fit: cover — banner vyplní rámeček, přesah se ořízne.
      const aspect = source.data.aspect;
      let iw = w;
      let ih = w / aspect;
      if (ih < h) {
        ih = h;
        iw = h * aspect;
      }
      const u = Math.max(0.0001, clamp01(p / HANDOFF) * BUILT);
      player.draw(ctx, { x: (w - iw) / 2, y: (h - ih) / 2, w: iw, h: ih }, u, dpr, 1);
      const hand = clamp01((p - HANDOFF) / (1 - HANDOFF));
      canvas.style.opacity = String(1 - hand);
      content.style.opacity = String(hand);
    };

    apply(progress.get());
    const off = progress.on("change", apply);
    return () => {
      dead = true;
      off();
      release();
    };
  }, [src, progress, still, from, to]);

  return (
    <div
      ref={boxRef}
      className={[styles.root, className].filter(Boolean).join(" ")}
      data-state={still ? "done" : "empty"}
    >
      <div ref={contentRef} className={styles.content} style={still ? undefined : { opacity: 0 }}>
        {children}
      </div>
      {still ? null : <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />}
    </div>
  );
}
