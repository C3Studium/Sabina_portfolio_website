// Úvodní stránka — čtyři bloky, doslova texty a obrázky, které dnes stojí
// v src/components/home/*. Po seedu se na webu nic nezmění; změní se jen to,
// že to jde upravit ve Studiu.
//
// Klíče = HOME.* v src/lib/cms/home.ts, pořadí položek = smlouva s čtečkami
// tamtéž a s indexy v komponentách. Zvýraznění je `*text*` — jediné, co
// schéma `siteCopy` zvýrazňovat umí, a jen v `headline` a `items[].label`.
// Koncová interpunkce („*výsledky*.") se ukládá mimo hvězdičky; dekodér
// zvýrazňuje po slovech a komponenta ji zase vyndá ven, takže obě podoby
// se kreslí stejně.

// Jedna fotka pod všemi čtyřmi sekcemi — runner nahraje soubor jednou.
const PORTRAIT = { image: '/assets/rest/main_photo.png', alt: 'Sabina Hudrmentová' }

export const blocks = [
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
            // 4–7: karty ukázek — lead = klient, label = obor, value = tlačítko.
            // Fotky karet jsou `gallery` ve stejném pořadí.
            { lead: 'Gummylife', label: 'Doplňky stravy', value: 'Zjistit víc' },
            { lead: 'Věcicky', label: 'Dětská móda', value: 'Zjistit víc' },
            { lead: 'Bruzek', label: 'Prodej nemovitostí', value: 'Zjistit víc' },
            { lead: 'Samurai', label: 'Kampaň pro e-shop', value: 'Chci vědět víc' },
        ],
        image: PORTRAIT,
        gallery: [
            { image: '/assets/banners/gummylife_banner1.png', alt: 'Gummylife — Doplňky stravy' },
            { image: '/assets/banners/vecicky_banner16.png', alt: 'Věcicky — Dětská móda' },
            { image: '/assets/banners/bruzek_banner6.png', alt: 'Bruzek — Prodej nemovitostí' },
            { image: '/assets/banners/samurai_banner1.png', alt: 'Samurai — Kampaň pro e-shop' },
        ],
    },
    {
        key: 'index.info',
        page: 'index',
        title: 'Služby a nástroje',
        headline: 'Vizuály, které\nmají *smysl.*',
        body: 'Tvořím reklamní grafiku, která zaujme, komunikuje a přináší výsledky.',
        items: [
            // 0: popisek nad nástroji
            { label: 'Nástroje, se kterými pracuji' },
            // 1–4: nástroje
            { label: 'Figma' },
            { label: 'Adobe' },
            { label: 'Canva Pro' },
            { label: 'AI nástroje' },
            // 5: odkaz pod nadpisem (vede na #spoluprace — cíl zůstává v kódu)
            { label: 'Domluvit spolupráci' },
            // 6–8: první karta služeb — štítek, titulek (poslední slovo se
            // zvýrazňuje v kódu), úvod
            { label: 'Co nabízím' },
            { label: 'Reklamní grafika' },
            { label: 'Tvořím vizuály, které fungují napříč kanály – od bannerů po sociální sítě.' },
            // 9–12: štítky první karty
            { label: 'Bannery' },
            { label: 'Carousel formáty' },
            { label: 'Sociální sítě' },
            { label: 'Branding vizuály' },
            // 13: tlačítko první karty
            { label: 'Zobrazit příklady' },
            // 14–16: karty stojící za tou první — číslo a název
            { lead: '02', label: 'Sociální sítě' },
            { lead: '03', label: 'Branding' },
            { lead: '04', label: 'Webové prvky' },
            // 17–21: statistiky
            { value: '500+', label: 'vytvořených bannerů' },
            { value: '5 let', label: 'zkušeností' },
            { value: '100%', label: 'individuální přístup' },
            { value: '2000+', label: 'hodin tvorby' },
            { value: '∞', label: 'nápadů :D' },
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
            // 3–7: kroky — lead = číslo, note = název, label = text kroku.
            // Text je v `label`, protože tučné fráze jsou zvýraznění a to umí
            // z polí položky jen `label`.
            {
                lead: '01',
                note: 'Seznámení',
                label: 'Začínáme *pochopením vašich cílů*, cílové skupiny a toho, *čeho má grafika dosáhnout*.',
            },
            {
                lead: '02',
                note: 'Koncept',
                label: 'Vizuální směr vychází z barev samotného produktu. Důraz je kladen na *kontrast, detail produktu* a charakter značky.',
            },
            {
                lead: '03',
                note: 'Tvorba',
                label: 'Tvořím s jasným záměrem. *Každý prvek má svou funkci* – zaujmout, komunikovat a podpořit výsledek.',
            },
            {
                lead: '04',
                note: 'Doladění',
                label: 'Na základě zpětné vazby *dolaďuji detaily*, dokud není vše připravené do finální podoby.',
            },
            {
                lead: '05',
                note: 'Předání',
                label: 'Finální grafiku předávám ve všech potřebných formátech, *připravenou pro použití* napříč platformami.',
            },
        ],
        image: PORTRAIT,
        // V pořadí, v jakém je track kreslí: tvorba (3), doladění (1), předání (3).
        // Tentýž soubor smí být v sadě dvakrát — runner ho nahraje jednou.
        gallery: [
            { image: '/assets/banners/jordan_banner4.png', alt: 'Reklamní vizuál pro značku Jordan' },
            { image: '/assets/banners/jordan_banner1.png', alt: 'Varianta vizuálu' },
            { image: '/assets/banners/jordan_banner3.png', alt: 'Varianta vizuálu' },
            { image: '/assets/banners/jordan_banner4.png', alt: 'Doladěná verze vizuálu' },
            { image: '/assets/banners/jordan_banner6.png', alt: 'Formát 1080 × 1920 px, story na výšku' },
            { image: '/assets/banners/jordan_banner1.png', alt: 'Formát 1080 × 1350 px na výšku' },
            { image: '/assets/banners/jordan_banner5.png', alt: 'Čtvercový formát 1080 × 1080 px, 1:1' },
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
            // 3: recenze — label = text, value = jméno, note = role.
            // ZÁSTUPNÁ podle návrhu, před spuštěním nahradit skutečnou.
            {
                label: 'Sabina úplně proměnila náš vizuální styl. Bannery nejenom skvěle vypadají, ale hlavně přinášejí výsledky. Komunikace byla bez zádrhelů, termíny sedly a *dopad byl skutečný*.',
                value: 'Lucie K.',
                note: 'Brand manažerka, LUNE',
            },
            // 4–5: čísla pod recenzí (zástupná)
            { value: '100+', label: 'Odevzdaných bannerů' },
            { value: '50+', label: 'Spokojených klientů' },
            // 6–7: claim v patě sekce, dva řádky
            { label: 'Design, který *spojuje*,' },
            { label: 'mluví a prodává.' },
        ],
        image: PORTRAIT,
        gallery: [
            { image: '/assets/banners/bruzek_banner1.png', alt: 'Bannerová kampaň pro realitní značku Bruzek' },
            { image: '/assets/banners/vlnenezbozi_banner1.png', alt: 'Bannerová kampaň pro e-shop Wooline' },
            { image: '/assets/banners/mistrpet_banner3.png', alt: 'Bannerová kampaň pro e-shop Mistr Pet' },
        ],
    },
]
