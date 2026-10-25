import { create } from 'zustand'
import { getFile, allFiles, setRevealedPaths } from '../vfs/fs'
import { SECRET_FILES, SECRET_BY_UNLOCK } from '../vfs/secrets'
import { BRANCH_NAMES, LANE_VISITOR, COMMITS } from '../vfs/gitdata'
import { extOf, kindOf } from '../vfs/types'
import type { VFile } from '../vfs/types'
import { EXTENSIONS } from '../vfs/extensions'
import { ACHIEVEMENTS } from '../achievements/defs'
import { DEFAULT_SETTINGS, parseSettingsJson, SETTING_META } from '../settings/model'
import type { Settings } from '../settings/model'
import { loadPersisted, createWriter } from './persist'
import { withViewTransition } from '../lib/viewTransition'

export type { ThemeId } from '../settings/theme-types'

export type SidebarView = 'explorer' | 'search' | 'git' | 'run' | 'extensions' | 'achievements'
const SIDEBAR_VIEWS: ReadonlySet<string> = new Set(['explorer', 'search', 'git', 'run', 'extensions', 'achievements'])
export type PanelTab = 'terminal' | 'problems' | 'output'
export type ViewMode = 'preview' | 'raw'

export interface Pane {
  id: string
  tabs: string[]
  active: string | null
}

export interface TermLine {
  id: number
  // 'red' is stdout that happens to render red (diff deletions, git status
  // entries) — 'err' is real stderr: it sets exit status and stays out of pipes
  kind: 'input' | 'out' | 'err' | 'ok' | 'dim' | 'sys' | 'accent' | 'red'
  text: string
  /** when set, the line renders clickable. 'view:X' / 'ui:X' / 'commit:X' navigate, anything else runs as a command */
  cmd?: string
}

export interface Toast {
  id: number
  msg: string
  kind: 'info' | 'ok' | 'warn' | 'err' | 'achv'
  /** achievement title/desc when kind === 'achv' */
  title?: string
  desc?: string
}

export interface Notification {
  id: number
  icon: 'git' | 'ext' | 'lsp' | 'kushal' | 'achv' | 'settings' | 'warn'
  title: string
  body: string
  time: number
  read: boolean
  /** clicking deep-links: a file path, 'ui:settings', 'diff:…', etc. */
  target?: string
}

export interface Problem {
  id: string
  severity: 'error' | 'warn' | 'info'
  file: string
  line: number
  msg: string
  hint?: string
  fixable?: boolean
}

export type Modal =
  | { kind: 'save-close' }
  | { kind: 'about' }
  | { kind: 'shortcuts' }
  | { kind: 'factory-reset' }
  | { kind: 'first-visit' }
  | { kind: 'map' }
  | null

export interface VisitorCommit {
  hash: string
  msg: string
  time: number
  files: string[]
  previousBaselines?: Record<string, string>
}

export interface CtxMenu {
  x: number
  y: number
  items: { label: string; action: () => void; sep?: boolean; disabled?: boolean; shortcut?: string }[]
}

let lineId = 0
let toastId = 0
let notifId = 0
let untitledN = 0
let paneN = 1
let settingsParseTimer: number | undefined

// diagnostics point at real text, not frozen line numbers — a content edit
// above the needle must not leave a squiggle hanging on the wrong line
const lineOf = (file: string, needle: string): number => {
  const i = (getFile(file)?.original ?? '').split('\n').findIndex((l) => l.includes(needle))
  return i >= 0 ? i + 1 : 1
}

const seedProblems = (): Problem[] => {
  const problems: Problem[] = [
    {
      id: 'work-life',
      severity: 'warn',
      file: 'life.ts',
      line: Number.POSITIVE_INFINITY,
      msg: "'work-life balance' is not defined",
      hint: "did you mean 'deadline'? — kushal-ls",
      fixable: true,
    },
    {
      id: 'todo-rotate',
      severity: 'info',
      file: 'contact.env',
      line: lineOf('contact.env', 'TODO(kushal)'),
      msg: 'TODO(kushal): rotate after That One Incident',
      hint: 'the incident remains unrotated after',
    },
    {
      id: 'rust-learning',
      severity: 'info',
      file: 'skills.toml',
      line: lineOf('skills.toml', 'rust'),
      msg: "rust: level 'learning' — listed because the intent is real",
      hint: "calibrated claims only. this file doesn't inflate — kushal-ls",
    },
  ]
  // the "currently" self-check — if LAST_VERIFIED in contact.env is >90 days
  // stale, the Problems tab says so instead of quietly lying
  const verified = /^LAST_VERIFIED=(\d{4}-\d{2}-\d{2})/m.exec(getFile('contact.env')?.original ?? '')?.[1]
  const days = verified ? Math.floor((Date.now() - new Date(verified).getTime()) / 86_400_000) : 0
  if (days > 90) {
    problems.push({
      id: 'stale-content',
      severity: 'info',
      file: 'contact.env',
      line: 1,
      msg: `content last verified ${days} days ago — "currently" may have moved`,
      hint: 'bump LAST_VERIFIED in contact.env after a quick pass — kushal-ls',
    })
  }
  return problems
}

export function isPseudoTab(p: string): boolean {
  return p.startsWith('ui:') || p.startsWith('diff:') || p.startsWith('untitled:') || p.startsWith('commit:')
}

export function tabTitle(path: string): string {
  if (path === 'ui:settings') return 'Settings'
  if (path === 'ui:slides') return 'deck (slides)'
  if (path.startsWith('ui:ext/')) return `${path.slice(7)} (ext)`
  if (path.startsWith('diff:')) return `${path.slice(5).split('/').pop()} (diff)`
  if (path.startsWith('untitled:')) return path.slice(9)
  if (path.startsWith('commit:')) return `${path.slice(7)} (commit)`
  return path.split('/').pop() ?? path
}

export function tabExt(path: string): string {
  if (path === 'ui:settings') return '⚙'
  if (path === 'ui:slides') return '◫'
  if (path.startsWith('ui:ext/')) return 'toml'
  if (path.startsWith('diff:')) return 'gitignore'
  if (path.startsWith('untitled:')) return 'txt'
  if (path.startsWith('commit:')) return 'gitignore'
  return extOf(path)
}

export interface IDEState {
  booted: boolean
  mobile: boolean
  restoredSession: boolean
  recruiterMode: boolean
  /** brief "compiling" overlay before the readable view lands */
  building: boolean
  /** mobile visitor opted into the full IDE — stops the auto-lite redirect */
  liteDismissed: boolean
  settings: Settings

  activeView: SidebarView
  sidebarOpen: boolean
  sidebarWidth: number
  panelOpen: boolean
  panelTab: PanelTab
  panelHeight: number

