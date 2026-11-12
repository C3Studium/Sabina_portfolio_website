import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion, useTransform, type MotionValue } from "framer-motion";
import { editableIn, surfaceRoot, useStudioSurface } from "@c3studium/valecms/edit";
import type { CopyItem, GlobalBlock } from "@/lib/site/globals";
import { decodeMarked } from "@/lib/site/marks";
import Lines from "@/components/home/lines";
import SmokeText from "@/components/common/smoke-text";
import { useFormBuild } from "./build";
import Brief from "./brief";
import { CopyIcon } from "./brief-icons";
import LayerStack from "./layer-stack";
import Geometry from "./geometry";
import BauhausBg from "./bauhaus-bg";

// Vstup a odchod modálu: rozmazané pozadí, panel a v něm prvky po ose x —
// lišta a úvod (na šířku) zleva, formulář zprava. Odchod je tentýž pohyb obráceně a rychleji — prvky odjedou dřív,
// než zmizí karta, a pozadí zhasne až po kartě (delay, ne `afterChildren`:
// u vnořených variant spolehlivější). Text, pole a kontakty pod formulářem
// řídí stavba (build.ts), ne varianty.
const EASE_OUT = [0.22, 1, 0.36, 1] as const;
const EASE_IN = [0.4, 0, 1, 1] as const;
const BACKDROP = {
  hidden: { opacity: 0 },
  shown: { opacity: 1, transition: { duration: 0.3, ease: "easeOut" } },
  exit: { opacity: 0, transition: { duration: 0.28, ease: "easeIn", delay: 0.34 } },
} as const;
const PANEL = {
  hidden: { opacity: 0, scale: 0.96 },
  shown: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.5, ease: EASE_OUT, delayChildren: 0.14, staggerChildren: 0.055 },
  },
  exit: {
    opacity: 0,
    scale: 0.985,
    transition: { duration: 0.3, ease: EASE_IN, delay: 0.16, staggerChildren: 0.025, staggerDirection: -1 },
  },
} as const;
const slide = (from: string, away: string) =>
  ({
    hidden: { opacity: 0, x: from },
    shown: { opacity: 1, x: "0vw", transition: { duration: 0.6, ease: EASE_OUT } },
    exit: { opacity: 0, x: away, transition: { duration: 0.22, ease: EASE_IN } },
  }) as const;
const ITEM_LEFT = slide("-2.6vw", "-1.6vw");
const ITEM = slide("2.4vw", "1.6vw");
// Pruh nad nadpisem se vytáhne zleva.
const BAR = {
  hidden: { scaleX: 0 },
  shown: { scaleX: 1, transition: { duration: 0.7, ease: EASE_OUT, delay: 0.35 } },
  exit: { scaleX: 0, transition: { duration: 0.2, ease: EASE_IN } },
} as const;

