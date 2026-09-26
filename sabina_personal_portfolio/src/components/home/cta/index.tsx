import Image from "next/image";
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

// Co sekce říká, když CMS mlčí — tytéž texty, jaké tu stály natvrdo.
// Zvýrazněné úseky jsou dekódované po slovech, jako to dělá server; koncová
// interpunkce („ZNAČKU," / „skutečný.") se při kreslení zase vyndá ven.
const FALLBACK = {
  eyebrow: "Začněme váš projekt",
  heading: [
    [
      ["Hledáte grafickou podporu pro svou", false],
      ["ZNAČKU,", true],
      ["e-shop nebo klienta?", false],
    ],
  ] as MarkedLine[],
  lead: [
    ["Každý projekt je jedinečný.", false],
    ["Řekněte mi o tom vašem.", true],
  ] as MarkedLine,
  action: "Nezávazná poptávka",
  status: [
    ["Odpovím do", false],
    ["24 hodin", true],
  ] as MarkedLine,
  // ZÁSTUPNÁ recenze podle návrhu — text, jméno i čísla čekají na skutečné.
  // Právě proto je v CMS: nahradí se ve Studiu, ne v kódu.
  review: {
    text: [
      [
        "Sabina úplně proměnila náš vizuální styl. Bannery nejenom skvěle vypadají, ale hlavně přinášejí výsledky. Komunikace byla bez zádrhelů, termíny sedly a",
        false,
      ],
      ["dopad byl skutečný.", true],
    ] as MarkedLine,
    name: "Lucie K.",
    role: "Brand manažerka, LUNE",
  },
  stats: [
    { value: "100+", label: "Odevzdaných bannerů" },
    { value: "50+", label: "Spokojených klientů" },
  ],
  claim: [
    [
      ["Design, který", false],
      ["spojuje,", true],
    ],
    [["mluví a prodává.", false]],
  ] as MarkedLine[],
  portrait: {
    src: "/assets/rest/main_photo.png",
    alt: "",
    width: 612,
    height: 1019,
  },
  // Perspektivní řada bannerů vpravo. Návrh má tři panely — tmavý, světlý
  // a teplý — aby se od sebe v perspektivě odlišily i bez ostrých hran.
  // Všechny tři assety jsou 4:5, ořez na povinný formát 3:4 je proto mírný.
  banners: [
    {
      src: "/assets/banners/bruzek_banner1.png",
      alt: "Bannerová kampaň pro realitní značku Bruzek",
      width: 973,
      height: 1216,
    },
    {
      src: "/assets/banners/vlnenezbozi_banner1.png",
      alt: "Bannerová kampaň pro e-shop Wooline",
      width: 1080,
      height: 1350,
    },
    {
      src: "/assets/banners/mistrpet_banner3.png",
      alt: "Bannerová kampaň pro e-shop Mistr Pet",
      width: 1080,
      height: 1350,
    },
  ],
};

// Kde v `items` bloku `index.cta` co bydlí — musí sedět na src/lib/cms/home.ts.
const AT = { lead: 0, action: 1, status: 2, review: 3, stats: 4, claim: 6 };

// Blok `index.cta`, jak ho tvaruje src/lib/cms/home.ts.
export type CtaCopy = {
  docId?: string;
  eyebrow?: string;
  heading?: { text?: string; lines?: MarkedLine[]; mark?: string };
  labels?: MarkedLine[];
  labelMark?: string;
  action?: string;
  review?: { value?: string; note?: string }[];
  stats?: { value?: string; label?: string }[];
  portrait?: CmsImage | null;
  gallery?: CmsImage[] | string;
};

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path
        d="M5 12h13M12 5.5 18.5 12 12 18.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="m12 2.6 2.9 5.9 6.5.9-4.7 4.6 1.1 6.4-5.8-3-5.8 3 1.1-6.4L2.6 9.4l6.5-.9z" />
    </svg>
  );
}

