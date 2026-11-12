// /ochrana-soukromi — převzaté z webu Procházka Group
// (components/pages/gdpr/TermsPage), jen přebarvené do tónů Sabiny.
//
// Stránka ke čtení v otevřené řeči webu: žádné rámečky kolem textu, vlasové
// linky, jediný akcent (zelený) na aktivním čtverečku obsahu a na mailto
// odkazech v textu. Každý oddíl má velkou průsvitnou číslici, jednu svislou
// páteř u levé hrany sloupce a z ní vyroste základní linka oddílu, když
// oddíl vjede. Obsah vlevo je přilepený a sleduje, kde čtenář je.
//
// Na malé obrazovce se obsah sbalí do jednoho řádku na začátku stránky
// (název oddílu, ve kterém čtenář je), který se rozbalí na všech devět.
// STACKED_MQ níž a mixin `stacked` ve stylech musí říkat totéž.
//
// Texty ze Studia (bloky `ochrana-soukromi.*`, src/lib/cms/legal.ts); bez
// nich texty z kódu (../terms.ts). Kotvy oddílů (#rights) jsou kód.

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion, type Variants } from "framer-motion";
import { editable } from "@c3studium/valecms/edit";
import { useGate } from "@/motion/LoadProvider";
import { PrivacySections, type LegalSection } from "../terms";
import { CURTAIN, ENTERS, RISE, group, scrollToY } from "../entrance";
import styles from "./styles.module.scss";

/** Co stránka říká bez Studia: hlava a oddíly. Výchozí = ochrana soukromí;
 *  obchodní podmínky dávají vlastní (stejné rozvržení). */
export type LegalShipped = {
  hero: { tag: string; words: string; heading: string[]; lead: string; indexLabel: string };
  sections: LegalSection[];
};

export const PRIVACY_SHIPPED: LegalShipped = {
  hero: {
    tag: "GDPR",
    words: "Ochrana soukromí",
    heading: ["Vše o ochraně,", "použití vašich údajů", "a informací."],
    lead: "Detaily a všechny podrobné informace",
    indexLabel: "Obsah",
  },
  sections: PrivacySections,
};

export type PrivacyHero = {
  tag?: string;
  words?: string;
  heading?: string[];
  lead?: string;
  indexLabel?: string;
  docId?: string;
};
export type LegalBlock = { heading?: string; body?: string; docId?: string };

/** Text ze Studia, když je; jinak ten z kódu. */
const say = (value: string | undefined, shipped: string) => (value?.trim() ? value.trim() : shipped);

const ord = (i: number) => String(i + 1).padStart(2, "0");

// JS dvojče mixinu `stacked` ve stylech — měnit obojí spolu.
const STACKED_MQ = "(max-width: 899.98px), (max-height: 560px)";

