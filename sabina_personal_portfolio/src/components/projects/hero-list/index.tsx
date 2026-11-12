import { useRef, useState } from "react";
import { editableDoc, editableIn } from "@c3studium/valecms/edit";
import DepthRibbon, { type DepthRibbonHandle, type DepthRibbonItem } from "@/components/3D/DepthRibbon";
import ScrollPlaceholder from "@/components/common/scroll-placeholder";
import { openContact } from "@/components/layout/contact-modal/open";
import { PORTRAIT_PHONE, PORTRAIT_TABLET, useMedia } from "@/lib/fluid";

// Telefon na šířku — totéž co zastávka `phs` v _breakpoints.scss.
const PHONE_LANDSCAPE = "(min-width: 480px) and (max-height: 520px) and (orientation: landscape)";
import type { Project } from "@/lib/site/projects";
import { projectsOrFallback } from "../fallback";
import styles from "./styles.module.scss";

// Kolik obrázků z galerie projektu jde do ribbonu za titulní obrázek.
// Ribbon je o projektech, ne o celé galerii — ta patří do case study.
const GALLERY_IN_RIBBON = 3;

type RibbonEntry = DepthRibbonItem & { projectId: string | null };

// Položky ribbonu: za každý projekt titulní obrázek a pár z galerie, všechny
// se skupinou = pořadím projektu (šipky skáčou po projektech) a odkazem na
// case study. Rozměry z CMS drží poměr karty, než se obrázek načte.
const ribbonItems = (projects: Project[], cta: string): RibbonEntry[] =>
  projects.flatMap((project, group) =>
    [project.cover, ...project.gallery.slice(0, GALLERY_IN_RIBBON)]
      .filter((image): image is NonNullable<typeof image> => Boolean(image?.url))
      .map((image) => ({
        src: image.url,
        alt: image.alt || project.title,
        title: project.title,
        subtitle: project.tagline,
        href: `/projects/${project.slug}`,
        cta,
        group,
        width: image.width,
        height: image.height,
        projectId: project.id ?? null,
      })),
  );

// Blok `projects.intro`, jak ho tvaruje cms/projects.ts: výzva, nadpis
// sdílených detailů a poznámka o mlčenlivosti. `docId` jen ve Studiu.
export type IntroCopy = {
  cta?: string;
  sharedTitle?: string;
  note?: string;
  docId?: string;
};

// Texty, jak stojí v kódu — záloha pro prázdná pole ve Studiu. Musí být
// doslova to, co zakládá scripts/seed/projects.mjs.
const FALLBACK_INTRO = {
  cta: "Domluvit spolupráci",
  sharedTitle: "Co mohu ukázat",
  note: "Část zakázek je pod mlčenlivostí. U každého projektu ukazuji jen to, co klient schválil ke zveřejnění.",
};

// Texty stránky, jak stály v kódu — zůstávají jako záloha: prázdné pole ve
// Studiu nesmí vyrobit prázdný nadpis. Musí být doslova to, co zakládá
// scripts/seed/projects.mjs.
/** Blok `projects.labels` (cms/projects.ts). Sdílí ho seznam i detail. */
export type LabelsCopy = {
  scrollHint?: string;
  cardLink?: string;
  eyebrow?: string;
  nextLabel?: string;
  goalsTitle?: string;
  docId?: string;
};

