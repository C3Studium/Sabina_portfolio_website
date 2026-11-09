// OrbitCards — nastavení a vstupy.
//
// Tohle je React strana: propy s výchozími hodnotami, jejich předání
// enginu přes ref (engine je čte každý snímek, takže změna propu se
// projeví bez přestavby plátna), přístupnost (role, živý region, skrytý
// seznam pro čtečky, mezerník pro pauzu) a záloha bez WebGL.
//
// Shader a chování jsou v engine.ts, vzhled obalu ve styles.module.scss.
//
// Karty jedou po dráze, která od přední karty ubíhá do hloubky. Vidět
// je jen přední okno (`visible` karet), zbytek zhasne do stínu. Úvodní
// příjezd odzadu dopředu jde napojit na scroll přes `progress`.

import {
  forwardRef,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type SyntheticEvent,
} from "react";
import Link from "next/link";
import type { MotionValue } from "framer-motion";
import { useRefRegistry } from "@/providers/RefContext";
import { createCardOverlay, type OverlayController } from "./overlay";
import {
  createOrbit,
  isLight,
  readMotion,
  subscribeToMotion,
  type Controller,
  type OrbitCardsItem,
  type Settings,
} from "./engine";
import styles from "./styles.module.scss";

export type { OrbitCardsItem } from "./engine";

