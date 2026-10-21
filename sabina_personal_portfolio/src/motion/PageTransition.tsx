// Přechod mezi stránkami — varianta Default (scéna). Mechaniku dělá engine
// z knihovny: zachytí klik na vnitřní odkaz, nechá starou stránku odjet,
// vymění routu neviděně pod závojem, počká na vykreslení nové stránky a
// prolne ji zpátky (`reveal.mode: 'fade'`). Kdyby stránka nedorazila do 10 s,
// načte ji prohlížeč sám.
//
// Co se nezachytí: odkaz ven, `target="_blank"`, modifikátor, stejná
// stránka, kotvy (`#sluzby`), cokoli s `data-no-veil` a klik, který už někdo
// zpracoval — třeba tlačítko kontaktu, které otevírá modál.

import { PageVeil } from "@c3studium/valecms/motion";
import type { VeilSceneProps } from "@c3studium/valecms/motion";

import styles from "./PageTransition.module.scss";

function Scene({ phase }: VeilSceneProps) {
  return <div className={styles.veil} data-phase={phase} />;
}

export default function PageTransition() {
  // Časy v ms: zakrytí, nejkratší držení, dojezd; pak prolnutí stránky.
  return <PageVeil scene={Scene} cover={350} walk={250} final={100} reveal={{ mode: "fade", duration: 0.45 }} />;
}
