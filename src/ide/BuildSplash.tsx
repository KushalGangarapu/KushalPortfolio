import { store, contentOf, isDirtyPath } from '../state/store'
import { getFile, allFiles } from '../vfs/fs'
import { FileIcon } from '../editor/FileIcon'

/** `key =` entries under non-meta sections — the count npm ls would print */
function countSkillEntries(toml: string): number {
  let n = 0
  let meta = false
  for (const raw of toml.split('\n')) {
    const line = raw.trim()
    const sec = /^\[(\w+)\]/.exec(line)
    if (sec) {
      meta = sec[1] === 'meta'
      continue
    }
    if (!meta && /^\w+\s*=/.test(line)) n++
  }
  return n
}

/**
 * the ~1.3s "compiling" beat before the readable view lands — a terminal
 * window that streams a real build log. the counts are read off the live
 * workspace, so a visitor's edits (and their commits) show up in the output.
 * no timers: the stagger is pure CSS animation-delay.
 */
export function BuildSplash() {
  const s = store.getState()
  const bag = { fileContents: s.fileContents, virtualFiles: s.virtualFiles, baselines: s.baselines }
  const live = (p: string) => {
    const f = getFile(p)
    return f ? contentOf(bag, f) : ''
  }
  const projects = allFiles().filter((f) => f.path.startsWith('projects/')).length
  let roles: number | undefined
  try {
    roles = (JSON.parse(live('experience.json')) as { experience?: unknown[] }).experience?.length
  } catch {
    roles = undefined // half-edited json — a real build reports the file, not a count
  }
  const skills = countSkillEntries(live('skills.toml'))
  const patches =
    Object.keys(s.fileContents).filter((p) => isDirtyPath(bag, p)).length + s.visitorCommits.length

  // reduced-motion: the global css clamps duration to ~0, but animation-delay
  // would still hold lines at their invisible from-state — drop the stagger
  const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  const delay = (i: number) => ({ animationDelay: still ? '0ms' : `${i * 130}ms`, animationFillMode: 'both' as const })

  const rows: { ext: string; name: string; count?: number; to: string }[] = [
    { ext: 'md', name: 'README.md', to: 'intro' },
    { ext: 'md', name: 'projects/*.md', count: projects, to: 'work' },
    { ext: 'json', name: 'experience.json', count: roles, to: 'git log' },
    { ext: 'toml', name: 'skills.toml', count: skills, to: 'npm ls' },
    { ext: 'env', name: 'contact.env', to: 'contact' },
  ]

  let i = 0
  return (
    <div className="fadein fixed inset-0 z-[70] flex flex-col items-center justify-center bg-abyss/95 px-4 font-mono">
      <div className="w-[min(92vw,560px)] border border-line bg-chrome shadow-[0_24px_70px_rgba(0,0,0,0.45)]">
        <div className="flex h-8 items-center border-b border-line px-3 text-[10.5px] uppercase tracking-wide text-inkfaint">
          TERMINAL — kushal build --production
        </div>
        <div className="p-3 text-[12px] leading-[1.8]">
          <p className="slideup" style={delay(i++)}>
            <span className="text-tide">~/portfolio</span> <span className="text-ember">$</span> kushal build --production
          </p>
          {/* grid rows — padEnd spaces collapse in html, columns are the point */}
          {rows.map((r) => (
            <p key={r.name} className="slideup grid grid-cols-[16px_minmax(0,1fr)_auto_minmax(0,1fr)_16px] items-center" style={delay(i++)}>
              <FileIcon ext={r.ext} size={12} />
              <span className="truncate">
                <span className="text-ink">{r.name}</span>
                {r.count !== undefined && <span className="text-inkfaint"> ({r.count})</span>}
              </span>
              <span className="px-2 text-inkfaint">→</span>
              <span className="truncate text-inkdim">{r.to}</span>
              <span className="text-ember">✓</span>
            </p>
          ))}
          {patches > 0 && (
            <p className="slideup text-violet" style={delay(i++)}>
              {'  ● '}{patches} visitor patch{patches === 1 ? '' : 'es'} applied
            </p>
          )}
          <p className="slideup text-sage" style={delay(i++)}>
            {'  ✓'} readable.html — compiled in 1.3s · deploying…
          </p>
        </div>
        <div className="border-t border-line/60 px-3 py-1.5 text-[10px] text-inkfaint">
          tree-shaking imposter syndrome… removed 0 bytes
        </div>
        {/* buildbar — the window's bottom edge, keyframed to the 1.3s build */}
        <div role="progressbar" aria-label="compiling readable build" className="h-[2px] w-full overflow-hidden bg-raised">
          <div className="h-full w-full origin-left animate-[buildbar_1.3s_ease-out] bg-ember" />
        </div>
      </div>
    </div>
  )
}
