// Úvodní stránka — čtyři bloky textů a dokumenty, doslova texty a obrázky,
// které dnes stojí v src/components/home/*. Po seedu se na webu nic nezmění;
// změní se jen to, že to jde upravit ve Studiu.
//
// Bloky (siteCopy): klíče = HOME.* v src/lib/cms/home.ts, pořadí položek =
// smlouva s čtečkami tamtéž a s indexy v komponentách. Zvýraznění je `*text*`.
// Koncová interpunkce („*výsledky*.") se ukládá mimo hvězdičky; dekodér
// zvýrazňuje po slovech a komponenta ji zase vyndá ven, takže obě podoby
// se kreslí stejně.
//
// Dokumenty: nástroje a statistiky (modul Nabídka), služby, kroky procesu
// a recenze — typy v src/lib/valecms.types.ts. Projekty pro galerii hera
// zakládá seed/projects.mjs (pole `featured`). `key` je značka runneru.

// Jedna fotka pod všemi sekcemi — runner nahraje soubor jednou.
const PORTRAIT = { image: '/assets/rest/main_photo.png', alt: 'Sabina Hudrmentová' }

const doc = (type, key, body) => ({ type, key, ...body })

export const blocks = [
    /* ------------------------------------------------------------ bloky -- */
    {
        key: 'index.hero',
        page: 'index',
        title: 'Úvod',
        items: [
            // 0–2: řádky nadpisu (anotace `lines` na <h1>)
            { label: 'Grafika' },
            { label: 'pro *lepší*' },
            { label: '*výsledky*.' },
            // 3: nápověda posunu (a její zrcadlo u galerie)
            { label: 'Objevujte posunutím' },
            // 4–5: první kombinace zelených slov pro úvod při načtení
            // („Grafika pro větší prodeje" → „… lepší výsledky").
            // ZÁSTUPNÉ, skutečná slova doplní Sabina ve Studiu.
            { label: 'větší' },
            { label: 'prodeje' },
        ],
        image: PORTRAIT,
    },
    {
        key: 'index.info',
        page: 'index',
        title: 'Služby a nástroje',
        headline: 'Vizuály, které\nmají *smysl.*',
        body: 'Tvořím reklamní grafiku, která zaujme, komunikuje a přináší výsledky.',
        items: [
            { label: 'Nástroje, se kterými pracuji' }, // 0 popisek nad nástroji
            { label: 'Domluvit spolupráci' }, // 1 tlačítko pod nadpisem (#spoluprace)
            { label: 'Co nabízím' }, // 2 štítek karet služeb
            { label: 'Zobrazit příklady' }, // 3 odkaz karty (vede na /projects)
        ],
        image: PORTRAIT,
    },
    {
        key: 'index.process',
        page: 'index',
        title: 'Jak probíhá spolupráce',
        body: 'Jasný a efektivní proces, který mění nápady ve funkční vizuály a výsledky.',
        items: [
            // 0–1: řádky nadpisu (anotace `lines` na <h2>)
            { label: 'Od zadání' },
            { label: 'k *výsledku*.' },
            // 2: nápověda posunu
            { label: 'Objevujte posunutím' },
        ],
    },
    {
        key: 'index.cta',
        page: 'index',
        title: 'Začněme váš projekt',
        headline: 'Hledáte grafickou podporu pro svou *ZNAČKU*, e-shop nebo klienta?',
        items: [
            // 0: podtitul — druhá věta je tučná na vlastním řádku
            { label: 'Každý projekt je jedinečný. *Řekněte mi o tom vašem.*' },
            // 1: tlačítko (vede na #kontakt — cíl zůstává v kódu)
            { label: 'Nezávazná poptávka' },
            // 2: stavový řádek
            { label: 'Odpovím do *24 hodin*' },
            // 3–4: čísla pod recenzí, ručně psaná (zástupná)
            { value: '100+', label: 'Odevzdaných bannerů' },
            { value: '50+', label: 'Spokojených klientů' },
            // 5–6: claim v patě sekce, dva řádky
            { label: 'Design, který *spojuje*,' },
            { label: 'mluví a prodává.' },
        ],
        image: PORTRAIT,
        // Bannery vpravo, v pořadí zobrazení.
        gallery: [
            { image: '/assets/banners/bruzek_banner1.png', alt: 'Bannerová kampaň pro realitní značku Bruzek' },
            { image: '/assets/banners/vlnenezbozi_banner1.png', alt: 'Bannerová kampaň pro e-shop Wooline' },
            { image: '/assets/banners/mistrpet_banner3.png', alt: 'Bannerová kampaň pro e-shop Mistr Pet' },
        ],
    },

    /* ------------------------------------------------- Zelená slova -- */
    // Dvě podoby každého zeleného slova nadpisu: při načtení → po otevření.
    // ZÁSTUPNÁ první podoba, skutečná slova doplní Sabina ve Studiu.
    doc('heroWord', 'hero.word.1', { place: 'hero', intro: 'větší', final: 'lepší', order: 1 }),
    doc('heroWord', 'hero.word.2', { place: 'hero', intro: 'prodeje', final: 'výsledky', order: 2 }),
    // Výzva: „Začněme *váš* projekt" se dokola přelévá na „náš".
    doc('heroWord', 'cta.word.1', { place: 'cta', intro: 'náš', final: 'váš', order: 10 }),

    /* ------------------------------------------------ Nabídka → Stack -- */
    // Ikony zatím žádné nejsou (v public není ani jedna) — komponenta pak
    // kreslí tečku jako dosud. Nahrají se ve Studiu.
    doc('stackItem', 'stack.figma', { title: 'Figma', order: 1 }),
    doc('stackItem', 'stack.adobe', { title: 'Adobe', order: 2 }),
    doc('stackItem', 'stack.canva', { title: 'Canva Pro', order: 3 }),
    doc('stackItem', 'stack.ai', { title: 'AI nástroje', order: 4 }),

    /* ------------------------------------------------ Nabídka → Stats -- */
    doc('statItem', 'stat.banners', { value: '500+', label: 'vytvořených bannerů', order: 1 }),
    doc('statItem', 'stat.years', { value: '5 let', label: 'zkušeností', order: 2 }),
    doc('statItem', 'stat.approach', { value: '100%', label: 'individuální přístup', order: 3 }),
    doc('statItem', 'stat.hours', { value: '2000+', label: 'hodin tvorby', order: 4 }),
    doc('statItem', 'stat.ideas', { value: '∞', label: 'nápadů :D', order: 5 }),

    /* ------------------------------------------------------- Služby -- */
    // Dnes má text a body jen první karta; další tři jsou na webu jen číslo
    // a název. Doplnit se dají ve Studiu. Číslo, štítek a odkaz jsou pole
    // karty (prázdné = pořadí, „Co nabízím", „Zobrazit příklady").
    doc('service', 'service.ads', {
        number: '01',
        label: 'Co nabízím',
        title: 'Reklamní grafika',
        lead: 'Tvořím vizuály, které fungují napříč kanály – od bannerů po sociální sítě.',
        points: ['Bannery', 'Carousel formáty', 'Sociální sítě', 'Branding vizuály'],
        cta: 'Zobrazit příklady',
        order: 1,
    }),
    doc('service', 'service.social', { number: '02', label: 'Co nabízím', title: 'Sociální sítě', lead: '', points: [], cta: 'Zobrazit příklady', order: 2 }),
    doc('service', 'service.branding', { number: '03', label: 'Co nabízím', title: 'Branding', lead: '', points: [], cta: 'Zobrazit příklady', order: 3 }),
    doc('service', 'service.web', { number: '04', label: 'Co nabízím', title: 'Webové prvky', lead: '', points: [], cta: 'Zobrazit příklady', order: 4 }),

    /* ------------------------------------------------------- Proces -- */
    doc('processStep', 'process.start', {
        stage: 'start',
        title: '',
        text: '',
        note: '',
        images: [PORTRAIT],
        details: [],
    }),
    doc('processStep', 'process.01', {
        stage: '01',
        title: 'Seznámení',
        text: 'Začínáme *pochopením vašich cílů,* cílové skupiny a toho, *čeho má grafika dosáhnout.*',
        note: 'pochopení cílů\n& cílové skupiny',
        images: [],
        details: [
            { label: 'Cíl', value: 'Propagace produktu' },
            { label: 'Cílová skupina', value: 'Milovníci prémiové čokolády a sladkostí' },
            { label: 'Výstupy', value: 'Reklamní vizuál' },
            { label: 'Termín', value: '3 dny' },
            { label: 'Zaměření na:', value: 'Prémiovost, Čistý design, Chuť' },
        ],
    }),
    doc('processStep', 'process.02', {
        stage: '02',
        title: 'Koncept',
        text: 'Vizuální směr vychází z barev samotného produktu. Důraz je kladen na *kontrast, detail produktu* a charakter značky.',
        note: 'moodboard &\nvizuální směr',
        images: [],
        details: [
            { label: 'Typografie', value: 'Agrandir' },
            { label: 'Barva', value: '#9cae5c' },
            { label: 'Barva', value: '#3b2318' },
            { label: 'Barva', value: '#d9873f' },
            { label: 'Barva', value: '#f4ead2' },
        ],
    }),
    doc('processStep', 'process.03', {
        stage: '03',
        title: 'Tvorba',
        text: 'Tvořím s jasným záměrem. *Každý prvek má svou funkci* – zaujmout, komunikovat a podpořit výsledek.',
        note: 'tvorba\nhlavního vizuálu',
        images: [
            { image: '/assets/banners/jordan_banner4.png', alt: 'Reklamní vizuál pro značku Jordan' },
            { image: '/assets/banners/jordan_banner1.png', alt: 'Varianta vizuálu' },
            { image: '/assets/banners/jordan_banner3.png', alt: 'Varianta vizuálu' },
        ],
        details: [],
    }),
    doc('processStep', 'process.04', {
        stage: '04',
        title: 'Doladění',
        text: 'Na základě zpětné vazby *dolaďuji detaily,* dokud není vše připravené do finální podoby.',
        note: 'úpravy a finální\ndoladění',
        images: [{ image: '/assets/banners/jordan_banner4.png', alt: 'Doladěná verze vizuálu' }],
        details: [
            { label: 'Klient', value: 'Můžeme zkusit dát nadpis větší?' },
            { label: 'Já', value: 'Jasně, tady to máte změněné.' },
        ],
    }),
    doc('processStep', 'process.05', {
        stage: '05',
        title: 'Předání',
        text: 'Finální grafiku předávám ve všech potřebných formátech, *připravenou pro použití* napříč platformami.',
        note: 'předání ve všech\npotřebných formátech',
        images: [
            { image: '/assets/banners/jordan_banner6.png', alt: 'Formát 1080 × 1920 px, story na výšku' },
            { image: '/assets/banners/jordan_banner1.png', alt: 'Formát 1080 × 1350 px na výšku' },
            { image: '/assets/banners/jordan_banner5.png', alt: 'Čtvercový formát 1080 × 1080 px, 1:1' },
        ],
        details: [
            { label: '1080 x 1920 px', value: 'story formát' },
            { label: '1080 x 1350 px', value: 'formát na výšku' },
            { label: '1080 x 1080 px', value: '1:1 čtverec' },
        ],
    }),
    // 06 Další projekty. Pořadí `details` je smlouva s komponentou (MORE_TEXTS):
    // tři popisky, štítek a nadpis snímku, název, podtitul a monogram značky,
    // pak barvy značky (#hex).
    doc('processStep', 'process.06', {
        stage: '06',
        title: 'Další projekty',
        text: 'Kromě bannerů tvořím i *prezentace a vizuální identity značek* — se stejným důrazem na detail.',
        note: '',
        images: [
            { image: '/assets/banners/gummylife_banner1.png', alt: 'Banner pro Gummylife' },
            { image: '/assets/banners/bruzek_banner1.png', alt: 'Kampaň Bruzek na snímku' },
        ],
        details: [
            { label: 'Popisek banneru', value: 'bannery do kampaní' },
            { label: 'Popisek prezentace', value: 'prezentace' },
            { label: 'Popisek identity', value: 'identita značky' },
            { label: 'Snímek — štítek', value: 'Prezentace · 04 / 12' },
            { label: 'Snímek — nadpis', value: 'Výsledky kampaně Q3' },
            { label: 'Značka — název', value: 'NOVA' },
            { label: 'Značka — podtitul', value: 'studio interiérů' },
            { label: 'Značka — monogram', value: 'N' },
            { label: 'Barva', value: '#bec948' },
            { label: 'Barva', value: '#2e2e2e' },
            { label: 'Barva', value: '#e8e5de' },
            { label: 'Barva', value: '#6c5ce7' },
        ],
    }),
    // Výzva před CTA: název = nadtitulek, poznámka = řádky nadpisu (poslední
    // slovo zezelená), text = úvod.
    doc('processStep', 'process.callout', {
        stage: 'callout',
        title: 'Pojďme spolupracovat',
        text: 'Napište mi, s čím potřebujete pomoct — společně z vašeho nápadu uděláme vizuál, který funguje.',
        note: 'Jste připraveni\nna spolupráci?',
        images: [],
        details: [],
    }),

    /* ------------------------------------------------------ Recenze -- */
    // ZÁSTUPNÁ podle návrhu — před spuštěním nahradit skutečnou.
    doc('reference', 'reference.lune', {
        name: 'Lucie K.',
        role: 'Brand manažerka, LUNE',
        text: 'Sabina úplně proměnila náš vizuální styl. Bannery nejenom skvěle vypadají, ale hlavně přinášejí výsledky. Komunikace byla bez zádrhelů, termíny sedly a *dopad byl skutečný.*',
        stars: 5,
        order: 1,
    }),
    // ZÁSTUPNÉ recenze do pásu ve výzvě (dřív MORE_REVIEWS v cta/index.tsx) —
    // dokud nejsou skutečné, ať pás nemá jen jednu kartu.
    doc('reference', 'reference.vikio', {
        name: 'Tomáš R.',
        role: 'Majitel e-shopu, Vikio',
        text: 'Bannery na Black Friday jsme měli hotové dřív, než jsme čekali. Proklik se zvedl o třetinu a *kampaň se zaplatila první týden.*',
        stars: 5,
        order: 2,
    }),
    doc('reference', 'reference.mistr-pet', {
        name: 'Petra M.',
        role: 'Marketing, Mistr Pet',
        text: 'Oceňuji, jak rychle Sabina pochopila naši značku. Každý formát sedí na svou síť a *vizuály drží jednotný styl.*',
        stars: 5,
        order: 3,
    }),
    doc('reference', 'reference.bruzek', {
        name: 'Jan K.',
        role: 'Jednatel, Bruzek reality',
        text: 'Spolupráce bez zbytečných kol připomínek. Zadání, koncept, hotovo — a *výsledky, které je vidět na poptávkách.*',
        stars: 5,
        order: 4,
    }),
]
