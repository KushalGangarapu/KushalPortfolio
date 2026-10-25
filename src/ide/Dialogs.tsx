import { useEffect, useRef } from 'react'
import { useIDE, store } from '../state/store'
import { wipePersisted } from '../state/persist'
import { exec } from '../terminal/commands'
import { startTour } from '../tour/runner'
import { Rocket, Compass, X } from 'lucide-react'

const DIALOG_LABELS: Record<string, string> = {
  'save-close': 'save changes?',
  about: 'about kushal',
  'factory-reset': 'factory reset — destructive',
  'first-visit': 'welcome — pick how you want to browse',
  map: 'what am i looking at — site map',
  shortcuts: 'keyboard shortcuts',
}

export function Dialogs() {
  const modal = useIDE((s) => s.modal)
  const setModal = useIDE((s) => s.setModal)
  const frameRef = useRef<HTMLDivElement>(null)

  // focus management: grab focus on open, give it back on close, trap Tab inside
  useEffect(() => {
    if (!modal) return
    const prev = document.activeElement as HTMLElement | null
    const frame = frameRef.current
    frame?.querySelector<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')?.focus()
    // isConnected — the prior element may have unmounted while the dialog was
    // up; focusing a detached node strands focus on <body>
    return () => {
      if (prev?.isConnected) prev.focus()
      else document.getElementById('main-editor')?.focus?.()
    }
  }, [modal])

  if (!modal) return null

  const close = () =>
    modal.kind === 'first-visit' ? store.getState().markSeenIntro() : setModal(null)
  const s = store.getState

  return (
    <div
      className="fadein fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-[2px]"
      onClick={close}
    >
      {/* children set their own width; this only floors the tiny ones */}
      <div
        ref={frameRef}
        role="dialog"
        aria-modal="true"
        aria-label={DIALOG_LABELS[modal.kind] ?? 'dialog'}
        className="slideup max-h-[92vh] w-auto min-w-[min(360px,88vw)] max-w-[94vw] overflow-y-auto border border-line bg-chrome shadow-[0_18px_50px_rgba(0,0,0,0.6)]"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key !== 'Tab') return
          const els = frameRef.current?.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
          )
          if (!els?.length) return
          const first = els[0]
          const last = els[els.length - 1]
          // fallback: if focus is outside the frame entirely (SR virtual cursor,
          // programmatic), pull it back in instead of walking the page behind us
          if (!frameRef.current?.contains(document.activeElement)) {
            e.preventDefault()
            ;(e.shiftKey ? last : first).focus()
          } else if (e.shiftKey && document.activeElement === first) {
            e.preventDefault()
            last.focus()
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault()
            first.focus()
          }
        }}
      >
        {modal.kind === 'save-close' && (
          <>
            <div className="border-b border-line px-4 py-2.5 font-mono text-[12px] text-ink">
              kushal
            </div>
            <div className="px-4 py-4 font-mono text-[12px] leading-relaxed text-inkdim">
              Do you want to save the changes you made to
              <span className="text-ember"> your_offer_letter.md</span>?
              <div className="mt-1.5 text-[10.5px] text-inkfaint">
                Your changes will be lost if you don't save them. (They won't.)
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-line px-4 py-2.5">
              <button
                onClick={() => {
                  close()
                  s().toast("didn't save. bold. risky. respected.", 'warn')
                }}
                className="border border-line px-3 py-1 font-mono text-[11.5px] text-inkdim transition-colors hover:bg-raised"
              >
                don't save
              </button>
              <button
                onClick={close}
                className="border border-line px-3 py-1 font-mono text-[11.5px] text-inkdim transition-colors hover:bg-raised"
              >
                cancel
              </button>
              <button
                onClick={() => {
                  close()
                  s().toast('saved. you are now officially prepared.', 'ok')
                }}
                className="border border-ember/60 bg-ember-glow px-3 py-1 font-mono text-[11.5px] text-ember transition-colors hover:bg-ember/25"
              >
                save
              </button>
            </div>
          </>
        )}

        {modal.kind === 'about' && (
          <>
            <div className="px-4 py-5 text-center">
              <div className="mb-1 font-mono text-[26px] font-bold text-ink">
                <span className="text-ember">▮</span> kushal
              </div>
              <div className="font-mono text-[10.5px] text-inkfaint">version 2027.0-beta (x86_64-sleep-deprived)</div>
              <div className="mx-auto mt-3 max-w-[300px] font-mono text-[11px] leading-relaxed text-inkdim">
                a portfolio that is a code editor, built inside a code editor,
                by someone who couldn't pick between the two.
              </div>
              <div className="mt-3 font-mono text-[10px] text-inkfaint">
                electron free · 0 telemetry · 1 developer
              </div>
            </div>
            <div className="flex justify-center border-t border-line px-4 py-2.5">
              <button
                onClick={close}
                className="border border-ember/60 bg-ember-glow px-4 py-1 font-mono text-[11.5px] text-ember transition-colors hover:bg-ember/25"
              >
                cool
              </button>
            </div>
          </>
        )}

        {modal.kind === 'factory-reset' && (
          <>
            <div className="border-b border-line px-4 py-2.5 font-mono text-[12px] text-rust">
              factory reset
            </div>
            <div className="px-4 py-4 font-mono text-[12px] leading-relaxed text-inkdim">
              This wipes <span className="text-ember">everything</span> — your edits,
              settings, untitled drafts, visitor commits, terminal history, and all
              {` `}achievements. The site reloads as if you'd never been here.
              <div className="mt-1.5 text-[10.5px] text-inkfaint">
                (the portfolio itself is immutable; only your fingerprints get erased.)
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-line px-4 py-2.5">
              <button
                onClick={close}
                className="border border-line px-3 py-1 font-mono text-[11.5px] text-inkdim transition-colors hover:bg-raised"
              >
                keep my mess
              </button>
              <button
                onClick={() => {
                  wipePersisted()
                  window.location.reload()
                }}
                className="border border-rust/60 bg-rust/10 px-3 py-1 font-mono text-[11.5px] text-rust transition-colors hover:bg-rust/25"
              >
                wipe it clean
              </button>
            </div>
          </>
        )}

        {modal.kind === 'first-visit' && (
          <div className="w-[min(480px,92vw)]">
            <div className="border-b border-line px-4 py-3">
              <div className="font-mono text-[13px] text-ink">hi. quick question.</div>
              <div className="mt-0.5 font-mono text-[10.5px] leading-relaxed text-inkfaint">
                this site is dressed as a code editor. everything is clickable, nothing breaks.
              </div>
            </div>
            <div className="grid gap-2 px-4 py-4 sm:grid-cols-3">
              <button
                onClick={() => {
                  s().markSeenIntro()
                  s().buildForProduction()
                }}
                className="group border border-ember/40 bg-abyss px-3 py-3.5 text-left transition-colors hover:border-ember hover:bg-raised"
              >
                <Rocket size={15} className="mb-2 text-ember" />
                <div className="font-mono text-[12px] text-ink">i'm hiring</div>
                <div className="mt-1 font-mono text-[9.5px] leading-relaxed text-inkfaint">
                  skip the editor — get the readable page
                </div>
              </button>
              <button
                onClick={() => {
                  s().applySettings({ 'kushal.jargon': 'tourist' })
                  s().markSeenIntro()
                  s().startGuide()
                }}
                className="group border border-tide/40 bg-abyss px-3 py-3.5 text-left transition-colors hover:border-tide hover:bg-raised"
              >
                <Compass size={15} className="mb-2 text-tide" />
                <div className="font-mono text-[12px] text-ink">show me around</div>
                <div className="mt-1 font-mono text-[9.5px] leading-relaxed text-inkfaint">
                  a click-through route, plain-English labels
                </div>
              </button>
              <button
                onClick={() => {
                  s().markSeenIntro()
                  s().toast('godspeed. ctrl+k if you get lost.', 'ok')
                }}
                className="group border border-line bg-abyss px-3 py-3.5 text-left transition-colors hover:bg-raised"
              >
                <X size={15} className="mb-2 text-inkfaint" />
                <div className="font-mono text-[12px] text-ink">i know what i'm doing</div>
                <div className="mt-1 font-mono text-[9.5px] leading-relaxed text-inkfaint">
                  dismiss. shortcuts: ctrl+k does everything.
                </div>
              </button>
            </div>
            <div className="border-t border-line px-4 py-2 font-mono text-[9px] text-inkfaint">
              this only asks once. the `?` in the bottom bar reopens the map.
            </div>
          </div>
        )}

        {modal.kind === 'map' && (
          <div className="w-[min(520px,94vw)]">
            <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
              <span className="font-mono text-[12px] text-ink">what am i looking at?</span>
              <button onClick={close} className="text-inkfaint hover:text-ink" aria-label="close">
                <X size={14} />
              </button>
            </div>
            {/* a diagram of the IDE itself — css boxes, not a screenshot */}
            <div className="px-4 py-4">
              <div className="border border-line bg-abyss font-mono text-[9px]">
                <div className="border-b border-line px-2 py-1.5 text-center text-inkfaint">menus — file, run, help</div>
                <div className="flex">
                  <div className="w-10 border-r border-line px-1 py-2 text-center leading-relaxed text-inkfaint">
                    se<br />ct<br />io<br />ns
                  </div>
                  <div className="w-24 border-r border-line px-1.5 py-2 text-inkfaint">file list + panels</div>
                  <div className="flex-1 px-1.5 py-2">
                    <div className="mb-1.5 border-b border-dashed border-line pb-1 text-ember">tabs — your open pages</div>
                    <div className="text-inkdim">the thing you're reading</div>
                  </div>
                </div>
                <div className="border-t border-line px-2 py-1.5 text-center text-inkfaint">
                  status bar — branch, errors, theme … and the big <span className="text-ember">build</span> button
                </div>
              </div>
              <div className="mt-3 font-mono text-[11px] leading-relaxed text-inkdim">
                <span className="text-tide">left rail:</span> sections — files, find, the career, skills, trophies.{' '}
                <span className="text-tide">tabs:</span> like browser tabs.{' '}
                <span className="text-tide">bottom panel:</span> a real terminal — type <code className="text-ember">help</code>.{' '}
                <span className="text-tide">bottom bar:</span> status + the build button.
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-line px-4 py-2.5">
              <button
                onClick={() => {
                  close()
                  s().applySettings({ 'kushal.jargon': 'tourist' })
                  s().startGuide()
                }}
                className="border border-tide/50 px-3 py-1 font-mono text-[11.5px] text-tide transition-colors hover:bg-tide/10"
              >
                take the guided route
              </button>
              <button
                onClick={() => {
                  close()
                  void startTour(exec)
                }}
                className="border border-line px-3 py-1 font-mono text-[11.5px] text-inkdim transition-colors hover:bg-raised"
              >
                or the self-driving tour (F6)
              </button>
            </div>
          </div>
        )}

        {modal.kind === 'shortcuts' && (
          <>
            <div className="border-b border-line px-4 py-2.5 font-mono text-[12px] text-ink">
              keyboard shortcuts
            </div>
            <div className="grid max-h-[50vh] grid-cols-[auto_1fr] gap-x-5 gap-y-1.5 overflow-y-auto px-4 py-3 font-mono text-[11.5px]">
              {[
                ['Ctrl+K / Ctrl+P', 'command palette'],
                ['Ctrl+Shift+P', 'palette, command mode (>)'],
                ['Ctrl+G', 'palette, go-to-line (:)'],
                ['Ctrl+`', 'toggle terminal'],
                ['Ctrl+Tab', 'cycle open tabs'],
                ['Ctrl+B', 'toggle sidebar'],
                ['Ctrl+,', 'settings (writes the real file)'],
                ['Ctrl+\\', 'split editor'],
                ['Ctrl+N', 'new untitled buffer'],
                ['Ctrl+S', 'save (theatrical)'],
                ['Ctrl+Shift+F', 'search'],
                ['Ctrl+Shift+G', 'source control'],
                ['Ctrl+Shift+X', 'extensions'],
                ['Ctrl+Shift+A', 'achievements'],
                ['Ctrl+Shift+T', 'reopen closed tab'],
                ['F2', 'rename symbol (raw view)'],
                ['F12 / Shift+F12', 'goto def / find refs (raw view)'],
                ['Ctrl+Click', 'go to definition (anywhere)'],
                ['F5', 'Deploy Site'],
                ['F6', 'take the tour'],
                ['↑↑↓↓←→←→BA', 'demo god mode'],
                ['Esc', 'close everything'],
              ].map(([k, d]) => (
                <div key={k} className="contents">
                  <span className="justify-self-end border border-line bg-abyss px-1.5 py-0.5 text-[10px] text-ember">{k}</span>
                  <span className="py-0.5 text-inkdim">{d}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-end border-t border-line px-4 py-2.5">
              <button onClick={close} className="border border-line px-4 py-1 font-mono text-[11.5px] text-inkdim hover:bg-raised">
                close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