  panes: Pane[]
  activePane: string
  viewModes: Record<string, ViewMode>
  fileContents: Record<string, string>
  /** committed content — dirty compares against this, falls back to original */
  baselines: Record<string, string>
  virtualFiles: Record<string, string>
  closedStack: string[]
  /** pending jump-to-position requests: { line, col? } */
  lineRequests: Record<string, { line: number; col?: number }>
  openedEver: string[]
  visitorCommits: VisitorCommit[]
  zenMode: boolean
  /** layout stashed on zen entry, restored on exit */
  zenPrev: { sidebarOpen: boolean; panelOpen: boolean } | null
  mobilePrev: { sidebarOpen: boolean; panelOpen: boolean } | null
  tour: { caption: string } | null

  cursor: { ln: number; col: number }
  cwd: string
  termLines: TermLine[]
  termHistory: string[]
  cmdCount: number
  vimTrapped: boolean

  extensionsEnabled: Record<string, boolean>
  problems: Problem[]
  notifications: Notification[]
  notifsOpen: boolean
  unlocked: Record<string, number>
  /** coachmark ids already shown — each hint fires once, ever */
  hintsSeen: string[]
  /** dismissed the first-visit chooser */
  seenIntro: boolean
  /** guided-route step index; null = not guiding */
  guided: number | null
  /** session-only: hid the "readable version" banner in mobile IDE */
  mobileBannerHidden: boolean

  paletteOpen: boolean
  /** prefilled query when the palette opens (Ctrl+Shift+P seeds '>') */
  paletteSeed: string
  modal: Modal
  ctxMenu: CtxMenu | null
  toasts: Toast[]
  searchSeed: string | null
}

export interface IDEActions {
  boot: () => void
  setMobile: (m: boolean) => void
  toggleRecruiter: () => void
  /** the F5 experience — compile animation, then the readable artifact */
  buildForProduction: () => void
  /** mobile: leave the compiled view and enter the real IDE anyway */
  dismissLite: () => void
  applySettings: (patch: Partial<Settings>, source?: 'ui' | 'file') => void

  setView: (v: SidebarView) => void
  ensureView: (v: SidebarView) => void
  revealInExplorer: (p: string) => void
  /** the file "Reveal in Explorer" last asked for — Explorer consumes it to
      force-open ancestor dirs and scroll the row into view */
  revealPath: string | null
  /** every path a reveal ever targeted — its ancestor dirs stay open until
      the user collapses them (the transient revealPath only lives a frame) */
  revealedDirs: string[]
  toggleSidebar: () => void
  setSidebarWidth: (w: number) => void
  togglePanel: () => void
  setPanelTab: (t: PanelTab) => void
  setPanelHeight: (h: number) => void

  openFile: (path: string, opts?: { line?: number; col?: number; mode?: ViewMode; pane?: string; keepOverlay?: boolean }) => void
  openPseudo: (path: string, opts?: { keepOverlay?: boolean }) => boolean
  // opening anything while the readable overlay is up must surface it —
  // a tab that opens behind an overlay looks like a dead link
  dismissReadable: () => void
  closeTab: (path: string, pane?: string) => void
  closeOtherTabs: (path: string, pane?: string) => void
  closeAllTabs: (pane?: string) => void
  activateTab: (path: string, pane?: string) => void
  setActivePane: (id: string) => void
  moveTab: (pane: string, from: number, to: number) => void
  moveTabToPane: (fromPane: string, idx: number, toPane: string) => void
  splitRight: (path?: string) => void
  reopenClosed: () => void
  setViewMode: (path: string, mode: ViewMode) => void
  newUntitled: () => void
  editFile: (path: string, content: string) => void
  deleteDraft: (path: string) => void
  revertFile: (path: string) => void
  revertAll: () => void
  commitChanges: (msg: string) => void
  toggleZen: () => void
  setTour: (t: { caption: string } | null) => void
  consumeLineRequest: (path: string) => void
  setCursor: (ln: number, col: number) => void

  setCwd: (cwd: string) => void
  pushTerm: (lines: Omit<TermLine, 'id'>[]) => void
  clearTerm: () => void
  pushHistory: (cmd: string) => void
  setVimTrapped: (v: boolean) => void

  toggleExtension: (id: string) => void
  resolveProblem: (id: string) => void
  setProblems: (p: Problem[]) => void
  notify: (n: { icon: Notification['icon']; title: string; body: string; target?: string }) => void
  markNotificationsRead: () => void
  clearNotifications: () => void
  setNotifsOpen: (o: boolean) => void
  unlock: (id: string) => void
  /** true (and records it) the first time a hint id is asked for */
  maybeHint: (id: string) => boolean
  markSeenIntro: () => void
  startGuide: () => void
  /** +1 next / -1 prev — clamps, ends at the edges */
  stepGuide: (dir: 1 | -1) => void
  endGuide: () => void
  hideMobileBanner: () => void

  setPaletteOpen: (o: boolean, seed?: string) => void
  setModal: (m: Modal) => void
  setCtxMenu: (m: CtxMenu | null) => void
  toast: (msg: string, kind?: Toast['kind'], title?: string, desc?: string) => void
  dismissToast: (id: number) => void
  setSearchSeed: (seed: string | null) => void
}

export type Store = IDEState & IDEActions

const restored = loadPersisted()
const r = restored.state

// restored achievements may have already revealed secret files — sync the vfs
// BEFORE pruning, or getFile() reports the secrets nonexistent and the stale-
// path prune below deletes open secret tabs, their edits, and their history
setRevealedPaths(SECRET_FILES.filter((s) => r.unlocked?.[s.unlockId]).map((s) => s.path))

// content migrations delete files (path-tracer.md → wildcat-calendar.md) — a
// returning visitor's saved paths must be pruned or they survive as ghost tabs,
// ghost "dirty" entries, and inflated recents. isPseudoTab covers untitled:/
// ui:/diff:/commit: — those are always valid.
const livePath = (p: unknown): p is string => typeof p === 'string' && (isPseudoTab(p) || !!getFile(p))
if (validPanes(r.panes)) {
  for (const p of r.panes) {
    p.tabs = p.tabs.filter(livePath)
    // active must be a live path AND a member of tabs — a phantom active
    // renders a file with no tab
    if (p.active && (!livePath(p.active) || !p.tabs.includes(p.active))) p.active = p.tabs[0] ?? null
  }
}
if (r.closedStack) r.closedStack = r.closedStack.filter(livePath)
if (r.openedEver) r.openedEver = r.openedEver.filter(livePath)
for (const bag of [r.fileContents, r.baselines, r.viewModes]) {
  if (bag) for (const k of Object.keys(bag)) if (!livePath(k)) delete bag[k]
}

// keep id counters ahead of anything we restored — no duplicate keys, no pane collision
if (r.termLines?.length) lineId = Math.max(...r.termLines.map((l) => l.id)) + 1
if (r.notifications?.length) notifId = Math.max(...r.notifications.map((n) => n.id)) + 1
if (r.panes?.length) {
  for (const p of r.panes) {
    const m = /^p(\d+)$/.exec(p.id)
    if (m) paneN = Math.max(paneN, Number(m[1]))
  }
}
if (r.virtualFiles) {
  for (const k of Object.keys(r.virtualFiles)) {
    const m = /^untitled:Untitled-(\d+)\./.exec(k)
    if (m) untitledN = Math.max(untitledN, Number(m[1]))
  }
}

