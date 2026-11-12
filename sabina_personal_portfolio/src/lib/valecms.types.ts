// Typy obsahu, které tenhle web má.
//
// Typ je jméno, titulek a pole. Studio z toho staví editor, server proti tomu
// validuje a web přes to čte — takže pole, které tu není, neexistuje nikde.
//
// Dva typy si veze knihovna a jsou tu proto převzaté, ne deklarované znovu:
//
//   siteCopy  bloky textu na stránkách. Na něm stojí `copy: 'index'`
//             v konfiguraci — stránka tím říká "všechny bloky s page: 'index'".
//   review    recenze i s moderací a hlasy. Tenhle web ho NEPOUŽÍVÁ: je to
//             fronta ke schválení recenzí z formuláře (poradci, benefit
//             program), kdežto tady jsou reference, které zapisuje Sabina
//             sama — se jménem, logem a hvězdičkami. Proto vlastní typ
//             `reference` níž a `reviews: false` v konfiguraci, které modul
//             recenzí ze Studia schová. Ze schémat se `review` nemaže: server
//             ho zná a nic dalšího se tím nemění.
//
// Deklarovat vlastní typ stejného jména není přejmenování, ale kolize: registr
// je odmítne, protože `cms_document.type` je v databázi holý řetězec a dvě
// deklarace téhož jména by od sebe nešly rozeznat.
//
// Vlastní typy musí projít přes `defineType` a `defineField`. Holý objekt se
// stejnými klíči vypadá stejně a projde i čtením, ale zápis na něm spadne:
// pole si nese chování (viditelnost, práva, validaci), ne jen data.
//
// `module` (od valecms 0.1.55) dává víc typů pod jednu položku menu Studia
// a typy v ní ukáže jako záložky — tak je „Nabídka" jedna věc se dvěma
// záložkami, Stack a Stats. `groups` jsou záložky UVNITŘ jednoho dokumentu —
// tak má projekt kartu a detail stránky zvlášť.
import { defineField, defineType } from '@c3studium/valecms/core'
import siteCopy from '@c3studium/valecms/schemas/siteCopy.js'
import review from '@c3studium/valecms/schemas/review.js'

// Pořadí v řadě — u všech typů stejně: menší číslo = dřív.
const order = (group?: string) =>
    defineField({
        name: 'order',
        title: 'Pořadí',
        type: 'number',
        ...(group ? { group } : {}),
        initialValue: 100,
        description: 'Menší číslo = dřív v řadě.',
        validation: (rule) => rule.integer().min(0),
    })

// Značka seedu, ne obsah: scripts/cms-seed.mjs pozná už založený dokument jen
// podle `data.key`. Skrytá, aby se editorovi neplétla mezi pole; dokument
// založený ve Studiu ji nemá a nic mu nechybí.
// U typu se záložkami musí sedět v jedné z nich, jinak Studio založí záložku
// „Ostatní" jen kvůli poli, které nikdo nevidí.
const seedKey = (group?: string) =>
    defineField({ name: 'key', title: 'Klíč seedu', type: 'string', hidden: true, ...(group ? { group } : {}) })

// Seznam ve Studiu ve stejném pořadí jako na webu.
const BY_ORDER = [{ name: 'order', title: 'Podle pořadí', by: [{ field: 'order', direction: 'asc' }] }]

/* ------------------------------------------------------ případová studie -- */

// Případová studie projektu (components/study) — záložka „Případová studie"
// v projektu. Plátno má pět zastávek: Titulní, tři kapitoly a Výstupy
// (editor) a na konci výzvu. Kapitoly mají pevné rozvržení (balíček karet,
// pás, kolotoč), obsah je volný: nadpis, text, krátké poznámky a díla.
//
// Text: odstavce odděluje prázdný řádek, **dvě hvězdičky** = tučně,
// *jedna* = zeleně. Stejná úmluva jako hvězdičky v blocích textů.
// Studie se na stránce projektu ukáže, jakmile má Titulní aspoň jedno dílo.
const STUDY_TEXT = 'Odstavce oddělte prázdným řádkem. **Dvě hvězdičky** = tučně, *jedna* = zeleně.'

