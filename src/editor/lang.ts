import { HighlightStyle, StreamLanguage, syntaxHighlighting } from '@codemirror/language'
import type { Language } from '@codemirror/language'
import { tags as t } from '@lezer/highlight'
import type { Tag, Highlighter } from '@lezer/highlight'
import { highlightCode } from '@lezer/highlight'

import { javascript } from '@codemirror/lang-javascript'
import { json } from '@codemirror/lang-json'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { shell } from '@codemirror/legacy-modes/mode/shell'
import { toml } from '@codemirror/legacy-modes/mode/toml'
import { yaml } from '@codemirror/legacy-modes/mode/yaml'

// tag → css class, shared by CM and the static highlighter
const SPEC: [Tag | undefined, string][] = [
  [t.comment, 'tok-com'],
  [t.lineComment, 'tok-com'],
  [t.blockComment, 'tok-com'],
  [t.docComment, 'tok-com'],
  [t.keyword, 'tok-kw'],
  [t.controlKeyword, 'tok-kw'],
  [t.definitionKeyword, 'tok-kw'],
  [t.moduleKeyword, 'tok-kw'],
  [t.operatorKeyword, 'tok-kw'],
  [t.modifier, 'tok-kw'],
  [t.string, 'tok-str'],
  [t.docString, 'tok-str'],
  [t.character, 'tok-str'],
  [t.attributeValue, 'tok-str'],
  [t.regexp, 'tok-str'],
  [t.escape, 'tok-str'],
  [t.number, 'tok-num'],
  [t.integer, 'tok-num'],
  [t.float, 'tok-num'],
  [t.bool, 'tok-builtin'],
  [t.atom, 'tok-builtin'],
  [t.null, 'tok-builtin'],
  [t.self, 'tok-builtin'],
  [t.macroName, 'tok-builtin'],
  [t.typeName, 'tok-type'],
  [t.className, 'tok-type'],
  [t.tagName, 'tok-type'],
  [t.namespace, 'tok-type'],
  [t.propertyName, 'tok-prop'],
  [t.attributeName, 'tok-prop'],
  [t.definition(t.variableName), 'tok-var'],
  [t.function(t.variableName), 'tok-fn'],
  [t.standard(t.variableName), 'tok-builtin'],
  [t.variableName, 'tok-var'],
  [t.labelName, 'tok-type'],
  [t.operator, 'tok-op'],
  [t.punctuation, 'tok-op'],
  [t.separator, 'tok-op'],
  [t.bracket, 'tok-op'],
  [t.heading, 'tok-kw'],
  [t.strong, 'tok-kw'],
  [t.emphasis, 'tok-type'],
  [t.link, 'tok-str'],
  [t.url, 'tok-str'],
  [t.monospace, 'tok-str'],
  [t.meta, 'tok-com'],
  [t.processingInstruction, 'tok-com'],
  [t.annotation, 'tok-builtin'],
  [t.invalid, 'tok-err'],
  [t.strikethrough, 'tok-com'],
  [t.contentSeparator, 'tok-op'],
]

export const kushalHighlight = HighlightStyle.define(
  SPEC.filter((s): s is [Tag, string] => s[0] !== undefined).map(([tag, className]) => ({ tag, class: className })),
)

/** Highlighter object for @lezer/highlight's highlightCode() */
export const kushalHighlighter: Highlighter = {
  style(tags: readonly Tag[]): string | null {
    for (const [tag, cls] of SPEC) {
      if (tag && tags.includes(tag)) return cls
    }
    return null
  },
}

export const highlightExtension = syntaxHighlighting(kushalHighlight, { fallback: true })

const shellLang = StreamLanguage.define(shell)
const tomlLang = StreamLanguage.define(toml)
const yamlLang = StreamLanguage.define(yaml)

// only grammars the workspace (and its fences) actually uses — rust/cpp/go/py
// parsers were eagerly shipped for zero files; unknown exts degrade to plain
const LANGS: Record<string, Language | null> = {
  md: markdown({ base: markdownLanguage }).language,
  ts: javascript({ typescript: true }).language,
  tsx: javascript({ typescript: true, jsx: true }).language,
  js: javascript().language,
  json: json().language,
  toml: tomlLang,
  yaml: yamlLang,
  yml: yamlLang,
  env: shellLang,
  sh: shellLang,
  kushalrc: shellLang,
  gitignore: shellLang,
  '1': null,
  txt: null,
  pdf: null,
}

export function langFor(ext: string): Language | null {
  return LANGS[ext.toLowerCase()] ?? null
}

const fenceLangs: Record<string, string> = { bash: 'sh', shell: 'sh', javascript: 'js', typescript: 'ts', text: 'txt', console: 'txt' }

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** syntax-highlight a fenced code block to HTML spans using the same theme */
export function highlightToHtml(code: string, lang: string): string {
  const l = fenceLangs[lang] ?? lang
  const language = langFor(l)
  if (!language) return esc(code)
  let html = ''
  try {
    highlightCode(
      code,
      language.parser.parse(code),
      kushalHighlighter,
      (text, classes) => {
        html += classes ? `<span class="${classes}">${esc(text)}</span>` : esc(text)
      },
      () => {
        html += '\n'
      },
    )
  } catch {
    return esc(code)
  }
  return html
}
