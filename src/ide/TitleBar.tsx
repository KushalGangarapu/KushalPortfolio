import { useEffect, useRef, useState } from 'react'
import { PanelLeft, PanelBottom, Command, Rocket } from 'lucide-react'
import { store, useIDE, getActiveTab } from '../state/store'
import { runPortfolioBuild, exec } from '../terminal/commands'
import { startTour } from '../tour/runner'

interface Item {
  label?: string
  shortcut?: string
  action?: () => void
  sep?: boolean
  disabled?: boolean
}

function Menu({ label, items, open, setOpen }: { label: string; items: Item[]; open: boolean; setOpen: (v: string | null) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(open ? null : label)}
        aria-haspopup="menu"
        aria-expanded={open}
        onMouseOver={() => {
          // hover-switch when any menu is already open
          const bar = ref.current?.closest('[data-anyopen]') as HTMLElement | null
          if (bar?.dataset.anyopen === '1' && !open) setOpen(label)
        }}
        className={`rounded-sm px-2 py-0.5 text-[12px] ${open ? 'bg-raised text-ink' : 'text-inkdim hover:bg-raised hover:text-ink'}`}
      >
        {label}
      </button>
      {open && (
        <div role="menu" className="fadein absolute left-0 top-full z-50 min-w-[230px] border border-line bg-chrome py-1 shadow-[0_8px_24px_rgba(0,0,0,0.5)]">
          {items.map((it, i) =>
            it.sep ? (
              <div key={i} className="mx-2 my-1 border-t border-line" />
            ) : (
              <button
                key={i}
                role="menuitem"
                disabled={it.disabled}
                onClick={() => {
                  setOpen(null)
                  it.action?.()
                }}
                className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-[12px] ${
                  it.disabled ? 'text-inkfaint' : 'text-inkdim hover:bg-raised hover:text-ink'
                }`}
              >
                <span>{it.label}</span>
                {it.shortcut && <span className="text-[10px] text-inkfaint">{it.shortcut}</span>}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  )
}

export function TitleBar() {
  const [menu, setMenu] = useState<string | null>(null)
  const mobile = useIDE((s) => s.mobile)
  const sidebarOpen = useIDE((s) => s.sidebarOpen)
  const panelOpen = useIDE((s) => s.panelOpen)
  const isTourist = useIDE((s) => s.settings['kushal.jargon'] === 'tourist')

  useEffect(() => {
    if (!menu) return
    const close = () => setMenu(null)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [menu])

  const s = store.getState
  const menus: { label: string; items: Item[] }[] = [
    {
      label: 'File',
      items: [
        { label: 'Open File…', shortcut: 'Ctrl+K', action: () => s().setPaletteOpen(true) },
        { label: 'New Untitled File', shortcut: 'Ctrl+N', action: () => { s().newUntitled(); s().toast('fresh buffer — say something worth committing', 'ok') } },
        { sep: true },
        { label: 'Save', shortcut: 'Ctrl+S', action: () => s().toast('portfolio saved — no changes since hire', 'ok') },
        { label: 'Save All', action: () => s().toast('everything was already saved. impressively.', 'ok') },
        { sep: true },
        { label: 'Revert All Files', action: () => s().revertAll() },
        { sep: true },
        { label: 'Preferences: Open Settings', shortcut: 'Ctrl+,', action: () => s().openPseudo('ui:settings') },
        { label: 'Release Notes', action: () => s().openFile('CHANGELOG.md') },
        { sep: true },
        { label: 'Close Editor', action: () => { const t = getActiveTab(s()); if (t) s().closeTab(t) } },
        { label: 'Exit', action: () => s().toast('there is no exit. there is only kushal.', 'err') },
      ],
    },
    {
      label: 'Edit',
      items: [
        { label: 'Undo', shortcut: 'Ctrl+Z', action: () => s().toast('the past is immutable here', 'info') },
        { label: 'Redo', shortcut: 'Ctrl+Y', action: () => s().toast('the future is unwritten (like this feature)', 'info') },
        { sep: true },
        { label: 'Cut', shortcut: 'Ctrl+X', action: () => s().toast('nothing was cut. feelings were.', 'info') },
        { label: 'Copy', shortcut: 'Ctrl+C', action: () => s().toast('copied kushal to clipboard (metaphorically)', 'ok') },
        { label: 'Paste', shortcut: 'Ctrl+V', action: () => s().toast('clipboard contains: buffer overflow', 'warn') },
      ],
    },
    {
      label: 'View',
      items: [
        { label: 'Command Palette…', shortcut: 'Ctrl+K', action: () => s().setPaletteOpen(true) },
        { sep: true },
        { label: 'Explorer', shortcut: 'Ctrl+Shift+E', action: () => s().setView('explorer') },
        { label: 'Search', shortcut: 'Ctrl+Shift+F', action: () => s().setView('search') },
        { label: 'Source Control', shortcut: 'Ctrl+Shift+G', action: () => s().setView('git') },
        { label: 'Run and Debug', action: () => s().setView('run') },
        { label: 'Extensions', shortcut: 'Ctrl+Shift+X', action: () => s().setView('extensions') },
        { label: 'Achievements', action: () => s().setView('achievements') },
        { sep: true },
        { label: 'Split Editor Right', shortcut: 'Ctrl+\\', action: () => s().splitRight() },
        { label: 'Toggle Sidebar', shortcut: 'Ctrl+B', action: () => s().toggleSidebar() },
        { label: 'Toggle Panel', shortcut: 'Ctrl+`', action: () => s().togglePanel() },
        { sep: true },
        { label: 'Zen Mode', action: () => s().toggleZen() },
      ],
    },
    {
      label: 'Go',
      items: [
        { label: 'Go to File…', shortcut: 'Ctrl+K', action: () => s().setPaletteOpen(true) },
        { label: 'Go to Symbol: me', action: () => s().openFile('README.md') },
        { sep: true },
        { label: 'Back to Work', action: () => s().toast('you never left', 'info') },
      ],
    },
    {
      label: 'Run',
      items: [
        { label: 'Run Portfolio', shortcut: 'F5', action: () => { runPortfolioBuild(); s().buildForProduction() } },
        { label: 'Debug: sleep schedule', action: () => {
            s().setPanelTab('terminal')
            s().pushTerm([
              { kind: 'input', text: '$ kushal --debug sleep-schedule' },
              { kind: 'err', text: '[debug] attaching to process: sleep' },
              { kind: 'err', text: '[debug] ERROR: process not found (last seen 2024)' },
            ])
          } },
        { sep: true },
        { label: 'Build for Production', shortcut: 'F5', action: () => s().buildForProduction() },
      ],
    },
    {
      label: 'Terminal',
      items: [
        { label: 'New Terminal', shortcut: 'Ctrl+`', action: () => s().setPanelTab('terminal') },
        { label: 'Run Task: make coffee', action: () => {
            s().setPanelTab('terminal')
            s().pushTerm([
              { kind: 'input', text: '$ make coffee' },
              { kind: 'err', text: "make: *** No rule to make target 'coffee'. Required: 'internship'." },
            ])
          } },
      ],
    },
    {
      label: 'Help',
      items: [
        { label: 'Welcome', action: () => s().closeAllTabs() },
        { label: 'What Am I Looking At?', shortcut: 'F1', action: () => s().setModal({ kind: 'map' }) },
        { label: 'The Guided Route', action: () => { s().applySettings({ 'kushal.jargon': 'tourist' }); s().startGuide() } },
        { label: 'Take the Tour', shortcut: 'F6', action: () => startTour(exec) },
        { label: 'Documentation', action: () => s().openFile('man1/kushal.1') },
        { label: 'Release Notes', action: () => s().openFile('CHANGELOG.md') },
        { label: 'Keyboard Shortcuts', action: () => s().setModal({ kind: 'shortcuts' }) },
        { sep: true },
        { label: 'About', action: () => s().setModal({ kind: 'about' }) },
      ],
    },
  ]

  return (
    <header className="flex h-9 shrink-0 select-none items-center gap-2 border-b border-line bg-chrome pr-2" data-anyopen={menu ? 1 : 0} style={{ viewTransitionName: 'titlebar' }}>
      {/* traffic lights */}
      {!mobile && (
        <div className="group flex items-center gap-2 px-3">
          <button
            aria-label="close"
            onClick={() => s().setModal({ kind: 'save-close' })}
            className="h-3 w-3 rounded-full bg-[#e0604f] transition-transform group-hover:scale-110"
          />
          <button
            aria-label="minimize"
            onClick={() => s().toast("can't minimize greatness", 'info')}
            className="h-3 w-3 rounded-full bg-[#e0a54f] transition-transform group-hover:scale-110"
          />
          <button
            aria-label="maximize"
            onClick={() => {
              if (document.fullscreenElement) document.exitFullscreen()
              else document.documentElement.requestFullscreen().catch(() => s().toast('fullscreen refused. the browser said no.', 'warn'))
            }}
            className="h-3 w-3 rounded-full bg-[#7fbf6e] transition-transform group-hover:scale-110"
          />
        </div>
      )}
      {/* menus */}
      <nav
        className="hidden items-center md:flex"
        onKeyDown={(e) => {
          if (!menu) return
          const idx = menus.findIndex((m) => m.label === menu)
          if (e.key === 'Escape') {
            e.preventDefault()
            e.stopPropagation()
            setMenu(null)
          }
          else if (e.key === 'ArrowRight') setMenu(menus[(idx + 1) % menus.length].label)
          else if (e.key === 'ArrowLeft') setMenu(menus[(idx - 1 + menus.length) % menus.length].label)
          else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            // menubar pattern: Down enters the open menu, Up/Down rove items
            e.preventDefault()
            const items = [...e.currentTarget.querySelectorAll<HTMLElement>('[role=menuitem]:not(:disabled)')]
            if (!items.length) return
            const at = items.indexOf(document.activeElement as HTMLElement)
            const next =
              at < 0
                ? items[e.key === 'ArrowDown' ? 0 : items.length - 1]
                : items[(at + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]
            next.focus()
          }
        }}
      >
        {menus.map((m) => (
          <Menu key={m.label} label={m.label} items={m.items} open={menu === m.label} setOpen={setMenu} />
        ))}
      </nav>
      {/* center: quick-open pill — the site's real navigation */}
      <button
        onClick={() => s().setPaletteOpen(true)}
        className="group mx-auto flex h-5.5 min-w-0 w-full max-w-[380px] items-center gap-2 rounded-sm border border-line bg-abyss px-3 font-mono text-[11px] text-inkfaint transition-colors hover:border-inkfaint/50"
        title="command palette (Ctrl+K)"
      >
        <Command size={11} className="shrink-0 text-ember/70" />
        <span className="min-w-0 flex-1 truncate text-left">
          {isTourist ? 'type what you want — "resume", "contact", "hire"' : 'search files, run commands…'}
        </span>
        <kbd className="shrink-0 rounded-sm border border-line bg-raised px-1 text-[9px] text-inkfaint group-hover:border-ember/60 group-hover:text-ember">
          ⌘K
        </kbd>
      </button>
      {/* Code to Main Site — animated CTA button in titlebar */}
      <button
        onClick={() => s().buildForProduction()}
        title="Code to Main Site (readable portfolio) — F5"
        aria-label="Code to Main Site"
        className="animate-main-ui-btn group relative flex h-6 shrink-0 items-center gap-1.5 overflow-hidden rounded-[3px] border border-ember/60 bg-ember/15 px-2.5 font-mono text-[11px] font-bold text-ink shadow-sm transition-all duration-200 hover:scale-105 hover:border-ember hover:bg-ember/30 hover:shadow-md active:scale-95"
      >
        {/* shimmering glossy light beam sweep (animation 1) */}
        <span
          className="animate-main-ui-shimmer pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent"
          aria-hidden="true"
        />
        {/* glowing beacon dot (animation 2) */}
        <span className="relative flex h-1.5 w-1.5 shrink-0" aria-hidden="true">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ember opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-ember" />
        </span>
        <Rocket size={11} className="shrink-0 text-ember transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:rotate-12" />
        <span className="tracking-tight">
          <span className="hidden sm:inline">Code to </span>Main Site
        </span>
        <kbd className="hidden rounded-[2px] border border-ember/40 bg-ember/20 px-1 text-[8.5px] font-bold text-ember lg:inline">
          F5
        </kbd>
      </button>
      {/* right: layout toggles */}
      <div className="flex items-center gap-0.5">
        <button
          onClick={() => s().toggleSidebar()}
          title="toggle sidebar (Ctrl+B)"
          className={`rounded-sm p-1 ${sidebarOpen ? 'text-inkdim' : 'text-inkfaint'} hover:bg-raised hover:text-ink`}
        >
          <PanelLeft size={14} />
        </button>
        <button
          onClick={() => s().togglePanel()}
          title="toggle panel (Ctrl+`)"
          className={`rounded-sm p-1 ${panelOpen ? 'text-inkdim' : 'text-inkfaint'} hover:bg-raised hover:text-ink`}
        >
          <PanelBottom size={14} />
        </button>
      </div>
    </header>
  )
}
