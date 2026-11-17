// Přepíše e-mail v bloku „Kontakt" (global.contact, položka „Napište mi")
// přímo v databázi CMS — ať je na webu hned a klientka ho nemusí měnit
// ve Studiu sama.
//
//     pnpm run cms:contact-email                 jen ukáže, co by změnil
//     pnpm run cms:contact-email -- --write      zapíše
//
// Spouští se jako ostatní cms:* skripty (node --import @c3studium/valecms/register.mjs).
// Položky bloku se adresují pořadím — stejné jako LINES v
// components/layout/contact-modal/index.tsx (channelsFrom = 2, e-mail = 3).

const NEW_EMAIL = 'sabina@sgrafika.cz'
const MAIL_INDEX = 3
const write = process.argv.includes('--write')

const { getAdminClient } = await import('@c3studium/valecms/server/supabaseAdmin.js')
const client = getAdminClient()

const { data: rows, error } = await client.from('cms_document').select('id, type, status, data').eq('type', 'siteCopy').limit(1000)
if (error) {
    console.error('Čtení selhalo:', error.message)
    process.exit(1)
}
const doc = (rows || []).find((r) => r?.data?.key === 'global.contact')
if (!doc) {
    console.log('Blok global.contact v databázi není — web používá zálohu z kódu (už s novým e-mailem).')
    process.exit(0)
}
const items = Array.isArray(doc.data.items) ? doc.data.items : []
const item = items[MAIL_INDEX]
console.log(`global.contact (${doc.id}, ${doc.status}): položka ${MAIL_INDEX} = ${JSON.stringify(item)}`)
if (!item || !/mail|napište|e-?mail/i.test(`${item.label} ${item.value}`)) {
    console.error('Položka na pozici 3 nevypadá jako e-mail — nic nepřepisuji.')
    process.exit(1)
}
if (item.value === NEW_EMAIL) {
    console.log('Už je nastavený, není co měnit.')
    process.exit(0)
}
console.log(`→ ${item.value} se změní na ${NEW_EMAIL}`)
if (!write) {
    console.log('Nic jsem nezapsal. Spusť s --write.')
    process.exit(0)
}
const next = { ...doc.data, items: items.map((it, i) => (i === MAIL_INDEX ? { ...it, value: NEW_EMAIL } : it)) }
const { error: updateError } = await client.from('cms_document').update({ data: next }).eq('id', doc.id)
if (updateError) {
    console.error('Zápis selhal:', updateError.message)
    process.exit(1)
}
console.log('Zapsáno.')
