import { useMemo } from 'react'

interface Props {
  lines: string[]
  /** scrollTop / maxScroll — 0..1 */
  frac: number
  /** clientHeight / scrollHeight — 0..1 */
  visible: number
  /** click/drag to scroll the document */
  onSeek?: (frac: number) => void
}

const STRIP_H = 320

/** minimap: one bar per line, width ~ line length; click to scroll */
export function Minimap({ lines, frac, visible, onSeek }: Props) {
  const bars = useMemo(
    () =>
      lines.slice(0, STRIP_H / 2).map((l) => {
        const trimmed = l.trim()
        const w = trimmed === '' ? 0 : Math.min(50, Math.max(4, l.length * 0.55))
        const color = trimmed.startsWith('#') ? 'var(--ember)' : 'var(--line)'
        return { w, color, indent: Math.min(18, (l.length - trimmed.length) * 1.4) }
      }),
    [lines],
  )
  const contentH = bars.length * 2
  const boxH = Math.max(12, Math.min(visible, 1) * Math.min(STRIP_H, contentH))
  const track = Math.max(0, Math.min(STRIP_H, contentH) - boxH)
  const top = frac * track

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onSeek) return
    const rect = e.currentTarget.getBoundingClientRect()
    const y = e.clientY - rect.top
    onSeek(Math.max(0, Math.min(1, (y - boxH / 2) / Math.max(1, rect.height - boxH))))
  }

  return (
    <div
      className="relative w-[54px] shrink-0 select-none overflow-hidden border-l border-line"
      onClick={seek}
      style={onSeek ? { cursor: 'pointer' } : undefined}
      title={onSeek ? 'click to scroll' : undefined}
      role={onSeek ? 'slider' : undefined}
      aria-label={onSeek ? 'minimap — click to scroll' : undefined}
      aria-orientation={onSeek ? 'vertical' : undefined}
      aria-valuemin={onSeek ? 0 : undefined}
      aria-valuemax={onSeek ? 100 : undefined}
      aria-valuenow={onSeek ? Math.round(frac * 100) : undefined}
      aria-valuetext={onSeek ? `${Math.round(frac * 100)}% through file` : undefined}
      tabIndex={onSeek ? 0 : undefined}
      onKeyDown={
        onSeek
          ? (e) => {
              const step = e.shiftKey ? 0.2 : 0.05
              if (e.key === 'ArrowDown') { e.preventDefault(); onSeek(Math.min(1, frac + step)) }
              else if (e.key === 'ArrowUp') { e.preventDefault(); onSeek(Math.max(0, frac - step)) }
              else if (e.key === 'PageDown') { e.preventDefault(); onSeek(Math.min(1, frac + 0.25)) }
              else if (e.key === 'PageUp') { e.preventDefault(); onSeek(Math.max(0, frac - 0.25)) }
              else if (e.key === 'Home') { e.preventDefault(); onSeek(0) }
              else if (e.key === 'End') { e.preventDefault(); onSeek(1) }
            }
          : undefined
      }
    >
      <div className="px-[3px] pt-1">
        {bars.map((b, i) => (
          <div
            key={i}
            style={{ width: b.w, height: 1.4, marginLeft: b.indent, marginBottom: 0.6, background: b.color }}
          />
        ))}
      </div>
      <div
        className="absolute left-0 right-0"
        style={{ top, height: boxH, background: 'rgba(232,224,212,0.07)' }}
      />
    </div>
  )
}
