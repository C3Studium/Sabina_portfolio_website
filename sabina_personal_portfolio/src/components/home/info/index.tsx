import { type CSSProperties } from "react";
import Image from "next/image";
import styles from "./styles.module.scss";

const TOOLS = ["Figma", "Adobe", "Canva Pro", "AI nástroje"];

// První karta je rozbalená, zbytek stojí za ní jen s číslem a názvem.
const SERVICES = [
  {
    label: "Co nabízím",
    title: "Reklamní",
    titleAccent: "grafika",
    lead: "Tvořím vizuály, které fungují napříč kanály – od bannerů po sociální sítě.",
    tags: ["Bannery", "Carousel formáty", "Sociální sítě", "Branding vizuály"],
    cta: "Zobrazit příklady",
  },
  { number: "02", title: "Sociální sítě" },
  { number: "03", title: "Branding" },
  { number: "04", title: "Webové prvky" },
];

const STATS = [
  { value: "500+", label: "vytvořených bannerů" },
  { value: "5 let", label: "zkušeností" },
  { value: "100%", label: "individuální přístup" },
  { value: "2000+", label: "hodin tvorby" },
  { value: "∞", label: "nápadů :D" },
];

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

export default function Info() {
  const [primary, ...rest] = SERVICES;

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
              Nástroje, se kterými pracuji
            </p>

            <ul className={styles.tools}>
              {TOOLS.map((tool) => (
                <li key={tool} className={styles.tool}>
                  {/* Místo pro ikonu — v public zatím žádná není. */}
                  <span className={styles.toolDot} aria-hidden="true" />
                  {tool}
                </li>
              ))}
            </ul>
          </div>

          {/* Dolní blok — nadpis, text a CTA u spodního okraje */}
          <div className={styles.headingBlock}>
            <h2 className={styles.heading}>
              Vizuály, které
              <br />
              mají <span className={styles.accent}>smysl.</span>
            </h2>

            <p className={styles.lead}>
              Tvořím reklamní grafiku, která zaujme, komunikuje a přináší
              výsledky.
            </p>

            <a className={styles.cta} href="#spoluprace">
              Domluvit spolupráci
              <span className={styles.ctaArrow} aria-hidden="true">
                <ArrowIcon />
              </span>
            </a>
          </div>
        </div>

        {/* ---------- Portrét ---------- */}
        <div className={styles.portrait}>
          <Image
            src="/assets/rest/main_photo.png"
            alt=""
            width={612}
            height={1019}
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

            <p className={styles.cardLabel}>{primary.label}</p>
            <h3 className={styles.cardTitle}>
              {primary.title}{" "}
              <span className={styles.accent}>{primary.titleAccent}</span>
            </h3>

            <div className={styles.cardBody}>
              {/* Sem přijde obrázek služby, až bude v public. */}
              <div className={styles.cardMediaSlot} aria-hidden="true" />

              <div className={styles.cardDetail}>
                <p className={styles.cardLead}>{primary.lead}</p>
                <ul className={styles.cardTags}>
                  {primary.tags?.map((tag) => (
                    <li key={tag} className={styles.cardTag}>
                      <span className={styles.cardTagDot} aria-hidden="true" />
                      {tag}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <a className={styles.cardCta} href="#portfolio">
              {primary.cta}
              <span className={styles.cardCtaArrow} aria-hidden="true">
                <ArrowIcon />
              </span>
            </a>
          </article>

          {/* Karty stojící za tou první */}
          {rest.map((service, index) => (
            <article
              key={service.number}
              className={styles.cardStacked}
              style={{ "--stack-index": index } as CSSProperties}
            >
              <span className={styles.cardNumber}>{service.number}</span>
              <span className={styles.cardStackedTitle}>{service.title}</span>
            </article>
            ))}
          </div>
        </div>

        {/* ---------- Statistiky ---------- */}
        <ul className={styles.stats}>
          {STATS.map((stat) => (
            <li key={stat.label} className={styles.stat}>
              <span className={styles.statBadge} aria-hidden="true" />
              <span className={styles.statText}>
                <span className={styles.statValue}>{stat.value}</span>
                <span className={styles.statLabel}>{stat.label}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
