import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Settings, GitCompare, GitCommitHorizontal, Blocks, Presentation } from 'lucide-react'
import { FileIcon } from './FileIcon'
import { getDir, getFile, parentOf } from '../vfs/fs'
import { store, tabTitle, useIDE } from '../state/store'
import { tt } from '../tourist/copy'

export function Breadcrumbs({ path }: { path: string }) {
  const [dropAt, setDropAt] = useState<number | null>(null)
  const isTourist = useIDE((s) => s.settings['kushal.jargon'] === 'tourist')
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (dropAt === null) return
    // outside-click only — an unguarded close unmounts the menu on its own
    // mousedown, so the click never lands and every sibling is a dead item
    const close = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setDropAt(null)
    }
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [dropAt])

  // pseudo-tabs get a minimal trail
  if (path === 'ui:settings') {
    return (
      <div className="flex h-7 select-none items-center gap-1 border-b border-line bg-chrome px-3 font-mono text-[11px] text-inkdim">
        <Settings size={11} className="text-inkfaint" />
        <span className="text-inkfaint">kushal</span>
        <span className="text-inkfaint">›</span>
        <span className="text-ink">Settings</span>
      </div>
    )
  }
  if (path.startsWith('diff:')) {
    return (
      <div className="flex h-7 select-none items-center gap-1 border-b border-line bg-chrome px-3 font-mono text-[11px] text-inkdim">
        <GitCompare size={11} className="text-inkfaint" />
        <span className="text-inkfaint">git</span>
        <span className="text-inkfaint">›</span>
        <span className="text-ink">{tabTitle(path)}</span>
      </div>
    )
  }
  if (path.startsWith('commit:')) {
    return (
      <div className="flex h-7 select-none items-center gap-1 border-b border-line bg-chrome px-3 font-mono text-[11px] text-inkdim">
        <GitCommitHorizontal size={11} className="text-inkfaint" />
        <span className="text-inkfaint">git show</span>
        <span className="text-inkfaint">›</span>
        <span className="text-ink">{path.slice(7)}</span>
      </div>
    )
  }
  if (path === 'ui:slides') {
    return (
      <div className="flex h-7 select-none items-center gap-1 border-b border-line bg-chrome px-3 font-mono text-[11px] text-inkdim">
        <Presentation size={11} className="text-inkfaint" />
        <span className="text-inkfaint">kushal</span>
        <span className="text-inkfaint">›</span>
        <span className="text-ink">deck</span>
        <span className="ml-auto text-[9px] text-inkfaint">← → space · esc to close</span>
      </div>
    )
  }
  if (path.startsWith('ui:ext/')) {
    return (
      <div className="flex h-7 select-none items-center gap-1 border-b border-line bg-chrome px-3 font-mono text-[11px] text-inkdim">
        <Blocks size={11} className="text-inkfaint" />
        <span className="text-inkfaint">extensions</span>
        <span className="text-inkfaint">›</span>
        <span className="text-ink">{path.slice(7)}</span>
      </div>
    )
  }
  if (path.startsWith('untitled:')) {
    return (
      <div className="flex h-7 select-none items-center gap-1 border-b border-line bg-chrome px-3 font-mono text-[11px] text-inkdim">
        <span className="text-inkfaint">untitled/</span>
        <span className="text-inkfaint">›</span>
        <span className="text-ink">{tabTitle(path)}</span>
      </div>
    )
  }

  const parts = path.split('/')
  const file = getFile(path)
  const siblingsOf = (i: number) => {
    const dirPath = i === 0 ? '' : parts.slice(0, i).join('/')
    return getDir(dirPath)?.children ?? []
  }

  return (
    <div ref={wrapRef} className="relative flex h-7 select-none items-center gap-1 border-b border-line bg-chrome px-3 font-mono text-[11px] text-inkdim">
      {isTourist && <span className="mr-1 text-inkfaint">you are here:</span>}
      <span className="text-inkfaint">portfolio</span>
      {parts.map((p, i) => {
        const last = i === parts.length - 1
        const sibs = siblingsOf(i).filter((s) => s.path !== path)
        return (
          <span key={i} className="relative flex items-center gap-1">
            <span className="text-inkfaint">›</span>
            {last && file ? (
              <button
                onClick={() => setDropAt(dropAt === i ? null : i)}
                className="flex items-center gap-1 text-ink hover:text-ember"
              >
                <FileIcon ext={file.ext} size={12} />
                {p}
                <ChevronDown size={9} className="text-inkfaint" />
              </button>
            ) : (
              <button onClick={() => setDropAt(dropAt === i ? null : i)} className="hover:text-ink">
                {p}
              </button>
            )}
            {dropAt === i && sibs.length > 0 && (
              <div className="fadein absolute left-0 top-full z-50 mt-0.5 min-w-[170px] border border-line bg-chrome py-1 shadow-[0_8px_24px_rgba(0,0,0,0.5)]">
                {sibs.map((sib) => (
                  <button
                    key={sib.path}
                    onClick={() => {
                      setDropAt(null)
                      // dirs land on the explorer — setView would toggle it
                      // shut when it's already open; revealInExplorer forces
                      if (sib.type === 'file') store.getState().openFile(sib.path)
                      else store.getState().revealInExplorer(sib.path)
                    }}
                    className="flex w-full items-center gap-2 px-3 py-1 text-left font-mono text-[11px] text-inkdim hover:bg-raised hover:text-ink"
                  >
                    {sib.type === 'file' ? <FileIcon ext={sib.ext} size={11} /> : <span className="text-tide">▸</span>}
                    {sib.name}
                  </button>
                ))}
                <div className="mx-2 my-1 border-t border-line" />
                <div className="px-3 py-0.5 font-mono text-[9px] text-inkfaint">siblings in {parentOf(path) || '~'}</div>
              </div>
            )}
          </span>
        )
      })}
      <span className="ml-auto hidden items-center gap-2 text-[9px] text-inkfaint sm:flex">
        <span>{tt('hover a symbol — kushal-ls knows it', 'dotted words hover — they know things')}</span>
      </span>
    </div>
  )
}
