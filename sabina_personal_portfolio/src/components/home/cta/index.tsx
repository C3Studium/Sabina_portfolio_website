import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import Image from "next/image";
import dynamic from "next/dynamic";
import { motion, useMotionValue, useMotionValueEvent, useTransform, type MotionValue } from "framer-motion";
import ScrollBend, { type ScrollBendHandle, type ScrollBendItem } from "@/components/3D/ScrollBend";
import type { FlexControls } from "@/components/3D/FlexCarousel";
import { FLAT_LENS } from "../flat-lens";
import IntroBanners from "@/motion/intro/IntroBanners";
import { drawReviewCard } from "./review-card";
import SketchReveal from "@/components/common/sketch-reveal";
import MeasureText from "@/components/common/measure-text";
import TextMorph from "@/components/common/text-morph";
import { openContact } from "@/components/layout/contact-modal/open";
import { BuildFrame, SketchText, softMask } from "@/components/home/info/reveal";
import { ease, within, type Window } from "@/components/home/info/choreography";
import { editableDoc, editableIn } from "@c3studium/valecms/edit";
import type { HeroWord, Reference } from "@/lib/site/home";
import { lerp, PORTRAIT_PHONE, PORTRAIT_TABLET, useLandscapeFluid, useMedia } from "@/lib/fluid";
import Lines, {
  hasLines,
  picture,
  pictures,
  text,
  type CmsImage,
  type MarkedLine,
} from "../lines";
import styles from "./styles.module.scss";
import { ACCENT, SNOW_RGB } from "@/lib/palette";

const PortraitParticles = dynamic(() => import("@/components/common/particle-image"), { ssr: false });
// Telefon: pás recenzí stejnou galerií jako úvod (home/stacked) — přes celou
// šířku, ohyb za okraji (FLAT_LENS). WebGL a window — jen na klientovi.
const FlexCarousel = dynamic(() => import("@/components/3D/FlexCarousel"), { ssr: false });
// Za jak dlouho po načtení se částice portrétu připraví (pak ještě klid prohlížeče).
const PARTICLES_WARM_MS = 3000;

// Co sekce říká, když CMS mlčí — tytéž texty, jaké tu stály natvrdo.
// Zvýrazněné úseky jsou dekódované po slovech, jako to dělá server; koncová
// interpunkce („skutečný.") se při kreslení zase vyndá ven.
const FALLBACK = {
  // Nadpis sekce — tři obří slova, každé na vlastním řádku.
  title: "Začněme váš projekt",
  /** Které slovo nadpisu je zelené (pořadí od 0) — „VÁŠ". */
  titleAccent: 1,
  lead: [
    ["Každý projekt je jedinečný.", false],
    ["Řekněte mi o tom vašem.", true],
  ] as MarkedLine,
  action: "Nezávazná poptávka",
  status: [
    ["Odpovím do", false],
    ["24 hodin", true],
  ] as MarkedLine,
  // ZÁSTUPNÁ recenze podle návrhu — text, jméno i čísla čekají na skutečné.
  // Ve Studiu je to dokument v Recenzích; na webu se ukazuje první podle pořadí.
  review: {
    name: "Lucie K.",
    role: "Brand manažerka, LUNE",
    logo: null,
    stars: 5,
    text: [
      [
        "Sabina úplně proměnila náš vizuální styl. Bannery nejenom skvěle vypadají, ale hlavně přinášejí výsledky. Komunikace byla bez zádrhelů, termíny sedly a",
        false,
      ],
      ["dopad byl skutečný.", true],
    ],
  } as Reference,
  stats: [
    { value: "100+", label: "Odevzdaných bannerů" },
    { value: "50+", label: "Spokojených klientů" },
  ],
  claim: [
    [
      ["Design, který", false],
      ["spojuje,", true],
    ],
    [["mluví a prodává.", false]],
  ] as MarkedLine[],
  portrait: {
    src: "/assets/rest/main_photo.png",
    alt: "",
    width: 612,
    height: 1019,
  },
  // Perspektivní řada bannerů vpravo. Návrh má tři panely — tmavý, světlý
  // a teplý — aby se od sebe v perspektivě odlišily i bez ostrých hran.
  // Všechny tři assety jsou 4:5, ořez na povinný formát 3:4 je proto mírný.
  banners: [
    {
      src: "/assets/banners/bruzek_banner1.png",
      alt: "Bannerová kampaň pro realitní značku Bruzek",
      width: 973,
      height: 1216,
    },
    {
      src: "/assets/banners/vlnenezbozi_banner1.png",
      alt: "Bannerová kampaň pro e-shop Wooline",
      width: 1080,
      height: 1350,
    },
    {
      src: "/assets/banners/mistrpet_banner3.png",
      alt: "Bannerová kampaň pro e-shop Mistr Pet",
      width: 1080,
      height: 1350,
    },
  ],
};

