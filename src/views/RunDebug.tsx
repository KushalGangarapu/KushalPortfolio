import { useEffect, useState } from 'react'
import { Play, Bug, ChevronDown, CircleDot, Eye, Layers, Variable } from 'lucide-react'
import { store, useIDE, isDirtyPath } from '../state/store'
import { getFile } from '../vfs/fs'

const CONFIGS = [
  {
    id: 'portfolio',
    label: 'Run Portfolio',
    desc: 'kushal build --production',
    run() {
      // the real artifact — compiles live edits into the readable view
      store.getState().buildForProduction()
    },
  },
  {
    id: 'sleep',
    label: 'Debug: sleep schedule',
    desc: 'attach to process: sleep',
    run() {
      const s = store.getState()
      s.setPanelTab('terminal')
      s.pushTerm([
        { kind: 'input', text: '$ kushal debug --attach sleep' },
        { kind: 'out', text: 'attaching to process: sleep…' },
        { kind: 'err', text: 'error: process not found (last seen: pre-midterms 2024)' },
        { kind: 'dim', text: 'suggestion: sleep.schedule is deprecated. see .gitignore' },
      ])
    },
  },
  {
    id: 'coffee',
    label: 'Launch: coffee chat',
    desc: 'mailto — the only protocol that matters',
    run() {
      const s = store.getState()
      s.pushTerm([{ kind: 'ok', text: 'launching: coffee chat' }])
      window.location.href = 'mailto:smileykushal@gmail.com?subject=coffee%20chat%20(via%20the%20IDE%2C%20respectfully)'
    },
  },
  {
    id: 'social',
    label: 'Test: social skills',
    desc: 'npm test -- --suite=soft',
    run() {
      const s = store.getState()
      s.setPanelTab('terminal')
      s.pushTerm([
        { kind: 'input', text: '$ npm test -- --suite=soft' },
        { kind: 'out', text: '  ✓ makes eye contact (when safe)' },
        { kind: 'out', text: '  ✓ explains code without sighing' },
        { kind: 'err', text: '  ✗ small talk — timeout after 90s' },
        { kind: 'dim', text: '  2 passing, 1 failing (expected failure, documented)' },
      ])
    },
  },
  {
    id: 'attach',
    label: 'Attach: recruiter attention',
    desc: 'pid: your_cursor',
    run() {
      store.getState().toast('already attached. hi.', 'ok')
    },
  },
]

const BREAKPOINTS = [
  { file: 'life.ts', line: 42, cond: 'when free_time > 0', hits: 'never' },
  { file: 'resume.pdf', line: 1, cond: 'always', hits: 'you, right now' },
  { file: 'motivation.rs', line: 7, cond: 'deadline < 48h', hits: 'always' },
]

export function RunDebug() {
  const [sel, setSel] = useState('portfolio')
  const [bpsOpen, setBpsOpen] = useState(true)
  const current = CONFIGS.find((c) => c.id === sel)!

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="p-3">
        <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.12em] text-inkfaint">
          run and debug
        </div>
        <div className="border border-line bg-abyss">
          {CONFIGS.map((c) => (
            <button
              key={c.id}
              onClick={() => setSel(c.id)}
              onDoubleClick={c.run}
              className={`flex w-full items-center gap-2 px-2.5 py-2 text-left font-mono text-[11.5px] transition-colors ${
                sel === c.id ? 'bg-raised text-ink' : 'text-inkdim hover:bg-raised/60'
              }`}
            >
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${sel === c.id ? 'bg-ember' : 'bg-line'}`} />
              <span className="min-w-0">
                <span className="block truncate">{c.label}</span>
                <span className="block truncate text-[9.5px] text-inkfaint">{c.desc}</span>
              </span>
            </button>
          ))}
        </div>
        <button
          onClick={current.run}
          className="mt-2 flex w-full items-center justify-center gap-1.5 border border-sage/50 bg-sage/10 py-1.5 font-mono text-[12px] text-sage transition-colors hover:bg-sage/20"
        >
          <Play size={12} /> run: {current.label.toLowerCase()}
        </button>
        <div className="mt-1 text-center font-mono text-[9px] text-inkfaint">
          double-click a config to run it directly
        </div>
      </div>

      <div className="px-3 pb-3">
        <button
          onClick={() => setBpsOpen(!bpsOpen)}
          className="flex w-full items-center gap-1 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-inkfaint"
        >
          <ChevronDown size={11} className={bpsOpen ? '' : '-rotate-90'} />
          breakpoints ({BREAKPOINTS.length})
        </button>
        {bpsOpen &&
          BREAKPOINTS.map((b, i) => (
            <button
              key={i}
              onClick={() => {
                const s = store.getState()
                if (getFile(b.file)) s.openFile(b.file, { line: b.line, mode: 'raw' })
                else s.toast(`${b.file} isn't in this workspace — it lives in a different repo`, 'info')
              }}
              className="mb-1 flex w-full items-start gap-2 px-2 py-1 text-left font-mono text-[10.5px] transition-colors hover:bg-raised"
              title={getFile(b.file) ? 'jump to breakpoint' : `${b.file} — outside this workspace`}
            >
              <CircleDot size={10} className="mt-0.5 shrink-0 text-rust" />
              <div className="min-w-0">
                <div className="text-inkdim">
                  {b.file}:{b.line}
                </div>
                <div className="truncate text-inkfaint">
                  {b.cond} — hits: {b.hits}
                </div>
              </div>
            </button>
          ))}
      </div>

      <Watches />
      <CallStack />
      <Variables />

      <div className="mt-auto px-3 pb-3">
        <div className="flex items-center gap-1.5 font-mono text-[9.5px] text-inkfaint">
          <Bug size={10} />
          debugger attached to: potential employer
        </div>
      </div>
    </div>
  )
}

