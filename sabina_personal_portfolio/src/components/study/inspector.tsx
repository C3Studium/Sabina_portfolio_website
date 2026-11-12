// Detail díla z plátna případové studie — malá karta, která se nalepí
// vedle díla (jako poznámky), ne hlavní věc stránky.
//
//   hlava      přepínač Náhled / Vrstvy / Pixely · výrazné Zavřít
//   plocha     obrázek na tečkované ploše
//   ovládání   přiblížení (−, %, +), lupa / výchozí pohled, u Vrstev
//              předvolby 3D (Zepředu, Izometrie, Z boku, Shora) a rozestup;
//              hned vedle krátce, jak se ovládá
//   pata       název a rozměr (u Vrstev vrstva pod kurzorem)
//
// Pohledy:
//  - Náhled: kolečko / tlačítka přiblíží, tažením posun, dvojklik = celý
//    obrázek; lupa pod kurzorem (jde vypnout).
//  - Vrstvy: rozklad banneru (lib/banner-layers) ve 3D — tah natočí,
//    Shift / prostřední tlačítko / dva prsty posunou, kolečko přiblíží.
//  - Pixely: obrázek z částic (common/particle-image), kurzor je rozfoukává.
// Zavře ji klik mimo, Esc, Zavřít nebo scroll o víc než čtvrt okna.
// Klávesy: 1–3 pohled, + / − přiblížení, 0 přizpůsobit.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type PointerEvent,
} from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import Image from "next/image";
import { AnimatePresence, motion, useSpring } from "framer-motion";
import { splitGrouped, type GroupedSplit } from "@/lib/banner-layers";
import type { StudyImage } from "./content";
import styles from "./inspector.module.scss";

const ParticleImage = dynamic(() => import("@/components/common/particle-image"), { ssr: false });

/** Otevření prohlížeče z obrázku na plátně. */
export const InspectContext = createContext<((image: StudyImage, anchor?: HTMLElement | null) => void) | null>(null);
export const useInspect = () => useContext(InspectContext);

export type View = "preview" | "layers" | "pixels";

const clampTo = (v: number, [lo, hi]: [number, number]) => Math.min(hi, Math.max(lo, v));

/** Jemný ukazatel (myš) vs. dotyk — podle toho nápověda. */
const fineQuery = "(hover: hover) and (pointer: fine)";
const subscribeFine = (notify: () => void) => {
  const media = window.matchMedia(fineQuery);
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
};
const useFinePointer = () => useSyncExternalStore(subscribeFine, () => window.matchMedia(fineQuery).matches, () => true);

/* ------------------------------------------------------- ikony --------- */

const ICON = {
  preview: "M4 5h16v14H4zM4 15l4.5-4.5 3.5 3.5 2.5-2.5L20 17",
  layers: "M12 4 3 9l9 5 9-5-9-5ZM3 14l9 5 9-5",
  pixels: "M5 5h3v3H5zM10.5 5h3v3h-3zM16 5h3v3h-3zM5 10.5h3v3H5zM10.5 10.5h3v3h-3zM16 10.5h3v3h-3zM5 16h3v3H5zM10.5 16h3v3h-3zM16 16h3v3h-3z",
  minus: "M6 12h12",
  plus: "M6 12h12M12 6v12",
  fit: "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5",
  loupe: "M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13ZM15.5 15.5 20 20",
  close: "M6 6l12 12M18 6 6 18",
  reset: "M4 12a8 8 0 1 0 2.4-5.7M4 4v4.5h4.5",
} as const;

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}



/* ------------------------------------------------------- náhled -------- */

const LOUPE = 180;
const LOUPE_ZOOM = 2.5;
const PREVIEW_ZOOM: [number, number] = [1, 4];

