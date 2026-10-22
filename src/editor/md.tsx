import { useMemo } from 'react'
import { parseFrontmatter, renderMarkdown } from './md-render'

export function Markdown({ src, path }: { src: string; path?: string }) {
  const { body } = useMemo(() => parseFrontmatter(src), [src])
  // the pipeline (parse → element tree incl. HoverSym) is pure for a given
  // src — memoize so unrelated store updates don't re-render the whole doc
  const doc = useMemo(() => renderMarkdown(body, path), [body, path])
  return <div className="mdprose">{doc}</div>
}
