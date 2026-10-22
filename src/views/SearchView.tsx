import { useEffect, useMemo, useState } from 'react'
import { CaseSensitive, Regex, Replace } from 'lucide-react'
import { search, SEARCH_CAP } from '../vfs/fs'
import type { SearchHit } from '../vfs/fs'
import { getFile } from '../vfs/fs'
import { useIDE } from '../state/store'
import { FileIcon } from '../editor/FileIcon'

function highlight(text: string, q: string, caseSensitive: boolean, regex: boolean) {
  if (!q) return text
  try {
    const re = regex
      ? new RegExp(`(${q})`, caseSensitive ? 'g' : 'gi')
      : new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, caseSensitive ? 'g' : 'gi')
    const parts = text.split(re)
    return parts.map((p, i) =>
      i % 2 === 1 ? (
        <mark key={i} className="bg-ember/25 text-ember">
          {p}
        </mark>
      ) : (
        <span key={i}>{p}</span>
      ),
    )
  } catch {
    return text
  }
}

export function SearchView() {
  const [q, setQ] = useState('')
  const [cs, setCs] = useState(false)
  const [rx, setRx] = useState(false)
  const openFile = useIDE((s) => s.openFile)
  const seed = useIDE((s) => s.searchSeed)
  const fileContents = useIDE((s) => s.fileContents)
  const baselines = useIDE((s) => s.baselines)

  // peek-references lands here with a prefilled query — the input update is
  // derived state (adjust during render); the store clear is a real side effect
  const [lastSeed, setLastSeed] = useState(seed)
  if (seed !== lastSeed) {
    setLastSeed(seed)
    if (seed) setQ(seed)
  }
  useEffect(() => {
    if (seed) useIDE.getState().setSearchSeed(null)
  }, [seed])

  const hits = useMemo(
    () => search(q, { caseSensitive: cs, regex: rx }, { ...baselines, ...fileContents }),
    [q, cs, rx, fileContents, baselines],
  )
  const grouped = useMemo(() => {
    const m = new Map<string, SearchHit[]>()
    for (const h of hits) {
      const arr = m.get(h.path) ?? []
      arr.push(h)
      m.set(h.path, arr)
    }
    return [...m.entries()]
  }, [hits])

  const toggle = 'flex h-5 w-5 items-center justify-center rounded-sm text-inkfaint hover:text-ink'
  const toggleOn = 'bg-raised text-ember hover:text-ember'

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-1 p-2">
        <div className="flex min-w-0 flex-1 items-center gap-1 border border-line bg-abyss px-2 py-1">
          <input
            id="search-files-input"
            name="search-files-input"
            value={q}
            aria-label="search files"
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search"
            className="min-w-0 flex-1 bg-transparent font-mono text-[12px] text-ink outline-none placeholder:text-inkfaint"
            autoCapitalize="off"
            spellCheck={false}
          />
          <button title="match case" aria-label="match case" aria-pressed={cs} onClick={() => setCs(!cs)} className={`${toggle} ${cs ? toggleOn : ''}`}>
            <CaseSensitive size={13} />
          </button>
          <button title="regex" aria-label="regex" aria-pressed={rx} onClick={() => setRx(!rx)} className={`${toggle} ${rx ? toggleOn : ''}`}>
            <Regex size={13} />
          </button>
        </div>
        <button
          title="replace (dreams only)"
          aria-label="replace"
          onClick={() => useIDE.getState().toast('replace what? it is already optimal', 'info')}
          className="text-inkfaint hover:text-inkdim"
        >
          <Replace size={14} />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-1 pb-2">
        {q && (
          <div role="status" aria-live="polite" className="px-2 py-1 font-mono text-[10.5px] text-inkfaint">
            {hits.length === SEARCH_CAP ? `${SEARCH_CAP}+ matches — first ${SEARCH_CAP} shown` : `${hits.length} match${hits.length === 1 ? '' : 'es'}`} across {grouped.length} file{grouped.length === 1 ? '' : 's'}
          </div>
        )}
        {grouped.map(([path, fileHits]) => {
          const f = getFile(path)
          return (
            <div key={path} className="mb-1">
              <div className="flex items-center gap-1.5 px-2 py-1 font-mono text-[11.5px] text-ink">
                {f && <FileIcon ext={f.ext} size={12} />}
                <span className="truncate">{path}</span>
                <span className="ml-auto text-[10px] text-inkfaint">{fileHits.length}</span>
              </div>
              {fileHits.slice(0, 8).map((h, i) => (
                <button
                  key={i}
                  onClick={() => openFile(path, { line: h.line, mode: 'raw' })}
                  className="block w-full truncate px-6 py-[2px] text-left font-mono text-[11px] text-inkdim transition-colors hover:bg-raised hover:text-ink"
                >
                  <span className="mr-2 text-inkfaint">{h.line}</span>
                  {highlight(h.text.slice(0, 90), q, cs, rx)}
                </button>
              ))}
              {fileHits.length > 8 && (
                <div className="px-6 py-[2px] font-mono text-[10px] text-inkfaint">… {fileHits.length - 8} more in this file</div>
              )}
            </div>
          )
        })}
        {!q && (
          <div className="px-3 py-4 font-mono text-[11px] leading-relaxed text-inkfaint">
            searches everything — project writeups, experience, dotfiles.
            <br />
            <br />
            try: <button className="text-tide hover:underline" onClick={() => setQ('rust')}>rust</button>
            {' · '}
            <button className="text-tide hover:underline" onClick={() => setQ('prisma')}>prisma</button>
            {' · '}
            <button className="text-tide hover:underline" onClick={() => setQ('hire')}>hire</button>
          </div>
        )}
      </div>
    </div>
  )
}
