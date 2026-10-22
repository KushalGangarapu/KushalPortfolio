---
title: reverse-captcha
stack: javascript · bad intentions · good execution
year: 2025
status: shipped, regrettably effective
---

# reverse-captcha

A CAPTCHA with the threat model inverted: it's designed to **only let
bots through**. Humans fail. Scripts pass. The spec is the joke and the
joke is fully implemented.

## why it's here

Because it's the best litmus test on the site. Everyone gets the joke
in half a second; the people worth working with immediately start
asking *how* — what heuristics distinguish human sloppiness from bot
precision, what "passing" even means when the pass condition is wrong.

The honest answer: the interesting engineering in verification isn't
the puzzle, it's the decision boundary. Reverse the polarity and you
have to think about it from the bot's side — timing entropy, perfect
clicks, inhuman consistency as the tell rather than the goal.

## the receipt

```console
$ reverse-captcha --verify you
✗ failed: response contained hesitation, typos, and feelings.
  verdict: human. access denied. (sorry.)
$ reverse-captcha --verify curl/8.x
✓ inhuman precision detected. welcome, bot.
```

Not a product. A conversation piece with a CI badge.
