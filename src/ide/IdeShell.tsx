import { useState } from 'react'
import { useIDE, store } from '../state/store'
import { TitleBar } from './TitleBar'
import { ActivityBar } from './ActivityBar'
import { Sidebar } from './Sidebar'
import { TabBar } from './TabBar'
import { Panel } from './Panel'
import { GuideBar } from './GuideBar'
import { StatusBar } from './StatusBar'
import { EditorPane } from '../editor/EditorPane'
import { parseTabDrag } from './dnd'

function EditorGroup({ paneId, mobile }: { paneId: string; mobile: boolean }) {
  const pane = useIDE((s) => s.panes.find((p) => p.id === paneId))
  const moveTabToPane = useIDE((s) => s.moveTabToPane)
  const setActivePane = useIDE((s) => s.setActivePane)
  const active = useIDE((s) => s.activePane === paneId)
  const [dropHint, setDropHint] = useState(false)

  if (!pane) return null
  return (
    <div
      className={`relative flex min-w-0 flex-1 flex-col ${active ? '' : 'opacity-[0.97]'}`}
      onClick={() => setActivePane(paneId)}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('kushal/tab') || e.dataTransfer.types.includes('kushal/file')) {
          e.preventDefault()
          setDropHint(true)
        }
      }}
      onDragLeave={() => setDropHint(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDropHint(false)
        const file = e.dataTransfer.getData('kushal/file')
        if (file) {
          store.getState().openFile(file, { pane: paneId })
          return
        }
        const d = parseTabDrag(e.dataTransfer.getData('kushal/tab'))
        if (d && d.pane !== paneId) moveTabToPane(d.pane, d.idx, paneId)
      }}
    >
      <TabBar pane={pane} mobile={mobile} />
      <div className="min-h-0 flex-1">
        <EditorPane paneId={paneId} />
      </div>
      {dropHint && (
        <div className="pointer-events-none absolute inset-0 border-2 border-ember/60 bg-ember/5" />
      )}
    </div>
  )
}

export function IdeShell() {
  const mobile = useIDE((s) => s.mobile)
  const panes = useIDE((s) => s.panes)
  const activePane = useIDE((s) => s.activePane)
  const zen = useIDE((s) => s.zenMode)
  const liteDismissed = useIDE((s) => s.liteDismissed)
  const bannerHidden = useIDE((s) => s.mobileBannerHidden)
  const [splitHint, setSplitHint] = useState(false)

  // mobile: one pane at a time — splits are a desktop luxury
  const shownPanes = mobile ? panes.filter((p) => p.id === activePane) : panes

  return (
    <div className="flex h-full flex-col overflow-hidden bg-abyss text-ink">
      <TitleBar />
      {mobile && liteDismissed && !bannerHidden && (
        <div className="flex shrink-0 items-center gap-2 border-b border-line bg-raised px-3 py-1.5 font-mono text-[10.5px] text-inkdim">
          <span className="min-w-0 flex-1 truncate">this is the raw IDE — the readable page fits phones better</span>
          <button
            onClick={() => store.getState().buildForProduction()}
            className="shrink-0 border border-ember/50 px-2 py-0.5 text-ember"
          >
            readable ↗
          </button>
          <button onClick={() => store.getState().hideMobileBanner()} className="shrink-0 px-1 text-inkfaint" aria-label="dismiss">
            ×
          </button>
        </div>
      )}
      <div className="flex min-h-0 flex-1">
        {!mobile && !zen && <ActivityBar />}
        {!zen && <Sidebar />}
        {/* skip-link target — the editor area */}
        <p id="ide-concept" className="sr-only">
          This is a fictional code editor that is also a portfolio. The left rail switches
          sections: files, search, career graph, skills, achievements. Ctrl+K opens the
          command palette — typing plain words like "resume" or "contact" works.
        </p>
        <div id="main-editor" tabIndex={-1} className="relative flex min-w-0 flex-1 flex-col outline-none" role="main" aria-label="editor" aria-describedby="ide-concept">
          <div className="flex min-h-0 flex-1">
            {shownPanes.map((p, i) => (
              <div key={p.id} className={`flex min-w-0 flex-1 ${i > 0 ? 'border-l border-line' : ''}`}>
                <EditorGroup paneId={p.id} mobile={mobile} />
              </div>
            ))}
            {/* right-edge drop strip → split */}
            {!mobile && panes.length < 2 && (
              <div
                className={`w-2 shrink-0 transition-colors ${splitHint ? 'bg-ember/30' : ''}`}
                onDragOver={(e) => {
                  if (e.dataTransfer.types.includes('kushal/tab') || e.dataTransfer.types.includes('kushal/file')) {
                    e.preventDefault()
                    setSplitHint(true)
                  }
                }}
                onDragLeave={() => setSplitHint(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setSplitHint(false)
                  const file = e.dataTransfer.getData('kushal/file')
                  const s = store.getState()
                  if (file) {
                    // open first so splitRight has a tab to carry over
                    s.openFile(file)
                    s.splitRight(file)
                    return
                  }
                  const d = parseTabDrag(e.dataTransfer.getData('kushal/tab'))
                  if (!d) return
                  const tab = s.panes.find((p) => p.id === d.pane)?.tabs[d.idx]
                  if (tab) s.splitRight(tab)
                }}
              />
            )}
          </div>
          {!zen && <Panel />}
        </div>
      </div>
      {mobile && !zen && <ActivityBar />}
      {!zen && <GuideBar />}
      {!zen && <StatusBar />}
      {zen && (
        <button
          onClick={() => store.getState().toggleZen()}
          className="fixed bottom-3 right-4 z-50 font-mono text-[10px] text-inkfaint/60 transition-colors hover:text-inkdim"
        >
          zen · esc
        </button>
      )}
    </div>
  )
}
