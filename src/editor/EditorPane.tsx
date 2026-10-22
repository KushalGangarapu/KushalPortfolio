import { useMemo, useRef, useState } from 'react'
import { CodeXml, Eye, Play, Clock, Star, Compass, Clapperboard } from 'lucide-react'
import { useIDE, store, contentOf, resolveTab } from '../state/store'
import { Markdown } from './md'
import { parseFrontmatter } from './md-render'
import { CodeEditor } from './CodeEditor'
import { Minimap } from './Minimap'
import { SlidesView } from '../views/SlidesView'
import { Breadcrumbs } from './Breadcrumbs'
import { PdfView } from './PdfView'
import { DiffView } from './DiffView'
import { EnvView } from './EnvView'
import { CommitView } from './CommitView'
import { SettingsView } from '../settings/SettingsView'
import { EXTENSIONS } from '../vfs/extensions'
import { getFile } from '../vfs/fs'
import { exec } from '../terminal/commands'
import { availabilityLabel } from '../lib/availability'
import { startTour } from '../tour/runner'

/** visitor-edited frontmatter feeds an href — only bare host[:/path] slugs
 *  qualify ('github.com/x', 'bcss-calendar.vercel.app'). a value carrying a
 *  scheme ('javascript:', 'data:') or leading '//' doesn't get a link at all */
