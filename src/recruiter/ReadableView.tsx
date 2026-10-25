import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Printer, Share2, Sun, Moon, Command, GitBranch, XCircle, AlertTriangle, Rocket, ChevronRight, Mail, FileText, FolderGit2, Briefcase, GraduationCap, BadgeCheck, BookOpen, Award, Copy, Check, HeartHandshake, Leaf, Camera, Code } from 'lucide-react'
import kushalHeroImg from '../assets/kushal-hero.png'
import { availabilityLong } from '../lib/availability'
import { useIDE, store, contentOf, getActiveTab, isDirtyPath } from '../state/store'
import { allFiles, getFile } from '../vfs/fs'
import { parseFrontmatter } from '../editor/md-render'
import { EXTENSIONS } from '../vfs/extensions'
import { FileIcon } from '../editor/FileIcon'
import { withViewTransition } from '../lib/viewTransition'
import { copyToClipboard } from '../lib/clipboard'
import { exec } from '../terminal/commands'
import { parseEnv } from './parse'
import type { ThemeId } from '../settings/theme-types'

// ---- tiny parsers for our controlled formats ----

interface SkillEntry { name: string; level: string; note: string }
interface SkillSection { name: string; entries: SkillEntry[] }

function parseSkills(toml: string): SkillSection[] {
  const sections: SkillSection[] = []
  let cur: SkillSection | null = null
  for (const raw of toml.split('\n')) {
    const line = raw.trim()
    const sec = /^\[(\w+)]$/.exec(line)
    if (sec) {
      cur = { name: sec[1], entries: [] }
      sections.push(cur)
      continue
    }
    // [[deprecated]] and any unrecognized header end the current section —
    // without this, entry-shaped lines under a TOML array-of-tables would
    // keep appending to whatever section came before
    if (line.startsWith('[')) { cur = null; continue }
    const ent = /^(\w+)\s*=\s*\{\s*level\s*=\s*"([^"]*)"(?:\s*,\s*note\s*=\s*"([^"]*)")?/.exec(line)
    if (ent && cur && cur.name !== 'meta') {
      cur.entries.push({ name: ent[1], level: ent[2], note: ent[3] ?? '' })
    }
  }
  return sections.filter((s) => s.entries.length)
}

interface ExpData {
  experience: { role: string; org: string; period: string; highlights: string[]; stack: string[]; url?: string }[]
  education: { institution: string; degree: string; period: string; notes?: string }[]
  coursework: { name: string; status?: string }[]
  awards: { what: string; result: string }[]
  certifications: { name: string; issuer: string; date: string; file?: string; verify?: string; status?: string }[]
  community: { activity: string; hours: string; org?: string; highlights?: string }[]
  communityLog: { org: string; activity: string; hours: string }[]
}

// order is curated; membership isn't — any projects/*.md dropped into the
// workspace joins the shelf after these
const PROJECTS = ['projects/wildcat-calendar.md', 'projects/bcss-newspaper.md', 'projects/faithful-flight.md', 'projects/reverse-captcha.md', 'projects/sidequests.md']

/** the sourcemap jump — a line opens raw, like a real sourcemap resolves a
    position; dirs can't open as tabs, so they land on the explorer */
function openSource(src: string, line?: number) {
  const s = store.getState()
  // setView is a toggle — calling it while the explorer is already open
  // would close the sidebar instead of landing on it. revealInExplorer forces.
  if (src.endsWith('/')) {
    // revealInExplorer doesn't dismiss this overlay (openFile does via
    // openPseudo) — without it the click looks dead: the reveal lands on a
    // sidebar hidden behind the artifact
    s.revealInExplorer(src.replace(/\/+$/, ''))
    s.dismissReadable()
  }
  else s.openFile(src, { line, mode: line != null ? 'raw' : undefined })
}

