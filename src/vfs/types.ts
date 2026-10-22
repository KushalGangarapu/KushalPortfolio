export type FileKind = 'md' | 'code' | 'json' | 'toml' | 'env' | 'dotfile' | 'pdf' | 'man' | 'txt' | 'image'

export interface VFile {
  type: 'file'
  /** path relative to workspace root, e.g. "projects/wildcat-calendar.md" */
  path: string
  name: string
  ext: string
  kind: FileKind
  /** pristine content — edits live in the store, this never mutates */
  original: string
  /** for binary-ish files served from /public */
  url?: string
}

export interface VDir {
  type: 'dir'
  path: string
  name: string
  children: VNode[]
}

export type VNode = VFile | VDir

export function extOf(name: string): string {
  const base = name.startsWith('.') ? name : name.split('/').pop()!
  if (base.startsWith('.') && !base.slice(1).includes('.')) return base.slice(1)
  const i = base.lastIndexOf('.')
  return i >= 0 ? base.slice(i + 1).toLowerCase() : ''
}

export function kindOf(name: string): FileKind {
  const n = name.toLowerCase()
  const ext = extOf(n)
  if (ext === 'pdf') return 'pdf'
  if (ext === 'md') return 'md'
  if (ext === 'json') return 'json'
  if (ext === 'toml') return 'toml'
  if (ext === 'env' || n === 'contact.env') return 'env'
  if (n === '.kushalrc' || n === '.gitignore' || ext === 'sh' || ext === 'kushalrc' || ext === 'gitignore') return 'dotfile'
  if (ext === '1') return 'man'
  if (['svg', 'png', 'jpg', 'gif', 'webp'].includes(ext)) return 'image'
  if (['rs', 'go', 'c', 'cpp', 'py', 'ts', 'tsx', 'js', 'java'].includes(ext)) return 'code'
  return 'txt'
}
