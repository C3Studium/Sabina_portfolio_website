// DollyLine — křivka v prostoru DollyGallery. Body (kotvy) jsou přivázané
// k dlaždicím: posun od středu dlaždice a o kolik stojí PŘED ní do hloubky.
// Přes ně vede hladká 3D křivka (centripetální Catmull-Rom), která se
// každý snímek promítne stejnou perspektivou jako CSS dlaždice
// (měřítko = perspective / (perspective + hloubka)) a nakreslí do SVG.
// Do dálky slábne a ztenčuje se, za kamerou zhasne.
//
// `head` (MotionValue v kotvách: 0 = první, 1 = druhá…) = kam až je křivka
// nakreslená — linka pak ROSTE (špička se dopočítá mezi vzorky) a uzly
// naskočí, až k nim dojde. Bez `head` je celá.
//
// Kreslí se, když galerie kreslí (onFrame), a když se pohne `head`:
//
//     const line = useRef<DollyLineHandle>(null);
//     <DollyLine ref={line} anchors={[...]} head={grow} />
//     <DollyGallery onFrame={(f) => line.current?.draw(f)} ... />
//
// Vrstva leží v rámu galerie (absolute, inset 0) — dej ji do stejného
// rodiče jako galerii, pod ni (z-index), ať linka běží za obsahem kroků.

import { useEffect, useImperativeHandle, useMemo, useRef, type ReactNode, type Ref } from "react";
import type { MotionValue } from "framer-motion";
import type { DollyFrame } from "./index";
import styles from "./styles.module.scss";
import { ACCENT } from "@/lib/palette";

export type DollyAnchor = {
  /** Pořadí dlaždice v galerii. */
  tile: number;
  /** Posun od středu dlaždice — podíl její šířky / výšky. */
  x?: number;
  y?: number;
  /** O kolik rozestupů stojí bod PŘED dlaždicí (záporné = za ní). */
  ahead?: number;
  /** Uzel na křivce: "dot" kroužek, "final" koncový (s `finalContent`). */
  node?: "dot" | "final";
};

export type DollyLineHandle = { draw: (frame: DollyFrame) => void };

type DollyLineProps = {
  ref?: Ref<DollyLineHandle>;
  anchors: DollyAnchor[];
  color?: string;
  /** Tloušťka v hloubce 0 (px); dál se ztenčuje s perspektivou. */
  width?: number;
  /** Vzorků na úsek mezi dvěma kotvami. */
  samples?: number;
  /** Do dálky: od kolika rozestupů slábne a kde zmizí úplně. */
  fade?: readonly [number, number];
  /** Za kamerou: za kolik rozestupů zhasne. */
  pass?: number;
  /** Kam až je křivka nakreslená (v kotvách) — linka roste. */
  head?: MotionValue<number>;
  className?: string;
  nodeClassName?: string;
  finalClassName?: string;
  finalContent?: ReactNode;
};

/* ---------- Nastavení ---------- */

// Kolik vzorků kreslí jeden kousek čáry (vlastní tloušťka a průhlednost).
const CHUNK = 3;
// Body blíž než tenhle zlomek perspektivy ke kameře se nekreslí (obří).
const NEAR = 0.12;
// Uzel naskočí během posledního kousku cesty linky k němu (v kotvách).
const NODE_IN = 0.15;

/* ---------- Matematika ---------- */

type P3 = { x: number; y: number; z: number };

