// /cookies — převzaté z webu Procházka Group (components/pages/cookies/
// CookiesPage), přebarvené do tónů Sabiny.
//
// Stránka ke čtení: jeden měřený sloupec textu visí z levé svislé linky,
// každý oddíl nese velkou průsvitnou číslici nad světlým nadpisem verzálkami.
// Vedle přilepený obsah, aktivní řádek se rozsvítí zeleným čtverečkem. Dole
// jediná akce: nastavení předvoleb — otevře znovu lištu cookies webu
// (providers/CookieBanner), ne modál z Procházka Group.
//
// Texty ze Studia (bloky `cookies.*`, src/lib/cms/legal.ts), jinak z kódu
// (../terms.ts). Jednotka je ODDÍL — nadpis a odstavec spolu.

import { useEffect, useMemo, useRef, useState } from "react";
import { MotionConfig, motion, useScroll, useSpring, type Variants } from "framer-motion";
import { editable, editableLines } from "@c3studium/valecms/edit";
import { useGate } from "@/motion/LoadProvider";
import { useCookies } from "@/providers/CookiesProvider";
import CornerButton from "../corner-button";
import { CookiesSections } from "../terms";
import { CURTAIN, ENTERS, RISE, group } from "../entrance";
import type { LegalBlock } from "../privacy";
import { useStacked, viewportHeight } from "@/lib/fluid";
import styles from "./styles.module.scss";

const DRAW_X: Variants = {
  hidden: { scaleX: 0 },
  shown: { scaleX: 1, transition: { duration: 1, ease: CURTAIN } },
};

const ord = (i: number) => String(i + 1).padStart(2, "0");

// Co stránka říká bez Studia — seed (scripts/seed/legal.mjs) zakládá totéž.
const SHIPPED = {
  title: ["Co jsou cookies", "a jak je používáme."],
  lead: "Zde si můžete nastavit, ke kterým budeme mít přístup.",
  index: "Obsah",
  manage: "Chcete si přenastavit vaše cookies?",
  cta: "Nastavit",
};

export type CookiesCopy = {
  hero?: { heading?: string[]; lead?: string; docId?: string } | null;
  index?: { label?: string; docId?: string } | null;
  sections?: (LegalBlock | null)[] | null;
  manage?: { heading?: string; cta?: string; docId?: string } | null;
};

