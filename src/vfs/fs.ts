import { ROOT } from './files'
import type { VDir, VFile, VNode } from './types'
import { SECRET_FILES, secretVFile, secretVDir, secretDirOf } from './secrets'

// module-level reveal set — store.syncs it on unlock + restore (avoids fs→store cycle)
const revealed = new Set<string>()

export function setRevealedPaths(paths: Iterable<string>) {
  revealed.clear()
  for (const p of paths) revealed.add(p)
}

const byPath = new Map<string, VNode>()
const realDirPaths = new Set<string>()

;(function index(node: VNode) {
  byPath.set(node.path, node)
  if (node.type === 'dir') {
    realDirPaths.add(node.path)
    node.children.forEach(index)
  }
})(ROOT)

for (const s of SECRET_FILES) {
  byPath.set(s.path, secretVFile(s))
  const dir = secretDirOf(s)
  if (!byPath.has(dir)) byPath.set(dir, secretVDir(dir))
}

const SECRET_PATHS = new Set(SECRET_FILES.map((s) => s.path))

export function getNode(path: string): VNode | undefined {
  const n = byPath.get(normalize(path))
  if (!n) return undefined
  // unrevealed secrets don't exist — wherever they sit, root included
  if (n.type === 'file' && SECRET_PATHS.has(n.path) && !revealed.has(n.path)) return undefined
  if (n.type === 'dir' && !realDirPaths.has(n.path) && !getDir(n.path)) return undefined
  return n
}

export function getFile(path: string): VFile | undefined {
  const n = getNode(path)
  return n?.type === 'file' ? n : undefined
}

export function getDir(path: string): VDir | undefined {
  const p = normalize(path)
  const n = byPath.get(p)
  if (!n || n.type !== 'dir') return undefined

  // a dir that only exists to hold secrets — empty until one reveals
  if (!realDirPaths.has(p)) {
    const kids = SECRET_FILES.filter((s) => secretDirOf(s) === p && revealed.has(s.path)).map(secretVFile)
    return kids.length ? { ...n, children: kids } : undefined
  }

  // real dir: merge in revealed secret children (root also gains secret dirs)
  const extra: VNode[] = []
  if (p === '') {
    const seen = new Set<string>()
    for (const s of SECRET_FILES) {
      const sd = secretDirOf(s)
      if (sd !== '' && revealed.has(s.path) && !seen.has(sd) && !n.children.some((c) => c.path === sd)) {
        seen.add(sd)
        extra.push(byPath.get(sd)!)
      }
    }
  }
  for (const s of SECRET_FILES) {
    if (revealed.has(s.path) && secretDirOf(s) === p) extra.push(byPath.get(s.path)!)
  }
  return extra.length ? { ...n, children: [...n.children, ...extra] } : n
}

export function allFiles(node: VNode = ROOT): VFile[] {
  if (node.type === 'file') return [node]
  const out = node.children.flatMap(allFiles)
  // append revealed secrets once, at root
  if (node === ROOT) {
    for (const s of SECRET_FILES) if (revealed.has(s.path)) out.push(secretVFile(s))
  }
  return out
}

export function normalize(path: string): string {
  const parts: string[] = []
  for (const seg of path.replace(/\\/g, '/').split('/')) {
    if (!seg || seg === '.') continue
    if (seg === '..') parts.pop()
    else parts.push(seg)
  }
  return parts.join('/')
}

/** resolve a user-typed path against cwd ("" = workspace root, shown as ~) */
export function resolve(cwd: string, input: string): string {
  if (input.startsWith('/') || input.startsWith('~')) {
    return normalize(input.replace(/^~?/, ''))
  }
  return normalize(cwd ? cwd + '/' + input : input)
}

export function parentOf(path: string): string {
  const i = path.lastIndexOf('/')
  return i < 0 ? '' : path.slice(0, i)
}

/** "~" display of a path for the prompt */
export function promptPath(cwd: string): string {
  return cwd ? `~/${cwd}` : '~'
}

export interface SearchHit {
  path: string
  line: number
  col: number
  text: string
}

// hard ceiling — a query matching every line shouldn't allocate the world;
// callers read hits.length === SEARCH_CAP as "and probably more"
export const SEARCH_CAP = 400

export function search(
  query: string,
  opts: { caseSensitive?: boolean; regex?: boolean; word?: boolean } = {},
  overrides?: Record<string, string>,
): SearchHit[] {
  if (!query || query.length > 200) return []
  let re: RegExp
  try {
    const src = opts.regex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const wrapped = opts.word ? `\\b(?:${src})\\b` : src
    re = new RegExp(wrapped, opts.caseSensitive ? 'g' : 'gi')
  } catch {
    return []
  }
  const hits: SearchHit[] = []
  const scan = (path: string, src: string) => {
    const ls = src.split('\n')
    for (let i = 0; i < ls.length && hits.length < SEARCH_CAP; i++) {
      for (const m of ls[i].matchAll(re)) {
        hits.push({ path, line: i + 1, col: m.index ?? 0, text: ls[i].trim() })
        if (hits.length >= SEARCH_CAP) return
        if (m[0] === '') break // zero-width matches would loop forever
      }
    }
  }
  for (const f of allFiles()) {
    if (f.kind === 'pdf' || f.kind === 'image') continue
    scan(f.path, overrides?.[f.path] ?? f.original)
    if (hits.length >= SEARCH_CAP) return hits
  }
  // unsaved drafts live outside the tree — they're searchable too
  for (const p of Object.keys(overrides ?? {})) {
    if (p.startsWith('untitled:') && !byPath.has(p)) scan(p, overrides![p])
  }
  return hits
}