function QuoteIcon() {
  return (
    <svg viewBox="0 0 32 24" fill="currentColor" aria-hidden="true">
      <path d="M0 24V13.4C0 6 3.9 1.3 11.2 0l1.3 3.9C8.2 5.3 6 7.7 5.8 11h5.4v13H0Zm18.8 0V13.4C18.8 6 22.7 1.3 30 0l1.3 3.9c-4.3 1.4-6.5 3.8-6.7 7.1H30v13H18.8Z" />
    </svg>
  );
}

// Tenká linka z návrhu, která obtáčí kartu recenze a míří k bannerům.
// viewBox drží proporce plátna z Figmy (1165x646), takže se souřadnice
// dají odečítat přímo z návrhu. preserveAspectRatio="none" nechá kresbu
// roztáhnout přes celou sekci; non-scaling-stroke pak brání tomu, aby se
// s ní roztáhla i tloušťka čáry.
function Swoosh() {
  return (
    <svg
      className={styles.swoosh}
      viewBox="0 0 1165 646"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <g
        fill="none"
        stroke="rgba(255, 255, 255, 0.42)"
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
      >
        <path d="M306 349c-15 104 45 186 180 225" />
        <path d="M686 286c56 44 76 82 91 118 23 58 79 82 144 90" />
      </g>
      <circle cx="777" cy="404" r="4.5" fill="#bec948" />
    </svg>
  );
}

