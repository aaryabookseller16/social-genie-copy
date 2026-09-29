# Low-Level Design — Social Genie

> Companion to [HLD.md](HLD.md). Describes code layout, module contracts, and the route → Xano map.

## 1. Directory layout

```
app/
├── page.tsx, saved/…          → render <SinglePageGenieApp initialScreen=…/>
├── venue/[id]/                  SSR venue page + OG tags (xanoFetch on the server)
├── events/[slug]/               SSR event page + client island (EventDetailClient)
├── i/[handle]/                  SSR influencer landing page
├── join/, verified/             client redirects into "/" with query params
├── verify/[token]/              staff-facing offer redemption check
├── vibee/success, vendor/success  Stripe return pages
├── worldcup/                    campaign landing page (own layout)
├── admin/city-intelligence/     admin dashboard
├── api/**/route.ts              server route handlers (see §4)
├── components/
│   ├── SinglePageGenieApp.tsx   app shell: screen state machine, chat, results, modals
│   ├── single-page/             large screen sections (Account, Profile, Vendor, Drawer, ui kit)
│   ├── discovery/HomeScreen.tsx
│   ├── shared/                  BottomNav, GenieOrb, QuickChips, ThemeToggle, PwaBoot, NotificationsBoot
│   └── admin/                   CityIntelligenceDashboard
├── lib/                         client-safe helpers (see §3)
│   └── server/                  server-only helpers — never import from a client component
├── layout.tsx, providers.tsx    root layout, next-themes provider
└── globals.css
apps/website/                    separate Next.js app (Social Bevy marketing site, template stage)
docs/                            this documentation
public/                          static assets, sw.js, OneSignal workers, manifest
```

## 2. Rendering model

- `app/page.tsx` renders a **single client component** that owns navigation via
  `activeScreen: FlowAnchor` state (`home`, `listening`, `thinking`, `decision`, `detail`, `saved`,
  `offers`, `redemptions`, `account`, `profile`, `vendor`, `dashboard`, `event-detail`, …).
  Deep links use `?screen=<anchor>` (e.g. `/join` → `/?screen=account&signup=vibee`).
  See [ADR-0003](../adr/0003-single-page-app-shell.md).
- Shareable pages (`venue`, `events`, `i`) are **server components** that call `xanoFetch` directly
  so they can emit `generateMetadata` OG tags.

## 3. `app/lib` modules

| Module | Side | Role |
|---|---|---|
| `publicApiClient.ts` | client | Typed wrapper for **every** `/api/*` call (≈60 functions). New endpoints go here. |
| `genieClient.ts` | client | `callGenie()` → `/api/genie/message`, attaches Bearer token + session IDs |
| `genieMappers.ts` | both | `mapVenue`, `getVenueImage`, `normalizeHandleMessageResponse` — raw Xano → UI shapes |
| `genieTypes.ts` | both | `RawGenieVenue`, `GenieVenue`, `RawGenieEvent`, response envelopes, runtime config types |
| `localState.ts` | client | Saved venues, consumer account, auth token in localStorage |
| `sessionToken.ts` | client | Guest session token/ID, external user ID, device ID |
| `signupPrompt.ts`, `vendorOnboarding.ts` | client | Persisted UI state for the signup nudge and vendor wizard draft |
| `analytics.ts`, `analyticsEvents.ts` | client | `trackEvent` + event-name catalogue |
| `cityExtractor.ts` | client | Detects a typed city ("…in Houston") to override geolocation |
| `runtimeConfig.ts` | client | Quick chips and other static runtime config |
| `server/xanoProxy.ts` | server | `xanoFetch` / `xanoAuthFetch` / `xanoStripeFetch`, `XanoError`, `extractBearerToken` |
| `server/xanoCatalog.ts` | server | Venue catalog feed + in-memory name/address scoring |
| `server/requestAuth.ts`, `authToken.ts`, `apiStore.ts` | server | **Legacy** local-JWT + JSON-file user store (see §7) |

### localStorage keys

`genie_auth_token_v1`, `genie_consumer_account_v1`, `genie_saved_venues_v1`, `genie_session_token`,
`genie_session_id`, `genie_external_user_id`, `genie_device_id`, `genie_signup_prompt_v1`,
`genie_vendor_onboarding_v1`, `genie_location_prompt_dismissed_v1`. Bump the `_vN` suffix when a shape changes.

## 4. API route → Xano map

Base groups: **G** = Genie `api:pgMKWi2e`, **A** = Auth `api:dRDS80y8`, **S** = Stripe `api:jQf3GatY`.

