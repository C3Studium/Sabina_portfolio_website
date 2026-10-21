// Opona při prvním načtení — SCÉNA Sabiny. Mechaniku dělá engine z knihovny.
//
// Engine drží stránku schovanou od prvního snímku (`data-preload`
// z `_document`), tiká hodiny s náhodnými zastávkami, zastaví Lenis, otevře
// bránu (`ground` → `go`) a na konci nad stránkou otevře okno — obdélník
// rámečku, který tahle scéna označí přes `registerWindow`. Na editační ploše
// Studia a s `?nopl=1` v adrese se opona přeskočí.
//
// Scéna je PRŮHLEDNÁ: pod ní prosvítá shader, který web má jako podklad. Ve
// středu stojí rámeček se jménem stránky (z něj se stane okno), vlevo dole
// se píše jméno po znacích, vpravo dole běží procenta a po spodní hraně
// proužek. V poslední vteřině rámeček naroste a ostatní se ztiší; při
// otevírání okna scéna zhasne.
//
// Zápis procent a proužku jde mimo render (`useProgressRef`): mění se každý
// snímek a překreslovat kvůli tomu celou oponu by bylo zbytečné.

import { Preloader as PreloaderEngine, useProgressRef } from "@c3studium/valecms/motion";
import type { PreloaderSceneProps } from "@c3studium/valecms/motion";

import { nameFor } from "./names";
import styles from "./Preloader.module.scss";

const EYEBROW = "Grafika pro lepší výsledky";
const NAME = "Sabina Hudrmentová";

// Každý znak je vlastní prvek, aby se dal napsat postupně. Zpoždění jde
// inline, protože ho určuje pořadí znaku a CSS ho nespočítá.
function Chars({ text, className, from, step }: { text: string; className: string; from: number; step: number }) {
  return (
    <span className={className}>
      {text.split("").map((ch, index) => (
        <span key={index} className={styles.ch} style={{ animationDelay: `${from + index * step}s` }}>
          {ch === " " ? " " : ch}
        </span>
      ))}
    </span>
  );
}

function Marks() {
  return (
    <>
      <span className={styles.mark} data-corner="tl" />
      <span className={styles.mark} data-corner="tr" />
      <span className={styles.mark} data-corner="br" />
      <span className={styles.mark} data-corner="bl" />
    </>
  );
}

function Scene({ phase, progress, name, registerWindow }: PreloaderSceneProps) {
  const pct = useProgressRef<HTMLSpanElement>(progress, (el, v) => {
    el.textContent = `${Math.round(v)} %`;
  });
  const bar = useProgressRef<HTMLSpanElement>(progress, (el, v) => {
    el.style.transform = `scaleX(${v / 100})`;
  });

  return (
    <div className={styles.scene} data-phase={phase}>
      {/* Z tohohle rámečku se stane okno, kterým se stránka odhalí. */}
      <div className={styles.frame} ref={registerWindow}>
        <Marks />
        <span className={styles.frameName}>{name ?? "Portfolio"}</span>
      </div>

      <p className={styles.word}>
        <Chars text={EYEBROW} className={styles.eyebrow} from={0.15} step={0.014} />
        <Chars text={NAME} className={styles.name} from={0.3} step={0.03} />
      </p>

      <p className={styles.pct}>
        <span ref={pct} />
      </p>

      <div className={styles.bar}>
        <span className={styles.fill} ref={bar} />
      </div>
    </div>
  );
}

export default function Preloader() {
  // `duration` jsou milisekundy hodin; okno pak trvá 1,25 s. Tlumený pohyb
  // řeší engine (kratší hodiny, okno bez prolnutí).
  return (
    <PreloaderEngine
      scene={Scene}
      duration={4200}
      nameFor={nameFor}
      reveal={{ frameClassName: styles.revealFrame }}
    />
  );
}
