import { useEffect, useRef, useState } from 'react'
import { useIDE } from '../state/store'
import { COMMITS } from '../vfs/gitdata'
import { allFiles } from '../vfs/fs'

const BOOT_LINES = [
  'loading extensions… ok (13 installed, 1 deprecated)',
  'parsing ~/.kushalrc… ok (aliases loaded, regrets included)',
  `indexing workspace… ${allFiles().length} files, 1 man page`,
  `resolving git history… ${COMMITS.length} commits, ${COMMITS.filter((c) => c.mergeFrom !== undefined).length} merges, 1 revert`,
  'compiling personality… done in 0.42s',
]

export function Splash() {
  const boot = useIDE((s) => s.boot)
  const restored = useIDE((s) => s.restoredSession)
  const still = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
  const [step, setStep] = useState(0)
  const [fading, setFading] = useState(false)
  const booted = useRef(false)

  const LINES = restored ? ['restoring workspace… ok', ...BOOT_LINES] : BOOT_LINES
  const stepMs = still ? 40 : restored ? 90 : 220 // returning visitors or reduced motion users get a faster boot

  useEffect(() => {
    if (step < LINES.length) {
      const t = setTimeout(() => setStep((s) => s + 1), still ? 30 : restored ? 90 : 180 + Math.random() * stepMs)
      return () => clearTimeout(t)
    }
    if (!booted.current) {
      booted.current = true
      const t1 = setTimeout(() => setFading(true), still ? 100 : 350)
      const t2 = setTimeout(() => boot(), still ? 200 : 650)
      return () => {
        clearTimeout(t1)
        clearTimeout(t2)
      }
    }
  }, [step, boot, LINES.length, restored, stepMs, still])

  // any click or keypress skips the ceremony — the IDE is behind this
  const skipTimer = useRef<number | undefined>(undefined)
  useEffect(() => () => clearTimeout(skipTimer.current), [])
  const skip = () => {
    if (booted.current) return
    booted.current = true
    setFading(true)
    skipTimer.current = window.setTimeout(() => boot(), 150)
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="loading portfolio"
      tabIndex={0}
      onClick={skip}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter' || e.key === 'Escape') skip()
      }}
      title="click or press space to skip"
      className={`fixed inset-0 z-[60] flex cursor-pointer flex-col items-center justify-center bg-abyss outline-none transition-opacity duration-300 ${
        fading ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      <div className="mb-6 select-none font-mono text-[clamp(28px,5vw,44px)] font-bold tracking-tight text-ink text-center">
        <span className="text-ember">▮</span> Kushal Gangarapu
      </div>
      <div className="w-[min(480px,84vw)] font-mono text-[11px] leading-[1.9]">
        {LINES.slice(0, step).map((l, i) => (
          <div key={i} className="fadein flex items-center gap-2 text-inkdim">
            <span className="text-sage">✓</span>
            {l}
          </div>
        ))}
        {step < LINES.length && (
          <div className="flex items-center gap-2 text-inkfaint">
            <span className="blink text-ember">▮</span>
            {LINES[step].split('…')[0]}…
          </div>
        )}
      </div>
      <div className="absolute bottom-6 font-mono text-[10px] text-inkfaint text-center">
        Kushal Gangarapu · a portfolio that compiles{!restored && ' · click anywhere to skip'}
      </div>
    </div>
  )
}
