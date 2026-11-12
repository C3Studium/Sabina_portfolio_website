#!/usr/bin/env node
/**
 * Náhled pro sdílení (Open Graph / Twitter / LinkedIn / Messenger…):
 * public/og-image.jpg, 1200 × 630.
 *
 *     node scripts/og-image.mjs
 *
 * Kreslí ho Edge (playwright-core) z HTML s písmem webu (Poppins z Google
 * Fonts) — logo „S", jméno, claim z úvodní stránky a portrét.
 * Potřebuje Edge a playwright-core (ve scratchpadu / globálně), web nepotřebuje.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const EDGE = process.env.EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const asUrl = (p) => pathToFileURL(path.join(ROOT, 'public', p)).href

const html = `<!doctype html>
<html lang="cs"><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@200;300;400;500;600&display=block" rel="stylesheet">
<style>
  * { margin: 0; box-sizing: border-box; }
  html, body { width: 1200px; height: 630px; overflow: hidden; }
  body {
    position: relative;
    font-family: Poppins, sans-serif;
    color: #f2f7ff;
    background:
      radial-gradient(70% 90% at 78% 40%, rgba(120,120,120,.35), transparent 70%),
      linear-gradient(150deg, #3a3a3a 0%, #262626 45%, #161616 100%);
  }
  .dots { position: absolute; inset: 0; background-image: radial-gradient(rgba(242,247,255,.08) 1.2px, transparent 1.6px); background-size: 28px 28px; }
  .stage { position: absolute; right: -60px; top: 40px; width: 640px; height: 640px; border-radius: 50%;
    background: linear-gradient(152deg, rgba(110,110,110,.55), rgba(44,44,44,.85) 45%, rgba(18,18,18,.95)); }
  .portrait { position: absolute; right: 70px; bottom: -40px; height: 640px; filter: grayscale(1) contrast(1.05); }
  .swoosh { position: absolute; inset: 0; }
  .copy { position: absolute; left: 76px; top: 76px; width: 600px; }
  .brand { display: flex; align-items: center; gap: 18px; }
  .brand img { height: 58px; }
  .name b { display: block; font-size: 26px; font-weight: 600; letter-spacing: .26em; }
  .name span { display: block; font-size: 15px; font-weight: 400; letter-spacing: .34em; opacity: .85; }
  h1 { margin-top: 92px; font-size: 64px; font-weight: 200; line-height: 1; letter-spacing: .04em; text-transform: uppercase; }
  h1 em { font-style: normal; color: #bec948; }
  .role { margin-top: 30px; display: flex; align-items: center; gap: 14px; font-size: 17px; letter-spacing: .22em; text-transform: uppercase; opacity: .85; }
  .role i { width: 9px; height: 9px; border-radius: 50%; background: #bec948; }
</style></head>
<body>
  <div class="dots"></div>
  <div class="stage"></div>
  <svg class="swoosh" viewBox="0 0 1200 630"><path d="M560 540 C 640 470, 700 470, 760 520" fill="none" stroke="rgba(242,247,255,.35)" stroke-width="1.2"/><circle cx="760" cy="520" r="5" fill="#bec948"/></svg>
  <img class="portrait" src="${asUrl('assets/rest/main_photo.png')}" alt="">
  <div class="copy">
    <div class="brand"><img src="${asUrl('assets/rest/logo.png')}" alt=""><div class="name"><b>SABINA</b><span>HUDRMENTOVÁ</span></div></div>
    <h1>Grafika pro <em>lepší</em><br><em>výsledky.</em></h1>
    <p class="role"><i></i>Grafická designérka · reklamní bannery</p>
  </div>
</body></html>`

const tmp = path.join(os.tmpdir(), 'sabina-og.html')
fs.writeFileSync(tmp, html)

// playwright-core: z projektu, nebo ze složky v PLAYWRIGHT_DIR (není v závislostech webu).
let chromium
try {
    ;({ chromium } = await import('playwright-core'))
} catch {
    const dir = process.env.PLAYWRIGHT_DIR
    if (!dir) {
        console.error('Chybí playwright-core — nastav PLAYWRIGHT_DIR na složku, kde je nainstalovaný.')
        process.exit(1)
    }
    ;({ chromium } = await import(pathToFileURL(path.join(dir, 'node_modules/playwright-core/index.mjs')).href))
}
const browser = await chromium.launch({ executablePath: EDGE, headless: true })
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })
await page.goto(pathToFileURL(tmp).href, { waitUntil: 'networkidle' })
await page.evaluate(() => document.fonts.ready)
const out = path.join(ROOT, 'public', 'og-image.jpg')
await page.screenshot({ path: out, type: 'jpeg', quality: 90 })
await browser.close()
console.log(`og-image.jpg (${fs.statSync(out).size} B)`)
