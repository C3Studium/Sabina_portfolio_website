#!/usr/bin/env node
/**
 * Založí ve Studiu dokument „SEO a ikony" (typ siteSeo) s dnešními hodnotami
 * z kódu (src/lib/seo.ts) a nahraje náhled pro sdílení a ikony z /public.
 *
 *     pnpm run cms:seo              vypíše plán, nic nezapíše
 *     pnpm run cms:seo -- --write   zapíše
 *
 * Když dokument už existuje, nesahá na něj (úpravy ze Studia nepřepíše).
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

for (const name of ['.env.local', '.env']) {
    const file = path.join(ROOT, name)
    if (!fs.existsSync(file)) continue
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
        const t = line.trim()
        if (!t || t.startsWith('#') || !t.includes('=')) continue
        const i = t.indexOf('=')
        const k = t.slice(0, i).trim()
        if (!(k in process.env)) process.env[k] = t.slice(i + 1).trim().replace(/^["']|["']$/g, '')
    }
}

const write = process.argv.includes('--write')
const { SEO_FALLBACK: seo } = await import('../src/lib/seo.ts')
const { getAdminClient } = await import('@c3studium/valecms/server/supabaseAdmin.js')
const { createMediaRepository, createStorageFromEnv } = await import('@c3studium/valecms/server')

const client = getAdminClient()
const media = createMediaRepository({ client, storage: createStorageFromEnv() })
const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml' }

const upload = async (img) => {
    if (!img) return null
    if (!write) return { url: img.src, alt: img.alt, width: img.width, height: img.height }
    const file = path.join(ROOT, 'public', img.src.replace(/^\//, ''))
    const row = await media.upload({ buffer: fs.readFileSync(file), filename: path.basename(file), mime: MIME[path.extname(file).toLowerCase()] }, { alt: img.alt })
    return {
        id: row.id,
        url: row.url,
        alt: row.alt || img.alt || '',
        width: Number.isFinite(row.width) ? row.width : img.width,
        height: Number.isFinite(row.height) ? row.height : img.height,
    }
}

const { data: rows, error } = await client.from('cms_document').select('id').eq('type', 'siteSeo').limit(1)
if (error) {
    console.error('Čtení selhalo:', error.message)
    process.exitCode = 1
} else if (rows.length) {
    console.log('✓ „SEO a ikony" už ve Studiu je — nesahám.')
} else {
    console.log('+ „SEO a ikony" — jméno, popis, náhled pro sdílení, favikona, ikona na plochu')
    if (!write) {
        console.log('\nNic jsem nezapsal. Spusť s --write.')
    } else {
        const data = {
            key: 'site.seo',
            order: 0,
            siteName: seo.siteName,
            tagline: seo.tagline,
            description: seo.description,
            locale: seo.locale,
            shareImage: await upload(seo.shareImage),
            twitter: seo.twitter,
            favicon: await upload(seo.favicon),
            appleIcon: await upload(seo.appleIcon),
            themeColor: seo.themeColor,
        }
        const { error: insertError } = await client.from('cms_document').insert({ type: 'siteSeo', status: 'published', data, published_at: new Date().toISOString() })
        if (insertError) {
            console.error('Zápis selhal:', insertError.message)
            process.exitCode = 1
        } else console.log('\nHotovo — „SEO a ikony" je ve Studiu.')
    }
}
