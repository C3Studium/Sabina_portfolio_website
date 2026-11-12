// Přechod mezi stránkami — PROLNUTÍ se jménem stránky. Mechaniku dělá engine
// z knihovny: zachytí klik na vnitřní odkaz, nechá starou stránku odjet,
// vymění routu neviděně, počká na vykreslení nové stránky a prolne ji
// zpátky (`reveal.mode: 'fade'`). Kdyby stránka nedorazila do 10 s, načte
// ji prohlížeč sám.
//
// Bez závoje: stará stránka se rozplyne, uprostřed vyjede po písmenech jméno
// cílové stránky (tenké verzálky jako nadpisy webu), pod ním se nakreslí
// zelená linka a kolem se tahem pera nakreslí tři malé tvary z „konstrukce"
// webu (kruh, čtverec, trojúhelník) s čárkovanými vodítky. S příjezdem nové
// stránky jméno i tvary odplují nahoru a zhasnou. Hlavička stojí (je na všech
// stránkách stejná). Vzhled je v PageTransition.module.scss.
//
// Co se nezachytí: odkaz ven, `target="_blank"`, modifikátor, stejná
// stránka, kotvy (`#sluzby`), cokoli s `data-no-veil` a klik, který už někdo
// zpracoval — třeba tlačítko kontaktu, které otevírá modál.

import { useState, type CSSProperties } from "react";
import { PageVeil, type VeilSceneProps } from "@c3studium/valecms/motion";

import styles from "./PageTransition.module.scss";

/** Začátek přechodu na jinou stránku — scény ho mohou použít na vlastní
 *  odchod (DepthRibbon odjede do přehledu). */
export const PAGE_LEAVE_EVENT = "page:leave";

// Stránky s vlastním odchodem scény (Portfolio — 3D dráha odjede do odstupu):
// přechod z nich dá scéně čas (TIMES_SCENE) a jméno s tvary nastoupí až po
// ní (`html[data-leave-scene]`, styles).
const SCENE_PAGES = ["/projects"];
const LEAVE_ATTR = "data-leave-scene";
// ms: delší odchod (stránka zhasne až od ~0,9 s), dobrzdění pro jméno.
const TIMES_SCENE = { cover: 1450, walk: 80, final: 320 };

// ms: odchod staré stránky (jméno se mezitím postaví), nejkratší pauza,
// dobrzdění; s prolnutí nové. Dohromady drží scénu nejméně ~0,98 s — jméno
// (i dlouhé), linka i tvary stihnou dojet, než odplují.
const TIMES = { cover: 700, walk: 80, final: 200, reveal: 0.75 };
// Rozestup písmen jména (s): nejvýš 35 ms, u dlouhého jména kratší, aby
// celý nástup písmen trval nejvýš ~0,26 s.
const LETTER_STAGGER = { max: 0.035, total: 0.26 };

/** Jméno cílové stránky uprostřed přechodu. Projekt má jen slug (bez
 *  diakritiky), proto obecně „Případová studie". Jinde bez jména. */
const nameFor = (path: string): string | null => {
  const clean = path.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  if (clean === "/") return "Úvod";
  if (clean === "/projects") return "Portfolio";
  if (clean.startsWith("/projects/")) return "Případová studie";
  if (clean === "/about") return "O mně";
  return null;
};

// Tři tvary, každý ve vlastním SVG přivázaném ke kraji jména (styles:
// .at-*), aby nepřekryly dlouhé jméno. Kreslí se tahem pera v pořadí.
const SHAPES = [
  {
    at: "top",
    d: "0.12s",
    body: (
      <>
        <path className={styles.guide} d="M2 50h96M50 2v96" />
        <circle className={styles.stroke} cx="50" cy="50" r="26" pathLength={1} />
        <circle className={styles.dot} cx="50" cy="24" r="3" />
      </>
    ),
  },
  {
    at: "right",
    d: "0.2s",
    body: (
      <>
        <path className={styles.guide} d="M2 50h96M50 2v96" />
        <rect className={styles.stroke} x="28" y="28" width="44" height="44" pathLength={1} />
        <circle className={styles.dot} cx="72" cy="28" r="3" />
      </>
    ),
  },
  {
    at: "bottom",
    d: "0.28s",
    body: (
      <>
        <path className={styles.guide} d="M5 66h90M50 20v76" />
        <path className={styles.stroke} d="M50 28l22 38H28z" pathLength={1} />
        <circle className={styles.dot} cx="28" cy="66" r="3" />
      </>
    ),
  },
] as const;

function Shapes() {
  return (
    <>
      {SHAPES.map((shape) => (
        <svg
          key={shape.at}
          className={`${styles.shape} ${styles[`at-${shape.at}`]}`}
          viewBox="0 0 100 100"
          fill="none"
          style={{ "--d": shape.d } as CSSProperties}
          aria-hidden="true"
        >
          {shape.body}
        </svg>
      ))}
    </>
  );
}

function Scene({ phase, name }: VeilSceneProps) {
  const letters = Array.from(name ?? "");
  return (
    <div className={styles.veil} data-phase={phase} aria-hidden="true">
      {name ? (
        <div
          className={styles.stage}
          style={
            {
              "--n": letters.length,
              "--step": `${Math.min(LETTER_STAGGER.max, LETTER_STAGGER.total / Math.max(letters.length, 1)).toFixed(4)}s`,
            } as CSSProperties
          }
        >
          <Shapes />
          <p className={styles.name}>
            {letters.map((ch, i) => (
              <span key={i} className={styles.letter} style={{ "--i": i } as CSSProperties}>
                {ch === " " ? " " : ch}
              </span>
            ))}
          </p>
          <span className={styles.rule} />
        </div>
      ) : null}
    </div>
  );
}

export default function PageTransition() {
  // Odkud se odchází — z adresy v okamžiku kliku (komponenta je vrstva nad
  // stránkami a při změně routy se nepřekresluje, router by vrátil starou
  // cestu). Stav se nastaví spolu s fází `cover`, engine si časy přečte
  // z props už s ním.
  const [fromScene, setFromScene] = useState(false);
  const times = fromScene ? TIMES_SCENE : TIMES;
  return (
    <PageVeil
      scene={Scene}
      nameFor={nameFor}
      onBegin={() => {
        const scene = SCENE_PAGES.includes(window.location.pathname.replace(/\/+$/, "") || "/");
        setFromScene(scene);
        if (scene) document.documentElement.setAttribute(LEAVE_ATTR, "");
        window.dispatchEvent(new Event(PAGE_LEAVE_EVENT));
      }}
      onFinish={() => {
        setFromScene(false);
        document.documentElement.removeAttribute(LEAVE_ATTR);
      }}
      cover={times.cover}
      walk={times.walk}
      final={times.final}
      reveal={{ mode: "fade", duration: TIMES.reveal, ease: [0.22, 1, 0.36, 1] }}
      reduced={{ cover: 150, walk: 0, final: 0, reveal: { duration: 0.2 } }}
    />
  );
}
