import { Clapperboard, X } from 'lucide-react'
import { useIDE } from '../state/store'
import { abortTour } from './runner'

/** bottom-center caption bar while the self-driving tour plays */
export function TourCaption() {
  const tour = useIDE((s) => s.tour)
  if (!tour) return null
  return (
    <div
      className="pointer-events-auto fixed bottom-10 left-1/2 z-[70] flex max-w-[min(560px,86vw)] -translate-x-1/2 items-center gap-3 border border-ember/50 bg-abyss/95 px-4 py-2 shadow-[0_8px_32px_rgba(0,0,0,0.55)] slideup"
      role="status"
      aria-live="polite"
      aria-label="guided tour narration"
    >
      <Clapperboard size={13} className="shrink-0 animate-pulse text-ember" />
      <div className="min-w-0 font-mono text-[11.5px] leading-snug text-ink">
        <span className="mr-2 text-ember">tour</span>
        {tour.caption}
      </div>
      <button
        onClick={() => abortTour()}
        title="abort tour"
        aria-label="abort tour"
        className="ml-1 shrink-0 text-inkfaint transition-colors hover:text-ink"
      >
        <X size={13} />
      </button>
    </div>
  )
}