// Nadpis úvodu, když blok žádný nemá — tentýž zápis, jaký zakládá seed.
const FALLBACK_HEADLINE = "Pustíme se\ndo něčeho,\nco *funguje*?";
import styles from "./styles.module.scss";
import { cvw } from "@/lib/fluid";

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
  formLead: "Pár kliknutí — vyberte, co sedí, a na konci odešlete. Ozvu se s návrhem postupu.",
  placeholders: {
    name: "Vaše jméno *",
    phone: "Telefon *",
    type: "Typ projektu (nepovinné)",
    message: "Napište mi pár slov o projektu",
  },
  submit: "Odeslat — ozvu se obratem",
  privacy: "Vaše údaje jsou v bezpečí a nikdy je nikomu nepředám.",
  consent: "Souhlasím se zpracováním osobních údajů",
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
  consent: 16, // souhlas se zpracováním údajů (zaškrtávací pole)
  projectTypesFrom: 17,
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
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  // Povrch: Studio modál otevře, i když ho žádné tlačítko nestisklo. Na
  // veřejném webu je hook vždy `false`, takže se chování nemění.
  const studioOpen = useStudioSurface(SURFACE);
  const isOpen = open || studioOpen;

  // Dokument zadaný jednou, ne u každé anotace. Mimo Studio je `docId`
  // undefined a `edit(...)` vrací prázdno, takže na web se nerozprostře nic.
  const edit = editableIn(copy?.docId ?? null);
  const items = copy?.items;
  const headline = (copy?.headline?.trim() || FALLBACK_HEADLINE)
    .split("\n")
    .map((line) => decodeMarked(line))
    .filter((line) => line.length);

  // Starší záznam v databázi nemá řádek souhlasu: na jeho místě (16) už
  // začínají typy projektu. Pak souhlas z kódu a typy od 16.
  const consentInCms = /souhlas/i.test(items?.[LINES.consent]?.label ?? "");
  const consentText = consentInCms ? textAt(items, LINES.consent, "label", FALLBACK.consent) : FALLBACK.consent;

  // Typy projektu jsou ocas seznamu — cokoli od `projectTypesFrom` dál.
  // Prázdný ocas znamená „v CMS nic", ne „žádné typy", proto záloha.
  const projectTypes = (items ?? [])
    .slice(consentInCms || !items?.[LINES.consent] ? LINES.projectTypesFrom : LINES.consent)
    .map((item) => item.label.trim())
    .filter(Boolean);
  const types = projectTypes.length ? projectTypes : FALLBACK.projectTypes;

  // Stavba formuláře (build.ts): text z kouře, pole, souhlas a tlačítko
  // rámečkem a konturou. Ve Studiu stojí formulář hotový.
  const editing = Boolean(copy?.docId);
  const build = useFormBuild({ active: isOpen, disabled: studioOpen || editing, panelRef });
  const formTitle = textAt(items, LINES.formTitle, "label", FALLBACK.formTitle);
  const formLead = textAt(items, LINES.formLead, "label", FALLBACK.formLead);
  const submitLabel = textAt(items, LINES.submit, "label", FALLBACK.submit);
  const placeholder = {
    name: textAt(items, LINES.placeholderName, "label", FALLBACK.placeholders.name),
    phone: textAt(items, LINES.placeholderPhone, "label", FALLBACK.placeholders.phone),
    type: textAt(items, LINES.placeholderType, "label", FALLBACK.placeholders.type),
    message: textAt(items, LINES.placeholderMessage, "label", FALLBACK.placeholders.message),
  };

  // Escape zavírá a po dobu otevření se zastaví scroll. Lenis si scroll
  // řídí sám, takže nestačí overflow na body — instanci je nutné stopnout,
  // jinak by se pozadí pod modalem dál posouvalo.
  useEffect(() => {
    if (!isOpen) return;

    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    // Modal nemá vlastní lištu: začíná pod hlavičkou webu, která stojí nad
    // ním (její výzva je teď „Zavřít"). Výška hlavičky se mění podle
    // zarážek, proto se měří (CSS: --header-bottom).
    const root = document.documentElement;
    const placeUnderHeader = () => {
      const header = document.querySelector<HTMLElement>("header[data-motion-hold]");
      if (!header) return;
      // Tlačítka (menu, výzva) můžou z boxu hlavičky přečnívat — měří se i ona.
      const bottoms = [header, ...Array.from(header.querySelectorAll<HTMLElement>(":scope > *, button"))]
        .map((el) => el.getBoundingClientRect())
        .filter((box) => box.height > 0 && box.bottom < window.innerHeight / 2)
        .map((box) => box.bottom);
      root.style.setProperty("--header-bottom", `${Math.round(Math.max(...bottoms) + 8)}px`);
    };
    placeUnderHeader();

    const lenis = window.lenisInstance;
    lenis?.stop();
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKey);
    window.addEventListener("resize", placeUnderHeader);

    return () => {
      lenis?.start();
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKey);
      window.removeEventListener("resize", placeUnderHeader);
    };
  }, [isOpen, onClose]);

  return (
    <>
    {/* Po odchodu modálu se stavba vrátí do výchozího stavu — další otevření
        ji přehraje znovu od začátku. */}
    <AnimatePresence onExitComplete={build.reset}>
      {isOpen && (
        <motion.div
          className={styles.backdrop}
          onClick={onClose}
          variants={BACKDROP}
          initial="hidden"
          animate="shown"
          exit="exit"
        >
          {/* `surfaceRoot` na panelu, ne na pozadí: výběr ve Studiu se uzavře
              do obsahu modálu a nenajde patičku ani hero pod ním. */}
          <motion.div
            {...surfaceRoot(SURFACE)}
            ref={panelRef}
            // Lenis je při otevřeném modalu zastavený a kolečko i dotyk by
            // pohltil — panel se posouvá sám (nativní scroll).
            data-lenis-prevent=""
            className={styles.panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onClick={(event) => event.stopPropagation()}
            variants={PANEL}
          >
            <div className={styles.glow} aria-hidden="true" />
            {/* Zrnitá hrana toho světlého tvaru — v návrhu je výrazně
                ditherovaná, ne hladká. */}
            <div className={styles.grain} aria-hidden="true" />

            {/* Mřížka: na šířku úvod a kontakty vlevo, formulář vpravo; na
                výšku formulář a pod ním kontakty, úvod schovaný (CSS). */}
            <div className={styles.body}>
              <div className={styles.intro}>
                {/* Rozložený banner (vrstvy jako ve Figmě), krátký pruh a
                    nadpis až dole. */}
                {/* Sotva viditelná kresba v uhlovém sloupci, za vrstvami. */}
                <div className={styles.introBg}>
                  <Geometry variant="dim" className={styles.introGeo} />
                </div>
                <LayerStack />
                <motion.p className={styles.eyebrow} variants={ITEM_LEFT}>
                  <span className={styles.eyebrowDot} aria-hidden="true" />
                  <span className={styles.eyebrowArrow} aria-hidden="true">
                    <TailArrowIcon />
                  </span>
                  {/* Slova ve vlastním <span>: tečka a šipka jsou značky, ne
                      text, a uložení celého odstavce by je smazalo. */}
                  <span {...edit(`items.${LINES.eyebrow}.label`)}>
                    {textAt(items, LINES.eyebrow, "label", FALLBACK.eyebrow)}
                  </span>
                </motion.p>

                {/* Pole `headline` bloku: řádky oddělené Enterem, zvýraznění
                    hvězdičkami („co *funguje*?"). Řádky jsou <br>, ne spany —
                    překryv čte <br> jako konec řádku. */}
                <motion.span className={styles.shapeBar} variants={BAR} aria-hidden="true" />
                <motion.h2 className={styles.headline} variants={ITEM_LEFT} {...edit("headline", "text", "highlight")}>
                  <Lines lines={headline} markClass={styles.accent} trailClass="" />
                </motion.h2>

                <motion.p className={styles.lead} variants={ITEM_LEFT} {...edit("body")}>
                  {copy?.body?.trim() || FALLBACK.lead}
                </motion.p>
              </div>

              <div className={styles.formCol}>
                {/* Bauhaus tvary úplně vzadu za formulářem; naskočí poslední. */}
                <BauhausBg className={styles.formBg} />
                <motion.p className={styles.formEyebrow} variants={ITEM}>
                  <span {...edit(`items.${LINES.formEyebrow}.label`)}>
                    {textAt(items, LINES.formEyebrow, "label", FALLBACK.formEyebrow)}
                  </span>
                  <span className={styles.formEyebrowRule} aria-hidden="true" />
                </motion.p>

                {/* Nadpis a text formuláře se srazí z kouře — týž kouř jako
                    nápověda „Objevujte posunutím" (SmokeText). */}
                <SmokeText
                  className={styles.formTitle}
                  id={titleId}
                  text={formTitle}
                  progress={build.title}
                  still={build.still}
                  {...edit(`items.${LINES.formTitle}.label`)}
                />
                <span className={styles.formTitleRule} aria-hidden="true" />

                <SmokeText
                  className={styles.formLead}
                  text={formLead}
                  progress={build.lead}
                  still={build.still}
                  {...edit(`items.${LINES.formLead}.label`)}
                />

                {/* Poptávka v krocích (brief.tsx): návštěvník jen kliká na
                    možnosti, na konci nechá jméno a kontakt a odešle. Nastoupí
                    s postupem stavby (průhlednost) — ne přes SketchText, ten by
                    obsah vykreslil dvakrát a kroky by měly dva stavy.
                    Odeslání zatím nikam nevede, backend neexistuje. */}
                <motion.div className={styles.briefWrap} style={{ opacity: build.part.name }}>
                  <Brief
                    types={types}
                    namePlaceholder={placeholder.name}
                    contactPlaceholder={`${placeholder.phone.replace(/\s*\*$/, "")} nebo e-mail *`}
                    notePlaceholder={placeholder.message}
                    consentLabel={
                      <span {...(consentInCms ? edit(`items.${LINES.consent}.label`) : {})}>{consentText}</span>
                    }
                    submitBody={
                      <SubmitBody label={submitLabel} measure={false} edit={edit(`items.${LINES.submit}.label`)} />
                    }
                  />
                </motion.div>

                <p className={styles.privacy}>
                  <span className={styles.privacyIcon} aria-hidden="true">
                    <LockIcon />
                  </span>
                  <span {...edit(`items.${LINES.privacy}.label`)}>
                    {textAt(items, LINES.privacy, "label", FALLBACK.privacy)}
                  </span>
                </p>
              </div>

              {/* Kontakty — na šířku pod úvodem, na výšku pod formulářem.
                  Přijedou jeden po druhém, až se formulář postaví
                  (build.channels). */}
              <ul className={styles.channels}>
                {FALLBACK.channels.map((channel, i) => {
                  const at = LINES.channelsFrom + i;
                  return (
                    <SlideIn
                      key={at}
                      className={styles.channel}
                      progress={build.channels}
                      index={i}
                      count={FALLBACK.channels.length}
                    >
                      <ChannelRow
                        icon={channel.icon}
                        label={textAt(items, at, "label", channel.label)}
                        value={textAt(items, at, "value", channel.value)}
                        note={textAt(items, at, "note", channel.note)}
                        annotate={(key) => edit(`items.${at}.${key}`)}
                      />
                    </SlideIn>
                  );
                })}
              </ul>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
    </>
  );
}

// Obsah tlačítka: ikona, popisek a šipka v kroužku. `measure` = slova a
// kroužek nesou značky MeasureText; bez nich jde o kopii pro konturu
// SketchText (stavba), nebo o editační rám Studia.
function SubmitBody({
  label,
  measure,
  edit,
}: {
  label: string;
  measure: boolean;
  edit?: Record<string, unknown>;
}) {
  const words = label.split(/\s+/).filter(Boolean);
  return (
    <>
      <span className={styles.submitIcon} aria-hidden="true">
        <SendIcon />
      </span>
      <span className={styles.submitLabel} {...edit}>
        {measure
          ? words.map((word, i) => (
              <span key={i}>
                {/^[—–-]$/.test(word) ? word : <span data-measure="">{word}</span>}
                {i < words.length - 1 ? " " : null}
              </span>
            ))
          : label}
      </span>
      <span className={styles.submitArrow} data-measure-frame={measure ? "" : undefined} aria-hidden="true">
        <ArrowIcon />
      </span>
    </>
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

// Telefon a e-mail se klikem zkopírují (tlačítko); dostupnost a schůzka
// zatím nikam nevedou (span). Šipka je uhlová; na myši při najetí zezelená
// v černém kroužku a vedle naskočí „Klikněte pro zkopírování". Na dotyku je
// místo šipky ikona kopírování (CSS podle `hover`).
const COPY_HINT = "Klikněte pro zkopírování";
const COPIED = "Zkopírováno";

function ChannelRow({ icon, label, value, note, annotate }: ChannelRowProps) {
  const copyable = icon === "phone" || icon === "mail";
  const [copied, setCopied] = useState(false);
  const copy = () => {
    const done = () => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    };
    navigator.clipboard?.writeText(value.trim()).then(done, done);
  };
  const content = (
    <>
      <span className={styles.channelIcon} aria-hidden="true">
        <ChannelIcon name={icon} />
      </span>
      <span className={styles.channelText}>
        {/* Popisek a nápověda kopírování v jedné buňce — při najetí se
            vystřídají, hodnotu pod nimi nic nepřekryje. */}
        <span className={styles.channelLabelSlot}>
          <span className={styles.channelLabel} {...annotate("label")}>{label}</span>
          {copyable ? (
            <span className={`${styles.channelLabel} ${styles.channelHint}`} aria-hidden="true">
              {copied ? COPIED : COPY_HINT}
            </span>
          ) : null}
        </span>
        <span className={styles.channelValue} {...annotate("value")}>
          <BreakableValue value={value} editable={Object.keys(annotate("value")).length > 0} />
        </span>
        {note && (
          <span className={styles.channelNote} {...annotate("note")}>{note}</span>
        )}
      </span>
      <span className={styles.channelArrow} aria-hidden="true">
        {copyable && copied ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m5 12.5 4.5 4.5L19 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <>
            <span className={styles.arrowGlyph}>
              <ArrowIcon />
            </span>
            {copyable ? (
              <span className={styles.copyGlyph}>
                <CopyIcon />
              </span>
            ) : null}
          </>
        )}
      </span>
    </>
  );

  if (copyable) {
    return (
      <button
        type="button"
        className={styles.channelLink}
        data-copy=""
        data-copied={copied || undefined}
        onClick={copy}
        aria-label={`${label}: ${value} — ${copied ? COPIED : COPY_HINT}`}
      >
        {content}
      </button>
    );
  }

  return <span className={styles.channelLink}>{content}</span>;
}

// E-mail se smí zalomit jen za zavináčem (úzký modul kontaktů), jinak celý.
// Ve Studiu čistý text — překryv ho upravuje přímo v DOMu.
function BreakableValue({ value, editable }: { value: string; editable: boolean }) {
  const at = value.indexOf("@");
  if (editable || at < 0) return <>{value}</>;
  return (
    <>
      {value.slice(0, at + 1)}
      <wbr />
      {value.slice(at + 1)}
    </>
  );
}

// Krátká linka s hrotem doleva před eyebrow textem, jak ji má návrh.
function TailArrowIcon() {
  return (
    <svg viewBox="0 0 22 8" fill="none" stroke="currentColor" strokeWidth="1.2">
      <path d="M22 4H1M4.4 1.2 1 4l3.4 2.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Kontakt, který přijede zprava: vlastní úsek postupu `progress` 0–1,
// úseky se překrývají (rozestup čtvrt délky), jako stagger.
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
function SlideIn({
  progress,
  index,
  count,
  className,
  children,
}: {
  progress: MotionValue<number>;
  index: number;
  count: number;
  className?: string;
  children: React.ReactNode;
}) {
  const length = 1 / (1 + (count - 1) * 0.25);
  const from = index * length * 0.25;
  const t = useTransform(progress, (p) => easeOut(Math.min(Math.max((p - from) / length, 0), 1)));
  const x = useTransform(t, (v) => cvw((1 - v) * 2.4));
  return (
    <motion.li className={className} style={{ x, opacity: t }}>
      {children}
    </motion.li>
  );
}
