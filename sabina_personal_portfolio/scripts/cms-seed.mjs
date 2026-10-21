#!/usr/bin/env node
/**
 * Založí bloky textů a nahraje obrázky, které web dnes nese v kódu a v /public.
 *
 *     pnpm run cms:seed              vypíše plán, nic nezapíše
 *     pnpm run cms:seed -- --write   nahraje obrázky a založí bloky
 *
 * Spouští se přes `node --import @c3studium/valecms/register.mjs` (viz
 * package.json): balíček uvnitř importuje aliasy `valecms.config` a
 * `valecms.types`, které mimo bundler rozřeší jedině jeho loader. Holé
 * `node scripts/cms-seed.mjs` spadne na ERR_MODULE_NOT_FOUND ještě před
 * načtením dat.
 *
 * Data nejsou tady, ale v scripts/seed/*.mjs — jeden soubor na stránku, protože
 * stránky vznikají paralelně a jeden soubor by byl jedno místo, kde se čtyři
 * agenti přepisují. Tenhle runner je jediný, kdo sahá na databázi a úložiště.
 * Kontrakt souborů je v scripts/seed/README.md.
 *
 * Idempotentní na obou koncích: blok, jehož `key` už v databázi je, se nechá být
 * (přepsat rozepsaný text editora nejde ani omylem), a upload stejného souboru
 * vrátí existující řádek médií (viz media.js — otisk obsahu).
 *
 * Proč přímo přes Supabase klienta a ne přes `createDocumentRepository`:
 * repository umí koncept → publikace s revizí, což je tok pro editora. Seed
 * zakládá stav „takhle to bylo v kódu" jako první publikovanou verzi bez
 * historie — stejný důvod, proč to tak dělá ProchazkaGroup.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// Next čte .env.local sám, holý node ne. Co už v prostředí je, vyhrává —
// stejné pravidlo jako u `next dev`.
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

// Po načtení env, protože klient si klíče bere z process.env při vzniku.
const { getAdminClient } = await import('@c3studium/valecms/server/supabaseAdmin.js')
const { createMediaRepository, createStorageFromEnv } = await import('@c3studium/valecms/server')

const client = getAdminClient()
const media = createMediaRepository({ client, storage: createStorageFromEnv() })

/* ------------------------------------------------------------ seed soubory -- */

const seedDir = path.join(ROOT, 'scripts', 'seed')
const files = fs
    .readdirSync(seedDir)
    .filter((name) => name.endsWith('.mjs') && (!only || name.startsWith(only)))
    .sort()

if (!files.length) {
    console.log('Ve scripts/seed/ není žádný *.mjs soubor.')
    process.exit(1)
}

const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.svg': 'image/svg+xml' }

/* --------------------------------------------------------------- obrázky -- */

// Cesta v /public → řádek médií. Jeden upload na jeden soubor, ať se stejná
// fotka na dvou místech nenahrává dvakrát (repository by to stejně srazila
// otiskem, ale ušetří se jeden přenos).
const uploaded = new Map()
const uploadImage = async (publicPath, alt) => {
    if (uploaded.has(publicPath)) return uploaded.get(publicPath)
    const file = path.join(ROOT, 'public', publicPath.replace(/^\//, ''))
    if (!fs.existsSync(file)) throw new Error(`obrázek ${publicPath} v /public není`)
    const ext = path.extname(file).toLowerCase()
    const row = await media.upload(
        { buffer: fs.readFileSync(file), filename: path.basename(file), mime: MIME[ext] },
        { alt },
    )
    // Tvar, který čte `imageValue` v server/site/read.js: `url` je povinné,
    // `id` drží vazbu na knihovnu médií (mediaArchive hledá podle něj).
    const ref = { id: row.id, url: row.url, alt: row.alt || alt || '' }
    if (Number.isFinite(row.width) && Number.isFinite(row.height)) Object.assign(ref, { width: row.width, height: row.height })
    uploaded.set(publicPath, ref)
    return ref
}

// V těle bloku smí stát obrázek jako `{ image: '/assets/…', alt }` — značka,
// že se má nahrát. Projde se rekurzivně (i položky, i galerie).
const isImageMarker = (v) => v && typeof v === 'object' && typeof v.image === 'string' && v.image.startsWith('/')
const resolveImages = async (value, plan) => {
    if (Array.isArray(value)) return Promise.all(value.map((v) => resolveImages(v, plan)))
    if (isImageMarker(value)) {
        plan.push(value.image)
        return write ? uploadImage(value.image, value.alt) : { url: value.image, alt: value.alt || '' }
    }
    if (value && typeof value === 'object') {
        const out = {}
        for (const [k, v] of Object.entries(value)) out[k] = await resolveImages(v, plan)
        return out
    }
    return value
}

/* --------------------------------------------------------------- dokumenty -- */

const { data: existing, error: readError } = await client.from('cms_document').select('id, type, status, data').limit(1000)
if (readError) {
    console.error('Čtení selhalo:', readError.message)
    console.error('Jsou migrace puštěné? `pnpm run cms:migrate`')
    process.exit(1)
}
const have = new Map((existing || []).filter((r) => r?.data?.key).map((r) => [r.data.key, r]))

let toCreate = 0
let failed = 0
const imagesPlanned = new Set()

for (const name of files) {
    const mod = await import(pathToFileURL(path.join(seedDir, name)).href)
    const blocks = mod.blocks || mod.default || []
    console.log(`\n▍ ${name}`)
    for (const block of blocks) {
        const type = block.type || 'siteCopy'
        const body = { ...block }
        delete body.type
        if (!body.key) { console.log(`  ✗ blok bez key`); failed += 1; continue }
        if (have.has(body.key)) { console.log(`  ✓ ${body.key} — už existuje, nesahám`); continue }

        const plan = []
        const resolved = await resolveImages(body, plan)
        plan.forEach((p) => imagesPlanned.add(p))
        toCreate += 1
        console.log(`  + ${body.key} (${type})${plan.length ? ` · obrázky: ${plan.length}` : ''}`)

        if (!write) continue
        const now = new Date().toISOString()
        const { error } = await client
            .from('cms_document')
            .insert({ type, status: 'published', data: resolved, published_at: now })
        if (error) { console.error(`  ✗ ${body.key} — ${error.message}`); failed += 1 }
    }
}

console.log('')
if (!toCreate) console.log('Všechno je na místě. Nic k zápisu.')
else if (!write) console.log(`Nic jsem nezapsal. Spusť s --write (${toCreate} bloků, ${imagesPlanned.size} obrázků k nahrání).`)
else console.log(`Hotovo: ${toCreate - failed} bloků založeno, ${uploaded.size} obrázků nahráno${failed ? `, ${failed} selhalo` : ''}.`)
process.exit(failed ? 1 : 0)
