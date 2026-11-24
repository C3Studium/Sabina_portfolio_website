// Obrázky z knihovny médií (Supabase Storage) přes optimalizaci Next/Vercelu.
//
// Proč (24. 11. 2026): 3D scény (FlexCarousel, DepthRibbon), částicový portrét
// a pár <img> stahovaly originály přímo ze Supabase — úvodní stránka ~15 MB
// PNG na návštěvu, /projects ~14 MB. Supabase je navíc posílá s
// `Cache-Control: private, no-cache`, takže prohlížeč nic nedrží a každá
// návštěva stahovala znovu. Free plán Supabase (5,5 GB „cached egress")
// během pár dní přetekl.
//
// `/_next/image` vrátí zmenšený WebP/AVIF a Vercel ho drží v cache
// (next.config `minimumCacheTTL` 31 dní) — Supabase se tak ptá jednou za
// obrázek a šířku, ne při každé návštěvě. Soubory v knihovně mají v názvu
// hash, nový obrázek = nová adresa, takže dlouhá cache nevadí.
//
// Komponenta `next/image` tohle dělá sama — `mediaUrl` je pro místa, která
// obrázek načítají ručně (textury WebGL, fetch → createImageBitmap, <img>).

const SUPABASE_STORAGE = /^https:\/\/[^/]+\.supabase\.co\/storage\/v1\/object\/public\//;

/** Šířky, které `/_next/image` přijme (výchozí deviceSizes Next.js). */
const WIDTHS = [640, 750, 828, 1080, 1200, 1920, 2048, 3840];

/** Povolené kvality (next.config `images.qualities`). */
type Quality = 75 | 80;

/**
 * Adresa obrázku z knihovny médií přes `/_next/image` v dané šířce (zaokrouhleno
 * nahoru na povolenou). Cokoli jiného (soubory z /public, data:, blob:) vrátí beze změny.
 */
export function mediaUrl(src: string, width = 1080, quality: Quality = 75): string {
  if (!src || !SUPABASE_STORAGE.test(src)) return src;
  const w = WIDTHS.find((candidate) => candidate >= width) ?? WIDTHS[WIDTHS.length - 1];
  return `/_next/image?url=${encodeURIComponent(src)}&w=${w}&q=${quality}`;
}

/** Hlavička Accept pro fetch() obrázku — ať optimalizace vrátí WebP/AVIF, ne PNG. */
export const IMAGE_ACCEPT = { Accept: "image/avif,image/webp,image/*,*/*;q=0.8" };
