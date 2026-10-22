import { useEffect } from 'react'
import { useIDE, store, getActiveTab, isPseudoTab } from './state/store'
import { IdeShell } from './ide/IdeShell'
import { ReadableView } from './recruiter/ReadableView'
import { Toasts } from './ide/Toasts'
import { Dialogs } from './ide/Dialogs'
import { ContextMenu } from './ide/ContextMenu'
import { CommandPalette } from './palette/CommandPalette'
import { TourCaption } from './tour/TourCaption'
import { startTour, abortTour } from './tour/runner'
import { exec } from './terminal/commands'
import { getFile } from './vfs/fs'
import { withViewTransition } from './lib/viewTransition'
import { BuildSplash } from './ide/BuildSplash'

const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a']

export default function App() {
  const recruiterMode = useIDE((s) => s.recruiterMode)
  const building = useIDE((s) => s.building)
  const theme = useIDE((s) => s.settings['workbench.colorTheme'])
  const setMobile = useIDE((s) => s.setMobile)

  // boot workspace immediately on launch
  useEffect(() => {
    store.getState().boot()
  }, [])

  // theme → document attr + theme-color meta (boot path; applySettings
  // covers later changes)
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    const meta = document.querySelector('meta[name="theme-color"]')
    const abyss = getComputedStyle(document.documentElement).getPropertyValue('--abyss').trim()
    if (meta && abyss) meta.setAttribute('content', abyss)
  }, [theme])

  // font size → CSS var — apply once at boot; applySettings only runs on change
  const fontSize = useIDE((s) => s.settings['editor.fontSize'])
  useEffect(() => {
    document.documentElement.style.setProperty('--editor-font-size', `${fontSize}px`)
  }, [fontSize])

  // mobile breakpoint
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const apply = () => setMobile(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [setMobile])

  // active tab → shareable hash (real files only)
  useEffect(
    () =>
      useIDE.subscribe((s, prev) => {
        const cur = getActiveTab(s)
        const old = getActiveTab(prev)
        if (cur && cur !== old && !isPseudoTab(cur) && !s.recruiterMode) {
          window.history.replaceState(null, '', `#/file/${encodeURIComponent(cur)}`)
        }
      }),
    [],
  )

  // hash → file/recruiter (back/forward + shared links)
  useEffect(() => {
    const onHash = () => {
      const h = window.location.hash
      if (h === '#/recruiter') {
        const s = store.getState()
        if (s.booted && !s.recruiterMode) {
          // mobile shows the artifact as lite — a shared link must land on it
          // even when this device dismissed lite in an earlier session
          if (s.mobile) useIDE.setState({ liteDismissed: false })
          else s.buildForProduction()
        }
        return
      }
      const m = /^#\/file\/([^:]+)(?::(\d+))?(?::(\d+))?$/.exec(h)
      if (m) {
        let path = ''
        try {
          path = decodeURIComponent(m[1])
        } catch {
          return // malformed escape — same guard boot() applies
        }
        const s = store.getState()
        // dead hashes (e.g. a file that no longer exists) must not materialize
        // an untitled ghost — openFile would "helpfully" create one
        if (s.booted && (getFile(path) || isPseudoTab(path))) {
          // a :line link only makes sense in source mode — boot() made this
          // same choice; preview would stash a stale line request
          s.openFile(path, { line: m[2] ? Number(m[2]) : undefined, col: m[3] ? Number(m[3]) : undefined, mode: m[2] ? 'raw' : undefined })
        }
      }
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  // document.title follows the active tab — the window title is real
  useEffect(
    () =>
      useIDE.subscribe((s, prev) => {
        const cur = getActiveTab(s)
        if (cur !== getActiveTab(prev) && !s.recruiterMode) {
          document.title = cur ? `${cur.split('/').pop()} — kushal` : 'kushal — a portfolio that is a code editor'
        }
      }),
    [],
  )

  // global keybindings + konami
  useEffect(() => {
    let konamiIdx = 0
    const onKey = (e: KeyboardEvent) => {
      const s = store.getState()
      const ctrl = e.ctrlKey || e.metaKey

      if (e.key === 'Escape') {
        // a closer layer already ate this keypress on the way up — dismiss
        // one layer per Escape, never two
        if (e.defaultPrevented) return
        if (s.tour) abortTour()
        else if (s.ctxMenu) s.setCtxMenu(null)
        else if (s.notifsOpen) s.setNotifsOpen(false)
        else if (s.paletteOpen) s.setPaletteOpen(false)
        // dismissing the chooser still counts as "seen" — it only ever asks once
        else if (s.modal) {
          if (s.modal.kind === 'first-visit') s.markSeenIntro()
          else s.setModal(null)
        // esc on the artifact = "close the window" → back to source — checked
        // before guided because the overlay sits on top and must yield first
        } else if (s.recruiterMode || (s.mobile && !s.liteDismissed)) {
          withViewTransition(() => {
            if (s.recruiterMode) s.toggleRecruiter()
            if (s.mobile) s.dismissLite()
          })
        } else if (s.guided !== null) s.endGuide()
        else if (s.zenMode) s.toggleZen()
        // the deck is the lowest dismissable layer — esc backs out of it last.
        // not while typing in an input/terminal though — that esc is theirs
        else if (getActiveTab(s) === 'ui:slides' && !isTypingTarget(e.target)) s.closeTab('ui:slides')
        else return
        // the layer that just unmounted may have held focus — without this it
        // falls to <body> and keyboard users lose their place
        rescueFocus()
        return
      }

      if (ctrl && e.shiftKey && (e.key === 'p' || e.key === 'P')) {
        // Ctrl+Shift+P — the command-mode palette, seeded with '>'
        e.preventDefault()
        s.setPaletteOpen(true, '>')
        return
      }
      if (ctrl && (e.key === 'k' || e.key === 'K' || e.key === 'p' || e.key === 'P')) {
        e.preventDefault()
        s.setPaletteOpen(!s.paletteOpen)
        return
      }
      if (ctrl && e.key === 'Tab') {
        e.preventDefault()
        const pane = s.panes.find((p) => p.id === s.activePane)
        if (pane && pane.tabs.length > 1) {
          const i = pane.active ? pane.tabs.indexOf(pane.active) : -1
          const next = pane.tabs[(i + (e.shiftKey ? -1 : 1) + pane.tabs.length) % pane.tabs.length]
          s.activateTab(next, pane.id)
          s.unlock('tab-dancer')
        }
        return
      }
      if (ctrl && (e.key === 'g' || e.key === 'G')) {
        e.preventDefault()
        s.setPaletteOpen(true, ':')
        return
      }
      // the palette owns the top layer from here down — nothing else may act
      // underneath it (Ctrl+N materializing a tab behind a modal dialog,
      // typed letters feeding konami mid-query)
      if (s.paletteOpen) return
      if (ctrl && e.key === '`') {
        e.preventDefault()
        s.togglePanel()
        rescueFocus()
        return
      }
      if (ctrl && e.key === '\\') {
        e.preventDefault()
        s.splitRight()
        return
      }
      if (ctrl && e.key === ',') {
        e.preventDefault()
        s.openPseudo('ui:settings')
        return
      }
      if (ctrl && e.key === 'n' && !e.shiftKey) {
        e.preventDefault()
        s.newUntitled()
        return
      }
      if (ctrl && (e.key === 's' || e.key === 'S')) {
        e.preventDefault()
        s.toast('portfolio saved — no changes since hire', 'ok')
        return
      }
      if (ctrl && !e.shiftKey && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault()
        s.toggleSidebar()
        rescueFocus()
        return
      }
      if (e.key === 'F5') {
        e.preventDefault()
        if (s.recruiterMode) {
          withViewTransition(() => s.toggleRecruiter())
          rescueFocus()
        } else s.buildForProduction()
        return
      }
      if (e.key === 'F6') {
        e.preventDefault()
        if (s.tour) abortTour()
        else void startTour(exec)
        return
      }
      if (e.key === 'F1') {
        e.preventDefault()
        s.setModal({ kind: 'map' })
        return
      }
      if (ctrl && e.key === 'z' && !e.shiftKey && !isEditableTarget(e)) {
        e.preventDefault()
        s.toggleZen()
        rescueFocus()
        return
      }
      if (ctrl && e.shiftKey) {
        const k = e.key.toLowerCase()
        if (k === 'f') { e.preventDefault(); s.setView('search'); return }
        if (k === 'g') { e.preventDefault(); s.setView('git'); return }
        if (k === 'e') { e.preventDefault(); s.setView('explorer'); return }
        if (k === 'x') { e.preventDefault(); s.setView('extensions'); return }
        if (k === 'a') { e.preventDefault(); s.setView('achievements'); return }
        if (k === 't') { e.preventDefault(); s.reopenClosed(); return }
      }

      // konami — non-editable surfaces only: inside an input the arrows are
      // history nav and 'b','a' are keystrokes, not a cheat code
      if (!isEditableTarget(e)) {
        const want = KONAMI[konamiIdx]
        const key = ctrl ? '' : e.key.length === 1 ? e.key.toLowerCase() : e.key
        if (key === want) {
          konamiIdx++
          if (konamiIdx === KONAMI.length) {
            konamiIdx = 0
            s.applySettings({ 'workbench.colorTheme': 'demogod' })
            s.unlock('konami')
            s.pushTerm([
              { kind: 'sys', text: '[konami] ↑↑↓↓←→←→BA detected' },
              { kind: 'ok', text: 'theme → demogod. respect.' },
            ])
          }
        } else {
          konamiIdx = key === KONAMI[0] ? 1 : 0
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // UI pages (readable portfolio) is default on launch; View source page (IDE) opens on demand
  const showReadable = recruiterMode

  return (
    <>
      {/* skip link — first tab stop for keyboard users; in recruiter mode the
          editor landmark doesn't exist, so it retargets the readable doc */}
      <a
        href={showReadable ? '#readable-main' : '#main-editor'}
        // raw fragment nav would clobber '#/recruiter' with '#readable-main' —
        // jump+focus manually so the shareable URL survives
        onClick={(e) => {
          e.preventDefault()
          const el = document.getElementById(showReadable ? 'readable-main' : 'main-editor')
          el?.scrollIntoView({ block: 'start' })
          el?.focus({ preventScroll: true })
        }}
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-10 focus:z-[90] focus:border focus:border-ember focus:bg-abyss focus:px-3 focus:py-1.5 focus:font-mono focus:text-[12px] focus:text-ember"
      >
        {showReadable ? 'skip to content' : 'skip to editor'}
      </a>
      {showReadable ? <ReadableView /> : <IdeShell />}
      {building && <BuildSplash />}
      <CommandPalette />
      <Dialogs />
      <Toasts />
      <ContextMenu />
      <TourCaption />
      <SrAnnouncer />
    </>
  )
}

/**
 * notify() drops a card in the bell — silent to screen readers. this hidden
 * live region speaks each new notification once (React only mutates the text
 * when the latest item actually changes).
 */
function SrAnnouncer() {
  const notifs = useIDE((s) => s.notifications)
  const latest = notifs[notifs.length - 1]
  return (
    <div className="sr-only" role="status" aria-live="polite">
      {latest ? `${latest.title}. ${latest.body}` : ''}
    </div>
  )
}

/** don't hijack Ctrl+Z inside the editors — CodeMirror owns undo there */
function isEditableTarget(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null
  return !!t?.closest('.cm-editor, input, textarea')
}

/**
 * toggling a region (sidebar/panel/zen/recruiter) or dismissing a popup can
 * unmount the focused element, silently dumping focus on <body>. one frame
 * later, if focus is stranded, park it on the main editor landmark.
 */
function rescueFocus() {
  requestAnimationFrame(() => {
    const active = document.activeElement as HTMLElement | null
    if (!active || active === document.body || active === document.documentElement || !document.contains(active)) {
      document.getElementById('main-editor')?.focus({ preventScroll: true })
    }
  })
}

/** is the event aimed at something that types — inputs, contenteditable,
 *  CodeMirror. those elements own their own Escape/Tab/Arrows */
function isTypingTarget(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable || !!el.closest('.cm-editor'))
}
