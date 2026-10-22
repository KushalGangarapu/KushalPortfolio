import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { ChevronRight, ChevronDown, FolderClosed, FolderOpen, Heading1, Heading2, Heading3 } from 'lucide-react'
import { useIDE, store, isDirty, isDirtyPath, getActiveTab, tabTitle } from '../state/store'
import { getDir, getFile } from '../vfs/fs'
import { SECRET_FILES } from '../vfs/secrets'
import type { VNode } from '../vfs/types'
import { FileIcon } from '../editor/FileIcon'

const SECRET_PATHS = new Set(SECRET_FILES.map((s) => s.path))

/** dirs on the reveal target's ancestor chain — forced live plus every dir
    a reveal ever opened (stays open until the user collapses it) */
const RevealCtx = createContext<ReadonlySet<string>>(new Set())

function TreeNode({ node, depth }: { node: VNode; depth: number }) {
  const forced = useContext(RevealCtx)
  // null = follow default+reveal; boolean = the user's explicit choice —
  // collapses must stick even over a dir a reveal opened
  const [userChoice, setUserChoice] = useState<boolean | null>(null)
  const activeTab = useIDE(getActiveTab)
  const fileContents = useIDE((s) => s.fileContents)
  const baselines = useIDE((s) => s.baselines)
  const openFile = useIDE((s) => s.openFile)
  const mobile = useIDE((s) => s.mobile)
  const pad = { paddingLeft: 8 + depth * 12 }
  const isSecret = SECRET_PATHS.has(node.path)

  const onFileContext = (e: React.MouseEvent, path: string) => {
    e.preventDefault()
    const s = store.getState()
    s.setCtxMenu({
      x: e.clientX,
      y: e.clientY,
      items: [
        { label: 'Open', action: () => s.openFile(path) },
        { label: 'Open to the Side', shortcut: 'Ctrl+\\', action: () => s.splitRight(path), disabled: s.panes.length >= 2 },
        { sep: true, label: '', action: () => {} },
        { label: 'Copy Path', action: () => { void navigator.clipboard?.writeText(path).then(() => s.toast(`copied: ${path}`, 'ok')).catch(() => s.toast('copy failed — clipboard refused', 'warn')) } },
        { label: 'Open Diff (your edits)', action: () => s.openFile(`diff:${path}`), disabled: !isDirtyPath(s, path) },
        { sep: true, label: '', action: () => {} },
        { label: 'Delete', action: () => s.toast('delete is disabled. the files have tenure.', 'warn') },
      ],
    })
  }

  if (node.type === 'dir') {
    const isOpen = userChoice ?? (depth < 2 || forced.has(node.path))
    return (
      <div>
        <button
          onClick={() => setUserChoice(!isOpen)}
          style={pad}
          role="treeitem"
          aria-expanded={isOpen}
          aria-level={depth + 1}
          aria-selected={false}
          className="flex w-full items-center gap-1 py-[3px] text-left font-mono text-[12px] text-inkdim transition-colors hover:bg-raised hover:text-ink"
        >
          {isOpen ? <ChevronDown size={12} className="shrink-0 text-inkfaint" /> : <ChevronRight size={12} className="shrink-0 text-inkfaint" />}
          {isOpen ? <FolderOpen size={13} className="shrink-0 text-tide" /> : <FolderClosed size={13} className="shrink-0 text-tide" />}
          <span className="truncate">{node.name === '' ? 'portfolio' : node.name}</span>
        </button>
        {isOpen && (
          <div role="group">
            {(getDir(node.path)?.children ?? node.children).map((c) => (
              <TreeNode key={c.path} node={c} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    )
  }

  const dirty = isDirty({ fileContents, baselines }, node)
  const active = activeTab === node.path
  const dot = node.name.startsWith('.')
  return (
    <button
      onClick={() => openFile(node.path)}
      onContextMenu={(e) => onFileContext(e, node.path)}
      // html5 drag is a desktop interaction — on touch it hijacks long-press
      draggable={!mobile}
      onDragStart={(e) => {
        e.dataTransfer.setData('kushal/file', node.path)
        e.dataTransfer.effectAllowed = 'copyMove'
      }}
      style={pad}
      data-tree-path={node.path}
      role="treeitem"
      aria-level={depth + 1}
      aria-selected={active}
      title={isSecret ? 'unlocked — you found this' : node.path}
      className={`fadein flex w-full items-center gap-1 py-[3px] text-left font-mono text-[12px] transition-colors ${
        active ? 'bg-raised text-ink' : `${dot ? 'text-inkfaint' : 'text-inkdim'} hover:bg-raised hover:text-ink`
      }`}
    >
      <span className="w-3 shrink-0" />
      <FileIcon ext={node.ext} />
      <span className="truncate">{node.name}</span>
      {isSecret && <span className="ml-1 text-[9px] text-violet">◆</span>}
      {dirty && <span className="ml-auto mr-1 h-1.5 w-1.5 shrink-0 rounded-full bg-ember" />}
    </button>
  )
}

/** outline of the active markdown file — headings jump to source lines */
function Outline() {
  const activeTab = useIDE(getActiveTab)
  const fileContents = useIDE((s) => s.fileContents)

  const headings = useMemo(() => {
    const f = activeTab ? getFile(activeTab) : null
    if (!f || f.kind !== 'md') return []
    const s = store.getState()
    const src = fileContents[f.path] ?? s.baselines[f.path] ?? f.original
    const out: { level: number; text: string; line: number }[] = []
    src.split('\n').forEach((l, i) => {
      const m = /^(#{1,3})\s+(.*)$/.exec(l)
      if (m) out.push({ level: m[1].length, text: m[2].replace(/[*`]/g, ''), line: i + 1 })
    })
    return out
  }, [activeTab, fileContents])

  if (!headings.length) return null
  const HIcon = [Heading1, Heading2, Heading3]
  return (
    <div className="mt-1 border-t border-line pt-1">
      <div className="px-3 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-inkfaint">
        outline — {activeTab?.split('/').pop()}
      </div>
      {headings.map((h) => {
        const Icon = HIcon[Math.min(h.level, 3) - 1]
        return (
          <button
            key={h.line}
            onClick={() => store.getState().openFile(activeTab!, { line: h.line, mode: 'raw' })}
            style={{ paddingLeft: 10 + (h.level - 1) * 10 }}
            className="flex w-full items-center gap-1.5 py-[2.5px] pr-2 text-left font-mono text-[11px] text-inkdim transition-colors hover:bg-raised hover:text-ink"
            title={`line ${h.line}`}
          >
            <Icon size={10} className="shrink-0 text-inkfaint" />
            <span className="truncate">{h.text}</span>
          </button>
        )
      })}
    </div>
  )
}

export function Explorer() {
  const panes = useIDE((s) => s.panes)
  const activePane = useIDE((s) => s.activePane)
  const activateTab = useIDE((s) => s.activateTab)
  const fileContents = useIDE((s) => s.fileContents)
  const virtualFiles = useIDE((s) => s.virtualFiles)
  const baselines = useIDE((s) => s.baselines)
  useIDE((s) => s.unlocked) // re-render the tree when a secret file reveals

  const allTabs = panes.flatMap((p) => p.tabs.map((t) => ({ path: t, pane: p.id })))
  const rootChildren = getDir('')?.children ?? []

  // "reveal in explorer" — force-open every dir on the target's ancestor
  // chain, then scroll the row into view once it's mounted
  const revealPath = useIDE((s) => s.revealPath)
  const revealedDirs = useIDE((s) => s.revealedDirs)
  const revealDirs = useMemo(() => {
    const set = new Set<string>()
    const add = (p: string) => {
      const parts = p.split('/')
      for (let i = 1; i < parts.length; i++) set.add(parts.slice(0, i).join('/'))
    }
    if (revealPath) add(revealPath)
    // sticky: once a reveal opens a chain it stays open until the user
    // collapses it — the transient revealPath only lives one frame
    for (const p of revealedDirs) add(p)
    return set
  }, [revealPath, revealedDirs])
  useEffect(() => {
    if (!revealPath) return
    const t = requestAnimationFrame(() => {
      document.querySelector(`[data-tree-path="${CSS.escape(revealPath)}"]`)?.scrollIntoView({ block: 'center' })
      // consume the transient signal — but the dirs a reveal opened join the
      // sticky set, or a user-collapsed ancestor would flash open for one
      // frame then snap shut, hiding the file it just revealed
      useIDE.setState((s) => ({
        revealPath: null,
        revealedDirs: s.revealedDirs.includes(revealPath)
          ? s.revealedDirs
          : [...s.revealedDirs, revealPath],
      }))
    })
    return () => cancelAnimationFrame(t)
  }, [revealPath])

  return (
    <div className="flex h-full flex-col overflow-y-auto py-1">
      {allTabs.length > 0 && (
        <div className="mb-2">
          <div className="px-3 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-inkfaint">
            open editors
          </div>
          {allTabs.map(({ path, pane }) => {
            const active = panes.find((p) => p.id === pane)?.active === path && pane === activePane
            const dirty = isDirtyPath({ fileContents, virtualFiles, baselines }, path)
            const multi = panes.length > 1
            return (
              <button
                key={pane + path}
                onClick={() => activateTab(path, pane)}
                className={`flex w-full items-center gap-1.5 px-3 py-[3px] text-left font-mono text-[12px] ${
                  active ? 'text-ink' : 'text-inkdim hover:text-ink'
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${dirty ? 'bg-ember' : 'bg-transparent'}`} />
                <span className="truncate">{tabTitle(path)}</span>
                {multi && <span className="ml-auto text-[8.5px] text-inkfaint">{pane === panes[0].id ? '◧' : '◨'}</span>}
              </button>
            )
          })}
          <div className="mx-2 my-2 border-t border-line" />
        </div>
      )}
      <div className="px-3 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-inkfaint" id="explorer-label">
        portfolio
      </div>
      <div role="tree" aria-labelledby="explorer-label">
        <RevealCtx.Provider value={revealDirs}>
          {rootChildren.map((c) => (
            <TreeNode key={c.path} node={c} depth={0} />
          ))}
        </RevealCtx.Provider>
      </div>
      <div className="mt-auto">
        <Outline />
      </div>
    </div>
  )
}
