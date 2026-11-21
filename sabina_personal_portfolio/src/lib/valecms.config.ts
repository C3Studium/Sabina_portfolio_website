// Tenhle web, jako konfigurace — složená z jednoho souboru na stránku.
//
// Rozdělení není kvůli délce, ale kvůli práci: stránky vznikají paralelně a
// jeden soubor by byl jedno místo, kde se čtyři lidi (nebo agenti) přepisují.
// Tady se jen skládá; definice bydlí v ./cms/*.ts a klíče v ./cms/keys.ts.
//
// Musí projít přes `defineSite`. Holý objekt se stejnými klíči projde čtením
// i buildem a rozbije se až při publikaci: revalidace se ptá téhle konfigurace,
// které stránky přegenerovat, a na nezpracovaném objektu neví.
import { defineSite } from '@c3studium/valecms/site'

import { homepage } from './cms/home.ts'
import { aboutPage } from './cms/about.ts'
import { projectsPage, projectPages } from './cms/projects.ts'
import { globals, surfaces } from './cms/layout.ts'
import { legalPages } from './cms/legal.ts'

export default defineSite({
    pages: [homepage, aboutPage, projectsPage, ...projectPages, ...legalPages],
    globals,
    surfaces,
    // Study Cases ve Studiu (valecms 2.0): karty se snímkem stránky projektu
    // a editor s živým náhledem — nad VLASTNÍM typem `project` (řetězec =
    // žádný nový typ, žádný převod dokumentů). Stránku projektu i `paths`
    // deklaruje cms/projects.ts (projectPage); klikací pole dává caseEditable
    // v components/case-study a components/study/boards.
    caseStudies: 'project',
    // Knihovní modul recenzí je fronta ke schválení recenzí z formuláře. Tenhle
    // web takový formulář nemá — reference zapisuje Sabina sama do vlastního
    // typu `reference` (src/lib/valecms.types.ts). Vypnuto, ať Studio nenabízí
    // dvě různé „Recenze".
    reviews: false,
    // Deklarace 2.0.0-beta.11 klíč `caseStudies` ještě neznají (běh ano —
    // src/site/define.js SITE_KEYS); přetypování je jen pro TypeScript.
} as Parameters<typeof defineSite>[0] & { caseStudies?: boolean | string })
