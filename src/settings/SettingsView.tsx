import { useEffect, useMemo, useState } from 'react'
import { Search, FileCode } from 'lucide-react'
import { useIDE, store } from '../state/store'
import { SETTING_META } from './model'
import type { Settings } from './model'
import type { ThemeId } from './theme-types'

/** first-pixel swatches — hover previews the theme, click commits it */
const SWATCHES: Record<ThemeId, { bg: string; fg: string; accent: string }> = {
  'kushal-midnight': { bg: '#0e0d0b', fg: '#e8e0d4', accent: '#ff9e3d' },
  demogod: { bg: '#12081f', fg: '#f2e9ff', accent: '#ff2ea6' },
  'kushal-daylight': { bg: '#f5f1ea', fg: '#2b251d', accent: '#c05a17' },
}

// hover previews live on documentElement — leaving restores the committed theme
function previewTheme(t: ThemeId | null) {
  const theme = t ?? store.getState().settings['workbench.colorTheme']
  if (theme === 'kushal-midnight') delete document.documentElement.dataset.theme
  else document.documentElement.dataset.theme = theme
}

function ThemeSwatches({ value, onPick }: { value: ThemeId; onPick: (t: ThemeId) => void }) {
  const preview = previewTheme
  // the tab can die mid-hover (Close Others / closeAllTabs) before any
  // mouseleave or blur fires — unmount must restore the committed theme or
  // data-theme stays on the preview while settings disagree
  useEffect(() => () => previewTheme(null), [])
  return (
    <div
      className="flex items-center gap-2"
      role="radiogroup"
      aria-label="color theme"
      onKeyDown={(e) => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
        const ids = Object.keys(SWATCHES) as ThemeId[]
        const i = ids.indexOf(value)
        const next = ids[(i + (e.key === 'ArrowRight' ? 1 : ids.length - 1)) % ids.length]
        preview(null)
        onPick(next)
        // APG radios move focus with selection — keep it on the newly-checked swatch
        requestAnimationFrame(() =>
          (e.currentTarget.querySelector(`[data-theme-id="${next}"]`) as HTMLElement | null)?.focus(),
        )
      }}
    >
      {(Object.keys(SWATCHES) as ThemeId[]).map((t) => (
        <button
          key={t}
          role="radio"
          aria-checked={value === t}
          aria-label={`${t} theme`}
          title={`${t} — hover to preview, click to keep`}
          tabIndex={value === t ? 0 : -1}
          data-theme-id={t}
          onMouseEnter={() => preview(t)}
          onMouseLeave={() => preview(null)}
          onFocus={() => preview(t)}
          onBlur={() => preview(null)}
          onClick={() => { preview(null); onPick(t) }}
          className={`flex h-8 w-12 items-end overflow-hidden border p-0.5 transition-transform hover:scale-105 ${
            value === t ? 'border-ember' : 'border-line'
          }`}
          style={{ background: SWATCHES[t].bg }}
        >
          <span className="h-1 w-1/3" style={{ background: SWATCHES[t].accent }} />
          <span className="ml-auto mb-0.5 h-0.5 w-1/2" style={{ background: SWATCHES[t].fg }} />
        </button>
      ))}
    </div>
  )
}

/** number inputs can't commit per keystroke — typing "12" into a field that
 *  clamps at 10 would freeze on "1". edit as text, commit on blur/Enter. */
function NumberField({ value, min, max, label, onCommit }: { value: number; min?: number; max?: number; label: string; onCommit: (n: number) => void }) {
  const [text, setText] = useState<string | null>(null)
  const commit = () => {
    if (text !== null) {
      const n = Number(text)
      if (Number.isFinite(n)) onCommit(Math.min(max ?? n, Math.max(min ?? n, n)))
    }
    setText(null)
  }
  return (
    <input
      id={`setting-num-${label.replace(/\s+/g, '-').toLowerCase()}`}
      name={label}
      type="number"
      aria-label={label}
      value={text ?? String(value)}
      min={min}
      max={max}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
      }}
      className="w-16 border border-line bg-abyss px-2 py-1 font-mono text-[11.5px] text-ink outline-none"
    />
  )
}

