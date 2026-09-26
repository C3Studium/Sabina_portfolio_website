import { Fragment } from "react";
import Image from "next/image";
import { editableIn } from "@c3studium/valecms/edit";
import styles from "./styles.module.scss";

/* ------------------------------------------------------------ tvar obsahu -- */

// Jeden úsek řádku a zda je zvýrazněný — tvar, ve kterém `f.lines` dekóduje
// hvězdičky z pole `headline` (schemas/marks.js).
type Part = [string, boolean];

type Heading = { text?: string; lines?: Part[][]; mark?: string };

type Picture = {
  src: string;
  url: string;
  alt: string;
  width?: number;
  height?: number;
  sizes?: string;
};

type CardRow = { lead: string; label: string; note: string; value: string };

type Block = { docId?: string };

type PanelBlock = Block & {
  label?: string;
  heading?: Heading;
  text?: string;
  tags?: { label: string }[];
};

/** Bloky stránky /about, jak je skládá `getPageContent` podle src/lib/cms/about.ts. */
export type AboutContent = {
  me?: Block & { eyebrow?: string; heading?: Heading; image?: Picture | null };
  lead?: Block & { heading?: Heading };
  highlights?: Block & { cards?: CardRow[]; titleMark?: string };
  courses?: PanelBlock;
  skills?: PanelBlock;
};

/* ------------------------------------------------------------- záloha ----- */

// Texty, se kterými komponenta přišla. Nejsou to náhražky, je to poslední síť:
// prázdný CMS (nebo vymazané pole ve Studiu) vykreslí stránku beze změny.
//
// POZOR: obsah karet je PŘEVZATÝ Z NÁVRHU a je zástupný — jazyková
// úroveň, certifikát i rozsah zkušeností jsou konkrétní tvrzení o Sabině,
// která nemám jak ověřit. Před spuštěním je nutné je nahradit skutečnými.
const FALLBACK = {
  eyebrow: "Pojďme se poznat",
  heading: [[["Něco", false]], [["o mně", true]]] as Part[][],
  lead: [
    [["Měním nápady ve vizuály,", false]],
    [["které", false], ["spojují, mluví", true]],
    // Tečka jako vlastní úsek, aby zůstala v barvě textu jako dnes. Značka
    // v CMS zvýrazňuje po slovech, takže po seedu bude tečka zelená.
    [["a", false], ["prodávají", true], [".", false]],
  ] as Part[][],
  portrait: { src: "/assets/rest/main_photo.png", alt: "Sabina Hudrmentová", width: 612, height: 1019 },
  portraitSizes: "(max-width: 1100px) 70vw, 56vw",
};

// Ikony zůstávají v kódu a váží se na pozici karty — do CMS jdou jen texty.
// Z toho plyne jediné pravidlo, které se dá porušit: pořadí položek v bloku
// `about.highlights` musí odpovídat pořadí tady.
const HIGHLIGHTS = [
  {
    icon: "bookmark",
    art: "globe",
    label: "Vzdělání",
    title: "C1",
    subtitle: "Angličtina",
    body: "Pokročilá úroveň angličtiny pro profesionální komunikaci a mezinárodní projekty.",
  },
  {
    icon: "briefcase",
    art: "discs",
    label: "Zkušenosti",
    title: "Spolupráce se silnými značkami",
    subtitle: "",
    body: "Kampaně pro e-shopy a značky z oblasti krásy, módy a lifestylu napříč Evropou.",
  },
  {
    icon: "certificate",
    art: "rosette",
    label: "Certifikáty",
    title: "Google Digital Garage",
    subtitle: "",
    body: "Dokončený certifikát digitálního marketingu — strategie, SEO, reklama a analytika.",
  },
];

