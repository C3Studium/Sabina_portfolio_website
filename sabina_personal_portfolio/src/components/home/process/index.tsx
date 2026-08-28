import { useRef, type CSSProperties } from "react";
import Image from "next/image";
import { motion, useScroll, useTransform } from "framer-motion";
import styles from "./styles.module.scss";

// Uzly na křivce. x/y jsou zlomky celého tracku (455vw) a výšky sekce.
// Stejná čísla používá i SVG cesta níž — proto jsou tady jen jednou.
// Přeměřeno z Figmy: pozice uzlu ve screenu -> zlomek celého tracku.
// Track je 455vw (screeny 150 + 135 + 170 — poslední je nejširší).
const NODES = [
  { x: 21, y: 64 },
  { x: 37, y: 65 },
  { x: 51, y: 52 },
  { x: 68, y: 81 },
  { x: 85, y: 52 },
];

// Vlna přes celý track. viewBox 4550x1000 => 10 jednotek = 1vw.
// Uzly leží na souřadnicích (x*45.5, y*10) z NODES.
//
// DVA kvadratické segmenty na úsek, ne jeden. Jeden Q má jediný kontrolní
// bod, takže tečna na začátku i na konci segmentu je tímtéž bodem svázaná —
// nelze je zadat nezávisle a v uzlech vznikaly rohy (naměřeno až 17,4° u
// uzlu 04). Dvojice Q dává dva stupně volnosti, takže tečna z obou stran
// uzlu sedí a napojení je C1 spojité.
//
// Sklony tečen jsou z monotónní (Fritsch–Carlson) interpolace: kde sekanty
// mění znaménko, je uzel lokální extrém a tečna vyjde vodorovná. Tady jsou
// takové rovnou čtyři — vlna se v uzlech 01–04 obrací, takže nikde
// nepřestřeluje (rozsah y zůstává 380–810).
//   P0(0,800) −0.166 | P1(965,640) 0 | P2(1688,650) 0 | P3(2312,520) 0
//   P4(3110,810) 0 | P5(3845,520) −0.297 | P6(4550,380) −0.199
const WAVE_PATH = [
  "M 0 800",
  "Q 321 746, 482 693 Q 643 640, 965 640", // náběh k uzlu 01 (vrchol)
  "Q 1206 640, 1326 645 Q 1447 650, 1688 650", // k uzlu 02 (údolí)
  "Q 1896 650, 2000 585 Q 2104 520, 2312 520", // vzhůru k uzlu 03 (vrchol)
  "Q 2578 520, 2711 665 Q 2844 810, 3110 810", // dolů k uzlu 04 (údolí)
  "Q 3355 810, 3477 701 Q 3600 592, 3845 520", // vzhůru k uzlu 05
  "Q 4080 450, 4197 438 Q 4315 426, 4550 380", // doběh
].join(" ");

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path
        d="M5 12h13M12 5.5 18.5 12 12 18.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m5 12.5 4.5 4.5L19 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Ručně psaná anotace s obloučkovou šipkou — v návrhu fialová.
function Annotation({
  lines,
  className,
  flip = false,
}: {
  lines: string[];
  className?: string;
  // flip = šipka je vpravo od textu a zrcadlí se. V návrhu to tak má
  // jen krok 02, kde anotace míří zprava nahoru k paletě.
  flip?: boolean;
}) {
  return (
    <div
      className={`${styles.annotation} ${flip ? styles.annotationFlip : ""} ${
        className ?? ""
      }`}
    >
      {/* Oblouk vychází nahoře u kompozice a stáčí se dolů k textu.
          Kvadratický, aby zatáčel plynule; hrot sedí na jeho konci. */}
      <svg className={styles.annotationArrow} viewBox="0 0 118 84" fill="none">
        {/* Delší oblouk: vychází svisle nahoře a přes dlouhou zatáčku
            doběhne k textu. Kontrolní bod (10, 58) drží zakřivení až
            do poslední třetiny, takže linka není skoro rovná. */}
        <path
          d="M10 4 Q 10 58, 68 72"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        {/* Hrot: ramena spočítaná z tečny v koncovém bodě (58, 14). */}
        <path
          d="M57 61 68 72 53 76.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <p className={styles.annotationText}>
        {lines.map((line) => (
          <span key={line}>{line}</span>
        ))}
      </p>
    </div>
  );
}

function StepHead({
  number,
  label,
  children,
}: {
  number: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.stepHead}>
      <span className={styles.stepNumber}>{number}</span>
      <span className={styles.stepLabel}>{label}</span>
      <p className={styles.stepText}>{children}</p>
    </div>
  );
}

