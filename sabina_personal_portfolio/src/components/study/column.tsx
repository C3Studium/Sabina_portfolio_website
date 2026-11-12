// Případová studie na telefonu na výšku: místo plátna s kamerou (scrollem
// řízené artboardy) obyčejná čtivá stránka v jednom sloupci — text napřed,
// díla v pásech, které se táhnou prstem do strany (nativní scroll-snap,
// žádná animace na scrollu). Klepnutí na dílo otevře stejný detail jako
// na plátně (InspectorDock: náhled, vrstvy, pixely).
//
// Server tuhle verzi vykresluje pro všechny (celý text studie je v HTML);
// větší obrazovky ji po hydrataci vymění za plátno (index.tsx).

import Image from "next/image";
import type { CSSProperties } from "react";
import { Parts } from "./boards";
import type { StudyChapter, StudyContent, StudyImage, StudyOutput, StudyWork } from "./content";
import { useInspect } from "./inspector";
import { openContact } from "@/components/layout/contact-modal/open";
import styles from "./column.module.scss";

type ChapterKey = keyof StudyContent["chapters"];
const CHAPTERS: ChapterKey[] = ["play", "campaigns", "trust"];
const pad2 = (n: number) => String(n).padStart(2, "0");

/** Dílo jako tlačítko: obrázek v poměru stran, klepnutí otevře detail. */
function Shot({ image, label, className }: { image: StudyImage; label: string; className?: string }) {
  const inspect = useInspect();
  return (
    <button
      type="button"
      className={className ? `${styles.shot} ${className}` : styles.shot}
      style={{ "--ar": `${image.width} / ${image.height}` } as CSSProperties}
      onClick={(e) => inspect?.(image, e.currentTarget)}
      aria-label={`Detail: ${label}`}
    >
      <Image src={image.src} alt={image.alt} fill sizes="(max-width: 600px) 70vw, 40vw" draggable={false} />
    </button>
  );
}

/** Pás děl do strany (scroll-snap). */
function Strip({ works }: { works: StudyWork[] }) {
  if (!works.length) return null;
  return (
    <div className={styles.strip} role="list">
      {works.map((work, i) => (
        <figure key={work.name + i} className={styles.stripItem} role="listitem">
          <Shot image={work.image} label={work.name} />
          <figcaption>
            <span>{work.tag}</span> {work.name}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

/** Poznámka (postřeh) jako lístek s páskou. */
function Note({ parts, tilt }: { parts: StudyChapter["asides"][number]; tilt: number }) {
  return (
    <p className={styles.note} style={{ "--tilt": `${tilt}deg` } as CSSProperties}>
      <Parts parts={parts} />
    </p>
  );
}

function Heading({ no, label, parts, level = 2 }: { no: string; label: string; parts: StudyChapter["heading"]; level?: 1 | 2 }) {
  const Tag = level === 1 ? "h1" : "h2";
  return (
    <header className={styles.head}>
      <p className={styles.kicker}>
        <span className={styles.bar} aria-hidden="true" />
        {no} <span>{label}</span>
      </p>
      <Tag className={level === 1 ? styles.title : styles.heading}>
        {parts.map(([text, green], i) => (
          <span key={i} className={green === true ? styles.green : undefined}>
            {text}
          </span>
        ))}
      </Tag>
    </header>
  );
}

function Outputs({ outputs, no }: { outputs: StudyOutput[]; no: string }) {
  if (!outputs.length) return null;
  return (
    <section className={styles.section} aria-label="Výstupy" data-scroll-label="Výstupy">
      <Heading
        no={no}
        label="Výstupy"
        parts={[
          ["Všechny", true],
          ["formáty", false],
        ]}
      />
      <p className={styles.text}>
        {outputs.length} vizuálů — klepnutím otevřete detail s vrstvami a rozměry.
      </p>
      <div className={styles.grid}>
        {outputs.map((output, i) => (
          <figure key={output.caption + i} className={styles.gridItem}>
            <Shot image={output.image} label={output.caption} />
            <figcaption>
              <b>{output.caption}</b>
              <span>{output.format}</span>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

export default function StudyColumn({ c }: { c: StudyContent }) {
  const cover = c.chapters.cover;
  return (
    <>
      <section className={styles.section} aria-label="Úvod" data-scroll-label="Úvod">
        <Heading
          no={c.index}
          label="Případová studie"
          level={1}
          parts={[[c.title, true]]}
        />
        <p className={styles.kind}>{c.kind}</p>
        {cover.text.map((paragraph, i) => (
          <p key={i} className={styles.lead}>
            <Parts parts={paragraph} />
          </p>
        ))}
        <dl className={styles.meta}>
          {c.meta.map((item) => (
            <div key={item.label}>
              <dt>{item.label}</dt>
              <dd>{item.value}</dd>
            </div>
          ))}
        </dl>
        <Strip works={cover.works} />
        <p className={styles.hint}>Táhněte do strany · klepnutím otevřete detail</p>
        {cover.asides.map((aside, i) => (
          <Note key={i} parts={aside} tilt={i % 2 ? 1.2 : -1.4} />
        ))}
      </section>

      {CHAPTERS.map((key, k) => {
        const ch = c.chapters[key];
        return (
          <section key={key} className={styles.section} aria-label={ch.label} data-scroll-label={ch.label}>
            <Heading no={pad2(k + 2)} label={ch.label} parts={ch.heading} />
            {ch.text.map((paragraph, i) => (
              <p key={i} className={styles.text}>
                <Parts parts={paragraph} />
              </p>
            ))}
            <Strip works={ch.works} />
            {ch.asides.map((aside, i) => (
              <Note key={i} parts={aside} tilt={(k + i) % 2 ? 1.4 : -1.2} />
            ))}
          </section>
        );
      })}

      <Outputs outputs={c.outputs} no={pad2(CHAPTERS.length + 2)} />

      <section className={`${styles.section} ${styles.cta}`} aria-label="Spolupráce" data-scroll-label="Spolupráce" data-contact-zone="">
        <p className={styles.ctaLead}>
          <Parts parts={c.cta.lead} />
        </p>
        <button type="button" className={styles.ctaButton} onClick={() => openContact()}>
          {c.cta.button}
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 12h13M12 5.5 18.5 12 12 18.5" />
          </svg>
        </button>
        <p className={styles.status}>
          <span className={styles.dot} aria-hidden="true" />
          <Parts parts={c.cta.status} />
        </p>
      </section>
    </>
  );
}
