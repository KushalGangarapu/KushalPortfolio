import { useEffect, useRef, useState } from 'react'
import { Check, Copy } from 'lucide-react'

export function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  // a pending reset must not fire into an unmounted component
  const timer = useRef<number>(0)
  useEffect(() => () => clearTimeout(timer.current), [])
  return (
    <button
      className="absolute right-2 top-2 z-10 border border-line bg-chrome/80 p-1 text-inkfaint opacity-0 transition-opacity hover:text-ink group-hover/code:opacity-100 focus-visible:opacity-100"
      title="copy"
      aria-label="copy code block"
      onClick={() => {
        // only flash the check when the write resolves — a rejected promise
        // (denied permission, insecure context) must not lie about copying
        void navigator.clipboard?.writeText(text).then(() => {
          setCopied(true)
          clearTimeout(timer.current)
          timer.current = window.setTimeout(() => setCopied(false), 1200)
        }).catch(() => {})
      }}
    >
      {copied ? <Check size={11} className="text-sage" /> : <Copy size={11} />}
    </button>
  )
}