// E-maily v textu jako mailto odkazy (beze změny jediného znaku textu).
const EMAIL_RE = /([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;

const linkify = (text: string) =>
  text.split(EMAIL_RE).map((part, i) =>
    i % 2 === 1 ? (
      <a key={i} href={`mailto:${part}`}>
        {part}
      </a>
    ) : (
      part
    ),
  );

export default function PrivacyContent({
  hero = {},
  sections: blocks,
  shipped = PRIVACY_SHIPPED,
}: {
  hero?: PrivacyHero | null;
  sections?: (LegalBlock | null)[] | null;
  shipped?: LegalShipped;
}) {
  const { go } = useGate();
  const h = hero ?? {};
  const HERO = shipped.hero;
  const SECTIONS = shipped.sections;

  const head = {
    tag: say(h.tag, HERO.tag),
    words: say(h.words, HERO.words),
    heading: HERO.heading.map((line, i) => say(h.heading?.[i], line)),
    lead: say(h.lead, HERO.lead),
    indexLabel: say(h.indexLabel, HERO.indexLabel),
  };

  // Devět oddílů podle POŘADÍ; id zůstává z kódu (kotva).
  const sections = SECTIONS.map((section, i) => {
    const block = blocks?.[i] || null;
    return {
      ...section,
      title: say(block?.heading, section.title),
      content: say(block?.body, section.content ?? ""),
      docId: block?.docId,
    };
  });
  const [activeSection, setActiveSection] = useState(SECTIONS[0].id);
  const sectionRefs = useRef<(HTMLElement | null)[]>([]);

  // Tlumený pohyb: stav začíná false a mění se v efektu (server = klient).
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const read = () => setReduce(mq.matches);
    read();
    mq.addEventListener("change", read);
    return () => mq.removeEventListener("change", read);
  }, []);

  // Sbalené rozvržení (jen chování kliku; vzhled řídí styly).
  const [stacked, setStacked] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(STACKED_MQ);
    const read = () => {
      setStacked(mq.matches);
      if (!mq.matches) setOpen(false);
    };
    read();
    mq.addEventListener("change", read);
    return () => mq.removeEventListener("change", read);
  }, []);

  const rise: Variants = reduce ? { hidden: { opacity: 0 }, shown: { opacity: 1, y: 0, transition: { duration: 0.01 } } } : RISE;
  const drawX = (delay = 0): Variants =>
    reduce
      ? { hidden: { opacity: 0 }, shown: { opacity: 1, scaleX: 1, transition: { duration: 0.01 } } }
      : { hidden: { scaleX: 0 }, shown: { scaleX: 1, transition: { duration: 1.1, ease: CURTAIN, delay } } };
  const drawY: Variants = reduce
    ? { hidden: { opacity: 0 }, shown: { opacity: 1, scaleY: 1, transition: { duration: 0.01 } } }
    : { hidden: { scaleY: 0 }, shown: { scaleY: 1, transition: { duration: 1.6, ease: CURTAIN, delay: 0.15 } } };

  // Ve kterém oddílu čtenář je: poslední, jehož vršek přešel sondu.
  useEffect(() => {
    const handleScroll = () => {
      const probe = window.scrollY + window.innerHeight * 0.35;
      let current = SECTIONS[0].id;
      for (let i = 0; i < sectionRefs.current.length; i++) {
        const el = sectionRefs.current[i];
        if (!el) continue;
        const top = el.getBoundingClientRect().top + window.scrollY;
        if (top <= probe) current = SECTIONS[i].id;
      }
      setActiveSection(current);
    };
    window.addEventListener("scroll", handleScroll);
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, [SECTIONS]);

  // Poloha v rozvržení (ne getBoundingClientRect — oddíl ještě drží posun
  // vstupní animace a skok by o něj přestřelil).
  const layoutTop = (el: HTMLElement) => {
    let y = 0;
    for (let n: HTMLElement | null = el; n; n = n.offsetParent as HTMLElement | null) y += n.offsetTop;
    return y;
  };

  const scrollToId = (id: string, shrink = 0) => {
    const el = document.getElementById(id);
    if (!el) return;
    const inset = Math.min(Math.max(window.innerHeight * 0.22, 108), 240);
    scrollToY(layoutTop(el) - inset - shrink);
  };

  // Sbalené: klik zavře obsah a teprve pak posune — zavření ubere výšku
  // nad cílem, takže se cíl opraví o to, co zmizí.
  const revealRef = useRef<HTMLDivElement>(null);
  const [pending, setPending] = useState<{ id: string; n: number } | null>(null);
  useLayoutEffect(() => {
    if (!pending) return;
    const shrink = revealRef.current ? revealRef.current.getBoundingClientRect().height : 0;
    scrollToId(pending.id, shrink);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- jednorázový požadavek po zavření obsahu
    setPending(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  const goTo = (id: string) => {
    if (stacked && open) {
      setOpen(false);
      setPending({ id, n: (pending?.n ?? 0) + 1 });
      return;
    }
    scrollToId(id);
  };

  const activeTitle = sections.find((s) => s.id === activeSection)?.title ?? sections[0].title;

  return (
    <section className={styles.TermsPage}>
      <motion.header className={styles.TermsPage__hero} variants={group(0.1)} initial="hidden" animate={go ? "shown" : undefined}>
        <motion.p className={styles.TermsPage__eyebrow} variants={rise}>
          <em {...editable(h.docId, "items.0.label", "text")}>{head.tag}</em>
          {` ${head.words}`}
        </motion.p>
        <motion.h1 className={styles.TermsPage__title} variants={rise}>
          {head.heading.map((line, i) => (
            <span key={i} {...editable(h.docId, `items.${i + 1}.label`, "text")}>
              {line}
            </span>
          ))}
        </motion.h1>
        <motion.span className={styles.TermsPage__rule} variants={drawX(0.08)} aria-hidden="true" />
        <motion.p className={styles.TermsPage__lead} variants={rise} {...editable(h.docId, "items.4.label", "text")}>
          {head.lead}
        </motion.p>
      </motion.header>

      <div className={styles.TermsPage__layout}>
        <nav className={`${styles.TermsPage__index}${open ? ` ${styles["is-open"]}` : ""}`} aria-label={head.indexLabel}>
          <motion.div className={styles.TermsPage__index__inner} variants={group(0.1)} initial="hidden" whileInView="shown" viewport={ENTERS}>
            <motion.p className={styles.TermsPage__index__label} variants={rise} {...editable(h.docId, "items.5.label", "text")}>
              {head.indexLabel}
            </motion.p>

            <motion.button
              type="button"
              className={styles.TermsPage__index__toggle}
              variants={rise}
              aria-expanded={open}
              aria-controls="TermsPage-index-list"
              onClick={() => setOpen((o) => !o)}
            >
              <span className={styles.TermsPage__index__toggle__label}>{head.indexLabel}</span>
              <span className={styles.TermsPage__index__toggle__now}>{activeTitle}</span>
              <span className={styles.TermsPage__index__toggle__mark} aria-hidden="true" />
            </motion.button>

            <div className={styles.TermsPage__index__reveal} ref={revealRef}>
              <ol className={styles.TermsPage__index__list} id="TermsPage-index-list">
                {sections.map((section, i) => (
                  <motion.li key={section.id} variants={rise}>
                    <a
                      href={`#${section.id}`}
                      className={activeSection === section.id ? styles["is-active"] : ""}
                      onClick={(e) => {
                        e.preventDefault();
                        goTo(section.id);
                      }}
                    >
                      <span className={styles.TermsPage__index__square} aria-hidden="true" />
                      <span className={styles.TermsPage__index__n}>{ord(i)}</span>
                      <span className={styles.TermsPage__index__t}>{section.title}</span>
                    </a>
                  </motion.li>
                ))}
              </ol>
            </div>
          </motion.div>
        </nav>

        <div className={styles.TermsPage__sections}>
          <motion.span className={styles.TermsPage__spine} variants={drawY} initial="hidden" whileInView="shown" viewport={{ once: true, amount: 0 }} aria-hidden="true" />

          {sections.map((section, i) => (
            <motion.article
              key={section.id}
              className={styles.TermsPage__section}
              ref={(el) => {
                sectionRefs.current[i] = el;
              }}
              variants={group()}
              initial="hidden"
              whileInView="shown"
              viewport={ENTERS}
            >
              <motion.span className={styles.TermsPage__ord} variants={rise} aria-hidden="true">
                {ord(i)}
              </motion.span>
              <motion.h2 id={section.id} variants={rise} {...editable(section.docId, "title", "text")}>
                {section.title}
              </motion.h2>
              {section.content ? (
                <motion.p className={styles.TermsPage__body} variants={rise} {...editable(section.docId, "body", "text")}>
                  {linkify(section.content)}
                </motion.p>
              ) : null}
              <motion.span className={styles.TermsPage__baseline} variants={drawX(0.25)} aria-hidden="true" />
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
