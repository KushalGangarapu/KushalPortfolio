// tourist copy — one place owns every plain-English label so the jargon
// setting (`kushal.jargon: dev | tourist`) is a single swap everywhere.
import { store } from '../state/store'

/** is the UI speaking plain English right now? */
export function tourist(): boolean {
  return store.getState().settings['kushal.jargon'] === 'tourist'
}

/** tt(dev label, tourist label) — call sites stay one line */
export function tt(dev: string, touristLabel: string): string {
  return tourist() ? touristLabel : dev
}

/** sidebar section headers — both vocabularies */
export const SECTION_TITLES: Record<string, [string, string]> = {
  explorer: ['Explorer', 'files — the portfolio'],
  search: ['Search', 'find in files'],
  git: ['Source Control', 'the career · your edits'],
  run: ['Run and Debug', 'run & debug'],
  extensions: ['Extensions', 'skills, as plugins'],
  achievements: ['Achievements', 'the trophy room'],
}

/** activity-bar captions under the icons — tourist only, keeps the bar narrow */
export const RAIL_CAPTIONS: Record<string, string> = {
  explorer: 'files',
  search: 'find',
  git: 'career',
  run: 'run',
  extensions: 'skills',
  achievements: 'trophies',
}
