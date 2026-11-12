// Drobná matematika pro animace.

/** Hodnota omezená na [min, max]. */
export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * Přepočet z rozsahu [inMin, inMax] do [outMin, outMax] (lineárně, bez
 * omezení — mimo vstupní rozsah pokračuje dál). Např. náhodná prodleva
 * 3–5 s: `mapRange(Math.random(), 0, 1, 3, 5)`.
 */
export const mapRange = (value: number, inMin: number, inMax: number, outMin: number, outMax: number) =>
  outMin + ((value - inMin) / (inMax - inMin || 1)) * (outMax - outMin);