function Preview({ image, zoom, setZoom, loupe }: { image: StudyImage; zoom: number; setZoom: (z: number) => void; loupe: boolean }) {
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [cursor, setCursor] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const drag = useRef<{ id: number; x: number; y: number } | null>(null);
  const stage = useRef<HTMLDivElement>(null);
  // Při návratu na 100 % zpět na střed.
  const shown = zoom <= 1 ? { x: 0, y: 0 } : pan;

  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setZoom(clampTo(zoom * Math.exp(-e.deltaY * 0.0015), PREVIEW_ZOOM));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoom, setZoom]);

  return (
    <div
      ref={stage}
      className={styles.previewStage}
      data-zoomed={zoom > 1 || undefined}
      onPointerDown={(e) => {
        if (zoom <= 1 || e.button !== 0) return;
        drag.current = { id: e.pointerId, x: e.clientX - pan.x, y: e.clientY - pan.y };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (d && d.id === e.pointerId) setPan({ x: e.clientX - d.x, y: e.clientY - d.y });
      }}
      onPointerUp={() => {
        drag.current = null;
      }}
      onDoubleClick={() => setZoom(zoom > 1 ? 1 : 2)}
    >
      <motion.div className={styles.previewPan} animate={{ x: shown.x, y: shown.y, scale: zoom }} transition={{ type: "spring", stiffness: 260, damping: 30 }}>
        <div
          className={styles.previewImage}
          style={{ "--ar": image.width / image.height } as CSSProperties}
          onPointerMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            setCursor({ x: (e.clientX - r.left) / zoom, y: (e.clientY - r.top) / zoom, w: r.width / zoom, h: r.height / zoom });
          }}
          onPointerLeave={() => setCursor(null)}
        >
          <Image src={image.src} alt={image.alt} fill sizes="70vw" draggable={false} />
          {loupe && cursor && zoom <= 1 ? (
            <span
              className={styles.loupe}
              style={{ width: LOUPE, height: LOUPE, transform: `translate(${cursor.x - LOUPE / 2}px, ${cursor.y - LOUPE / 2}px)` }}
              aria-hidden="true"
            >
              <span
                className={styles.loupeImage}
                style={{
                  backgroundImage: `url("${image.src}")`,
                  backgroundSize: `${cursor.w * LOUPE_ZOOM}px ${cursor.h * LOUPE_ZOOM}px`,
                  backgroundPosition: `${-(cursor.x * LOUPE_ZOOM - LOUPE / 2)}px ${-(cursor.y * LOUPE_ZOOM - LOUPE / 2)}px`,
                }}
              />
              <span className={styles.loupeLabel}>{Math.round(LOUPE_ZOOM * 100)} %</span>
            </span>
          ) : null}
        </div>
      </motion.div>
    </div>
  );
}

/* ------------------------------------------------------- vrstvy -------- */

// Předvolby pohledu: ze 2D vrstev 3D scéna (natočení kolem os Y a X).
const PRESETS = [
  { key: "front", label: "Zepředu", ry: 0, rx: 0 },
  { key: "iso", label: "Izometrie", ry: 34, rx: 14 },
  { key: "side", label: "Z boku", ry: 72, rx: 4 },
  { key: "top", label: "Shora", ry: 12, rx: 40 },
] as const;
type PresetKey = (typeof PRESETS)[number]["key"];

const LAYER_ZOOM: [number, number] = [0.45, 2.4];

type Gesture = { mode: "rotate" | "pan"; x: number; y: number; ry: number; rx: number; px: number; py: number; dist: number; zoom: number };

