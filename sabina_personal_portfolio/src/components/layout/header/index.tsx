import { useCallback, useEffect, useState } from "react";
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
import { PORTRAIT_PHONE, useMedia } from "@/lib/fluid";
import { useRouter } from "next/router";
import { NAV_ITEMS, currentNavIndex } from "../nav-items";
import { MENU_OPEN_EVENT, openSection, type SectionKey } from "../section-popup/open";
import Menu from "../menu";
import { frameThrottle } from "@/lib/frame-throttle";
import styles from "./styles.module.scss";

// Hover hlavičky dělá kurzor: nad logem, odkazem i tlačítkem se jeho tečka
// rozpadne do čtyř rohů prvku (common/cursor, RefContext). Okraj kolem
// boxu v px. Odkazy menu mají „větší box" vlastním odsazením (styly), takže
// okraj 0 — rohy kurzoru i rámeček MeasureText sedí přesně na odkazu.
const PAD = { brand: 10, link: 0, cta: 5 } as const;

// Odkaz navigace jako vlastní komponenta: každý se zapisuje do registru
// pod svým klíčem a hook nejde volat v cyklu. `data-measure-frame` říká
// MeasureText, že rámeček obejme celý odkaz; text v `data-measure` měří.
//
// `active`: stránka (nebo sekce úvodní stránky), na které návštěvník je —
// odkaz drží rámeček a zelenou jako při najetí (`data-measure-active`).
function NavLink({ href, label, popup, active = false }: { href: string; label: string; popup?: SectionKey; active?: boolean }) {
  const ref = useRegisterRef(`header.nav.${href}`, { pad: PAD.link });
  return (
    <a
      ref={ref}
      className={styles.navLink}
      href={href}
      aria-current={active ? (popup ? "location" : "page") : undefined}
      data-measure-frame=""
      data-measure-active={active ? "" : undefined}
      data-intro="link"
      // Sekce úvodní stránky jako samostatné okno. Bez modifikátoru —
      // Ctrl/⌘ + klik dál otevře stránku v nové kartě. `data-no-veil`:
      // závoj přechodu stránek se o klik nemá starat.
      data-no-veil={popup ? "" : undefined}
      onClick={
        popup
          ? (event) => {
              if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
              event.preventDefault();
              openSection(popup);
            }
          : undefined
      }
    >
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

// Lišta s výzvou (telefon) odjede, když je na obrazovce jiná výzva ke
// kontaktu — prvek s `data-contact-zone` (výzva v CTA, patička) aspoň z půlky
// viditelný: v okně a s krytím (i po předcích) nad 0,5. Sekce si krytí
// animují samy (i chvíli po zastavení scrollu), proto se čte při scrollu
// a navíc dvakrát za sekundu, ne přes IntersectionObserver.
function useContactZone(active: boolean) {
  const [away, setAway] = useState(false);
  useEffect(() => {
    if (!active) return;
    const check = () => {
      const shown = Array.from(document.querySelectorAll<HTMLElement>("[data-contact-zone]")).some((el) => {
        const r = el.getBoundingClientRect();
        if (!r.height || r.bottom < 0 || r.top > window.innerHeight) return false;
        let opacity = 1;
        for (let node: HTMLElement | null = el; node && opacity > 0.5; node = node.parentElement) {
          opacity *= Number(getComputedStyle(node).opacity);
        }
        return opacity > 0.5;
      });
      setAway(shown);
    };
    // Nejvýš ~8× za sekundu — čte layout a krytí předků (viz frame-throttle).
    const onScroll = frameThrottle(check, 120);
    check();
    const timer = window.setInterval(onScroll, 500);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      onScroll.cancel();
      window.clearInterval(timer);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [active]);
  return active && away;
}

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

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" strokeLinecap="round" />
    </svg>
  );
}

// Popisek výzvy, když je kontaktní modal otevřený (tlačítko ho zavírá).
const CLOSE_LABEL = "Zavřít";

type HeaderProps = {
  // Otevírá kontaktní modal — stav drží _app.tsx, protože modal je
  // sourozenec hlavičky, ne její potomek.
  onContactClick: () => void;
  // Modal je otevřený: hlavička stojí nad ním a výzva se přelije na
  // „Zavřít" s křížkem — modal vlastní lištu nemá.
  contactOpen?: boolean;
  onContactClose?: () => void;
  // Blok `global.header` z `props.globals` stránky; `null` bez CMS i na 404.
  copy?: GlobalBlock | null;
};

export default function Header({ onContactClick, contactOpen = false, onContactClose, copy = null }: HeaderProps) {
  // Dokument zadaný jednou, ne u každé anotace. Mimo Studio je `docId`
  // undefined a `edit(...)` vrací prázdno, takže na web se nerozprostře nic.
  const edit = editableIn(copy?.docId ?? null);
  const items = copy?.items;
  const brandRef = useRegisterRef("header.brand", { pad: PAD.brand });
  const ctaRef = useRegisterRef("header.cta", { pad: PAD.cta });

  // Aktivní odkaz: stránka podle cesty, na úvodní stránce sekce ve výhledu
  // (počítá se při scrollu, nejvýš jednou za snímek).
  const { pathname } = useRouter();
  const [activeNav, setActiveNav] = useState(-1);
  useEffect(() => {
    const update = () => setActiveNav(currentNavIndex(pathname));
    update();
    if (pathname !== "/") return;
    // Měří sekce — nejvýš ~8× za sekundu, ne každý snímek scrollu.
    const onScroll = frameThrottle(update, 120);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      onScroll.cancel();
    };
  }, [pathname]);

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
  const ctaLabel = textAt(items, LINES.cta, "label", FALLBACK.cta);

  // Menu za tlačítkem s třemi čarami — jen tam, kde se navigace do hlavičky
  // nevejde (CSS schová .nav a ukáže .menuButton).
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), [setMenuOpen]);
  // Okno sekce otevřené z menu na dotyku se po zavření vrátí do menu
  // (section-popup/open.ts).
  useEffect(() => {
    const reopen = () => setMenuOpen(true);
    window.addEventListener(MENU_OPEN_EVENT, reopen);
    return () => window.removeEventListener(MENU_OPEN_EVENT, reopen);
  }, []);
  const barAway = useContactZone(useMedia(PORTRAIT_PHONE)) && !contactOpen;
  const toggleContact = contactOpen && onContactClose ? onContactClose : onContactClick;
  // Výzva ↔ „Zavřít" kapalným přelitím (TextMorph); ve Studiu obyčejný text.
  const ctaText = editing ? (
    contactOpen ? CLOSE_LABEL : ctaLabel
  ) : (
    <TextMorph words={[ctaLabel, CLOSE_LABEL]} index={contactOpen ? 1 : 0} measure={false} />
  );

  return (
    // `data-motion-hold`: přechod mezi stránkami hlavičku schová celou. Pod
    // oponou při načtení ne — tam naskakují prvky (`data-intro`) jeden po
    // druhém, jak je úvod postaví (src/motion/intro/header.ts).
    <>
    <header className={styles.header} data-motion-hold="lift" data-contact-open={contactOpen || undefined}>
      {/* Logo i tlačítko mají hover jako odkazy menu (MeasureText): čárkovaný
          rámeček mezi tečkami kurzoru, rozměr a drobky. Text zůstává v DOMu
          (`data-measure-frame` bez měřeného textu), jeho hover dělá CSS. */}
      <MeasureText variant="brand" className={styles.brandSlot}>
      {/* `data-brand` / `data-brand-mark`: podle nich preloader najde, kde bude
          logo stát, a kreslí ho přesně tam (src/motion/intro/logo.ts). */}
      <Link
        ref={brandRef}
        className={styles.brand}
        href="/"
        data-measure-frame=""
        // Úvodní stránka nahoře (žádná sekce ve výhledu): aktivní je logo.
        data-measure-active={pathname === "/" && activeNav < 0 ? "" : undefined}
        aria-current={pathname === "/" && activeNav < 0 ? "page" : undefined}
        data-brand=""
        data-intro="brand"
      >
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
      <MeasureText variant="nav" className={styles.navSlot}>
        <nav className={styles.nav} aria-label="Hlavní navigace">
          {NAV_ITEMS.map((item, i) => (
            <NavLink key={item.href} href={item.href} label={item.label} popup={item.popup} active={i === activeNav} />
          ))}
        </nav>
      </MeasureText>

      <MeasureText variant="cta" className={styles.ctaSlot}>
      <button
        ref={ctaRef}
        type="button"
        className={styles.cta}
        onClick={toggleContact}
        aria-expanded={contactOpen}
        data-open={contactOpen || undefined}
        data-measure-frame=""
        data-intro="cta"
      >
        <span className={styles.ctaLabel} data-intro-label="" {...edit(`items.${LINES.cta}.label`)}>
          {ctaText}
        </span>
        {/* Šipka dvakrát: při hoveru jedna odletí doprava, druhá přiletí zleva.
            Při otevřeném modalu se šipky schovají a vtočí se křížek. */}
        <span className={styles.ctaArrow} aria-hidden="true" data-intro-ring="">
          <span className={styles.ctaArrowIcon}>
            <ArrowIcon />
          </span>
          <span className={`${styles.ctaArrowIcon} ${styles.ctaArrowNext}`}>
            <ArrowIcon />
          </span>
          <span className={styles.ctaCloseIcon}>
            <CloseIcon />
          </span>
        </span>
      </button>
      </MeasureText>

      <button
        type="button"
        className={styles.menuButton}
        onClick={() => setMenuOpen(true)}
        aria-label="Otevřít menu"
        aria-expanded={menuOpen}
        aria-controls="site-menu"
        data-intro="menu"
      >
        <span className={styles.menuLines} aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      </button>

      <Menu
        id="site-menu"
        open={menuOpen}
        onClose={closeMenu}
        onContact={onContactClick}
        ctaLabel={ctaLabel}
      />
    </header>

    {/* Telefon na výšku: výzva jako lišta dole přes šířku (v hlavičce se
        schová, styles). Stojí vedle hlavičky, ne v ní — hlavička se při
        přechodu posouvá (transform) a fixed prvek uvnitř by jel s ní. */}
    <button type="button" className={styles.contactBar} onClick={toggleContact}
      data-motion-hold=""
      data-away={barAway ? "" : undefined}
      data-open={contactOpen || undefined}
      aria-expanded={contactOpen}
      tabIndex={barAway ? -1 : undefined}
    >
      <span className={styles.contactBarLabel}>{ctaText}</span>
      <span className={styles.contactBarArrow} aria-hidden="true">
        {contactOpen ? <CloseIcon /> : <ArrowIcon />}
      </span>
    </button>
    </>
  );
}
