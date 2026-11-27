// Případová studie na telefonu na výšku: místo plátna s kamerou (scrollem
// řízené artboardy) obyčejná čtivá stránka v jednom sloupci — text napřed,
// díla v pásech, které se táhnou prstem do strany (nativní scroll-snap,
// žádná animace na scrollu). Klepnutí na dílo otevře stejný detail jako
// na plátně (InspectorDock: vrstvy, pixely).
//
// Server tuhle verzi vykresluje pro všechny (celý text studie je v HTML);
// větší obrazovky ji po hydrataci vymění za plátno (index.tsx).

import Image from "next/image";
import { useRef, type CSSProperties } from "react";
import { caseEditable, useFitText } from "@c3studium/valecms/edit";
import { Parts } from "./boards";
import type { StudyChapter, StudyContent, StudyImage, StudyOutput, StudyWork } from "./content";
import { useInspect } from "./inspector";
import { openContact } from "@/components/layout/contact-modal/open";
import SwipeHint from "@/components/common/swipe-hint";
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

/**
 * Pás děl do strany (scroll-snap). `field` = cesta kapitoly pro Study Cases
 * (`studyCover` …). Pod ním SwipeHint (víc než jedno dílo): počítadlo, linka
 * a „táhněte" — dílo je skoro na šířku telefonu a další nevykukuje.
 */
function Strip({ works, docId = null, field, hint }: { works: StudyWork[]; docId?: string | null; field?: string; hint?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  if (!works.length) return null;
  return (
    <>
      <div ref={ref} className={styles.strip} role="list">
        {works.map((work, i) => (
          <figure key={work.name + i} className={styles.stripItem} role="listitem" {...(field ? caseEditable(docId, `${field}.works.${i}.image`, "image") : {})}>
            <Shot image={work.image} label={work.name} />
            <figcaption>
              <span>{work.tag}</span> {work.name}
            </figcaption>
          </figure>
        ))}
      </div>
      <SwipeHint scroller={ref} count={works.length} label={hint} />
    </>
  );
}

/** Poznámka (postřeh) jako lístek s páskou; prázdná se nevykreslí. `edit` = anotace pro Study Cases. */
function Note({ parts, tilt, edit }: { parts: StudyChapter["asides"][number]; tilt: number; edit?: object }) {
  if (!parts?.length) return null;
  return (
    <p {...edit} className={styles.note} style={{ "--tilt": `${tilt}deg` } as CSSProperties}>
      <Parts parts={parts} />
    </p>
  );
}

/**
 * Nadpis kapitoly. Study Cases: `labelEdit` / `titleEdit` = anotace štítku
 * a nadpisu (caseEditable); mimo Studio prázdné objekty.
 */
function Heading({
  no,
  label,
  parts,
  level = 2,
  labelEdit,
  titleEdit,
}: {
  no: string;
  label: string;
  parts: StudyChapter["heading"];
  level?: 1 | 2;
  labelEdit?: Record<string, string>;
  titleEdit?: Record<string, string>;
}) {
  const Tag = level === 1 ? "h1" : "h2";
  // Název studie (level 1) se na úzkém telefonu zmenší, když se nejdelší slovo nevejde.
  const ref = useRef<HTMLHeadingElement>(null);
  useFitText(ref, { enabled: level === 1 });
  return (
    <header className={styles.head}>
      <p className={styles.kicker}>
        <span className={styles.bar} aria-hidden="true" />
        {no} <span {...labelEdit}>{label}</span>
      </p>
      <Tag ref={ref} className={level === 1 ? styles.title : styles.heading} {...titleEdit}>
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

// Study Cases (Studio): kapitoly → pole projektu (src/lib/site/study.ts).
const FIELD: Record<ChapterKey, string> = { cover: "studyCover", play: "studyStack", campaigns: "studyStrip", trust: "studyRing" };

export default function StudyColumn({ c, docId = null }: { c: StudyContent; docId?: string | null }) {
  const cover = c.chapters.cover;
  const edit = (field: string) => caseEditable(docId, field);
  return (
    <>
      <section className={styles.section} aria-label="Úvod" data-scroll-label="Úvod">
        <Heading
          no={c.index}
          label="Případová studie"
          level={1}
          parts={[[c.title, true]]}
          titleEdit={edit("title")}
        />
        <p className={styles.kind} {...edit("studyKind")}>{c.kind}</p>
        {/* Odstavce jsou jedno pole — anotace na obalu, ne na odstavci. */}
        <div {...edit("studyCover.text")}>
          {cover.text.map((paragraph, i) => (
            <p key={i} className={styles.lead}>
              <Parts parts={paragraph} />
            </p>
          ))}
        </div>
        <dl className={styles.meta}>
          {c.meta.map((item) => (
            <div key={item.label}>
              <dt>{item.label}</dt>
              <dd>{item.value}</dd>
            </div>
          ))}
        </dl>
        <Strip works={cover.works} docId={docId} field={FIELD.cover} hint="Táhněte · klepnutím detail" />
        {cover.asides.map((aside, i) => (
          <Note key={i} parts={aside} tilt={i % 2 ? 1.2 : -1.4} edit={edit(`studyCover.asides.${i}`)} />
        ))}
      </section>

      {/* Kapitoly skryté ve Studiu (hidden) se vynechají a čísla jdou bez děr. */}
      {CHAPTERS.filter((key) => !c.hidden?.includes(key)).map((key, k) => {
        const ch = c.chapters[key];
        return (
          <section key={key} className={styles.section} aria-label={ch.label} data-scroll-label={ch.label}>
            <Heading
              no={pad2(k + 2)}
              label={ch.label}
              parts={ch.heading}
              labelEdit={edit(`${FIELD[key]}.label`)}
              titleEdit={edit(`${FIELD[key]}.heading`)}
            />
            <div {...edit(`${FIELD[key]}.text`)}>
              {ch.text.map((paragraph, i) => (
                <p key={i} className={styles.text}>
                  <Parts parts={paragraph} />
                </p>
              ))}
            </div>
            <Strip works={ch.works} docId={docId} field={FIELD[key]} />
            {ch.asides.map((aside, i) => (
              <Note key={i} parts={aside} tilt={(k + i) % 2 ? 1.4 : -1.2} edit={edit(`${FIELD[key]}.asides.${i}`)} />
            ))}
          </section>
        );
      })}

      {c.hidden?.includes("outputs") ? null : (
        <Outputs outputs={c.outputs} no={pad2(CHAPTERS.filter((key) => !c.hidden?.includes(key)).length + 2)} />
      )}

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
