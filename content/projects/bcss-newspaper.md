---
title: bcss-newspaper
stack: next.js 16 · typescript · tailwind v4 · supabase · pdf.js · vercel
year: 2026
status: in production — the school paper lives here
link: github.com/KushalGangarapu/BCSS_NewsPaper
---

# bcss-newspaper

The official student newspaper of Burnaby Central — a fast,
mobile-friendly editorial site where issues publish as PDFs and read
right in the browser. No downloads, no "open in Acrobat."

## the fun part: the upload pipeline

PDF issues run up to **50 MB on a platform with a 4.5 MB request-body
limit**. The fix: uploads go browser → Supabase Storage directly, never
touching the Vercel function body. The API then re-validates the
*stored bytes* — magic bytes, size, path shape — before a database row
is allowed to exist. The file is the source of truth; the row is a
pointer.

- **in-browser PDF reader** — PDF.js at full device-pixel-ratio
  sharpness; page-turn buttons, arrow keys, page-jump, fit-width/zoom
- **auto-generated covers** — page 1 of the PDF is rasterized into the
  thumbnail on upload; the editor never designs a cover
- **issue archive** — every published issue, grouped by school year
- **one-editor admin** — `/admin` uploads, publishes, unpublishes,
  edits, deletes; signup is disabled on purpose

## hardened by default

- Postgres **Row Level Security** on every table and bucket policy
- generic login errors (no "wrong password" oracle), strict CSP headers
- drafts genuinely invisible to anonymous readers — not just hidden
  from the index, unreadable at the API

## the receipt

```console
$ ls /issues
2025-26/ 2026-27/ — every issue readable in-browser at full sharpness
$ grep -c 'download required' README.md
0
```

(The full 50 MB upload story is in
[notes/the-upload-that-couldnt-touch-the-server.md](../notes/the-upload-that-couldnt-touch-the-server.md).)
