import { useRef, type CSSProperties } from "react";
import Image from "next/image";
import dynamic from "next/dynamic";
import { motion, useScroll, useTransform } from "framer-motion";
import styles from "./styles.module.scss";

// Sahá na WebGL a na 2D canvas kvůli getImageData, takže se nesmí
// renderovat na serveru.
const PortraitParticles = dynamic(
  () => import("@/components/common/particle-image"),
  { ssr: false },
);

// Čtyři ukázky, každá z jiné kolekce v public/assets/banners.
// width/height jsou skutečné rozměry souboru — next/image je potřebuje kvůli
// rezervaci místa. Karta má vlastní pevný poměr 4/5 a případný přesah ořízne.
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

export default function Hero() {
  const containerRef = useRef<HTMLElement>(null);
  // Částicová vrstva si podle tohohle prvku měří svůj box z DOMu.
  const portraitRef = useRef<HTMLImageElement>(null);

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
              <h1 className={styles.headline}>
                <span className={styles.headlineRow}>Grafika</span>
                <span className={styles.headlineRow}>
                  pro<span className={styles.accent}>lepší</span>
                </span>
                <span className={styles.headlineRow}>
                  <span className={styles.accent}>výsledky</span>
                  <span className={styles.dot}>.</span>
                </span>
              </h1>
            </div>

            <div className={styles.scrollHint} aria-hidden="true">
              <span className={styles.scrollDot} />
              <span className={styles.scrollLine} />
              <span className={styles.scrollLabel}>Objevujte posunutím</span>
            </div>

            <div className={styles.portrait}>
              <Image
                ref={portraitRef}
                src="/assets/rest/main_photo.png"
                alt="Sabina Hudrmentová"
                width={612}
                height={1019}
                className={styles.portraitImage}
                preload
                sizes="(max-width: 900px) 70vw, 45vw"
              />
              {/* Všechny propy jsou vypsané schválně — i ty na výchozí
                  hodnotě — aby se daly ladit, aniž by se muselo
                  dohledávat, co je default uvnitř komponenty. */}
              <PortraitParticles
                src="/assets/rest/main_photo.png"
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
              <div className={styles.stage}>
                {BANNERS.map((banner, index) => (
                  <a
                    key={banner.src}
                    className={styles.card}
                    href="#portfolio"
                    style={{ "--card-index": index } as CSSProperties}
                  >
                    <Image
                      src={banner.src}
                      alt={`${banner.client} — ${banner.claim}`}
                      width={banner.width}
                      height={banner.height}
                      className={styles.cardImage}
                      sizes="(max-width: 820px) 45vw, 18vw"
                      loading="eager"
                    />
                    <span className={styles.cardShade} aria-hidden="true" />
                    <span className={styles.cardCta}>
                      <span className={styles.cardCtaLabel}>{banner.cta}</span>
                      <span className={styles.cardCtaArrow} aria-hidden="true">
                        <ArrowIcon />
                      </span>
                    </span>
                  </a>
                ))}
              </div>
            </div>

            <div className={styles.galleryHint}>
              <span className={styles.galleryHintLabel}>Objevujte posunutím</span>
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
