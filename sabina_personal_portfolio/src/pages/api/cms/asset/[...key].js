// Servírování médií z disku (lokální vývoj bez Supabase) — logika je v balíčku,
// tenhle soubor jí dává adresu. S úložištěm Supabase vrací 404.
export { default } from '@c3studium/valecms/server/assetRoute.js'

export const config = { api: { bodyParser: false } }
