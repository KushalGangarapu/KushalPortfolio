import { Bell, Trash2, GitBranch, Blocks, Braces, UserRound, Trophy, Settings, AlertTriangle } from 'lucide-react'
import { useIDE, store } from '../state/store'
import { exec } from '../terminal/commands'
import { getFile } from '../vfs/fs'
import type { Notification } from '../state/store'

const ICONS: Record<Notification['icon'], React.ReactNode> = {
  git: <GitBranch size={13} className="text-tide" />,
  ext: <Blocks size={13} className="text-violet" />,
  lsp: <Braces size={13} className="text-tide" />,
  kushal: <UserRound size={13} className="text-ember" />,
  achv: <Trophy size={13} className="text-ember" />,
  settings: <Settings size={13} className="text-inkdim" />,
  warn: <AlertTriangle size={13} className="text-ember" />,
}

function ago(t: number) {
  const s = Math.max(1, Math.floor((Date.now() - t) / 1000))
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m`
  return `${Math.floor(s / 3600)}h`
}

export function Notifications() {
  const notifsOpen = useIDE((s) => s.notifsOpen)
  const notifications = useIDE((s) => s.notifications)
  const setNotifsOpen = useIDE((s) => s.setNotifsOpen)
  const markRead = useIDE((s) => s.markNotificationsRead)
  const clear = useIDE((s) => s.clearNotifications)
  const unread = notifications.filter((n) => !n.read).length

  return (
    <div className="relative flex items-stretch">
      <button
        onClick={() => {
          setNotifsOpen(!notifsOpen)
          if (!notifsOpen) markRead()
        }}
        className="relative flex h-full items-center gap-1 px-2 text-inkdim transition-colors hover:bg-raised"
        title="notifications"
        aria-label={unread > 0 ? `notifications, ${unread} unread` : 'notifications'}
        aria-expanded={notifsOpen}
        aria-haspopup="dialog"
      >
        <Bell size={11} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-ember px-1 text-[8.5px] font-bold text-abyss">
            {unread}
          </span>
        )}
      </button>
      {notifsOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setNotifsOpen(false)} />
          <div
            className="slideup absolute bottom-6 right-0 z-50 w-[320px] border border-line bg-chrome shadow-[0_-8px_30px_rgba(0,0,0,0.5)]"
            role="dialog"
            aria-label="notifications"
          >
            <div className="flex items-center justify-between border-b border-line px-3 py-2">
              <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-inkfaint">
                notifications
              </span>
              <button
                onClick={clear}
                className="flex items-center gap-1 font-mono text-[10px] text-inkfaint transition-colors hover:text-rust"
              >
                <Trash2 size={11} /> clear all
              </button>
            </div>
            <div className="max-h-[300px] overflow-y-auto">
              {notifications.length === 0 && (
                <div className="px-3 py-6 text-center font-mono text-[11px] text-inkfaint">
                  zero notifications. inbox zero. inner peace.
                </div>
              )}
              {[...notifications].reverse().map((n) => (
                <div
                  key={n.id}
                  role={n.target ? 'button' : undefined}
                  tabIndex={n.target ? 0 : undefined}
                  onKeyDown={
                    n.target
                      ? (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            e.currentTarget.click()
                          }
                        }
                      : undefined
                  }
                  onClick={() => {
                    if (!n.target) return
                    const s = store.getState()
                    if (n.target.startsWith('view:')) s.ensureView(n.target.slice(5) as 'git' | 'achievements' | 'explorer')
                    else if (n.target.startsWith('cmd:')) {
                      s.setPanelTab('terminal')
                      exec(n.target.slice(4))
                    } else if (n.target.startsWith('diff:') || n.target.startsWith('commit:') || n.target.startsWith('ui:') || n.target.startsWith('untitled:')) s.openPseudo(n.target)
                    else if (getFile(n.target) || Object.hasOwn(s.virtualFiles, n.target)) s.openFile(n.target)
                    else s.toast(`'${n.target}' isn't here anymore — dead link`, 'warn')
                    setNotifsOpen(false)
                  }}
                  className={`flex items-start gap-2.5 border-b border-line/60 px-3 py-2.5 last:border-0 ${
                    n.target ? 'cursor-pointer transition-colors hover:bg-raised' : ''
                  }`}
                  title={n.target ? `open ${n.target}` : undefined}
                >
                  <span className="mt-0.5 shrink-0">{ICONS[n.icon]}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate font-mono text-[11px] text-ink">{n.title}</span>
                      <span className="shrink-0 font-mono text-[9px] text-inkfaint">{ago(n.time)}</span>
                    </div>
                    <div className="mt-0.5 font-mono text-[10.5px] leading-snug text-inkdim">{n.body}</div>
                    {n.target && <div className="mt-0.5 font-mono text-[9px] text-tide">→ {n.target}</div>}
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-line px-3 py-1.5 font-mono text-[9px] text-inkfaint">
              delivered by kushal-notify v1.0 — no push, only pull
            </div>
          </div>
        </>
      )}
    </div>
  )
}
