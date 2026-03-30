# Backend

The current public GitHub Pages site is frontend-only.

That means:

- contact memory is local to the browser
- sessions can be exported by the player
- no shared global numbering yet
- no cross-player persistence yet

## What This Backend Adds

When deployed on a platform like Vercel with API routes enabled, the backend can:

- assign global sequential contact numbers like `#1`, `#2`, `#3`
- persist contacts across devices
- store session logs centrally
- become the first step toward shared world state

## Current API Routes

- `POST /api/contact`
Creates or resumes a contact using a pseudonymous contact token.

- `POST /api/session`
Stores a session record for a contact.

- `GET /api/health`
Reports whether the backend is live and whether KV is configured.

## Vercel KV

The current backend scaffold expects Vercel KV REST environment variables:

- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`

Without those, the frontend still works, but the backend routes return `kv_not_configured`.

## Deployment Shape

- GitHub Pages = frontend-only testing
- Vercel = frontend + API + persistent numbering

## Why This Split Is Fine

It lets you:

- play and iterate immediately on the live Pages site
- move to the real persistent world model when ready

That keeps the project lightweight without blocking progress.
