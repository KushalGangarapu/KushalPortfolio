import { flushSync } from 'react-dom'

/**
 * run a mode flip inside a View Transition so the IDE ⇄ artifact swap morphs
 * instead of hard-cutting. flushSync forces React to commit the DOM inside the
 * transition callback — without it the update batches to after the snapshot
 * and old/new frames come out identical.
 *
 * call-site only: wrap explicit user toggles (F5, close buttons, chips), not
 * the store actions themselves — openFile/dismissReadable also run on SrcLink
 * jumps where reordering state updates would break the hash/title sync.
 */
export function withViewTransition(fn: () => void): void {
  if (
    'startViewTransition' in document &&
    !document.hidden &&
    !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  ) {
    try {
      const transition = document.startViewTransition(() => {
        flushSync(fn)
      })
      transition.finished?.catch(() => {
        // Ignored: transitions can abort if the tab is backgrounded or interrupted
      })
    } catch {
      fn()
    }
  } else {
    fn()
  }
}
