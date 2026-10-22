import { useEffect, useRef } from 'react'
import { EditorView, keymap, lineNumbers, highlightActiveLineGutter, drawSelection } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { indentOnInput, bracketMatching, foldGutter } from '@codemirror/language'
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search'
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete'
import { Compartment } from '@codemirror/state'
import type { Extension } from '@codemirror/state'
import { linter, lintGutter } from '@codemirror/lint'

import { langFor, highlightExtension } from './lang'
import { parseSettingsJson } from '../settings/model'
import { store, useIDE } from '../state/store'
import { symbolHover, symbolAt, ctrlClickGoto } from '../lsp/cm-hover'
import { gotoDefinition, peekReferences } from '../lsp/card'

const langComp = new Compartment()
const wrapComp = new Compartment()
const tabComp = new Compartment()

// per-buffer EditorState cache — remounting on tab switches used to build a
// fresh state every time, silently destroying undo history (Ctrl+Z did
// nothing after switching tabs)
const stateCache = new Map<string, EditorState>()
const STATE_CACHE_CAP = 12
const cacheState = (key: string, state: EditorState) => {
  if (stateCache.size >= STATE_CACHE_CAP) stateCache.delete(stateCache.keys().next().value!)
  stateCache.set(key, state)
}

const cmTheme = EditorView.theme(
  {
    '&': { backgroundColor: 'transparent', fontSize: 'var(--editor-font-size, 13px)', height: '100%' },
    '.cm-content': {
      fontFamily: 'var(--font-mono)',
      caretColor: 'var(--ember)',
      padding: '12px 0 40vh 0',
    },
    '.cm-cursor': { borderLeftColor: 'var(--ember)' },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
      backgroundColor: 'var(--ember-glow) !important',
    },
    '.cm-gutters': {
      backgroundColor: 'transparent',
      border: 'none',
      color: 'var(--ink-faint)',
      fontFamily: 'var(--font-mono)',
      paddingLeft: '8px',
    },
    '.cm-activeLine': { backgroundColor: 'rgba(255,255,255,0.025)' },
    '.cm-activeLineGutter': { backgroundColor: 'transparent', color: 'var(--ink-dim)' },
    '.cm-matchingBracket': { backgroundColor: 'var(--ember-glow)', outline: 'none' },
    '.cm-foldPlaceholder': { backgroundColor: 'var(--raised)', border: 'none', color: 'var(--ink-dim)' },
    '.cm-selectionMatch': { backgroundColor: 'rgba(255,158,61,0.12)' },
    '.cm-tooltip.cm-tooltip-hover': {
      border: '1px solid var(--line)',
      backgroundColor: 'transparent',
      padding: '0',
    },
    '&.cm-focused': { outline: 'none' },
  },
  { dark: true },
)

interface Props {
  path: string
  ext: string
  /** which editor group this instance lives in */
  paneId: string
  /** controlled-ish: external content source of truth */
  value: string
  /** scroll position feed for the minimap — (scrollTop/max, clientHeight/scrollHeight) */
  onScrollInfo?: (frac: number, visible: number) => void
  /** hands the parent the scrolling element (for minimap click-to-seek) */
  scrollerRef?: (el: HTMLElement | null) => void
}

