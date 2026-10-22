---
title: faithful-flight
stack: python · pygame · cryptography · discord rpc
year: 2023
status: shipped — and sold
link: github.com/KushalGangarapu/FaithfulFlight
---

# faithful-flight

A fast-paced, side-bouncing arcade game in Python + Pygame — and the
first software I ever sold. Grade 8 math-class project; it got popular
enough with classmates that we sold copies and **raised over $100**.
First revenue, age 13. The math class recovered.

## under the hood

- **side-bouncing physics** — bounce off the walls for points while
  procedural spikes scale with your score; screen-shake on defeat
- **5 powerups** — shield, coin magnet, slow-mo, 2x points, shrink-birb
- **encrypted saves** — high scores and coin totals secured with
  PBKDF2 + Fernet. yes, the grade 8 math project has threat modeling.
- **discord rich presence** — live score and status in your profile
- **texture pack studio** — a standalone GUI for managing visual
  themes: import packs (folders or `.zip`), rename, delete, one-click
  launch. a mod manager, for a school project, in tkinter.

## the receipt

```console
$ ./faithful-flight --sales
> $100+ in revenue. currency: actual money from actual classmates.
$ sqlite3 saves.db 'select * from highscores'
error: encrypted. (working as intended.)
```

Origin story and origin code both public — the repo reads like a time
capsule, which is half the point.
