// the guided route — a click-through itinerary for people who don't know
// what a sidebar is. each stop is a store action + a plain-English caption.
import { store } from '../state/store'

export interface Stop {
  /** short name shown in the progress bar */
  label: string
  /** one plain sentence — no IDE jargon */
  caption: string
  go: () => void
}

const open = (path: string) => () => store.getState().openFile(path, { mode: 'preview' })

export const ROUTE: Stop[] = [
  {
    label: 'readme',
    caption: 'the readme — who this person is, in 30 seconds',
    go: open('README.md'),
  },
  {
    label: 'a project',
    caption: 'the flagship project — the calendar his whole school uses, as a markdown file',
    go: open('projects/wildcat-calendar.md'),
  },
  {
    label: 'experience',
    caption: 'experience.json — work history as structured data. yes, it type-checks',
    go: open('experience.json'),
  },
  {
    label: 'the career',
    caption: 'source control — the career as a git graph. every commit is clickable',
    go: () => store.getState().ensureView('git'),
  },
  {
    label: 'skills',
    caption: 'skills.toml — the toolkit, as config. the left rail "skills" shows them as plugins',
    go: open('skills.toml'),
  },
  {
    label: 'contact',
    caption: 'contact.env — the env file with the actual email in it',
    go: open('contact.env'),
  },
  {
    label: 'build it',
    caption: 'F5 — compile this whole workspace into a readable page for recruiters',
    go: () => store.getState().buildForProduction(),
  },
]
