import type { Settings } from '../settings/model'
import { DEFAULT_SETTINGS, parseSettingsJson } from '../settings/model'
import { ACHIEVEMENTS } from '../achievements/defs'
import type {
  Pane,
  TermLine,
  Notification,
  Problem,
  ViewMode,
  PanelTab,
  VisitorCommit,
} from './store'

const KEY = 'kushal:v1'

// factory-reset tombstone: wipePersisted() runs right before reload, but the
// pagehide/visibilitychange flush would otherwise write the full in-memory
// state back on the way out — silently undoing the wipe
let wiped = false

export interface Persisted {
  settings?: Settings
  panes?: Pane[]
  activePane?: string
  fileContents?: Record<string, string>
  virtualFiles?: Record<string, string>
  viewModes?: Record<string, ViewMode>
  closedStack?: string[]
  cwd?: string
  termHistory?: string[]
  termLines?: TermLine[]
  extensionsEnabled?: Record<string, boolean>
  unlocked?: Record<string, number>
  notifications?: Notification[]
  problems?: Problem[]
  sidebarOpen?: boolean
  sidebarWidth?: number
  panelOpen?: boolean
  panelTab?: PanelTab
  openedEver?: string[]
  cmdCount?: number
  baselines?: Record<string, string>
  visitorCommits?: VisitorCommit[]
  liteDismissed?: boolean
  panelHeight?: number
  hintsSeen?: string[]
  seenIntro?: boolean
}

export interface LoadResult {
  state: Persisted
  existed: boolean
}