// Zelené slovo nadpisu se dokola přelévá (TextMorph): „váš" ↔ „náš" projekt.
// Ve Studiu je to dokument Přelévaná slova (místo „Výzva"); tady záloha.
const TITLE_MORPH = {
  /** Druhá podoba zeleného slova, když dokument chybí. */
  alternates: ["náš"],
  /** Jak dlouho (s) každé slovo stojí. */
  every: 2.8,
};

// Nástup CTA — průběh jeho úseku dolly (0–1, kamera dorazí v ~0,44,
// process/steps.ts). Stejný jazyk jako první stránka, bez umělé myši:
// jeviště se rozsvítí, texty se postaví rámečkem (kontura → výplň), karta
// recenzí jako blok, portrét se nakreslí (SketchReveal jako v heru) a za
// ním se rozjedou bannery, linky se dokreslí, na konec claim a stav.
const ENTRY = {
  stage: [0.3, 0.5] as Window,
  headline: [0.44, 0.64] as Window,
  lead: [0.58, 0.7] as Window,
  /** Výzva se postaví; MeasureText (rámeček přes písmena) naskočí na konci. */
  action: [0.6, 0.74] as Window,
  review: [0.5, 0.68] as Window,
  /** Portrét se začne kreslit (čas, ne scroll — SketchReveal). */
  portrait: 0.48,
  /** Recenze: od kdy do kdy scroll posouvá pás (krok za každý úsek). */
  strip: [0.5, 0.95] as Window,
  stripStep: 0.11,
  swoosh: [0.62, 0.86] as Window,
  claim: [[0.72, 0.86], [0.76, 0.9]] as Window[],
  status: [0.8, 0.92] as Window,
};

// Pozadí vpravo: totéž co úvod hera — portrét s částicemi a za ním bannery,
// které se staví vrstvami (motion/intro) — jen ztlumené a zpomalené, ať
// nepoutá pozornost. Bannery z bloku CTA (galerie), pak další ukázky.
const BACKGROUND = {
  banners: [
    "/assets/banners/gummylife_banner1.png",
    "/assets/banners/samurai_banner1.png",
    "/assets/banners/bruzek_banner1.png",
    "/assets/banners/mistrpet_banner1.png",
    "/assets/banners/vecicky_banner16.png",
    "/assets/banners/jordan_banner4.png",
  ],
  /** Tempo stavby bannerů (× hero). */
  pace: 1.8,
  /** Částic na portrétu (hero má 300 000). */
  particles: 140000,
  /**
   * Odkud zleva smí stát slova a tvary kolem bannerů (část šířky okna) —
   * i pod pásem recenzí, kde prosvítají mezi kartami.
   */
  fieldLeft: 0.4,
  /**
   * Spodní linka bannerů (část výšky okna) — výš než v heru, za horní
   * polovinou postavy, ne u spodní hrany.
   */
  baseline: 0.62,
  /**
   * Za jak dlouho (s) po příjezdu se bannery rozmístí — kamera ještě
   * dojíždí a dlaždice je zvětšená; změřené pole by bannery nafouklo.
   */
  settle: 0.8,
};

// Zelená tečka na konci linky u claimu jezdí pružně tam a zpět.
const CLAIM_DOT = {
  /** Jak daleko od konce linky dojede (část délky linky). */
  travel: 0.55,
  spring: { type: "spring" as const, stiffness: 26, damping: 5, mass: 1 },
  /** Pauza na každém konci (s). */
  rest: 1.4,
};

// Pás recenzí (components/3D/ScrollBend): karty nakreslené jako DOM karta
// (review-card.ts), prohnutí při pohybu, přichycení; při nástupu ho posouvá
// scroll, pak se dá táhnout a sám co STRIP.autoAdvance s přejde na další.
// Prohnutí jen náznakem — karty mají zůstat čitelné a v klidu.
const STRIP = {
  bend: "direction" as const,
  strength: 0.55,
  maxBend: 0.14,
  // Méně pružné dojetí na kartu (0 = bez zhoupnutí).
  wobble: 0.05,
  response: 0.42,
  gap: 32,
  radius: 6,
  fade: 0.22,
  shade: 0.12,
  aberration: 0.12,
  inertia: 0.45,
  autoAdvance: 4.2,
};

// O kolik px se smí myš pohnout mezi stiskem a puštěním, aby to byl klik
// na výzvu — tažení písmen (MeasureText) modal neotevře.
const CLICK_SLOP = 6;

