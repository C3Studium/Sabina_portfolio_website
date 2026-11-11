// Barvy webu pro kód, který kreslí sám (plátno, WebGL, SVG atributy).
// Stejné hodnoty jako CSS proměnné v styles/system/_colors.scss
// (--snow, --green, --charcoal) — měnit obojí naráz.
//
// Text je jen sněhový nebo zelený; uhlová jen na světlém podkladu.

/** Sněhově bílá (studená, do světle modré) — text na tmavém podkladu. */
export const SNOW = "#f2f7ff";
/** Složky RGB sněhové pro rgba(): `rgba(${SNOW_RGB}, 0.9)`. */
export const SNOW_RGB = "242, 247, 255";

/** Zelený akcent. */
export const ACCENT = "#bec948";
/** Složky RGB zelené. */
export const ACCENT_RGB = "190, 201, 72";

/** Uhlová — černá do modro-šedé; jen na světlém podkladu. */
export const INK = "#161b22";
/** Složky RGB uhlové. */
export const INK_RGB = "22, 27, 34";