export function loadPersisted(): LoadResult {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return { state: {}, existed: false }
    const parsed = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return { state: {}, existed: false }
    const state = parsed as Persisted
    // migrate renamed theme id (sesha-midnight → kushal-midnight)
    const theme = state.settings?.['workbench.colorTheme'] as string | undefined
    if (theme === 'sesha-midnight') {
      state.settings!['workbench.colorTheme'] = 'kushal-midnight'
    }
    // normalize stored settings through the real validator — a corrupted
    // value (e.g. a theme id that no longer exists) falls back to defaults
    // instead of breaking the runtime CSS vars
    if (state.settings) {
      const res = parseSettingsJson(JSON.stringify(state.settings))
      state.settings = { ...DEFAULT_SETTINGS, ...(res.ok ? res.patch : {}) }
    }
    for (const bag of [state.fileContents, state.baselines]) {
      const sj = bag?.['settings.json']
      if (sj?.includes('sesha-midnight')) bag!['settings.json'] = sj.replace('sesha-midnight', 'kushal-midnight')
      const ej = bag?.['experience.json']
      if (ej && (!ej.includes('"community"') || !ej.includes('BC Youth Developer Collective'))) delete bag!['experience.json']
    }
    // field-shape guard — a hand-edited/corrupted blob must not TypeError store init
    for (const k of ['panes', 'closedStack', 'termHistory', 'termLines', 'notifications', 'problems', 'openedEver', 'visitorCommits', 'hintsSeen'] as const) {
      if (state[k] !== undefined && !Array.isArray(state[k])) delete state[k]
    }
    for (const k of ['fileContents', 'virtualFiles', 'viewModes', 'extensionsEnabled', 'unlocked', 'baselines'] as const) {
      const v = state[k]
      if (v !== undefined && (typeof v !== 'object' || v === null || Array.isArray(v))) delete state[k]
    }
    // element-level guards — arrays pass the shape check but a malformed
    // element still crashes renderers (object children, .join on non-arrays)
    // or poisons the id counters via Math.max → NaN
    const strList = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string')
    if (state.closedStack && !strList(state.closedStack)) delete state.closedStack
    if (state.termHistory && !strList(state.termHistory)) delete state.termHistory
    if (state.openedEver && !strList(state.openedEver)) delete state.openedEver
    if (state.hintsSeen && !strList(state.hintsSeen)) delete state.hintsSeen
    // a pane with tabs:"x" or active:{} TypeErrors on boot — panes.find +
    // tabs.indexOf run before any render
    if (
      state.panes &&
      !state.panes.every(
        (p) =>
          p &&
          typeof p.id === 'string' &&
          Array.isArray(p.tabs) &&
          p.tabs.every((t) => typeof t === 'string') &&
          (p.active === null || p.active === undefined || typeof p.active === 'string'),
      )
    )
      delete state.panes
    const TERM_KINDS = new Set(['input', 'out', 'err', 'ok', 'dim', 'sys', 'accent', 'red'])
    // a forged kind reaches KIND_CLASS[kind] → undefined class; values must be
    // in the render union, not just strings
    if (state.termLines && !state.termLines.every((l) => l && typeof l.text === 'string' && Number.isFinite(l.id) && TERM_KINDS.has(l.kind) && (l.cmd === undefined || typeof l.cmd === 'string'))) delete state.termLines
    // full-shape checks, not spot checks — a body:{} notification renders an
    // object as a React child, a bogus severity/icon paints broken chrome,
    // and target must stay a string or the click deep-links to [object Object]
    const ICONS = new Set(['git', 'ext', 'lsp', 'kushal', 'achv', 'settings', 'warn'])
    if (
      state.notifications &&
      !state.notifications.every(
        (n) =>
          n &&
          typeof n.title === 'string' &&
          typeof n.body === 'string' &&
          typeof n.read === 'boolean' &&
          Number.isFinite(n.id) &&
          Number.isFinite(n.time) &&
          ICONS.has(n.icon) &&
          (n.target === undefined || typeof n.target === 'string'),
      )
    )
      delete state.notifications
    const SEVS = new Set(['error', 'warn', 'info'])
    if (
      state.problems &&
      !state.problems.every(
        (p) =>
          p &&
          typeof p.id === 'string' &&
          typeof p.file === 'string' &&
          // JSON.stringify(Infinity) → null; 'work-life' seeds a +∞ line, so a
          // round-tripped blob carries null. rejecting it would delete the
          // array and resurrect every quick-fixed problem on next load
          (typeof p.line === 'number' || p.line === null) &&
          typeof p.msg === 'string' &&
          SEVS.has(p.severity) &&
          (p.hint === undefined || typeof p.hint === 'string') &&
          (p.fixable === undefined || typeof p.fixable === 'boolean'),
      )
    )
      delete state.problems
    if (state.problems) for (const p of state.problems) if (p.line === null) p.line = Number.POSITIVE_INFINITY
    if (state.visitorCommits && !state.visitorCommits.every((c) => c && typeof c.hash === 'string' && typeof c.msg === 'string' && Number.isFinite(c.time) && Array.isArray(c.files) && c.files.every((f: unknown) => typeof f === 'string'))) delete state.visitorCommits
    // stray achievement ids (renamed/forged) skew the platinum count — and a
    // non-numeric value renders as "Invalid Date" on the achievements card
    if (state.unlocked) {
      const known = new Set(ACHIEVEMENTS.map((a) => a.id))
      state.unlocked = Object.fromEntries(Object.entries(state.unlocked).filter(([id, v]) => known.has(id) && Number.isFinite(v)))
    }
    // record-value guards — a blob like {"fileContents": {"x": 5}} must not
    // reach contentOf, which treats every value as a string
    const strRecord = (v: Record<string, unknown> | undefined) => v && Object.fromEntries(Object.entries(v).filter(([, x]) => typeof x === 'string'))
    if (state.fileContents) state.fileContents = strRecord(state.fileContents) as Persisted['fileContents']
    if (state.virtualFiles) state.virtualFiles = strRecord(state.virtualFiles) as Persisted['virtualFiles']
    if (state.baselines) state.baselines = strRecord(state.baselines) as Persisted['baselines']
    if (state.extensionsEnabled) {
      state.extensionsEnabled = Object.fromEntries(Object.entries(state.extensionsEnabled).filter(([, x]) => typeof x === 'boolean')) as Persisted['extensionsEnabled']
    }
    // scalar guards — bogus scalars pass ?? and degrade the shell silently.
    // the setters clamp (sidebar 180–420, panel 120–480); a hand-edited blob
    // bypasses them unless the restore path applies the same bounds
    if (state.sidebarWidth !== undefined && (!Number.isFinite(state.sidebarWidth) || state.sidebarWidth < 180 || state.sidebarWidth > 420)) delete state.sidebarWidth
    if (state.panelHeight !== undefined && (!Number.isFinite(state.panelHeight) || state.panelHeight < 120 || state.panelHeight > 480)) delete state.panelHeight
    if (state.cmdCount !== undefined && !Number.isFinite(state.cmdCount)) delete state.cmdCount
    if (state.cwd !== undefined && typeof state.cwd !== 'string') delete state.cwd
    if (state.panelTab !== undefined && !['terminal', 'problems', 'output'].includes(state.panelTab)) delete state.panelTab
    if (state.activePane !== undefined && typeof state.activePane !== 'string') delete state.activePane
    for (const k of ['sidebarOpen', 'panelOpen', 'liteDismissed', 'seenIntro'] as const) {
      if (state[k] !== undefined && typeof state[k] !== 'boolean') delete state[k]
    }
    return { state, existed: true }
  } catch {
    return { state: {}, existed: false }
  }
}

