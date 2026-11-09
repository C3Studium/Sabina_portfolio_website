// Hook pro komponenty mimo plátno úvodu: `true`, jakmile hodiny úvodu
// dojdou na daný čas (čas návrhu z timeline.ts). Když úvod neběží
// (`?nopl=1`, Studio, omezený pohyb), zůstane `false` — komponenta si pak
// vezme jiný signál (typicky bránu `go`).

import { useEffect, useState, useSyncExternalStore } from "react";
import { introElapsed, onIntroStart } from "./clock";
import { real } from "./timeline";

export function useIntroAt(at: number) {
  const [reached, setReached] = useState(false);

  useEffect(() => {
    let timer = 0;
    const arm = () => {
      const elapsed = introElapsed();
      if (elapsed === null) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setReached(true), Math.max(0, real(at) - elapsed) * 1000);
    };
    arm();
    const off = onIntroStart(arm);
    return () => {
      off();
      window.clearTimeout(timer);
    };
  }, [at]);

  return reached;
}

/**
 * Běžel (nebo běží) úvod s oponou? Na serveru a bez preloaderu `false`.
 * Komponenty se podle toho řídí časy úvodu, nebo bránou `go`.
 */
export const useIntroRan = () =>
  useSyncExternalStore(
    onIntroStart,
    () => introElapsed() !== null,
    () => false,
  );
