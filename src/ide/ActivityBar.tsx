import { Files, Search, GitBranch, Play, Blocks, Settings, UserRound, Trophy, Rocket } from 'lucide-react'
import { useIDE, store, isDirtyPath } from '../state/store'
import type { SidebarView } from '../state/store'
import { RAIL_CAPTIONS, tt } from '../tourist/copy'

const ITEMS: { view: SidebarView; icon: React.ElementType; label: string }[] = [
  { view: 'explorer', icon: Files, label: 'Explorer (Ctrl+Shift+E)' },
  { view: 'search', icon: Search, label: 'Search (Ctrl+Shift+F)' },
  { view: 'git', icon: GitBranch, label: 'Source Control (Ctrl+Shift+G)' },
  { view: 'run', icon: Play, label: 'Run and Debug' },
  { view: 'extensions', icon: Blocks, label: 'Extensions (Ctrl+Shift+X)' },
  { view: 'achievements', icon: Trophy, label: 'Achievements' },
]

export function ActivityBar() {
  const activeView = useIDE((s) => s.activeView)
  const sidebarOpen = useIDE((s) => s.sidebarOpen)
  const mobile = useIDE((s) => s.mobile)
  const dirtyCount = useIDE((s) => Object.keys(s.fileContents).filter((p) => isDirtyPath(s, p)).length)
  const unlockedCount = useIDE((s) => Object.keys(s.unlocked).length)
  const setView = useIDE((s) => s.setView)
  const isTourist = useIDE((s) => s.settings['kushal.jargon'] === 'tourist')

  if (mobile) {
    return (
      <div className="flex h-11 shrink-0 items-center justify-around border-t border-line bg-chrome">
        {ITEMS.map(({ view, icon: Icon, label }) => {
          const active = activeView === view && sidebarOpen
          const buttonLabel =
            view === 'git' && dirtyCount > 0
              ? `${label} (${dirtyCount})`
              : view === 'achievements' && unlockedCount > 0
                ? `${label} (${unlockedCount})`
                : label
          return (
            <button
              key={view}
              title={buttonLabel}
              aria-label={buttonLabel}
              aria-pressed={active}
              onClick={() => setView(view)}
              className={`relative flex h-full w-12 flex-col items-center justify-center gap-0.5 ${active ? 'text-ink' : 'text-inkfaint'}`}
            >
              {active && <span className="absolute top-0 left-1/2 h-[2px] w-8 -translate-x-1/2 bg-ember" />}
              <Icon size={18} strokeWidth={1.6} />
              {isTourist && <span className="font-mono text-[7px] leading-none">{RAIL_CAPTIONS[view]}</span>}
              {view === 'git' && dirtyCount > 0 && (
                <span aria-hidden="true" className="absolute top-1 right-2 min-w-[13px] rounded-full bg-ember px-0.5 text-center font-mono text-[8px] font-bold leading-[13px] text-abyss">
                  {dirtyCount}
                </span>
              )}
            </button>
          )
        })}
        <button
          title="build readable page"
          aria-label="build readable page"
          onClick={() => store.getState().buildForProduction()}
          className="flex h-full w-12 items-center justify-center text-ember"
        >
          <Rocket size={20} strokeWidth={1.6} />
        </button>
      </div>
    )
  }

  return (
    <nav aria-label="sections" className="flex w-12 shrink-0 flex-col items-center border-r border-line bg-chrome py-1">
      {ITEMS.map(({ view, icon: Icon, label }) => {
        const active = activeView === view && sidebarOpen
        const buttonLabel =
          view === 'git' && dirtyCount > 0
            ? `${label} (${dirtyCount})`
            : view === 'achievements' && unlockedCount > 0
              ? `${label} (${unlockedCount})`
              : label
        return (
          <button
            key={view}
            title={buttonLabel}
            aria-label={buttonLabel}
            aria-pressed={active}
            onClick={() => setView(view)}
            className={`relative my-1 flex w-full flex-col items-center justify-center gap-0.5 transition-colors ${
              isTourist ? 'h-12' : 'h-10'
            } ${active ? 'text-ink' : 'text-inkfaint hover:text-inkdim'}`}
          >
            {active && <span className="absolute left-0 top-1/2 h-6 w-[2px] -translate-y-1/2 bg-ember" />}
            <Icon size={20} strokeWidth={1.6} />
            {isTourist && <span className="font-mono text-[7px] leading-none">{RAIL_CAPTIONS[view]}</span>}
            {view === 'git' && dirtyCount > 0 && (
              <span aria-hidden="true" className="absolute bottom-1 right-1 min-w-[14px] rounded-full bg-ember px-0.5 text-center font-mono text-[8.5px] font-bold leading-[14px] text-abyss">
                {dirtyCount}
              </span>
            )}
            {view === 'achievements' && unlockedCount > 0 && (
              <span aria-hidden="true" className="absolute bottom-1 right-1 min-w-[14px] rounded-full bg-violet px-0.5 text-center font-mono text-[8.5px] font-bold leading-[14px] text-abyss">
                {unlockedCount}
              </span>
            )}
          </button>
        )
      })}
      <div className="mt-auto flex flex-col items-center gap-1 pb-1">
        <button
          title={tt('whoami', 'about this person')}
          aria-label="whoami — about this person"
          onClick={() => store.getState().openFile('README.md')}
          className="flex h-9 w-9 items-center justify-center text-inkfaint transition-colors hover:text-inkdim"
        >
          <UserRound size={19} strokeWidth={1.6} />
        </button>
        <button
          title="settings (Ctrl+,)"
          aria-label="settings"
          onClick={() => store.getState().openPseudo('ui:settings')}
          className="flex h-9 w-9 items-center justify-center text-inkfaint transition-colors hover:text-inkdim"
        >
          <Settings size={19} strokeWidth={1.6} />
        </button>
        {dirtyCount > 0 && (
          <span title={`${dirtyCount} unsaved file(s)`} className="mb-1 h-1.5 w-1.5 rounded-full bg-ember" />
        )}
      </div>
    </nav>
  )
}
