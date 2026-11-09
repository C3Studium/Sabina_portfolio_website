import Image from "next/image";
import Link from "next/link";
import { editableIn } from "@c3studium/valecms/edit";
import type { CopyItem, GlobalBlock } from "@/lib/site/globals";
import { useRegisterRef } from "@/providers/RefContext";
import MeasureText from "@/components/common/measure-text";
import TextMorph from "@/components/common/text-morph";
import { useGate } from "@/motion/LoadProvider";
import { useIntroAt } from "@/motion/intro/useIntroAt";
import { LOGO } from "@/motion/intro/timeline";
import { NAV_ITEMS } from "../nav-items";
import styles from "./styles.module.scss";

// Hover hlavičky dělá kurzor: nad logem, odkazem i tlačítkem se jeho tečka
// rozpadne do čtyř rohů prvku (common/cursor, RefContext). Okraj kolem
// boxu v px. Odkazy menu mají „větší box" vlastním odsazením (styly), takže
// okraj 0 — rohy kurzoru i rámeček MeasureText sedí přesně na odkazu.
const PAD = { brand: 10, link: 0, cta: 5 } as const;

// Odkaz navigace jako vlastní komponenta: každý se zapisuje do registru
// pod svým klíčem a hook nejde volat v cyklu. `data-measure-frame` říká
// MeasureText, že rámeček obejme celý odkaz; text v `data-measure` měří.
function NavLink({ href, label }: { href: string; label: string }) {
  const ref = useRegisterRef(`header.nav.${href}`, { pad: PAD.link });
  return (
    <a ref={ref} className={styles.navLink} href={href} data-measure-frame="" data-intro="link">
      <span data-measure="">{label}</span>
    </a>
  );
}

/**
 * Co hlavička říká, když CMS mlčí.
 *
 * Tytéž texty, jaké tu stály natvrdo — je to poslední síť, ne náhražka.
 * Stránka bez `getStaticProps` (404) žádné `copy` nepředá a hlavička musí
 * vypadat stejně jako všude jinde.
 */
const FALLBACK = {
  logo: "/assets/rest/logo.png",
  brandName: "Sabina",
  brandSurname: "Hudrmentová",
  cta: "Domluvit spolupráci",
};

/**
 * Která položka `global.header` je co. Blok je seznam, řádky se adresují
 * pozicí a tady je to jediné místo, kde se pozice pojmenovávají — anotace
 * o pár řádků níž opisují totéž číslo, proto stojí hned vedle.
 *
 * Seed (scripts/seed/layout.mjs) zakládá položky v tomhle pořadí.
 */
const LINES = {
  // label = jméno, value = příjmení: dvě půlky jedné značky v jedné položce.
  brand: 0,
  cta: 1,
} as const;

