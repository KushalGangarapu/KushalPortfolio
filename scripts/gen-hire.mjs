// Generates public/hire/index.html — the prerendered, zero-JS readable page.
// Reads the SAME content/ files the app renders, so the static page can't drift
// from the site (it already did once — cortex was a "terminal LLM client").
// Run: node scripts/gen-hire.mjs  (also wired into `npm run build` via prebuild)
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const content = (p) => readFileSync(join(ROOT, 'content', p), 'utf8')
const outDir = join(ROOT, 'public', 'hire')
const out = join(outDir, 'index.html')

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const stripMd = (s) =>
  s.replace(/\*\*|__/g, '').replace(/\*([^*]+)\*/g, '$1').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/`/g, '').trim()

// scheme allowlist — a poisoned env value must never emit javascript: into a
// recruiter's inbox page. http/https/mailto/tel pass; anything else is dead.
const safeHref = (u) => (/^(https?:|mailto:|tel:)/i.test(String(u).trim()) ? String(u).trim() : null)
// fm.link is a bare domain ('bcss-calendar.vercel.app') — prefix https unless
// it already carries an allowed scheme. the bare-domain branch must LOOK like
// a domain: webHref('see notes') producing href="https://see notes" ships a
// broken link on the zero-JS page
const webHref = (u) => {
  const s = String(u ?? '').trim()
  if (!s) return null
  if (/^[a-z][a-z0-9+.-]*:/i.test(s)) return safeHref(s)
  return /^[\w-]+(\.[\w-]+)+(:\d+)?(\/[\w\-./]*)?$/.test(s) ? `https://${s}` : null
}
// site-rooted paths only ('/resume.pdf') — '//evil.com' must NOT pass: the
// char after the leading slash can't be another slash or it ships a
// protocol-relative URL to a recruiter's zero-JS page
const sitePath = (u) => (/^\/[\w-][\w\-./]*$/.test(String(u ?? '').trim()) ? String(u).trim() : null)

// ---- parse content/ — same controlled formats the app uses ----
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
// CRLF-tolerant like the app's parser — under a \r\n checkout every project
// would silently lose all frontmatter (blurb becomes the raw yaml, flagship
// demoted, cards sort year=0)
function parseFm(src) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(src)
  if (!m) return { fm: {}, body: src }
  const fm = {}
  for (const line of m[1].split(/\r?\n/)) {
    const i = line.indexOf(':')
    if (i > 0) fm[line.slice(0, i).trim()] = line.slice(i + 1).trim()
  }
  return { fm, body: src.slice(m[0].length) }
}
// skills.toml — [languages]/[tools] name = { level = "x" } lines. derive the
// "skills:" line instead of hardcoding it — canonical content wins every time.
function parseSkillNames(src) {
  const names = []
  let section = ''
  for (const line of src.split('\n')) {
    const s = line.trim()
    const sec = /^\[(\w+)]/.exec(s)
    if (sec && !s.startsWith('[[')) {
      section = sec[1]
      continue
    }
    // [[deprecated]] / unrecognized headers end the section — entry-shaped
    // lines under them must not land in the last plain section
    if (s.startsWith('[')) {
      section = ''
      continue
    }
    if (section !== 'languages' && section !== 'tools') continue
    const m = /^(\w+)\s*=\s*\{\s*level\s*=\s*"(\w+)"/.exec(s)
    if (m && m[2] !== 'touched' && m[2] !== 'learning') names.push(m[1].replace(/_/g, ' '))
  }
  return names
}

const env = parseEnv(content('contact.env'))
const exp = JSON.parse(content('experience.json'))
// the name is content, not template — a person rename must reach every
// title/h1/ld without a script edit
const personName = exp.person?.name ?? 'Kushal Gangarapu'
// canonical domain — same package.json.homepage index.html + the sitemap read
const origin = (JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).homepage ?? 'https://www.kushalgangarapu.com').replace(/\/+$/, '')
// local date — toISOString() is UTC and stamps tomorrow on late-evening builds
const today = new Date().toLocaleDateString('en-CA')

const openTo = (env.OPEN_TO ?? '').split(',').map((t) => t.trim()).filter(Boolean)
const availLabel = openTo.map((t) => t.replace(/-/g, ' ')).join(' · ')
const leadWant = (openTo[0] ?? 'internships').replace(/-/g, ' ')
const seeks = openTo[0]
  ? `${openTo[0].replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())} — Software Engineering`
  : 'Software Engineering Internship'

