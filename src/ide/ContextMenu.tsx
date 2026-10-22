import { useEffect, useRef } from 'react'
import { useIDE } from '../state/store'

export function ContextMenu() {
  const menu = useIDE((s) => s.ctxMenu)
  const setMenu = useIDE((s) => s.setCtxMenu)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menu) return
    const close = () => setMenu(null)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    // focus the first actionable item — a menu that opens with no focus is just a popup
    const first = ref.current?.querySelector<HTMLElement>('button:not(:disabled)')
    first?.focus()
    window.addEventListener('mousedown', close)
    window.addEventListener('keydown', onKey)
    window.addEventListener('blur', close)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('mousedown', close)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('blur', close)
      window.removeEventListener('resize', close)
    }
  }, [menu, setMenu])

  if (!menu) return null

  // clamp to viewport — both ends: a narrow window or a synthetic x/y of 0
  // must not leave the menu hanging off the left/top edge
  const w = 220
  const itemH = 26
  const h = menu.items.length * itemH + 12
  const x = Math.max(8, Math.min(menu.x, window.innerWidth - w - 8))
  const y = Math.max(8, Math.min(menu.y, window.innerHeight - h - 8))

  return (
    <div
      ref={ref}
      role="menu"
      className="fadein fixed z-[70] border border-line bg-chrome py-1 shadow-[0_8px_26px_rgba(0,0,0,0.55)]"
      style={{ left: x, top: y, width: w }}
      onMouseDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        // menu arrow-nav — items are buttons, walk the enabled ones
        if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
        const items = [...(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled)') ?? [])]
        if (!items.length) return
        e.preventDefault()
        const i = items.indexOf(document.activeElement as HTMLElement)
        items[(i + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length].focus()
      }}
    >
      {menu.items.map((it, i) =>
        it.sep ? (
          <div key={i} className="mx-2 my-1 border-t border-line" />
        ) : (
          <button
            key={i}
            role="menuitem"
            disabled={it.disabled}
            onClick={() => {
              setMenu(null)
              it.action()
            }}
            className={`flex w-full items-center justify-between px-3 py-1 text-left font-mono text-[11.5px] ${
              it.disabled ? 'cursor-default text-inkfaint' : 'text-inkdim hover:bg-raised hover:text-ink'
            }`}
          >
            <span>{it.label}</span>
            {it.shortcut && <span className="text-[9.5px] text-inkfaint">{it.shortcut}</span>}
          </button>
        ),
      )}
    </div>
  )
}
