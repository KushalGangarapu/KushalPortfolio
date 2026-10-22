import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronRight, GitBranch, Blocks, Rocket, Terminal, Bell, FilePlus, RotateCcw, Info, RefreshCw, BookOpen, Palette, Settings, Trophy, ScrollText, Columns2, GitCompare, Clapperboard, Moon, FlaskConical, Clock, Hash, Braces, Command as Command2, AlertTriangle, Compass, Languages, Map, Presentation, Briefcase } from 'lucide-react'
import { useIDE, store, getActiveTab } from '../state/store'
import { allFiles } from '../vfs/fs'
import { SYMBOLS } from '../lsp/symbols'
import { gotoDefinition } from '../lsp/card'
import { fuzzy, fuzzyIdx } from './fuzzy'
import { FileIcon } from '../editor/FileIcon'
import { exec, runPortfolioBuild } from '../terminal/commands'
import { startTour } from '../tour/runner'

interface Item {
  id: string
  label: string
  hint?: string
  icon?: React.ReactNode
  action: () => void
}

/** strip the mode prefix to get the user's actual needle */
function needle(q: string): string {
  const t = q.trimStart()
  return t.startsWith('>') || t.startsWith('@') || t.startsWith(':') ? t.slice(1).trim() : t.trim()
}

/** ember-highlight the fuzzy-matched characters */
function highlight(label: string, q: string): React.ReactNode {
  const idx = fuzzyIdx(q, label)
  if (!q || !idx) return label
  const set = new Set(idx)
  return (
    <>
      {[...label].map((ch, i) => (set.has(i) ? (
        <span key={i} className="text-ember">{ch}</span>
      ) : ch))}
    </>
  )
}

