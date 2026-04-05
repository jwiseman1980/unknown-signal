# Deploy

## Local Development

Run a local server with hot reload via the Vercel CLI (handles API routes too):

```bash
npm i -g vercel
vercel dev
```

Or for frontend-only (no API routes):

```powershell
powershell -ExecutionPolicy Bypass -File .\start-local.ps1
# then open http://127.0.0.1:4173
```

For local API routes, copy `.env.example` to `.env.local` and fill in your keys.

---

## Vercel Deployment (full stack)

This is the primary deployment target. Vercel handles static files + serverless API routes from the `/api` folder automatically.

### 1. Import the repo

Vercel dashboard → Add New Project → Import `jwiseman1980/unknown-signal`.

- **Framework preset**: Other
- **Build command**: *(leave empty)*
- **Output directory**: `.` (root)
- **Install command**: *(leave empty)*

### 2. Set environment variables

Vercel dashboard → Project → Settings → Environment Variables.

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | Powers the Claude Sonnet narrative engine. Get at console.anthropic.com |
| `OPENAI_API_KEY` | No | Powers The Echo's voice (TTS-1). Falls back to browser speech if unset. |
| `KV_REST_API_URL` | No* | Auto-set by Vercel when you attach a KV store (see step 3) |
| `KV_REST_API_TOKEN` | No* | Auto-set by Vercel when you attach a KV store (see step 3) |

*Without KV, the game runs fine but contact numbering, session history, and cross-session character memory are disabled.

### 3. Attach a KV store (for persistence)

Vercel dashboard → Project → Storage → Connect Store → Create New → KV.

Once linked, Vercel automatically injects `KV_REST_API_URL` and `KV_REST_API_TOKEN` into your deployment. Redeploy after linking.

Verify KV is live by hitting `/api/health` on your deployment — it returns `{ "kvConfigured": true }` when working.

### 4. Deploy

Push to `main` or trigger manually from the Vercel dashboard. Every push to `main` deploys automatically once the project is imported.

---

## GitHub Pages (frontend only)

The `.github/workflows/deploy-pages.yml` workflow deploys the static frontend to GitHub Pages on every push to `main`.

**Live at:** `https://jwiseman1980.github.io/unknown-signal/`

This deployment has **no API routes** — the Claude narrative engine, voice TTS, and character history are all disabled. The game falls back to its local hardcoded handlers. Useful for frontend testing and sharing the first-contact experience without backend costs.

---

## What each deployment target can do

| Feature | GitHub Pages | Vercel (no KV) | Vercel (with KV) |
|---|---|---|---|
| First contact + terminal UI | Yes | Yes | Yes |
| Hardcoded simulations | Yes | Yes | Yes |
| Claude AI narrative (Sonnet) | No | Yes* | Yes |
| Echo voice (OpenAI TTS) | No | Yes* | Yes |
| Contact numbering | No | No | Yes |
| Session history | No | No | Yes |
| Cross-session character memory | No | No | Yes |

*Requires env vars set in Vercel.

---

## Environment variable notes

- Never commit `.env.local` — it is gitignored.
- `.env.example` documents all variables with placeholder values — commit that instead.
- The `ANTHROPIC_API_KEY` is only ever read server-side in `api/world.js`. It is never exposed to the browser.
- Same for `OPENAI_API_KEY` in `api/voice.js`.
