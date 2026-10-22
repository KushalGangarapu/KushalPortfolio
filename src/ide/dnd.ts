// drag payload parsing — dataTransfer carries strings from anywhere the OS
// will marshal (another window, an extension, a misbehaving webview). a
// 'kushal/tab' payload that isn't {pane: string, idx: int>=0} is not ours.

export interface TabDrag {
  pane: string
  idx: number
}

export function parseTabDrag(raw: string): TabDrag | null {
  try {
    const d: unknown = JSON.parse(raw)
    if (typeof d !== 'object' || d === null) return null
    const { pane, idx } = d as Record<string, unknown>
    if (typeof pane !== 'string' || !Number.isInteger(idx) || (idx as number) < 0) return null
    return { pane, idx: idx as number }
  } catch {
    return null
  }
}
