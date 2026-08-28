import Image from "next/image";
import styles from "./styles.module.scss";

// Perspektivní řada bannerů vpravo. Návrh má tři panely — tmavý, světlý
// a teplý — aby se od sebe v perspektivě odlišily i bez ostrých hran.
// Všechny tři assety jsou 4:5, ořez na povinný formát 3:4 je proto mírný.
const BANNERS = [
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
];

// Patička karty recenze. ZÁSTUPNÁ čísla — čekají na skutečná.
const STATS = [
  { value: "100+", label: "Odevzdaných bannerů" },
  { value: "50+", label: "Spokojených klientů" },
];

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

export default function Cta() {
  return (
    <section className={styles.cta} id="spoluprace">
      {/* Tmavé „jeviště" — velký kruh z návrhu, na kterém stojí fotka
          i bannery. Leží nad sdíleným gradientem, ne místo něj. */}
      <div className={styles.stage} aria-hidden="true" />
      <Swoosh />

      <div className={styles.inner}>
        {/* ---------- Text a výzva ---------- */}
        <div className={styles.intro}>
          <p className={styles.eyebrow}>Začněme váš projekt</p>

          <h2 className={styles.headline}>
            Hledáte grafickou podporu pro svou{" "}
            <span className={styles.accent}>ZNAČKU</span>, e-shop nebo klienta?
          </h2>

          <p className={styles.lead}>
            Každý projekt je jedinečný.
            <strong>Řekněte mi o tom vašem.</strong>
          </p>

          <a className={styles.action} href="#kontakt">
            <span className={styles.actionDisc} aria-hidden="true">
              <ArrowIcon />
            </span>
            <span className={styles.actionLabel}>Nezávazná poptávka</span>
          </a>
        </div>

        <p className={styles.status}>
          <span className={styles.statusDot} aria-hidden="true" />
          Odpovím do <span className={styles.accent}>24 hodin</span>
        </p>

        {/* ---------- Mockup recenze ----------
            POZOR: text, jméno i čísla jsou zástupné podle návrhu.
            Před spuštěním je nutné nahradit skutečnou referencí. */}
        <figure className={styles.review}>
          <span className={styles.reviewMark} aria-hidden="true">
            <QuoteIcon />
          </span>

          <blockquote className={styles.reviewText}>
            Sabina úplně proměnila náš vizuální styl. Bannery nejenom skvěle
            vypadají, ale hlavně přinášejí výsledky. Komunikace byla bez
            zádrhelů, termíny sedly a{" "}
            <span className={styles.accent}>dopad byl skutečný</span>.
          </blockquote>

          <figcaption className={styles.reviewAuthor}>
            <span className={styles.reviewAvatar} aria-hidden="true">
              Lune
            </span>
            <span className={styles.reviewName}>
              <strong>Lucie K.</strong>
              <span className={styles.reviewRole}>Brand manažerka, LUNE</span>
            </span>
            <span className={styles.reviewStars} aria-label="Hodnocení 5 z 5">
              {[0, 1, 2, 3, 4].map((i) => (
                <StarIcon key={i} />
              ))}
            </span>
          </figcaption>

          <div className={styles.reviewStats}>
            {STATS.map((stat) => (
              <div key={stat.label} className={styles.stat}>
                <span className={styles.statValue}>{stat.value}</span>
                <span className={styles.statLabel}>{stat.label}</span>
              </div>
            ))}
          </div>
        </figure>

        {/* ---------- Portrét ---------- */}
        <div className={styles.portrait}>
          <Image
            src="/assets/rest/main_photo.png"
            alt=""
            width={612}
            height={1019}
            className={styles.portraitImage}
            sizes="(max-width: 1100px) 60vw, 28vw"
          />
        </div>

        {/* ---------- Bannery v perspektivě ---------- */}
        <div className={styles.banners}>
          {BANNERS.map((banner) => (
            <div key={banner.src} className={styles.banner}>
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
      <p className={styles.claim}>
        <span>
          Design, který <span className={styles.accent}>spojuje</span>,
        </span>
        <span>mluví a prodává.</span>
        <span className={styles.claimRule} aria-hidden="true" />
      </p>
    </section>
  );
}