const paneFor = (panes: Pane[], id?: string) => panes.find((p) => p.id === id) ?? panes[0]

/** whole-array guard: a corrupted `panes` blob must not white-screen the app */
function validPanes(p: unknown): p is Pane[] {
  return (
    Array.isArray(p) &&
    p.length > 0 &&
    p.every(
      (x) =>
        !!x &&
        typeof x === 'object' &&
        typeof (x as Pane).id === 'string' &&
        Array.isArray((x as Pane).tabs) &&
        ((x as Pane).active === null || typeof (x as Pane).active === 'string'),
    )
  )
}

// normalize the pane shape once — a corrupted blob degrades to a fresh pane
// instead of white-screening (validPanes also guards the .some below)
const okPanes: Pane[] = validPanes(r.panes) && r.panes.some((p) => p.tabs.length > 0) ? r.panes : [{ id: 'p1', tabs: ['README.md'], active: 'README.md' }]

export const useIDE = create<Store>()((set, get) => ({
  booted: false,
  mobile: false,
  restoredSession: restored.existed,
  recruiterMode: true,
  building: false,
  liteDismissed: r.liteDismissed ?? true,
  // no saved settings → follow the OS preference; a light-mode user gets daylight
  settings:
    r.settings ??
    (window.matchMedia?.('(prefers-color-scheme: light)').matches
      ? { ...DEFAULT_SETTINGS, 'workbench.colorTheme': 'kushal-daylight' }
      : DEFAULT_SETTINGS),

  activeView: 'explorer',
  sidebarOpen: r.sidebarOpen ?? true,
  sidebarWidth: r.sidebarWidth ?? 260,
  panelOpen: r.panelOpen ?? true,
  panelTab: r.panelTab ?? 'terminal',
  panelHeight: r.panelHeight ?? 220,

  panes: okPanes,
  activePane: r.activePane && okPanes.some((p) => p.id === r.activePane) ? r.activePane : okPanes[0].id,
  viewModes: r.viewModes ?? {},
  fileContents: r.fileContents ?? {},
  baselines: r.baselines ?? {},
  virtualFiles: r.virtualFiles ?? {},
  closedStack: (r.closedStack ?? []).slice(0, 50),
  lineRequests: {},
  openedEver: r.openedEver ?? [],
  visitorCommits: (r.visitorCommits ?? []).slice(0, 50),
  zenMode: false,
  zenPrev: null,
  mobilePrev: null,
  tour: null,

  cursor: { ln: 1, col: 1 },
  cwd: r.cwd ?? '',
  termLines:
    r.termLines?.length
      ? r.termLines.slice(-400)
      : [
          { id: lineId++, kind: 'accent', text: 'kushal@dev — portfolio shell v2027.0-beta' },
          { id: lineId++, kind: 'dim', text: '⚡ you are inside a real portfolio. last login: honestly, who keeps track' },
          { id: lineId++, kind: 'dim', text: '   ✔ repo cloned          → explore the files on the left' },
          { id: lineId++, kind: 'dim', text: '   ✔ services started     → this terminal works' },
          { id: lineId++, kind: 'dim', text: '   ✔ kushal-ls attached   → hover underlined things' },
          { id: lineId++, kind: 'sys', text: `   ${ACHIEVEMENTS.length} achievements hidden. \`achievements\` lists the ones you've found.` },
          { id: lineId++, kind: 'out', text: '' },
          { id: lineId++, kind: 'dim', text: 'type `help` to get started.' },
          { id: lineId++, kind: 'out', text: '' },
        ],
  termHistory: (r.termHistory ?? []).slice(-100),
  cmdCount: r.cmdCount ?? 0,
  vimTrapped: false,

  extensionsEnabled: {
    ...Object.fromEntries(EXTENSIONS.map((e) => [e.id, e.defaultEnabled])),
    ...(r.extensionsEnabled ?? {}),
  },
  problems: r.problems ?? seedProblems(),
  notifications: r.notifications ?? [],
  notifsOpen: false,
  unlocked: r.unlocked ?? {},
  hintsSeen: (r.hintsSeen ?? []).slice(0, 20),
  seenIntro: r.seenIntro ?? false,
  guided: null,
  mobileBannerHidden: false,

  paletteOpen: false,
  paletteSeed: '',
  modal: null,
  ctxMenu: null,
  toasts: [],
  searchSeed: null,

  boot: () => {
    set({ booted: true })
    const s = get()
    const hash = window.location.hash
    // ensure main site page is default while loading; clear any stale recruiter hash
    if (hash === '#/recruiter') {
      window.history.replaceState(null, '', window.location.pathname + window.location.search)
    }
    const m = /^#\/file\/([^:]+)(?::(\d+))?(?::(\d+))?$/.exec(hash)
    if (m) {
      let p = ''
      try {
        p = decodeURIComponent(m[1])
      } catch {
        p = '' // malformed escape — treat as stale
      }
      if (p && (isPseudoTab(p) || getFile(p) || Object.hasOwn(s.virtualFiles, p))) {
        // a :line link only makes sense in source mode — preview ignores it
        // and the request would land as a stale landmine for later
        const line = m[2] ? Number(m[2]) : undefined
        s.openFile(p, { line, col: m[3] ? Number(m[3]) : undefined, mode: line ? 'raw' : undefined })
        // no hash clear — openFile's subscriber already wrote the canonical
        // '#/file/p' over the deep link; clearing it would strand the address
        // bar empty on a link that should stay shareable
      } else if (p) {
        s.toast(`'${p}' isn't in this workspace — link may be stale`, 'warn')
        s.openFile('README.md')
      }
      return
    }
    const hasTabs = s.panes.some((p) => p.tabs.length > 0)
    // ensure README.md is open on main site page if no tabs exist
    if (!hasTabs) s.openFile('README.md', { keepOverlay: true })
    // night owl check
    const h = new Date().getHours()
    if (h >= 23 || h < 5) s.unlock('night-owl')
    if (restored.existed) {
      const dirty = Object.keys(s.fileContents).filter((p) => isDirtyPath(s, p)).length
      s.notify({
        icon: 'kushal',
        title: 'session restored',
        body: dirty ? `welcome back — ${dirty} unsaved change${dirty === 1 ? '' : 's'} still here` : 'welcome back — workspace as you left it',
      })
      // returning visitor → one quiet "what's new" pointing at the changelog.
      // the hint is marked seen inside the timer — consuming it at schedule
      // time would burn the one-shot on a notification that never showed
      window.setTimeout(() => {
        const st = get()
        if (!st.modal && st.maybeHint('changelog-v2027')) {
          st.notify({
            icon: 'kushal',
            title: 'what changed since you left',
            body: "v2027.0-beta — release notes for a human being are in CHANGELOG.md",
            target: 'CHANGELOG.md',
          })
        }
      }, 6_000)
    } else {
      // first-run notices — the archive starts here
      s.notify({
        icon: 'warn',
        title: "'Sleep' has been deprecated",
        body: 'in kushal 2027.0 the sleep module will be removed. migrate to grind().',
      })
      s.notify({
        icon: 'kushal',
        title: 'kushal 2027.0-beta available',
        body: 'changelog: added 1 student-government, removed fear of shipping.',
      })
      // first-ever visit on a real screen: one chooser, then never again.
      // skip if they already arrived at the readable page — they made their choice
      if (!s.mobile && !s.seenIntro) {
        window.setTimeout(() => {
          const st = get()
          if (!st.modal && !st.seenIntro && !st.recruiterMode) st.setModal({ kind: 'first-visit' })
        }, 900)
      }
      // idle nudge — clickable; fires at 18s, before the bounce
      window.setTimeout(() => {
        const st = get()
        if (!st.tour && !st.unlocked['sightseer'] && st.cmdCount === 0 && st.openedEver.length === 0) {
          st.notify({
            icon: 'kushal',
            title: 'psst — take the tour',
            body: 'the IDE gives a guided tour of itself. click this to start.',
            target: 'cmd:tour',
          })
        }
      }, 18_000)
    }
  },

  setMobile: (mobile) =>
    set((s) => {
      // entering mobile hides chrome; going back to desktop restores what was
      // there — otherwise a resize-to-phone would permanently persist closed
      // panels for the next visit. the stash is its own field: overloading
      // zenPrev meant non-zen stashes were never read, and zen-mode's stash
      // was clobbered by every mobile transition
      if (mobile) return { mobile, mobilePrev: { sidebarOpen: s.sidebarOpen, panelOpen: s.panelOpen }, sidebarOpen: false, panelOpen: false }
      return { mobile, sidebarOpen: s.mobilePrev?.sidebarOpen ?? true, panelOpen: s.mobilePrev?.panelOpen ?? true, mobilePrev: null }
    }),
  toggleRecruiter: () => {
    const opening = !get().recruiterMode
    // the artifact is a separate window — transient IDE overlays (palette,
    // ctx menu, bell) don't travel with it. an unanswered first-visit
    // chooser counts as seen: the visitor already picked a lane
    if (opening && get().modal?.kind === 'first-visit') get().markSeenIntro()
    set((s) =>
      s.recruiterMode
        ? { recruiterMode: false }
        : { recruiterMode: true, paletteOpen: false, ctxMenu: null, notifsOpen: false, modal: null },
    )
    if (get().recruiterMode) get().unlock('production-ready')
  },
  buildForProduction: () => {
    if (get().building || get().recruiterMode) return
    set({ building: true })
    window.setTimeout(() => {
      withViewTransition(() => {
        set({ building: false })
        // toggle inverts — a build that fires while recruiter mode is already
        // open (tour step, racing click) would CLOSE the page it just built
        if (!get().recruiterMode) get().toggleRecruiter()
      })
    }, 1300)
  },
  dismissLite: () => set({ liteDismissed: true, recruiterMode: false }),
  dismissReadable: () => {
    const s = get()
    // both flags, not else-if — recruiterMode + mobile-lite can coexist
    // (desktop F5, then resize below 768px) and lite would survive a dismiss
    if (s.recruiterMode) s.toggleRecruiter()
    if (s.mobile && !s.liteDismissed) s.dismissLite()
  },

  applySettings: (patch, source = 'ui') => {
    if (patch['kushal.telemetry'] === true) {
      get().toast('telemetry stays off. that was a promise, not a preference.', 'warn')
    }
    // sanitize against SETTING_META — an unchecked patch (js repl, stale
    // storage, a cleared number input) can set fontSize 0 or a bogus theme
    const clean: Partial<Settings> = {}
    for (const meta of SETTING_META) {
      const v = patch[meta.key]
      if (v === undefined) continue
      if (meta.kind === 'bool' && typeof v === 'boolean') (clean as Record<string, unknown>)[meta.key] = v
      else if (meta.kind === 'number' && typeof v === 'number')
        (clean as Record<string, unknown>)[meta.key] = Math.max(meta.min ?? 0, Math.min(meta.max ?? 99, v))
      else if (meta.kind === 'enum' && typeof v === 'string' && meta.options?.includes(v))
        (clean as Record<string, unknown>)[meta.key] = v
    }
    const next = { ...get().settings, ...clean, 'kushal.telemetry': false }
    set({ settings: next })
    if (patch['kushal.jargon'] === 'tourist') get().unlock('tourist')
    document.documentElement.dataset.theme = next['workbench.colorTheme']
    // theme-color meta follows the live theme — mobile chrome + tab previews
    // shouldn't keep painting the midnight bar over a daylight page
    const meta = document.querySelector('meta[name="theme-color"]')
    const abyss = getComputedStyle(document.documentElement).getPropertyValue('--abyss').trim()
    if (meta && abyss) meta.setAttribute('content', abyss)
    document.documentElement.style.setProperty('--editor-font-size', `${next['editor.fontSize']}px`)
    if (source !== 'file') {
      // write through to settings.json — but patch only the changed keys.
      // The parser tolerates comments and unknown keys; a wholesale regen
      // would wipe a visitor's annotations every time they toggle a setting.
      const cur = get().fileContents['settings.json']
      // committed settings edits live in baselines, not fileContents — skipping
      // the baseline here dropped a visitor's committed keys the next time any
      // setting toggled
      const base = cur ?? get().baselines['settings.json'] ?? getFile('settings.json')?.original ?? ''
      const rendered = patchSettingsJson(base, { ...clean, 'kushal.telemetry': false })
      if (base !== rendered) {
        suppressSettingsParse = true
        get().editFile('settings.json', rendered)
      }
    }
  },

  setView: (v) => {
    // forged view:* targets ride in through persisted notifications/termLines —
    // an unknown view renders META[v] as undefined and crashes the sidebar
    if (!SIDEBAR_VIEWS.has(v)) return
    const s = get()
    s.dismissReadable()
    const opening = !(s.activeView === v && s.sidebarOpen)
    if (opening) set({ activeView: v, sidebarOpen: true })
    else set({ sidebarOpen: false })
    if (v === 'git' && opening) s.unlock('historian')
    if (v !== 'explorer' && s.maybeHint('activity')) {
      s.toast('the left rail switches sections — files, career, skills, trophies', 'info')
    }
  },
  // unlike setView this FORCES the named view open — "go to X" is navigation,
  // not a toggle; call sites that jump somewhere must never close the panel
  // they claim to open
  ensureView: (v) => {
    if (!SIDEBAR_VIEWS.has(v)) return
    const s = get()
    s.dismissReadable()
    set({ activeView: v, sidebarOpen: true })
    if (v === 'git') s.unlock('historian')
    if (v !== 'explorer' && s.maybeHint('activity')) {
      s.toast('the left rail switches sections — files, career, skills, trophies', 'info')
    }
  },
  // unlike setView this FORCES the explorer open — reveal is a command, not a toggle
  revealInExplorer: (p) => set({ activeView: 'explorer', sidebarOpen: true, revealPath: p }),
  revealPath: null,
  revealedDirs: [],
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarWidth: (w) => set({ sidebarWidth: Math.max(180, Math.min(420, Math.round(w))) }),
  // Ctrl+` semantics: closed → open terminal; open-on-other-tab → focus terminal; open-on-terminal → close
  togglePanel: () =>
    set((s) =>
      !s.panelOpen
        ? { panelOpen: true, panelTab: 'terminal' }
        : s.panelTab !== 'terminal'
          ? { panelTab: 'terminal' }
          : { panelOpen: false },
    ),
  setPanelTab: (panelTab) => set({ panelTab, panelOpen: true }),
  setPanelHeight: (panelHeight) => set({ panelHeight: Math.max(120, Math.min(panelHeight, 480)) }),

  openFile: (path, opts) => {
    const s = get()
    // pseudo-tabs — openPseudo validates first, then dismisses the overlay
    if (isPseudoTab(path)) {
      s.openPseudo(path, { keepOverlay: opts?.keepOverlay })
      return
    }
    // canonicalize before anything else — '#/file/./x' or 'a/../x' would
    // otherwise spawn a second tab for the same file with a divergent overlay
    path = getFile(path)?.path ?? path
    if (!getFile(path) && !s.virtualFiles[path]) {
      // not found → materialize an untitled buffer with that name
      const name = path.split('/').pop() || 'untitled'
      const key = `untitled:${name}`
      if (!s.virtualFiles[key]) {
        set((st) => ({ virtualFiles: { ...st.virtualFiles, [key]: '' } }))
      }
      s.toast(`'${path}' wasn't in the workspace, so it exists now. that's the energy here.`, 'info')
      s.openPseudo(key, { keepOverlay: opts?.keepOverlay })
      return
    }
    if (!opts?.keepOverlay) s.dismissReadable()
    set((st) => {
      const pane = paneFor(st.panes, opts?.pane ?? st.activePane)
      const tabs = pane.tabs.includes(path) ? pane.tabs : [...pane.tabs, path]
      const panes = st.panes.map((p) => (p.id === pane.id ? { ...p, tabs, active: path } : p))
      const viewModes = { ...st.viewModes }
      if (opts?.mode) viewModes[path] = opts.mode
      else if (!viewModes[path]) viewModes[path] = 'preview'
      const lineRequests =
        opts?.line != null ? { ...st.lineRequests, [path]: { line: opts.line, col: opts.col } } : st.lineRequests
      // MRU — openedEver doubles as the Welcome screen's recents list
      const openedEver = [path, ...st.openedEver.filter((p) => p !== path)].slice(0, 200)
      return { panes, activePane: pane.id, viewModes, lineRequests, openedEver }
    })
    if (path === 'README.md') get().unlock('readme-first')
    if (path === 'man1/kushal.1') get().unlock('man-page')
    // visited every real file → cartographer
    if (get().openedEver.filter(livePath).length >= allFiles().filter((f) => f.kind !== 'pdf').length) {
      get().unlock('cartographer')
    }
    if (get().openedEver.length === 1 && get().maybeHint('tabs')) {
      get().toast('tabs work like browser tabs — click to switch, × to close', 'info')
    }
    if (get().mobile) set({ sidebarOpen: false })
  },

  openPseudo: (path, opts) => {
    const s0 = get()
    // validate pseudo-targets — `open ui:garbage` or `commit:` with no hash
    // would otherwise materialize a dead tab that claims to be a real view.
    // dismiss AFTER validation: a rejected command shouldn't kill the overlay
    if (path.startsWith('ui:')) {
      const ok = path === 'ui:settings' || path === 'ui:slides' ||
        (path.startsWith('ui:ext/') && EXTENSIONS.some((e) => e.id === path.slice(7)))
      if (!ok) {
        s0.toast(`'${path}' isn't a view — try ui:settings or ui:slides`, 'warn')
        return false
      }
    } else if (path.startsWith('commit:')) {
      const hash = path.slice(7)
      const found = COMMITS.some((c) => c.hash === hash) || s0.visitorCommits.some((c) => c.hash === hash)
      if (!found) {
        s0.toast(`no commit '${hash || '(empty)'}' — try git log for real hashes`, 'warn')
        return false
      }
    } else if (path.startsWith('diff:')) {
      const target = path.slice(5)
      if (!target || !(getFile(target) || Object.hasOwn(s0.virtualFiles, target))) {
        s0.toast(`nothing to diff at '${target || '(empty)'}'`, 'warn')
        return false
      }
    } else if (path.startsWith('untitled:') && !Object.hasOwn(s0.virtualFiles, path)) {
      s0.toast(`'${path}' doesn't exist — touch it first`, 'warn')
      return false
    }
    if (!opts?.keepOverlay) s0.dismissReadable()
    set((st) => {
      const pane = paneFor(st.panes, st.activePane)
      const tabs = pane.tabs.includes(path) ? pane.tabs : [...pane.tabs, path]
      const panes = st.panes.map((p) => (p.id === pane.id ? { ...p, tabs, active: path } : p))
      return { panes, activePane: pane.id }
    })
    if (path.startsWith('diff:')) get().unlock('diff-detective')
    if (path === 'ui:slides') get().unlock('keynote')
    if (get().mobile) set({ sidebarOpen: false })
    return true
  },

  closeTab: (path, paneId) => {
    set((s) => {
      const pane = paneFor(s.panes, paneId ?? s.panes.find((p) => p.tabs.includes(path))?.id)
      const i = pane.tabs.indexOf(path)
      if (i < 0) return s
      const tabs = pane.tabs.filter((t) => t !== path)
      const closedStack = [...s.closedStack.filter((p) => p !== path), path]
      const active = pane.active === path ? tabs[Math.min(i, tabs.length - 1)] ?? null : pane.active
      let panes = s.panes.map((p) => (p.id === pane.id ? { ...p, tabs, active } : p))
      // collapse empty side panes (keep at least one)
      if (panes.length > 1 && !tabs.length) {
        panes = panes.filter((p) => p.id !== pane.id)
      }
      const activePane = panes.some((p) => p.id === s.activePane) ? s.activePane : panes[0].id
      const { [path]: _dropReq, ...lineRequests } = s.lineRequests
      return { panes, closedStack, activePane, lineRequests }
    })
  },

  closeOtherTabs: (path, paneId) =>
    set((s) => {
      const pane = paneFor(s.panes, paneId)
      const closed = pane.tabs.filter((t) => t !== path)
      return {
        panes: s.panes.map((p) => (p.id === pane.id ? { ...p, tabs: [path], active: path } : p)),
        closedStack: [...s.closedStack.filter((p) => !closed.includes(p)), ...closed],
      }
    }),

  closeAllTabs: (paneId) =>
    set((s) => {
      // no paneId means "close everything" — clear every pane, collapse to one
      if (paneId === undefined) {
        const closed = s.panes.flatMap((p) => p.tabs)
        const stack = [...s.closedStack.filter((p) => !closed.includes(p)), ...closed]
        return {
          panes: [{ ...s.panes[0], tabs: [], active: null }],
          activePane: s.panes[0].id,
          closedStack: stack,
        }
      }
      const pane = paneFor(s.panes, paneId)
      let panes = s.panes.map((p) => (p.id === pane.id ? { ...p, tabs: [], active: null } : p))
      if (panes.length > 1 && panes.some((p) => p.id === pane.id && !p.tabs.length)) {
        panes = panes.filter((p) => p.id !== pane.id || p.tabs.length > 0)
      }
      const activePane = panes.some((p) => p.id === s.activePane) ? s.activePane : panes[0].id
      const stack = [...s.closedStack.filter((p) => !pane.tabs.includes(p)), ...pane.tabs]
      return { panes, closedStack: stack, activePane }
    }),

  activateTab: (path, paneId) =>
    set((s) => {
      const pane = paneFor(s.panes, paneId ?? s.panes.find((p) => p.tabs.includes(path))?.id)
      // refuse to point active at a tab that isn't a member — a phantom
      // active renders a file with no tab
      if (!pane?.tabs.includes(path)) return s
      return { panes: s.panes.map((p) => (p.id === pane.id ? { ...p, active: path } : p)), activePane: pane.id }
    }),

  setActivePane: (activePane) => set({ activePane }),

  moveTab: (paneId, from, to) =>
    set((s) => {
      const pane = paneFor(s.panes, paneId)
      const tabs = [...pane.tabs]
      const [x] = tabs.splice(from, 1)
      // a stale drag index yields undefined — inserting it makes a hole that
      // crashes tabTitle() on the next render
      if (x === undefined) return s
      tabs.splice(to, 0, x)
      return { panes: s.panes.map((p) => (p.id === pane.id ? { ...p, tabs } : p)) }
    }),

  moveTabToPane: (fromPaneId, idx, toPaneId) =>
    set((s) => {
      const from = s.panes.find((p) => p.id === fromPaneId)
      const to = s.panes.find((p) => p.id === toPaneId)
      if (!from || !to || from.id === to.id) return s
      const tab = from.tabs[idx]
      if (!tab) return s
      const fromTabs = from.tabs.filter((t) => t !== tab)
      const fromActive = from.active === tab ? (fromTabs[Math.min(idx, fromTabs.length - 1)] ?? null) : from.active
      const toTabs = to.tabs.includes(tab) ? to.tabs : [...to.tabs, tab]
      return {
        panes: s.panes
          .map((p) => (p.id === from.id ? { ...p, tabs: fromTabs, active: fromActive } : p.id === to.id ? { ...p, tabs: toTabs, active: tab } : p))
          .filter((p) => p.tabs.length > 0 || s.panes.length === 1),
        activePane: to.id,
      }
    }),

  splitRight: (path) => {
    const s = get()
    if (s.panes.length >= 2) {
      // already split — bounce the tab to the other group
      const moving = path ?? paneFor(s.panes, s.activePane).active
      if (!moving) return
      const from = s.panes.find((p) => p.tabs.includes(moving))
      const to = s.panes.find((p) => p.id !== from?.id)
      if (from && to) s.moveTabToPane(from.id, from.tabs.indexOf(moving), to.id)
      return
    }
    const id = `p${++paneN}`
    const moving = path ?? paneFor(s.panes, s.activePane).active
    set((st) => ({ panes: [...st.panes, { id, tabs: [], active: null }] }))
    if (moving) {
      const home = get().panes.find((p) => p.tabs.includes(moving))
      // not open yet — open it straight into the new pane instead of
      // leaving an empty split with the file dropped on the floor
      if (home) get().moveTabToPane(home.id, home.tabs.indexOf(moving), id)
      else get().openFile(moving, { pane: id })
    } else {
      set({ activePane: id })
    }
    s.unlock('split-brain')
  },

  reopenClosed: () => {
    let stack = [...get().closedStack]
    while (stack.length > 0) {
      const last = stack.pop()!
      if (last.startsWith('untitled:') && !Object.hasOwn(get().virtualFiles, last)) {
        continue
      }
      set({ closedStack: stack })
      get().openFile(last)
      return
    }
    set({ closedStack: [] })
  },

  setViewMode: (path, mode) => set((s) => ({ viewModes: { ...s.viewModes, [path]: mode } })),

  newUntitled: () => {
    const key = `untitled:Untitled-${++untitledN}.txt`
    set((s) => ({ virtualFiles: { ...s.virtualFiles, [key]: '' } }))
    get().openPseudo(key)
  },

  editFile: (path, content) => {
    set((s) => {
      const fileContents = { ...s.fileContents }
      // content equal to baseline isn't a change — dirty accounting stays exact
      const baseline = s.baselines[path] ?? (path.startsWith('untitled:') ? '' : getFile(path)?.original)
      if (baseline !== undefined && content === baseline) delete fileContents[path]
      else fileContents[path] = content
      return { fileContents }
    })
    if (content !== (get().baselines[path] ?? getFile(path)?.original ?? '')) {
      get().unlock('editor')
      if (get().maybeHint('edit')) {
        get().toast("you just edited the site — it's a sandbox. git status shows your change.", 'info')
      }
    }
    // settings.json write-back: parse → apply or surface a real problem
    if (path === 'settings.json') {
      clearTimeout(settingsParseTimer)
      if (!suppressSettingsParse) {
        // the timer re-reads state at fire time — a revert between keystroke
        // and fire must not re-apply the dead content it raced past
        settingsParseTimer = window.setTimeout(() => {
          const s = get()
          const fresh = s.fileContents['settings.json']
          const base = fresh ?? s.baselines['settings.json'] ?? getFile('settings.json')?.original ?? ''
          const res = parseSettingsJson(base)
          if (res.ok) {
            s.applySettings(res.patch, 'file')
            s.setProblems(s.problems.filter((p) => p.file !== 'settings.json'))
          } else {
            s.setProblems([
              ...s.problems.filter((p) => p.file !== 'settings.json'),
              { id: 'settings-parse', severity: 'error', file: 'settings.json', line: res.line, msg: res.error },
            ])
          }
        }, 500)
      }
    }
    suppressSettingsParse = false
  },

  deleteDraft: (path) => {
    set((s) => {
      const fileContents = { ...s.fileContents }
      const virtualFiles = { ...s.virtualFiles }
      const baselines = { ...s.baselines }
      const closedStack = s.closedStack.filter((p) => p !== path)
      delete fileContents[path]
      delete virtualFiles[path]
      delete baselines[path]
      return { fileContents, virtualFiles, baselines, closedStack }
    })
    get().closeTab(path)
  },

  revertFile: (path) => {
    if (path === 'settings.json') clearTimeout(settingsParseTimer)
    let deletedDraft = false
    set((s) => {
      const fileContents = { ...s.fileContents }
      delete fileContents[path]
      if (path.startsWith('untitled:')) {
        // a draft with a baseline was committed once — revert restores that
        // committed state like a real checkout, it doesn't delete the file
        if (Object.hasOwn(s.baselines, path)) {
          fileContents[path] = s.baselines[path]
          const baselines = { ...s.baselines }
          delete baselines[path]
          return { fileContents, baselines }
        }
        // reverting a never-committed draft deletes it — drop the baseline too
        // or the dead content keeps answering contentOf()/search lookups forever
        const virtualFiles = { ...s.virtualFiles }
        const baselines = { ...s.baselines }
        delete virtualFiles[path]
        delete baselines[path]
        deletedDraft = true
        return { fileContents, virtualFiles, baselines }
      }
      return { fileContents }
    })
    if (deletedDraft) get().closeTab(path)
    if (path === 'settings.json') {
      reapplyBaselineSettings(get())
      // a stale parse error shouldn't survive the file that caused it
      set((s) => ({ problems: s.problems.filter((p) => p.file !== 'settings.json') }))
    }
  },

  revertAll: () => {
    const s = get()
    // git semantics: `git checkout .` reverts tracked edits but leaves
    // untracked files alone — a visitor's untitled drafts survive
    const tracked = Object.keys(s.fileContents).filter((p) => !p.startsWith('untitled:'))
    const n = tracked.length
    const settingsWereDirty = isDirtyPath(s, 'settings.json')
    if (settingsWereDirty) clearTimeout(settingsParseTimer)
    set((st) => ({
      fileContents: Object.fromEntries(Object.entries(st.fileContents).filter(([p]) => p.startsWith('untitled:'))),
    }))
    if (settingsWereDirty) reapplyBaselineSettings(get())
    get().toast(`reverted ${n} change${n === 1 ? '' : 's'} — drafts untouched, git style`, 'ok')
    if (n > 0) get().unlock('time-traveler')
  },

  commitChanges: (msg) => {
    const s = get()
    const dirty = Object.keys(s.fileContents).filter((p) => isDirtyPath(s, p))
    if (!dirty.length) {
      s.toast('nothing to commit — working tree clean. very disciplined of you.', 'info')
      return
    }
    // 7 hex chars like a real short sha — 4 chars collided inside 50 commits
    // pad the random tail — toString(16) drops trailing zeros, so a short
    // hash like 'you-8' could prefix-collide with a later 'you-8abc123'
    const hash = 'you-' + (Math.random().toString(16).slice(2, 9) + '0000000').slice(0, 7)
    const previousBaselines: Record<string, string> = {}
    for (const p of dirty) {
      if (s.baselines[p] !== undefined) previousBaselines[p] = s.baselines[p]
    }
    const commit: VisitorCommit = {
      hash,
      msg: msg.trim() || 'visitor: touched things',
      time: Date.now(),
      files: dirty,
      ...(Object.keys(previousBaselines).length > 0 ? { previousBaselines } : {}),
    }
    set((st) => {
      const baselines = { ...st.baselines }
      const fileContents = { ...st.fileContents }
      for (const p of dirty) {
        baselines[p] = st.fileContents[p]
        // overlay entry equals its baseline now — drop it or the file reads
        // dirty forever (and untitled drafts stay "untracked" every commit)
        delete fileContents[p]
      }
      return { baselines, fileContents, visitorCommits: [...st.visitorCommits, commit] }
    })
    get().toast(`[${BRANCH_NAMES[LANE_VISITOR]} ${hash}] ${commit.msg}`, 'ok')
    get().notify({
      icon: 'git',
      title: `commit ${hash}`,
      body: `${commit.msg} — ${dirty.length} file${dirty.length === 1 ? '' : 's'} on visitor/you`,
      target: 'view:git',
    })
    get().unlock('you-were-here')
  },

  toggleZen: () => {
    const next = !get().zenMode
    if (next) {
      // stash the layout — zen exit restores it instead of leaving you bare.
      // notifs die with the status bar that hosts them; leaving notifsOpen
      // set strands a dead layer in the Escape chain
      set((s) => ({ zenMode: true, zenPrev: { sidebarOpen: s.sidebarOpen, panelOpen: s.panelOpen }, sidebarOpen: false, panelOpen: false, notifsOpen: false }))
      get().toast('zen mode. Escape to leave.', 'info')
    } else {
      const prev = get().zenPrev
      set({ zenMode: false, zenPrev: null, sidebarOpen: prev?.sidebarOpen ?? true, panelOpen: prev?.panelOpen ?? true })
    }
  },

  setTour: (tour) => set({ tour }),

  consumeLineRequest: (path) =>
    set((s) => {
      const { [path]: _gone, ...rest } = s.lineRequests
      return { lineRequests: rest }
    }),

  setCursor: (ln, col) => set({ cursor: { ln, col } }),
  setCwd: (cwd) => set({ cwd }),

  pushTerm: (lines) =>
    set((s) => {
      const withIds = lines.map((l) => ({ ...l, id: lineId++ }))
      return { termLines: [...s.termLines, ...withIds].slice(-600) }
    }),

  clearTerm: () => set({ termLines: [] }),

  pushHistory: (cmd) => {
    set((s) => (cmd.trim() ? { termHistory: [...s.termHistory, cmd].slice(-100), cmdCount: s.cmdCount + 1 } : s))
    if (get().cmdCount === 1) get().unlock('hello-shell')
    if (get().cmdCount >= 10) get().unlock('schelling')
    if (get().cmdCount >= 50) get().unlock('shell-shocked')
  },

  setVimTrapped: (vimTrapped) => set({ vimTrapped }),

  toggleExtension: (id) => {
    const s = get()
    const enabled = { ...s.extensionsEnabled, [id]: !s.extensionsEnabled[id] }
    set({ extensionsEnabled: enabled })
    const ext = EXTENSIONS.find((e) => e.id === id)
    s.toast(
      enabled[id] ? `${ext?.name} enabled` : `${ext?.name} disabled — reload required. jk, it applied instantly`,
      'info',
    )
    s.notify({
      icon: 'ext',
      title: `extension ${enabled[id] ? 'enabled' : 'disabled'}`,
      body: `${ext?.name} v${ext?.version}`,
    })
  },

  resolveProblem: (id) => {
    const s = get()
    const p = s.problems.find((x) => x.id === id)
    set({ problems: s.problems.filter((x) => x.id !== id) })
    if (p?.id === 'work-life') {
      s.toast("'work-life balance' defined as: undefined. a poetic null.", 'ok')
      s.unlock('refactor-justice')
      s.notify({ icon: 'lsp', title: 'problem resolved', body: "'work-life balance' now exists. allegedly." })
    }
  },

  setProblems: (problems) =>
    set((s) => {
      // identical content → no-op; diagnostics rebuild on every keystroke and
      // a fresh array each time re-renders the whole problems surface
      const same =
        s.problems.length === problems.length &&
        s.problems.every((p, i) => {
          const q = problems[i]
          return p.id === q.id && p.severity === q.severity && p.file === q.file && p.line === q.line && p.msg === q.msg
        })
      return same ? s : { problems }
    }),

  notify: (n) =>
    set((s) => ({ notifications: [...s.notifications.slice(-59), { ...n, id: notifId++, time: Date.now(), read: false }] })),

  markNotificationsRead: () => set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) })),
  clearNotifications: () => set({ notifications: [] }),
  setNotifsOpen: (notifsOpen) => set({ notifsOpen }),

  unlock: (id) => {
    const s = get()
    if (s.unlocked[id]) return
    const def = ACHIEVEMENTS.find((a) => a.id === id)
    if (!def) return
    set({ unlocked: { ...s.unlocked, [id]: Date.now() } })
    if (s.settings['kushal.achievements.toasts']) {
      s.toast('achievement unlocked', 'achv', def.name, def.desc)
    }
    s.notify({ icon: 'achv', title: `achievement: ${def.name}`, body: def.desc })
    // some achievements materialize a file in the tree
    const secret = SECRET_BY_UNLOCK.get(id)
    if (secret) {
      setRevealedPaths(SECRET_FILES.filter((f) => get().unlocked[f.unlockId]).map((f) => f.path))
      s.notify({
        icon: 'kushal',
        title: 'file materialized',
        body: `${secret.path} appeared in the explorer`,
        target: secret.path,
      })
    }
    // meta-check — count only known ids; stale/foreign persisted keys mustn't
    // inflate the total toward platinum
    if (id !== 'platinum') {
      const known = Object.keys(get().unlocked).filter((k) => ACHIEVEMENTS.some((a) => a.id === k))
      if (known.length >= ACHIEVEMENTS.length - 1) get().unlock('platinum')
    }
  },

  maybeHint: (id) => {
    const s = get()
    if (s.hintsSeen.includes(id)) return false
    set({ hintsSeen: [...s.hintsSeen.slice(-19), id] })
    return true
  },
  markSeenIntro: () => set({ seenIntro: true, modal: null }),

  startGuide: () => set({ guided: 0 }),
  stepGuide: (dir) => set((s) => ({ guided: s.guided === null ? null : Math.max(0, s.guided + dir) })),
  endGuide: () => set({ guided: null }),
  hideMobileBanner: () => set({ mobileBannerHidden: true }),

  setPaletteOpen: (paletteOpen, seed = '') => {
    // a dialog owns the top layer — opening the palette under it would hide
    // the palette (same z-index, earlier in the DOM) while it still eats keys
    if (paletteOpen && get().modal) return
    set({ paletteOpen, paletteSeed: paletteOpen ? seed : '' })
    if (paletteOpen) get().unlock('power-user')
  },
  // symmetric guard: a dialog arriving over the palette retires the palette —
  // and every lower layer: the bell panel and ctx menu would otherwise stay
  // "open" but invisible, leaving dead presses in the Escape chain
  setModal: (modal) => set(modal ? { modal, paletteOpen: false, paletteSeed: '', notifsOpen: false, ctxMenu: null } : { modal }),
  setCtxMenu: (ctxMenu) => set({ ctxMenu }),

  toast: (msg, kind = 'info', title, desc) => {
    const id = toastId++
    set((s) => ({ toasts: [...s.toasts, { id, msg, kind, title, desc }] }))
    window.setTimeout(() => get().dismissToast(id), kind === 'achv' ? 4200 : 3200)
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  setSearchSeed: (searchSeed) => set({ searchSeed }),
}))

