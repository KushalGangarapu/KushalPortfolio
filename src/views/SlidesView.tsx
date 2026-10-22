import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Mail } from 'lucide-react'
import { store, useIDE, contentOf, getActiveTab } from '../state/store'
import { allFiles, getFile } from '../vfs/fs'
import { parseFrontmatter } from '../editor/md-render'
import { parseEnv } from '../recruiter/parse'
import { availabilityLabel } from '../lib/availability'

interface Slide {
  kicker: string
  title: string
  body: string[]
  foot?: string
  /** optional visual — resolved from `img:` frontmatter via the VFS */
  img?: string
}

/** `ui:slides` — the deck build. same content source as everything else. */
export function SlidesView() {
  const fileContents = useIDE((s) => s.fileContents)
  const virtualFiles = useIDE((s) => s.virtualFiles)
  const baselines = useIDE((s) => s.baselines)
  const bag = { fileContents, virtualFiles, baselines }
  const live = (p: string) => {
    const f = getFile(p)
    return f ? contentOf(bag, f) : ''
  }

  const slides = useMemo<Slide[]>(() => {
    const deck: Slide[] = []
    const env = parseEnv(live('contact.env'))

    deck.push({
      kicker: 'kushal · deck build',
      title: 'kushal gangarapu',
      body: [
        'builds software his school runs on — ' + availabilityLabel(),
        '',
        'this deck was compiled from the repo you\'re sitting in.',
        'arrow keys advance. edit a file, the deck recompiles.',
      ],
      foot: 'slide 1 of the deck — everything after this is real content, not bullet-point theater',
    })

    const about = live('README.md')
    const aboutBody = about
      .split('\n')
      .map((l) => l.replace(/^#+\s*/, '').replace(/\*\*|__|\[([^\]]+)\]\([^)]*\)/g, '$1').trim())
      .filter((l) => l && !l.startsWith('![') && !l.startsWith('|') && !l.startsWith('<'))
      .slice(1, 5)
    if (aboutBody.length)
      deck.push({ kicker: 'README.md', title: 'the short version', body: aboutBody, foot: 'source: README.md — the file recruiters actually read first' })

    for (const f of allFiles()) {
      if (!f.path.startsWith('projects/') || !f.path.endsWith('.md')) continue
      const src = contentOf(bag, f)
      const { fm } = parseFrontmatter(src)
      const paras = src
        .replace(/^---[\s\S]*?---\n?/, '')
        .split('\n')
        .map((l) => l.replace(/^#+\s*/, '').replace(/\*\*/g, '').trim())
        .filter((l) => l && !l.startsWith('```') && !l.startsWith('![') && !l.startsWith('|') && !l.startsWith('- ') && !l.startsWith('<'))
      const title = fm?.title ?? f.name.replace(/\.md$/, '')
      const bits = [fm?.stack && `stack: ${fm.stack}`, fm?.year && `${fm.year}`, fm?.status].filter(Boolean) as string[]
      const img = fm?.img ? getFile(fm.img)?.url : undefined
      deck.push({
        kicker: `projects/${f.name}`,
        title,
        body: [paras[0] ?? '', paras[1] ?? '', ...(bits.length ? ['', bits.join(' · ')] : [])],
        foot: `source: ${f.path}`,
        img,
      })
    }

    try {
      const parsed = JSON.parse(live('experience.json') || '{}')
      // normalize per entry — a visitor-edited experience.json can hold any
      // shape; one bad field must degrade one slide, not the whole section
      const str = (v: unknown) => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '')
      const strArr = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])
      const entries = Array.isArray(parsed.experience) ? parsed.experience : []
      for (const e of entries) {
        if (!e || typeof e !== 'object') continue
        const role = str(e.role)
        const org = str(e.org)
        if (!role && !org) continue
        const stack = strArr(e.stack)
        deck.push({
          kicker: 'experience.json',
          title: `${role}${org ? ` — ${org}` : ''}`,
          body: [str(e.period), '', ...strArr(e.highlights).slice(0, 3)],
          foot: stack.length ? `stack: ${stack.join(', ')}` : undefined,
        })
      }
    } catch {
      /* visitor broke the json — deck degrades silently, like a real demo shouldn't */
    }

    deck.push({
      kicker: 'contact.env',
      title: 'hire me',
      body: [
        `email: ${env.EMAIL ?? 'smileykushal@gmail.com'}`,
        `resume: /resume.pdf`,
        `open to: ${env.OPEN_TO ?? availabilityLabel()}`,
        `relocation: ${env.RELOCATION ?? 'yes'}`,
        '',
        'this deck is a view, not a promise — the terminal below still works.',
      ],
      foot: 'end of deck · press esc or close the tab to go back to the real site',
    })
    return deck
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileContents, baselines])

  const [i, setI] = useState(0)
  const at = Math.min(i, slides.length - 1)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // the deck only listens while it's the active tab and nothing modal is up
      const st = store.getState()
      if (st.modal || st.paletteOpen) return
      if (getActiveTab(st) !== 'ui:slides') return
      // an input has the focus — the deck must not eat the user's spaces and
      // arrows while they type in the terminal or a field
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable || t.closest('.cm-editor'))) return
      // Escape is handled by the App's global layer stack — handling it here
      // too would close the deck AND the layer under it on one keypress
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') setI((v) => Math.min(slides.length - 1, v + 1))
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') setI((v) => Math.max(0, v - 1))
      else if (e.key === 'End') setI(slides.length - 1)
      else if (e.key === 'Home') setI(0)
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [slides.length])

  const s = slides[at]
  return (
    <div className="flex h-full min-w-0 flex-col bg-abyss" role="region" aria-live="polite" aria-label={`slide ${at + 1} of ${slides.length}: ${s.title}`}>
      <button
        onClick={() => setI((v) => Math.max(0, v - 1))}
        aria-label="previous slide"
        className="absolute left-2 top-1/2 z-10 -translate-y-1/2 border border-line bg-chrome p-1.5 text-inkfaint transition-colors hover:text-ink disabled:opacity-30"
        disabled={at === 0}
      >
        <ChevronLeft size={16} />
      </button>
      <button
        onClick={() => setI((v) => Math.min(slides.length - 1, v + 1))}
        aria-label="next slide"
        className="absolute right-2 top-1/2 z-10 -translate-y-1/2 border border-line bg-chrome p-1.5 text-inkfaint transition-colors hover:text-ink disabled:opacity-30"
        disabled={at === slides.length - 1}
      >
        <ChevronRight size={16} />
      </button>

      <div
        className="flex min-h-0 flex-1 cursor-pointer flex-col items-center justify-center px-16"
        onClick={() => setI((v) => Math.min(slides.length - 1, v + 1))}
      >
        <div className={`w-full ${s.img ? 'max-w-[860px]' : 'max-w-[640px]'} ${s.img ? 'flex items-center gap-10' : ''}`}>
          <div className={s.img ? 'min-w-0 flex-1' : ''}>
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-inkfaint">{s.kicker}</div>
            <div className="mt-3 font-mono text-[28px] leading-tight text-ink sm:text-[36px]">{s.title}</div>
            <div className="mt-6 space-y-2">
              {s.body.map((l, j) =>
                l === '' ? (
                  <div key={j} className="h-3" />
                ) : (
                  <div key={j} className="font-mono text-[14px] leading-relaxed text-inkdim sm:text-[15px]">
                    {l}
                  </div>
                ),
              )}
            </div>
            {s.foot && <div className="mt-8 border-t border-line pt-3 font-mono text-[10.5px] text-inkfaint">{s.foot}</div>}
          </div>
          {s.img && (
            <img
              src={s.img}
              alt={`${s.title} — project output`}
              className="hidden w-64 shrink-0 border border-line bg-chrome object-contain sm:block"
            />
          )}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-line px-4 py-1.5 font-mono text-[10px] text-inkfaint">
        <span className="flex items-center gap-1.5">
          <Mail size={10} />
          deck build — from live content, like everything else here
        </span>
        <span className="flex items-center gap-2">
          {/* slide-jump — arrowing through ten slides in a live demo is painful */}
          <span role="group" aria-label="jump to slide" className="flex items-center gap-1">
            {slides.map((sl, j) => (
              <button
                key={j}
                onClick={(e) => {
                  e.stopPropagation()
                  setI(j)
                }}
                aria-label={`slide ${j + 1}: ${sl.title}`}
                aria-current={j === at ? 'true' : undefined}
                title={sl.title}
                className={`h-1.5 rounded-full transition-all ${j === at ? 'w-4 bg-ember' : 'w-1.5 bg-line hover:bg-inkdim'}`}
              />
            ))}
          </span>
          {at + 1} / {slides.length}
          <span className="hidden sm:inline">· ← → space · esc to close</span>
        </span>
      </div>
    </div>
  )
}
