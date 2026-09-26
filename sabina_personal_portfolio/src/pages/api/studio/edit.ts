// Režim prohlížeče pro Studio — viz valecms/server/studio.
// Logika je v balíčku; tenhle soubor jí dává adresu.
//
// `registerSchemas` i tady, ne jen v catch-allu pod /api/cms: registr typů
// odmítá duplicity záměrně a tahle routa je vlastní vstupní bod, který si
// konfiguraci webu vyhodnotí znovu. Bez resetu předem spadne na
// "type is already registered" — chyba, která vypadá jako vada knihovny.
import '@c3studium/valecms/server/registerSchemas.js'

export { handleEdit as default } from '@c3studium/valecms/server/studio/index.js'
