// Společné hodiny úvodu. Preloader je spustí, když se jeho scéna objeví;
// vrstvy mimo oponu (bannery v heru) se k nim připojí a kreslí ve stejném
// čase. Bez preloaderu (`?nopl=1`, Studio, klientský přechod, omezený pohyb)
// se hodiny nespustí a úvodní vrstvy nekreslí nic.

let startedAt: number | null = null;
const listeners = new Set<() => void>();

export const markIntroStart = () => {
  startedAt = performance.now();
  listeners.forEach((fn) => fn());
};

/** Sekundy od startu úvodu, nebo `null`, když úvod neběží. */
export const introElapsed = () => (startedAt === null ? null : (performance.now() - startedAt) / 1000);

export const onIntroStart = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