export interface OrbitCardsProps {
  /** Obrázky na kartách. Při count větším než počet se opakují dokola. */
  items?: OrbitCardsItem[];
  /** Počet karet na kruhu, 0 = tolik, kolik je položek. Strop 48. */
  count?: number;
  /** Karta, která je po úvodní animaci vpředu. */
  startIndex?: number;
  /** Poměr stran karty, šířka / výška. Bannery jsou 9:16 = 0.5625. */
  aspect?: number;
  /**
   * Úhel dráhy ve stupních: 0 = karty vedle sebe v rovině obrazovky,
   * kladný = řada ubíhá doprava do hloubky, záporný = doleva.
   */
  angle?: number;
  /** Mezera mezi kartami jako podíl šířky karty. */
  gap?: number;
  /**
   * Poloměr oběžné dráhy ve výškách karty. Velké číslo = jen mírně
   * zakřivený oblouk obří dráhy, 0 = rovná dráha.
   */
  orbit?: number;
  /**
   * Zhuštění rozestupů směrem dozadu, 0 = stejné rozestupy. Kladné =
   * řada se vzadu sbíhá jako rozevřený balíček.
   */
  stack?: number;
  /** Výška oblouku nad dráhou v půli viditelného okna, ve výškách karty. */
  arch?: number;
  /**
   * Zpoždění zadních karet za předními v sekundách na slot. Řada se při
   * tažení i scrollu rozvlní; 0 = všechny jedou spolu.
   */
  lag?: number;
  /** Překmit při dojezdu karet, 0 = žádný, 1 = výrazný. */
  bounce?: number;
  /**
   * Natočení karet kolem svislé osy ve stupních: kladné = pravá hrana
   * jde k divákovi, levá dozadu. Přední karta se narovná.
   */
  cardYaw?: number;
  /** Předklon karet ve stupních: kladný = horní hrana odchází dozadu. */
  cardLean?: number;
  /** Náhodný náklon navíc pro každou kartu, ve stupních. */
  jitter?: number;
  /** Zaoblení rohů v px (u přední karty). */
  radius?: number;
  /**
   * Náklon roviny dráhy ve stupních — kladný = vzdálené karty výš,
   * jako by se kamera na oběžnou dráhu dívala shora.
   */
  tilt?: number;
  /**
   * Natočení celé scény v rovině obrazovky ve stupních. Záporné = levá
   * strana nahoru, pravá dolů.
   */
  roll?: number;
  /**
   * Vzdálenost kamery od přední karty ve výškách karty — menší =
   * výraznější perspektiva (zadní karty rychleji ubývají).
   */
  distance?: number;
  /** Zvětšení viditelné části dráhy vůči boxu. */
  scale?: number;
  /**
   * Výška přední karty jako podíl výšky boxu (0.85 = 85 %). Když je
   * zadaná, velikost karet nezávisí na tvaru dráhy. 0 = vepsat řadu.
   */
  cardHeight?: number;
  /**
   * Posun řady po dráze ve slotech: přední karta se postaví na místo
   * slotu `anchor` (1 = o kartu dál) a karta před ní se objeví na jejím
   * dosavadním místě. 0 = beze změny.
   */
  anchor?: number;
  /** Kolik karet je vidět, než zbytek zhasne do stínu (lze i 4.5). */
  visible?: number;
  /** Jak moc karty vzadu tmavnou, 0–1. */
  shade?: number;
  /**
   * Kolik slotů karta ujede za přední pozici, než zmizí. Malé číslo =
   * zmizí hned; větší = odjede dál dopředu (třeba za prvek nad plátnem).
   */
  exit?: number;
  /** Ztlumení všech obrázků, jako černý překryv s touhle průhledností. */
  dim?: number;
  /** Ztlumení karty pod myší (plynule z `dim`). */
  dimHover?: number;
  /**
   * HTML vrstva nad kartou pod myší: rámeček ve stylu MeasureText,
   * titulek, text a odkaz. Jen pro myš.
   */
  hoverPanel?: boolean;
  /** Rychlost pásu v kartách za sekundu, kladná = karty jedou dopředu. */
  speed?: number;
  /** Síla rozostření karet mimo zaostřenou hloubku, 0–1. */
  aperture?: number;
  /** Jak moc vzdálené karty blednou do pozadí, 0–1. */
  haze?: number;
  /** Síla stínu pod kartou, 0–1. */
  shadow?: number;
  /** Úvodní příjezd odzadu dopředu (v čase, když chybí `progress`). */
  intro?: boolean;
  /**
   * Postup úvodního příjezdu 0–1, typicky z useScroll/useTransform.
   * 0 = karty jsou ještě vzadu ve stínu, 1 = stojí na místě.
   * Když je zadaný, příjezd řídí on místo času.
   */
  progress?: MotionValue<number>;
  /** Zastavit otáčení, když je nad ním kurzor. */
  pauseOnHover?: boolean;
  /** Otáčení tažením. */
  draggable?: boolean;
  /** Otáčení kolečkem myši (pak kolečko neskroluje stránku). */
  wheel?: boolean;
  /** Popisek přední karty. */
  captions?: boolean;
  /**
   * Usadit scénu do boxu rodiče místo vlastního. Pro plátno, které CSS
   * roztáhne přes rodiče, aby velké karty neořízla jeho hrana.
   */
  fitParent?: boolean;
  /** Barva pozadí, "transparent" = převezme se z rodiče. */
  backgroundColor?: string;
  paused?: boolean;
  /** Strop device pixel ratio. */
  dpr?: number;
  ariaLabel?: string;
  onFocusChange?: (item: OrbitCardsItem, index: number) => void;
  onSelect?: (item: OrbitCardsItem, index: number) => void;
  className?: string;
  style?: CSSProperties;
}

export interface OrbitCardsHandle {
  next: () => void;
  previous: () => void;
  show: (index: number) => void;
  release: () => void;
  replay: () => void;
}

