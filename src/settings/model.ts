// pure settings logic — no store imports (avoids cycles)
import type { ThemeId } from './theme-types'

export interface Settings {
  'workbench.colorTheme': ThemeId
  'editor.fontSize': number
  'editor.minimap.enabled': boolean
  'editor.wordWrap': 'on' | 'off'
  'editor.tabSize': number
  'kushal.achievements.toasts': boolean
  'kushal.telemetry': boolean
  'kushal.jargon': 'dev' | 'tourist'
}

export const DEFAULT_SETTINGS: Settings = {
  'workbench.colorTheme': 'kushal-midnight',
  'editor.fontSize': 13,
  'editor.minimap.enabled': true,
  'editor.wordWrap': 'on',
  'editor.tabSize': 2,
  'kushal.achievements.toasts': true,
  'kushal.telemetry': false,
  'kushal.jargon': 'dev',
}

export interface SettingMeta {
  key: keyof Settings
  label: string
  desc: string
  kind: 'enum' | 'bool' | 'number'
  options?: string[]
  min?: number
  max?: number
}

export const SETTING_META: SettingMeta[] = [
  { key: 'workbench.colorTheme', label: 'Color Theme', desc: 'the soul of the editor — hover swatches to preview', kind: 'enum', options: ['kushal-midnight', 'demogod', 'kushal-daylight'] },
  { key: 'editor.fontSize', label: 'Editor: Font Size', desc: 'px. bigger = fewer regrets per screen', kind: 'number', min: 10, max: 20 },
  { key: 'editor.minimap.enabled', label: 'Editor: Minimap', desc: 'the decorative-but-honest scroll strip', kind: 'bool' },
  { key: 'editor.wordWrap', label: 'Editor: Word Wrap', desc: 'wrap long lines in source view', kind: 'enum', options: ['on', 'off'] },
  { key: 'editor.tabSize', label: 'Editor: Tab Size', desc: 'spaces. this is a safe space.', kind: 'number', min: 2, max: 8 },
  { key: 'kushal.achievements.toasts', label: 'Achievements: Toasts', desc: 'pop unlock banners when you earn things', kind: 'bool' },
  { key: 'kushal.telemetry', label: 'Telemetry', desc: 'sends nothing, to nobody, always. stays off.', kind: 'bool' },
  { key: 'kushal.jargon', label: 'Jargon Level', desc: 'tourist = plain-English labels for people who don\'t live in code editors', kind: 'enum', options: ['dev', 'tourist'] },
]

export function settingsToJson(s: Settings): string {
  const lines = [
    '{',
    `  "workbench.colorTheme": ${JSON.stringify(s['workbench.colorTheme'])},`,
    `  "editor.fontSize": ${s['editor.fontSize']},`,
    `  "editor.minimap.enabled": ${s['editor.minimap.enabled']},`,
    `  "editor.wordWrap": ${JSON.stringify(s['editor.wordWrap'])},`,
    `  "editor.tabSize": ${s['editor.tabSize']},`,
    `  "kushal.achievements.toasts": ${s['kushal.achievements.toasts']},`,
    `  "kushal.jargon": ${JSON.stringify(s['kushal.jargon'])},`,
    `  "kushal.telemetry": false`,
    '}',
  ]
  return lines.join('\n')
}

export type ParseResult =
  | { ok: true; patch: Partial<Settings> }
  | { ok: false; error: string; line: number }

export function parseSettingsJson(text: string): ParseResult {
  // tolerate // comments like a real settings file (both whole-line and trailing)
  const stripped = text
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/(\b\d+|\btrue|\bfalse|\bnull|"[^"\\]*(?:\\.[^"\\]*)*"|[\],{}])\s*\/\/.*$/gm, '$1')
  let obj: unknown
  try {
    obj = JSON.parse(stripped)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'invalid JSON'
    const lm = /position (\d+)/.exec(msg)
    let line = 1
    if (lm) {
      const pos = Number(lm[1])
      line = stripped.slice(0, pos).split('\n').length
    }
    return { ok: false, error: msg, line }
  }
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
    return { ok: false, error: 'settings must be a JSON object', line: 1 }
  }
  const patch: Partial<Settings> = {}
  const rec = obj as Record<string, unknown>
  for (const meta of SETTING_META) {
    const v = rec[meta.key]
    if (v === undefined) continue
    if (meta.key === 'kushal.telemetry') {
      patch['kushal.telemetry'] = false // it is a promise, not a setting
      continue
    }
    if (meta.kind === 'bool' && typeof v === 'boolean') (patch as Record<string, unknown>)[meta.key] = v
    else if (meta.kind === 'number' && typeof v === 'number') {
      ;(patch as Record<string, unknown>)[meta.key] = Math.max(meta.min ?? 0, Math.min(meta.max ?? 99, v))
    } else if (meta.kind === 'enum' && typeof v === 'string' && meta.options?.includes(v)) {
      ;(patch as Record<string, unknown>)[meta.key] = v
    }
  }
  return { ok: true, patch }
}
