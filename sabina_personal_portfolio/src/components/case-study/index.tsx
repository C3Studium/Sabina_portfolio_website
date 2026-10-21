import Image from "next/image";
import Link from "next/link";
import { editableDoc } from "@c3studium/valecms/edit";
import type { Project } from "@/lib/site/projects";
import styles from "./styles.module.scss";

// Rozměry pro obrázek, o kterém CMS nic neví (holá adresa bez šířky a výšky).
const DEFAULT_COVER = { width: 1200, height: 1800 };

type Props = {
  project: Project;
  /** Další projekt v řadě, kam vede odkaz na konci. `null` = jediný projekt. */
  next: Project | null;
};

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

/**
 * Case study jednoho projektu — prototyp.
 *
 * Všechno na stránce je pole jednoho dokumentu `project`, proto je anotace
 * jediná a na obalu: kliknutí kdekoli ve Studiu otevře celý záznam jako
 * formulář (editableDoc), stejně jako karta poradce v ProchazkaGroup. Značit
 * název a podtitul ještě zvlášť by byly dvě cesty k jedné hodnotě.
 *
 * Sekce s prázdným obsahem se nevykreslují: prototyp má dnes jen název, podtitul
 * a obrázek, a prázdný nadpis „Zadání" nad ničím by lhal o tom, co tu je.
 */
export default function CaseStudy({ project, next }: Props) {
  const cover = project.cover;

  return (
    <article
      className={styles.caseStudy}
      {...editableDoc(project.id ?? null, "project")}
    >
      <section id="case-study-hero" className={styles.hero}>
        <div className={styles.heroText}>
          <p className={styles.eyebrow}>Case study</p>
          <h1 className={styles.title}>{project.title}</h1>
          {project.tagline ? (
            <p className={styles.tagline}>{project.tagline}</p>
          ) : null}
        </div>
        {cover ? (
          <div className={styles.heroMedia}>
            <Image
              src={cover.url}
              alt={cover.alt}
              width={cover.width ?? DEFAULT_COVER.width}
              height={cover.height ?? DEFAULT_COVER.height}
              sizes="(max-width: 900px) 90vw, 40vw"
              priority
            />
          </div>
        ) : null}
      </section>

      {project.perex || project.body ? (
        <section id="case-study-overview" className={styles.overview}>
          {project.perex ? <p className={styles.perex}>{project.perex}</p> : null}
          {project.body ? (
            // richText je HTML z editoru Studia — jediné místo, odkud sem může
            // přijít; návštěvník ho nepíše.
            <div
              className={styles.body}
              dangerouslySetInnerHTML={{ __html: project.body }}
            />
          ) : null}
        </section>
      ) : null}

      {project.gallery.length ? (
        <section id="case-study-process" className={styles.gallery}>
          {project.gallery.map((picture, index) => (
            <figure key={`${picture.url}-${index}`} className={styles.galleryItem}>
              <Image
                src={picture.url}
                alt={picture.alt}
                width={picture.width ?? DEFAULT_COVER.width}
                height={picture.height ?? DEFAULT_COVER.height}
                sizes="(max-width: 900px) 90vw, 30vw"
              />
            </figure>
          ))}
        </section>
      ) : null}

      {next ? (
        <section id="case-study-next" className={styles.next}>
          <p className={styles.nextLabel}>Další projekt</p>
          <Link className={styles.nextLink} href={`/projects/${next.slug}`}>
            <span className={styles.nextTitle}>{next.title}</span>
            <span className={styles.nextArrow} aria-hidden="true">
              <ArrowIcon />
            </span>
          </Link>
        </section>
      ) : null}
    </article>
  );
}
