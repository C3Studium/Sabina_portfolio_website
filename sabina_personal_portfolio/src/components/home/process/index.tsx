import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode, type Ref } from "react";
import { useRefRegistry } from "@/providers/RefContext";
import Image from "next/image";
import {
  animate,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useScroll,
  useTransform,
  type MotionValue,
} from "framer-motion";
import TypeText from "@/components/common/type-text";
import ScrollPlaceholder from "@/components/common/scroll-placeholder";
import { InspectHint, InspectRoot } from "@/components/study/inspect-hint";
import DollyGallery from "@/components/3D/DollyGallery";
import DollyLine, { type DollyAnchor, type DollyLineHandle } from "@/components/3D/DollyGallery/DollyLine";
import { CheckIcon } from "./wave";
import { markTyped } from "@/components/home/typing";
import DesignCursor from "@/components/common/design-cursor";
import { DesignSelection, ToolPanels } from "@/components/home/info/designer";
import { BuildFrame, RiseLine, SketchText, softMask, useBlockBuild } from "@/components/home/info/reveal";
import { ease, mix, within, type Window } from "@/components/home/info/choreography";
import { Block, DupImage, Drawn, useSoftReveal, type Geo } from "./build";
import LayeredReveal from "@/components/common/layered-reveal";
import { TextPanel } from "./text-panel";
import { useStepDesigner } from "./designer";
import {
  CALLOUT,
  FONT_SIZE,
  HEAD,
  NOTE,
  S1,
  S2,
  S3,
  S4,
  S5,
  S6,
  STORY,
  TITLE_FROM,
  briefRow,
  cameraAt,
  chipDup,
  lineHead,
  segAt,
  SEGMENTS,
  stepAt,
  swatchDup,
} from "./steps";
import { PROCESS, PROCESS_PINNED } from "@/components/home/designer-timeline";
import { editableDoc, editableIn } from "@c3studium/valecms/edit";
import type { ProcessDetail, ProcessStep } from "@/lib/site/home";
import Lines, { hasLines, picture, text, type MarkedLine } from "../lines";
import styles from "./styles.module.scss";
import { cvw, cvh, PORTRAIT_TABLET, useMedia } from "@/lib/fluid";
import { ACCENT } from "@/lib/palette";

// Úvod, kroky 01–06, výzva a CTA jako dlaždice DollyGallery (components/3D):
// kamera jimi projíždí do hloubky podle scrollu. Dlaždice nese celý krok,
// střídají se vlevo a vpravo, další se vynoří z dálky a předchozí proletí
// kolem. CTA je poslední — přes celý rám uprostřed, takže z dálky je to
// okno („portál"), které se s příjezdem rozroste přes celou obrazovku.
const DOLLY = {
  /** Dlaždice = krok: podíl šířky a výšky okna. */
  fit: { width: 0.66, height: 1 },
  perspective: 1000,
  /** Rozestup kroků do hloubky (px) — velký, ať je mezi kroky místo
   *  na jejich vlastní animace. */
  spacing: 2400,
  /** Střídání do stran (podíl šířky dlaždice). */
  spread: 0.3,
  /** Kolik kroků dopředu je vidět (další prosvítá z dálky). */
  revealRange: 1.5,
  /** Krok, který proletěl kolem kamery, zhasne do ~400px (podíl rozestupu). */
  passRange: 0.17,
  /** Vyhlazení kamery za scrollem (0 = hned, 1 = líně). */
  smooth: 0.5,
  /** Lehké pohoupnutí při rychlém scrollu. */
  drift: 0.04,
  /** Volby dlaždic — poloha kroků (podíl šířky dlaždice od středu, hlava
   *  kroku leží u levé hrany dlaždice). Vlevo nahoře pod logem je pevný panel
   *  Vrstvy: kroky stojí co nejvíc vlevo, hlavou těsně vedle něj (01 o kus
   *  dál, ať je vidět linka). Výzva (7.) uprostřed, CTA (8.) přes celý rám. */
  tiles: [
    // Úvod: text začíná hned za panelem Vrstvy (jinak by ho překryl toast).
    { x: -0.03 },
    { x: 0.08 },
    { x: 0.05 },
    { x: 0.02 },
    { x: 0.05 },
    { x: 0.02 },
    { x: 0.02 },
    { fit: { width: 0.8, height: 1 }, x: 0, y: 0 },
    { fit: { width: 1, height: 1 }, x: 0, y: 0 },
  ],
};

// Tablet na výšku: úvod přes celou šířku, kroky skoro přes celou (text nad
// kompozicí, ta je zmenšená celá — styles, blok xs-v), žádné střídání do
// stran. Výzva a CTA jako na šířku.
// Kompozice kroků na výšku (viz --comp-zoom): šířka okna, pro kterou jsou
// navržené (tablet), a o kolik větší smí být na telefonu.
const COMP_REF_WIDTH = 1128;
const COMP_PHONE_BOOST = 1.1;

const DOLLY_TABLET = {
  /** Dlaždice stojí na výšku za sebou uprostřed — další z dálky jen
   *  naznačená, jinak by (hlavně velký text výzvy) prosvítala přes krok. */
  revealRange: 1.1,
  fit: { width: 0.94, height: 1 },
  tiles: [
    { fit: { width: 1, height: 1 }, x: 0, y: 0 },
    { x: 0 },
    { x: 0 },
    { x: 0 },
    { x: 0 },
    { x: 0 },
    { x: 0 },
    { fit: { width: 0.9, height: 1 }, x: 0, y: 0 },
    { fit: { width: 1, height: 1 }, x: 0, y: 0 },
  ],
};

// Zelená linka v prostoru dolly (DollyLine): hladká 3D křivka přes kotvy
// přivázané k dlaždicím — posun od středu dlaždice (podíl její šířky
// a výšky) a o kolik rozestupů stojí PŘED ní. Uzel 01–05 je vždy těsně
// před svým krokem: kamera jím proletí, než dorazí ke kroku. Výšky uzlů
// jsou z původní vlny (wave.tsx, NODES y − 50 %).
const LINE: DollyAnchor[] = [
  // Náběh: zleva zdola přes úvod (jako dřív začátek vlny) a za portrét.
  { tile: 0, x: -0.6, y: 0.42, ahead: 0.05 },
  { tile: 0, x: 0.35, y: 0.18, ahead: -0.13 },
  // Uzly kroků (~160px před krokem), vpravo od obsahu kroku — linka běží
  // vedle kompozice, ne za ní (pod obsahem by byla schovaná).
  { tile: 1, x: 0.32, y: 0.14, ahead: 0.067, node: "dot" },
  { tile: 2, x: 0.3, y: 0.15, ahead: 0.067, node: "dot" },
  { tile: 3, x: 0.32, y: 0.02, ahead: 0.067, node: "dot" },
  { tile: 4, x: 0.42, y: 0.31, ahead: 0.067, node: "dot" },
  { tile: 5, x: 0.42, y: 0.02, ahead: 0.067, node: "final" },
  { tile: 6, x: 0.42, y: 0.12, ahead: 0.067, node: "dot" },
  // Doběh: přes výzvu vpravo nahoru a do portálu s CTA (zmizí za podkladem).
  { tile: 7, x: 0.45, y: -0.28, ahead: 0 },
  { tile: 8, x: 0, y: 0, ahead: 0 },
];

// Krok 03: kde stojí vizuály (kompozice: left vw, top vh, rozměr vh, °).
// Hlavní 4:5, varianta nahoře 1:1, dole 9:16 — duplikáty hlavního se na
// tyto rozměry stáhnou (DupImage).
const SHOT_GEO: Record<"main" | "top" | "bottom", Geo> = {
  main: { left: 0, top: 8, width: 40, height: 50, rotate: -2 },
  top: { left: 31.05, top: 9, width: 26, height: 26, rotate: 1.5 },
  bottom: { left: 27.6, top: 37, width: 20.25, height: 36, rotate: -1 },
};

// Krok 05: o kolik výš (vh) stojí formát na výšku nad čtvercem — odtud se
// duplikát táhne dolů.
const SQUARE_DROP = 36;
const LINE_STYLE = {
  /** Tloušťka v hloubce kroku u kamery (px). */
  width: 2.5,
  /** Do dálky slábne od 0,8 rozestupu, zmizí ve 2 — kreslí se jen narostlá
   *  část (lineHead v steps.ts), takže tohle jen změkčí její špičku. */
  fade: [0.8, 2] as const,
  /** Za kamerou zhasne do 0,2 rozestupu. */
  pass: 0.2,
};

