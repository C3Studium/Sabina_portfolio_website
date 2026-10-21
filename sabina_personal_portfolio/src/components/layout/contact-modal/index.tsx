import { useEffect, useId, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { editableIn, surfaceRoot, useStudioSurface } from "@c3studium/valecms/edit";
import type { CopyItem, GlobalBlock } from "@/lib/site/globals";
import { NAV_ITEMS } from "../nav-items";
import styles from "./styles.module.scss";

// Jméno povrchu z `defineSurface` v src/lib/cms/layout.ts. Literál schválně:
// konfigurace webu je server/Studio, komponenta ji do bundlu tahat nemá.
const SURFACE = "contact";

// POZOR: telefon i e-mail jsou ZÁSTUPNÉ, skutečné kontakty neznám.
// Před spuštěním je nutné je přepsat — ve Studiu, blok „Kontakt".
type ChannelIconName = "phone" | "mail" | "clock" | "calendar";

type ChannelFallback = {
  icon: ChannelIconName;
  label: string;
  value: string;
  note: string;
};

/**
 * Co modál říká, když CMS mlčí.
 *
 * Tytéž texty, jaké tu stály natvrdo — poslední síť pro stránky bez
 * `getStaticProps` a pro nedostupnou databázi, ne náhražka.
 */
const FALLBACK = {
  logo: "/assets/rest/logo.png",
  brandName: "Sabina",
  brandSurname: "Hudrmentová",
  close: "Zavřít",
  eyebrow: "Pojďme do toho spolu",
  lead:
    "Máte v hlavě projekt? Pojďme si o něm říct. Vyplňte formulář a ozvu se vám co nejdřív.",
  channels: [
    { icon: "phone", label: "Zavolejte mi", value: "+420 123 456 789", note: "" },
    { icon: "mail", label: "Napište mi", value: "ahoj@sabinahudrmentova.cz", note: "" },
    {
      icon: "clock",
      label: "Dostupnost",
      value: "Po – Pá   9:00 – 18:00",
      note: "Obvykle odpovím do pár hodin",
    },
    {
      icon: "calendar",
      label: "Domluvit schůzku",
      value: "Vybrat termín online",
      note: "Vyberte si čas, který vám vyhovuje",
    },
  ] satisfies ChannelFallback[],
  formEyebrow: "Poslat zprávu",
  formTitle: "Mám zájem o spolupráci.",
  formLead: "Nechte mi jméno a telefon — ozvu se vám osobně a probereme váš projekt.",
  placeholders: {
    name: "Vaše jméno *",
    phone: "Telefon *",
    type: "Typ projektu (nepovinné)",
    message: "Napište mi pár slov o projektu",
  },
  submit: "Odeslat — ozvu se obratem",
  privacy: "Vaše údaje jsou v bezpečí a nikdy je nikomu nepředám.",
  projectTypes: [
    "Bannerová kampaň",
    "Obsah pro sociální sítě",
    "Vizuály pro e-shop",
    "Kompletní vizuální identita",
    "Něco jiného",
  ],
};

/**
 * Která položka `global.contact` je co. Blok je seznam a řádky se adresují
 * pozicí; tady je jediné místo, kde se pozice pojmenovávají, a anotace níž
 * opisují totéž číslo. Seed (scripts/seed/layout.mjs) zakládá položky v tomhle
 * pořadí — přehodit je znamená přehodit obojí.
 *
 * Typy projektu jsou OCAS seznamu, ne pevné pozice: je to jediná část, kde je
 * počet položek obsah (pátý typ přidat, třetí smazat), a ocas jako jediný může
 * růst, aniž by posunul něco za sebou.
 */
const LINES = {
  brand: 0, // label = jméno, value = příjmení
  eyebrow: 1,
  channelsFrom: 2, // čtyři kanály: label, value, note — ikony z kódu, pořadím
  formEyebrow: 6,
  formTitle: 7,
  formLead: 8,
  placeholderName: 9,
  placeholderPhone: 10,
  placeholderType: 11,
  placeholderMessage: 12,
  submit: 13,
  privacy: 14,
  close: 15,
  projectTypesFrom: 16,
} as const;

/**
 * Text z CMS na dané pozici, jinak ten z kódu.
 *
 * Prázdný řetězec se bere jako „nic nenapsáno": vymazané pole ve Studiu nesmí
 * vyrobit kanál bez popisku.
 */
const textAt = (
  items: CopyItem[] | undefined,
  index: number,
  key: "label" | "value" | "note",
  zaloha: string,
) => {
  const value = items?.[index]?.[key];
  return (typeof value === "string" && value.trim()) || zaloha;
};

/**
 * Cíl kanálu se odvozuje z jeho hodnoty, ne z vlastního pole: kdyby editor
 * přepsal číslo a odkaz zůstal starý, volalo by tlačítko jinam, než ukazuje.
 * Dostupnost a schůzka zatím nikam nevedou.
 */
const channelHref = (icon: ChannelIconName, value: string) => {
  if (icon === "phone") return `tel:${value.replace(/\s+/g, "")}`;
  if (icon === "mail") return `mailto:${value}`;
  return null;
};

const MESSAGE_LIMIT = 300;

// Modal JE cíl tlačítka „Domluvit spolupráci", takže odpovídající položka
// navigace se v jeho liště tváří jako aktivní — v návrhu je takhle
// zvýrazněný CONTACT.
const ACTIVE_NAV = "#spoluprace";

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
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
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
    </svg>
  );
}

