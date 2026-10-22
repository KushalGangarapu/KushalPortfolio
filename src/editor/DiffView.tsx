import { useMemo } from 'react'
import { GitCompare } from 'lucide-react'
import { useIDE } from '../state/store'
import { getFile } from '../vfs/fs'
import { hunks } from '../vfs/diff'

export function DiffView({ path }: { path: string }) {
  const fileContents = useIDE((s) => s.fileContents)
  const virtualFiles = useIDE((s) => s.virtualFiles)
  const baselines = useIDE((s) => s.baselines)
  // untitled drafts diff too — a/ is their committed baseline (or the empty
  // draft), b/ is the live buffer
  const untitled = path.startsWith('untitled:')
  const file = getFile(path)
  const name = untitled ? path.slice(9) : file?.path
  const edited = fileContents[path]
  const original = untitled
    ? (baselines[path] ?? virtualFiles[path] ?? '')
    : (baselines[path] ?? file?.original ?? '')
  const current = edited ?? original

  const hk = useMemo(() => hunks(original, current), [original, current])

  if (!file && !untitled) {
    return <div className="p-6 font-mono text-[12px] text-inkfaint">diff source evaporated.</div>
  }

  return (
    <div className="h-full overflow-auto">
      <div className="flex items-center gap-2 border-b border-line bg-chrome px-4 py-1.5 font-mono text-[11px] text-inkdim">
        <GitCompare size={12} className="text-tide" />
        <span className="text-rust">a/{name}</span>
        <span className="text-inkfaint">→</span>
        <span className="text-sage">b/{name}</span>
        <span className="ml-auto text-inkfaint">unified · your edits vs HEAD</span>
      </div>
      {hk.length === 0 ? (
        <div className="flex h-40 flex-col items-center justify-center gap-2 font-mono text-[12px] text-inkfaint">
          <span>no changes</span>
          <span className="text-[10px]">edit the file and this view wakes up</span>
        </div>
      ) : (
        <div className="py-2 font-mono text-[11.5px] leading-[1.55]">
          {hk.map((h, hi) => (
            <div key={hi}>
              <div className="bg-tide/10 px-4 py-0.5 text-tide select-none">
                @@ -{h.oldStart},{h.oldLines} +{h.newStart},{h.newLines} @@
              </div>
              {h.lines.map((l, li) => (
                <div
                  key={li}
                  className={`flex whitespace-pre-wrap px-4 ${
                    l.type === 'add' ? 'bg-sage/10' : l.type === 'del' ? 'bg-rust/10' : ''
                  }`}
                >
                  <span className="w-10 shrink-0 select-none pr-3 text-right text-inkfaint">
                    {l.oldLn ?? ''}
                  </span>
                  <span className="w-10 shrink-0 select-none pr-3 text-right text-inkfaint">
                    {l.newLn ?? ''}
                  </span>
                  <span
                    className={`w-4 shrink-0 select-none ${
                      l.type === 'add' ? 'text-sage' : l.type === 'del' ? 'text-rust' : 'text-inkfaint'
                    }`}
                  >
                    {l.type === 'add' ? '+' : l.type === 'del' ? '−' : ' '}
                  </span>
                  <span className={l.type === 'add' ? 'text-sage' : l.type === 'del' ? 'text-rust' : 'text-inkdim'}>
                    {l.text}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
