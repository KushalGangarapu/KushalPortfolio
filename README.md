# kushal — a portfolio that is a code editor

You don't visit this portfolio. You open it in an IDE.

The site boots into **kushal**, a bespoke fictional code editor where every
section of a normal portfolio is re-expressed as IDE behavior:

- **file tree** = the sections (`README.md`, `projects/*.md`, `experience.json`, `skills.toml`, `contact.env`)
- **git graph** = the career timeline (20+ commits, merges included, 0 regrets)
- **extensions** = skills (with changelogs and uninstall jokes)
- **terminal** = a real parser — `help`, `git log`, `neofetch`, `man kushal`, `vim` (good luck), `sudo hire-me`
- **command palette** (`Ctrl+K`) = fuzzy-open everything
- **status bar / tabs / breadcrumbs / minimap** = all functional, nothing decorative-fake
- **`F5` / "build for production"** = compiles the whole workspace into a clean recruiter-readable page

## run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + bundle → dist/ (prebuild regenerates /hire/ + sitemap.xml from content/)
```

## where the content lives

`content/` — real files, on purpose. To make this portfolio yours, edit these:

```
content/
├── README.md          about / landing
├── .kushalrc          dotfile of preferences & jokes
├── .gitignore         things that shall not be committed
├── projects/*.md      case studies (frontmatter: title/stack/year/status/repo)
├── experience.json    jobs, education, coursework
├── skills.toml        honest skill levels
├── contact.env        how to reach you (secrets redacted, obviously)
└── man1/kushal.1      the manual page
```

Career timeline commits live in `src/vfs/gitdata.ts`, skills-extensions in
`src/vfs/extensions.ts`.

## stack

vite + react 19 + typescript · tailwind v4 · zustand · codemirror 6 ·
custom terminal & markdown renderer · zero component libraries, because the
chrome is the point.
