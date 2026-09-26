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

export const globals = defineGlobals({ copy: 'global', sources: {} })

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
    defineSurface({
        name: 'contact',
        title: 'Kontakt',
        kind: 'modal',
        copy: GLOBAL.contact,
    }),
]
