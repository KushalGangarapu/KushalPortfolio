export interface AchievementDef {
  id: string
  name: string
  desc: string
  secret?: boolean
  icon: string // lucide icon name handled by view
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'readme-first', name: 'README First', desc: 'Opened the readme. the tutorial everyone skips.', icon: 'BookOpen' },
  { id: 'hello-shell', name: 'Hello, Shell', desc: 'Ran your first terminal command.', icon: 'Terminal' },
  { id: 'schelling', name: 'Schelling Point', desc: 'Ran 10 terminal commands. you live here now.', icon: 'TerminalSquare' },
  { id: 'power-user', name: 'Power User', desc: 'Opened the command palette.', icon: 'Command' },
  { id: 'historian', name: 'Historian', desc: 'Opened the git graph. the career is real.', icon: 'GitBranch' },
  { id: 'forensics', name: 'Forensics', desc: 'Expanded a commit diff. trust but verify.', icon: 'Search' },
  { id: 'editor', name: 'Ship It Anyway', desc: 'Edited a file that is not yours.', icon: 'PencilLine' },
  { id: 'time-traveler', name: 'Time Traveler', desc: 'Reverted all changes. the timeline heals.', icon: 'History' },
  { id: 'diff-detective', name: 'Diff Detective', desc: 'Opened a real diff of your own edits.', icon: 'GitCompare' },
  { id: 'split-brain', name: 'Split Brain', desc: 'Split the editor. two panes, one kushal.', icon: 'Columns2' },
  { id: 'tinkerer', name: 'Tinkerer', desc: 'Changed a setting. the file noticed.', icon: 'Settings2' },
  { id: 'code-whisperer', name: 'Code Whisperer', desc: 'Used go-to-definition on a person.', icon: 'MousePointerClick' },
  { id: 'refactor-justice', name: 'Refactor Justice', desc: "Fixed 'work-life balance'. it was never defined.", icon: 'Wrench' },
  { id: 'production-ready', name: 'Production Ready', desc: 'Built for production. the recruiters got a page.', icon: 'Rocket' },
  { id: 'night-owl', name: 'Night Owl', desc: 'Visited between 23:00 and 05:00. respect.', icon: 'Moon', secret: true },
  { id: 'vim-fatalities', name: 'vim Fatalities', desc: 'Entered vim. may whatever god you believe in help you.', icon: 'Skull', secret: true },
  { id: 'exit-vim', name: 'exit vim', desc: 'Escaped vim. you are now legally a veteran.', icon: 'DoorOpen', secret: true },
  { id: 'konami', name: '↑↑↓↓←→←→BA', desc: 'demo god mode unlocked.', icon: 'Gamepad2', secret: true },
  { id: 'red-flag', name: 'Red Flag', desc: 'Ran rm -rf. the files have lawyers.', icon: 'Flag', secret: true },
  { id: 'sudo-please', name: 'sudo please', desc: 'Used sudo. elevated privileges, elevated manners.', icon: 'ShieldCheck', secret: true },
  { id: 'man-page', name: 'RTFM', desc: 'Read the manual. all of it, probably.', icon: 'Book', secret: true },
  { id: 'cartographer', name: 'Cartographer', desc: 'Opened every file in the workspace. thorough.', icon: 'Map', secret: true },
  { id: 'sl-conductor', name: 'Locomotive Enjoyer', desc: 'Ran `sl`. a train, in the terminal. choice.', icon: 'TrainFront', secret: true },
  { id: 'sightseer', name: 'Sightseer', desc: 'Took the full guided tour. the IDE drove; you watched.', icon: 'Clapperboard' },
  { id: 'backseat-driver', name: 'Backseat Driver', desc: 'Grabbed the wheel mid-tour. understandable.', icon: 'Car', secret: true },
  { id: 'you-were-here', name: 'You Were Here', desc: 'Committed to visitor/you — the portfolio remembers.', icon: 'GitCommitHorizontal' },
  { id: 'redacted', name: 'REDACTED', desc: 'Clicked the dots in contact.env. curiosity: not dead.', icon: 'EyeOff', secret: true },
  { id: 'pipe-dream', name: 'Pipe Dream', desc: 'Piped a command into another. the plumbing holds.', icon: 'Workflow', secret: true },
  { id: 'cannot-leave', name: 'Cannot Leave', desc: 'Tried :q without the bang. vim refused, politely, twice.', icon: 'Lock', secret: true },
  { id: 'shell-shocked', name: 'Shell Shocked', desc: 'Ran 50 terminal commands. this is your home now.', icon: 'TerminalSquare', secret: true },
  { id: 'tab-dancer', name: 'Tab Dancer', desc: 'Cycled through tabs with Ctrl+Tab like you meant it.', icon: 'SquareStack', secret: true },
  { id: 'path-taken', name: 'Path Taken', desc: 'Finished the guided route. all seven stops.', icon: 'Compass' },
  { id: 'tourist', name: 'Tourist', desc: 'Switched to plain-English labels. no shame in it.', icon: 'Languages', secret: true },
  { id: 'heard-it', name: 'Heard It', desc: 'Made the browser talk. it says "koo-shahl".', icon: 'Volume2', secret: true },
  { id: 'grass-toucher', name: 'Grass Toucher', desc: 'Touched grass. digitally, but still.', icon: 'Leaf', secret: true },
  { id: 'demo-watcher', name: 'Demo Watcher', desc: 'Watched the site demo itself. a trailer inside the film.', icon: 'Clapperboard', secret: true },
  { id: 'deal-closer', name: 'Deal Closer', desc: 'Ran sudo hire-me — the mailto is already drafted.', icon: 'Handshake', secret: true },
  { id: 'keynote', name: 'Keynote', desc: 'Opened the slide deck — the portfolio presents itself now.', icon: 'Presentation' },
  { id: 'freshman-year', name: 'Freshman Year', desc: 'Scrubbed the career graph back to a younger version.', icon: 'History', secret: true },
  { id: 'platinum', name: 'Completionist', desc: 'Everything unlocked. the portfolio bows.', icon: 'Trophy', secret: true },
]
