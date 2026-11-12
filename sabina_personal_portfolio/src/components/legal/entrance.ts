// Jak sekce právních stránek přichází — převzaté z webu Procházka Group
// (components/common/ui/entrance.js): všechno vyjede o kousek nahoru na
// jedné křivce a odstup mezi prvky dělá z bloku usazující se sekci.
import { cubicBezier, type Variants } from "framer-motion";

export const CURTAIN = cubicBezier(0.22, 1, 0.36, 1);

export const RISE: Variants = {
  hidden: { opacity: 0, y: 24 },
  shown: { opacity: 1, y: 0, transition: { duration: 0.7, ease: CURTAIN } },
};

/** Odstup jedné skupiny; zpoždění se liší podle místa volání. */
export const group = (delay = 0): Variants => ({
  hidden: {},
  shown: { transition: { staggerChildren: 0.07, delayChildren: delay } },
});

/** `whileInView` všech sekcí: jednou, při 20 % ve výhledu. */
export const ENTERS = { once: true, amount: 0.2 } as const;

/** Lenis Sabiny (src/pages/_app.tsx) — plynulý posun, jinak nativní. */
export const scrollToY = (y: number, duration = 1.2) => {
  const lenis = (window as unknown as { lenisInstance?: { scrollTo: (y: number, o?: Record<string, unknown>) => void } }).lenisInstance;
  if (lenis) lenis.scrollTo(Math.max(0, y), { duration });
  else window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
};
