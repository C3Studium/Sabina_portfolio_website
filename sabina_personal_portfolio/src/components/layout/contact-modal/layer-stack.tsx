// Vrstvy banneru v uhlovém sloupci kontaktního modálu: jeden banner
// rozložený na skupiny jako ve Figmě (lib/banner-layers). Vrstvy stojí
// svisle, natočené, za sebou jako v inspektoru case study. Při otevření
// se rozestoupí; pak běží drobná smyčka — zelený rám každé vrstvy se
// „kreslí" (dotáhne, chvíli drží, smaže se) a celý stoh se pomalu kolébá.
//
// Výjimka z pravidla „vrstvy jen v case study" — modál si ji vyžádal
// uživatel. Jmenovky jsou obecné názvy skupin, žádná písma ani barvy (NDA).
//
// Rozestup vrstev je v CSS (--stack-gap podle rozvržení); rozestoupení je
// přechod `transform`, spuštěný snímek po vykreslení (data-spread).

import { useEffect, useState, type CSSProperties } from "react";
import { splitGrouped, type GroupedSplit } from "@/lib/banner-layers";
import styles from "./layer-stack.module.scss";

const BANNER = "/assets/banners/gummylife_banner2.png";

export default function LayerStack() {
  const [split, setSplit] = useState<GroupedSplit | null>(null);
  const [spread, setSpread] = useState(false);

  useEffect(() => {
    let alive = true;
    splitGrouped(BANNER).then((result) => {
      if (alive) setSplit(result);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Vrstvy nejdřív stojí na sobě, o snímek později se rozestoupí.
  useEffect(() => {
    if (!split) return;
    const frame = requestAnimationFrame(() => requestAnimationFrame(() => setSpread(true)));
    return () => cancelAnimationFrame(frame);
  }, [split]);

  const layers = split?.layers ?? [];

  return (
    <div className={styles.stack} data-spread={spread || undefined} aria-hidden="true">
      <div className={styles.rig}>
        {layers.map((layer, i) => (
          <div
            key={layer.name}
            className={styles.layer}
            data-kind={layer.kind}
            style={{ "--i": i } as CSSProperties}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- blob z canvasu, next/image ho neumí */}
            <img src={layer.url} alt="" draggable={false} />
            {/* Rám vrstvy, který se ve smyčce kreslí (pathLength 1). */}
            <svg className={styles.frame} viewBox="0 0 100 100" preserveAspectRatio="none">
              <rect x="0" y="0" width="100" height="100" pathLength={1} vectorEffect="non-scaling-stroke" />
            </svg>
            <span className={styles.label}>{layer.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
