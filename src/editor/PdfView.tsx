import { useEffect, useState } from 'react'
import { Download, FileText } from 'lucide-react'
import { availabilityLabel } from '../lib/availability'
import { useIDE } from '../state/store'
import type { VFile } from '../vfs/types'

/** real byte size of the served pdf — the hardcoded label was a drift trap */
function usePdfSize(url: string) {
  const [size, setSize] = useState('~1 MB')
  useEffect(() => {
    fetch(url, { method: 'HEAD' })
      .then((r) => {
        const n = Number(r.headers.get('content-length'))
        if (n > 0) setSize(n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`)
      })
      .catch(() => {})
  }, [url])
  return size
}

export function PdfView({ file }: { file: VFile }) {
  const mobile = useIDE((s) => s.mobile)
  const resumeSize = usePdfSize('/resume.pdf')
  // resume.pdf gets the hand-rendered preview below; any other pdf (certificates)
  // embeds the real binary — the file is already public/, so just show it
  if (file.url && file.path !== 'resume.pdf') {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-2 border-b border-line px-3 py-2 font-mono text-[11px] text-inkdim">
          <FileText size={13} className="text-rust" />
          <span>{file.name}</span>
          <a
            href={file.url}
            target="_blank"
            rel="noreferrer"
            className="ml-auto flex items-center gap-1.5 border border-ember/60 bg-ember-glow px-2.5 py-1 font-mono text-[11px] text-ember transition-colors hover:bg-ember/20"
          >
            <Download size={12} /> {mobile ? 'open' : 'download'}
          </a>
        </div>
        {/* mobile browsers render <embed> as a blank rect — give them a real
            link instead; desktop gets the inline preview */}
        {mobile ? (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
            <FileText size={28} className="text-inkfaint" />
            <a href={file.url} target="_blank" rel="noreferrer" className="text-tide underline">
              open {file.name} ↗
            </a>
            <span className="font-mono text-[11px] text-inkfaint">
              mobile browsers can't embed pdfs — it opens in a new tab
            </span>
          </div>
        ) : (
          <embed src={file.url} type="application/pdf" className="min-h-0 flex-1" aria-label={file.name} />
        )}
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 overflow-auto p-8">
      <div className="flex w-full max-w-[560px] flex-col border border-line bg-chrome shadow-[0_12px_40px_rgba(0,0,0,0.45)]">
        {/* pdf toolbar */}
        <div className="flex items-center gap-2 border-b border-line px-3 py-2 font-mono text-[11px] text-inkdim">
          <FileText size={13} className="text-rust" />
          <span>{file.name}</span>
          <span className="ml-auto text-inkfaint">1 / 1 · 118%</span>
        </div>
        {/* the "page" */}
        <div className="bg-[#f4efe6] px-8 py-8 font-serif text-[#1a1712]">
          <div className="mb-4 flex items-baseline justify-between border-b-2 border-[#1a1712] pb-3">
            <h1 className="text-2xl font-bold tracking-tight">Kushal Gangarapu</h1>
            <div className="font-mono text-[10px]">smileykushal@gmail.com · github.com/KushalGangarapu</div>
          </div>
          <p className="mb-5 text-[13px] leading-relaxed">
            Grade 12 at Burnaby Central — built the calendar platform 1,500+ students and
            faculty use daily; runs a 60-person student government. Seeking: {availabilityLabel()}.
          </p>
          <Section title="Experience">
            <Item head="Co-Prime Minister — Student Government" sub="may 2026 →"
              body="advocate for 1,500+ students; direct a 60+ member exec team; own events end-to-end." />
            <Item head="General Executive — BC Youth Developer Collective" sub="apr 2025 →"
              body="organized Daydream Vancouver — largest youth hackathon in western Canada; $5,200+ raised; 130+ hackers." />
            <Item head="Student Monitor — SD41 Summer School" sub="jul 2026"
              body="built the excel tracking system for registrations, withdrawals, transfers — admin reporting ran on it." />
          </Section>
          <Section title="Selected Projects">
            <Item head="wildcat-calendar — React 19 · Express · Postgres" body="the school's hub for clubs/events; 1,500+ users; SSE sync; sub-100ms PWA." />
            <Item head="bcss-newspaper — Next.js 16 · Supabase" body="the school paper in-browser; PDF.js reader; RLS everywhere; 50MB uploads around the platform limit." />
            <Item head="faithful-flight — Python/Pygame" body="grade-8 math project sold to classmates ($100+); encrypted saves; texture-pack studio." />
            <Item head="reverse-captcha — JS" body="a captcha that only lets bots through. fully implemented." />
          </Section>
          <Section title="Skills">
            <p className="font-mono text-[10.5px] leading-relaxed">
              typescript · react · node · postgres · prisma · python · java · next.js · supabase · godot · git
            </p>
          </Section>
          <div className="mt-6 font-mono text-[9px] text-[#6a6154]">
            generated from a real IDE. rendered preview — download for the actual binary.
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-line px-3 py-2">
          <span className="font-mono text-[10px] text-inkfaint">portfolio/resume.pdf · {resumeSize}</span>
          <a
            href="/resume.pdf"
            download="Kushal_Gangarapu_Resume.pdf"
            className="flex items-center gap-1.5 border border-ember/60 bg-ember-glow px-2.5 py-1 font-mono text-[11px] text-ember transition-colors hover:bg-ember/20"
          >
            <Download size={12} /> download
          </a>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <h2 className="mb-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[#8a5a20]">
        {title}
      </h2>
      {children}
    </div>
  )
}

function Item({ head, sub, body }: { head: string; sub?: string; body: string }) {
  return (
    <div className="mb-2">
      <div className="flex items-baseline justify-between">
        <span className="text-[12.5px] font-semibold">{head}</span>
        {sub && <span className="font-mono text-[9px] text-[#6a6154]">{sub}</span>}
      </div>
      <p className="text-[12px] leading-snug text-[#38322a]">{body}</p>
    </div>
  )
}