function Exploded({
  split,
  image,
  gap,
  preset,
  onPreset,
  zoom,
  setZoom,
  focus,
  setHover,
}: {
  split: GroupedSplit;
  image: StudyImage;
  gap: number;
  preset: { ry: number; rx: number; tick: number };
  onPreset: (key: PresetKey | null) => void;
  zoom: number;
  setZoom: (z: number) => void;
  focus: number | null;
  setHover: (i: number | null) => void;
}) {
  const ry = useSpring(preset.ry, { stiffness: 120, damping: 20 });
  const rx = useSpring(preset.rx, { stiffness: 120, damping: 20 });
  const panX = useSpring(0, { stiffness: 220, damping: 28 });
  const panY = useSpring(0, { stiffness: 220, damping: 28 });
  const scale = useSpring(zoom, { stiffness: 200, damping: 26 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<Gesture | null>(null);
  const n = split.layers.length;

  // Předvolba / přiblížení z lišty → pružiny.
  // (tick: stejná předvolba vybraná znovu po ručním natočení.)
  useEffect(() => {
    ry.set(preset.ry);
    rx.set(preset.rx);
    panX.set(0);
    panY.set(0);
  }, [preset.ry, preset.rx, preset.tick, ry, rx, panX, panY]);
  useEffect(() => {
    scale.set(zoom);
  }, [zoom, scale]);

  const center = () => {
    const pts = [...pointers.current.values()];
    const x = pts.reduce((s, p) => s + p.x, 0) / pts.length;
    const y = pts.reduce((s, p) => s + p.y, 0) / pts.length;
    const dist = pts.length > 1 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : 0;
    return { x, y, dist };
  };
  const begin = (mode: Gesture["mode"]) => {
    const c = center();
    gesture.current = { mode, x: c.x, y: c.y, ry: ry.get(), rx: rx.get(), px: panX.get(), py: panY.get(), dist: c.dist, zoom };
  };
  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button === 1) e.preventDefault();
    if (e.button > 1) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    e.currentTarget.setPointerCapture(e.pointerId);
    const touchPan = e.pointerType === "touch" && pointers.current.size >= 2;
    begin(e.button === 1 || e.shiftKey || touchPan ? "pan" : "rotate");
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    if (!g) return;
    const c = center();
    if (g.mode === "pan") {
      panX.set(g.px + (c.x - g.x));
      panY.set(g.py + (c.y - g.y));
      if (g.dist > 0 && c.dist > 0) setZoom(clampTo(g.zoom * (c.dist / g.dist), LAYER_ZOOM));
    } else {
      ry.set(clampTo(g.ry + (c.x - g.x) * 0.3, [-80, 80]));
      rx.set(clampTo(g.rx - (c.y - g.y) * 0.25, [-45, 45]));
      if (Math.hypot(c.x - g.x, c.y - g.y) > 4) onPreset(null);
    }
  };
  const onUp = (e: PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 1 && e.pointerType === "touch") begin("rotate");
    else if (!pointers.current.size) gesture.current = null;
  };

  const viewRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = viewRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setZoom(clampTo(zoom * Math.exp(-e.deltaY * 0.0012), LAYER_ZOOM));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoom, setZoom]);

  return (
    <div
      ref={viewRef}
      className={styles.layersStage}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onAuxClick={(e) => e.preventDefault()}
    >
      <motion.div className={styles.layersPan} style={{ x: panX, y: panY, scale }}>
        <motion.div className={styles.layersStack} style={{ rotateY: ry, rotateX: rx, aspectRatio: `${image.width} / ${image.height}` }}>
          {split.layers.map((layer, i) => (
            <motion.img
              key={layer.name + i}
              src={layer.url}
              alt=""
              draggable={false}
              className={styles.layer}
              data-focus={focus === i || undefined}
              data-dim={focus !== null && focus !== i ? "" : undefined}
              initial={{ z: 0, opacity: 0 }}
              animate={{ z: (i - (n - 1) / 2) * gap, opacity: 1 }}
              transition={{ type: "spring", stiffness: 90, damping: 16, delay: i * 0.02 }}
              onPointerEnter={() => setHover(i)}
              onPointerLeave={() => setHover(null)}
            />
          ))}
        </motion.div>
      </motion.div>
    </div>
  );
}

/* ------------------------------------------------------- pixely -------- */

