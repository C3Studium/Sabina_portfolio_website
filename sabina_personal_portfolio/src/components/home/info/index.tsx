import { type CSSProperties } from "react";
import Image from "next/image";
import { editableIn } from "@c3studium/valecms/edit";
import Lines, {
  hasLines,
  picture,
  text,
  type CmsImage,
  type MarkedLine,
} from "../lines";
import styles from "./styles.module.scss";

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
  tools: ["Figma", "Adobe", "Canva Pro", "AI nástroje"],
  cta: "Domluvit spolupráci",
  cardLabel: "Co nabízím",
  cardTitle: "Reklamní grafika",
  cardLead:
    "Tvořím vizuály, které fungují napříč kanály – od bannerů po sociální sítě.",
  tags: ["Bannery", "Carousel formáty", "Sociální sítě", "Branding vizuály"],
  cardCta: "Zobrazit příklady",
  // Karty stojící za tou první — jen číslo a název.
  stacked: [
    { lead: "02", label: "Sociální sítě" },
    { lead: "03", label: "Branding" },
    { lead: "04", label: "Webové prvky" },
  ],
  stats: [
    { value: "500+", label: "vytvořených bannerů" },
    { value: "5 let", label: "zkušeností" },
    { value: "100%", label: "individuální přístup" },
    { value: "2000+", label: "hodin tvorby" },
    { value: "∞", label: "nápadů :D" },
  ],
  portrait: {
    src: "/assets/rest/main_photo.png",
    alt: "",
    width: 612,
    height: 1019,
  },
};

// Kde v `items` bloku `index.info` co bydlí — musí sedět na src/lib/cms/home.ts.
const AT = { toolsLabel: 0, tools: 1, cta: 5, cardLabel: 6, cardTitle: 7, cardLead: 8, tags: 9, cardCta: 13, stacked: 14, stats: 17 };

// Blok `index.info`, jak ho tvaruje src/lib/cms/home.ts. `docId` dorazí jen
// v editačním rámu Studia.
export type InfoCopy = {
  docId?: string;
  heading?: { text?: string; lines?: MarkedLine[]; mark?: string };
  lead?: string;
  toolsLabel?: string;
  tools?: string[];
  cta?: string;
  cardLabel?: string;
  cardTitle?: string;
  cardLead?: string;
  tags?: string[];
  cardCta?: string;
  stacked?: { lead?: string; label?: string }[];
  stats?: { value?: string; label?: string }[];
  portrait?: CmsImage | null;
};

// Seznam z CMS napasovaný na pevný seznam z kódu POŘADÍM: počet položek dává
// rozvržení, CMS dodává slova. Prázdné slovo padá na to z kódu.
const each = (from: unknown[] | undefined, fallback: string[]) =>
  fallback.map((value, index) => text(from?.[index], value));

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