export default function Cta({ copy = null }: { copy?: CtaCopy | null }) {
  const edit = editableIn(copy?.docId ?? null);

  const labels = hasLines(copy?.labels) ? copy.labels : null;
  // Jeden popisek z bloku, nebo záloha — prázdný řádek je „nic nenapsáno".
  const line = (index: number, fallback: MarkedLine) => {
    const own = labels?.[index];
    return own && own.length ? own : fallback;
  };

  const eyebrow = text(copy?.eyebrow, FALLBACK.eyebrow);
  // Zvýraznění je deklarace pole a platí i pro zálohu, která zvýrazněný
  // úsek má — bez něj by překryv četl „ZNAČKU" jako nedeklarované zvýraznění.
  const heading = {
    mark: copy?.heading?.mark,
    lines: hasLines(copy?.heading?.lines) ? copy.heading!.lines! : FALLBACK.heading,
  };
  const mark = copy?.labelMark;
  const lead = line(AT.lead, FALLBACK.lead);
  const action = text(copy?.action, FALLBACK.action);
  const status = line(AT.status, FALLBACK.status);
  const review = {
    text: line(AT.review, FALLBACK.review.text),
    name: text(copy?.review?.[0]?.value, FALLBACK.review.name),
    role: text(copy?.review?.[0]?.note, FALLBACK.review.role),
  };
  const stats = FALLBACK.stats.map((stat, index) => ({
    value: text(copy?.stats?.[index]?.value, stat.value),
    label: text(copy?.stats?.[index]?.label, stat.label),
  }));
  const claim = FALLBACK.claim.map((row, index) => line(AT.claim + index, row));
  const portrait = picture(copy?.portrait, FALLBACK.portrait);
  const gallery = pictures(copy?.gallery);
  const banners = FALLBACK.banners.map((banner, index) => picture(gallery[index], banner));

  return (
    <section className={styles.cta} id="spoluprace">
      {/* Tmavé „jeviště" — velký kruh z návrhu, na kterém stojí fotka
          i bannery. Leží nad sdíleným gradientem, ne místo něj. */}
      <div className={styles.stage} aria-hidden="true" />
      <Swoosh />

      <div className={styles.inner}>
        {/* ---------- Text a výzva ---------- */}
        <div className={styles.intro}>
          <p className={styles.eyebrow} {...edit("title")}>
            {eyebrow}
          </p>

          <h2
            className={styles.headline}
            {...edit("headline", "text", heading.mark)}
          >
            {/* Čárka za ZNAČKOU stojí mimo zvýraznění, jako v návrhu. */}
            <Lines lines={heading.lines} markClass={styles.accent} trailClass="" />
          </h2>

          {/* Druhá věta je v návrhu tučná a na vlastním řádku — dělá to <strong>
              ve stylech, tady je to zvýrazněný úsek. */}
          <p className={styles.lead} {...edit(`items.${AT.lead}.label`, "text", mark)}>
            <Lines lines={[lead]} markTag="strong" />
          </p>

          <a className={styles.action} href="#kontakt">
            <span className={styles.actionDisc} aria-hidden="true">
              <ArrowIcon />
            </span>
            <span className={styles.actionLabel} {...edit(`items.${AT.action}.label`)}>
              {action}
            </span>
          </a>
        </div>

        {/* Anotace na <p>, ne na spanu: <p> je flex s gap a text před
            zvýrazněním je vlastní položka — obal by tu mezeru sebral. */}
        <p className={styles.status} {...edit(`items.${AT.status}.label`, "text", mark)}>
          <span className={styles.statusDot} aria-hidden="true" />
          <Lines lines={[status]} markClass={styles.accent} />
        </p>

        {/* ---------- Mockup recenze ----------
            POZOR: text, jméno i čísla jsou zástupné podle návrhu.
            Před spuštěním je nutné nahradit skutečnou referencí — ve Studiu. */}
        <figure className={styles.review}>
          <span className={styles.reviewMark} aria-hidden="true">
            <QuoteIcon />
          </span>

          <blockquote
            className={styles.reviewText}
            {...edit(`items.${AT.review}.label`, "text", mark)}
          >
            <Lines lines={[review.text]} markClass={styles.accent} trailClass="" />
          </blockquote>

          <figcaption className={styles.reviewAuthor}>
            {/* Monogram klienta místo fotky — kulisa, nikoli text k úpravě. */}
            <span className={styles.reviewAvatar} aria-hidden="true">
              Lune
            </span>
            <span className={styles.reviewName}>
              <strong {...edit(`items.${AT.review}.value`)}>{review.name}</strong>
              <span className={styles.reviewRole} {...edit(`items.${AT.review}.note`)}>
                {review.role}
              </span>
            </span>
            <span className={styles.reviewStars} aria-label="Hodnocení 5 z 5">
              {[0, 1, 2, 3, 4].map((i) => (
                <StarIcon key={i} />
              ))}
            </span>
          </figcaption>

          <div className={styles.reviewStats}>
            {stats.map((stat, index) => (
              <div key={index} className={styles.stat}>
                <span
                  className={styles.statValue}
                  {...edit(`items.${AT.stats + index}.value`)}
                >
                  {stat.value}
                </span>
                <span
                  className={styles.statLabel}
                  {...edit(`items.${AT.stats + index}.label`)}
                >
                  {stat.label}
                </span>
              </div>
            ))}
          </div>
        </figure>

        {/* ---------- Portrét ---------- */}
        <div className={styles.portrait} {...edit.image("image")}>
          <Image
            src={portrait.src}
            alt={portrait.alt}
            width={portrait.width}
            height={portrait.height}
            className={styles.portraitImage}
            sizes="(max-width: 1100px) 60vw, 28vw"
          />
        </div>

        {/* ---------- Bannery v perspektivě ---------- */}
        <div className={styles.banners} {...edit.set("gallery")}>
          {banners.map((banner, index) => (
            <div key={banner.src + index} className={styles.banner}>
              <Image
                src={banner.src}
                alt={banner.alt}
                width={banner.width}
                height={banner.height}
                sizes="(max-width: 1100px) 40vw, 20vw"
              />
            </div>
          ))}
        </div>
      </div>

      {/* ---------- Claim v patě sekce ---------- */}
      {/* Dva řádky = dvě položky, každá anotovaná zvlášť: <p> má i třetí,
          dekorativní dítě (linku), takže anotace `lines` na něm nejde. */}
      <p className={styles.claim}>
        {claim.map((row, index) => (
          <span key={index} {...edit(`items.${AT.claim + index}.label`, "text", mark)}>
            <Lines lines={[row]} markClass={styles.accent} trailClass="" />
          </span>
        ))}
        <span className={styles.claimRule} aria-hidden="true" />
      </p>
    </section>
  );
}