// Co sekce říká, když CMS mlčí — tytéž texty, jaké tu stály natvrdo.
// Tučné fráze kroků jsou zvýraznění dekódovaná po slovech, jako na serveru.
const FALLBACK = {
  eyebrow: "Jak probíhá spolupráce",
  // Tečka je součástí posledního slova; Lines ji vyndá do vlastního spanu.
  heading: [
    [["Od zadání", false]],
    [
      ["k", false],
      ["výsledku.", true],
    ],
  ] as MarkedLine[],
  lead: "Jasný a efektivní proces, který mění nápady ve funkční vizuály a výsledky.",
  scrollHint: "Objevujte posunutím",
  // Kroky 01–05: název, text s tučnými frázemi, ručně psaná poznámka a drobné
  // texty v kompozici (`details`). Ve Studiu je každý krok vlastní dokument
  // typu `processStep` — tady je jejich podoba z kódu.
  steps: [
    {
      stage: "01",
      title: "Seznámení",
      text: [
        ["Začínáme", false],
        ["pochopením vašich cílů,", true],
        ["cílové skupiny a toho,", false],
        ["čeho má grafika dosáhnout.", true],
      ],
      note: ["pochopení cílů", "& cílové skupiny"],
      // Řádky karty zadání; položka s dvojtečkou na konci je „Zaměření na"
      // a její hodnota jsou body oddělené čárkou.
      details: [
        { label: "Cíl", value: "Propagace produktu" },
        { label: "Cílová skupina", value: "Milovníci prémiové čokolády a sladkostí" },
        { label: "Výstupy", value: "Reklamní vizuál" },
        { label: "Termín", value: "3 dny" },
        { label: "Zaměření na:", value: "Prémiovost, Čistý design, Chuť" },
      ],
    },
    {
      stage: "02",
      title: "Koncept",
      text: [
        ["Vizuální směr vychází z barev samotného produktu. Důraz je kladen na", false],
        ["kontrast, detail produktu", true],
        ["a charakter značky.", false],
      ],
      note: ["moodboard &", "vizuální směr"],
      // Písmo, pak barvy palety (hodnota je barva v hex).
      details: [
        { label: "Typografie", value: "Agrandir" },
        { label: "Barva", value: "#9cae5c" },
        { label: "Barva", value: "#3b2318" },
        { label: "Barva", value: "#d9873f" },
        { label: "Barva", value: "#f4ead2" },
      ],
    },
    {
      stage: "03",
      title: "Tvorba",
      text: [
        ["Tvořím s jasným záměrem.", false],
        ["Každý prvek má svou funkci", true],
        ["– zaujmout, komunikovat a podpořit výsledek.", false],
      ],
      note: ["tvorba", "hlavního vizuálu"],
      details: [],
    },
    {
      stage: "04",
      title: "Doladění",
      text: [
        ["Na základě zpětné vazby", false],
        ["dolaďuji detaily,", true],
        ["dokud není vše připravené do finální podoby.", false],
      ],
      note: ["úpravy a finální", "doladění"],
      // Dvě bubliny chatu: kdo mluví a co říká.
      details: [
        { label: "Klient", value: "Můžeme zkusit dát nadpis větší?" },
        { label: "Já", value: "Jasně, tady to máte změněné." },
      ],
    },
    {
      stage: "05",
      title: "Předání",
      text: [
        ["Finální grafiku předávám ve všech potřebných formátech,", false],
        ["připravenou pro použití", true],
        ["napříč platformami.", false],
      ],
      note: ["předání ve všech", "potřebných formátech"],
      // Popisky tří formátů: rozměr a název.
      details: [
        { label: "1080 x 1920 px", value: "story formát" },
        { label: "1080 x 1350 px", value: "formát na výšku" },
        { label: "1080 x 1080 px", value: "1:1 čtverec" },
      ],
    },
  ] as { stage: string; title: string; text: MarkedLine; note: string[]; details: ProcessDetail[] }[],
  // 06 Další projekty — zatím jen z kódu (ve Studiu není dokument).
  more: {
    stage: "06",
    title: "Další projekty",
    text: [
      ["Kromě bannerů tvořím i", false],
      ["prezentace a vizuální identity značek", true],
      ["— se stejným důrazem na detail.", false],
    ] as MarkedLine,
    banner: { src: "/assets/banners/gummylife_banner1.png", alt: "Banner pro Gummylife", width: 1440, height: 2560 },
    slide: {
      eyebrow: "Prezentace · 04 / 12",
      title: "Výsledky kampaně Q3",
      bars: [38, 62, 88],
      image: { src: "/assets/banners/bruzek_banner1.png", alt: "Kampaň Bruzek na snímku", width: 973, height: 1216 },
    },
    brand: { mark: "N", name: "NOVA", tagline: "studio interiérů", colors: [ACCENT, "#2e2e2e", "#e8e5de", "#6c5ce7"] },
    captions: ["bannery do kampaní", "prezentace", "identita značky"],
  },
  // 07 Výzva před CTA (bez čísla).
  callout: {
    eyebrow: "Pojďme spolupracovat",
    lines: [[["Jste připraveni", false]], [["na", false], ["spolupráci?", true]]] as MarkedLine[],
    lead: "Napište mi, s čím potřebujete pomoct — společně z vašeho nápadu uděláme vizuál, který funguje.",
  },
  // Fotka v kartě zadání (krok 01), když ji dokument kroku nemá.
  briefPhoto: {
    src: "/assets/banners/jordan_banner2.png",
    alt: "Podklad od klienta: dubajská čokoláda Jordan",
    width: 822,
    height: 1024,
  },
  portrait: {
    src: "/assets/rest/main_photo.png",
    alt: "",
    width: 612,
    height: 1019,
  },
  // Sedm ukázek v pořadí, v jakém je track kreslí: tvorba (3), doladění (1),
  // předání (3). Rozměry jsou skutečné rozměry souborů.
  shots: [
    { src: "/assets/banners/jordan_banner4.png", alt: "Reklamní vizuál pro značku Jordan", width: 305, height: 381 },
    { src: "/assets/banners/jordan_banner1.png", alt: "Varianta vizuálu", width: 293, height: 366 },
    { src: "/assets/banners/jordan_banner3.png", alt: "Varianta vizuálu", width: 205, height: 256 },
    { src: "/assets/banners/jordan_banner4.png", alt: "Doladěná verze vizuálu", width: 305, height: 381 },
    { src: "/assets/banners/jordan_banner6.png", alt: "Formát 1080 × 1920 px, story na výšku", width: 231, height: 410 },
    { src: "/assets/banners/jordan_banner1.png", alt: "Formát 1080 × 1350 px na výšku", width: 293, height: 366 },
    { src: "/assets/banners/jordan_banner5.png", alt: "Čtvercový formát 1080 × 1080 px, 1:1", width: 194, height: 194 },
  ],
};

// Texty kompozice kroku 06 v poli `details` dokumentu (pořadí = smlouva se
// seedem): tři popisky, štítek a nadpis snímku, název, podtitul a monogram
// značky. Barvy značky jsou položky s #hex hodnotou, kdekoli v seznamu.
const MORE_TEXTS = {
  captions: [0, 1, 2],
  slideEyebrow: 3,
  slideTitle: 4,
  brandName: 5,
  brandTagline: 6,
  brandMark: 7,
} as const;
const MORE_DETAILS: ProcessDetail[] = [
  { label: "Popisek banneru", value: FALLBACK.more.captions[0] },
  { label: "Popisek prezentace", value: FALLBACK.more.captions[1] },
  { label: "Popisek identity", value: FALLBACK.more.captions[2] },
  { label: "Snímek — štítek", value: FALLBACK.more.slide.eyebrow },
  { label: "Snímek — nadpis", value: FALLBACK.more.slide.title },
  { label: "Značka — název", value: FALLBACK.more.brand.name },
  { label: "Značka — podtitul", value: FALLBACK.more.brand.tagline },
  { label: "Značka — monogram", value: FALLBACK.more.brand.mark },
  ...FALLBACK.more.brand.colors.map((value) => ({ label: "Barva", value })),
];

// Vizuál kroku 04 rozdělený na podklad a nadpis (tools/banner-layers/
// split-title.mjs) — nadpis jde zvětšit zvlášť. Klíč je obrázek kroku 04;
// box nadpisu je podíl obrázku (x, y, šířka, výška).
const TITLE_SPLIT: Record<string, { base: string; title: string; box: [number, number, number, number] }> = {
  "/assets/banners/jordan_banner4.png": {
    base: "/assets/banners/split/jordan_banner4_base.png",
    title: "/assets/banners/split/jordan_banner4_title.png",
    box: [0.128, 0.095, 0.739, 0.236],
  },
};

// Kde v `items` bloku `index.process` co bydlí — musí sedět na src/lib/cms/home.ts.
// 0–1 řádky nadpisu, 2 nápověda posunu.
const AT = { scrollHint: 2 };

// Blok `index.process`, jak ho tvaruje src/lib/cms/home.ts. Kroky, obrázky
// a poznámky nejsou v bloku — jsou to dokumenty `processStep` (prop `steps`).
export type ProcessCopy = {
  docId?: string;
  eyebrow?: string;
  labels?: MarkedLine[];
  labelMark?: string;
  lead?: string;
  scrollHint?: string;
};

// Krok, jak ho kreslí komponenta: dokument ze Studia slitý se zálohou.
type Step = {
  id?: string;
  stage: string;
  title: string;
  text: MarkedLine;
  note: string[];
  details: ProcessDetail[];
};

const HEX = /^#[0-9a-f]{3,8}$/i;

// Ručně psaná anotace s obloučkovou šipkou — v návrhu fialová. Text je pole
// `note` dokumentu kroku, po řádcích; `edit` míří na to pole. Na konci
// kroku se nakreslí (SketchText, šipka stejnou měkkou maskou).
function Annotation({
  lines,
  className,
  flip = false,
  editAttrs,
  progress,
  still = false,
}: {
  lines: string[];
  className?: string;
  editAttrs?: Record<string, unknown>;
  // flip = šipka je vpravo od textu a zrcadlí se. V návrhu to tak má
  // jen krok 02, kde anotace míří zprava nahoru k paletě.
  flip?: boolean;
  progress: MotionValue<number>;
  still?: boolean;
}) {
  const arrow = useSoftReveal(progress, NOTE);
  return (
    <div
      className={`${styles.annotation} ${flip ? styles.annotationFlip : ""} ${
        className ?? ""
      }`}
    >
      {/* Oblouk vychází nahoře u kompozice a stáčí se dolů k textu.
          Kvadratický, aby zatáčel plynule; hrot sedí na jeho konci. */}
      <motion.svg
        className={styles.annotationArrow}
        viewBox="0 0 118 84"
        fill="none"
        style={still ? undefined : { maskImage: arrow, WebkitMaskImage: arrow }}
      >
        {/* Delší oblouk: vychází svisle nahoře a přes dlouhou zatáčku
            doběhne k textu. Kontrolní bod (10, 58) drží zakřivení až
            do poslední třetiny, takže linka není skoro rovná. */}
        <path
          d="M10 4 Q 10 58, 68 72"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        {/* Hrot: ramena spočítaná z tečny v koncovém bodě (58, 14). */}
        <path
          d="M57 61 68 72 53 76.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </motion.svg>
      <SketchText
        as="p"
        progress={progress}
        from={NOTE[0]}
        to={NOTE[1]}
        still={still}
        className={styles.annotationText}
        {...editAttrs}
      >
        {lines.map((line, index) => (
          <span key={index} className={styles.annotationLine}>
            {line}
          </span>
        ))}
      </SketchText>
    </div>
  );
}

