import { Fragment, useEffect, useRef, useState, type CSSProperties } from "react";
import Image from "next/image";
import dynamic from "next/dynamic";
import { motion, useReducedMotion } from "framer-motion";
import { editableIn } from "@c3studium/valecms/edit";
import MeasureText from "@/components/common/measure-text";
import TypeText from "@/components/common/type-text";
import type { TypeSegment } from "@/components/common/type-text/engine";
import { useGate } from "@/motion/LoadProvider";
import IntroBanners from "@/motion/intro/IntroBanners";
import SketchReveal from "@/components/common/sketch-reveal";
import { lerp, PORTRAIT_TABLET, useLandscapeFluid, useMedia } from "@/lib/fluid";
import { BuildCard, CardBadge, CardScramble, CardSketch, CardType, ShuffleTags } from "./cards";
import styles from "./styles.module.scss";

/* ------------------------------------------------------------ tvar obsahu -- */

// Jeden úsek řádku a zda je zvýrazněný — tvar, ve kterém `f.lines` dekóduje
// hvězdičky z pole `headline` (schemas/marks.js).
type Part = [string, boolean];

type Heading = { text?: string; lines?: Part[][]; mark?: string };

type Picture = {
  src: string;
  url: string;
  alt: string;
  width?: number;
  height?: number;
  sizes?: string;
};

type CardRow = { lead: string; label: string; note: string; value: string };

type Block = { docId?: string };

type PanelBlock = Block & {
  label?: string;
  heading?: Heading;
  text?: string;
  tags?: { label: string }[];
};

/** Bloky stránky /about, jak je skládá `getPageContent` podle src/lib/cms/about.ts. */
export type AboutContent = {
  me?: Block & { eyebrow?: string; heading?: Heading; image?: Picture | null; rail?: { label?: string }[] };
  lead?: Block & { heading?: Heading };
  highlights?: Block & { cards?: CardRow[]; titleMark?: string };
  courses?: PanelBlock;
  skills?: PanelBlock;
};

/* ------------------------------------------------------------- záloha ----- */

// Texty, se kterými komponenta přišla. Nejsou to náhražky, je to poslední síť:
// prázdný CMS (nebo vymazané pole ve Studiu) vykreslí stránku beze změny.
//
// POZOR: obsah karet je PŘEVZATÝ Z NÁVRHU a je zástupný — jazyková
// úroveň, certifikát i rozsah zkušeností jsou konkrétní tvrzení o Sabině,
// která nemám jak ověřit. Před spuštěním je nutné je nahradit skutečnými.
const FALLBACK = {
  eyebrow: "Pojďme se poznat",
  heading: [[["Něco", false]], [["o mně", true]]] as Part[][],
  lead: [
    [["Měním nápady ve vizuály,", false]],
    [["které", false], ["spojují, mluví", true]],
    // Tečka jako vlastní úsek, aby zůstala v barvě textu jako dnes. Značka
    // v CMS zvýrazňuje po slovech, takže po seedu bude tečka zelená.
    [["a", false], ["prodávají", true], [".", false]],
  ] as Part[][],
  portrait: { src: "/assets/rest/main_photo.png", alt: "Sabina Hudrmentová", width: 612, height: 1019 },
  portraitSizes: "(max-width: 1100px) 70vw, 56vw",
};

// Ikony zůstávají v kódu a váží se na pozici karty — do CMS jdou jen texty.
// Z toho plyne jediné pravidlo, které se dá porušit: pořadí položek v bloku
// `about.highlights` musí odpovídat pořadí tady.
const HIGHLIGHTS = [
  {
    icon: "bookmark",
    art: "globe",
    label: "Vzdělání",
    title: "C1",
    subtitle: "Angličtina",
    body: "Pokročilá úroveň angličtiny pro profesionální komunikaci a mezinárodní projekty.",
  },
  {
    icon: "briefcase",
    art: "discs",
    label: "Zkušenosti",
    title: "Spolupráce se silnými značkami",
    subtitle: "",
    body: "Kampaně pro e-shopy a značky z oblasti krásy, módy a lifestylu napříč Evropou.",
  },
  {
    icon: "certificate",
    art: "rosette",
    label: "Certifikáty",
    title: "Google Digital Garage",
    subtitle: "",
    body: "Dokončený certifikát digitálního marketingu — strategie, SEO, reklama a analytika.",
  },
];

