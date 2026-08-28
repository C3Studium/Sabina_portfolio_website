import { type CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import styles from "./styles.module.scss";

// Šest projektů = "01 / 06" v pageru. Značky jsou SKUTEČNÉ klientky
// z public/assets/banners — návrh má na kartách Sportisimo, Notino,
// About You, Billu a Samsung, což jsou cizí firmy a na portfoliu by
// tvrdily spolupráci, která neexistuje.
//
// tone řídí, jestli je karta tmavá nebo světlá — návrh je střídá.
const PROJECTS = [
  {
    slug: "gummylife",
    client: "Gummylife",
    category: "Bannerová kampaň",
    tone: "dark",
    src: "/assets/banners/gummylife_banner1.png",
    alt: "Bannerová kampaň pro doplňky stravy Gummylife",
    width: 1440,
    height: 2560,
  },
  {
    slug: "vecicky",
    client: "Věcicky",
    category: "Sezónní kampaň",
    tone: "light",
    src: "/assets/banners/vecicky_banner16.png",
    alt: "Sezónní kampaň pro e-shop s dětskou módou Věcicky",
    width: 1468,
    height: 2587,
  },
  {
    slug: "bruzek",
    client: "Bruzek",
    category: "Digitální kampaň",
    tone: "dark",
    src: "/assets/banners/bruzek_banner1.png",
    alt: "Digitální kampaň pro realitní značku Bruzek",
    width: 973,
    height: 1216,
  },
  {
    slug: "wooline",
    client: "Wooline",
    category: "Obsah pro e-shop",
    tone: "light",
    src: "/assets/banners/vlnenezbozi_banner3.png",
    alt: "Vizuály pro e-shop s vlněnými ponožkami Wooline",
    width: 1483,
    height: 1853,
  },
  {
    slug: "mistr-pet",
    client: "Mistr Pet",
    category: "Promo vizuály",
    tone: "dark",
    src: "/assets/banners/mistrpet_banner1.png",
    alt: "Promo vizuály pro chovatelské potřeby Mistr Pet",
    width: 1118,
    height: 1397,
  },
  {
    slug: "samurai",
    client: "Samurai",
    category: "Uvedení produktu",
    tone: "light",
    src: "/assets/banners/samurai_banner1.png",
    alt: "Kampaň k uvedení nealkoholických nápojů Samurai",
    width: 536,
    height: 954,
  },
];

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path
        d="M5 12h13M12 5.5 18.5 12 12 18.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ArrowDownIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path
        d="M12 5v13M5.5 12 12 18.5 18.5 12"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// 1 -> "01". Stejný formát má návrh u čísla karty i v pageru.
function pad(value: number) {
  return String(value).padStart(2, "0");
}

export default function HeroList() {
  return (
    <section className={styles.heroList}>
      {/* Světelný klín zleva a tmavá pravá půlka s odrazivou podlahou. */}
      <div className={styles.stage} aria-hidden="true" />

      {/* ---------- Levá lišta ---------- */}
      <div className={styles.rail}>
        <span className={styles.railDot} aria-hidden="true" />
        <span className={styles.railLine} aria-hidden="true" />
        <span className={styles.railIndex}>{pad(1)}</span>
        <span className={styles.railLine} aria-hidden="true" />
        <span className={styles.railLabel}>Objevujte posunutím</span>
        <span className={styles.railLine} aria-hidden="true" />
        <button
          type="button"
          className={styles.railButton}
          aria-label="Posunout na další sekci"
        >
          <ArrowDownIcon />
        </button>
      </div>

      {/* ---------- Nadpis ---------- */}
      <div className={styles.intro}>
        <h1 className={styles.headline}>
          <span className={styles.headlineTop}>Práce,</span>
          <span className={styles.headlineBottom}>
            která <span className={styles.accent}>funguje</span>
          </span>
        </h1>

        <p className={styles.lead}>
          <span>Výběr značek, se kterými</span>
          <span>jsem spolupracovala.</span>
          <span>Každý projekt je příběh</span>
          <span>strategie, designu a výsledku.</span>
        </p>
      </div>

      {/* ---------- Řada karet v perspektivě ---------- */}
      <div className={styles.deck}>
        {PROJECTS.map((project, index) => (
          <article
            key={project.slug}
            className={`${styles.card} ${
              project.tone === "dark" ? styles.isDark : styles.isLight
            }`}
            style={{ "--i": index } as CSSProperties}
          >
            <span className={styles.cardIndex}>{pad(index + 1)}</span>
            <h2 className={styles.cardTitle}>{project.client}</h2>
            <p className={styles.cardCategory}>{project.category}</p>

            <div className={styles.cardMedia}>
              <Image
                src={project.src}
                alt={project.alt}
                width={project.width}
                height={project.height}
                sizes="(max-width: 1100px) 60vw, 22vw"
              />
            </div>

            <Link
              className={styles.cardLink}
              href={`/projects/${project.slug}`}
            >
              <span className={styles.cardLinkTop} aria-hidden="true">
                <span className={styles.cardLinkRule} />
                <span className={styles.cardLinkArrow}>
                  <ArrowIcon />
                </span>
              </span>
              <span className={styles.cardLinkLabel}>Zobrazit projekt</span>
            </Link>
          </article>
        ))}
      </div>

      {/* ---------- Pager ---------- */}
      <div className={styles.pager}>
        <span className={styles.pagerCount}>
          {pad(1)} / {pad(PROJECTS.length)}
        </span>
        <button
          type="button"
          className={styles.pagerButton}
          aria-label="Předchozí projekt"
        >
          <span className={styles.isBack}>
            <ArrowIcon />
          </span>
        </button>
        <button
          type="button"
          className={`${styles.pagerButton} ${styles.isNext}`}
          aria-label="Další projekt"
        >
          <ArrowIcon />
        </button>
      </div>
    </section>
  );
}
