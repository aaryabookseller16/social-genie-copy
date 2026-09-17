# Codebase Overview — Social Genie

**Repo:** `social-genie` · **Product:** Social Genie by Social Bevy
**What it is:** an AI-powered social concierge. A user types or speaks a vibe ("rooftop happy hour," "R&B brunch") and Genie returns ranked venues, events, and member offers for their city.
**Launch city:** Houston. **Live at:** `https://genie.socialbevy.com`.

---

## 1. The one-paragraph version

This is a **Next.js 16 / React 19 App Router front end with a thin server-side proxy layer over a Xano no-code backend.** Essentially all business logic — venue ranking, AI reply generation, personalization, auth, Stripe orchestration, push delivery — lives in Xano. The code in this repo renders the UI, manages browser-side session and location state, and normalizes the shapes Xano returns. The consumer app is delivered as a **single 5,400-line client component** (`SinglePageGenieApp.tsx`) that owns its own screen router; the rest of `app/` is supporting pages and API proxies.

---

## 2. Stack

| Layer | Choice |
|---|---|
| Framework | Next.js `^16.0.8`, App Router, Turbopack |
| UI | React `^19.2.1`, Tailwind CSS v4 (via `@tailwindcss/postcss`) |
| Language | TypeScript `^5`, `strict: true` |
| Theming | `next-themes`, dark default, class strategy |
| Push | `react-onesignal` `^3.5.1` |
| AI SDK | `openai` `^6.9.1` — **installed and wired but never invoked** |
| Backend | Xano (4 API groups on one host) |
| Payments | Stripe, via Xano-hosted Checkout |
| Email | SendGrid, via Xano |
| Hosting | Vercel |
| Fonts | Geist, Geist Mono, Cormorant Garamond via `next/font/google` (self-hosted at build) |

**No test framework, no CI config, no Dockerfile, no `.env.example`.** Scripts are `dev`, `build`, `start`, `lint` only.

---

## 3. Directory map

