export type Lane = 0 | 1 | 2 | 3
export const LANE_MAIN: Lane = 0
export const LANE_ORG: Lane = 1
export const LANE_SIDE: Lane = 2
export const LANE_VISITOR: Lane = 3

export interface Commit {
  hash: string
  lane: Lane
  msg: string
  date: string
  /** if set, draw a merge curve from this commit's lane to lane `mergeFrom` */
  mergeFrom?: Lane
  body?: string
  diff?: string[]
  /** workspace files touched — commit detail links them open */
  files?: string[]
  /** annotated tag to render beside the dot (git log --decorate style) */
  tag?: string
}

export const BRANCH_COLORS: Record<Lane, string> = {
  [LANE_MAIN]: 'var(--ember)',
  [LANE_ORG]: 'var(--tide)',
  [LANE_SIDE]: 'var(--sage)',
  [LANE_VISITOR]: 'var(--violet)',
}

export const BRANCH_NAMES: Record<Lane, string> = {
  [LANE_MAIN]: 'main',
  [LANE_ORG]: 'feature/leadership',
  [LANE_SIDE]: 'feature/side-quests',
  [LANE_VISITOR]: 'visitor/you',
}

// newest → oldest, like `git log` — every entry is a real event
export const COMMITS: Commit[] = [
  {
    hash: 'e7a1c2f', lane: LANE_MAIN, msg: 'chore: rebuilt the portfolio as an IDE (meta)', date: '2026-09',
    tag: 'v2027.0-beta',
    body: 'a hero section with a gradient felt dishonest',
    diff: ['+ src/ide/ (you are here)', '+ content/ (the truth)', '- hero-section.tsx (good riddance)', '- "passionate full-stack developer"'],
    files: ['src/person.ts', 'tests/hireable.test.ts', 'README.md'],
  },
  {
    hash: '9c4b1e8', lane: LANE_SIDE, msg: 'feat: bcss-newspaper — the school paper, in-browser', date: '2026-09',
    body: 'next.js 16 + supabase + pdf.js. the 50MB upload never touches the function body — browser to storage, then the api validates the stored bytes.',
    diff: ['+ pdf.js reader (full devicePixelRatio)', '+ rls on every table', '+ magic-byte revalidation', '- "please download the pdf"'],
    files: ['projects/bcss-newspaper.md', 'notes/the-upload-that-couldnt-touch-the-server.md'],
  },
  {
    hash: '4f2d8a6', lane: LANE_ORG, msg: 'feat: student monitor — summer school ops', date: '2026-07',
    body: 'sd41 summer school: navigation, classroom access, supply requests. built the excel system tracking registrations, withdrawals, transfers — admin reporting ran on it.',
    diff: ['+ centralized tracking workbook', '+ faster admin reporting', '- hallway confusion (reduced, not eliminated)'],
    files: ['experience.json'],
  },
  {
    hash: '7b9e3c1', lane: LANE_ORG, msg: 'feat: co-leader — chess club & the good guys', date: '2026-06',
    body: 'two promotions in one month. elementary-school chess pipeline plus community outreach. the good guys fundraised $1,000+ last year.',
    diff: ['+ chess teaching initiative (elementary schools)', '+ partnerships pipeline', '- available evenings'],
    files: ['experience.json'],
  },
  {
    hash: '2a6f9d4', lane: LANE_MAIN, msg: 'feat: co-prime minister — 60-person team', date: '2026-05',
    body: 'student government. from minister of technology to co-pm — four years, three titles, one school of 1,500.',
    diff: ['+ 60-member exec team to align', '+ school-wide event strategy + budget', '- plausible deniability'],
    files: ['experience.json'],
  },
  {
    hash: '5d8b2e9', lane: LANE_MAIN, msg: "Merge branch 'feature/side-quests' into main", date: '2026-03',
    mergeFrom: LANE_SIDE,
    body: 'wildcat-calendar merged to production. the school runs on it now — conflicts: none, users: all of them.',
    files: ['projects/wildcat-calendar.md'],
  },
  {
    hash: 'a1e4c7b', lane: LANE_SIDE, msg: 'feat: wildcat-calendar — 1,500+ users, live', date: '2026-02',
    body: 'react 19 + express + postgres + prisma. real-time sse sync, sub-100ms loads, pwa install. the centralized hub for every club on campus.',
    diff: ['+ 4-view calendar (month/week/day/agenda)', '+ sse live sync + offline cache', '+ jwt httponly + bcrypt + rate limits', '- the bulletin board nobody read'],
    files: ['projects/wildcat-calendar.md'],
  },
  {
    hash: '8e3a5f2', lane: LANE_ORG, msg: 'feat: debate club — president', date: '2025-11',
    body: 'weekly sessions, 15+ members, formal argumentation. formerly the marketing manager — the funnel worked so well they made me the product.',
    diff: ['+ structured coaching pipeline', '+ measurable member improvement', '- fear of microphones (deprecated school-wide)'],
    files: ['experience.json'],
  },
  {
    hash: 'c7d1b4e', lane: LANE_ORG, msg: 'feat: chess instructor @ bc junior chess', date: '2025-10',
    body: 'weekly lessons at morley elementary. designed the curriculum, kept it fun, watched a 7-year-old sacrifice a queen on purpose.',
    diff: ['+ lesson plans', '+ the next generation of tacticians', '- pieces lost under tables'],
    files: ['experience.json'],
  },
  {
    hash: 'f6a9d3c', lane: LANE_ORG, msg: 'feat: bright minds — event coordinator', date: '2025-10',
    body: 'mental-health awareness events — the cozy room. volunteers organized, teachers partnered, students actually showed up.',
    diff: ['+ volunteer coordination', '+ the cozy room', '- stigma (work in progress, trending down)'],
    files: ['experience.json'],
  },
  {
    hash: '3b8e1a7', lane: LANE_MAIN, msg: "Merge branch 'feature/leadership' into main", date: '2025-09',
    mergeFrom: LANE_ORG,
    body: 'daydream vancouver reconciled into the main timeline. sleep schedule: merge conflict unresolved.',
  },
  {
    hash: 'd4f7c2e', lane: LANE_ORG, msg: 'feat: daydream vancouver — largest youth hackathon in western canada', date: '2025-09',
    body: '$5,200+ raised so 130+ hackers could attend free. 12-hour game jam, godot/unity/art/sound workshops, 50+ games shipped to itch.io.',
    diff: ['+ sponsorship pipeline ($5,200+)', '+ 130 hackers fed and caffeinated', '+ 50+ shipped games', '- one (1) sleep schedule'],
    files: ['experience.json'],
  },
  {
    hash: '6a2d9f4', lane: LANE_SIDE, msg: 'feat: skylands — godot game, daydream training', date: '2025-08',
    body: 'built for hack club\'s daydream training. gdscript, mit-licensed, at least one mechanic invented at 1am and kept.',
    diff: ['+ scenes + scripts + sprites', '+ gdscript fluency', '- daylight'],
    files: ['projects/sidequests.md'],
  },
  {
    hash: '9e5b7a3', lane: LANE_ORG, msg: 'feat: district student advisory council', date: '2025-06',
    body: 'selected to represent burnaby central at the district level — structured feedback straight to sd41.',
    diff: ['+ district-level seat', '+ policy feedback loop', '- the phrase "not my department"'],
    files: ['experience.json'],
  },
  {
    hash: '4c8f1d6', lane: LANE_MAIN, msg: 'feat: minister of technology — student government', date: '2025-05',
    body: 'three straight grade-rep terms → minister of technology. the technology portfolio: actual technology.',
    diff: ['+ tech portfolio', '+ exec table seat', '- excuses'],
    files: ['experience.json'],
  },
  {
    hash: '7d3e6b9', lane: LANE_ORG, msg: 'feat: general exec @ bc youth developer collective', date: '2025-04',
    body: 'the org behind daydream. joined as general exec — ended up co-running the largest youth hackathon in western canada.',
    diff: ['+ org-level event ops', '+ sponsor emails, venue logistics, workshop wrangling', '- weekends (see .gitignore)'],
    files: ['experience.json'],
  },
  {
    hash: '2f9a4c8', lane: LANE_SIDE, msg: 'feat: reverse-captcha — only bots pass', date: '2025-03',
    body: 'a captcha with the threat model inverted. humans fail; scripts pass. the joke is fully implemented.',
    diff: ['+ humanity detection (inverted)', '+ perfect-click heuristics', '- confidence in "i am not a robot" checkboxes'],
    files: ['projects/reverse-captcha.md'],
  },
  {
    hash: '8b4d6e1', lane: LANE_ORG, msg: 'feat: head of marketing — the shoreline guardians', date: '2024-10',
    body: 'instagram 30 → 1,000+ followers in seven months. weekly shoreline cleanups, 15+ volunteers, real dirt under real fingernails.',
    diff: ['+ content strategy that worked (700% activity)', '+ weekly cleanup ops', '- the "post and pray" era'],
    files: ['experience.json'],
  },
  {
    hash: '5e7c3a9', lane: LANE_ORG, msg: 'feat: math & computing club — co-leader', date: '2024-09',
    body: 'weekly problem-solving for 20+ members. the fun kind of homework, inflicted voluntarily.',
    diff: ['+ competition prep pipeline', '+ 20+ regulars', '- free lunch periods'],
    files: ['experience.json'],
  },
  {
    hash: '1d6f8b4', lane: LANE_SIDE, msg: 'feat: faithful-flight — sold to classmates', date: '2023-02',
    body: 'grade 8 math project that escaped the classroom. pygame arcade game — encrypted saves, texture packs, discord rpc. raised $100+. first revenue.',
    diff: ['+ pygame game loop + physics', '+ pbkdf2/fernet save encryption', '+ texture pack studio', '- inventory: unsold copies (none left)'],
    files: ['projects/faithful-flight.md'],
  },
  {
    hash: 'd84e0f1', lane: LANE_MAIN, msg: 'feat: enrolled @ Burnaby Central Secondary — grade 8', date: '2022-09',
    body: 'elected grade 8 student-government rep — the first of three straight terms. the rep seat and the code both stuck.',
    diff: ['+ focus: computer science + math', '+ student council seat', '+ the wildcats'],
    files: ['experience.json'],
  },
  {
    hash: '6c3a9e2', lane: LANE_SIDE, msg: 'init repo: python-projects', date: '2022-06',
    body: 'first github repo. the code is bad. the trajectory is not.',
    diff: ['+ python basics', '+ the habit of finishing things'],
  },
  {
    hash: '1a2b3c4', lane: LANE_MAIN, msg: 'init: hello, world', date: '2009-01',
    body: 'compiled successfully. no errors (yet).',
    diff: ['+ consciousness (beta)', '+ fingers (for typing, eventually)'],
    files: ['README.md'],
  },
]