export default function Info({ copy = null }: { copy?: InfoCopy | null }) {
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
  const tools = each(copy?.tools, FALLBACK.tools);
  const cta = text(copy?.cta, FALLBACK.cta);
  const cardLabel = text(copy?.cardLabel, FALLBACK.cardLabel);
  // Zvýrazněné je poslední slovo titulku — návrh, ne obsah, proto se to
  // nerozhoduje v CMS, ale tady.
  const cardTitle = text(copy?.cardTitle, FALLBACK.cardTitle).trim().split(/\s+/);
  const cardTitleAccent = cardTitle.pop() ?? "";
  const cardLead = text(copy?.cardLead, FALLBACK.cardLead);
  const tags = each(copy?.tags, FALLBACK.tags);
  const cardCta = text(copy?.cardCta, FALLBACK.cardCta);
  const stacked = FALLBACK.stacked.map((card, index) => ({
    lead: text(copy?.stacked?.[index]?.lead, card.lead),
    label: text(copy?.stacked?.[index]?.label, card.label),
  }));
  const stats = FALLBACK.stats.map((stat, index) => ({
    value: text(copy?.stats?.[index]?.value, stat.value),
    label: text(copy?.stats?.[index]?.label, stat.label),
  }));
  const portrait = picture(copy?.portrait, FALLBACK.portrait);

  return (
    <section className={styles.info} id="sluzby">
      {/* Obsah drží 90vw uprostřed */}
      <div className={styles.content}>
        <div className={styles.inner}>
        {/* ---------- Levý sloupec ---------- */}
        <div className={styles.intro}>
          {/* Horní blok — drží se u horního okraje */}
          <div>
            <p className={styles.toolsLabel}>
              <span className={styles.toolsLabelLine} aria-hidden="true" />
              {/* Text ve vlastním spanu: <p> je flex a volný text v něm byl
                  anonymní položka — span je položka stejně, mezery se nemění. */}
              <span {...edit(`items.${AT.toolsLabel}.label`)}>{toolsLabel}</span>
            </p>

            <ul className={styles.tools}>
              {tools.map((tool, index) => (
                <li key={index} className={styles.tool}>
                  {/* Místo pro ikonu — v public zatím žádná není. */}
                  <span className={styles.toolDot} aria-hidden="true" />
                  <span {...edit(`items.${AT.tools + index}.label`)}>{tool}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Dolní blok — nadpis, text a CTA u spodního okraje */}
          <div className={styles.headingBlock}>
            <h2
              className={styles.heading}
              {...edit("headline", "text", heading.mark)}
            >
              <Lines lines={heading.lines} markClass={styles.accent} />
            </h2>

            <p className={styles.lead} {...edit("body")}>
              {lead}
            </p>

            <a className={styles.cta} href="#spoluprace">
              <span {...edit(`items.${AT.cta}.label`)}>{cta}</span>
              <span className={styles.ctaArrow} aria-hidden="true">
                <ArrowIcon />
              </span>
            </a>
          </div>
        </div>

        {/* ---------- Portrét ---------- */}
        <div className={styles.portrait} {...edit.image("image")}>
          <Image
            src={portrait.src}
            alt={portrait.alt}
            width={portrait.width}
            height={portrait.height}
            className={styles.portraitImage}
            sizes="(max-width: 1100px) 0px, 30vw"
          />
        </div>

        {/* ---------- Karty služeb ---------- */}
        <div className={styles.cards}>
          <article className={`${styles.card} ${styles.cardPrimary}`}>
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
            <h3 className={styles.cardTitle} {...edit(`items.${AT.cardTitle}.label`)}>
              {cardTitle.length ? `${cardTitle.join(" ")} ` : null}
              <span className={styles.accent}>{cardTitleAccent}</span>
            </h3>

            <div className={styles.cardBody}>
              {/* Sem přijde obrázek služby, až bude v public. */}
              <div className={styles.cardMediaSlot} aria-hidden="true" />

              <div className={styles.cardDetail}>
                <p className={styles.cardLead} {...edit(`items.${AT.cardLead}.label`)}>
                  {cardLead}
                </p>
                <ul className={styles.cardTags}>
                  {tags.map((tag, index) => (
                    <li key={index} className={styles.cardTag}>
                      <span className={styles.cardTagDot} aria-hidden="true" />
                      <span {...edit(`items.${AT.tags + index}.label`)}>{tag}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <a className={styles.cardCta} href="#portfolio">
              <span {...edit(`items.${AT.cardCta}.label`)}>{cardCta}</span>
              <span className={styles.cardCtaArrow} aria-hidden="true">
                <ArrowIcon />
              </span>
            </a>
          </article>

          {/* Karty stojící za tou první */}
          {stacked.map((service, index) => (
            <article
              key={index}
              className={styles.cardStacked}
              style={{ "--stack-index": index } as CSSProperties}
            >
              <span
                className={styles.cardNumber}
                {...edit(`items.${AT.stacked + index}.lead`)}
              >
                {service.lead}
              </span>
              <span
                className={styles.cardStackedTitle}
                {...edit(`items.${AT.stacked + index}.label`)}
              >
                {service.label}
              </span>
            </article>
            ))}
          </div>
        </div>

        {/* ---------- Statistiky ---------- */}
        <ul className={styles.stats}>
          {stats.map((stat, index) => (
            <li key={index} className={styles.stat}>
              <span className={styles.statBadge} aria-hidden="true" />
              <span className={styles.statText}>
                <span
                  className={styles.statValue}
                  {...edit(`items.${AT.stats + index}.value`)}
                >
                  {stat.value}
                </span>
                <span
                  className={styles.statLabel}
                  {...edit(`items.${AT.stats + index}.label`)}
                >
                  {stat.label}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