export const FALLBACK_LABELS = {
  scrollHint: "Objevujte posunutím",
  cardLink: "Zobrazit projekt",
  eyebrow: "Case study",
  nextLabel: "Další projekt",
  goalsTitle: "Cíle projektu",
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

function ArrowDownIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path
        d="M12 5v13M5.5 12 12 18.5 18.5 12"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// 1 -> "01". Stejný formát má návrh u čísla karty i v pageru.
function pad(value: number) {
  return String(value).padStart(2, "0");
}


type Props = {
  /** Blok `projects.intro` — text pod scénou. */
  copy?: IntroCopy | null;
  /** Blok `projects.labels` — drobné popisky stránky. */
  labels?: LabelsCopy | null;
  projects?: Project[] | null;
};

/** Popisek z CMS, nebo ten z kódu. Prázdný řetězec je „nic nenapsáno". */
export const labelText = (value: string | undefined, fallback: string) =>
  (typeof value === "string" && value.trim()) || fallback;

export default function HeroList({ copy = null, labels = null, projects = null }: Props) {
  const editLabels = editableIn(labels?.docId ?? null);
  const list = projectsOrFallback(projects);
  // Dokument zadaný jednou, ne u každé anotace zvlášť. Mimo Studio je `docId`
  // undefined a `edit(...)` vrací prázdný objekt, takže na web nejde nic.
  const edit = editableIn(copy?.docId ?? null);
  // `docId` je jen v konceptu pro Studio — tam ribbon stojí a karty jsou
  // klikací cíle projektů.
  const editing = Boolean(copy?.docId || labels?.docId);

  const ribbon = useRef<DepthRibbonHandle>(null);
  // Kolečko kdekoli v sekci jede po dráze (i nad nadpisem) — stránka nescrolluje.
  const sectionRef = useRef<HTMLElement>(null);
  const items = ribbonItems(list, labelText(labels?.cardLink, FALLBACK_LABELS.cardLink));
  // Projekt, ke kterému kamera jede — pro počítadlo v pageru.
  const [currentGroup, setCurrentGroup] = useState(0);
  const portrait = useMedia(PORTRAIT_TABLET);
  const phone = useMedia(PORTRAIT_PHONE);
  // Telefon na šířku (zastávka phs v _breakpoints.scss): scéna vpravo,
  // text vlevo dole — styles, blok phs-h.
  const phoneWide = useMedia(PHONE_LANDSCAPE);

  const cta = labelText(copy?.cta, FALLBACK_INTRO.cta);
  const sharedTitle = labelText(copy?.sharedTitle, FALLBACK_INTRO.sharedTitle);
  const note = labelText(copy?.note, FALLBACK_INTRO.note);
  // Aktivní projekt (hlavní karta) a co od něj smí ven. Bez vyplněného pole
  // „Co mohu ukázat" aspoň typ zakázky.
  const active = list[currentGroup] ?? list[0];
  const shared = active?.shared?.length ? active.shared : active?.tagline ? [active.tagline] : [];

  return (
    <section ref={sectionRef} className={styles.heroList}>

      {/* Ztmavení odspodu — pod textem tmavší, nahoru se vytrácí do ztracena. */}
      <div className={styles.dim} aria-hidden="true" />

      {/* ---------- Text pod scénou ---------- */}
      {/* Jen to, co od aktivního projektu smí ven (smlouvy s klienty nedovolí
          ukazovat strategie, barvy ani písma), a vedle toho výzva. */}
      <div className={styles.intro}>
        {/* Sdílené detaily aktivního projektu. Klik ve Studiu otevře projekt
            (pole „Co mohu ukázat"); nadpis a poznámka jsou texty stránky. */}
        <div className={styles.shared}>
          {/* Číslo aktivního projektu před čárkovanou linkou, na řádku
              s „Co mohu ukázat". Mění se s projektem (01, 02…). */}
          <span className={styles.sharedIndex} aria-hidden="true">
            {pad(currentGroup + 1)}
          </span>
          <p className={styles.sharedTitle}>
            <span {...edit("items.5.label")}>{sharedTitle}</span>
            <span className={styles.sharedProject}>{active?.title}</span>
          </p>
          <ul key={currentGroup} className={styles.sharedList} {...editableDoc(active?.id ?? null, "project")}>
            {shared.map((detail, index) => (
              <li key={index}>{detail}</li>
            ))}
          </ul>
          <p className={styles.note} {...edit("items.6.label")}>
            {note}
          </p>
          {/* Nápověda posunu pod textem projektu, vodorovně jako pod nadpisem
              úvodní stránky: tečka jede po lince, popisek se rozplývá v kouři. */}
          <div className={styles.sharedHint}>
            <ScrollPlaceholder
              orientation="horizontal"
              compact
              label={labelText(labels?.scrollHint, FALLBACK_LABELS.scrollHint)}
              labelProps={editLabels("items.0.label")}
            />
            <button
              type="button"
              className={styles.hintButton}
              // Stránka nescrolluje — šipka posune scénu na další projekt,
              // stejně jako kolečko („Objevujte posunutím").
              aria-label="Posunout na další projekt"
              onClick={() => ribbon.current?.step(1)}
            >
              <ArrowDownIcon />
            </button>
          </div>
        </div>

        <button type="button" className={styles.cta} onClick={openContact}>
          <span {...edit("items.4.label")}>{cta}</span>
          <span className={styles.ctaArrow} aria-hidden="true">
            <ArrowIcon />
          </span>
        </button>
      </div>

      {/* ---------- Ribbon projektů (3D) ---------- */}
      {/* Obrázky stojí na prstenci ve svém poměru stran. V klidu je
          hlavní karta velká uprostřed pravé části, sousedky po stranách;
          kolečko / tah kameru odtáhne do přehledu celého kruhu a po zastavení
          se vrátí na nejbližší kartu. Klik na hlavní kartu otevře projekt.
          Ve Studiu dráha stojí a klik na kartu otevře záznam projektu. */}
      <div className={styles.ribbon}>
        <DepthRibbon
          ref={ribbon}
          // Popisek přiblížené karty vpravo nad pagerem (ne dole uprostřed
          // pod výzvou).
          captionClassName={styles.ribbonCaption}
          items={items}
          // Velký prstenec s jemnou vlnou: v klidu mírně prohnutá řada,
          // při posunu z odstupu čistý kruh.
          path="ring"
          view="row"
          tour="ride"
          speed={0}
          count={60}
          // Karty velké vůči rozestupu, aby v klidu byla vidět řada 4–5 karet.
          cardSize={1.3}
          maxWidth={1.2}
          // Karty podle skutečné šířky se stejnou mezerou mezi hranami.
          spacing={0.3}
          // Zelená pravítka pod i nad řadou, dílky míří k řadě.
          rulerDrop={1.2}
          thread={0.5}
          // Neaktivní projekty ztlumené, hlavní a karta pod myší plné; zadní
          // část kruhu skoro neviditelná — ukáže se až při prudkém posunu.
          rowDim={0.26}
          rowBack={0.05}
          // Každých 2,5 s další projekt (po zásahu chvíli stojí).
          autoplay={2.5}
          // Při posunu se kolem řady kreslí slova a tvary ze sazby.
          glyphs
          // Plochý pohled z boku: řada zleva doprava, hlavní karta na středu
          // a o 60 % větší než sousedky.
          rowAngle={0}
          rowFill={phone ? 0.22 : portrait ? 0.26 : phoneWide ? 0.3 : 0.34}
          rowScale={0.6}
          // Scéna přes celou sekci, za textem; hlavní karta vpravo od středu
          // a výš, aby dole vlevo zbylo místo pro text.
          vanishX={portrait ? 0.5 : phoneWide ? 0.67 : 0.58}
          vanishY={phone ? 0.36 : portrait ? 0.43 : phoneWide ? 0.55 : 0.44}
          // Stránka je jedna obrazovka bez scrollu — kolečko i tah jedou po dráze.
          wheel
          wheelTarget={() => sectionRef.current}
          linkLabel={labelText(labels?.cardLink, FALLBACK_LABELS.cardLink)}
          linkLabelAttrs={editLabels("items.1.label")}
          onCurrentChange={(index) => setCurrentGroup(items[index]?.group ?? 0)}
          editTarget={
            editing ? (index) => editableDoc(items[index]?.projectId ?? null, "project") : undefined
          }
        />
      </div>

      {/* ---------- Pager ---------- */}
      <div className={styles.pager}>
        <span className={styles.pagerCount}>
          {pad(currentGroup + 1)} / {pad(list.length)}
        </span>
        <button
          type="button"
          className={styles.pagerButton}
          aria-label="Předchozí projekt"
          onClick={() => ribbon.current?.step(-1)}
        >
          <span className={styles.isBack}>
            <ArrowIcon />
          </span>
        </button>
        <button
          type="button"
          className={`${styles.pagerButton} ${styles.isNext}`}
          aria-label="Další projekt"
          onClick={() => ribbon.current?.step(1)}
        >
          <ArrowIcon />
        </button>
      </div>
    </section>
  );
}
