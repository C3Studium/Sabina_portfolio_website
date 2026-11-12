// Úvodní stránka ve zjednodušené verzi („stacked" — telefon na výšku i na
// šířku, lib/fluid STACKED). Stejný přístup jako ProchazkaGroup: žádné scény
// řízené scrollem, žádné přišpendlení — sekce pod sebou, nejdřív text, pak
// obrázky; řady obrázků jako pás do strany (nativní scroll-snap). Obsah je
// tentýž jako v plné verzi: bloky a dokumenty z CMS, a když chybí, stejné
// zálohy (exportované z jednotlivých sekcí).
//
// Kotvy sekcí (#sluzby, #proces, #spoluprace) sedí s menu (section-popup/open).

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useMotionValue } from "framer-motion";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import type { FlexControls } from "@/components/3D/FlexCarousel";
import { FlexCaption } from "@/components/3D/FlexCarousel/caption";
import Lines, { hasLines, picture, text, type MarkedLine } from "../lines";
import { FALLBACK_CARDS, FALLBACK_PORTRAIT, FALLBACK_ROWS, type HeroCopy } from "../hero";
import { FALLBACK_SERVICES, FALLBACK_STACK, FALLBACK_STATS, INFO_FALLBACK, cardCtaOf, cardLabelOf, cardNumber, type InfoCopy } from "../info";
import { PROCESS_FALLBACK, type ProcessCopy } from "../process";
import Cta, { type CtaCopy } from "../cta";
import type { Project } from "@/lib/site/projects";
import type { HeroWord, ProcessStep, Reference, Service, StackItem, StatItem } from "@/lib/site/home";
import styles from "./styles.module.scss";
import { FLAT_LENS } from "../flat-lens";
import { InspectRoot } from "@/components/study/inspect-hint";
import { useInspect } from "@/components/study/inspector";

// 3D galerie projektů z plné verze — jediná scéna, která na telefonu zůstává.
// Neřídí ji scroll: táhne se prstem (svislý pohyb nechá stránce) a šipkami.
const FlexCarousel = dynamic(() => import("@/components/3D/FlexCarousel"), { ssr: false });

type Img = { src: string; alt: string; width: number; height: number };
const or = <T,>(list: T[] | null | undefined, fallback: T[]) => (list && list.length ? list : fallback);
const ratio = (image: { width?: number; height?: number }) => `${image.width ?? 4} / ${image.height ?? 5}`;

/** Řádek s tučnými úseky (kroky procesu, recenze). */
function Marked({ line }: { line: MarkedLine }) {
  return line.map(([run, marked], i) => (
    <span key={i}>
      {i > 0 && !/^[.,;:!?]/.test(run) ? " " : null}
      {marked ? <b>{run}</b> : run}
    </span>
  ));
}

function Kicker({ no, children }: { no?: string; children: ReactNode }) {
  return (
    <p className={styles.kicker}>
      <span className={styles.bar} aria-hidden="true" />
      {no ? <>{no} </> : null}
      <span>{children}</span>
    </p>
  );
}

function Picture({ image, sizes = "(max-width: 600px) 80vw, 40vw", className }: { image: Img; sizes?: string; className?: string }) {
  return (
    <span className={className ? `${styles.picture} ${className}` : styles.picture} style={{ "--ar": ratio(image) } as CSSProperties}>
      <Image src={image.src} alt={image.alt} fill sizes={sizes} />
    </span>
  );
}

/** Obrázek jako tlačítko: klepnutí otevře detail (Vrstvy / Náhled / Pixely). */
function Shot({ image }: { image: Img }) {
  const inspect = useInspect();
  return (
    <button type="button" className={styles.shotButton} onClick={(e) => inspect?.(image, e.currentTarget)} aria-label={`Detail: ${image.alt}`}>
      <Picture image={image} sizes="(max-width: 600px) 70vw, 35vw" />
    </button>
  );
}

/* ---------------------------------------------------------- úvod ----- */