const studyWork = {
    type: 'object',
    name: 'work',
    title: 'Dílo',
    fields: [
        defineField({ name: 'image', title: 'Obrázek', type: 'image', validation: (rule) => rule.required() }),
        defineField({
            name: 'name',
            title: 'Název',
            type: 'string',
            description: 'Např. „Jarní novinky".',
            validation: (rule) => rule.required().max(60),
        }),
        defineField({
            name: 'tag',
            title: 'Druh',
            type: 'string',
            description: 'Krátký štítek — „Kolekce", „Sleva", „Story". V pásu kampaní řadí díla do skupin.',
            validation: (rule) => rule.max(30),
        }),
    ],
}

const studyWorks = (max: number, description: string) =>
    defineField({
        name: 'works',
        title: 'Díla',
        type: 'array',
        of: [studyWork],
        description,
        validation: (rule) => rule.max(max),
    })

const studyNotes = () => defineField({
    name: 'asides',
    title: 'Poznámky přes díla',
    type: 'array',
    of: [{ type: 'string' }],
    description: 'Krátké postřehy nalepené přes díla (lístek s páskou), nejvýš dva. ' + '**Tučně** jde i tady.',
    validation: (rule) => rule.max(2),
})

const studyText = () => defineField({
    name: 'text',
    title: 'Text',
    type: 'text',
    options: { rows: 6 },
    description: `Vypisuje se pod nadpisem. ${STUDY_TEXT}`,
    validation: (rule) => rule.max(1200),
})

// Kapitola: štítek v liště, dvoubarevný nadpis, text, poznámky, díla.
const studyChapter = (name: string, title: string, layout: string, works: { max: number; help: string }) =>
    defineField({
        name,
        title,
        type: 'object',
        group: 'studie',
        description: layout,
        fields: [
            defineField({
                name: 'label',
                title: 'Štítek kapitoly',
                type: 'string',
                description: 'Krátce — v liště kapitol a nad nadpisem, např. „Pro rodiče".',
                validation: (rule) => rule.max(30),
            }),
            defineField({
                name: 'heading',
                title: 'Nadpis',
                type: 'text',
                options: { rows: 2 },
                description: 'Každý řádek nadpisu na vlastním řádku (verzálkami). *Řádek v hvězdičkách* = zeleně, např. „*Hravé,*" a pod ním „ale pro rodiče".',
                validation: (rule) => rule.max(140),
            }),
            studyText(),
            studyNotes(),
            studyWorks(works.max, works.help),
        ],
    })

/* ---------------------------------------------------------------- projekty -- */

