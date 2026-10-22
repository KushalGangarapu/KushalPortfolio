---
title: wildcat-calendar
stack: react 19 · typescript · node · express · postgres · prisma · vercel
year: 2026 → present
status: in production — 1,500+ users
flagship: true
link: bcss-calendar.vercel.app
img: /renders/wildcat.png
---

# wildcat-calendar

The centralized hub for club discovery, event scheduling, and school
announcements at Burnaby Central — designed, built, and deployed by me,
and used daily by **1,500+ students and faculty**. This is the flagship:
not a tutorial project, a production PWA my school runs on.

## what it does

- **four-view interactive calendar** — month, week, day, agenda — with
  recurring events and in-calendar admin editing
- **markdown event descriptions**, printable PDF schedules, and native
  Google/Apple Calendar integration (real `.ics` feeds, not "add to
  calendar" buttons that 404)
- **real-time sync** — an admin edits on one screen and every open
  session updates via Server-Sent Events, no refresh

## the engineering

- **sub-100ms load times** — service-worker offline caching plus
  consolidated batch APIs; the PWA installs to home screens
- **hardened backend** — JWT sessions in HttpOnly cookies, bcrypt
  hashing, per-device rate limiting
- **Postgres + Prisma** — typed queries end to end; migrations in git,
  not in someone's head

## the receipt

```console
$ uptime --school
1,500+ students and faculty · every club on campus · daily driver since feb 2026
$ curl -w '%{time_total}' bcss-calendar.vercel.app
0.0s (ok, ~90ms — under the 100ms budget)
$ ps aux | grep leaflet
no processes found — the calendar is map-free and proud
```

## what i took from it

Shipping to people you see at lunch is the best forcing function there
is. A bug isn't a ticket — it's your friend telling you the pep rally
shows up on the wrong day. Feedback loops measured in hallways.
