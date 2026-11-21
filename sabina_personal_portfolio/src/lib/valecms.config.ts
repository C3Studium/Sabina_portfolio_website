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
    // Recenze ve Studiu (valecms 2.0.0-beta.12): položka „Recenze" v menu nad
    // VLASTNÍM typem `reference` — Sabina je píše sama, žádný formulář pro
    // návštěvníky, takže bez knihovní fronty ke schválení (a bez typu `review`).
    // Vedle seznamu je záložka „Nastavení" (typ siteSettings ve stejném modulu)
    // s přepínačem, jestli se recenze a jejich 3D pás na webu ukazují.
    reviews: 'reference',
})
