import { useIDE } from '../state/store'
import type { SidebarView } from '../state/store'
import { SECTION_TITLES } from '../tourist/copy'
import { Explorer } from '../views/Explorer'
import { SearchView } from '../views/SearchView'
import { GitGraph } from '../views/GitGraph'
import { ExtensionsView } from '../views/ExtensionsView'
import { RunDebug } from '../views/RunDebug'
import { AchievementsView } from '../views/AchievementsView'
import { X } from 'lucide-react'

const META: Record<SidebarView, { title: string; el: React.ReactNode }> = {
  explorer: { title: 'Explorer', el: <Explorer /> },
  search: { title: 'Search', el: <SearchView /> },
  git: { title: 'Source Control', el: <GitGraph /> },
  run: { title: 'Run and Debug', el: <RunDebug /> },
  extensions: { title: 'Extensions', el: <ExtensionsView /> },
  achievements: { title: 'Achievements', el: <AchievementsView /> },
}

export function Sidebar() {
  const activeView = useIDE((s) => s.activeView)
  const sidebarOpen = useIDE((s) => s.sidebarOpen)
  const sidebarWidth = useIDE((s) => s.sidebarWidth)
  const setSidebarWidth = useIDE((s) => s.setSidebarWidth)
  const mobile = useIDE((s) => s.mobile)
  const toggleSidebar = useIDE((s) => s.toggleSidebar)
  const isTourist = useIDE((s) => s.settings['kushal.jargon'] === 'tourist')

  if (!sidebarOpen) return null
  const { el } = META[activeView]
  const title = SECTION_TITLES[activeView][isTourist ? 1 : 0]

  const startDrag = (e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startW = sidebarWidth
    const move = (ev: MouseEvent) => setSidebarWidth(startW + (ev.clientX - startX))
    const up = () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  const inner = (
    <div
      className={`flex h-full flex-col ${mobile ? 'w-[280px] border-r border-line bg-chrome shadow-[8px_0_24px_rgba(0,0,0,0.5)]' : ''}`}
      style={mobile ? undefined : { width: sidebarWidth }}
    >
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-line px-3">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-inkfaint">{title}</span>
        {mobile && (
          <button onClick={toggleSidebar} aria-label="close sidebar" className="text-inkfaint hover:text-ink">
            <X size={14} />
          </button>
        )}
      </div>
      <div className="min-h-0 flex-1">{el}</div>
    </div>
  )

  if (mobile) {
    // z-40 — the status bar (z-30) must not paint over the drawer
    return (
      <div className="fadein fixed inset-0 z-40 bg-black/40" onClick={toggleSidebar}>
        <div className="slideup h-full" onClick={(e) => e.stopPropagation()}>
          {inner}
        </div>
      </div>
    )
  }
  return (
    <aside aria-label={title} className="relative shrink-0 border-r border-line bg-chrome">
      {inner}
      {/* right-edge drag — resizable by mouse AND arrows, like a real IDE's */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="resize sidebar — arrow keys"
        aria-valuenow={sidebarWidth}
        aria-valuemin={180}
        aria-valuemax={420}
        tabIndex={0}
        onMouseDown={startDrag}
        onKeyDown={(e) => {
          const step = e.shiftKey ? 40 : 12
          if (e.key === 'ArrowLeft') {
            e.preventDefault()
            setSidebarWidth(sidebarWidth - step)
          } else if (e.key === 'ArrowRight') {
            e.preventDefault()
            setSidebarWidth(sidebarWidth + step)
          }
        }}
        className="absolute -right-[3px] top-0 bottom-0 z-10 w-[5px] cursor-col-resize hover:bg-ember/30 focus-visible:bg-ember/50 focus-visible:outline-none"
      />
    </aside>
  )
}