// Projekt portfolia — jeden záznam je jedna karta na úvodní stránce a na
// /projects a zároveň jedna stránka /projects/[slug]. Dvě záložky: „Karta" je
// to, co je vidět v řadě (název, náhled), „Detail stránky" to, co je na jeho
// vlastní stránce.
const project = defineType({
    name: 'project',
    title: 'Projekty',
    icon: 'image',
    groups: [
        { name: 'karta', title: 'Karta', default: true },
        { name: 'detail', title: 'Detail stránky' },
        { name: 'studie', title: 'Případová studie' },
    ],
    orderings: BY_ORDER,
    fields: [
        defineField({
            name: 'title',
            title: 'Název',
            type: 'string',
            group: 'karta',
            description: 'Jméno značky nebo projektu, jak stojí na kartě.',
            validation: (rule) => rule.required().max(120),
        }),
        defineField({
            name: 'cover',
            title: 'Náhled',
            type: 'image',
            group: 'karta',
            description: 'Obrázek karty — na úvodní stránce, v řadě projektů i v hlavičce detailu.',
        }),
        defineField({
            name: 'slug',
            title: 'Adresa',
            type: 'slug',
            group: 'karta',
            description:
                'Konec adresy /projects/…. Prázdné = vytvoří se samo z názvu. Po zveřejnění neměnit — odkazy by přestaly platit.',
            options: { source: 'title', prefix: '/projects/' },
            validation: (rule) => rule.max(80),
        }),
        defineField({
            name: 'tagline',
            title: 'Podtitul',
            type: 'string',
            group: 'karta',
            description: 'Krátká řádka pod názvem — typ zakázky, např. „Bannerová kampaň".',
            validation: (rule) => rule.max(120),
        }),
        defineField({
            name: 'featured',
            title: 'Na úvodní stránce',
            type: 'boolean',
            group: 'karta',
            initialValue: false,
            description: 'Karta v galerii úvodní stránky. Vejdou se čtyři, berou se podle pořadí.',
        }),
        defineField({
            name: 'cardCta',
            title: 'Text tlačítka na kartě',
            type: 'string',
            group: 'karta',
            description: 'Na úvodní stránce, např. „Zjistit víc". Prázdné = „Zjistit víc".',
            validation: (rule) => rule.max(40),
        }),
        defineField({
            name: 'tone',
            title: 'Tón karty',
            type: 'select',
            group: 'karta',
            options: { list: [{ value: 'dark', title: 'Tmavá' }, { value: 'light', title: 'Světlá' }] },
            initialValue: 'dark',
            description: 'Řada karet na /projects střídá tmavou a světlou.',
        }),
        order('karta'),
        defineField({
            name: 'perex',
            title: 'Popis',
            type: 'text',
            group: 'detail',
            description: 'Úvod case study, pár vět. Prázdné = detail ukáže jen název a obrázek.',
            validation: (rule) => rule.max(600),
        }),
        defineField({
            name: 'goals',
            title: 'Cíle',
            type: 'array',
            group: 'detail',
            of: [{ type: 'string' }],
            description: 'Čeho měl projekt dosáhnout — jeden cíl na položku, např. „Zvýšit proklik bannerů".',
            validation: (rule) => rule.max(8),
        }),
        defineField({
            name: 'shared',
            title: 'Co mohu ukázat',
            type: 'array',
            group: 'detail',
            of: [{ type: 'string' }],
            description:
                'Detaily, které klient dovolil zveřejnit — jeden na položku, např. „Klíčové vizuály kampaně". Ukazují se pod scénou na stránce Projekty u aktivního projektu.',
            validation: (rule) => rule.max(6),
        }),
        defineField({
            name: 'body',
            title: 'Text',
            type: 'richText',
            group: 'detail',
            description: 'Volitelný delší text case study.',
        }),
        defineField({
            name: 'gallery',
            title: 'Galerie',
            type: 'array',
            group: 'detail',
            of: [{ type: 'image' }],
            description: 'Další vizuály projektu, v pořadí zobrazení.',
            validation: (rule) => rule.max(24),
        }),
        /* ---------- Případová studie ---------- */
        defineField({
            name: 'studyKind',
            title: 'Druh práce',
            type: 'string',
            group: 'studie',
            description: 'Pod názvem na titulní zastávce, např. „Reklamní bannery".',
            validation: (rule) => rule.max(60),
        }),
        defineField({
            name: 'studyMeta',
            title: 'Údaje',
            type: 'array',
            group: 'studie',
            of: [
                {
                    type: 'object',
                    name: 'fact',
                    title: 'Údaj',
                    fields: [
                        defineField({ name: 'label', title: 'Popisek', type: 'string', validation: (rule) => rule.required().max(30) }),
                        defineField({ name: 'value', title: 'Hodnota', type: 'string', validation: (rule) => rule.required().max(60) }),
                    ],
                },
            ],
            description: 'Řádek údajů pod názvem — Klient, Rok, Rozsah, Formáty…',
            validation: (rule) => rule.max(5),
        }),
        defineField({
            name: 'studyCover',
            title: 'Titulní',
            type: 'object',
            group: 'studie',
            description: 'Velký název vlevo, vpravo díla do hloubky (vpředu poslední).',
            fields: [studyText(), studyNotes(), studyWorks(3, 'Tři díla do hloubky — nejlépe story. Vpředu je poslední.')],
        }),
        studyChapter('studyStack', 'Kapitola 2 — balíček karet', 'Díla vlevo jako balíček karet, nadpis a text vpravo.', {
            max: 6,
            help: 'Karty balíčku, 3–5 je ideál.',
        }),
        studyChapter('studyStrip', 'Kapitola 3 — pás', 'Nadpis vlevo, text vpravo, přes celou šířku pás děl a pod ním mapa druhů.', {
            max: 14,
            help: 'Díla v pořadí pásu. Stejný „Druh" za sebou = jedna skupina v mapě.',
        }),
        studyChapter('studyRing', 'Kapitola 4 — kolotoč', 'Kolotoč děl vlevo, nadpis a text vpravo.', {
            max: 6,
            help: 'Díla na kolotoči, 3–5 je ideál.',
        }),
        defineField({
            name: 'studyOutputs',
            title: 'Výstupy',
            type: 'array',
            group: 'studie',
            of: [
                {
                    type: 'object',
                    name: 'output',
                    title: 'Výstup',
                    fields: [
                        defineField({ name: 'image', title: 'Obrázek', type: 'image', validation: (rule) => rule.required() }),
                        defineField({ name: 'caption', title: 'Název', type: 'string', validation: (rule) => rule.max(60) }),
                    ],
                },
            ],
            description: 'Všechny formáty do editoru na konci — libovolné tvary. Formát (Story / Post / Banner) a rozměr se dopočítají.',
            validation: (rule) => rule.max(40),
        }),
        defineField({
            name: 'studyCta',
            title: 'Výzva na konci',
            type: 'object',
            group: 'studie',
            description: 'Po oddálení na celé plátno: věta, velké tlačítko (otevře kontakt) a stav.',
            fields: [
                defineField({ name: 'lead', title: 'Věta', type: 'string', description: 'Např. „Věcičky jsou hotové."', validation: (rule) => rule.max(80) }),
                defineField({ name: 'leadAccent', title: 'Věta — zvýrazněná', type: 'string', description: 'Pod ní tučně, např. „Další studie může být ta vaše."', validation: (rule) => rule.max(80) }),
                defineField({ name: 'button', title: 'Tlačítko', type: 'string', description: 'Dvě slova pod sebou, např. „Začněme spolu".', validation: (rule) => rule.max(30) }),
                defineField({ name: 'status', title: 'Stav', type: 'string', description: 'Např. „Odpovím do *24 hodin*".', validation: (rule) => rule.max(60) }),
            ],
        }),
        seedKey('karta'),
    ],
    preview: (doc: Record<string, unknown>) => ({
        title: doc.title,
        subtitle: doc.tagline,
        media: doc.cover ?? null,
    }),
})

