// Přechod mezi stránkami — SCÉNA Sabiny. Mechaniku dělá engine z knihovny.
//
// Engine zachytí klik na vnitřní odkaz, nechá starou stránku odjet, vymění
// routu NEVIDĚNĚ pod závojem, počká, až je nová stránka opravdu vykreslená,
// a odhalí ji oknem — obdélníkem rámečku, který tahle scéna označí přes
// `registerWindow`. Kdyby stránka nedorazila do 10 s, závoj to vzdá a načte
// ji prohlížeč sám.
//
// Co se nezachytí: odkaz ven, `target="_blank"`, modifikátor, stejná
// stránka, kotvy (`#sluzby`), cokoli s `data-no-veil` a klik, který už někdo
// zpracoval — třeba tlačítko kontaktu, které otevírá modál.
//
// Stejná řeč jako opona: průhledný ztmavený podklad a rámeček se jménem
// cíle, který v poslední fázi naroste a stane se oknem.

import { PageVeil } from "@c3studium/valecms/motion";
import type { VeilSceneProps } from "@c3studium/valecms/motion";

import { nameFor } from "./names";
import styles from "./PageTransition.module.scss";

function Scene({ phase, name, registerWindow }: VeilSceneProps) {
  return (
    <div className={styles.scene} data-phase={phase}>
      {/* Z tohohle rámečku se stane okno, kterým se nová stránka odhalí. */}
      <div className={styles.frame} ref={registerWindow}>
        <span className={styles.mark} data-corner="tl" />
        <span className={styles.mark} data-corner="tr" />
        <span className={styles.mark} data-corner="br" />
        <span className={styles.mark} data-corner="bl" />
        {name ? <span className={styles.frameName}>{name}</span> : null}
      </div>
    </div>
  );
}

export default function PageTransition() {
  return <PageVeil scene={Scene} nameFor={nameFor} reveal={{ frameClassName: styles.revealFrame }} />;
}