const clamp01 = (v: number) => Math.min(Math.max(v, 0), 1);
const smooth = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const lerp3 = (a: P3, b: P3, wa: number, wb: number): P3 => ({
  x: a.x * wa + b.x * wb,
  y: a.y * wa + b.y * wb,
  z: a.z * wa + b.z * wb,
});
const dist = (a: P3, b: P3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

/** Centripetální Catmull-Rom (Barry–Goldman): bod úseku P1→P2 v u ∈ [0, 1]. */
function catmull(p0: P3, p1: P3, p2: P3, p3: P3, u: number): P3 {
  const knot = (a: P3, b: P3) => Math.max(Math.sqrt(dist(a, b)), 1e-4);
  const t0 = 0;
  const t1 = t0 + knot(p0, p1);
  const t2 = t1 + knot(p1, p2);
  const t3 = t2 + knot(p2, p3);
  const t = t1 + (t2 - t1) * u;
  const a1 = lerp3(p0, p1, (t1 - t) / (t1 - t0), (t - t0) / (t1 - t0));
  const a2 = lerp3(p1, p2, (t2 - t) / (t2 - t1), (t - t1) / (t2 - t1));
  const a3 = lerp3(p2, p3, (t3 - t) / (t3 - t2), (t - t2) / (t3 - t2));
  const b1 = lerp3(a1, a2, (t2 - t) / (t2 - t0), (t - t0) / (t2 - t0));
  const b2 = lerp3(a2, a3, (t3 - t) / (t3 - t1), (t - t1) / (t3 - t1));
  return lerp3(b1, b2, (t2 - t) / (t2 - t1), (t - t1) / (t2 - t1));
}

/** Vzorky celé křivky přes kotvy (konce prodloužené zrcadlením). */
function sampleCurve(points: P3[], samples: number): P3[] {
  if (points.length < 2) return points;
  const ext = [
    lerp3(points[0], points[1], 2, -1),
    ...points,
    lerp3(points[points.length - 1], points[points.length - 2], 2, -1),
  ];
  const out: P3[] = [];
  for (let i = 1; i < ext.length - 2; i++) {
    for (let j = 0; j < samples; j++) out.push(catmull(ext[i - 1], ext[i], ext[i + 1], ext[i + 2], j / samples));
  }
  out.push(points[points.length - 1]);
  return out;
}

/* ---------- Komponenta ---------- */

export default function DollyLine({
  ref,
  anchors,
  color = ACCENT,
  width = 2.5,
  samples = 24,
  fade = [0.6, 2.6],
  pass = 0.6,
  head,
  className,
  nodeClassName,
  finalClassName,
  finalContent,
}: DollyLineProps) {
  const chunkRefs = useRef<(SVGPathElement | null)[]>([]);
  const nodeRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const lastFrame = useRef<DollyFrame | null>(null);
  const segments = Math.max(0, anchors.length - 1);
  const sampleCount = segments * samples + 1;
  const chunkCount = Math.max(0, Math.ceil((sampleCount - 1) / CHUNK));
  const nodes = useMemo(() => anchors.map((a, i) => ({ ...a, i })).filter((a) => a.node), [anchors]);

  // Jeden snímek: kotvy → 3D křivka → narostlá část → promítnutí → SVG.
  const paint = (frame: DollyFrame) => {
    const { width: W, height: H, perspective: P, step, tileWidth, tileHeight, tiles } = frame;
    if (!W || !H) return;
    const byIndex = new Map(tiles.map((t) => [t.index, t]));
    const world: P3[] = [];
    for (const a of anchors) {
      const tile = byIndex.get(a.tile);
      if (!tile) return;
      world.push({
        x: tile.x + (a.x ?? 0) * tileWidth,
        y: tile.y + (a.y ?? 0) * tileHeight,
        z: tile.depth - (a.ahead ?? 0) * step,
      });
    }

    // Promítnutí jako CSS perspective (počátek uprostřed rámu).
    const project = (p: P3) => {
      const room = P + p.z;
      if (room <= P * NEAR) return null;
      const s = P / room;
      const t = p.z / step;
      const alpha = p.z >= 0 ? 1 - smooth(fade[0], fade[1], t) : 1 - clamp01(-t / pass);
      return { x: W / 2 + p.x * s, y: H / 2 + p.y * s, s, alpha };
    };

    // Jen narostlá část: vzorky do `head` a špička dopočítaná mezi nimi.
    const reach = head ? Math.max(0, head.get()) : Infinity;
    const all = sampleCurve(world, samples);
    const cut = Math.min(reach * samples, all.length - 1);
    const whole = Math.floor(cut);
    const grown = all.slice(0, whole + 1);
    if (cut > whole && all[whole + 1]) {
      const f = cut - whole;
      grown.push(lerp3(all[whole], all[whole + 1], 1 - f, f));
    }
    const curve = grown.length > 1 ? grown.map(project) : [];

    for (let c = 0; c < chunkCount; c++) {
      const el = chunkRefs.current[c];
      if (!el) continue;
      const from = c * CHUNK;
      const to = Math.min(from + CHUNK, curve.length - 1);
      if (from >= to) {
        el.setAttribute("d", "");
        continue;
      }
      const part = curve.slice(from, to + 1);
      const mid = curve[Math.min(from + Math.floor(CHUNK / 2), to)];
      if (!mid || part.some((pt) => !pt) || mid.alpha <= 0.002) {
        el.setAttribute("d", "");
        continue;
      }
      el.setAttribute("d", part.map((pt, k) => `${k ? "L" : "M"}${pt!.x.toFixed(1)} ${pt!.y.toFixed(1)}`).join(" "));
      el.style.strokeWidth = String(Math.min(Math.max(width * mid.s, 0.5), width * 3).toFixed(2));
      el.style.opacity = mid.alpha.toFixed(3);
    }

    nodes.forEach((node, n) => {
      const el = nodeRefs.current[n];
      if (!el) return;
      const pt = project(world[node.i]);
      // Uzel naskočí, až k němu linka doroste.
      const grownTo = clamp01((reach - (node.i - NODE_IN)) / NODE_IN);
      const alpha = pt ? pt.alpha * grownTo : 0;
      if (!pt || alpha <= 0.002) {
        el.style.visibility = "hidden";
        return;
      }
      el.style.visibility = "visible";
      el.style.opacity = alpha.toFixed(3);
      el.style.transform = `translate3d(${pt.x.toFixed(1)}px, ${pt.y.toFixed(1)}px, 0) translate(-50%, -50%) scale(${pt.s.toFixed(3)})`;
      // Bližší uzel nad vzdálenějším.
      el.style.zIndex = String(Math.round(1000 * pt.s));
    });
  };

  // Vždy aktuální `paint` (props) pro volání zvenku a z `head`.
  const paintRef = useRef(paint);
  useEffect(() => {
    paintRef.current = paint;
  });

  useImperativeHandle(
    ref,
    () => ({
      draw(frame) {
        lastFrame.current = frame;
        paintRef.current(frame);
      },
    }),
    [],
  );

  // Linka roste i když kamera stojí (galerie pak nekreslí) — překreslit
  // s posledním snímkem galerie.
  useEffect(() => {
    if (!head) return;
    return head.on("change", () => {
      if (lastFrame.current) paintRef.current(lastFrame.current);
    });
  }, [head]);

  return (
    <div className={[styles.line, className].filter(Boolean).join(" ")} aria-hidden="true">
      <svg className={styles.lineSvg}>
        {Array.from({ length: chunkCount }, (_, c) => (
          <path
            key={c}
            ref={(el) => {
              chunkRefs.current[c] = el;
            }}
            fill="none"
            stroke={color}
            strokeLinecap="butt"
            strokeLinejoin="round"
          />
        ))}
      </svg>
      {nodes.map((node, n) => (
        <span
          key={node.i}
          ref={(el) => {
            nodeRefs.current[n] = el;
          }}
          className={[styles.lineNode, node.node === "final" ? finalClassName : nodeClassName].filter(Boolean).join(" ")}
        >
          {node.node === "final" ? finalContent : null}
        </span>
      ))}
    </div>
  );
}
