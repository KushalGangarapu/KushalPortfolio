import { useEffect, useRef, useState } from 'react'
import { useIDE, store } from '../state/store'
import type { TermLine } from '../state/store'
import { promptPath, resolve, getDir } from '../vfs/fs'
import { exec, COMMAND_NAMES } from './commands'

const KIND_CLASS: Record<TermLine['kind'], string> = {
  input: 'text-ink',
  out: 'text-inkdim',
  err: 'text-rust',
  red: 'text-rust',
  ok: 'text-sage',
  dim: 'text-inkfaint',
  sys: 'text-violet',
  accent: 'text-tide',
}

function renderLine(l: TermLine) {
  if (l.kind === 'input') {
    // split "… $ cmd" — path in tide, $ in ember
    const i = l.text.lastIndexOf(' $ ')
    if (i >= 0) {
      return (
        <>
          <span className="text-tide">{l.text.slice(0, i)}</span>
          <span className="text-ember">{' $ '}</span>
          <span>{l.text.slice(i + 3)}</span>
        </>
      )
    }
  }
  return l.text
}

export function Terminal() {
  const termLines = useIDE((s) => s.termLines)
  const termHistory = useIDE((s) => s.termHistory)
  const cwd = useIDE((s) => s.cwd)
  const vimTrapped = useIDE((s) => s.vimTrapped)
  const cmdCount = useIDE((s) => s.cmdCount)
  const isTourist = useIDE((s) => s.settings['kushal.jargon'] === 'tourist')
  const [buffer, setBuffer] = useState('')
  const [histIdx, setHistIdx] = useState(-1)
  const [focused, setFocused] = useState(false)
  const savedBuf = useRef('')
  const inputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  // scroll only while pinned to the bottom — scrolling back to read output
  // must not be ripped away by a new line
  const pinned = useRef(true)

  useEffect(() => {
    const el = scrollRef.current
    if (el && pinned.current) el.scrollTop = el.scrollHeight
  }, [termLines])

  // typing re-pins — a shell always jumps to the prompt when you type
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [buffer])

  useEffect(() => {
    const s = store.getState()
    if (!s.termLines.length) {
      s.pushTerm([
        { kind: 'dim', text: 'kushalsh 1.0 — this terminal is real. `help` lists what it knows.' },
        { kind: 'dim', text: 'try: cowsay hi · fortune > note.txt · sudo hire-me · vim (if brave)' },
      ])
    }
    inputRef.current?.focus()
    // one-time coachmark — the terminal is the last thing non-devs expect to work
    if (s.maybeHint('terminal')) {
      s.toast('the terminal actually works — type words, click a chip, or `help`', 'info')
    }
  }, [])

  const complete = (buf: string) => {
    const trailingSpace = /\s$/.test(buf)
    const parts = buf.trimEnd().split(/\s+/)
    const last = trailingSpace ? '' : (parts[parts.length - 1] ?? '')
    let candidates: string[] = []
    if (parts.length === 1 && !trailingSpace) {
      candidates = COMMAND_NAMES.filter((c) => c.startsWith(last))
    } else {
      // path completion
      const s = store.getState()
      // '/x' is absolute — dirPart becomes '/' and resolves to root; without
      // the `|| '/'` the leading slash is silently eaten by the empty string
      const dirPart = last.includes('/') ? last.slice(0, last.lastIndexOf('/')) || '/' : ''
      const base = last.includes('/') ? last.slice(last.lastIndexOf('/') + 1) : last
      const dirPath = resolve(s.cwd, dirPart || '.')
      const dir = getDir(dirPath)
      const childNames = dir
        ? dir.children
            .filter((n) => n.name.startsWith(base))
            .map((n) => (dirPart === '/' ? '/' : dirPart ? dirPart + '/' : '') + n.name + (n.type === 'dir' ? '/' : ''))
        : []
      const draftNames =
        (dirPath === '' || dirPath === '.') && !dirPart
          ? Object.keys(s.virtualFiles)
              .map((k) => k.slice(9))
              .filter((name) => name.startsWith(base))
          : []
      candidates = [...childNames, ...draftNames]
    }
    if (candidates.length === 1) {
      if (trailingSpace) return buf + candidates[0]
      parts[parts.length - 1] = candidates[0]
      return parts.join(' ')
    }
    if (candidates.length > 1) {
      const shared = candidates.reduce((a, b) => {
        let i = 0
        while (a[i] && a[i] === b[i]) i++
        return a.slice(0, i)
      })
      pushLine([{ kind: 'dim', text: candidates.join('   ') }])
      if (shared.length > last.length) {
        if (trailingSpace) return buf + shared
        parts[parts.length - 1] = shared
        return parts.join(' ')
      }
    }
    return buf
  }

  const pushLine = (lines: { kind: TermLine['kind']; text: string }[]) => store.getState().pushTerm(lines)

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // mid-IME-composition Enter confirms the candidate, not the command
    if (e.nativeEvent.isComposing) return
    if (e.key === 'Enter') {
      exec(buffer)
      setBuffer('')
      setHistIdx(-1)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (!termHistory.length) return
      const i = histIdx < 0 ? termHistory.length - 1 : Math.max(0, histIdx - 1)
      if (histIdx < 0) savedBuf.current = buffer
      setHistIdx(i)
      setBuffer(termHistory[i])
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (histIdx < 0) return
      const i = histIdx + 1
      if (i >= termHistory.length) {
        setHistIdx(-1)
        setBuffer(savedBuf.current)
      } else {
        setHistIdx(i)
        setBuffer(termHistory[i])
      }
    } else if (e.key === 'Tab') {
      // Shift+Tab is the keyboard user's exit hatch — swallowing every Tab
      // here would trap focus inside the input forever
      if (e.shiftKey) return
      e.preventDefault()
      // complete() pushes lines as a side effect — inside a setState updater
      // StrictMode dev double-invokes it and the candidates print twice
      setBuffer(complete(buffer))
    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault()
      store.getState().clearTerm()
    } else if (e.key === 'c' && e.ctrlKey) {
      // a real terminal copies when text is selected and SIGINTs otherwise —
      // swallowing both means ctrl+c can never copy from scrollback
      if (window.getSelection()?.toString()) return
      e.preventDefault()
      if (vimTrapped) {
        pushLine([{ kind: 'input', text: buffer }, { kind: 'dim', text: '^C — even ctrl-c cannot save you from vim. :q! can.' }])
      } else {
        pushLine([{ kind: 'input', text: `${promptPath(cwd)} $ ${buffer}^C` }])
      }
      setBuffer('')
    } else if (e.key === 'd' && e.ctrlKey) {
      e.preventDefault()
      if (vimTrapped) {
        pushLine([{ kind: 'dim', text: '^D — vim ate it. :q! is still the way out.' }])
      } else if (!buffer) {
        pushLine([
          { kind: 'input', text: `${promptPath(cwd)} $ logout` },
          { kind: 'dim', text: 'there is no escape from the portfolio. (the shell stays. it likes you.)' },
        ])
      }
    }
  }

  return (
    <div
      className="ide-terminal relative flex h-full flex-col overflow-hidden bg-abyss font-mono text-[12px] leading-[1.55] focus-within:ring-1 focus-within:ring-inset focus-within:ring-ember/35"
      onClick={() => inputRef.current?.focus()}
    >
      <div
        ref={scrollRef}
        onScroll={(e) => {
          const el = e.currentTarget
          pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 30
        }}
        className="min-h-0 flex-1 overflow-y-auto px-3 py-2"
      >
        {/* role=log announces appended lines — this covers toasts the terminal
            prints, demo/tour narration, and command output. the live prompt row
            stays OUT of the region so typing doesn't re-announce the buffer. */}
        <div role="log" aria-label="terminal output" aria-live="polite" className="contents">
          {termLines.map((l) =>
            l.cmd ? (
              // real button: keyboard-reachable, and it routes pseudo-targets to
              // openPseudo instead of exec — commit:/diff:/ui: aren't commands
              <button
                key={l.id}
                className={`block w-full cursor-pointer whitespace-pre-wrap break-all text-left ${KIND_CLASS[l.kind]} hover:bg-raised/70 hover:text-ink focus-visible:bg-raised/70 focus-visible:outline-none`}
                title={`click → ${l.cmd}`}
                onClick={() => {
                  const s = store.getState()
                  const c = l.cmd!
                  if (c.startsWith('view:')) {
                    // a cmd link navigates — ensureView can't close the panel
                    // it's navigating to (setView would toggle it shut)
                    s.ensureView(c.slice(5) as 'git')
                  }
                  else if (/^(commit|diff|ui|untitled):/.test(c)) s.openPseudo(c)
                  else exec(c)
                }}
              >
                {renderLine(l)}
              </button>
            ) : (
              <div key={l.id} className={`whitespace-pre-wrap break-all ${KIND_CLASS[l.kind]}`}>
                {renderLine(l)}
              </div>
            ),
          )}
        </div>
        {/* live prompt */}
        <div className="flex items-center whitespace-pre-wrap break-all">
          {vimTrapped ? (
            <span className="text-sage">-- INSERT --&nbsp;</span>
          ) : (
            <>
              <span className="text-inkdim">kushal@portfolio</span>
              <span className="text-inkfaint">:</span>
              <span className="text-tide">{promptPath(cwd)}</span>
              <span className="text-ember">&nbsp;$&nbsp;</span>
            </>
          )}
          <span className="text-ink">{buffer}</span>
          {/* the real input is invisible — the cursor is the only focus
              signal, so it blinks when focused and dims when not */}
          <span
            aria-hidden
            className={`ml-0.5 inline-block h-[14px] w-[7px] align-middle ${focused ? 'blink bg-ember' : 'border border-inkfaint/60 bg-transparent'}`}
          />
          {/* ghost suggestion — nothing invites typing like an invitation */}
          {cmdCount === 0 && buffer === '' && !vimTrapped && (
            <span className="ml-2 text-inkfaint/70 italic">try 'achievements' — it actually runs</span>
          )}
        </div>
      </div>
      {/* starter chips — the terminal has training wheels until you've earned them off */}
      {(isTourist || cmdCount < 8) && !vimTrapped && (
        <div className="flex shrink-0 items-center gap-1.5 overflow-x-auto border-t border-line/60 px-3 py-1.5">
          <span className="shrink-0 font-mono text-[9px] uppercase tracking-wider text-inkfaint">try:</span>
          {['whoami', 'ls', 'projects', 'kushal --hire', 'fortune', 'tldr git', 'help'].map((c) => (
            <button
              key={c}
              onClick={() => exec(c)}
              className="shrink-0 border border-line px-1.5 py-0.5 font-mono text-[10px] text-inkdim transition-colors hover:border-ember hover:text-ember"
            >
              {c}
            </button>
          ))}
        </div>
      )}
      <input
        ref={inputRef}
        id="terminal-input"
        name="terminal-input"
        value={buffer}
        onChange={(e) => setBuffer(e.target.value)}
        onKeyDown={onKey}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        // sr-only + 16px font: focusable and accessible without contrast scanner false-positives or iOS auto-zoom
        className="sr-only text-[16px]"
        aria-label="terminal input"
        autoCapitalize="off"
        autoCorrect="off"
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="send"
      />
    </div>
  )
}