/* -------------------------------------------------------------- 3D vizuály -- */

// Vizuál rozložený na vrstvy pro detail díla (pohled Vrstvy). Dvě cesty:
//   - jen Obrázek: rozloží se sám (hotový rozklad z tools/banner-layers,
//     jinak podle barev přímo v prohlížeči),
//   - Vrstvy: každá vrstva jako PNG s průhledností ve stejném rozměru jako
//     celý vizuál (export vrstev z Figmy), odspodu nahoru.
// Detail díla si vizuál najde podle obrázku — stačí nahrát tentýž soubor.
const LAYER_KINDS = [
    { value: 'background', title: 'Pozadí' },
    { value: 'shape', title: 'Tvar' },
    { value: 'object', title: 'Objekt / fotka' },
    { value: 'text', title: 'Text' },
    { value: 'button', title: 'Tlačítko' },
]

const visual3d = defineType({
    name: 'visual3d',
    title: '3D vizuály',
    icon: 'layers',
    description: 'Vizuály rozložené na vrstvy pro detail díla — buď jen obrázek (rozloží se sám), nebo jednotlivé vrstvy.',
    orderings: BY_ORDER,
    fields: [
        defineField({
            name: 'title',
            title: 'Název',
            type: 'string',
            validation: (rule) => rule.required().max(80),
        }),
        defineField({
            name: 'image',
            title: 'Celý vizuál',
            type: 'image',
            description: 'Tentýž soubor jako dílo ve studii — podle něj se vizuál najde. Bez vrstev se rozloží sám.',
            validation: (rule) => rule.required(),
        }),
        defineField({
            name: 'layers',
            title: 'Vrstvy',
            type: 'array',
            of: [
                {
                    type: 'object',
                    name: 'layer',
                    title: 'Vrstva',
                    fields: [
                        defineField({ name: 'image', title: 'Obrázek vrstvy', type: 'image', description: 'PNG s průhledností, stejný rozměr jako celý vizuál.', validation: (rule) => rule.required() }),
                        defineField({ name: 'name', title: 'Název', type: 'string', description: 'Např. „Nadpis", „Fotka", „Tlačítko".', validation: (rule) => rule.max(40) }),
                        defineField({ name: 'kind', title: 'Druh', type: 'select', options: { list: LAYER_KINDS }, initialValue: 'shape' }),
                    ],
                },
            ],
            description: 'Volitelné. Odspodu nahoru — první je pozadí. Prázdné = rozklad automaticky.',
            validation: (rule) => rule.max(24),
        }),
        order(),
        seedKey(),
    ],
    preview: (doc: Record<string, unknown>) => ({
        title: doc.title,
        subtitle: Array.isArray(doc.layers) && doc.layers.length ? `${doc.layers.length} vrstev` : 'Rozklad automaticky',
        media: doc.image ?? null,
    }),
})

