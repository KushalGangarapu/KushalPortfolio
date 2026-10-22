// tiny parsers for our controlled content formats — shared by the readable
// view and the deck build so `contact.env` changes land in both.

export function parseEnv(env: string): Record<string, string> {
  const m: Record<string, string> = {}
  for (const line of env.split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    // strip the trailing ` # comment` — env files earn comments
    if (i > 0) m[t.slice(0, i).trim()] = t.slice(i + 1).replace(/\s+#.*$/, '').trim()
  }
  return m
}
