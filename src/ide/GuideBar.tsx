import { useEffect } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { store, useIDE } from '../state/store'
import { ROUTE } from '../tour/route'

/** the guided-route bar — click next, we drive. sits above the status bar. */
/** survives unmounts (the route's last stop builds → recruiter view unmounts us) */
let lastFired = -1

export function GuideBar() {
  const guided = useIDE((s) => s.guided)

  // arriving at a stop performs its action; walking off the end finishes the route
  useEffect(() => {
    if (guided === null) return
    const stop = ROUTE[guided]
    if (!stop) {
      store.getState().endGuide()
      store.getState().unlock('path-taken')
      store.getState().toast('route complete — you saw the whole thing', 'ok')
      return
    }
    if (guided === 0) lastFired = -1 // a restarted route re-arms every stop
    if (guided === lastFired) return // remount replay — don't re-fire the same stop
    lastFired = guided
    stop.go()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guided])

  // esc exits the route via App's ordered Escape chain — a private listener
  // here would fire on the same keydown as a palette/modal close, killing the
  // route when the user meant to dismiss the thing on top
  if (guided === null) return null
  const stop = ROUTE[guided]
  if (!stop) return null

  return (
    <div className="flex h-8 shrink-0 items-stretch gap-px border-t border-line bg-chrome font-mono text-[10.5px]">
      <button
        onClick={() => store.getState().stepGuide(-1)}
        disabled={guided === 0}
        className="flex items-center gap-1 px-3 text-inkdim transition-colors hover:bg-raised disabled:opacity-30"
        aria-label="previous stop"
      >
        <ChevronLeft size={12} />
        prev
      </button>
      <div className="flex min-w-0 flex-1 items-center gap-2 px-3">
        <span className="flex shrink-0 gap-1">
          {ROUTE.map((_, i) => (
            <span key={i} className={`h-1 w-1 rounded-full ${i === guided ? 'bg-ember' : i < guided ? 'bg-sage/60' : 'bg-line'}`} />
          ))}
        </span>
        <span className="shrink-0 text-inkfaint">{guided + 1}/{ROUTE.length}</span>
        <span className="truncate text-inkdim" title={stop.label} aria-live="polite">
          {stop.caption}
        </span>
      </div>
      <button
        onClick={() => store.getState().stepGuide(1)}
        className={`flex items-center gap-1 px-3 transition-colors hover:bg-raised ${
          guided === ROUTE.length - 1 ? 'text-ember' : 'text-inkdim'
        }`}
        aria-label="next stop"
      >
        {guided === ROUTE.length - 1 ? 'finish' : 'next'}
        <ChevronRight size={12} />
      </button>
      <button
        onClick={() => store.getState().endGuide()}
        className="px-2.5 text-inkfaint transition-colors hover:bg-raised hover:text-ink"
        title="leave the route"
        aria-label="exit guided route"
      >
        <X size={12} />
      </button>
    </div>
  )
}
