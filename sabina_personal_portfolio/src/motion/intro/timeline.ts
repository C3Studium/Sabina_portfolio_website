// Časování úvodu — skutečné sekundy od chvíle, kdy se objeví opona.
// Preloader je jen TEXT — nadpis, k tomu o kus později logo a hlavička —
// klidně, ~5,3 s. Po něm VSTUP stránky: pomalu se postaví portrét, za ním
// bannery (ztlumené, pak ve smyčce, při scrollu je nahradí 3D scéna)
// a nápověda posunu.
//
//   0,3   bílý rámeček skáče po bílém textu nadpisu
//   1,2   logo: rámeček → linky → obrys → plné logo (zůstane)
//   1,4   rámeček nadpisu se přelije do tvaru zelených slov, uvnitř
//         tečkovaný obrys slov, která přijdou
//   1,95  zelená slova se vylijí (TextMorph); rámeček je dál obepíná
//   3,1   rámeček loga se roztáhne kolem celého loga, jméno se vylije
//   3,6   od loga běží linka přes hlavičku — odkazy se staví jeden po
//         druhém, nakonec tlačítko (hotovo ~4,3)
//   4,5   rámečky hlavičky zhasínají jeden po druhém
//   4,6   `go`: zelená slova se přelijí do finálních (už bez obrysu),
//         rámeček nadpisu se přetvaruje a zmizí
//   5,3   konec opony
//   — vstup —
//   5,3   za portrétem se začnou stavět bannery
//   5,4   pomalu se staví portrét (zelená skica → barvy) a zůstane
//   5,9   nápověda posunu

import type { Span } from "./draw";

/**
 * Zpomalení celého úvodu: 1 = časy níž, jak jsou (skutečné sekundy).
 * Páka zůstává pro rychlé ladění.
 */
export const SLOW = 1;
/** Čas z tohoto souboru → skutečné sekundy. */
export const real = (seconds: number) => seconds * SLOW;

/** Hodiny enginu opony před odhalením stránky (skutečné sekundy). */
export const CLOCK = 0.25;
/** Stránka se otevře (brána `go`): finální slova, nápověda posunu. */
export const GO = 4.6;
/** Konec úvodu — engine sundá oponu. */
export const END = 5.3;

/** První kombinace zelených slov se vylije v tomhle čase (hero). */
// Posunuto o 0,6 s (z 1,95), aby rámeček na bílém textu měl čas na klidné
// přejezdy (HEADLINE.hops). Otevření stránky (GO) i konec se nemění.
export const WORDS_IN = 2.55;

/** Vstup po textu: za portrétem se začnou stavět bannery… */
export const BANNERS_IN = 5.3;
/** …pomalu se postaví portrét (SketchReveal v heru)… */
export const PORTRAIT_IN = 5.4;
/** …a nakonec nápověda posunu. */
export const HINT_IN = 5.9;

// Logo se jen postaví a zůstane. Rámeček nezmizí: roztáhne se kolem celého
// loga, jméno se vylije (TextMorph v hlavičce) a od rámečku vyběhne linka
// hlavičky. Zhasne až s ostatními rámečky hlavičky (HEADER.out).
export const LOGO = {
  frame: [1.2, 1.7] as Span,
  lines: [1.55, 2.15] as Span,
  outline: [2.0, 2.6] as Span,
  fill: [2.5, 2.95] as Span,
  // Obrys pod hotovým logem zhasne, linky se stáhnou.
  outlineOut: [2.9, 3.1] as Span,
  linesOut: [2.95, 3.3] as Span,
  // Logo v hlavičce naskočí na místě nakresleného (stejný obrázek).
  show: 2.95,
  // Rámeček se roztáhne z „S" kolem celého loga i se jménem.
  frameMove: [3.1, 3.5] as Span,
  // Jméno se vylije (hlavička čte přes useIntroAt).
  name: 3.2,
};

// Bílý rámeček na nadpisu — jeden průběh, žádná smyčka: skáče po bílém
// textu, přelije se do tvaru zelených slov (s tečkovaným obrysem těch, která
// přijdou), slova se vylijí a rámeček je dál obepíná. S druhým přelitím
// (`go`, bez obrysu) se přetvaruje na finální slova a zmizí.
export const HEADLINE = {
  // Rámeček na bílém textu: 3 zastávky, přejezdy po ~0,8 s (headline.ts).
  hops: [0.2, 2.0] as Span,
  shape: [2.0, 2.5] as Span,
  words: [2.02, 2.55] as Span,
  first: WORDS_IN,
  reshape: [GO, GO + 0.45] as Span,
  fade: [GO + 0.1, GO + 0.5] as Span,
};

// Hlavička: od rámečku loga vyběhne linka přes celou lištu. Kde linka
// mine odkaz, ten se postaví (rámeček se rozevře z linky, tečkovaný text)
// a naskočí. Na konci linky tlačítko: ořezové značky, kóta, kruh kolem
// šipky. Rámečky zůstanou a na konci zhasnou postupně — logo, odkazy,
// tlačítko.
export const HEADER = {
  bar: [3.6, 3.95] as Span,
  /** Kroky jednoho odkazu od chvíle, kdy ho linka mine. */
  link: { open: 0.2, text: [0.05, 0.25] as Span, show: 0.25 },
  cta: { marks: 0.25, text: [0.06, 0.28] as Span, show: 0.3 },
  /** Postupné zhasnutí: start, rozestup prvků, délka. */
  out: 4.5,
  outStagger: 0.05,
  outLength: 0.3,
};

/** Úsek zhasnutí `index`-tého prvku hlavičky (0 = logo). */
export const headerOut = (index: number): Span => {
  const start = HEADER.out + index * HEADER.outStagger;
  return [start, start + HEADER.outLength];
};

// Bannery za portrétem — stálá vrstva s VLASTNÍMI hodinami (s), ne hodinami
// opony (IntroBanners): stavba 0 → HOLD a stojí; při odchodu (scroll ke 3D
// scéně) skok na OUT a doběh do konce života; návrat nahoru = nová stavba.
export const BANNERS = {
  /** Život banneru [začátek, konec]; kroky níž jsou jeho části 0–1. */
  lives: [
    [0, 4.73],
    [0.25, 4.78],
  ] as Span[],
  /** Hotovo (bannery, slova i tvary stojí) — tady hodiny stojí. */
  hold: 2.7,
  /** Odchod začíná tady (do té doby jen stání). */
  out: 3.95,
  // Konstrukce kolem: ořezové značky, rámeček s rozměrem, mřížka.
  marks: [0, 0.08] as Span,
  frame: [0.02, 0.14] as Span,
  grid: [0.04, 0.2] as Span,
  gridOut: [0.31, 0.4] as Span,
  frameOut: [0.9, 1] as Span,
  // Banner samotný stavějí vrstvy (layered.ts): skica do 31 %, výplň do
  // 38 %, od 87,5 % pozpátku. Bez rozkladu náhradní rastr a obraz:
  halftone: [0.05, 0.28] as Span,
  image: [0.22, 0.38] as Span,
  imageOut: [0.875, 0.95] as Span,
  halftoneOut: [0.89, 0.97] as Span,
  // Slova a tvary.
  glyphsStart: 0.6,
  glyphStagger: 0.2,
  glyphsOut: 3.95,
  glyphOutStagger: 0.07,
};

/** Konec odchodu bannerů (jejich hodiny). */
export const BANNERS_END = Math.max(...BANNERS.lives.map(([, end]) => end));
