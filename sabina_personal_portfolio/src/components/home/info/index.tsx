import { useCallback, useRef, type CSSProperties } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRefRegistry } from "@/providers/RefContext";
import TypeText from "@/components/common/type-text";
import DesignCursor from "@/components/common/design-cursor";
import CardSwap, { Card } from "@/components/3D/CardSwap";
import { BuildGrid, DrawFrame, NavPill, SketchText, span, useRemoved } from "./reveal";
import { DesignSelection, FlightImage, ToolPanels } from "./designer";
import { useDesigner } from "./choreography";
import { markTyped } from "@/components/home/typing";
import Image from "next/image";
import Link from "next/link";
import { editableDoc, editableIn } from "@c3studium/valecms/edit";
import type { Service, StackItem, StatItem } from "@/lib/site/home";
import Lines, {
  hasLines,
  picture,
  text,
  type CmsImage,
  type MarkedLine,
} from "../lines";
import styles from "./styles.module.scss";
import { cvh, cvw, PORTRAIT_TABLET, useMedia } from "@/lib/fluid";

// Co sekce říká, když CMS mlčí — tytéž texty, jaké tu stály natvrdo. Prázdná
// hodnota ze Studia spadne sem, ne na prázdné místo.
const FALLBACK = {
  heading: [
    [["Vizuály, které", false]],
    [
      ["mají", false],
      ["smysl.", true],
    ],
  ] as MarkedLine[],
  lead: "Tvořím reklamní grafiku, která zaujme, komunikuje a přináší výsledky.",
  toolsLabel: "Nástroje, se kterými pracuji",
  cta: "Domluvit spolupráci",
  cardLabel: "Co nabízím",
  cardCta: "Zobrazit příklady",
  portrait: {
    src: "/assets/rest/main_photo.png",
    alt: "",
    width: 612,
    height: 1019,
  },
};

// Dokumenty, když žádné nejsou — tvar shodný s čtečkami v src/lib/site/home.ts.
const FALLBACK_STACK: StackItem[] = ["Figma", "Adobe", "Canva Pro", "AI nástroje"].map((title) => ({
  title,
  icon: null,
}));

const FALLBACK_SERVICES: Service[] = [
  {
    title: "Reklamní grafika",
    icon: null,
    lead: "Tvořím vizuály, které fungují napříč kanály – od bannerů po sociální sítě.",
    points: ["Bannery", "Carousel formáty", "Sociální sítě", "Branding vizuály"],
  },
  { title: "Sociální sítě", icon: null, lead: "", points: [] },
  { title: "Branding", icon: null, lead: "", points: [] },
  { title: "Webové prvky", icon: null, lead: "", points: [] },
];

const FALLBACK_STATS: StatItem[] = [
  { value: "500+", label: "vytvořených bannerů", icon: null },
  { value: "5 let", label: "zkušeností", icon: null },
  { value: "100%", label: "individuální přístup", icon: null },
  { value: "2000+", label: "hodin tvorby", icon: null },
  { value: "∞", label: "nápadů :D", icon: null },
];

// Za první kartou stojí nejvýš tři další — víc rozvržení neunese.
const STACKED_MAX = 3;

// Kde v `items` bloku `index.info` co bydlí — musí sedět na src/lib/cms/home.ts.
const AT = { toolsLabel: 0, cta: 1, cardLabel: 2, cardCta: 3 };

// Blok `index.info`, jak ho tvaruje src/lib/cms/home.ts. `docId` dorazí jen
// v editačním rámu Studia.
export type InfoCopy = {
  docId?: string;
  heading?: { text?: string; lines?: MarkedLine[]; mark?: string };
  lead?: string;
  toolsLabel?: string;
  cta?: string;
  cardLabel?: string;
  cardCta?: string;
  portrait?: CmsImage | null;
};

type InfoProps = {
  copy?: InfoCopy | null;
  stack?: StackItem[] | null;
  stats?: StatItem[] | null;
  services?: Service[] | null;
  /**
   * Okno sekce (layout/section-popup): hotové rozvržení bez přišpendlení
   * a bez umělé myši — sekce jen nastoupí (styles .infoPopup), balíček
   * karet běží hned. Texty a anotace pro Studio stejné jako na stránce.
   */
  popup?: boolean;
};

