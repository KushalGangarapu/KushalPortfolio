import { GitCommitHorizontal, FileText, Tag } from 'lucide-react'
import { COMMITS, BRANCH_COLORS, BRANCH_NAMES, LANE_VISITOR } from '../vfs/gitdata'
import { store, useIDE } from '../state/store'
import { getFile } from '../vfs/fs'

/** `commit:<hash>` pseudo-tab — git show, but it's a page */
export function CommitView({ hash }: { hash: string }) {
  const visitorCommits = useIDE((s) => s.visitorCommits)
  const virtualFiles = useIDE((s) => s.virtualFiles)
  const c =
    COMMITS.find((x) => x.hash === hash || x.hash.startsWith(hash)) ??
    visitorCommits.find((x) => x.hash === hash || x.hash.startsWith(hash))

  if (!c) {
    return (
      <div className="flex h-full items-center justify-center font-mono text-[12px] text-inkfaint">
        commit {hash} — lost to history (or never existed)
      </div>
    )
  }

  const visitor = 'lane' in c ? c.lane === LANE_VISITOR : true
  const lane = 'lane' in c ? c.lane : LANE_VISITOR
  const files = c.files ?? []

  return (
    <div className="h-full overflow-y-auto bg-abyss">
      <div className="mx-auto max-w-[680px] px-8 py-8 font-mono">
        <div className="mb-1 flex items-center gap-2 text-[11px] text-inkfaint">
          <GitCommitHorizontal size={13} />
          <span style={{ color: BRANCH_COLORS[lane] }}>{BRANCH_NAMES[lane]}</span>
          {('tag' in c && c.tag) && (
            <span className="flex items-center gap-1 border border-ember/50 px-1.5 py-0.5 text-[9.5px] text-ember">
              <Tag size={9} /> {c.tag}
            </span>
          )}
        </div>
        <div className={`text-[15px] ${visitor ? 'text-violet' : 'text-ember'}`}>commit {c.hash}</div>
        <div className="mt-1 text-[11px] text-inkfaint">
          Author: {visitor ? 'you <visitor@localhost>' : 'Kushal Gangarapu <smileykushal@gmail.com>'}
        </div>
        <div className="text-[11px] text-inkfaint">
          Date: {'time' in c && typeof c.time === 'number' ? new Date(c.time).toLocaleString() : ('date' in c ? c.date : 'recently')}
        </div>

        <div className="mt-5 text-[13.5px] text-ink">{c.msg}</div>
        {'body' in c && c.body && <div className="mt-2 text-[12px] leading-relaxed text-inkdim">{c.body}</div>}

        {files.length > 0 && (
          <div className="mt-6 border-t border-line pt-4">
            <div className="mb-2 text-[10px] uppercase tracking-[0.14em] text-inkfaint">
              files touched ({files.length})
            </div>
            {files.map((f) => {
              // untitled: paths must actually still exist — a deleted draft
              // marked "(gone)" must not materialize a ghost on click
              const exists = f.startsWith('untitled:') ? f in virtualFiles : !!getFile(f)
              return (
                <button
                  key={f}
                  onClick={() => exists && store.getState().openFile(f)}
                  disabled={!exists}
                  className={`flex items-center gap-2 py-1 text-[12px] ${
                    exists ? 'text-tide hover:text-ember hover:underline' : 'cursor-default text-inkfaint'
                  }`}
                >
                  <FileText size={11} />
                  {f}
                  {!exists && <span className="text-[9.5px]">(gone)</span>}
                </button>
              )
            })}
          </div>
        )}

        {'diff' in c && c.diff && (
          <div className="mt-6 border-t border-line pt-4">
            <div className="mb-2 text-[10px] uppercase tracking-[0.14em] text-inkfaint">the diff, narrated</div>
            <div className="border border-line bg-chrome px-3 py-2 text-[11.5px] leading-relaxed">
              {c.diff.map((d, i) => (
                <div key={i} className={d.startsWith('+') ? 'text-sage' : 'text-rust'}>
                  {d}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-10 border-t border-dashed border-line pt-3 text-[10px] text-inkfaint">
          git show {c.hash} · rendered by the graph · the lane never lies
        </div>
      </div>
    </div>
  )
}
