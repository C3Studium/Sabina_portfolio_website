// Stránka O mně — texty, které dnes stojí v src/components/about/about-me.
//
// Klíče = ABOUT v src/lib/cms/about.ts, tvar bloků = definePage tamtéž.
// Kontrakt souboru: scripts/seed/README.md.
//
// POZOR: obsah karet je PŘEVZATÝ Z NÁVRHU a je zástupný — jazyková úroveň,
// certifikát i rozsah zkušeností jsou konkrétní tvrzení o Sabině, která
// nemáme ověřená. Seed je zakládá tak, jak stojí v kódu, aby se po seedu na
// webu nic nezměnilo; nahradit je skutečnými se pak dá ve Studiu.

// Ruční zalomení je `\n`, zvýraznění jsou hvězdičky (značka pole `headline`).
const blocks = [
    {
        key: 'about.me',
        page: 'about',
        title: 'Pojďme se poznat',
        headline: 'Něco\n*o mně*',
        image: { image: '/assets/rest/main_photo.png', alt: 'Sabina Hudrmentová' },
    },
    {
        key: 'about.lead',
        page: 'about',
        // `title` je v schématu povinný; tady jen pojmenovává blok ve Studiu,
        // komponenta ho nečte.
        title: 'Motto',
        headline: 'Měním nápady ve vizuály,\nkteré *spojují, mluví*\na *prodávají*.',
    },
    {
        key: 'about.highlights',
        page: 'about',
        title: 'Karty',
        // Pořadí = pořadí karet v komponentě (ikony jsou v kódu podle pozice).
        items: [
            {
                lead: 'Vzdělání',
                label: 'C1',
                note: 'Angličtina',
                value: 'Pokročilá úroveň angličtiny pro profesionální komunikaci a mezinárodní projekty.',
            },
            {
                lead: 'Zkušenosti',
                label: 'Spolupráce se silnými značkami',
                note: '',
                value: 'Kampaně pro e-shopy a značky z oblasti krásy, módy a lifestylu napříč Evropou.',
            },
            {
                lead: 'Certifikáty',
                label: 'Google Digital Garage',
                note: '',
                value: 'Dokončený certifikát digitálního marketingu — strategie, SEO, reklama a analytika.',
            },
        ],
    },
    {
        key: 'about.courses',
        page: 'about',
        title: 'Kurzy',
        headline: 'Neustálé vzdělávání',
        body: 'Průběžné kurzy motion designu, UI/UX, brandingu a marketingu, abych držela krok s oborem.',
        items: [
            { label: 'Motion design' },
            { label: 'UI / UX design' },
            { label: 'Brandová strategie' },
            { label: 'Webový vývoj' },
            { label: 'Marketing a reklama' },
            { label: 'Copywriting' },
        ],
    },
    {
        key: 'about.skills',
        page: 'about',
        title: 'Specializace',
        headline: 'Co umím nejlíp',
        body: 'Zaměřuju se na výkonné bannery, media kity a vizuální systémy, které přinášejí výsledky.',
        items: [
            { label: 'Bannery' },
            { label: 'Media kity' },
            { label: 'Brandové vizuály' },
            { label: 'Digitální kampaně' },
            { label: 'Reklamy na sítě' },
            { label: 'Tiskoviny' },
        ],
    },
]

export { blocks }
