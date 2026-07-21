# Social Genie

Next.js 16 (App Router) + React 19 + TypeScript + Tailwind v4 frontend. The backend is Xano (see below) — this repo contains **no backend source code**.

## Backend: Xano — the source is on disk, read it

This repo contains only the frontend and the Next.js route handlers that proxy to Xano.

### Read the backend repo — do not wait on another agent

The full Xano workspace source lives at **`D:\social-genie-project\social-genie-backend`** —
~753 `.xs` files under `api/`, `table/`, `function/`, tracking branch `v1.5-dev`. **This is your
source of truth for the backend.** When you need an endpoint path, input parameters, behavior,
response shape, or auth requirement, **read the endpoint's `.xs` file first.** Do not ask another
agent, and do not block waiting on one.

Useful paths:

- `api/genie_dev/genie/<name>_<VERB>.xs` — one file per endpoint, e.g. `vendor_create_offer_POST.xs`
- `table/<table>.xs` — column definitions and comments, e.g. `genie_offers.xs`
- `database.xs` — table schemas only. It does **not** contain endpoint logic; prefer the
  per-endpoint `.xs` files for anything behavioral.

Refresh it with `xano workspace pull -d . -w 1 -b v1.5-dev -p idrees`.

Order of resolution when you need to know something about the backend:

1. **The endpoint's `.xs` file** in the backend repo.
2. **Existing calls** in `app/api/**/route.ts` and `app/lib/genieClient.ts` — endpoints already wired up.
3. **Ask the user** — only if the backend repo is missing or does not cover the endpoint.

**Never assume or invent anything about a Xano endpoint.** No guessed field names, no "it probably
returns," no speculative types. If steps 1 and 2 don't answer it, stop and ask — then implement.

Two traps worth knowing before you trust a read:

- **Live vs. branch skew.** The deployed v1 group is ~139 objects behind `v1.5-dev`. An endpoint
  present in the source may still 404 in the running app. Probe before assuming it ships.
- **Inverted preconditions.** XanoScript `precondition` aborts when its expression is *false*, so
  `precondition ($x == null)` throws exactly when `$x` exists. This bug is present in several
  endpoints (e.g. `vendor_onboarding_complete`), meaning a "Vendor not found" error can mean the
  vendor *was* found. Read the precondition's polarity before concluding a record is missing.

### Xano base URLs (env vars)

Set in `.env.local`. Never hardcode a Xano URL.

| Variable | Use |
| --- | --- |
| `XANO_BASE_URL` | Server-side default Xano group |
| `XANO_AUTH_BASE` | Auth endpoints |
| `XANO_STRIPE_BASE` | Stripe/subscription endpoints |
| `XANO_GENIE_DEV_BASE` | Genie endpoints |
| `XANO_GENIE_VENUES_URL` | Venue lookup |
| `NEXT_PUBLIC_XANO_BASE_URL` | Client-side Xano calls |

Secrets (`JWT_SECRET`, `OPENAI_API_KEY`, Xano bases without `NEXT_PUBLIC_`) must stay server-side — never reference them from a client component.

## Running the app

```bash
npm run dev      # Next.js dev server, http://localhost:3000
npm run build    # production build
npm run lint     # eslint
```

`npm run dev` runs **both** the frontend and the Next.js API route handlers (`app/api/**`) — there is no separate backend process to start. The route handlers are the backend surface of this repo; they proxy to Xano.

### Always monitor the dev server logs

When you run `npm run dev`, run it in the background and **actively read its output** while working. The route handlers log Xano request/response failures there, and it is the fastest way to see:

- Xano 4xx/5xx responses and their error bodies
- Missing or misnamed env vars
- Server-side exceptions in `app/api/**` that the browser only surfaces as a generic 500

Do not declare a change working based on a clean compile. Exercise the affected flow and confirm the logs are clean.

## Layout

```
app/
  api/**/route.ts   Next.js route handlers — thin proxies to Xano
  lib/              clients, mappers, types, shared state
    genieClient.ts  Genie API client
    genieTypes.ts   shared Genie types
    genieMappers.ts response normalization
    runtimeConfig.ts city config, quick chips
  components/       React components
  <route dirs>/     admin, vendor, venue, messages, events, saved, ...
public/             static assets
social-bevy-website/ separate marketing site (own package.json)
```

## Conventions

- TypeScript everywhere; type Xano responses in `app/lib/genieTypes.ts`, normalize them in `genieMappers.ts` rather than consuming raw shapes in components.
- Tailwind v4 utility classes for styling; no CSS modules.
- Client components need `"use client"`; keep data fetching in route handlers or server components where possible.
- Match the surrounding file's naming and import style.

## End-of-session handoff

When the session is wrapping up — the user says they're done, signs off, or asks for a summary of the work — **ask the user whether they want a handoff doc.** Do not write one unprompted.

If they say yes, create `docs/handoff/HANDOFF_<YYYY-MM-DD>.md` covering the features built that session:

- What was built, per feature, and where the code lives (`file:line`)
- Which Xano endpoints it depends on
- What was verified vs. what is untested
- Known gaps, TODOs, and anything left mid-flight
- Decisions made and why, especially ones a future session couldn't re-derive from the code

Handoff docs are gitignored — they are working notes, not repo content. Never commit them.

## Reference docs in this repo

- `genie_api_reference.md`, `latest_api_docs_today.md` — Genie/Xano API notes. Check these before asking the user, but treat the code as authoritative if they disagree.
- `FEATURE_STATUS.md`, `CLIENT_SPEC_GAP_ANALYSIS.md` — feature/spec tracking
