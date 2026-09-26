// Seed stránky /projects — blok textů seznamu a šest projektů.
//
// Texty a obrázky jsou DOSLOVA ty, které dnes stojí v kódu
// (src/components/projects/fallback.ts a hero-list/index.tsx): po seedu se na
// webu nic nezmění, jen to půjde upravit ve Studiu.
//
// Projekty jsou dokumenty typu `project`, ne bloky textu — z každého vzniká karta
// v řadě i stránka /projects/[slug]. `key` na nich je značka runneru (podle
// `data.key` pozná, co už založil), v typu je to skryté pole.
import { PROJECTS } from '../../src/lib/cms/projects.ts'

const project = ({ slug, title, tagline, tone, order, image, alt }) => ({
    type: 'project',
    key: `project.${slug}`,
    title,
    slug,
    tagline,
    perex: '',
    body: '',
    // Značka k nahrání: runner soubor uloží do knihovny médií a nahradí ji
    // { id, url, alt, width, height }.
    cover: { image, alt },
    gallery: [],
    tone,
    order,
})

export const blocks = [
    {
        key: PROJECTS.list,
        page: 'projects',
        title: 'Projekty',
        // Dva řádky nadpisu; zvýrazněný konec je zvlášť v `accent`.
        headline: 'Práce,\nkterá',
        accent: ['funguje'],
        // Úvod jako položky: čtyři řádky, kde počet řádků je obsah.
        items: [
            { label: 'Výběr značek, se kterými', value: '', lead: '', note: '' },
            { label: 'jsem spolupracovala.', value: '', lead: '', note: '' },
            { label: 'Každý projekt je příběh', value: '', lead: '', note: '' },
            { label: 'strategie, designu a výsledku.', value: '', lead: '', note: '' },
        ],
    },

    // `tone` střídá tmavou a světlou kartu, `order` drží pořadí „01 / 06".
    project({
        slug: 'gummylife',
        title: 'Gummylife',
        tagline: 'Bannerová kampaň',
        tone: 'dark',
        order: 1,
        image: '/assets/banners/gummylife_banner1.png',
        alt: 'Bannerová kampaň pro doplňky stravy Gummylife',
    }),
    project({
        slug: 'vecicky',
        title: 'Věcicky',
        tagline: 'Sezónní kampaň',
        tone: 'light',
        order: 2,
        image: '/assets/banners/vecicky_banner16.png',
        alt: 'Sezónní kampaň pro e-shop s dětskou módou Věcicky',
    }),
    project({
        slug: 'bruzek',
        title: 'Bruzek',
        tagline: 'Digitální kampaň',
        tone: 'dark',
        order: 3,
        image: '/assets/banners/bruzek_banner1.png',
        alt: 'Digitální kampaň pro realitní značku Bruzek',
    }),
    project({
        slug: 'wooline',
        title: 'Wooline',
        tagline: 'Obsah pro e-shop',
        tone: 'light',
        order: 4,
        image: '/assets/banners/vlnenezbozi_banner3.png',
        alt: 'Vizuály pro e-shop s vlněnými ponožkami Wooline',
    }),
    project({
        slug: 'mistr-pet',
        title: 'Mistr Pet',
        tagline: 'Promo vizuály',
        tone: 'dark',
        order: 5,
        image: '/assets/banners/mistrpet_banner1.png',
        alt: 'Promo vizuály pro chovatelské potřeby Mistr Pet',
    }),
    project({
        slug: 'samurai',
        title: 'Samurai',
        tagline: 'Uvedení produktu',
        tone: 'light',
        order: 6,
        image: '/assets/banners/samurai_banner1.png',
        alt: 'Kampaň k uvedení nealkoholických nápojů Samurai',
    }),
]
