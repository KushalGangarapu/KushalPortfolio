import { useRef } from 'react'
import { X, Plus } from 'lucide-react'
import { useIDE, store, isDirtyPath, tabTitle, tabExt } from '../state/store'
import { copyToClipboard } from '../lib/clipboard'
import type { Pane } from '../state/store'
import { FileIcon } from '../editor/FileIcon'
import { parseTabDrag } from './dnd'

function tabGlyph(path: string) {
  if (path === 'ui:settings') return '⚙'
  if (path === 'ui:slides') return '◫'
  if (path.startsWith('diff:')) return '±'
  if (path.startsWith('commit:')) return '⎇'
  if (path.startsWith('ui:ext')) return '◈'
  return null
}

const pseudo = (p: string) =>
  p.startsWith('ui:') || p.startsWith('diff:') || p.startsWith('untitled:') || p.startsWith('commit:')

export function TabBar({ pane, mobile }: { pane: Pane; mobile?: boolean }) {
  const activePane = useIDE((s) => s.activePane)
  const fileContents = useIDE((s) => s.fileContents)
  const virtualFiles = useIDE((s) => s.virtualFiles)
  const baselines = useIDE((s) => s.baselines)
  const activateTab = useIDE((s) => s.activateTab)
  const closeTab = useIDE((s) => s.closeTab)
  const moveTab = useIDE((s) => s.moveTab)
  const setPaletteOpen = useIDE((s) => s.setPaletteOpen)
  const setActivePane = useIDE((s) => s.setActivePane)
  const setCtxMenu = useIDE((s) => s.setCtxMenu)
  const dragIdx = useRef<number | null>(null)

  const active = pane.id === activePane

  const onTabContext = (e: React.MouseEvent, path: string) => {
    e.preventDefault()
    const s = store.getState()
    const tabs = pane.tabs
    const idx = tabs.indexOf(path)
    setCtxMenu({
      x: e.clientX,
      y: e.clientY,
      items: [
        { label: 'Close', action: () => closeTab(path, pane.id) },
        { label: 'Close Others', action: () => s.closeOtherTabs(path, pane.id), disabled: tabs.length < 2 },
        { label: 'Close to the Right', action: () => {
            const s2 = store.getState()
            for (const t of tabs.slice(idx + 1)) s2.closeTab(t, pane.id)
          }, disabled: idx >= tabs.length - 1 },
        { label: 'Close All', action: () => s.closeAllTabs(pane.id) },
        { sep: true, label: '', action: () => {} },
        { label: 'Copy Path', action: () => { void copyToClipboard(path).then((ok) => { if (ok) s.toast(`copied: ${path}`, 'ok'); else s.toast('clipboard refused', 'warn') }) } },
        { label: 'Copy Deep Link', action: () => { void copyToClipboard(`${location.origin}${location.pathname}#/file/${encodeURIComponent(path)}`).then((ok) => { if (ok) s.toast('deep link copied', 'ok'); else s.toast('clipboard refused', 'warn') }) }, disabled: pseudo(path) },
        { label: 'Reveal in Explorer', action: () => { s.revealInExplorer(path) }, disabled: pseudo(path) },
        { label: 'Revert File', action: () => { s.revertFile(path); s.toast(`reverted ${path}`, 'ok') }, disabled: !isDirtyPath(store.getState(), path) || pseudo(path) },
        { sep: true, label: '', action: () => {} },
        { label: 'Split Right', shortcut: 'Ctrl+\\', action: () => s.splitRight(path), disabled: s.panes.length >= 2 },
      ],
    })
  }

  return (
    <div
      className={`flex h-9 shrink-0 items-stretch overflow-hidden border-b bg-chrome ${active ? 'border-line' : 'border-line/60'}`}
      onClick={() => { if (!active) setActivePane(pane.id) }}
    >
      <div
        role="tablist"
        aria-label="open editors"
        aria-orientation="horizontal"
        className="flex min-w-0 flex-1 items-stretch overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {pane.tabs.map((path, i) => {
          const isActive = path === pane.active
          const dirty = isDirtyPath({ fileContents, virtualFiles, baselines }, path)
          const glyph = tabGlyph(path)
          return (
            <div
              key={path}
              role="tab"
              aria-selected={isActive}
              aria-label={`${tabTitle(path)}${dirty ? ', unsaved changes' : ''}`}
              tabIndex={isActive ? 0 : -1}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  activateTab(path, pane.id)
                  return
                }
                if (e.key === 'ArrowRight' || e.key === 'ArrowLeft' || e.key === 'Home' || e.key === 'End') {
                  e.preventDefault()
                  const list = e.currentTarget.closest('[role=tablist]')
                  if (!list) return
                  const tabs = [...list.querySelectorAll<HTMLElement>('[role=tab]')]
                  const cur = tabs.indexOf(e.currentTarget)
                  const next =
                    e.key === 'Home' ? tabs[0]
                    : e.key === 'End' ? tabs[tabs.length - 1]
                    : tabs[(cur + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length]
                  next?.focus()
                  next?.click()
                }
              }}
              draggable={!mobile}
              onDragStart={(e) => {
                dragIdx.current = i
                e.dataTransfer.setData('kushal/tab', JSON.stringify({ pane: pane.id, idx: i }))
              }}
              // only advertise a drop we can consume — an explorer file
              // dragged over the strip would otherwise silently no-op
              onDragOver={(e) => {
                if (e.dataTransfer.types.includes('kushal/tab')) e.preventDefault()
              }}
              onDrop={(e) => {
                // stop the drop from bubbling to the pane container — one
                // drop must not fire a reorder here AND a pane-move above
                e.preventDefault()
                e.stopPropagation()
                const d = parseTabDrag(e.dataTransfer.getData('kushal/tab'))
                if (d) {
                  if (d.pane === pane.id) {
                    if (d.idx !== i) moveTab(pane.id, d.idx, i)
                  } else {
                    store.getState().moveTabToPane(d.pane, d.idx, pane.id)
                  }
                }
                dragIdx.current = null
              }}
              onClick={() => activateTab(path, pane.id)}
              onAuxClick={(e) => {
                if (e.button === 1) closeTab(path, pane.id)
              }}
              onContextMenu={(e) => onTabContext(e, path)}
              className={`group flex min-w-0 cursor-pointer select-none items-center gap-1.5 border-r border-line px-3 font-mono text-[12px] focus-visible:outline focus-visible:outline-1 focus-visible:outline-ember ${
                isActive
                  ? 'border-t-2 border-t-ember bg-abyss text-ink'
                  : 'border-t-2 border-t-transparent text-inkdim hover:bg-raised'
              }`}
            >
              {glyph ? <span className="text-[10px] text-inkdim">{glyph}</span> : <FileIcon ext={tabExt(path)} />}
              <span className={`max-w-[140px] truncate ${dirty ? 'italic' : ''}`}>{tabTitle(path)}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  closeTab(path, pane.id)
                }}
                className={`ml-0.5 rounded-sm p-0.5 transition-colors hover:bg-line ${
                  dirty ? 'text-ember' : 'text-inkfaint opacity-0 group-hover:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-70'
                }`}
                title={dirty ? 'unsaved changes' : 'close'}
              >
                {dirty ? <span className="block h-2.5 w-2.5 rounded-full bg-ember" /> : <X size={12} />}
              </button>
            </div>
          )
        })}
      </div>
      <button
        onClick={() => setPaletteOpen(true)}
        title="open file (Ctrl+K)"
        className="flex w-9 shrink-0 items-center justify-center text-inkfaint transition-colors hover:bg-raised hover:text-ink"
      >
        <Plus size={15} />
      </button>
    </div>
  )
}

