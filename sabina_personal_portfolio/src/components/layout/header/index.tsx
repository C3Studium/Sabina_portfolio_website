import Image from "next/image";
import Link from "next/link";
import { editableIn } from "@c3studium/valecms/edit";
import type { CopyItem, GlobalBlock } from "@/lib/site/globals";
import { NAV_ITEMS } from "../nav-items";
import styles from "./styles.module.scss";

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

  return (
    <header className={styles.header}>
      <Link className={styles.brand} href="/">
        {/* `alt` zůstává prázdný i s obrázkem z CMS: jméno stojí hned vedle
            jako text a čtečka by ho jinak slyšela dvakrát. */}
        <Image
          {...edit.image("image")}
          src={copy?.image?.src || FALLBACK.logo}
          alt=""
          width={64}
          height={58}
          className={styles.brandMark}
          preload
        />
        <span className={styles.brandText}>
          <span className={styles.brandName} {...edit(`items.${LINES.brand}.label`)}>
            {textAt(items, LINES.brand, "label", FALLBACK.brandName)}
          </span>
          <span className={styles.brandSurname} {...edit(`items.${LINES.brand}.value`)}>
            {textAt(items, LINES.brand, "value", FALLBACK.brandSurname)}
          </span>
        </span>
      </Link>

      {/* Navigace bez anotace schválně: jsou to názvy rout sdílené s lištou
          kontaktního modalu (../nav-items), ne texty bloku. */}
      <nav className={styles.nav} aria-label="Hlavní navigace">
        {NAV_ITEMS.map((item) => (
          <a key={item.href} className={styles.navLink} href={item.href}>
            {item.label}
          </a>
        ))}
      </nav>

      <button type="button" className={styles.cta} onClick={onContactClick}>
        <span className={styles.ctaLabel} {...edit(`items.${LINES.cta}.label`)}>
          {textAt(items, LINES.cta, "label", FALLBACK.cta)}
        </span>
        <span className={styles.ctaArrow} aria-hidden="true">
          <ArrowIcon />
        </span>
      </button>
    </header>
  );
}