/* ----------------------------------------------------------- zelená slova -- */

// Slova, která mají dvě podoby a přelévají se mezi nimi (TextMorph). Jeden
// dokument = jedno zelené slovo:
//   Úvod   nadpis „Grafika pro *lepší* *výsledky*." — při načtení stránky
//          (preloader) se ukáže druhá podoba a s otevřením se přelije na
//          slovo v nadpisu. Pořadí = pořadí zelených slov v nadpisu.
//   Výzva  „Začněme *váš* projekt" — slovo se dokola přelévá na druhou
//          podobu a zpět.
// Jméno typu zůstává `heroWord` (je v databázi), titulek je obecný.
const WORD_PLACES = [
    { value: 'hero', title: 'Úvod — nadpis' },
    { value: 'cta', title: 'Výzva — nadpis' },
]

const heroWord = defineType({
    name: 'heroWord',
    title: 'Přelévaná slova',
    icon: 'tag',
    description: 'Zelená slova se dvěma podobami — v nadpisu úvodu (při načtení → po otevření) a ve výzvě (dokola).',
    orderings: BY_ORDER,
    fields: [
        defineField({
            name: 'place',
            title: 'Kde',
            type: 'select',
            options: { list: WORD_PLACES },
            initialValue: 'hero',
            description: 'Ve kterém nadpisu slovo stojí.',
        }),
        defineField({
            name: 'final',
            title: 'Slovo v nadpisu',
            type: 'string',
            description: 'Podoba, která v nadpisu stojí (Úvod: po otevření stránky, např. „lepší"; Výzva: „váš").',
            validation: (rule) => rule.required().max(30),
        }),
        defineField({
            name: 'intro',
            title: 'Druhá podoba',
            type: 'string',
            description: 'Úvod: slovo při načtení stránky (např. „větší"), pak se přelije na slovo v nadpisu. Výzva: slovo, na které se nadpis dokola přelévá (např. „náš").',
            validation: (rule) => rule.max(30),
        }),
        order(),
        seedKey(),
    ],
    preview: (doc: Record<string, unknown>) => ({
        title: `${doc.intro || '—'} ↔ ${doc.final || '—'}`,
        subtitle: WORD_PLACES.find((p) => p.value === (doc.place || 'hero'))?.title,
    }),
})

