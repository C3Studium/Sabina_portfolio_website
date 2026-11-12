// Přechod mezi stránkami — PROLNUTÍ. Mechaniku dělá engine z knihovny:
// zachytí klik na vnitřní odkaz, nechá starou stránku odjet, vymění routu
// neviděně, počká na vykreslení nové stránky a prolne ji zpátky
// (`reveal.mode: 'fade'`). Kdyby stránka nedorazila do 10 s, načte ji
// prohlížeč sám.
//
// Bez závoje: scéna je prázdná, mezi stránkami je vidět jen podklad webu.
// Stará stránka se rozplyne s nepatrným zmenšením, nová se prolne se
// zklidněním z mírně většího měřítka; hlavička stojí (je na všech stránkách
// stejná). Vzhled je v PageTransition.module.scss.
//
// Co se nezachytí: odkaz ven, `target="_blank"`, modifikátor, stejná
// stránka, kotvy (`#sluzby`), cokoli s `data-no-veil` a klik, který už někdo
// zpracoval — třeba tlačítko kontaktu, které otevírá modál.

import { PageVeil } from "@c3studium/valecms/motion";

import styles from "./PageTransition.module.scss";

// Prázdná scéna — průhledný obal jen kvůli třídě (globální pravidla prolnutí).
function Scene() {
  return <div className={styles.veil} aria-hidden="true" />;
}

// ms: odchod staré stránky, nejkratší pauza, dobrzdění; s prolnutí nové.
const TIMES = { cover: 480, walk: 60, final: 0, reveal: 0.65 };

export default function PageTransition() {
  return (
    <PageVeil
      scene={Scene}
      cover={TIMES.cover}
      walk={TIMES.walk}
      final={TIMES.final}
      reveal={{ mode: "fade", duration: TIMES.reveal, ease: [0.22, 1, 0.36, 1] }}
      reduced={{ cover: 150, walk: 0, final: 0, reveal: { duration: 0.2 } }}
    />
  );
}
