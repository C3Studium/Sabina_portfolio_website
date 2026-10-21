// Typy obsahu, které tenhle web má.
//
// Typ je jméno, titulek a pole. Studio z toho staví editor, server proti tomu
// validuje a web přes to čte — takže pole, které tu není, neexistuje nikde.
//
// Dva typy si veze knihovna a jsou tu proto převzaté, ne deklarované znovu:
//
//   siteCopy  bloky textu na stránkách. Na něm stojí `copy: 'index'`
//             v konfiguraci — stránka tím říká "všechny bloky s page: 'index'".
//   review    recenze i s moderací a hlasy.
//
// Deklarovat vlastní typ stejného jména není přejmenování, ale kolize: registr
// je odmítne, protože `cms_document.type` je v databázi holý řetězec a dvě
// deklarace téhož jména by od sebe nešly rozeznat.
//
// Vlastní typy musí projít přes `defineType` a `defineField`. Holý objekt se
// stejnými klíči vypadá stejně a projde i čtením, ale zápis na něm spadne:
// pole si nese chování (viditelnost, práva, validaci), ne jen data.
import { defineField, defineType } from '@c3studium/valecms/core'
import siteCopy from '@c3studium/valecms/schemas/siteCopy.js'
import review from '@c3studium/valecms/schemas/review.js'

// Příklad vlastního typu — smaž ho nebo přepiš.
const clanek = defineType({
    name: 'clanek',
    title: 'Článek',
    fields: [
        defineField({
            name: 'title',
            title: 'Nadpis',
            type: 'string',
            validation: (rule) => rule.required().max(200),
        }),
        defineField({ name: 'perex', title: 'Perex', type: 'text' }),
    ],
})

// Projekt portfolia — jeden záznam je jedna karta na /projects a zároveň jedna
// stránka /projects/[slug]. Dokument, ne blok textu: seznam se generuje z toho,
// co je publikované, a adresa vzniká ze `slug` (viz `paths` v cms/projects.ts).
//
// `tone` a `order` nejsou obsah, ale rozvržení karty a její pořadí v řadě — jsou
// tu proto, že bez nich by web po seedu nevypadal stejně jako z konstanty.
const project = defineType({
    name: 'project',
    title: 'Projekt',
    icon: 'image',
    fields: [
        defineField({
            name: 'title',
            title: 'Název',
            type: 'string',
            description: 'Jméno značky nebo projektu, jak stojí na kartě.',
            validation: (rule) => rule.required().max(120),
        }),
        defineField({
            name: 'slug',
            title: 'Adresa',
            type: 'slug',
            description: 'Konec adresy /projects/…. Po zveřejnění neměnit — odkazy by přestaly platit.',
            options: { source: 'title', prefix: '/projects/' },
            // Adresa je vytištěná věc: chybu v ní vidí návštěvník, ne editor.
            adminOnly: true,
            validation: (rule) => rule.required().max(80),
        }),
        defineField({
            name: 'tagline',
            title: 'Podtitul',
            type: 'string',
            description: 'Krátká řádka pod názvem — typ zakázky, např. „Bannerová kampaň“.',
            validation: (rule) => rule.max(120),
        }),
        defineField({
            name: 'perex',
            title: 'Perex',
            type: 'text',
            description: 'Úvod case study, pár vět. Prázdné = detail ukáže jen název a obrázek.',
            validation: (rule) => rule.max(600),
        }),
        defineField({
            name: 'body',
            title: 'Text',
            type: 'richText',
            description: 'Volitelný delší text case study.',
        }),
        defineField({
            name: 'cover',
            title: 'Hlavní obrázek',
            type: 'image',
            description: 'Vizuál na kartě i v hlavičce detailu.',
        }),
        defineField({
            name: 'gallery',
            title: 'Galerie',
            type: 'array',
            of: [{ type: 'image' }],
            description: 'Další vizuály projektu, v pořadí zobrazení.',
            validation: (rule) => rule.max(24),
        }),
        defineField({
            name: 'tone',
            title: 'Tón karty',
            type: 'select',
            options: { list: [{ value: 'dark', title: 'Tmavá' }, { value: 'light', title: 'Světlá' }] },
            initialValue: 'dark',
            description: 'Řada karet střídá tmavou a světlou.',
        }),
        defineField({
            name: 'order',
            title: 'Pořadí',
            type: 'number',
            initialValue: 100,
            description: 'Menší číslo = dřív v řadě.',
            validation: (rule) => rule.integer().min(0),
        }),
        // Značka seedu, ne obsah: scripts/cms-seed.mjs pozná už založený dokument
        // jen podle `data.key`. Skryté, aby se editorovi neplétlo mezi pole;
        // dokument založený ve Studiu ji nemá a nic mu nechybí.
        defineField({ name: 'key', title: 'Klíč seedu', type: 'string', hidden: true }),
    ],
    preview: (doc: Record<string, unknown>) => ({
        title: doc.title,
        subtitle: doc.tagline,
        media: doc.cover ?? null,
    }),
})

export const types = [siteCopy, review, clanek, project]

// Typ, o kterém se píšou recenze (např. 'consultant'), nebo null.
export const reviewSubjectType = null