// project blurbs: frontmatter + first real paragraph of each projects/*.md
const projects = readdirSync(join(ROOT, 'content', 'projects'))
  .filter((f) => f.endsWith('.md'))
  .map((f) => {
    const { fm, body } = parseFm(content(join('projects', f)))
    // first real paragraph — md files wrap at ~70 cols, so join until a blank line
    const lines = body.split('\n')
    let para = ''
    for (const l of lines) {
      const t = l.trim()
      if (!t) {
        if (para) break
        continue
      }
      if (t.startsWith('#') || t.startsWith('![') || t.startsWith('|') || t.startsWith('-') || t.startsWith('```')) {
        if (para) break
        continue
      }
      para += (para ? ' ' : '') + t
    }
    para = stripMd(para)
    return {
      name: fm.title ?? f.replace(/\.md$/, ''),
      stack: fm.stack ?? '',
      status: fm.status ?? '',
      // app prefers `repo` over `link` — keep the precedence identical
      link: fm.repo ?? fm.link ?? '',
      year: Number((fm.year ?? '0').match(/\d{4}/)?.[0] ?? 0),
      // app's parse: /^(true|yes|1)$/i — match it so 'flagship: yes' survives
      flagship: /^(true|yes|1)$/i.test(fm.flagship ?? ''),
      blurb: para,
      path: f,
    }
  })
// flagship first (it's the one the school runs on), then live production,
// then newest — never alphabetical: alphabetical buried the flagship last.
// sidequests sorts last on its own: no flagship, no production status.
const cards = projects
  .sort((a, b) => {
    const rank = (p) => (p.flagship ? 0 : /production/i.test(p.status) ? 1 : 2)
    return rank(a) - rank(b) || b.year - a.year || a.path.localeCompare(b.path)
  })

const edu = exp.education?.[0]
const jobLi = (e) => (e.highlights ?? []).filter((h) => typeof h === 'string' && h.trim()).map((h) => `        <li>${esc(stripMd(h))}</li>`).join('\n')
// entries missing the fields they print would emit literal 'undefined' —
// drop them like the app's parser does rather than ship a malformed line
const expHtml = (exp.experience ?? [])
  .filter((e) => e && typeof e.role === 'string' && typeof e.org === 'string' && typeof e.period === 'string')
  .map((e) => {
    const u = e.url ?? e.link
    const linkHtml = u && webHref(u) ? ` <a href="${esc(webHref(u))}">${esc(String(u).replace(/^https?:\/\//, '').replace(/\/$/, ''))} ↗</a>` : ''
    return `    <div class="proj">
      <span class="role">${esc(e.role)} — ${esc(e.org)}</span>${linkHtml}
      <span class="period"> · ${esc(e.period)}</span>
      <ul>
${jobLi(e)}
      </ul>
    </div>`
  })
  .join('\n')
const projHtml = cards
  .map(
    (p) => `    <div class="proj"><span class="name">${esc(p.name)}</span>
      ${p.link && webHref(p.link) ? `<a href="${esc(webHref(p.link))}">${esc(p.link)} ↗</a> ` : ''}— ${esc(p.blurb)}
      <span class="period">${esc(p.stack)}${p.status ? ` · ${esc(p.status)}` : ''}</span></div>`,
  )
  .join('\n')
const certHtml = (exp.certifications ?? [])
  .filter((c) => c && typeof c.name === 'string' && typeof c.issuer === 'string')
  .map((c) => {
    // cert file link only when present AND path-shaped — '/undefined' or a
    // host-relative smuggle must never ship on the zero-JS page
    const fileHref = c.file ? sitePath(`/${c.file}`) : null
    const meta = [c.date, c.status].filter((v) => typeof v === 'string' && v).join(' · ')
    return `    <div class="proj"><span class="name">${esc(c.name)}</span> — ${esc(c.issuer)}${meta ? ` <span class="period">${esc(meta)}</span>` : ''}${fileHref ? ` <a href="${esc(fileHref)}">cert ↗</a>` : ''} ${safeHref(c.verify) ? `<a href="${esc(safeHref(c.verify))}">verify ↗</a>` : ''}</div>`
  })
  .join('\n')
