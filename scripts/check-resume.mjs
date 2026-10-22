// check-resume.mjs — build-time consistency check between content/ and the
// shipped résumé. gen-resume.mjs is gone: public/resume.pdf is now a byte
// copy of the hand-maintained "Kushal Gangarapu - Resume.pdf", which
// reintroduces the drift class gen-hire.mjs killed. This check fails the
// build when they diverge:
//
//   1. byte drift — public/resume.pdf must be identical to the source PDF
//      (edited the source, forgot to copy = hard fail)
//   2. fact drift — name, email, school, every org + role title, headline
//      numbers, and every certification must appear in the PDF's decoded text
//      (edited experience.json without re-issuing the résumé = hard fail)
//   3. cert drift — every certifications[].file must exist under public/
//
// Text extraction is dependency-free: the résumé embeds subset fonts with
// custom encodings, so we parse each font's /ToUnicode CMap and decode the
// <hex> runs in the /Contents streams. If a future résumé export changes
// shape, the <200-char sanity floor fails with a clear message.

import { readFileSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { inflateSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(root, 'Kushal Gangarapu - Resume.pdf')
const PUB = join(root, 'public', 'resume.pdf')
const EXP = join(root, 'content', 'experience.json')
const CONTACT = join(root, 'content', 'contact.env')

const fail = (msg) => {
  console.error(`check-resume: FAIL — ${msg}`)
  process.exit(1)
}

// --- 1. byte drift -----------------------------------------------------------

if (!existsSync(SRC)) fail(`source résumé missing: ${SRC}`)
if (!existsSync(PUB)) fail('public/resume.pdf missing')

const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex')
if (sha(SRC) !== sha(PUB)) {
  fail(
    'public/resume.pdf differs from "Kushal Gangarapu - Resume.pdf".\n' +
      '  the résumé is hand-maintained — copy the source over public/resume.pdf.',
  )
}

// --- 2. fact drift -----------------------------------------------------------

const exp = JSON.parse(readFileSync(EXP, 'utf8'))

// minimal pdf object graph: "N 0 obj ... endobj" bodies, raw bytes
function pdfObjects(buf) {
  const objs = new Map()
  const re = /(\d+)\s+0\s+obj/g
  let m
  const latin = buf.toString('latin1')
  while ((m = re.exec(latin))) {
    const start = m.index + m[0].length
    const end = latin.indexOf('endobj', start)
    if (end > start) objs.set(+m[1], latin.slice(start, end))
  }
  return objs
}

function streamData(body) {
  const s = body.indexOf('stream')
  if (s < 0) return null
  let p = s + 6
  if (body[p] === '\r') p++
  if (body[p] === '\n') p++
  const e = body.indexOf('endstream', p)
  if (e < 0) return null
  const raw = Buffer.from(body.slice(p, e), 'latin1')
  try {
    return inflateSync(raw).toString('latin1')
  } catch {
    return raw.toString('latin1')
  }
}

// ToUnicode CMap → Map<cid, string>
function parseCMap(text) {
  const map = new Map()
  const hex = (s) => parseInt(s, 16)
  const uni = (s) => {
    // dst is utf-16be hex — may hold multiple code units
    let out = ''
    for (let i = 0; i + 4 <= s.length; i += 4) out += String.fromCharCode(hex(s.slice(i, i + 4)))
    return out
  }
  for (const block of text.matchAll(/beginbfchar(.*?)endbfchar/gs)) {
    for (const m of block[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g)) {
      map.set(hex(m[1]), uni(m[2]))
    }
  }
  for (const block of text.matchAll(/beginbfrange(.*?)endbfrange/gs)) {
    for (const m of block[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*(\[(.*?)\]|<([0-9a-fA-F]+)>)/gs)) {
      const lo = hex(m[1])
      const hi = hex(m[2])
      if (m[5]) {
        const base = hex(m[5])
        for (let c = lo; c <= hi; c++) map.set(c, String.fromCharCode(base + (c - lo)))
      } else {
        const items = [...m[4].matchAll(/<([0-9a-fA-F]+)>/g)].map((x) => uni(x[1]))
        for (let c = lo; c <= hi; c++) map.set(c, items[c - lo] ?? '')
      }
    }
  }
  return map
}

function extractText(buf) {
  const objs = pdfObjects(buf)

  // resource-name → font obj num:  /Font<</calibri 5 0 R ... >>
  const fontRes = new Map()
  for (const m of buf.toString('latin1').matchAll(/\/Font\s*<<\s*((?:\/[\w.]+\s+\d+\s+0\s+R\s*)+)>>/g)) {
    for (const f of m[1].matchAll(/\/([\w.]+)\s+(\d+)\s+0\s+R/g)) {
      fontRes.set(f[1], +f[2])
    }
  }

  // font obj → ToUnicode cmap
  const fontCMaps = new Map()
  for (const [name, num] of fontRes) {
    const body = objs.get(num)
    const tu = body?.match(/\/ToUnicode\s+(\d+)\s+0\s+R/)
    const cmapBody = tu && objs.get(+tu[1])
    const stream = cmapBody && streamData(cmapBody)
    if (stream) fontCMaps.set(name, parseCMap(stream))
  }

  // content streams: /Contents N 0 R and /Contents [a b c ...]
  const contentNums = []
  for (const m of buf.toString('latin1').matchAll(/\/Contents\s+(\d+)\s+0\s+R/g)) contentNums.push(+m[1])
  for (const m of buf.toString('latin1').matchAll(/\/Contents\s*\[((?:\s*\d+\s+0\s+R)+)\s*\]/g)) {
    for (const r of m[1].matchAll(/(\d+)\s+0\s+R/g)) contentNums.push(+r[1])
  }

  const decode = (hexStr, cmap) => {
    let out = ''
    // cids are 2 bytes in subset fonts; fall back to 1-byte if cmap says so
    for (let i = 0; i + 4 <= hexStr.length; i += 4) {
      const cid = parseInt(hexStr.slice(i, i + 4), 16)
      out += cmap?.get(cid) ?? ''
    }
    return out
  }

  const parts = []
  for (const n of contentNums) {
    const body = objs.get(n)
    const stream = body && streamData(body)
    if (!stream) continue
    let font = null
    // walk ops in order: font selects, hex runs, literal strings
    const re = /\/([\w.]+)\s+[\d.]+\s+Tf|<([0-9a-fA-F]+)>|\(((?:[^()\\]|\\.)*)\)/g
    let m
    while ((m = re.exec(stream))) {
      if (m[1]) font = m[1]
      else if (m[2]) parts.push(decode(m[2], fontCMaps.get(font)))
      else if (m[3]) parts.push(m[3].replace(/\\([()\\])/g, '$1'))
    }
  }
  return parts.join(' ')
}

const pdf = extractText(readFileSync(PUB))
if (pdf.replace(/\W/g, '').length < 200) {
  fail(
    `extracted only ${pdf.length} chars from the résumé — the PDF's internals changed\n` +
      '  and check-resume.mjs needs its extractor updated.',
  )
}

// whitespace-insensitive matching: line-level content streams and TJ kerning
// make word boundaries unreliable. commas are NOT kept: the JSON writes
// "1,500" and "$1,000" while the PDF may write "1500" and "$1000" — keeping
// them would pin the check to one typography choice
const hay = pdf.toLowerCase().replace(/[^a-z0-9+@.$]/g, '')
const has = (needle) => hay.includes(needle.toLowerCase().replace(/[^a-z0-9+@.$]/g, ''))

const missing = []
const must = (label, needle) => {
  if (needle && !has(needle)) missing.push(`${label}: "${needle}"`)
}

// identity anchors — the things that make it *his* résumé. contact facts
// come from contact.env, not literals, so editing one place can't leave the
// check asserting stale values
const env = Object.fromEntries(
  readFileSync(CONTACT, 'utf8')
    .split('\n')
    .flatMap((l) => {
      const m = /^([A-Z_]+)=(.*)$/.exec(l.trim())
      return m ? [[m[1], m[2].replace(/\s+#.*$/, '').trim()]] : []
    }),
)
if (!env.EMAIL || !env.PHONE) fail('contact.env is missing EMAIL or PHONE — nothing to check against')
must('name', exp.person.name)
must('school', exp.education?.[0]?.institution)
// the PDF says "smileykushal@gmail.com"; match the distinctive local part so
// a TLD change can't false-fail
must('email', env.EMAIL?.split('@')[0])
// "+1-778-858-5616" → "7788585616"; PDFs render it any of half a dozen ways
must('phone', env.PHONE?.replace(/\D/g, '').slice(-10))

// every role: org name (minus " · location" qualifiers) + title before " — "
for (const job of exp.experience ?? []) {
  must('org', job.org?.replace(/\s*·.*$/, ''))
  must('role', job.role?.split('—')[0].trim())
}

// every numeric claim in the highlights — if the JSON says 9,999 users and
// the résumé still says 1,500, that's drift. strip $ and normalize: the PDF
// writes "$1000" while the JSON writes "$1,000".
const claims = new Set()
for (const job of exp.experience ?? []) {
  for (const h of job.highlights ?? []) {
    for (const m of h.matchAll(/\$?(\d[\d,]*[%+]?)/g)) {
      const num = m[1].replace(/,/g, '').replace(/[%+]$/, '')
      if (parseInt(num, 10) >= 10) claims.add(m[1])
    }
  }
}
for (const n of claims) must('highlight claim', n)

// certifications: issuer + longest distinctive name token
for (const c of exp.certifications ?? []) {
  must('cert issuer', c.issuer?.replace(/\s*\(.*\)/, ''))
  const token = (c.name ?? '').match(/[a-z0-9]{4,}/gi)?.sort((a, b) => b.length - a.length)[0]
  must('cert', token)
}

if (missing.length) {
  fail(
    `experience.json facts missing from resume.pdf:\n    ${missing.join('\n    ')}\n` +
      '  the résumé is hand-maintained — update the PDF (or fix the JSON).',
  )
}

// --- 3. cert drift -----------------------------------------------------------

for (const c of exp.certifications ?? []) {
  if (c.file && !existsSync(join(root, 'public', c.file))) {
    fail(`certification file missing: public/${c.file}`)
  }
}

console.log(
  `check-resume: ok — ${exp.experience.length} roles, ${exp.certifications.length} certs, ` +
    `${pdf.length} chars decoded, résumé in sync`,
)