// ZÁSTUPNÉ recenze navíc (do pásu), dokud ve Studiu nejsou skutečné.
const MORE_REVIEWS: Reference[] = [
  {
    name: "Tomáš R.",
    role: "Majitel e-shopu, Vikio",
    logo: null,
    stars: 5,
    text: [
      ["Bannery na Black Friday jsme měli hotové dřív, než jsme čekali. Proklik se zvedl o třetinu a", false],
      ["kampaň se zaplatila první týden.", true],
    ],
  },
  {
    name: "Petra M.",
    role: "Marketing, Mistr Pet",
    logo: null,
    stars: 5,
    text: [
      ["Oceňuji, jak rychle Sabina pochopila naši značku. Každý formát sedí na svou síť a", false],
      ["vizuály drží jednotný styl.", true],
    ],
  },
  {
    name: "Jan K.",
    role: "Jednatel, Bruzek reality",
    logo: null,
    stars: 5,
    text: [
      ["Spolupráce bez zbytečných kol připomínek. Zadání, koncept, hotovo — a", false],
      ["výsledky, které je vidět na poptávkách.", true],
    ],
  },
];

// Kde v `items` bloku `index.cta` co bydlí — musí sedět na src/lib/cms/home.ts.
// Recenze v bloku není: je to dokument (prop `references`).
const AT = { lead: 0, action: 1, status: 2, stats: 3, claim: 5 };

// Blok `index.cta`, jak ho tvaruje src/lib/cms/home.ts.
export type CtaCopy = {
  docId?: string;
  eyebrow?: string;
  heading?: { text?: string; lines?: MarkedLine[]; mark?: string };
  labels?: MarkedLine[];
  labelMark?: string;
  action?: string;
  stats?: { value?: string; label?: string }[];
  portrait?: CmsImage | null;
  gallery?: CmsImage[] | string;
};

/** Monogram, když recenze nemá logo: firma za čárkou v pozici, jinak jméno. */
const monogram = (review: Reference) => {
  const company = review.role.split(",").pop()?.trim();
  const word = (company || review.name).split(/\s+/)[0] ?? "";
  return word.charAt(0).toUpperCase() + word.slice(1, 4).toLowerCase();
};

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path
        d="M5 12h13M12 5.5 18.5 12 12 18.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="m12 2.6 2.9 5.9 6.5.9-4.7 4.6 1.1 6.4-5.8-3-5.8 3 1.1-6.4L2.6 9.4l6.5-.9z" />
    </svg>
  );
}

function QuoteIcon() {
  return (
    <svg viewBox="0 0 32 24" fill="currentColor" aria-hidden="true">
      <path d="M0 24V13.4C0 6 3.9 1.3 11.2 0l1.3 3.9C8.2 5.3 6 7.7 5.8 11h5.4v13H0Zm18.8 0V13.4C18.8 6 22.7 1.3 30 0l1.3 3.9c-4.3 1.4-6.5 3.8-6.7 7.1H30v13H18.8Z" />
    </svg>
  );
}

// Obsah výzvy: zelená slova (každé na řádku) a kroužek se šipkou vedle.
// `measure` = slova a kroužek nesou značky MeasureText (rámeček přes písmena
// a kolem tlačítka); bez nich jde o kopii pro konturu SketchText, nebo
// o editační rám Studia, kde zůstává jen text.
function ActionBody({
  label,
  measure,
  edit,
}: {
  label: string;
  measure: boolean;
  edit?: Record<string, unknown>;
}) {
  const words = label.split(/\s+/).filter(Boolean);
  return (
    <span className={styles.actionBody}>
      <span className={styles.actionLabel} {...edit}>
        {measure
          ? words.map((word, i) => (
              <span key={i}>
                <span data-measure="">{word}</span>
                {i < words.length - 1 ? " " : null}
              </span>
            ))
          : label}
      </span>
      <span className={styles.actionDisc} data-measure-frame={measure ? "" : undefined} aria-hidden="true">
        <ArrowIcon />
      </span>
    </span>
  );
}

// Tenká linka z návrhu, která obtáčí kartu recenze a míří k bannerům.
// viewBox drží proporce plátna z Figmy (1165x646), takže se souřadnice
// dají odečítat přímo z návrhu. preserveAspectRatio="none" nechá kresbu
// roztáhnout přes celou sekci; non-scaling-stroke pak brání tomu, aby se
// s ní roztáhla i tloušťka čáry.
function Swoosh({ draw }: { draw?: MotionValue<number> }) {
  return (
    <svg
      className={styles.swoosh}
      viewBox="0 0 1165 646"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <g
        fill="none"
        stroke={`rgba(${SNOW_RGB}, 0.42)`}
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
      >
        <motion.path d="M306 349c-15 104 45 186 180 225" style={draw ? { pathLength: draw } : undefined} />
        <motion.path d="M686 286c56 44 76 82 91 118 23 58 79 82 144 90" style={draw ? { pathLength: draw } : undefined} />
      </g>
      <motion.circle cx="777" cy="404" r="4.5" fill={ACCENT} style={draw ? { opacity: draw } : undefined} />
    </svg>
  );
}

