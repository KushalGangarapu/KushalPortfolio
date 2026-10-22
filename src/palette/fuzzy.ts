/** subsequence match indices (for highlighting), or null on no match */
export function fuzzyIdx(query: string, text: string): number[] | null {
  const q = query.toLowerCase()
  const t = text.toLowerCase()
  if (!q) return []
  const idx: number[] = []
  let qi = 0
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) {
      idx.push(i)
      qi++
    }
  }
  return qi === q.length ? idx : null
}

/** subsequence fuzzy score; higher = better, -1 = no match */
export function fuzzy(query: string, text: string): number {
  const q = query.toLowerCase()
  const t = text.toLowerCase()
  if (!q) return 0
  let qi = 0
  let score = 0
  let streak = 0
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) {
      streak++
      score += 10 + streak * 6
      if (i === 0 || /[\s\-_./]/.test(t[i - 1])) score += 12
      qi++
    } else {
      streak = 0
      score -= 1
    }
  }
  return qi === q.length ? score : -1
}