const PANELS = [
  {
    icon: "cap",
    art: "spiral",
    marker: "dot",
    label: "Kurzy",
    title: [[["Neustálé vzdělávání", false]]] as Part[][],
    body: "Průběžné kurzy motion designu, UI/UX, brandingu a marketingu, abych držela krok s oborem.",
    tags: [
      "Motion design",
      "UI / UX design",
      "Brandová strategie",
      "Webový vývoj",
      "Marketing a reklama",
      "Copywriting",
    ],
  },
  {
    icon: "star",
    art: "target",
    marker: "check",
    label: "Specializace",
    title: [[["Co umím nejlíp", false]]] as Part[][],
    body: "Zaměřuju se na výkonné bannery, media kity a vizuální systémy, které přinášejí výsledky.",
    tags: [
      "Bannery",
      "Media kity",
      "Brandové vizuály",
      "Digitální kampaně",
      "Reklamy na sítě",
      "Tiskoviny",
    ],
  },
];

/* ---------------------------------------------------------- pomocníci ----- */

/**
 * Text z CMS, jinak ten z kódu. Prázdný řetězec se bere jako „nic nenapsáno":
 * vymazané pole ve Studiu nesmí vyrobit kartu s prázdným řádkem.
 */
const pick = (value: unknown, zaloha: string) =>
  (typeof value === "string" && value.trim()) || zaloha;

/** Řádky nadpisu z CMS, jinak z kódu. Prázdné `headline` dává `[[]]`, ne `[]`. */
const linesOf = (heading: Heading | undefined, zaloha: Part[][]) => {
  const lines = heading?.lines;
  return Array.isArray(lines) && lines.some((parts) => parts.length) ? lines : zaloha;
};

/**
 * Ručně zalomený text se zvýrazněnými úseky.
 *
 * Řádky odděluje `<br />`, ne vlastní blok: překryv Studia čte `<br>` jako `\n`
 * uložené hodnoty, zatímco dva bloky by při editaci svařil do jednoho řádku.
 * Mezera jde mezi úseky, ale ne před interpunkci — kvůli záloze „a prodávají.".
 */
function Lines({ lines }: { lines: Part[][] }) {
  return lines.map((parts, line) => (
    <Fragment key={line}>
      {line > 0 ? <br /> : null}
      {parts.map(([piece, marked], run) => {
        const gap = run > 0 && !/^[.,;:!?]/.test(piece) ? " " : "";
        return marked ? (
          <Fragment key={run}>
            {gap}
            <span className={styles.accent}>{piece}</span>
          </Fragment>
        ) : (
          <Fragment key={run}>{gap + piece}</Fragment>
        );
      })}
    </Fragment>
  ));
}

const PortraitParticles = dynamic(() => import("@/components/common/particle-image"), { ssr: false });

/* ------------------------------------------------------------- vstup ------ */

// Vstup úvodu jako na homepage, celý zhruba do 2 s od otevření stránky
// (přechod pustí bránu `go`): nadtitulek se napíše, řádky nadpisu vyjedou
// zdola (slova pak jde „měřit" myší — MeasureText jako v heru), linka se
// natáhne a podtitul se napíše. Portrét se nakreslí (SketchReveal), lišta
// vlevo naskočí, za portrétem se stavějí bannery a na něm běží částice.
// Karty se postaví až nakonec (CARDS_AT).
const ENTRANCE = [0.22, 1, 0.36, 1] as const;
const RISE_TIME = 0.8;
// Kdy začne psaní podtitulu a stavba karet (s po `go`).
const LEAD_AT = 0.45;
const CARDS_AT = 0.9;