/**
 * CTA — poslední dlaždice dolly v Procesu (process/index.tsx), ne vlastní
 * sekce. Dlaždice je přes celý rám uprostřed: z dálky je to zarámované,
 * ztlumené okno („portál"), které se s příjezdem kamery rozroste přes celou
 * obrazovku. Rámeček, ztlumení a podklad řídí CSS proměnná --dolly-t
 * z DollyGallery (styles: .portal*). Obsah nastupuje podle `progress`
 * (průběh úseku CTA, ENTRY nahoře); bez něj (nebo se `still`) stojí hotový.
 */
export default function Cta({
  copy = null,
  references = null,
  words = null,
  progress,
  still: forcedStill = false,
  instant = false,
}: {
  copy?: CtaCopy | null;
  references?: Reference[] | null;
  /** Přelévané zelené slovo nadpisu (dokument `heroWord`, místo „cta"). */
  words?: HeroWord[] | null;
  /** Průběh úseku CTA v dolly (0–1). */
  progress?: MotionValue<number>;
  /** Hotový stav bez nástupu (Studio, úzké okno). */
  still?: boolean;
  /**
   * Bez nástupových efektů, ale s živými částmi (3D pás recenzí) — telefon
   * (home/stacked). Portrét stojí rovnou, nekreslí se skicou.
   */
  instant?: boolean;
}) {
  const still = forcedStill || !progress;
  const done = useMotionValue(1);
  const p = progress ?? done;
  const stageIn = useTransform(p, (v) => (still ? 1 : ease(within(ENTRY.stage)(v))));
  const stageScale = useTransform(stageIn, (v) => 0.92 + 0.08 * v);
  const swoosh = useTransform(p, (v) => (still ? 1 : ease(within(ENTRY.swoosh)(v))));
  const reviewMask = useTransform(p, (v) => softMask(still ? 1 : ease(within(ENTRY.review)(v)), "180deg"));
  const statusMask = useTransform(p, (v) => softMask(still ? 1 : ease(within(ENTRY.status)(v))));
  // Portrét se nakreslí, když kamera dorazí (a zase zmizí, když se vrátí).
  const [arrived, setArrived] = useState(still);
  // Částice jako v heru: jen na šířku od md, na notebooku čtvrtina a 0,25px.
  const fluid = useLandscapeFluid();
  // Na výšku stojí pás recenzí vodorovně mezi podtitulem a výzvou (styles,
  // blok xs-v) — karty zůstávají na výšku, jede jen pás.
  const portraitLayout = useMedia(PORTRAIT_TABLET);
  const stripOrientation = portraitLayout ? "horizontal" : "vertical";
  const phoneLayout = useMedia(PORTRAIT_PHONE);
  // Zelené slovo nadpisu se po příjezdu dokola přelévá (TITLE_MORPH).
  const [titleWord, setTitleWord] = useState(0);
  useEffect(() => {
    if (!arrived || still) return;
    const timer = window.setInterval(() => setTitleWord((w) => w + 1), TITLE_MORPH.every * 1000);
    return () => window.clearInterval(timer);
  }, [arrived, still]);
  // Bannery až po dojezdu kamery (BACKGROUND.settle), pryč hned s odjezdem.
  const [bannersOn, setBannersOn] = useState(false);
  useEffect(() => {
    const on = arrived && !still;
    const timer = window.setTimeout(() => setBannersOn(on), on ? BACKGROUND.settle * 1000 : 0);
    return () => window.clearTimeout(timer);
  }, [arrived, still]);
  // Částice portrétu se připraví předem, v klidu chvíli po načtení: vytvoření
  // plátna WebGL a překlad shaderů (~0,1 s) by jinak zasekly scroll přesně
  // v okamžiku příjezdu kamery. Do příjezdu stojí schované a zastavené.
  const [warm, setWarm] = useState(false);
  useEffect(() => {
    if (still) return;
    let idle = 0;
    const timer = window.setTimeout(() => {
      const ready = () => setWarm(true);
      if (typeof window.requestIdleCallback === "function") idle = window.requestIdleCallback(ready, { timeout: 3000 });
      else ready();
    }, PARTICLES_WARM_MS);
    return () => {
      window.clearTimeout(timer);
      if (idle) window.cancelIdleCallback(idle);
    };
  }, [still]);
  const particlesLive = !still && arrived;
  // Výzva postavená → MeasureText změří slova (kamera už stojí, dlaždice
  // má měřítko 1) a pustí rámeček přes písmena jako v heru.
  const [built, setBuilt] = useState(false);
  useMotionValueEvent(p, "change", (v) => {
    setArrived(still || v >= ENTRY.portrait);
    setBuilt(!still && v >= ENTRY.action[1]);
  });
  // Klik na výzvu otevře kontaktní modal — jen když se myš nehnula (tažení
  // písmen není klik). MeasureText si při stisku zachytí ukazatel (tažení
  // písmen), takže tlačítko `click` nedostane — stisk a puštění se čtou na
  // obalu, kam z MeasureText probublají. `click` zůstává pro klávesnici.
  const press = useRef<{ x: number; y: number } | null>(null);
  const onActionDown = (event: ReactPointerEvent) => {
    // Jen stisk na tlačítku (ne v okraji pro popisek kolem něj).
    const onButton = (event.target as Element).closest?.("button");
    press.current = event.button === 0 && onButton ? { x: event.clientX, y: event.clientY } : null;
  };
  const onActionUp = (event: ReactPointerEvent) => {
    const start = press.current;
    press.current = null;
    if (!start || Math.hypot(event.clientX - start.x, event.clientY - start.y) > CLICK_SLOP) return;
    openContact();
  };
  const onActionKey = (event: ReactMouseEvent) => {
    if (event.detail === 0) openContact();
  };

  // Pás recenzí: při nástupu ho scroll posouvá o kartu za každý úsek
  // (ENTRY.stripStep) — přichycení pás prohne.
  const strip = useRef<ScrollBendHandle>(null);
  const flexStrip = useRef<FlexControls | null>(null);
  const stripStep = useRef<number | null>(null);
  useMotionValueEvent(p, "change", (v) => {
    if (still || v < ENTRY.strip[0] || v > ENTRY.strip[1]) {
      stripStep.current = null;
      return;
    }
    const step = Math.floor((v - ENTRY.strip[0]) / ENTRY.stripStep);
    if (stripStep.current !== null && step !== stripStep.current) {
      const nav = strip.current ?? flexStrip.current;
      if (step > stripStep.current) nav?.next();
      else nav?.previous();
    }
    stripStep.current = step;
  });
  // Portrét pro částice; bannery se rozmístí v širším poli kolem něj.
  const portraitRef = useRef<HTMLImageElement>(null);
  const bannerAreaRef = useRef<HTMLDivElement>(null);
  const edit = editableIn(copy?.docId ?? null);

  const labels = hasLines(copy?.labels) ? copy.labels : null;
  // Jeden popisek z bloku, nebo záloha — prázdný řádek je „nic nenapsáno".
  const line = (index: number, fallback: MarkedLine) => {
    const own = labels?.[index];
    return own && own.length ? own : fallback;
  };

  // Nadpis je pole `title` bloku (dřív nadtitulek); dlouhá otázka
  // z `headline` se už nekreslí.
  const title = text(copy?.eyebrow, FALLBACK.title);
  const editing = Boolean(copy?.docId);
  const mark = copy?.labelMark;
  const lead = line(AT.lead, FALLBACK.lead);
  const action = text(copy?.action, FALLBACK.action);
  const status = line(AT.status, FALLBACK.status);
  // První recenze podle pořadí; bez dokumentů ta zástupná z kódu.
  const review = references?.[0] ?? FALLBACK.review;
  const editReview = editableIn(review.id ?? null);
  // Recenze do pásu: ze Studia, nebo zástupná + další zástupné.
  const reviews = references?.length ? references : [FALLBACK.review, ...MORE_REVIEWS];
  // Popisek čísla, který jen opakuje text recenze, se nekreslí — recenze
  // stojí nahoře v kartě celá (v bloku Studia zůstal řádek se starou
  // recenzí, který se čte jako první číslo).
  const plain = (value: string) => value.replace(/\*/g, "").replace(/\s+/g, " ").trim();
  const quotes = new Set(reviews.map((r) => plain(r.text.map(([run]) => run).join(" "))));
  // DOM karta (Studio) — pozice sedí s řádky bloku (anotace `items.N`).
  const stats = FALLBACK.stats.map((stat, index) => {
    const label = text(copy?.stats?.[index]?.label, stat.label);
    return {
      value: text(copy?.stats?.[index]?.value, stat.value),
      label: quotes.has(plain(label)) ? "" : label,
    };
  });
  // Nakreslené karty: jen čísla ze Studia (řádek se starou recenzí —
  // „Lucie K." + citace — vypadne), zbytek doplní zálohy.
  const numbers = (copy?.stats ?? []).filter((stat) => stat?.value && /\d/.test(stat.value));
  const cardStats = FALLBACK.stats.map((stat, index) => {
    const own = numbers[index];
    return own ? { value: own.value!, label: text(own.label, stat.label) } : stat;
  });
  const claim = FALLBACK.claim.map((row, index) => line(AT.claim + index, row));
  const portrait = picture(copy?.portrait, FALLBACK.portrait);
  const gallery = pictures(copy?.gallery);
  const banners = FALLBACK.banners.map((banner, index) => picture(gallery[index], banner));
  const bannerSources = [...new Set([...banners.map((banner) => banner.src), ...BACKGROUND.banners])];
  const reviewsKey = reviews.map((r) => `${r.name}|${r.role}`).join("\n");
  const statsKey = cardStats.map((st) => `${st.value}|${st.label}`).join("\n");
  const rootRef = useRef<HTMLDivElement>(null);
  const [cards, setCards] = useState<{ items: ScrollBendItem[]; aspect: number } | null>(null);
  // Karty se kreslí do plátna rozměrem DOM karty (.reviewFrame) a písmem
  // stránky, až jsou písma načtená.
  useEffect(() => {
    if (still) return;
    let cancelled = false;
    // Překreslit jen při skutečně jiném rozměru karty. iOS posílá `resize`
    // pokaždé, když se při scrollu schová/ukáže lišta Safari — dřív se tím
    // uprostřed scrollu znovu kreslily a nahrávaly všechny karty do GPU.
    let drawn = "";
    let timer = 0;
    const draw = () => {
      const frame = rootRef.current?.querySelector<HTMLElement>(`.${styles.reviewFrame}`);
      if (!frame || cancelled) return;
      const width = frame.offsetWidth;
      const height = frame.offsetHeight;
      if (!width || !height) return;
      const size = `${width}x${height}`;
      if (size === drawn) return;
      drawn = size;
      const family = getComputedStyle(rootRef.current ?? document.body).fontFamily;
      const version = Date.now();
      setCards({
        aspect: width / height,
        items: reviews.map((review, i) => ({
          src: `review-${i}-${version}`,
          alt: `${review.text.map(([run]) => run).join(" ")} — ${review.name}, ${review.role}`,
          canvas: drawReviewCard(
            { text: review.text, name: review.name, role: review.role, stars: review.stars, monogram: monogram(review), stats: cardStats },
            width,
            height,
            family,
            // Telefon: ostřejší plátno a větší písmo (nízká karta).
            phoneLayout ? 3 : 2,
            phoneLayout ? 1.8 : 1,
          ),
        })),
      });
    };
    const onResize = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(draw, 200);
    };
    void document.fonts.ready.then(draw);
    window.addEventListener("resize", onResize);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.removeEventListener("resize", onResize);
    };
    // Klíče místo polí — pole se tvoří každý render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [still, reviewsKey, statsKey, phoneLayout]);

  // Telefon: nakreslené karty jako obrázky pro FlexCarousel (bez textové
  // vrstvy — položky nemají název ani odkaz).
  const flexCards = useMemo(
    () =>
      phoneLayout && cards
        ? cards.items.map((item) => ({ src: item.canvas ? item.canvas.toDataURL("image/png") : item.src, alt: item.alt ?? "" }))
        : null,
    [phoneLayout, cards],
  );

  return (
    // Proces má kurzor „Vy" (data-cursor="user"); v CTA zpátky tečka, která
    // se nad výzvou rozloží do rohů a nad pásem recenzí ukáže „Táhnout".
    <div ref={rootRef} className={styles.cta} data-cursor={arrived ? "dot" : undefined}>
      {/* Podklad okna — dokud je CTA daleko, je to průhled jinam. */}
      <div className={styles.portalBackdrop} aria-hidden="true" />

      {/* Tmavé „jeviště" — velký kruh z návrhu, na kterém stojí fotka
          i bannery. Leží nad sdíleným gradientem, ne místo něj. */}
      <motion.div className={styles.stage} style={{ opacity: stageIn, scale: stageScale }} aria-hidden="true" />
      <Swoosh draw={still ? undefined : swoosh} />

      {/* Bannery za portrétem — jako úvod hera, ztlumené a zpomalené. Až po
          příjezdu kamery: rozmístí se podle portrétu v plné velikosti. */}
      <div ref={bannerAreaRef} className={styles.bannerArea} aria-hidden="true" />
      {!still && bannersOn ? (
        <IntroBanners
          sources={bannerSources}
          area={bannerAreaRef}
          show={bannersOn}
          pace={BACKGROUND.pace}
          fieldLeft={BACKGROUND.fieldLeft}
          baseline={BACKGROUND.baseline}
          className={styles.backgroundBanners}
        />
      ) : null}

      <div className={styles.inner}>
        {/* ---------- Text a výzva ---------- */}
        <div className={styles.intro}>
          {/* Tři obří slova — řádky láme šířka (min-content), text zůstává
              jedním polem pro Studio. */}
          <h2 className={styles.headline} {...edit("title")}>
            <SketchText
              progress={p}
              from={ENTRY.headline[0]}
              to={ENTRY.headline[1]}
              tag="T · Nadpis"
              still={still}
              style={{ display: "block" }}
            >
              {title.split(/\s+/).map((word, i, all) => {
                const accent = i === FALLBACK.titleAccent;
                // Zelené slovo: obě podoby z dokumentu, co chybí, dodá nadpis
                // (slovo v nadpisu) a TITLE_MORPH (druhá podoba).
                const doc = words?.[0];
                const shown = accent ? text(doc?.final, word) : word;
                const choices = [shown, doc?.intro || TITLE_MORPH.alternates[0]].filter(Boolean);
                return (
                  <span key={i} className={accent ? styles.accent : undefined}>
                    {accent && editing ? (
                      // Ve Studiu vlastní dokument: klik otevře obě podoby.
                      <span {...editableDoc(doc?.id ?? null, "heroWord")}>{shown}</span>
                    ) : accent && !still ? (
                      <TextMorph words={choices} index={titleWord % choices.length} measure={false} />
                    ) : (
                      shown
                    )}
                    {i < all.length - 1 ? " " : null}
                  </span>
                );
              })}
            </SketchText>
          </h2>

          {/* Druhá věta je v návrhu tučná a na vlastním řádku — dělá to <strong>
              ve stylech, tady je to zvýrazněný úsek. */}
          <SketchText
            as="p"
            progress={p}
            from={ENTRY.lead[0]}
            to={ENTRY.lead[1]}
            still={still}
            className={styles.lead}
            {...edit(`items.${AT.lead}.label`, "text", mark)}
          >
            <Lines lines={[lead]} markTag="strong" />
          </SketchText>

          {/* Výzva: zelená slova a tlačítko v jednom obalu MeasureText —
              rámeček s rozměry přejíždí po písmenech i kolem kroužku, jako
              nadpis hera, a ukazuje, kam kliknout. Klik otevře modal. */}
          <div className={styles.actionHit} onPointerDown={onActionDown} onPointerUp={onActionUp} data-contact-zone="">
          <MeasureText enabled={built && !editing} sweep={built} className={styles.actionMeasure}>
            <button type="button" className={styles.action} onClick={onActionKey}>
              <SketchText
                progress={p}
                from={ENTRY.action[0]}
                to={ENTRY.action[1]}
                still={still}
                style={{ display: "block" }}
                ghost={<ActionBody label={action} measure={false} />}
              >
                <ActionBody label={action} measure={!editing} edit={edit(`items.${AT.action}.label`)} />
              </SketchText>
            </button>
          </MeasureText>
          </div>
        </div>

        {/* Anotace na <p>, ne na spanu: <p> je flex s gap a text před
            zvýrazněním je vlastní položka — obal by tu mezeru sebral. */}
        <motion.p
          className={styles.status}
          style={{ maskImage: statusMask, WebkitMaskImage: statusMask }}
          {...edit(`items.${AT.status}.label`, "text", mark)}
        >
          <span className={styles.statusDot} aria-hidden="true" />
          <Lines lines={[status]} markClass={styles.accent} />
        </motion.p>

        {/* ---------- Mockup recenze ----------
            POZOR: text, jméno i čísla jsou zástupné podle návrhu.
            Před spuštěním je nutné nahradit skutečnou referencí — ve Studiu. */}
        {/* Recenze je dokument (Recenze ve Studiu): jméno, logo, text,
            hvězdičky. Čísla pod ní jsou ručně psané texty bloku sekce. */}
        {still ? null : (
          <div className={styles.reviewFrame} aria-hidden="true">
            <BuildFrame progress={p} from={ENTRY.review[0]} to={ENTRY.review[1]} tag="Recenze" size marks />
          </div>
        )}
        {/* Pás recenzí ve 3D (ScrollBend): karty se při pohybu prohnou, dají
            se táhnout (kurzor „Táhnout"). Ve Studiu a na úzkém okně DOM karta. */}
        {still ? null : (
          <motion.div
            className={styles.reviewStrip}
            data-cursor="drag"
            style={{ maskImage: reviewMask, WebkitMaskImage: reviewMask }}
          >
            {flexCards ? (
              <FlexCarousel
                items={flexCards}
                intro="fade"
                cardHeight={0.92}
                gap={20}
                squeeze={0.15}
                focusOnClick={false}
                captions={false}
                controlsRef={flexStrip}
                fit="natural"
                radius={STRIP.radius}
                autoplay
                interval={STRIP.autoAdvance}
                dim={0.5}
                dimHover={0}
                {...FLAT_LENS}
              />
            ) : cards ? (
              <ScrollBend
                key={stripOrientation}
                ref={strip}
                items={cards.items}
                orientation={stripOrientation}
                itemSize={1}
                aspectRatio={cards.aspect}
                autoScroll={0}
                wheelSpeed={0}
                snap
                infinite
                pauseOnHover
                ariaLabel="Recenze klientů"
                {...STRIP}
              />
            ) : null}
          </motion.div>
        )}
        {still ? (
        <figure
          className={styles.review}
          {...editableDoc(review.id ?? null, "reference")}
        >
          <span className={styles.reviewMark} aria-hidden="true">
            <QuoteIcon />
          </span>

          <blockquote
            className={styles.reviewText}
            {...editReview("text", "text", "highlight")}
          >
            <Lines lines={[review.text]} markClass={styles.accent} trailClass="" />
          </blockquote>

          <figcaption className={styles.reviewAuthor}>
            {review.logo?.src ? (
              <span className={styles.reviewAvatar} {...editReview.image("logo")}>
                <Image
                  src={review.logo.src}
                  alt=""
                  width={review.logo.width ?? 96}
                  height={review.logo.height ?? 96}
                  className={styles.reviewLogo}
                  sizes="48px"
                />
              </span>
            ) : (
              // Bez loga monogram firmy — kulisa, nikoli text k úpravě.
              <span className={styles.reviewAvatar} aria-hidden="true">
                {monogram(review)}
              </span>
            )}
            <span className={styles.reviewName}>
              <strong {...editReview("name")}>{review.name}</strong>
              {review.role ? (
                <span className={styles.reviewRole} {...editReview("role")}>
                  {review.role}
                </span>
              ) : null}
            </span>
            <span className={styles.reviewStars} aria-label={`Hodnocení ${review.stars} z 5`}>
              {Array.from({ length: review.stars }, (_, i) => (
                <StarIcon key={i} />
              ))}
            </span>
          </figcaption>

          <div className={styles.reviewStats}>
            {stats.map((stat, index) => (
              <div key={index} className={styles.stat}>
                <span
                  className={styles.statValue}
                  {...edit(`items.${AT.stats + index}.value`)}
                >
                  {stat.value}
                </span>
                {stat.label ? (
                  <span
                    className={styles.statLabel}
                    {...edit(`items.${AT.stats + index}.label`)}
                  >
                    {stat.label}
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        </figure>
        ) : null}

        {/* ---------- Portrét ---------- */}
        <div className={styles.portrait} {...edit.image("image")}>
          {/* Nakreslí se jako portrét v heru: linky → klidné prolnutí barev. */}
          <SketchReveal show={arrived} enabled={!still && !instant} className={styles.portraitLayer}>
            <Image
              ref={portraitRef}
              src={portrait.src}
              alt={portrait.alt}
              width={portrait.width}
              height={portrait.height}
              className={styles.portraitImage}
              sizes="(max-width: 1100px) 60vw, 28vw"
            />
            {/* Tytéž částice jako portrét v heru, jen jich je méně. */}
            {!still && (warm || arrived) && fluid.on ? (
              <PortraitParticles
                src={portrait.src}
                targetRef={portraitRef}
                className={particlesLive ? styles.portraitParticles : `${styles.portraitParticles} ${styles.portraitParticlesHold}`}
                particleCount={Math.round(lerp(BACKGROUND.particles / 4, BACKGROUND.particles, fluid.t) / 5000) * 5000}
                particleSize={lerp(0.25, 1, fluid.t)}
                particleOpacity={0.4}
                additive={false}
                bleed={72}
                alphaThreshold={24}
                speed={0.35}
                noiseScale={0.002}
                noiseStrength={0.025}
                damping={0.96}
                lifespan={320}
                cursorInteraction
                cursorStrength={0.02}
                cursorRadius={120}
                dpr={1.5}
                paused={!particlesLive}
              />
            ) : null}
          </SketchReveal>
        </div>

      </div>

      {/* ---------- Claim v patě sekce ---------- */}
      {/* Dva řádky = dvě položky, každá anotovaná zvlášť: <p> má i třetí,
          dekorativní dítě (linku), takže anotace `lines` na něm nejde. */}
      <p className={styles.claim}>
        {claim.map((row, index) => (
          <SketchText
            key={index}
            progress={p}
            from={ENTRY.claim[index]?.[0] ?? 0}
            to={ENTRY.claim[index]?.[1] ?? 1}
            still={still}
            {...edit(`items.${AT.claim + index}.label`, "text", mark)}
          >
            <Lines lines={[row]} markClass={styles.accent} trailClass="" />
          </SketchText>
        ))}
        <span className={styles.claimRule} aria-hidden="true">
          <motion.span
            className={styles.claimDot}
            initial={{ x: 0 }}
            animate={still ? { x: 0 } : { x: `${-CLAIM_DOT.travel * 100}cqw` }}
            transition={{ ...CLAIM_DOT.spring, repeat: Infinity, repeatType: "reverse", repeatDelay: CLAIM_DOT.rest }}
          />
        </span>
      </p>

      {/* Ztlumení a rámeček okna, dokud CTA nedorazí. */}
      <div className={styles.portalVeil} aria-hidden="true" />
      <div className={styles.portalFrame} aria-hidden="true" />
    </div>
  );
}