export function wipePersisted() {
  wiped = true
  try {
    window.localStorage.removeItem(KEY)
  } catch {
    /* private mode — nothing persists anyway */
  }
}

/** snapshot a state object down to the persisted subset */
export function pickState(s: Persisted): Persisted {
  return {
    settings: s.settings,
    panes: s.panes,
    activePane: s.activePane,
    fileContents: s.fileContents,
    virtualFiles: s.virtualFiles,
    viewModes: s.viewModes,
    closedStack: s.closedStack?.slice(-50),
    cwd: s.cwd,
    termHistory: s.termHistory?.slice(-100),
    termLines: s.termLines?.slice(-80),
    extensionsEnabled: s.extensionsEnabled,
    unlocked: s.unlocked,
    notifications: s.notifications?.slice(-60),
    problems: s.problems,
    sidebarOpen: s.sidebarOpen,
    sidebarWidth: s.sidebarWidth,
    panelOpen: s.panelOpen,
    panelTab: s.panelTab,
    openedEver: s.openedEver?.slice(0, 50),
    cmdCount: s.cmdCount,
    baselines: s.baselines,
    visitorCommits: s.visitorCommits?.slice(-50),
    liteDismissed: s.liteDismissed,
    panelHeight: s.panelHeight,
    hintsSeen: s.hintsSeen?.slice(-20),
    seenIntro: s.seenIntro,
  }
}

export interface Writer {
  /** debounced — the subscriber callback */
  write: (s: Persisted) => void
  /** synchronous — call on pagehide/visibilitychange so the debounce doesn't eat the last edit */
  flush: (s: Persisted) => void
}

/** returns a debounced writer — wire it via useIDE.subscribe(writer.write) */
export function createWriter(): Writer {
  let timer: number | undefined
  let last = ''
  const commit = (s: Persisted) => {
    if (wiped) return // factory reset won — don't resurrect the state being torn down
    try {
      const snap = JSON.stringify(pickState(s))
      if (snap !== last) {
        last = snap
        window.localStorage.setItem(KEY, snap)
      }
    } catch {
      /* quota / private mode — shrug */
    }
  }
  return {
    write: (s) => {
      clearTimeout(timer)
      timer = window.setTimeout(() => commit(s), 400)
    },
    flush: (s) => {
      clearTimeout(timer)
      commit(s)
    },
  }
}