const COMMANDS: Item[] = [
  { id: '>tour', label: 'Take the Tour', hint: 'the IDE drives itself · F6', icon: <Clapperboard size={13} className="text-ember" />, action: () => startTour(exec) },
  { id: '>guide', label: 'Guided Route', hint: 'click-through walk — no IDE knowledge needed', icon: <Compass size={13} className="text-tide" />, action: () => { const s = store.getState(); s.applySettings({ 'kushal.jargon': 'tourist' }); s.startGuide() } },
  { id: '>tourist', label: 'Toggle Tourist Mode', hint: 'plain-English labels everywhere', icon: <Languages size={13} className="text-sage" />, action: () => { const s = store.getState(); const next = s.settings['kushal.jargon'] === 'tourist' ? 'dev' : 'tourist'; s.applySettings({ 'kushal.jargon': next }); s.toast(`labels → ${next === 'tourist' ? 'plain english' : 'dev jargon'}`, 'ok') } },
  { id: '>map', label: 'What Am I Looking At?', hint: 'a labeled map of this page · F1', icon: <Map size={13} className="text-violet" />, action: () => store.getState().setModal({ kind: 'map' }) },
  { id: '>build', label: 'Build for Production', hint: 'compile to readable page', icon: <Rocket size={13} className="text-ember" />, action: () => store.getState().buildForProduction() },
  { id: '>slides', label: 'Present as Slides', hint: 'the portfolio as a deck — from live content', icon: <Presentation size={13} className="text-ember" />, action: () => store.getState().openPseudo('ui:slides') },
  { id: '>hire', label: 'Hire Kushal', hint: 'the whole point', icon: <Bell size={13} className="text-ember" />, action: () => { store.getState().setPanelTab('terminal'); exec('kushal --hire') } },
  { id: '>term', label: 'Toggle Terminal', hint: 'Ctrl+`', icon: <Terminal size={13} className="text-tide" />, action: () => store.getState().setPanelTab('terminal') },
  { id: '>git', label: 'View Git Graph', hint: 'career as commits', icon: <GitBranch size={13} className="text-tide" />, action: () => store.getState().ensureView('git') },
  { id: '>ext', label: 'View Extensions', hint: 'skills marketplace', icon: <Blocks size={13} className="text-tide" />, action: () => store.getState().ensureView('extensions') },
  { id: '>run', label: 'Run Portfolio', hint: 'fake build, real fun', icon: <ChevronRight size={13} className="text-sage" />, action: () => runPortfolioBuild() },
  { id: '>test', label: 'Run Tests', hint: 'npm test — they pass', icon: <FlaskConical size={13} className="text-sage" />, action: () => { store.getState().setPanelTab('terminal'); exec('npm test') } },
  { id: '>zen', label: 'Toggle Zen Mode', hint: 'just the code. esc to leave', icon: <Moon size={13} className="text-violet" />, action: () => store.getState().toggleZen() },
  { id: '>theme', label: 'Cycle Theme', hint: 'midnight → demogod → daylight', icon: <Palette size={13} className="text-violet" />, action: () => { const s = store.getState(); const order = ['kushal-midnight', 'demogod', 'kushal-daylight'] as const; const next = order[(order.indexOf(s.settings['workbench.colorTheme']) + 1) % order.length]; s.applySettings({ 'workbench.colorTheme': next }); s.toast(`theme → ${next}`, 'ok') } },
  { id: '>settings', label: 'Open Settings', hint: 'Ctrl+, — writes to settings.json', icon: <Settings size={13} className="text-inkdim" />, action: () => store.getState().openPseudo('ui:settings') },
  { id: '>achv', label: 'Achievements', hint: 'the scoreboard', icon: <Trophy size={13} className="text-ember" />, action: () => store.getState().ensureView('achievements') },
  { id: '>changelog', label: 'Release Notes', hint: 'changelog for a human', icon: <ScrollText size={13} className="text-tide" />, action: () => store.getState().openFile('CHANGELOG.md') },
  { id: '>split', label: 'Split Editor Right', hint: 'Ctrl+\\', icon: <Columns2 size={13} className="text-tide" />, action: () => store.getState().splitRight() },
  { id: '>diff', label: 'View Working Changes', hint: 'real diffs of your edits', icon: <GitCompare size={13} className="text-ember" />, action: () => { const s = store.getState(); const dirty = Object.keys(s.fileContents).find((p) => !p.startsWith('untitled:')); if (dirty) s.openFile(`diff:${dirty}`); else { s.ensureView('git'); s.toast('working tree clean — edit a file first', 'info') } } },
  { id: '>man', label: 'Read the Manual', hint: 'man kushal', icon: <BookOpen size={13} className="text-tide" />, action: () => store.getState().openFile('man1/kushal.1') },
  { id: '>new', label: 'New Untitled File', hint: 'Ctrl+N — actually works now', icon: <FilePlus size={13} className="text-inkdim" />, action: () => store.getState().newUntitled() },
  { id: '>revert', label: 'Revert All Files', hint: 'undo your edits', icon: <RotateCcw size={13} className="text-inkdim" />, action: () => store.getState().revertAll() },
  { id: '>about', label: 'About This IDE', icon: <Info size={13} className="text-inkdim" />, action: () => store.getState().setModal({ kind: 'about' }) },
  { id: '>revertfile', label: 'Revert Current File', hint: 'undo edits to the active tab', icon: <RotateCcw size={13} className="text-inkdim" />, action: () => { const s = store.getState(); const t = getActiveTab(s); if (t && !t.startsWith('ui:')) { s.revertFile(t); s.toast(`reverted ${t}`, 'ok') } else s.toast('nothing to revert in this tab', 'info') } },
  { id: '>copylink', label: 'Copy Link to Current File', hint: 'shareable #/file/… url', icon: <Hash size={13} className="text-tide" />, action: () => { const s = store.getState(); const t = getActiveTab(s); if (t && !t.startsWith('ui:') && !t.startsWith('commit:')) { void navigator.clipboard?.writeText(`${location.origin}${location.pathname}#/file/${encodeURIComponent(t)}`); s.toast('deep link copied — it opens straight to this file', 'ok') } else s.toast('pseudo-tabs have no link — open a real file', 'info') } },
  { id: '>shortcuts', label: 'Keyboard Shortcuts', hint: 'the full map', icon: <Command2 size={13} className="text-inkdim" />, action: () => store.getState().setModal({ kind: 'shortcuts' }) },
  { id: '>reset', label: 'Factory Reset', hint: 'wipe everything — settings, edits, achievements', icon: <AlertTriangle size={13} className="text-rust" />, action: () => store.getState().setModal({ kind: 'factory-reset' }) },
  { id: '>reload', label: 'Reload Window', hint: 'the classic fix', icon: <RefreshCw size={13} className="text-inkdim" />, action: () => window.location.reload() },
]