/* ----------------------------------------------------------------- nabídka -- */

// Jeden modul, dvě záložky: nástroje (stack) a statistiky.
const NABIDKA = { name: 'nabidka', title: 'Nabídka', icon: 'layers' }

const stackItem = defineType({
    name: 'stackItem',
    title: 'Stack',
    icon: 'tag',
    module: NABIDKA,
    description: 'Nástroje v sekci „Nástroje, se kterými pracuji".',
    orderings: BY_ORDER,
    fields: [
        defineField({
            name: 'title',
            title: 'Název',
            type: 'string',
            validation: (rule) => rule.required().max(40),
        }),
        defineField({
            name: 'icon',
            title: 'Ikona',
            type: 'image',
            description: 'Malé logo nástroje (ideálně SVG nebo PNG s průhledností). Prázdné = tečka.',
        }),
        order(),
        seedKey(),
    ],
    preview: (doc: Record<string, unknown>) => ({ title: doc.title, media: doc.icon ?? null }),
})

const statItem = defineType({
    name: 'statItem',
    title: 'Stats',
    icon: 'chart',
    module: NABIDKA,
    description: 'Řada čísel pod sekcí služeb.',
    orderings: BY_ORDER,
    fields: [
        defineField({
            name: 'value',
            title: 'Hodnota',
            type: 'string',
            description: 'Číslo i s jednotkou, např. „500+" nebo „5 let".',
            validation: (rule) => rule.required().max(20),
        }),
        defineField({
            name: 'label',
            title: 'Popisek',
            type: 'string',
            validation: (rule) => rule.max(60),
        }),
        defineField({
            name: 'icon',
            title: 'Ikona',
            type: 'image',
            description: 'Do kroužku vlevo od čísla. Prázdné = prázdný kroužek.',
        }),
        order(),
        seedKey(),
    ],
    preview: (doc: Record<string, unknown>) => ({ title: doc.value, subtitle: doc.label, media: doc.icon ?? null }),
})

/* ----------------------------------------------------------------- služby -- */

// Karty „Co nabízím". První (podle pořadí) je rozložená celá, další stojí za
// ní jen s číslem a názvem. „Zobrazit příklady" vede vždy na portfolio, takže
// odkaz není pole.
const service = defineType({
    name: 'service',
    title: 'Služby',
    icon: 'grid',
    orderings: BY_ORDER,
    fields: [
        defineField({
            name: 'title',
            title: 'Název',
            type: 'string',
            description: 'Poslední slovo se na kartě zvýrazní.',
            validation: (rule) => rule.required().max(60),
        }),
        defineField({
            name: 'icon',
            title: 'Obrázek',
            type: 'image',
            description: 'Ikona nebo ilustrace vlevo na kartě.',
        }),
        defineField({
            name: 'lead',
            title: 'Text',
            type: 'text',
            options: { rows: 3 },
            validation: (rule) => rule.max(300),
        }),
        defineField({
            name: 'points',
            title: 'Body',
            type: 'array',
            of: [{ type: 'string' }],
            description: 'Krátké položky seznamu na kartě, např. „Bannery".',
            validation: (rule) => rule.max(8),
        }),
        order(),
        seedKey(),
    ],
    preview: (doc: Record<string, unknown>) => ({
        title: doc.title,
        subtitle: Array.isArray(doc.points) ? doc.points.join(' · ') : '',
        media: doc.icon ?? null,
    }),
})

/* ------------------------------------------------------------------ proces -- */

