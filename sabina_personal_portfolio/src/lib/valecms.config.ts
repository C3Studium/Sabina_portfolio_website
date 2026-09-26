// Tenhle web, jako konfigurace.
//
// VALECMS je knihovna; tenhle soubor je jediný popis toho, z čeho se skládá
// TENHLE web. Stránka je route, dokumenty, které drží, a to, kam jejich pole
// padají do props, které dostanou sekce.
//
// Musí projít přes `defineSite`. Holý objekt se stejnými klíči projde čtením
// i buildem a rozbije se až při publikaci: revalidace se ptá téhle konfigurace,
// které stránky přegenerovat, a na nezpracovaném objektu neví.
import { defineGlobals, definePage, defineSite } from '@c3studium/valecms/site'

const homepage = definePage({
    route: '/',
    title: 'Domů',
    // Všechny bloky typu siteCopy, které mají `page: 'index'`.
    copy: 'index',
    // Pojmenované zdroje dokumentů. Klíč je jméno, pod kterým dorazí do props.
    sources: {},
})

export default defineSite({
    pages: [homepage],
    // Co `_app` vykresluje pod každou routou — patička, kontakt. Publikace
    // takového bloku sáhne na každou stránku, a proto se to říká tady nahlas.
    globals: defineGlobals({ copy: 'global', sources: {} }),
})