// Bannery za portrétem (motion/intro — stavějí se vrstvami), ztlumené
// a pomalejší než v heru; částice na portrétu (hero jich má 300 000).
const BACKGROUND = {
  banners: [
    "/assets/banners/gummylife_banner1.png",
    "/assets/banners/samurai_banner1.png",
    "/assets/banners/bruzek_banner1.png",
    "/assets/banners/mistrpet_banner1.png",
    "/assets/banners/vecicky_banner16.png",
    "/assets/banners/jordan_banner4.png",
  ],
  pace: 1.5,
  particles: 140000,
  fieldLeft: 0.5,
  baseline: 0.86,
};

/** Řádky se zvýrazněním → úseky pro TypeText (řádky "\n", mezery jako Lines). */
const segmentsOf = (lines: Part[][], accent: string): TypeSegment[] =>
  lines.flatMap((parts, line) =>
    parts.map(([piece, marked], run) => {
      const gap = run > 0 && !/^[.,;:!?]/.test(piece) ? " " : "";
      const lead = line > 0 && run === 0 ? "\n" : gap;
      return marked ? { text: lead + piece, className: accent } : { text: lead + piece };
    }),
  );

/** Řádky nadpisu jako bloky — každý vyjede zvlášť, slova jsou měřitelná. */
function RiseLines({ lines, show, enter }: { lines: Part[][]; show: boolean; enter: (delay: number) => object }) {
  return lines.map((parts, line) => (
    <span key={line} className={styles.headlineRow}>
      <motion.span
        className={styles.headlineRise}
        initial={{ y: "0.55em", opacity: 0 }}
        animate={show ? { y: 0, opacity: 1 } : { y: "0.55em", opacity: 0 }}
        transition={enter(0.05 + line * 0.1)}
      >
        {parts.map(([piece, marked], run) => (
          <Fragment key={run}>
            {run > 0 && !/^[.,;:!?]/.test(piece) ? " " : null}
            {piece.split(/(\s+)/).map((word, w) =>
              /^\s+$/.test(word) || !word ? (
                word
              ) : (
                // Barvu písmen bere MeasureText z rodiče slova — zelená je
                // proto na obalu, ne na měřeném slově.
                <span key={w} className={marked ? styles.accent : undefined}>
                  <span data-measure="">{word}</span>
                </span>
              ),
            )}
          </Fragment>
        ))}
      </motion.span>
    </span>
  ));
}

/* --------------------------------------------------------------- ikony ---- */

