import { CheckCircle2, Info, AlertTriangle, XCircle, Trophy } from 'lucide-react'
import { useIDE } from '../state/store'
import type { Toast } from '../state/store'

const ICONS = {
  info: <Info size={13} className="text-tide" />,
  ok: <CheckCircle2 size={13} className="text-sage" />,
  warn: <AlertTriangle size={13} className="text-ember" />,
  err: <XCircle size={13} className="text-rust" />,
  achv: <Trophy size={15} className="text-ember" />,
} satisfies Record<Toast['kind'], React.ReactNode>

export function Toasts() {
  const toasts = useIDE((s) => s.toasts)
  const dismiss = useIDE((s) => s.dismissToast)
  const openAchievements = () => useIDE.getState().ensureView('achievements')
  return (
    <div
      className="pointer-events-none fixed bottom-[calc(2.5rem+env(safe-area-inset-bottom))] right-3 z-[55] flex flex-col items-end gap-1.5 max-sm:bottom-[calc(4.5rem+env(safe-area-inset-bottom))]"
      role="status"
      aria-live="polite"
      aria-atomic="false"
      aria-label="notifications"
    >
      {toasts.map((t) =>
        t.kind === 'achv' ? (
          <button
            key={t.id}
            onClick={() => {
              dismiss(t.id)
              openAchievements()
            }}
            className="slideup pointer-events-auto flex items-center gap-2.5 border border-ember/50 bg-chrome px-3 py-2.5 shadow-[0_8px_30px_rgba(255,158,61,0.12)]"
            title="view achievements"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full border border-ember/60 bg-ember/15">
              {ICONS.achv}
            </span>
            <span className="text-left font-mono">
              <span className="block text-[9px] uppercase tracking-[0.14em] text-ember">achievement unlocked</span>
              <span className="block text-[12px] font-semibold text-ink">{t.title}</span>
              <span className="block text-[10px] text-inkfaint">{t.desc}</span>
            </span>
          </button>
        ) : (
          <button
            key={t.id}
            onClick={() => dismiss(t.id)}
            className="slideup pointer-events-auto flex items-center gap-2 border border-line bg-chrome px-3 py-2 font-mono text-[11.5px] text-inkdim shadow-[0_6px_20px_rgba(0,0,0,0.4)]"
          >
            {ICONS[t.kind]}
            {t.msg}
          </button>
        ),
      )}
    </div>
  )
}
