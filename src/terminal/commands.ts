import { store, isPseudoTab, isDirtyPath } from '../state/store'
import type { TermLine, VisitorCommit } from '../state/store'
import type { Commit } from '../vfs/gitdata'
import { getNode, getDir, getFile, resolve, normalize, promptPath, allFiles, search } from '../vfs/fs'
import { ROOT } from '../vfs/files'
import type { VNode } from '../vfs/types'
import { COMMITS, BRANCH_NAMES } from '../vfs/gitdata'
import { diffLines } from '../vfs/diff'
import { startTour, abortTour, tourRunning } from '../tour/runner'
import { availabilityLabel } from '../lib/availability'

type Line = Omit<TermLine, 'id'>
const L = (kind: Line['kind'], text: string, cmd?: string): Line => ({ kind, text, cmd })

// when set, output goes here instead of the screen — pipes/redirects capture through it
let capture: Line[] | null = null
// last segment's exit status — `&&`/`||` honor it, `$?` reports it
let segFailed = false
let prevCwd = '' // OLDPWD — `cd -` hops back here, `env` reports it
let lastExit = 0
const push = (lines: Line[]) => {
  if (lines.some((l) => l.kind === 'err')) segFailed = true
  if (capture) capture.push(...lines)
  else store.getState().pushTerm(lines)
}
const out = (text: string) => L('out', text)

// born 2009-01-10 (the init commit says so) — a hardcoded "17 years" goes
// stale the morning after a birthday nobody remembered to grep for
const ageYears = () => {
  const b = new Date(2009, 0, 10)
  const n = new Date()
  return n.getFullYear() - b.getFullYear() - (n < new Date(n.getFullYear(), 0, 10) ? 1 : 0)
}

/** ~/.kushalrc — the aliases are real, not decorative */
const ALIASES: Record<string, string> = {
  ll: 'ls -la',
  la: 'ls -la',
  gs: 'git status',
  gd: 'git diff',
  gl: 'git log',
  gaa: 'git commit -m',
  rg: 'grep',
  please: 'sudo',
  yeet: 'rm',
  cls: 'clear',
  q: 'exit',
  hireme: 'kushal --hire',
  'code.': 'open .',
}

/** tldr <cmd> — plain-english one-liners. the man page for people in a hurry */
const TLDR: Record<string, string> = {
  ls: 'list the files here. the left sidebar shows the same thing.',
  cd: 'change folder. cd projects, then ls.',
  cat: 'print a file. cat README.md reads it in the terminal.',
  open: 'open a file as a tab, rendered nicely. open README.md',
  git: 'the career as commits. git log lists them; the left rail draws the graph.',
  grep: 'search every file for a word. grep rust finds it all.',
  vim: 'a trap. do not. (if stuck: type :q! and press enter)',
  npm: 'fake npm — npm test runs the suite, npm run dev refuses politely.',
  theme: 'switch colors. theme party makes it a rave.',
  help: 'this. you just ran it.',
  tldr: 'the command you are reading about right now. very meta.',
  pipe: 'not a command — | feeds one command into another. try: fortune | cowsay',
  sudo: 'ask nicely, get privileges. sudo hire kushal is the move.',
  js: 'a real javascript repl. js me() introduces the author.',
  hire: 'the whole point. prints email/resume/schedule. sudo hire-me opens your mail client pre-addressed.',
  exit: 'the terminal pretends to close. it always comes back.',
  touch: 'create a draft file. touch grass does… something else.',
  fortune: 'wisdom, generated fresh. pipe it into cowsay for maximum effect.',
  matrix: 'wake up. follow the white rabbit to theme demogod.',
  weekend: 'a foreign concept.',
  demo: 'kushal --demo plays the trailer — the site demos itself.',
  tour: 'the self-driving tour. any keypress takes the wheel back.',
}

/** baked-in env — rc exports override these, runtime `export X=y` overrides the rc */
const envBaked: Record<string, string> = {
  USER: 'visitor',
  HOME: '/', // the vfs root is the simulated home — /home/kushal doesn't exist
  SHELL: '/bin/kushalsh',
  TERM: 'portfolio-256color',
  EDITOR: 'vim (unfortunately)',
  HIREABLE: 'true',
  VIBE: 'immaculate',
}
/** runtime `export` writes here — wins over .kushalrc, like a real shell */
const envVars: Record<string, string> = {}

/** ~/.kushalrc is *sourced*, not decorative — aliases/exports parse from the live file (edits included) */
// rc functions become expansions too — except the conversion commands. a real
// shell lets hire() shadow the builtin; a portfolio does not.
const RC_PROTECTED = new Set(['hire', 'sudo', 'kushal', 'demo', 'sleep'])