function BadgeIcon({ name }: { name: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
      {name === "bookmark" && (
        <path pathLength={1} d="M6.5 3.6h11v16.8L12 16.2l-5.5 4.2V3.6Z" strokeLinejoin="round" />
      )}
      {name === "briefcase" && (
        <>
          <rect pathLength={1} x="2.8" y="7.2" width="18.4" height="13" rx="2.2" />
          <path pathLength={1} d="M8.6 7.2V5.4a1.8 1.8 0 0 1 1.8-1.8h3.2a1.8 1.8 0 0 1 1.8 1.8v1.8" />
        </>
      )}
      {name === "certificate" && (
        <>
          <rect pathLength={1} x="3.4" y="3.6" width="17.2" height="12.4" rx="2" />
          <path pathLength={1} d="M7.4 19.6h9.2M12 16v3.6" strokeLinecap="round" />
        </>
      )}
      {name === "cap" && (
        <>
          <path pathLength={1} d="M12 4 22 8.6 12 13.2 2 8.6 12 4Z" strokeLinejoin="round" />
          <path pathLength={1} d="M6 10.6v4.8c0 1.7 2.7 3 6 3s6-1.3 6-3v-4.8" strokeLinecap="round" />
        </>
      )}
      {name === "star" && (
        <path pathLength={1}
          d="m12 3.4 2.7 5.6 6.1.8-4.4 4.3 1 6-5.4-2.8-5.4 2.8 1-6-4.4-4.3 6.1-.8L12 3.4Z"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

function MarkerIcon({ name }: { name: string }) {
  if (name === "check") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="12" r="9.4" strokeWidth="1.2" />
        <path d="m8 12.4 2.8 2.8L16.2 9.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="12" r="4.4" />
    </svg>
  );
}

/* --------------------------------------------------------------- panel ---- */

function Panel({
  copy,
  zaloha,
  still,
  index,
  ready,
}: {
  copy: PanelBlock | undefined;
  zaloha: (typeof PANELS)[number];
  still: boolean;
  index: number;
  ready: boolean;
}) {
  // Vlastní dokument, tedy i vlastní `edit`: prvek musí pojmenovat blok, do
  // kterého zapisuje. Mimo Studio je `docId` undefined a anotace jsou prázdné.
  const edit = editableIn(copy?.docId ?? null);
  const tags = copy?.tags?.length ? copy.tags.map((tag) => tag.label) : zaloha.tags;

  return (
    <BuildCard
      index={index}
      ready={ready}
      tag={pick(copy?.label, zaloha.label)}
      art={zaloha.art}
      still={still}
      contentClassName={styles.panel}
    >
      <div className={styles.panelText}>
        <CardBadge className={styles.cardBadge}>
          <BadgeIcon name={zaloha.icon} />
        </CardBadge>
        <p className={styles.cardLabel} {...edit("title")}>
          <CardScramble text={pick(copy?.label, zaloha.label)} />
        </p>
        <h2 className={styles.cardTitle} {...edit("headline", "text", copy?.heading?.mark)}>
          <CardSketch>
            <Lines lines={linesOf(copy?.heading, zaloha.title)} />
          </CardSketch>
        </h2>
        <p className={styles.cardBody} {...edit("body")}>
          <CardType text={pick(copy?.text, zaloha.body)} />
        </p>
      </div>

      {/* Každý štítek zvlášť, ne `edit.lines` na obal: štítek nese i ikonu a
          překryv by ji při editaci celého seznamu počítal do textu. Přidat
          nebo ubrat štítek jde ve formuláři bloku ve Studiu. */}
      <ShuffleTags
        count={tags.length}
        still={still}
        render={(index) => (
          <>
            <span className={styles.tagMarker} aria-hidden="true">
              <MarkerIcon name={zaloha.marker} />
            </span>
            <span {...edit(`items.${index}.label`)}>{tags[index]}</span>
          </>
        )}
      />
    </BuildCard>
  );
}

/* ----------------------------------------------------------- komponenta --- */

export default function AboutMe({ content = null }: { content?: AboutContent | null }) {
  const me = content?.me;
  const lead = content?.lead;
  const highlights = content?.highlights;

  const editMe = editableIn(me?.docId ?? null);
  const editLead = editableIn(lead?.docId ?? null);
  const editCards = editableIn(highlights?.docId ?? null);

  // Ve Studiu (editační rám) bez animací — překryv čte a přepisuje DOM.
  const editing = Boolean(me?.docId || lead?.docId);
  const { go } = useGate();
  const reduce = useReducedMotion();
  const enter = (delay: number) => (reduce ? { duration: 0 } : { duration: RISE_TIME, ease: ENTRANCE, delay });
  const [leadGo, setLeadGo] = useState(false);
  const [cardsGo, setCardsGo] = useState(editing);
  useEffect(() => {
    if (!go || editing) return;
    const lead = window.setTimeout(() => setLeadGo(true), (reduce ? 0 : LEAD_AT) * 1000);
    const cards = window.setTimeout(() => setCardsGo(true), (reduce ? 0 : CARDS_AT) * 1000);
    return () => {
      window.clearTimeout(lead);
      window.clearTimeout(cards);
    };
  }, [go, editing, reduce]);

  // Bannery a částice jen tam, kde je portrét vidět (na šířku od notebooku).
  const fluid = useLandscapeFluid();
  const portraitRef = useRef<HTMLImageElement>(null);
  const bannerAreaRef = useRef<HTMLDivElement>(null);
  // Na výšku (tablet, telefon) bannery jako pozadí obrazovky — jako hero;
  // částice jen na šířku od notebooku.
  const portraitLayout = useMedia(PORTRAIT_TABLET);
  const scenery = !editing && fluid.on;
  const banners = !editing && (fluid.on || portraitLayout);

  // Karty: rozdání z balíčku (cards.tsx), ve Studiu stojí.

  const headingLines = linesOf(me?.heading, FALLBACK.heading);
  const leadLines = linesOf(lead?.heading, FALLBACK.lead);
  const eyebrow = pick(me?.eyebrow, FALLBACK.eyebrow);

  // Fotka z knihovny médií, jinak ta z /public. Rozměry jen když je asset má —
  // holá adresa je nemá a `object-fit: contain` si s poměrem stran poradí.
  const portrait = me?.image?.url
    ? {
        src: me.image.url,
        alt: pick(me.image.alt, FALLBACK.portrait.alt),
        width: me.image.width ?? FALLBACK.portrait.width,
        height: me.image.height ?? FALLBACK.portrait.height,
      }
    : FALLBACK.portrait;

  return (
    <section className={styles.about}>
      {/* Světlý kruh vpravo a ztmavení k pravému dolnímu rohu. */}
      <div className={styles.stage} aria-hidden="true" />

      {/* ---------- Levá lišta ---------- */}
      {/* Popisky lišty jsou položky bloku about.me. Index „02" je pořadí
          sekce, ne text — zůstává v kódu. */}
      {/* Nástup s otevřením stránky (`data-in`): kroužek naskočí, linky se
          shora natáhnou a popisky vyjedou — postupně shora dolů (--i). */}
      <div className={styles.rail} data-in={editing || go || undefined}>
        <span className={styles.railRing} style={{ "--i": 0 } as CSSProperties} aria-hidden="true" />
        <span className={styles.railLine} style={{ "--i": 1 } as CSSProperties} aria-hidden="true" />
        <span className={styles.railIndex} style={{ "--i": 2 } as CSSProperties}>
          02
        </span>
        <span className={styles.railLine} style={{ "--i": 3 } as CSSProperties} aria-hidden="true" />
        <span className={styles.railLabel} style={{ "--i": 4 } as CSSProperties} {...editMe("items.0.label")}>
          {pick(me?.rail?.[0]?.label, "O mně")}
        </span>
        <span className={styles.railLine} style={{ "--i": 5 } as CSSProperties} aria-hidden="true" />
        <span className={styles.railLabel} style={{ "--i": 6 } as CSSProperties} {...editMe("items.1.label")}>
          {pick(me?.rail?.[1]?.label, "Objevujte posunutím")}
        </span>
        <span className={styles.railLine} style={{ "--i": 7 } as CSSProperties} aria-hidden="true" />
        <span className={styles.railDot} style={{ "--i": 8 } as CSSProperties} aria-hidden="true" />
      </div>

      {/* ---------- Nadpis ---------- */}
      <div className={styles.intro}>
        {editing ? (
          <>
            <p className={styles.eyebrow} {...editMe("title")}>
              {eyebrow}
            </p>

            {/* Anotace na <h1> samotném: zalomení je `\n` v uložené hodnotě
                a zvýraznění je značka pole, takže `mark` cestuje spolu s `docId`. */}
            <h1 className={styles.headline} {...editMe("headline", "text", me?.heading?.mark)}>
              <Lines lines={headingLines} />
            </h1>

            <span className={styles.introRule} aria-hidden="true" />

            <p className={styles.lead} {...editLead("headline", "text", lead?.heading?.mark)}>
              <Lines lines={leadLines} />
            </p>
          </>
        ) : (
          <>
            <p className={styles.eyebrow}>
              <TypeText segments={[{ text: eyebrow }]} play={go} typeSpeed={30} />
            </p>

            <MeasureText enabled sweep={go}>
              <h1 className={styles.headline}>
                <RiseLines lines={headingLines} show={go} enter={enter} />
              </h1>
            </MeasureText>

            <motion.span
              className={styles.introRule}
              aria-hidden="true"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: go ? 1 : 0 }}
              transition={enter(0.3)}
            />

            <p className={styles.lead}>
              <TypeText segments={segmentsOf(leadLines, styles.accent)} play={leadGo} typeSpeed={15} />
            </p>
          </>
        )}
      </div>

      {/* ---------- Portrét ---------- */}
      {/* Rám, ne <Image>: maska i fotka jsou jedna fotografie, takže to, co
          editor myslí „tímhle obrázkem", je box, který ji drží. */}
      {/* Bannery za portrétem: pole, podle kterého se rozmístí, a plátno. */}
      <div ref={bannerAreaRef} className={styles.bannerArea} aria-hidden="true" />
      {banners ? (
        <div className={styles.bannersLayer} aria-hidden="true">
          <IntroBanners
            sources={BACKGROUND.banners}
            area={bannerAreaRef}
            show={go}
            delay={0.25}
            still={Boolean(reduce)}
            pace={BACKGROUND.pace}
            fieldLeft={portraitLayout ? 0.04 : BACKGROUND.fieldLeft}
            baseline={portraitLayout ? 0.66 : BACKGROUND.baseline}
            scale={portraitLayout ? 0.95 : undefined}
            across={portraitLayout ? 0.96 : undefined}
            className={styles.backgroundBanners}
          />
        </div>
      ) : null}

      <div className={styles.portrait} {...editMe.image("image")}>
        {/* Nakreslí se jako portrét v heru a v CTA: linky → klidné prolnutí
            barev, s otevřením stránky. */}
        <SketchReveal show={editing || go} enabled={!editing && !reduce} className={styles.portraitReveal}>
        <Image
          ref={portraitRef}
          src={portrait.src}
          alt={portrait.alt}
          width={portrait.width}
          height={portrait.height}
          className={styles.portraitImage}
          sizes={me?.image?.sizes ?? FALLBACK.portraitSizes}
          // Místo `priority`: portrét je nad ohybem a je to LCP prvek /about.
          loading="eager"
          fetchPriority="high"
        />
        {/* Tytéž částice jako portrét v heru a v CTA, jen jich je méně. */}
        {scenery && go ? (
          <PortraitParticles
            src={portrait.src}
            targetRef={portraitRef}
            className={styles.portraitParticles}
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
            paused={false}
          />
        ) : null}
        </SketchReveal>
      </div>

      {/* ---------- Karty ---------- */}
      {/* Obal s měřením (MeasureText jako logo v hlavičce): najetí na kartu
          nakreslí kolem ní rámeček s rozměrem a drobky a kurzor se rozpadne
          do jejích rohů. Karty jsou `data-measure-frame` bez měřeného textu. */}
      <div className={styles.cards}>
        <MeasureText variant="brand" enabled={!editing} className={styles.cardsMeasure}>
        <div className={styles.rowTop}>
          {HIGHLIGHTS.map((item, index) => {
            // Karta z CMS na téže pozici; chybějící řádek = záloha z kódu.
            const row = highlights?.cards?.[index];
            const subtitle = pick(row?.note, item.subtitle);
            return (
              <BuildCard
                key={item.label}
                ready={cardsGo}
                index={index}
                tag={pick(row?.lead, item.label)}
                art={item.art}
                still={editing}
              >
                <CardBadge className={styles.cardBadge}>
                  <BadgeIcon name={item.icon} />
                </CardBadge>
                <p className={styles.cardLabel} {...editCards(`items.${index}.lead`)}>
                  <CardScramble text={pick(row?.lead, item.label)} />
                </p>
                <h2
                  className={styles.cardTitle}
                  {...editCards(`items.${index}.label`, "text", highlights?.titleMark)}
                >
                  <CardSketch>{pick(row?.label, item.title)}</CardSketch>
                </h2>
                {subtitle && (
                  <p className={styles.cardSubtitle} {...editCards(`items.${index}.note`)}>
                    {subtitle}
                  </p>
                )}
                <p className={styles.cardBody} {...editCards(`items.${index}.value`)}>
                  <CardType text={pick(row?.value, item.body)} />
                </p>
              </BuildCard>
            );
          })}
        </div>

        <div className={styles.rowBottom}>
          <Panel copy={content?.courses} zaloha={PANELS[0]} still={editing} index={0} ready={cardsGo} />
          <Panel copy={content?.skills} zaloha={PANELS[1]} still={editing} index={1} ready={cardsGo} />
        </div>
        </MeasureText>
      </div>
    </section>
  );
}