// Jedna „složka" na úsek sekce Jak probíhá spolupráce: Start (úvod s fotkou)
// a kroky 01–05. Nadpis a úvod sekce zůstávají v bloku textů `index.process`;
// tady je to, co patří ke kroku — název, text, obrázky a ručně psaná poznámka.
//
// `details` jsou drobné texty v kompozici kroku (karta zadání, bubliny chatu,
// popisky formátů). Každý krok je čte po svém, viz komponenta procesu.
const STAGES = [
    { value: 'start', title: 'Start' },
    { value: '01', title: '01' },
    { value: '02', title: '02' },
    { value: '03', title: '03' },
    { value: '04', title: '04' },
    { value: '05', title: '05' },
    { value: '06', title: '06 Další projekty' },
    { value: 'callout', title: 'Výzva (před CTA)' },
]

const processStep = defineType({
    name: 'processStep',
    title: 'Proces',
    icon: 'list',
    description: 'Úseky sekce „Jak probíhá spolupráce" — Start, kroky 01–06 a Výzva před CTA.',
    orderings: [{ name: 'stage', title: 'Podle kroku', by: [{ field: 'stage', direction: 'asc' }] }],
    fields: [
        defineField({
            name: 'stage',
            title: 'Krok',
            type: 'select',
            options: { list: STAGES },
            description: 'Kam na stránce tahle složka patří. Každý krok jednou.',
            validation: (rule) => rule.required(),
        }),
        defineField({
            name: 'title',
            title: 'Název kroku',
            type: 'string',
            description: 'Např. „Seznámení". U Startu se nepoužívá. U Výzvy je to drobný nadtitulek („Pojďme spolupracovat").',
            validation: (rule) => rule.max(40),
        }),
        defineField({
            name: 'text',
            title: 'Text',
            type: 'text',
            options: { rows: 3, mark: 'highlight' },
            description: 'Tučné fráze označ hvězdičkami: „Začínáme *pochopením vašich cílů,* …".',
            validation: (rule) => rule.max(400),
        }),
        defineField({
            name: 'note',
            title: 'Ručně psaná poznámka',
            type: 'text',
            options: { rows: 2 },
            description: 'Anotace se šipkou. Každý řádek zvlášť. U Výzvy jsou to řádky velkého nadpisu (poslední slovo zezelená).',
            validation: (rule) => rule.max(80),
        }),
        defineField({
            name: 'images',
            title: 'Obrázky',
            type: 'array',
            of: [{ type: 'image' }],
            description:
                'Start: portrét. 01: fotka v kartě zadání. 03: tři vizuály. 04: jeden vizuál. 05: tři formáty (story, na výšku, čtverec). 06: banner, fotka na snímku prezentace.',
            validation: (rule) => rule.max(6),
        }),
        defineField({
            name: 'details',
            title: 'Texty v kompozici',
            type: 'array',
            of: [
                {
                    type: 'object',
                    name: 'detail',
                    title: 'Text',
                    fields: [
                        defineField({ name: 'label', title: 'Popisek', type: 'string' }),
                        defineField({ name: 'value', title: 'Hodnota', type: 'string' }),
                    ],
                },
            ],
            description:
                '01: řádky karty zadání (Cíl, Cílová skupina…), pak „Zaměření na" s body. 02: písmo a barvy (hodnota = #hex). 04: zpráva klienta a odpověď. 05: popisky formátů. 06: tři popisky, štítek a nadpis snímku, název, podtitul a monogram značky, pak barvy značky (#hex).',
            validation: (rule) => rule.max(16),
        }),
        seedKey(),
    ],
    preview: (doc: Record<string, unknown>) => ({
        title:
            doc.stage === 'start'
                ? 'Start'
                : doc.stage === 'callout'
                  ? `Výzva ${doc.title ?? ''}`.trim()
                  : `${doc.stage ?? '—'} ${doc.title ?? ''}`.trim(),
        subtitle: typeof doc.note === 'string' ? doc.note.replace(/\n/g, ' ') : '',
        media: Array.isArray(doc.images) ? (doc.images[0] ?? null) : null,
    }),
})