function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      role="switch"
      aria-checked={on}
      aria-label={label}
      className={`relative h-[18px] w-9 shrink-0 rounded-full border transition-colors ${
        on ? 'border-ember bg-ember/25' : 'border-line bg-abyss'
      }`}
    >
      <span
        className={`absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full transition-all ${
          on ? 'left-[19px] bg-ember' : 'left-[3px] bg-inkfaint'
        }`}
      />
    </button>
  )
}

export function SettingsView() {
  const settings = useIDE((s) => s.settings)
  const [q, setQ] = useState('')

  const list = useMemo(() => {
    const needle = q.toLowerCase()
    return SETTING_META.filter(
      (m) => !needle || m.key.toLowerCase().includes(needle) || m.label.toLowerCase().includes(needle) || m.desc.toLowerCase().includes(needle),
    )
  }, [q])

  const apply = (patch: Partial<Settings>) => {
    const s = store.getState()
    s.applySettings(patch, 'ui')
    s.unlock('tinkerer')
  }

  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto max-w-[640px] px-6 py-6">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="font-mono text-[18px] font-semibold text-ink">Settings</h1>
          <button
            onClick={() => store.getState().openFile('settings.json')}
            className="flex items-center gap-1.5 border border-line px-2 py-1 font-mono text-[10.5px] text-inkdim transition-colors hover:bg-raised hover:text-ink"
            title="open settings.json — it writes back"
          >
            <FileCode size={12} /> open settings.json
          </button>
        </div>
        <div className="mb-4 flex items-center gap-2 border border-line bg-chrome px-3 py-1.5">
          <Search size={13} className="text-inkfaint" />
          <input
            id="settings-search"
            name="settings-search"
            aria-label="Search settings"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search settings"
            className="w-full bg-transparent font-mono text-[12px] text-ink outline-none placeholder:text-inkfaint"
            autoCapitalize="off"
            spellCheck={false}
          />
        </div>
        <div className="divide-y divide-line border-y border-line">
          {list.map((m) => {
            const v = settings[m.key]
            return (
              <div key={m.key} className="flex items-center justify-between gap-6 py-3">
                <div className="min-w-0">
                  <div className="font-mono text-[12.5px] text-ink">{m.label}</div>
                  <div className="font-mono text-[10.5px] text-inkfaint">
                    <span className="text-tide">{m.key}</span> — {m.desc}
                  </div>
                </div>
                <div className="shrink-0">
                  {m.kind === 'bool' && <Toggle on={Boolean(v)} onClick={() => apply({ [m.key]: !v })} label={m.label} />}
                  {m.kind === 'enum' && m.key === 'workbench.colorTheme' && (
                    <ThemeSwatches
                      value={v as ThemeId}
                      onPick={(t) => apply({ 'workbench.colorTheme': t })}
                    />
                  )}
                  {m.kind === 'enum' && m.key !== 'workbench.colorTheme' && (
                    <select
                      value={String(v)}
                      aria-label={m.label}
                      onChange={(e) => apply({ [m.key]: e.target.value } as Partial<Settings>)}
                      className="border border-line bg-abyss px-2 py-1 font-mono text-[11.5px] text-ink outline-none"
                    >
                      {m.options!.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  )}
                  {m.kind === 'number' && (
                    <NumberField
                      value={Number(v)}
                      min={m.min}
                      max={m.max}
                      label={m.label}
                      onCommit={(n) => apply({ [m.key]: n } as Partial<Settings>)}
                    />
                  )}
                </div>
              </div>
            )
          })}
        </div>
        <div className="mt-4 font-mono text-[10px] leading-relaxed text-inkfaint">
          changes write straight into <span className="text-tide">settings.json</span> — open it, break the
          JSON, and watch the Problems tab catch it. that's the deal here.
        </div>
      </div>
    </div>
  )
}
