// Pixelové pomůcky pro rozklad bannerů — vše nad plochými poli (mapa
// vrstev má rozměr w × h, index = y * w + x).

/** Otsu práh pro hodnoty 0–255 (vrací práh, třída „nad" je > práh). */
export function otsu(values) {
  const hist = new Float64Array(256);
  for (const v of values) hist[v]++;
  const total = values.length;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0;
  let wB = 0;
  let best = 0;
  let threshold = 127;
  for (let i = 0; i < 256; i++) {
    wB += hist[i];
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += i * hist[i];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) ** 2;
    if (between > best) {
      best = between;
      threshold = i;
    }
  }
  return threshold;
}

/** Souvislé oblasti masky (4-sousedství). Vrací pole { pixels: Int32Array, box }. */
export function components(mask, w, h, minArea = 1) {
  const seen = new Uint8Array(w * h);
  const out = [];
  const stack = new Int32Array(w * h);
  for (let start = 0; start < w * h; start++) {
    if (!mask[start] || seen[start]) continue;
    let top = 0;
    stack[top++] = start;
    seen[start] = 1;
    const pixels = [];
    let x0 = w, y0 = h, x1 = 0, y1 = 0;
    while (top) {
      const i = stack[--top];
      pixels.push(i);
      const x = i % w;
      const y = (i - x) / w;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      const near = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1];
      for (const n of near) {
        if (n >= 0 && mask[n] && !seen[n]) {
          seen[n] = 1;
          stack[top++] = n;
        }
      }
    }
    if (pixels.length >= minArea) {
      out.push({ pixels: Int32Array.from(pixels), box: { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 } });
    }
  }
  return out;
}

/** k-means v RGB nad vzorkem pixelů. Vrací středy [[r,g,b], …]. */
export function kmeans(samples, k, iterations = 12) {
  const centers = [];
  // Rozsev k-means++ (deterministicky — první je průměr).
  const mean = [0, 0, 0];
  for (const s of samples) for (let c = 0; c < 3; c++) mean[c] += s[c] / samples.length;
  centers.push(mean);
  while (centers.length < k) {
    let far = samples[0];
    let farD = -1;
    for (const s of samples) {
      const d = Math.min(...centers.map((c) => dist2(s, c)));
      if (d > farD) {
        farD = d;
        far = s;
      }
    }
    centers.push([...far]);
  }
  for (let it = 0; it < iterations; it++) {
    const acc = centers.map(() => [0, 0, 0, 0]);
    for (const s of samples) {
      const j = nearest(s, centers);
      acc[j][0] += s[0];
      acc[j][1] += s[1];
      acc[j][2] += s[2];
      acc[j][3]++;
    }
    acc.forEach((a, j) => {
      if (a[3]) centers[j] = [a[0] / a[3], a[1] / a[3], a[2] / a[3]];
    });
  }
  return centers;
}

export const dist2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
export const nearest = (s, centers) => {
  let best = 0;
  let bestD = Infinity;
  centers.forEach((c, j) => {
    const d = dist2(s, c);
    if (d < bestD) {
      bestD = d;
      best = j;
    }
  });
  return best;
};

/**
 * Rovnoměrné rozložení postupu: hodnoty pixelů jedné vrstvy přeskládá na
 * jejich pořadí (0–1), ať se vrstva odhaluje stejným tempem od začátku do
 * konce, ať je vstupní pole jakkoli nakřivo.
 */
export function rankNormalize(values) {
  // Distribuční funkce: stejné hodnoty dostanou stejný postup (pořadí uvnitř
  // shody by kreslilo pruhy po řádcích).
  const sorted = Float32Array.from(values).sort();
  const n = Math.max(1, values.length - 1);
  const bound = (v, upper) => {
    let lo = 0;
    let hi = sorted.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (upper ? sorted[mid] <= v : sorted[mid] < v) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };
  const out = new Float32Array(values.length);
  for (let i = 0; i < values.length; i++) {
    out[i] = (bound(values[i], false) + bound(values[i], true) - 1) / 2 / n;
  }
  return out;
}

/** Sobel nad jasem (0–1) → síla hrany 0–1 (normalizovaná na 98. percentil). */
export function edges(luma, w, h) {
  const out = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx =
        -luma[i - w - 1] - 2 * luma[i - 1] - luma[i + w - 1] + luma[i - w + 1] + 2 * luma[i + 1] + luma[i + w + 1];
      const gy =
        -luma[i - w - 1] - 2 * luma[i - w] - luma[i - w + 1] + luma[i + w - 1] + 2 * luma[i + w] + luma[i + w + 1];
      out[i] = Math.hypot(gx, gy);
    }
  }
  const sorted = Float32Array.from(out).sort();
  const top = sorted[Math.floor(sorted.length * 0.98)] || 1;
  for (let i = 0; i < out.length; i++) out[i] = Math.min(1, out[i] / top);
  return out;
}

/** Rozmazání 3×3 (box) — před Sobelem, ať šum nekreslí čáry. */
export function blur3(src, w, h) {
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
          s += src[yy * w + xx];
          n++;
        }
      }
      out[y * w + x] = s / n;
    }
  }
  return out;
}