// Hlava kroku: číslo (= krok dokumentu), název a text. Text nese tučné fráze
// jako zvýraznění (`options.mark: 'highlight'` v typu processStep).
// Číslo a název se postaví rámečkem, ještě když kamera přilétá (HEAD). Text
// buď napíše umělá myš (`typed`), nebo se nakreslí sám v okně `sketch`.
function StepHead({
  step,
  progress,
  still = false,
  typed,
  textRef,
  sketch,
  onTyped,
}: {
  step: Step;
  progress: MotionValue<number>;
  still?: boolean;
  typed?: boolean;
  textRef?: Ref<HTMLParagraphElement>;
  sketch?: Window;
  /** Text je dopsaný (myš pak přestane čekat). */
  onTyped?: () => void;
}) {
  const edit = editableIn(step.id ?? null);
  // Text pro psaní: tučné fráze jako vlastní úseky.
  const segments = step.text.flatMap(([run, marked], i) => [
    ...(i > 0 ? [{ text: " " }] : []),
    { text: run, className: marked ? styles.stepStrong : undefined },
  ]);
  return (
    <div className={styles.stepHead}>
      {/* Číslo je to, KAM krok patří — mění se polem „Krok", ne psaním. */}
      <SketchText
        progress={progress}
        from={HEAD.number[0]}
        to={HEAD.number[1]}
        tag={`T · ${step.stage}`}
        still={still}
        className={styles.stepNumber}
      >
        {step.stage}
      </SketchText>
      <SketchText
        progress={progress}
        from={HEAD.label[0]}
        to={HEAD.label[1]}
        still={still}
        className={styles.stepLabel}
        {...edit("title")}
      >
        {step.title}
      </SketchText>
      {/* Interpunkce za tučnou frází stojí mimo <strong>, jako v návrhu. */}
      {sketch || still ? (
        <SketchText
          as="p"
          progress={progress}
          from={sketch?.[0] ?? 0}
          to={sketch?.[1] ?? 1}
          still={still}
          className={styles.stepText}
          {...edit("text", "text", "highlight")}
        >
          <Lines lines={[step.text]} markTag="strong" trailClass="" />
        </SketchText>
      ) : (
        <p ref={textRef} className={styles.stepText} {...edit("text", "text", "highlight")}>
          <TypeText segments={segments} placeholder="Text" play={Boolean(typed)} typeSpeed={18} onDone={onTyped} />
        </p>
      )}
    </div>
  );
}

// Šířka barvy v paletě (vw) — o tolik se duplikát táhne z předchozí.
const SWATCH_PITCH = 6.21;

type DupWindow = (i: number) => { a: number; drop: number };

// Barva palety (krok 02, a stejně barvy identity v kroku 06). První se
// postaví (rámeček, měkká výplň), další jsou duplikáty (Ctrl/⌘ + D): kopie
// předchozí barvy se dotáhne na své místo a přebarví se.
function Swatch({
  index,
  color,
  prev,
  progress,
  still,
  ref,
  build = S2.swatch,
  dup: dupOf = swatchDup,
  pitch = SWATCH_PITCH,
  className = styles.swatch,
  fillClassName = styles.swatchFill,
}: {
  index: number;
  color: string;
  prev?: string;
  progress: MotionValue<number>;
  still: boolean;
  ref?: Ref<HTMLLIElement>;
  /** Okno stavby první barvy. */
  build?: Window;
  /** Okna duplikátů (1., 2., …). */
  dup?: DupWindow;
  /** O kolik vw se duplikát táhne (rozteč barev). */
  pitch?: number;
  className?: string;
  fillClassName?: string;
}) {
  const dup = index > 0 ? dupOf(index) : null;
  const x = useTransform(progress, (s) =>
    dup ? cvw(-(1 - ease(within([dup.a, dup.drop])(s))) * pitch) : "0vw",
  );
  const on = useTransform(progress, (s) => (dup ? (s >= dup.a ? 1 : 0) : 1));
  const copy = useTransform(progress, (s) => (dup ? 1 - within([dup.drop, dup.drop + 0.015])(s) : 0));
  const [a, b] = build;
  const fill = useTransform(progress, (s) => softMask(ease(within([a + (b - a) * 0.45, b])(s))));
  if (still) {
    return (
      <li ref={ref} className={className}>
        <span className={fillClassName} style={{ background: color }} />
      </li>
    );
  }
  return (
    <motion.li ref={ref} className={className} style={{ x, opacity: on }}>
      {dup ? null : <BuildFrame progress={progress} from={a} to={b} tag="Barva" />}
      <motion.span
        className={fillClassName}
        style={dup ? { background: color } : { background: color, maskImage: fill, WebkitMaskImage: fill }}
      />
      {dup && prev ? <motion.span className={fillClassName} style={{ background: prev, opacity: copy }} /> : null}
    </motion.li>
  );
}

// Řádek karty zadání (krok 01): linka se natáhne, myš napíše popisek a pak
// hodnotu (jako když se karta skládá ve Figmě).
function BriefRow({
  index,
  label,
  value,
  progress,
  still,
  typed,
  labelRef,
  valueRef,
  onTyped,
  labelEdit,
  valueEdit,
}: {
  index: number;
  label: string;
  value: string;
  progress: MotionValue<number>;
  still: boolean;
  /** Kolik polí karty se už píše (designer.ts). */
  typed: number;
  labelRef: (node: HTMLElement | null) => void;
  valueRef: (node: HTMLElement | null) => void;
  onTyped: () => void;
  labelEdit: Record<string, unknown>;
  valueEdit: Record<string, unknown>;
}) {
  const rule = useTransform(progress, (s) => ease(within(briefRow(index).line)(s)));
  // Pole: 0 = nadpis karty, pak popisek a hodnota každého řádku.
  const labelAt = 1 + index * 2;
  return (
    <div className={styles.briefRow}>
      <motion.span className={styles.briefRule} style={still ? undefined : { scaleX: rule }} aria-hidden="true" />
      <dt ref={labelRef} {...labelEdit}>
        {still ? label : <TypeText segments={[{ text: label }]} placeholder="" play={typed > labelAt} typeSpeed={26} />}
      </dt>
      <dd ref={valueRef} {...valueEdit}>
        {still ? (
          value
        ) : (
          <TypeText segments={[{ text: value }]} placeholder="" play={typed > labelAt + 1} typeSpeed={20} onDone={onTyped} />
        )}
      </dd>
    </div>
  );
}

// Formát kroku 05. Story se postaví jako banner a myš ji natáhne; formát
// na výšku myš dotáhne zprava; čtverec je jeho duplikát stažený na 1:1
// (kopie se pak přepíše na čtverec). Fialový rámeček ořezu naskočí, až na
// formát myš klikne; popisek se pomalu napíše.
function DeliverFormat({
  index,
  variant,
  src,
  image,
  copy,
  caption,
  progress,
  still,
  storyRatio,
  formatRef,
  hint,
}: {
  index: number;
  variant: string;
  /** Obrázek formátu (k němu se hledá rozklad na vrstvy). */
  src: string;
  image: ReactNode;
  /** Obsah kopie (čtverec vzniká z formátu na výšku). */
  copy?: ReactNode;
  caption: ReactNode;
  progress: MotionValue<number>;
  still: boolean;
  storyRatio: MotionValue<string>;
  formatRef: (node: HTMLElement | null) => void;
  /** Proklik do inspektoru (InspectHint) — leží přes celý formát. */
  hint?: ReactNode;
}) {
  const kind = (["story", "portrait", "square"] as const)[index];
  const mark = S5.marks[index];
  const markIn = useTransform(progress, within([mark.click, mark.click + 0.008]));
  const x = useTransform(progress, (s) =>
    kind === "portrait" ? cvw((1 - ease(within(S5.portraitDrag)(s))) * 70) : "0vw",
  );
  const y = useTransform(progress, (s) =>
    kind === "square" ? cvh(-(1 - ease(within(S5.square.drag)(s))) * SQUARE_DROP) : "0vh",
  );
  const shown = useTransform(progress, (s) =>
    kind === "portrait" ? (s >= S5.portraitDrag[0] ? 1 : 0) : kind === "square" ? (s >= S5.square.drag[0] ? 1 : 0) : 1,
  );
  const squareRatio = useTransform(progress, (s) => `1080 / ${mix(1350, 1080, ease(within(S5.square.resize)(s)))}`);
  const ownIn = useTransform(progress, within([S5.square.resize[1], S5.square.resize[1] + 0.02]));
  const formatClass = [styles.formatStory, styles.formatPortrait, styles.formatSquare][index];
  const captionAt = S5.captions[index];

  let format: ReactNode;
  if (kind === "story") {
    format = (
      <motion.div ref={formatRef} className={formatClass} style={still ? undefined : { aspectRatio: storyRatio }}>
        <LayeredReveal src={src} progress={progress} at={S5.story} still={still}>
          {image}
        </LayeredReveal>
      </motion.div>
    );
  } else if (kind === "square" && !still) {
    format = (
      <motion.div ref={formatRef} className={formatClass} style={{ aspectRatio: squareRatio }}>
        {copy}
        <motion.div className={styles.formatOwn} style={{ opacity: ownIn }}>
          {image}
        </motion.div>
      </motion.div>
    );
  } else {
    format = (
      <div ref={formatRef} className={formatClass}>
        {image}
      </div>
    );
  }

  return (
    <motion.div className={`${styles.deliver} ${variant}`} style={still ? undefined : { x, y, opacity: shown }}>
      <div className={styles.cropMarks}>
        {format}
        <motion.span className={styles.cropFrame} style={still ? undefined : { opacity: markIn }} aria-hidden="true" />
        {hint}
      </div>
      {caption ? (
        <SketchText as="p" progress={progress} from={captionAt[0]} to={captionAt[1]} still={still} className={styles.deliverCaption}>
          {caption}
        </SketchText>
      ) : null}
    </motion.div>
  );
}