export function HeroStacked({ copy, projects }: { copy?: HeroCopy | null; projects?: Project[] | null }) {
  const rows = hasLines(copy?.labels) && copy.labels.length >= FALLBACK_ROWS.length ? copy.labels.slice(0, FALLBACK_ROWS.length) : FALLBACK_ROWS;
  const portrait = picture(copy?.portrait, FALLBACK_PORTRAIT);
  const list = (projects ?? []).filter((project) => project.cover?.src);
  const featured = list.filter((project) => project.featured);
  const cards = list.length
    ? (featured.length >= 3 ? featured : list).slice(0, 8).map((project) => ({
        href: `/projects/${project.slug}`,
        title: project.title,
        tagline: project.tagline,
        image: { src: project.cover!.src, alt: project.tagline ? `${project.title} — ${project.tagline}` : project.title, width: project.cover!.width ?? 800, height: project.cover!.height ?? 1000 },
      }))
    : FALLBACK_CARDS.map((card) => ({
        href: `/projects/${card.slug}`,
        title: card.title,
        tagline: card.tagline,
        image: { src: card.src, alt: `${card.title} — ${card.tagline}`, width: card.width, height: card.height },
      }));
  const items = cards.map((card) => ({
    src: card.image.src,
    alt: card.image.alt,
    title: card.title,
    subtitle: card.tagline,
    href: card.href,
    // Na telefonu krátce — delší výzva přetékala kartu.
    cta: "Prohlédnout",
  }));
  const [active, setActive] = useState(0);
  const controls = useRef<FlexControls | null>(null);
  // Klepnutí na banner otevře detail s vrstvami ve 3D (study/inspector).
  const inspect = useInspect();
  return (
    <>
      <section className={`${styles.section} ${styles.hero}`} aria-label="Úvod" data-scroll-label="Úvod">
        <h1 className={styles.display}>
          <Lines lines={rows} markClass={styles.green} />
        </h1>
        <Picture image={portrait} className={styles.portrait} sizes="(max-width: 600px) 70vw, 35vw" />
      </section>
      <section className={styles.section} aria-label="Ukázky prací" data-scroll-label="Ukázky prací">
        <Kicker>Ukázky prací</Kicker>
        {/* Plátno přes celou šířku obrazovky, ohyb čočky leží za okraji. */}
        <div className={styles.galleryClip}>
        <div className={styles.gallery} data-cursor="drag">
          <FlexCarousel
            items={items}
            intro="rise"
            introSpeed={1.6}
            cardHeight={0.74}
            gap={28}
            squeeze={0.2}
            focusOnClick={false}
            captions={false}
            onChange={setActive}
            controlsRef={controls}
            onSelect={(index, anchor) => {
              const card = cards[index];
              if (card) inspect?.(card.image, anchor);
            }}
            fit="natural"
            radius={0}
            autoplay={false}
            interval={4}
            dim={0.62}
            dimHover={0.15}
            {...FLAT_LENS}
          />
        </div>
        </div>
        <div className={styles.galleryBar}>
          <FlexCaption item={items[active]} index={active} total={items.length} align="end" />
          <span className={styles.galleryNav}>
            <button type="button" className={`${styles.navButton} ${styles.isBack}`} aria-label="Předchozí projekt" onClick={() => controls.current?.previous()}>
              <Arrow />
            </button>
            <button type="button" className={styles.navButton} aria-label="Další projekt" onClick={() => controls.current?.next()}>
              <Arrow />
            </button>
          </span>
        </div>
        {/* Čtečky a klávesnice: tytéž projekty jako obyčejné odkazy. */}
        <ul className={styles.srOnly}>
          {cards.map((card) => (
            <li key={card.href}>
              <Link href={card.href}>{card.title} — {card.tagline}</Link>
            </li>
          ))}
        </ul>
        <Link href="/projects" className={styles.more}>
          Všechny projekty
          <Arrow />
        </Link>
      </section>
    </>
  );
}

/* ---------------------------------------------------------- služby --- */

