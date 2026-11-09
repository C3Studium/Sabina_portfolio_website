// Adresa projektu — z pole `slug`, a když je prázdné, z názvu.
//
// Studio slug z názvu jen NABÍZÍ (tlačítko u pole), nevyplňuje: přepsat živou
// adresu kvůli opravenému překlepu v názvu by rozbilo odkazy. Sabina ale chce,
// aby nový projekt měl adresu sám od sebe — takže prázdný slug se tady
// dopočítá z názvu. Vyplněný vyhrává vždycky.
//
// Čte to konfigurace (`paths` v cms/projects.ts, běží i v prohlížeči) i čtečka
// na serveru (site/projects.ts) — proto vlastní soubor bez serverových importů,
// a proto jedna funkce: dvě kopie by se jednou rozešly a karta by vedla jinam,
// než kam publikace přegeneruje stránku.

/** „Věcicky & spol." → „vecicky-spol" */
export const slugify = (text: string): string =>
    text
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80)

/** Slug tolerantně: `{ current }` i holý řetězec (viz fieldTypes.js v knihovně). */
const rawSlug = (value: unknown): string => {
    const slug = value && typeof value === 'object' ? (value as { current?: unknown }).current : value
    return typeof slug === 'string' ? slug.trim() : ''
}

/** Adresa projektu bez prefixu, nebo '' když nemá ani slug, ani název. */
export const projectSlug = (body: { slug?: unknown; title?: unknown } | null | undefined): string => {
    const own = rawSlug(body?.slug)
    if (own) return own
    return typeof body?.title === 'string' ? slugify(body.title) : ''
}
