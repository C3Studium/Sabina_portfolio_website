// Úvod webu na plátně opony: logo, nadpis a hlavička — vrstvy nad jedním
// plátnem a jedněmi hodinami (framer `animate(0 → END)`). Bannery v heru
// mají vlastní plátno (pod nadpisem) a připojí se ke stejným hodinám
// (clock.ts).

import { animate } from "framer-motion";
import { markIntroStart } from "./clock";
import type { Layer } from "./draw";
import { createHeader } from "./header";
import { createHeadline } from "./headline";
import { createLogo, type LogoLook } from "./logo";
import { END, real } from "./timeline";

export function createIntro(canvas: HTMLCanvasElement, look: LogoLook) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const logo = createLogo(look);
  const layers = [logo, createHeadline(look), createHeader(look, logo?.frameAt ?? null)].filter(
    (layer): layer is NonNullable<typeof layer> => Boolean(layer),
  ) as Layer[];

  let dpr = 1;
  let last = 0;
  let stopped = false;

  const draw = (t: number) => {
    last = t;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (const layer of layers) layer.draw(ctx, t);
  };

  const layout = () => {
    if (stopped) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(window.innerWidth * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);
    layers.forEach((layer) => layer.layout());
    draw(last);
  };

  layout();
  window.addEventListener("resize", layout);
  // Písmo se může dočíst až po startu — popisky a obrysy pak přeměřit.
  document.fonts?.ready.then(layout).catch(() => {});
  markIntroStart();

  const finish = () => layers.forEach((layer) => layer.finish?.());
  // Hodnota běží v čase návrhu (0 → END), trvání je skutečné (zpomalené).
  const clock = animate(0, END, { duration: real(END), ease: "linear", onUpdate: draw, onComplete: finish });

  return {
    destroy: () => {
      stopped = true;
      clock.stop();
      window.removeEventListener("resize", layout);
      layers.forEach((layer) => layer.destroy?.());
      // Bez `finish()`: když opona zmizí dřív, sundá i `data-preload` a CSS
      // prvky hlavičky už nedrží. (Ve vývoji StrictMode scénu připojí dvakrát
      // — úklid první by jinak ukázal hlavičku hned.)
    },
  };
}
