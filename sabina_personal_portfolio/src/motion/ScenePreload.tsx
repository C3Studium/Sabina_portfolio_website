// Předehřátí 3D scény Portfolia (/projects) na pozadí.
//
// Scéna (DepthRibbon) si při připojení stáhne obrázky projektů v plné
// velikosti a kód three.js — bez předehřátí to při přechodu na stránku trhá
// nástup. Chvíli po načtení kterékoli jiné stránky, až prohlížeč nemá co
// dělat, se proto stáhne:
//   - kód stránky a scény (prefetch routy, dynamický import),
//   - seznam projektů (z dat stránky /projects) a jejich obrázky, rovnou
//     DEKÓDOVANÉ a zmenšené na slot atlasu scény (DepthRibbon/bitmaps.ts,
//     mimo hlavní vlákno) — scéna je při příchodu jen přiloží a nahraje.
//     Na dotyku (telefon, tablet — iPhone hlásí deviceMemory jako nic)
//     a se slabou pamětí jen stažené do cache HTTP, a to ve zmenšené
//     verzi, kterou si scéna na dotyku vyžádá (lib/device.ts) — dekódované
//     bitmapy by držely desítky MB a iPhone by záložku shodil.
// Jednou za návštěvu; bez spořiče dat (Save-Data) a mimo /projects.

import { useEffect } from "react";
import { useRouter } from "next/router";
import { atlasSlot, decodeForAtlas } from "@/components/3D/DepthRibbon/bitmaps";
import { isTouchDevice, sceneImage } from "@/lib/device";

// Po načtení stránky počká (úvod a shader úvodní stránky mají přednost),
// pak ještě na klid prohlížeče (requestIdleCallback).
const AFTER_MS = 2500;
// Kolik obrázků se stahuje najednou.
const PARALLEL = 3;
// Stejné jako GALLERY_IN_RIBBON v projects/hero-list: obálka + 3 z galerie.
const GALLERY_IN_RIBBON = 3;
// Na dotyku jen jeden (GALLERY_ON_TOUCH v projects/hero-list).
const GALLERY_ON_TOUCH = 1;
// Strop položek scény (MAX_ITEMS v DepthRibbon/engine.ts).
const MAX_ITEMS = 48;

type Img = { url?: string; width?: number; height?: number } | null | undefined;
type Source = { url: string; aspect: number | null };
type ProjectData = { cover?: Img; gallery?: Img[] };

let started = false;

/** Obrázky scény z dat stránky /projects (__NEXT_DATA__), v pořadí scény. */
const sourcesFrom = (html: string): Source[] => {
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!match) return [];
  try {
    const data = JSON.parse(match[1]);
    const projects: ProjectData[] = data?.props?.pageProps?.content?.projects ?? [];
    return projects
      .flatMap((project) => [project.cover, ...(project.gallery ?? []).slice(0, isTouchDevice() ? GALLERY_ON_TOUCH : GALLERY_IN_RIBBON)])
      .filter((image): image is NonNullable<Img> => Boolean(image?.url))
      .map((image) => ({
        url: image.url as string,
        aspect: image.width && image.height ? image.width / image.height : null,
      }))
      .slice(0, MAX_ITEMS);
  } catch {
    return [];
  }
};

const warmImage = (src: string) =>
  new Promise<void>((resolve) => {
    const image = new Image();
    // Jako engine scény — jinak by cache patřila jinému režimu a stáhlo se znovu.
    image.crossOrigin = "anonymous";
    image.decoding = "async";
    image.onload = () => resolve();
    image.onerror = () => resolve();
    image.src = src;
  });

async function warmProjects(prefetch: (path: string) => Promise<void>) {
  await Promise.allSettled([prefetch("/projects"), import("@/components/3D/DepthRibbon")]);
  const response = await fetch("/projects", { credentials: "same-origin" }).catch(() => null);
  if (!response?.ok) return;
  const sources = sourcesFrom(await response.text());
  // Slot atlasu podle počtu položek — tentýž výpočet jako ve scéně.
  const slot = atlasSlot(sources.length);
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  const touch = isTouchDevice();
  const decode = !touch && (memory === undefined || memory >= 4);
  const queue = [...new Map(sources.map((source) => [source.url, source])).values()];
  const worker = async () => {
    for (let next = queue.shift(); next; next = queue.shift()) {
      if (decode) await decodeForAtlas(next.url, slot, next.aspect);
      else await warmImage(touch ? sceneImage(next.url, 640) : next.url);
    }
  };
  await Promise.all(Array.from({ length: PARALLEL }, worker));
}

export default function ScenePreload() {
  const router = useRouter();
  const onProjects = router.pathname.startsWith("/projects");

  useEffect(() => {
    if (started || onProjects) return;
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (connection?.saveData) return;
    let idle = 0;
    let calm = 0;
    // Poslední scroll — Safari nemá requestIdleCallback, tak se „klid"
    // pozná podle scrollu: načítání a parsování chunku scény nesmí
    // padnout do tahu prstem (zásek uprostřed scrollu).
    let lastScroll = 0;
    const onScroll = () => {
      lastScroll = performance.now();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    const run = () => {
      if (started) return;
      started = true;
      window.removeEventListener("scroll", onScroll);
      void warmProjects((path) => router.prefetch(path));
    };
    const whenCalm = () => {
      const wait = lastScroll + 1200 - performance.now();
      if (wait > 0) calm = window.setTimeout(whenCalm, wait);
      else run();
    };
    const timer = window.setTimeout(() => {
      if (typeof window.requestIdleCallback === "function") idle = window.requestIdleCallback(whenCalm, { timeout: 3000 });
      else whenCalm();
    }, AFTER_MS);
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(calm);
      window.removeEventListener("scroll", onScroll);
      if (idle && typeof window.cancelIdleCallback === "function") window.cancelIdleCallback(idle);
    };
  }, [onProjects, router]);

  return null;
}
