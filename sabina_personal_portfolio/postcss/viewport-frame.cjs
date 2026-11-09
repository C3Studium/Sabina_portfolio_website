// Rám obsahu: celá výška okna, šířka nejvýš 16 : 9 podle výšky.
//
// Celý web je složený ve vw / vh. Aby se na okně širším než 16 : 9
// (ultrawide 5120 × 1440) obsah neroztahoval do šířky, přepisuje tenhle
// plugin každé `Xvw` na `calc(X * var(--vw))` a `Xvh` na `calc(X * var(--vh))`.
// Proměnné jsou v styles/globals.scss: --vh je 1vh, --vw nejvýš 1vh / 9 × 16
// (od notebooku na šířku). Zdrojáky tak zůstávají ve vw / vh, jak byly psané.
//
// Co se NEpřepisuje (skutečný viewport, ne rám obsahu):
//  - svh / dvh / lvh / svw / dvw / lvw — pro výšku přišpendlených sekcí,
//    pozadí přes celé okno a polohu vůči okraji okna (sticky patička),
//  - deklarace vlastních proměnných (`--vw: min(1vw, …)` samo),
//  - media dotazy (to nejsou deklarace),
//  - CSS z node_modules (Studio a knihovny mají svůj vlastní layout).
const UNIT = /(^|[^\w.-])(-?\d*\.?\d+)(vw|vh)\b/g;

module.exports = () => ({
  postcssPlugin: "viewport-frame",
  Declaration(decl) {
    if (decl.prop.startsWith("--")) return;
    const file = decl.source && decl.source.input && decl.source.input.file;
    if (file && /node_modules/.test(file)) return;
    if (!/\d(vw|vh)\b/.test(decl.value)) return;
    decl.value = decl.value.replace(UNIT, (m, pre, n, unit) => `${pre}calc(${n} * var(--${unit}))`);
  },
});
module.exports.postcss = true;