| Route | Methods | Upstream |
|---|---|---|
| `genie/message` | POST | G `genie/ep_genie_chat_v2_dev` |
| `genie/session` | POST | G `genie/guest_session`, `genie/convert_guest_session` |
| `genie/init-device` | POST | G `genie/init_device` |
| `genie/merge-guest-profile` | POST | G `genie/merge_guest_profile` |
| `genie/venue` | GET | G `genie/ep_get_venue_dev` (+ catalog fallback) |
| `genie/social-profile` | GET, POST | G `genie/get_social_profile`, `genie/update_social_profile` |
| `genie/track-signal` | POST | G `genie/track_signal` |
| `genie/interaction` | POST | G `genie/vendor_log_interaction` |
| `genie/log-venue-interaction` / `log-event-interaction` | POST | G `genie/ep_log_venue_interaction_dev` / `ep_log_event_interaction_dev` |
| `genie/prompt` | GET, POST | G `genie/prompt_should_show`, `prompt_dismiss`, `prompt_log_event` |
| `genie/offers` | GET | G `genie/vibee_offers` |
| `genie/redeem-offer`, `redemptions`, `verify-redemption/[token]` | POST/GET | G `genie/redeem_offer`, `user_redemptions`, `verify_redemption` |
| `genie/register-push-token`, `send-notification`, `notification-opened` | POST | G `genie/register_push_token`, `send_notification`, `notification_opened` |
| `auth/signup` | POST | A `auth/verify_email/signup` |
| `auth/login` | POST | A `auth/verify_email/magic_login` |
| `auth/me` | GET | A `auth/me` |
| `auth/update-profile` | POST | A `auth/update_profile` + G `genie/ep_save_contact_info_dev` |
| `auth/delete-account` | POST | G `genie/ep_delete_account_dev` |
| `user/save-venue`, `unsave-venue`, `saved-venues` | POST/GET | G `genie/save_venue`, `genie/saved_venues` |
| `vendor/search` | GET | G `genie/vendor_search` |
| `vendor/create`, `vendor/claim` | POST | G `genie/vendor_onboarding_start` |
| `vendor/contact-info` | POST | G `genie/ep_save_contact_info_dev` |
| `vendor/profile` | GET, PUT | G `genie/ep_get_vendor_profile_dev`, `ep_save_profile_changes_dev` |
| `vendor/venue` | GET, PUT | G `genie/ep_get_venue_details_dev`, `ep_save_venue_details_dev` |
| `vendor/dashboard`, `analytics`, `profile-completeness` | GET | G `genie/vendor_dashboard_v1`, `vendor_analytics_summary`, `vendor_profile_completeness` |
| `vendor/offer` | POST | G `genie/vendor_create_offer` |
| `subscription/create` | POST | G `genie/checkout_vibee` / `genie/checkout_vendor_plan` |
| `subscription/status` | GET | A `auth/me` |
| `stripe/products`, `stripe/sessions[/id[/line_items]]` | GET/POST | S `products`, `sessions…` |
| `analytics/track` | POST | G `genie/prompt_log_event`, `genie/vendor_log_interaction` |
| `contact` | POST | G `genie/ep_contact_us_dev` |
| `worldcup/capture` | POST | G `genie/ep_worldcup_capture_dev` |
| `admin/city-intelligence` | GET | G `admin/city-intelligence` (hard-coded URL, no auth) |
| `stripe/webhook`, `stripe/vendor-webhook`, `subscription/webhook` | POST | **501 stubs** — Stripe calls Xano directly |

Full request/response contracts: [api/genie-api-reference.md](../api/genie-api-reference.md) and
[api/endpoint-curl-examples.md](../api/endpoint-curl-examples.md).

## 5. Route handler pattern

Every handler should follow this shape:

```ts
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const data = await xanoFetch("genie/some_endpoint", {
      method: "POST",
      body,
      authToken: extractBearerToken(request),
    });
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof XanoError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Unexpected server error" }, { status: 500 });
  }
}
```

Then add a matching typed function in `publicApiClient.ts` and call only that from components.

## 6. Auth & identity

1. Guest: `sessionToken.ts` creates a device ID; `genie/guest_session` returns a session token.
2. Signup/login: magic-link email → `/verified?token=…` → `/?token=…` → `loginWithMagicToken()`
   → `persistAuthSession()` stores `genie_auth_token_v1` + account.
3. Authenticated calls send `Authorization: Bearer <xano authToken>`; route handlers forward it via
   `extractBearerToken()`.
4. After login `convertGuestSession()` migrates guest saves.

## 7. Known issues & tech debt

| # | Issue | Location | Impact |
|---|---|---|---|
| 1 | `/api/genie/message` verifies the Xano token against a **local** `JWT_SECRET` and a JSON file store in `.next/cache`. Xano tokens never validate, so enrichment is dead; if `JWT_SECRET` is unset any logged-in chat request throws → **500**. | `lib/server/requestAuth.ts`, `authToken.ts`, `apiStore.ts` | Logged-in chat breaks without the env var. Fix: drop `getAuthenticatedUser` and forward the token to Xano. |
| 2 | Admin route has no auth and hard-codes the Xano URL | `api/admin/city-intelligence/route.ts` | Data exposure; ignores env overrides |
| 3 | Several upstreams are `*_dev` Xano endpoints in production code | see §4 | Env drift |
| 4 | `SinglePageGenieApp.tsx` is 5.4k lines; `VendorSection.tsx` 2k | `components/` | Hard to review/test — split by screen |
| 5 | No automated tests | — | Regressions only caught manually |
| 6 | OneSignal `appId` hard-coded | `components/shared/NotificationsBoot.tsx` | Can't point dev at a separate app |
| 7 | `next.config.ts` allows images from any host over http and https | `next.config.ts` | Open image optimizer proxy |
| 8 | Asset filenames with spaces/`(1)` | `public/` | Fragile references |