/* -------------------------------------------------------------- reference -- */

// Recenze klientů do výzvy na konci úvodní stránky. Viz poznámka nahoře, proč
// ne knihovní `review`.
const reference = defineType({
    name: 'reference',
    title: 'Recenze',
    icon: 'star',
    orderings: BY_ORDER,
    fields: [
        defineField({
            name: 'name',
            title: 'Jméno',
            type: 'string',
            validation: (rule) => rule.required().max(60),
        }),
        defineField({
            name: 'role',
            title: 'Pozice a firma',
            type: 'string',
            description: 'Např. „Brand manažerka, LUNE".',
            validation: (rule) => rule.max(80),
        }),
        defineField({
            name: 'logo',
            title: 'Logo',
            type: 'image',
            description: 'Do kroužku vedle jména. Prázdné = první slovo z firmy.',
        }),
        defineField({
            name: 'text',
            title: 'Text recenze',
            type: 'text',
            options: { rows: 4, mark: 'highlight' },
            description: 'Zvýrazněnou část označ hvězdičkami: „… a *dopad byl skutečný.*".',
            validation: (rule) => rule.required().max(500),
        }),
        defineField({
            name: 'stars',
            title: 'Hvězdičky',
            type: 'number',
            initialValue: 5,
            validation: (rule) => rule.integer().min(1).max(5),
        }),
        order(),
        seedKey(),
    ],
    preview: (doc: Record<string, unknown>) => ({
        title: doc.name,
        subtitle: doc.role,
        media: doc.logo ?? null,
    }),
})

/* ---------------------------------------------------------- sociální sítě -- */

// Odkazy v patičce „Sledujte mě". Ikona je z kódu podle sítě; vlastní obrázek
// ji přebije (síť, pro kterou ikona v kódu není).
const PLATFORMS = [
    { value: 'instagram', title: 'Instagram' },
    { value: 'linkedin', title: 'LinkedIn' },
    { value: 'behance', title: 'Behance' },
    { value: 'facebook', title: 'Facebook' },
    { value: 'tiktok', title: 'TikTok' },
    { value: 'dribbble', title: 'Dribbble' },
    { value: 'other', title: 'Jiná' },
]

const socialLink = defineType({
    name: 'socialLink',
    title: 'Sociální sítě',
    icon: 'link',
    orderings: BY_ORDER,
    fields: [
        defineField({
            name: 'platform',
            title: 'Síť',
            type: 'select',
            options: { list: PLATFORMS },
            initialValue: 'instagram',
            validation: (rule) => rule.required(),
        }),
        defineField({
            name: 'label',
            title: 'Název',
            type: 'string',
            description: 'Slyší ho čtečka obrazovky. Prázdné = název sítě.',
            validation: (rule) => rule.max(40),
        }),
        defineField({
            name: 'url',
            title: 'Odkaz',
            type: 'url',
            validation: (rule) => rule.required(),
        }),
        defineField({
            name: 'icon',
            title: 'Vlastní ikona',
            type: 'image',
            description: 'Jen když síť v seznamu není. Jinak se použije ikona sítě.',
        }),
        order(),
        seedKey(),
    ],
    preview: (doc: Record<string, unknown>) => ({
        title: doc.label || PLATFORMS.find((p) => p.value === doc.platform)?.title || doc.platform,
        subtitle: doc.url,
        media: doc.icon ?? null,
    }),
})

// Pořadí je pořadí v menu Studia.
export const types = [siteCopy, project, visual3d, heroWord, stackItem, statItem, service, processStep, reference, socialLink, review]

// Typ, o kterém se píšou recenze (např. 'consultant'), nebo null.
export const reviewSubjectType = null