function repoHref(v: string | undefined): string | null {
  const first = v?.split(' ')[0] ?? ''
  return /^[\w-]+(\.[\w-]+)+(:\d+)?([/?#][^\s]*)?$/.test(first) ? `https://${first}` : null
}

function FileHeader({ fm }: { fm: Record<string, string> }) {
  const href = repoHref(fm.repo ?? fm.link)
  return (
    <div className="mb-6 border border-line bg-chrome">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 font-mono text-[11px]">
        {fm.title && <span className="text-[13px] font-semibold text-ink">{fm.title}</span>}
        {fm.status && (
          <span className="flex items-center gap-1.5 text-sage">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-sage" />
            {fm.status}
          </span>
        )}
        {fm.year && <span className="text-inkdim">{fm.year}</span>}
        {href && (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="text-tide hover:text-ember hover:underline"
            title="repos are private — the profile is real, the code is a conversation"
          >
            {fm.repo ?? fm.link} ↗
          </a>
        )}
        {fm.stack && (
          <span className="ml-auto flex gap-1.5">
            {fm.stack.split(/\s*[·,]\s*/).map((s) => (
              <span key={s} className="border border-line bg-raised px-1.5 py-0.5 text-[10px] text-inkdim">
                {s.trim()}
              </span>
            ))}
          </span>
        )}
      </div>
      {fm.img && (() => {
        const img = getFile(fm.img)
        return img?.url ? (
          <img src={img.url} alt={`${fm.title ?? 'project'} render`} className="block max-h-56 w-full border-t border-line bg-abyss object-contain" />
        ) : null
      })()}
    </div>
  )
}

const TIPS = [
  'tip: ctrl+click any dotted word — the language server knows kushal lore',
  'tip: edit a file, then `git commit -m "hi"` — your commit joins the graph',
  'tip: F5 compiles this whole editor into a recruiter-readable page',
  'tip: the achievements panel keeps score — locked ones say ???',
  'tip: `vim` in the terminal. go on. :q! is the way out.',
  'tip: notifications archive. the bell, bottom-left, remembers everything',
  'tip: drag a file from the explorer onto a split — panes do panes things',
]

function Welcome() {
  const openFile = useIDE((s) => s.openFile)
  const openedEver = useIDE((s) => s.openedEver)
  const restoredSession = useIDE((s) => s.restoredSession)
  const isTourist = useIDE((s) => s.settings['kushal.jargon'] === 'tourist')
  // deterministic rotation — a fresh tip per session without impure render calls
  const tip = TIPS[openedEver.length % TIPS.length]
  // openedEver is MRU-ordered — most recent first
  const recents = useMemo(
    () => openedEver.filter((p) => !p.startsWith('untitled:') && getFile(p)).slice(0, 4),
    [openedEver],
  )

  return (
    <div className="fadein flex h-full flex-col items-center justify-center gap-7 overflow-auto p-8">
      <div className="select-none text-center">
        <h1 className="mb-2 font-mono text-[72px] font-bold leading-none tracking-tight text-ink">
          <span className="text-ember">▮</span> kushal
        </h1>
        <div className="font-mono text-[15px] text-inkfaint">
          a portfolio that compiles · v2027.0-beta{restoredSession ? ' · session restored' : ''}
        </div>
        <div className="mt-2 font-mono text-[12px] text-inkdim">
          kushal gangarapu — builds software his school runs on · <span className="text-sage">open to {availabilityLabel()}</span>
        </div>
      </div>

      {/* the two ways in — self-driving vs self-paced */}
      <div className="grid w-[min(560px,88vw)] gap-3 sm:grid-cols-2">
        <button
          onClick={() => startTour(exec)}
          className="group flex items-center gap-3 border border-ember/50 bg-chrome px-4 py-3 text-left transition-colors hover:bg-raised"
        >
          <Play size={17} className="shrink-0 text-ember transition-transform group-hover:scale-110" />
          <div>
            <div className="font-mono text-[13px] text-ink">take the tour — it drives itself</div>
            <div className="mt-0.5 font-mono text-[10.5px] text-inkfaint">~30s · any input takes over · F6</div>
          </div>
        </button>
        <button
          onClick={() => {
            store.getState().applySettings({ 'kushal.jargon': 'tourist' })
            store.getState().startGuide()
          }}
          className="group flex items-center gap-3 border border-tide/40 bg-chrome px-4 py-3 text-left transition-colors hover:bg-raised"
        >
          <Compass size={17} className="shrink-0 text-tide transition-transform group-hover:scale-110" />
          <div>
            <div className="font-mono text-[13px] text-ink">the guided route — you click, we drive</div>
            <div className="mt-0.5 font-mono text-[10.5px] text-inkfaint">7 stops · plain English · no IDE needed</div>
          </div>
        </button>
      </div>
      {/* terminal-shy? the trailer plays the same story in 20s */}
      <button
        onClick={() => {
          store.getState().setPanelTab('terminal')
          exec('kushal --demo')
        }}
        className="group -mt-4 flex items-center justify-center gap-2 font-mono text-[11px] text-inkfaint transition-colors hover:text-ember"
      >
        or watch the 10-second trailer <Clapperboard size={12} className="transition-transform group-hover:scale-110" />
      </button>

      <div className="flex w-[min(560px,88vw)] flex-col gap-4 sm:flex-row">
        <div className="min-w-0 flex-1 border border-line bg-chrome">
          <div className="border-b border-line px-3.5 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-inkfaint">
            start
          </div>
          {[
            { label: 'resume.pdf — the paper trail', fn: () => openFile('resume.pdf') },
            { label: 'contact.env — reach out', fn: () => openFile('contact.env') },
            { label: 'README.md — who is this', fn: () => openFile('README.md') },
            { label: 'CHANGELOG.md — release notes', fn: () => openFile('CHANGELOG.md') },
            { label: 'git log — the career', fn: () => store.getState().ensureView('git') },
            { label: 'the trophy room', fn: () => store.getState().ensureView('achievements') },
          ].map((r) => (
            <button
              key={r.label}
              onClick={r.fn}
              className="block w-full truncate px-3.5 py-2 text-left font-mono text-[13px] text-tide transition-colors hover:bg-raised hover:text-ember"
            >
              {r.label}
            </button>
          ))}
        </div>
        <div className="min-w-0 flex-1 border border-line bg-chrome">
          <div className="border-b border-line px-3.5 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-inkfaint">
            recent
          </div>
          {recents.length === 0 ? (
            <div className="px-3.5 py-2.5 font-mono text-[12px] leading-relaxed text-inkfaint">
              nothing yet —
              <br />
              open something
            </div>
          ) : (
            recents.map((p) => (
              <button
                key={p}
                onClick={() => openFile(p)}
                className="flex w-full items-center gap-1.5 truncate px-3.5 py-2 text-left font-mono text-[13px] text-inkdim transition-colors hover:bg-raised hover:text-ink"
              >
                <Clock size={12} className="shrink-0 text-inkfaint" />
                {p.split('/').pop()}
              </button>
            ))
          )}
        </div>
      </div>

      {isTourist ? (
        <div className="max-w-[440px] text-center font-mono text-[12.5px] leading-relaxed text-inkdim">
          this whole page is a program wearing a website costume.{' '}
          <span className="text-ink">everything you see is clickable</span> — the left rail switches
          sections, tabs work like browser tabs, and nothing you do can break it.{' '}
          <span className="text-inkfaint">the ? in the bottom bar draws you a map.</span>
        </div>
      ) : (
        <div className="grid grid-cols-[auto_auto] gap-x-5 gap-y-2 font-mono text-[13px] text-inkdim">
          {[
            ['Ctrl+K', 'command palette — do anything'],
            ['Ctrl+`', 'terminal (a real one)'],
            ['Ctrl+\\', 'split editor'],
            ['F6', 'self-driving tour'],
            ['F5', 'build for production (recruiter mode)'],
          ].map(([k, d]) => (
            <div key={k} className="contents">
              <span className="justify-self-end border border-line bg-raised px-2 py-1 text-ember">{k}</span>
              <span className="self-center">{d}</span>
            </div>
          ))}
        </div>
      )}

      {/* the checklist — exploration as a progress bar */}
      <Checklist />

      <div className="font-mono text-[12px] text-inkfaint">{tip}</div>
    </div>
  )
}

const QUEST: { id: string; label: string; go: () => void }[] = [
  { id: 'readme-first', label: 'read the readme', go: () => store.getState().openFile('README.md') },
  { id: 'historian', label: 'see the career', go: () => store.getState().ensureView('git') },
  { id: 'hello-shell', label: 'run a command', go: () => { store.getState().setPanelTab('terminal'); store.getState().toast('the chips above the input are clickable', 'info') } },
  { id: 'power-user', label: 'open the palette', go: () => store.getState().setPaletteOpen(true) },
  { id: 'production-ready', label: 'build the page', go: () => store.getState().buildForProduction() },
  { id: 'sightseer', label: 'take the tour', go: () => startTour(exec) },
]

function Checklist() {
  const unlocked = useIDE((s) => s.unlocked)
  const done = QUEST.filter((q) => unlocked[q.id]).length
  if (done === QUEST.length) return null
  return (
    <div className="w-[min(560px,88vw)] border border-line bg-chrome">
      <div className="flex items-center justify-between border-b border-line px-3.5 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-inkfaint">
        <span>the grand tour</span>
        <span className="text-ember">{done}/{QUEST.length}</span>
      </div>
      <div className="flex flex-wrap">
        {QUEST.map((q) => {
          const got = !!unlocked[q.id]
          return (
            <button
              key={q.id}
              onClick={got ? undefined : q.go}
              className={`flex w-1/2 items-center gap-2 px-3.5 py-2 text-left font-mono text-[12px] transition-colors sm:w-1/3 ${
                got ? 'cursor-default text-sage' : 'text-inkdim hover:bg-raised hover:text-ink'
              }`}
            >
              <span className={`text-[10px] ${got ? 'text-sage' : 'text-inkfaint'}`}>{got ? '✓' : '○'}</span>
              <span className={got ? 'line-through opacity-70' : ''}>{q.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** `ui:ext/<id>` pseudo-tab — extension marketplace page */
function ExtDetail({ id }: { id: string }) {
  const enabled = useIDE((s) => s.extensionsEnabled[id])
  const toggleExtension = useIDE((s) => s.toggleExtension)
  const ext = EXTENSIONS.find((e) => e.id === id)!
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[640px] px-8 py-8 font-mono">
        <div className="flex items-baseline gap-3">
          <span className="text-[17px] text-ink">{ext.name}</span>
          <span className="text-[11px] text-inkfaint">v{ext.version}</span>
          <span className="flex items-center gap-0.5 text-ember">
            {Array.from({ length: 5 }, (_, i) => (
              <Star key={i} size={10} className={i < ext.stars ? 'fill-ember' : 'opacity-30'} />
            ))}
          </span>
        </div>
        <div className="mt-0.5 text-[11px] text-inkfaint">kushal · installs: {ext.installs}</div>
        <p className="mt-4 text-[13px] leading-relaxed text-inkdim">{ext.desc}</p>
        <button
          onClick={() => toggleExtension(ext.id)}
          className={`mt-5 border px-3 py-1.5 text-[12px] transition-colors ${
            enabled
              ? 'border-rust/50 text-rust hover:bg-rust/10'
              : 'border-sage/50 text-sage hover:bg-sage/10'
          }`}
        >
          {enabled ? 'disable (the skill goes with it)' : 'enable'}
        </button>
        <div className="mt-6 border-t border-line pt-4">
          <div className="mb-1.5 text-[10px] uppercase tracking-[0.14em] text-inkfaint">changelog</div>
          <div className="text-[12px] text-inkdim">{ext.changelog}</div>
        </div>
        <div className="mt-8 text-[10px] text-inkfaint">
          powers: <span className="text-tide">{ext.skillKeys?.join(', ') ?? '—'}</span> · see skills.toml
        </div>
      </div>
    </div>
  )
}

/** image files — renders/wildcat.svg renders as an actual render */
function ImageView({ file }: { file: { path: string; name: string; url?: string } }) {
  // per-file captions — the wildcat lore doesn't belong on a certificate png
  const caption = file.path.startsWith('renders/wildcat.') ? 'drawn by hand, served to 1,500 users' : null
  const sub = file.path.startsWith('renders/wildcat.') ? 'commit a1e4c7b · the calendar the school actually checks'
    : file.path.startsWith('certs/') ? 'the credential, in pixels — verify link lives in experience.json'
    : null
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 overflow-auto bg-abyss p-8">
      {file.url ? (
        <img src={file.url} alt={file.name} className="max-h-[70vh] max-w-full border border-line" />
      ) : (
        <div className="font-mono text-[12px] text-inkfaint">no preview — the pixels are shy</div>
      )}
      <div className="font-mono text-[11px] text-inkfaint">
        {file.path}{caption ? ` · ${caption}` : ''}
      </div>
      {sub && <div className="font-mono text-[10px] text-inkfaint">{sub}</div>}
    </div>
  )
}

export function EditorPane({ paneId }: { paneId: string }) {
  const pane = useIDE((s) => s.panes.find((p) => p.id === paneId))
  const viewModes = useIDE((s) => s.viewModes)
  const fileContents = useIDE((s) => s.fileContents)
  const virtualFiles = useIDE((s) => s.virtualFiles)
  const baselines = useIDE((s) => s.baselines)
  const setViewMode = useIDE((s) => s.setViewMode)
  const minimapOn = useIDE((s) => s.settings['editor.minimap.enabled'])

  // minimap scroll feed — CodeEditor reports its own scroll geometry
  const [scroll, setScroll] = useState({ frac: 0, visible: 1 })
  const cmScroller = useRef<HTMLElement | null>(null)
  const path = pane?.active ?? null

  const file = useMemo(
    () => (path ? resolveTab(store.getState(), path) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [path, virtualFiles],
  )
  const src = file ? contentOf({ fileContents, virtualFiles, baselines }, file) : ''
  const { fm } = useMemo(() => (file?.kind === 'md' ? parseFrontmatter(src) : { fm: null }), [file, src])
  const mobile = useIDE((s) => s.mobile)
  // minimap lines — split once per content change, not per render
  const minimapLines = useMemo(() => src.split('\n'), [src])
  const previewable = !!file && (file.kind === 'md' || file.ext === 'env')
  const mode = file ? (viewModes[file.path] ?? (previewable ? 'preview' : 'raw')) : 'raw'

  if (!pane) return null

  if (path?.startsWith('ui:settings')) {
    return (
      <div className="flex h-full min-w-0 flex-col bg-abyss">
        <Breadcrumbs path="ui:settings" />
        <SettingsView />
      </div>
    )
  }
  if (path?.startsWith('diff:')) {
    return (
      <div className="flex h-full min-w-0 flex-col bg-abyss">
        <Breadcrumbs path={path} />
        <DiffView path={path.slice(5)} />
      </div>
    )
  }
  if (path?.startsWith('commit:')) {
    return (
      <div className="flex h-full min-w-0 flex-col bg-abyss">
        <Breadcrumbs path={path} />
        <CommitView hash={path.slice(7)} />
      </div>
    )
  }
  if (path === 'ui:slides') {
    return (
      <div className="relative flex h-full min-w-0 flex-col bg-abyss">
        <Breadcrumbs path={path} />
        <SlidesView />
      </div>
    )
  }
  if (path?.startsWith('ui:ext/')) {
    const ext = EXTENSIONS.find((e) => e.id === path.slice(7))
    return (
      <div className="flex h-full min-w-0 flex-col bg-abyss">
        <Breadcrumbs path={path} />
        {ext ? <ExtDetail id={ext.id} /> : (
          <div className="flex h-full items-center justify-center font-mono text-[12px] text-inkfaint">
            extension uninstalled itself out of spite
          </div>
        )}
      </div>
    )
  }

  if (!file) return <Welcome />

  const isMd = file.kind === 'md'
  const isEnv = file.ext === 'env'

  return (
    <div className="flex h-full min-w-0 flex-col bg-abyss">
      <Breadcrumbs path={file.path} />
      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          {previewable && (
            <div className="flex justify-end border-b border-line bg-chrome px-2 py-0.5">
              <button
                onClick={() => setViewMode(file.path, mode === 'preview' ? 'raw' : 'preview')}
                className="flex items-center gap-1.5 px-2 py-0.5 font-mono text-[10.5px] text-inkdim transition-colors hover:text-ember"
                title={mode === 'preview' ? 'view source' : 'view rendered'}
              >
                {mode === 'preview' ? <CodeXml size={12} /> : <Eye size={12} />}
                {mode === 'preview' ? 'source' : 'preview'}
              </button>
            </div>
          )}
          {file.kind === 'pdf' ? (
            <PdfView file={file} />
          ) : file.kind === 'image' ? (
            <ImageView file={file} />
          ) : mode === 'preview' && isEnv ? (
            <EnvView src={src} />
          ) : mode === 'preview' && isMd ? (
            // rendered prose gets no minimap — it would map the source, not the scroll
            <div className="min-h-0 flex-1 overflow-auto">
              <div className="mx-auto max-w-[760px] px-8 py-7">
                {fm && <FileHeader fm={fm} />}
                <Markdown src={src} path={file.path} />
                <div className="mt-10 border-t border-dashed border-line pt-3 font-mono text-[10px] text-inkfaint">
                  eof · {file.path} · rendered by kushal
                </div>
              </div>
            </div>
          ) : (
            // raw/source mode — where the minimap actually belongs
            <div className="flex min-h-0 flex-1">
              <CodeEditor
                path={file.path}
                ext={file.ext}
                paneId={paneId}
                value={src}
                onScrollInfo={(frac, visible) => setScroll({ frac, visible })}
                scrollerRef={(el) => (cmScroller.current = el)}
              />
              {/* minimap — off on phones: 54px of dead width on a 360px screen */}
              {minimapOn && !mobile && (
                <Minimap
                  lines={minimapLines}
                  frac={scroll.frac}
                  visible={scroll.visible}
                  onSeek={(frac) => {
                    const el = cmScroller.current
                    if (el) el.scrollTop = frac * Math.max(1, el.scrollHeight - el.clientHeight)
                  }}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