const PANELS = [
  {
    icon: "cap",
    marker: "dot",
    label: "Kurzy",
    title: [[["Neustálé vzdělávání", false]]] as Part[][],
    body: "Průběžné kurzy motion designu, UI/UX, brandingu a marketingu, abych držela krok s oborem.",
    tags: [
      "Motion design",
      "UI / UX design",
      "Brandová strategie",
      "Webový vývoj",
      "Marketing a reklama",
      "Copywriting",
    ],
  },
  {
    icon: "star",
    marker: "check",
    label: "Specializace",
    title: [[["Co umím nejlíp", false]]] as Part[][],
    body: "Zaměřuju se na výkonné bannery, media kity a vizuální systémy, které přinášejí výsledky.",
    tags: [
      "Bannery",
      "Media kity",
      "Brandové vizuály",
      "Digitální kampaně",
      "Reklamy na sítě",
      "Tiskoviny",
    ],
  },
];

/* ---------------------------------------------------------- pomocníci ----- */

/**
 * Text z CMS, jinak ten z kódu. Prázdný řetězec se bere jako „nic nenapsáno":
 * vymazané pole ve Studiu nesmí vyrobit kartu s prázdným řádkem.
 */
const pick = (value: unknown, zaloha: string) =>
  (typeof value === "string" && value.trim()) || zaloha;

/** Řádky nadpisu z CMS, jinak z kódu. Prázdné `headline` dává `[[]]`, ne `[]`. */
const linesOf = (heading: Heading | undefined, zaloha: Part[][]) => {
  const lines = heading?.lines;
  return Array.isArray(lines) && lines.some((parts) => parts.length) ? lines : zaloha;
};

/**
 * Ručně zalomený text se zvýrazněnými úseky.
 *
 * Řádky odděluje `<br />`, ne vlastní blok: překryv Studia čte `<br>` jako `\n`
 * uložené hodnoty, zatímco dva bloky by při editaci svařil do jednoho řádku.
 * Mezera jde mezi úseky, ale ne před interpunkci — kvůli záloze „a prodávají.".
 */
function Lines({ lines }: { lines: Part[][] }) {
  return lines.map((parts, line) => (
    <Fragment key={line}>
      {line > 0 ? <br /> : null}
      {parts.map(([piece, marked], run) => {
        const gap = run > 0 && !/^[.,;:!?]/.test(piece) ? " " : "";
        return marked ? (
          <Fragment key={run}>
            {gap}
            <span className={styles.accent}>{piece}</span>
          </Fragment>
        ) : (
          <Fragment key={run}>{gap + piece}</Fragment>
        );
      })}
    </Fragment>
  ));
}

/* --------------------------------------------------------------- ikony ---- */

