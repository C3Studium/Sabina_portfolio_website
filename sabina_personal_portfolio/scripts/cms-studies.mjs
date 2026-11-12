#!/usr/bin/env node
/**
 * Přenese případové studie z kódu do Studia — do záložky „Případová studie"
 * projektů Věcičky, Vlněné zboží, VIKIO a Jordan.
 *
 *     pnpm run cms:studies              vypíše plán, nic nezapíše
 *     pnpm run cms:studies -- --write   nahraje bannery a zapíše
 *     pnpm run cms:studies -- --only=vikio
 *
 * - Projekt, který ve Studiu ještě není, založí (publikovaný, s náhledem).
 * - U existujícího doplní jen pole `study*`, která jsou prázdná (rozepsané
 *   úpravy ze Studia nepřepíše); `--force` je přepíše. Ostatních polí se
 *   nedotkne — jen překlep „Věcicky" v názvu opraví na „Věcičky".
 * - Obrázky jdou do knihovny médií; stejný soubor se nenahraje dvakrát.
 *
 * Zdroj: STUDY_TEMPLATE (content.ts) a STUDIES (studies.ts) — tytéž zálohy,
 * které web kreslí bez dat ve Studiu.
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
const force = process.argv.includes('--force')
const only = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7)

const { STUDIES } = await import('../src/components/study/studies.ts')
const { getAdminClient } = await import('@c3studium/valecms/server/supabaseAdmin.js')
const { createMediaRepository, createStorageFromEnv } = await import('@c3studium/valecms/server')

const client = getAdminClient()
const media = createMediaRepository({ client, storage: createStorageFromEnv() })

// Projekty: karta pro nově zakládané (existující se nemění).
const PROJECTS = {
    vecicky: { title: 'Věcičky', tagline: 'Sezónní kampaň', tone: 'light', order: 2, cover: '/assets/banners/vecicky_banner16.png' },
    'vlnene-zbozi': { title: 'Vlněné zboží', tagline: 'Reklamní bannery', tone: 'dark', order: 7, cover: '/assets/banners/vlnenezbozi_banner2.png' },
    vikio: { title: 'VIKIO', tagline: 'Reklamní bannery', tone: 'light', order: 8, cover: '/assets/banners/vikio_banner8.png' },
    jordan: { title: 'Jordan', tagline: 'Reklamní bannery', tone: 'dark', order: 9, cover: '/assets/banners/jordan_banner3.png' },
}

/* ------------------------------------------------------------- převod -- */

// Úseky → úmluva Studia: **tučně**, *zeleně*, odstavce prázdným řádkem.
const markup = (parts) => parts.map(([text, mark]) => (mark === 'bold' ? `**${text}**` : mark === true ? `*${text}*` : text)).join(' ').replace(/\s+([.,;:!?])/g, '$1')
const paragraphs = (list) => list.map(markup).join('\n\n')
// Nadpis: řádek na úsek, zelený v hvězdičkách.
const heading = (parts) => parts.map(([text, mark]) => (mark === true ? `*${text}*` : text)).join('\n')

const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' }
const uploaded = new Map()
const planned = new Set()
const image = async (img) => {
    planned.add(img.src)
    if (!write) return { url: img.src, alt: img.alt, width: img.width, height: img.height }
    if (uploaded.has(img.src)) return uploaded.get(img.src)
    const file = path.join(ROOT, 'public', img.src.replace(/^\//, ''))
    const row = await media.upload(
        { buffer: fs.readFileSync(file), filename: path.basename(file), mime: MIME[path.extname(file).toLowerCase()] },
        { alt: img.alt },
    )
    const ref = { id: row.id, url: row.url, alt: row.alt || img.alt || '' }
    ref.width = Number.isFinite(row.width) ? row.width : img.width
    ref.height = Number.isFinite(row.height) ? row.height : img.height
    uploaded.set(img.src, ref)
    return ref
}

const works = async (list) => Promise.all(list.map(async (w) => ({ image: await image(w.image), name: w.name, tag: w.tag })))

const chapter = async (ch) => ({
    label: ch.label,
    heading: heading(ch.heading),
    text: paragraphs(ch.text),
    asides: ch.asides.map(markup),
    works: await works(ch.works),
})

const fieldsOf = async (study) => {
    const { chapters } = study
    return {
        studyKind: study.kind,
        studyMeta: study.meta.map((m) => ({ label: m.label, value: m.value })),
        studyCover: {
            text: paragraphs(chapters.cover.text),
            asides: chapters.cover.asides.map(markup),
            works: await works(chapters.cover.works),
        },
        studyStack: await chapter(chapters.play),
        studyStrip: await chapter(chapters.campaigns),
        studyRing: await chapter(chapters.trust),
        studyOutputs: await Promise.all(study.outputs.map(async (o) => ({ image: await image(o.image), caption: o.caption }))),
        studyCta: {
            lead: study.cta.lead.filter(([, m]) => m !== true).map(([t]) => t).join(' '),
            leadAccent: study.cta.lead.filter(([, m]) => m === true).map(([t]) => t).join(' '),
            button: study.cta.button,
            status: markup(study.cta.status),
        },
    }
}

const empty = (v) => v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)

/* ------------------------------------------------------------ dokumenty -- */

const { data: rows, error } = await client.from('cms_document').select('id, data, draft').eq('type', 'project')
if (error) {
    console.error('Čtení selhalo:', error.message)
    process.exit(1)
}

let failed = 0
let writes = 0
for (const [slug, study] of Object.entries(STUDIES)) {
    if (only && slug !== only) continue
    console.log(`\n▍ ${slug}`)
    const fields = await fieldsOf(study)
    const doc = rows.find((r) => r.data?.key === `project.${slug}` || r.data?.slug === slug)

    if (!doc) {
        const card = PROJECTS[slug]
        if (!card) {
            console.log('  ✗ projekt ve Studiu není a nevím, jak ho založit')
            failed += 1
            continue
        }
        console.log(`  + nový projekt „${card.title}" se studií`)
        writes += 1
        if (!write) continue
        const cover = await image({ src: card.cover, alt: `${card.title} — ${card.tagline}`, width: 0, height: 0 })
        const data = {
            key: `project.${slug}`,
            title: card.title,
            slug,
            tagline: card.tagline,
            perex: '',
            goals: [],
            shared: [],
            body: '',
            cover,
            gallery: [],
            tone: card.tone,
            order: card.order,
            featured: false,
            cardCta: '',
            ...fields,
        }
        const { error: insertError } = await client.from('cms_document').insert({ type: 'project', status: 'published', data, published_at: new Date().toISOString() })
        if (insertError) {
            console.error(`  ✗ ${insertError.message}`)
            failed += 1
        }
        continue
    }

    const next = { ...doc.data }
    const changed = []
    for (const [name, value] of Object.entries(fields)) {
        if (!empty(doc.data[name]) && !force) {
            console.log(`  ✓ ${name} — už vyplněné, nesahám`)
            continue
        }
        next[name] = value
        changed.push(name)
        console.log(`  + ${name}`)
    }
    if (doc.data.title === 'Věcicky') {
        next.title = 'Věcičky'
        changed.push('title')
        console.log('  + title — „Věcicky" → „Věcičky"')
    }
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
else if (!write) console.log(`Nic jsem nezapsal. Spusť s --write (${writes} projektů, ${planned.size} obrázků k nahrání).`)
else console.log(`Hotovo: ${writes - failed} projektů zapsáno, ${uploaded.size} obrázků v knihovně médií${failed ? `, ${failed} selhalo` : ''}.`)
process.exit(failed ? 1 : 0)
