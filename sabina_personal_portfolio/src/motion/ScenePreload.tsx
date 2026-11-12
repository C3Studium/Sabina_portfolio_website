// Předehřátí 3D scény Portfolia (/projects) na pozadí.
//
// Scéna (DepthRibbon) si při připojení stáhne obrázky projektů v plné
// velikosti a kód three.js — bez předehřátí to při přechodu na stránku trhá
// nástup. Chvíli po načtení kterékoli jiné stránky, až prohlížeč nemá co
// dělat, se proto stáhne:
//   - kód stránky a scény (prefetch routy, dynamický import),
//   - seznam projektů (z dat stránky /projects) a jejich obrázky — ve stejném
//     režimu CORS jako scéna, takže je pak vezme z cache.
// Jednou za návštěvu; bez spořiče dat (Save-Data) a mimo /projects.

import { useEffect } from "react";
import { useRouter } from "next/router";

// Po načtení stránky počká (úvod a shader úvodní stránky mají přednost).
const AFTER_MS = 4000;
// Kolik obrázků se stahuje najednou.
const PARALLEL = 3;
// Stejné jako GALLERY_IN_RIBBON v projects/hero-list: obálka + 3 z galerie.
const GALLERY_IN_RIBBON = 3;

type Img = { url?: string } | null | undefined;
type ProjectData = { cover?: Img; gallery?: Img[] };

let started = false;

/** Adresy obrázků scény z dat stránky /projects (__NEXT_DATA__). */
const sourcesFrom = (html: string): string[] => {
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!match) return [];
  try {
    const data = JSON.parse(match[1]);
    const projects: ProjectData[] = data?.props?.pageProps?.content?.projects ?? [];
    return projects
      .flatMap((project) => [project.cover, ...(project.gallery ?? []).slice(0, GALLERY_IN_RIBBON)])
      .map((image) => image?.url)
      .filter((url): url is string => Boolean(url));
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
  const queue = [...new Set(sourcesFrom(await response.text()))];
  const worker = async () => {
    for (let src = queue.shift(); src; src = queue.shift()) await warmImage(src);
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
    const timer = window.setTimeout(() => {
      const run = () => {
        if (started) return;
        started = true;
        void warmProjects((path) => router.prefetch(path));
      };
      if ("requestIdleCallback" in window) idle = window.requestIdleCallback(run, { timeout: 3000 });
      else run();
    }, AFTER_MS);
    return () => {
      window.clearTimeout(timer);
      if (idle && "cancelIdleCallback" in window) window.cancelIdleCallback(idle);
    };
  }, [onProjects, router]);

  return null;
}
