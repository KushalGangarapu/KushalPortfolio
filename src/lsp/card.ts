import type { Symbol } from './symbols'
import { store } from '../state/store'

const KIND_LETTER: Record<Symbol['kind'], string> = {
  class: 'C',
  fn: 'f',
  interface: 'I',
  const: '𝑥',
  module: '{}',
  field: '□',
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export function symbolCardHtml(sym: Symbol): string {
  return (
    `<div class="lsp-card">` +
    `<div class="lsp-head"><span class="lsp-kind k-${sym.kind}">${KIND_LETTER[sym.kind]}</span>` +
    `<code>${esc(sym.signature)}</code></div>` +
    `<div class="lsp-doc">${esc(sym.doc)}</div>` +
    `<div class="lsp-foot">` +
    // real <button>s — injected HTML is focusable by tab + fires click on
    // enter/space, where <span>s were mouse-only
    `<button type="button" class="lsp-link" data-goto>Go to Definition</button>` +
    `<button type="button" class="lsp-link" data-refs>references</button>` +
    `<span class="lsp-ls">kushal-ls</span>` +
    `</div></div>`
  )
}

export function gotoDefinition(sym: Symbol) {
  const s = store.getState()
  s.openFile(sym.target.file, { line: sym.target.line, mode: sym.target.line ? 'raw' : undefined })
  s.unlock('code-whisperer')
}

export function peekReferences(sym: Symbol) {
  const s = store.getState()
  s.setSearchSeed(sym.name)
  s.ensureView('search')
  s.unlock('code-whisperer')
}

/** attach to a card container — delegated click handling for goto/refs */
export function cardClick(e: { target: EventTarget | null }, sym: Symbol) {
  const t = e.target as HTMLElement
  if (t.closest('[data-goto]')) gotoDefinition(sym)
  else if (t.closest('[data-refs]')) peekReferences(sym)
}
