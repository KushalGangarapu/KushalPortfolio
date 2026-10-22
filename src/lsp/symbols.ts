// the "kushal-ls" symbol registry — every entry is hoverable + go-to-def-able
export interface Symbol {
  /** matched case-insensitively as a whole word/phrase */
  name: string
  kind: 'class' | 'fn' | 'interface' | 'const' | 'module' | 'field'
  signature: string
  doc: string
  /** go-to-definition target */
  target: { file: string; line?: number }
}

export const SYMBOLS: Symbol[] = [
  // projects → their files
  { name: 'wildcat-calendar', kind: 'module', signature: 'mod wildcat_calendar: prod', doc: 'The flagship — calendar + announcements platform for 1,500+ students and faculty. React 19, Express, Postgres, SSE.', target: { file: 'projects/wildcat-calendar.md' } },
  { name: 'wildcat', kind: 'module', signature: 'mod wildcat_calendar: prod', doc: 'The calendar Burnaby Central runs on. 4 views, live sync, sub-100ms.', target: { file: 'projects/wildcat-calendar.md' } },
  { name: 'bcss-newspaper', kind: 'module', signature: 'mod bcss_newspaper: prod', doc: 'The school paper — Next.js 16 + Supabase + PDF.js. The 50MB upload never touches the function body.', target: { file: 'projects/bcss-newspaper.md' } },
  { name: 'newspaper', kind: 'module', signature: 'mod bcss_newspaper: prod', doc: 'In-browser PDF reader, auto-covers, RLS on everything.', target: { file: 'projects/bcss-newspaper.md' } },
  { name: 'faithful-flight', kind: 'module', signature: 'mod faithful_flight: pygame', doc: 'Grade 8 math project that escaped the classroom. Sold to classmates — first revenue, age 13.', target: { file: 'projects/faithful-flight.md' } },
  { name: 'reverse-captcha', kind: 'module', signature: 'mod reverse_captcha: bots_only', doc: 'A CAPTCHA that only lets bots through. The joke is fully implemented.', target: { file: 'projects/reverse-captcha.md' } },
  { name: 'skylands', kind: 'module', signature: 'mod skylands: godot', doc: 'Godot game for Hack Club Daydream Training. GDScript, MIT-licensed.', target: { file: 'projects/sidequests.md' } },

  // orgs & roles → experience.json
  { name: 'daydream', kind: 'interface', signature: 'interface Daydream extends Hackathon', doc: 'Largest youth hackathon in Western Canada. $5,200+ raised, 130+ hackers, 50+ shipped games. He ran it.', target: { file: 'experience.json' } },
  { name: 'daydream vancouver', kind: 'interface', signature: 'interface DaydreamVancouver extends Hackathon', doc: 'Largest youth hackathon in Western Canada — Kushal was general exec at BCYDC.', target: { file: 'experience.json' } },
  { name: 'bcydc', kind: 'interface', signature: 'interface BCYDC extends Org', doc: 'BC Youth Developer Collective — general executive since apr 2025.', target: { file: 'experience.json' } },
  { name: 'co-prime minister', kind: 'interface', signature: 'interface CoPM extends StudentGovernment', doc: 'Runs a 60-person exec team advocating for 1,500+ students.', target: { file: 'experience.json' } },
  { name: 'student government', kind: 'interface', signature: 'interface StudentGov extends Leadership', doc: 'Four years, three titles: grade rep → minister of technology → co-prime minister.', target: { file: 'experience.json' } },
  { name: 'shoreline guardians', kind: 'interface', signature: 'interface ShorelineGuardians extends Nonprofit', doc: 'Head of marketing — Instagram 30 → 1,000+ in seven months; weekly cleanups, 15+ volunteers.', target: { file: 'experience.json' } },
  { name: 'sd41', kind: 'interface', signature: 'interface SD41 extends SchoolDistrict', doc: 'Student Monitor (summer 2026) + District Student Advisory Council member.', target: { file: 'experience.json' } },
  { name: 'burnaby central secondary', kind: 'class', signature: 'class BurnabyCentral implements SecondarySchool', doc: 'CS + math focus, 2022 → 2027. AP CSA 5, AP Calc BC 4.', target: { file: 'experience.json', line: 14 } },
  { name: 'debate club', kind: 'interface', signature: 'interface DebateClub extends Club', doc: 'President — weekly sessions, 15+ members, measurable improvement.', target: { file: 'experience.json' } },
  { name: 'chess', kind: 'interface', signature: 'interface Chess extends Teaching', doc: 'Instructor at Morley Elementary + co-leader of the school club. The pipeline is real.', target: { file: 'experience.json' } },

  // skills → skills.toml / extensions
  { name: 'typescript', kind: 'const', signature: 'let typescript: Skill { level: productive }', doc: 'This very site is written in it. The IDE you are inside.', target: { file: 'skills.toml', line: 8 } },
  { name: 'react', kind: 'const', signature: 'let react: Skill { level: productive }', doc: 'v19, in production, with actual users.', target: { file: 'skills.toml', line: 19 } },
  { name: 'postgres', kind: 'const', signature: 'let postgres: Skill { level: productive }', doc: 'In prod, not in a tutorial. Prisma on top.', target: { file: 'skills.toml', line: 21 } },
  { name: 'prisma', kind: 'const', signature: 'let prisma: ORM', doc: 'Typed end to end; migrations in git, not in someone\'s head.', target: { file: 'skills.toml', line: 22 } },
  { name: 'sse', kind: 'fn', signature: 'fn sse(stream) -> live_updates', doc: 'Server-sent events — the calendar syncs every open session live. Ask him about it; bring time.', target: { file: 'projects/wildcat-calendar.md' } },
  { name: 'server-sent events', kind: 'fn', signature: 'fn sse(stream) -> live_updates', doc: 'The calendar\'s live sync. He will explain unprompted — the test suite asserts it.', target: { file: 'tests/hireable.test.ts' } },
  { name: 'supabase', kind: 'const', signature: 'let supabase: Skill { level: working }', doc: 'Auth + storage + RLS — the newspaper\'s entire backend.', target: { file: 'projects/bcss-newspaper.md' } },
  { name: 'python', kind: 'const', signature: 'let python: Skill { level: fluent }', doc: 'First revenue was a Pygame game. Grade 8. $100+.', target: { file: 'skills.toml', line: 9 } },
  { name: 'pwa', kind: 'const', signature: 'let pwa: Skill { level: productive }', doc: 'Service workers + offline cache — the calendar installs to home screens.', target: { file: 'skills.toml', line: 26 } },
  { name: 'neovim', kind: 'field', signature: 'const neovim: Editor = trap', doc: 'Currently inside it. Send :q!. Terminal easter egg: try it.', target: { file: '.kushalrc' } },
  { name: 'rls', kind: 'fn', signature: 'fn rls(policy) -> RowLevelSecurity', doc: 'Postgres row-level security on every table of the newspaper. Drafts are unreadable at the API, not just hidden.', target: { file: 'projects/bcss-newspaper.md' } },

  // files → themselves
  { name: 'person.ts', kind: 'module', signature: 'mod person: TheKushal', doc: 'The module the test suite imports. hireable: true is asserted, not claimed.', target: { file: 'src/person.ts' } },
  { name: 'contributing', kind: 'module', signature: 'mod contributing: ReferralGuide', doc: 'CONTRIBUTING.md — accepted contributions: referrals, introductions, interesting problems.', target: { file: 'CONTRIBUTING.md' } },
  { name: 'readme', kind: 'module', signature: 'mod readme', doc: 'The about file. You probably opened it first — everyone does.', target: { file: 'README.md' } },
  { name: 'contact.env', kind: 'module', signature: 'mod contact_env', doc: 'How to reach him. Secrets are redacted. The email is real.', target: { file: 'contact.env' } },
  { name: 'resume.pdf', kind: 'module', signature: 'mod resume_pdf: binary', doc: 'The compiled artifact — the same PDF that goes to recruiters.', target: { file: 'resume.pdf' } },
  { name: 'settings.json', kind: 'module', signature: 'mod settings_json: Settings', doc: 'Real settings file. Edits write back into the IDE. Break it — Problems will catch you.', target: { file: 'settings.json' } },
  { name: 'kushalrc', kind: 'module', signature: 'mod kushalrc: ShellConfig', doc: 'Dotfile of preferences and questionable aliases.', target: { file: '.kushalrc' } },
  { name: 'changelog', kind: 'module', signature: 'mod changelog: ReleaseNotes', doc: 'Calver patch notes for a human. Deprecated: sleep schedule.', target: { file: 'CHANGELOG.md' } },
  { name: 'package.json', kind: 'module', signature: 'mod package_json: HumanManifest', doc: '"coffee": "^4.2.0", "postgres": "load-bearing". Engines: node>=18, sleep=deprecated.', target: { file: 'package.json' } },
  { name: 'license', kind: 'module', signature: 'mod license: MIT', doc: 'MIT — permission to hire hereby granted, free of charge.', target: { file: 'LICENSE' } },
  { name: 'hireable', kind: 'const', signature: 'const hireable: true', doc: 'tests/hireable.test.ts asserts it. 6/6 green. Run `npm test`.', target: { file: 'tests/hireable.test.ts' } },
  { name: 'visitor/you', kind: 'module', signature: 'branch visitor/you: YourWork', doc: 'The violet lane. Your commits land there — edit a file, `git commit -m "…"`.', target: { file: 'README.md' } },

  // concepts → docs
  { name: 'work-life balance', kind: 'field', signature: 'let work_life_balance: undefined', doc: 'Not defined. There is a quick-fix in the Problems tab.', target: { file: 'skills.toml' } },
  { name: 'tabs', kind: 'field', signature: 'const tabs = false', doc: 'Spaces. This is a safe space. (editor.tabSize: 2)', target: { file: 'settings.json' } },
  { name: 'demogod', kind: 'const', signature: 'const demogod: Theme', doc: 'The synthwave theme. Unlocked by ↑↑↓↓←→←→BA or `theme demogod`.', target: { file: 'settings.json' } },
]

const LOOKUP = new Map<string, Symbol>()
for (const s of SYMBOLS) LOOKUP.set(s.name.toLowerCase(), s)

export function findSymbol(word: string): Symbol | undefined {
  return LOOKUP.get(word.toLowerCase())
}

// longest-first regex source for whole-phrase matching in text
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const NAMES = SYMBOLS.map((s) => s.name).sort((a, b) => b.length - a.length)
export const SYMBOL_RE = new RegExp(`\\b(${NAMES.map(esc).join('|')})\\b`, 'gi')

/**
 * prose-safety: names that double as ordinary english words only resolve when
 * they show up capitalized in text ('Chess' the club vs 'chess' the game).
 * code-ish contexts still match them lowercase via symbolAt's caller.
 */
const PROSE_NOISE = new Set(['tabs', 'license', 'readme', 'changelog', 'hireable', 'python', 'react', 'chess', 'wildcat', 'newspaper', 'pwa', 'sse', 'rls'])
export function proseOk(matched: string): boolean {
  return !PROSE_NOISE.has(matched.toLowerCase()) || matched !== matched.toLowerCase()
}
