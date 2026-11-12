// FlexCarousel — nastavení a vstupy.
//
// React strana: propy s výchozími hodnotami a předvolby čočky, předání
// enginu přes ref (engine je čte každý snímek), popisek s počítadlem
// a přístupnost. Hover (rámeček ve stylu MeasureText, titulek, obor
// a tlačítko) se kreslí DO SCÉNY (hover.ts), takže ho čočka ohne spolu
// s kartou. Pro klávesnici a čtečky jsou odkazy na projekty v DOMu skrytě.
//
// Shader a chování jsou v engine.ts, vzhled ve styles.module.scss.

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MutableRefObject,
} from "react";
import { Digits } from "./caption";
import Link from "next/link";
import { useRouter } from "next/router";
import type { MotionValue } from "framer-motion";
import {
  BEND_PRESETS,
  createFlexCarousel,
  type Curl,
  type Fit,
  type FlexEngine,
  type FlexItem,
  type FlexSettings,
  type IntroKind,
  type Preset,
} from "./engine";
import styles from "./styles.module.scss";

export type { FlexItem } from "./engine";

/** Ruční ovládání zvenku (šipky mimo komponentu). */
export interface FlexControls {
  next: () => void;
  previous: () => void;
}

export interface FlexCarouselProps {
  items: FlexItem[];
  /** Předvolba čočky: liquid, ribbon, vortex, arch. Jednotlivé propy ji přebíjí. */
  preset?: Preset;
  /** Úvod: rise (karty vyjedou zespodu), bloom, spin, deal, fade, none. */
  intro?: IntroKind;
  /**
   * Úvod počká, dokud je `true` — scéna je do té doby neviditelná. Pro
   * nástup v pořadí (např. až po jiném prvku stránky). Na už proběhlý úvod
   * nemá vliv.
   */
  hold?: boolean;
  /** Rychlost úvodu: 1 = výchozí délka, 1,6 = o tolik rychleji. */
  introSpeed?: number;
  /** Výška karty jako podíl výšky kontejneru. */
  cardHeight?: number;
  /** Mezera mezi kartami v px. */
  gap?: number;
  /** Zaoblení rohů v px. */
  radius?: number;
  /** Poměr karet: natural = podle obrázku, nebo pevný portrait/square/landscape. */
  fit?: Fit;
  /** Přesný poměr karet šířka/výška, např. 1080 / 1350. Přebije `fit`. */
  aspect?: number;
  /* ---------- Čočka ---------- */
  /** Šířka čočky jako podíl šířky kontejneru. */
  lensWidth?: number;
  /** Výška čočky jako podíl ŠÍŘKY kontejneru. */
  lensHeight?: number;
  /** Natočení čočky ve stupních. */
  tilt?: number;
  /** 1 = elipsa, 0 = skoro obdélník. */
  roundness?: number;
  /** Síla ohnutí za okrajem čočky. */
  bend?: number;
  /** Jak daleko od okraje ohnutí sahá. */
  reach?: number;
  /** Směr stočení: twist (každá strana jinam), rise, fall. */
  curl?: Curl;
  /** Rozklad barev na ohybu. */
  dispersion?: number;
  /** Jak moc čočku zmáčkne rychlý pohyb. */
  liquid?: number;
  /** Čočka sleduje kurzor. */
  followCursor?: boolean;
  /* ---------- Chování ---------- */
  /** Jak moc se karty při rychlém pohybu zmenší. */
  squeeze?: number;
  /** Kliknutí na aktivní kartu ji přiblíží. */
  focusOnClick?: boolean;
  autoplay?: boolean;
  /** Interval autoplay v sekundách. */
  interval?: number;
  /** Popisek pod kartou s počítadlem. */
  captions?: boolean;
  /** Svislé kolečko posouvá řadu (jinak scrolluje stránku). */
  captureWheel?: boolean;
  /* ---------- Hover (stejné jako OrbitCards) ---------- */
  /** Ztlumení obrázků, jako černý překryv s touhle průhledností. */
  dim?: number;
  /** Ztlumení karty pod myší (plynule z `dim`). */
  dimHover?: number;
  /** Rozostření na okrajích čočky v px, 0 = vypnuté. */
  edgeBlur?: number;
  /** HTML vrstva nad kartou pod myší: rámeček, titulek, text a odkaz. */
  hoverPanel?: boolean;
  /** Posun řady ze scrollu jako podíl šířky kontejneru (MotionValue). */
  drift?: MotionValue<number>;
  /** Aktivní karta se změnila (index položky). Pro popisek mimo komponentu. */
  onChange?: (index: number) => void;
  /** Sem komponenta zapíše next/previous pro šipky mimo ni. */
  controlsRef?: MutableRefObject<FlexControls | null>;
  /**
   * Klepnutí na aktivní kartu. Bez propu vede karta s `href` na odkaz;
   * s ním rozhoduje volající (např. otevře detail obrázku). `anchor` je
   * kontejner scény — k němu se detail může přilepit.
   */
  onSelect?: (index: number, anchor: HTMLElement | null) => void;
  /**
   * Jen ve Studiu: atributy anotace pro kartu podle indexu položky (např.
   * `editableDoc(id, "project")`). Karty jsou pixely v plátně, takže nad
   * kartou pod myší stojí neviditelný box s touhle anotací — klik na kartu
   * ve Studiu otevře její záznam. Bez propu (web) se nic nevykresluje.
   */
  editTarget?: (index: number) => Record<string, unknown>;
  className?: string;
  style?: CSSProperties;
}