export function InfoStacked({ copy, stack, stats, services }: { copy?: InfoCopy | null; stack?: StackItem[] | null; stats?: StatItem[] | null; services?: Service[] | null }) {
  const heading = hasLines(copy?.heading?.lines) ? copy!.heading!.lines! : INFO_FALLBACK.heading;
  const lead = text(copy?.lead, INFO_FALLBACK.lead);
  const toolsLabel = text(copy?.toolsLabel, INFO_FALLBACK.toolsLabel);
  const tools = or(stack, FALLBACK_STACK);
  const statList = or(stats, FALLBACK_STATS);
  const cards = or(services, FALLBACK_SERVICES);
  return (
    <section id="sluzby" className={styles.section} aria-label="Služby" data-scroll-label="Služby">
      <Kicker>Služby</Kicker>
      <h2 className={styles.heading}>
        <Lines lines={heading} markClass={styles.green} />
      </h2>
      <p className={styles.lead}>{lead}</p>

      <ol className={styles.services}>
        {cards.map((service, i) => (
          <li key={service.title + i} className={styles.service}>
            <p className={styles.serviceTop}>
              <b>{cardNumber(service, i)}</b> {cardLabelOf(service)}
            </p>
            <h3>{service.title}</h3>
            {service.lead ? <p className={styles.text}>{service.lead}</p> : null}
            {service.points.length ? (
              <ul className={styles.points}>
                {service.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            ) : null}
            <Link href="/projects" className={styles.more}>
              {cardCtaOf(service)}
              <Arrow />
            </Link>
          </li>
        ))}
      </ol>

      <h3 className={styles.subhead}>{toolsLabel}</h3>
      <ul className={styles.tools}>
        {tools.map((tool) => (
          <li key={tool.title}>
            {tool.icon?.src ? <Image src={tool.icon.src} alt="" width={20} height={20} /> : null}
            {tool.title}
          </li>
        ))}
      </ul>

      <dl className={styles.stats}>
        {statList.map((stat) => (
          <div key={stat.label}>
            <dt>{stat.value}</dt>
            <dd>{stat.label}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/* ---------------------------------------------------------- proces --- */

// Obrázky kroků jako v plné verzi (process/index.tsx, FALLBACK.shots):
// zadání = foto briefu, tvorba = 3, ladění = 1, předání = 3.
const SHOTS: Record<string, number[]> = { "03": [0, 1, 2], "04": [3], "05": [4, 5, 6] };

export function ProcessStacked({ copy, steps: docs }: { copy?: ProcessCopy | null; steps?: ProcessStep[] | null }) {
  const F = PROCESS_FALLBACK;
  const labels = hasLines(copy?.labels) ? copy!.labels! : null;
  const heading = labels && labels.length >= F.heading.length ? labels.slice(0, F.heading.length) : F.heading;
  const eyebrow = text(copy?.eyebrow, F.eyebrow);
  const lead = text(copy?.lead, F.lead);
  const docOf = (stage: string) => docs?.find((doc) => doc.stage === stage);
  const steps = F.steps.map((fallback) => {
    const doc = docOf(fallback.stage);
    const images: Img[] =
      fallback.stage === "01"
        ? [picture(doc?.images?.[0], F.briefPhoto)]
        : (SHOTS[fallback.stage] ?? []).map((shot, k) => picture(doc?.images?.[k], F.shots[shot]));
    return {
      stage: fallback.stage,
      title: text(doc?.title, fallback.title),
      text: doc?.text?.length ? doc.text : fallback.text,
      note: doc?.note?.length ? doc.note : fallback.note,
      details: doc?.details?.length ? doc.details : fallback.details,
      images,
    };
  });
  return (
    <section id="proces" className={styles.section} aria-label={eyebrow} data-scroll-label={eyebrow}>
      <Kicker>{eyebrow}</Kicker>
      <h2 className={styles.heading}>
        <Lines lines={heading} markClass={styles.green} />
      </h2>
      <p className={styles.lead}>{lead}</p>
      <ol className={styles.steps}>
        {steps.map((step) => {
          // Zadání (01) ukazuje řádky briefu. Detaily dalších kroků (písmo,
          // barvy klientů) se nevypisují — NDA, viz paměť projektu.
          const brief = step.stage === "01" ? step.details.filter((d) => !d.label.trim().endsWith(":")) : [];
          const focus = step.stage === "01" ? step.details.find((d) => d.label.trim().endsWith(":")) : undefined;
          return (
            <li key={step.stage} className={styles.step}>
              <p className={styles.stepNo} aria-hidden="true">
                {step.stage}
              </p>
              <h3>{step.title}</h3>
              <p className={styles.text}>
                <Marked line={step.text} />
              </p>
              {step.note.length ? <p className={styles.handNote}>{step.note.join(" ")}</p> : null}
              {brief.length ? (
                <dl className={styles.brief}>
                  {brief.map((row) => (
                    <div key={row.label}>
                      <dt>{row.label}</dt>
                      <dd>{row.value}</dd>
                    </div>
                  ))}
                  {focus ? (
                    <div>
                      <dt>{focus.label.replace(/:\s*$/, "")}</dt>
                      <dd>{focus.value}</dd>
                    </div>
                  ) : null}
                </dl>
              ) : null}
              {step.images.length ? (
                <div className={styles.strip} role="list">
                  {step.images.map((image, k) => (
                    <div key={image.src + k} className={styles.shot} role="listitem">
                      <Shot image={image} />
                    </div>
                  ))}
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/* ---------------------------------------------------------- výzva ---- */

// Telefon: plné CTA z dolly (rozvržení pro telefon, recenze ve 3D pásu
// FlexCarousel). Bez nástupu — stojí rovnou postavené: průběh skočí na 1
// hned po připojení (skokem, ne animací; CTA reaguje na změnu hodnoty).
export function CtaPhone({ copy, references, words }: { copy?: CtaCopy | null; references?: Reference[] | null; words?: HeroWord[] | null }) {
  const progress = useMotionValue(0);
  useEffect(() => progress.set(1), [progress]);
  return (
    <section id="spoluprace" className={styles.ctaFull} aria-label="Spolupráce" data-scroll-label="Spolupráce">
      <Cta copy={copy} references={references} words={words} progress={progress} instant />
    </section>
  );
}

function Arrow() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12h13M12 5.5 18.5 12 12 18.5" />
    </svg>
  );
}

/* ---------------------------------------------------------- stránka -- */

export type HomeStackedContent = {
  hero?: HeroCopy;
  info?: InfoCopy;
  process?: ProcessCopy;
  cta?: CtaCopy;
  projects?: Project[];
  stack?: StackItem[];
  stats?: StatItem[];
  services?: Service[];
  steps?: ProcessStep[];
  references?: Reference[];
  heroWords?: HeroWord[];
};

export default function HomeStacked({ content }: { content?: HomeStackedContent | null }) {
  return (
    <InspectRoot>
      <HeroStacked copy={content?.hero} projects={content?.projects ?? null} />
      <InfoStacked copy={content?.info} stack={content?.stack ?? null} stats={content?.stats ?? null} services={content?.services ?? null} />
      <ProcessStacked copy={content?.process} steps={content?.steps ?? null} />
      <CtaPhone
        copy={content?.cta}
        references={content?.references ?? null}
        words={content?.heroWords?.filter((word) => word.place === "cta") ?? null}
      />
    </InspectRoot>
  );
}