/** live watch expressions — real values, re-evaluated every second */
function Watches() {
  const [open, setOpen] = useState(true)
  const [tick, setTick] = useState(0)
  const unlocked = useIDE((s) => s.unlocked)
  const fileContents = useIDE((s) => s.fileContents)
  const panes = useIDE((s) => s.panes)

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [])

  const values: [string, string][] = [
    ['kushal.motivation', `${(60 + Math.floor(40 * Math.sin(tick / 9)) + 100) % 101}% — oscillating`],
    ['visitor.patience', `${Math.floor(90 - (tick % 50))}s remaining`],
    ['workspace.openTabs', String(panes.reduce((n, p) => n + p.tabs.length, 0))],
    ['workspace.dirtyFiles', String(Object.keys(fileContents).filter((p) => isDirtyPath(useIDE.getState(), p)).length)],
    ['achievements.unlocked', `${Object.keys(unlocked).length}`],
    ['sleep', 'undefined (not a function)'],
  ]

  return (
    <div className="px-3 pb-3">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-1 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-inkfaint"
      >
        <ChevronDown size={11} className={open ? '' : '-rotate-90'} />
        watch ({values.length}) — live
      </button>
      {open &&
        values.map(([expr, v]) => (
          <div key={expr} className="flex items-baseline gap-2 px-2 py-[3px] font-mono text-[10.5px]">
            <Eye size={9} className="shrink-0 translate-y-[1px] text-tide" />
            <span className="text-inkdim">{expr}</span>
            <span className="truncate text-ember">= {v}</span>
          </div>
        ))}
    </div>
  )
}

/** paused at the interesting part — every frame is real and jumpable */
function CallStack() {
  const [open, setOpen] = useState(true)
  const frames: { fn: string; file: string; line: number }[] = [
    { fn: 'impress(recruiter)', file: 'src/person.ts', line: 1 },
    { fn: 'portfolio.visit(visitor)', file: 'README.md', line: 1 },
    { fn: 'kushal.main()', file: 'experience.json', line: 1 },
    { fn: '<anonymous>', file: 'life.ts', line: 0 },
  ]
  return (
    <div className="px-3 pb-3">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-1 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-inkfaint"
      >
        <ChevronDown size={11} className={open ? '' : '-rotate-90'} />
        call stack
      </button>
      {open &&
        frames.map((f, i) => (
          <button
            key={f.fn}
            onClick={() => {
              const s = store.getState()
              if (getFile(f.file)) s.openFile(f.file, f.line ? { line: f.line, mode: 'raw' } : undefined)
              else s.toast(`${f.file} — optimized away at build time`, 'info')
            }}
            className={`flex w-full items-center gap-2 px-2 py-[3px] text-left font-mono text-[10.5px] transition-colors hover:bg-raised ${i === 0 ? 'text-ink' : 'text-inkdim'}`}
            title={getFile(f.file) ? 'jump to frame' : 'frame unavailable'}
          >
            <Layers size={9} className={`shrink-0 ${i === 0 ? 'text-ember' : 'text-inkfaint'}`} />
            <span className="truncate">{f.fn}</span>
            <span className="ml-auto shrink-0 text-[9px] text-inkfaint">{f.file}{f.line ? `:${f.line}` : ''}</span>
          </button>
        ))}
      <div className="px-2 py-1 font-mono text-[9px] text-inkfaint">⏸ paused on: your attention</div>
    </div>
  )
}

/** locals — small, inspectable, mostly true */
function Variables() {
  const [open, setOpen] = useState(false)
  const locals: [string, string][] = [
    ['kushal.role', '"grade 12 @ Burnaby Central → builds the school\'s calendar"'],
    ['kushal.coffee', 'NaN (never null)'],
    ['this.recruiter', 'you'],
    ['deadlines.length', '∞'],
    ['scope', 'global (unavoidable)'],
  ]
  return (
    <div className="px-3 pb-3">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-1 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-inkfaint"
      >
        <ChevronDown size={11} className={open ? '' : '-rotate-90'} />
        variables ({locals.length})
      </button>
      {open &&
        locals.map(([k, v]) => (
          <div key={k} className="flex items-baseline gap-2 px-2 py-[3px] font-mono text-[10.5px]">
            <Variable size={9} className="shrink-0 translate-y-[1px] text-violet" />
            <span className="text-tide">{k}</span>
            <span className="truncate text-inkfaint">= {v}</span>
          </div>
        ))}
    </div>
  )
}