// education deserves more than one line — AP scores and awards are the
// strongest academic signal and previously existed only inside the JS bundle.
// notes split on ' · ' like the app's renderer — one run-on bullet was the
// old divergence
const eduHtml = (exp.education ?? [])
  .filter((e) => e && (typeof e.degree === 'string' || typeof e.institution === 'string'))
  .map(
    (e) => `    <div class="proj">
      <span class="role">${esc(stripMd(e.degree ?? ''))} — ${esc(e.institution ?? '')}</span>
      <span class="period"> · ${esc(e.period ?? '')}</span>
      ${typeof e.notes === 'string' && e.notes ? `<ul>\n${e.notes.split(' · ').filter(Boolean).map((n) => `        <li>${esc(stripMd(n))}</li>`).join('\n')}\n      </ul>` : ''}
    </div>`,
  )
  .join('\n')
const courseHtml = (exp.coursework ?? [])
  .filter((c) => c && typeof c.name === 'string')
  .map((c) => `    <div class="proj"><span class="name">${esc(c.name)}</span>${c.id || c.status ? ` — <span class="period">${[c.id, stripMd(c.status ?? '')].filter(Boolean).join(' · ')}</span>` : ''}</div>`)
  .join('\n')
// awards & scores — the app's education section shows them; the static page
// was silently dropping the strongest academic proof
const awardHtml = (exp.awards ?? [])
  .filter((a) => a && typeof a.what === 'string')
  .map((a) => {
    if (!a.result) return `    <div class="proj"><span class="name">${esc(stripMd(a.what))}</span></div>`
    const lines = a.result.split('\n').map((l) => esc(stripMd(l)))
    return `    <div class="proj"><span class="name">${esc(stripMd(a.what))}</span> — <span class="period">${lines.join(' · ')}</span></div>`
  })
  .join('\n')
const communityHtml = (exp.community ?? [])
  .filter((c) => c && typeof c.activity === 'string')
  .map(
    (c) => `    <div class="proj">
      <span class="role">${esc(c.activity)} — ${esc(c.hours ?? '')}</span>
      ${c.org ? `<span class="period"> · ${esc(c.org)}</span>` : ''}
      ${c.highlights ? `<div><span class="period">${esc(c.highlights)}</span></div>` : ''}
    </div>`,
  )
  .join('\n')

const skillNames = parseSkillNames(content('skills.toml'))
const skillsLine = skillNames.length ? skillNames.join(' · ') : 'typescript · react · node'

const ctaHref = safeHref(env.SCHEDULING) ?? (env.EMAIL ? `mailto:${env.EMAIL}` : '#')
const mailtoHref = env.EMAIL ? `mailto:${env.EMAIL}` : '#'
const telHref = env.PHONE ? `tel:${env.PHONE.replace(/[^+\d]/g, '')}` : '#'
const githubHref = webHref(env.GITHUB)
const linkedinHref = webHref(env.LINKEDIN)
const flagship = cards.find((c) => c.flagship) ?? cards[0]
const flagshipHref = flagship?.link ? webHref(flagship.link) : null

// JSON-LD built as data — esc() inside JSON corrupts on & and " characters,
// and hand-maintained JSON silently drifts from contact.env
const ld = {
  '@context': 'https://schema.org',
  '@type': 'Person',
  name: personName,
  url: `${origin}/`,
  ...(env.EMAIL ? { email: env.EMAIL } : {}),
  ...(env.PHONE ? { telephone: env.PHONE } : {}),
  image: `${origin}/og.png`,
  logo: `${origin}/favicon-192x192.png`,
  jobTitle: 'Student Developer & Event Organizer',
  // still enrolled — alumniOf claims graduation that hasn't happened
  memberOf: { '@type': 'EducationalOrganization', name: edu?.institution ?? '' },
  ...(edu?.period ? { description: `Grade-12 student, ${edu.institution} (${edu.period})` } : {}),
  sameAs: [githubHref, linkedinHref].filter(Boolean),
  // Demand is the schema type for "looking for work" — JobPosting is what
  // employers publish, not what a candidate seeks
  seeks: { '@type': 'Demand', name: seeks },
}

