#!/usr/bin/env node
/**
 * Projektům BEZ případové studie doplní šablonu studie (záložka „Případová
 * studie" ve Studiu) — stejnou kostru, jakou má nová studie: titulní
 * kapitola s díly, kapitoly Zadání / Kampaně / Značka s obecným textem a
 * závěrečná výzva. Stránka /projects/<slug> se tím přepne z dosavadního
 * detailu na plátno studie; texty si Sabina upraví ve Study Cases.
 *
 *     node --import @c3studium/valecms/register.mjs scripts/cms-studies-template.mjs            plán
 *     node --import @c3studium/valecms/register.mjs scripts/cms-studies-template.mjs --write    zápis
 *     … --only=gummylife
 *
 * - Sahá jen na pole `study*`, která jsou prázdná; ostatní pole projektu
 *   nemění. Projekt s vyplněnou titulní kapitolou přeskočí.
 * - Díla bere z knihovny médií (id) — nic se nenahrává dvakrát; pár souborů
 *   z public/assets/banners nahraje do knihovny.
 * - Kapitoly 2–4 díla nemají — plátno jim půjčí díla titulní kapitoly
 *   (src/lib/site/study.ts), ať je co ukazovat, než je Sabina doplní.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const loadEnvFile = () => {
    for (const name of ['.env.local', '.env']) {
        const file = path.join(ROOT, name)
        if (!fs.existsSync(file)) continue
        for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
            const trimmed = line.trim()
            if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue
            const at = trimmed.indexOf('=')
            const key = trimmed.slice(0, at).trim()
            if (!(key in process.env)) process.env[key] = trimmed.slice(at + 1).trim().replace(/^["']|["']$/g, '')
        }
    }
}
loadEnvFile()

const write = process.argv.includes('--write')
const only = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7)

const { getAdminClient } = await import('@c3studium/valecms/server/supabaseAdmin.js')
const { createMediaRepository, createStorageFromEnv } = await import('@c3studium/valecms/server')

const client = getAdminClient()
const media = createMediaRepository({ client, storage: createStorageFromEnv() })

/* --------------------------------------------------------------- díla -- */

// Díla titulní kapitoly: `media` = id v knihovně médií, `file` = soubor
// v public (nahraje se). Název a štítek jsou obecné — podle formátu; Sabina
// je ve Studiu přepíše.
const TEMPLATES = {
    gummylife: {
        works: [
            { media: '8bcba159-203e-45f8-a4a7-48f0f40f02f2' },
            { fallbackName: 'n2-denik-4-5' },
            { fallbackName: 'gummylife-banner1' },
        ],
    },
    gummyplus: {
        works: [{ media: 'd78aadab-73a5-45a7-b999-4a600bccd9e1' }, { fallbackName: '2-slevova-akce-4-5-1' }, { fallbackName: '1-slevova-akce-9-16' }],
    },
    dogoteka: {
        works: [{ media: '6d20ad70-1068-411f-afc9-4992f644875e' }],
    },
    wooline: {
        works: [
            { media: '4fdf5d85-b444-44de-b706-45cb1f344fa3' },
            { file: '/assets/banners/vlnenezbozi_banner10.png' },
            { file: '/assets/banners/vlnenezbozi_banner11.png' },
        ],
    },
    samurai: {
        works: [{ media: 'f4c2b3b3-f3f4-4445-9963-b3e17623ab00' }, { file: '/assets/banners/samurai_banner2.png' }, { file: '/assets/banners/samurai_banner3.png' }],
    },
}

const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' }
const formatOf = (w, h) => (w === h ? 'Čtverec' : h / w > 1.6 ? 'Story' : 'Post')
const ref = (row, alt) => ({ id: row.id, url: row.url, alt: row.alt || alt || '', width: row.width, height: row.height })

// Knihovna médií: podle id, nebo podle části názvu souboru (bez archivu).
const { data: library, error: mediaError } = await client.from('cms_media').select('id, url, alt, width, height, path').is('archived_at', null)
if (mediaError) {
    console.error('Čtení knihovny médií selhalo:', mediaError.message)
    process.exit(1)
}
const byId = (id) => library.find((m) => m.id === id)
const byName = (part) => library.find((m) => (m.path || '').includes(part))

