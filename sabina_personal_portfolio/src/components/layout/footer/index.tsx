import Image from "next/image";
import Link from "next/link";
import { editableIn } from "@c3studium/valecms/edit";
import type { CopyItem, GlobalBlock } from "@/lib/site/globals";
import styles from "./styles.module.scss";

// Rok je zapsaný natvrdo schválně — new Date() na serveru a v prohlížeči
// může spadnout do jiného roku a rozbít hydrataci kvůli jedinému číslu.
const YEAR = 2026;

/**
 * Co patička říká, když CMS mlčí.
 *
 * Tytéž texty, jaké tu stály natvrdo — poslední síť pro stránky bez
 * `getStaticProps` a pro nedostupnou databázi. Odkazy jsou zatím zástupné —
 * až budou stránky existovat, stačí přepsat href; značení i pořadí odpovídá
 * návrhu.
 */
const FALLBACK = {
  logo: "/assets/rest/logo.png",
  brandName: "Sabina",
  brandSurname: "Hudrmentová",
  tagline: ["Strategie.", "Design.", "Výsledky."],
  legalTitle: "Právní informace",
  legal: [
    { label: "Zásady ochrany údajů", href: "#" },
    { label: "Obchodní podmínky", href: "#" },
    { label: "Cookies", href: "#" },
  ],
  followTitle: "Sledujte mě",
  socials: [
    { label: "Instagram", href: "#" },
    { label: "LinkedIn", href: "#" },
    { label: "Behance", href: "#" },
  ],
  copyright: `© ${YEAR} Sabina Hudrmentová. Všechna práva vyhrazena.`,
  sign: "Pojďme tvořit.",
};

/**
 * Která položka `global.footer` je co. Blok je seznam a řádky se adresují
 * pozicí; tady je jediné místo, kde se pozice pojmenovávají, a anotace níž
 * opisují totéž číslo. Seed (scripts/seed/layout.mjs) zakládá položky v tomhle
 * pořadí — přehodit je znamená přehodit obojí.
 *
 * U odkazů je `label` text a `value` cíl: dvě půlky jednoho odkazu v jedné
 * položce.
 */
const LINES = {
  brand: 0,
  taglineFrom: 1, // tři řádky claimu, poslední je zvýrazněný
  legalTitle: 4,
  legalFrom: 5, // tři právní odkazy
  followTitle: 8,
  socialsFrom: 9, // tři sítě — ikony jsou z kódu, vázané pořadím
  copyright: 12,
  sign: 13,
} as const;

/**
 * Text z CMS na dané pozici, jinak ten z kódu.
 *
 * Prázdný řetězec se bere jako „nic nenapsáno": vymazané pole ve Studiu nesmí
 * vyrobit sloupec s prázdným nadpisem.
 */
const textAt = (
  items: CopyItem[] | undefined,
  index: number,
  key: "label" | "value",
  zaloha: string,
) => {
  const value = items?.[index]?.[key];
  return (typeof value === "string" && value.trim()) || zaloha;
};

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="3" width="18" height="18" rx="5.2" />
      <circle cx="12" cy="12" r="4.1" />
      <circle cx="17.3" cy="6.7" r="1.15" fill="currentColor" stroke="none" />
    </svg>
  );
}

function LinkedinIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M6.94 8.67v10.06H3.6V8.67h3.34Zm-1.67-5.2a1.94 1.94 0 1 1 0 3.87 1.94 1.94 0 0 1 0-3.88ZM20.4 18.73h-3.34v-5.3c0-1.38-.5-2.32-1.73-2.32-.94 0-1.5.63-1.75 1.25-.09.22-.11.53-.11.84v5.53H10.1s.05-8.98 0-9.9h3.35v1.4c.44-.68 1.24-1.65 3.01-1.65 2.2 0 3.85 1.43 3.85 4.5v5.65Z" />
    </svg>
  );
}

function BehanceIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M8.4 11.5c.86-.44 1.32-1.15 1.32-2.14 0-1.96-1.46-2.9-3.28-2.9H1v11.08h5.55c1.98 0 3.83-.95 3.83-3.17 0-1.37-.65-2.38-1.98-2.87ZM3.44 8.42h2.36c.9 0 1.71.25 1.71 1.3 0 .96-.63 1.36-1.53 1.36H3.44V8.42Zm2.66 7.16H3.44v-2.9h2.72c1.1 0 1.79.46 1.79 1.42 0 1.09-.82 1.48-1.85 1.48ZM23 12.98c0-2.4-1.4-4.4-3.93-4.4-2.46 0-4.13 1.85-4.13 4.27 0 2.51 1.58 4.24 4.13 4.24 1.93 0 3.18-.87 3.78-2.72h-2.06c-.21.69-1.08 1.05-1.75 1.05-1.3 0-1.98-.76-1.98-2.05H23v-.4Zm-5.94-1.02c.07-1.06.78-1.72 1.84-1.72 1.11 0 1.67.65 1.76 1.72h-3.6ZM15.55 7.2h4.87v1.18h-4.87z" />
    </svg>
  );
}

