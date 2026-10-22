#!/usr/bin/env node
// scripts/gen-sitemap.mjs — stamps <lastmod> with the newest content/ mtime,
// not the build date: a sitemap that claims the page changed every deploy is
// noise crawlers learn to ignore. Runs via the `prebuild` npm script; writes
// public/sitemap.xml so vite copies it.
import { writeFileSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, 'public', 'sitemap.xml')

// canonical domain lives in package.json.homepage — index.html's canonical
// and check-meta.mjs read the same field, so a domain move is one edit
const origin = (JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).homepage ?? '').replace(/\/+$/, '')
if (!/^https:\/\//.test(origin)) {
  console.error('gen-sitemap: FAIL — package.json homepage must be an https:// origin')
  process.exit(1)
}

const walk = (d) =>
  readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]))

// newest content mtime → lastmod; en-CA formats YYYY-MM-DD in LOCAL time —
// toISOString() is UTC and would stamp tomorrow's date on a late-evening edit
const lastmod = new Date(Math.max(...walk(join(root, 'content')).map((f) => statSync(f).mtimeMs))).toLocaleDateString('en-CA')

writeFileSync(
  out,
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${origin}/</loc>
    <lastmod>${lastmod}</lastmod>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${origin}/hire/</loc>
    <lastmod>${lastmod}</lastmod>
    <priority>0.9</priority>
  </url>
</urlset>
`,
)
console.log(`sitemap.xml stamped ${lastmod} (${origin})`)