/**
 * Text z CMS na dané pozici, jinak ten z kódu.
 *
 * Prázdný řetězec se bere jako „nic nenapsáno": vymazané pole ve Studiu nesmí
 * vyrobit hlavičku bez jména.
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

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path
        d="M5 12h13M12 5.5 18.5 12 12 18.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type HeaderProps = {
  // Otevírá kontaktní modal — stav drží _app.tsx, protože modal je
  // sourozenec hlavičky, ne její potomek.
  onContactClick: () => void;
  // Blok `global.header` z `props.globals` stránky; `null` bez CMS i na 404.
  copy?: GlobalBlock | null;
};

export default function Header({ onContactClick, copy = null }: HeaderProps) {
  // Dokument zadaný jednou, ne u každé anotace. Mimo Studio je `docId`
  // undefined a `edit(...)` vrací prázdno, takže na web se nerozprostře nic.
  const edit = editableIn(copy?.docId ?? null);
  const items = copy?.items;
  const brandRef = useRegisterRef("header.brand", { pad: PAD.brand });
  const ctaRef = useRegisterRef("header.cta", { pad: PAD.cta });

  // Jméno v logu se při úvodu vylije (TextMorph), když ho rámeček loga
  // obejme — jméno, o kousek později příjmení. Bez úvodu (`?nopl=1`,
  // omezený pohyb) ho pustí brána `go`. Ve Studiu zůstává obyčejným
  // textem: překryv ho čte a přepisuje přímo v DOMu.
  const editing = Boolean(copy?.docId);
  const { go } = useGate();
  const nameIn = useIntroAt(LOGO.name) || go;
  const surnameIn = useIntroAt(LOGO.name + 0.15) || go;
  const brandName = textAt(items, LINES.brand, "label", FALLBACK.brandName);
  const brandSurname = textAt(items, LINES.brand, "value", FALLBACK.brandSurname);
  // `measure={false}`: obal loga (MeasureText "brand") má jen rámeček, jméno
  // kreslí DOM a jeho hover dělá CSS.
  const morphName = (word: string, shown: boolean) =>
    editing ? word : <TextMorph words={[word]} index={shown ? 0 : -1} measure={false} />;

  return (
    // `data-motion-hold`: přechod mezi stránkami hlavičku schová celou. Pod
    // oponou při načtení ne — tam naskakují prvky (`data-intro`) jeden po
    // druhém, jak je úvod postaví (src/motion/intro/header.ts).
    <header className={styles.header} data-motion-hold="lift">
      {/* Logo i tlačítko mají hover jako odkazy menu (MeasureText): čárkovaný
          rámeček mezi tečkami kurzoru, rozměr a drobky. Text zůstává v DOMu
          (`data-measure-frame` bez měřeného textu), jeho hover dělá CSS. */}
      <MeasureText variant="brand">
      {/* `data-brand` / `data-brand-mark`: podle nich preloader najde, kde bude
          logo stát, a kreslí ho přesně tam (src/motion/intro/logo.ts). */}
      <Link ref={brandRef} className={styles.brand} href="/" data-measure-frame="" data-brand="" data-intro="brand">
        {/* `alt` zůstává prázdný i s obrázkem z CMS: jméno stojí hned vedle
            jako text a čtečka by ho jinak slyšela dvakrát. */}
        <Image
          {...edit.image("image")}
          src={copy?.image?.src || FALLBACK.logo}
          alt=""
          width={64}
          height={58}
          className={styles.brandMark}
          data-brand-mark=""
          // Logo je nad ohybem na každé stránce. Podle dokumentace se pro
          // takový obrázek hodí loading="eager", ne preload — ten by jen
          // přidával <link> do hlavičky pro pár kilobajtů.
          loading="eager"
        />
        <span className={styles.brandText}>
          <span className={styles.brandName} {...edit(`items.${LINES.brand}.label`)}>
            {morphName(brandName, nameIn)}
          </span>
          <span className={styles.brandSurname} {...edit(`items.${LINES.brand}.value`)}>
            {morphName(brandSurname, surnameIn)}
          </span>
        </span>
      </Link>
      </MeasureText>

      {/* Navigace bez anotace schválně: jsou to názvy rout sdílené s lištou
          kontaktního modalu (../nav-items), ne texty bloku. */}
      {/* Hover odkazů je efekt nadpisu (MeasureText), jen zmenšený: odkaz
          dostane rámeček s rozměrem a drobky a celý název zezelená. */}
      <MeasureText variant="nav">
        <nav className={styles.nav} aria-label="Hlavní navigace">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.href} href={item.href} label={item.label} />
          ))}
        </nav>
      </MeasureText>

      <MeasureText variant="cta">
      <button
        ref={ctaRef}
        type="button"
        className={styles.cta}
        onClick={onContactClick}
        data-measure-frame=""
        data-intro="cta"
      >
        <span className={styles.ctaLabel} data-intro-label="" {...edit(`items.${LINES.cta}.label`)}>
          {textAt(items, LINES.cta, "label", FALLBACK.cta)}
        </span>
        {/* Šipka dvakrát: při hoveru jedna odletí doprava, druhá přiletí zleva. */}
        <span className={styles.ctaArrow} aria-hidden="true" data-intro-ring="">
          <span className={styles.ctaArrowIcon}>
            <ArrowIcon />
          </span>
          <span className={`${styles.ctaArrowIcon} ${styles.ctaArrowNext}`}>
            <ArrowIcon />
          </span>
        </span>
      </button>
      </MeasureText>
    </header>
  );
}
