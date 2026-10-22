// the self-driving tour — real store actions, no fake cursor, no overlays.
// any genuine user input (key/click) aborts and hands control back.
import { store } from '../state/store'

export type Exec = (cmd: string, echo?: boolean) => void

interface Step {
  caption: string
  act: (exec: Exec) => void
  /** dwell time in ms while the caption shows */
  ms: number
}

const STEPS: Step[] = [
  {
    caption: 'this is a code editor that is also a person — buckle up, it drives itself',
    act: () => {
      store.getState().ensureView('explorer')
      store.getState().openFile('README.md', { mode: 'preview' })
    },
    ms: 3400,
  },
  {
    caption: 'projects/*.md — case studies as markdown. hover the dotted words later: that’s a language server',
    act: () => store.getState().openFile('projects/wildcat-calendar.md', { mode: 'preview' }),
    ms: 3600,
  },
  {
    caption: 'ctrl+\\ splits panes — skills.toml keeps the readme company',
    act: () => {
      store.getState().splitRight()
      store.getState().openFile('skills.toml', { mode: 'raw' })
    },
    ms: 3600,
  },
  {
    caption: 'source control — the career is a git graph. every commit is real, expand one',
    act: () => {
      store.getState().ensureView('git')
    },
    ms: 3400,
  },
  {
    caption: 'the terminal is real — asking the repl who built this',
    act: (exec) => {
      store.getState().setPanelTab('terminal')
      exec('js me()')
    },
    ms: 3400,
  },
  {
    caption: 'F5 — "build for production" compiles the workspace into a recruiter-readable page',
    act: () => store.getState().toggleRecruiter(),
    ms: 3200,
  },
  {
    caption: '…and back. every edit you make diffs for real and can be committed to visitor/you',
    act: () => {
      store.getState().toggleRecruiter()
      store.getState().openFile('settings.json')
    },
    ms: 3800,
  },
  {
    caption: 'tour complete — your turn. edit a file, commit it, find the hidden ones. esc to leave anytime.',
    act: () => {
      const s = store.getState()
      s.ensureView('explorer')
      s.openFile('README.md', { mode: 'preview' })
    },
    ms: 3000,
  },
]

let running = false
// per-run generation — an aborted loop's sleep() can resolve after a NEW tour
// already restarted `running`; the stale loop must not keep stepping
let gen = 0
let abortHandler: ((e: Event) => void) | null = null

function cleanup() {
  running = false
  if (abortHandler) window.removeEventListener('pointerdown', abortHandler, true)
  if (abortHandler) window.removeEventListener('keydown', abortHandler, true)
  abortHandler = null
}

export function abortTour(silent = false) {
  if (!running) {
    store.getState().setTour(null)
    return
  }
  cleanup()
  store.getState().setTour(null)
  if (!silent) {
    store.getState().toast('tour aborted — your hands, your rules', 'info')
    store.getState().unlock('backseat-driver')
  }
}

export function tourRunning() {
  return running
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function startTour(exec: Exec) {
  const s = store.getState()
  if (running || s.tour) return
  s.endGuide() // the guided route and the auto-tour don't run at once
  running = true
  const myGen = ++gen

  // the abort key must NOT also reach the app — F6 restarting a second loop
  // or Escape simultaneously closing the palette/modal is exactly the leak
  // this handler exists to prevent
  abortHandler = (e: Event) => {
    e.preventDefault()
    e.stopImmediatePropagation()
    abortTour()
  }
  window.addEventListener('pointerdown', abortHandler, true)
  window.addEventListener('keydown', abortHandler, true)

  for (const step of STEPS) {
    if (!running || myGen !== gen) return
    store.getState().setTour({ caption: step.caption })
    try {
      step.act(exec)
    } catch {
      /* a step failing shouldn't strand the tour */
    }
    await sleep(step.ms)
  }
  if (myGen !== gen) return // a newer tour owns the finish line

  cleanup()
  store.getState().setTour(null)
  store.getState().unlock('sightseer')
}
