import { useEffect, useRef, useState, Fragment } from "react";
import Image from "next/image";
import dynamic from "next/dynamic";
import { motion, useMotionValue, useMotionValueEvent, useScroll, useTransform } from "framer-motion";
import { useRefRegistry } from "@/providers/RefContext";
import { editableIn, editableDoc } from "@c3studium/valecms/edit";
import type { Project } from "@/lib/site/projects";
import { usePerformance } from "@/providers/PerformanceProvider";
import { cvh, lerp, PORTRAIT_PHONE, PORTRAIT_TABLET, useLandscapeFluid, useMedia } from "@/lib/fluid";
import { useGate } from "@/motion/LoadProvider";
import ScrollPlaceholder from "@/components/common/scroll-placeholder";
import MeasureText from "@/components/common/measure-text";
import TextMorph from "@/components/common/text-morph";
import SketchReveal from "@/components/common/sketch-reveal";
import IntroBanners from "@/motion/intro/IntroBanners";
import { heroAt, heroProgress } from "./progress";
import { BANNERS_IN, HINT_IN, PORTRAIT_IN, WORDS_IN, real } from "@/motion/intro/timeline";
import { useIntroAt, useIntroRan } from "@/motion/intro/useIntroAt";
import {
  hasLines,
  picture,
  text,
  type CmsImage,
  type MarkedLine,
} from "../lines";
import type { OrbitCardsItem } from "@/components/3D/OrbitCards";
import type { FlexControls } from "@/components/3D/FlexCarousel";
import { FlexCaption } from "@/components/3D/FlexCarousel/caption";
import styles from "./styles.module.scss";

// Sahá na WebGL a na 2D canvas kvůli getImageData, takže se nesmí
// renderovat na serveru.
// Kruh projektů. Engine sahá na WebGL a window, takže jen na klientovi.
// Galerie v heru má dvě varianty — nejsme vázaní na jednu animaci:
//  - "flex":  FlexCarousel, ploché karty v řadě ohnuté čočkou (ogl),
//  - "orbit": OrbitCards, 3D karty na nakloněné oběžné dráze.
// Obě mají stejný hover (ztlumení, rámeček, panel s odkazem).
const GALLERY: "flex" | "orbit" = "flex";

// Řada karet ohnutá čočkou. ogl sahá na WebGL a window — jen na klientovi.
const FlexCarousel = dynamic(() => import("@/components/3D/FlexCarousel"), {
  ssr: false,
});

const OrbitCards = dynamic(() => import("@/components/3D/OrbitCards"), {
  ssr: false,
});

const PortraitParticles = dynamic(
  () => import("@/components/common/particle-image"),
  { ssr: false },
);

// Co sekce říká, když CMS mlčí — tytéž texty, jaké tu stály natvrdo.
// Není to náhražka, je to poslední síť: prázdný blok nesmí dát prázdný hero.
const FALLBACK_PORTRAIT = {
  src: "/assets/rest/main_photo.png",
  alt: "Sabina Hudrmentová",
  width: 612,
  height: 1019,
};

// Tři řádky nadpisu, dekódované stejně, jako je dekóduje server: úsek a
// příznak zvýraznění. Tečka je součástí posledního slova — dekodér zvýrazňuje
// po slovech a Lines ji zase vyndá ven do vlastního spanu.
const FALLBACK_ROWS: MarkedLine[] = [
  [["Grafika", false]],
  [
    ["pro", false],
    ["lepší", true],
  ],
  [["výsledky.", true]],
];

const FALLBACK_SCROLL_HINT = "Objevujte posunutím";

// Úvod při načtení (s preloaderem): nejdřív „Grafika pro", za INTRO_DELAY
// se zelená slova vylijí z ničeho v PRVNÍ kombinaci (položky 4–5 bloku
// `index.hero`), a s otevřením stránky (`go`) se přelijí do té skutečné
// z nadpisu. ZÁSTUPNÁ první kombinace — skutečná slova patří do Studia.
const FALLBACK_ALTERNATES = ["větší", "prodeje"];
// Kdy přesně, určuje časování úvodu (src/motion/intro/timeline.ts) — na
// slova tam čeká rámeček nadpisu.
const INTRO_DELAY = real(WORDS_IN) * 1000;
// Bez úvodu (`?nopl=1`, klientský přechod): o kolik (s) po otevření
// stránky se postaví portrét a bannery za ním. S úvodem je řídí timeline
// (PORTRAIT_IN, BANNERS_IN).
const PORTRAIT_DELAY = 0.6;
// Bannery za portrétem odejdou (a nahradí je 3D scéna s kartami), když
// scroll hera přejde SCROLL_AWAY; vrátí se pod SCROLL_BACK (hystereze, ať
// se na hranici nepřepínají sem a tam).
// Časy hera jsou ve vh scrollu přišpendleného úseku (heroAt, progress.ts).
const SCROLL_AWAY = heroAt(12);
const SCROLL_BACK = heroAt(3);
// Kdy umělá myš smaže 3D scénu (viz choreography.ts). Smazání je okamžité
// jako v editoru — žádné prolínání.
const SCENE_DELETED = heroAt(424);
// Přelet portrétu do Info: od FLIGHT_FROM do konce hera.
const FLIGHT_FROM = heroAt(489);

// Tablet na výšku: portrét při posunu tracku vyroste z 54 % výšky okna
// (styles .portrait) na 79,2 % a k tomu ujede o 26vw doleva — skončí
// za levým okrajem okna, ať má galerie vpravo víc místa.
const TABLET_GROW = 79.2 / 54;
const TABLET_SHIFT_VW = -26;
// Telefon: vedle velkého portrétu se karta nevejde — portrét neroste
// a jede jen s trackem (o 6vw míň): obličej u levého okraje, karta stojí
// vpravo od obličeje, PŘED tělem.
const PHONE_GROW = 1;
const PHONE_SHIFT_VW = 6;
// …a vyjede o 14vh nahoru (dole je lišta s výzvou, header/styles).
const PHONE_LIFT_VH = 14;