export default function FlexCarousel({
  items,
  preset = "liquid",
  intro = "rise",
  hold = false,
  introSpeed = 1,
  cardHeight = 0.5,
  gap = 12,
  radius = 0,
  fit = "natural",
  aspect = 0,
  lensWidth,
  lensHeight,
  tilt,
  roundness,
  bend,
  reach,
  curl,
  dispersion,
  liquid,
  followCursor,
  squeeze = 0.2,
  focusOnClick = true,
  autoplay = false,
  interval = 4,
  captions = true,
  captureWheel = true,
  dim = 0,
  dimHover = 0,
  edgeBlur = 0,
  hoverPanel = false,
  onChange,
  controlsRef,
  onSelect,
  drift,
  editTarget,
  className,
  style,
}: FlexCarouselProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<FlexSettings | null>(null);
  const itemsRef = useRef(items);
  const engineRef = useRef<FlexEngine | null>(null);

  const [active, setActive] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [focusOpen, setFocusOpen] = useState(false);
  // Karty pro `editTarget` (boxy v px vůči kontejneru). Ve Studiu je myš
  // stránky vypnutá, takže hover nejde — box má každá kreslená karta. Engine
  // je hlásí každý snímek, stav se mění, jen když se některý pohne.
  type EditBox = { index: number; left: number; top: number; width: number; height: number };
  const [editBoxes, setEditBoxes] = useState<EditBox[]>([]);
  const editKeyRef = useRef("");
  const editingRef = useRef(Boolean(editTarget));
  useEffect(() => {
    editingRef.current = Boolean(editTarget);
  }, [editTarget]);

  const router = useRouter();
  const routerRef = useRef(router);
  const onChangeRef = useRef(onChange);
  const onSelectRef = useRef(onSelect);

  const base = BEND_PRESETS[preset] ?? BEND_PRESETS.liquid;
  const list = items;
  const itemsKey = list.map((item) => item.src).join("|");

  // Každý render přepíše, co engine čte; engine si to vyzvedne v příštím
  // snímku, wake() ho jen probudí.
  useEffect(() => {
    itemsRef.current = list;
    routerRef.current = router;
    onChangeRef.current = onChange;
    onSelectRef.current = onSelect;
    settingsRef.current = {
      intro,
      hold,
      introSpeed,
      cardHeight,
      gap,
      radius,
      fit,
      aspect,
      lensWidth: lensWidth ?? base.lensWidth,
      lensHeight: lensHeight ?? base.lensHeight,
      tilt: tilt ?? base.tilt,
      roundness: roundness ?? base.roundness,
      bend: bend ?? base.bend,
      reach: reach ?? base.reach,
      curl: curl ?? base.curl,
      dispersion: dispersion ?? base.dispersion,
      liquid: liquid ?? base.liquid,
      followCursor: followCursor ?? base.followCursor,
      squeeze,
      focusOnClick,
      autoplay,
      interval,
      captureWheel,
      dim,
      dimHover,
      edgeBlur,
      hover: hoverPanel,
      drift: drift ?? null,
    };
    engineRef.current?.wake();
  });

  // Posun ze scrollu se mění mimo render — engine spí, když se nic
  // nehýbe, takže ho každá změna musí probudit.
  useEffect(() => {
    if (!drift) return;
    return drift.on("change", () => engineRef.current?.wake());
  }, [drift]);

  useEffect(() => {
    engineRef.current?.setItems(itemsRef.current);
  }, [itemsKey]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const engine = createFlexCarousel(container, settingsRef, itemsRef, {
      onActive: (index) => {
        setActive(index);
        onChangeRef.current?.(index);
      },
      onRevealed: () => setRevealed(true),
      onFocusOpen: setFocusOpen,
      // Jen pro `editTarget` (Studio); jinak se hned vrátí.
      onBoxes: (boxes) => {
        if (!editingRef.current) return;
        const bounds = containerRef.current?.getBoundingClientRect();
        const next = boxes
          .map((box) => ({
            index: box.index,
            left: Math.round(box.left),
            top: Math.round(box.top),
            width: Math.round(box.right - box.left),
            height: Math.round(box.bottom - box.top),
          }))
          // Jen karty, které jsou v kontejneru aspoň zčásti vidět.
          .filter((box) => !bounds || (box.left + box.width > 0 && box.left < bounds.width && box.width > 4));
        const key = next.map((box) => `${box.index}:${box.left},${box.top},${box.width},${box.height}`).join("|");
        if (key === editKeyRef.current) return;
        editKeyRef.current = key;
        setEditBoxes(next);
      },
      // Kliknutí na aktivní kartu vede na projekt (bez přiblížení, když
      // je focusOnClick vypnuté).
      onSelect: (index) => {
        if (onSelectRef.current) {
          onSelectRef.current(index, containerRef.current);
          return;
        }
        const item = itemsRef.current[index];
        if (item?.href) void routerRef.current.push(item.href);
      },
    });
    engineRef.current = engine;
    if (controlsRef) {
      controlsRef.current = {
        next: () => engine?.step(1),
        previous: () => engine?.step(-1),
      };
    }

    return () => {
      if (controlsRef) controlsRef.current = null;
      engine?.destroy();
      engineRef.current = null;
    };
  }, [controlsRef]);

  const current = list[active] || list[0];
  const label = current ? current.title || current.alt || `Ukázka ${active + 1}` : "";


  return (
    <div
      ref={containerRef}
      className={[styles.root, className].filter(Boolean).join(" ")}
      style={
        {
          ...style,
          "--flex-carousel-half": `${Math.min(Math.max(cardHeight, 0.05), 1) * 50}%`,
        } as CSSProperties
      }
      role="region"
      aria-roledescription="carousel"
      aria-label="Ukázky prací"
      tabIndex={0}
    >
      {/* Studio: neviditelné boxy s anotací nad kartami (viz editTarget). */}
      {editTarget
        ? editBoxes.map((box, i) => (
            <div
              key={i}
              className={styles.editTarget}
              style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
              {...editTarget(box.index)}
            />
          ))
        : null}
      {/* Odkazy na projekty pro klávesnici a čtečky — hover je jen v plátně. */}
      <ul className={styles.live}>
        {list.map((item, index) =>
          item.href ? (
            <li key={`${item.src}-${index}`}>
              <Link href={item.href}>{item.title || item.alt}</Link>
            </li>
          ) : null,
        )}
      </ul>
      {captions && current && revealed ? (
        <div className={styles.caption} aria-hidden="true">
          <span key={active} className={styles.title}>
            {current.title || current.alt}
            {current.subtitle ? <span className={styles.subtitle}>{current.subtitle}</span> : null}
          </span>
          <span className={styles.count} data-hidden={focusOpen ? "" : undefined}>
            <Digits value={active + 1} />
            <span className={styles.slash}>/</span>
            <span>{String(list.length).padStart(2, "0")}</span>
          </span>
        </div>
      ) : null}
      <div className={styles.live} aria-live="polite" aria-atomic="true">
        {`${label}, ${active + 1} z ${list.length}`}
      </div>
    </div>
  );
}
