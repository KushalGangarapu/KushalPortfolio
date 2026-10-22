import type { ReactNode } from 'react'
import { highlightToHtml } from './lang'
import { CopyBtn } from './CopyBtn'
import { SYMBOL_RE, proseOk } from '../lsp/symbols'
import { HoverSym } from '../lsp/HoverSym'
import { getFile } from '../vfs/fs'
import { store } from '../state/store'

export interface Frontmatter {
  [key: string]: string
}

export function parseFrontmatter(src: string): { fm: Frontmatter | null; body: string } {
  // CRLF-tolerant — a file saved on Windows must not lose its whole header
  const m = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*\r?\n?/.exec(src)
  if (!m) return { fm: null, body: src }
  const fm: Frontmatter = {}
  for (const line of m[1].split('\n')) {
    const i = line.indexOf(':')
    if (i > 0) fm[line.slice(0, i).trim()] = line.slice(i + 1).trim()
  }
  return { fm, body: src.slice(m[0].length).replace(/^\r?\n+/, '') }
}

// ---------- inline ----------

/** split plain text on known symbols, wrapping matches in hoverable spans */
function withSymbols(seg: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = []
  SYMBOL_RE.lastIndex = 0
  let last = 0
  let i = 0
  for (const m of seg.matchAll(SYMBOL_RE)) {
    // prose-safety: 'go' matches, 'Go' does too — but bare lowercase noise words don't
    if (!proseOk(m[0])) continue
    const idx = m.index ?? 0
    if (idx > last) out.push(seg.slice(last, idx))
    out.push(
      <HoverSym key={`${keyBase}-s${i}`} name={m[0]}>
        {m[0]}
      </HoverSym>,
    )
    last = idx + m[0].length
    i++
  }
  if (last < seg.length) out.push(seg.slice(last))
  return out
}

/** what a [text](href) link does depends on the target — external opens, workspace opens, #anchors scroll */
function linkTo(href: string, basePath: string | undefined): { href: string; open?: () => void; raw?: string; dead?: boolean } {
  // scheme allowlist — a visitor-edited [x](javascript:…) must never become a
  // clickable link that executes. dead links render as literal code, not anchors.
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(href.trim())?.[1]?.toLowerCase()
  if (scheme && scheme !== 'http' && scheme !== 'https' && scheme !== 'mailto') return { href, dead: true }
  if (/^(https?:|mailto:)/i.test(href)) return { href, raw: href }
  if (href.startsWith('#')) return { href }
  // split off ?query/#frag before VFS lookup — getFile('x.md#anchor') always misses
  const pathOnly = href.split(/[?#]/)[0]
  // root-absolute ('/renders/x.svg') resolves from workspace root; otherwise relative to the file's dir
  const dir = href.startsWith('/') ? '' : basePath?.includes('/') ? basePath.slice(0, basePath.lastIndexOf('/')) : ''
  const parts = (dir ? `${dir}/${pathOnly}` : pathOnly).split('/')
  const segs: string[] = []
  for (const p of parts) {
    if (p === '.' || p === '') continue
    else if (p === '..') segs.pop()
    else segs.push(p)
  }
  const target = segs.join('/')
  const f = getFile(target)
  if (f) {
    return {
      href: `#/file/${encodeURIComponent(target)}`,
      open: () => {
        // a link clicked inside the recruiter overlay must surface the file —
        // openFile dismisses the overlay itself (recruiter mode and mobile lite)
        store.getState().openFile(target)
      },
      raw: f.url,
    }
  }
  // internal-ish target with no VFS match → dead link, not an external
  // navigation that reloads the app into a 404
  return { href, dead: true }
}

const slug = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '')

const smoothScroll = () => !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

function inline(text: string, keyBase: string, basePath?: string): ReactNode[] {
  const out: ReactNode[] = []
  // order matters: double-backtick, code, bold, italic, image, link
  const re = /(``[\s\S]*?``)|(`[^`\n]+`)|(\*\*[^*]+\*\*)|(\*[^*\n]+\*)|(!\[[^\]]*\]\([^)\s]+\))|(\[[^\]]+\]\([^)\s]+\))/g
  let last = 0
  let i = 0
  const pushText = (seg: string) => {
    out.push(...withSymbols(seg, `${keyBase}-${i}`))
  }
  for (const m of text.matchAll(re)) {
    const idx = m.index ?? 0
    if (idx > last) pushText(text.slice(last, idx))
    const tok = m[0]
    if (tok.startsWith('``')) {
      out.push(<code key={`${keyBase}-${i}`}>{tok.slice(2, -2).replace(/^ | $/g, '')}</code>)
    } else if (tok.startsWith('`')) {
      out.push(<code key={`${keyBase}-${i}`}>{tok.slice(1, -1)}</code>)
    } else if (tok.startsWith('**')) {
      // inner text goes through inline() again — `code` inside bold is real
      out.push(<strong key={`${keyBase}-${i}`}>{inline(tok.slice(2, -2), `${keyBase}-b${i}`, basePath)}</strong>)
    } else if (tok.startsWith('![')) {
      const mm = /!\[([^\]]*)\]\(([^)]+)\)/.exec(tok)!
      const link = linkTo(mm[2], basePath)
      // an image only renders http(s) or VFS-served srcs — `![](mailto:x)`
      // passes the link allowlist but makes a broken <img src="mailto:…">
      if (link.raw && !link.dead && (/^https?:/i.test(link.raw) || link.raw.startsWith('/'))) {
        out.push(<img key={`${keyBase}-${i}`} src={link.raw} alt={mm[1]} className="my-2 max-w-full border border-line" />)
      } else {
        out.push(<code key={`${keyBase}-${i}`}>![{mm[1]}]({mm[2]})</code>)
      }
    } else if (tok.startsWith('[')) {
      const mm = /\[([^\]]+)\]\(([^)]+)\)/.exec(tok)!
      const { href, open, dead } = linkTo(mm[2], basePath)
      // `#frag` scrolls in-doc; `#/file/…` is a real route and must not be swallowed
      const isAnchor = mm[2].startsWith('#') && !mm[2].startsWith('#/')
      if (dead) {
        out.push(<code key={`${keyBase}-${i}`} title="link disabled — dead or unsafe target">[{mm[1]}]({mm[2]})</code>)
      } else
      out.push(
        <a
          key={`${keyBase}-${i}`}
          href={href}
          {...(!open && !isAnchor ? { target: '_blank', rel: 'noreferrer' } : {})}
          onClick={
            isAnchor
              ? (e) => {
                  e.preventDefault()
                  document.getElementById(`md-${slug(mm[2].slice(1))}`)?.scrollIntoView({ behavior: smoothScroll() ? 'smooth' : 'auto', block: 'start' })
                }
              : open
                ? (e) => {
                    e.preventDefault()
                    open()
                  }
                : undefined
          }
        >
          {mm[1]}
        </a>,
      )
    } else {
      out.push(<em key={`${keyBase}-${i}`}>{inline(tok.slice(1, -1), `${keyBase}-e${i}`, basePath)}</em>)
    }
    last = idx + tok.length
    i++
  }
  if (last < text.length) pushText(text.slice(last))
  return out
}

