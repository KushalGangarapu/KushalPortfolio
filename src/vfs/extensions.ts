import { COMMITS } from './gitdata'

export interface Extension {
  id: string
  name: string
  version: string
  desc: string
  /** plain-English version for tourist mode — the marketplace bit is a metaphor */
  plain?: string
  stars: number // 0..5
  installs: string
  changelog: string
  defaultEnabled: boolean
  /** skills.toml entries this extension powers — keeps the recruiter build honest */
  skillKeys?: string[]
}

// skills, but make it a marketplace
export const EXTENSIONS: Extension[] = [
  {
    id: 'typescript', name: 'TypeScript', version: '5.x',
    desc: 'This very site, in fact — plus the calendar the school runs on.',
    plain: 'what this entire site and wildcat-calendar are written in — you are looking at the proof.',
    stars: 5, installs: '1,500 users', changelog: 'added: discriminated unions everywhere.',
    defaultEnabled: true, skillKeys: ['typescript'],
  },
  {
    id: 'react', name: 'React 19', version: '19.x',
    desc: 'Production-grade — the calendar serves 1,500+ students and faculty daily.',
    plain: 'the UI library behind wildcat-calendar — in real production, not a tutorial.',
    stars: 5, installs: 'prod', changelog: 'fixed: the pep rally now shows on the right day.',
    defaultEnabled: true, skillKeys: ['react'],
  },
  {
    id: 'node', name: 'Node + Express', version: 'lts',
    desc: 'APIs with JWT HttpOnly sessions, bcrypt, and per-device rate limiting.',
    plain: 'the backend behind the calendar — real auth, real hardening.',
    stars: 4, installs: 'prod', changelog: 'hardened: rate limits before the school found the api.',
    defaultEnabled: true, skillKeys: ['node'],
  },
  {
    id: 'postgres', name: 'PostgreSQL + Prisma', version: '16',
    desc: 'Typed end to end, migrations in git. I can explain EXPLAIN.',
    plain: 'the database wildcat-calendar runs on — typed queries via prisma.',
    stars: 4, installs: 'load-bearing', changelog: 'optimized: batch apis over request waterfalls.',
    defaultEnabled: true, skillKeys: ['postgres', 'prisma', 'sql'],
  },
  {
    id: 'python', name: 'Python', version: '3.12',
    desc: 'The duct tape of my childhood — first software sold was a pygame game.',
    plain: 'the language faithful-flight is written in — sold to classmates for $100+.',
    stars: 5, installs: '$100+ revenue', changelog: 'added: pbkdf2 save encryption, age 13.',
    defaultEnabled: true, skillKeys: ['python', 'pygame'],
  },
  {
    id: 'java', name: 'Java', version: '21',
    desc: 'AP Computer Science A: 5 on the exam, 100% in the course.',
    plain: 'the AP CSA language — scored a 5 with a perfect course grade.',
    stars: 4, installs: 'ap: 5', changelog: 'no changelog. it just keeps running.',
    defaultEnabled: true, skillKeys: ['java'],
  },
  {
    id: 'nextjs', name: 'Next.js + Supabase', version: '16',
    desc: 'The school paper lives on it — RLS everywhere, PDFs at full sharpness.',
    plain: 'the stack behind bcss-newspaper — auth, storage, row-level security.',
    stars: 4, installs: 'the whole paper', changelog: 'fixed: 50MB uploads route around the platform limit.',
    defaultEnabled: true, skillKeys: ['nextjs', 'supabase'],
  },
  {
    id: 'pwa', name: 'PWA + SSE', version: 'offline-first',
    desc: 'Service workers, install prompts, and server-sent events that actually sync.',
    plain: 'the tech that makes the calendar feel instant and update live.',
    stars: 4, installs: 'sub-100ms', changelog: 'added: edits land on every screen in real time.',
    defaultEnabled: true, skillKeys: ['pwa', 'sse'],
  },
  {
    id: 'git', name: 'Git', version: '2.45',
    desc: 'Rebases without fear. Reads reflog like scripture.',
    plain: 'version control — the commit graph on the left is his real career timeline.',
    stars: 5, installs: `${COMMITS.length} commits deep`, changelog: 'fixed: the commit graph is the portfolio.',
    defaultEnabled: true, skillKeys: ['git'],
  },
  {
    id: 'godot', name: 'Godot + Unity', version: 'game-jam',
    desc: 'Skylands shipped for Daydream Training; ran the workshops at Daydream.',
    plain: 'game engines — built a game, then taught 130 hackers to build theirs.',
    stars: 3, installs: '130+ hackers taught', changelog: 'added: 12-hour game-jam endurance.',
    defaultEnabled: true, skillKeys: ['godot', 'unity'],
  },
  {
    id: 'rust', name: 'Rust + C/C++ + Dart', version: 'learning',
    desc: 'On the resume because the intent is real — exposure-level, trending up.',
    plain: 'honest entry: early-stage languages, listed because honesty scales.',
    stars: 2, installs: 'intent: real', changelog: 'status: learning. claims: calibrated.',
    defaultEnabled: true, skillKeys: ['rust', 'cpp', 'dart'],
  },
  {
    id: 'leadership', name: 'Event Ops + Leadership', version: 'district-scale',
    desc: 'Ran a 130+-person hackathon and a 60-person student government. Ships people, not just code.',
    plain: 'the non-IDE skills — events, teams, sponsorships, actually leading things.',
    stars: 5, installs: '$5,200+ raised', changelog: 'added: the largest youth hackathon in western canada.',
    defaultEnabled: true, skillKeys: ['event_ops', 'public_speaking', 'sponsorship', 'marketing', 'mentoring'],
  },
  {
    id: 'center-div', name: 'Center Div With Tables', version: '1.0.0-deprecated',
    desc: 'Legacy layout engine. Superseded by flexbox and inner peace.',
    plain: 'a joke entry. he can actually do CSS — you are looking at it.',
    stars: 1, installs: '0 (healed)', changelog: 'deprecated: healed.',
    defaultEnabled: false,
  },
]
