import { hoverTooltip } from '@codemirror/view'
import type { EditorView, Tooltip } from '@codemirror/view'
import { SYMBOL_RE, findSymbol, proseOk } from './symbols'
import { symbolCardHtml, cardClick, gotoDefinition } from './card'
import type { Symbol } from './symbols'

/** find a symbol covering `pos` — checks a regex window on the line for multi-word names */
export function symbolAt(view: EditorView, pos: number): { sym: Symbol; from: number; to: number } | null {
  const line = view.state.doc.lineAt(pos)
  const rel = pos - line.from
  // window of ±40 chars around the cursor catches multi-word symbols
  const wFrom = Math.max(0, rel - 40)
  const wTo = Math.min(line.text.length, rel + 40)
  const windowText = line.text.slice(wFrom, wTo)
  SYMBOL_RE.lastIndex = 0
  for (const m of windowText.matchAll(SYMBOL_RE)) {
    const start = wFrom + m.index
    const end = start + m[0].length
    if (rel >= start && rel <= end) {
      // 'go' the verb shouldn't light up; 'Go' the language should
      if (!proseOk(m[0])) continue
      const sym = findSymbol(m[0])
      if (sym) return { sym, from: line.from + start, to: line.from + end }
    }
  }
  return null
}

export const symbolHover = hoverTooltip((view, pos) => {
  const hit = symbolAt(view, pos)
  if (!hit) return null
  const { sym, from, to } = hit
  const tip: Tooltip = {
    pos: from,
    end: to,
    above: true,
    create() {
      const dom = document.createElement('div')
      dom.innerHTML = symbolCardHtml(sym)
      // click, not mousedown — the card's buttons fire click on Enter/Space,
      // and mousedown never reaches keyboard users
      dom.addEventListener('click', (e) => cardClick(e, sym))
      return { dom }
    },
  }
  return tip
})

/** Ctrl+Click → go to definition. Returns true if handled. */
export function ctrlClickGoto(e: MouseEvent, view: EditorView): boolean {
  if (!e.ctrlKey && !e.metaKey) return false
  const pos = view.posAtCoords({ x: e.clientX, y: e.clientY })
  if (pos == null) return false
  const hit = symbolAt(view, pos)
  if (!hit) return false
  e.preventDefault()
  gotoDefinition(hit.sym)
  return true
}