```
social-genie/
├── app/
│   ├── layout.tsx                 Root layout, metadata, OG/Twitter cards, viewport
│   ├── providers.tsx              ThemeProvider + PwaBoot + NotificationsBoot
│   ├── page.tsx                   3 lines — renders <SinglePageGenieApp />
│   ├── globals.css
│   │
│   ├── components/
│   │   ├── SinglePageGenieApp.tsx      ★ 5,446 lines — the entire consumer app
│   │   ├── single-page/
│   │   │   ├── VendorSection.tsx       2,034 lines — vendor onboarding + dashboard
│   │   │   ├── AccountSection.tsx        749 — signup, login, membership, profile
│   │   │   ├── ui.tsx                    609 — shared primitives
│   │   │   ├── ProfileSection.tsx        483 — social preferences intake
│   │   │   └── DrawerMenu.tsx            256 — nav drawer
│   │   ├── discovery/HomeScreen.tsx      194 — (legacy//alternate home)
│   │   ├── shared/                       GenieOrb, QuickChips, BottomNav,
│   │   │                                 ThemeToggle, PwaBoot, NotificationsBoot
│   │   ├── admin/CityIntelligenceDashboard.jsx   (only .jsx file in the repo)
│   │   ├── account/.gitkeep              empty — planned split
│   │   └── vendor/.gitkeep               empty — planned split
│   │
│   ├── lib/
│   │   ├── publicApiClient.ts     ★ 1,324 lines — every browser→/api call
│   │   ├── genieClient.ts            127 — callGenie(), the main query path
│   │   ├── genieTypes.ts             177 — venue/response type contracts
│   │   ├── genieMappers.ts           171 — Xano response → normalized envelope
│   │   ├── localState.ts             122 — account, auth token, saved venues
│   │   ├── sessionToken.ts            93 — session/device/external-user IDs
│   │   ├── analytics.ts              103 — trackEvent helpers
│   │   ├── analyticsEvents.ts         87 — ~80 named event constants
│   │   ├── runtimeConfig.ts           88 — city, chips, pricing, plan copy
│   │   ├── maps.ts                    79 — Google Maps URL builders
│   │   ├── cityExtractor.ts           73 — detect explicit city in a message
│   │   ├── signupPrompt.ts            51 — signup-nudge suppression
│   │   ├── vendorOnboarding.ts        41 — vendor draft persistence
│   │   ├── image.ts                   42 — image fallback chain
│   │   ├── openaiClient.ts            21 — lazy OpenAI client (unused)
│   │   ├── genie/                     xano.ts, useGenieLocation.ts, types.ts
│   │   │                              (parallel/legacy helpers, largely unused)
│   │   └── server/
│   │       ├── xanoProxy.ts          123 ★ all backend calls funnel through here
│   │       ├── apiStore.ts           182 — legacy JSON-file DB (see §9)
│   │       ├── xanoCatalog.ts         92 — genie_v1 catalog fetch + scoring
│   │       ├── authToken.ts           79 — legacy HMAC JWT + scrypt
│   │       └── requestAuth.ts         70 — legacy bearer-token resolution
│   │
│   ├── api/                       45 route handlers — see §6
│   │
│   ├── venue/[id]/page.tsx        Venue detail
│   ├── events/[slug]/             Event detail (server fetch + client component)
│   ├── i/[handle]/page.tsx        Influencer landing page (SSR, 420 lines)
│   ├── saved/page.tsx             Saved spots
│   ├── verify/[token]/page.tsx    Public redemption verification (staff-facing)
│   ├── verified/page.tsx          Post-verification confirmation
│   ├── vibee/success/page.tsx     Post-checkout (consumer)
│   ├── vendor/success/page.tsx    Post-checkout (vendor)
│   ├── worldcup/                  World Cup 2026 Houston campaign landing
│   ├── join/page.tsx              Redirect shim → /?screen=account&signup=vibee
│   └── admin/city-intelligence/   Admin dashboard (3-line page wrapper)
│
├── public/                        Icons, venue placeholders, sw.js,
│                                  OneSignalSDKWorker.js, site.webmanifest
├── social-bevy-website/           Separate untouched create-next-app scaffold
├── genie_api_reference.md         1,487 lines — full Xano contract, 35 endpoints
├── latest_api_docs_today.md         771 lines — newer partial contract
├── production_readiness_report.md   395 lines — audit (partially stale)
├── production_readiness_report_v1.md
└── next.config.ts, tailwind.config.ts, tsconfig.json, eslint.config.mjs
```

---

## 4. Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Browser                                                 │
│  ┌───────────────────────────────────────────────────┐  │
│  │  SinglePageGenieApp.tsx  (client component)        │  │
│  │  • own screen router: home│listening│results│…     │  │
│  │  • geolocation, Web Speech, all UI state           │  │
│  └───────────────────────────────────────────────────┘  │
│           │ publicApiClient.ts · genieClient.ts          │
│           │ localStorage: token, account, device, session│
└───────────┼─────────────────────────────────────────────┘
            │ fetch("/api/…")   ← same-origin only
┌───────────▼─────────────────────────────────────────────┐
│  Next.js route handlers  (app/api/**/route.ts)           │
│  validate → rename fields → xanoProxy → normalize shape  │
└───────────┬─────────────────────────────────────────────┘
            │ server-side fetch, secrets never leave here
┌───────────▼─────────────────────────────────────────────┐
│  Xano   xwpg-kuah-brlj.n7d.xano.io                       │
│   api:pgMKWi2e  Genie  — venues, vendor, social, offers  │
│   api:dRDS80y8  Auth   — magic-link signup/login/me      │
│   api:jQf3GatY  Stripe — native session objects          │
│   api:mY7zYhwk  genie_v1 — raw venue catalog             │
└──────┬──────────────┬──────────────┬────────────────────┘
       │              │              │
   Stripe         SendGrid       OneSignal