export function CodeEditor({ path, ext, paneId, value, onScrollInfo, scrollerRef }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const lineRequest = useIDE((s) => s.lineRequests[path])
  const consumeLineRequest = useIDE((s) => s.consumeLineRequest)
  const wordWrap = useIDE((s) => s.settings['editor.wordWrap'])
  const tabSize = useIDE((s) => s.settings['editor.tabSize'])
  const active = useIDE((s) => s.panes.find((p) => p.id === paneId)?.active === path)

  // create once per file
  useEffect(() => {
    if (!host.current) return
    const cacheKey = `${paneId}:${path}`
    const lang = langFor(ext)
    const exts: Extension[] = [
      lineNumbers(),
      highlightActiveLineGutter(),
      foldGutter({ openText: '▾', closedText: '▸' }),
      drawSelection(),
      history(),
      indentOnInput(),
      bracketMatching(),
      closeBrackets(),
      highlightSelectionMatches(),
      symbolHover,
      lintGutter(),
      ...(path === 'settings.json'
        ? [
            linter((view) => {
              const res = parseSettingsJson(view.state.doc.toString())
              if (res.ok) return []
              const ln = Math.min(Math.max(1, res.line), view.state.doc.lines)
              const l = view.state.doc.line(ln)
              return [
                {
                  from: l.from,
                  to: Math.max(l.from + 1, l.to),
                  severity: 'error' as const,
                  message: `${res.error} — kushal-ls`,
                },
              ]
            }),
          ]
        : []),
      keymap.of([
        {
          key: 'F12',
          run: (view) => {
            const hit = symbolAt(view, view.state.selection.main.head)
            if (hit) gotoDefinition(hit.sym)
            else store.getState().toast('kushal-ls: no definition found — it was never defined, like work-life balance', 'info')
            return true
          },
        },
        {
          key: 'Shift-F12',
          run: (view) => {
            const hit = symbolAt(view, view.state.selection.main.head)
            if (hit) peekReferences(hit.sym)
            else store.getState().toast('kushal-ls: no references. it is, sadly, unreferenced.', 'info')
            return true
          },
        },
        {
          // F2 — rename symbol (this buffer only, but the rename is real)
          key: 'F2',
          run: (view) => {
            const hit = symbolAt(view, view.state.selection.main.head)
            if (!hit) {
              store.getState().toast('kushal-ls: rename needs a symbol under the cursor', 'info')
              return true
            }
            const next = window.prompt(`rename '${hit.sym.name}' to`, hit.sym.name)
            if (!next || next === hit.sym.name) return true
            const re = new RegExp(`\\b${hit.sym.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi')
            const changes: { from: number; to: number; insert: string }[] = []
            const text = view.state.doc.toString()
            for (const m of text.matchAll(re)) changes.push({ from: m.index, to: m.index + m[0].length, insert: next })
            if (changes.length) {
              view.dispatch({ changes })
              store.getState().toast(`kushal-ls: renamed ${changes.length} occurrence${changes.length === 1 ? '' : 's'} — working tree is dirty, as it should be`, 'ok')
            }
            return true
          },
        },
        ...closeBracketsKeymap,
        ...defaultKeymap,
        ...historyKeymap,
        ...searchKeymap,
        indentWithTab,
      ]),
      wrapComp.of(wordWrap === 'on' ? EditorView.lineWrapping : []),
      tabComp.of(EditorState.tabSize.of(tabSize)),
      cmTheme,
      highlightExtension,
      langComp.of(lang ? [lang] : []),
      EditorView.contentAttributes.of({ 'aria-label': `editor — ${path}`, 'aria-multiline': 'true' }),
      EditorView.updateListener.of((u) => {
        if (u.docChanged) {
          const v = u.state.doc.toString()
          const st = store.getState()
          if (st.fileContents[path] !== v) st.editFile(path, v)
        }
        if (u.selectionSet || u.docChanged) {
          const head = u.state.selection.main.head
          const line = u.state.doc.lineAt(head)
          const st = store.getState()
          if (st.panes.find((p) => p.id === paneId)?.active === path) st.setCursor(line.number, head - line.from + 1)
        }
      }),
      EditorView.domEventHandlers({
        mousedown: (e, view) => {
          if (ctrlClickGoto(e, view)) return true
          return false
        },
      }),
    ]
    const view = new EditorView({
      // a cached state carries undo history + cursor across tab switches; the
      // [value] sync effect below reconciles any drift since unmount
      state: stateCache.get(cacheKey) ?? EditorState.create({ doc: value, extensions: exts }),
      parent: host.current,
    })
    viewRef.current = view
    ;(view as unknown as { __compts: unknown }).__compts = { wrapComp, tabComp }

    // feed the minimap — CM owns its own scroller
    const scroller = view.scrollDOM
    scrollerRef?.(scroller)
    const feedScroll = () => {
      const max = Math.max(1, scroller.scrollHeight - scroller.clientHeight)
      onScrollInfo?.(scroller.scrollTop / max, scroller.clientHeight / Math.max(1, scroller.scrollHeight))
    }
    scroller.addEventListener('scroll', feedScroll, { passive: true })
    feedScroll()

    return () => {
      scroller.removeEventListener('scroll', feedScroll)
      scrollerRef?.(null)
      cacheState(cacheKey, view.state) // undo history survives the unmount
      view.destroy()
      viewRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, paneId])

  // live-reconfigure word wrap / tab size from settings
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const comps = (view as unknown as { __compts?: { wrapComp: Compartment; tabComp: Compartment } }).__compts
    if (!comps) return
    view.dispatch({
      effects: [
        comps.wrapComp.reconfigure(wordWrap === 'on' ? EditorView.lineWrapping : []),
        comps.tabComp.reconfigure(EditorState.tabSize.of(tabSize)),
      ],
    })
  }, [wordWrap, tabSize])

  // external changes (revert all, settings write-through) → sync doc
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const current = view.state.doc.toString()
    if (current !== value) {
      view.dispatch({ changes: { from: 0, to: current.length, insert: value } })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  // search-result / go-to-definition jumps — line + optional column
  useEffect(() => {
    if (lineRequest && viewRef.current) {
      const view = viewRef.current
      const line = Math.min(Math.max(1, lineRequest.line), view.state.doc.lines)
      const ln = view.state.doc.line(line)
      const pos = Math.min(ln.from + Math.max(0, (lineRequest.col ?? 1) - 1), ln.to)
      view.dispatch({
        selection: { anchor: pos },
        effects: EditorView.scrollIntoView(pos, { y: 'center' }),
      })
      view.focus()
      consumeLineRequest(path)
    }
  }, [lineRequest, path, consumeLineRequest])

  // focus when tab becomes active — but never yank focus out of the tab
  // strip (arrow-key navigation) or pop the on-screen keyboard on touch
  useEffect(() => {
    if (!active) return
    const el = document.activeElement as HTMLElement | null
    if (el?.closest('[role="tab"]')) return
    if (store.getState().mobile) return
    viewRef.current?.focus()
  }, [active])

  return <div ref={host} className="h-full overflow-hidden" />
}
