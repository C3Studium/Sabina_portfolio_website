// Telefon / tablet (dotyk) — rozpočet paměti a GPU pro 3D scény.
//
// iPhone má přísný limit paměti plátek a celé záložky: stránka, která na
// počítači jede, ho na telefonu shodí („Při načítání stránky došlo
// k problému" a znovunačtení). Scény se proto na dotyku drží menší: menší
// atlasy, nižší rozlišení plátna, obrázky přes optimalizátor Nextu
// a uvolnění kontextu WebGL hned, ne až v klidu.
//
// Jen pro kód v prohlížeči (efekty, enginy) — při renderu na serveru vrací
// „není dotyk".

/** Zařízení s dotykem jako hlavním ukazatelem (telefon, tablet). */
export const isTouchDevice = () =>
  typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;

// Šířky musí být v `deviceSizes` Nextu (výchozí 640, 750, 828, 1080, …)
// a kvalita v `images.qualities` (next.config.ts: 75, 80).
const NEXT_WIDTHS = [640, 750, 828, 1080, 1200, 1920, 2048, 3840];

/**
 * Obrázek pro 3D scénu na dotyku: přes optimalizátor Nextu zmenšený na
 * `width` (WebP, desítky kB místo PNG o několika MB). Jinde beze změny.
 */
export const sceneImage = (src: string, width = 750) => {
  if (!isTouchDevice() || !src || /^(data:|blob:)|\/_next\/image/.test(src)) return src;
  const w = NEXT_WIDTHS.find((size) => size >= width) ?? 3840;
  return `/_next/image?url=${encodeURIComponent(src)}&w=${w}&q=75`;
};

/**
 * Uvolní kontext WebGL: na dotyku hned (paměť), jinde až v klidu — uvolnění
 * stojí desítky ms a odchod běží během přechodu stránek.
 */
export const releaseContext = (lose: () => void) => {
  if (isTouchDevice()) return lose();
  if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(lose, { timeout: 2500 });
  else setTimeout(lose, 1500);
};
