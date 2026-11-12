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

const project = ({ slug, title, tagline, tone, order, image, alt, featured = false, cardCta = '' }) => ({
    type: 'project',
    key: `project.${slug}`,
    title,
    slug,
    tagline,
    perex: '',
    goals: [],
    // Co klient dovolil zveřejnit — vyplní se ve Studiu.
    shared: [],
    body: '',
    // Značka k nahrání: runner soubor uloží do knihovny médií a nahradí ji
    // { id, url, alt, width, height }.
    cover: { image, alt },
    gallery: [],
    tone,
    order,
    // Karta v galerii úvodní stránky a text jejího tlačítka.
    featured,
    cardCta,
})

export const blocks = [
    // Text pod scénou — pořadí položek = PROJECTS.intro v cms/projects.ts.
    // Musí být doslova to, co je v FALLBACK_INTRO (hero-list/index.tsx).
    {
        key: PROJECTS.intro,
        page: 'projects',
        title: 'Projekty — úvod',
        items: [
            // 0–3 se nečtou (dřív nadtitulek a kroky postupu); drží pořadí zbytku.
            { label: '', value: '', lead: '', note: '' },
            { label: '', value: '', lead: '', note: '' },
            { label: '', value: '', lead: '', note: '' },
            { label: '', value: '', lead: '', note: '' },
            { label: 'Domluvit spolupráci', value: '', lead: '', note: '' }, // 4 výzva
            { label: 'Co mohu ukázat', value: '', lead: '', note: '' }, // 5 nadpis sdílených detailů
            {
                label: 'Část zakázek je pod mlčenlivostí. U každého projektu ukazuji jen to, co klient schválil ke zveřejnění.',
                value: '',
                lead: '',
                note: '',
            }, // 6 poznámka
        ],
    },

    // Drobné popisky seznamu i detailu — pořadí = PROJECTS.labels v cms/projects.ts.
    {
        key: PROJECTS.labels,
        page: 'projects',
        title: 'Projekty — popisky',
        items: [
            { label: 'Objevujte posunutím' }, // 0 nápověda posunu
            { label: 'Zobrazit projekt' }, // 1 odkaz karty
            { label: 'Case study' }, // 2 štítek nad názvem v detailu
            { label: 'Další projekt' }, // 3 odkaz na další projekt
            { label: 'Cíle projektu' }, // 4 nadpis cílů v detailu
        ],
    },

    // `tone` střídá tmavou a světlou kartu, `order` drží pořadí „01 / 06".
    project({
        slug: 'gummylife',
        featured: true,
        cardCta: 'Zjistit víc',
        title: 'Gummylife',
        tagline: 'Bannerová kampaň',
        tone: 'dark',
        order: 1,
        image: '/assets/banners/gummylife_banner1.png',
        alt: 'Bannerová kampaň pro doplňky stravy Gummylife',
    }),
    project({
        slug: 'vecicky',
        featured: true,
        cardCta: 'Zjistit víc',
        title: 'Věcičky',
        tagline: 'Sezónní kampaň',
        tone: 'light',
        order: 2,
        image: '/assets/banners/vecicky_banner16.png',
        alt: 'Sezónní kampaň pro e-shop s dětskou módou Věcičky',
    }),
    project({
        slug: 'bruzek',
        featured: true,
        cardCta: 'Zjistit víc',
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
        featured: true,
        cardCta: 'Chci vědět víc',
        title: 'Samurai',
        tagline: 'Uvedení produktu',
        tone: 'light',
        order: 6,
        image: '/assets/banners/samurai_banner1.png',
        alt: 'Kampaň k uvedení nealkoholických nápojů Samurai',
    }),
]
