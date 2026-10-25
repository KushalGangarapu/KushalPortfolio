import {
  BookOpen, Terminal, TerminalSquare, Command, GitBranch, Search, PencilLine,
  History, GitCompare, Columns2, Settings2, MousePointerClick, Wrench, Rocket,
  Moon, Skull, DoorOpen, Gamepad2, Flag, ShieldCheck, Book, Map, TrainFront,
  Trophy, Lock, Clapperboard, Car, GitCommitHorizontal, EyeOff, Handshake,
  Workflow, SquareStack, Compass, Languages, Volume2, Leaf, Share2, Check,
  Presentation,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { copyToClipboard } from '../lib/clipboard'
import { ACHIEVEMENTS } from '../achievements/defs'
import { useIDE, store } from '../state/store'

const ICONS: Record<string, LucideIcon> = {
  BookOpen, Terminal, TerminalSquare, Command, GitBranch, Search, PencilLine,
  History, GitCompare, Columns2, Settings2, MousePointerClick, Wrench, Rocket,
  Moon, Skull, DoorOpen, Gamepad2, Flag, ShieldCheck, Book, Map, TrainFront, Trophy,
  Clapperboard, Car, GitCommitHorizontal, EyeOff, Handshake,
  Workflow, SquareStack, Compass, Languages, Volume2, Leaf, Presentation,
}

export function AchievementsView() {
  const unlocked = useIDE((s) => s.unlocked)
  const total = ACHIEVEMENTS.length
  const got = ACHIEVEMENTS.filter((a) => unlocked[a.id]).length
  const pct = Math.round((got / total) * 100)

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-line px-3 py-3">
        <div className="flex items-baseline justify-between font-mono text-[11px]">
          <span className="text-ink">{got} / {total} unlocked</span>
          <span className="text-inkfaint">{pct}%</span>
        </div>
        <div
          className="mt-1.5 h-[3px] bg-raised"
          role="progressbar"
          aria-label="achievements unlocked"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="h-full bg-ember transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-1.5 flex items-center justify-between font-mono text-[9.5px] text-inkfaint">
          <span>gamerscore: {got * 15}G — the portfolio keeps score</span>
          <ShareCard got={got} total={total} />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pb-2">
        {ACHIEVEMENTS.map((a) => {
          const at = unlocked[a.id]
          const locked = !at
          const hidden = locked && a.secret
          const Icon = hidden ? Lock : (ICONS[a.icon] ?? Trophy)
          return (
            <div
              key={a.id}
              className={`flex items-start gap-2.5 border-l-2 px-3 py-2 ${
                locked ? 'border-transparent opacity-60' : 'border-ember'
              }`}
            >
              <span
                className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center border ${
                  locked ? 'border-line bg-raised text-inkfaint' : 'border-ember/50 bg-ember/15 text-ember'
                }`}
              >
                <Icon size={13} />
              </span>
              <div className="min-w-0">
                <div className={`font-mono text-[11.5px] ${locked ? 'text-inkfaint' : 'text-ink'}`}>
                  {hidden ? '???' : a.name}
                  {a.secret && !hidden && <span className="ml-1.5 text-[8.5px] text-violet">secret</span>}
                </div>
                <div className="font-mono text-[10px] leading-snug text-inkfaint">
                  {hidden ? 'keep exploring. the portfolio notices things.' : a.desc}
                </div>
                {at && (
                  <div className="mt-0.5 font-mono text-[8.5px] text-inkfaint">
                    {new Date(at).toLocaleDateString()} · +15G
                  </div>
                )}
              </div>
            </div>
          )
        })}
        <div className="px-3 py-3 font-mono text-[9.5px] leading-relaxed text-inkfaint">
          toasts can be muted in <button className="text-tide hover:underline" onClick={() => store.getState().openPseudo('ui:settings')}>settings</button> —
          but where's the fun in that.
        </div>
      </div>
    </div>
  )
}

/** the virality loop — copies a text card, because a screenshot says less */
function ShareCard({ got, total }: { got: number; total: number }) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<number>(0)
  useEffect(() => () => clearTimeout(timer.current), [])
  return (
    <button
      onClick={() => {
        void copyToClipboard(
          `i unlocked ${got}/${total} achievements in a portfolio that is a code editor — https://kushalgangarapu.com`,
        ).then((ok) => {
          if (ok) {
            setCopied(true)
            clearTimeout(timer.current)
            timer.current = window.setTimeout(() => setCopied(false), 1400)
          }
        })
      }}
      title="copy a brag-line to the clipboard"
      className="flex items-center gap-1 text-inkfaint transition-colors hover:text-ember"
    >
      {copied ? <Check size={10} className="text-sage" /> : <Share2 size={10} />}
      {copied ? 'copied' : 'share'}
    </button>
  )
}
