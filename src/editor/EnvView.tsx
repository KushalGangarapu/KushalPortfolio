import { useState } from 'react'
import { Lock, LockOpen, Copy } from 'lucide-react'
import { store } from '../state/store'

// what the redacted values "really" say when clicked — keys must actually be
// redacted in contact.env or the entry sits dead (SOCIAL_BATTERY says '3%'
// in plain text — nothing to leak)
const LEAKED: Record<string, string> = {
  AWS_SECRET_ACCESS_KEY: 'hunter2 (you saw nothing)',
  HOTPOT_CREDENTIALS: 'broth / simmer',
}

function isRedacted(v: string) {
  return v.includes('•') || /redact/i.test(v)
}

export function EnvView({ src }: { src: string }) {
  const [revealed, setRevealed] = useState<Record<string, string>>({})
  const lines = src.split('\n')

  const leak = (key: string) => {
    const real = LEAKED[key] ?? 'redacted, but flattered'
    setRevealed((r) => ({ ...r, [key]: real }))
    const s = store.getState()
    s.unlock('redacted')
    s.toast(`${key} leaked: "${real}"`, 'ok')
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <div className="mx-auto max-w-[720px] px-8 py-8">
        <div className="mb-6 flex items-center gap-3 border border-line bg-chrome px-4 py-2.5">
          <Lock size={13} className="text-ember" />
          <div className="font-mono text-[11px] text-inkdim">
            environment file — <span className="text-inkfaint">some values redacted. click the dots. you know you want to.</span>
          </div>
        </div>
        <div className="font-mono text-[12.5px] leading-[1.9]">
          {lines.map((l, i) => {
            const t = l.trim()
            if (!t) return <div key={i} className="h-4" />
            if (t.startsWith('#')) {
              return (
                <div key={i} className="text-inkfaint">
                  {l}
                </div>
              )
            }
            const eq = l.indexOf('=')
            if (eq < 0) return <div key={i}>{l}</div>
            const key = l.slice(0, eq).trim()
            let rest = l.slice(eq + 1)
            // `\s+#` — one space before a comment is enough, matching parseEnv
            const hash = rest.search(/\s+#/)
            const comment = hash >= 0 ? rest.slice(hash) : ''
            if (hash >= 0) rest = rest.slice(0, hash)
            const value = rest.trim()
            const redacted = isRedacted(value)
            const shown = revealed[key] ?? value
            return (
              <div key={i} className="group flex items-baseline gap-0 whitespace-pre-wrap">
                <span className="break-all text-ember">{key}</span>
                <span className="text-inkfaint">=</span>
                {redacted && !revealed[key] ? (
                  <button
                    onClick={() => leak(key)}
                    title="click to leak — consequences be damned"
                    aria-label={`reveal redacted value for ${key}`}
                    className="cursor-pointer text-inkdim underline decoration-dotted decoration-inkfaint underline-offset-4 transition-colors hover:text-ember"
                  >
                    {value}
                  </button>
                ) : (
                  <span className={revealed[key] ? 'text-sage' : 'text-ink'}>{shown}</span>
                )}
                {revealed[key] && <LockOpen size={10} className="ml-1.5 inline text-sage" />}
                {!redacted && (
                  <button
                    onClick={() => {
                      if (!navigator.clipboard) {
                        store.getState().toast(`no clipboard — ${key} = ${value}`, 'warn')
                        return
                      }
                      void navigator.clipboard.writeText(value).then(
                        () => store.getState().toast(`copied ${key}`, 'ok'),
                        () => store.getState().toast(`clipboard refused — ${key} = ${value}`, 'warn'),
                      )
                    }}
                    title="copy value"
                    aria-label={`copy ${key}`}
                    className="ml-2 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                  >
                    <Copy size={10} className="inline text-inkfaint hover:text-ink" />
                  </button>
                )}
                {comment && <span className="text-inkfaint">{comment}</span>}
              </div>
            )
          })}
        </div>
        <div className="mt-8 border-t border-dashed border-line pt-3 font-mono text-[10px] text-inkfaint">
          eof · parsed by kushal-dotenv v1.0 · rotate after That One Incident
        </div>
      </div>
    </div>
  )
}