// module-level flag: suppress the settings.json → parse path when the write came from UI
let suppressSettingsParse = false

/** after revert: re-apply whatever settings.json's committed/original content says */
function reapplyBaselineSettings(s: Store) {
  const base = s.baselines['settings.json'] ?? getFile('settings.json')?.original ?? ''
  const res = parseSettingsJson(base)
  if (res.ok) s.applySettings(res.patch, 'file')
}

/**
 * text-level patch of a settings.json blob — replace only the given keys'
 * lines, insert missing keys before the closing brace, and leave comments /
 * custom keys untouched. A wholesale settingsToJson() regen would wipe the
 * visitor's annotations every time they toggle a setting in the UI.
 */
function patchSettingsJson(text: string, patch: Record<string, unknown>): string {
  let out = text
  for (const [k, v] of Object.entries(patch)) {
    const val = typeof v === 'string' ? JSON.stringify(v) : String(v)
    const keyRe = new RegExp(`(\\n\\s*"${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"\\s*:\\s*)[^,\\n}]+`)
    if (keyRe.test(out)) {
      out = out.replace(keyRe, `$1${val}`)
      continue
    }
    const brace = out.lastIndexOf('}')
    if (brace < 0) continue
    const before = out.slice(0, brace).replace(/\s+$/, '')
    const comma = before.endsWith('{') || before.endsWith(',') ? '' : ','
    out = `${before}${comma}\n  ${JSON.stringify(k)}: ${val}\n}`
  }
  return out
}