// Ukázkové obrázky z předlohy — použijí se, jen když nepřijdou žádné items.
const defaultItems: OrbitCardsItem[] = [
  {
    src: "https://pro.reactbits.dev/demo-media/abstract-rose-balance.webp",
    alt: "Tilted raspberry rounded rectangle and tangerine disc on a rose-pink field",
    title: "Rose balance",
    subtitle: "A bright point of balance",
  },
  {
    src: "https://pro.reactbits.dev/demo-media/abstract-violet-steps.webp",
    alt: "Three interlocking violet and pink stepped planes with an amber edge",
    title: "Violet steps",
    subtitle: "Three planes in rhythm",
  },
  {
    src: "https://pro.reactbits.dev/demo-media/abstract-fuchsia-wave.webp",
    alt: "Broad fuchsia S-shaped band with a coral gradient across deep plum",
    title: "Fuchsia wave",
    subtitle: "One continuous curve",
  },
  {
    src: "https://pro.reactbits.dev/demo-media/abstract-coral-fold.webp",
    alt: "Broad vermilion and orange folded plane over deep plum with fine grain",
    title: "Coral fold",
    subtitle: "A bold change of direction",
  },
  {
    src: "https://pro.reactbits.dev/demo-media/abstract-amber-loop.webp",
    alt: "Tilted golden-amber loop on a grainy raspberry-purple field",
    title: "Amber loop",
    subtitle: "Warmth around an open center",
  },
  {
    src: "https://pro.reactbits.dev/demo-media/abstract-pink-eclipse.webp",
    alt: "Coral-pink disc crossing a violet diagonal plane on a grainy purple field",
    title: "Pink eclipse",
    subtitle: "A disc across the diagonal",
  },
  {
    src: "https://pro.reactbits.dev/demo-media/abstract-plum-ribbon.webp",
    alt: "Intersecting pink and plum diagonal ribbons on a coral-magenta field",
    title: "Plum ribbon",
    subtitle: "Two ribbons, one crossing",
  },
  {
    src: "https://pro.reactbits.dev/demo-media/abstract-orchid-orbit.webp",
    alt: "Fuchsia ring and peach crescent on a grainy orchid-purple field",
    title: "Orchid orbit",
    subtitle: "Color in orbit",
  },
];

