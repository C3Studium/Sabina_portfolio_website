// Poptávka (kontaktní formulář) — modul „Poptávka" ve Studiu: pět kroků
// (otázka + možnosti s ikonou) a poslední krok Kontakt. Stejné texty, jaké
// má formulář v kódu (contact-modal/brief.tsx), aby se po seedu nic nezměnilo
// a klientka je mohla upravovat ve Studiu.
//
// Ikony: jména z contact-modal/brief-icon-names.ts; 'auto' = podle názvu.

const step = (key, order, label, title, hint, options, multi = false) => ({
    type: 'briefStep',
    key,
    order,
    label,
    title,
    hint,
    multi,
    options: options.map(([label, icon]) => ({ label, icon })),
})

export const blocks = [
    step('brief.who', 1, 'Kdo jste', 'Pro koho budu pracovat?', 'Ať vím, jak velký projekt to bude a kdo bude schvalovat.', [
        ['Firma', 'firma'],
        ['E-shop', 'eshop'],
        ['Startup', 'startup'],
        ['Agentura', 'agentura'],
        ['Osobní značka', 'osobni'],
        ['Něco jiného', 'hvezda'],
    ]),
    step(
        'brief.what',
        2,
        'Co potřebujete',
        'S čím vám mám pomoct?',
        'Klidně víc věcí najednou.',
        [
            ['Bannerová kampaň', 'banner'],
            ['Obsah pro sociální sítě', 'socialni'],
            ['Vizuály pro e-shop', 'vizualy'],
            ['Kompletní vizuální identita', 'identita'],
            ['Něco jiného', 'hvezda'],
        ],
        true,
    ),
    step(
        'brief.have',
        3,
        'Podklady',
        'Co už máte připravené?',
        'Podle toho poznám rozsah — a co vám můžu dodat navíc.',
        [
            ['Logo a barvy značky', 'logo'],
            ['Fotky produktů', 'fotky'],
            ['Texty', 'texty'],
            ['Inspiraci nebo vzory', 'inspirace'],
            ['Zatím nic, začínáme od nuly', 'nic'],
        ],
        true,
    ),
    step('brief.when', 4, 'Termín', 'Kdy to potřebujete?', 'Na spěchající projekty si najdu místo, jen to vím dopředu.', [
        ['Co nejdřív', 'nejdriv'],
        ['Do 2 týdnů', 'tydny'],
        ['Do měsíce', 'mesic'],
        ['Nespěchá', 'nespecha'],
    ]),
    step('brief.budget', 5, 'Rozpočet', 'S jakým rozpočtem počítáte?', 'Orientačně — pomůže mi navrhnout rozsah, který dává smysl.', [
        ['Do 10 000 Kč', 'penize'],
        ['10–30 tisíc Kč', 'penize'],
        ['30–80 tisíc Kč', 'penize'],
        ['Přes 80 tisíc Kč', 'penize'],
        ['Zatím nevím, poraďte', 'nevim'],
    ]),
    {
        type: 'briefContact',
        key: 'brief.contact',
        title: 'Komu se mám ozvat?',
        channels: [
            { label: 'Zavolejte mi', kind: 'call' },
            { label: 'Napište e-mail', kind: 'email' },
            { label: 'Zpráva na WhatsApp', kind: 'whatsapp' },
        ],
        doneTitle: 'Díky, {jméno}. Poptávka je u mě.',
        doneText: 'Projdu ji a ozvu se — {jak} obvykle do 24 hodin.',
    },
]
