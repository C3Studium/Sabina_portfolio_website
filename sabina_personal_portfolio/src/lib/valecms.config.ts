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

export default defineSite({
    pages: [homepage, aboutPage, projectsPage, ...projectPages],
    globals,
    surfaces,
})
