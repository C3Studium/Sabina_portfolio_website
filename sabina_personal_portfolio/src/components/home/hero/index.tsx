import { useRef, type CSSProperties } from "react";
import Image from "next/image";
import dynamic from "next/dynamic";
import { motion, useScroll, useTransform } from "framer-motion";
import { editableIn } from "@c3studium/valecms/edit";
import Lines, {
  hasLines,
  picture,
  pictures,
  text,
  type CmsImage,
  type MarkedLine,
} from "../lines";
import styles from "./styles.module.scss";

// Sahá na WebGL a na 2D canvas kvůli getImageData, takže se nesmí
// renderovat na serveru.
const PortraitParticles = dynamic(
  () => import("@/components/common/particle-image"),
  { ssr: false },
);

// Co sekce říká, když CMS mlčí — tytéž texty, jaké tu stály natvrdo.
// Není to náhražka, je to poslední síť: prázdný blok nesmí dát prázdný hero.
const FALLBACK_PORTRAIT = {
  src: "/assets/rest/main_photo.png",
  alt: "Sabina Hudrmentová",
  width: 612,
  height: 1019,
};

// Tři řádky nadpisu, dekódované stejně, jako je dekóduje server: úsek a
// příznak zvýraznění. Tečka je součástí posledního slova — dekodér zvýrazňuje
// po slovech a Lines ji zase vyndá ven do vlastního spanu.
const FALLBACK_ROWS: MarkedLine[] = [
  [["Grafika", false]],
  [
    ["pro", false],
    ["lepší", true],
  ],
  [["výsledky.", true]],
];

const FALLBACK_SCROLL_HINT = "Objevujte posunutím";

// Čtyři ukázky, každá z jiné kolekce v public/assets/banners.
// width/height jsou skutečné rozměry souboru — next/image je potřebuje kvůli
// rezervaci místa. Karta má vlastní pevný poměr 4/5 a případný přesah ořízne.
// Počet karet je daný rozvržením (--card-index), z CMS se berou texty a fotky,
// ne počet.
const BANNERS = [
  {
    client: "Gummylife",
    claim: "Doplňky stravy",
    cta: "Zjistit víc",
    src: "/assets/banners/gummylife_banner1.png",
    width: 1440,
    height: 2560,
  },
  {
    client: "Věcicky",
    claim: "Dětská móda",
    cta: "Zjistit víc",
    src: "/assets/banners/vecicky_banner16.png",
    width: 1468,
    height: 2587,
  },
  {
    client: "Bruzek",
    claim: "Prodej nemovitostí",
    cta: "Zjistit víc",
    src: "/assets/banners/bruzek_banner6.png",
    width: 492,
    height: 874,
  },
  {
    client: "Samurai",
    claim: "Kampaň pro e-shop",
    cta: "Chci vědět víc",
    src: "/assets/banners/samurai_banner1.png",
    width: 536,
    height: 954,
  },
];

// První karta ukázek v `items` bloku `index.hero` — před ní jsou tři řádky
// nadpisu a nápověda posunu. Viz src/lib/cms/home.ts.
const CARDS_AT = 4;