function BadgeIcon({ name }: { name: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
      {name === "bookmark" && (
        <path d="M6.5 3.6h11v16.8L12 16.2l-5.5 4.2V3.6Z" strokeLinejoin="round" />
      )}
      {name === "briefcase" && (
        <>
          <rect x="2.8" y="7.2" width="18.4" height="13" rx="2.2" />
          <path d="M8.6 7.2V5.4a1.8 1.8 0 0 1 1.8-1.8h3.2a1.8 1.8 0 0 1 1.8 1.8v1.8" />
        </>
      )}
      {name === "certificate" && (
        <>
          <rect x="3.4" y="3.6" width="17.2" height="12.4" rx="2" />
          <path d="M7.4 19.6h9.2M12 16v3.6" strokeLinecap="round" />
        </>
      )}
      {name === "cap" && (
        <>
          <path d="M12 4 22 8.6 12 13.2 2 8.6 12 4Z" strokeLinejoin="round" />
          <path d="M6 10.6v4.8c0 1.7 2.7 3 6 3s6-1.3 6-3v-4.8" strokeLinecap="round" />
        </>
      )}
      {name === "star" && (
        <path
          d="m12 3.4 2.7 5.6 6.1.8-4.4 4.3 1 6-5.4-2.8-5.4 2.8 1-6-4.4-4.3 6.1-.8L12 3.4Z"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

// Světlé linkové kresby v pravém horním rohu karet — v návrhu jsou
// sotva viditelné, drží se jen jako textura.
function ArtIcon({ name }: { name: string }) {
  return (
    <svg viewBox="0 0 120 120" fill="none" stroke="currentColor" strokeWidth="1">
      {name === "globe" && (
        <>
          <circle cx="60" cy="60" r="44" />
          <ellipse cx="60" cy="60" rx="18" ry="44" />
          <ellipse cx="60" cy="60" rx="34" ry="44" />
          <path d="M16 60h88M24 38h72M24 82h72" />
        </>
      )}
      {name === "discs" && (
        <>
          <ellipse cx="60" cy="34" rx="40" ry="14" />
          <path d="M20 34v16c0 7.7 17.9 14 40 14s40-6.3 40-14V34" />
          <path d="M20 62v16c0 7.7 17.9 14 40 14s40-6.3 40-14V62" />
        </>
      )}
      {name === "rosette" && (
        <>
          <circle cx="60" cy="48" r="30" />
          <circle cx="60" cy="48" r="19" />
          <path d="M44 74 36 108l24-12 24 12-8-34" strokeLinejoin="round" />
        </>
      )}
    </svg>
  );
}

function MarkerIcon({ name }: { name: string }) {
  if (name === "check") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="12" r="9.4" strokeWidth="1.2" />
        <path d="m8 12.4 2.8 2.8L16.2 9.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="12" r="4.4" />
    </svg>
  );
}

/* --------------------------------------------------------------- panel ---- */

function Panel({ copy, zaloha }: { copy: PanelBlock | undefined; zaloha: (typeof PANELS)[number] }) {
  // Vlastní dokument, tedy i vlastní `edit`: prvek musí pojmenovat blok, do
  // kterého zapisuje. Mimo Studio je `docId` undefined a anotace jsou prázdné.
  const edit = editableIn(copy?.docId ?? null);
  const tags = copy?.tags?.length ? copy.tags.map((tag) => tag.label) : zaloha.tags;

  return (
    <article className={`${styles.card} ${styles.panel}`}>
      <div className={styles.panelText}>
        <span className={styles.cardBadge} aria-hidden="true">
          <BadgeIcon name={zaloha.icon} />
        </span>
        <p className={styles.cardLabel} {...edit("title")}>
          {pick(copy?.label, zaloha.label)}
        </p>
        <h2 className={styles.cardTitle} {...edit("headline", "text", copy?.heading?.mark)}>
          <Lines lines={linesOf(copy?.heading, zaloha.title)} />
        </h2>
        <p className={styles.cardBody} {...edit("body")}>
          {pick(copy?.text, zaloha.body)}
        </p>
      </div>

      {/* Každý štítek zvlášť, ne `edit.lines` na obal: štítek nese i ikonu a
          překryv by ji při editaci celého seznamu počítal do textu. Přidat
          nebo ubrat štítek jde ve formuláři bloku ve Studiu. */}
      <ul className={styles.tags}>
        {tags.map((tag, index) => (
          <li key={`${index}-${tag}`} className={styles.tag}>
            <span className={styles.tagMarker} aria-hidden="true">
              <MarkerIcon name={zaloha.marker} />
            </span>
            <span {...edit(`items.${index}.label`)}>{tag}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

/* ----------------------------------------------------------- komponenta --- */

export default function AboutMe({ content = null }: { content?: AboutContent | null }) {
  const me = content?.me;
  const lead = content?.lead;
  const highlights = content?.highlights;

  const editMe = editableIn(me?.docId ?? null);
  const editLead = editableIn(lead?.docId ?? null);
  const editCards = editableIn(highlights?.docId ?? null);

  // Fotka z knihovny médií, jinak ta z /public. Rozměry jen když je asset má —
  // holá adresa je nemá a `object-fit: contain` si s poměrem stran poradí.
  const portrait = me?.image?.url
    ? {
        src: me.image.url,
        alt: pick(me.image.alt, FALLBACK.portrait.alt),
        width: me.image.width ?? FALLBACK.portrait.width,
        height: me.image.height ?? FALLBACK.portrait.height,
      }
    : FALLBACK.portrait;

  return (
    <section className={styles.about}>
      {/* Světlý kruh vpravo a ztmavení k pravému dolnímu rohu. */}
      <div className={styles.stage} aria-hidden="true" />

      {/* ---------- Levá lišta ---------- */}
      {/* Bez anotací schválně: index sekce a pokyn k posunu jsou navigace
          stránky, ne text o Sabině. */}
      <div className={styles.rail}>
        <span className={styles.railRing} aria-hidden="true" />
        <span className={styles.railLine} aria-hidden="true" />
        <span className={styles.railIndex}>02</span>
        <span className={styles.railLine} aria-hidden="true" />
        <span className={styles.railLabel}>O mně</span>
        <span className={styles.railLine} aria-hidden="true" />
        <span className={styles.railLabel}>Objevujte posunutím</span>
        <span className={styles.railLine} aria-hidden="true" />
        <span className={styles.railDot} aria-hidden="true" />
      </div>

      {/* ---------- Nadpis ---------- */}
      <div className={styles.intro}>
        <p className={styles.eyebrow} {...editMe("title")}>
          {pick(me?.eyebrow, FALLBACK.eyebrow)}
        </p>

        {/* Anotace na <h1> samotném: zalomení je `\n` v uložené hodnotě
            a zvýraznění je značka pole, takže `mark` cestuje spolu s `docId`. */}
        <h1 className={styles.headline} {...editMe("headline", "text", me?.heading?.mark)}>
          <Lines lines={linesOf(me?.heading, FALLBACK.heading)} />
        </h1>

        <span className={styles.introRule} aria-hidden="true" />

        <p className={styles.lead} {...editLead("headline", "text", lead?.heading?.mark)}>
          <Lines lines={linesOf(lead?.heading, FALLBACK.lead)} />
        </p>
      </div>

      {/* ---------- Portrét ---------- */}
      {/* Rám, ne <Image>: maska i fotka jsou jedna fotografie, takže to, co
          editor myslí „tímhle obrázkem", je box, který ji drží. */}
      <div className={styles.portrait} {...editMe.image("image")}>
        <Image
          src={portrait.src}
          alt={portrait.alt}
          width={portrait.width}
          height={portrait.height}
          className={styles.portraitImage}
          sizes={me?.image?.sizes ?? FALLBACK.portraitSizes}
          priority
        />
      </div>

      {/* ---------- Karty ---------- */}
      <div className={styles.cards}>
        <div className={styles.rowTop}>
          {HIGHLIGHTS.map((item, index) => {
            // Karta z CMS na téže pozici; chybějící řádek = záloha z kódu.
            const row = highlights?.cards?.[index];
            const subtitle = pick(row?.note, item.subtitle);
            return (
              <article key={item.label} className={styles.card}>
                <span className={styles.cardArt} aria-hidden="true">
                  <ArtIcon name={item.art} />
                </span>
                <span className={styles.cardBadge} aria-hidden="true">
                  <BadgeIcon name={item.icon} />
                </span>
                <p className={styles.cardLabel} {...editCards(`items.${index}.lead`)}>
                  {pick(row?.lead, item.label)}
                </p>
                <h2
                  className={styles.cardTitle}
                  {...editCards(`items.${index}.label`, "text", highlights?.titleMark)}
                >
                  {pick(row?.label, item.title)}
                </h2>
                {subtitle && (
                  <p className={styles.cardSubtitle} {...editCards(`items.${index}.note`)}>
                    {subtitle}
                  </p>
                )}
                <p className={styles.cardBody} {...editCards(`items.${index}.value`)}>
                  {pick(row?.value, item.body)}
                </p>
              </article>
            );
          })}
        </div>

        <div className={styles.rowBottom}>
          <Panel copy={content?.courses} zaloha={PANELS[0]} />
          <Panel copy={content?.skills} zaloha={PANELS[1]} />
        </div>
      </div>
    </section>
  );
}