// Koncová interpunkce u slova z CMS patří mimo něj (tečku kreslí řádek).
const TRAILING = /[.,;:!?…]+$/;

// Karty galerie jsou PROJEKTY (dokumenty typu `project`) se zaškrtnutým „Na
// úvodní stránce", podle pořadí. Rozvržení (--card-index) má místo pro čtyři.
// Když žádný projekt zaškrtnutý není, berou se první čtyři; bez databáze
// záloha níž — tytéž čtyři ukázky, jaké tu stály natvrdo.
const CARD_COUNT = 4;
const DEFAULT_CTA = "Zjistit víc";

// width/height jsou skutečné rozměry souboru — next/image je potřebuje kvůli
// rezervaci místa. Karta má vlastní pevný poměr 4/5 a případný přesah ořízne.
const FALLBACK_CARDS = [
  { slug: "gummylife", title: "Gummylife", tagline: "Doplňky stravy", cta: "Zjistit víc", src: "/assets/banners/gummylife_banner1.png", width: 1440, height: 2560 },
  { slug: "vecicky", title: "Věcicky", tagline: "Dětská móda", cta: "Zjistit víc", src: "/assets/banners/vecicky_banner16.png", width: 1468, height: 2587 },
  { slug: "bruzek", title: "Bruzek", tagline: "Prodej nemovitostí", cta: "Zjistit víc", src: "/assets/banners/bruzek_banner6.png", width: 492, height: 874 },
  { slug: "samurai", title: "Samurai", tagline: "Kampaň pro e-shop", cta: "Chci vědět víc", src: "/assets/banners/samurai_banner1.png", width: 536, height: 954 },
];

type Card = {
  id?: string;
  href: string;
  cta: string;
  image: { src: string; alt: string; width: number; height: number };
};

const cardsFrom = (projects: Project[] | null | undefined): Card[] => {
  const list = (projects ?? []).filter((project) => project.cover?.src);
  if (!list.length) {
    return FALLBACK_CARDS.map((card) => ({
      href: `/projects/${card.slug}`,
      cta: card.cta,
      image: { src: card.src, alt: `${card.title} — ${card.tagline}`, width: card.width, height: card.height },
    }));
  }
  const featured = list.filter((project) => project.featured);
  return (featured.length ? featured : list).slice(0, CARD_COUNT).map((project) => ({
    ...(project.id ? { id: project.id } : {}),
    href: `/projects/${project.slug}`,
    cta: text(project.cardCta, DEFAULT_CTA),
    image: {
      src: project.cover!.src,
      alt: project.tagline ? `${project.title} — ${project.tagline}` : project.title,
      // Rozměry nese knihovna médií; bez nich poměr karty (4/5), ořízne se.
      width: project.cover!.width ?? 800,
      height: project.cover!.height ?? 1000,
    },
  }));
};

// Blok `index.hero`, jak ho tvaruje src/lib/cms/home.ts. `docId` dorazí jen
// v editačním rámu Studia; na webu chybí a každá anotace vrátí prázdno.
// Zelené slovo nadpisu (dokument `heroWord`): podoba při načtení a konečná.
export type { HeroWord } from "@/lib/site/home";
type Word = { id?: string; intro: string; final: string };

