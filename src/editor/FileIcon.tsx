const ICONS: Record<string, { glyph: string; color: string }> = {
  md: { glyph: 'M↓', color: 'var(--tide)' },
  rs: { glyph: 'rs', color: 'var(--ember)' },
  go: { glyph: 'go', color: 'var(--tide)' },
  c: { glyph: 'c', color: 'var(--violet)' },
  cpp: { glyph: 'c+', color: 'var(--violet)' },
  py: { glyph: 'py', color: 'var(--sage)' },
  ts: { glyph: 'ts', color: 'var(--tide)' },
  tsx: { glyph: 'tx', color: 'var(--tide)' },
  js: { glyph: 'js', color: 'var(--ember)' },
  json: { glyph: '{}', color: 'var(--ember)' },
  toml: { glyph: '≡', color: 'var(--sage)' },
  env: { glyph: '.e', color: 'var(--sage)' },
  kushalrc: { glyph: 'rc', color: 'var(--ink-dim)' },
  gitignore: { glyph: 'ⓖ', color: 'var(--rust)' },
  sh: { glyph: '$_', color: 'var(--sage)' },
  pdf: { glyph: 'pd', color: 'var(--rust)' },
  '1': { glyph: 'mn', color: 'var(--ink-dim)' },
  txt: { glyph: '≡', color: 'var(--ink-dim)' },
}

export function FileIcon({ ext, size = 14 }: { ext: string; size?: number }) {
  const icon = ICONS[ext] ?? { glyph: '·', color: 'var(--ink-faint)' }
  return (
    <span
      className="inline-flex select-none items-center justify-center font-mono font-semibold leading-none"
      style={{ width: size + 4, fontSize: Math.max(8, size - 4), color: icon.color }}
      aria-hidden
    >
      {icon.glyph}
    </span>
  )
}