// env/fm values are user-editable — an href must carry an allowed scheme or a
// bare domain, never javascript:. anything else degrades to '#'.
const safeHref = (u: string | undefined, fallback = '#'): string => {
  const s = (u ?? '').trim()
  return /^(https?:|mailto:|tel:)/i.test(s) ? s : fallback
}
const domainHref = (u: string | undefined): string => {
  const s = (u ?? '').trim()
  if (/^[a-z][a-z0-9+.-]*:/i.test(s)) return safeHref(s)
  return /^[\w-]+(\.[\w-]+)+([/?#][^\s]*)?$/.test(s) ? `https://${s}` : '#'
}
const smoothScroll = () => !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

let scrollAnimationId: number | null = null

const scrollToId = (id: string, smooth = true, onDone?: () => void) => {
  const scroller = document.getElementById('readable-scroll')
  if (!scroller) return

  if (scrollAnimationId != null) {
    cancelAnimationFrame(scrollAnimationId)
    scrollAnimationId = null
  }

  const chrome = document.getElementById('readable-chrome')
  const chromeHeight = chrome ? chrome.offsetHeight : 72

  let targetTop = 0
  if (id !== 'doc-intro') {
    const target = document.getElementById(id)
    if (!target) return
    const scrollerRect = scroller.getBoundingClientRect()
    const targetRect = target.getBoundingClientRect()
    targetTop = Math.max(0, scroller.scrollTop + (targetRect.top - scrollerRect.top) - chromeHeight)
  }

  const shouldSmooth = smooth && smoothScroll()
  if (!shouldSmooth) {
    scroller.scrollTop = targetTop
    onDone?.()
    return
  }

  const startTop = scroller.scrollTop
  const distance = targetTop - startTop
  if (Math.abs(distance) < 2) {
    scroller.scrollTop = targetTop
    onDone?.()
    return
  }

  // Duration tuned to feel responsive and swift: 260ms to 420ms
  const duration = Math.min(420, Math.max(260, Math.abs(distance) * 0.1))
  const startTime = performance.now()

  let cancelled = false
  const stopOnUser = () => {
    cancelled = true
    if (scrollAnimationId != null) {
      cancelAnimationFrame(scrollAnimationId)
      scrollAnimationId = null
    }
    scroller.removeEventListener('wheel', stopOnUser)
    scroller.removeEventListener('touchstart', stopOnUser)
    onDone?.()
  }

  scroller.addEventListener('wheel', stopOnUser, { passive: true, once: true })
  scroller.addEventListener('touchstart', stopOnUser, { passive: true, once: true })

  const step = (now: number) => {
    if (cancelled) return
    const elapsed = now - startTime
    const progress = Math.min(1, elapsed / duration)
    // easeOutQuart: rapid initial movement, silky smooth landing at target
    const ease = 1 - Math.pow(1 - progress, 4)

    scroller.scrollTop = Math.round(startTop + distance * ease)

    if (progress < 1) {
      scrollAnimationId = requestAnimationFrame(step)
    } else {
      scroller.scrollTop = targetTop
      scrollAnimationId = null
      scroller.removeEventListener('wheel', stopOnUser)
      scroller.removeEventListener('touchstart', stopOnUser)
      onDone?.()
    }
  }

  scrollAnimationId = requestAnimationFrame(step)
}

/** mask `## ` at line-start inside fenced blocks so heading-splitting is
    fence-blind — a fence containing a fake heading mustn't split content */
const FENCE_MASK = '\x01'
const maskFences = (src: string): string =>
  src.replace(/```[\s\S]*?(?:```|$)/g, (m) => m.replace(/^## /gm, FENCE_MASK))
const splitH2 = (src: string): string[] =>
  maskFences(src).split(/^## /m).map((s) => s.replaceAll(FENCE_MASK, '## '))

/** a plausible short sha for the git-log fiction — deterministic per role */
const hashFor = (s: string): string => {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h.toString(16).padStart(8, '0').slice(0, 7)
}

/** 1-based line of the first line containing `needle` — real sourcemap positions */
const lineOf = (src: string, needle: string): number | undefined => {
  if (!needle) return undefined
  const i = src.split('\n').findIndex((l) => l.includes(needle))
  return i >= 0 ? i + 1 : undefined
}

const LINK = 'text-inkdim underline decoration-line decoration-1 underline-offset-4 transition-colors hover:text-ink hover:decoration-ember'
const LINK_INK = 'text-ink underline decoration-line decoration-1 underline-offset-4 transition-colors hover:decoration-ember'
const CHIP = 'rounded-[3px] border border-line bg-raised/50 px-1.5 py-0.5 font-mono text-[10.5px] leading-none text-inkdim'

const SKILL_THEMES: Record<string, {
  border: string
  topBorder: string
  hoverBorder: string
  badgeBg: string
  badgeText: string
  badgeBorder: string
  dot: string
}> = {
  languages: {
    border: 'border-line',
    topBorder: 'border-t-[3px] border-t-tide',
    hoverBorder: 'hover:border-tide/60',
    badgeBg: 'bg-tide/12',
    badgeText: 'text-tide',
    badgeBorder: 'border-tide/30',
    dot: 'bg-tide',
  },
  tools: {
    border: 'border-line',
    topBorder: 'border-t-[3px] border-t-ember',
    hoverBorder: 'hover:border-ember/60',
    badgeBg: 'bg-ember/12',
    badgeText: 'text-ember',
    badgeBorder: 'border-ember/30',
    dot: 'bg-ember',
  },
  soft: {
    border: 'border-line',
    topBorder: 'border-t-[3px] border-t-violet',
    hoverBorder: 'hover:border-violet/60',
    badgeBg: 'bg-violet/12',
    badgeText: 'text-violet',
    badgeBorder: 'border-violet/30',
    dot: 'bg-violet',
  },
}

const DEFAULT_SKILL_THEME = {
  border: 'border-line',
  topBorder: 'border-t-2 border-t-line',
  hoverBorder: 'hover:border-ember/50',
  badgeBg: 'bg-ember/12',
  badgeText: 'text-ember',
  badgeBorder: 'border-line',
  dot: 'bg-ember',
}

// ---- a tiny markdown setter, for this page only ----
// the IDE's renderer wires hover cards and opens files — jargon for someone
// who's never used an editor. here a workspace link resolves to a place on
// this page, or quietly becomes plain text. nothing leaves the page uninvited.

type MdBlock = { kind: 'p'; text: string } | { kind: 'h'; text: string } | { kind: 'ul'; items: string[] } | { kind: 'code'; lines: string[] }

const isInternal = (href: string) => !/^(https?:|mailto:|tel:)/i.test(href)

/** a workspace path that exists but isn't a page section — notes/, source
    files. the link doesn't scroll, it opens the file in the editor itself */
const fileFor = (href: string): string | null => {
  const p = href.split(/[?#]/)[0].replace(/^(\.\.?\/)+/, '')
  return getFile(p) ? p : null
}

/** the in-page target for a workspace path — a project scrolls to its entry */
function anchorFor(href: string): string | null {
  const p = href.split(/[?#]/)[0].replace(/^(\.\.?\/)+/, '')
  const m = /^projects\/([\w-]+)\.md$/.exec(p)
  if (m) return `proj-${m[1]}`
  return { 'experience.json': 'doc-experience', 'skills.toml': 'doc-skills', 'contact.env': 'doc-contact' }[p] ?? null
}

/** "…is mine ([projects/x.md](projects/x.md))." — a parenthetical that only
    names a file reads as noise off the editor; drop it */
const dropFileRefs = (s: string) => s.replace(/\s*\((?:see\s+)?\[[^\]]+\]\((?!https?:|mailto:)[^)]+\)\)/g, '')

function parseBlocks(src: string): MdBlock[] {
  const out: MdBlock[] = []
  const st = { para: [] as string[], list: null as string[] | null }
  const closePara = () => {
    if (st.para.length) out.push({ kind: 'p', text: dropFileRefs(st.para.join(' ')) })
    st.para = []
  }
  const closeList = () => {
    if (st.list) out.push({ kind: 'ul', items: st.list.map(dropFileRefs) })
    st.list = null
  }
  const lines = src.replace(/\r/g, '').split('\n')
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const t = raw.trim()
    if (t.startsWith('```')) {
      closePara()
      closeList()
      const code: string[] = []
      for (i++; i < lines.length && !lines[i].trim().startsWith('```'); i++) code.push(lines[i])
      out.push({ kind: 'code', lines: code })
    } else if (!t) {
      closePara()
      closeList()
    } else if (/^#{1,6}\s/.test(t)) {
      closePara()
      closeList()
      out.push({ kind: 'h', text: t.replace(/^#+\s+/, '') })
    } else if (/^[-*]\s/.test(t)) {
      closePara()
      st.list ??= []
      st.list.push(t.slice(2))
    } else if (st.list && /^\s{2,}/.test(raw)) {
      st.list[st.list.length - 1] += ` ${t}`
    } else {
      closeList()
      st.para.push(t)
    }
  }
  closePara()
  closeList()
  return out
}

const INLINE = /\*\*(.+?)\*\*|``\s?(.+?)\s?``|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)|(?<![\w*])\*(?!\s)([^*]+?)\*(?![\w*])/g

function Inline({ text, depth = 0 }: { text: string; depth?: number }) {
  const out: ReactNode[] = []
  let last = 0
  for (const m of text.matchAll(INLINE)) {
    const at = m.index ?? 0
    if (at > last) out.push(text.slice(last, at))
    const key = at
    if (m[1] != null) {
      out.push(
        <strong key={key} className="font-medium text-ink">
          {/* visitor-edited '**…**' nests recursively — cap before the stack does */}
          {depth < 8 ? <Inline text={m[1]} depth={depth + 1} /> : m[1]}
        </strong>,
      )
    } else if (m[2] != null || m[3] != null) {
      out.push(<code key={key} className="font-mono text-[0.84em] text-ink">{m[2] ?? m[3]}</code>)
    } else if (m[4] != null) {
      const href = m[5]
      const internal = isInternal(href)
      const id = internal ? (href.startsWith('#') ? href.slice(1) : anchorFor(href)) : null
      const file = internal && !id && !href.startsWith('#') ? fileFor(href) : null
      out.push(
        !internal ? (
          <a key={key} href={safeHref(href)} target="_blank" rel="noreferrer" className={LINK_INK}>{m[4]}</a>
        ) : id ? (
          <button key={key} onClick={() => scrollToId(id)} className={LINK_INK}>{m[4]}</button>
        ) : file ? (
          <button key={key} onClick={() => openSource(file)} title={`open ${file} in the editor`} className={LINK_INK}>{m[4]}</button>
        ) : (
          <span key={key}>{m[4]}</span>
        ),
      )
    } else if (m[6] != null) {
      out.push(<em key={key} className="italic">{m[6]}</em>)
    }
    last = at + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return <>{out}</>
}

/** a console fence, set as the terminal session it is: prompts in ember, ✓ sage, ✗ rust */
function Receipt({ lines }: { lines: string[] }) {
  return (
    <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-[12px] leading-[1.75]">
      {lines.map((l, i) => (
        <span key={i} className={`block ${l.startsWith('$ ') ? 'text-ink' : /^\s*✓/.test(l) ? 'text-sage' : /^\s*✗/.test(l) ? 'text-rust' : 'text-inkdim'}`}>
          {l.startsWith('$ ') ? (
            <>
              <span className="text-ember">$</span>
              {l.slice(1)}
            </>
          ) : (
            l || ' '
          )}
        </span>
      ))}
    </pre>
  )
}

/** the write-up behind a project's fold — headings as `## markdown`, prose in serif */
function Details({ blocks }: { blocks: MdBlock[] }) {
  return (
    <div className="space-y-3">
      {blocks.map((b, i) =>
        b.kind === 'h' ? (
          <h4 key={i} className={`font-mono text-[12px] text-ink ${i ? 'pt-4' : ''}`}>
            <span className="text-inkfaint">## </span>
            {b.text}
          </h4>
        ) : b.kind === 'p' ? (
          <p key={i} className="font-serif text-[16.5px] leading-[1.65] text-inkdim">
            <Inline text={b.text} />
          </p>
        ) : b.kind === 'ul' ? (
          <ul key={i} className="space-y-1.5">
            {b.items.map((it, j) => (
              <li key={j} className="pl-4 -indent-4 font-serif text-[16.5px] leading-[1.6] text-inkdim">
                <span className="text-inkfaint" aria-hidden>– </span>
                <Inline text={it} />
              </li>
            ))}
          </ul>
        ) : (
          <div key={i} className="border-l-2 border-line pl-4">
            <Receipt lines={b.lines} />
          </div>
        ),
      )}
    </div>
  )
}

// ---- chrome pieces borrowed from the IDE ----

/** an editor window: traffic lights, one active tab, the abyss underneath */
function Window({ title, ext, url, className = '', bodyClass = '', children }: { title: string; ext?: string; url?: string; className?: string; bodyClass?: string; children: ReactNode }) {
  return (
    <div className={`overflow-hidden rounded-md border border-line bg-chrome shadow-[0_28px_60px_-28px_rgba(0,0,0,0.45)] ${className}`}>
      <div className="flex h-8 items-stretch border-b border-line">
        <div className="flex items-center gap-1.5 px-3" aria-hidden>
          <span className="h-2.5 w-2.5 rounded-full bg-[#e0604f]/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#e0a54f]/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#7fbf6e]/80" />
        </div>
        {url ? (
          <div className="my-1.5 mr-3 flex min-w-0 flex-1 items-center gap-2 rounded-[3px] border border-line bg-abyss px-2.5 font-mono text-[10.5px] text-inkfaint">
            <span className="text-sage" aria-hidden>●</span>
            <span className="truncate">{url}</span>
          </div>
        ) : (
          <div className="-mb-px flex min-w-0 items-center gap-1.5 border-x border-t-2 border-line border-t-ember bg-abyss px-3 font-mono text-[11px] text-ink">
            {ext && <FileIcon ext={ext} size={12} />}
            <span className="truncate">{title}</span>
          </div>
        )}
      </div>
      <div className={`bg-abyss ${bodyClass}`}>{children}</div>
    </div>
  )
}

/** the section opener: `nº / file` in mono, the human title in serif, the source on the right */
function SectionHead({ n, file, ext, title, sub, src, line, dirty, id }: { n: string; file: string; ext: string; title: string; sub?: ReactNode; src: string; line?: number; dirty?: boolean; id?: string }) {
  return (
    <div className="mb-12 flex flex-wrap items-end justify-between gap-x-8 gap-y-4 md:mb-14">
      <div>
        <p className="flex items-center gap-2 font-mono text-[11.5px] text-inkfaint">
          <span className="text-ember">{n}</span>
          <span aria-hidden>/</span>
          <FileIcon ext={ext} size={12} />
          {file}
          {dirty && <span className="text-violet">● edited in your workspace</span>}
        </p>
        <h2 id={id} tabIndex={-1} className="mt-3 font-serif text-[40px] font-normal leading-[1.02] tracking-[-0.02em] text-ink outline-none md:text-[54px]">
          {title}
        </h2>
      </div>
      <div className="flex flex-col items-start gap-1 font-mono text-[11.5px] text-inkfaint md:items-end">
        {sub}
        <button onClick={() => openSource(src, line)} className="no-print transition-colors hover:text-ember" title={`open ${src} in the editor — the source this section was compiled from`}>
          open in the editor ↗
        </button>
      </div>
    </div>
  )
}

// ---- the career as a git graph: one lane per role, a dashed line for now ----

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const ym = (s: string): number | null => {
  const m = /\b([a-z]{3})[a-z]*\.?\s+(\d{4})/i.exec(s)
  if (m && MONTHS.includes(m[1].toLowerCase())) return Number(m[2]) * 12 + MONTHS.indexOf(m[1].toLowerCase())
  const y = /(\d{4})/.exec(s)
  return y ? Number(y[1]) * 12 : null
}
function spanOf(period: string, now: number): { start: number; end: number; ongoing: boolean } | null {
  const [a, b] = period.split('→').map((x) => x.trim())
  const start = ym(a ?? '')
  if (start == null) return null
  const ongoing = /present/i.test(b ?? '')
  const end = b ? (ongoing ? now : (ym(b) ?? start + 1)) : start + 1
  // visitor-edited dates can land outside the track (e.g. "2049 → present") —
  // clamp both ends so a lane can't paint past the now line
  return { start: Math.min(start, now), end: Math.min(now, Math.max(end, start + 1)), ongoing }
}

// months-since-epoch — recomputes per page load, which is the granularity
// the timeline needs anyway
const NOW_MONTHS = (() => {
  const d = new Date()
  return d.getFullYear() * 12 + d.getMonth() + 1
})()

function Timeline({ roles }: { roles: ExpData['experience'] }) {
  const now = NOW_MONTHS
  const lanes = roles.flatMap((r, i) => {
    const s = spanOf(r.period, now)
    return s ? [{ r, i, s }] : []
  })
  if (lanes.length < 2) return null
  const lo = Math.min(...lanes.map((l) => l.s.start)) - 1
  const x = (m: number) => `${(((m - lo) / Math.max(1, now - lo)) * 100).toFixed(2)}%`
  const years: number[] = []
  for (let y = Math.ceil(lo / 12); y * 12 < now; y++) years.push(y)
  return (
    <div className="relative font-mono text-[11.5px]">
      {/* the track column's grid: year ticks + the dashed "now" line */}
      <div className="pointer-events-none absolute bottom-0 left-[calc(16rem+1.25rem)] lg:left-[calc(24rem+1.25rem)] right-0 top-0" aria-hidden>
        {years.map((y) => (
          <span key={y} className="absolute inset-y-0 border-l border-line" style={{ left: x(y * 12) }}>
            <span className="absolute -top-0.5 left-1.5 text-[10.5px] text-inkfaint">{y}</span>
          </span>
        ))}
        <span className="absolute inset-y-0 right-0 border-l border-dashed border-ember/60">
          <span className="absolute -top-0.5 right-1.5 text-[10.5px] text-ember">now</span>
        </span>
      </div>
      <ol aria-label="career timeline — one lane per role" className="pt-6">
        {lanes.map(({ r, i, s }) => (
          <li key={r.role + r.org + i}>
            <button
              onClick={() => scrollToId(`role-${i}`)}
              aria-label={`${r.role}${r.org ? `, ${r.org}` : ''} — ${r.period}. jump to details`}
              title={`${r.role}${r.org ? ` — ${r.org}` : ''} · ${r.period}`}
              className="group/lane grid h-[26px] w-full grid-cols-[16rem_minmax(0,1fr)] lg:grid-cols-[24rem_minmax(0,1fr)] items-center gap-x-5 rounded-[3px] text-left transition-colors hover:bg-raised/70"
            >
              <span className="whitespace-nowrap pl-2 text-inkdim transition-colors group-hover/lane:text-ink">{r.role}</span>
              <span className="relative h-full">
                <span
                  className={`absolute top-1/2 h-[2px] -translate-y-1/2 transition-colors ${s.ongoing ? 'bg-ink/70 group-hover/lane:bg-ember' : 'bg-inkfaint/50 group-hover/lane:bg-ink'}`}
                  style={{ left: x(s.start), width: `calc(${x(s.end)} - ${x(s.start)})` }}
                />
                <span
                  className={`absolute top-1/2 h-[8px] w-[8px] -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-abyss ${s.ongoing ? 'bg-ember' : 'bg-inkfaint'}`}
                  style={{ left: x(s.start) }}
                />
              </span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  )
}

// ---- the hero's code window: the profile as the TypeScript it would be ----

type Tok = [string, string]
const str = (v: string): Tok => ['tok-str', JSON.stringify(v)]
const prop = (k: string, ...v: Tok[]): Tok[] => [['', '  '], ['tok-prop', k], ['tok-op', ': '], ...v, ['tok-op', ',']]
const arr = (vs: string[]): Tok[] => [['tok-op', '['], ...vs.flatMap((v, i): Tok[] => (i ? [['tok-op', ', '], str(v)] : [str(v)])), ['tok-op', ']']]

const SECTIONS_NAV = [
  { id: 'doc-intro', name: 'README.md', ext: 'md' },
  { id: 'doc-work', name: 'projects/', ext: 'md' },
  { id: 'doc-experience', name: 'experience.json', ext: 'json' },
  { id: 'doc-skills', name: 'skills.toml', ext: 'toml' },
  { id: 'doc-education', name: 'certs/', ext: 'pdf' },
  { id: 'doc-community', name: 'volunteer', ext: 'json' },
  { id: 'doc-contact', name: 'contact.env', ext: 'env' },
] as const

/** section tabs — the IDE's own tab strip, active tab picked out the same way */
function Tabs({ items }: { items: readonly (typeof SECTIONS_NAV)[number][] }) {
  const [active, setActive] = useState<string>(items[0]?.id ?? '')
  const navRef = useRef<HTMLElement>(null)
  const isNavigatingRef = useRef(false)
  const navTimerRef = useRef<number | null>(null)

  useEffect(() => {
    const scroller = document.getElementById('readable-scroll')
    if (!scroller) return

    const spy = () => {
      if (isNavigatingRef.current) return
      const top = scroller.getBoundingClientRect().top
      const chrome = document.getElementById('readable-chrome')
      const chromeHeight = chrome ? chrome.offsetHeight : 72
      const bottomedOut = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 16
      const marker = top + chromeHeight + (bottomedOut ? scroller.clientHeight * 0.7 : 60)
      let current = items[0]?.id ?? ''
      for (const it of items) {
        const el = document.getElementById(it.id)
        if (el && el.getBoundingClientRect().top <= marker) current = it.id
      }
      setActive(current)
    }

    spy()
    scroller.addEventListener('scroll', spy, { passive: true })
    window.addEventListener('resize', spy)
    return () => {
      scroller.removeEventListener('scroll', spy)
      window.removeEventListener('resize', spy)
      if (navTimerRef.current) clearTimeout(navTimerRef.current)
    }
  }, [items])

  useEffect(() => {
    if (!active || !navRef.current) return
    const btn = navRef.current.querySelector<HTMLElement>('[aria-current="location"]')
    const nav = navRef.current
    if (!btn) return
    const btnLeft = btn.offsetLeft
    const btnRight = btnLeft + btn.offsetWidth
    const scrollLeft = nav.scrollLeft
    const visibleWidth = nav.clientWidth
    if (btnLeft < scrollLeft) {
      nav.scrollTo({ left: Math.max(0, btnLeft - 16), behavior: 'smooth' })
    } else if (btnRight > scrollLeft + visibleWidth) {
      nav.scrollTo({ left: btnRight - visibleWidth + 16, behavior: 'smooth' })
    }
  }, [active])

  return (
    <nav ref={navRef} aria-label="sections" className="flex h-9 items-stretch overflow-x-auto border-b border-line [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {items.map((it) => {
        const on = active === it.id
        return (
          <button
            key={it.id}
            aria-current={on ? 'location' : undefined}
            onClick={() => {
              setActive(it.id)
              isNavigatingRef.current = true
              if (navTimerRef.current) clearTimeout(navTimerRef.current)
              scrollToId(it.id, true, () => {
                isNavigatingRef.current = false
              })
              navTimerRef.current = window.setTimeout(() => {
                isNavigatingRef.current = false
              }, 500)
            }}
            className={`flex shrink-0 items-center gap-1.5 border-r border-t-2 border-line px-3.5 font-mono text-[12px] transition-colors ${
              on ? 'border-t-ember bg-abyss text-ink' : 'border-t-transparent text-inkfaint hover:bg-raised hover:text-ink'
            }`}
          >
            <FileIcon ext={it.ext} size={12} />
            {it.name}
          </button>
        )
      })}
    </nav>
  )
}

/**
 * the page's status bar — the IDE's own bottom chrome, morphed: same footer,
 * same item chrome, and the deploy chip comes back rotated as "back to
 * source". Ln tracks scroll against the artifact's pretend source length.
 */
function StatusBar({ errors, theme, onExit }: { errors: number; theme: string; onExit: () => void }) {
  const [ln, setLn] = useState(1)
  const fileContents = useIDE((s) => s.fileContents)
  const virtualFiles = useIDE((s) => s.virtualFiles)
  const baselines = useIDE((s) => s.baselines)
  const visitorCommits = useIDE((s) => s.visitorCommits)
  const dirty = Object.keys(fileContents).filter((p) => isDirtyPath({ fileContents, virtualFiles, baselines }, p)).length
  const dirtyish = dirty > 0 || visitorCommits.length > 0
  useEffect(() => {
    const sc = document.getElementById('readable-scroll')
    if (!sc) return
    const onScroll = () => setLn(Math.max(1, Math.round((sc.scrollTop / Math.max(1, sc.scrollHeight - sc.clientHeight)) * 340)))
    onScroll()
    sc.addEventListener('scroll', onScroll, { passive: true })
    return () => sc.removeEventListener('scroll', onScroll)
  }, [])
  // inert items stay quiet — the IDE's status items are buttons, but on this
  // page nothing here responds to a click except the two that say so
  const item = 'flex h-full items-center gap-1 px-2'
  const cycleTheme = () => {
    const s = store.getState()
    const order: ThemeId[] = ['kushal-midnight', 'demogod', 'kushal-daylight']
    const i = order.indexOf(s.settings['workbench.colorTheme'])
    s.applySettings({ 'workbench.colorTheme': order[(i + 1) % order.length] })
  }
  return (
    <footer
      aria-label="status"
      style={{ viewTransitionName: 'statusbar' }}
      className="no-print fixed inset-x-0 bottom-0 z-10 flex h-6 select-none items-stretch justify-between border-t border-line bg-chrome font-mono text-[10.5px] text-inkdim box-content pb-[env(safe-area-inset-bottom,0px)]"
    >
      <div className="flex items-stretch">
        <span className={item} title="branch — visitor edits land on visitor/you">
          <GitBranch size={11} className={dirtyish ? 'text-violet' : 'text-ember'} />
          <span className={dirtyish ? 'text-violet' : undefined}>
            {visitorCommits.length ? 'visitor/you' : 'main'}{dirty ? `*${dirty}` : ''}
          </span>
        </span>
        <span className={`hidden ${item} sm:flex`} title="problems in the compiled sources">
          <XCircle size={11} className={errors ? 'text-rust' : ''} />
          <span>{errors}</span>
          <AlertTriangle size={11} className="text-ember" />
          <span>0</span>
        </span>
        <span className={`hidden ${item} md:flex text-inkfaint`}>readable.html</span>
      </div>
      <div className="flex items-stretch">
        {/* the deploy chip, home again — same slot the IDE builds from */}
        <button
          onClick={onExit}
          title="View Source (F5)"
          aria-label="View Source (F5)"
          style={{ viewTransitionName: 'deploy-chip' }}
          className="animate-view-source mx-1 my-1 flex items-center gap-1.5 rounded-[3px] bg-ember px-2.5 font-black tracking-wide text-abyss shadow-md transition-all hover:bg-ember/90 hover:scale-105 active:scale-95"
        >
          <Code size={11} />
          <span className="hidden sm:inline font-bold">View Source</span>
          <span className="sm:hidden font-bold">Source</span>
          <kbd className="hidden rounded-[2px] border border-abyss/40 bg-abyss/10 px-1 text-[8.5px] font-bold sm:inline">F5</kbd>
        </button>
        <span className="hidden h-full items-center px-2 tabular-nums sm:flex">Ln {ln}, Col 1</span>
        <span className={`hidden ${item} md:flex`}>Spaces: 2</span>
        <span className="hidden items-center px-2 lg:flex">UTF-8</span>
        <button onClick={cycleTheme} title={`theme: ${theme} — click to cycle`} className={`hidden ${item} text-ember transition-colors hover:bg-raised md:flex`}>{theme}</button>
      </div>
    </footer>
  )
}

/** contact.env, leaked — comments, redactions and jokes intact, env-highlighted.
    trimmed for a reader: the internal plumbing keys and the trailing notes-to-self
    block stay in the file */
const ENV_HIDDEN = /^(SCHEDULING|LAST_VERIFIED|TESTIMONIAL)=/
function EnvLines({ src }: { src: string }) {
  const lines = src.replace(/\r/g, '').split('\n')
  const cut = lines.findIndex((l) => /^#\s*social proof/i.test(l.trim()))
  const shown = (cut >= 0 ? lines.slice(0, cut) : lines).filter((l) => !ENV_HIDDEN.test(l.trim()))
  while (shown.length && !shown[shown.length - 1].trim()) shown.pop()
  return (
    <div className="font-mono text-[12px] leading-[1.75]">
      {shown.map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-2" />
        if (line.trimStart().startsWith('#')) return <div key={i} className="whitespace-pre-wrap break-words text-inkfaint">{line}</div>
        const m = /^([A-Z_][A-Z0-9_]*)=(.*?)(\s+#.*)?$/.exec(line)
        if (!m) return <div key={i} className="whitespace-pre-wrap break-words text-inkfaint">{line}</div>
        const [, key, rawVal, comment] = m
        const val = rawVal.trim()
        // only these keys are links — everything else (incl. the jokes) is text
        const link =
          key === 'EMAIL' ? (/^[^\s@]+@[^\s@]+$/.test(val) ? `mailto:${val}` : null)
          : key === 'PHONE' ? (/^\+?[\d][\d\s().-]{6,}$/.test(val) ? `tel:${val.replace(/[^\d+]/g, '')}` : null)
          : key === 'GITHUB' || key === 'LINKEDIN' ? domainHref(val)
          : key === 'RESUME_PDF' ? (/^\/[^/]/.test(val) ? val : safeHref(val))
          : null
        const newTab = /^(https?:|\/)/.test(link ?? '')
        return (
          <div key={i} className="whitespace-pre-wrap break-all">
            <span className="text-tide">{key}</span>
            <span className="text-inkfaint">=</span>
            {link && link !== '#' ? (
              <a data-print-plain href={link} target={newTab ? '_blank' : undefined} rel={newTab ? 'noreferrer' : undefined} className="text-sage underline decoration-transparent underline-offset-2 hover:decoration-sage">
                {val}
              </a>
            ) : (
              <span className="text-sage">{val}</span>
            )}
            {comment && <span className="text-inkfaint">{comment}</span>}
          </div>
        )
      })}
    </div>
  )
}

/** facts the impact panel may show — each only renders if its number still
    appears somewhere in the live content, so a visitor edit can retract it */
const IMPACT = [
  { re: /1,500\+/, n: '1,500+', label: 'students & faculty on wildcat-calendar, daily', tab: 'users' },
  { re: /60\+? member|60-person/, n: '60+', label: 'person student government, co-led', tab: 'team' },
  { re: /130\+/, n: '130+', label: 'hackers at daydream vancouver, organized', tab: 'event' },
  { re: /\$5,200\+/, n: '$5,200+', label: 'raised so the hackathon could be free', tab: 'funding' },
]

export function ReadableView() {
  const enabled = useIDE((s) => s.extensionsEnabled)
  const visitorCommits = useIDE((s) => s.visitorCommits)
  const mobile = useIDE((s) => s.mobile)
  const liteDismissed = useIDE((s) => s.liteDismissed)
  const ideTheme = useIDE((s) => s.settings['workbench.colorTheme'])
  // the artifact compiles the *live* workspace — visitor edits show up here
  const fileContents = useIDE((s) => s.fileContents)
  const virtualFiles = useIDE((s) => s.virtualFiles)
  const baselines = useIDE((s) => s.baselines)
  const bag = { fileContents, virtualFiles, baselines }
  const live = (p: string) => {
    const f = getFile(p)
    return f ? contentOf(bag, f) : ''
  }

  const { data: exp, fatal: expFatal, dropped: expDropped } = useMemo((): { data: ExpData; fatal: boolean; dropped: number } => {
    const str = (v: unknown) => (typeof v === 'string' ? v : '')
    const strArr = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])
    try {
      const parsed = JSON.parse(live('experience.json') || '{}')
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('shape')
      // normalize every field — "live parsed" means a half-typed edit hits
      // parseable-but-wrong-shape states and must degrade, not crash. each
      // array degrades independently: deleting `education` shouldn't take
      // the whole experience section down with it
      const roles = (Array.isArray(parsed.experience) ? parsed.experience : [])
        .filter((e: unknown) => e && typeof (e as { role?: unknown }).role === 'string')
        .map((e: { role: string; org?: unknown; period?: unknown; highlights?: unknown; stack?: unknown; url?: unknown; link?: unknown }) => ({
          role: e.role,
          org: str(e.org),
          period: str(e.period),
          highlights: strArr(e.highlights),
          stack: strArr(e.stack),
          url: str(e.url ?? e.link) || undefined,
        }))
      const edu = (Array.isArray(parsed.education) ? parsed.education : [])
        .filter((e: unknown) => e && typeof (e as { institution?: unknown }).institution === 'string')
        .map((e: { institution: string; degree?: unknown; period?: unknown; notes?: unknown }) => ({
          institution: e.institution,
          degree: str(e.degree),
          period: str(e.period),
          notes: str(e.notes) || undefined,
        }))
      const coursework = Array.isArray(parsed.coursework)
        ? parsed.coursework
            .filter((c: unknown) => c && typeof (c as { name?: unknown }).name === 'string')
            .map((c: { name: string; status?: unknown }) => ({ name: c.name, status: str(c.status) || undefined }))
        : []
      const awards = Array.isArray(parsed.awards)
        ? parsed.awards
            .filter((a: unknown) => a && typeof (a as { what?: unknown }).what === 'string')
            .map((a: { what: string; result?: unknown }) => ({ what: a.what, result: str(a.result) }))
        : []
      const certifications = Array.isArray(parsed.certifications)
        ? parsed.certifications
            .filter((c: unknown) => c && typeof (c as { name?: unknown }).name === 'string')
            .map((c: { name: string; issuer?: unknown; date?: unknown; file?: unknown; verify?: unknown; status?: unknown }) => ({
              name: c.name,
              issuer: str(c.issuer),
              date: str(c.date),
              file: str(c.file) || undefined,
              verify: str(c.verify) || undefined,
              status: str(c.status) || undefined,
            }))
        : []
      const community = Array.isArray(parsed.community)
        ? parsed.community
            .filter((c: unknown) => c && typeof (c as { activity?: unknown }).activity === 'string')
            .map((c: { activity: string; hours?: unknown; org?: unknown; highlights?: unknown }) => ({
              activity: c.activity,
              hours: str(c.hours),
              org: str(c.org) || undefined,
              highlights: str(c.highlights) || undefined,
            }))
        : []
      const communityLog = Array.isArray(parsed.communityLog)
        ? parsed.communityLog
            .filter((c: unknown) => c && typeof (c as { activity?: unknown }).activity === 'string')
            .map((c: { org?: unknown; activity: string; hours?: unknown }) => ({
              org: str(c.org),
              activity: c.activity,
              hours: str(c.hours),
            }))
        : []
      // a malformed entry that's silently dropped is still an error worth
      // disclosing — the status bar counts it
      const dropped =
        (Array.isArray(parsed.experience) ? parsed.experience.length - roles.length : parsed.experience != null ? 1 : 0) +
        (Array.isArray(parsed.education) ? parsed.education.length - edu.length : parsed.education != null ? 1 : 0) +
        (Array.isArray(parsed.coursework) ? parsed.coursework.length - coursework.length : parsed.coursework != null ? 1 : 0) +
        (Array.isArray(parsed.awards) ? parsed.awards.length - awards.length : parsed.awards != null ? 1 : 0) +
        (Array.isArray(parsed.certifications) ? parsed.certifications.length - certifications.length : parsed.certifications != null ? 1 : 0) +
        (Array.isArray(parsed.community) ? parsed.community.length - community.length : parsed.community != null ? 1 : 0)
      return { data: { experience: roles, education: edu, coursework, awards, certifications, community, communityLog }, fatal: false, dropped }
    } catch {
      // the visitor broke the JSON — the artifact degrades instead of crashing
      return { data: { experience: [], education: [], coursework: [], awards: [], certifications: [], community: [], communityLog: [] }, fatal: true, dropped: 1 }
    }
  }, [fileContents, baselines]) // eslint-disable-line react-hooks/exhaustive-deps
  const skills = useMemo(() => parseSkills(live('skills.toml')), [fileContents, baselines]) // eslint-disable-line react-hooks/exhaustive-deps
  const envSrc = live('contact.env')
  const env = useMemo(() => parseEnv(envSrc), [envSrc])
  // TESTIMONIAL=who|quote in contact.env — absent by design until there's a real one
  const testimonial = useMemo(() => {
    const t = env.TESTIMONIAL?.split('|') ?? []
    return t.length === 2 && t[1].trim() ? { who: t[0].trim(), quote: t[1].trim() } : null
  }, [env])

  // the intro is the README, re-set: h1 → name, the whoami fence → the hover
  // card, "the deal" → headline + lede. the rest of the README is about using
  // the editor — it doesn't compile into a page meant for people who never will.
  const readmeSrc = live('README.md')
  const intro = useMemo(() => {
    const src = readmeSrc
    const name = /^#\s+(.+)$/m.exec(src)?.[1].trim() || 'Kushal Gangarapu'
    const fence = (/```text\s*\n([\s\S]*?)```/.exec(src)?.[1] ?? '').split('\n').map((l) => l.trim())
    const wi = fence.findIndex((l) => l.startsWith('$ whoami'))
    const whoami = wi >= 0 ? fence[wi + 1] ?? '' : ''
    const tagline = wi >= 0 ? fence[wi + 2] ?? '' : ''
    const deal = splitH2(src).find((p) => /^the deal\b/.test(p)) ?? ''
    const paras = deal
      .split('\n')
      .slice(1)
      .join('\n')
      .split(/\n\s*\n/)
      .map((p) => p.replace(/\s*\n\s*/g, ' ').trim())
      .filter(Boolean)
    const m = /^(.+?[.!?])\s+([\s\S]+)$/.exec(paras[0] ?? '')
    const headline = m ? m[1] : paras[0] || name
    const lede = m ? dropFileRefs(m[2]) : ''
    return { name, whoami, tagline, headline, lede }
  }, [readmeSrc])

  const expSrc = live('experience.json')

  // every project, whole — the pitch paragraph up front, the receipt in a
  // terminal, the rest of the file behind a fold so nobody has to open it
  const projects = useMemo(() => {
    const curated = new Set(PROJECTS)
    const extra = allFiles()
      .map((f) => f.path)
      .filter((p) => /^projects\/.+\.md$/.test(p) && !curated.has(p))
      .sort()
    return [...PROJECTS, ...extra].flatMap((p) => {
        const f = getFile(p)
        if (!f) return []
        const { fm, body } = parseFrontmatter(contentOf(bag, f))
        const blocks = parseBlocks(body.replace(/^\s*#\s+[^\n]*\r?\n/, ''))
        const lede = blocks[0]?.kind === 'p' ? blocks[0].text : ''
        const rest = lede ? blocks.slice(1) : blocks
        const receiptIdx = rest.findIndex((b) => b.kind === 'code')
        const receipt = receiptIdx >= 0 ? (rest[receiptIdx] as Extract<MdBlock, { kind: 'code' }>) : undefined
        // the fence moves into its own terminal window — the heading sitting
        // directly above it ("## the receipt") would otherwise end up
        // labeling whatever paragraph followed the fence instead
        const details = rest.filter((b, i) => i !== receiptIdx && !(receiptIdx > 0 && i === receiptIdx - 1 && b.kind === 'h'))
        // a heading left with nothing under it (end of doc, or another
        // heading next) drops out too
        const tidy = details.filter((b, i) => !(b.kind === 'h' && (i === details.length - 1 || details[i + 1].kind === 'h')))
        const fm2 = fm ?? {}
        const stack = (fm2.stack ?? '').split('·').map((s) => s.trim()).filter(Boolean)
        const repoUrl = (fm2.repo ?? fm2.link)?.split(' ')[0]
      return [{ path: p, slug: p.replace(/^projects\/|\.md$/g, ''), name: f.name, fm: fm2, lede, receipt, details: tidy, stack, repoUrl }]
    })
    }, [fileContents, baselines]) // eslint-disable-line react-hooks/exhaustive-deps
  // fm values are strings — `flagship: false` parses to 'false', which is truthy
  const flagship = projects.find((p) => /^(true|yes|1)$/i.test(p.fm.flagship ?? '')) ?? projects[0]
  const others = projects.filter((p) => p !== flagship)

  // open folds, by key — write-ups start folded so the page stays visual;
  // print ignores folds entirely
  const [openSet, setOpenSet] = useState<ReadonlySet<string>>(() => new Set())
  const toggle = (k: string) =>
    setOpenSet((prev) => {
      const next = new Set(prev)
      if (!next.delete(k)) next.add(k)
      return next
    })

  const scrollRef = useRef<HTMLDivElement>(null)
  // the artifact IS the IDE's theme — the toolbar toggle writes the real
  // workbench.colorTheme setting, so page and editor can never disagree
  const applySettings = useIDE((s) => s.applySettings)
  const light = ideTheme === 'kushal-daylight'

  // skills.toml carries the same "malformed entries disclose in the status
  // bar" contract as experience.json — a visitor edit that leaves sections
  // declared but zero entries parseable shows up as a problem, not silence
  const skillBroken = /\[(languages|tools)\]/.test(live('skills.toml')) && !skills.some((sec) => sec.entries.length)
  const expErrors = (expFatal || expDropped ? Math.max(1, expDropped) : 0) + (skillBroken ? 1 : 0)

  // deep-link while the artifact is up + announce the deploy — once per
  // session; F5-ing back and forth shouldn't spam the bell
  useEffect(() => {
    const prev = window.location.hash
    if (store.getState().booted || prev === '#/recruiter') {
      window.history.replaceState(null, '', '#/recruiter')
    }
    document.title = 'Kushal Gangarapu'
    const s = store.getState()
    if (s.maybeHint('deployed-notif')) {
      s.notify({
        icon: 'kushal',
        title: 'deployed to production',
        body: 'shareable link: #/recruiter — it lands here directly',
        target: 'cmd:kushal --hire',
      })
    }
    // the artifact is a screen — keyboard/screen-reader users land on it, not body
    const hadFocus = document.activeElement as HTMLElement | null
    scrollRef.current?.focus()
    return () => {
      // only restore if nothing else navigated — a sourcemap jump writes
      // '#/file/x' + a title via the subscriber BEFORE this cleanup runs;
      // restoring unconditionally would clobber both
      if (window.location.hash === '#/recruiter' || window.location.hash === '') {
        // replaceState('') is a no-op — an empty url resolves to the current
        // url, fragment included. the bare pathname actually drops it.
        // if we ARRIVED via '#/recruiter' (typed hash after boot), prev is
        // '#/recruiter' too — restoring it would leave a dead deep-link in
        // the url while the IDE shows; fall back to the active tab instead
        const tab = getActiveTab(store.getState())
        const restore =
          prev && prev !== '#/recruiter' ? prev : tab ? `#/file/${encodeURIComponent(tab)}` : window.location.pathname + window.location.search
        window.history.replaceState(null, '', restore)
        document.title = 'Kushal Gangarapu'
      }
      if (hadFocus && document.contains(hadFocus)) hadFocus.focus({ preventScroll: true })
      else document.getElementById('main-editor')?.focus({ preventScroll: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // the extension lookup decides whether a skill is installed — toggling an
  // extension off in the IDE drops the skill here
  const skillOn = (name: string) => {
    const ext = EXTENSIONS.find((e) => e.skillKeys?.includes(name))
    return !ext || !!enabled[ext.id]
  }

  const dirty = (p: string) => isDirtyPath(bag, p)
  const exit = () => withViewTransition(() => store.getState().dismissReadable())
  const tryLive = (cmd: string) => {
    const s = store.getState()
    withViewTransition(() => {
      s.dismissReadable()
      s.setPanelTab('terminal')
    })
    exec(cmd)
  }

  // mailto/tel targets only exist if the value is plausible — malformed
  // values render as text, never as a broken link
  const emailOk = env.EMAIL && /^[^\s@]+@[^\s@]+$/.test(env.EMAIL) ? env.EMAIL : undefined
  const resumeHref = env.RESUME_PDF ? (/^\/[^/]/.test(env.RESUME_PDF) ? env.RESUME_PDF : safeHref(env.RESUME_PDF)) : '/resume.pdf'
  const githubHref = domainHref(env.GITHUB)
  const linkedinHref = domainHref(env.LINKEDIN)
  const openTo = availabilityLong(envSrc).split(' · ')

  const hasEducation = !expFatal && (exp.education.length + exp.certifications.length + exp.coursework.length + exp.awards.length) > 0
  const hasCommunity = !expFatal && exp.community.length > 0
  const communityHoursTotal = useMemo(() => {
    return exp.community.reduce((sum, item) => {
      const val = parseFloat(item.hours)
      return isNaN(val) ? sum : sum + val
    }, 0)
  }, [exp.community])
  const nav = useMemo(
    () =>
      SECTIONS_NAV.filter(
        (n) => (n.id !== 'doc-education' || hasEducation) && (n.id !== 'doc-community' || hasCommunity),
      ),
    [hasEducation, hasCommunity],
  )

  const corpus = readmeSrc + expSrc + projects.map((p) => p.lede).join(' ')
  const impact = IMPACT.filter((s) => s.re.test(corpus))

  const now = exp.experience[0]
  const shipping = projects.filter((p) => /^in production/i.test(p.fm.status ?? '')).map((p) => p.fm.title ?? p.name)
  const code: Tok[][] = [
    [['tok-com', '// compiled from README.md, experience.json, contact.env']],
    [['tok-kw', 'export const '], ['tok-def', 'kushal'], ['tok-op', ' = {']],
    prop('name', str(intro.name)),
    ...(intro.whoami ? [prop('school', str(intro.whoami))] : []),
    ...(now ? [prop('role', str(now.role))] : []),
    ...(shipping.length ? [prop('shipping', ...arr(shipping))] : []),
    prop('openTo', ...arr(openTo)),
    ...(env.LOCATION ? [prop('location', str(env.LOCATION))] : []),
    ...(env.RESPONSE_TIME ? [prop('repliesIn', str(env.RESPONSE_TIME))] : []),
    [['tok-op', '} '], ['tok-kw', 'satisfies '], ['tok-type', 'Hireable']],
  ]

  const sectionWrap = 'mx-auto max-w-[1240px] px-5 md:px-10'

  return (
    <div
      ref={scrollRef}
      id="readable-scroll"
      tabIndex={-1}
      // pinned so the artifact carries the IDE's theme even where an
      // inherited html data-theme would disagree
      data-theme={ideTheme}
      className="print-doc fixed inset-0 z-40 overflow-y-auto overflow-x-hidden bg-abyss text-ink outline-none pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]"
    >
      {/* top chrome — the IDE's own titlebar, morphed. same view-transition
          name, so F5 slides the real titlebar into this one instead of cutting */}
      <div id="readable-chrome" className="no-print sticky top-0 z-10 bg-chrome">
        <div className="flex h-9 items-center gap-1 border-b border-line pr-2" style={{ viewTransitionName: 'titlebar' }}>
          {/* traffic lights — decorative window dots */}
          <div className="flex items-center gap-2 px-3">
            <span className="h-3 w-3 rounded-full bg-[#e0604f]" aria-hidden />
            <span className="h-3 w-3 rounded-full bg-[#e0a54f]" aria-hidden />
            <span className="h-3 w-3 rounded-full bg-[#7fbf6e]" aria-hidden />
          </div>
          <button
            onClick={exit}
            title={mobile ? 'Source (F5)' : 'View Source (F5)'}
            aria-label="View Source (F5)"
            className="animate-view-source flex shrink-0 items-center gap-1.5 rounded-sm border border-ember/60 bg-ember/15 px-2.5 py-1 font-mono text-[11px] font-bold text-ink shadow-sm transition-all hover:scale-105 hover:border-ember hover:bg-ember/30 hover:shadow-md active:scale-95"
          >
            <Code size={12} className="text-ember" />
            <span className="font-bold text-ink">{mobile ? 'Source' : 'View Source'}</span>
            <kbd className="hidden rounded-sm border border-ember/40 bg-ember/20 px-1 text-[9px] font-bold text-ink sm:inline">F5</kbd>
          </button>
          {visitorCommits.length > 0 && (
            <span className="hidden shrink-0 font-mono text-[10px] text-violet lg:block">
              ● {visitorCommits.length} visitor patch{visitorCommits.length === 1 ? '' : 'es'} applied
            </span>
          )}
          {/* center: quick-open pill — the same one the IDE's titlebar carries */}
          <button
            onClick={() => store.getState().setPaletteOpen(true)}
            className="group mx-auto hidden h-5.5 w-full max-w-[380px] items-center gap-2 rounded-sm border border-line bg-abyss px-3 font-mono text-[11px] text-inkfaint transition-colors hover:border-inkfaint/50 md:flex"
            title="command palette (Ctrl+K)"
          >
            <Command size={11} className="shrink-0 text-ember/70" />
            <span className="min-w-0 flex-1 truncate text-left">jump to a section, file, or command</span>
            <kbd className="shrink-0 rounded-sm border border-line bg-raised px-1 text-[9px] text-inkfaint group-hover:border-ember/60 group-hover:text-ember">
              ⌘K
            </kbd>
          </button>
          <div className="ml-auto flex items-center gap-0.5 md:ml-0">
            <button
              onClick={() => {
                const url = `${location.origin}/`
                void copyToClipboard(url).then((ok) => {
                  if (ok) store.getState().toast('portfolio link copied', 'ok')
                  else store.getState().toast(`clipboard refused — the link is ${url}`, 'warn')
                })
              }}
              className="flex items-center gap-1.5 rounded-sm px-2 py-1 font-mono text-[10.5px] text-inkdim transition-colors hover:bg-raised hover:text-ink"
              title="copy link"
            >
              <Share2 size={12} /> <span className="hidden sm:inline">share</span>
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 rounded-sm px-2 py-1 font-mono text-[10.5px] text-inkdim transition-colors hover:bg-raised hover:text-ink"
              title="print / save as pdf"
            >
              <Printer size={12} /> <span className="hidden sm:inline">print / pdf</span>
            </button>
            <button
              onClick={() => applySettings({ 'workbench.colorTheme': light ? 'kushal-midnight' : 'kushal-daylight' })}
              title={light ? 'switch to the dark build — sets workbench.colorTheme' : 'switch to the light build — sets workbench.colorTheme'}
              className="flex items-center gap-1.5 rounded-sm px-2 py-1 font-mono text-[10.5px] text-inkdim transition-colors hover:bg-raised hover:text-ink"
            >
              {light ? <Moon size={12} /> : <Sun size={12} />} <span className="hidden sm:inline">{light ? 'dark' : 'light'}</span>
            </button>
          </div>
        </div>
        <Tabs items={nav} />
      </div>

      {/* lite-mode banner — only when the IDE auto-compiled for a phone */}
      {mobile && !liteDismissed && (
        <div className="no-print border-b border-line bg-raised/60 px-4 py-2 text-center font-mono text-[10.5px] text-inkdim">
          lite mode — the full IDE is underneath, keyboard and all.
          <button onClick={exit} className="ml-1.5 text-tide underline hover:text-ember">
            explore the source anyway
          </button>
        </div>
      )}

      <main role="main" id="readable-main" tabIndex={-1} className="outline-none">
        {/* print-only masthead — the chrome doesn't print, so the PDF still
            says whose page this is */}
        <div className="hidden border-b-2 border-ink px-6 py-4 print:block">
          <p className="font-serif text-[22px] font-bold">{intro.name}</p>
          <p className="font-mono text-[10px]">
            {[env.EMAIL, env.GITHUB, env.LINKEDIN, env.LOCATION, location.host].filter(Boolean).join(' · ')}
          </p>
        </div>

        {/* ── hero: the pitch on the left, the profile as code on the right ── */}
        <section id="doc-intro" aria-labelledby="rv-h1" className="rv-hero relative scroll-mt-[72px] overflow-visible border-b border-line">
          <div className={`${sectionWrap} grid items-center gap-14 pb-20 pt-16 md:pb-24 md:pt-20 lg:pb-40 xl:pb-36 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]`}>
            <div className="min-w-0">
              <h1
                id="rv-h1"
                tabIndex={-1}
                className="font-serif text-[clamp(48px,6.4vw,94px)] font-[420] leading-[0.96] tracking-[-0.035em] text-ink outline-none [text-wrap:balance]"
              >
                <Inline text={intro.headline} />
                <span aria-hidden className="rv-caret blink ml-[0.06em] inline-block h-[0.74em] w-[0.055em] translate-y-[0.04em] bg-ember" />
              </h1>
              {intro.lede && (
                <p className="mt-7 max-w-[32em] font-serif text-[19px] leading-[1.55] text-inkdim md:text-[21px]">
                  <Inline text={intro.lede} />
                </p>
              )}
              {/* no-print: the paper masthead already carries every one of these */}
              <div className="no-print mt-9 flex flex-wrap items-center gap-3">
                {emailOk && (
                  <a
                    data-print-plain
                    href={`mailto:${emailOk}`}
                    className="inline-flex items-center gap-2 rounded-[3px] bg-ember px-4 py-2.5 font-mono text-[12.5px] font-bold text-abyss transition-colors hover:bg-ember/85"
                  >
                    <Mail size={14} /> email me
                  </a>
                )}
                {resumeHref !== '#' && (
                  <a
                    href={resumeHref}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-[3px] border border-line bg-chrome px-4 py-2.5 font-mono text-[12.5px] text-ink transition-colors hover:border-ember/70"
                  >
                    <FileText size={14} /> resume.pdf
                  </a>
                )}
                {githubHref !== '#' && (
                  <a
                    href={githubHref}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-[3px] border border-line bg-chrome px-4 py-2.5 font-mono text-[12.5px] text-ink transition-colors hover:border-ember/70"
                  >
                    <FolderGit2 size={14} /> github
                  </a>
                )}
                {linkedinHref !== '#' && (
                  <a
                    href={linkedinHref}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-[3px] border border-line bg-chrome px-4 py-2.5 font-mono text-[12.5px] text-ink transition-colors hover:border-ember/70"
                  >
                    <Briefcase size={14} /> linkedin
                  </a>
                )}
              </div>
            </div>

            {/* the profile, as the TypeScript it would be — with the editor's
                own hover card pinned to the symbol, photo and all */}
            {/* sm:mb-64 md:mb-72 lg:mb-96 xl:mb-72 reserves room for the hover card and photo card hanging off the window's foot */}
            <div className="relative min-w-0 sm:mb-64 md:mb-72 lg:mb-96 xl:mb-72 lg:pl-4">
              <Window title="kushal.ts" ext="ts">
                <pre className="overflow-x-auto py-4 font-mono text-[12.5px] leading-[1.85]" aria-label="profile, written as code">
                  {code.map((line, i) => (
                    <div key={i} className={`grid grid-cols-[2.75rem_minmax(0,1fr)] pr-4 ${i === 1 ? 'bg-raised/60' : ''}`}>
                      <span className="select-none pr-4 text-right text-inkfaint/70" aria-hidden>{i + 1}</span>
                      {/* hanging indent — a wrapped value continues under its key, like a formatter would */}
                      <span className={`whitespace-pre-wrap break-words pl-[4ch] [text-indent:-4ch] ${line.some(([, tok]) => tok === 'name') ? 'font-bold' : ''}`}>
                        {line.map(([cls, t], j) =>
                          // the hovered symbol wears the editor's hover underline
                          i === 1 && t === 'kushal' ? (
                            <span key={j} className="underline decoration-ember decoration-dotted underline-offset-4">{t}</span>
                          ) : (
                            <span key={j} className={`${cls || ''} ${line.some(([, tok]) => tok === 'name') ? 'font-bold text-ink' : ''}`.trim() || undefined}>{t}</span>
                          ),
                        )}
                      </span>
                    </div>
                  ))}
                </pre>
              </Window>
              <div className="lsp-card relative z-[1] mt-4 w-full max-w-none sm:absolute sm:left-[2%] md:left-[4%] sm:top-full sm:-mt-3 sm:w-[285px] md:w-[310px]">
                <div className="lsp-head">
                  <span className="lsp-kind k-const">K</span>
                  <code>const kushal: Hireable</code>
                </div>
                <div className="lsp-doc">
                  {intro.tagline && <span className="block text-ink">{intro.tagline}</span>}
                  <span className="mt-0.5 block">{intro.whoami}</span>
                </div>
                <div className="lsp-foot no-print">
                  {emailOk && <a href={`mailto:${emailOk}`} className="lsp-link">email</a>}
                  <button onClick={() => scrollToId('doc-work')} className="lsp-link">see the work</button>
                  <span className="lsp-ls">kushal-ls</span>
                </div>
              </div>
              {/* developer photo card — placed in the red highlighted area below kushal.ts */}
              <div className="group relative z-[2] mx-auto mt-6 w-[210px] sm:mx-0 sm:absolute sm:right-0 sm:top-full sm:-mt-12 sm:w-[195px] md:w-[215px] lg:mt-32 xl:-mt-12">
                <div className="overflow-hidden rounded-md border border-line bg-chrome/95 p-1.5 shadow-xl backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-ember/70 hover:shadow-[0_16px_36px_-8px_rgba(232,122,54,0.25)] rotate-1 hover:rotate-0">
                  <div className="mb-1.5 flex items-center justify-between px-1 font-mono text-[10px] text-inkfaint">
                    <span className="flex items-center gap-1.5">
                      <Camera size={11} className="text-ember" />
                      <span className="font-medium text-inkdim">kushal.jpg</span>
                    </span>
                    <span className="flex items-center gap-1 text-[9px] text-sage">
                      <span className="h-1.5 w-1.5 rounded-full bg-sage" /> live
                    </span>
                  </div>
                  <div className="relative aspect-[3/4] overflow-hidden rounded-[3px] border border-line/60 bg-abyss">
                    <img
                      src={kushalHeroImg}
                      alt={intro.name}
                      width={450}
                      height={600}
                      fetchPriority="high"
                      className="h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
                      loading="eager"
                      decoding="async"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-abyss/95 via-abyss/60 to-transparent px-3 pb-3 pt-8">
                      <p className="font-mono text-[11.5px] font-bold leading-normal text-ink">{intro.name}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── impact: the editor's bottom panel, reporting the numbers ── */}
        {impact.length > 0 && (
          <div className={`${sectionWrap} -mt-px pt-14`}>
            <div className="overflow-hidden rounded-md border border-line bg-chrome shadow-[0_20px_50px_-15px_rgba(0,0,0,0.35),0_8px_24px_-6px_rgba(0,0,0,0.18)]">
              <div className="flex h-8 items-stretch border-b border-line font-mono text-[10.5px] uppercase tracking-[0.08em]" aria-hidden>
                <span className="flex items-center border-b-2 border-ember px-3 text-ink">output</span>
                <span className="flex items-center px-3 text-inkfaint">problems <span className="ml-1.5 rounded-full bg-raised px-1.5 text-[9.5px]">0</span></span>
                <span className="flex items-center px-3 text-inkfaint">terminal</span>
                <span className="ml-auto flex items-center px-3 normal-case tracking-normal text-inkfaint">kushal --impact</span>
              </div>
              <ul className="grid grid-cols-2 bg-abyss lg:grid-cols-4">
                {impact.map((s, i) => (
                  <li key={s.n} className={`px-3.5 py-6 sm:px-6 sm:py-7 ${i % 2 ? 'border-l border-line' : ''} ${i >= 2 ? 'border-t border-line lg:border-t-0' : ''} ${i === 2 ? 'lg:border-l' : ''}`}>
                    <p className="font-mono text-[10.5px] text-inkfaint">
                      <span className="text-sage">✓</span> {s.tab}
                    </p>
                    <p className="mt-2 font-serif text-[34px] sm:text-[44px] md:text-[52px] leading-none tracking-[-0.02em] text-ink">
                      {s.n.startsWith('$') ? (
                        <>
                          <span className="font-sans font-normal mr-0.5">$</span>
                          {s.n.slice(1)}
                        </>
                      ) : (
                        s.n
                      )}
                    </p>
                    <p className="mt-2.5 font-mono text-[11.5px] leading-snug text-inkdim">{s.label}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* ── work ── */}
        <section id="doc-work" aria-labelledby="doc-work-h" className="scroll-mt-[72px] pt-8 pb-20 md:pt-10 md:pb-24">
          <div className={sectionWrap}>
            <SectionHead
              n="01"
              file="projects/"
              ext="md"
              title="Selected work"
              src="projects/"
              dirty={PROJECTS.some(dirty)}
              id="doc-work-h"
            />

            {/* the flagship, full size: the product in a browser, the proof in a terminal */}
            {flagship && (
              <article id={`proj-${flagship.slug}`} aria-labelledby={`proj-${flagship.slug}-h`} className="min-w-0 scroll-mt-24">
                <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
                  {flagship.fm.img && (/^https?:\/\//i.test(flagship.fm.img) || /^\/[^/]/.test(flagship.fm.img)) ? (
                    <Window title={flagship.path} url={flagship.repoUrl ?? flagship.fm.title}>
                      <img
                        src={flagship.fm.img}
                        alt={`${flagship.fm.title ?? flagship.name} — screenshot`}
                        width={1024}
                        height={590}
                        style={{ aspectRatio: '1024/590' }}
                        loading="lazy"
                        decoding="async"
                        className="block w-full"
                      />
                    </Window>
                  ) : (
                    <div />
                  )}
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-inkfaint">
                      <span className="rounded-[3px] border border-ember/50 bg-ember/10 px-1.5 py-0.5 uppercase tracking-[0.12em] text-ember">flagship</span>
                      {flagship.fm.year}
                    </p>
                    <h3 id={`proj-${flagship.slug}-h`} className="mt-3 font-serif text-[38px] leading-[1.05] tracking-[-0.02em] text-ink md:text-[46px]">
                      {flagship.fm.title ?? flagship.name}
                    </h3>
                    {flagship.fm.status && (
                      <p className="mt-2 font-mono text-[12px] text-sage">
                        <span aria-hidden>● </span>
                        {flagship.fm.status}
                      </p>
                    )}
                    {flagship.lede && (
                      <p className="mt-5 font-serif text-[18px] leading-[1.6] text-inkdim">
                        <Inline text={flagship.lede} />
                      </p>
                    )}
                    {flagship.stack.length > 0 && (
                      <div className="mt-5 flex flex-wrap gap-1.5">
                        {flagship.stack.map((s, i) => <span key={s + i} className={CHIP}>{s}</span>)}
                      </div>
                    )}
                    <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[12px]">
                      {flagship.repoUrl && domainHref(flagship.repoUrl) !== '#' && (
                        <a href={domainHref(flagship.repoUrl)} target="_blank" rel="noreferrer" data-print-plain className="inline-flex items-center gap-1.5 rounded-[3px] border border-line bg-chrome px-3 py-2 text-ink transition-colors hover:border-ember/70">
                          visit {flagship.repoUrl.replace(/^https?:\/\//, '')} ↗
                        </a>
                      )}
                    </div>
                  </div>
                </div>
                {flagship.receipt && (
                  <Window title="zsh — the receipt" ext="sh" className="mt-8" bodyClass="p-5">
                    <Receipt lines={flagship.receipt.lines} />
                  </Window>
                )}
                {flagship.details.length > 0 && (
                  <WriteUp k={flagship.path} blocks={flagship.details} open={openSet.has(flagship.path)} onToggle={toggle} />
                )}
              </article>
            )}

            {/* the rest of the shelf — each project a small editor window */}
            <div className="mt-16 grid gap-6 md:grid-cols-2">
              {others.map((p) => {
                const isGh = p.repoUrl ? /^(www\.)?github\.com(\/|$)/i.test(p.repoUrl.replace(/^https?:\/\//i, '')) : false
                return (
                  // min-w-0: the folded write-up's one-line summary is nowrap —
                  // without it the grid cell grows to fit it and the page scrolls sideways
                  <article key={p.path} id={`proj-${p.slug}`} aria-labelledby={`proj-${p.slug}-h`} className="min-w-0 scroll-mt-24">
                    <Window title={p.path} ext="md" className="flex h-full flex-col" bodyClass="flex flex-1 flex-col p-6">
                      <div className="flex items-baseline justify-between gap-3">
                        <h3 id={`proj-${p.slug}-h`} className="font-serif text-[28px] leading-[1.1] tracking-[-0.015em] text-ink">
                          {p.fm.title ?? p.name}
                        </h3>
                        <span className="shrink-0 font-mono text-[11px] text-inkfaint">{p.fm.year}</span>
                      </div>
                      {p.fm.status && (
                        <p className={`mt-1.5 font-mono text-[11.5px] ${/^in production/i.test(p.fm.status) ? 'text-sage' : 'text-inkfaint'}`}>
                          <span aria-hidden>● </span>
                          {p.fm.status}
                        </p>
                      )}
                      {p.lede && (
                        <p className="mt-4 font-serif text-[16.5px] leading-[1.6] text-inkdim">
                          <Inline text={p.lede} />
                        </p>
                      )}
                      {p.receipt && (
                        <div className="mt-5 rounded-[3px] border border-line bg-chrome/60 px-4 py-3">
                          <Receipt lines={p.receipt.lines} />
                        </div>
                      )}
                      <div className="mt-auto pt-5">
                        {p.stack.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {p.stack.map((s, i) => <span key={s + i} className={CHIP}>{s}</span>)}
                          </div>
                        )}
                        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 font-mono text-[12px]">
                          {p.repoUrl && domainHref(p.repoUrl) !== '#' && (
                            <a href={domainHref(p.repoUrl)} target="_blank" rel="noreferrer" data-print-plain={isGh ? undefined : true} className={LINK}>
                              {isGh ? 'source on github' : p.repoUrl.replace(/^https?:\/\//, '')} ↗
                            </a>
                          )}
                          {dirty(p.path) && <span className="text-violet">● edited</span>}
                        </div>
                      </div>
                      {p.details.length > 0 && (
                        <WriteUp k={p.path} blocks={p.details} open={openSet.has(p.path)} onToggle={toggle} compact />
                      )}
                    </Window>
                  </article>
                )
              })}
            </div>
          </div>
        </section>

        {/* ── experience: the graph, then the commits ── */}
        <section id="doc-experience" aria-labelledby="doc-experience-h" className="scroll-mt-[72px] border-y border-line bg-chrome/40 pt-8 pb-20 md:pt-10 md:pb-24">
          <div className={sectionWrap}>
            <SectionHead
              n="02"
              file="experience.json"
              ext="json"
              title="Experience"
              src="experience.json"
              line={lineOf(expSrc, '"experience"')}
              dirty={dirty('experience.json')}
              id="doc-experience-h"
              sub={!expFatal && <span>{exp.experience.length} roles · {exp.experience.filter((e) => /present/i.test(e.period)).length} current</span>}
            />
            {expFatal ? (
              <p className="font-mono text-[13px] text-rust">syntax error in experience.json — fix it in the editor and this section recompiles.</p>
            ) : (
              <>
                {/* Timeline self-hides under 2 parseable lanes — don't ship an
                    empty git-log window when visitor edits collapse the data */}
                {exp.experience.filter((r) => spanOf(r.period, NOW_MONTHS)).length >= 2 && (
                  <Window title="git log --graph" ext="json" className="no-print hidden md:block" bodyClass="px-5 pb-5 pt-4">
                    <Timeline roles={exp.experience} />
                  </Window>
                )}
                <div className="mt-10 grid gap-5 md:grid-cols-2">
                  {exp.experience.map((e, i) => {
                    const current = /present/i.test(e.period)
                    const k = `role-${i}`
                    const more = e.highlights.length > 2
                    const shown = openSet.has(k) ? e.highlights : e.highlights.slice(0, 2)
                    return (
                      <article key={e.role + e.org + i} id={k} className="flex scroll-mt-24 flex-col rounded-md border border-line bg-abyss p-6">
                        <p className="flex items-center gap-2 font-mono text-[11px] text-inkfaint">
                          <span className={current ? 'text-ember' : ''} aria-hidden>●</span>
                          <span>{hashFor(e.role + e.org)}</span>
                          <span aria-hidden>·</span>
                          <span className={current ? 'text-inkdim' : ''}>{e.period}</span>
                        </p>
                        <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                          <h3 className="font-serif text-[22px] leading-[1.25] text-ink">{e.role}</h3>
                          {e.url && domainHref(e.url) !== '#' && (
                            <a
                              href={domainHref(e.url)}
                              target="_blank"
                              rel="noreferrer"
                              data-print-plain
                              className={`${LINK} font-mono text-[12px] whitespace-nowrap`}
                            >
                              {e.url.replace(/^https?:\/\//, '').replace(/\/$/, '')} ↗
                            </a>
                          )}
                        </div>
                        {e.org && (
                          e.url && domainHref(e.url) !== '#' ? (
                            <a
                              href={domainHref(e.url)}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-0.5 inline-block font-mono text-[12px] text-inkdim transition-colors hover:text-ember"
                            >
                              {e.org}
                            </a>
                          ) : (
                            <p className="mt-0.5 font-mono text-[12px] text-inkdim">{e.org}</p>
                          )
                        )}
                        {shown.length > 0 && (
                          <ul id={`${k}-hl`} className="mt-4 space-y-1.5">
                            {shown.map((h, j) => (
                              <li key={h + j} className="pl-4 -indent-4 font-serif text-[16px] leading-[1.55] text-inkdim">
                                <span className="text-inkfaint" aria-hidden>– </span>
                                {h}
                              </li>
                            ))}
                          </ul>
                        )}
                        {/* print gets every highlight, folded or not */}
                        {more && !openSet.has(k) && (
                          <ul className="mt-1.5 hidden space-y-1.5 print:block">
                            {e.highlights.slice(2).map((h, j) => (
                              <li key={h + j} className="pl-4 -indent-4 font-serif text-[16px] leading-[1.55]">– {h}</li>
                            ))}
                          </ul>
                        )}
                        {e.url && domainHref(e.url) !== '#' && (
                          <div className="mt-3.5 pt-1">
                            <a
                              href={domainHref(e.url)}
                              target="_blank"
                              rel="noreferrer"
                              data-print-plain
                              className="inline-flex items-center gap-1.5 rounded-[3px] border border-ember/60 bg-ember/10 px-2.5 py-1 font-mono text-[11.5px] font-semibold text-ember transition-colors hover:border-ember hover:bg-ember/20"
                            >
                              <span>visit {e.url.replace(/^https?:\/\//, '').replace(/\/$/, '')}</span>
                              <span aria-hidden>↗</span>
                            </a>
                          </div>
                        )}
                        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-4">
                          {e.stack.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                              {e.stack.map((s, j) => <span key={s + j} className={CHIP}>{s}</span>)}
                            </div>
                          ) : (
                            <span />
                          )}
                          {more && (
                            <button onClick={() => toggle(k)} aria-expanded={openSet.has(k)} aria-controls={`${k}-hl`} className="no-print font-mono text-[11px] text-inkfaint transition-colors hover:text-ember">
                              {openSet.has(k) ? 'show less' : `+${e.highlights.length - 2} more`}
                            </button>
                          )}
                        </div>
                      </article>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        </section>

        {/* ── skills: the extensions panel ── */}
        <section id="doc-skills" aria-labelledby="doc-skills-h" className="scroll-mt-[72px] pt-8 pb-20 md:pt-10 md:pb-24">
          <div className={sectionWrap}>
            <SectionHead
              n="03"
              file="skills.toml"
              ext="toml"
              title="Skills"
              src="skills.toml"
              dirty={dirty('skills.toml')}
              id="doc-skills-h"
              sub={<span>installed — {skills.reduce((n, s) => n + s.entries.filter((e) => skillOn(e.name)).length, 0)}</span>}
            />
            <div className="space-y-10">
              {skills.map((sec) => {
                const on = sec.entries.filter((e) => skillOn(e.name))
                if (!on.length) return null
                const key = sec.name.toLowerCase()
                const theme = SKILL_THEMES[key] ?? DEFAULT_SKILL_THEME
                const remainder3 = on.length % 3
                const missing3 = remainder3 === 0 ? 0 : 3 - remainder3
                return (
                  <div key={sec.name}>
                    <p className="mb-3 flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.12em] text-inkfaint">
                      <span className={`h-1.5 w-1.5 rounded-full ${theme.dot}`} aria-hidden />
                      <span>installed — {sec.name.replace(/_/g, ' ')}</span>
                      <span className="text-inkfaint/70">({on.length})</span>
                    </p>
                    <ul className={`grid overflow-hidden rounded-md border ${theme.border} ${theme.topBorder} gap-px bg-line shadow-sm sm:grid-cols-2 xl:grid-cols-3`}>
                      {on.map((e) => (
                        <li
                          key={e.name}
                          className="flex items-start gap-3 bg-abyss p-4 transition-colors hover:bg-chrome"
                        >
                          <span
                            className={`flex h-9 w-9 shrink-0 select-none items-center justify-center rounded-[3px] border ${theme.badgeBorder} ${theme.badgeBg} font-mono text-[11px] font-bold ${theme.badgeText}`}
                            aria-hidden
                          >
                            {e.name.replace(/_/g, '').slice(0, 2)}
                          </span>
                          <span className="min-w-0">
                            <span className="flex flex-wrap items-baseline gap-x-2 font-mono text-[13px] text-ink">
                              {e.name.replace(/_/g, ' ')}
                              <span className="text-[10.5px] text-sage">{e.level.replace(/_/g, ' ')}</span>
                            </span>
                            {e.note && <span className="mt-1 block font-mono text-[11.5px] leading-snug text-inkdim">{e.note}</span>}
                          </span>
                        </li>
                      ))}
                      {missing3 > 0 && Array.from({ length: missing3 }).map((_, idx) => (
                        <li
                          key={`filler-${idx}`}
                          className="hidden items-center justify-center bg-chrome/20 p-4 font-mono text-[11px] text-inkfaint/40 xl:flex"
                          aria-hidden
                        >
                          <span>// + more in terminal</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* ── certificates & awards ── */}
        {hasEducation && (
          <section id="doc-education" aria-labelledby="doc-education-h" className="scroll-mt-[72px] border-y border-line bg-chrome/40 pt-8 pb-20 md:pt-10 md:pb-24">
            <div className={sectionWrap}>
              <SectionHead
                n="04"
                file="certs/"
                ext="pdf"
                title="Education & Certificates"
                src="certs/"
                id="doc-education-h"
                sub={<span>{exp.education.length + exp.certifications.length + exp.coursework.length + exp.awards.length} certificates</span>}
              />

              {/* formal education */}
              {exp.education.length > 0 && (
                <div className="mb-5 grid gap-5">
                  {exp.education.map((e, i) => (
                    <article key={e.institution + i} className="flex flex-col rounded-md border border-line bg-abyss p-6">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="flex items-center gap-2 font-mono text-[11px] text-inkfaint">
                          <GraduationCap size={13} className="text-ember" /> education · {e.period}
                        </p>
                        {e.notes && <span className="font-mono text-[11px] text-inkfaint">{e.notes}</span>}
                      </div>
                      <h3 className="mt-2 font-serif text-[20px] leading-[1.25] text-ink">{e.degree}</h3>
                      <p className="mt-1 font-mono text-[12.5px] text-inkdim">{e.institution}</p>
                    </article>
                  ))}
                </div>
              )}

              {/* 3 certificates in balanced 3-column grid */}
              <div className="grid gap-5 md:grid-cols-3">
                {exp.certifications.map((c, i) => (
                  <article key={c.name + i} className="flex flex-col rounded-md border border-line bg-abyss p-6">
                    <p className="flex items-center gap-2 font-mono text-[11px] text-inkfaint">
                      <BadgeCheck size={13} className="text-sage" /> certificate · {c.date}
                    </p>
                    <h3 className="mt-3 font-serif text-[20px] leading-[1.25] text-ink">{c.name}</h3>
                    {c.issuer && <p className="mt-1 font-mono text-[12px] text-inkdim">{c.issuer}</p>}
                    {c.status && <p className="mt-1 font-mono text-[11.5px] text-inkfaint">{c.status}</p>}
                    <div className="mt-auto flex gap-x-4 pt-4 font-mono text-[12px]">
                      {/* file is workspace-relative — '//evil.com' must not parse as protocol-relative */}
                      {c.file && /^[\w-][\w./-]*$/.test(c.file) && <a href={`/${c.file}`} target="_blank" rel="noreferrer" className={`${LINK} whitespace-nowrap`}>certificate&nbsp;↗</a>}
                      {c.verify && safeHref(c.verify) !== '#' && (
                        <a href={safeHref(c.verify)} target="_blank" rel="noreferrer" className={`${LINK} whitespace-nowrap`}>verify&nbsp;↗</a>
                      )}
                    </div>
                  </article>
                ))}
              </div>

              {/* coursework and awards in balanced 2-column grid */}
              {(exp.coursework.length > 0 || exp.awards.length > 0) && (
                <div className="mt-5 grid gap-5 md:grid-cols-2">
                  {exp.coursework.length > 0 && (
                    <article className="flex flex-col rounded-md border border-line bg-abyss p-6">
                      <p className="flex items-center gap-2 font-mono text-[11px] text-inkfaint">
                        <BookOpen size={13} className="text-ember" /> courses
                      </p>
                      <ul className="mt-3 space-y-3">
                        {exp.coursework.map((c, i) => (
                          <li key={c.name + i}>
                            <span className="block font-serif text-[18px] leading-[1.3] text-ink">{c.name}</span>
                            {c.status && <span className="mt-0.5 block font-mono text-[11.5px] text-inkdim">{c.status}</span>}
                          </li>
                        ))}
                      </ul>
                    </article>
                  )}
                  {exp.awards.length > 0 && (
                    <article className="flex flex-col rounded-md border border-line bg-abyss p-6">
                      <p className="flex items-center gap-2 font-mono text-[11px] text-inkfaint">
                        <Award size={13} className="text-ember" /> awards
                      </p>
                      <ul className="mt-3 space-y-3">
                        {exp.awards.map((a, i) => (
                          <li key={a.what + i}>
                            <span className="block font-serif text-[18px] leading-[1.3] text-ink">{a.what}</span>
                            {a.result && (
                              <div className="mt-0.5 space-y-0.5">
                                {a.result.split('\n').map((line, li) => (
                                  <span key={li} className="block font-mono text-[11.5px] text-inkdim">{line}</span>
                                ))}
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    </article>
                  )}
                </div>
              )}
            </div>
          </section>
        )}

        {/* ── community help ── */}
        {hasCommunity && (
          <section id="doc-community" aria-labelledby="doc-community-h" className="scroll-mt-[72px] pt-8 pb-20 md:pt-10 md:pb-24">
            <div className={sectionWrap}>
              <SectionHead
                n="05"
                file="experience.json"
                ext="json"
                title="Volunteer & Community Service"
                src="experience.json"
                line={lineOf(expSrc, '"community"')}
                dirty={dirty('experience.json')}
                id="doc-community-h"
                sub={<span>{communityHoursTotal.toFixed(2)} total hours logged · {exp.community.length} initiatives</span>}
              />

              {/* initiative overview cards */}
              <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                {exp.community.map((item, i) => {
                  const isGreen = /green team|cleanup/i.test(item.org + item.activity)
                  const isTeach = /chess|academy|tutoring|grading/i.test(item.org + item.activity)
                  const isStem = /stem|assistive/i.test(item.org + item.activity)
                  const isHack = /bcydc|daydream|hack/i.test(item.org + item.activity)
                  const isSchool = /school|lockers/i.test(item.org + item.activity)

                  const Icon = isGreen ? Leaf : isTeach ? GraduationCap : isStem ? FolderGit2 : isHack ? Rocket : isSchool ? Briefcase : HeartHandshake
                  const iconColor = isGreen ? 'text-sage' : isTeach ? 'text-tide' : isStem ? 'text-violet' : isHack ? 'text-ember' : isSchool ? 'text-inkdim' : 'text-ember'
                  const dotColor = isGreen ? 'bg-sage' : isTeach ? 'bg-tide' : isStem ? 'bg-violet' : isHack ? 'bg-ember' : isSchool ? 'bg-inkdim' : 'bg-ember'

                  return (
                    <article key={item.activity + i} className="flex flex-col rounded-md border border-line bg-abyss p-6 shadow-sm transition-colors hover:border-line/80">
                      <p className="flex items-center gap-2 font-mono text-[11px] text-inkfaint">
                        <Icon size={13} className={iconColor} />
                        <span>volunteering</span>
                        <span aria-hidden>·</span>
                        <span className="text-inkdim">{item.hours}</span>
                      </p>
                      <h3 className="mt-3 font-serif text-[21px] leading-[1.25] text-ink">{item.activity}</h3>
                      {item.org && <p className="mt-1 font-mono text-[12px] text-inkdim">{item.org}</p>}
                      {item.highlights && (
                        <p className="mt-4 font-serif text-[15.5px] leading-[1.55] text-inkdim">
                          {item.highlights}
                        </p>
                      )}
                      <div className="mt-auto pt-5">
                        <span className="inline-flex items-center gap-1.5 rounded-[3px] border border-line bg-raised/50 px-2 py-0.5 font-mono text-[11px] text-inkdim">
                          <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} aria-hidden />
                          {item.hours} logged
                        </span>
                      </div>
                    </article>
                  )
                })}
              </div>
            </div>
          </section>
        )}

        {/* social proof — renders only when TESTIMONIAL="name|quote" exists in contact.env */}
        {testimonial && (
          <div className={`${sectionWrap} pt-24`}>
            <blockquote className="mx-auto max-w-[36em] text-center font-serif text-[26px] italic leading-[1.45] text-inkdim">
              “{testimonial.quote}”
              <footer className="mt-3 font-mono text-[12px] not-italic text-inkfaint">— {testimonial.who}</footer>
            </blockquote>
          </div>
        )}

        {/* ── contact: the address big, the env file leaked beside it ── */}
        <section id="doc-contact" aria-labelledby="doc-contact-h" className="scroll-mt-[72px] border-t border-line bg-chrome/40 pt-8 pb-20 md:pt-10 md:pb-24">
          <div className={`${sectionWrap} grid items-start gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]`}>
            <div className="min-w-0">
              <SectionHead n="06" file="contact.env" ext="env" title="Contact" src="contact.env" dirty={dirty('contact.env')} id="doc-contact-h" />
              <div>
                {emailOk && (
                  <a
                    data-print-plain
                    href={`mailto:${emailOk}`}
                    className="block font-serif text-[clamp(24px,3.5vw,40px)] leading-[1.15] tracking-[-0.015em] text-ember underline decoration-ember/60 decoration-[2px] underline-offset-[8px] transition-colors [overflow-wrap:anywhere] hover:text-ember/80"
                  >
                    {emailOk}
                  </a>
                )}
              </div>
              <p className="mt-6 max-w-[30em] font-serif text-[18px] leading-[1.55] text-inkdim">
                open to {availabilityLong(envSrc)}
                {env.RESPONSE_TIME && <> · replies {env.RESPONSE_TIME}</>}
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                {emailOk && (
                  <a href={`mailto:${emailOk}`} className="inline-flex items-center gap-2 rounded-[3px] bg-ember px-4 py-2.5 font-mono text-[12.5px] font-bold text-abyss transition-colors hover:bg-ember/85">
                    <Mail size={14} /> email me
                  </a>
                )}
                {emailOk && <CopyEmailButton email={emailOk} />}
                {resumeHref !== '#' && (
                  <a href={resumeHref} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-[3px] border border-line bg-chrome px-4 py-2.5 font-mono text-[12.5px] text-ink transition-colors hover:border-ember/70">
                    <FileText size={14} /> resume.pdf
                  </a>
                )}
              </div>
            </div>
            <Window title="zsh — cat contact.env" ext="env" bodyClass="p-5">
              <p className="mb-3 font-mono text-[12px] text-ink">
                <span className="text-ember">$</span> cat contact.env
              </p>
              <EnvLines src={envSrc} />
            </Window>
          </div>
        </section>

        <footer className="border-t border-line">
          <div className={`${sectionWrap} flex flex-wrap items-center justify-between gap-x-8 gap-y-3 py-8 pb-14 font-mono text-[11.5px] text-inkfaint`}>
            <span>-- end of readable.html --</span>
            <span className="no-print flex flex-wrap items-center gap-x-4 gap-y-1">
              <button onClick={exit} className={LINK}>open the editor version</button>
              <span className="flex items-center gap-2">
                run:
                {['whoami', 'projects', 'kushal --hire'].map((c) => (
                  <button key={c} onClick={() => tryLive(c)} className={LINK}>{c}</button>
                ))}
              </span>
              <a href="/hire/" className={LINK} title="the pre-compiled static version — no JS, loads on any phone">static version ↗</a>
            </span>
          </div>
        </footer>
      </main>

      {/* the page's own status bar — the IDE's bottom chrome, reporting honestly */}
      <StatusBar errors={expErrors} theme={ideTheme} onExit={exit} />
    </div>
  )
}

/** a project's fold — the full write-up, a click away and always in print */
function WriteUp({ k, blocks, open, onToggle, compact }: { k: string; blocks: MdBlock[]; open: boolean; onToggle: (k: string) => void; compact?: boolean }) {
  const heads = blocks.filter((b): b is Extract<MdBlock, { kind: 'h' }> => b.kind === 'h').map((b) => b.text)
  return (
    <div className={compact ? 'mt-5 border-t border-line pt-4' : 'mt-8 border-t border-line pt-5'}>
      <button
        onClick={() => onToggle(k)}
        aria-expanded={open}
        aria-controls={`wu-${k}`}
        className="no-print group/wu flex w-full items-baseline gap-2 text-left font-mono text-[12px] text-inkdim transition-colors hover:text-ember"
      >
        <ChevronRight size={12} className={`shrink-0 self-center text-inkfaint transition-all group-hover/wu:text-ember group-hover/wu:translate-x-0.5 ${open ? 'rotate-90' : ''}`} />
        <span className="shrink-0 font-medium group-hover/wu:underline underline-offset-2">{open ? 'fold the write-up' : 'read the full write-up'}</span>
        {!open && heads.length > 0 && <span className="min-w-0 truncate text-inkfaint group-hover/wu:text-inkdim">· {heads.join(' · ')}</span>}
      </button>
      <div id={`wu-${k}`} className={`${open ? 'mt-5' : 'hidden'} ${compact ? '' : 'max-w-[44em]'} print:mt-4 print:block`}>
        <Details blocks={blocks} />
      </div>
    </div>
  )
}

/** a quiet clipboard affordance in the IDE's button chrome */
function CopyEmailButton({ email }: { email: string }) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<number>(0)
  useEffect(() => () => clearTimeout(timer.current), [])
  return (
    <button
      onClick={() => {
        void copyToClipboard(email).then((ok) => {
          if (ok) {
            setCopied(true)
            clearTimeout(timer.current)
            timer.current = window.setTimeout(() => setCopied(false), 1400)
          } else {
            store.getState().toast(`clipboard refused — it's ${email}`, 'warn')
          }
        })
      }}
      title={`copy ${email}`}
      className="no-print inline-flex items-center gap-2 rounded-[3px] border border-line bg-chrome px-4 py-2.5 font-mono text-[12.5px] text-ink transition-colors hover:border-ember/70"
    >
      {copied ? <Check size={14} className="text-sage" /> : <Copy size={14} />}
      {copied ? 'copied' : 'copy address'}
    </button>
  )
}
