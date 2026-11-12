// Sdílené nastavení FlexCarousel pro telefon (home/stacked galerie a pás
// recenzí v home/cta).

/**
 * Čočka galerie na telefonu (FlexCarousel): širší i vyšší než plátno, takže
 * ohyb, duha i rozostření leží celé za okrajem obrazovky a karty jedou přes
 * celou šířku rovně. Rozostření hran vypnuté — za okrajem by se počítalo
 * zbytečně.
 */
export const FLAT_LENS = {
  preset: "liquid",
  lensWidth: 1.7,
  lensHeight: 2.4,
  tilt: 0,
  roundness: 1,
  bend: 0.22,
  reach: 0.08,
  curl: "twist",
  dispersion: 0.25,
  liquid: 0,
  followCursor: false,
  captureWheel: false,
  edgeBlur: 0,
} as const;