/** typed nouns → actions — "resume", "hire", "dark" just work */
const KEYWORDS: Record<string, Item> = {
  resume: { id: 'kw:resume', label: 'resume.pdf', hint: 'the compiled artifact', icon: <ScrollText size={13} className="text-ember" />, action: () => store.getState().openFile('resume.pdf') },
  cv: { id: 'kw:resume', label: 'resume.pdf', hint: 'the compiled artifact', icon: <ScrollText size={13} className="text-ember" />, action: () => store.getState().openFile('resume.pdf') },
  contact: { id: 'kw:contact', label: 'contact.env', hint: 'email + links', icon: <Hash size={13} className="text-tide" />, action: () => store.getState().openFile('contact.env') },
  email: { id: 'kw:contact', label: 'contact.env', hint: 'email + links', icon: <Hash size={13} className="text-tide" />, action: () => store.getState().openFile('contact.env') },
  hire: { id: 'kw:hire', label: 'kushal --hire', hint: 'the ceremony', icon: <Bell size={13} className="text-ember" />, action: () => { store.getState().setPanelTab('terminal'); exec('kushal --hire') } },
  dark: { id: 'kw:dark', label: 'theme: kushal-midnight', hint: 'the dark one', icon: <Moon size={13} className="text-violet" />, action: () => store.getState().applySettings({ 'workbench.colorTheme': 'kushal-midnight' }) },
  light: { id: 'kw:light', label: 'theme: kushal-daylight', hint: 'the light one', icon: <Palette size={13} className="text-ember" />, action: () => store.getState().applySettings({ 'workbench.colorTheme': 'kushal-daylight' }) },
  theme: { id: 'kw:theme', label: 'Cycle Theme', hint: 'midnight → demogod → daylight', icon: <Palette size={13} className="text-violet" />, action: () => COMMANDS.find((c) => c.id === '>theme')?.action() },
  projects: { id: 'kw:proj', label: 'projects/', hint: 'five write-ups', icon: <BookOpen size={13} className="text-tide" />, action: () => store.getState().openFile('projects/wildcat-calendar.md') },
  about: { id: 'kw:about', label: 'README.md', hint: 'who this is', icon: <Info size={13} className="text-tide" />, action: () => store.getState().openFile('README.md') },
  skills: { id: 'kw:skills', label: 'skills.toml', hint: 'the toolkit as config', icon: <Blocks size={13} className="text-sage" />, action: () => store.getState().openFile('skills.toml') },
  // recruiters type the noun they came for — these dead-ended at "no results"
  github: { id: 'kw:github', label: 'github.com/KushalGangarapu', hint: 'opens the real profile ↗', icon: <GitBranch size={13} className="text-tide" />, action: () => window.open('https://github.com/KushalGangarapu', '_blank', 'noreferrer') },
  linkedin: { id: 'kw:linkedin', label: 'linkedin.com/in/kushal-gangarapu', hint: 'opens the real profile ↗', icon: <Briefcase size={13} className="text-tide" />, action: () => window.open('https://linkedin.com/in/kushal-gangarapu', '_blank', 'noreferrer') },
  phone: { id: 'kw:phone', label: 'contact.env', hint: 'the number is in there', icon: <Hash size={13} className="text-tide" />, action: () => store.getState().openFile('contact.env') },
  call: { id: 'kw:call', label: 'contact.env', hint: 'scheduling + phone + email', icon: <Hash size={13} className="text-tide" />, action: () => store.getState().openFile('contact.env') },
  schedule: { id: 'kw:schedule', label: 'contact.env', hint: 'SCHEDULING link lives here', icon: <Hash size={13} className="text-tide" />, action: () => store.getState().openFile('contact.env') },
  interview: { id: 'kw:interview', label: 'contact.env', hint: 'scheduling + phone + email', icon: <Hash size={13} className="text-tide" />, action: () => store.getState().openFile('contact.env') },
  transcript: { id: 'kw:transcript', label: 'experience.json', hint: 'grades, AP scores, awards', icon: <ScrollText size={13} className="text-tide" />, action: () => store.getState().openFile('experience.json') },
  grades: { id: 'kw:grades', label: 'experience.json', hint: 'AP CSA: 5 · AP Calc BC: 4', icon: <ScrollText size={13} className="text-tide" />, action: () => store.getState().openFile('experience.json') },
  gpa: { id: 'kw:gpa', label: 'experience.json', hint: 'AP scores + course grades', icon: <ScrollText size={13} className="text-tide" />, action: () => store.getState().openFile('experience.json') },
  certs: { id: 'kw:certs', label: 'certs/', hint: 'three certificates, verified', icon: <Trophy size={13} className="text-ember" />, action: () => store.getState().openFile('certs/cs50ai-harvard.pdf') },
  certificates: { id: 'kw:certs2', label: 'certs/', hint: 'three certificates, verified', icon: <Trophy size={13} className="text-ember" />, action: () => store.getState().openFile('certs/cs50ai-harvard.pdf') },
  slides: { id: 'kw:slides', label: 'present as slides', hint: 'the deck build', icon: <Presentation size={13} className="text-ember" />, action: () => store.getState().openPseudo('ui:slides') },
  deck: { id: 'kw:deck', label: 'present as slides', hint: 'the deck build', icon: <Presentation size={13} className="text-ember" />, action: () => store.getState().openPseudo('ui:slides') },
  present: { id: 'kw:present', label: 'present as slides', hint: 'the deck build', icon: <Presentation size={13} className="text-ember" />, action: () => store.getState().openPseudo('ui:slides') },
}