// ---------- blocks ----------

type Block =
  | { t: 'h'; level: number; text: string }
  | { t: 'p'; text: string }
  | { t: 'code'; lang: string; code: string }
  | { t: 'ul' | 'ol'; items: string[] }
  | { t: 'quote'; text: string }
  | { t: 'hr' }
  | { t: 'img'; alt: string; src: string }
  | { t: 'table'; head: string[]; rows: string[][] }

function blocks(src: string): Block[] {
  const lines = src.split('\n')
  const out: Block[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]

    if (!line.trim()) {
      i++
      continue
    }

    // fenced code
    if (line.trimStart().startsWith('```')) {
      const lang = line.trimStart().slice(3).trim()
      const buf: string[] = []
      i++
      while (i < lines.length && !lines[i].trimStart().startsWith('```')) {
        buf.push(lines[i])
        i++
      }
      i++
      out.push({ t: 'code', lang, code: buf.join('\n') })
      continue
    }

    // heading
    const h = /^(#{1,4})\s+(.*)$/.exec(line)
    if (h) {
      out.push({ t: 'h', level: h[1].length, text: h[2] })
      i++
      continue
    }

    // standalone image line
    const im = /^!\[([^\]]*)\]\(([^)\s]+)\)\s*$/.exec(line.trim())
    if (im) {
      out.push({ t: 'img', alt: im[1], src: im[2] })
      i++
      continue
    }

    // hr
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      out.push({ t: 'hr' })
      i++
      continue
    }

    // blockquote
    if (/^\s*>\s?/.test(line)) {
      const buf: string[] = []
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        buf.push(lines[i].replace(/^\s*>\s?/, ''))
        i++
      }
      out.push({ t: 'quote', text: buf.join(' ') })
      continue
    }

    // table
    if (line.trimStart().startsWith('|')) {
      const rows: string[][] = []
      while (i < lines.length && lines[i].trimStart().startsWith('|')) {
        const cells = lines[i].trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim())
        rows.push(cells)
        i++
      }
      const sepIdx = rows.findIndex((r) => r.every((c) => /^:?-{2,}:?$/.test(c)))
      const head = sepIdx > 0 ? rows[0] : []
      const body = sepIdx >= 0 ? rows.slice(sepIdx + 1) : rows
      out.push({ t: 'table', head, rows: body })
      continue
    }

    // list — indented continuation lines join the previous item instead of vanishing
    if (/^\s*([-*+]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\./.test(line)
      const items: string[] = []
      while (i < lines.length) {
        if (/^\s*([-*+]|\d+\.)\s+/.test(lines[i])) {
          items.push(lines[i].replace(/^\s*([-*+]|\d+\.)\s+/, ''))
          i++
        } else if (items.length && /^\s+\S/.test(lines[i]) && !/^(#{1,4})\s|```|>|\|/.test(lines[i].trimStart())) {
          items[items.length - 1] += ' ' + lines[i].trim()
          i++
        } else break
      }
      out.push({ t: ordered ? 'ol' : 'ul', items })
      continue
    }

    // paragraph — merge consecutive plain lines
    const buf: string[] = []
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].trimStart().startsWith('```') &&
      !/^(#{1,4})\s/.test(lines[i]) &&
      !/^\s*>\s?/.test(lines[i]) &&
      !/^\s*([-*+]|\d+\.)\s+/.test(lines[i]) &&
      !/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(lines[i]) &&
      !lines[i].trimStart().startsWith('|') &&
      !/^!\[/.test(lines[i].trim())
    ) {
      buf.push(lines[i].trim())
      i++
    }
    if (buf.length) out.push({ t: 'p', text: buf.join(' ') })
  }
  return out
}

