// check-meta.mjs — build-time drift guard for hand-maintained metadata.
// index.html's JSON-LD is written by hand (the app can't generate its own
// <head>), so it silently rots when contact.env / experience.json change.
// Runs AFTER gen-hire so it also verifies the just-generated /hire/ output.
// Exits nonzero on any mismatch — drift fails the build, like it should.
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(ROOT, p), 'utf8')

const fails = []
const check = (cond, label) => {
  if (!cond) fails.push(label)
}

function parseEnv(src) {
  const m = {}
  for (const line of src.split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i > 0) m[t.slice(0, i).trim()] = t.slice(i + 1).replace(/\s+#.*$/, '').trim()
  }
  return m
}

const env = parseEnv(read('content/contact.env'))
const exp = JSON.parse(read('content/experience.json'))
const edu = exp.education?.[0] ?? {}
const index = read('index.html')
const hire = read('public/hire/index.html')

// ---- index.html JSON-LD vs canonical content ----
const ldm = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(index)
check(!!ldm, 'index.html: no JSON-LD block found')
if (ldm) {
  let ld = null
  try {
    ld = JSON.parse(ldm[1])
  } catch (e) {
    fails.push(`index.html: JSON-LD does not parse — ${e.message}`)
  }
  if (ld) {
    check(ld.email === env.EMAIL, `index.html: JSON-LD email "${ld.email}" != contact.env "${env.EMAIL}" (and must not be mailto:)`)
    check(ld.telephone === env.PHONE, `index.html: JSON-LD telephone "${ld.telephone}" != contact.env "${env.PHONE}"`)
    check(ld.memberOf?.name === edu.institution, `index.html: JSON-LD memberOf "${ld.memberOf?.name}" != experience.json "${edu.institution}"`)
    check(!('alumniOf' in ld), 'index.html: JSON-LD still uses alumniOf — still enrolled, memberOf is honest')
    check(ld.seeks?.['@type'] === 'Demand', `index.html: JSON-LD seeks is "${ld.seeks?.['@type']}" — a candidate seeks a Demand, not a JobPosting`)
    check(ld.name === exp.person?.name, `index.html: JSON-LD name "${ld.name}" != experience.json person.name`)
  }
}

// ---- generated /hire/ carries the canonical facts ----
for (const [key, val] of [['EMAIL', env.EMAIL], ['PHONE', env.PHONE]]) {
  if (val) check(hire.includes(val), `hire/index.html: missing ${key} value "${val}"`)
}
check(hire.includes('bcss-calendar.vercel.app'), 'hire/index.html: flagship project link missing — cards must link out')
check(hire.includes('"@type": "Demand"') || hire.includes('"@type":"Demand"'), 'hire/index.html: JSON-LD seeks is not Demand')
check(hire.includes('AP Computer Science'), 'hire/index.html: coursework/AP scores missing from crawlable html')
// assert the emitted field, not the bare value — includes('yes') passes on
// any "yes" anywhere in the page, even with RELOCATION unset in the HTML
if (env.RELOCATION) {
  const escH = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  check(hire.includes(`relocation: ${escH(env.RELOCATION)}`), 'hire/index.html: RELOCATION chip missing or value drifted')
}
check(!/mailto:[^"'\s]*mailto:/.test(hire), 'hire/index.html: double mailto: in an href')

// ---- og/canonical origin consistency ----
// package.json.homepage is the canonical source — gen-sitemap.mjs and
// gen-hire.mjs read it; index.html is hand-maintained and must match
const homepage = JSON.parse(read('package.json')).homepage ?? ''
check(!!homepage, 'package.json: homepage (canonical domain) missing')
if (homepage) {
  check(index.includes(`href="${homepage}/"`), `index.html: canonical link "${homepage}/" missing`)
  check(index.includes(`content="${homepage}/"`), `index.html: og:url "${homepage}/" missing`)
}

// ---- referenced assets must exist — a deleted og.png ships a broken card
// preview on every link share, silently ----
for (const asset of ['og.png', 'favicon.svg', 'resume.pdf']) {
  check(existsSync(join(ROOT, 'public', asset)), `public/${asset} missing — referenced from index.html`)
}

if (fails.length) {
  console.error('check-meta FAILED — metadata drift detected:')
  for (const f of fails) console.error(`  ✗ ${f}`)
  console.error('fix index.html or content/* so the canonical sources win again.')
  process.exit(1)
}
console.log('check-meta: index.html + hire/index.html in sync with content/')
