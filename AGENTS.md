# AGENTS.md

Guidance for AI coding agents working in this repository.

**Project:** Social Genie — an AI social concierge. Users describe a vibe; Genie returns ranked venues, events, and member offers.
**Shape:** Next.js 16 / React 19 App Router front end + thin server-side proxy layer over a **Xano** no-code backend.
**Deeper docs:** `docs/CODEBASE_OVERVIEW.md` (architecture) and `docs/DATA_STREAMS.md` (data flows and privacy).

---

## Commands

```bash
npm install
npm run dev      # next dev (Turbopack) → http://localhost:3000
npm run build    # verify your changes compile
npm run lint     # eslint flat config
```

**There is no test suite.** No framework, no CI, no `npm test`. `npm run build` plus `npm run lint` is the full automated verification available — run both before claiming a change works. Anything beyond that needs manual verification in the browser, and you should say so plainly rather than implying it was tested.

---

## The one rule that matters most

**Almost all business logic lives in Xano, not here.** Venue ranking, AI reply generation, personalization, auth, Stripe orchestration, and push delivery are all backend concerns. This repo renders UI and proxies requests.

Before implementing anything that looks like business logic, check whether a Xano endpoint already does it. `genie_api_reference.md` lists 35 endpoints. If the feature needs backend work, say so — do not reimplement it client-side.

---

## Architecture in four lines

1. Browser calls **same-origin `/api/*`** only. It never calls Xano directly.
2. Route handlers in `app/api/**/route.ts` validate, coerce, and proxy.
3. All proxying goes through `app/lib/server/xanoProxy.ts` (`xanoFetch`, `xanoAuthFetch`, `xanoStripeFetch`).
4. Responses are normalized in `app/lib/genieMappers.ts` before the UI sees them.

Keep this shape. Do not add a `fetch` to a Xano URL from a client component.

---

## Route handler pattern

Every handler in `app/api/` follows this. Match it exactly.

```ts
import { NextRequest, NextResponse } from "next/server";
import { xanoFetch, XanoError } from "@/app/lib/server/xanoProxy";

/**
 * POST /api/genie/example
 * Proxies to genie/ep_example_dev
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    const deviceId = String(body.device_id ?? "").trim();
    if (!deviceId) {
      return NextResponse.json({ error: "device_id is required" }, { status: 400 });
    }

    const result = await xanoFetch("genie/ep_example_dev", {
      method: "POST",
      body: { device_id: deviceId },
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof XanoError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("POST /api/genie/example failed:", error);
    return NextResponse.json({ error: "Could not do the thing." }, { status: 500 });
  }
}
```

Non-negotiable parts: the doc comment naming the HTTP contract and the Xano target; `.catch(() => ({}))` on body parsing; explicit coercion of every field; the `instanceof XanoError` branch preserving upstream status; a generic 500 fallback.

---

## Conventions

- **Coerce defensively.** `String(x ?? "").trim()`, `Number(x)` + `Number.isFinite(...)`, `Array.isArray(x)` before use. This is not paranoia — `genie_api_reference.md` §13.5 documents that Xano returns `{}` for empty arrays and mishandles optional booleans.
- **Telemetry never fails the user.** Analytics and interaction-logging routes swallow errors and return success. Preserve that. If you add a tracking call, use fire-and-forget (`fetch(...).catch(() => {})`), never `await` it in a user-facing path.
- **`snake_case` on the wire, `camelCase` in React.** `toConsumerAccount()` in `publicApiClient.ts` is the translation boundary.
- **Import alias** `@/*` maps to the repo root: `@/app/lib/server/xanoProxy`.
- **Guard every browser API.** `typeof window === "undefined"` before `localStorage`, `navigator`, `crypto`. Wrap `JSON.parse` in try/catch. SSR will run this code.
- **Types:** `RawGenieVenue` for Xano shapes, `GenieVenue` for normalized, both in `lib/genieTypes.ts`. API payload types live inline in `publicApiClient.ts`.
- **TypeScript is `strict: true`.** No `any` escapes; use `Record<string, unknown>` and narrow.

---

## Where things live

| Task | File |
|---|---|
| Main query flow | `lib/genieClient.ts` → `api/genie/message/route.ts` → `lib/genieMappers.ts` |
| Add a backend call | New `app/api/…/route.ts` (via `xanoProxy`), then a client fn in `lib/publicApiClient.ts` |
| Pricing, city, plan copy, quick chips | `lib/runtimeConfig.ts` — **never hardcode these in components** |
| Consumer UI | `components/SinglePageGenieApp.tsx` (5,446 lines) |
| Vendor UI | `components/single-page/VendorSection.tsx` |
| Account / auth UI | `components/single-page/AccountSection.tsx` |
| Analytics event | Add to `lib/analyticsEvents.ts`, then a helper in `lib/analytics.ts` |
| Session / identity | `lib/sessionToken.ts` + `lib/localState.ts` |
| Xano contract | `genie_api_reference.md` — verify against code before trusting |

---

