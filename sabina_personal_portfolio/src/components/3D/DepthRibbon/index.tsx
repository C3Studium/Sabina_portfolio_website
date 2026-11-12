// DepthRibbon — React strana.
//
// Propy s výchozími hodnotami, předání enginu přes ref (čte je každý snímek),
// popisek přiblížené karty s odkazem a přístupnost. Scéna a chování jsou
// v engine.ts, vzhled ve styles.module.scss.
//
//   <DepthRibbon items={…} path="knot" tour="ride" speed={0.4} />
//   ribbon.current?.step(1)       // další projekt
//   ribbon.current?.reveal(true)  // celá křivka

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import {
  createRibbon,
  MAX_ITEMS,
  type DepthRibbonItem,
  type DepthRibbonOrder,
  type DepthRibbonPath,
  type DepthRibbonTour,
  type RibbonBox,
  type RibbonController,
  type RibbonSettings,
} from "./engine";
import { PAGE_LEAVE_EVENT } from "@/motion/PageTransition";
import styles from "./styles.module.scss";

export type { DepthRibbonItem, DepthRibbonPath, DepthRibbonTour, DepthRibbonOrder } from "./engine";

export interface DepthRibbonProps {
  items: DepthRibbonItem[];
  /** Počet karet na křivce (položky se opakují). */
  count?: number;
  /** Tvar křivky: loop, knot (uzel), wave, ring (velký prstenec s jemnou vlnou). */
  path?: DepthRibbonPath;
  /** cycle = jízda a občas přehled, ride = jen jízda, overview = jen přehled. */
  tour?: DepthRibbonTour;
  /** sequence = položky po řadě, shuffle = zamíchané. */
  order?: DepthRibbonOrder;
  /** Po kolika sekundách jízdy přijde přehled (tour="cycle"). */
  interval?: number;
  /** Rychlost jízdy v kartách za sekundu. */
  speed?: number;
  /** Výška karty ve scéně. */
  cardSize?: number;
  /** Nejširší karta jako násobek výšky — strop pro obrázky na šířku. */
  maxWidth?: number;
  /** Zaoblení rohů, 0–1 kratší strany. */
  radius?: number;
  /** Odstup kamery od křivky. */
  offset?: number;
  /**
   * Klidový pohled: `ride` = jízda po dráze, `row` = hlavní karta na středu
   * a další ubíhají doprava; posun kamerou odtáhne do přehledu dráhy.
   */
  view?: "ride" | "row";
  /** `row`: šikmost pohledu v radiánech (0 = přesně z boku). */
  rowAngle?: number;
  /** `row`: kolik výšky plátna zabere hlavní karta (0–1). */
  rowFill?: number;
  /** `row`: jak daleko do přehledu odtáhne rychlý posun (0–1). */
  scope?: number;
  /** `row`: o kolik je hlavní karta větší než sousedky (0,6 = o 60 %). */
  rowScale?: number;
  /**
   * Mezera mezi hranami karet ve světových jednotkách (výška karty je
   * `cardSize`). Karty pak stojí podle skutečné šířky obrázku. 0 = po jedné
   * jednotce bez ohledu na šířku.
   */
  spacing?: number;
  /** Pravítka s dílky pod i nad řadou, tak daleko od dráhy (0 = nit středem karet). */
  rulerDrop?: number;
  /** `row`: krytí neaktivních karet 0–1 (hlavní a karta pod myší jsou plné). */
  rowDim?: number;
  /** `row`: krytí vzdálenějších karet (zadní část kruhu), ukážou se až při prudkém posunu. */
  rowBack?: number;
  /** `row`: po kolika sekundách klidu jet na další projekt (0 = vypnuto). Zásah návštěvníka ho pozdrží. */
  autoplay?: number;
  /** Glyfy ze sazby při posunu (slova a tvary jako u bannerů na úvodní stránce). */
  glyphs?: boolean;
  /** Popisek karty a rámeček při hoveru (jako galerie na úvodní stránce). */
  labels?: boolean;
  /** `row`: klik na hlavní kartu. Bez propu se otevře `href` položky. */
  onSelect?: (item: DepthRibbonItem, index: number) => void;
  /** Úběžník jako podíl šířky plátna (0,5 = střed). */
  vanishX?: number;
  /** Úběžník jako podíl výšky plátna (0,5 = střed, menší = výš). */
  vanishY?: number;
  fov?: number;
  /** Hustota mlhy do dálky. */
  fog?: number;
  /** Průhlednost nitě, po které karty jdou (0 = bez nitě). */
  thread?: number;
  shadow?: number;
  accentColor?: string;
  focusOnClick?: boolean;
  holdToReveal?: boolean;
  /** Popisek přiblížené karty s odkazem. */
  captions?: boolean;
  interactive?: boolean;
  draggable?: boolean;
  /**
   * Kolečko jede po křivce (jinak scrolluje stránku). Na dotyku pak scéna
   * bere i svislý tah — pro stránky, které samy nescrollují.
   */
  wheel?: boolean;
  /** Kde poslouchat kolečko, např. celá sekce (výchozí: jen plátno). Čte se při připojení. */
  wheelTarget?: () => HTMLElement | null;
  pauseOnHover?: boolean;
  seed?: number;
  paused?: boolean;
  dpr?: number;
  ariaLabel?: string;
  /** Text odkazu v popisku přiblížené karty. */
  linkLabel?: string;
  /** Atributy pro text odkazu (např. anotace Studia). */
  linkLabelAttrs?: Record<string, unknown>;
  onFocusChange?: (item: DepthRibbonItem | null, index: number) => void;
  /** Položka, ke které kamera právě jede. */
  onCurrentChange?: (index: number) => void;
  /**
   * Jen ve Studiu: atributy anotace pro kartu podle indexu položky (např.
   * `editableDoc(id, "project")`). Karty jsou pixely v plátně, takže nad
   * každou viditelnou stojí neviditelný box s anotací. Zároveň zastaví jízdu.
   */
  editTarget?: (index: number) => Record<string, unknown>;
  className?: string;
  /** Třída popisku přiblížené karty — stránka ho může přesunout jinam
   *  (výchozí poloha je dole uprostřed). */
  captionClassName?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

export interface DepthRibbonHandle {
  /** Rozjet o daný počet karet (se setrvačností). */
  travel: (cards: number) => void;
  /** Další / předchozí skupina (projekt). */
  step: (direction: 1 | -1) => void;
  focus: (index: number) => void;
  release: () => void;
  reveal: (show: boolean) => void;
}

const subscribeToMotion = (notify: () => void) => {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
};

const readMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M5 12h13M12 5.5 18.5 12 12 18.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const DepthRibbon = forwardRef<DepthRibbonHandle, DepthRibbonProps>(function DepthRibbon(
  {
    items,
    count = 72,
    path = "loop",
    tour = "cycle",
    order = "sequence",
    interval = 9,
    speed = 0.6,
    cardSize = 0.72,
    maxWidth = 1.3,
    radius = 0.04,
    offset = 1,
    vanishX = 0.5,
    vanishY = 0.5,
    view = "ride",
    rowAngle = 0.75,
    rowFill = 0.62,
    scope = 0.85,
    rowScale = 0.6,
    spacing = 0,
    rowDim = 1,
    rowBack = 1,
    autoplay = 0,
    glyphs = false,
    rulerDrop = 0,
    labels = true,
    onSelect,
    fov = 60,
    fog = 1,
    thread = 0.3,
    shadow = 0.5,
    accentColor = "#bec948",
    focusOnClick = true,
    holdToReveal = true,
    captions = true,
    interactive = true,
    draggable = true,
    wheel = true,
    wheelTarget,
    pauseOnHover = true,
    seed = 0,
    paused = false,
    dpr = 2,
    ariaLabel = "Galerie prací. Táhněte pro jízdu, podržením uvidíte celou dráhu, klik obrázek přiblíží.",
    linkLabel = "Zobrazit projekt",
    linkLabelAttrs,
    onFocusChange,
    onCurrentChange,
    editTarget,
    className,
    captionClassName,
    style,
    children,
  },
  ref,
) {
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<RibbonController | null>(null);
  const reduced = useSyncExternalStore(subscribeToMotion, readMotion, () => false);
  const [focused, setFocused] = useState(-1);
  const [lead, setLead] = useState(0);
  const [failed, setFailed] = useState(false);
  const [boxes, setBoxes] = useState<RibbonBox[]>([]);
  const list = items.slice(0, MAX_ITEMS);
  const itemsRef = useRef(list);
  const editing = Boolean(editTarget);

  const settings: RibbonSettings = {
    count,
    path,
    tour,
    order,
    interval,
    speed,
    cardSize,
    maxWidth,
    radius,
    offset,
    fov,
    fog,
    thread,
    shadow,
    accentColor,
    focusOnClick: focusOnClick && !editing,
    holdToReveal: holdToReveal && !editing,
    interactive,
    draggable,
    wheel,
    pauseOnHover,
    seed,
    paused: paused || editing,
    dpr,
    reduced,
    editing,
    vanishX,
    vanishY,
    view,
    rowAngle,
    rowFill,
    scope,
    labels,
    rowScale,
    spacing,
    rowDim,
    rowBack,
    autoplay,
    glyphs,
    rulerDrop,
  };
  const settingsRef = useRef(settings);
  const focusRef = useRef(onFocusChange);
  const currentRef = useRef(onCurrentChange);
  const wheelTargetRef = useRef(wheelTarget);
  const selectRef = useRef(onSelect);
  const router = useRouter();
  const routerRef = useRef(router);

  // Každý render přepíše, co engine čte; sync() ho probudí.
  useEffect(() => {
    settingsRef.current = settings;
    itemsRef.current = list;
    focusRef.current = onFocusChange;
    currentRef.current = onCurrentChange;
    selectRef.current = onSelect;
    routerRef.current = router;
    controllerRef.current?.sync();
  });

  useEffect(() => {
    const root = rootRef.current;
    const stage = stageRef.current;
    if (!root || !stage) return;
    const controller = createRibbon(root, stage, settingsRef, itemsRef, {
      onFocus: (index) => {
        setFocused(index);
        const item = index >= 0 ? itemsRef.current[index] ?? null : null;
        focusRef.current?.(item, index);
      },
      onCurrent: (index) => {
        setLead(index);
        currentRef.current?.(index);
      },
      onBoxes: setBoxes,
      onSelect: (index) => {
        const item = itemsRef.current[index];
        if (!item) return;
        if (selectRef.current) selectRef.current(item, index);
        else if (item.href) void routerRef.current.push(item.href);
      },
    }, wheelTargetRef.current?.() ?? stage);
    if (!controller) {
      const frame = requestAnimationFrame(() => setFailed(true));
      return () => cancelAnimationFrame(frame);
    }
    controllerRef.current = controller;
    // Odchod na jinou stránku (PageTransition, PAGE_LEAVE_EVENT): kamera
    // odjede do přehledu celé dráhy — nástup pozpátku.
    const leave = () => controller.leave();
    window.addEventListener(PAGE_LEAVE_EVENT, leave);
    return () => {
      window.removeEventListener(PAGE_LEAVE_EVENT, leave);
      controller.destroy();
      controllerRef.current = null;
    };
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      travel: (cards: number) => controllerRef.current?.travel(cards),
      step: (direction: 1 | -1) => controllerRef.current?.step(direction),
      focus: (index: number) => controllerRef.current?.focus(index),
      release: () => controllerRef.current?.release(),
      reveal: (show: boolean) => controllerRef.current?.reveal(show),
    }),
    [],
  );

  // Ve Studiu se nepřibližuje — popisek ukazuje kartu, ke které kamera jede,
  // aby text odkazu šel upravit.
  const current = focused >= 0 ? list[focused] : editing ? list[lead] ?? null : null;

  return (
    <div
      ref={rootRef}
      className={[styles.root, className].filter(Boolean).join(" ")}
      // Značka pro přechod stránek: stránka s dráhou zhasne později (odjezd).
      data-ribbon=""
      style={style}
      role="region"
      aria-roledescription="gallery"
      aria-label={ariaLabel}
      tabIndex={0}
      // Kolečko si bere galerie (je-li zapnuté) — Lenis ho nesmí scrollovat.
      data-lenis-prevent-wheel={wheel && interactive ? "" : undefined}
      data-cursor={editing ? undefined : "drag"}
    >
      <div ref={stageRef} className={styles.stage} data-own-touch={wheel ? "" : undefined} />

      {/* Bez WebGL: obrázky v řadě, každý ve svém poměru. */}
      {failed ? (
        <div className={styles.fallback}>
          {list.slice(0, 12).map((item, index) =>
            item.href ? (
              <Link key={`${item.src}-${index}`} href={item.href}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.src} alt={item.alt} />
              </Link>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={`${item.src}-${index}`} src={item.src} alt={item.alt} />
            ),
          )}
        </div>
      ) : null}

      {/* Studio: neviditelné boxy s anotací nad kartami (viz editTarget). */}
      {editTarget
        ? boxes.map((box, index) => (
            <div
              key={index}
              className={styles.editTarget}
              style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
              {...editTarget(box.item)}
            />
          ))
        : null}

      {/* Popisek přiblížené karty. Klik mimo odkaz kartu vrátí (engine). */}
      {captions && !failed ? (
        <div
          className={captionClassName ? `${styles.caption} ${captionClassName}` : styles.caption}
          data-open={current ? "" : undefined}
          aria-live="polite"
        >
          {current ? (
            <>
              <span className={styles.captionTitle}>{current.title || current.alt}</span>
              {current.subtitle ? <span className={styles.captionSubtitle}>{current.subtitle}</span> : null}
              {current.href ? (
                <Link className={styles.captionLink} href={current.href}>
                  <span {...linkLabelAttrs}>{linkLabel}</span>
                  <span className={styles.captionArrow}>
                    <ArrowIcon />
                  </span>
                </Link>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}

      {/* Odkazy pro klávesnici a čtečky — karty jsou jen v plátně. */}
      <ul className={styles.hidden}>
        {list
          .filter((item, index) => item.href && list.findIndex((other) => other.href === item.href) === index)
          .map((item) => (
            <li key={item.href}>
              <Link href={item.href!}>{item.title || item.alt}</Link>
            </li>
          ))}
      </ul>
      {children}
    </div>
  );
});

export default DepthRibbon;
