import { useEffect, useRef, useState } from 'react'
import { GitBranch, XCircle, AlertTriangle, RefreshCw, Rocket, Check, Braces, CircleHelp, Trophy, ChevronUp } from 'lucide-react'
import { useIDE, store, getActiveTab, isDirtyPath } from '../state/store'
import { COMMITS } from '../vfs/gitdata'
import { SYMBOLS } from '../lsp/symbols'
import { ACHIEVEMENTS } from '../achievements/defs'
import { availabilityLabel } from '../lib/availability'
import { Notifications } from './Notifications'

/** the quiet billboard — availability + one tip, rotating.
 *  availability derives from OPEN_TO in contact.env (live edits included) */
const TICKER: { text: string; go: () => void }[] = [
  { text: `open to: ${availabilityLabel()}`, go: () => store.getState().openFile('contact.env') },
  { text: '⌘K — search files, run anything', go: () => store.getState().setPaletteOpen(true) },
  { text: "the terminal is real — try 'achievements'", go: () => store.getState().setPanelTab('terminal') },
  { text: 'F5 — the readable page for recruiters', go: () => store.getState().buildForProduction() },
]

const THEMES = [
  { id: 'kushal-midnight', name: 'kushal midnight', desc: 'warm near-black · the default' },
  { id: 'demogod', name: 'demogod', desc: 'neon violet · previously konami-gated' },
  { id: 'kushal-daylight', name: 'kushal daylight', desc: 'paper · for the light-inclined' },
] as const