export const OrbitCards = forwardRef<OrbitCardsHandle, OrbitCardsProps>(
  function OrbitCards(
    {
      items = defaultItems,
      count = 0,
      startIndex = 0,
      aspect = 0.5625,
      angle = 38,
      gap = 0.12,
      orbit = 0,
      stack = 0,
      arch = 0,
      lag = 0,
      bounce = 0,
      cardYaw = 0,
      cardLean = 0,
      jitter = 0,
      radius = 14,
      tilt = 0,
      roll = 0,
      distance = 3,
      scale = 1,
      cardHeight = 0,
      anchor = 0,
      visible = 4.5,
      shade = 0.6,
      exit = 0.3,
      dim = 0,
      dimHover = 0,
      hoverPanel = false,
      speed = 0,
      aperture = 0.45,
      haze = 0.3,
      shadow = 0.35,
      intro = true,
      progress,
      pauseOnHover = true,
      draggable = true,
      wheel = true,
      captions = true,
      fitParent = false,
      backgroundColor = "transparent",
      paused = false,
      dpr = 2,
      ariaLabel = "Ukázky prací. Najetím kartu zaostříte, kliknutím ji přivedete dopředu, tažením nebo šipkami posouváte řadu.",
      onFocusChange,
      onSelect,
      className,
      style,
    },
    ref,
  ) {
    const rootRef = useRef<HTMLDivElement>(null);
    const stageRef = useRef<HTMLDivElement>(null);
    const captionRef = useRef<HTMLDivElement>(null);
    const titleRef = useRef<HTMLSpanElement>(null);
    const subtitleRef = useRef<HTMLSpanElement>(null);
    const controllerRef = useRef<Controller | null>(null);
    const frameRef = useRef<HTMLCanvasElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const overlayRef = useRef<OverlayController | null>(null);
    // Položka, jejíž obsah panel ukazuje. Mění se jen při přechodu na jinou
    // kartu — pozice za snímek se píše rovnou do stylu, ne přes React.
    const [hoverItem, setHoverItem] = useState<number | null>(null);
    const registry = useRefRegistry();
    const registryKey = `orbit-cards:${useId()}`;
    const reduced = useSyncExternalStore(
      subscribeToMotion,
      readMotion,
      () => false,
    );
    const list = items.length ? items : defaultItems;
    const itemsRef = useRef(list);
    const [initialCard] = useState(() => Math.max(Math.round(startIndex), 0));
    const [active, setActive] = useState(initialCard % list.length);
    const [picked, setPicked] = useState<number | null>(null);
    const [held, setHeld] = useState(false);
    const [failed, setFailed] = useState(false);

    const settings: Settings = {
      count,
      aspect,
      angle,
      gap,
      orbit,
      stack,
      arch,
      lag,
      bounce,
      cardYaw,
      cardLean,
      jitter,
      radius,
      tilt,
      roll,
      distance,
      scale,
      cardHeight,
      anchor,
      visible,
      shade,
      exit,
      dim,
      dimHover,
      speed,
      aperture,
      haze,
      shadow,
      intro,
      progress: progress ?? null,
      pauseOnHover,
      draggable,
      wheel,
      captions,
      fitParent,
      backgroundColor,
      paused,
      dpr,
      reduced,
      held,
    };
    const settingsRef = useRef(settings);
    const callbacksRef = useRef({ onFocusChange, onSelect });

    // Každý render přepíše, co engine čte. Engine si změnu vyzvedne
    // v příštím snímku, sync() ho jen probudí.
    useEffect(() => {
      settingsRef.current = settings;
      itemsRef.current = list;
      callbacksRef.current = { onFocusChange, onSelect };
      controllerRef.current?.sync();
    });

    useEffect(() => {
      const root = rootRef.current;
      const stage = stageRef.current;
      const caption = captionRef.current;
      const title = titleRef.current;
      const subtitle = subtitleRef.current;
      if (!root || !stage || !caption || !title || !subtitle) return;

      // HTML vrstva nad kartou pod myší. Jen s myší — na dotyku hover není.
      const frameCanvas = frameRef.current;
      const panel = panelRef.current;
      const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
      const overlay =
        hoverPanel && fine && frameCanvas && panel
          ? createCardOverlay(root, frameCanvas, panel, {
              markColor: "rgba(255, 255, 255, 0.9)",
              pad: 10,
              specks: 12,
              drawIn: 0.45,
              onItem: setHoverItem,
            })
          : null;
      overlayRef.current = overlay;
      // Kurzor se nad kartou rozpadne do rohů rámečku, stejně jako nad
      // písmeny MeasureText.
      if (overlay) registry.register(registryKey, root, { rect: overlay.rect });

      const controller = createOrbit(
        root,
        stage,
        { caption, title, subtitle },
        settingsRef,
        itemsRef,
        initialCard,
        {
          onFeature: (index) => {
            setActive(index);
            const item = itemsRef.current[index];
            if (item) callbacksRef.current.onFocusChange?.(item, index);
          },
          onPick: (index) => setPicked(index),
          onSelect: (index) => {
            const item = itemsRef.current[index];
            if (!item) return;
            callbacksRef.current.onSelect?.(item, index);
            if (item.href) window.location.assign(item.href);
          },
          onOverlay: overlay ? (state) => overlay.update(state) : undefined,
        },
      );
      const cleanupOverlay = () => {
        if (overlay) registry.register(registryKey, null);
        overlay?.destroy();
        overlayRef.current = null;
      };
      if (!controller) {
        cleanupOverlay();
        const frame = requestAnimationFrame(() => setFailed(true));
        return () => cancelAnimationFrame(frame);
      }
      controllerRef.current = controller;
      return () => {
        controller.destroy();
        controllerRef.current = null;
        cleanupOverlay();
      };
    }, [initialCard, registry, registryKey, hoverPanel]);

    // Postup ze scrollu se mění mimo React render — engine spí, když se
    // nic nehýbe, takže ho každá změna musí probudit.
    useEffect(() => {
      if (!progress) return;
      return progress.on("change", () => controllerRef.current?.wake());
    }, [progress]);

    useImperativeHandle(
      ref,
      () => ({
        next: () => controllerRef.current?.step(1),
        previous: () => controllerRef.current?.step(-1),
        show: (index: number) => controllerRef.current?.show(index),
        release: () => controllerRef.current?.release(),
        replay: () => controllerRef.current?.replay(),
      }),
      [],
    );

    const backgroundValue = backgroundColor.trim().toLowerCase();
    const transparent = backgroundValue === "transparent" || backgroundValue === "";
    const light = !transparent && isLight(backgroundValue);
    const ink = transparent ? "currentColor" : light ? "#0a0a0a" : "#fafafa";
    const announced = picked !== null ? list[picked] : undefined;
    const hovered = hoverItem !== null ? list[hoverItem] : undefined;
    // Klik a stisk v panelu nesmí dojít k enginu — jinak by odkaz spustil
    // tažení řady nebo výběr karty místo navigace.
    const keepInPanel = (event: SyntheticEvent) => event.stopPropagation();

    return (
      <div
        ref={rootRef}
        className={[styles.root, className].filter(Boolean).join(" ")}
        style={{
          backgroundColor: transparent ? undefined : backgroundColor,
          color: ink,
          ...style,
        }}
        role="region"
        aria-roledescription="carousel"
        aria-label={ariaLabel}
        tabIndex={0}
        onKeyDown={(event) => {
          // Mezerník na kontejneru pozastaví / pustí otáčení.
          if (event.key === " " && event.target === event.currentTarget) {
            event.preventDefault();
            setHeld((value) => !value);
          }
        }}
      >
        {/* HTML vrstva leží UVNITŘ plochy enginu: pohyb myši nad panelem
            tak dál dochází k enginu a karta pod ním zůstane v hoveru. */}
        <div ref={stageRef} className={styles.stage}>
          {hoverPanel ? (
            <>
              <canvas ref={frameRef} className={styles.frame} aria-hidden="true" />
              <div ref={panelRef} className={styles.panel} data-shown="false">
                {hovered ? (
                  <div key={hoverItem} className={styles.panelInner}>
                    {hovered.title ? (
                      <span className={styles.panelTitle} style={{ "--i": 0 } as CSSProperties}>
                        {hovered.title}
                      </span>
                    ) : null}
                    {hovered.subtitle ? (
                      <span className={styles.panelText} style={{ "--i": 1 } as CSSProperties}>
                        {hovered.subtitle}
                      </span>
                    ) : null}
                    {hovered.href ? (
                      <Link
                        href={hovered.href}
                        className={styles.panelCta}
                        style={{ "--i": 2 } as CSSProperties}
                        onPointerDown={keepInPanel}
                        onClick={keepInPanel}
                      >
                        <span>{hovered.cta ?? "Zjistit víc"}</span>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                          <path d="M5 12h13M12 5.5 18.5 12 12 18.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </Link>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </>
          ) : null}
        </div>
        {failed ? (
          <div className={styles.fallback}>
            {list.slice(0, 8).map((item, index) => (
              // eslint-disable-next-line @next/next/no-img-element -- záloha bez WebGL, rozměry z propů
              <img
                key={`${item.src}-${index}`}
                src={item.src}
                alt={item.alt}
                style={{ width: 96, height: 96 / aspect, borderRadius: radius }}
              />
            ))}
          </div>
        ) : null}
        <ul className={styles.hidden}>
          {list.map((item, index) => (
            <li
              key={`${item.src}-${index}`}
              aria-current={index === active ? "true" : undefined}
            >
              {item.title
                ? `${item.title}${item.subtitle ? `, ${item.subtitle}` : ""}`
                : item.alt}
            </li>
          ))}
        </ul>
        <div aria-live="polite" className={styles.hidden}>
          {announced ? (announced.title ?? announced.alt) : ""}
        </div>
        <div ref={captionRef} aria-hidden="true" className={styles.caption}>
          <span ref={titleRef} className={styles.title} />
          <span ref={subtitleRef} className={styles.subtitle} />
        </div>
      </div>
    );
  },
);

OrbitCards.displayName = "OrbitCards";

export default OrbitCards;