function sourceRc(s: ReturnType<typeof store.getState>): { aliases: Record<string, string>; env: Record<string, string> } {
  const f = getFile('.kushalrc')
  const src = f ? (s.fileContents['.kushalrc'] ?? s.baselines['.kushalrc'] ?? f.original) : ''
  const aliases = { ...ALIASES }
  const env: Record<string, string> = {}
  for (const raw of src.split('\n')) {
    const line = raw.split('#')[0].trim()
    const am = /^alias\s+([\w.-]+)=(['"])(.*)\2$/.exec(line)
    if (am) aliases[am[1]] = am[3]
    const fm = /^([\w.-]+)\(\)\s*\{\s*(.+?)\s*;?\s*\}/.exec(line)
    if (fm && !RC_PROTECTED.has(fm[1])) aliases[fm[1]] = fm[2]
    const em = /^export\s+(\w+)=([^\s'"]+)/.exec(line)
    if (em) env[em[1]] = em[2]
  }
  return { aliases, env }
}

function envAll(s: ReturnType<typeof store.getState>): Record<string, string> {
  return { ...envBaked, ...sourceRc(s).env, ...envVars, PWD: `/${s.cwd}`, OLDPWD: `/${prevCwd}`, HOSTNAME: 'portfolio', '?': String(lastExit) }
}

function expandVars(token: string, s: ReturnType<typeof store.getState>): string {
  return token.replace(/\$(\w+|\?)/g, (_, name: string) => envAll(s)[name] ?? '')
}

/** split a command line on && / || / ; — respecting quotes; keeps the joint so chains can short-circuit */
function splitChain(input: string): { seg: string; joint: '&&' | '||' | ';' | null }[] {
  const parts: { seg: string; joint: '&&' | '||' | ';' | null }[] = []
  let cur = ''
  let q = ''
  for (let i = 0; i < input.length; i++) {
    const c = input[i]
    if (q) {
      cur += c
      if (c === q) q = ''
    } else if (c === '"' || c === "'") {
      q = c
      cur += c
    } else if (c === ';' || (c === '&' && input[i + 1] === '&') || (c === '|' && input[i + 1] === '|')) {
      const joint = c === ';' ? ';' : c === '&' ? '&&' : '||'
      parts.push({ seg: cur, joint })
      cur = ''
      if (c !== ';') i++
    } else {
      cur += c
    }
  }
  parts.push({ seg: cur, joint: null })
  return parts.map((p) => ({ ...p, seg: p.seg.trim() })).filter((p) => p.seg)
}

/** split on a single-char operator (| or >) outside quotes; returns [left, ...stages] */
function splitOp(input: string, op: string): string[] {
  const parts: string[] = []
  let cur = ''
  let q = ''
  for (let i = 0; i < input.length; i++) {
    const c = input[i]
    if (q) {
      cur += c
      if (c === q) q = ''
    } else if (c === '"' || c === "'") {
      q = c
      cur += c
    } else if (c === op) {
      parts.push(cur)
      cur = ''
    } else {
      cur += c
    }
  }
  parts.push(cur)
  return parts
}

/** run a command synchronously and collect its output lines (async drips still go live) */
function runCaptured(input: string): Line[] {
  const buf: Line[] = []
  capture = buf
  try {
    dispatchLine(input)
  } finally {
    capture = null
  }
  return buf
}

/** apply a pipe stage to captured lines — the classics all work */
function applyPipe(stage: string, lines: Line[]): Line[] | 'unhandled' {
  const [pc, ...pargs] = tokenize(stage)
  const texts = () => lines.map((l) => l.text)
  switch (pc) {
    case 'grep':
    case 'rg': {
      // flags before the pattern: -i case-insensitive, -v invert
      const flagStr = pargs.filter((a) => a.startsWith('-')).join('')
      const pat = pargs.filter((a) => !a.startsWith('-')).join(' ')
      if (!pat) return []
      const ci = flagStr.includes('i')
      const invert = flagStr.includes('v')
      const hits = (t: string) => {
        try {
          return new RegExp(pat, ci ? 'i' : '').test(t)
        } catch {
          return (ci ? t.toLowerCase() : t).includes(ci ? pat.toLowerCase() : pat)
        }
      }
      return lines.filter((l) => invert !== hits(l.text))
    }
    case 'head':
    case 'tail': {
      // -n 5 and -5 are both legal; -0 really means zero
      let n = 10
      for (let i = 0; i < pargs.length; i++) {
        if (pargs[i] === '-n') {
          const parsed = Number(pargs[++i])
          n = Number.isFinite(parsed) && parsed >= 0 ? parsed : 10
          continue
        }
        const m = /^-n?(\d+)$/.exec(pargs[i])
        if (m) n = Number(m[1])
      }
      return pc === 'head' ? lines.slice(0, n) : n === 0 ? [] : lines.slice(-n)
    }
    case 'wc':
      return [out(`  ${texts().length}  ${texts().join(' ').split(/\s+/).filter(Boolean).length}  ${texts().join(' ').length}`)]
    case 'sort': {
      const sorted = [...lines].sort((a, b) => a.text.localeCompare(b.text))
      return pargs.includes('-r') ? sorted.reverse() : sorted
    }
    case 'uniq': {
      const outL: Line[] = []
      for (const l of lines) if (outL.at(-1)?.text !== l.text) outL.push(l)
      return outL
    }
    case 'cat':
      return lines
    case 'tac':
      return [...lines].reverse()
    case 'nl': {
      let i = 0
      return lines.map((l) => L(l.kind, `  ${++i}\t${l.text}`))
    }
    case 'cowsay':
      return cowsayOut(lines.map((l) => l.text).join(' ').trim())
    case 'less':
    case 'more':
      return [...lines, L('dim', '(END — this is a fake pager, q is implicit)')]
    default:
      return 'unhandled'
  }
}

/** write captured output to a file — real files get dirty (committable!), new ones materialize */
function writeRedirect(spec: string, lines: Line[], append: boolean) {
  const s = store.getState()
  const target = tokenize(spec)[0]
  if (!target) {
    push([L('err', 'syntax error near unexpected token `newline\'')])
    return
  }
  const text = lines.map((l) => l.text).join('\n') + (lines.length ? '\n' : '')
  const path = target.startsWith('untitled:') ? target : resolve(s.cwd, target)
  if (getDir(path)) {
    push([L('err', `bash: ${target}: Is a directory`)])
    return
  }
  const f = getFile(path)
  if (f) {
    const cur = s.fileContents[path] ?? s.baselines[path] ?? f.original
    s.editFile(path, append ? cur + text : text)
    push([L('ok', `→ ${path} ${append ? '(appended)' : 'written'} — now dirty. git status notices.`), L('dim', '    it\'s a real edit: you can `git diff` or commit it to visitor/you')])
    return
  }
  const name = path.split('/').pop() || 'output.txt'
  const key = path.startsWith('untitled:') ? path : `untitled:${name}`
  if (!(key in s.virtualFiles)) {
    store.setState((st) => ({ virtualFiles: { ...st.virtualFiles, [key]: '' } }))
  }
  const cur = s.fileContents[key] ?? s.virtualFiles[key] ?? ''
  s.editFile(key, append ? cur + text : text)
  push([L('ok', `→ ${name} materialized in untitled/ — open it, commit it, it's yours now`, `open ${key}`)])
}

/** working-tree read — edits overlay commits overlay originals */
const readFile = (s: ReturnType<typeof store.getState>, path: string, orig: string) =>
  s.fileContents[path] ?? s.baselines[path] ?? orig

/** resolve a file operand to text — real files and untitled drafts, never binaries */
const readOperand = (s: ReturnType<typeof store.getState>, a: string): string | null => {
  const p = a.startsWith('untitled:') ? a : resolve(s.cwd, a)
  const f = getFile(p)
  if (f && f.kind !== 'pdf' && f.kind !== 'image') return readFile(s, f.path, f.original)
  if (p.startsWith('untitled:') && Object.hasOwn(s.virtualFiles, p))
    return s.fileContents[p] ?? s.baselines[p] ?? s.virtualFiles[p]
  return null
}

function tokenize(input: string): string[] {
  const m = input.match(/"[^"]*"|'[^']*'|\S+/g) ?? []
  return m.map((t) => t.replace(/^['"]|['"]$/g, ''))
}

function fmtTree(node: VNode, prefix: string, isLast: boolean): Line[] {
  const name = node.name === '' ? 'portfolio/' : node.type === 'dir' ? node.name + '/' : node.name
  const lines: Line[] = [L(node.type === 'dir' ? 'accent' : 'out', `${prefix}${isLast ? '└── ' : '├── '}${name}`)]
  if (node.type === 'dir') {
    // getDir merges in revealed secrets — getNode's raw children would hide them
    const kids = getDir(node.path)?.children ?? []
    kids.forEach((c, i) => {
      lines.push(...fmtTree(c, prefix + (isLast ? '    ' : '│   '), i === kids.length - 1))
    })
  }
  return lines
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

// the one theme party allowed at a time — module-level so a second
// `theme --party` can toggle it off instead of stacking another interval
let partyStop: (() => void) | null = null

async function drip(lines: { text: string; kind?: Line['kind']; delay?: number; cmd?: string }[]) {
  for (const l of lines) {
    await sleep(l.delay ?? 90)
    store.getState().pushTerm([L(l.kind ?? 'out', l.text, l.cmd)])
  }
}

export function runPortfolioBuild() {
  const s = store.getState()
  s.setPanelTab('terminal')
  push([L('input', `${promptPath(s.cwd)} $ kushal build --production`)])
  void drip([
    { text: '▸ resolving dependencies… found: grit, curiosity, caffeine', delay: 160 },
    { text: '▸ compiling personality…', delay: 380 },
    { text: '▸ tree-shaking imposter syndrome… removed 0 bytes (it persists)', delay: 360 },
    { text: '▸ bundling projects/ → 5 modules, 0 circular deps, 1 circular sleep schedule', delay: 420 },
    { text: '▸ minifying excuses…', delay: 320 },
    { text: '✓ built in 0.42s — 0 warnings about career choices', kind: 'ok', delay: 420 },
    { text: '→ artifact ready. press F5 or "build for production" to view.', kind: 'dim', delay: 200 },
  ])
}

export const COMMAND_NAMES = [...new Set([
  'kushal', 'hire', 'contact', 'resume', 'git', 'grep', 'history', 'theme', 'clear',
  'help', 'ls', 'cd', 'cat', 'open', 'code', 'pwd', 'tree', 'whoami', 'hostname',
  'sort', 'uniq', 'less', 'more', 'rg', 'diff', 'echo',
  'echo', 'date', 'uname', 'neofetch', 'man', 'ping', 'ssh', 'curl', 'top', 'htop',
  'sudo', 'vim', 'vi', 'nvim', 'nano', 'emacs', 'exit', 'logout', 'quit', 'rm', 'make',
  'npm', 'reboot', 'shutdown', 'true', 'false', 'which', 'wc', 'head', 'tail', 'bye',
  'sl', 'cowsay', 'fortune', 'js', 'settings', 'achievements', 'trophies', 'touch', 'tour', 'ed',
  'env', 'printenv', 'export', 'file', 'find', 'fd', 'uptime', 'who', 'ps', 'df', 'free',
  'nproc', 'cloc', 'tokei', 'kill', 'killall', 'pkill', 'apt', 'apt-get', 'brew', 'pacman',
  'docker', 'kubectl', 'python', 'python3', 'node', 'gcc', 'rustc', 'cargo', 'go',
  'mv', 'cp', 'mkdir', 'ln', 'lazygit', 'lg', 'matrix', 'grind', 'vimtutor',
  'tourist', 'jargon', 'tldr', 'wtf', 'say', 'weather', 'coffee',
  'projects', 'skills', 'experience', 'about', 'start', 'hello', 'hi', 'portfolio',
  'career', 'work', 'guide', 'map', 'slides', 'deck', 'present',
  'weekend', 'demo', 'alias', 'sleep', 'dnf', 'yum', 'k8s', 'deno', 'bun', 'branches',
  'linkedin', 'github', 'transcript', 'grades', 'gpa', 'certs', 'certificates',
  'phone', 'schedule', 'interview', 'call', 'meeting',
  'gca', 'gs', 'please', 'oops', 'yolo', // sourced from ~/.kushalrc
  ...Object.keys(ALIASES),
])]

export function exec(raw: string, echo = true) {
  const s = store.getState()
  const input = raw.trim()

  // vim trap swallows everything until :q! / :wq / ZZ
  if (s.vimTrapped) {
    if (input) s.pushHistory(input)
    vimBuffer(input)
    return
  }

  if (echo) push([L('input', `${promptPath(s.cwd)} $ ${input}`)])
  // echo=false is automation — the demo, tours, tests. silent commands must
  // not land in ↑-history or the cmd-count achievements
  if (input && echo) s.pushHistory(input)
  if (!input) return

  let prevJoint: '&&' | '||' | ';' | null = null
  for (const { seg, joint } of splitChain(input)) {
    // short-circuit like a real shell: && needs success, || needs failure
    if (prevJoint === '&&' && lastExit !== 0) { prevJoint = joint; continue }
    if (prevJoint === '||' && lastExit === 0) { prevJoint = joint; continue }
    segFailed = false
    runSegment(seg)
    lastExit = segFailed ? 1 : 0
    prevJoint = joint
  }
}

/** one chain segment: detect redirects + pipes, or dispatch directly */
function runSegment(seg0: string) {
  const red = findRedirect(seg0)
  const body = red ? red.body : seg0
  const stages = splitOp(body, '|')
    .map((x) => x.trim())
    .filter(Boolean)
  if (!stages.length) {
    // bare `> file` — the shell still creates/truncates the target
    if (red) writeRedirect(red.target, [], red.append)
    return
  }

  if (stages.length > 1 || red) {
    const captured = runCaptured(stages[0])
    // stderr stays on the terminal — real shells don't pipe it downstream or
    // write it into redirect targets (except 2>, which redirects it there).
    // pushTerm bypasses the segFailed marker; the failure was already recorded
    // while the lines were captured.
    const errLines = captured.filter((l) => l.kind === 'err')
    if (errLines.length && !red?.fd2) store.getState().pushTerm(errLines)
    let lines = captured.filter((l) => l.kind !== 'err')
    for (const stage of stages.slice(1)) {
      const r = applyPipe(stage, lines)
      if (r === 'unhandled') {
        push([L('err', `pipe: '${tokenize(stage)[0]}' — the plumbing here is limited. grep/head/tail/wc/sort/uniq/cat/tac/nl/cowsay flow fine.`)])
        return
      }
      // a pipe-stage grep that selects nothing exits 1 — real semantics, and
      // `… | grep x || echo missing` depends on the failure propagating
      if (/^(grep|rg)\b/.test(stage.trim()) && r.length === 0) segFailed = true
      lines = r
    }
    if (stages.length > 1) store.getState().unlock('pipe-dream')
    if (red) {
      if (red.target.includes('|')) {
        // `cmd > f | next` would silently eat the pipe — call it what it is
        push([L('err', `bash: syntax error near unexpected token '|'`)])
        return
      }
      if (red.fd2) {
        if (errLines.length) writeRedirect(red.target, errLines, red.append)
        if (lines.length) push(lines)
      } else {
        writeRedirect(red.target, lines, red.append)
      }
    } else push(lines)
    return
  }
  dispatchLine(stages[0])
}

/** rightmost top-level `>` / `>>` / `2>` splits the command from its target */
function findRedirect(seg: string): { body: string; target: string; append: boolean; fd2: boolean } | null {
  let q = ''
  for (let i = 0; i < seg.length; i++) {
    const c = seg[i]
    if (q) {
      if (c === q) q = ''
      continue
    }
    if (c === '"' || c === "'") {
      q = c
      continue
    }
    if (c === '>') {
      const append = seg[i + 1] === '>'
      // `cmd 2> f` is the stderr redirect — the 2 belongs to the operator
      const fd2 = seg[i - 1] === '2' && (i === 1 || seg[i - 2] === ' ')
      return { body: seg.slice(0, i - (fd2 ? 1 : 0)).trim(), target: seg.slice(i + (append ? 2 : 1)).trim(), append, fd2 }
    }
  }
  return null
}

/** alias-expand, var-expand, and run the actual command */
function dispatchLine(input: string, expanded = new Set<string>()) {
  const s = store.getState()
  let [cmd, ...args] = tokenize(input)
  if (!cmd) return
  // real shells expand an alias once per word — a self/mutual alias can't recurse
  const alias = expanded.has(cmd) ? undefined : (sourceRc(s).aliases[cmd] ?? ALIASES[cmd])
  if (alias && alias !== cmd) {
    expanded.add(cmd)
    // the expansion echo is shell chrome — during capture it goes to the
    // terminal, not the buffer, or pipes/redirects would ingest it
    const echo = L('dim', `  → ${alias}${args.length ? ' ' + args.join(' ') : ''}`)
    if (capture) store.getState().pushTerm([echo])
    else push([echo])
    return dispatchLine(`${alias} ${args.join(' ')}`.trim(), expanded)
  }
  args = args.map((a) => expandVars(a, s))

  switch (cmd) {
    case 'help':
      push([
        ...(s.settings['kushal.jargon'] === 'tourist'
          ? [L('dim', "short version: click things in the left rail. `kushal --hire` when you're sold.")]
          : []),
        L('accent', 'available commands'),
        out('  ls cd cat tree open code pwd     filesystem (it is real)'),
        out('  whoami kushal hire contact     the person'),
        out('  git log|status|diff|commit     the career, and your edits'),
        out('  grep <pattern>                 search every file'),
        out('  js <expr>                      a real js repl'),
        out('  man kushal                     the manual'),
        out('  env export echo                the shell is a shell'),
        out('  neofetch theme vim rm make     the toys'),
        out('  sl cowsay fortune matrix       the other toys'),
        L('dim', '  ── click a line to run it ──'),
        L('out', '  › tour          the IDE drives itself for 30s', 'tour'),
        L('out', '  › kushal --demo the trailer — the site demos itself', 'kushal --demo'),
        L('out', '  › man kushal    the manual, as a man page', 'man kushal'),
        L('out', '  › js me()       ask the repl who this is', 'js me()'),
        L('out', '  › npm test      the test suite. it passes.', 'npm test'),
        L('out', '  › fortune       wisdom, generated', 'fortune'),
        L('dim', '  real plumbing: `help | grep toys` · `fortune > note.txt` · `ls && pwd`'),
        L('dim', '  hint: everything is a file. try `cat skills.toml`'),
      ])
      return

    case 'ls': {
      const long = args.includes('-la') || args.includes('-l') || args.includes('-al')
      const pathArg = args.find((a) => !a.startsWith('-'))
      const target = pathArg ? resolve(s.cwd, pathArg) : s.cwd
      const dir = getDir(target)
      if (!dir) {
        // `ls file` lists the file itself, not an error
        const single = getFile(target)
        const draftKey = target.startsWith('untitled:') ? target : `untitled:${target}`
        const isDraft = !single && Object.hasOwn(s.virtualFiles, draftKey)
        if (single || isDraft) {
          const name = single ? single.name : draftKey.slice(9)
          const content = single
            ? (s.fileContents[single.path] ?? s.baselines[single.path] ?? single.original)
            : (s.fileContents[draftKey] ?? s.virtualFiles[draftKey] ?? '')
          if (long) {
            const size = String(content.length).padStart(5)
            push([L('out', `-rw-r--r--  kushal kushal  ${size}  Jan 10  ${name}`)])
          } else {
            push([L('out', `  ${name}`)])
          }
        } else {
          push([L('err', `ls: cannot access '${pathArg ?? target}': No such directory`)])
        }
        return
      }
      const lines: Line[] = []
      if (long) {
        const sib = (n: VNode) => (n.type === 'dir' ? 'drwxr-xr-x' : '-rw-r--r--')
        for (const c of dir.children) {
          // live size — a visitor-edited file isn't `original.length` anymore;
          // a committed edit lives in baselines once fileContents drops it
          const size = c.type === 'file' ? String((s.fileContents[c.path] ?? s.baselines[c.path] ?? c.original).length).padStart(5) : ' 4096'
          const dirty = c.type === 'file' && s.fileContents[c.path] !== undefined && s.fileContents[c.path] !== (s.baselines[c.path] ?? c.original)
          lines.push(
            L(
              c.type === 'dir' ? 'accent' : 'out',
              `${sib(c)}  kushal kushal  ${size}  ${'Jan 10'}  ${c.name}${c.type === 'dir' ? '/' : ''}${dirty ? ' *' : ''}`,
            ),
          )
        }
        if ((target === '' || target === '.') && Object.keys(s.virtualFiles).length > 0) {
          lines.push(L('dim', '-rw-------  kushal kushal      ?  ???     untitled/  (your drafts)'))
        }
      } else {
        for (const c of dir.children) {
          lines.push(L(c.type === 'dir' ? 'accent' : 'out', `  ${c.name}${c.type === 'dir' ? '/' : ''}`))
        }
      }
      push(lines.length ? lines : [L('dim', '  (empty — like my calendar, allegedly)')])
      return
    }

    case 'cd': {
      // `cd -` hops back to the previous dir — OLDPWD is tracked for real
      const back = args[0] === '-'
      const target = back ? prevCwd : resolve(s.cwd, args[0] ?? '~')
      if (target === '' || getDir(target)) {
        if (back) push([out(`/${normalize(target)}`)])
        prevCwd = s.cwd
        store.getState().setCwd(normalize(target))
      } else {
        const f = getFile(target)
        push([L('err', f ? `cd: ${args[0]}: Not a directory` : `cd: no such directory: ${args[0]}`)])
      }
      return
    }

    case 'pwd':
      push([out(`/${s.cwd}`)])
      return

    case 'tree': {
      const node = s.cwd ? (getNode(s.cwd) ?? ROOT) : ROOT
      push(fmtTree(node, '', true))
      return
    }

    case 'cat':
    case 'head':
    case 'tail': {
      // -n 5 and -5 are both legal for head/tail; for cat -n numbers lines.
      // operands collect — `cat a b` concatenates, it doesn't drop `a`
      let count = 10
      let numbered = false
      const operands: string[] = []
      for (let i = 0; i < args.length; i++) {
        const a = args[i]
        if (a === '-n') {
          if (cmd === 'cat') {
            numbered = true
          } else {
            const parsed = Number(args[++i])
            // `head -n file` consumed the filename as the count — say so
            if (!Number.isFinite(parsed) || parsed < 0) {
              push([L('err', `${cmd}: invalid number of lines: '${args[i]}'`)])
              return
            }
            count = parsed
          }
          continue
        }
        if (cmd !== 'cat' && /^-n?\d+$/.test(a)) {
          count = Number(a.replace(/^-n?/, ''))
          continue
        }
        if (a.startsWith('-')) continue
        operands.push(a)
      }
      if (!operands.length) {
        push([L('err', `${cmd}: missing file operand. the void stares back.`)])
        return
      }
      const lines: Line[] = []
      let missing = 0
      for (const arg0 of operands) {
        const target = resolve(s.cwd, arg0)
        const f = getFile(target)
        // untitled drafts are cat-able too — but only by bare name or explicit
        // untitled: path. `cat dir/x` must not fall back to a draft called x
        const ukey = f ? null : arg0.startsWith('untitled:') ? arg0 : !arg0.includes('/') ? `untitled:${arg0}` : null
        if (!f && !(ukey && Object.hasOwn(s.virtualFiles, ukey))) {
          push([L('err', `${cmd}: ${arg0}: No such file`)])
          missing++
          continue
        }
        if (f && (f.kind === 'pdf' || f.kind === 'image')) {
          push([L('err', `${cmd}: ${f.name}: binary file — try 'open ${f.path}'`)])
          missing++
          continue
        }
        const content = f
          ? readFile(s, f.path, f.original)
          // baselines hold committed drafts — fileContents drops them post-commit
          : (s.fileContents[ukey!] ?? s.baselines[ukey!] ?? s.virtualFiles[ukey!] ?? '')
        lines.push(...content.split('\n').map((l) => out(l)))
      }
      if (!lines.length && missing) return
      if (cmd === 'head') {
        push(lines.slice(0, count))
      } else if (cmd === 'tail') {
        push(count === 0 ? [] : lines.slice(-count))
      } else if (numbered) {
        push(lines.map((l, i) => out(`${String(i + 1).padStart(6)}  ${l.text}`)))
      } else {
        push(lines)
      }
      return
    }

    case 'open':
    case 'code': {
      if (!args.length) {
        push([L('err', `${cmd}: open what? try 'open README.md'`)])
        return
      }
      if (args[0] === '.') {
        s.ensureView('explorer')
        push([L('dim', 'you are already inside it. the explorer is to your left.')])
        return
      }
      // pseudo-tabs open as themselves — test the raw arg, resolving would prefix cwd
      const raw = args[0]
      const lm = /^(.*):(\d+)$/.exec(raw)
      if (isPseudoTab(raw) && (Object.hasOwn(s.virtualFiles, raw) || !raw.startsWith('untitled:'))) {
        // only claim success when openPseudo validates — `open ui:garbage`
        // toasts a rejection; printing "opened" on top would lie twice
        if (s.openPseudo(raw)) push([L('dim', `opened ${raw}`)])
        return
      }
      // path:line — grep-style targets jump to the line
      const target = lm ? lm[1] : raw
      const resolved = target.startsWith('untitled:') ? target : resolve(s.cwd, target)
      const f = getFile(resolved)
      if (f) {
        s.openFile(f.path, lm ? { line: Number(lm[2]), mode: 'raw' } : undefined)
        push([L('dim', `opened ${f.path}`)])
        return
      }
      // drafts resolve by bare name or untitled: key only — `open dir/x` must
      // not silently open an unrelated draft that happens to share the name
      const ukey = resolved.startsWith('untitled:') ? resolved : target.includes('/') ? null : `untitled:${target}`
      if (ukey && Object.hasOwn(s.virtualFiles, ukey)) {
        s.openPseudo(ukey)
        push([L('dim', `opened ${ukey}`)])
        return
      }
      push([L('err', `${cmd}: cannot find '${args[0]}' in workspace`)])
      return
    }

    case 'whoami':
      push([out('kushal — grade 12 · ships software 1,500+ students and faculty use · student-gov co-pm. you knew this.')])
      return

    case 'hostname':
      push([out('portfolio')])
      return

    case 'date':
      push([out(new Date().toString())])
      return

    case 'echo': {
      // -n suppresses the newline (cosmetic here — honor it, don't print it)
      const body = args[0] === '-n' ? args.slice(1) : args
      push([out(body.join(' ') || '')])
      return
    }

    case 'uname':
      push([out('kushalOS portfolio 2027.0-beta x86_64-caffeinated GNU/life')])
      return

    case 'which':
      push([out(args[0] === 'kushal' ? '/usr/bin/kushal (open to offers)' : `/usr/bin/${args[0] ?? 'nothing'} — probably`)])
      return

    case 'wc': {
      // wc <file> counts real lines/words/chars; bare wc keeps the joke
      const linesOnly = args.includes('-l')
      const target = args.find((a) => !a.startsWith('-'))
      if (target) {
        const text = readOperand(s, target)
        if (text === null) {
          const p = resolve(s.cwd, target)
          push([L('err', `wc: ${target}: ${getFile(p) ? 'binary file — read it with your eyes' : 'No such file or directory'}`)])
          return
        }
        // real wc counts newlines — a trailing \n doesn't invent a phantom line
        const lc = text === '' ? 0 : text.split('\n').length - (text.endsWith('\n') ? 1 : 0)
        const wc_ = text.split(/\s+/).filter(Boolean).length
        push([out(linesOnly ? `  ${lc} ${target}` : `  ${lc}  ${wc_}  ${text.length} ${target}`)])
        return
      }
      push([out(`${allFiles().length} files, 1 developer, 0 excuses`)])
      return
    }

    case 'true':
      return
    case 'false':
      segFailed = true // && short-circuits on us, correctly
      push([L('dim', 'exit status 1 — much like my sleep schedule')])
      return

    case 'clear':
      s.clearTerm()
      return

    case 'history': {
      const h = s.termHistory.slice(-15)
      push(h.map((c, i) => out(`  ${s.termHistory.length - h.length + i + 1}  ${c}`)))
      return
    }

    case 'kushal': {
      const flag = args[0]
      if (flag === '--version' || flag === '-v') {
        push([out('kushal 2027.0-beta (x86_64-sleep-deprived)')])
      } else if (flag === '--stats') {
        push([
          L('accent', 'kushal --stats'),
          out(`  commits.............. ${COMMITS.length} public, ∞ stashed`),
          out('  languages............ 9 listed, 0 inflated'),
          out('  coffee cups.......... ∞/∞ (sustainably sourced)'),
          out('  bugs shipped......... yes'),
          out('  bugs fixed........... yes + 1'),
          out('  side quests.......... ongoing'),
          L('ok', '  hireability.......... maximum'),
        ])
      } else if (flag === '--hire') {
        hireSeq()
      } else if (flag === '--demo') {
        demoSeq()
      } else if (flag === '--internship') {
        // the man page advertises this flag — it has to actually do something
        push([
          out('status: actively seeking summer 2027 internships'),
          L('dim', 'flag set. `hire` prints the coordinates · `contact` opens the env file'),
        ])
      } else if (flag === '--coffee') {
        const n = Number(args[1])
        const cups = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 1
        push([
          out(`throughput +${cups} cup${cups === 1 ? '' : 's'}`),
          L('dim', cups > 6 ? 'warning: undefined behavior achieved. vibrating audibly.' : cups > 3 ? 'diminishing returns engaged' : 'peak throughput range'),
        ])
      } else if (flag === '--ship-it') {
        runPortfolioBuild()
      } else {
        push([
          out('usage: kushal [--version | --stats | --hire | --demo | --internship | --coffee N | --ship-it]'),
          L('dim', 'hint: --hire is the good one · --demo plays the trailer'),
        ])
      }
      return
    }

    case 'hire':
      hireSeq()
      return

    case 'demo':
      demoSeq()
      return

    case 'contact':
      s.openFile('contact.env')
      push([L('dim', 'opening contact.env — the secrets are redacted, the email is real')])
      return

    case 'resume':
      s.openFile('resume.pdf')
      push([L('dim', 'opening resume.pdf')])
      return

    // recruiter vocabulary — the nouns a non-dev types, routed somewhere real
    case 'linkedin':
      window.open('https://linkedin.com/in/kushal-gangarapu', '_blank', 'noreferrer')
      push([L('ok', 'linkedin.com/in/kushal-gangarapu ↗'), L('dim', 'opened in a new tab')])
      return

    case 'github':
      window.open('https://github.com/KushalGangarapu', '_blank', 'noreferrer')
      push([L('ok', 'github.com/KushalGangarapu ↗'), L('dim', 'opened in a new tab')])
      return

    case 'transcript':
    case 'grades':
    case 'gpa':
      s.openFile('experience.json')
      push([L('dim', 'opening experience.json — AP CSA: 5 · AP Calc BC: 4 · coursework inside')])
      return

    case 'certs':
    case 'certificates':
      s.openFile('certs/cs50ai-harvard.pdf')
      push([L('dim', 'opening certs/ — harvard CS50AI · helsinki fullstack · imperial math-for-ml')])
      return

    case 'phone':
      s.openFile('contact.env')
      push([L('dim', 'opening contact.env — PHONE= is in there, unredacted')])
      return

    case 'schedule':
    case 'interview':
    case 'call':
    case 'meeting':
      s.openFile('contact.env')
      push([L('dim', 'opening contact.env — SCHEDULING= is the line you want')])
      return

    case 'git': {
      const sub = args[0]
      if ((sub === 'log' || sub === undefined) && args.includes('--graph')) {
        s.ensureView('git')
        push([L('dim', 'opening the real graph — better than ascii, honestly')])
      } else if (sub === 'log' || sub === undefined) {
        if (args.includes('--oneline')) {
          for (const v of [...s.visitorCommits].reverse()) {
            push([L('accent', `${v.hash} ${v.msg}`, 'view:git')])
          }
          for (const c of COMMITS) {
            push([L('accent', `${c.hash} ${c.msg}${c.tag ? ` (tag: ${c.tag})` : ''}`, `commit:${c.hash}`)])
          }
          return
        }
        const total = COMMITS.length + s.visitorCommits.length
        push([L('accent', `commit history — ${total} commits, 2 branches merged${s.visitorCommits.length ? ', 1 visitor' : ''}, 0 regrets`)])
        for (const v of [...s.visitorCommits].reverse()) {
          push([
            L('accent', `commit ${v.hash} (visitor/you)`, 'view:git'),
            out(`    ${v.msg}`),
            L('dim', `    files: ${v.files.join(', ')}`),
          ])
        }
        COMMITS.forEach((c) => {
          push([
            L('accent', `commit ${c.hash}${c.tag ? ` (tag: ${c.tag})` : ''} (${c.date})`, `commit:${c.hash}`),
            out(`    ${c.msg}`),
            ...(c.files?.length ? [L('dim', `    files: ${c.files.join(', ')}`)] : []),
          ])
        })
      } else if (sub === 'status') {
        const dirty = Object.keys(s.fileContents).filter((p) => isDirtyPath(s, p))
        // untracked = drafts that were never committed (no baseline)
        const untracked = Object.keys(s.virtualFiles).filter((p) => !(p in s.baselines))
        const untrackedSet = new Set(untracked)
        const modified = dirty.filter((p) => !untrackedSet.has(p))
        push([
          out('On branch main'),
          out("Your branch is ahead of 'graduation' by 2 commits."),
          out(''),
          ...(modified.length
            ? [
                out('Changes not staged for commit:'),
                ...modified.map((p) => L('red', `        modified:   ${p.startsWith('untitled:') ? p.slice(9) : p}`, `open /${p}`)),
                L('dim', '        (click a path to open it — or `git commit -m "…"`)'),
              ]
            : [L('dim', 'no changes — working tree clean (suspiciously so)')]),
          ...(untracked.length
            ? [out(''), out('Untracked files:'), ...untracked.map((p) => L('red', `        ${p.slice(9)}  (your draft)`, `open ${p}`))]
            : []),
          out(''),
          L('red', '        modified:   life/sleep-schedule.json'),
          L('red', '        untracked:  feelings/'),
          L('dim', 'nothing added to commit but untracked files present'),
        ])
        segFailed = false // real git exits 0 on a dirty tree — the red is styling, not failure
      } else if (sub === 'diff') {
        const pathArg = args[1] ? (args[1].startsWith('untitled:') ? args[1] : resolve(s.cwd, args[1])) : null
        const files = pathArg
          ? [pathArg]
          : Object.keys(s.fileContents).filter((p) => getFile(p) || Object.hasOwn(s.baselines, p) || Object.hasOwn(s.virtualFiles, p))
        let printed = false
        for (const p of files) {
          const f = getFile(p)
          const isU = p.startsWith('untitled:')
          if (!f && !isU) continue
          // a committed draft's baseline is the committed text; an uncommitted
          // draft diffs against its empty birth
          const base = isU ? (s.baselines[p] ?? s.virtualFiles[p] ?? '') : (s.baselines[p] ?? f?.original)
          const cur = isU ? (s.fileContents[p] ?? s.baselines[p] ?? s.virtualFiles[p]) : s.fileContents[p]
          if (cur === undefined || cur === base) continue
          printed = true
          push([L('accent', `diff --git a/${p} b/${p}`)])
          for (const l of diffLines(base ?? '', cur)) {
            if (l.type === 'add') push([L('ok', `+${l.text}`)])
            else if (l.type === 'del') push([L('red', `-${l.text}`)])
            else push([L('dim', ` ${l.text}`)])
          }
        }
        if (!printed) push([L('dim', 'no diff — your working tree is clean. edit something first.')])
        segFailed = false // '-' lines are styled err — diff still exits 0
      } else if (sub === 'commit') {
        if (args.includes('--amend')) {
          const mi = args.findIndex((a) => a === '-m')
          const last = s.visitorCommits.at(-1)
          if (!last) {
            push([L('err', 'fatal: nothing to amend — visitor/you is a clean lane')])
          } else {
            const msg = mi >= 0 ? args.slice(mi + 1).join(' ') : last.msg
            store.setState((st) => ({
              visitorCommits: st.visitorCommits.map((c, i) =>
                i === st.visitorCommits.length - 1 ? { ...c, msg } : c,
              ),
            }))
            push([L('ok', `[visitor/you ${last.hash}] amended → "${msg}" — history is a draft here`)])
          }
          return
        }
        const mi = args.findIndex((a) => a === '-m')
        const msg = mi >= 0 ? args.slice(mi + 1).join(' ') : ''
        const before = s.visitorCommits.length
        s.commitChanges(msg)
        const after = store.getState().visitorCommits
        if (after.length > before) {
          const c = after[after.length - 1]
          push([
            L('ok', `[visitor/you ${c.hash}] ${c.msg}`),
            out(` ${c.files.length} file${c.files.length === 1 ? '' : 's'} changed — immortalized in the graph`),
            L('dim', '    open Source Control to see your lane. it persists.'),
          ])
        } else {
          push([L('dim', 'nothing to commit, working tree clean')])
        }
      } else if (sub === 'reset') {
        // `oops` lands here — undo your own commit, keep the work
        const last = s.visitorCommits.at(-1)
        if (!last) {
          push([L('dim', 'nothing to uncommit — visitor/you has no history yet')])
        } else {
          store.setState((st) => {
            const baselines = { ...st.baselines }
            const fileContents = { ...st.fileContents }
            for (const p of last.files) {
              if (p in baselines) {
                // edits made AFTER the commit are working-tree state — reset
                // only revives the committed snapshot for untouched files,
                // like a real `git reset` that leaves the worktree alone
                if (!(p in fileContents)) fileContents[p] = baselines[p]
                if (last.previousBaselines && p in last.previousBaselines) {
                  baselines[p] = last.previousBaselines[p]
                } else {
                  delete baselines[p]
                }
              }
            }
            return { baselines, fileContents, visitorCommits: st.visitorCommits.slice(0, -1) }
          })
          push([L('ok', `uncommitted ${last.hash} — back in the working tree, like it never shipped`)])
        }
      } else if (sub === 'add' || sub === 'stage') {
        // staging is implicit here — everything dirty is already commit-ready
        const n = Object.keys(s.fileContents).filter((p) => isDirtyPath(s, p)).length
        push([
          L('dim', n ? `${n} change${n === 1 ? '' : 's'} already staged — this index skips the middleman.` : 'nothing to stage — working tree clean'),
          ...(n ? [L('dim', '    `git commit -m "…"` ships it to visitor/you')] : []),
        ])
        segFailed = false
      } else if (sub === 'checkout' || sub === 'restore') {
        const rest = args.slice(1)
        const branchIdx = rest.findIndex((a) => a === '-b')
        // `checkout .`/`restore .` mean "everything"; a bare `checkout` with no
        // paths is a usage error — it must never reach revertAll
        const wantsAll = rest.includes('.') || rest.includes('--all')
        // the -b operand is skipped only when -b actually exists — with no -b,
        // branchIdx is -1 and i !== branchIdx + 1 would silently eat arg 0
        const pathArgs = rest.filter((a, i) => !a.startsWith('-') && a !== '.' && a !== '--' && (branchIdx < 0 || i !== branchIdx + 1))
        if (wantsAll) {
          const n = Object.keys(s.fileContents).filter((p) => isDirtyPath(s, p) && !p.startsWith('untitled:')).length
          if (n) {
            s.revertAll()
            push([L('ok', `reverted ${n} change${n === 1 ? '' : 's'} — history rewritten, regrets preserved. drafts kept.`)])
          } else {
            push([L('dim', 'nothing to revert. the timeline was already clean.')])
          }
        } else if (branchIdx >= 0) {
          const name = rest[branchIdx + 1]
          push([name
            ? L('dim', `switched to a new branch '${name}' — decoratively. main and visitor/you are the real lanes.`)
            : L('err', 'fatal: switch to what? -b needs a branch name')])
        } else if (pathArgs.length) {
          // scoped: `git restore file` / `git checkout -- file` reverts just that path
          let reverted = 0
          for (const a of pathArgs) {
            const key = a.startsWith('untitled:')
              ? a
              : resolve(s.cwd, a)
            if (Object.hasOwn(s.fileContents, key) || (key.startsWith('untitled:') && Object.hasOwn(s.virtualFiles, key))) {
              s.revertFile(key)
              reverted++
            } else {
              push([L('err', `error: pathspec '${a}' did not match any modified file`)])
            }
          }
          if (reverted) push([L('ok', `reverted ${reverted} file${reverted === 1 ? '' : 's'} — surgical strike`)])
        } else {
          push([L('err', `fatal: ${sub === 'checkout' ? "you must specify a branch or path(s) — try 'git checkout .' to restore everything" : "you must specify path(s) — try 'git restore .'"}`)])
        }
      } else if (sub === 'blame') {
        push([
          out(`^1a2b3c4 (Kushal Gangarapu 2009-01-10 init) 1) all of it`),
          L('dim', `^ every line. blame the init commit.`),
        ])
      } else if (sub === 'push') {
        push([L('err', 'error: failed to push. the remote is called "real life" and it rejects everything.')])
      } else if (sub === 'branch' || sub === 'branches') {
        push([
          ...Object.values(BRANCH_NAMES).map((b, i) => out(`${i === 0 ? '*' : ' '} ${b}`)),
          L('dim', '  remotes/origin/career — fast-forwarding'),
        ])
      } else if (sub === 'show') {
        const target = args[1]
        // HEAD = latest visitor commit if any, else latest career commit;
        // HEAD~n/HEAD^ walk the merged lane (visitor commits newest-first)
        const rev = /^head(?:([~^])(\d*))?$/i.exec(target ?? '')
        let c: VisitorCommit | Commit | undefined
        if (!target || rev) {
          const n = !target ? 0 : rev?.[2] ? Number(rev[2]) : rev?.[1] ? 1 : 0
          const chain: (VisitorCommit | Commit)[] = [...[...s.visitorCommits].reverse(), ...COMMITS]
          c = chain[Math.min(n, chain.length - 1)]
        } else {
          c = COMMITS.find((x) => x.hash.startsWith(target)) ?? s.visitorCommits.find((x) => x.hash.startsWith(target))
        }
        if (!c) {
          push([L('err', `fatal: ambiguous argument '${target}': unknown revision`)])
          return
        }
        s.openPseudo(`commit:${c.hash}`)
        push([L('dim', `opened commit ${c.hash} — the details live in the tab`)])
      } else if (sub === 'stash') {
        const dirty = Object.keys(s.fileContents).filter((p) => isDirtyPath(s, p)).length
        push(dirty
          ? [L('dim', `stash: ${dirty} uncommitted change${dirty === 1 ? '' : 's'} — nothing leaves this working tree. \`git checkout .\` discards, \`git commit -m\` ships.`)]
          : [L('dim', 'no local changes to stash. the tree is clean — suspiciously so.')])
      } else {
        push([L('err', `git: '${sub}' is not a git command. see 'git log', 'git status', 'git show', 'git blame'`)])
      }
      return
    }

    case 'grep': {
      // separate flags from operands — flags precede the pattern like real grep
      const flags = new Set<string>()
      const operands: string[] = []
      for (const a of args) {
        if (!operands.length && /^-[a-zA-Z]+$/.test(a)) {
          for (const ch of a.slice(1)) flags.add(ch)
        } else operands.push(a)
      }
      const unsupported = [...flags].filter((f) => !'irlvnc'.includes(f))
      const pattern = operands[0]
      if (!pattern) {
        push([L('err', 'usage: grep [-ivlnr] <pattern> [file…] — try `grep rust`')])
        return
      }
      if (unsupported.length) {
        push([L('err', `grep: -${unsupported[0]} unsupported here — i, v, l, n, r, c all work`)])
        return
      }
      const ci = flags.has('i')
      const invert = flags.has('v')
      const namesOnly = flags.has('l')
      const countOnly = flags.has('c')
      const showNum = flags.has('n')
      const fileArgs = operands.slice(1)

      // match one line of text against the pattern (regex-then-literal, like rg)
      let re: RegExp | null = null
      try {
        re = new RegExp(pattern, ci ? 'i' : '')
      } catch {
        /* fall through to literal */
      }
      const hit = (t: string) =>
        (re ? re.test(t) : (ci ? t.toLowerCase() : t).includes(ci ? pattern.toLowerCase() : pattern)) !== invert

      // file operands restrict the search to those files
      if (fileArgs.length) {
        const hits: { path: string; line: number; text: string }[] = []
        let missing = 0
        let anyMatch = false
        for (const a of fileArgs) {
          const target = a.startsWith('untitled:') ? a : resolve(s.cwd, a)
          const f = getFile(target)
          const ukey = target.startsWith('untitled:') ? target : !a.includes('/') ? `untitled:${a}` : null
          const path = f ? f.path : ukey && Object.hasOwn(s.virtualFiles, ukey) ? ukey : null
          if (!path || (f && (f.kind === 'pdf' || f.kind === 'image'))) {
            push([L('err', `grep: ${a}: No such file`)])
            missing++
            continue
          }
          const text = f ? readFile(s, f.path, f.original) : ukey ? (s.fileContents[ukey] ?? s.baselines[ukey] ?? s.virtualFiles[ukey] ?? '') : ''
          const ls = text.split('\n')
          let n = 0
          for (let i = 0; i < ls.length; i++) {
            if (!hit(ls[i])) continue
            n++
            if (!namesOnly && !countOnly && hits.length < 24) {
              hits.push({ path, line: i + 1, text: ls[i].trim() })
            }
          }
          if (n) anyMatch = true
          if (namesOnly && n) hits.push({ path, line: 0, text: '' })
          if (countOnly) hits.push({ path, line: 0, text: String(n) })
        }
        if (!hits.length) {
          if (!missing) {
            push([L('dim', 'no matches. the void returns empty.')])
            // real grep exits 1 on no match — `grep x || echo missing` depends on it
            segFailed = true
          }
          return
        }
        push(
          hits.map((h) =>
            h.line === 0
              ? L('out', countOnly ? `${h.path}:${h.text}` : h.path, `open ${h.path}`)
              : L('out', `${h.path}:${h.line}: ${h.text}`, `open ${h.path}:${h.line}`),
          ),
        )
        // -c prints `path:0` for misses but still exits 1 when nothing matched
        if (!anyMatch && !missing) segFailed = true
        return
      }

      // whole-workspace search — -r is the default here, like rg
      const results = search(pattern, { caseSensitive: !ci, regex: !!re }, { ...s.baselines, ...s.fileContents })
      let filtered = results
      if (invert) {
        // -v needs lines that DON'T match — scan source, not match results
        filtered = []
        const seen = new Set(results.map((h) => `${h.path}:${h.line}`))
        const scanAll = (path: string, text: string) => {
          const ls = text.split('\n')
          for (let i = 0; i < ls.length && filtered.length < 400; i++) {
            if (!seen.has(`${path}:${i + 1}`)) filtered.push({ path, line: i + 1, col: 0, text: ls[i].trim() })
          }
        }
        for (const f of allFiles()) {
          if (f.kind === 'pdf' || f.kind === 'image') continue
          scanAll(f.path, s.fileContents[f.path] ?? s.baselines[f.path] ?? f.original)
        }
        for (const p of Object.keys(s.virtualFiles)) scanAll(p, s.fileContents[p] ?? s.baselines[p] ?? s.virtualFiles[p])
      }
      if (!filtered.length) {
        push([L('dim', 'no matches. the void returns empty.')])
        segFailed = true // no-match is exit 1 — keeps `&&`/`||` honest
        return
      }
      if (countOnly) {
        const counts = new Map<string, number>()
        for (const h of filtered) counts.set(h.path, (counts.get(h.path) ?? 0) + 1)
        push([...counts].slice(0, 24).map(([p, n]) => L('out', `${p}:${n}`, `open ${p}`)))
        return
      }
      if (namesOnly) {
        const paths = [...new Set(filtered.map((h) => h.path))]
        push(paths.slice(0, 24).map((p) => L('out', p, `open ${p}`)))
        return
      }
      push([
        L('dim', `${filtered.length} match${filtered.length === 1 ? '' : 'es'} — click a line to open it`),
        ...filtered.slice(0, 24).map((h) =>
          L('out', `${h.path}:${showNum ? `${h.line}: ` : ''}${h.text}`, `open ${h.path}:${h.line}`),
        ),
        ...(filtered.length > 24 ? [L('dim', `… and ${filtered.length - 24} more`)] : []),
      ])
      return
    }

    case 'man': {
      if (args[0] === 'kushal') {
        const f = getFile('man1/kushal.1')
        if (f) {
          push(readFile(s, f.path, f.original).split('\n').map((l) => out(l)))
          s.unlock('man-page')
        }
      } else {
        push([L('err', `No manual entry for ${args[0] ?? 'nothing'}. Try 'man kushal'`)])
      }
      return
    }

    case 'neofetch':
      push([
        L('accent', '        ▄▄▄        kushal@portfolio'),
        L('accent', '      ▄█████▄      ─────────────────'),
        L('accent', '     ▐███████▌     os: kushalOS 2027.0-beta lts-ish'),
        L('accent', '      ▀█████▀      host: your browser'),
        L('accent', '        ▀▀▀        kernel: 6.your.questions'),
        out(`                   uptime: ${ageYears()} years`),
        out('                   shell: kushalsh 1.0'),
        out('                   wm: tabs'),
        out('                   theme: kushal-midnight'),
        out('                   cpu: coffee (3) @ 4.20GHz'),
        out('                   memory: 4GiB / everything, apparently'),
      ])
      return

    case 'theme': {
      const name = args[0]
      if (name === 'party') {
        // theme party — cycles all three until any keypress stops the rave.
        // rapid full-screen color cycling is exactly what prefers-reduced-motion
        // exists to block — the party sits that one out.
        if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
          push([
            L('dim', 'theme party respects prefers-reduced-motion — no flashing lights today.'),
            L('dim', `try 'theme demogod' for a single, dignified switch.`),
          ])
          return
        }
        const order = ['kushal-midnight', 'demogod', 'kushal-daylight'] as const
        let i = 0
        // a second --party while one's running stops it — stacked intervals
        // would race applySettings and double every countdown
        if (partyStop) {
          partyStop()
          push([L('dim', 'party over. the theme stays where it landed.')])
          return
        }
        push([L('sys', '🎉 theme party — any key stops the rave')])
        const stop = () => {
          clearInterval(t)
          clearTimeout(mercy)
          window.removeEventListener('keydown', stop, true)
          partyStop = null
        }
        const t = window.setInterval(() => {
          i = (i + 1) % order.length
          store.getState().applySettings({ 'workbench.colorTheme': order[i] })
        }, 900)
        window.addEventListener('keydown', stop, true)
        const mercy = window.setTimeout(stop, 20_000) // mercy rule
        partyStop = stop
        return
      }
      if (name === 'demogod' || name === 'kushal-midnight' || name === 'kushal-daylight') {
        s.applySettings({ 'workbench.colorTheme': name })
        push([L('ok', `theme → ${name}`)])
        if (name === 'demogod') s.unlock('konami')
      } else {
        push([
          L('err', `theme '${name ?? ''}' not found`),
          L('dim', 'available: kushal-midnight, demogod, kushal-daylight (try it. konami optional.)'),
        ])
      }
      return
    }

    case 'ping': {
      const host = args.filter((a) => !a.startsWith('-')).at(-1) ?? 'github.com'
      push([
        out(`PING ${host}: 56 data bytes`),
        out(`64 bytes from ${host}: icmp_seq=0 ttl=64 time=0.42ms`),
        out(`64 bytes from ${host}: icmp_seq=1 ttl=64 time=0.39ms`),
        out(`64 bytes from ${host}: icmp_seq=2 ttl=64 time=0.41ms`),
        L('dim', `--- ${host} ping statistics ---`),
        out('3 packets transmitted, 3 received, 0% packet loss — connection better than mine'),
      ])
      return
    }

    case 'ssh': {
      // last non-flag arg is the host — `ssh -i key host` doesn't report '-i'
      const flagValue = new Set(['-i', '-p', '-l'])
      const host = args.filter((a, i) => !a.startsWith('-') && !flagValue.has(args[i - 1])).at(-1)
      push([L('err', `ssh: connect to host ${host ?? 'anywhere'} port 22: connection refused — insufficient coffee`)])
      return
    }

    case 'curl':
      push([L('err', 'curl: (6) could not resolve host — this portfolio is self-contained, like its author')])
      return

    case 'top':
    case 'htop':
      push([
        L('accent', '  PID USER      %CPU  %MEM   TIME    COMMAND'),
        out('    1 kushal    91.4  12.0   ∞:∞     portfoliod'),
        out('   42 kushal    04.2  04.2  4:20     curiosity'),
        out('  666 kushal    00.1  99.9  0:00     imposter-syndrome [defunct]'),
        out(` 1337 kushal    03.7  02.1  ${ageYears()}yr     learning --always`),
      ])
      return

    case 'sudo': {
      s.unlock('sudo-please')
      const rest = args.join(' ')
      if (/^(hire|hire-me|--hire)/.test(rest)) {
        push([L('dim', '[sudo] password for kushal: ********')])
        hireSeq(true)
      } else if (/^make (me )?(a )?sandwich/.test(rest)) {
        push([L('ok', 'okay.')])
      } else if (/^make coffee/.test(rest)) {
        push([L('ok', 'coffee brewed with elevated privileges. you absolute admin.')])
      } else if (/^rm/.test(rest)) {
        push([L('err', 'nice try. the files have a union.')])
      } else {
        push([
          L('err', "kushal is not in the sudoers file."),
          L('dim', 'this incident will be reported. (to whom? he is the only user)'),
        ])
      }
      return
    }

    case 'vim':
    case 'vi':
    case 'nvim':
    case 'nano':
    case 'emacs':
    case 'ed':
      enterVim(cmd)
      return

    case 'rm': {
      const targets = args.filter((a) => !a.startsWith('-'))
      const recursive = args.some((a) => /^-[a-zA-Z]*r[a-zA-Z]*$/.test(a))
      const tgt0 = targets[0]
      // the wipe gag needs an actual dangerous operand — `rm -r` alone is a
      // missing operand, and -fr / -rf both count as recursive
      if (recursive && tgt0 && /^(\/|~|\*|\$HOME)/.test(tgt0)) {
        s.unlock('red-flag')
        void wipeGag()
      } else if (!tgt0) {
        push([L('err', 'rm: missing operand')])
      } else {
        // drafts die by bare name or untitled: key — `rm dir/x` must not reach
        // across the workspace and kill an unrelated draft called x
        const ukey = tgt0.startsWith('untitled:') ? tgt0 : tgt0.includes('/') ? null : `untitled:${tgt0}`
        if (ukey && Object.hasOwn(s.virtualFiles, ukey)) {
          s.deleteDraft(ukey)
          push([L('ok', `removed ${tgt0} — drafts are mortal here`)])
        } else {
          push([L('err', `rm: cannot remove '${tgt0}': the files have tenure`)])
        }
      }
      return
    }

    case 'make': {
      const target = args[0]
      if (target === 'coffee' || target === 'tea') {
        push([L('err', `make: *** No rule to make target '${target}'. Required: 'internship'.`)])
      } else if (target === 'love') {
        push([L('err', `make: don't be weird`)])
      } else if (target === 'me' || target === 'sandwich') {
        push([L('err', `make: *** refusing. try sudo.`)])
      } else {
        runPortfolioBuild()
      }
      return
    }

    case 'npm': {
      if (args[0] === 'install' || args[0] === 'i') {
        const pkg = args[1]
        if (pkg) {
          push([L('err', `npm ERR! 404 '${pkg}' is not in this registry.`), L('dim', 'searched locally instead. found: more side projects.')])
        } else {
          push([L('ok', 'audited 1 portfolio. found 0 vulnerabilities and 1 excellent hire.')])
        }
      } else if (args[0] === 'test' || (args[0] === 'run' && args[1] === 'test')) {
        void drip([
          { text: '> kushal@2027.0-beta test', kind: 'dim', delay: 100 },
          { text: '> vitest run tests/', kind: 'dim', delay: 60 },
          { text: '', delay: 300 },
          { text: ' ✓ tests/hireable.test.ts (6)', kind: 'ok', delay: 500 },
          { text: '   ✓ has actual users', kind: 'dim', delay: 90 },
          { text: '   ✓ ships on fridays', kind: 'dim', delay: 90 },
          { text: '   ✓ explains sse unprompted', kind: 'dim', delay: 90 },
          { text: '   ✓ merges without conflicts (emotional)', kind: 'dim', delay: 90 },
          { text: '   ✓ reads the whole error message', kind: 'dim', delay: 90 },
          { text: '   ✓ hires itself in tests (assertion holds)', kind: 'dim', delay: 90 },
          { text: '', delay: 200 },
          { text: ' Test Files  1 passed (1)', kind: 'ok', delay: 100 },
          { text: '      Tests  6 passed (6)', kind: 'ok', delay: 60 },
          { text: '   Duration  42ms', kind: 'dim', delay: 60 },
          { text: 'open the file: tests/hireable.test.ts', kind: 'dim', delay: 200, cmd: 'open /tests/hireable.test.ts' },
        ])
      } else if (args[0] === 'run' && args[1] === 'dev') {
        push([L('dim', 'you are already running it. look around.')])
      } else if (args[0] === 'run') {
        push([out(`npm run ${args[1] ?? ''} — surely you jest`)])
      } else {
        push([out(`npm ${args.join(' ')} — surely you jest`)])
      }
      return
    }

    case 'exit':
    case 'logout':
    case 'quit':
    case 'bye':
      push([
        L('dim', 'logout'),
        L('err', 'there is no escape from the portfolio.'),
        L('dim', '(the shell stays. it likes you.)'),
      ])
      return

    case 'reboot':
      push([L('sys', 'rebooting kushalOS…')])
      setTimeout(() => window.location.reload(), 900)
      return

    case 'shutdown':
      push([L('sys', 'system halted. (refresh to wake — the shell cannot truly die)')])
      return

    case 'weekend':
      push([L('out', "what's a weekend?")])
      return

    case 'sleep':
      push([L('err', `sleep: command deprecated since midterms. did you mean 'grind'?`)])
      return

    case 'sl':
      s.unlock('sl-conductor')
      void (async () => {
        const frames = [
          '      ====        ________                ___________',
          '  _D _|  |_______/        \\__I_I_____===__|_________|',
          '   |(_)---  |   H\\________/ |   |        =|___ ___|',
          '   /     |  |   H  |  |     |   |         ||_| |_||',
          '  |      |  |   H  |__--------------------| [___] |',
          '  | ________|___H__/__|_____/[][]~\\_______|       |',
          '  |/ |   |-----------I_____I [][] []  D   |=======|_',
          '__/ =| o |=-~~\\  /~~\\  /~~\\  /~~\\ ____Y___________|_',
          ' |/-=|___|=    ||    ||    ||    |_____/~\\___/',
          '  \\_/      \\_O=====O=====O=====O_/      \\_/',
        ]
        for (let i = 0; i < frames.length; i++) {
          await sleep(60)
          const pad = ' '.repeat(Math.max(0, 34 - i * 5))
          s.pushTerm([L('out', pad + frames[i])])
        }
        s.pushTerm([L('dim', '  choo choo. this is what the command does. it brings joy.')])
      })()
      return

    case 'cowsay':
      push(cowsayOut(args.join(' ')))
      return

    case 'fortune': {
      const FORTUNES = [
        'you will merge without conflicts. today is your day.',
        'a segfault in your future has already been fixed.',
        'the bug you fear most is afraid of you.',
        'your next interview will feature exactly the leetcode you know.',
        'somewhere, a production deploy succeeds on friday. believe.',
        "the answer is 'borrow checker'. the question doesn't matter.",
        'your next deploy ships to 1,500 users and one pep-rally announcement.',
      ]
      push([L('accent', FORTUNES[Math.floor(Math.random() * FORTUNES.length)])])
      return
    }

    case 'js': {
      const expr = args.join(' ')
      if (!expr) {
        push([L('dim', "usage: js <expression> — try `js 6*7` or `js files()` (that's real)")])
        return
      }
      try {
        const api = {
          files: () => allFiles().map((f) => f.path),
          open: (p: string) => { s.openFile(p); return `opened ${p}` },
          theme: (t: string) => { s.applySettings({ 'workbench.colorTheme': t as 'kushal-midnight' }); return `theme → ${store.getState().settings['workbench.colorTheme']}` },
          me: () => ({ name: 'kushal', hireable: true, sleep: undefined }),
          achievements: () => Object.keys(s.unlocked),
        }
        // eslint-disable-next-line no-new-func
        const fn = new Function(...Object.keys(api), `return (${expr})`)
        const res = fn(...Object.values(api)) as unknown
        const shown = typeof res === 'string' ? res : JSON.stringify(res, null, 0)
        push([L('ok', `← ${shown?.slice(0, 240) ?? 'undefined'}`)])
      } catch (e) {
        push([L('err', `← ${e instanceof Error ? e.message : 'eval failed — the repl is embarrassed'}`)])
      }
      return
    }

    case 'settings':
      s.openPseudo('ui:settings')
      push([L('dim', 'opened settings — changes write back to settings.json')])
      return

    case 'achievements':
    case 'trophies':
      s.ensureView('achievements')
      push([L('dim', `${Object.keys(s.unlocked).length} unlocked so far`)])
      return

    case 'tour': {
      if (s.tour) {
        push([L('dim', 'tour already running. click anywhere or press a key to take the wheel.')])
        return
      }
      push([L('accent', 'tour starting — hands off, it drives itself. any input aborts.')])
      startTour(exec)
      return
    }

    case 'guide': {
      s.applySettings({ 'kushal.jargon': 'tourist' })
      s.startGuide()
      push([L('ok', 'guided route on — follow the bar at the bottom. "esc" to exit.')])
      return
    }

    case 'map':
      s.setModal({ kind: 'map' })
      push([L('dim', 'map opened — a labeled diagram of the whole editor')])
      return

    case 'slides':
    case 'deck':
    case 'present':
      s.openPseudo('ui:slides')
      push([L('ok', 'deck build complete — arrow keys advance, esc closes.'), L('dim', 'slides are compiled from the same files you can edit')])
      return

    case 'touch': {
      if (args[0] === 'grass') {
        document.documentElement.classList.add('grassed')
        window.setTimeout(() => document.documentElement.classList.remove('grassed'), 2400)
        s.unlock('grass-toucher')
        push([L('ok', 'touched grass. balance restored.'), L('dim', '(the screen will recover in a moment)')])
        return
      }
      if (!args[0]) {
        push([L('err', 'touch: missing file operand')])
        return
      }
      const name = args[0].split('/').pop() ?? 'untitled.txt'
      const key = `untitled:${name}`
      store.setState((st) => ({ virtualFiles: { ...st.virtualFiles, [key]: st.virtualFiles[key] ?? '' } }))
      s.openPseudo(key)
      push([L('ok', `created ${name} — it's real now, live with that`)])
      return
    }

    case 'env':
    case 'printenv': {
      const all = envAll(s)
      push(Object.entries(all).map(([k, v]) => out(`${k}=${v}`)))
      return
    }

    case 'alias': {
      // like a real shell: lists every alias — the live .kushalrc edits included
      const { aliases } = sourceRc(s)
      const rows = Object.entries(aliases).map(([k, v]) => {
        const custom = !(k in ALIASES)
        return L(custom ? 'accent' : 'out', `alias ${k}='${v}'${custom ? '   ← yours' : ''}`)
      })
      rows.push(L('dim', 'add your own in .kushalrc — `alias gs=\'git status\'` takes effect immediately'))
      push(rows)
      return
    }

    case 'export': {
      // parse the raw segment, not args — tokenize strips boundary quotes
      // per-token, so `X="a b"` rejoins as `X="a b` (one quote eaten) and
      // the value ships with a leading `"`
      const m = /^(\w+)\s*=\s*(.*)$/.exec(input.replace(/^\S+\s*/, ''))
      if (!m) {
        push([L('err', 'export: usage: export NAME=value')])
        return
      }
      const val = expandVars(m[2].replace(/^(['"])(.*)\1$/, '$2'), s)
      envVars[m[1]] = val
      if (m[1] === 'HIRED') {
        push([L('ok', `HIRED=${val} — noted. the recruiter view agrees: F5`), L('dim', '    (the variable is real. `env` shows it.)')])
      } else {
        push([L('dim', `${m[1]}=${val} — exported. 'env' confirms; nothing else does.`)])
      }
      return
    }

    case 'file': {
      const target = args[0] ? resolve(s.cwd, args[0]) : ''
      const f = getFile(target)
      if (f) {
        const verdict =
          f.path === 'resume.pdf' ? 'PDF document, 1 page, extremely hireable' :
          f.kind === 'pdf' ? 'PDF document, certified, verifiable online' :
          f.kind === 'md' ? 'UTF-8 markdown, with narrative arc' :
          f.path.startsWith('renders/wildcat.') ? 'Image — the production calendar, in production' :
          f.kind === 'image' ? 'PNG image — proof, on university letterhead' :
          'ASCII text, with ambitions'
        push([out(`${args[0]}: ${verdict}`)])
      } else if (
        Object.hasOwn(s.virtualFiles, target) ||
        (args[0] && !args[0].includes('/') && Object.hasOwn(s.virtualFiles, `untitled:${args[0]}`))
      ) {
        push([out(`${args[0]}: visitor-authored. canonical, emotionally.`)])
      } else {
        push([L('err', `file: cannot open '${args[0] ?? ''}' (No such file or directory)`)])
      }
      return
    }

    case 'find':
    case 'fd': {
      // `find <path> [-name glob] [-type f|d]` — searches from the path (or cwd),
      // -name is a glob, -type filters kind; previously the flag VALUES leaked
      // into the pattern slot and the search ignored cwd entirely
      let pat: string | undefined
      let type: string | undefined
      let base: string | undefined
      for (let i = 0; i < args.length; i++) {
        const a = args[i]
        if (a === '-name' || a === '-iname') { pat = args[++i]; continue }
        if (a === '-type') { type = args[++i]; continue }
        if (a.startsWith('-')) continue
        if (base === undefined) base = a
        else pat ??= a
      }
      const basePath = base === undefined || base === '.' ? s.cwd : resolve(s.cwd, base)
      const baseDir = getDir(basePath)
      if (!baseDir) {
        push([L('err', `find: ${base ?? ''}: No such file or directory`)])
        return
      }
      const rel = (p: string) => `./${basePath ? p.slice(basePath.length + 1) : p}`
      if (type === 'd') {
        const dirs: string[] = ['.']
        const walk = (n: typeof baseDir) => {
          for (const c of n.children) if (c.type === 'dir') { dirs.push(rel(c.path)); walk(c) }
        }
        walk(baseDir)
        push(dirs.slice(0, 30).map((d) => out(d)))
        return
      }
      if (type !== undefined && type !== 'f') {
        push([L('err', `find: Unknown argument to -type: ${type}`)])
        return
      }
      let hits = allFiles(baseDir)
      if (pat) {
        if (/[*?]/.test(pat)) {
          const re = new RegExp('^' + pat.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$', 'i')
          hits = hits.filter((f) => re.test(f.name))
        } else {
          hits = hits.filter((f) => f.path.toLowerCase().includes(pat.toLowerCase()))
        }
      }
      push(hits.slice(0, 30).map((f) => out(rel(f.path))))
      if (hits.length > 30) push([L('dim', `… ${hits.length - 30} more`)])
      return
    }

    // sort/uniq/less/more/diff take files directly, not just pipe stages —
    // COMMAND_NAMES offers them, so typing them can't be a 404
    case 'sort':
    case 'uniq':
    case 'less':
    case 'more': {
      const operand = args.find((a) => !a.startsWith('-'))
      if (!operand) {
        push([L('dim', `${cmd} reads stdin — here that's a pipe. try \`fortune | ${cmd}\` or \`${cmd} README.md\``)])
        return
      }
      const text = readOperand(s, operand)
      if (text === null) {
        push([L('err', `${cmd}: ${operand}: No such file`)])
        return
      }
      const ls = text.split('\n')
      if (cmd === 'sort') {
        const sorted = [...ls].sort((a, b) => a.localeCompare(b))
        push((args.includes('-r') ? sorted.reverse() : sorted).map((t) => out(t)))
      } else if (cmd === 'uniq') {
        const u: string[] = []
        for (const t of ls) if (u.at(-1) !== t) u.push(t)
        push(u.map((t) => out(t)))
      } else {
        push([...ls.map((t) => out(t)), L('dim', '(END — the pager here is decorative, q is implicit)')])
      }
      return
    }

    case 'diff': {
      const operands = args.filter((a) => !a.startsWith('-'))
      if (operands.length < 2) {
        push([L('dim', 'diff file1 file2 — or `git diff` for your working-tree edits')])
        return
      }
      const ta = readOperand(s, operands[0])
      const tb = readOperand(s, operands[1])
      if (ta === null || tb === null) {
        push([L('err', `diff: ${ta === null ? operands[0] : operands[1]}: No such file`)])
        return
      }
      if (ta === tb) return // identical files: real diff exits 0, prints nothing
      // differing files exit 1 — `diff a b && echo same` must not run echo
      segFailed = true
      push([
        L('accent', `--- ${operands[0]}`),
        L('accent', `+++ ${operands[1]}`),
        ...diffLines(ta, tb).map((l) =>
          L(l.type === 'add' ? 'ok' : l.type === 'del' ? 'red' : 'dim', `${l.type === 'add' ? '+' : l.type === 'del' ? '-' : ' '}${l.text}`),
        ),
      ])
      return
    }

    case 'uptime':
      push([out(` ${new Date().toTimeString().slice(0, 5)} up ${ageYears()} years, load average: coffee, deadlines, spite`)])
      return

    case 'who':
      push([out('kushal   pts/0    since birth'), out('visitor  pts/1    right now — hello')])
      return

    case 'ps':
      push([
        L('accent', '  PID TTY          TIME CMD'),
        out(`    1 ?        ${ageYears()}y:00  portfoliod`),
        out('   42 pts/0    04:20   curiosity --daemon'),
        out('  666 pts/9    00:00   imposter-syndrome <defunct>'),
        out(' 1337 pts/1    00:01   you --reading-this'),
      ])
      return

    case 'df':
      push([
        L('accent', 'Filesystem      Size  Used Avail Use% Mounted on'),
        out('/dev/portfolio  128G   12G  116G  10% /'),
        out('tmpfs            ∞     ∞     0 100% /feelings'),
      ])
      return

    case 'free':
      push([out('              total        used        free'), out('Mem:        16GiB       15GiB       tabs')])
      return

    case 'nproc':
      push([out('1 — single-threaded, like the author')])
      return

    case 'cloc':
    case 'tokei':
      push([
        L('accent', 'language        files    lines'),
        out('typescript         63    10896'),
        out('markdown            9      ~700'),
        out('confidence          1        0'),
        L('dim', '(the confidence file is a symlink to /dev/null)'),
      ])
      return

    case 'kill':
    case 'killall':
    case 'pkill':
      push([
        L('err', `kill: (${args.filter((a) => !a.startsWith('-'))[0] ?? '1'}): Operation not permitted`),
        L('dim', 'the processes are load-bearing. all of them.'),
      ])
      return

    case 'apt':
    case 'apt-get':
    case 'brew':
    case 'pacman':
    case 'dnf':
    case 'yum':
      push([L('err', `${cmd}: package management unavailable — this portfolio is statically linked`)])
      return

    case 'docker':
    case 'kubectl':
    case 'k8s':
      push([L('dim', `${cmd}: no containers here — a static site pretending to have infrastructure, beautifully`)])
      return

    case 'python':
    case 'python3':
      push([L('err', 'python: not found — this is a javascript house'), L('dim', '  (`js` is the repl. `js me()` knows things)')])
      return

    case 'node':
    case 'deno':
    case 'bun':
      push([L('dim', 'use `js <expr>` — the repl here has manners')])
      return

    case 'gcc':
    case 'rustc':
    case 'cargo':
    case 'go':
      push([L('err', `${cmd}: compiler not present. the portfolio ships pre-built.`), L('dim', '  F5 shows you the artifact')])
      return

    case 'mv':
    case 'cp':
    case 'mkdir':
    case 'ln':
      push([L('err', `${cmd}: permission denied — the files are unionized. relocation denied.`)])
      return

    case 'lazygit':
    case 'lg':
      s.ensureView('git')
      push([L('dim', 'the source control view IS lazygit, wearing a suit')])
      return

    case 'matrix':
      push([
        L('sys', 'wake up, visitor.'),
        L('sys', 'the portfolio has you.'),
        L('dim', 'follow the white rabbit: `theme demogod`'),
      ])
      return

    case 'grind':
      push([out('grinding… done. +1 discipline, -1 sleep. repeat.')])
      return

    case 'vimtutor':
      enterVim('vimtutor')
      return

    // ---------- plain-english nouns — for people who type words, not commands ----------

    case 'tourist':
    case 'jargon': {
      const next = s.settings['kushal.jargon'] === 'tourist' ? 'dev' : 'tourist'
      s.applySettings({ 'kushal.jargon': next })
      push([
        next === 'tourist'
          ? L('ok', 'labels → plain english. the icons forgive you.')
          : L('ok', 'labels → dev jargon. welcome back to the matrix.'),
        L('dim', 'edit kushal.jargon in settings.json — it\'s a real setting'),
      ])
      return
    }

    case 'projects':
      s.ensureView('explorer')
      s.openFile('projects/wildcat-calendar.md', { mode: 'preview' })
      push([L('dim', 'projects/ — five write-ups in the file list. opened the one in production.')])
      return
    case 'skills':
      s.ensureView('extensions')
      push([L('dim', 'skills are "extensions" here — left rail, puzzle icon')])
      return
    case 'experience':
      s.openFile('experience.json')
      push([L('dim', 'experience.json — the work history, as data')])
      return
    case 'career':
    case 'work':
      s.ensureView('git')
      push([L('dim', 'the career is a git graph — left rail, branch icon')])
      return
    case 'about':
    case 'start':
    case 'hello':
    case 'hi':
    case 'portfolio':
      s.openFile('README.md')
      push([L('dim', 'README.md — the front door. always a good start.')])
      return

    case 'tldr':
    case 'wtf': {
      const target = args[0]
      const tip = target && TLDR[target]
      push(
        tip
          ? [L('accent', `${target}`), out(`  ${tip}`)]
          : [
              L('dim', target ? `no tldr for '${target}' — try 'help' or 'tldr git'` : 'tldr <command> — one-line plain-english. try: tldr git'),
              L('dim', 'examples: tldr grep · tldr git · tldr vim · tldr npm'),
            ],
      )
      return
    }

    case 'say': {
      const text = args.join(' ') || 'hire kushal'
      try {
        const u = new SpeechSynthesisUtterance(text.replace(/^kushal$/i, 'koo-SHAHL'))
        speechSynthesis.speak(u)
        push([L('dim', `said "${text}" out loud. the browser actually talks.`)])
        s.unlock('heard-it')
      } catch {
        push([L('err', 'say: speech synthesis unavailable — the browser is shy')])
      }
      return
    }

    case 'weather':
      push([
        out('forecast for the portfolio:'),
        out('  ┌─────────────────────────────┐'),
        out('  │  ☀ 99% chance of callbacks  │'),
        out('  │  💨 winds: strong, from the │'),
        out('  │     direction of opportunity│'),
        out('  │  🌡 feels like: hired       │'),
        out('  └─────────────────────────────┘'),
      ])
      return

    case 'coffee':
      push([
        L('err', '418 — this portfolio is a teapot.'),
        L('dim', '  (make coffee gets you further. barely.)'),
      ])
      return

    default: {
      // natural language → the point of the site
      if (/\b(hire|contact|email|resume|recruiter)\b/i.test(input)) {
        push([L('dim', 'natural language detected. impressive. translating…')])
        hireSeq()
        return
      }
      push([
        L('err', `${cmd}: command not found`),
        L('dim', `try 'help' — or 'neofetch' if you want to feel something`),
      ])
    }
  }
}

// ---------- easter eggs ----------

function cowsayOut(text: string): Line[] {
  const t = text || 'hire me'
  const w = Math.min(Math.max(t.length, 8), 46)
  const words = t.match(new RegExp(`.{1,${w}}`, 'g')) ?? [t]
  return [
    L('out', ` ${'_'.repeat(w + 2)}`),
    ...words.map((w2) => L('out', `< ${w2.padEnd(w)} >`)),
    L('out', ` ${'-'.repeat(w + 2)}`),
    L('out', '        \\   ^__^'),
    L('out', '         \\  (oo)\\_______'),
    L('out', '            (__)\\       )\\/\\'),
    L('out', '                ||----w |'),
    L('out', '                ||     ||'),
  ]
}

/** the highest-intent command on the site actually converts — contact info in-band */
function hireSeq(fromSudo = false) {
  const s = store.getState()
  void (async () => {
    // pull the real values — if the visitor edited contact.env, hire prints their version
    const envSrc = s.fileContents['contact.env'] ?? s.baselines['contact.env'] ?? getFile('contact.env')?.original ?? ''
    const env = Object.fromEntries(
      envSrc.split('\n').flatMap((l) => {
        const m = /^([A-Z_]+)=(.*)$/.exec(l.trim())
        return m ? [[m[1], m[2].split(/\s+#/)[0].trim()]] : []
      }),
    )
    const email = env.EMAIL && /^[^\s@]+@[^\s@]+$/.test(env.EMAIL) ? env.EMAIL : 'smileykushal@gmail.com'
    // SCHEDULING is user-editable — the codebase's rule is allowlisted schemes
    // or '#', never a raw javascript:. https goes to a new tab so the portfolio
    // isn't stranded mid-ceremony; anything else falls back to the mailto
    const sched = (env.SCHEDULING || '').trim()
    const schedOk = /^(https?|mailto):/i.test(sched)
    const mailto = schedOk ? sched : `mailto:${email}?subject=${encodeURIComponent(`${availabilityLabel(envSrc)} — let's talk`)}`
    const seq: { text: string; kind?: Line['kind']; delay?: number; cmd?: string }[] = [
      { text: 'permission granted.', kind: 'ok', delay: 200 },
      { text: 'drafting offer…', delay: 420 },
      { text: '[██████████████████] 100%', kind: 'accent', delay: 700 },
      { text: 'compensation expectations: yes', delay: 200 },
      { text: '', delay: 150 },
      { text: `  EMAIL     ${email}`, kind: 'ok' },
      { text: `  RESUME    ${env.RESUME_PDF || '/resume.pdf'}`, kind: 'ok', cmd: 'resume' },
      { text: '  SCHEDULE  15 min → `sudo hire-me` writes the email for you', kind: 'ok', cmd: 'sudo hire-me' },
      { text: `  GITHUB    ${env.GITHUB || 'github.com/KushalGangarapu'}`, kind: 'dim' },
      ...(env.PHONE ? [{ text: `  PHONE     ${env.PHONE}`, kind: 'ok' as const }] : []),
      ...(env.LINKEDIN ? [{ text: `  LINKEDIN  ${env.LINKEDIN}`, kind: 'ok' as const }] : []),
      { text: '', delay: 150 },
      fromSudo
        ? { text: 'sudo — writing the email for you. check your drafts.', kind: 'accent' }
        : { text: '→ opening contact.env  (or: sudo hire-me to open your mail client)', kind: 'dim' },
    ]
    for (const l of seq) {
      await sleep(l.delay ?? 100)
      s.pushTerm([L(l.kind ?? 'out', l.text, l.cmd)])
    }
    if (fromSudo) {
      // zero distance between delight and inbox — https schedulers open out of
      // the app so the tab doesn't navigate away mid-sequence
      if (/^https?:/i.test(mailto)) window.open(mailto, '_blank', 'noopener')
      else window.location.href = mailto
      s.unlock('deal-closer')
    }
    s.openFile('contact.env')
  })()
}

/** kushal --demo — the portfolio plays itself. a trailer inside the film. */
// generation counter: re-invocation bumps it, and every step re-checks — so a
// second `--demo` (or any user input) cleanly retires the in-flight sequence
let demoGen = 0

function demoSeq() {
  if (demoGen > 0) {
    push([L('dim', 'demo already rolling — any keypress or click stops it.')])
    return
  }
  const s = store.getState()
  if (tourRunning()) abortTour(true)
  s.endGuide()
  const gen = ++demoGen
  const alive = () => gen === demoGen
  const onInput = () => {
    demoGen++
  }
  window.addEventListener('keydown', onInput, true)
  window.addEventListener('pointerdown', onInput, true)
  void (async () => {
    try {
      s.pushTerm([L('sys', 'kushal --demo — the site is about to demo itself. hands off. (any input stops it)')])
      await sleep(900)
      if (!alive()) return
      s.ensureView('git')
      s.pushTerm([L('dim', '→ source control: the career is a git graph. every commit is real.')])
      await sleep(1600)
      if (!alive()) return
      exec('neofetch')
      await sleep(1600)
      if (!alive()) return
      s.openFile('projects/wildcat-calendar.md', { mode: 'preview' })
      s.pushTerm([L('dim', '→ case studies render as docs. this one has a live-ui embed.')])
      await sleep(1600)
      if (!alive()) return
      s.openFile('settings.json')
      s.pushTerm([L('dim', '→ settings.json is real. edit it — the site obeys.')])
      await sleep(1600)
      if (!alive()) return
      s.unlock('demo-watcher')
      s.pushTerm([
        L('ok', 'achievement unlocked: demo watcher'),
        L('accent', "your turn. type 'help' — or 'tour' for the 30s hands-free version. nothing breaks."),
      ])
    } finally {
      window.removeEventListener('keydown', onInput, true)
      window.removeEventListener('pointerdown', onInput, true)
      const aborted = !alive()
      demoGen = 0
      if (aborted) store.getState().pushTerm([L('dim', 'demo aborted — hands back on the wheel.')])
    }
  })()
}

function enterVim(cmd: string) {
  const s = store.getState()
  s.setVimTrapped(true)
  s.unlock('vim-fatalities')
  push([
    L('out', `entering ${cmd}…`),
    L('dim', '~'),
    L('dim', `~                    ${cmd.toUpperCase()} — the room you can't leave`),
    L('dim', '~                    hint: type :q! then press enter'),
    L('dim', '~                    (has helped 0 of 4,000,000 users)'),
    L('dim', '~'),
    L('ok', '-- INSERT --'),
  ])
}

const VIM_ERRORS = [
  "E45: 'readonly' option is set (add ! to override — and to your life)",
  'E486: Pattern not found: your_escape_plan',
  "E212: Can't open file for writing. or for escaping.",
  'W10: Warning: Changing a readonly file. read: your fate',
  'E37: No write since last change (add ! to override, type :q! to leave)',
]

// `:q` without `!` is refused on purpose — the trap teaches you vim for real
let vimQAttempts = 0

function vimBuffer(input: string) {
  const s = store.getState()
  if (/^:(q!|wq!|x!)/.test(input) || input === 'ZZ' || input === ':x') {
    push([
      L('input', input),
      L('ok', 'finally free. the light. it burns.'),
      L('dim', '(tip: real vim users are still in there)'),
    ])
    s.setVimTrapped(false)
    s.unlock('exit-vim')
    // a fresh trapping deserves a fresh counter — the next session's first
    // :q shouldn't inherit this session's escape attempts
    vimQAttempts = 0
    return
  }
  if (/^:(q|wq)$/.test(input)) {
    vimQAttempts++
    if (vimQAttempts >= 2) s.unlock('cannot-leave')
    push([
      L('input', input),
      L('err', `E37: No write since last change (add ! to override — yes, really: ${input}!)`),
      L('dim', '-- INSERT --'),
    ])
    return
  }
  if (input === 'help') {
    push([L('input', input), L('dim', "vim doesn't have help. it has suffering. try :q!")])
    return
  }
  push([
    L('input', input),
    L('err', VIM_ERRORS[Math.floor(Math.random() * VIM_ERRORS.length)]),
    L('dim', '-- INSERT --'),
  ])
}

async function wipeGag() {
  const s = store.getState()
  const el = document.querySelector('.ide-terminal')
  for (const l of [
    'removing node_modules/ …',
    'removing childhood memories …',
    'removing evidence …',
    'removing the evidence of removing evidence …',
  ]) {
    await sleep(300)
    s.pushTerm([L('err', l)])
  }
  el?.classList.add('glitching')
  await sleep(700)
  el?.classList.remove('glitching')
  s.pushTerm([L('ok', 'jk. nothing happened.'), L('dim', '(the files have backups. the files have lawyers.)')])
}
