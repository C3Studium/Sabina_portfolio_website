import Image from "next/image";
import styles from "./styles.module.scss";

// POZOR: obsah karet je PŘEVZATÝ Z NÁVRHU a je zástupný — jazyková
// úroveň, certifikát i rozsah zkušeností jsou konkrétní tvrzení o Sabině,
// která nemám jak ověřit. Před spuštěním je nutné je nahradit skutečnými.
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
    subtitle: null,
    body: "Kampaně pro e-shopy a značky z oblasti krásy, módy a lifestylu napříč Evropou.",
  },
  {
    icon: "certificate",
    art: "rosette",
    label: "Certifikáty",
    title: "Google Digital Garage",
    subtitle: null,
    body: "Dokončený certifikát digitálního marketingu — strategie, SEO, reklama a analytika.",
  },
];

const PANELS = [
  {
    icon: "cap",
    marker: "dot",
    label: "Kurzy",
    title: "Neustálé vzdělávání",
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
    title: "Co umím nejlíp",
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

export default function AboutMe() {
  return (
    <section className={styles.about}>
      {/* Světlý kruh vpravo a ztmavení k pravému dolnímu rohu. */}
      <div className={styles.stage} aria-hidden="true" />

      {/* ---------- Levá lišta ---------- */}
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
        <p className={styles.eyebrow}>Pojďme se poznat</p>

        <h1 className={styles.headline}>
          <span>Něco</span>
          <span className={styles.accent}>o mně</span>
        </h1>

        <span className={styles.introRule} aria-hidden="true" />

        <p className={styles.lead}>
          <span>Měním nápady ve vizuály,</span>
          <span>
            které <span className={styles.accent}>spojují, mluví</span>
          </span>
          <span>
            a <span className={styles.accent}>prodávají</span>.
          </span>
        </p>
      </div>

      {/* ---------- Portrét ---------- */}
      <div className={styles.portrait}>
        <Image
          src="/assets/rest/main_photo.png"
          alt="Sabina Hudrmentová"
          width={612}
          height={1019}
          className={styles.portraitImage}
          sizes="(max-width: 1100px) 70vw, 56vw"
          priority
        />
      </div>

      {/* ---------- Karty ---------- */}
      <div className={styles.cards}>
        <div className={styles.rowTop}>
          {HIGHLIGHTS.map((item) => (
            <article key={item.label} className={styles.card}>
              <span className={styles.cardArt} aria-hidden="true">
                <ArtIcon name={item.art} />
              </span>
              <span className={styles.cardBadge} aria-hidden="true">
                <BadgeIcon name={item.icon} />
              </span>
              <p className={styles.cardLabel}>{item.label}</p>
              <h2 className={styles.cardTitle}>{item.title}</h2>
              {item.subtitle && (
                <p className={styles.cardSubtitle}>{item.subtitle}</p>
              )}
              <p className={styles.cardBody}>{item.body}</p>
            </article>
          ))}
        </div>

        <div className={styles.rowBottom}>
          {PANELS.map((panel) => (
            <article
              key={panel.label}
              className={`${styles.card} ${styles.panel}`}
            >
              <div className={styles.panelText}>
                <span className={styles.cardBadge} aria-hidden="true">
                  <BadgeIcon name={panel.icon} />
                </span>
                <p className={styles.cardLabel}>{panel.label}</p>
                <h2 className={styles.cardTitle}>{panel.title}</h2>
                <p className={styles.cardBody}>{panel.body}</p>
              </div>

              <ul className={styles.tags}>
                {panel.tags.map((tag) => (
                  <li key={tag} className={styles.tag}>
                    <span className={styles.tagMarker} aria-hidden="true">
                      <MarkerIcon name={panel.marker} />
                    </span>
                    {tag}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