// start persisting once the module is loaded — flush on hide so the debounce
// doesn't eat the last 400ms of edits when the tab closes
const writer = createWriter()
useIDE.subscribe(writer.write as (s: Store, prev: Store) => void)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') writer.flush(useIDE.getState())
})
window.addEventListener('pagehide', () => writer.flush(useIDE.getState()))

// ---- derived helpers ----
export function getActiveTab(s: Pick<IDEState, 'panes' | 'activePane'>): string | null {
  return s.panes.find((p) => p.id === s.activePane)?.active ?? null
}

export function contentOf(
  s: Pick<IDEState, 'fileContents' | 'virtualFiles' | 'baselines'>,
  f: VFile | { path: string; original: string },
): string {
  return s.fileContents[f.path] ?? s.baselines[f.path] ?? f.original
}

/** the committed content — what diffs and dirty-checks compare against */
export function baselineOf(s: Pick<IDEState, 'baselines'>, path: string): string {
  return s.baselines[path] ?? getFile(path)?.original ?? ''
}

export function isDirty(s: Pick<IDEState, 'fileContents' | 'baselines'>, f: VFile): boolean {
  const c = s.fileContents[f.path]
  return c !== undefined && c !== (s.baselines[f.path] ?? f.original)
}

export function isDirtyPath(s: Pick<IDEState, 'fileContents' | 'virtualFiles' | 'baselines'>, path: string): boolean {
  const c = s.fileContents[path]
  if (c === undefined) return false
  // drafts compare against their committed baseline (or initial content) —
  // `c !== ''` kept every committed draft permanently dirty
  if (path.startsWith('untitled:')) return c !== (s.baselines[path] ?? s.virtualFiles[path] ?? '')
  const f = getFile(path)
  if (!f) return false // ghost path — can't be dirty, can't be committed
  return c !== (s.baselines[path] ?? f.original)
}

/** resolve any tab path — real, virtual, or pseudo — to a displayable file */
export function resolveTab(s: IDEState, path: string): VFile | null {
  const real = getFile(path)
  if (real) return real
  if (path.startsWith('untitled:')) {
    const name = path.slice(9)
    return {
      type: 'file',
      path,
      name,
      ext: extOf(name),
      kind: kindOf(name),
      original: s.virtualFiles[path] ?? '',
    }
  }
  return null
}

export const store = useIDE