// Ikony jsou kód, ne obsah — k položkám z CMS se váží pořadím.
const SOCIAL_ICONS = [InstagramIcon, LinkedinIcon, BehanceIcon];

type FooterProps = {
  // Blok `global.footer` z `props.globals` stránky; `null` bez CMS i na 404.
  copy?: GlobalBlock | null;
};

export default function Footer({ copy = null }: FooterProps) {
  // Dokument zadaný jednou, ne u každé anotace. Mimo Studio je `docId`
  // undefined a `edit(...)` vrací prázdno, takže na web se nerozprostře nic.
  const edit = editableIn(copy?.docId ?? null);
  const items = copy?.items;

  return (
    <footer className={styles.footer}>
      <div className={styles.decor} aria-hidden="true" />

      <div className={styles.inner}>
        <div className={styles.top}>
          {/* ---------- Značka a claim ---------- */}
          <div className={styles.brandCol}>
            {/* Stejná stavba i rozměry jako brand v hlavičce, aby footer
                seděl na svislici s navbarem. */}
            <Link className={styles.brand} href="/">
              {/* `alt` prázdný i s obrázkem z CMS: jméno je hned vedle jako
                  text a čtečka by ho slyšela dvakrát. */}
              <Image
                {...edit.image("image")}
                src={copy?.image?.src || FALLBACK.logo}
                alt=""
                width={64}
                height={58}
                className={styles.brandMark}
              />
              <span className={styles.brandText}>
                <span className={styles.brandName} {...edit(`items.${LINES.brand}.label`)}>
                  {textAt(items, LINES.brand, "label", FALLBACK.brandName)}
                </span>
                <span className={styles.brandSurname} {...edit(`items.${LINES.brand}.value`)}>
                  {textAt(items, LINES.brand, "value", FALLBACK.brandSurname)}
                </span>
              </span>
              <span className={styles.brandDot} aria-hidden="true" />
            </Link>

            {/* Každý řádek ve vlastním <span> a s vlastní anotací: překryv
                ukládá textContent a jeden prvek se třemi řádky by slil. Třetí
                řádek je zvýrazněný třídou, ne značkou v textu, takže zůstává
                prostý text. */}
            <p className={styles.tagline}>
              {FALLBACK.tagline.map((line, i) => {
                const at = LINES.taglineFrom + i;
                const last = i === FALLBACK.tagline.length - 1;
                return (
                  <span
                    key={at}
                    className={last ? styles.accent : undefined}
                    {...edit(`items.${at}.label`)}
                  >
                    {textAt(items, at, "label", line)}
                  </span>
                );
              })}
            </p>
          </div>

          {/* ---------- Právní odkazy ---------- */}
          <nav className={styles.legal} aria-label="Právní informace">
            <h2 className={styles.colLabel} {...edit(`items.${LINES.legalTitle}.label`)}>
              {textAt(items, LINES.legalTitle, "label", FALLBACK.legalTitle)}
            </h2>
            <ul className={styles.legalList}>
              {FALLBACK.legal.map((link, i) => {
                const at = LINES.legalFrom + i;
                return (
                  <li key={at}>
                    {/* Text i cíl z jedné položky: `label` je slovo na stránce,
                        `value` adresa. */}
                    <a
                      className={styles.legalLink}
                      href={textAt(items, at, "value", link.href)}
                      {...edit.link({ text: `items.${at}.label`, href: `items.${at}.value` })}
                    >
                      {textAt(items, at, "label", link.label)}
                    </a>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* ---------- Sociální sítě ---------- */}
          <div className={styles.follow}>
            <h2 className={styles.colLabel} {...edit(`items.${LINES.followTitle}.label`)}>
              {textAt(items, LINES.followTitle, "label", FALLBACK.followTitle)}
            </h2>
            <ul className={styles.socials}>
              {FALLBACK.socials.map((social, i) => {
                const at = LINES.socialsFrom + i;
                const Icon = SOCIAL_ICONS[i];
                return (
                  <li key={at}>
                    {/* Ikona nemá slova na obrazovce, takže se upravuje jen
                        cíl; `label` slouží čtečce. */}
                    <a
                      className={styles.social}
                      href={textAt(items, at, "value", social.href)}
                      aria-label={textAt(items, at, "label", social.label)}
                      target="_blank"
                      rel="noreferrer noopener"
                      {...edit.link({ href: `items.${at}.value` })}
                    >
                      <Icon />
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        {/* ---------- Spodní pruh ---------- */}
        <div className={styles.bottom}>
          <span className={styles.bottomRule} aria-hidden="true" />
          <p className={styles.copy} {...edit(`items.${LINES.copyright}.label`)}>
            {textAt(items, LINES.copyright, "label", FALLBACK.copyright)}
          </p>
          <p className={styles.sign} {...edit(`items.${LINES.sign}.label`)}>
            {textAt(items, LINES.sign, "label", FALLBACK.sign)}
          </p>
        </div>
      </div>
    </footer>
  );
}
