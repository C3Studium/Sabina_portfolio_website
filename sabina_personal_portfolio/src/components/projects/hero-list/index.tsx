import { type CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { editableDoc, editableIn } from "@c3studium/valecms/edit";
import type { Project } from "@/lib/site/projects";
import { projectsOrFallback } from "../fallback";
import styles from "./styles.module.scss";

// Blok `projects.list`, jak ho tvaruje cms/projects.ts: `headline` jsou řádky
// nadpisu, `accent` zvýrazněný konec, `lead` řádky úvodu. `docId` jen ve Studiu.
export type ListCopy = {
  title?: string;
  headline?: string[];
  accent?: string[];
  lead?: string[];
  docId?: string;
};

// Texty stránky, jak stály v kódu — zůstávají jako záloha: prázdné pole ve
// Studiu nesmí vyrobit prázdný nadpis. Musí být doslova to, co zakládá
// scripts/seed/projects.mjs.
const FALLBACK_COPY = {
  headline: ["Práce,", "která"],
  accent: "funguje",
  lead: [
    "Výběr značek, se kterými",
    "jsem spolupracovala.",
    "Každý projekt je příběh",
    "strategie, designu a výsledku.",
  ],
};

// Rozměry pro obrázek, o kterém CMS nic neví (holá adresa bez šířky a výšky).
// Poměr na výšku jako u bannerů dnes; Next potřebuje čísla, aby rezervoval místo.
const DEFAULT_COVER = { width: 1200, height: 1800 };

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

// Neprázdné řádky z CMS, jinak záloha. Prázdný řetězec je „nic nenapsáno".
const linesOr = (lines: string[] | undefined, fallback: string[]) => {
  const kept = (lines ?? []).filter((line) => line.trim());
  return kept.length ? kept : fallback;
};

type Props = {
  copy?: ListCopy | null;
  projects?: Project[] | null;
};

export default function HeroList({ copy = null, projects = null }: Props) {
  const list = projectsOrFallback(projects);
  // Dokument zadaný jednou, ne u každé anotace zvlášť. Mimo Studio je `docId`
  // undefined a `edit(...)` vrací prázdný objekt, takže na web nejde nic.
  const edit = editableIn(copy?.docId ?? null);

  const headline = linesOr(copy?.headline, FALLBACK_COPY.headline);
  const accent = copy?.accent?.[0]?.trim() || FALLBACK_COPY.accent;
  const lead = linesOr(copy?.lead, FALLBACK_COPY.lead);

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
        {/* Řádky nadpisu jsou jeden text se zalomením; zvýrazněný konec je
            vlastní pole, aby šel přepsat sám. Návrh má právě dva řádky —
            případný třetí a další se přisadí k druhému. */}
        <h1 className={styles.headline} {...edit("headline")}>
          <span className={styles.headlineTop}>{headline[0]}</span>
          <span className={styles.headlineBottom}>
            {headline.slice(1).join(" ")}
            {headline.length > 1 ? " " : ""}
            <span className={styles.accent} {...edit("accent.0")}>
              {accent}
            </span>
          </span>
        </h1>

        {/* Čtyři řádky, kde počet řádků je obsah — proto se upravuje blok
            jako celek, ne řádek po řádku. */}
        <p className={styles.lead} {...edit.lines("items.*.label")}>
          {lead.map((line, index) => (
            <span key={index}>{line}</span>
          ))}
        </p>
      </div>

      {/* ---------- Řada karet v perspektivě ---------- */}
      <div className={styles.deck}>
        {list.map((project, index) => (
          // Karta JE projekt: kliknutí ve Studiu otevře celý záznam. `id` je jen
          // při čtení konceptu; na veřejném webu anotace nevznikne.
          <article
            key={project.slug}
            className={`${styles.card} ${
              project.tone === "dark" ? styles.isDark : styles.isLight
            }`}
            style={{ "--i": index } as CSSProperties}
            {...editableDoc(project.id ?? null, "project")}
          >
            <span className={styles.cardIndex}>{pad(index + 1)}</span>
            <h2 className={styles.cardTitle}>{project.title}</h2>
            <p className={styles.cardCategory}>{project.tagline}</p>

            {project.cover ? (
              <div className={styles.cardMedia}>
                <Image
                  src={project.cover.url}
                  alt={project.cover.alt}
                  width={project.cover.width ?? DEFAULT_COVER.width}
                  height={project.cover.height ?? DEFAULT_COVER.height}
                  sizes="(max-width: 1100px) 60vw, 22vw"
                />
              </div>
            ) : null}

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
          {pad(1)} / {pad(list.length)}
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