function Pixels({ image }: { image: StudyImage }) {
  const ref = useRef<HTMLImageElement>(null);
  return (
    <div className={styles.previewStage}>
      <div className={styles.previewImage} style={{ "--ar": image.width / image.height } as CSSProperties}>
        <Image ref={ref} src={image.src} alt={image.alt} fill sizes="70vw" className={styles.pixelsGhost} />
        <ParticleImage
          src={image.src}
          targetRef={ref}
          className={styles.pixelsLayer}
          particleCount={160000}
          particleSize={1.3}
          particleOpacity={0.95}
          additive={false}
          bleed={120}
          alphaThreshold={10}
          speed={0.3}
          noiseScale={0.002}
          noiseStrength={0.02}
          damping={0.94}
          lifespan={420}
          cursorInteraction
          cursorStrength={0.18}
          cursorRadius={150}
          dpr={1.5}
          paused={false}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------- karta -------- */

function ToolButton({ icon, label, onClick, active, disabled }: { icon: string; label: string; onClick: () => void; active?: boolean; disabled?: boolean }) {
  return (
    <button type="button" className={styles.tool} onClick={onClick} aria-label={label} title={label} data-active={active || undefined} disabled={disabled}>
      <Icon d={icon} />
    </button>
  );
}

/** Nápověda k ovládání: dvojice „gesto — co udělá", každá na řádku. */
const HINTS: Record<View, { fine: string[]; touch: string[] }> = {
  layers: { fine: ["Tažení", "natočí", "Shift + tažení", "posune", "Kolečko", "přiblíží"], touch: ["Jeden prst", "natočí", "Dva prsty", "posunou a přiblíží"] },
  pixels: { fine: ["Kurzor", "rozfouká pixely"], touch: ["Prst", "rozfouká pixely"] },
  preview: { fine: ["Kolečko", "přiblíží", "Tažení", "posune", "Dvojklik", "celý obrázek"], touch: ["Tlačítka", "přiblíží", "Tažení", "posune"] },
};

function Hint({ parts }: { parts: string[] }) {
  const pairs = parts.reduce<string[][]>((acc, part, i) => (i % 2 ? (acc[acc.length - 1].push(part), acc) : [...acc, [part]]), []);
  return (
    <p className={styles.hint}>
      {pairs.map(([gesture, effect]) => (
        <span key={gesture}>
          <b>{gesture}</b> {effect}
        </span>
      ))}
    </p>
  );
}

/**
 * Obsah karty: nahoře přepínač pohledů a Zavřít, vlevo plocha v poměru
 * stran obrázku (rozměr jí dává Card), vpravo pod sebou ovládání,
 * nápověda a název s rozměrem.
 */
function Detail({ image, onClose }: { image: StudyImage; onClose: () => void }) {
  const fine = useFinePointer();
  // Začíná se na vrstvách; bez rozkladu na náhledu.
  const [chosen, setView] = useState<View>("layers");
  const [split, setSplit] = useState<GroupedSplit | null | undefined>(undefined);
  const view: View = chosen === "layers" && split === null ? "preview" : chosen;
  const [zoom, setZoomState] = useState({ preview: 1, layers: 0.85 });
  const [loupe, setLoupe] = useState(true);
  const [gap, setGap] = useState(90);
  const [preset, setPreset] = useState<{ key: PresetKey | null; ry: number; rx: number; tick: number }>({ key: "iso", ry: 34, rx: 14, tick: 0 });
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    splitGrouped(image.src).then((result) => alive && setSplit(result));
    return () => {
      alive = false;
    };
  }, [image]);

  const range = view === "layers" ? LAYER_ZOOM : PREVIEW_ZOOM;
  const zoomKey = view === "layers" ? "layers" : "preview";
  const fitZoom = zoomKey === "layers" ? 0.85 : 1;
  const current = zoom[zoomKey];
  const setZoom = useCallback((z: number) => setZoomState((s) => ({ ...s, [zoomKey]: z })), [zoomKey]);
  const choosePreset = (key: PresetKey | null) => {
    const p = PRESETS.find((x) => x.key === key);
    if (!p) {
      setPreset((s) => (s.key === null ? s : { ...s, key: null }));
      return;
    }
    setPreset((s) => ({ key: p.key, ry: p.ry, rx: p.rx, tick: s.tick + 1 }));
  };

  // Klávesy: 1 vrstvy, 2 pixely, 3 náhled, + / − přiblížení, 0 přizpůsobit.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "1" && split) setView("layers");
      else if (e.key === "2") setView("pixels");
      else if (e.key === "3") setView("preview");
      else if (e.key === "+" || e.key === "=") setZoom(clampTo(current * 1.25, range));
      else if (e.key === "-") setZoom(clampTo(current / 1.25, range));
      else if (e.key === "0") setZoom(fitZoom);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [split, current, range, setZoom, fitZoom]);

  const name = (image.src.split("/").pop() ?? "").replace(/^[0-9a-f]{12,}-/i, "");
  const layer = view === "layers" && split && hover !== null ? split.layers[hover] : null;
  const views: { key: View; label: string; off?: boolean }[] = [
    { key: "layers", label: "Vrstvy", off: split === null },
    { key: "pixels", label: "Pixely" },
    { key: "preview", label: "Náhled" },
  ];

  return (
    <>
      <div className={styles.head}>
        <div className={styles.modes} role="tablist" aria-label="Pohled">
          {views.map((v, i) => (
            <button
              key={v.key}
              type="button"
              role="tab"
              aria-selected={view === v.key}
              data-active={view === v.key || undefined}
              disabled={v.off}
              aria-label={v.label}
              title={v.off ? "Tento obrázek rozklad na vrstvy nemá" : `${v.label} (${i + 1})`}
              onClick={() => setView(v.key)}
            >
              <Icon d={ICON[v.key]} />
              <span>{v.label}</span>
              {v.key === "layers" && split ? <i>{split.layers.length}</i> : null}
            </button>
          ))}
        </div>
        <button type="button" className={styles.close} onClick={onClose} aria-label="Zavřít detail (Esc)">
          <Icon d={ICON.close} />
          <span>Zavřít</span>
        </button>
      </div>

      <div className={styles.body}>
        {/* Plocha: rozměr v poměru stran obrázku nastavuje Card. */}
        <div className={styles.stage} data-stage="">
          {view === "preview" && <Preview image={image} zoom={current} setZoom={setZoom} loupe={loupe && fine} />}
          {view === "layers" && split ? (
            <Exploded split={split} image={image} gap={gap} preset={preset} onPreset={choosePreset} zoom={current} setZoom={setZoom} focus={hover} setHover={setHover} />
          ) : null}
          {view === "layers" && split === undefined ? <p className={styles.loading}>Rozkládám vrstvy…</p> : null}
          {view === "pixels" && <Pixels image={image} />}
        </div>

        {/* Ovládání pod sebou a jak se ovládá. */}
        <div className={styles.side} data-side-panel="">
          {view === "layers" && split ? (
            <>
              <section>
                <p className={styles.sideHead}>Pohled</p>
                <div className={styles.presets} role="group" aria-label="Pohled na vrstvy">
                  {PRESETS.map((p) => (
                    <button key={p.key} type="button" data-active={preset.key === p.key || undefined} onClick={() => choosePreset(p.key)}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </section>
              <section>
                <p className={styles.sideHead}>
                  Rozestup <span>{gap} px</span>
                </p>
                <input className={styles.range} type="range" min={0} max={200} step={5} value={gap} onChange={(e) => setGap(Number(e.target.value))} aria-label="Rozestup vrstev" />
              </section>
            </>
          ) : null}
          {view !== "pixels" ? (
            <section>
              <p className={styles.sideHead}>Přiblížení</p>
              <div className={styles.zoom}>
                <ToolButton icon={ICON.minus} label="Oddálit (−)" onClick={() => setZoom(clampTo(current / 1.25, range))} disabled={current <= range[0]} />
                <button type="button" className={styles.zoomValue} onClick={() => setZoom(fitZoom)} title="Přizpůsobit (0)">
                  {Math.round(current * 100)} %
                </button>
                <ToolButton icon={ICON.plus} label="Přiblížit (+)" onClick={() => setZoom(clampTo(current * 1.25, range))} disabled={current >= range[1]} />
                {view === "preview" && fine ? <ToolButton icon={ICON.loupe} label={loupe ? "Vypnout lupu" : "Zapnout lupu"} active={loupe} onClick={() => setLoupe((l) => !l)} /> : null}
                {view === "layers" ? <ToolButton icon={ICON.reset} label="Výchozí pohled" onClick={() => choosePreset("iso")} /> : null}
              </div>
            </section>
          ) : null}
          <section>
            <p className={styles.sideHead}>Ovládání</p>
            <Hint parts={HINTS[view][fine ? "fine" : "touch"]} />
          </section>

          <p className={styles.meta}>
            {layer ? (
              <>
                <b>{layer.name}</b>
                <span>
                  {Math.round(layer.box[2] * image.width)} × {Math.round(layer.box[3] * image.height)} px
                </span>
              </>
            ) : (
              <>
                <b>{name}</b>
                <span>
                  {image.width} × {image.height} px{split ? ` · ${split.layers.length} vrstev` : ""}
                </span>
              </>
            )}
          </p>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------- okno ---------- */

// Karta stojí vedle díla — na straně, kde je víc místa, a zmenší se, aby
// dílo nepřekryla. Plocha má poměr stran obrázku. Drží se díla, dokud se
// plátno hýbe. Zavře ji klik mimo, Esc, Zavřít nebo scroll o víc než
// čtvrt okna. Bez díla (homepage) nebo na výšku stojí uprostřed / dole.
const CARD = { gap: 24, edge: 16, top: 88, closeAfter: 0.25, maxH: 0.8, minStage: 220, minSheet: 160, sheetShare: 0.55 };

function Card({ image, anchor, onClose }: { image: StudyImage; anchor: HTMLElement | null; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const ar = image.width / image.height;

  // Poloha a velikost u díla (každý snímek — plátno se pod kartou hýbe).
  useEffect(() => {
    let raf = 0;
    const place = () => {
      raf = requestAnimationFrame(place);
      const el = ref.current;
      const stage = el?.querySelector<HTMLElement>("[data-stage]");
      const sideEl = el?.querySelector<HTMLElement>("[data-side-panel]");
      if (!el || !stage) return;
      const frame = document.querySelector("[data-study-frame]")?.getBoundingClientRect() ?? new DOMRect(0, 0, window.innerWidth, window.innerHeight);
      const top0 = Math.max(frame.top, 0) + CARD.top;
      const bottom0 = Math.min(frame.bottom, window.innerHeight) - CARD.edge;
      const sheet = window.innerHeight > window.innerWidth;
      const r = anchor && anchor.isConnected ? anchor.getBoundingClientRect() : null;
      el.dataset.side = sheet ? "sheet" : r ? "beside" : "center";
      // Okraje karty kolem plochy (hlava, pravý sloupec, odsazení).
      const chromeW = el.offsetWidth - stage.offsetWidth;
      const chromeH = el.offsetHeight - stage.offsetHeight;
      const maxStageH = Math.min(bottom0 - top0, window.innerHeight * CARD.maxH) - chromeH;
      let stageH: number;
      let left: number;
      let top: number;
      if (sheet) {
        // List dole: plocha přes celou šířku těla (ne „karta minus plocha" —
        // s nulovou plochou by to sebralo celou šířku a plocha zůstala 0).
        // Výška: nejvýš ~58 % místa pod hlavičkou listu, zbytek ovládání.
        const body = stage.parentElement;
        const cs = body ? getComputedStyle(body) : null;
        const availW = body && cs ? body.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) : frame.width - 64;
        const room = bottom0 - top0 - (body ? body.offsetTop : 60) - (cs ? parseFloat(cs.paddingBottom) : 16);
        // Plocha přes celou šířku listu (CSS), výška podílem místa — 3D
        // scéna i náhled mají kolem obrázku prostor; neomezovat poměrem stran.
        stageH = Math.max(CARD.minSheet, Math.min(room * CARD.sheetShare, availW * 1.4));
        left = 0;
        top = 0;
      } else {
        stageH = maxStageH;
        let room = Infinity;
        let side: "right" | "left" | null = null;
        if (r) {
          const roomRight = frame.right - CARD.edge - (r.right + CARD.gap);
          const roomLeft = r.left - CARD.gap - (frame.left + CARD.edge);
          side = roomRight >= roomLeft ? "right" : "left";
          room = Math.max(roomRight, roomLeft);
          // Zmenšit, aby se vešla vedle díla — ale ne pod výšku ovládání
          // (to by se uřízlo); úplně úzko → doprostřed přes dílo.
          const fit = (room - chromeW) / ar;
          const least = Math.max(CARD.minStage, sideEl?.scrollHeight ?? 0);
          if (fit >= CARD.minStage) stageH = Math.min(stageH, Math.max(fit, least));
          else side = null;
        }
        stageH = Math.min(stageH, (frame.width - CARD.edge * 2 - chromeW) / ar);
        const w = stageH * ar + chromeW;
        const h = stageH + chromeH;
        left = side === "right" && r ? r.right + CARD.gap : side === "left" && r ? r.left - CARD.gap - w : frame.left + (frame.width - w) / 2;
        // Karta nesmí z okna: když se vedle díla nevejde (drží výšku
        // ovládání), přisune se ke kraji a dílo částečně překryje.
        const right0 = Math.min(frame.right, window.innerWidth) - CARD.edge;
        left = Math.min(Math.max(left, Math.max(frame.left, 0) + CARD.edge), right0 - w);
        top = r && side ? r.top + r.height / 2 - h / 2 : top0 + (bottom0 - top0 - h) / 2;
        top = Math.min(Math.max(top, top0), bottom0 - h);
      }
      stage.style.width = `${Math.round(stageH * ar)}px`;
      stage.style.height = `${Math.round(stageH)}px`;
      if (sheet) {
        left = frame.left + (Math.min(frame.width, window.innerWidth) - el.offsetWidth) / 2;
        top = bottom0 - el.offsetHeight;
      }
      el.style.left = `${Math.round(left)}px`;
      el.style.top = `${Math.round(top)}px`;
      el.dataset.placed = "";
    };
    raf = requestAnimationFrame(place);
    return () => cancelAnimationFrame(raf);
  }, [anchor, ar]);

  // Zavření: Esc, klik mimo, scroll o víc než čtvrt okna.
  useEffect(() => {
    const start = window.scrollY;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onDown = (e: globalThis.PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onScroll = () => {
      if (Math.abs(window.scrollY - start) > window.innerHeight * CARD.closeAfter) onClose();
    };
    // Až po kliku, který kartu otevřel.
    const timer = window.setTimeout(() => window.addEventListener("pointerdown", onDown), 0);
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll);
    };
  }, [onClose]);

  return (
    <motion.div
      ref={ref}
      className={styles.card}
      initial={{ opacity: 0, scale: 1.05, rotate: 2.5 }}
      animate={{ opacity: 1, scale: 1, rotate: 0 }}
      exit={{ opacity: 0, scale: 0.97, rotate: -1.5, transition: { duration: 0.2 } }}
      transition={{ type: "spring", stiffness: 260, damping: 20 }}
      role="dialog"
      aria-label={`Detail: ${image.alt}`}
      data-lenis-prevent=""
    >
      <span className={styles.tape} aria-hidden="true" />
      <Detail image={image} onClose={onClose} />
    </motion.div>
  );
}

/** Detail díla jako karta u něj (případová studie). `anchor` = prvek díla. */
// Portál do <body>: `main` má vlastní vrstvu (z-index 1), karta by v ní
// zůstala pod hlavičkou a spodní lištou kontaktu na telefonu.
const subscribeNothing = () => () => {};

export function InspectorDock({ image, anchor = null, onClose }: { image: StudyImage | null; anchor?: HTMLElement | null; onClose: () => void }) {
  const mounted = useSyncExternalStore(subscribeNothing, () => true, () => false);
  if (!mounted) return null;
  return createPortal(<AnimatePresence>{image ? <Card key={image.src} image={image} anchor={anchor} onClose={onClose} /> : null}</AnimatePresence>, document.body);
}

/** Totéž pro proklik mimo plátno (homepage, inspect-hint) — bez díla uprostřed. */
export const Inspector = InspectorDock;