mkdirSync(outDir, { recursive: true })
writeFileSync(
  out,
  `<!doctype html>
<!-- /hire/ — GENERATED by scripts/gen-hire.mjs from content/. Do not edit by hand;
     edit content/*.md / experience.json / contact.env and rebuild. Zero JS,
     instant on any phone, indexable — what F5 promises: the workspace as a document. -->
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(personName)} — résumé &amp; contact</title>
  <meta name="description" content="${esc(personName)} — grade-12 developer &amp; student leader. Résumé, experience, and contact. Open to ${esc(leadWant)}." />
  <meta name="keywords" content="Kushal Gangarapu, Kushal, Gangarapu, software engineer, full stack developer, web developer Vancouver, software engineer portfolio, student developer, Burnaby Central Secondary School, Burnaby Central, student leader, Co-Prime Minister, wildcat-calendar, BCSS calendar, BC Youth Developer Collective, BCYDC, Daydream Vancouver, React 19, TypeScript, JavaScript, PostgreSQL, Prisma, Python, Next.js, Tailwind CSS, CS50AI, Full Stack Open, Waterloo Math Contests, Gauss, Hypatia, Galois, Canadian Open Mathematics Challenge, youth hackathon organizer, summer 2027 internship" />
  <meta name="author" content="${esc(personName)}" />
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
  <meta name="googlebot" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
  <link rel="canonical" href="${origin}/hire/" />
  <meta http-equiv="Content-Security-Policy" content="upgrade-insecure-requests" />
  <link rel="icon" href="/favicon.ico" sizes="48x48" />
  <link rel="icon" href="/favicon.svg" sizes="any" type="image/svg+xml" />
  <link rel="icon" type="image/png" sizes="48x48" href="/favicon-48x48.png" />
  <link rel="icon" type="image/png" sizes="96x96" href="/favicon-96x96.png" />
  <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
  <link rel="manifest" href="/site.webmanifest" />

  <meta property="og:type" content="profile" />
  <meta property="og:site_name" content="kushal" />
  <meta property="og:locale" content="en_US" />
  <meta property="og:url" content="${origin}/hire/" />
  <meta property="og:title" content="${esc(personName)} — résumé &amp; contact" />
  <meta property="og:description" content="The readable build: experience, projects, and contact — no IDE required. Open to ${esc(leadWant)}." />
  <meta property="og:image" content="${origin}/og.png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:type" content="image/png" />
  <meta property="og:image:alt" content="A code-editor styled card: '${esc(personName)} — a portfolio that is a code editor' over a terminal prompt reading '~ $ kushal --hire'." />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(personName)} — résumé &amp; contact" />
  <meta name="twitter:description" content="Experience, projects, contact — the readable build. Open to ${esc(leadWant)}." />
  <meta name="twitter:image" content="${origin}/og.png" />

  <script type="application/ld+json">${JSON.stringify(ld, null, 2).replace(/</g, '\\u003c')}</script>

  <style>
    :root {
      --paper: #f5f1ea; --card: #fdfaf4; --ink: #2b251d; --dim: #5f564a;
      --faint: #5e564a; --ember: #9c440a; --tide: #3d6e80; --sage: #346c37;
      --line: #ddd4c4;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: var(--paper); color: var(--ink);
      font: 16px/1.65 Georgia, 'Times New Roman', serif;
      padding: 48px 20px 80px;
    }
    main { max-width: 640px; margin: 0 auto; }
    .mono { font-family: ui-monospace, 'Cascadia Mono', Consolas, Menlo, monospace; }
    h1 { font-size: 34px; letter-spacing: -0.01em; }
    .tag { color: var(--ember); font-size: 14px; }
    h2 {
      font-family: ui-monospace, Consolas, monospace; font-size: 12px;
      text-transform: lowercase; letter-spacing: 0.14em; color: var(--ember);
      border-bottom: 1px solid var(--line); padding-bottom: 6px;
      margin: 44px 0 16px;
    }
    h2::before { content: '// '; }
    p { margin: 8px 0; }
    a { color: var(--tide); text-decoration: none; border-bottom: 1px dotted var(--tide); }
    a:hover { color: var(--ember); border-color: var(--ember); }
    .lede { color: var(--dim); font-size: 17px; }
    .avail {
      display: inline-block; margin-top: 14px; padding: 6px 14px;
      border: 1px solid var(--sage); color: var(--sage);
      font-family: ui-monospace, Consolas, monospace; font-size: 12.5px;
    }
    .avail::before { content: '● '; }
    .cta {
      display: inline-block; margin-top: 18px; padding: 10px 20px;
      background: var(--ember); color: var(--paper); border: none;
      font-family: ui-monospace, Consolas, monospace; font-size: 14px; font-weight: 700;
    }
    .cta:hover { background: var(--ink); }
    .env {
      background: var(--card); border: 1px solid var(--line);
      padding: 14px 18px; font-family: ui-monospace, Consolas, monospace;
      font-size: 13px; line-height: 2; overflow-wrap: anywhere;
    }
    .env .k { color: var(--tide); overflow-wrap: anywhere; }
    ul { list-style: none; }
    li { padding-left: 16px; position: relative; margin: 6px 0; color: var(--dim); }
    li::before { content: '–'; position: absolute; left: 0; color: var(--faint); }
    .role { font-family: ui-monospace, Consolas, monospace; font-size: 13.5px; color: var(--ink); }
    .period { color: var(--faint); font-size: 12.5px; font-family: ui-monospace, Consolas, monospace; }
    .proj { margin: 14px 0; }
    .proj .name { font-family: ui-monospace, Consolas, monospace; font-size: 14px; color: var(--tide); }
    .proj a { font-family: ui-monospace, Consolas, monospace; font-size: 12.5px; margin-left: 6px; }
    footer {
      margin-top: 60px; padding-top: 18px; border-top: 1px dashed var(--line);
      font-family: ui-monospace, Consolas, monospace; font-size: 12px; color: var(--faint);
      display: flex; justify-content: space-between; flex-wrap: wrap; gap: 8px;
    }
  </style>
</head>
<body>
<main>
  <header>
    <h1>${esc(personName)}</h1>
    <div class="tag mono">// grade-12 developer — ships software his school runs on</div>
    <p class="lede" style="margin-top:14px">
      Built ${flagship ? `<a href="${esc(flagshipHref ?? '#')}">the calendar platform</a>` : 'the calendar platform'} ${esc(flagship?.status?.replace(/^in production — /, '') ?? '1,500+ users')} at his school,
      and the school paper's site. Runs a 60-person student government; co-ran Western
      Canada's largest youth hackathon. Looking for <strong>${esc(leadWant)}</strong>.
    </p>
    <span class="avail">${esc(availLabel)}</span>
    ${env.RELOCATION ? `<span class="avail" style="border-color:var(--tide);color:var(--tide)">relocation: ${esc(env.RELOCATION)}${env.LOCATION ? ` · ${esc(env.LOCATION)}` : ''}</span>` : ''}
    <br />
    <a class="cta" href="${esc(ctaHref)}">write the email — it's pre-addressed →</a>
  </header>

  <section>
    <h2>contact</h2>
    <div class="env">
      <div><span class="k">EMAIL</span> = <a href="${esc(mailtoHref)}">${esc(env.EMAIL ?? '')}</a></div>
      ${env.PHONE ? `<div><span class="k">PHONE</span> = <a href="${esc(telHref)}">${esc(env.PHONE)}</a></div>` : ''}
      ${githubHref ? `<div><span class="k">GITHUB</span> = <a href="${esc(githubHref)}">${esc(env.GITHUB ?? '')}</a></div>` : ''}
      ${linkedinHref ? `<div><span class="k">LINKEDIN</span> = <a href="${esc(linkedinHref)}">${esc(env.LINKEDIN ?? '')}</a></div>` : ''}
      <div><span class="k">RESUME</span> = <a href="${esc(sitePath(env.RESUME_PDF) ?? '/resume.pdf')}">${esc(sitePath(env.RESUME_PDF) ?? '/resume.pdf')}</a></div>
      ${env.LOCATION ? `<div><span class="k">LOCATION</span> = ${esc(env.LOCATION)}</div>` : ''}
      <div><span class="k">RESPONSE_TIME_IF_YOU_SAY_CALENDAR</span> = ${esc(env.RESPONSE_TIME_IF_YOU_SAY_CALENDAR ?? '')}</div>
    </div>
  </section>

  <section>
    <h2>education &amp; certifications</h2>
${eduHtml}
${courseHtml}
${certHtml}
${awardHtml}
  </section>

  <section>
    <h2>experience</h2>
${expHtml}
  </section>

${communityHtml ? `  <section>
    <h2>community help</h2>
${communityHtml}
  </section>

` : ''}

  <section>
    <h2>projects</h2>
${projHtml}
  </section>

  <section>
    <h2>the rest</h2>
    <p class="lede">skills: ${esc(skillsLine)} — plus: running a 60-person team</p>
    <p class="lede" style="margin-top:10px">The full portfolio is itself a piece of work — a code editor you browse:
      a real file tree, a git graph of the career, and a working terminal.
      <a href="${origin}/">Open the IDE version →</a></p>
  </section>

  <footer>
    <span>exit code 0 — kushal v2027.0-beta · built ${today}</span>
    <span><a href="/sitemap.xml">sitemap</a> · <a href="/">the IDE</a> · <a href="/resume.pdf">pdf</a></span>
  </footer>
</main>
</body>
</html>
`,
)
console.log(`wrote ${out}`)
