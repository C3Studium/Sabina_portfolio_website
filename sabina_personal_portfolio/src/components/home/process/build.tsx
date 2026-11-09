// Proces — stavba vrstev kroků ze stejných kousků jako Info (info/reveal.tsx):
//
//   Block  — blok jako banner: ořezové značky, rámeček s rozměrem a štítkem,
//            mřížka třetin, obsah se měkce prolne shora (useBlockBuild)
//   Drawn  — rámeček nakreslený myší (DrawFrame), pak se obsah prolne shora
//   DupImage — duplikát obrázku (Ctrl/⌘ + D): kopie se dotáhne na své místo,
//            myš jí za úchyt změní rozměr a kopie se přepíše na svůj obrázek
//
// Obal (`className`) nese polohu a rozměr, obsah (`bodyClassName`) vzhled —
// maska jde jen na obsah, rámeček stojí vedle něj. `still` = hotový stav bez
// stavby (Studio, úzké okno).

import type { ReactNode, Ref } from "react";
import { motion, useTransform, type MotionValue } from "framer-motion";
import { BuildFrame, BuildGrid, DrawFrame, softMask, useBlockBuild } from "@/components/home/info/reveal";
import { ease, mix, within, type Window } from "@/components/home/info/choreography";
import type { DupWindows } from "./steps";
import { fluidScaleRatio, useLandscapeFluid, cvw, cvh } from "@/lib/fluid";

type Common = {
  progress: MotionValue<number>;
  still?: boolean;
  className?: string;
  bodyClassName?: string;
  /** Pohyb obalu (dotažení myší) — motion styl navíc. */
  style?: Record<string, unknown>;
  ref?: Ref<HTMLDivElement>;
  /** Obsah navíc vedle obsahu (bez masky) — např. popisek se stavbou. */
  extra?: ReactNode;
  children: ReactNode;
} & Record<string, unknown>;

export function Block({
  progress,
  at: [from, to],
  tag,
  still = false,
  className,
  bodyClassName,
  style,
  ref,
  extra,
  children,
  ...rest
}: Common & { at: Window; tag?: string }) {
  const { mask, grid } = useBlockBuild(progress, from, to);
  if (still) {
    return (
      <div ref={ref} className={className} {...rest}>
        <div className={bodyClassName}>{children}</div>
        {extra}
      </div>
    );
  }
  return (
    <motion.div ref={ref} className={className} style={style} {...rest}>
      <BuildFrame progress={progress} from={from} to={to} tag={tag} size marks />
      <BuildGrid opacity={grid} />
      <motion.div className={bodyClassName} style={{ maskImage: mask, WebkitMaskImage: mask }}>
        {children}
      </motion.div>
      {extra}
    </motion.div>
  );
}

export function Drawn({
  progress,
  draw: drawWindow,
  reveal,
  label,
  still = false,
  className,
  bodyClassName,
  style,
  ref,
  extra,
  children,
  ...rest
}: Common & { draw: Window; reveal: Window; label: string }) {
  const draw = useTransform(progress, (s) => ease(within(drawWindow)(s)));
  const marks = useTransform(progress, within([drawWindow[1] - 0.01, drawWindow[1] + 0.03]));
  const fade = useTransform(progress, (s) => 1 - within([reveal[0] + 0.02, reveal[1]])(s));
  const mask = useTransform(progress, (s) => softMask(ease(within(reveal)(s)), "180deg"));
  if (still) {
    return (
      <div ref={ref} className={className} {...rest}>
        <div className={bodyClassName}>{children}</div>
        {extra}
      </div>
    );
  }
  return (
    <motion.div ref={ref} className={className} style={style} {...rest}>
      <DrawFrame draw={draw} marks={marks} fade={fade} label={label} />
      <motion.div className={bodyClassName} style={{ maskImage: mask, WebkitMaskImage: mask }}>
        {children}
      </motion.div>
      {extra}
    </motion.div>
  );
}

/** Měkké odhalení zleva (výplň SketchText) — pro prvky bez textu (šipky). */
export function useSoftReveal(progress: MotionValue<number>, [from, to]: Window) {
  return useTransform(progress, (s) => softMask(ease(within([from + (to - from) * 0.45, to])(s))));
}

/** Poloha a rozměr v kompozici: left (vw), top (vh), šířka a výška (vh), natočení (°). */
export type Geo = { left: number; top: number; width: number; height: number; rotate: number };

/**
 * Duplikát obrázku: od `drag[0]` se objeví kopie zdroje (`from`), dotáhne se
 * na své místo (`to`, poloha a natočení), v `resize` změní rozměr na svůj
 * a pak se kopie (`copy`) prolne do vlastního obrázku (`own`).
 * `still` = hotový stav na svém místě.
 */
export function DupImage({
  progress,
  w,
  from,
  to,
  copy,
  own,
  still = false,
  className,
  bodyClassName,
  ref,
}: {
  progress: MotionValue<number>;
  w: DupWindows;
  from: Geo;
  to: Geo;
  copy: ReactNode;
  own: ReactNode;
  still?: boolean;
  className?: string;
  bodyClassName?: string;
  ref?: Ref<HTMLDivElement>;
}) {
  // Fotky v krocích jsou na notebooku 0,85× (fluid-scale v CSS) — rozměry
  // kopie jsou čísla ve vh, tak je zmenšuje stejný poměr.
  const fluid = useLandscapeFluid();
  const k = fluidScaleRatio(fluid, 0.85);
  const t = useTransform(progress, (s) => ease(within(w.drag)(s)));
  const u = useTransform(progress, (s) => ease(within(w.resize)(s)));
  const left = useTransform(t, (v) => cvw(mix(from.left, to.left, v)));
  const top = useTransform(t, (v) => cvh(mix(from.top, to.top, v)));
  const rotate = useTransform(t, (v) => mix(from.rotate, to.rotate, v));
  const width = useTransform(u, (v) => cvh(mix(from.width, to.width, v) * k));
  const height = useTransform(u, (v) => cvh(mix(from.height, to.height, v) * k));
  const shown = useTransform(progress, (s) => (s >= w.drag[0] ? 1 : 0));
  const ownIn = useTransform(progress, within([w.resize[1], w.resize[1] + 0.02]));
  if (still) {
    return (
      <div ref={ref} className={className} style={{ left: cvw(to.left), top: cvh(to.top), width: cvh(to.width * k), height: cvh(to.height * k), rotate: `${to.rotate}deg` }}>
        <div className={bodyClassName}>{own}</div>
      </div>
    );
  }
  return (
    <motion.div ref={ref} className={className} style={{ left, top, width, height, rotate, opacity: shown }}>
      <div className={bodyClassName}>
        {copy}
        <motion.div style={{ position: "absolute", inset: 0, opacity: ownIn }}>{own}</motion.div>
      </div>
    </motion.div>
  );
}
