// Pro kontroly při scrollu, které čtou layout (getBoundingClientRect,
// getComputedStyle) a nemusí běžet každý snímek: zavolá `fn` v rAF nejvýš
// jednou za `ms`, a jednou ještě po posledním podnětu (doběh scrollu).
// Na iPhonu každé takové čtení v snímku, kdy stránka zapisuje styly,
// vynutí přepočet layoutu — u kontrol „co je na obrazovce" stačí ~8× za s.
export type Throttled = (() => void) & { cancel: () => void };

export function frameThrottle(fn: () => void, ms: number): Throttled {
  let raf = 0;
  let timer = 0;
  let last = -Infinity;
  const run = () => {
    raf = 0;
    last = performance.now();
    fn();
  };
  const schedule = (() => {
    if (raf || timer) return;
    const wait = last + ms - performance.now();
    if (wait <= 0) {
      raf = requestAnimationFrame(run);
      return;
    }
    timer = window.setTimeout(() => {
      timer = 0;
      raf = requestAnimationFrame(run);
    }, wait);
  }) as Throttled;
  schedule.cancel = () => {
    cancelAnimationFrame(raf);
    window.clearTimeout(timer);
    raf = 0;
    timer = 0;
  };
  return schedule;
}
