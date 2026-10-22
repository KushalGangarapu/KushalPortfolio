import { useState } from 'react'
import { Star, Download } from 'lucide-react'
import { EXTENSIONS } from '../vfs/extensions'
import { useIDE } from '../state/store'

function Stars({ n }: { n: number }) {
  return (
    <span className="flex items-center gap-px text-ember">
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} size={9} fill={i < n ? 'currentColor' : 'none'} className={i < n ? '' : 'text-inkfaint'} />
      ))}
    </span>
  )
}

export function ExtensionsView() {
  const [q, setQ] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const enabled = useIDE((s) => s.extensionsEnabled)
  const toggleExtension = useIDE((s) => s.toggleExtension)
  const tourist = useIDE((s) => s.settings['kushal.jargon'] === 'tourist')

  const list = EXTENSIONS.filter(
    (e) => !q || e.name.toLowerCase().includes(q.toLowerCase()) || e.desc.toLowerCase().includes(q.toLowerCase()),
  )

  return (
    <div className="flex h-full flex-col">
      <div className="p-2">
        <input
          id="extensions-search"
          name="extensions-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="search extensions"
          placeholder="Search extensions (skills)"
          className="w-full border border-line bg-abyss px-2 py-1 font-mono text-[12px] text-ink outline-none placeholder:text-inkfaint"
          autoCapitalize="off"
          spellCheck={false}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pb-2">
        <div className="px-3 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-inkfaint">
          installed — {list.length}
        </div>
        {list.map((e) => {
          const on = enabled[e.id]
          const open = expanded === e.id
          return (
            <div key={e.id} className={`border-l-2 ${open ? 'border-ember bg-raised/40' : 'border-transparent'}`}>
              <button
                onClick={() => setExpanded(open ? null : e.id)}
                className="flex w-full items-start gap-2 px-3 py-2 text-left transition-colors hover:bg-raised"
              >
                <span
                  className={`mt-0.5 flex h-8 w-8 shrink-0 select-none items-center justify-center border border-line font-mono text-[11px] font-bold ${
                    on ? 'bg-ember/15 text-ember' : 'bg-raised text-inkfaint'
                  }`}
                >
                  {e.name.slice(0, 2)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`flex items-baseline gap-2 font-mono text-[12px] ${on ? 'text-ink' : 'text-inkfaint line-through'}`}>
                    {e.name}
                    <span className="text-[9.5px] font-normal text-inkfaint">v{e.version}</span>
                  </span>
                  <span className={`mt-0.5 block font-mono text-[10.5px] leading-snug ${on ? 'text-inkdim' : 'text-inkfaint'}`}>
                    {tourist && e.plain ? e.plain : e.desc}
                  </span>
                  <span className="mt-1 flex items-center gap-2 font-mono text-[9.5px] text-inkfaint">
                    <Stars n={e.stars} />
                    <span className="flex items-center gap-0.5">
                      <Download size={9} /> {e.installs}
                    </span>
                    <span>kushal</span>
                  </span>
                </span>
              </button>
              {open && (
                <div className="slideup mx-3 mb-2 border border-line bg-abyss px-2.5 py-2">
                  <div className="font-mono text-[10px] text-inkfaint">CHANGELOG</div>
                  <div className="mt-0.5 font-mono text-[10.5px] text-sage">{e.changelog}</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      onClick={() => useIDE.getState().openPseudo(`ui:ext/${e.id}`)}
                      className="border border-tide/50 px-2 py-0.5 font-mono text-[10.5px] text-tide transition-colors hover:bg-tide/10"
                    >
                      details tab
                    </button>
                    <button
                      onClick={() => toggleExtension(e.id)}
                      className={`border px-2 py-0.5 font-mono text-[10.5px] transition-colors ${
                        on
                          ? 'border-rust/50 text-rust hover:bg-rust/10'
                          : 'border-sage/50 text-sage hover:bg-sage/10'
                      }`}
                    >
                      {on ? 'disable' : 'enable'}
                    </button>
                    <button
                      onClick={() => useIDE.getState().toast(`uninstalling ${e.name}… just kidding. it's load-bearing.`, 'info')}
                      className="border border-line px-2 py-0.5 font-mono text-[10.5px] text-inkdim hover:bg-raised"
                    >
                      uninstall
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
        <div className="px-3 py-3 font-mono text-[9.5px] leading-relaxed text-inkfaint">
          skills as extensions — because a 3-column icon grid is a crime.
          disabling one dims it here and in the recruiter build.
        </div>
      </div>
    </div>
  )
}
