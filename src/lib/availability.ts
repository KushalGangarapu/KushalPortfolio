// availability label — single source of truth is OPEN_TO in contact.env.
// "summer-2027-internships" → "summer 2027 internships"; bump the data, not the UI.
import { getFile } from '../vfs/fs'

export function availabilityLabel(envSrc?: string): string {
  const src = envSrc ?? getFile('contact.env')?.original ?? ''
  const openTo = /^OPEN_TO=([^\n#]+)/m.exec(src)?.[1]?.trim() ?? 'summer-2027-internships'
  return openTo.split(',')[0].trim().replace(/-/g, ' ')
}

/** a few open_to entries, humanized — "summer-2027-internships,new-grad" → "summer 2027 internships · new-grad" */
export function availabilityLong(envSrc?: string): string {
  const src = envSrc ?? getFile('contact.env')?.original ?? ''
  const openTo = /^OPEN_TO=([^\n#]+)/m.exec(src)?.[1]?.trim() ?? 'summer-2027-internships'
  return openTo.split(',').map((s) => s.trim().replace(/-/g, ' ')).join(' · ')
}
