// line-level diff (LCS) — files are small, O(n·m) is fine
export interface DiffLine {
  type: 'same' | 'add' | 'del'
  text: string
  oldLn?: number
  newLn?: number
}

export interface Hunk {
  oldStart: number
  oldLines: number
  newStart: number
  newLines: number
  lines: DiffLine[]
}

export function diffLines(a: string, b: string): DiffLine[] {
  const A = a.split('\n')
  const B = b.split('\n')
  const n = A.length
  const m = B.length

  // the LCS table is (n+1)×(m+1) — a visitor-pasted megabyte would allocate
  // tens of millions of cells. above the cap, just show a whole-file replace.
  if (n * m > 2_000_000) {
    return [
      ...A.map((text, i): DiffLine => ({ type: 'del', text, oldLn: i + 1 })),
      ...B.map((text, i): DiffLine => ({ type: 'add', text, newLn: i + 1 })),
    ]
  }

  // LCS table
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }

  const out: DiffLine[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (A[i] === B[j]) {
      out.push({ type: 'same', text: A[i], oldLn: i + 1, newLn: j + 1 })
      i++
      j++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ type: 'del', text: A[i], oldLn: i + 1 })
      i++
    } else {
      out.push({ type: 'add', text: B[j], newLn: j + 1 })
      j++
    }
  }
  while (i < n) out.push({ type: 'del', text: A[i], oldLn: ++i })
  while (j < m) out.push({ type: 'add', text: B[j], newLn: ++j })
  return out
}

export function diffStats(a: string, b: string): { add: number; del: number } {
  const d = diffLines(a, b)
  return {
    add: d.filter((l) => l.type === 'add').length,
    del: d.filter((l) => l.type === 'del').length,
  }
}

export function hunks(a: string, b: string, ctx = 3): Hunk[] {
  const lines = diffLines(a, b)
  const changed = lines.map((l, i) => ({ l, i })).filter((x) => x.l.type !== 'same')
  if (!changed.length) return []

  // group changed indices within 2*ctx
  const groups: { start: number; end: number }[] = []
  let gs = Math.max(0, changed[0].i - ctx)
  let ge = changed[0].i + ctx
  for (let k = 1; k < changed.length; k++) {
    const ci = changed[k].i
    if (ci - ctx <= ge + 1) {
      ge = Math.min(lines.length - 1, ci + ctx)
    } else {
      groups.push({ start: gs, end: Math.min(lines.length - 1, ge) })
      gs = Math.max(0, ci - ctx)
      ge = ci + ctx
    }
  }
  groups.push({ start: gs, end: Math.min(lines.length - 1, ge) })

  return groups.map(({ start, end }) => {
    const slice = lines.slice(start, end + 1)
    const oldStart = slice.find((l) => l.oldLn !== undefined)?.oldLn ?? 0
    const newStart = slice.find((l) => l.newLn !== undefined)?.newLn ?? 0
    return {
      oldStart,
      oldLines: slice.filter((l) => l.type !== 'add').length,
      newStart,
      newLines: slice.filter((l) => l.type !== 'del').length,
      lines: slice,
    }
  })
}
