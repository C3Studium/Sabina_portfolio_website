#!/usr/bin/env node
/**
 * Ikony webu ze značky „S" (public/assets/rest/logo.png).
 *
 *     node scripts/brand-assets.mjs
 *
 * Zapíše do /public: favicon.ico (16, 32, 48), icon-192.png, icon-512.png,
 * apple-touch-icon.png (180) a icon.png (32). Zelené S na tmavém čtverci
 * s jemně zaoblenými rohy — jako značka v hlavičce.
 *
 * Logo je jen 64 px, proto se zvětšuje s vyhlazenou alfou (zvětšit, rozmazat,
 * strmá křivka krytí) — hrany zůstanou ostré i na 512 px.
 *
 * Náhled pro sdílení (public/og-image.jpg) kreslí Edge z HTML se skutečným
 * písmem webu: scripts/og-image.mjs.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PUBLIC = path.join(ROOT, 'public')
const LOGO = path.join(PUBLIC, 'assets/rest/logo.png')
// Tmavý podklad v tónu webu (stejný jako závoj / hlavička).
const BG = { r: 38, g: 38, b: 38 }

/** Barva loga: průměr plně krytých pixelů. */
let inkCache = null
async function logoInk() {
    if (inkCache) return inkCache
    const { data } = await sharp(LOGO).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    const sum = [0, 0, 0, 0]
    for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] < 230) continue
        sum[0] += data[i]
        sum[1] += data[i + 1]
        sum[2] += data[i + 2]
        sum[3] += 1
    }
    inkCache = sum[3] ? [0, 1, 2].map((c) => Math.round(sum[c] / sum[3])) : [190, 201, 72]
    return inkCache
}

/** Logo zvětšené na `size` px s vyhlazenými hranami (RGBA buffer). */
async function smoothLogo(size) {
    const big = size * 2
    const { data, info } = await sharp(LOGO)
        .resize(big, big, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 }, kernel: 'cubic' })
        .blur(Math.max(0.6, big / 150))
        .raw()
        .toBuffer({ resolveWithObject: true })
    // Logo je jedna barva: všude jeho zelená (rozmazání by do hran přimíchalo
    // černou z průhledna), tvar nese jen alfa — strmá křivka krytí dá
    // ostrou, ale vyhlazenou hranu.
    const ink = await logoInk()
    for (let i = 0; i < data.length; i += 4) {
        const a = data[i + 3] / 255
        const t = Math.min(1, Math.max(0, (a - 0.42) / 0.22))
        data[i] = ink[0]
        data[i + 1] = ink[1]
        data[i + 2] = ink[2]
        data[i + 3] = Math.round(t * t * (3 - 2 * t) * 255)
    }
    return sharp(data, { raw: info }).resize(size, size, { kernel: 'lanczos3' }).png().toBuffer()
}

/** Ikona: tmavý čtverec se zaoblením, logo uprostřed (podíl `fill`). */
async function icon(size, { radius = 0.22, fill = 0.66 } = {}) {
    const r = Math.round(size * radius)
    const plate = Buffer.from(
        `<svg width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="rgb(${BG.r},${BG.g},${BG.b})"/></svg>`,
    )
    const inner = Math.round(size * fill)
    const logo = await smoothLogo(inner)
    const off = Math.round((size - inner) / 2)
    return sharp(plate).composite([{ input: logo, left: off, top: off }]).png().toBuffer()
}

/** ICO s PNG uvnitř (umí ho všechny současné prohlížeče). */
function ico(pngs) {
    const header = Buffer.alloc(6)
    header.writeUInt16LE(0, 0)
    header.writeUInt16LE(1, 2)
    header.writeUInt16LE(pngs.length, 4)
    const dir = Buffer.alloc(16 * pngs.length)
    let offset = 6 + dir.length
    pngs.forEach(({ size, buf }, i) => {
        const o = i * 16
        dir.writeUInt8(size >= 256 ? 0 : size, o)
        dir.writeUInt8(size >= 256 ? 0 : size, o + 1)
        dir.writeUInt8(0, o + 2)
        dir.writeUInt8(0, o + 3)
        dir.writeUInt16LE(1, o + 4)
        dir.writeUInt16LE(32, o + 6)
        dir.writeUInt32LE(buf.length, o + 8)
        dir.writeUInt32LE(offset, o + 12)
        offset += buf.length
    })
    return Buffer.concat([header, dir, ...pngs.map((p) => p.buf)])
}

const write = (name, buf) => {
    fs.writeFileSync(path.join(PUBLIC, name), buf)
    console.log(`  ${name} (${buf.length} B)`)
}

const small = await Promise.all([16, 32, 48].map(async (size) => ({ size, buf: await icon(size, { radius: 0.2, fill: 0.78 }) })))
write('favicon.ico', ico(small))
write('icon.png', small[1].buf)
write('apple-touch-icon.png', await icon(180, { radius: 0, fill: 0.62 }))
write('icon-192.png', await icon(192))
write('icon-512.png', await icon(512))
// Maskovatelná ikona (Android ořízne do kruhu) — víc okraje.
write('icon-maskable-512.png', await icon(512, { radius: 0, fill: 0.5 }))
console.log('Hotovo.')