// Blok `index.hero`, jak ho tvaruje src/lib/cms/home.ts. `docId` dorazí jen
// v editačním rámu Studia; na webu chybí a každá anotace vrátí prázdno.
export type HeroCopy = {
  docId?: string;
  labels?: MarkedLine[];
  labelMark?: string;
  scrollHint?: string;
  cards?: { lead?: string; label?: string; value?: string }[];
  portrait?: CmsImage | null;
  gallery?: CmsImage[] | string;
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

export default function Hero({ copy = null }: { copy?: HeroCopy | null }) {
  const containerRef = useRef<HTMLElement>(null);
  // Částicová vrstva si podle tohohle prvku měří svůj box z DOMu.
  const portraitRef = useRef<HTMLImageElement>(null);

  // Dokument zadaný jednou, ne u každé anotace zvlášť. Mimo Studio je `docId`
  // undefined a `edit(...)` vrací prázdný objekt — na web se nerozprostře nic.
  const edit = editableIn(copy?.docId ?? null);

  const rows =
    hasLines(copy?.labels) && copy.labels.length >= FALLBACK_ROWS.length
      ? copy.labels.slice(0, FALLBACK_ROWS.length)
      : FALLBACK_ROWS;
  const scrollHint = text(copy?.scrollHint, FALLBACK_SCROLL_HINT);
  const portrait = picture(copy?.portrait, FALLBACK_PORTRAIT);
  const gallery = pictures(copy?.gallery);
  // Slévá se po indexu s pevným seznamem: fotka i texty i-té karty jsou
  // i-tý obrázek sady a položka CARDS_AT + i.
  const cards = BANNERS.map((banner, index) => {
    const item = copy?.cards?.[index];
    const client = text(item?.lead, banner.client);
    const claim = text(item?.label, banner.claim);
    return {
      client,
      claim,
      cta: text(item?.value, banner.cta),
      image: picture(gallery[index], {
        src: banner.src,
        alt: `${client} — ${claim}`,
        width: banner.width,
        height: banner.height,
      }),
    };
  });

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  // Track je 160vw (100vw hero + 60vw galerie). Posun o -60vw, tedy
  // -37.5 % šířky tracku, nechá pravou část hera — tedy portrét — v záběru.
  // Headroom 0–0.12 a 0.88–1 dává oběma stranám chvíli klidu.
  const x = useTransform(scrollYProgress, [0.12, 0.88], ["0%", "-37.5%"]);

  return (
    <section ref={containerRef} className={styles.container}>
      <div className={styles.sticky}>
        <motion.div className={styles.track} style={{ x }}>
          {/* ---------- Panel 1: hero (100vw) ---------- */}
          <div className={`${styles.panel} ${styles.panelHero}`}>
            <div className={styles.content}>
              {/* Řádky jsou spany bez <br>, proto anotace `lines`: každé dítě
                  <h1> je jeden řádek a ukládá se do items.i.label. */}
              <h1
                className={styles.headline}
                {...edit.lines("items.*.label", copy?.labelMark)}
              >
                {rows.map((row, index) => (
                  <span key={index} className={styles.headlineRow}>
                    <Lines
                      lines={[row]}
                      markClass={styles.accent}
                      trailClass={styles.dot}
                    />
                  </span>
                ))}
              </h1>
            </div>

            <div className={styles.scrollHint} aria-hidden="true">
              <span className={styles.scrollDot} />
              <span className={styles.scrollLine} />
              <span className={styles.scrollLabel} {...edit("items.3.label")}>
                {scrollHint}
              </span>
            </div>

            {/* Anotace obrázku sedí na rámu, ne na <img>: částice kreslí tenhle
                soubor ještě jednou na vlastní plátno, takže „tahle fotka" je
                pro editora celý box, ne jeden z jeho dvou obrazů. */}
            <div className={styles.portrait} {...edit.image("image")}>
              <Image
                ref={portraitRef}
                src={portrait.src}
                alt={portrait.alt}
                width={portrait.width}
                height={portrait.height}
                className={styles.portraitImage}
                preload
                sizes="(max-width: 900px) 70vw, 45vw"
              />
              {/* Všechny propy jsou vypsané schválně — i ty na výchozí
                  hodnotě — aby se daly ladit, aniž by se muselo
                  dohledávat, co je default uvnitř komponenty. */}
              <PortraitParticles
                src={portrait.src}
                targetRef={portraitRef}
                className={styles.portraitParticles}
                /* Hustota a vzhled. particleCount je hlavní páka — zaokrouhlí
                   se nahoru na čtvercovou mřížku, 300 000 dá 548x548.
                   particleSize je o kus níž než dřív, protože při pětkrát
                   větším počtu se překryvy sčítají a 1,6 px už mazalo
                   detail siluety. */
                particleCount={400000}
                particleSize={0.5}
                particleOpacity={0.45}
                additive={false}
                /* Přesah plátna kolem fotky v px na každou stranu. Bez něj
                   částice na hraně plátna končí rovným řezem — nahoře
                   i po stranách. Zvedni, když mají doplout dál. */
                bleed={72}
                /* Maska */
                alphaThreshold={24}
                /* Proudění */
                speed={0.5}
                noiseScale={0.002}
                noiseStrength={0.025}
                damping={0.96}
                lifespan={320}
                /* Kurzor */
                cursorInteraction
                cursorStrength={0.02}
                cursorRadius={120}
                /* Běh a výkon */
                dpr={1.5}
                paused={false}
              />
            </div>
          </div>

          {/* ---------- Panel 2: galerie bannerů (60vw) ---------- */}
          <div className={`${styles.panel} ${styles.panelWork}`}>
            {/* .scene drží perspektivu, .stage je ten nakloněný parent —
                karty samy už žádnou rotaci nemají, takže drží jednu rovinu. */}
            <div className={styles.scene}>
              {/* Sada fotek se edituje jako celek (pořadí, výměna), popisky
                  tlačítek pod ní zvlášť — menší prvek při kliknutí vyhrává. */}
              <div className={styles.stage} {...edit.set("gallery")}>
                {cards.map((card, index) => (
                  <a
                    key={card.image.src + index}
                    className={styles.card}
                    href="#portfolio"
                    style={{ "--card-index": index } as CSSProperties}
                  >
                    <Image
                      src={card.image.src}
                      alt={card.image.alt}
                      width={card.image.width}
                      height={card.image.height}
                      className={styles.cardImage}
                      sizes="(max-width: 820px) 45vw, 18vw"
                      loading="eager"
                    />
                    <span className={styles.cardShade} aria-hidden="true" />
                    <span className={styles.cardCta}>
                      <span
                        className={styles.cardCtaLabel}
                        {...edit(`items.${CARDS_AT + index}.value`)}
                      >
                        {card.cta}
                      </span>
                      <span className={styles.cardCtaArrow} aria-hidden="true">
                        <ArrowIcon />
                      </span>
                    </span>
                  </a>
                ))}
              </div>
            </div>

            <div className={styles.galleryHint}>
              {/* Tentýž text podruhé: zrcadlo se při psaní drží zdroje nahoře. */}
              <span
                className={styles.galleryHintLabel}
                {...edit.mirror("items.3.label")}
              >
                {scrollHint}
              </span>
              <span className={styles.galleryNav}>
                <button
                  type="button"
                  className={`${styles.galleryNavButton} ${styles.isBack}`}
                  aria-label="Předchozí ukázka"
                >
                  <ArrowIcon />
                </button>
                <button
                  type="button"
                  className={styles.galleryNavButton}
                  aria-label="Další ukázka"
                >
                  <ArrowIcon />
                </button>
              </span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
