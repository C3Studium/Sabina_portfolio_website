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

export const types = [siteCopy, review, clanek]

// Typ, o kterém se píšou recenze (např. 'consultant'), nebo null.
export const reviewSubjectType = null