/** Seznam z CMS, a když je prázdný, ten z kódu. */
const or = <T,>(list: T[] | null | undefined, fallback: T[]) => (list && list.length ? list : fallback);

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path
        d="M5 12h13M12 5.5 18.5 12 12 18.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Malá ikona z knihovny médií. Bez rozměrů čtverec — box ji stejně ořízne. */
function DocIcon({ icon, className }: { icon: CmsImage; className?: string }) {
  return (
    <Image
      src={icon.src}
      alt=""
      width={icon.width ?? 64}
      height={icon.height ?? 64}
      className={className}
      sizes="48px"
    />
  );
}

export default function Info({
  copy = null,
  stack = null,
  stats = null,
  services = null,
  popup = false,
}: InfoProps) {
  const edit = editableIn(copy?.docId ?? null);

  // Zvýraznění a řádky se řeší zvlášť: zvýraznění je deklarace POLE, platí
  // i pro zálohu — a záloha zvýrazněný úsek má. Bez něj by překryv četl
  // „smysl." jako zvýraznění, které nikdo nedeklaroval.
  const heading = {
    mark: copy?.heading?.mark,
    lines: hasLines(copy?.heading?.lines) ? copy.heading!.lines! : FALLBACK.heading,
  };
  const lead = text(copy?.lead, FALLBACK.lead);
  const toolsLabel = text(copy?.toolsLabel, FALLBACK.toolsLabel);
  const cardLabel = text(copy?.cardLabel, FALLBACK.cardLabel);
  const cardCta = text(copy?.cardCta, FALLBACK.cardCta);
  const portrait = picture(copy?.portrait, FALLBACK.portrait);

  const tools = or(stack, FALLBACK_STACK);
  const statList = or(stats, FALLBACK_STATS);
  const [primary, ...rest] = or(services, FALLBACK_SERVICES);
  const stacked = rest.slice(0, STACKED_MAX);
  const editPrimary = editableIn(primary.id ?? null);
  // Zvýrazněné je poslední slovo titulku — návrh, ne obsah, proto se to
  // nerozhoduje v CMS, ale tady.
  const cardTitle = primary.title.trim().split(/\s+/);
  const cardTitleAccent = cardTitle.pop() ?? "";

  // ---------- Příchod z hera ----------
  // Sekce má margin-top -100vh: posledních 100vh přišpendleného hera přes
  // něj vyjíždí zdola. Portrét sem z hera PŘILETÍ — hero si ho najde
  // v registru pod "info-portrait" a v okamžiku, kdy sekce stojí nahoře,
  // se oba portréty vymění. Do té doby je tenhle neviditelný.
  const sectionRef = useRef<HTMLElement>(null);
  const registry = useRefRegistry();
  const portraitRef = useCallback(
    (node: HTMLImageElement | null) => registry.register("info-portrait", node),
    [registry],
  );
  const { scrollYProgress: enter } = useScroll({
    target: sectionRef,
    offset: ["start end", "start start"],
  });
  // Průhlednosti jako funkce, ne rozsahy: rozsah Framer Motion u opacity
  // převede na nativní scroll animaci, a ta v překryvu s přišpendleným
  // herem počítá špatně. Funkce se nezrychluje.
  const portraitOpacity = useTransform(enter, span(0.99, 1));

  // ---------- Nástup sekce: grafik před vámi ----------
  // Během vyjíždění (posledních 100vh hera) je obsah CELÝ průhledný — vidět
  // je jen portrét, který sem umělá myš přetáhne (choreography.ts). Sekce je
  // pak sama přišpendlená (200vh, sticky vnitřek) a obsah se staví během
  // jejích 100vh scrollu — myš staví, texty se staví samy jako vrstvy
  // bannerů:
  //   0.00–0.06  myš pustí portrét
  //   0.09–0.21  první pilulka jako odkaz hlavičky (linka, rámeček, číslo,
  //              kontura, výplň), myš na ni klikne
  //   0.21–0.44  další pilulky jako DUPLIKÁTY (Alt-tah dolů, pak přepis)
  //   0.45–0.50  myš najede na nadpis (rámeček jako pilulky), klikne
  //              a nadpis se NAPÍŠE (TypeText); 0.54–0.60 totéž s textem
  //   0.64–0.76  myš nakreslí rámeček karet, nastoupí balíček (CardSwap)
  //   0.81–0.85  lišta statistik se jen objeví
  //   0.85–0.93  myš odjede, panel vrstev zhasne
  const { scrollYProgress: stage } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });
  const editing = Boolean(copy?.docId);
  // Hotový stav bez stavby a bez myši: Studio a okno sekce. Statické karty
  // (místo balíčku) ale jen ve Studiu — překryv je čte jako dokumenty.
  const still = editing || popup;
  const tablet = useMedia(PORTRAIT_TABLET);
  const labelOpacity = useTransform(stage, span(0.02, 0.08));
  // Levý sloupec během stavby vyjede o 6vh nahoru. Ve Studiu stojí rovnou
  // v konečné poloze — hotový stav ukazuje i lištu statistik a sloupec
  // posunutý podle scrollu by pod ni zajel.
  const introY = useTransform(useTransform(stage, [0, 0.6], [still ? 0 : 6, 0]), cvh);

  // Umělá myš a to, co staví (choreography.ts).
  const toolsRef = useRef<HTMLUListElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const leadRef = useRef<HTMLParagraphElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);
  const introRef = useRef<HTMLDivElement>(null);
  const CARDS_PAD = 10;
  const designer = useDesigner({
    stage,
    names: tools.map((tool) => tool.title),
    refs: { list: toolsRef, heading: headingRef, lead: leadRef, cards: cardsRef, stats: statsRef, intro: introRef },
    cardsPad: CARDS_PAD,
    enabled: !still,
  });
  const { flow, typing } = designer;
  // Karty: rámeček kreslí myš, po nakreslení ořezové značky a mřížka, pak
  // nastoupí balíček (CardSwap) a rámeček zhasne.
  const cardsDraw = useTransform(stage, (p) => {
    const t = span(...flow.draw)(p);
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  });
  const cardsMarks = useTransform(stage, span(flow.draw[1] - 0.01, flow.draw[1] + 0.04));
  const cardsFrameFade = useTransform(stage, (p) => 1 - span(flow.cardsIn + 0.02, flow.cardsIn + 0.07)(p));
  const cardsGrid = useTransform(
    stage,
    (p) => span(flow.draw[1] - 0.02, flow.draw[1] + 0.02)(p) * (1 - span(flow.cardsIn, flow.cardsIn + 0.04)(p)),
  );
  // Lišta statistik: myš ji dotáhne zprava zpoza okraje okna (jede s ní).
  const statsOpacity = useTransform(stage, (p) => (p >= flow.barDrag[0] ? 1 : 0));
  const statsX = useTransform(stage, (p) => {
    const t = span(...flow.barDrag)(p);
    const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    return cvw((1 - e) * 100);
  });
  // Mazání (Delete): lišta, karty, pak výběr celého levého sloupce najednou.
  const exitStats = useRemoved(stage, flow.delBar.remove);
  const exitCards = useRemoved(stage, flow.delCards.remove);
  const exitLeft = useRemoved(stage, flow.marquee.remove);
  // Portrét v Info: vidět po přeletu z hera, schovaný, když ho myš nese
  // dál do Procesu (letící kopie).
  const infoPortraitOpacity = useTransform(
    [portraitOpacity, designer.infoPortrait] as const,
    ([a, b]: number[]) => a * b,
  );

  // Texty, které myš napíše: nadpis (řádky, zvýrazněné slovo v barvě) a text.
  const headingSegments = heading.lines.flatMap((line, row) => [
    ...(row > 0 ? [{ text: "\n" }] : []),
    ...line.map(([run, marked], i) => ({
      text: `${i > 0 ? " " : ""}${run}`,
      className: marked ? styles.accent : undefined,
    })),
  ]);
  const serviceList = [primary, ...rest];


  return (
    <section
      ref={sectionRef}
      className={popup ? `${styles.infoTrack} ${styles.infoPopup}` : styles.infoTrack}
      id={popup ? undefined : "sluzby"}
      data-cursor="user"
      data-scroll-label="Služby"
    >
    <div className={styles.info}>
      {/* Obsah drží 90vw uprostřed */}
      <div className={styles.content}>
        <div className={styles.inner}>
        {/* ---------- Levý sloupec ---------- */}
        <motion.div ref={introRef} className={styles.intro} style={{ y: introY }}>
          {/* Horní blok — drží se u horního okraje. */}
          <div className={styles.toolsBlock}>
            <motion.p className={`${styles.toolsLabel} ${styles.exitHost}`} style={popup ? undefined : { opacity: labelOpacity }}>
              <motion.span
                className={styles.toolsLabelLine}
                style={still ? undefined : { opacity: exitLeft }}
                aria-hidden="true"
              />
              {/* Text ve vlastním spanu: <p> je flex a volný text v něm byl
                  anonymní položka — span je položka stejně, mezery se nemění. */}
              <SketchText
                progress={stage}
                from={0.03}
                to={0.16}
                still={still}
                style={still ? undefined : { opacity: exitLeft }}
                {...edit(`items.${AT.toolsLabel}.label`)}
              >
                {toolsLabel}
              </SketchText>
            </motion.p>

            {/* Nástroje jsou dokumenty modulu Nabídka → Stack: klik na
                položku ve Studiu otevře její dokument (název, ikona). */}
            <ul ref={toolsRef} className={styles.tools}>
              {/* První pilulka se postaví jako odkaz hlavičky v preloaderu
                  (linka, rámeček se rozevře, číslo, kontura, výplň); každou
                  další myš vytvoří jako duplikát předchozí. */}
              {tools.map((tool, index) => {
                const dup = index > 0 ? flow.dup(index) : null;
                const content = (item: typeof tool) => (
                  <>
                    {item.icon ? (
                      <DocIcon icon={item.icon} className={styles.toolIcon} />
                    ) : (
                      <span className={styles.toolDot} aria-hidden="true" />
                    )}
                    <span>{item.title}</span>
                  </>
                );
                return (
                  <NavPill
                    key={tool.id ?? index}
                    progress={stage}
                    index={index}
                    build={dup ? dup.build : flow.pill}
                    dup={dup ? dup.drag : undefined}
                    removeAt={flow.marquee.remove}
                    copy={index > 0 ? content(tools[index - 1]) : undefined}
                    still={still}
                    className={styles.tool}
                    {...editableDoc(tool.id ?? null, "stackItem")}
                  >
                    {tool.icon ? (
                      <DocIcon icon={tool.icon} className={styles.toolIcon} />
                    ) : (
                      <span className={styles.toolDot} aria-hidden="true" />
                    )}
                    <span {...editableIn(tool.id ?? null)("title")}>{tool.title}</span>
                  </NavPill>
                );
              })}
            </ul>
          </div>

          {/* Dolní blok — nadpis, text a CTA u spodního okraje */}
          <div className={styles.headingBlock}>
            <h2
              ref={headingRef}
              className={`${styles.heading} ${styles.exitHost}`}
              {...edit("headline", "text", heading.mark)}
            >
              {/* Ve Studiu obyčejné řádky (překryv je čte a přepisuje). Na
                  webu nadpis napíše umělá myš: zástupný text se označí,
                  smaže a napíše se skutečný (TypeText). */}
              {still ? (
                <Lines lines={heading.lines} markClass={styles.accent} />
              ) : (
                <>
                  <motion.span style={{ display: "block", opacity: exitLeft }}>
                    <TypeText segments={headingSegments} placeholder="Nadpis" play={typing.heading} onDone={markTyped("heading")} />
                  </motion.span>
                </>
              )}
            </h2>

            <p ref={leadRef} className={`${styles.lead} ${styles.exitHost}`} {...edit("body")}>
              {still ? (
                lead
              ) : (
                <>
                  <motion.span style={{ display: "block", opacity: exitLeft }}>
                    <TypeText segments={[{ text: lead }]} placeholder="Text" play={typing.lead} typeSpeed={22} onDone={markTyped("lead")} />
                  </motion.span>
                </>
              )}
            </p>
          </div>
        </motion.div>

        {/* ---------- Portrét ---------- */}
        <motion.div
          className={styles.portrait}
          {...edit.image("image")}
          // Bez natáčení — portrét sem myš jen přetáhne a stojí.
          style={popup ? undefined : { opacity: editing ? portraitOpacity : infoPortraitOpacity }}
        >
          <Image
            ref={portraitRef}
            src={portrait.src}
            alt={portrait.alt}
            width={portrait.width}
            height={portrait.height}
            className={styles.portraitImage}
            sizes="(max-width: 1100px) 0px, 30vw"
          />
        </motion.div>

        {/* ---------- Karty služeb ----------
            Služby jsou dokumenty (Služby ve Studiu). První podle pořadí je
            rozložená, další stojí za ní s číslem a názvem. */}
        <div ref={cardsRef} className={styles.cardsBuild}>
        {still ? null : (
          <>
            <DrawFrame draw={cardsDraw} marks={cardsMarks} fade={cardsFrameFade} label={cardLabel} pad={CARDS_PAD} />
            <BuildGrid opacity={cardsGrid} />
          </>
        )}
        {editing ? (
        <div className={styles.cards}>
          <article
            className={`${styles.card} ${styles.cardPrimary}`}
            {...editableDoc(primary.id ?? null, "service")}
          >
            <div className={styles.cardNav}>
              <button
                type="button"
                className={`${styles.cardNavButton} ${styles.isBack}`}
                aria-label="Předchozí služba"
              >
                <ArrowIcon />
              </button>
              <button
                type="button"
                className={styles.cardNavButton}
                aria-label="Další služba"
              >
                <ArrowIcon />
              </button>
            </div>

            <p className={styles.cardLabel} {...edit(`items.${AT.cardLabel}.label`)}>
              {cardLabel}
            </p>
            <h3 className={styles.cardTitle} {...editPrimary("title")}>
              {cardTitle.length ? `${cardTitle.join(" ")} ` : null}
              <span className={styles.accent}>{cardTitleAccent}</span>
            </h3>

            <div className={styles.cardBody}>
              {primary.icon ? (
                <div className={styles.cardMedia} {...editPrimary.image("icon")}>
                  <Image
                    src={primary.icon.src}
                    alt=""
                    width={primary.icon.width ?? 320}
                    height={primary.icon.height ?? 320}
                    className={styles.cardMediaImage}
                    sizes="(max-width: 1100px) 30vw, 12vw"
                  />
                </div>
              ) : (
                <div className={styles.cardMediaSlot} aria-hidden="true" />
              )}

              <div className={styles.cardDetail}>
                {primary.lead ? (
                  <p className={styles.cardLead} {...editPrimary("lead")}>
                    {primary.lead}
                  </p>
                ) : null}
                <ul className={styles.cardTags}>
                  {primary.points.map((point, index) => (
                    <li key={index} className={styles.cardTag}>
                      <span className={styles.cardTagDot} aria-hidden="true" />
                      <span {...editPrimary(`points.${index}`)}>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* „Zobrazit příklady" vede vždy na portfolio — cíl není obsah. */}
            <Link className={styles.cardCta} href="/projects">
              <span {...edit(`items.${AT.cardCta}.label`)}>{cardCta}</span>
              <span className={styles.cardCtaArrow} aria-hidden="true">
                <ArrowIcon />
              </span>
            </Link>
          </article>

          {/* Karty stojící za tou první */}
          {stacked.map((service, index) => (
            <article
              key={service.id ?? index}
              className={styles.cardStacked}
              style={{ "--stack-index": index } as CSSProperties}
              {...editableDoc(service.id ?? null, "service")}
            >
              {/* Číslo je pořadí karty, ne pole: „02" je druhá služba. */}
              <span className={styles.cardNumber}>
                {String(index + 2).padStart(2, "0")}
              </span>
              <span
                className={styles.cardStackedTitle}
                {...editableIn(service.id ?? null)("title")}
              >
                {service.title}
              </span>
            </article>
            ))}
        </div>
        ) : (
          // Balíček karet ve 3D (CardSwap) — natočení jako původní karty
          // (rotateY −13°), další služby stojí za první vpravo. Nastoupí,
          // až myš dokreslí rámeček; pak se samy střídají, dají se táhnout.
          // Karty 2× větší, mezery 3× větší; balíček se vejde na výšku
          // a do strany smí přesáhnout (ukotvený vlevo, za ním okraj okna).
          <motion.div className={styles.cards} style={still ? undefined : { opacity: exitCards }}>
            {popup || typing.cards ? (
              <CardSwap
                theme="light"
                width={880}
                height={1120}
                tilt={-13}
                // Tablet na výšku: balíček sevřenější a celý v boxu (.cards
                // má šířku) — přes portrét vpravo nesmí přetéct.
                cardDistance={tablet ? 230 : 444}
                verticalDistance={16}
                depth={220}
                skewAmount={0}
                visibleCards={4}
                cardRadius={52}
                fitBy={tablet ? "both" : "height"}
                align="start"
                delay={4800}
                bounce={0.3}
                // Bez naklánění za kurzorem — balíček stojí, jen se dá táhnout.
                parallax={0}
                hoverSpread={0.1}
                dim={0.35}
              >
                {serviceList.map((service, index) => {
                  const words = service.title.trim().split(/\s+/);
                  const accent = words.pop() ?? "";
                  return (
                    // Nad kartou kurzor „Táhnout" jako nad 3D scénou v heru — karty se dají táhnout.
                    <Card key={service.id ?? index} className={styles.swapCard} data-cursor="drag">
                      <span className={styles.swapNumber}>{String(index + 1).padStart(2, "0")}</span>
                      <p className={styles.cardLabel}>{cardLabel}</p>
                      <h3 className={styles.cardTitle}>
                        {words.length ? `${words.join(" ")} ` : null}
                        <span className={styles.accent}>{accent}</span>
                      </h3>
                      {service.lead ? <p className={styles.cardLead}>{service.lead}</p> : null}
                      {service.points.length ? (
                        <ul className={styles.cardTags}>
                          {service.points.map((point, i) => (
                            <li key={i} className={styles.cardTag}>
                              <span className={styles.cardTagDot} aria-hidden="true" />
                              <span>{point}</span>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      <Link className={styles.cardCta} href="/projects">
                        <span>{cardCta}</span>
                        <span className={styles.cardCtaArrow} aria-hidden="true">
                          <ArrowIcon />
                        </span>
                      </Link>
                    </Card>
                  );
                })}
              </CardSwap>
            ) : null}
          </motion.div>
        )}
        </div>
        </div>

        {/* ---------- Statistiky ----------
            Dokumenty modulu Nabídka → Stats. Zjednodušená lišta 5vh přes
            celou šířku u spodku — přes spodek portrétu i karet. Na konci
            stavby se jen objeví. */}
        <motion.div
          ref={statsRef}
          className={styles.statsBar}
          style={still ? undefined : { opacity: statsOpacity, x: statsX }}
        >
        <motion.span
          className={styles.statsBarFill}
          style={still ? undefined : { opacity: exitStats }}
          aria-hidden="true"
        />
        <motion.ul className={styles.stats} style={still ? undefined : { opacity: exitStats }}>
          {statList.map((stat, index) => {
            const editStat = editableIn(stat.id ?? null);
            return (
              <SketchText
                as="li"
                key={stat.id ?? index}
                progress={stage}
                from={0.6 + index * 0.045}
                to={0.74 + index * 0.045}
                still
                className={styles.stat}
                {...editableDoc(stat.id ?? null, "statItem")}
              >
                <span className={styles.statBadge} aria-hidden="true">
                  {stat.icon ? <DocIcon icon={stat.icon} className={styles.statIcon} /> : null}
                </span>
                <span className={styles.statText}>
                  <span className={styles.statValue} {...editStat("value")}>
                    {stat.value}
                  </span>
                  <span className={styles.statLabel} {...editStat("label")}>
                    {stat.label}
                  </span>
                </span>
              </SketchText>
            );
          })}
        </motion.ul>
        </motion.div>
      </div>
    </div>

    {/* Umělá myš, výběr a panel vrstev — ve fixed portálu nad stránkou. */}
    {still ? null : (
      <>
        <FlightImage src={portrait.src} {...designer.flight} />
        <ToolPanels
          rows={designer.layers.rows}
          active={designer.layers.active}
          shortcut={designer.shortcut}
          opacity={designer.panelOpacity}
          scale={designer.panelScale}
          x={designer.panelX}
          y={designer.panelY}
        />
        <DesignSelection {...designer.marquee} variant="marquee" />
        <DesignSelection {...designer.hover} variant="hover" />
        <DesignSelection {...designer.selection} />
        <DesignCursor {...designer.cursor} name="Sabina" big text={designer.textCursor} />
      </>
    )}
    </section>
  );
}
