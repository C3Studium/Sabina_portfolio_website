import Image from "next/image";
import Link from "next/link";
import { editableDoc, editableIn } from "@c3studium/valecms/edit";
import type { CopyItem, GlobalBlock, SocialLink } from "@/lib/site/globals";
import { useRegisterRef } from "@/providers/RefContext";
import MeasureText from "@/components/common/measure-text";
import styles from "./styles.module.scss";

// Hover jako v hlavičce: tečka kurzoru se nad logem, odkazem i sítí rozpadne
// do rohů prvku (common/cursor, RefContext) a MeasureText kolem něj nakreslí
// rámeček s rozměrem a drobky. Okraj kolem boxu v px.
const PAD = { brand: 10, link: 4, social: 5 } as const;

// Právní odkaz — vlastní komponenta kvůli registru (hook nejde volat
// v cyklu). `data-measure-frame`: rámeček obejme celý odkaz, text měří.
function LegalLink({ id, href, measured, children }: { id: number; href: string; measured: boolean; children: React.ReactNode }) {
  const ref = useRegisterRef(`footer.legal.${id}`, { pad: PAD.link });
  return (
    <a ref={ref} className={styles.legalLink} href={href} data-measure-frame={measured ? "" : undefined}>
      {children}
    </a>
  );
}

// Kroužek sítě — jen rámeček (`data-measure-frame` bez měřeného textu).
function SocialItem({ id, ...props }: { id: string } & React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  const ref = useRegisterRef(`footer.social.${id}`, { pad: PAD.social });
  return <a ref={ref} data-measure-frame="" {...props} />;
}

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
    { label: "Zásady ochrany údajů", href: "/ochrana-soukromi" },
    { label: "Obchodní podmínky", href: "/obchodni-podminky" },
    { label: "Cookies", href: "/cookies" },
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
  // Sítě nejsou položky bloku, ale dokumenty `socialLink` (prop `socials`).
  copyright: 9,
  sign: 10,
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

function LinkIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M10.2 13.8a3.6 3.6 0 0 0 5.1 0l3.1-3.1a3.6 3.6 0 0 0-5.1-5.1L11.8 7" strokeLinecap="round" />
      <path d="M13.8 10.2a3.6 3.6 0 0 0-5.1 0l-3.1 3.1a3.6 3.6 0 0 0 5.1 5.1L12.2 17" strokeLinecap="round" />
    </svg>
  );
}

// Ikony jsou kód, ne obsah — k dokumentu sítě se váží polem „Síť". Síť bez
// ikony v kódu dostane obecný řetízek, nebo vlastní ikonu z dokumentu.
const PLATFORM_ICONS: Record<string, () => React.JSX.Element> = {
  instagram: InstagramIcon,
  linkedin: LinkedinIcon,
  behance: BehanceIcon,
};

// Názvy pro čtečku, když dokument nemá vlastní.
const PLATFORM_NAMES: Record<string, string> = {
  instagram: "Instagram",
  linkedin: "LinkedIn",
  behance: "Behance",
  facebook: "Facebook",
  tiktok: "TikTok",
  dribbble: "Dribbble",
};

type FooterProps = {
  // Blok `global.footer` z `props.globals` stránky; `null` bez CMS i na 404.
  copy?: GlobalBlock | null;
  // Dokumenty „Sociální sítě" ze Studia; prázdné = sítě z kódu.
  socials?: SocialLink[] | null;
};

export default function Footer({ copy = null, socials = null }: FooterProps) {
  // Dokument zadaný jednou, ne u každé anotace. Mimo Studio je `docId`
  // undefined a `edit(...)` vrací prázdno, takže na web se nerozprostře nic.
  const edit = editableIn(copy?.docId ?? null);
  const items = copy?.items;
  // Ve Studiu bez MeasureText — překryv čte a přepisuje text přímo v DOMu.
  const editing = Boolean(copy?.docId);
  const brandRef = useRegisterRef("footer.brand", { pad: PAD.brand });
  const links: SocialLink[] = socials?.length
    ? socials
    : FALLBACK.socials.map((social) => ({
        platform: social.label.toLowerCase(),
        label: social.label,
        url: social.href,
        icon: null,
      }));

  return (
    // Patička se odkrývá zpod CTA: obal má výšku patičky a ořez (clip-path),
    // uvnitř je o výšku okna delší dráha a v ní patička přilepená ke spodku
    // okna (sticky, top = 100vh − výška). Při scrollu tak stojí na místě
    // a horní hrana obalu ji postupně odkrývá — sekce nad ní po ní odjede.
    <div className={styles.reveal}>
    <div className={styles.revealTrack}>
    <footer className={styles.footer} data-motion-hold="" data-contact-zone="">
      <div className={styles.decor} aria-hidden="true" />

      <div className={styles.inner}>
        <div className={styles.top}>
          {/* ---------- Značka a claim ---------- */}
          <div className={styles.brandCol}>
            {/* Stejná stavba i rozměry jako brand v hlavičce, aby footer
                seděl na svislici s navbarem. */}
            <MeasureText variant="brand" enabled={!editing}>
            <Link ref={brandRef} className={styles.brand} href="/" data-measure-frame="">
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
            </MeasureText>

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
            <MeasureText variant="link" enabled={!editing}>
            <ul className={styles.legalList}>
              {FALLBACK.legal.map((link, i) => {
                const at = LINES.legalFrom + i;
                return (
                  <li key={at}>
                    {/* Vnitřní odkaz: slovo se upravuje, cíl je kód — stránky
                        webu nejsou obsah, který se přesměrovává ze Studia. */}
                    <LegalLink id={at} href={link.href} measured={!editing}>
                      <span data-measure={editing ? undefined : ""} {...edit(`items.${at}.label`)}>
                        {textAt(items, at, "label", link.label)}
                      </span>
                    </LegalLink>
                  </li>
                );
              })}
            </ul>
            </MeasureText>
          </nav>

          {/* ---------- Sociální sítě ---------- */}
          <div className={styles.follow}>
            <h2 className={styles.colLabel} {...edit(`items.${LINES.followTitle}.label`)}>
              {textAt(items, LINES.followTitle, "label", FALLBACK.followTitle)}
            </h2>
            {/* Každá síť je dokument (Sociální sítě ve Studiu): klik otevře
                jeho formulář — síť, název, odkaz, případně vlastní ikona. */}
            <MeasureText variant="cta" enabled={!editing}>
            <ul className={styles.socials}>
              {links.map((social, i) => {
                const Icon = PLATFORM_ICONS[social.platform] ?? LinkIcon;
                const name = social.label || PLATFORM_NAMES[social.platform] || social.platform;
                return (
                  <li key={social.id ?? i}>
                    <SocialItem
                      id={social.id ?? `${social.platform}-${i}`}
                      className={styles.social}
                      href={social.url}
                      aria-label={name}
                      target="_blank"
                      rel="noreferrer noopener"
                      {...editableDoc(social.id ?? null, "socialLink")}
                    >
                      {social.icon?.src ? (
                        <Image src={social.icon.src} alt="" width={24} height={24} className={styles.socialImage} />
                      ) : (
                        <Icon />
                      )}
                    </SocialItem>
                  </li>
                );
              })}
            </ul>
            </MeasureText>
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
    </div>
    </div>
  );
}