export default function Process() {
  const containerRef = useRef<HTMLElement>(null);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  // Track je 455vw, viewport 100vw => musí ujet 355vw.
  // Procenta v translate() se počítají z VLASTNÍ šířky prvku,
  // takže 355 / 455 = 78.02 %.
  const x = useTransform(scrollYProgress, [0.05, 0.95], ["0%", "-78.02%"]);

  return (
    <section ref={containerRef} className={styles.container} id="proces">
      <div className={styles.sticky}>
        <motion.div className={styles.track} style={{ x }}>
          {/* Vlna leží pod obsahem a táhne se přes celý track. */}
          <svg
            className={styles.wave}
            viewBox="0 0 4550 1000"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path
              d={WAVE_PATH}
              fill="none"
              stroke="#bec948"
              strokeWidth="2.5"
              strokeLinecap="round"
              // Bez tohohle by se tloušťka čáry roztáhla spolu s viewBoxem
              // (4550x1000 natažené na 455vw x 100svh není stejný poměr).
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          {/* Uzly jsou HTML, ne SVG — v roztaženém viewBoxu by se
              kroužky zdeformovaly na elipsy. */}
          {NODES.map((node, index) => (
            <span
              key={node.x}
              className={`${styles.node} ${
                index === NODES.length - 1 ? styles.nodeFinal : ""
              }`}
              style={{ "--node-x": `${node.x}%`, "--node-y": `${node.y}%` } as CSSProperties}
              aria-hidden="true"
            >
              {index === NODES.length - 1 ? <CheckIcon /> : null}
            </span>
          ))}

          {/* ---------- Screen 1 (150vw): úvod + krok 01 ---------- */}
          <div className={`${styles.screen} ${styles.screenOne}`}>
            <div className={styles.lead}>
              <p className={styles.eyebrow}>Jak probíhá spolupráce</p>
              <h2 className={styles.headline}>
                <span className={styles.headlineRow}>Od zadání</span>
                <span className={styles.headlineRow}>
                  k <span className={styles.accent}>výsledku</span>
                  <span className={styles.dot}>.</span>
                </span>
              </h2>
              <p className={styles.leadText}>
                Jasný a efektivní proces, který mění nápady ve funkční vizuály a
                výsledky.
              </p>

              <div className={styles.scrollHint} aria-hidden="true">
                <span className={styles.scrollDot} />
                <span className={styles.scrollLine} />
                <span className={styles.scrollFoot}>
                  <span className={styles.scrollCircle}>
                    <ArrowIcon />
                  </span>
                  Objevujte posunutím
                </span>
              </div>
            </div>

            <div className={styles.portrait}>
              <Image
                src="/assets/rest/main_photo.png"
                alt=""
                width={612}
                height={1019}
                className={styles.portraitImage}
                sizes="(max-width: 1000px) 50vw, 26vw"
              />
            </div>

            <div className={`${styles.step} ${styles.stepOne}`}>
              <StepHead number="01" label="Seznámení">
                Začínáme <strong>pochopením vašich cílů</strong>, cílové skupiny a
                toho, <strong>čeho má grafika dosáhnout</strong>.
              </StepHead>

              <div className={styles.briefComposition}>
                <div className={styles.briefCard}>
                  <p className={styles.briefTitle}>Zadání grafiky</p>
                  <dl className={styles.briefList}>
                    <div className={styles.briefRow}>
                      <dt>Cíl</dt>
                      <dd>Propagace produktu</dd>
                    </div>
                    <div className={styles.briefRow}>
                      <dt>Cílová skupina</dt>
                      <dd>Milovníci prémiové čokolády a sladkostí</dd>
                    </div>
                    <div className={styles.briefRow}>
                      <dt>Výstupy</dt>
                      <dd>Reklamní vizuál</dd>
                    </div>
                    <div className={styles.briefRow}>
                      <dt>Termín</dt>
                      <dd>3 dny</dd>
                    </div>
                  </dl>
                </div>

                {/* Fotka páru s čokoládou v public není — držím pro ni tvar. */}
                <div className={styles.briefPhotoSlot} aria-hidden="true" />

                <div className={styles.briefNote}>
                  <p className={styles.briefNoteTitle}>Zaměření na:</p>
                  <ul>
                    <li>Prémiovost</li>
                    <li>Čistý design</li>
                    <li>Chuť</li>
                  </ul>
                </div>
              </div>

              <Annotation
                className={styles.annotationOne}
                lines={["pochopení cílů", "& cílové skupiny"]}
              />
            </div>
          </div>

          {/* ---------- Screen 2 (135vw): kroky 02 a 03 ---------- */}
          <div className={`${styles.screen} ${styles.screenTwo}`}>
            <div className={`${styles.step} ${styles.stepTwo}`}>
              <StepHead number="02" label="Koncept">
                Vizuální směr vychází z barev samotného produktu. Důraz je kladen
                na <strong>kontrast, detail produktu</strong> a charakter značky.
              </StepHead>

              <div className={styles.conceptComposition}>
                <div className={styles.typeCard}>
                  <p className={styles.typeCardLabel}>Typografie</p>
                  <p className={styles.typeCardSample}>Aa</p>
                  <p className={styles.typeCardName}>Agrandir</p>
                </div>
                <ul className={styles.palette}>
                  <li style={{ background: "#9cae5c" }} />
                  <li style={{ background: "#3b2318" }} />
                  <li style={{ background: "#d9873f" }} />
                  <li style={{ background: "#f4ead2" }} />
                </ul>
              </div>

              <Annotation
                className={styles.annotationTwo}
                lines={["moodboard &", "vizuální směr"]}
                flip
              />
            </div>

            <div className={`${styles.step} ${styles.stepThree}`}>
              <StepHead number="03" label="Tvorba">
                Tvořím s jasným záměrem. <strong>Každý prvek má svou funkci</strong>{" "}
                – zaujmout, komunikovat a podpořit výsledek.
              </StepHead>

              <div className={styles.makeComposition}>
                <div className={`${styles.shot} ${styles.shotMain}`}>
                  <Image
                    src="/assets/banners/jordan_banner4.png"
                    alt="Reklamní vizuál pro značku Jordan"
                    width={305}
                    height={381}
                    sizes="18vw"
                  />
                </div>
                <div className={`${styles.shot} ${styles.shotTop}`}>
                  <Image
                    src="/assets/banners/jordan_banner1.png"
                    alt="Varianta vizuálu"
                    width={293}
                    height={366}
                    sizes="12vw"
                  />
                </div>
                <div className={`${styles.shot} ${styles.shotBottom}`}>
                  <Image
                    src="/assets/banners/jordan_banner3.png"
                    alt="Varianta vizuálu"
                    width={205}
                    height={256}
                    sizes="12vw"
                  />
                </div>
              </div>

              <Annotation
                className={styles.annotationThree}
                lines={["tvorba", "hlavního vizuálu"]}
              />
            </div>
          </div>

          {/* ---------- Screen 3 (170vw): kroky 04 a 05 ---------- */}
          <div className={`${styles.screen} ${styles.screenThree}`}>
            <div className={`${styles.step} ${styles.stepFour}`}>
              <StepHead number="04" label="Doladění">
                Na základě zpětné vazby <strong>dolaďuji detaily</strong>, dokud
                není vše připravené do finální podoby.
              </StepHead>

              <div className={styles.tuneComposition}>
                <div className={`${styles.bubble} ${styles.bubbleClient}`}>
                  <span className={`${styles.bubbleTag} ${styles.tagClient}`}>
                    Klient
                  </span>
                  <p>Můžeme zkusit dát nadpis větší?</p>
                </div>
                <div className={`${styles.bubble} ${styles.bubbleMe}`}>
                  <span className={`${styles.bubbleTag} ${styles.tagMe}`}>Já</span>
                  <p>Jasně, tady to máte změněné.</p>
                </div>
                <div className={`${styles.shot} ${styles.shotTune}`}>
                  <Image
                    src="/assets/banners/jordan_banner4.png"
                    alt="Doladěná verze vizuálu"
                    width={305}
                    height={381}
                    sizes="17vw"
                  />
                </div>
              </div>

              <Annotation
                className={styles.annotationFour}
                lines={["úpravy a finální", "doladění"]}
                flip
              />
            </div>

            <div className={`${styles.step} ${styles.stepFive}`}>
              <StepHead number="05" label="Předání">
                Finální grafiku předávám ve všech potřebných formátech,{" "}
                <strong>připravenou pro použití</strong> napříč platformami.
              </StepHead>

              <div className={styles.deliverComposition}>
                <figure className={`${styles.deliver} ${styles.deliverStory}`}>
                  <div className={styles.cropMarks}>
                    <Image
                      src="/assets/banners/jordan_banner6.png"
                      alt="Formát 1080 × 1920 px, story na výšku"
                      width={231}
                      height={410}
                      sizes="13vw"
                    />
                  </div>
                  <figcaption>
                    1080 x 1920 px
                    <br />
                    story formát
                  </figcaption>
                </figure>

                <figure className={`${styles.deliver} ${styles.deliverPortrait}`}>
                  <div className={styles.cropMarks}>
                    <Image
                      src="/assets/banners/jordan_banner1.png"
                      alt="Formát 1080 × 1350 px na výšku"
                      width={293}
                      height={366}
                      sizes="11vw"
                    />
                  </div>
                  <figcaption>
                    1080 x 1350 px
                    <br />
                    formát na výšku
                  </figcaption>
                </figure>

                <figure className={`${styles.deliver} ${styles.deliverSquare}`}>
                  <div className={styles.cropMarks}>
                    <Image
                      src="/assets/banners/jordan_banner5.png"
                      alt="Čtvercový formát 1080 × 1080 px, 1:1"
                      width={194}
                      height={194}
                      sizes="11vw"
                    />
                  </div>
                  <figcaption>
                    1080 x 1080 px
                    <br />
                    1:1 čtverec
                  </figcaption>
                </figure>
              </div>

              <Annotation
                className={styles.annotationFive}
                lines={["předání ve všech", "potřebných formátech"]}
                flip
              />
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