const uploaded = new Map()
const upload = async (file, alt) => {
    if (uploaded.has(file)) return uploaded.get(file)
    const abs = path.join(ROOT, 'public', file.replace(/^\//, ''))
    const existing = byName(path.basename(file, path.extname(file)).replace(/_/g, '-'))
    if (existing) return ref(existing, alt)
    if (!write) return { id: null, url: file, alt, width: 0, height: 0 }
    const row = await media.upload({ buffer: fs.readFileSync(abs), filename: path.basename(file), mime: MIME[path.extname(file).toLowerCase()] }, { alt })
    const out = ref(row, alt)
    uploaded.set(file, out)
    return out
}

const worksOf = async (slug, title) => {
    const out = []
    for (const spec of TEMPLATES[slug].works) {
        let row = spec.media ? byId(spec.media) : null
        if (!row && spec.fallbackName) row = byName(spec.fallbackName)
        const alt = `${title} — reklamní vizuál`
        const image = row ? ref(row, alt) : spec.file ? await upload(spec.file, alt) : null
        if (!image) {
            console.log(`  ! dílo nenalezeno: ${JSON.stringify(spec)}`)
            continue
        }
        const format = image.width && image.height ? formatOf(image.width, image.height) : 'Vizuál'
        out.push({ image, tag: format, name: `${title} · ${format.toLowerCase()}` })
    }
    return out
}

/* ------------------------------------------------------------- šablona -- */

const fieldsOf = (title, tagline, works) => ({
    studyKind: tagline || 'Reklamní bannery',
    studyMeta: [],
    studyCover: {
        text: `Série **reklamních vizuálů pro ${title}** – ${(tagline || 'reklamní bannery').toLowerCase()}. Jednotný vizuální styl, jasné sdělení a formáty pro sociální sítě i web.`,
        asides: [`**${works.length} ${works.length === 1 ? 'vizuál' : works.length < 5 ? 'vizuály' : 'vizuálů'}** ve formátech pro sociální sítě.`],
        works,
    },
    studyStack: {
        label: 'Zadání',
        heading: '*Jasné zadání,*\njeden cíl',
        text: '**Každý vizuál vychází z jednoho sdělení a jednoho cíle** – zaujmout správného zákazníka a dovést ho k akci.\n\nNa začátku stojí **zadání, cílová skupina a tón značky**; teprve potom vzniká kompozice, nadpis a výzva.',
        asides: ['**Sdělení:** jeden nadpis, jedna nabídka.', '**Akce:** jedno tlačítko, jasná výzva.'],
        works: [],
    },
    studyStrip: {
        label: 'Kampaně',
        heading: '*Od novinky*\npo akci',
        text: 'Jedna vizuální kostra, **různé příležitosti** – představení produktu, sezónní nabídka i slevová akce. **Stejná značka, pokaždé jiný důvod kliknout.**',
        asides: ['**Stejná kostra,** jiná nabídka.'],
        works: [],
    },
    studyRing: {
        label: 'Značka',
        heading: '*Jednotný*\nvizuální styl',
        text: 'Všechny výstupy drží **jednotný vizuální styl** – barvy, typografii a kompozici značky – a zároveň fungují samostatně v každém formátu. **Značka je na první pohled k poznání.**',
        asides: ['**Konzistence:** poznat na první pohled.'],
        works: [],
    },
    studyOutputs: [],
    studyCta: {
        lead: `Projekt ${title} je hotový.`,
        leadAccent: 'Další studie může být ta vaše.',
        button: 'Začněme spolu',
        status: 'Odpovím do *24 hodin*',
    },
})

const empty = (v) => v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length) || (typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length)

/* ------------------------------------------------------------ dokumenty -- */

const { data: rows, error } = await client.from('cms_document').select('id, data, draft, status').eq('type', 'project')
if (error) {
    console.error('Čtení selhalo:', error.message)
    process.exit(1)
}

let failed = 0
let writes = 0
for (const doc of rows) {
    const slug = doc.data?.slug
    if (!slug || !TEMPLATES[slug]) continue
    if (only && slug !== only) continue
    console.log(`\n▍ ${slug} — ${doc.data.title} (${doc.status})`)
    if (doc.data.studyCover?.works?.length) {
        console.log('  ✓ studie už má titulní díla, nesahám')
        continue
    }
    const works = await worksOf(slug, doc.data.title)
    if (!works.length) {
        console.log('  ✗ žádná díla — studie by se nevykreslila, přeskakuji')
        failed += 1
        continue
    }
    const fields = fieldsOf(doc.data.title, doc.data.tagline, works)
    const next = { ...doc.data }
    const changed = []
    for (const [name, value] of Object.entries(fields)) {
        if (!empty(doc.data[name])) {
            console.log(`  ✓ ${name} — už vyplněné, nesahám`)
            continue
        }
        next[name] = value
        changed.push(name)
    }
    console.log(`  + ${changed.join(', ')} (${works.length} díla: ${works.map((w) => w.tag).join(', ')})`)
    if (doc.draft) console.log('  ! Projekt má rozepsaný koncept — pole jdou do publikované verze, koncept zůstane.')
    if (!changed.length) continue
    writes += 1
    if (!write) continue
    const { error: updateError } = await client.from('cms_document').update({ data: next, updated_at: new Date().toISOString() }).eq('id', doc.id)
    if (updateError) {
        console.error(`  ✗ ${updateError.message}`)
        failed += 1
    }
}

console.log('')
if (!writes) console.log('Všechno je na místě. Nic k zápisu.')
else if (!write) console.log(`Nic jsem nezapsal. Spusť s --write (${writes} projektů).`)
else console.log(`Hotovo: ${writes - failed} projektů zapsáno, ${uploaded.size} obrázků nahráno${failed ? `, ${failed} selhalo` : ''}.`)
process.exitCode = failed ? 1 : 0