// Export kroku 05: tlačítko vlevo od story. Po kliknutí se otevře e-mail
// s podklady, myš klikne na Odeslat a e-mail odletí; tlačítko pak hlásí
// Odesláno.
function ExportMail({
  progress,
  still,
  files,
  buttonRef,
  sendRef,
}: {
  progress: MotionValue<number>;
  still: boolean;
  files: string[];
  buttonRef: (node: HTMLElement | null) => void;
  sendRef: (node: HTMLElement | null) => void;
}) {
  const mailIn = useTransform(progress, (s) => ease(within(S5.mail)(s)));
  const fly = useTransform(progress, (s) => ease(within(S5.fly)(s)));
  const opacity = useTransform([mailIn, fly] as const, ([a, f]: number[]) => a * (1 - f));
  const scale = useTransform([mailIn, fly] as const, ([a, f]: number[]) => (0.92 + 0.08 * a) * (1 - 0.7 * f));
  const x = useTransform(fly, (f) => cvw(f * 38));
  const y = useTransform(fly, (f) => cvh(-f * 46));
  const rotate = useTransform(fly, (f) => -10 * f);
  const sent = useTransform(progress, within([S5.fly[1] - 0.004, S5.fly[1] + 0.008]));
  const label = useTransform(sent, (v) => 1 - v);
  const pressed = useTransform(progress, (s) => (s >= S5.exportClick && s < S5.fly[1] ? 1 : 0));
  // Tlačítko se postaví jako vrstva (rámeček s rozměrem, výplň shora).
  const { mask } = useBlockBuild(progress, S5.exportIn[0], S5.exportIn[1]);
  return (
    <>
      <div className={styles.exportSlot}>
        {still ? null : <BuildFrame progress={progress} from={S5.exportIn[0]} to={S5.exportIn[1]} tag="Tlačítko" size />}
      <motion.div
        ref={buttonRef}
        className={styles.exportButton}
        style={still ? undefined : { maskImage: mask, WebkitMaskImage: mask }}
      >
        <motion.span className={styles.exportPressed} style={still ? { opacity: 0 } : { opacity: pressed }} aria-hidden="true" />
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
          <path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19h14" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className={styles.exportLabels}>
          <motion.span style={still ? undefined : { opacity: label }}>Exportovat</motion.span>
          <motion.span style={{ opacity: still ? 0 : sent }}>Odesláno ✓</motion.span>
        </span>
      </motion.div>
      </div>
      {still ? null : (
        <motion.div className={styles.mailCard} style={{ opacity, scale, x, y, rotate }} aria-hidden="true">
          <span className={styles.mailTitle}>Nový e-mail</span>
          <span className={styles.mailRow}>
            <span>Komu</span> klient@jordan.cz
          </span>
          <span className={styles.mailRow}>
            <span>Předmět</span> Finální podklady
          </span>
          <ul className={styles.mailFiles}>
            {files.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
          <span ref={sendRef} className={styles.mailSend}>
            Odeslat
          </span>
        </motion.div>
      )}
    </>
  );
}

// Sloupec grafu na snímku prezentace (krok 06) — postaví se zdola stejnou
// měkkou maskou jako vrstvy.
function SlideBar({
  height,
  progress,
  at,
  still,
}: {
  height: number;
  progress: MotionValue<number>;
  at: Window;
  still: boolean;
}) {
  const mask = useTransform(progress, (s) => softMask(ease(within(at)(s)), "0deg"));
  return (
    <motion.span
      className={styles.slideBar}
      style={still ? { height: `${height}%` } : { height: `${height}%`, maskImage: mask, WebkitMaskImage: mask }}
    />
  );
}

/** Obrázek kroku na pozici, jinak ten z kódu. */
const shotOf = (
  docs: ProcessStep | undefined,
  index: number,
  fallback: { src: string; alt: string; width: number; height: number },
) => picture(docs?.images?.[index], fallback);

// Prvky Procesu jsou v registru jen pro umělou myš (najde je a „napíše") —
// kurzor návštěvníka se na ně nerozkládá.
const NO_SNAP = { snap: false };

// Úzké okno na šířku (telefon): bez stavby a bez umělé myši. Na výšku
// (tablet i telefon) jede Proces celý jako na tabletu — styles, blok xs-v.
const NARROW = "(max-width: 820px) and (orientation: landscape)";
const subscribeNarrow = (notify: () => void) => {
  const media = window.matchMedia(NARROW);
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
};
const readNarrow = () => window.matchMedia(NARROW).matches;

/** Zastávka v okně sekce: dlaždice kamery, číslo na tlačítku a název. */
type NavStop = { tile: number; number: string; title: string };

/**
 * Okno sekce: zastávky 0 (úvod), 1–5 (kroky) a 6 (další projekty) jako
 * tlačítka místo scrollu — kamera dolly k nim přeletí. Šipky ← → jdou na
 * sousední zastávku, Home zpět na úvod.
 */
function StepNav({
  stops,
  active,
  onSelect,
}: {
  stops: NavStop[];
  active: number;
  onSelect: (tile: number) => void;
}) {
  // Šipky jdou po zastávkách, ne po dlaždicích — mezi 6 a CTA je dlaždice
  // výzvy bez vlastního tlačítka.
  useEffect(() => {
    const at = Math.max(0, stops.findIndex((stop) => stop.tile === active));
    const go = (index: number) => onSelect(stops[Math.min(Math.max(index, 0), stops.length - 1)].tile);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") go(at + 1);
      else if (event.key === "ArrowLeft") go(at - 1);
      else if (event.key === "Home") go(0);
      else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, onSelect, stops]);

  return (
    <nav className={styles.stepNav} aria-label="Kroky spolupráce">
      {stops.map((stop) => {
        const current = stop.tile === active;
        return (
          <button
            key={stop.tile}
            type="button"
            className={current ? `${styles.stepNavItem} ${styles.isCurrent}` : styles.stepNavItem}
            aria-current={current ? "step" : undefined}
            aria-label={`${stop.number}. ${stop.title}`}
            onClick={() => onSelect(stop.tile)}
          >
            <span className={styles.stepNavNumber}>{stop.number}</span>
            <span className={styles.stepNavTitle}>{stop.title}</span>
          </button>
        );
      })}
    </nav>
  );
}

// Krok je postavený od tohoto průběhu svého úseku (ručně psaná poznámka,
// NOTE v steps.ts, končí v 0,97). Štítky pak naskočí za HINT_DELAY s,
// víc štítků v kroku po HINT_STAGGER s.
const BUILT = 0.97;
const HINT_DELAY = 0.15;
const HINT_STAGGER = 0.45;

export default function Process({
  copy = null,
  steps: docs = null,
  cta = null,
  popup = false,
}: {
  copy?: ProcessCopy | null;
  steps?: ProcessStep[] | null;
  /**
   * Okno sekce (layout/section-popup): bez přišpendlení a bez scrollu —
   * kroky stojí hotové a kameru posílají tlačítka 1–5 (StepNav).
   */
  popup?: boolean;
  /** CTA jako poslední dlaždice dolly (components/home/cta) — dostane průběh
   *  svého úseku (nástup) a jestli má stát hotové. */
  cta?: ((progress: MotionValue<number>, still: boolean) => ReactNode) | null;
}) {
  const containerRef = useRef<HTMLElement>(null);
  const lineRef = useRef<DollyLineHandle>(null);
  const edit = editableIn(copy?.docId ?? null);
  const docOf = (stage: string) => docs?.find((doc) => doc.stage === stage);

  const labels = hasLines(copy?.labels) ? copy.labels : null;
  const heading =
    labels && labels.length >= FALLBACK.heading.length
      ? labels.slice(0, FALLBACK.heading.length)
      : FALLBACK.heading;
  const eyebrow = text(copy?.eyebrow, FALLBACK.eyebrow);
  const lead = text(copy?.lead, FALLBACK.lead);
  const scrollHint = text(copy?.scrollHint, FALLBACK.scrollHint);
  // Pět kroků dává křivka i rozvržení screenů. Každý krok je dokument podle
  // pole „Krok"; co v něm chybí, dodá záloha z kódu — pole po poli.
  const steps: Step[] = FALLBACK.steps.map((fallback) => {
    const doc = docOf(fallback.stage);
    return {
      ...(doc?.id ? { id: doc.id } : {}),
      stage: fallback.stage,
      title: text(doc?.title, fallback.title),
      text: doc?.text?.length ? doc.text : fallback.text,
      note: doc?.note?.length ? doc.note : fallback.note,
      details: doc?.details?.length ? doc.details : fallback.details,
    };
  });
  const [one, two, three, four, five] = steps;

  // Start = úvod sekce: portrét je první obrázek jeho dokumentu.
  const start = docOf("start");
  const portrait = picture(start?.images?.[0], FALLBACK.portrait);

  // Obrázky kroků v pořadí, v jakém je track kreslí (viz FALLBACK.shots).
  const make = docOf("03");
  const tune = docOf("04");
  const deliver = docOf("05");
  const shots = [
    shotOf(make, 0, FALLBACK.shots[0]),
    shotOf(make, 1, FALLBACK.shots[1]),
    shotOf(make, 2, FALLBACK.shots[2]),
    shotOf(tune, 0, FALLBACK.shots[3]),
    shotOf(deliver, 0, FALLBACK.shots[4]),
    shotOf(deliver, 1, FALLBACK.shots[5]),
    shotOf(deliver, 2, FALLBACK.shots[6]),
  ];
  const briefPhoto = picture(docOf("01")?.images?.[0], FALLBACK.briefPhoto);

  // Drobné texty kompozic (pole `details`), každý krok po svém.
  const briefRows = one.details.filter((d) => !d.label.trim().endsWith(":"));
  const focus = one.details.find((d) => d.label.trim().endsWith(":"));
  const focusPoints = (focus?.value ?? "")
    .split(",")
    .map((point) => point.trim())
    .filter(Boolean);
  const typeface = two.details.find((d) => !HEX.test(d.value.trim()));
  const palette = two.details.filter((d) => HEX.test(d.value.trim()));
  const editOne = editableIn(one.id ?? null);
  const editTwo = editableIn(two.id ?? null);
  const editFour = editableIn(four.id ?? null);
  const editFive = editableIn(five.id ?? null);
  const detailAt = (step: Step, detail: ProcessDetail | undefined) =>
    detail ? step.details.indexOf(detail) : -1;

  // Portrét sem při příchodu donese umělá myš z Info (info/choreography.ts)
  // — najde ho v registru a během letu ho schová. Stejně najde nadpis,
  // text a nápovědu, které pak „napíše".
  const registry = useRefRegistry();
  const portraitRef = useCallback(
    (node: HTMLImageElement | null) => registry.register("process-portrait", node, NO_SNAP),
    [registry],
  );
  const headlineRef = useCallback(
    (node: HTMLElement | null) => registry.register("process-headline", node, NO_SNAP),
    [registry],
  );
  const leadRef = useCallback(
    (node: HTMLElement | null) => registry.register("process-lead", node, NO_SNAP),
    [registry],
  );
  const hintRef = useCallback(
    (node: HTMLElement | null) => registry.register("process-hint", node, NO_SNAP),
    [registry],
  );
  const editing = Boolean(copy?.docId);
  const narrow = useSyncExternalStore(subscribeNarrow, readNarrow, () => false);
  // Hotový stav bez stavby a bez myši: Studio, úzké okno a okno sekce.
  const still = editing || narrow || popup;
  const tablet = useMedia(PORTRAIT_TABLET);
  const dollyLayout = tablet ? DOLLY_TABLET : DOLLY;

  // Na výšku se kompozice kroků kreslí jako na tabletu 1128 a celé se
  // zmenší (CSS zoom, styles blok xs-v) — i s písmem, takže nic nepřeteče
  // z karet. Faktor podle šířky okna; telefon o kus větší (kompozice má
  // vlevo menší okraj, vejde se).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const apply = () => {
      const w = window.innerWidth;
      const k = (w / COMP_REF_WIDTH) * (w < 600 ? COMP_PHONE_BOOST : 1);
      el.style.setProperty("--comp-zoom", k.toFixed(4));
    };
    apply();
    window.addEventListener("resize", apply);
    return () => window.removeEventListener("resize", apply);
  }, []);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });
  // Okno sekce: kamera (v dlaždicích) podle tlačítek, ne podle scrollu.
  const camera = useMotionValue(0);
  const [stop, setStop] = useState(0);
  const flyTo = useCallback(
    (tile: number) => {
      setStop(tile);
      const distance = Math.abs(tile - camera.get());
      animate(camera, tile, { duration: Math.min(0.8 + distance * 0.25, 1.8), ease: [0.65, 0, 0.35, 1] });
    },
    [camera],
  );

  // Kamera dolly (v dlaždicích: 0 = úvod, 1–6 kroky, 7 výzva, 8 CTA).
  // Rozjede se až po umělé myši (napíše nadpis a text, přidá nápovědu —
  // designer-timeline.ts) a před koncem sekce stojí u CTA.
  const STEPS = cta ? 8 : 7;
  // Průběh úseků (0 → SEGMENTS): v každém kamera odletí k další dlaždici
  // a pak u ní stojí, zatímco se krok staví (steps.ts).
  // V okně jsou všechny kroky hotové (úseky na konci).
  const seg = useTransform(scrollYProgress, (p) =>
    popup ? SEGMENTS : segAt((p - PROCESS.dollyStart) / (PROCESS.dollyEnd - PROCESS.dollyStart)),
  );
  const dolly = useTransform([seg, camera] as const, ([v, c]: number[]) =>
    popup ? c : Math.min(cameraAt(v), STEPS),
  );
  // Linka roste plynule se scrollem (kotvy v LINE, lineHead v steps.ts);
  // v okně s kamerou.
  const lineGrow = useTransform([seg, camera] as const, ([v, c]: number[]) => lineHead(popup ? c : v));
  // Průběh jednotlivých kroků v jejich úsecích.
  const sp1 = useTransform(seg, (v) => stepAt(v, 1));
  const sp2 = useTransform(seg, (v) => stepAt(v, 2));
  const sp3 = useTransform(seg, (v) => stepAt(v, 3));
  const sp4 = useTransform(seg, (v) => stepAt(v, 4));
  const sp5 = useTransform(seg, (v) => stepAt(v, 5));
  const sp6 = useTransform(seg, (v) => stepAt(v, 6));
  const sp7 = useTransform(seg, (v) => stepAt(v, 7));
  const sp8 = useTransform(seg, (v) => stepAt(v, 8));
  // Štítky „Rozbalit detail" až po stavbě kroku — dřív by blikaly nad
  // prázdnou kompozicí (a z dálky). Krok je hotový, když jeho průběh
  // dojede na BUILT; pak má ještě pauzu (STEP_HOLD_VH), kdy se štítky ukážou.
  const [builtUpTo, setBuiltUpTo] = useState(0);
  useMotionValueEvent(seg, "change", (v) => {
    const next = Math.floor(v + (1 - BUILT));
    if (next !== builtUpTo) setBuiltUpTo(next);
  });
  const shown = (step: number) => still || builtUpTo >= step;
  // 06 Další projekty: dokument kroku „06", co chybí, dodá kód.
  const sixDoc = docOf("06");
  const more: Step = {
    ...(sixDoc?.id ? { id: sixDoc.id } : {}),
    stage: FALLBACK.more.stage,
    title: text(sixDoc?.title, FALLBACK.more.title),
    text: sixDoc?.text?.length ? sixDoc.text : FALLBACK.more.text,
    note: [],
    details: sixDoc?.details?.length ? sixDoc.details : MORE_DETAILS,
  };
  const editSix = editableIn(more.id ?? null);
  // Texty kompozice: položky bez #hex podle pořadí; `at` = index v celém poli
  // (anotace míří na `details.<at>.value`).
  const moreTexts = more.details.filter((d) => !HEX.test(d.value.trim()));
  const moreText = (index: number) => {
    const entry = moreTexts[index];
    return {
      value: text(entry?.value, MORE_DETAILS[index].value),
      edit: entry ? editSix(`details.${more.details.indexOf(entry)}.value`) : {},
    };
  };
  const moreCaptions = MORE_TEXTS.captions.map((i) => moreText(i));
  const slideEyebrow = moreText(MORE_TEXTS.slideEyebrow);
  const slideTitle = moreText(MORE_TEXTS.slideTitle);
  const brandName = moreText(MORE_TEXTS.brandName);
  const brandTagline = moreText(MORE_TEXTS.brandTagline);
  const brandMark = moreText(MORE_TEXTS.brandMark);
  const ownColors = more.details.map((d) => d.value.trim()).filter((v) => HEX.test(v));
  const brandColors = ownColors.length ? ownColors : FALLBACK.more.brand.colors;
  const moreBanner = picture(sixDoc?.images?.[0], FALLBACK.more.banner);
  const slideImage = picture(sixDoc?.images?.[1], FALLBACK.more.slide.image);

  // Výzva před CTA: dokument „Výzva" — název = nadtitulek, poznámka = řádky
  // nadpisu (poslední slovo zezelená), text = úvod.
  const calloutDoc = docOf("callout");
  const editCallout = editableIn(calloutDoc?.id ?? null);
  const calloutEyebrow = text(calloutDoc?.title, FALLBACK.callout.eyebrow);
  const calloutLines: MarkedLine[] = calloutDoc?.note?.length
    ? calloutDoc.note.map((row, i, rows) => {
        if (i < rows.length - 1) return [[row, false]];
        const cut = row.lastIndexOf(" ");
        return cut > 0 ? [[row.slice(0, cut), false], [row.slice(cut + 1), true]] : [[row, true]];
      })
    : FALLBACK.callout.lines;
  const calloutLead: MarkedLine = calloutDoc?.text?.length ? calloutDoc.text : [[FALLBACK.callout.lead, false]];

  // Umělá myš v krocích: prvky, ke kterým jezdí (klíče v designer.ts).
  // Registr vzniká jednou; callback na klíč je stálý (bez odpojování při renderu).
  const [stepEls] = useState(() => {
    const elements: Record<string, HTMLElement | null> = {};
    const binds: Record<string, (node: HTMLElement | null) => void> = {};
    return {
      elements,
      bind: (key: string) =>
        (binds[key] ??= (node: HTMLElement | null) => {
          elements[key] = node;
        }),
    };
  });
  const stepRef = stepEls.bind;
  const designer = useStepDesigner({
    seg,
    elements: stepEls.elements,
    enabled: !still,
    palette: palette.map((color) => color.value.trim()),
    briefRows: briefRows.length,
    brandColors: brandColors.length,
  });
  // Dotažení myší: lístek kroku 01 zprava.
  const noteX = useTransform(sp1, (s) => cvw((1 - ease(within(S1.noteDrag)(s))) * 70));
  const noteOn = useTransform(sp1, (s) => (s >= S1.noteDrag[0] ? 1 : 0));
  // Krok 04: nadpis ve vizuálu se po přepsání velikosti zvětší.
  const titleScale = useTransform(sp4, (s) => TITLE_FROM + (1 - TITLE_FROM) * ease(within(S4.grow)(s)));
  const split = TITLE_SPLIT[shots[3].src];
  // Krok 05: story se natáhne z 1080 × 1350 na 1080 × 1920.
  const storyRatio = useTransform(
    sp5,
    (s) => `${STORY.width} / ${STORY.from + (STORY.to - STORY.from) * ease(within(S5.stretch)(s))}`,
  );

  // Co už myš napsala (podle scrollu, stejné časy jako její pohyb).
  // V okně se nadpis a text napíšou hned po otevření.
  const [typed, setTyped] = useState({ headline: popup, lead: popup, hint: popup });
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    if (popup) return;
    const next = {
      headline: v >= PROCESS.headlineClick,
      lead: v >= PROCESS.leadClick,
      hint: v >= PROCESS.hintClick,
    };
    if (next.headline !== typed.headline || next.lead !== typed.lead || next.hint !== typed.hint) setTyped(next);
  });
  // Nadpis jako úseky pro psaní: zvýrazněná slova v barvě, koncová
  // interpunkce zvýraznění (tečka) bílá jako u Lines.
  const TRAIL = /([.,;:!?…]+)$/;
  const headlineSegments = heading.flatMap((row, r) => [
    ...(r > 0 ? [{ text: "\n" }] : []),
    ...row.flatMap(([run, marked], i) => {
      const lead = i > 0 ? " " : "";
      if (!marked) return [{ text: `${lead}${run}` }];
      const split = run.match(TRAIL);
      const word = split ? run.slice(0, -split[1].length) : run;
      return [
        ...(lead ? [{ text: lead }] : []),
        { text: word, className: styles.accent },
        ...(split ? [{ text: split[1], className: styles.dot }] : []),
      ];
    }),
  ]);

  return (
    // Proklik obrázků do inspektoru (InspectHint) — inspektor kreslí portál.
    <InspectRoot>
    <section
      ref={containerRef}
      className={popup ? `${styles.container} ${styles.containerPopup}` : styles.container}
      id={popup ? undefined : "proces"}
      data-cursor="user"
      data-scroll-label="Proces"
    >
      {/* Odkaz „Spolupráce" v menu: místo ve scrollu, kde dorazí CTA. Pro
          posuvník stránky je to samostatná sekce (CTA je jen animačně
          poslední dlaždice dolly, obsahově vlastní sekce). */}
      {cta ? (
        <span
          id="spoluprace"
          data-scroll-section=""
          data-scroll-label="Spolupráce"
          className={styles.ctaAnchor}
          style={{ top: cvh(PROCESS.dollyEnd * PROCESS_PINNED) }}
          aria-hidden="true"
        />
      ) : null}
      <div className={styles.sticky}>
        {/* Linka pod dlaždicemi — běží za obsahem kroků (LINE nahoře).
            Kreslí ji galerie každý snímek (onFrame). */}
        <DollyLine
          ref={lineRef}
          anchors={cta ? LINE : LINE.slice(0, -1)}
          width={LINE_STYLE.width}
          fade={LINE_STYLE.fade}
          pass={LINE_STYLE.pass}
          head={lineGrow}
          className={styles.curve}
          nodeClassName={styles.curveNode}
          finalClassName={`${styles.curveNode} ${styles.curveFinal}`}
          finalContent={<CheckIcon />}
        />

        {/* Úvod a kroky 01–05 jako dlaždice — kamera jimi projíždí do
            hloubky podle scrollu (DOLLY nahoře). */}
        <DollyGallery
          className={styles.dolly}
          tileClassName={styles.dollyTile}
          label={eyebrow}
          offset={dolly}
          infinite={false}
          fit={dollyLayout.fit}
          perspective={DOLLY.perspective}
          spacing={DOLLY.spacing}
          spread={DOLLY.spread}
          scatter={0}
          revealRange={dollyLayout.revealRange}
          passRange={DOLLY.passRange}
          smooth={DOLLY.smooth}
          drift={DOLLY.drift}
          pulse={0}
          tilt={0}
          parallaxX={0}
          parallaxY={0}
          tiles={dollyLayout.tiles}
          onFrame={(frame) => lineRef.current?.draw(frame)}
          items={[
            // ---------- Úvod: nadpis, text, nápověda a portrét ----------
            <div key="start" className={styles.intro}>
              <div className={styles.lead}>
                <p className={styles.eyebrow} {...edit("title")}>
                  {eyebrow}
                </p>
                {/* Řádky jsou spany bez <br>, proto anotace `lines`: každé dítě
                    <h2> je jeden řádek a ukládá se do items.i.label. */}
                <h2
                  ref={headlineRef}
                  className={styles.headline}
                  {...edit.lines("items.*.label", copy?.labelMark)}
                >
                  {/* Ve Studiu řádky (překryv je čte); na webu nadpis napíše
                      umělá myš (TypeText), jako v Info. */}
                  {editing ? (
                    heading.map((row, index) => (
                      <span key={index} className={styles.headlineRow}>
                        <Lines
                          lines={[row]}
                          markClass={styles.accent}
                          trailClass={styles.dot}
                        />
                      </span>
                    ))
                  ) : (
                    <TypeText segments={headlineSegments} placeholder="Nadpis" play={typed.headline} onDone={markTyped("p-headline")} />
                  )}
                </h2>
                <p ref={leadRef} className={styles.leadText} {...edit("body")}>
                  {editing ? (
                    lead
                  ) : (
                    <TypeText segments={[{ text: lead }]} placeholder="Text" play={typed.lead} typeSpeed={22} onDone={markTyped("p-lead")} />
                  )}
                </p>

                {/* Nápověda posunu pod textem — menší; přidá ji umělá myš.
                    V okně se neposouvá, kroky vedou tlačítka. */}
                {popup ? null : (
                <motion.div
                  ref={hintRef}
                  className={styles.hint}
                  initial={false}
                  animate={editing || typed.hint ? { opacity: 1 } : { opacity: 0 }}
                  transition={{ duration: 0.35 }}
                >
                  <ScrollPlaceholder
                    orientation="horizontal"
                    label={scrollHint}
                    labelProps={edit(`items.${AT.scrollHint}.label`)}
                  />
                </motion.div>
                )}

              </div>

              {/* Portrét je obrázek dokumentu Start (Proces → Start). */}
              <div
                className={styles.portrait}
                {...editableIn(start?.id ?? null).set("images")}
              >
                <Image
                  ref={portraitRef}
                  src={portrait.src}
                  alt={portrait.alt}
                  width={portrait.width}
                  height={portrait.height}
                  className={styles.portraitImage}
                  sizes="(max-width: 1000px) 50vw, 26vw"
                />
              </div>
            </div>,

            // ---------- Krok 01: zadání ----------
            <div
              key="01"
              className={`${styles.step} ${styles.stepOne}`}
              {...editableDoc(one.id ?? null, "processStep")}
            >
              <StepHead
                step={one}
                progress={sp1}
                still={still}
                typed={designer.typed.s1}
                textRef={stepRef("s1-text")}
                onTyped={designer.doneFor("s1")}
              />

              {/* Kompozice kroku. Texty v ní jsou pole `details` dokumentu
                  kroku, obrázek v kartě zadání je jeho první obrázek.
                  Kartu nakreslí myš rámečkem, fotka se postaví sama, lístek
                  myš dotáhne zprava. */}
              <div className={styles.briefComposition}>
                <Drawn
                  ref={stepRef("s1-card")}
                  progress={sp1}
                  draw={S1.draw}
                  reveal={S1.cardIn}
                  label="Zadání grafiky"
                  still={still}
                  className={styles.briefSlot}
                  bodyClassName={styles.briefCard}
                >
                  <p ref={stepRef("s1-title")} className={styles.briefTitle}>
                    {still ? (
                      "Zadání grafiky"
                    ) : (
                      <TypeText
                        segments={[{ text: "Zadání grafiky" }]}
                        placeholder=""
                        play={designer.typed.brief > 0}
                        typeSpeed={30}
                        onDone={designer.doneFor("brief-title")}
                      />
                    )}
                  </p>
                  <dl className={styles.briefList}>
                    {briefRows.map((row, i) => {
                      const at = detailAt(one, row);
                      return (
                        <BriefRow
                          key={at}
                          index={i}
                          label={row.label}
                          value={row.value}
                          progress={sp1}
                          still={still}
                          typed={designer.typed.brief}
                          labelRef={stepRef(`s1-row-${i}-label`)}
                          valueRef={stepRef(`s1-row-${i}-value`)}
                          onTyped={designer.doneFor(`brief-${i}`)}
                          labelEdit={editOne(`details.${at}.label`)}
                          valueEdit={editOne(`details.${at}.value`)}
                        />
                      );
                    })}
                  </dl>
                </Drawn>

                {/* Fotka (podklad od klienta) se postaví jako bannery v heru. */}
                <div className={styles.briefPhotoSlot} {...editOne.set("images")}>
                  <div className={styles.revealBody}>
                    <LayeredReveal src={briefPhoto.src} progress={sp1} at={S1.photo} still={still}>
                      <Image
                        src={briefPhoto.src}
                        alt={briefPhoto.alt}
                        width={briefPhoto.width}
                        height={briefPhoto.height}
                        sizes="12vw"
                      />
                    </LayeredReveal>
                  </div>
                </div>

                {focus ? (
                  <motion.div
                    ref={stepRef("s1-note")}
                    className={styles.briefNote}
                    style={still ? undefined : { x: noteX, opacity: noteOn }}
                  >
                    <p
                      className={styles.briefNoteTitle}
                      {...editOne(`details.${detailAt(one, focus)}.label`)}
                    >
                      {focus.label}
                    </p>
                    <ul {...editOne(`details.${detailAt(one, focus)}.value`)}>
                      {focusPoints.map((point) => (
                        <li key={point}>{point}</li>
                      ))}
                    </ul>
                  </motion.div>
                ) : null}
              </div>

              <Annotation
                className={styles.annotationOne}
                lines={one.note}
                editAttrs={editOne("note")}
                progress={sp1}
                still={still}
              />
            </div>,

            // ---------- Krok 02: koncept ----------
            <div
              key="02"
              className={`${styles.step} ${styles.stepTwo}`}
              {...editableDoc(two.id ?? null, "processStep")}
            >
              <StepHead
                step={two}
                progress={sp2}
                still={still}
                typed={designer.typed.s2}
                textRef={stepRef("s2-text")}
                onTyped={designer.doneFor("s2")}
              />

              {/* Karta písma se postaví sama, barvy staví myš: první
                  postaví, další zduplikuje a přebarví. */}
              <div className={styles.conceptComposition}>
                {typeface ? (
                  <Block
                    progress={sp2}
                    at={S2.type}
                    tag="Typografie"
                    still={still}
                    className={styles.typeCardSlot}
                    bodyClassName={styles.typeCard}
                  >
                    <p
                      className={styles.typeCardLabel}
                      {...editTwo(`details.${detailAt(two, typeface)}.label`)}
                    >
                      {typeface.label}
                    </p>
                    <p className={styles.typeCardSample}>Aa</p>
                    <p
                      className={styles.typeCardName}
                      {...editTwo(`details.${detailAt(two, typeface)}.value`)}
                    >
                      {typeface.value}
                    </p>
                  </Block>
                ) : null}
                <ul className={styles.palette}>
                  {palette.map((color, index) => (
                    <Swatch
                      key={index}
                      index={index}
                      color={color.value.trim()}
                      prev={palette[index - 1]?.value.trim()}
                      progress={sp2}
                      still={still}
                      ref={stepRef(`s2-swatch-${index}`)}
                    />
                  ))}
                </ul>
              </div>

              <Annotation
                className={styles.annotationTwo}
                lines={two.note}
                editAttrs={editTwo("note")}
                progress={sp2}
                still={still}
                flip
              />
            </div>,

            // ---------- Krok 03: tvorba ----------
            <div
              key="03"
              className={`${styles.step} ${styles.stepThree}`}
              {...editableDoc(three.id ?? null, "processStep")}
            >
              <StepHead step={three} progress={sp3} still={still} sketch={S3.text} />

              {/* Tři vizuály = první tři obrázky dokumentu kroku 03. Hlavní
                  myš vloží (postaví se jako banner v heru), varianty jsou jeho
                  duplikáty: kopie se dotáhne na místo, myš jí za roh změní
                  rozměr na poměr varianty a kopie se přepíše na variantu. */}
              <div className={styles.makeComposition} {...editableIn(three.id ?? null).set("images")}>
                <div ref={stepRef("s3-main")} className={`${styles.shot} ${styles.shotMain}`}>
                  <div className={styles.revealBody}>
                    <LayeredReveal src={shots[0].src} progress={sp3} at={S3.main} still={still}>
                      <Image src={shots[0].src} alt={shots[0].alt} width={shots[0].width} height={shots[0].height} sizes="18vw" />
                    </LayeredReveal>
                  </div>
                  {/* Proklik do inspektoru: vrstvy, lupa, pixely. */}
                  <InspectHint image={shots[0]} disabled={editing || !shown(3)} delay={HINT_DELAY} />
                </div>
                {(["top", "bottom"] as const).map((where, n) => (
                  <DupImage
                    key={where}
                    ref={stepRef(`s3-${where}`)}
                    progress={sp3}
                    w={S3[where]}
                    from={SHOT_GEO.main}
                    to={SHOT_GEO[where]}
                    still={still}
                    className={`${styles.shot} ${styles.shotDup}`}
                    bodyClassName={styles.shotBody}
                    copy={<Image src={shots[0].src} alt="" width={shots[0].width} height={shots[0].height} sizes="18vw" />}
                    own={
                      <Image
                        src={shots[n + 1].src}
                        alt={shots[n + 1].alt}
                        width={shots[n + 1].width}
                        height={shots[n + 1].height}
                        sizes="12vw"
                      />
                    }
                  />
                ))}
              </div>

              <Annotation
                className={styles.annotationThree}
                lines={three.note}
                editAttrs={editableIn(three.id ?? null)("note")}
                progress={sp3}
                still={still}
              />
            </div>,

            // ---------- Krok 04: doladění ----------
            <div
              key="04"
              className={`${styles.step} ${styles.stepFour}`}
              {...editableDoc(four.id ?? null, "processStep")}
            >
              <StepHead step={four} progress={sp4} still={still} sketch={S4.text} />

              {/* Vizuál se postaví, klient napíše zprávu, myš si ji označí,
                  odpoví v bublině Já, klikne na nadpis ve vizuálu a v panelu
                  Text přepíše velikost písma — nadpis se zvětší. */}
              <div className={styles.tuneComposition}>
                {four.details.slice(0, 2).map((bubble, index) => {
                  const me = index === 1;
                  return (
                    <Block
                      key={index}
                      ref={stepRef(me ? "s4-me" : "s4-client")}
                      progress={sp4}
                      at={me ? S4.me : S4.client}
                      tag={bubble.label}
                      still={still}
                      className={`${styles.bubble} ${me ? styles.bubbleMe : styles.bubbleClient}`}
                      bodyClassName={styles.bubbleBody}
                    >
                      <span
                        className={`${styles.bubbleTag} ${me ? styles.tagMe : styles.tagClient}`}
                        {...editFour(`details.${index}.label`)}
                      >
                        {bubble.label}
                      </span>
                      <p {...editFour(`details.${index}.value`)}>
                        {still ? (
                          bubble.value
                        ) : (
                          <TypeText
                            segments={[{ text: bubble.value }]}
                            placeholder="…"
                            play={me ? designer.typed.me : designer.typed.client}
                            typeSpeed={34}
                            onDone={me ? designer.doneFor("me") : undefined}
                          />
                        )}
                      </p>
                    </Block>
                  );
                })}
                <Block
                  ref={stepRef("s4-shot")}
                  progress={sp4}
                  at={S4.shot}
                  tag="Vizuál"
                  still={still}
                  className={`${styles.shot} ${styles.shotTune}`}
                  bodyClassName={styles.shotBody}
                  {...editFour.set("images")}
                >
                  {split && !still ? (
                    <>
                      {/* Podklad bez nadpisu a nadpis zvlášť — zvětšuje se kolem
                          svého středu; box nadpisu (myš na něj kliká) jede s ním. */}
                      <Image src={split.base} alt={shots[3].alt} width={shots[3].width} height={shots[3].height} sizes="17vw" />
                      <motion.div
                        className={styles.titleLayer}
                        style={{
                          scale: titleScale,
                          transformOrigin: `${(split.box[0] + split.box[2] / 2) * 100}% ${(split.box[1] + split.box[3] / 2) * 100}%`,
                        }}
                      >
                        <Image src={split.title} alt="" width={shots[3].width} height={shots[3].height} sizes="17vw" />
                        <span
                          ref={stepRef("s4-title")}
                          className={styles.titleBox}
                          style={{
                            left: `${split.box[0] * 100}%`,
                            top: `${split.box[1] * 100}%`,
                            width: `${split.box[2] * 100}%`,
                            height: `${split.box[3] * 100}%`,
                          }}
                        />
                      </motion.div>
                    </>
                  ) : (
                    <Image
                      src={shots[3].src}
                      alt={shots[3].alt}
                      width={shots[3].width}
                      height={shots[3].height}
                      sizes="17vw"
                    />
                  )}
                  <InspectHint image={shots[3]} disabled={editing || !shown(4)} delay={HINT_DELAY} />
                </Block>
              </div>

              <Annotation
                className={styles.annotationFour}
                lines={four.note}
                editAttrs={editFour("note")}
                progress={sp4}
                still={still}
                flip
              />
            </div>,

            // ---------- Krok 05: předání ----------
            <div
              key="05"
              className={`${styles.step} ${styles.stepFive}`}
              {...editableDoc(five.id ?? null, "processStep")}
            >
              <StepHead
                step={five}
                progress={sp5}
                still={still}
                typed={designer.typed.s5}
                textRef={stepRef("s5-text")}
                onTyped={designer.doneFor("s5")}
              />

              {/* Tři formáty = první tři obrázky dokumentu kroku 05; popisky
                  jsou jeho `details` ve stejném pořadí. Story se postaví jako
                  banner a myš ji natáhne na 1080 × 1920, formát na výšku myš
                  dotáhne a zduplikuje do čtverce; popisky se napíšou, myš
                  označí formáty (fialový ořez) a přes Exportovat je odešle. */}
              <div className={styles.deliverComposition} {...editFive.set("images")}>
                <ExportMail
                  progress={sp5}
                  still={still}
                  files={["story_1080x1920.png", "na-vysku_1080x1350.png", "ctverec_1080x1080.png"]}
                  buttonRef={stepRef("s5-export")}
                  sendRef={stepRef("s5-send")}
                />
                {[styles.deliverStory, styles.deliverPortrait, styles.deliverSquare].map((variant, index) => {
                  const shot = shots[4 + index];
                  const caption = five.details[index];
                  return (
                    <DeliverFormat
                      key={index}
                      index={index}
                      variant={variant}
                      src={shot.src}
                      progress={sp5}
                      still={still}
                      storyRatio={storyRatio}
                      formatRef={stepRef(["s5-story", "s5-portrait", "s5-square"][index])}
                      hint={
                        <InspectHint
                          image={shot}
                          disabled={editing || !shown(5)}
                          delay={HINT_DELAY + index * HINT_STAGGER}
                        />
                      }
                      image={<Image src={shot.src} alt={shot.alt} width={shot.width} height={shot.height} sizes="15vw" />}
                      copy={
                        index === 2 ? (
                          <Image src={shots[5].src} alt="" width={shots[5].width} height={shots[5].height} sizes="15vw" />
                        ) : undefined
                      }
                      caption={
                        caption ? (
                          <>
                            <span {...editFive(`details.${index}.label`)}>{caption.label}</span>
                            <br />
                            <span {...editFive(`details.${index}.value`)}>{caption.value}</span>
                          </>
                        ) : null
                      }
                    />
                  );
                })}
              </div>

              <Annotation
                className={styles.annotationFive}
                lines={five.note}
                editAttrs={editFive("note")}
                progress={sp5}
                still={still}
                flip
              />
            </div>,

            // ---------- 06: další projekty ----------
            <div key="06" className={`${styles.step} ${styles.stepSix}`}>
              <StepHead
                step={more}
                progress={sp6}
                still={still}
                typed={designer.typed.s6}
                textRef={stepRef("s6-text")}
                onTyped={designer.doneFor("s6")}
              />

              {/* Banner myš vloží (postaví se vrstvami), snímek prezentace
                  nakreslí rámečkem a napíše jeho nadpis, karta identity se
                  postaví sama a myš klikne na logo. Fialové popisky na konec. */}
              <div className={styles.moreComposition}>
                <div ref={stepRef("s6-banner")} className={styles.moreBanner} {...editSix.set("images")}>
                  <div className={styles.revealBody}>
                    <LayeredReveal src={moreBanner.src} progress={sp6} at={S6.banner} still={still}>
                      <Image
                        src={moreBanner.src}
                        alt={moreBanner.alt}
                        width={moreBanner.width}
                        height={moreBanner.height}
                        sizes="12vw"
                      />
                    </LayeredReveal>
                  </div>
                  <InspectHint image={moreBanner} disabled={editing || !shown(6)} delay={HINT_DELAY} />
                </div>

                <Drawn
                  ref={stepRef("s6-slide")}
                  progress={sp6}
                  draw={S6.draw}
                  reveal={S6.slideIn}
                  label="Prezentace"
                  still={still}
                  className={styles.moreSlideSlot}
                  bodyClassName={styles.moreSlide}
                >
                  <span className={styles.slideEyebrow} {...slideEyebrow.edit}>
                    {slideEyebrow.value}
                  </span>
                  <p ref={stepRef("s6-slide-title")} className={styles.slideTitle} {...slideTitle.edit}>
                    {still ? (
                      slideTitle.value
                    ) : (
                      <TypeText
                        segments={[{ text: slideTitle.value }]}
                        placeholder="Nadpis"
                        play={designer.typed.slide}
                        typeSpeed={40}
                        onDone={designer.doneFor("slide")}
                      />
                    )}
                  </p>
                  {/* Fotka kampaně na snímku — postaví se sama (rámeček, mřížka). */}
                  <Block
                    progress={sp6}
                    at={S6.slideImage}
                    tag="Fotka"
                    still={still}
                    className={styles.slideImageSlot}
                    bodyClassName={styles.slideImage}
                    {...editSix.set("images")}
                  >
                    <Image
                      src={slideImage.src}
                      alt={slideImage.alt}
                      width={slideImage.width}
                      height={slideImage.height}
                      sizes="10vw"
                    />
                  </Block>
                  <div className={styles.slideChart}>
                    {FALLBACK.more.slide.bars.map((height, i) => (
                      <SlideBar
                        key={i}
                        height={height}
                        progress={sp6}
                        at={[S6.bars[0] + i * 0.02, S6.bars[0] + i * 0.02 + 0.05]}
                        still={still}
                      />
                    ))}
                  </div>
                </Drawn>

                <Block
                  progress={sp6}
                  at={S6.brand}
                  tag="Identita značky"
                  still={still}
                  className={styles.moreBrandSlot}
                  bodyClassName={styles.moreBrand}
                >
                  <span ref={stepRef("s6-logo")} className={styles.brandMark} {...brandMark.edit}>
                    {brandMark.value}
                  </span>
                  <span className={styles.brandName} {...brandName.edit}>
                    {brandName.value}
                  </span>
                  <span className={styles.brandTagline} {...brandTagline.edit}>
                    {brandTagline.value}
                  </span>
                  {/* Barvy: první postaví myš, další zduplikuje (jako v kroku 02). */}
                  <ul className={styles.brandColors} {...editSix.doc("processStep")}>
                    {brandColors.map((color, index) => (
                      <Swatch
                        key={color}
                        index={index}
                        color={color}
                        prev={brandColors[index - 1]}
                        progress={sp6}
                        still={still}
                        ref={stepRef(`s6-chip-${index}`)}
                        build={S6.chip}
                        dup={chipDup}
                        pitch={2.2}
                        className={styles.brandChip}
                        fillClassName={styles.brandChipFill}
                      />
                    ))}
                  </ul>
                </Block>

                {moreCaptions.map((caption, i) => (
                  <SketchText
                    key={i}
                    as="p"
                    progress={sp6}
                    from={S6.captions[i][0]}
                    to={S6.captions[i][1]}
                    still={still}
                    className={`${styles.moreCaption} ${[styles.moreCaptionBanner, styles.moreCaptionSlide, styles.moreCaptionBrand][i]}`}
                    {...caption.edit}
                  >
                    {caption.value}
                  </SketchText>
                ))}
              </div>
            </div>,

            // ---------- 07: výzva (bez čísla) ----------
            <div key="callout" className={styles.callout}>
              <SketchText
                progress={sp7}
                from={CALLOUT.eyebrow[0]}
                to={CALLOUT.eyebrow[1]}
                still={still}
                className={styles.calloutEyebrow}
                {...editCallout("title")}
              >
                {calloutEyebrow}
              </SketchText>
              <h2 className={styles.calloutHeadline} {...editCallout("note")}>
                {calloutLines.map((row, i) =>
                  still ? (
                    <span key={i} className={styles.headlineRow}>
                      <Lines lines={[row]} markClass={styles.accent} trailClass={styles.dot} />
                    </span>
                  ) : (
                    <RiseLine
                      key={i}
                      progress={sp7}
                      from={CALLOUT.lines[i][0]}
                      to={CALLOUT.lines[i][1]}
                      tag={i === 0 ? "T · Výzva" : undefined}
                      className={styles.headlineRow}
                    >
                      <Lines lines={[row]} markClass={styles.accent} trailClass={styles.dot} />
                    </RiseLine>
                  ),
                )}
              </h2>
              <SketchText
                as="p"
                progress={sp7}
                from={CALLOUT.lead[0]}
                to={CALLOUT.lead[1]}
                still={still}
                className={styles.calloutLead}
                {...editCallout("text", "text", "highlight")}
              >
                <Lines lines={[calloutLead]} markTag="strong" trailClass="" />
              </SketchText>
            </div>,

            // ---------- CTA: portál na konci ----------
            ...(cta ? [<div key="cta">{cta(sp8, still)}</div>] : []),
          ]}
        />

        {popup ? (
          <StepNav
            stops={[
              { tile: 0, number: "0", title: "Úvod" },
              ...steps.map((step, index) => ({ tile: index + 1, number: String(index + 1), title: step.title })),
              { tile: 6, number: "6", title: more.title },
              // 7: CTA na konci (dlaždice 8 — za výzvou), jen když ho okno dostalo.
              ...(cta ? [{ tile: 8, number: "7", title: "Spolupráce" }] : []),
            ]}
            active={stop}
            onSelect={flyTo}
          />
        ) : null}
      </div>

      {/* Umělá myš v krocích (designer.ts): panel Vrstvy se zkratkami,
          výběry a kurzor — ve fixed vrstvě nad stránkou. */}
      <ToolPanels
        rows={designer.ui.rows}
        active={designer.ui.active}
        shortcut={designer.ui.shortcut}
        opacity={designer.panelOpacity}
        scale={designer.panelScale}
        className={styles.toolPanels}
      />
      <TextPanel
        opacity={designer.textPanel.opacity}
        scale={designer.textPanel.scale}
        x={designer.textPanel.x}
        y={designer.textPanel.y}
        font="Agrandir Grand"
        weight="Bold"
        size={FONT_SIZE}
        focused={designer.typed.sizeFocus}
        typed={designer.typed.size}
        sizeRef={stepRef("s4-size")}
        onTyped={designer.doneFor("size")}
      />
      <DesignSelection {...designer.marquee} variant="marquee" />
      <DesignSelection {...designer.hover} variant="hover" />
      <DesignSelection {...designer.selection} />
      <DesignCursor {...designer.cursor} name="Sabina" big text={designer.ui.text} />
    </section>
    </InspectRoot>
  );
}
