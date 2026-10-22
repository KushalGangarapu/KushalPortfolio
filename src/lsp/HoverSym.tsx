import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { findSymbol } from './symbols'
import { symbolCardHtml, cardClick, gotoDefinition } from './card'

export function HoverSym({ name, children }: { name: string; children: ReactNode }) {
  const sym = findSymbol(name)
  const [open, setOpen] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  // a queued open/close must not land on an unmounted span
  useEffect(() => () => clearTimeout(timer.current), [])

  if (!sym) return <>{children}</>

  const enter = () => {
    clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setOpen(true), 280)
  }
  const leave = () => {
    clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setOpen(false), 160)
  }

  return (
    <span className="relative inline">
      <span
        role="button"
        tabIndex={0}
        aria-expanded={open}
        className="cursor-pointer border-b border-dotted border-inkfaint/50 transition-colors hover:border-tide hover:text-ember focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ember"
        onMouseEnter={enter}
        onMouseLeave={leave}
        onFocus={() => setOpen(true)}
        // blur kills the card only when focus LEAVES the wrapper — Tabbing
        // into the card's buttons is in-family and must not unmount it
        onBlur={(e) => {
          if (!e.currentTarget.parentElement?.contains(e.relatedTarget as Node)) setOpen(false)
        }}
        onClick={(e) => {
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            gotoDefinition(sym)
          } else {
            // tap/click without modifiers opens the card — touch screens have no hover
            e.preventDefault()
            setOpen((o) => !o)
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            if (e.ctrlKey || e.metaKey) gotoDefinition(sym)
            else setOpen((o) => !o)
          } else if (e.key === 'Escape' && open) {
            e.preventDefault()
            e.stopPropagation()
            setOpen(false)
          }
        }}
        title={`${sym.name} — ctrl+click: definition`}
      >
        {children}
      </span>
      {open && (
        <span
          className="fadein absolute left-0 top-full z-50 mt-1 block w-[min(300px,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] cursor-default text-left"
          onMouseEnter={enter}
          onMouseLeave={leave}
          onClick={(e) => cardClick(e, sym)}
        >
          <span
            className="block"
            dangerouslySetInnerHTML={{ __html: symbolCardHtml(sym) }}
          />
        </span>
      )}
    </span>
  )
}