function ChannelIcon({ name }: { name: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
      {name === "phone" && (
        <path
          d="M7.2 3.5 9.4 8l-1.9 1.6a12.4 12.4 0 0 0 5.9 5.9L15 13.6l4.5 2.2v3.1c0 .9-.8 1.7-1.7 1.6A16.6 16.6 0 0 1 3.5 5.2c-.1-.9.7-1.7 1.6-1.7h2.1Z"
          strokeLinejoin="round"
        />
      )}
      {name === "mail" && (
        <>
          <rect x="2.8" y="5" width="18.4" height="14" rx="2.2" />
          <path d="m3.4 6.6 8.6 6.2 8.6-6.2" strokeLinejoin="round" />
        </>
      )}
      {name === "clock" && (
        <>
          <circle cx="12" cy="12" r="8.8" />
          <path d="M12 6.9V12l3.4 2" strokeLinecap="round" />
        </>
      )}
      {name === "calendar" && (
        <>
          <rect x="3.4" y="5.2" width="17.2" height="15.4" rx="2.2" />
          <path d="M3.4 9.7h17.2M8.2 3.4v3.4M15.8 3.4v3.4" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M21 3 10.5 13.5M21 3l-6.8 18-3.7-7.5L3 9.8 21 3Z" strokeLinejoin="round" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="4.8" y="10.4" width="14.4" height="10.2" rx="2.2" />
      <path d="M8.4 10.4V7.6a3.6 3.6 0 0 1 7.2 0v2.8" strokeLinecap="round" />
    </svg>
  );
}

type ContactModalProps = {
  open: boolean;
  onClose: () => void;
  // Blok `global.contact` z `props.globals` stránky; `null` bez CMS i na 404.
  copy?: GlobalBlock | null;
};

export default function ContactModal({ open, onClose, copy = null }: ContactModalProps) {
  const [message, setMessage] = useState("");
  const titleId = useId();

  // Povrch: Studio modál otevře, i když ho žádné tlačítko nestisklo. Na
  // veřejném webu je hook vždy `false`, takže se chování nemění.
  const studioOpen = useStudioSurface(SURFACE);
  const isOpen = open || studioOpen;

  // Dokument zadaný jednou, ne u každé anotace. Mimo Studio je `docId`
  // undefined a `edit(...)` vrací prázdno, takže na web se nerozprostře nic.
  const edit = editableIn(copy?.docId ?? null);
  const items = copy?.items;

  // Typy projektu jsou ocas seznamu — cokoli od `projectTypesFrom` dál.
  // Prázdný ocas znamená „v CMS nic", ne „žádné typy", proto záloha.
  const projectTypes = (items ?? [])
    .slice(LINES.projectTypesFrom)
    .map((item) => item.label.trim())
    .filter(Boolean);
  const types = projectTypes.length ? projectTypes : FALLBACK.projectTypes;

  // Escape zavírá a po dobu otevření se zastaví scroll. Lenis si scroll
  // řídí sám, takže nestačí overflow na body — instanci je nutné stopnout,
  // jinak by se pozadí pod modalem dál posouvalo.
  useEffect(() => {
    if (!isOpen) return;

    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    const lenis = window.lenisInstance;
    lenis?.stop();
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKey);

    return () => {
      lenis?.start();
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKey);
    };
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className={styles.backdrop}
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.28, ease: "easeOut" }}
        >
          {/* `surfaceRoot` na panelu, ne na pozadí: výběr ve Studiu se uzavře
              do obsahu modálu a nenajde patičku ani hero pod ním. */}
          <motion.div
            {...surfaceRoot(SURFACE)}
            className={styles.panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onClick={(event) => event.stopPropagation()}
            initial={{ opacity: 0, y: "2vh", scale: 0.985 }}
            animate={{ opacity: 1, y: "0vh", scale: 1 }}
            exit={{ opacity: 0, y: "1.4vh", scale: 0.99 }}
            transition={{ duration: 0.34, ease: [0.22, 0.61, 0.36, 1] }}
          >
            <div className={styles.glow} aria-hidden="true" />
            {/* Zrnitá hrana toho světlého tvaru — v návrhu je výrazně
                ditherovaná, ne hladká. */}
            <div className={styles.grain} aria-hidden="true" />

            <div className={styles.bar}>
              <span className={styles.brand}>
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
              </span>

              {/* Navigace bez anotace schválně: názvy rout sdílené s hlavičkou
                  (../nav-items), ne texty bloku. */}
              <nav className={styles.nav} aria-label="Hlavní navigace">
                {NAV_ITEMS.map((item) => (
                  <a
                    key={item.href}
                    className={`${styles.navLink} ${
                      item.href === ACTIVE_NAV ? styles.isActive : ""
                    }`}
                    href={item.href}
                    onClick={onClose}
                  >
                    {item.label}
                  </a>
                ))}
              </nav>

              {/* Popisek je atribut, na stránce se kliknout nedá — upravuje se
                  ve formuláři povrchu. */}
              <button
                type="button"
                className={styles.close}
                onClick={onClose}
                aria-label={textAt(items, LINES.close, "label", FALLBACK.close)}
              >
                <CloseIcon />
              </button>
            </div>

            <div className={styles.body}>
              <div className={styles.intro}>
                <p className={styles.eyebrow}>
                  <span className={styles.eyebrowDot} aria-hidden="true" />
                  <span className={styles.eyebrowArrow} aria-hidden="true">
                    <TailArrowIcon />
                  </span>
                  {/* Slova ve vlastním <span>: tečka a šipka jsou značky, ne
                      text, a uložení celého odstavce by je smazalo. */}
                  <span {...edit(`items.${LINES.eyebrow}.label`)}>
                    {textAt(items, LINES.eyebrow, "label", FALLBACK.eyebrow)}
                  </span>
                </p>

                {/* Natvrdo schválně. Tři ručně zalomené řádky a uprostřed
                    třetího zvýrazněné slovo — překryv ukládá textContent,
                    takže by první uložení řádky slilo a značku sežralo. Pole
                    `headline` + `accent` bloku by to uneslo jen s akcentem NA
                    KONCI, a tady za ním stojí ještě otazník. Až se návrh nebo
                    schéma posune, přejde sem `headline`. */}
                <h2 className={styles.headline} id={titleId}>
                  <span>Pustíme se</span>
                  <span>do něčeho,</span>
                  <span>
                    co <span className={styles.accent}>funguje</span>?
                  </span>
                </h2>

                <p className={styles.lead} {...edit("body")}>
                  {copy?.body?.trim() || FALLBACK.lead}
                </p>

                <ul className={styles.channels}>
                  {FALLBACK.channels.map((channel, i) => {
                    const at = LINES.channelsFrom + i;
                    return (
                      <li key={at} className={styles.channel}>
                        <ChannelRow
                          icon={channel.icon}
                          label={textAt(items, at, "label", channel.label)}
                          value={textAt(items, at, "value", channel.value)}
                          note={textAt(items, at, "note", channel.note)}
                          annotate={(key) => edit(`items.${at}.${key}`)}
                        />
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className={styles.formCol}>
                <p className={styles.formEyebrow}>
                  <span {...edit(`items.${LINES.formEyebrow}.label`)}>
                    {textAt(items, LINES.formEyebrow, "label", FALLBACK.formEyebrow)}
                  </span>
                  <span className={styles.formEyebrowRule} aria-hidden="true" />
                </p>

                <p className={styles.formTitle} {...edit(`items.${LINES.formTitle}.label`)}>
                  {textAt(items, LINES.formTitle, "label", FALLBACK.formTitle)}
                </p>
                <span className={styles.formTitleRule} aria-hidden="true" />

                <p className={styles.formLead} {...edit(`items.${LINES.formLead}.label`)}>
                  {textAt(items, LINES.formLead, "label", FALLBACK.formLead)}
                </p>

                {/* Formulář zatím nikam neodesílá, backend neexistuje.
                    Placeholdery a typy projektu jsou atributy a <option>,
                    na stránce se kliknout nedají — upravují se ve formuláři
                    povrchu „Kontakt". */}
                <form
                  className={styles.form}
                  onSubmit={(event) => event.preventDefault()}
                >
                  <div className={styles.formRow}>
                    <input
                      className={styles.field}
                      type="text"
                      name="jmeno"
                      placeholder={textAt(items, LINES.placeholderName, "label", FALLBACK.placeholders.name)}
                      autoComplete="name"
                      required
                    />
                    <span className={styles.fieldWrap}>
                      <input
                        className={styles.field}
                        type="tel"
                        name="telefon"
                        placeholder={textAt(items, LINES.placeholderPhone, "label", FALLBACK.placeholders.phone)}
                        autoComplete="tel"
                        required
                      />
                      <span className={styles.fieldIcon} aria-hidden="true">
                        <PhoneFieldIcon />
                      </span>
                    </span>
                  </div>

                  <select
                    className={`${styles.field} ${styles.select}`}
                    name="typ"
                    defaultValue=""
                  >
                    <option value="" disabled>
                      {textAt(items, LINES.placeholderType, "label", FALLBACK.placeholders.type)}
                    </option>
                    {types.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>

                  <div className={styles.textareaWrap}>
                    <textarea
                      className={`${styles.field} ${styles.textarea}`}
                      name="zprava"
                      placeholder={textAt(items, LINES.placeholderMessage, "label", FALLBACK.placeholders.message)}
                      maxLength={MESSAGE_LIMIT}
                      value={message}
                      onChange={(event) => setMessage(event.target.value)}
                    />
                    <span className={styles.counter} aria-hidden="true">
                      {message.length} / {MESSAGE_LIMIT}
                    </span>
                  </div>

                  <button type="submit" className={styles.submit}>
                    <span className={styles.submitIcon} aria-hidden="true">
                      <SendIcon />
                    </span>
                    <span className={styles.submitLabel} {...edit(`items.${LINES.submit}.label`)}>
                      {textAt(items, LINES.submit, "label", FALLBACK.submit)}
                    </span>
                    <span className={styles.submitArrow} aria-hidden="true">
                      <ArrowIcon />
                    </span>
                  </button>
                </form>

                <p className={styles.privacy}>
                  <span className={styles.privacyIcon} aria-hidden="true">
                    <LockIcon />
                  </span>
                  <span {...edit(`items.${LINES.privacy}.label`)}>
                    {textAt(items, LINES.privacy, "label", FALLBACK.privacy)}
                  </span>
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

type ChannelRowProps = {
  icon: ChannelIconName;
  label: string;
  value: string;
  note: string;
  // Anotace pole položky (`label` | `value` | `note`) — pozici zná volající.
  // Tvar odpovídá `EditAttrs` knihovny: mimo Studio prázdný objekt.
  annotate: (key: "label" | "value" | "note") => Record<string, string | undefined>;
};

// Telefon a e-mail jsou proklikávací, dostupnost a schůzka zatím ne —
// proto se obal přepíná mezi <a> a <span>.
function ChannelRow({ icon, label, value, note, annotate }: ChannelRowProps) {
  const href = channelHref(icon, value);
  const content = (
    <>
      <span className={styles.channelIcon} aria-hidden="true">
        <ChannelIcon name={icon} />
      </span>
      <span className={styles.channelText}>
        <span className={styles.channelLabel} {...annotate("label")}>{label}</span>
        <span className={styles.channelValue} {...annotate("value")}>{value}</span>
        {note && (
          <span className={styles.channelNote} {...annotate("note")}>{note}</span>
        )}
      </span>
      <span className={styles.channelArrow} aria-hidden="true">
        <ArrowIcon />
      </span>
    </>
  );

  if (href) {
    return (
      <a className={styles.channelLink} href={href}>
        {content}
      </a>
    );
  }

  return <span className={styles.channelLink}>{content}</span>;
}

// Krátká linka s hrotem doleva před eyebrow textem, jak ji má návrh.
function TailArrowIcon() {
  return (
    <svg viewBox="0 0 22 8" fill="none" stroke="currentColor" strokeWidth="1.2">
      <path d="M22 4H1M4.4 1.2 1 4l3.4 2.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Drobný glyf v pravé části pole pro telefon.
function PhoneFieldIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3">
      <rect x="7" y="2.6" width="10" height="18.8" rx="2.2" />
      <path d="M11 18.6h2" strokeLinecap="round" />
    </svg>
  );
}
