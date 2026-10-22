import { useDeferredValue, useMemo, useRef, useState } from 'react'
import { GitCommitHorizontal, RefreshCw, FileDiff, ChevronDown, RotateCcw, Sparkles, Check } from 'lucide-react'
import { COMMITS, BRANCH_COLORS, BRANCH_NAMES, LANE_MAIN, LANE_VISITOR } from '../vfs/gitdata'
import type { Commit } from '../vfs/gitdata'
import { baselineOf, store, useIDE } from '../state/store'
import { getFile } from '../vfs/fs'
import { diffStats } from '../vfs/diff'

const ROW = 48
const LANE_X = (l: number) => 14 + l * 16
const W = 78
// expanded rows add a CommitDetail (h-148 + mb-2) under the button — keep in sync
const DETAIL_H = 156

/** static career + visitor session commits, newest first */
function useAllCommits(): Commit[] {
  const visitorCommits = useIDE((s) => s.visitorCommits)
  return useMemo(() => {
    const mine: Commit[] = [...visitorCommits]
      .reverse()
      .map((v) => ({
        hash: v.hash,
        lane: LANE_VISITOR,
        msg: v.msg,
        date: new Date(v.time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        body: `files: ${v.files.join(', ')}`,
      }))
    return [...mine, ...COMMITS]
  }, [visitorCommits])
}

/** for each commit, find the row index of the next commit on the same lane (below) */
function nextOnLane(all: Commit[], idx: number, lane: number): number {
  for (let j = idx + 1; j < all.length; j++) {
    if (all[j].lane === lane) return j
  }
  return -1
}

/** for a merge commit: find row of the newest commit on the merged lane */
function mergeTarget(all: Commit[], idx: number, fromLane: number): number {
  for (let j = idx + 1; j < all.length; j++) {
    if (all[j].lane === fromLane) return j
  }
  return -1
}

function GraphSvg({ all, expanded }: { all: Commit[]; expanded: string | null }) {
  // rows may shift when expanded — compute row-top offsets
  const tops: number[] = []
  let y = 0
  for (const c of all) {
    tops.push(y)
    y += c.hash === expanded ? ROW + DETAIL_H : ROW
  }
  const total = y
  const cy = (i: number) => tops[i] + 16

  return (
    <svg width={W} height={total} className="shrink-0 select-none">
      {/* lane runs */}
      {all.map((c, i) => {
        const j = nextOnLane(all, i, c.lane)
        if (j < 0) return null
        return (
          <line
            key={`l${i}`}
            x1={LANE_X(c.lane)}
            y1={cy(i)}
            x2={LANE_X(c.lane)}
            y2={cy(j)}
            stroke={BRANCH_COLORS[c.lane]}
            strokeWidth={1.6}
            opacity={0.75}
          />
        )
      })}
      {/* merge curves */}
      {all.map((c, i) => {
        if (c.mergeFrom === undefined) return null
        const j = mergeTarget(all, i, c.mergeFrom)
        if (j < 0) return null
        const x1 = LANE_X(c.mergeFrom)
        const x2 = LANE_X(LANE_MAIN)
        return (
          <path
            key={`m${i}`}
            d={`M ${x1} ${cy(j) - 8} C ${x1} ${cy(i) + 26}, ${x2} ${cy(j) - 30}, ${x2} ${cy(i)}`}
            fill="none"
            stroke={BRANCH_COLORS[c.mergeFrom]}
            strokeWidth={1.6}
            opacity={0.75}
          />
        )
      })}
      {/* commit dots */}
      {all.map((c, i) => (
        <g key={`d${i}`}>
          <circle
            cx={LANE_X(c.lane)}
            cy={cy(i)}
            r={i === 0 ? 5 : 4}
            fill="var(--chrome)"
            stroke={BRANCH_COLORS[c.lane]}
            strokeWidth={2}
          />
          {i === 0 && <circle cx={LANE_X(c.lane)} cy={cy(i)} r={2} fill={BRANCH_COLORS[c.lane]} />}
        </g>
      ))}
    </svg>
  )
}

export function CommitDetail({ c }: { c: Commit }) {
  const visitor = c.lane === LANE_VISITOR
  return (
    <div className="slideup mx-1 mb-2 h-[148px] overflow-y-auto border border-line bg-abyss px-2.5 py-2 font-mono text-[10.5px] leading-relaxed">
      <div className="flex items-center gap-2">
        <span className={visitor ? 'text-violet' : 'text-ember'}>commit {c.hash}</span>
        {c.tag && <span className="border border-ember/50 px-1 text-[9px] text-ember">{c.tag}</span>}
        <button
          onClick={(e) => {
            e.stopPropagation()
            store.getState().openPseudo(`commit:${c.hash}`)
          }}
          className="ml-auto text-[9px] text-tide hover:underline"
          title="open in an editor tab"
        >
          open ↗
        </button>
      </div>
      <div className="text-inkfaint">Author: {visitor ? 'you <visitor@localhost>' : 'Kushal Gangarapu <smileykushal@gmail.com>'}</div>
      <div className="text-inkfaint">Date: {c.date}</div>
      <div className="mt-1.5 text-ink">{c.msg}</div>
      {c.body && <div className="mt-1 text-inkdim">{c.body}</div>}
      {c.files && c.files.length > 0 && (
        <div className="mt-2 border-t border-dashed border-line pt-1.5">
          <div className="mb-0.5 text-[9px] uppercase tracking-wider text-inkfaint">files touched</div>
          {c.files.map((f) => (
            <button
              key={f}
              onClick={(e) => {
                e.stopPropagation()
                store.getState().openFile(f)
              }}
              className="block text-tide hover:text-ember hover:underline"
            >
              {f}
            </button>
          ))}
        </div>
      )}
      {c.diff && (
        <div className="mt-2 border-t border-dashed border-line pt-1.5">
          {c.diff.map((d, i) => (
            <div key={i} className={d.startsWith('+') ? 'text-sage' : 'text-rust'}>
              {d}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/** real working-tree changes — every file the visitor edited, committable */
function Changes() {
  const fileContents = useIDE((s) => s.fileContents)
  const virtualFiles = useIDE((s) => s.virtualFiles)
  const baselines = useIDE((s) => s.baselines)
  const [open, setOpen] = useState(true)
  const [msg, setMsg] = useState('')

  // deferred — the O(n·m) diff below shouldn't run mid-keystroke burst; it
  // catches up when typing pauses
  const deferredContents = useDeferredValue(fileContents)
  // per-path result cache — an edit to file A must not recompute B's diff
  const statsCache = useRef(new Map<string, { base: string; content: string; st: { add: number; del: number } }>())

  const entries = useMemo(() => {
    const s = store.getState()
    const out: { path: string; name: string; add: number; del: number; untracked: boolean }[] = []
    for (const [path, content] of Object.entries(deferredContents)) {
      if (path.startsWith('untitled:')) {
        // same rule isDirtyPath uses: compare against the committed baseline
        // when a commit captured this draft — else a post-commit edit that
        // returns to the committed text still reads dirty
        const base = baselines[path] ?? virtualFiles[path] ?? ''
        if (content === base) continue
        const st = diffStats(base, content)
        if (st.add || st.del) out.push({ path, name: path.slice(9), ...st, untracked: true })
        continue
      }
      const f = getFile(path)
      if (!f) continue
      const base = baselineOf(s, path)
      if (base === content) continue
      const cached = statsCache.current.get(path)
      const st = cached && cached.base === base && cached.content === content
        ? cached.st
        : diffStats(base, content)
      statsCache.current.set(path, { base, content, st })
      if (st.add || st.del) out.push({ path, name: f.name, ...st, untracked: false })
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deferredContents, virtualFiles, baselines])

  // untracked drafts commit too — visitor/you takes everything
  const committable = entries

  const commit = () => {
    store.getState().commitChanges(msg)
    setMsg('')
  }

  return (
    <div>
      <div className="flex items-center border-b border-line">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex flex-1 items-center gap-1 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-inkfaint"
      >
        <ChevronDown size={11} className={open ? '' : '-rotate-90'} />
        changes {entries.length > 0 && <span className="text-ember">({entries.length})</span>}
      </button>
      {entries.length > 0 && (
        <button
          title="revert all changes"
          aria-label="revert all changes"
          onClick={() => store.getState().revertAll()}
          className="px-3 py-1.5 text-inkfaint transition-colors hover:text-rust"
        >
          <RotateCcw size={10} />
        </button>
      )}
      </div>
      {open && (
        <div className="pb-1.5">
          {/* commit box — vscode style */}
          <div className="mx-2 mb-1.5 mt-1">
            <input
              id="git-commit-msg"
              name="git-commit-msg"
              value={msg}
              aria-label="commit message"
              onChange={(e) => setMsg(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && committable.length) commit()
              }}
              placeholder={committable.length ? 'message (Enter to commit)' : 'edit a file first…'}
              className="w-full border border-line bg-abyss px-2 py-1 font-mono text-[11px] text-ink placeholder:text-inkfaint focus:border-ember focus:outline-none"
            />
            <button
              onClick={commit}
              disabled={!committable.length}
              title={committable.length ? `commit ${committable.length} file(s) to visitor/you` : 'nothing staged — edit a file'}
              className="mt-1 flex w-full items-center justify-center gap-1.5 border border-line bg-raised px-2 py-1 font-mono text-[10.5px] text-inkdim transition-colors hover:border-violet hover:text-violet disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-line disabled:hover:text-inkdim"
            >
              <Check size={11} />
              commit to visitor/you
            </button>
          </div>
          {entries.length === 0 && (
            <div className="px-4 py-1 font-mono text-[10px] leading-relaxed text-inkfaint">
              working tree clean.
              <br />
              edit any file — the diff machinery is real.
            </div>
          )}
          {entries.map((e) => (
            <button
              key={e.path}
              onClick={() => {
                const s = store.getState()
                if (e.untracked) s.openFile(e.path)
                else s.openFile(`diff:${e.path}`)
              }}
              className="group flex w-full items-center gap-1.5 px-4 py-[3px] text-left font-mono text-[11.5px] text-inkdim transition-colors hover:bg-raised hover:text-ink"
              title={e.untracked ? 'untracked file' : 'open diff'}
            >
              {e.untracked ? <Sparkles size={11} className="shrink-0 text-sage" /> : <FileDiff size={11} className="shrink-0 text-ember" />}
              <span className="truncate">{e.name}</span>
              <span className="ml-auto shrink-0 text-[10px]">
                {e.untracked ? (
                  <span className="text-sage">U</span>
                ) : (
                  <>
                    <span className="text-sage">+{e.add}</span>{' '}
                    <span className="text-rust">−{e.del}</span>
                  </>
                )}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function GitGraph() {
  const [expanded, setExpanded] = useState<string | null>(null)
  const [year, setYear] = useState<number | null>(null)
  const all = useAllCommits()
  const hasVisitor = all.some((c) => c.lane === LANE_VISITOR)

  // the time-travel scrubber — "see me as a freshman" is a real filter
  const years = useMemo(
    () =>
      [...new Set(COMMITS.map((c) => +c.date.slice(0, 4)))]
        .filter((y) => y > 2009) // the birth commit stays under "all"
        .sort((a, b) => a - b),
    [],
  )
  const currentYear = new Date().getFullYear()
  const shown =
    year === null
      ? all
      : all.filter((c) => (c.lane === LANE_VISITOR ? year >= currentYear : +c.date.slice(0, 4) <= year))

  const toggleCommit = (hash: string) => {
    const next = expanded === hash ? null : hash
    setExpanded(next)
    if (next) store.getState().unlock('forensics')
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-3 py-2 font-mono text-[10.5px] text-inkfaint">
        <span className="flex items-center gap-1.5">
          <GitCommitHorizontal size={12} />
          main <span className="text-tide">↑{COMMITS.length} ↓0</span>
        </span>
        <button
          title="refresh"
          aria-label="refresh"
          onClick={() => store.getState().toast("already up to date. you're welcome.", 'ok')}
          className="text-inkfaint hover:text-ink"
        >
          <RefreshCw size={11} />
        </button>
      </div>
      <Changes />
      <div className="flex items-center justify-between px-3 py-1">
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-inkfaint">
          commit graph — {year ? `the career, as of ${year}` : 'the career'}
        </span>
        {/* year scrubber */}
        <span className="flex gap-1">
          <button
            onClick={() => setYear(null)}
            className={`px-1.5 font-mono text-[9.5px] transition-colors ${year === null ? 'text-ember' : 'text-inkfaint hover:text-inkdim'}`}
          >
            all
          </button>
          {years.map((y) => (
            <button
              key={y}
              onClick={() => {
                setYear(year === y ? null : y)
                store.getState().unlock('freshman-year')
              }}
              className={`px-1.5 font-mono text-[9.5px] transition-colors ${year === y ? 'text-ember' : 'text-inkfaint hover:text-inkdim'}`}
              title={`the career, as of ${y}`}
            >
              {y}
            </button>
          ))}
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex">
          <GraphSvg all={shown} expanded={expanded} />
          <div className="min-w-0 flex-1">
            {shown.map((c, i) => (
              <div key={c.hash + i}>
                <button
                  onClick={() => toggleCommit(c.hash)}
                  className={`block w-full px-1.5 py-0 text-left transition-colors hover:bg-raised ${
                    expanded === c.hash ? 'bg-raised' : ''
                  }`}
                  style={{ height: ROW }}
                >
                  <div className="flex items-baseline gap-1.5 pt-1.5">
                    <span className={`shrink-0 font-mono text-[11px] ${c.lane === LANE_VISITOR ? 'text-violet' : 'text-ember'}`}>
                      {c.hash}
                    </span>
                    {c.tag && (
                      <span className="shrink-0 border border-ember/50 px-1 font-mono text-[8.5px] text-ember">{c.tag}</span>
                    )}
                    {i === 0 && (
                      <span className="shrink-0 font-mono text-[9px] text-sage" title={c.lane === LANE_VISITOR ? 'HEAD → visitor/you' : 'HEAD — you are here'}>
                        ← HEAD
                      </span>
                    )}
                    {c.mergeFrom !== undefined && (
                      <span className="truncate font-mono text-[9px] text-tide">⤦{BRANCH_NAMES[c.mergeFrom].replace('feature/', '')}</span>
                    )}
                    <span className="ml-auto shrink-0 font-mono text-[9.5px] text-inkfaint">{c.date}</span>
                  </div>
                  <div className="mt-1 truncate font-mono text-[11.5px] text-inkdim">{c.msg}</div>
                </button>
                {expanded === c.hash && <CommitDetail c={c} />}
              </div>
            ))}
          </div>
        </div>
        <div className="px-3 py-3 font-mono text-[9.5px] leading-relaxed text-inkfaint">
          branches: <span style={{ color: BRANCH_COLORS[0] }}>main</span> (the school years) ·{' '}
          <span style={{ color: BRANCH_COLORS[1] }}>feature/leadership</span> ·{' '}
          <span style={{ color: BRANCH_COLORS[2] }}>feature/side-quests</span>
          {hasVisitor && (
            <>
              {' '}
              · <span style={{ color: BRANCH_COLORS[3] }}>visitor/you</span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