export type HeroCopy = {
  docId?: string;
  labels?: MarkedLine[];
  labelMark?: string;
  scrollHint?: string;
  portrait?: CmsImage | null;
};

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path
        d="M5 12h13M12 5.5 18.5 12 12 18.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function Hero({
  copy = null,
  projects = null,
  words = null,
}: {
  copy?: HeroCopy | null;
  projects?: Project[] | null;
  /** Zelená slova nadpisu v pořadí (dokumenty `heroWord`); bez nich záloha. */
  words?: Word[] | null;
}) {
  const containerRef = useRef<HTMLElement>(null);
  // Částicová vrstva si podle tohohle prvku měří svůj box z DOMu.
  const portraitRef = useRef<HTMLImageElement>(null);
  // Galerie FlexCarousel: aktivní karta pro popisek v rohu a šipky, které
  // ji posouvají (ref plní komponenta).
  const [galleryIndex, setGalleryIndex] = useState(0);
  const galleryControls = useRef<FlexControls | null>(null);
  // Rám portrétu — výchozí bod přeletu do Info.
  const portraitBoxRef = useRef<HTMLDivElement>(null);
  // Po textu úvodu se pomalu postaví portrét a za ním bannery (ztlumené,
  // stálá vrstva). S úvodem podle jeho času, bez úvodu s bránou `go`.
  const introRan = useIntroRan();
  const portraitCue = useIntroAt(PORTRAIT_IN);
  const bannersCue = useIntroAt(BANNERS_IN);
  const hintCue = useIntroAt(HINT_IN);

  // Částice jsou druhý WebGL kontext a 150 000 bodů za snímek. Na slabém
  // stroji nebo při omezeném pohybu zůstane jen fotka — vypadá stejně,
  // jen se nehýbe.
  const { heavy, reducedMotion } = usePerformance();
  // Částice jen na šířku od notebooku (md) výš; telefony, tablety a vše na
  // výšku mají portrét bez nich. Na notebooku jemnější: čtvrtina počtu
  // a 0,25px tečka, k monitoru (2560) roste po přímce na plnou hustotu.
  const fluid = useLandscapeFluid();
  const particlesOn = heavy && !reducedMotion && fluid.on;
  const particleCount = Math.round(lerp(75000, 300000, fluid.t) / 5000) * 5000;
  const particleSize = lerp(0.25, 1, fluid.t);

  // Vstup sekce řídí brána opony: podklad (portrét) smí nastoupit, jakmile se
  // okno chystá otevřít (`ground`), slova až s otevíráním (`go`). Mimo
  // preloader (Studio, `?nopl=1`) je brána otevřená hned a vstup proběhne
  // při prvním snímku. `initial={false}` — bez animace z ničeho při mountu,
  // server i klient vykreslí tentýž (schovaný) stav.
  const { go, ground } = useGate();
  const portraitStart = introRan ? portraitCue : go;
  const bannersStart = introRan ? bannersCue : go;
  // Nápověda posunu je součást vstupu po textu (s úvodem HINT_IN).
  const hintShown = introRan ? hintCue : go;
  const ENTRANCE = [0.22, 1, 0.36, 1] as const;
  const enter = (delay: number) =>
    reducedMotion ? { duration: 0 } : { duration: 1.1, ease: ENTRANCE, delay };

  // Dokument zadaný jednou, ne u každé anotace zvlášť. Mimo Studio je `docId`
  // undefined a `edit(...)` vrací prázdný objekt — na web se nerozprostře nic.
  const edit = editableIn(copy?.docId ?? null);
  const rows =
    hasLines(copy?.labels) && copy.labels.length >= FALLBACK_ROWS.length
      ? copy.labels.slice(0, FALLBACK_ROWS.length)
      : FALLBACK_ROWS;

  // Úvod zelených slov (TextMorph):
  //   hold            schovaná
  //   ground          stránka je vidět, „Grafika pro" nastupuje; zelená slova
  //                   čekají INTRO_DELAY a pak se vylijí v první kombinaci
  //   go              stránka se otevírá — přelijí se do skutečných slov
  // Bez preloaderu (Studio, `?nopl=1`) je `go` hned a slova rovnou platí.
  const [intro, setIntro] = useState(false);
  useEffect(() => {
    if (!ground || go) return;
    const timer = window.setTimeout(() => setIntro(true), INTRO_DELAY);
    return () => window.clearTimeout(timer);
  }, [ground, go]);
  const wordIndex = go ? 1 : intro ? 0 : -1;

  // Zelená slova se dají „měřit" (common/measure-text): značka `data-measure`
  // je říká obalu nadpisu — tady ji nese platné slovo TextMorph. V editačním
  // rámu Studia zůstávají obyčejným textem — překryv je čte a přepisuje
  // přímo v DOMu.
  const editing = Boolean(copy?.docId);
  // Zelené slovo na pozici `order` (napříč řádky): obě podoby z dokumentu
  // `heroWord`, co chybí, dodá nadpis (konečná) a FALLBACK_ALTERNATES (úvod).
  const wordAt = (order: number, lineWord: string): Word => {
    const doc = words?.[order];
    const final = text(doc?.final, lineWord).trim().replace(TRAILING, "");
    return {
      ...(doc?.id ? { id: doc.id } : {}),
      final,
      intro: text(doc?.intro, FALLBACK_ALTERNATES[order] ?? final).trim().replace(TRAILING, ""),
    };
  };
  // Nadpis má dvě vrstvy a každá se ve Studiu edituje zvlášť (žádný obal
  // přes celý nadpis — blok `lines` by si vzal každý klik uvnitř):
  //   bílý text řádku   položka bloku items.<řádek>.label — jen nezvýrazněné
  //                     úseky; zvýraznění v uloženém textu se ignoruje
  //   zelená slova      dokumenty `heroWord` (dvě podoby), v pořadí; slovo k
  //                     stojí na konci řádku k + 1 (poslední řádek bere zbytek)
  // Bez dokumentů jsou zelená slova zvýrazněné úseky řádků, jako dřív.
  const whiteOf = (row: MarkedLine) =>
    row
      .filter(([, marked]) => !marked)
      .map(([run]) => run)
      .join(" ")
      .trim();
  const lineGreens = rows.flatMap((row) => row.filter(([, marked]) => marked).map(([run]) => run));
  const greens = Array.from({ length: words?.length || lineGreens.length }, (_, k) => wordAt(k, lineGreens[k] ?? "")).filter(
    (word) => word.final,
  );
  const greensIn = (row: number) => greens.filter((_, k) => Math.min(k + 1, rows.length - 1) === row);
  // Ve Studiu je zelené slovo vlastní dokument: klik otevře obě podoby.
  // Mimo Studio se přelévá (TextMorph).
  const renderGreen = (word: Word) =>
    editing ? (
      <span {...editableDoc(word.id ?? null, "heroWord")}>{word.final}</span>
    ) : (
      <TextMorph words={[word.intro, word.final]} index={wordIndex} />
    );
  // Bílá tečka za posledním zeleným slovem čeká na první kombinaci —
  // jinak by na třetím řádku visela sama.
  const dotClass = wordIndex < 0 ? `${styles.dot} ${styles.dotWait}` : styles.dot;
  const scrollHint = text(copy?.scrollHint, FALLBACK_SCROLL_HINT);
  const portrait = picture(copy?.portrait, FALLBACK_PORTRAIT);
  const cards = cardsFrom(projects);
  // Tytéž projekty pro kruh. Název a podtitul se berou z alt textu
  // („Název — tagline"), který cardsFrom skládá z dokumentu projektu.
  const orbitItems: OrbitCardsItem[] = cards.map((card) => {
    const [title, subtitle] = card.image.alt.split(" — ");
    return {
      src: card.image.src,
      alt: card.image.alt,
      title,
      subtitle,
      href: card.href,
      // Hover v galerii má vlastní výzvu — banner sám často nese tlačítko
      // („Zjistit víc", „To potřebuji") a stejný text by se tloukl.
      cta: "Prohlédnout projekt",
    };
  });

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });
  // Sdílený průběh — umělá myš v Info podle něj chytá galerii a portrét.
  useMotionValueEvent(scrollYProgress, "change", (v) => heroProgress.set(v));
  // Po smazání 3D scény umělou myší (SCENE_DELETED) je návštěvník „uživatel v editoru"
  // — kurzor se hned přelije na jmenovku „Vy" (common/cursor).
  const [sceneGone, setSceneGone] = useState(false);
  useMotionValueEvent(scrollYProgress, "change", (v) => setSceneGone(v >= SCENE_DELETED));

  // Scroll pryč z výchozí obrazovky: bannery za portrétem odejdou a místo
  // nich nastoupí 3D scéna s kartami. Nahoře zase naopak.
  const [scrolled, setScrolled] = useState(false);
  useMotionValueEvent(scrollYProgress, "change", (value) => {
    if (value > SCROLL_AWAY) setScrolled(true);
    else if (value < SCROLL_BACK) setScrolled(false);
  });
  const galleryShown = scrolled;

  // ---------- Maskování sticky pozice ----------
  // Sekce je přišpendlená (sticky), ale nesmí to být poznat: na každý
  // pixel scrollu musí něco na obrazovce odpovědět, a to pokud možno
  // pohybem NAHORU, jak by se stránka posouvala normálně. Proto:
  //  - žádné mrtvé úseky: posun tracku i příjezd karet začínají hned,
  //  - každá vrstva jede jinou rychlostí (portrét, nadpis, track) —
  //    hloubka z rozdílu rychlostí schová, že rám stojí,
  //  - konec přišpendlení: track zrychlí přesně na rychlost scrollu, takže
  //    v okamžiku uvolnění sticky pokračuje beze skoku.
  //
  // Track je 160vw (100vw hero + 60vw galerie). Posun o -60vw, tedy
  // -37.5 % šířky tracku, nechá pravou část hera — tedy portrét — v záběru.
  //
  // ČASOVÁ OSA ve vh přišpendleného úseku (HERO_PINNED 772vh, sekce 872vh):
  //   10–210      track jede doleva, galerie přijíždí po spirále, řada
  //               karet se scrollem posouvá
  //   210–370     klid — galerie stojí uprostřed, dá se táhnout (kurzor
  //               „Táhnout"); 234–288 nadpis zhasne. Dost místa, ať se
  //               omylem nepřescrolluje do další sekce.
  //   370–446     umělá myš (Info, choreography.ts) galerii označí
  //               a SMAŽE (Delete) — zmizí; pak jde pro portrét
  //   489–772     myš portrét přetáhne na místo portrétu v Info. Info má
  //              margin-top -100vh a posledních 100vh přes hero vyjíždí —
  //              ale je v té chvíli celé průhledné, vidět je jen portrét.
  //              V 1.0 se sticky uvolní přesně ve chvíli, kdy Info stojí
  //              nahoře, portréty se vymění na stejném pixelu a Info pak
  //              (samo přišpendlené) postupně nastoupí.
  // Tablet na výšku: portrét stojí vpravo za titulkem — posun jen o 52vw
  // (-32,5 %): fotka má vlevo prázdný okraj, vlasy pak stojí u samého
  // levého okraje okna.
  const tablet = useMedia(PORTRAIT_TABLET);
  const phone = useMedia(PORTRAIT_PHONE);
  const x =useTransform(scrollYProgress, [heroAt(10), heroAt(210)], ["0%", tablet ? "-32.5%" : "-37.5%"]);

  // PRAVIDLO: na nule scrollu musí první obrazovka vypadat přesně podle
  // návrhu — bez posunu a bez natočení. Preloader (IntroBanners) i rámečky
  // MeasureText jsou zarovnané na výchozí rozvržení, a MeasureText měří
  // písmena jako rovné obdélníky, takže nadpis se nikdy nesmí natáčet.
  // Proto se nadpis a portrét jen POSOUVAJÍ a „spirála" (oblouk nahoru
  // a rozkroucení) patří jen galerii, která přijíždí zprava.

  // Galerie přijíždí po spirále: zdola zprava po oblouku nahoru (stoupání
  // zpomaluje, posun do strany je rovnoměrný) a přitom se rozkroutí
  // z náklonu do roviny. Od 210vh stojí srovnaná UPROSTŘED okna, dokud
  // ji umělá myš nesmaže.
  const easeOutQuad = (t: number) => 1 - (1 - t) * (1 - t);
  // Odchod: umělá myš z Info (choreography.ts) scénu označí a smaže
  // (Delete, SCENE_DELETED) — scéna v tu chvíli zmizí, bez přechodu.
  // Posuny ve vh rámu obsahu (cvh, strop 2K) — čísla, převod až na konci.
  const galleryShift = useTransform(scrollYProgress, [heroAt(10), heroAt(210)], [24, 0], {
    ease: easeOutQuad,
  });
  const galleryY = useTransform(galleryShift, cvh);
  const galleryRotate = useTransform(scrollYProgress, [heroAt(10), heroAt(210)], [5, 0], {
    ease: easeOutQuad,
  });
  // Průhlednost POZOR: zápis rozsahem ([0.6, 0.78] → [1, 0]) Framer Motion
  // u opacity „zrychlí" na nativní scroll animaci, která v přišpendlené
  // sekci počítá špatný rozsah (opacity zůstala 1). Funkce se nezrychluje.
  const fade = (from: number, to: number) => (p: number) =>
    1 - Math.min(Math.max((p - from) / (to - from), 0), 1);
  const galleryOpacity = useTransform(scrollYProgress, (p) => (p >= SCENE_DELETED ? 0 : 1));
  // Scénu najde umělá myš (registr) — chytí ji a odtáhne.
  const galleryRef = useRef<HTMLDivElement>(null);
  // Scroll posouvá i samotnou řadu karet (podíl šířky scény) — vstup
  // i odchod mají čím pohnout, i když se řada sama nehýbe.
  const galleryDrift = useTransform(scrollYProgress, [0, heroAt(312)], [0, 0.45]);

  // Portrét stojí — žádné natáčení ani kolébání. Fotka končí rovným řezem
  // v pase a stojí 10vh pod spodní hranou okna (styles .portrait). Do Info
  // ho pak „přetáhne" umělá myš (flight níž + kurzor v Info): jen posun
  // z první pozice na druhou a zmenšení.

  // Nadpis se mezitím zvolna zvedá — další vrstva s vlastní rychlostí —
  // a při odchodu galerie zhasne.
  // Tablet na výšku: titulek přes celou šířku by galerii překryl — odjede
  // nahoru z okna a cestou zhasne, než karty dojedou.
  const headlineShift = useTransform(
    scrollYProgress,
    tablet ? [0, heroAt(170)] : [0, heroAt(210), heroAt(300)],
    tablet ? [0, -60] : [0, -8, -14],
  );
  const headlineY = useTransform(headlineShift, cvh);
  const headlineOpacity = useTransform(
    scrollYProgress,
    tablet ? fade(heroAt(40), heroAt(150)) : fade(heroAt(234), heroAt(288)),
  );

  // ---------- Přelet portrétu do Info ----------
  // Cíl je ŽIVÝ obdélník portrétu v Info (registr "info-portrait"), který
  // během přechodu sám vyjíždí zdola. Portrét v heru se k němu přibližuje
  // (translate + scale od levého horního rohu) a v 1.0 na něm přesně leží.
  // ease-in-out: na konci má přelet nulovou vlastní rychlost, takže jede
  // dál přesně rychlostí cíle — stejně jako stránka po uvolnění sticky.
  const registry = useRefRegistry();
  const flightX = useMotionValue(0);
  const flightY = useMotionValue(0);
  const flightScale = useMotionValue(1);
  useEffect(() => {
    const easeInOut = (t: number) =>
      t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    const update = (p: number) => {
      const t = Math.min(Math.max((p - FLIGHT_FROM) / (1 - FLIGHT_FROM), 0), 1);
      const frame = portraitBoxRef.current;
      const target = registry.get("info-portrait");
      // Tablet na výšku: portrét začíná malý pod titulkem (rám v CSS) a se
      // scrollem vyroste do velké polohy u levého okraje — spodní hrana
      // stojí, roste nahoru. Přelet do Info pak jede z tohohle stavu.
      const k = tablet
        ? Math.min(Math.max((p - heroAt(10)) / (heroAt(210) - heroAt(10)), 0), 1)
        : 0;
      const grow = 1 + ((phone ? PHONE_GROW : TABLET_GROW) - 1) * k;
      const baseX = ((phone ? PHONE_SHIFT_VW : TABLET_SHIFT_VW) / 100) * window.innerWidth * k;
      const lift = phone ? (PHONE_LIFT_VH / 100) * window.innerHeight * k : 0;
      const baseY = -(grow - 1) * (frame?.offsetHeight ?? 0) - lift;
      if (t <= 0 || !frame || !target) {
        flightX.set(baseX);
        flightY.set(baseY);
        flightScale.set(grow);
        return;
      }
      const from = frame.getBoundingClientRect();
      const to = target.getBoundingClientRect();
      if (!from.height || !to.height) return;
      // Cíl je KONEČNÁ poloha portrétu v Info (sekce stojí nahoře), ne ta
      // živá: Info během přeletu teprve vyjíždí zdola a portrét by za ní
      // klesal a zase stoupal. V 1.0 je sekce nahoře, takže sedí na pixel.
      // Úplný konec se dotáhne na živou polohu — v okamžiku výměny sekce
      // nestojí přesně na nule a portréty musí sedět na pixel.
      const sectionTop = target.closest("section")?.getBoundingClientRect().top ?? 0;
      const settle = Math.min(Math.max((t - 0.9) / 0.1, 0), 1);
      const toTop = to.top - sectionTop * (1 - settle * settle * (3 - 2 * settle));
      const e = easeInOut(t);
      flightX.set(baseX + (to.left - from.left - baseX) * e);
      flightY.set(baseY + (toTop - from.top - baseY) * e);
      flightScale.set(grow + (to.height / from.height - grow) * e);
    };
    update(scrollYProgress.get());
    return scrollYProgress.on("change", update);
  }, [scrollYProgress, registry, flightX, flightY, flightScale, tablet, phone]);
  // Částice při přeletu zhasnou (portrét v Info je nemá) a v 1.0 se
  // portrét hera vymění za portrét Info.
  const particlesFade = useTransform(scrollYProgress, fade(FLIGHT_FROM, heroAt(720)));
  // Fotku hera najde umělá myš v Info (registr) — chytí ji a přetáhne.
  useEffect(() => {
    registry.register("hero-portrait", portraitRef.current);
    registry.register("hero-gallery", galleryRef.current);
    return () => {
      registry.register("hero-portrait", null);
      registry.register("hero-gallery", null);
    };
  }, [registry]);
  const heroPortraitOpacity = useTransform(scrollYProgress, fade(heroAt(768), 1));

  // Příjezd karet odzadu dopředu jede se scrollem od samého začátku a
  // dojede těsně před koncem posunu tracku. Scroll zpátky je zase
  // odveze dozadu do stínu.
  const orbitEntry = useTransform(scrollYProgress, [heroAt(20), heroAt(200)], [0, 1]);

  return (
    <section
      ref={containerRef}
      className={styles.container}
      data-cursor={sceneGone ? "user" : undefined}
      data-scroll-label="Úvod"
    >
      <div className={styles.sticky}>
        <motion.div className={styles.track} style={{ x }}>
          {/* ---------- Panel 1: hero (100vw) ---------- */}
          <div className={`${styles.panel} ${styles.panelHero}`}>
            {/* Za portrétem stojí dva bannery z projektů (ztlumené), kolem
                slova a tvary (src/motion/intro). Postaví se s portrétem po
                textu úvodu; při scrollu odejdou a nahradí je 3D scéna. */}
            {!editing && (
              <IntroBanners
                sources={cards.map((card) => card.image.src)}
                area={portraitRef}
                show={bannersStart && !scrolled}
                delay={introRan ? 0 : PORTRAIT_DELAY - 0.1}
                still={reducedMotion}
                // Na výšku pozadí obrazovky: větší, přes celou šířku, spodky
                // u spodní hrany — vršek pod textem zprůhlední maska (styles).
                scale={tablet ? 1.15 : undefined}
                across={tablet ? 0.96 : undefined}
                baseline={tablet ? 1 : undefined}
                fieldLeft={tablet ? 0.04 : undefined}
                className={styles.introBanners}
              />
            )}
            <motion.div className={styles.content} style={{ y: headlineY, opacity: headlineOpacity }}>
              {/* Jedno plátno přes celý nadpis: výběr mezi zelenými slovy
                  přejíždí. Obal je kolem <h1>, ne v něm — děti <h1> musí
                  zůstat jen řádky (anotace `lines` níž). */}
              {/* Samostatný pohled až po otevření stránky — během úvodu by
                  běhal po slovech, která se zrovna přelévají. */}
              <MeasureText enabled={!editing} sweep={go}>
              {/* Bílý text řádku a zelená slova mají každé svou anotaci
                  (viz `whiteOf` / `greens` výš). */}
              <h1 className={styles.headline}>
                {rows.map((row, index) => {
                  const white = whiteOf(row);
                  const rowGreens = greensIn(index);
                  return (
                    <span key={index} className={styles.headlineRow}>
                      {/* Vnitřní obal kvůli pohybu řádku. */}
                      <motion.span
                        className={styles.headlineRise}
                        initial={false}
                        // Řádky nastupují už s `ground` — „Grafika pro" je
                        // první, co preloader ukáže.
                        animate={ground ? { y: 0, opacity: 1 } : { y: "0.5em", opacity: 0 }}
                        transition={enter(0.1 + index * 0.12)}
                      >
                        {white ? <span {...edit(`items.${index}.label`)}>{white}</span> : null}
                        {rowGreens.map((word, j) => (
                          <Fragment key={j}>
                            {white || j > 0 ? " " : null}
                            <span className={`hl ${styles.accent}`}>{renderGreen(word)}</span>
                          </Fragment>
                        ))}
                        {/* Tečka za posledním zeleným slovem. */}
                        {index === rows.length - 1 ? <span className={dotClass}>.</span> : null}
                      </motion.span>
                    </span>
                  );
                })}
              </h1>
              </MeasureText>
              <motion.div
                className={styles.scrollHint}
                // Slova a tvary kolem bannerů se jí vyhnou (banners.ts).
                data-intro-avoid=""
                aria-hidden="true"
                initial={false}
                animate={hintShown ? { opacity: 1 } : { opacity: 0 }}
                transition={enter(0.6)}
              >
                {/* Tečka, linka a popisek v nekonečné smyčce; kouř v textu.
                    Vodorovně, v toku hned pod zeleným textem (styles .scrollHint). */}
                <ScrollPlaceholder
                  orientation="horizontal"
                  label={scrollHint}
                  labelProps={edit("items.3.label")}
                />
              </motion.div>
            </motion.div>

            {/* Anotace obrázku sedí na rámu, ne na <img>: částice kreslí tenhle
                soubor ještě jednou na vlastní plátno, takže „tahle fotka" je
                pro editora celý box, ne jeden z jeho dvou obrazů. */}
            <motion.div
              ref={portraitBoxRef}
              className={styles.portrait}
              {...edit.image("image")}
            >
              {/* Vstup portrétu staví SketchReveal: zelené linky (obrys
                  a výrazné hrany) → klidné prolnutí barev. JEDNOU — pomalu
                  po textu úvodu (PORTRAIT_IN), bez úvodu PORTRAIT_DELAY po
                  otevření stránky — a pak už stojí. Znovu se animují jen
                  bannery za ním (IntroBanners). */}
              {/* Přelet do Info: transformace na vlastním obalu, ne na rámu —
                  rám (portraitBoxRef) zůstává výchozím bodem přeletu. */}
              <motion.div
                className={styles.portraitFlight}
                style={
                  {
                    x: flightX,
                    y: flightY,
                    scale: flightScale,
                    opacity: heroPortraitOpacity,
                    "--particles": particlesFade,
                  } as never
                }
              >
              <SketchReveal
                show={portraitStart}
                delay={introRan ? 0 : PORTRAIT_DELAY}
                enabled={!reducedMotion && !editing}
                className={styles.portraitLayer}
              >
              <Image
                ref={portraitRef}
                src={portrait.src}
                alt={portrait.alt}
                width={portrait.width}
                height={portrait.height}
                className={styles.portraitImage}
                // Tenhle portrét je LCP prvek stránky. `preload` sám vloží
                // jen <link rel=preload> do hlavičky a na <img> nechá
                // výchozí loading="lazy" — proto na něj Next 16 nadával.
                // Dokumentace u obrázku nad ohybem chce tohle.
                loading="eager"
                fetchPriority="high"
                sizes="(max-width: 900px) 70vw, 45vw"
                // Jiná kvalita než výchozích 75 SCHVÁLNĚ (povolená v
                // next.config images.qualities): tatáž fotka je níž na
                // stránce ještě třikrát (info, process, cta) jako lazy.
                // Všechny čtyři <img> mají shodné src (…w=3840&q=75) a Next
                // si ve vývoji podle něj vede mapu obrázků — lazy záznam
                // odspodu přepsal ten z hera a Next pak hlásil LCP bez
                // loading="eager", přestože ho má. Jiné q= dá heru vlastní
                // URL. Na produkci se mapa nevede, tam o nic nešlo.
                quality={80}
              />
              {/* Všechny propy jsou vypsané schválně — i ty na výchozí
                  hodnotě — aby se daly ladit, aniž by se muselo
                  dohledávat, co je default uvnitř komponenty. */}
              {particlesOn && (
                <PortraitParticles
                  src={portrait.src}
                  targetRef={portraitRef}
                  className={styles.portraitParticles}
                  /* Hustota a vzhled. particleCount je hlavní páka — zaokrouhlí
                     se nahoru na čtvercovou mřížku, 300 000 dá 548x548.
                     Dřív tu bylo 400 000 × 0,5 px: pod 1 px ale GL bod
                     stejně zaokrouhlí na pixel, takže polovina počtu byla
                     jen překryv. Částice v pozadí jsou vypnuté, takže se
                     uvolněný výkon dal sem — 300 000 × 1 px. */
                  particleCount={particleCount}
                  particleSize={particleSize}
                  particleOpacity={0.45}
                  additive={false}
                  /* Přesah plátna kolem fotky v px na každou stranu. Bez něj
                     částice na hraně plátna končí rovným řezem — nahoře
                     i po stranách. Zvedni, když mají doplout dál. */
                  bleed={72}
                  /* Maska */
                  alphaThreshold={24}
                  /* Proudění */
                  speed={0.5}
                  noiseScale={0.002}
                  noiseStrength={0.025}
                  damping={0.96}
                  lifespan={320}
                  /* Kurzor */
                  cursorInteraction
                  cursorStrength={0.02}
                  cursorRadius={120}
                  /* Běh a výkon */
                  dpr={1.5}
                  paused={false}
                />
              )}
              </SketchReveal>
              </motion.div>
            </motion.div>
          </div>

          {/* ---------- Panel 2: galerie bannerů (60vw) ---------- */}
          {/* Spirála: panel přijíždí zdola a rozkrucuje se kolem levého
              dolního rohu (galleryY, galleryRotate). */}
          <motion.div
            className={`${styles.panel} ${styles.panelWork}`}
            style={{
              y: galleryY,
              rotate: galleryRotate,
              opacity: galleryOpacity,
              // Smazaná scéna se nesmí dát dál táhnout (neviditelně).
              visibility: sceneGone ? "hidden" : undefined,
              transformOrigin: "0% 100%",
            }}
          >
            {/* Projekty na dráze, která ubíhá do hloubky jako dřívější
                nakloněná řada (components/3D/OrbitCards). Vidět je jen
                přední část, zbytek zhasne do stínu. Příjezd řídí scroll.
                Kolečko je vypnuté, aby nebralo scroll, který panel posouvá. */}
            {/* Dvě varianty galerie, přepíná je GALLERY nahoře v souboru. */}
            {GALLERY === "flex" ? (
              <motion.div
                ref={galleryRef}
                className={styles.flex}
                // Kurzor nad scénou: čtyři tečky a velká jmenovka „Táhnout"
                // (common/cursor) — ať je jasné, že se scéna dá táhnout.
                data-cursor={sceneGone ? undefined : "drag"}
                // Karty nahrazují bannery: vidět až po scrollu z výchozí
                // obrazovky, nahoře se schovají (bannery se vrátí).
                initial={false}
                animate={galleryShown ? { opacity: 1 } : { opacity: 0 }}
                transition={enter(0)}
              >
                <FlexCarousel
                  items={orbitItems}
                  /* Studio: klik na kartu otevře záznam projektu (karty jsou
                     pixely v plátně — nad kartou pod myší stojí neviditelný
                     box s anotací). */
                  editTarget={editing ? (index) => editableDoc(cards[index]?.id ?? null, "project") : undefined}
                  preset="liquid"
                  intro="rise"
                  /* Úvod karet až po scrollu (místo bannerů). */
                  hold={!galleryShown}
                  /* Rise 1,6× rychleji — karty navazují na portrét. */
                  introSpeed={1.6}
                  /* Výška karty jako podíl boxu (1,25× proti 0,46). Tablet
                     na výšku má box přes celou výšku okna (ohnuté karty
                     nenarazí na jeho hranu) a jedna velká karta ~50vh ve
                     vlastním poměru, sousední jen nakukují; mezera s ní. */
                  cardHeight={phone ? 0.4 : tablet ? 0.5 : 0.575}
                  /* Větší mezera mezi bannery. */
                  gap={tablet ? 40 : 36}
                  squeeze={0.2}
                  /* Klik na aktivní kartu vede na projekt, nepřibližuje. */
                  focusOnClick={false}
                  /* Popisek je v pravém rohu panelu pod šipkami (FlexCaption níž). */
                  captions={false}
                  onChange={setGalleryIndex}
                  controlsRef={galleryControls}
                  /* Tablet bez posunu řady scrollem — aktivní karta stojí
                     rovně uprostřed čočky, nezastaví se napůl ohnutá. */
                  drift={tablet ? undefined : galleryDrift}
                  /* Karta přebírá poměr svého obrázku (načte se a teprve
                     pak se podle něj karta postaví) — nic se neořízne. */
                  fit="natural"
                  radius={0}
                  /* Rovná je jen střední část — zhruba tři celé karty.
                     Vlevo i vpravo se karty víc ohýbají; hover se kreslí
                     do scény, takže se ohne s nimi. */
                  /* Tablet: čočka svisle (tilt 0), rovná přes velkou kartu
                     a ještě o ~25vw dál — ohyb (začíná
                     `reach` před okrajem čočky, engine) leží za portrétem
                     a za pravým okrajem okna, je jen naznačený. Menší
                     reach, slabší ohyb, duha i rozostření. */
                  lensWidth={tablet ? 0.78 : 0.74}
                  lensHeight={tablet ? 1.6 : 1.18}
                  tilt={tablet ? 0 : 62}
                  roundness={1}
                  bend={tablet ? 0.25 : 0.44}
                  reach={tablet ? 0.12 : 0.3}
                  curl="twist"
                  dispersion={tablet ? 0.25 : 0.45}
                  liquid={0}
                  followCursor={false}
                  autoplay={false}
                  interval={4}
                  /* Svislé kolečko patří stránce — scroll řídí přišpendlený
                     hero. Vodorovné (touchpad) dál posouvá řadu. */
                  captureWheel={false}
                  /* Hover ve scéně: ztlumení 0,4 → 0,2, rámeček ve stylu
                     MeasureText, titulek, obor a tlačítko. Klik na kartu
                     pod myší vede na projekt. */
                  /* Neaktivní karty výrazně ztlumené, karta pod myší jen
                     lehce. Text (název, obor, výzva) je vidět vždy; hover
                     animuje jen výzvu — rámeček jako odkazy v hlavičce. */
                  dim={0.62}
                  dimHover={0.15}
                  /* Rozostření na okrajích, kde se karty ohýbají. */
                  edgeBlur={tablet ? 16 : 26}
                  hoverPanel
                />
              </motion.div>
            ) : (
              <div className={styles.orbit}>
                <OrbitCards
                  className={styles.orbitCanvas}
                  fitParent
                  items={orbitItems}
                  progress={orbitEntry}
                  count={16}
                  /* 9:16 — skutečný poměr bannerů v heru, nic se neořízne. */
                  aspect={0.5625}
                  /* Dráha: oblouk obří oběžné dráhy. Od přední karty vlevo
                     ubíhá doprava do hloubky a stáčí se dál dozadu. */
                  angle={38}
                  orbit={14}
                  gap={0.55}
                  /* Vzadu se řada sbíhá jako rozevřený balíček a uprostřed
                     se karty zvednou do mírného oblouku. */
                  stack={0.16}
                  arch={0.22}
                  /* Easing: zadní karty dojíždějí za předními s lehkým
                     překmitem, řada se při tažení i scrollu rozvlní. */
                  lag={0.1}
                  bounce={0.35}
                  distance={2.6}
                  /* Oběžná dráha je nakloněná: levá strana o 5° nahoru,
                     pravá dolů (roll), a kamera se na ni dívá o 5° shora
                     (tilt). */
                  roll={-5}
                  tilt={5}
                  /* Karty: pravá hrana k divákovi, levá dozadu, horní hrana
                     lehce dozadu, každá s vlastním náhodným náklonem.
                     Přední karta se narovná. */
                  cardYaw={22}
                  cardLean={8}
                  jitter={7}
                  /* Přední karta má 0,68× výšky portrétu: box .orbit je
                     stejně vysoký jako portrét (94vh) a karta zabere 68 %
                     jeho výšky (fitParent). Plátno box přesahuje (viz
                     .orbitCanvas), takže karty ořízne až okraj obrazovky. */
                  cardHeight={0.68}
                  scale={1}
                  /* Viditelné okno a stín za ním. */
                  visible={4.5}
                  shade={0.7}
                  /* Překryv přes obrázky: černá 0,4, karta pod myší plynule
                     jen 0,2 — jako HTML karty s tmavou vrstvou. */
                  dim={0.4}
                  dimHover={0.2}
                  /* Nad kartou pod myší rámeček ve stylu MeasureText,
                     titulek, text a odkaz (jen s myší). */
                  hoverPanel
                  /* Karta, která projede kolem přední pozice, jede dál
                     doleva a zmizí ZA portrétem (plátno leží pod ním). */
                  /* Řada posunutá o kartu doprava: karta před přední se
                     ukáže na jejím dosavadním místě, napůl za portrétem, a
                     delší exit ji nechá viditelnou jako náběh řady. */
                  anchor={1}
                  exit={1.4}
                  /* Popisek by u přesahujícího plátna skončil pod
                     obrazovkou, proto je vypnutý. */
                  captions={false}
                  /* Hloubkové rozostření zůstává jen uvnitř obrázků,
                     hrany karet jsou vždy ostré. */
                  radius={9}
                  shadow={1}
                  /* Po dojetí stojí; posouvá se tažením po dráze. */
                  speed={0}
                  wheel={false}
                />
              </div>
            )}

            {/* Pravý dolní roh: nahoře ruční ovládání, pod ním popisek
                aktivní karty (název, obor, počítadlo). */}
            <motion.div
              className={styles.galleryHint}
              initial={false}
              animate={galleryShown ? { opacity: 1 } : { opacity: 0 }}
              transition={enter(0.5)}
            >
              <span className={styles.galleryNav}>
                <button
                  type="button"
                  className={`${styles.galleryNavButton} ${styles.isBack}`}
                  aria-label="Předchozí ukázka"
                  onClick={() => galleryControls.current?.previous()}
                >
                  <ArrowIcon />
                </button>
                <button
                  type="button"
                  className={styles.galleryNavButton}
                  aria-label="Další ukázka"
                  onClick={() => galleryControls.current?.next()}
                >
                  <ArrowIcon />
                </button>
              </span>
              {GALLERY === "flex" ? (
                <FlexCaption
                  item={orbitItems[galleryIndex]}
                  index={galleryIndex}
                  total={orbitItems.length}
                  align="end"
                />
              ) : null}
            </motion.div>
          </motion.div>
        </motion.div>
        {/* Telefon: pruh u pravého okraje, kde palec scrolluje stránkou —
            jinde si dotyk bere 3D galerie (táhne kartami). */}
        <div className={styles.thumbLane} aria-hidden="true" />
      </div>
    </section>
  );
}