export function StatusBar() {
  const cursor = useIDE((s) => s.cursor)
  const theme = useIDE((s) => s.settings['workbench.colorTheme'])
  const isTourist = useIDE((s) => s.settings['kushal.jargon'] === 'tourist')
  const activeTab = useIDE(getActiveTab)
  const dirty = useIDE(
    (s) => Object.keys(s.fileContents).filter((p) => isDirtyPath(s, p)).length,
  )
  const visitorCommits = useIDE((s) => s.visitorCommits)
  const problems = useIDE((s) => s.problems)
  const unlocked = useIDE((s) => s.unlocked)
  // live availability — edits to contact.env re-label the ticker without a reload
  const envSrc = useIDE((s) => s.fileContents['contact.env'] ?? s.baselines['contact.env'] ?? '')
  const avail = availabilityLabel(envSrc)
  const [now, setNow] = useState(() => new Date())
  const [tick, setTick] = useState(0)
  const [themeMenu, setThemeMenu] = useState(false)
  const themeWrap = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 10_000)
    // reduced-motion users get the availability signal statically — no rotation
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const rot = still ? undefined : setInterval(() => setTick((n) => n + 1), 8_000)
    return () => {
      clearInterval(t)
      if (rot) clearInterval(rot)
    }
  }, [])

  useEffect(() => {
    if (!themeMenu) return
    const close = (e: MouseEvent) => {
      if (!themeWrap.current?.contains(e.target as Node)) setThemeMenu(false)
    }
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [themeMenu])

  const s = store.getState
  const item = 'flex h-full items-center gap-1 px-2 transition-colors hover:bg-raised cursor-pointer'
  const errors = problems.filter((p) => p.severity === 'error').length
  const warns = problems.filter((p) => p.severity === 'warn').length

  return (
    <footer aria-label="status" className="relative z-30 flex h-6 shrink-0 select-none items-stretch justify-between border-t border-line bg-chrome font-mono text-[10.5px] text-inkdim" style={{ viewTransitionName: 'statusbar' }}>
      <div className="flex items-stretch">
        <button onClick={() => s().ensureView('git')} aria-label={isTourist ? 'career timeline — as git commits' : 'branch — view source control'} className={item} title={isTourist ? 'career timeline — as git commits' : 'branch — view source control'}>
          <GitBranch size={11} className={visitorCommits.length ? 'text-violet' : 'text-ember'} />
          <span>{visitorCommits.length ? 'visitor/you' : 'main'}{dirty ? `*${dirty}` : ''}</span>
        </button>
        <button onClick={() => s().ensureView('git')} aria-label={isTourist ? 'commits — every one is a real career beat' : 'commits ahead of graduation'} className={item} title={isTourist ? 'commits — every one is a real career beat' : 'commits ahead of graduation'}>
          <RefreshCw size={10} className="text-tide" />
          <span>↑{COMMITS.length} ↓0</span>
        </button>
        <button onClick={() => s().setPanelTab('problems')} aria-label={isTourist ? 'issues — the jokes are intentional' : 'problems'} className={`hidden ${item} sm:flex`} title={isTourist ? 'issues — the jokes are intentional' : 'problems'}>
          <XCircle size={11} className={errors ? 'text-rust' : ''} />
          <span>{errors}</span>
          <AlertTriangle size={11} className="text-ember" />
          <span>{warns}</span>
        </button>
        <button
          onClick={() => s().toast(`kushal-ls: indexed ${SYMBOLS.length} symbols across the workspace — all green`, 'ok')}
          className={`hidden ${item} md:flex`}
          title="kushal language server"
          aria-label="kushal language server"
        >
          <Braces size={10} className="text-tide" /> kushal-ls
          <Check size={11} className="text-sage" />
        </button>
        {/* the quiet billboard — availability rotates with tips */}
        <button
          onClick={TICKER[tick % TICKER.length].go}
          className={`hidden ${item} lg:flex`}
          title={isTourist ? 'click me — it does the thing it says' : 'ticker — click to act on it'}
          aria-label={tick % TICKER.length === 0 ? `open to: ${avail}` : TICKER[tick % TICKER.length].text}
        >
          <span className="text-ember">·</span>
          {/* re-key the inner span, not the button — remounting the button drops focus */}
          <span key={tick} className="fadein text-inkfaint">
            {tick % TICKER.length === 0 ? `open to: ${avail}` : TICKER[tick % TICKER.length].text}
          </span>
        </button>
      </div>
      <div className="flex items-stretch">
        {/* scoreboard — progress you can see */}
        <button
          onClick={() => s().ensureView('achievements')}
          className={`hidden ${item} md:flex`}
          title="achievements — the trophy room"
          aria-label={`achievements — ${Object.keys(unlocked).length} of ${ACHIEVEMENTS.length} unlocked`}
        >
          <Trophy size={11} className="text-ember" />
          <span>
            {Object.keys(unlocked).length}/{ACHIEVEMENTS.length}
          </span>
        </button>
        <button
          onClick={() => s().setModal({ kind: 'map' })}
          className={item}
          title="what am i looking at? (F1)"
          aria-label="help — what am i looking at"
        >
          <CircleHelp size={11} />
        </button>
        <button
          onClick={() => s().buildForProduction()}
          title={isTourist ? 'the one-button version: readable page for recruiters (F5)' : 'compile this workspace into a readable page (F5)'}
          aria-label={isTourist ? 'readable page for recruiters' : 'build for production'}
          style={{ viewTransitionName: 'deploy-chip' }}
          className="animate-view-source mx-1 my-1 flex items-center gap-1.5 rounded-[3px] bg-ember px-2.5 font-black text-abyss shadow-md transition-all hover:bg-ember/90 hover:scale-105 active:scale-95"
        >
          <Rocket size={11} />
          <span className="hidden sm:inline">{isTourist ? 'readable page' : 'build for production'}</span>
          <span className="sm:hidden">build</span>
        </button>
        <span className="hidden h-full items-center px-2 sm:flex">
          {activeTab ? `Ln ${cursor.ln}, Col ${cursor.col}` : 'Ln –, Col –'}
        </span>
        <button onClick={() => s().toast('spaces: 2. this is a safe space.', 'info')} aria-label="indentation: spaces, 2" className={`hidden ${item} md:flex`}>
          Spaces: 2
        </button>
        <span className="hidden items-center px-2 lg:flex">UTF-8</span>
        {/* theme picker — the konami code is a shortcut, not the door */}
        <div
          ref={themeWrap}
          className="relative hidden md:flex"
          onKeyDown={(e) => {
            if (e.key === 'Escape' && themeMenu) {
              e.preventDefault()
              e.stopPropagation()
              setThemeMenu(false)
            }
          }}
        >
          <button
            onClick={() => setThemeMenu((v) => !v)}
            className={`${item} gap-1.5`}
            title="color theme — pick one, they're all real"
            aria-label={`color theme — current: ${theme}`}
            aria-expanded={themeMenu}
            aria-haspopup="menu"
          >
            {isTourist ? `theme: ${theme.replace('kushal-', '')}` : theme}
            <ChevronUp size={9} className={`transition-transform ${themeMenu ? 'rotate-180' : ''}`} />
          </button>
          {themeMenu && (
            <div
              role="menu"
              aria-label="color theme"
              className="slideup absolute bottom-full right-0 z-50 mb-1 w-56 border border-line bg-chrome py-1 shadow-[0_-8px_24px_rgba(0,0,0,0.5)]"
            >
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  role="menuitemradio"
                  aria-checked={theme === t.id}
                  onClick={() => {
                    s().applySettings({ 'workbench.colorTheme': t.id })
                    setThemeMenu(false)
                  }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left font-mono text-[11px] hover:bg-raised"
                >
                  <Check size={11} className={theme === t.id ? 'text-sage' : 'opacity-0'} />
                  <span className="min-w-0">
                    <span className="block text-ink">{t.name}</span>
                    <span className="block text-[9px] text-inkfaint">{t.desc}</span>
                  </span>
                </button>
              ))}
              <div className="mx-2 my-1 border-t border-line" />
              <div className="px-3 py-0.5 font-mono text-[9px] text-inkfaint">↑↑↓↓←→←→BA still works, for the record</div>
            </div>
          )}
        </div>
        <button
          onClick={() => s().toast(`the time is ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. somewhere, a recruiter is reading this.`, 'info')}
          className={`hidden ${item} sm:flex tabular-nums`}
          title="the time. yes, clickable."
          aria-label={`the time is ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
        >
          {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </button>
        <Notifications />
      </div>
    </footer>
  )
}