export default function CookiesContent({ content }: { content?: CookiesCopy | null }) {
  const { go } = useGate();
  const { reset } = useCookies();
  const [activeSection, setActiveSection] = useState(CookiesSections[0].id);
  const sectionRefs = useRef<(HTMLElement | null)[]>([]);
  const bodyRef = useRef<HTMLDivElement>(null);

  const hero = content?.hero ?? {};
  const index = content?.index ?? {};
  const manage = content?.manage ?? {};

  // Deset oddílů podle POŘADÍ; id (kotva) a pořadí jsou kód.
  const sections = useMemo(() => {
    const blocks = content?.sections || [];
    return CookiesSections.map((section, i) => ({
      ...section,
      title: blocks[i]?.heading || section.title,
      content: blocks[i]?.body || section.content,
      docId: blocks[i]?.docId,
    }));
  }, [content]);

  // Levá linka je zároveň průběh čtení.
  const { scrollYProgress } = useScroll({ target: bodyRef, offset: ["start 0.7", "end 0.7"] });
  const railDraw = useSpring(scrollYProgress, { stiffness: 100, damping: 30, restDelta: 0.001 });
  // Telefon: linka stojí celá, nekreslí se scrollem.
  const stacked = useStacked();

  // Aktivní oddíl: poslední, jehož vršek přešel polovinu obrazovky.
  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + viewportHeight() / 2;
      let current = CookiesSections[0].id;
      for (let i = 0; i < sectionRefs.current.length; i++) {
        const section = sectionRefs.current[i];
        if (section) {
          const sectionTop = section.getBoundingClientRect().top + window.scrollY;
          if (sectionTop <= scrollPosition) current = CookiesSections[i].id;
        }
      }
      setActiveSection(current);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Přes Lenis, když je (plynulý posun webu); kousek nad oddíl.
  const handleLinkClick = (id: string) => {
    const section = document.getElementById(id);
    if (!section) return;
    const lenis = (window as unknown as { lenisInstance?: { scrollTo: (t: Element, o?: Record<string, unknown>) => void } }).lenisInstance;
    if (lenis) lenis.scrollTo(section, { offset: -window.innerHeight * 0.16 });
    else section.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <MotionConfig reducedMotion="user">
      <section className={styles.CookiesContent}>
        <motion.header className={styles.CookiesContent__head} variants={group(0.13)} initial="hidden" animate={go ? "shown" : undefined}>
          <motion.p className={styles.CookiesContent__eyebrow} variants={RISE}>
            <em>§</em> Zásady cookies
          </motion.p>
          <motion.h1 className={styles.CookiesContent__title} variants={RISE} {...editableLines(hero?.docId, "items.*.label")}>
            {hero?.heading?.[0] || SHIPPED.title[0]}
            <span>{hero?.heading?.[1] || SHIPPED.title[1]}</span>
          </motion.h1>
          <motion.span className={styles.CookiesContent__rule} variants={DRAW_X} aria-hidden="true" />
          <motion.p className={styles.CookiesContent__lead} variants={RISE} {...editable(hero?.docId, "body", "text")}>
            {hero?.lead || SHIPPED.lead}
          </motion.p>
        </motion.header>

        <div className={styles.CookiesContent__body} ref={bodyRef}>
          <motion.nav className={styles.CookiesContent__index} aria-label="Obsah" variants={group()} initial="hidden" whileInView="shown" viewport={ENTERS}>
            <div className={styles.CookiesContent__index__inner}>
              <motion.p className={styles.CookiesContent__index__label} variants={RISE} {...editable(index?.docId, "title", "text")}>
                {index?.label || SHIPPED.index}
              </motion.p>
              <ul>
                {sections.map((section, i) => {
                  const isActive = activeSection === section.id;
                  return (
                    <motion.li key={section.id} variants={RISE}>
                      <a
                        href={`#${section.id}`}
                        className={isActive ? styles["is-active"] : undefined}
                        aria-current={isActive ? "true" : undefined}
                        onClick={(e) => {
                          e.preventDefault();
                          handleLinkClick(section.id);
                        }}
                      >
                        <span className={styles.CookiesContent__index__mark} aria-hidden="true" />
                        <span className={styles.CookiesContent__index__num}>{ord(i)}</span>
                        <span className={styles.CookiesContent__index__title}>{section.title}</span>
                      </a>
                    </motion.li>
                  );
                })}
              </ul>
            </div>
          </motion.nav>

          <div className={styles.CookiesContent__sections}>
            <motion.span className={styles.CookiesContent__rail} style={{ scaleY: stacked ? 1 : railDraw }} aria-hidden="true" />

            {sections.map((section, i) => (
              <motion.article
                key={section.id}
                id={section.id}
                className={styles.CookiesContent__section}
                ref={(el) => {
                  sectionRefs.current[i] = el;
                }}
                variants={group()}
                initial="hidden"
                whileInView="shown"
                viewport={ENTERS}
              >
                <motion.span className={styles.CookiesContent__section__tick} variants={DRAW_X} aria-hidden="true" />
                <motion.span className={styles.CookiesContent__section__num} variants={RISE} aria-hidden="true">
                  {ord(i)}
                </motion.span>
                <motion.h2 variants={RISE} {...editable(section.docId, "title", "text")}>
                  {section.title}
                </motion.h2>
                {section.content && (
                  <motion.p variants={RISE} {...editable(section.docId, "body", "text")}>
                    {section.content}
                  </motion.p>
                )}
              </motion.article>
            ))}
          </div>
        </div>

        <motion.div className={styles.CookiesContent__manage} variants={group()} initial="hidden" whileInView="shown" viewport={ENTERS}>
          <motion.span className={styles.CookiesContent__manage__rule} variants={DRAW_X} aria-hidden="true" />
          <motion.p className={styles.CookiesContent__eyebrow} variants={RISE}>
            <em>§</em> Správa předvoleb
          </motion.p>
          <motion.h2 className={styles.CookiesContent__manage__title} variants={RISE} {...editable(manage?.docId, "title", "text")}>
            {manage?.heading || SHIPPED.manage}
          </motion.h2>
          <motion.div className={styles.CookiesContent__manage__cta} variants={RISE}>
            {/* Znovu otevře lištu cookies webu s volbami. */}
            <CornerButton onClick={reset} {...editable(manage?.docId, "items.0.label", "text")}>
              {manage?.cta || SHIPPED.cta}
            </CornerButton>
          </motion.div>
        </motion.div>
      </section>
    </MotionConfig>
  );
}
