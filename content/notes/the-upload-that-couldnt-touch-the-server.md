---
title: the upload that couldn't touch the server
kind: bug-story
year: 2026
---

# the upload that couldn't touch the server

A war story from `bcss-newspaper`. All facts true; only the panic has
been compressed.

## the constraint

The school paper publishes issues as PDFs. Real issues, with photos,
run up to **50 MB**. The site deploys to Vercel, whose serverless
functions have a request-body limit of about **4.5 MB**. So the naive
architecture — browser POSTs the file to `/api/upload`, API forwards it
to storage — fails by an order of magnitude. The PDF literally cannot
touch the server.

## the wrong turns

Chunked uploads through the API? Works, but now you're reassembling
50 MB inside a function with a memory limit and a timeout — a second,
softer wall behind the first. Compress the PDFs server-side? The
compression has to happen *after* the upload that can't happen.

## the fix

Don't send the file to the server at all. The API mints a signed
target and the **browser uploads straight to Supabase Storage** — the
bytes never enter Vercel. Then a small POST says "the upload landed at
path X," and only then does the interesting part happen: the API
fetches the *stored* object and re-validates it — magic bytes say
`%PDF-`, size is within bounds, path shape matches the expected prefix —
before any database row is allowed to point at it.

Client says "trust me, it's a PDF." Server checks the bytes, not the
claim. The database never names a file that wasn't proven to exist.

## what i took from it

- Platform limits aren't walls — they're routing problems. The file
  and the metadata wanted different roads the whole time
- "The upload succeeded" and "the bytes are what they claimed" are
  different assertions, and only one of them should let a row exist
- Validation belongs at the trust boundary you control — the stored
  object — not the request you can't afford to accept

Filed under: constraints that turned into better architecture.
