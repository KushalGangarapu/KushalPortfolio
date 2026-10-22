import { ChevronDown, Wrench, X } from 'lucide-react'
import { useIDE, store, isDirtyPath } from '../state/store'
import type { PanelTab } from '../state/store'
import { Terminal } from '../terminal/Terminal'
import { getFile, allFiles } from '../vfs/fs'
import { COMMITS } from '../vfs/gitdata'

function Problems() {
  const problems = useIDE((s) => s.problems)
  const errors = problems.filter((p) => p.severity === 'error').length
  const warns = problems.filter((p) => p.severity === 'warn').length

  return (
    <div className="overflow-auto p-3 font-mono text-[12px]">
      <div className="mb-2 flex gap-4 text-inkfaint">
        <span className="flex items-center gap-1">
          <X size={11} className="text-rust" /> {errors} error{errors === 1 ? '' : 's'}
        </span>
        <span className="flex items-center gap-1">
          <span className="text-ember">⚠</span> {warns} warning{warns === 1 ? '' : 's'}
        </span>
      </div>
      {problems.length === 0 && (
        <div className="px-2 py-3 leading-relaxed text-inkfaint">
          no problems detected. kushal-ls is quietly disappointed — it lives for drama.
          <div className="mt-1 text-[11px]">
            it does flag real things: a broken settings.json, a stale "currently",
            an unresolved import. it just hasn't had the chance.
          </div>
        </div>
      )}
      {problems.map((p) => (
        <div key={p.id} className="flex items-start gap-2 rounded-sm px-2 py-1.5 text-inkdim hover:bg-raised">
          <span className={`mt-0.5 ${p.severity === 'error' ? 'text-rust' : p.severity === 'warn' ? 'text-ember' : 'text-tide'}`}>
            {p.severity === 'error' ? '✕' : p.severity === 'warn' ? '⚠' : 'ℹ'}
          </span>
          <div className="min-w-0 flex-1">
            <button
              className="text-ink hover:text-ember"
              onClick={() => {
                const s = store.getState()
                if (getFile(p.file)) {
                  // Infinity survives a storage round-trip as null — isFinite
                  // covers both the seed value and the deserialized corpse
                  s.openFile(p.file, { mode: 'raw', line: Number.isFinite(p.line) ? p.line : undefined })
                } else {
                  s.toast(`${p.file} does not exist in this workspace. suspicious.`, 'info')
                }
              }}
            >
              {p.msg}
            </button>
            <span className="ml-2 text-inkfaint">
              {p.file}:{Number.isFinite(p.line) ? p.line : '∞:∞'}
            </span>
            {p.hint && <div className="text-[11px] text-inkfaint">hint: {p.hint}</div>}
          </div>
          {p.fixable && (
            <button
              onClick={() => store.getState().resolveProblem(p.id)}
              className="flex shrink-0 items-center gap-1 border border-ember/40 px-1.5 py-0.5 text-[10px] text-ember transition-colors hover:bg-ember/10"
              title="apply quick fix"
            >
              <Wrench size={10} /> quick fix
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

function Output() {
  const fileContents = useIDE((s) => s.fileContents)
  const virtualFiles = useIDE((s) => s.virtualFiles)
  const baselines = useIDE((s) => s.baselines)
  const dirty = Object.keys(fileContents).filter((p) => isDirtyPath({ fileContents, virtualFiles, baselines }, p)).length
  const lines: [string, string][] = [
    ['[kushal-ls]', 'language server started — symbols indexed, hovers armed, all green'],
    ['[index]', `${allFiles().length} files indexed in 0.02s`],
    ['[git]', `${COMMITS.length + dirty} objects tracked — career confirmed real`],
    ['[build]', dirty ? `${dirty} file(s) modified — working tree dirty, deliciously` : 'watching for changes… (there are none. it is perfect.)'],
    ['[linter]', '0 issues. suspicions raised.'],
  ]
  return (
    <div className="overflow-auto p-3 font-mono text-[12px] leading-[1.6]">
      {lines.map(([tag, msg], i) => (
        <div key={i}>
          <span className="text-tide">{tag}</span>
          <span className="text-inkdim"> {msg}</span>
        </div>
      ))}
    </div>
  )
}

const TABS: { id: PanelTab; label: string }[] = [
  { id: 'terminal', label: 'Terminal' },
  { id: 'problems', label: 'Problems' },
  { id: 'output', label: 'Output' },
]

export function Panel() {
  const panelOpen = useIDE((s) => s.panelOpen)
  const panelTab = useIDE((s) => s.panelTab)
  const panelHeight = useIDE((s) => s.panelHeight)
  const problems = useIDE((s) => s.problems)
  const togglePanel = useIDE((s) => s.togglePanel)
  const setPanelHeight = useIDE((s) => s.setPanelHeight)
  const mobile = useIDE((s) => s.mobile)

  if (!panelOpen) return null

  // on a phone the panel can't eat the whole viewport — cap it
  const height = mobile ? Math.min(panelHeight, Math.round(window.innerHeight * 0.42)) : panelHeight

  const startDrag = (e: React.MouseEvent) => {
    e.preventDefault()
    const move = (ev: MouseEvent) => {
      setPanelHeight(window.innerHeight - ev.clientY - 24) // 24 = statusbar
    }
    const up = () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  return (
    <div
      className="relative flex shrink-0 flex-col border-t border-line bg-chrome"
      style={{ height }}
    >
      {/* drag handle — keyboard-resizable separator, not mouse-only */}
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="resize panel"
        tabIndex={0}
        onMouseDown={startDrag}
        onKeyDown={(e) => {
          const step = e.shiftKey ? 60 : 20
          if (e.key === 'ArrowUp') setPanelHeight(panelHeight + step)
          else if (e.key === 'ArrowDown') setPanelHeight(panelHeight - step)
          else return
          e.preventDefault()
        }}
        className="absolute -top-[3px] left-0 right-0 z-10 h-[5px] cursor-row-resize hover:bg-ember/30 focus-visible:bg-ember/50 focus-visible:outline-none"
      />
      <div className="flex h-8 shrink-0 items-center justify-between border-b border-line px-2">
        <div className="flex items-center">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => store.getState().setPanelTab(t.id)}
              className={`relative px-3 py-1.5 font-mono text-[11px] uppercase tracking-wide transition-colors ${
                panelTab === t.id ? 'text-ink' : 'text-inkfaint hover:text-inkdim'
              }`}
            >
              {t.label}
              {t.id === 'problems' && problems.length > 0 && (
                <span className="ml-1 text-[9px] text-ember">{problems.length}</span>
              )}
              {panelTab === t.id && <span className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-ember" />}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => setPanelHeight(140)}
            title="collapse"
            aria-label="collapse panel"
            className="rounded-sm p-1 text-inkfaint hover:bg-raised hover:text-ink"
          >
            <ChevronDown size={14} />
          </button>
          <button
            onClick={togglePanel}
            title="close panel (Ctrl+`)"
            aria-label="close panel"
            className="rounded-sm p-1 text-inkfaint hover:bg-raised hover:text-ink"
          >
            <X size={14} />
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1">
        {panelTab === 'terminal' && <Terminal />}
        {panelTab === 'problems' && <Problems />}
        {panelTab === 'output' && <Output />}
      </div>
    </div>
  )
}
