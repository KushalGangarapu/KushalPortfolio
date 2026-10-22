# AGENTS

Portfolio site: a fictional code editor ("kushal") where every portfolio
section is IDE behavior — file tree sections, git-graph career, extensions-as-
skills, working terminal, command palette, and an F5 "build for production"
recruiter view.

## commands

```bash
npm run dev          # vite dev server :5173
npm run build        # tsc -b && vite build (must stay clean); prebuild regenerates public/hire/ + public/sitemap.xml from content/
npm run lint         # oxlint
```

## layout

- `content/` — the actual portfolio text (real files; edit these to re-skin).
  Imported via `?raw` in `src/vfs/files.ts`, which builds the virtual tree.
- `src/state/store.ts` — zustand; tabs, edits overlay, panels, terminal buffer.
- `src/vfs/` — virtual FS, path resolve, ripgrep-style search, git + extension data.
- `src/ide/` — chrome (titlebar w/ menus, activity bar, sidebar, tabs, panel, status bar).
- `src/editor/` — CodeMirror raw mode + custom markdown renderer (`md.tsx`),
  shared syntax palette (`lang.ts` — tok-* classes map CM and preview).
- `src/terminal/` — parser + command registry + easter eggs (`commands.ts`).
- `src/recruiter/` — the compiled readable view; parses content/*.toml/.env/.json
  with small dedicated parsers — keep formats compatible if you change them.
- `public/resume.pdf` — the real résumé (copied from the source PDF, not generated).
  Keep `src/editor/PdfView.tsx` (the in-IDE preview) in sync when it changes.
- `scripts/check-resume.mjs` — prebuild consistency check: fails the build if
  public/resume.pdf drifts from the source PDF or from experience.json facts.
- `scripts/gen-hire.mjs` / `gen-sitemap.mjs` — build-time generators (prebuild hook).
  `public/hire/index.html` and `public/sitemap.xml` are GENERATED — never hand-edit.

## conventions

- Theme tokens live as runtime CSS vars in `src/index.css` (`--abyss` etc.),
  bridged to Tailwind via `@theme inline` — a second theme is just new var
  values under `[data-theme="..."]`.
- TS is strict: `verbatimModuleSyntax` (use `import type`), `noUnusedLocals`,
  `erasableSyntaxOnly` (no enums — union literals instead).
- No component library on purpose. Keep chrome bespoke and interactive.