```

**The load-bearing rule:** the browser never calls Xano directly. Every backend call goes through a Next.js route handler, which calls `xanoFetch` / `xanoAuthFetch` / `xanoStripeFetch` in `app/lib/server/xanoProxy.ts`. This keeps base URLs and any forwarded tokens server-side.

*(One exception exists: `app/lib/genie/xano.ts` reads the client-exposed `NEXT_PUBLIC_XANO_BASE_URL`. It is marked `server-only` and appears unused by any current route.)*

---

## 5. The core request flow

Tracing "user types *brunch near me*" end to end:

1. **Input** — `SinglePageGenieApp.tsx` captures the text (typed, or a Web Speech transcript the user confirmed).
2. **City extraction** — `cityExtractor.ts` scans for an explicit city among ~30 known aliases. A named city **always beats** device coordinates.
3. **Location resolution** — `SinglePageGenieApp.tsx:939-970`. If no explicit city, request `getCurrentPosition` with `enableHighAccuracy: true`, a 5s timeout, and a hard 5.5s cap so a hung permission prompt can never stall the query. Resolves to `null` on denial rather than blocking.
4. **`callGenie()`** — `genieClient.ts:29`. Assembles `{ message, channel, external_user_id, user_name, session_token, city_context, lat, lng, radius_meters: 2500, user, user_data, meta }` and `POST`s to `/api/genie/message` with the bearer token if present.
5. **Route handler** — `app/api/genie/message/route.ts`. Optionally enriches identity from the (legacy) auth path, coerces every field to its expected type, and proxies to Xano `genie/ep_genie_chat_v2_dev`.
6. **Response normalization** — the v2 endpoint returns a single merged `venues` array; the route splits it into `venues` (first 3) and `more_nearby_venues` (next 12), derives `query_mode`, `response_mode`, and `use_xano`, and maps each venue's image through the fallback chain `image_primary_url → image_fallback_url → image → image_url`.
7. **Client mapping** — `genieMappers.ts:normalizeHandleMessageResponse` produces the `GenieResponseEnvelope` the UI consumes, and coerces latitude/longitude from strings to numbers.
8. **Persistence** — `writeSessionToken()` / `writeSessionId()` store the returned session identity for continuity.
9. **Telemetry** — fire-and-forget calls to `/api/analytics/track` and the interaction-logging routes. None of these can fail the user's query.

**Failure mode:** if the route returns non-OK, `callGenie` does not throw. It returns a fully-formed fallback envelope with `response_mode: "ai_fallback"` and a friendly message, so the UI always has a valid object to render (`genieClient.ts:88-118`).

---

## 6. API surface (45 route handlers)

All under `app/api/`. Every one is a proxy to Xano except the webhook stub.

### Genie core — `app/api/genie/`
| Route | Method | Xano target |
|---|---|---|
| `message` | POST | `genie/ep_genie_chat_v2_dev` — **the main query endpoint** |
| `session` | POST | `genie/guest_session` · `genie/convert_guest_session` (`action: "convert"`) |
| `venue` | GET | `genie/ep_get_venue_dev`, falling back to a catalog scan |
| `init-device` | POST | `genie/init_device` |
| `social-profile` | GET/POST | `genie/get_social_profile` · `genie/update_social_profile` |
| `track-signal` | POST | `genie/track_signal` |
| `merge-guest-profile` | POST | `genie/merge_guest_profile` |
| `interaction` | POST | `genie/vendor_log_interaction` |
| `log-venue-interaction` | POST | `genie/ep_log_venue_interaction_dev` |
| `log-event-interaction` | POST | `genie/ep_log_event_interaction_dev` |
| `prompt` | GET/POST | `prompt_should_show` · `prompt_log_event` · `prompt_dismiss` |
| `offers` | GET | `genie/vibee_offers` |
| `redeem-offer` | POST | `genie/redeem_offer` |
| `redemptions` | GET | `genie/user_redemptions` |
| `verify-redemption/[token]` | GET | `genie/verify_redemption` (public) |
| `register-push-token` | POST | `genie/register_push_token` |
| `send-notification` | POST | `genie/send_notification` |
| `notification-opened` | POST | `genie/notification_opened` |

### Auth — `app/api/auth/`
`signup` → `auth/verify_email/signup` · `login` → `auth/verify_email/magic_login` · `me` → `auth/me` · `update-profile` → `auth/update_profile` · `delete-account` → `genie/ep_delete_account_dev`

### User — `app/api/user/`
`save-venue` / `unsave-venue` (both hit `genie/save_venue`, which is a **toggle**) · `saved-venues` → `genie/saved_venues`

### Vendor — `app/api/vendor/`
`claim`, `create` → `genie/vendor_onboarding_start` (step-based) · `search` → `genie/vendor_search` · `profile`, `venue`, `contact-info` → the `ep_*_dev` family · `dashboard` → `vendor_dashboard_v1` · `analytics` → `vendor_analytics_summary` · `profile-completeness` · `offer` → `vendor_create_offer`

### Commerce
`subscription/create` → `genie/checkout_vibee` or `genie/checkout_vendor_plan` · `subscription/status` → `auth/me` · `subscription/webhook` → **501 stub by design** · `stripe/sessions` + `[id]` + `[id]/line_items` → raw Stripe group passthrough

### Other
`analytics/track` (fan-out to `vendor_log_interaction` + `prompt_log_event`) · `contact` → `ep_contact_us_dev` · `worldcup/capture` → `ep_worldcup_capture_dev` · `admin/city-intelligence` (hardcoded base URL, no auth)

---

## 7. Key modules, in dependency order

### `app/lib/server/xanoProxy.ts` — the chokepoint
Three typed fetchers (`xanoFetch`, `xanoAuthFetch`, `xanoStripeFetch`) over a shared `baseFetch`. Every call is `cache: "no-store"`. Non-OK responses throw `XanoError`, which carries `status` and the parsed body, and whose message is produced by `readXanoErrorMessage` — a **recursive search** through the response object for the first `message` / `Message` / `error` / `detail` string. That exists because Xano nests error text unpredictably. `extractBearerToken(request)` pulls the `Authorization` header.

### `app/lib/publicApiClient.ts` — the browser's API layer
1,324 lines, ~70 exported functions. `apiJson<T>()` is the shared helper: sets JSON headers, attaches the stored bearer token unless `auth: false`, and **auto-clears the local session on any 401** (`publicApiClient.ts:150-153`). Grouped by domain: session management, auth, profile, vendor, subscription, social learning, offers/redemption, saved venues, push, analytics, Stripe.

Interaction loggers (`logVendorInteraction`, `logVenueInteraction`, `logEventInteraction`, `logSignupPromptEvent`) deliberately use a bare `fetch(...).catch(() => {})` rather than `apiJson` — they are fire-and-forget and must never surface an error.

### `app/lib/genieMappers.ts` — shape defense
Where the Xano contract gets pinned down. `mapVenue` applies the image fallback chain and coerces coordinates. `inferResponseMode` reconciles three different mode fields (`response_mode`, `reply_mode`, `mode`) that the backend has used across versions. `normalizeHandleMessageResponse` produces the single envelope the UI trusts.

### `app/lib/server/xanoCatalog.ts` — the fallback search
Fetches the raw `genie_v1` catalog (up to 400–500 rows) and scores matches client-side: exact name 400 → prefix 300 → substring 200 → address 120 → neighborhood 90. Used by `/api/genie/venue` when the dedicated lookup 404s, so any venue that appeared in search results stays resolvable. Note it re-fetches the whole catalog per call with no caching.

### `app/lib/runtimeConfig.ts` — the city/pricing config object
Single source for `cityLabel: "Houston"`, the 8 quick chips, `signupPromptSuppressAfter: 3`, V.I.Bee pricing (`$2.99/mo`), vendor plans (`$37/month` Pro and Boost), and all plan benefit copy. **This is where you change marketing copy and pricing** — not in components.

### `SinglePageGenieApp.tsx` — the app
One client component holding the whole consumer experience: its own screen state machine, all geolocation handling, Web Speech integration, results rendering, venue detail, saved spots, and the mount points for `AccountSection`, `ProfileSection`, `VendorSection`, and `DrawerMenu`. At 5,446 lines it is by a wide margin the largest and most consequential file in the repo.

---

## 8. State management

There is no state library. State lives in three places:

**React state** — inside `SinglePageGenieApp` and its section children. Screen routing is `activeScreen` plus a `navigateTo()` helper, not the Next.js router.

**localStorage** — twelve keys (full inventory in `docs/DATA_STREAMS.md` §5):
`genie_auth_token_v1`, `genie_consumer_account_v1`, `genie_saved_venues_v1`, `genie_device_id`, `genie_session_token`, `genie_session_id`, `genie_external_user_id`, `genie_geo_v1`, `genie_location_prompt_dismissed_v1`, `genie_vendor_onboarding_v1`, `genie_signup_prompt_v1`, `genie-theme`.

Every accessor guards `typeof window === "undefined"` and wraps `JSON.parse` in try/catch — correct for SSR and for storage-blocked contexts.

**Server (Xano)** — the durable record: sessions, social profiles, behavioral signals, saved venues, accounts, vendors, offers, redemptions.

**Identity model.** Three overlapping identifiers, which is the single most confusing thing about the codebase:
- `device_id` — client-generated UUID, pre-account, keys the social profile
- `external_user_id` — Xano-issued, spans guest → account (guest sessions get one too)
- `user_id` / `session_id` — numeric legacy identifiers several endpoints still require

`/api/user/save-venue` and `/api/user/saved-venues` forward **both** the legacy and modern shapes, with in-file comments explaining that the live backend still enforces the old ones despite newer docs describing the new ones.

---

## 9. Legacy and dead code

Worth knowing before you go spelunking:

| What | Status |
|---|---|
| `lib/server/apiStore.ts` + `authToken.ts` | A complete **local JSON-file backend** — users with scrypt password hashes, vendors, analytics — at `.next/cache/genie-api-store.json`. Superseded by Xano magic-link auth. Only live consumer is `getAuthenticatedUser()` in the Genie message route, which will not verify Xano-issued tokens. |
| `lib/openaiClient.ts` | Lazy OpenAI client. `getOpenAI()` is **never called**. AI replies are generated in Xano. |
| `lib/genie/xano.ts` | Server-only helper hitting `handle_message_dev` (v1) directly. Unused. |
| `lib/genie/useGenieLocation.ts` | Parallel geolocation hook that persists coords to `localStorage`. Unused; `SinglePageGenieApp` has its own implementation. |
| `components/discovery/HomeScreen.tsx` | Alternate home screen from the pre-single-page architecture. |
| `api/subscription/webhook` | Intentional 501 stub — real webhooks live in Xano. Documented in-file. |
| `social-bevy-website/` | Untouched `create-next-app` scaffold with its own lockfile. Not part of the build. |
| `components/account/`, `components/vendor/` | Empty, `.gitkeep` only — a planned decomposition of `SinglePageGenieApp`. |

---

## 10. Conventions

- **Route handlers** follow one shape: `try` → parse body with `.catch(() => ({}))` → validate and coerce each field → `xanoFetch` → `NextResponse.json` → `catch` with an `instanceof XanoError` branch preserving upstream status, then a generic 500.
- **Telemetry never fails the user.** Fire-and-forget routes return `{ success: true }` or `{ logged: true }` even on error. `/api/worldcup/capture` returns HTTP 200 with `success: false` on failure so the form can show its own message.
- **Defensive coercion everywhere.** `String(x ?? "").trim()`, `Number(x)` + `Number.isFinite`, `Array.isArray` before use. This is deliberate: `genie_api_reference.md` §13.5 documents that Xano returns `{}` for empty arrays and mishandles optional booleans.
- **Doc comments on route handlers** state the HTTP contract and the Xano target. Follow this — it is the fastest way to navigate the API layer.
- **Import alias** `@/*` → repo root, so `@/app/lib/...`.
- **Types** live in `lib/genieTypes.ts` (`RawGenieVenue` for Xano shapes, `GenieVenue` for normalized) and inline in `publicApiClient.ts` for API payloads.
- **Naming:** `snake_case` on the wire (Xano's convention), `camelCase` in React. `toConsumerAccount()` is the translation boundary.

---

## 11. Build, run, deploy

```bash
npm install
npm run dev      # next dev with Turbopack → localhost:3000
npm run build
npm run start
npm run lint     # eslint (flat config, next/core-web-vitals + next/typescript)
```

There is **no `.env.example`**. Create `.env.local` with at minimum:

```
XANO_BASE_URL=https://xwpg-kuah-brlj.n7d.xano.io
JWT_SECRET=<any-string; only the legacy auth path uses it>
NEXT_PUBLIC_APP_BASE_URL=http://localhost:3000
```

Optional: `XANO_GENIE_DEV_BASE`, `XANO_AUTH_BASE`, `XANO_STRIPE_BASE`, `XANO_GENIE_VENUES_URL`, `NEXT_PUBLIC_XANO_BASE_URL`, `NEXT_PUBLIC_GOOGLE_MAPS_KEY`, `NEXT_PUBLIC_ENABLE_CLIENT_STATIC_MAPS`, `OPENAI_API_KEY` (unused).

**Every Xano base URL has a hardcoded production fallback**, so the app will run with no env file at all — pointed at production. That is convenient and dangerous in equal measure.

The `README.md` instructs you to set `NEXT_PUBLIC_XANO_API_BASE_URL`, which **does not exist in the code**. The real name is `NEXT_PUBLIC_XANO_BASE_URL`.

Deploy is Vercel, connected to GitHub `socialbevy/social-genie`.

---

## 12. Rough edges

Things a newcomer will hit. Not a bug list — just the shape of the terrain.

1. **`SinglePageGenieApp.tsx` is 5,446 lines.** Screen routing, geolocation, speech, results, venue detail, and saved spots all in one client component. The empty `components/account/` and `components/vendor/` directories show the split was planned.
2. **Three identifier systems coexist** (`device_id`, `external_user_id`, `user_id`/`session_id`) and several endpoints forward all of them for compatibility. Read the in-file comments in `api/user/save-venue/route.ts` before touching identity code.
3. **Docs drift.** Three committed markdown files describe the API (`genie_api_reference.md` at v8.0/35 endpoints, `latest_api_docs_today.md`, and two readiness reports). They disagree with each other and with the code — the message endpoint is `ep_genie_chat_v2_dev` in code but `ep_handle_message_dev` in the reference. **Code is the source of truth.**
4. **`production_readiness_report.md` is partially stale.** It flags a missing `verify/[token]` page and absent offer routes; both now exist. Re-verify anything it claims before acting on it.
5. **No tests, anywhere.** No framework, no CI. Verification is manual.
6. **The catalog fallback re-fetches up to 500 venues per call** with no caching (`xanoCatalog.ts`). Fine at Houston scale; it will not survive multi-city.
7. **`next.config.ts` allows remote images from `**` over both http and https** — effectively any host on the internet.
8. **One `.jsx` file** in an otherwise strict-TypeScript repo: `components/admin/CityIntelligenceDashboard.jsx`.
9. **Two `console.log` calls remain**, one of which prints resolved coordinates (`SinglePageGenieApp.tsx:972`).
10. **The admin route and page have no auth guard.** `genie_api_reference.md` references an `ADMIN_SECRET` env var that does not appear anywhere in the code.
11. **`app/lib/genie/`** shadows `app/lib/` with parallel, mostly-unused implementations of the same concerns. Check whether a module is actually imported before editing it.

---

## 13. Where to start, by task

| You want to… | Go to |
|---|---|
| Change the main query flow | `lib/genieClient.ts` → `api/genie/message/route.ts` → `lib/genieMappers.ts` |
| Add a backend call | New handler in `app/api/…` using `xanoProxy`, then a client fn in `publicApiClient.ts` |
| Change pricing, city, or plan copy | `lib/runtimeConfig.ts` |
| Touch consumer UI | `components/SinglePageGenieApp.tsx` (brace yourself) |
| Touch vendor UI | `components/single-page/VendorSection.tsx` |
| Add an analytics event | `lib/analyticsEvents.ts`, then a helper in `lib/analytics.ts` |
| Understand what Xano offers | `genie_api_reference.md` — but verify against the code |
| Understand what data flows where | `docs/DATA_STREAMS.md` |
| Change session/identity handling | `lib/sessionToken.ts` + `lib/localState.ts` — read §8 first |
| Debug an image not rendering | `lib/genieMappers.ts:getVenueImage` and the fallback chain |

---

*Written from a static read of the repository at commit `e61fd69`. Line numbers and counts are accurate as of that commit.*
