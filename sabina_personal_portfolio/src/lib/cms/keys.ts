// Rozcestník klíčů bloků — sám nic nedefinuje.
//
// Klíče bydlí u své stránky (home.ts, about.ts, projects.ts, layout.ts), protože
// stránky vznikají paralelně a jeden společný soubor by byl jedno místo, kde se
// všichni přepisují. Komponenty importují odsud, ať nemusí vědět, kde co bydlí.
export { HOME } from './home.ts'
export { ABOUT } from './about.ts'
export { PROJECTS } from './projects.ts'
export { GLOBAL } from './layout.ts'
