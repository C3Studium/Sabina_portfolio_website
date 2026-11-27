// Hlavička, patička, kontaktní modál — pod každou routou.
//
// POZOR: `defineGlobals` NEBERE `blocks`. Globální bloky nejsou součástí obsahu
// žádné stránky (`resolvePage` prochází jen bloky té jedné routy), takže se čtou
// vlastní čtečkou podle klíče — `getGlobalCopy` v src/lib/site/globals.ts —
// a protahují se přes `getStaticProps` každé routy do `_app`. Tady se jen říká,
// pod jakým `page` ty bloky v databázi bydlí a který z nich je povrch.
import { defineGlobals, defineSurface } from '@c3studium/valecms/site'

// Klíče bloků téhle stránky. Tvar `<stránka>.<sekce>` = `page` v getSiteCopy.
// Komponenty i seed se odkazují jen na ně; keys.ts je pouze rozcestník.
export const GLOBAL = {
    header: 'global.header',
    footer: 'global.footer',
    contact: 'global.contact',
} as const

// `sources` tu web nečte (globals.ts má vlastní čtečky) — říkají revalidaci,
// že dokument těch typů je pod KAŽDOU routou. Bez nich uložené nastavení
// (hlavička bez Reference) nebo sociální síť v patičce dorazily na web až po
// okně ISR (10 min), protože publikace neobnovila žádnou stránku.
export const globals = defineGlobals({
    copy: 'global',
    sources: {
        settings: { type: 'siteSettings' },
        socials: { type: 'socialLink' },
    },
})

/**
 * Povrchy — co se ve Studiu vybírá ze seznamu, protože na stránce na to nejde
 * kliknout: výběr prvku je geometrický a zavřený modál nemá obdélník.
 *
 * Bez `preview` schválně: Studio pak otevře formulář bloku nad stránkou. Živý
 * náhled by chtěl vlastní routu pod `/studio/preview/…`, a to je nad rámec
 * prototypu. Komponenta modálu přesto `useStudioSurface('contact')` poslouchá,
 * takže až routa vznikne, stačí sem dopsat adresu.
 *
 * Hlavička ani patička povrch nejsou: jsou vidět na každé stránce a klikat do
 * nich jde rovnou.
 */
export const surfaces = [
    // Kontakt se upravuje jako případová studie (valecms 2.0.0-beta.19,
    // `editor: 'split'`): formulář bloku vlevo, modál vpravo na vlastní
    // stránce (pages/studio/preview/contact.tsx) — živě, dvojklik na text
    // najde jeho pole (telefon je položka 2, „Hodnota"). Dřív formulář nad
    // stránkou modál zakrýval a pole se hledala naslepo.
    defineSurface({
        name: 'contact',
        title: 'Kontakt',
        kind: 'modal',
        copy: GLOBAL.contact,
        preview: '/studio/preview/contact',
        editor: 'split',
    }),
]
