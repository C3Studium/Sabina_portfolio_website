// Obrázky 3D scény Portfolia dekódované předem — mimo hlavní vlákno.
//
// Scéna skládá obrázky do jednoho atlasu (engine.ts, buildAtlas). Kdyby je
// dekódovala až po příchodu na /projects, každý obrázek by se na hlavním
// vlákně rozbalil, zmenšil do slotu a atlas by se celý znovu nahrál do GPU —
// nástup by trhal. Tady se obrázek stáhne, dekóduje a rovnou zmenší na
// velikost slotu přes `createImageBitmap` (prohlížeč to dělá na pozadí);
// atlas pak jen přiloží hotové bitmapy a nahraje se jednou.
//
// Sdílená cache na celou návštěvu: plní ji předehřátí (motion/ScenePreload)
// už na jiných stránkách a při návratu na Portfolio je všechno hned.
// Bez three.js — modul je malý a smí se načíst kdekoli.

export type Decoded = {
  bitmap: ImageBitmap;
  /** Skutečný poměr stran souboru (šířka / výška), když ho známe. */
  aspect: number | null;
};

/** Strop atlasu (engine bere menší z tohohle a limitu GPU). */
export const ATLAS_LIMIT = 4096;

/** Velikost slotu atlasu pro `count` obrázků — totéž počítá engine. */
export const atlasSlot = (count: number, limit = ATLAS_LIMIT) => {
  const n = Math.max(count, 1);
  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);
  return Math.max(128, Math.min(1024, Math.floor(limit / Math.max(cols, rows))));
};

const cache = new Map<string, { promise: Promise<Decoded | null>; value?: Decoded | null }>();
const keyOf = (src: string, slot: number) => `${slot}\u0000${src}`;

const supported = () => typeof window !== "undefined" && typeof window.createImageBitmap === "function";

async function decode(src: string, slot: number, aspect: number | null): Promise<Decoded | null> {
  // Stejný režim jako <img crossOrigin="anonymous"> ve scéně — sdílí cache HTTP.
  const response = await fetch(src, { mode: "cors", credentials: "omit" });
  if (!response.ok) return null;
  const blob = await response.blob();
  // Bez známého poměru (CMS ho nemá) se dekóduje celý — poměr se z něj přečte.
  if (!aspect) {
    const full = await createImageBitmap(blob);
    const ratio = full.width / Math.max(full.height, 1);
    const bitmap = await createImageBitmap(full, { resizeWidth: slot, resizeHeight: slot, resizeQuality: "high" });
    full.close();
    return { bitmap, aspect: ratio };
  }
  // Celý obrázek přes celý čtvercový slot (bez ořezu) — poměr vrátí karta.
  const bitmap = await createImageBitmap(blob, { resizeWidth: slot, resizeHeight: slot, resizeQuality: "high" });
  return { bitmap, aspect };
}

/**
 * Dekódovaný obrázek pro slot dané velikosti. Jednou na adresu a velikost;
 * `null`, když to nejde (starý prohlížeč, CORS, chyba) — engine si ho pak
 * načte postaru přes <img>.
 */
export function decodeForAtlas(src: string, slot: number, aspect: number | null = null): Promise<Decoded | null> {
  const key = keyOf(src, slot);
  const hit = cache.get(key);
  if (hit) return hit.promise;
  if (!supported()) return Promise.resolve(null);
  const entry: { promise: Promise<Decoded | null>; value?: Decoded | null } = {
    promise: decode(src, slot, aspect)
      .catch(() => null)
      .then((value) => {
        entry.value = value;
        return value;
      }),
  };
  cache.set(key, entry);
  return entry.promise;
}

/** Hotový obrázek hned (bez čekání), nebo `undefined`, když ještě není. */
export function decodedNow(src: string, slot: number): Decoded | null | undefined {
  return cache.get(keyOf(src, slot))?.value;
}