export function CommandPalette() {
  const open = useIDE((s) => s.paletteOpen)
  const setOpen = useIDE((s) => s.setPaletteOpen)
  const touristMode = useIDE((s) => s.settings['kushal.jargon']) === 'tourist'
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(0)
  const WINDOW = 14 // rendered options — sel is clamped inside this range
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  // subscribed so an untitled draft created mid-search actually appears in
  // the results — getState() inside the memo alone would serve stale files
  const virtualFiles = useIDE((s) => s.virtualFiles)

  // seed + selection reset — derived state, adjusted during render
  const [wasOpen, setWasOpen] = useState(false)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setQ(store.getState().paletteSeed)
      setSel(0)
    }
  }

  useEffect(() => {
    if (!open) return
    // focus return — whoever had focus before the palette gets it back on close
    const prev = document.activeElement as HTMLElement | null
    const t = setTimeout(() => {
      inputRef.current?.focus()
      inputRef.current?.setSelectionRange(99, 99) // cursor after the seed
    }, 10)
    return () => {
      clearTimeout(t)
      // prev may have unmounted while the palette was up — focus() on a
      // detached node is a silent no-op that strands focus on <body>
      if (prev?.isConnected) prev.focus()
      else document.getElementById('main-editor')?.focus?.()
    }
  }, [open])

  const items = useMemo(() => {
    const s = store.getState()
    const files = [
      ...allFiles().map((f) => ({
        id: `f:${f.path}`,
        label: f.name,
        hint: f.path,
        icon: <FileIcon ext={f.ext} size={12} />,
        action: () => s.openFile(f.path),
      })),
      // untitled drafts are files too
      ...Object.keys(virtualFiles).map((p) => ({
        id: `f:${p}`,
        label: p.slice(9),
        hint: 'untitled draft',
        icon: <FileIcon ext="txt" size={12} />,
        action: () => s.openPseudo(p),
      })),
    ]

    // : — go to line in the active file
    if (q.startsWith(':')) {
      const n = parseInt(q.slice(1), 10)
      const tab = getActiveTab(s)
      if (!tab || Number.isNaN(n)) {
        const hint: Item[] = [
          {
            id: ':hint',
            label: tab ? 'go to line — type a number' : 'go to line — open a file first',
            icon: <Hash size={13} className="text-inkfaint" />,
            action: () => {},
          },
        ]
        return hint
      }
      const jump: Item[] = [
        {
          id: `:${n}`,
          label: `go to line ${n}`,
          hint: tab,
          icon: <Hash size={13} className="text-tide" />,
          action: () => s.openFile(tab, { line: n, mode: 'raw' }),
        },
      ]
      return jump
    }

    // @ — symbol search via the kushal-ls registry
    if (q.startsWith('@')) {
      const needle = q.slice(1).trim()
      const pool: Item[] = SYMBOLS.map((sym) => ({
        id: `@${sym.name}`,
        label: sym.name,
        hint: `${sym.kind} · ${sym.target.file}`,
        icon: <Braces size={13} className="text-violet" />,
        action: () => gotoDefinition(sym),
      }))
      if (!needle) return pool
      return pool
        .map((it) => ({ it, score: fuzzy(needle, it.label) }))
        .filter((x) => x.score >= 0)
        .sort((a, b) => b.score - a.score)
        .map((x) => x.it)
    }

    const cmdMode = q.startsWith('>')
    const needle = cmdMode ? q.slice(1).trim() : q.trim()

    // empty query → recents first, then commands (not the whole filesystem)
    if (!needle) {
      if (cmdMode) return COMMANDS
      const recents = s.openedEver
        .filter((p) => !p.startsWith('untitled:') && files.some((f) => f.id === `f:${p}`))
        .slice(0, 5)
        .map((p) => ({
          id: `r:${p}`,
          label: p.split('/').pop() ?? p,
          hint: `recent · ${p}`,
          icon: <Clock size={12} className="text-inkfaint" />,
          action: () => s.openFile(p),
        }))
      return [...recents, ...files.slice(0, 6), ...COMMANDS.slice(0, 8)]
    }

    const pool = cmdMode ? COMMANDS : [...files, ...COMMANDS]
    const ranked = pool
      .map((it) => ({ it, score: fuzzy(needle, it.label + ' ' + (it.hint ?? '')) }))
      .filter((x) => x.score >= 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.it)

    // plain-english keywords float their target to the top — non-devs type nouns
    const kw = KEYWORDS[needle.toLowerCase()]
    if (kw && !cmdMode) return [kw, ...ranked.filter((r) => r.id !== kw.id)]
    return ranked
  }, [q, virtualFiles])

  // clamp to the RENDERED window — selection must never point at an unmounted option
  const selI = Math.min(sel, Math.max(0, Math.min(items.length, WINDOW) - 1))

  // keep the selection visible while arrowing
  useEffect(() => {
    listRef.current?.querySelector('[data-sel="1"]')?.scrollIntoView({ block: 'nearest' })
  }, [selI])

  if (!open) return null

  const run = (it: Item) => {
    setOpen(false)
    it.action()
  }

  const onKey = (e: React.KeyboardEvent) => {
    const last = Math.min(items.length, WINDOW) - 1
    if (e.key === 'Escape') {
      // stop the event before the document layer sees it — otherwise the
      // same keypress closes the palette here AND dismisses the layer under it
      e.preventDefault()
      e.stopPropagation()
      setOpen(false)
    }
    else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSel((s) => Math.min(last, s + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSel((s) => Math.max(0, s - 1))
    } else if (e.key === 'Enter' && items[selI]) {
      e.preventDefault() // keeps a focused option's native click from double-firing
      run(items[selI])
    } else if (e.key === 'Tab') {
      e.preventDefault()
      setSel((s) => (s + 1) % Math.max(1, last + 1))
    }
  }

  const mode = q.startsWith('>') ? 'commands' : q.startsWith(':') ? 'go to line' : q.startsWith('@') ? 'symbols' : null

  return (
    <div className="fadein fixed inset-0 z-50 flex items-start justify-center bg-black/45 pt-[14vh]" onClick={() => setOpen(false)}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="command palette"
        className="slideup w-[min(560px,92vw)] border border-line bg-chrome shadow-[0_16px_48px_rgba(0,0,0,0.6)]"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKey}
      >
        <div className="flex items-center gap-2 border-b border-line px-3 py-2">
          <ChevronRight size={13} className="shrink-0 text-ember" />
          <input
            ref={inputRef}
            id="palette-input"
            name="palette-input"
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setSel(0)
            }}
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-list"
            aria-activedescendant={items.length ? `po-${items[selI].id}` : undefined}
            aria-label="command palette"
            placeholder="file name — or > commands · : line · @ symbols"
            className="w-full bg-transparent font-mono text-[13px] text-ink outline-none placeholder:text-inkfaint"
            autoCapitalize="off"
            spellCheck={false}
          />
          {mode && <span className="shrink-0 border border-ember/40 bg-ember/10 px-1.5 font-mono text-[9px] text-ember">{mode}</span>}
          <kbd className="shrink-0 border border-line bg-abyss px-1 font-mono text-[9px] text-inkfaint">esc</kbd>
        </div>
        <div ref={listRef} role="listbox" id="palette-list" className="max-h-[46vh] overflow-y-auto py-1">
          {items.length === 0 && (
            <div className="px-3 py-4 font-mono text-[11.5px] text-inkfaint">
              no results. the void checks its pockets.
            </div>
          )}
          {items.slice(0, WINDOW).map((it, i) => (
            <button
              key={it.id}
              id={`po-${it.id}`}
              role="option"
              aria-selected={i === selI}
              data-sel={i === selI ? 1 : 0}
              onClick={() => run(it)}
              onMouseEnter={() => setSel(i)}
              className={`flex w-full items-center gap-2.5 px-3 py-[7px] text-left font-mono text-[12px] transition-colors ${
                i === selI ? 'bg-raised text-ink shadow-[inset_2px_0_0_var(--ember)]' : 'text-inkdim'
              }`}
            >
              {it.icon}
              <span className="truncate">{highlight(it.label, needle(q))}</span>
              {it.hint && <span className="ml-auto truncate pl-4 text-[10px] text-inkfaint">{it.hint}</span>}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 border-t border-line px-3 py-1.5 font-mono text-[9.5px] text-inkfaint">
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span>&gt; commands</span>
          <span>: line</span>
          <span>@ symbol</span>
          <span className="ml-auto">{touristMode ? "just type what you want — 'resume', 'projects', 'hire'" : 'kushal command palette'}</span>
        </div>
      </div>
    </div>
  )
}