// ---------- render ----------

export function renderMarkdown(src: string, path?: string): ReactNode {
  // heading ids dedupe per document — CHANGELOG's 8× "### added" would
  // otherwise share md-added and anchor to whichever renders first
  const seenIds = new Map<string, number>()
  const idFor = (text: string) => {
    const base = slug(text)
    const n = (seenIds.get(base) ?? 0) + 1
    seenIds.set(base, n)
    return `md-${base}${n > 1 ? `-${n}` : ''}`
  }
  return blocks(src).map((b, i) => {
    switch (b.t) {
      case 'h': {
        const inner = inline(b.text, `h${i}`, path)
        const id = idFor(b.text)
        if (b.level === 1) return <h1 key={i} id={id} className="scroll-mt-8">{inner}</h1>
        if (b.level === 2) return <h2 key={i} id={id} className="scroll-mt-8">{inner}</h2>
        return <h3 key={i} id={id} className="scroll-mt-8">{inner}</h3>
      }
      case 'p':
        return <p key={i}>{inline(b.text, `p${i}`, path)}</p>
      case 'code':
        return (
          <div key={i} className="relative group/code">
            {b.lang && (
              <span className="absolute right-9 top-2 z-10 select-none font-mono text-[10px] tracking-wide text-inkfaint">
                {b.lang}
              </span>
            )}
            <CopyBtn text={b.code} />
            <pre>
              <code dangerouslySetInnerHTML={{ __html: highlightToHtml(b.code, b.lang) }} />
            </pre>
          </div>
        )
      case 'ul':
        return (
          <ul key={i}>
            {b.items.map((it, j) => (
              <li key={j}>{inline(it, `u${i}-${j}`, path)}</li>
            ))}
          </ul>
        )
      case 'ol':
        return (
          <ol key={i}>
            {b.items.map((it, j) => (
              <li key={j}>{inline(it, `o${i}-${j}`, path)}</li>
            ))}
          </ol>
        )
      case 'quote':
        return <blockquote key={i}>{inline(b.text, `q${i}`, path)}</blockquote>
      case 'hr':
        return <hr key={i} />
      case 'img': {
        const { raw } = linkTo(b.src, path)
        if (!raw) return <p key={i}><code>![{b.alt}]({b.src})</code></p>
        return (
          <figure key={i} className="my-4">
            <img src={raw} alt={b.alt} className="max-w-full border border-line" />
            {b.alt && <figcaption className="mt-1 font-mono text-[10.5px] text-inkfaint">{b.alt}</figcaption>}
          </figure>
        )
      }
      case 'table':
        // overflow-x so a wide table doesn't blow out narrow viewports
        return (
          <div key={i} className="overflow-x-auto">
          <table>
            {b.head.length > 0 && (
              <thead>
                <tr>
                  {b.head.map((c, j) => (
                    <th key={j}>{inline(c, `th${i}-${j}`, path)}</th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {b.rows.map((r, j) => (
                <tr key={j}>
                  {r.map((c, k) => (
                    <td key={k}>{inline(c, `td${i}-${j}-${k}`, path)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )
    }
  })
}