## Identity model — read before touching anything auth-adjacent

Three identifiers coexist, and this is the most common source of confusion:

- **`device_id`** — client-generated UUID in `localStorage`, exists pre-account, keys the social/personalization profile.
- **`external_user_id`** — Xano-issued, spans guest → account. Guest sessions get one too.
- **`user_id` / `session_id`** — numeric legacy identifiers that several live Xano endpoints still require.

Some routes forward **all** shapes deliberately, because the live backend enforces the legacy ones even though newer docs describe the modern ones. See the in-file comments in `app/api/user/save-venue/route.ts` and `saved-venues/route.ts`. **Do not "clean this up"** without confirming against the live backend — you will break saves.

---

## Do not touch without asking

| Path | Why |
|---|---|
| `app/lib/server/apiStore.ts`, `authToken.ts` | Legacy local JSON-file backend holding password hashes. Superseded by Xano magic-link auth, but `requestAuth.ts` still reads it from `api/genie/message`. Likely dead — confirm before deleting. |
| `app/api/subscription/webhook/route.ts` | Intentional 501 stub. Real Stripe webhooks are handled by Xano. Leave it. |
| `social-bevy-website/` | Separate untouched scaffold with its own lockfile. Not part of this build. |
| `public/OneSignalSDKWorker.js`, `OneSignalSDKUpdaterWorker.js` | Vendor-required contents. Do not edit. |
| `public/sw.js` | Service worker. Changes affect cached state on every existing user's device. |
| `genie_api_reference.md`, `latest_api_docs_today.md` | Backend contracts owned outside this repo. |
| `.env.local` | Never create, read, print, or commit. `.gitignore` covers `.env*`. |

---

## Known-stale documentation

Four markdown files describe this system and they disagree with each other and with the code.

- `genie_api_reference.md` (v8.0, 35 endpoints) — the fullest contract, but the message endpoint is listed as `ep_handle_message_dev` while the code calls `ep_genie_chat_v2_dev`.
- `latest_api_docs_today.md` — newer, partial.
- `production_readiness_report.md` — **partially stale.** It flags a missing `verify/[token]` page and absent offer routes; both now exist. Re-verify anything it claims before acting on it.
- `README.md` — says to set `NEXT_PUBLIC_XANO_API_BASE_URL`, which does not exist. The real var is `NEXT_PUBLIC_XANO_BASE_URL`.

**When docs and code disagree, the code wins.** Say which you relied on.

---

## Privacy-sensitive surfaces

This app handles precise geolocation, voice input, and preference tags that function as proxies for race and sexual orientation (`community_tags` includes `"Black-Owned"` and `"LGBTQ+ Friendly"`). `docs/DATA_STREAMS.md` has the full analysis.

Be deliberate near these:

- **Do not widen data collection** — new fields on `track_signal`, `analytics/track` metadata, or the social profile — without flagging it explicitly in your summary.
- **Do not log PII or coordinates.** There is already one offending `console.log` at `SinglePageGenieApp.tsx:972`; do not add more.
- **Do not add third-party scripts, SDKs, pixels, or analytics.** The app currently has zero third-party analytics, which is a deliberate and valuable property.
- **Do not put identifiers or tokens in URL query strings** for new endpoints; use the request body or the `Authorization` header.
- **Do not loosen `next.config.ts` image patterns.** They are already at `**` over http and https — narrowing is welcome, widening is not possible.
- **Treat `localStorage` keys as a schema.** Twelve keys are inventoried in `docs/DATA_STREAMS.md` §5. Adding one means adding a row there and handling it in `clearConsumerSession()`.

---

## Environment

No `.env.example` exists. Minimum `.env.local` for local dev:

```
XANO_BASE_URL=https://xwpg-kuah-brlj.n7d.xano.io
JWT_SECRET=<any-string; only the legacy auth path uses it>
NEXT_PUBLIC_APP_BASE_URL=http://localhost:3000
```

**Warning:** every Xano base URL has a hardcoded production fallback in source. The app runs with no env file at all — pointed at **production data**. Be aware of what you are writing to when testing mutations locally.

---

## Working style here

- **Read before writing.** Files are large and conventions are consistent; match the surrounding code rather than importing a different style.
- **Check if a module is actually imported** before editing it. `app/lib/genie/` shadows `app/lib/` with parallel, mostly-unused implementations, and several modules (`openaiClient.ts`, `genie/xano.ts`, `genie/useGenieLocation.ts`, `discovery/HomeScreen.tsx`) are dead.
- **Prefer small, surgical diffs.** `SinglePageGenieApp.tsx` is 5,446 lines; a large refactor there is a separate, explicitly-agreed task, not a side effect of a bug fix.
- **Report honestly.** With no test suite, "I verified this" means you ran `npm run build` and `npm run lint` and they passed. If you did not exercise the change in a browser, say that.
- **Flag backend-blocked work** rather than working around it. If a feature needs a Xano endpoint that does not exist, that is the finding — not a reason to build a client-side substitute.
