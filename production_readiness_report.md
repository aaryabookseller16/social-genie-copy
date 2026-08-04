# Social Genie — Production Readiness Report
> **Generated:** April 11, 2026 · **Branch:** `new-changes-ui` · **API Reference:** `genie_api_reference.md` v8.0 (35 official endpoints)
>
> **Method:** Source-code audit only. All claims verified against actual files. No live Xano endpoints were called.

---

## Architecture Summary.

```
Browser / PWA
    →
Next.js 15 App Router (Vercel)
  /app/api/* routes  ←  thin server-side proxies to Xano
    →
Xano Backend (4 API groups used by this repo)
  api:pgMKWi2e  —  Genie, Vendor, Offers, Push, Social, Admin  (official docs)
  api:dRDS80y8  —  Auth (magic link / passwordless)              (official docs)
  api:jQf3GatY  —  Stripe-native products / sessions             (used, not in official docs)
  api:mY7zYhwk  —  Venue catalog feed                            (used, not in official docs)
```

**Auth:** Passwordless magic link → token exchange for `authToken` (JWT) → `Authorization: Bearer` header on protected calls.  
**Sessions:** Guest usage starts with `guest_session`. After login, `convert_guest_session` fires automatically to transfer session venue saves. Social-learning profile merge (`merge_guest_profile`) is separate and not yet called.

---

## Coverage Summary

The 35 official endpoints and the repo-used-but-undocumented endpoints are tracked separately below to avoid mixing scopes.

| Bucket | Count |
|--------|-------|
| Official endpoints actively integrated | 13 |
| Official endpoints — placeholder only (return `501`) | 2 |
| Official endpoints not integrated | 20 |
| Additional repo-used endpoints **not in official docs** | 17 |
| Non-official placeholder routes (return `501`) | 1 (`/api/subscription/webhook`) |

---

## Official Endpoints — Actively Integrated (13 / 35)

| # | Xano Endpoint | Next.js Route | Notes |
|---|---------------|---------------|-------|
| 1 | `auth/verify_email/signup` | `POST /api/auth/signup` | Magic link signup |
| 2 | `auth/verify_email/magic_login` | `POST /api/auth/login` | Token → `authToken` exchange |
| 3 | `genie/guest_session` | `POST /api/genie/session` | Guest session creation |
| 4 | `genie/ep_handle_message_dev` | `POST /api/genie/message` · `POST /api/genie` · `POST /api/genie-chat` | Core AI query — 3 aliases all point to same handler (see issues) |
| 5 | `genie/vendor_search` | `GET /api/vendor/search` | Venue name search for onboarding |
| 6 | `genie/checkout_vibee` | `POST /api/subscription/create` | V.I.Bee Stripe checkout |
| 7 | `genie/checkout_vendor_plan` | `POST /api/subscription/create` | Vendor plan Stripe checkout |
| 8 | `genie/vendor_onboarding_start` | `POST /api/vendor/claim` · `POST /api/vendor/create` | All 3 steps: search → contact → confirm |
| 9 | `genie/vendor_dashboard_v1` | `GET /api/vendor/dashboard` | Pro/Basic tier differentiated |
| 10 | `genie/vendor_create_offer` | `POST /api/vendor/offer` | Pro vendors only |
| 15 | `genie/register_push_token` | `POST /api/genie/register-push-token` | OneSignal player ID |
| 16 | `genie/send_notification` | `POST /api/genie/send-notification` | Admin broadcast |
| 17 | `genie/notification_opened` | `POST /api/genie/notification-opened` | Open tracking |

---

## Official Endpoints — Placeholder Only (2 / 35)

Three routes exist in the repo but return `501`. Business logic is handled by Xano directly.

| # | Xano Endpoint | Repo Route | Reality |
|---|---------------|-----------|---------|
| 24 | `stripe/webhook` | `POST /api/stripe/webhook` | Returns `501` — "handled by Xano directly" |
| 25 | `stripe/vendor_webhook` | `POST /api/stripe/vendor-webhook` | Returns `501` — "handled by Xano directly" |
| — | *(not in official docs)* | `POST /api/subscription/webhook` | Returns `501` — same pattern, third placeholder |

> **Operational risk:** This is safe **only if** Stripe Dashboard webhooks point directly to Xano. If anyone configures Stripe to call any of these three Vercel routes, checkout activation will silently fail. Confirm all Stripe webhook URLs before launch.

---

## Official Endpoints — Not Integrated (20 / 35)

### P0 — Offers & Redemption (4 endpoints — launch blockers)

These power the core V.I.Bee membership value proposition. No pages, routes, or API calls exist for any of them.

| # | Xano Endpoint | What is missing |
|---|---------------|-----------------|
| 11 | `GET genie/vibee_offers` | No offers list route, page, or member UI |
| 12 | `POST genie/redeem_offer` | No redeem action, no QR code generation |
| 13 | `GET genie/verify_redemption` | No `app/verify/[token]/page.tsx` — staff QR scan lands on a 404 |
| 14 | `GET genie/user_redemptions` | No redemption history screen |

### P1 — Social Learning & Personalization (6 endpoints)

None are wired. Genie cannot build its documented personalization loop without them.

| # | Xano Endpoint | What is missing |
|---|---------------|-----------------|
| 18 | `POST genie/init_device` | Not called on app open — device never initialized |
| 19 | `GET genie/get_social_profile` | No social preferences intake load |
| 20 | `POST genie/update_social_profile` | No social preferences save flow |
| 21 | `POST genie/track_signal` | Not called on query, venue tap, save, or offer actions |
| 22 | `POST genie/merge_guest_profile` | Not called after `magic_login` — social-learning history lost on signup |
| 23 | `GET genie/get_profile_strength` | Not wired. Note: the proxy also strips `show_intake_prompt` from message responses (Issue #1), so neither mechanism for showing the intake prompt is currently functional. |

### Admin — Separate Portal (10 endpoints)

No admin UI or API proxy routes exist in this repo. Assumed to be at `admin.socialbevy.com` (separate codebase). Not a consumer launch blocker, but admin endpoints currently have **no auth guard**.

| Xano Endpoint | Section |
|---------------|---------|
| `GET genie/admin_overview` | KPI dashboard |
| `GET genie/admin_users` | Paginated user list |
| `PATCH genie/admin_user_membership` | Manual V.I.Bee activation |
| `GET genie/admin_vendors` | Paginated vendor list |
| `PATCH genie/admin_vendor_status` | Update vendor live/plan status |
| `GET genie/admin_offers` | Offer list |
| `PATCH genie/admin_offer_status` | Activate/deactivate offer |
| `GET genie/admin_redemptions` | Redemption list |
| `GET genie/admin_venues` | Venue inventory |
| `PATCH genie/admin_system_settings` | Kill switches (notifications, backfills) |

---

## Additional Repo-Used Endpoints Not in Official Docs

`genie_api_reference.md` is the stated frontend source of truth but does not document these endpoints and upstreams that the repo actively depends on:

**Auth & session helpers**
- `auth/me` — used by `/api/auth/me` and `/api/subscription/status`
- `genie/convert_guest_session` — called after login to transfer guest session venues

**Prompt & engagement system**
- `genie/prompt_should_show`
- `genie/prompt_log_event`
- `genie/prompt_dismiss`

**Venue & user features**
- `genie/venue` — venue detail fetch
- `genie/save_venue` — save/unsave toggle
- `genie/saved_venues` — saved venues list
- `genie/vendor_log_interaction` — call/map/save click tracking
- `genie/vendor_profile` — vendor profile update (PUT)
- `genie/vendor_analytics_summary` — analytics by period
- `genie/vendor_profile_completeness` — completeness score

**Additional upstream bases**
- `api:jQf3GatY/products` — Stripe products
- `api:jQf3GatY/sessions` — Stripe sessions list / create
- `api:jQf3GatY/sessions/${id}` — Stripe session by ID (`sessions/[id]/route.ts:21`)
- `api:jQf3GatY/sessions/${id}/line_items` — Stripe session line items
- `api:mY7zYhwk/genie_v1` — venue catalog feed

> These should be added to `genie_api_reference.md` if that doc is meant to be complete.

---

## Production Issues

### 1. Genie message response: `city_missing` collapsed + intake fields stripped — P1

Two separate problems in the message pipeline, both confirmed in source:

**a) `city_missing` collapses to `supported_no_results`** ([genieMappers.ts:50-51](app/lib/genieMappers.ts#L50))

```typescript
case "city_missing":
  return "supported_no_results"; // treat as no results with location prompt
```

The docs define `city_missing` as a distinct mode requiring a dedicated "ask for city" UI. The mapper silently converts it to `supported_no_results`, so the frontend shows "Genie did not find a clean match yet. Tighten the ask and try again." instead of prompting the user for their city.

This collapse is doubly entrenched: `GenieResponseMode` in `genieTypes.ts:1-5` only defines four modes (`structured_results`, `supported_no_results`, `city_unsupported`, `ai_fallback`) — `city_missing` is not a valid type at all. Both the mapper and the type system would need to be updated to handle it distinctly.

**b) Intake fields are stripped by the message proxy** ([message/route.ts:131-162](app/api/genie/message/route.ts#L131))

The API docs (§2.2) require checking three fields on every response:
- `show_intake_prompt` — whether to show the intake banner
- `intake_prompt_copy` — the banner text
- `profile_strength_tier` — personalization level (`new` / `getting_started` / `learning` / `strong`)

The proxy response at `message/route.ts:131` only forwards `reply`, `top_venues`, `more_venues`, `session_id`, `session_token`, `use_xano`, `needs_location`, `reply_mode`, `filters`, and `debug`. All three intake fields are absent from the forwarded response, so the frontend can never display the intake banner regardless of what Xano returns.

---

### 2. Missing `app/verify/[token]/page.tsx` — P0 blocker

`verify_offer_base_url` in Xano = `https://genie.socialbevy.com/verify/`. This page does not exist. The app has `app/verified/page.tsx` (magic-link redirect handler — different purpose) but nothing under `/verify/`. Any QR code a V.I.Bee member generates sends vendor staff to a 404.

Required UI states per docs §5.3:

| Condition | UI |
|-----------|----|
| `valid: true`, first scan | Green checkmark + "Valid Redemption" + offer title + member name |
| `valid: true`, already verified | Blue "Already Verified" + original `verified_at` timestamp |
| 404 / invalid token | Red X + "Invalid Code" |

---

### 3. No V.I.Bee offers, redeem, or redemption history UX — P0 blocker

After a user upgrades to V.I.Bee membership via Stripe checkout, there is nowhere in the app to:
- view active offers (`vibee_offers`)
- redeem an offer and receive a QR code (`redeem_offer` → `verify_url` → `qrcode.react`)
- review redemption history (`user_redemptions`)

The Stripe checkout session is created correctly and `checkout_url` is returned. Whether the Xano webhook actually activates the membership cannot be verified from source code alone — it depends on Stripe webhook configuration pointing at Xano, which must be confirmed with a live test. The post-upgrade UX is the confirmed gap.

---

### 4. Broken default checkout success URLs — P0 blocker

Both the server route and the client helper have hardcoded default success URLs that point to pages that do not exist in this repo:

```
app/api/subscription/create/route.ts:32   → https://genie.socialbevy.com/vendor/success
app/api/subscription/create/route.ts:55   → https://genie.socialbevy.com/vibee/success
app/lib/publicApiClient.ts:233            → https://genie.socialbevy.com/vendor/success
app/lib/publicApiClient.ts:244            → https://genie.socialbevy.com/vibee/success
```

Neither `app/vendor/success/` nor `app/vibee/success/` exist under `app/`. A successful Stripe checkout redirects the user to a 404. Either build the success pages or change the default URLs to an existing page (e.g. `/account?upgraded=true`).

---

### 5. Webhook routes are placeholders — P1 operational risk

Three routes in this repo return `501`:

| Route | Official? | Status |
|-------|-----------|--------|
| `POST /api/stripe/webhook` | Yes (#24) | Returns `501` — must be handled by Xano |
| `POST /api/stripe/vendor-webhook` | Yes (#25) | Returns `501` — must be handled by Xano |
| `POST /api/subscription/webhook` | No (not in official docs) | Returns `501` — additional placeholder |

This is architecturally correct but requires that all Stripe Dashboard webhook URLs are pointed at Xano, not at any of these Vercel routes. Verify this before launch — a misconfigured webhook silently breaks all membership and plan activations.

---

### 6. Social personalization loop not wired — P1

`convert_guest_session` IS called after login (session venues transfer correctly). What is missing is the separate social-learning layer:

- `init_device` — not called on app open
- `track_signal` — not called on query, venue tap, save, or offer actions; `profile_strength_tier` stays at `new` indefinitely
- `merge_guest_profile` — not called after `magic_login`; behavioral history (queries, taps) from the guest session is lost
- Social preferences intake UI (`get_social_profile` / `update_social_profile`) — not built

---

### 7. Three Genie message route aliases — P2 cleanup

There are three routes all pointing to the exact same handler:

```
app/api/genie/message/route.ts  — primary handler
app/api/genie/route.ts          — export { POST } from "./message/route"
app/api/genie-chat/route.ts     — export { POST } from "../genie/message/route"
```

All three proxy to `genie/ep_handle_message_dev`. Two aliases should be removed before launch to eliminate maintenance ambiguity.

---

### 8. `openaiClient.ts` is never imported — P2

`app/lib/openaiClient.ts` has a module-level guard:

```typescript
if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY is not set in environment variables");
}
```

But `openaiClient` is **not imported anywhere in the app**. The guard never executes. If any route eventually imports it without `OPENAI_API_KEY` set in production, the server will throw at startup. Either wire it properly or document that OpenAI fallback is intentionally disabled.

---

### 9. Docs and config drift — P2

- `genie_api_reference.md` says magic login completes from `/auth/verify`, but this app uses `/verified` to bounce `?token=` back to `/`.
- `genie_api_reference.md` omits the 17 additional endpoints and extra bases the repo depends on (listed above).
- `.env.example` includes `XANO_GENIE_HANDLE_MESSAGE_PATH` but this variable is **not used anywhere** in the current source.
- `.env.example` lists `OPENAI_API_KEY` as required but the guard in `openaiClient.ts` is never reached (module not imported).
- `XANO_GENIE_VENUES_URL` and `NEXT_PUBLIC_GOOGLE_MAPS_KEY` are used by the app but absent from `.env.example` — see the env variables section below.

---

### 10. Admin endpoints have no auth guard — P3

Docs note: *"No auth currently — add API key header before public exposure."* All 10 admin endpoints are open on the Xano side. Must add `ADMIN_SECRET` check before admin portal launch.

---

## What Is Working Well

| Area | Status |
|------|--------|
| Magic-link signup and token exchange | Working end-to-end |
| Guest session creation | Working |
| Guest session conversion after login (venue saves transfer) | Working — `convert_guest_session` fires after `magic_login` |
| Core Genie message flow | Partial — see Issue #1 below |
| Vendor business search and onboarding (all 3 steps) | Working |
| Vendor dashboard (Pro/Basic tier differentiation) | Working |
| Vendor offer creation | Working |
| Vendor profile update, analytics, completeness routes | Working in repo (missing from official docs) |
| Save / unsave / list saved venues | Working in repo (missing from official docs) |
| Push token registration and notification tracking | Working |
| Stripe checkout session creation (all plan types) | Working — checkout_url generated and redirects correctly |
| Signup prompt event plumbing | Working in repo (missing from official docs) |
| `/verified` magic-link redirect page | Working |

---

## Pre-Launch Priority List

| Priority | Item | Endpoints / Files Involved |
|----------|------|----------------------------|
| 🔴 **P0** | Build V.I.Bee offers list, redeem flow, QR display | `vibee_offers`, `redeem_offer`, `user_redemptions` |
| 🔴 **P0** | Create `app/verify/[token]/page.tsx` — staff QR verification | `verify_redemption` |
| 🔴 **P0** | Fix checkout success URLs or build `app/vibee/success` + `app/vendor/success` pages | `publicApiClient.ts:233,244` · `subscription/create/route.ts:32,55` |
| 🟠 **P1** | Forward `show_intake_prompt`, `intake_prompt_copy`, `profile_strength_tier` from message proxy | `message/route.ts:131` |
| 🟠 **P1** | Handle `city_missing` as distinct mode in mapper — do not collapse to `supported_no_results` | `genieMappers.ts:50` |
| 🟠 **P1** | Confirm all 3 Stripe webhook routes (Stripe + vendor + subscription) point to Xano, not Vercel | `stripe/webhook`, `stripe/vendor-webhook`, `subscription/webhook` |
| 🟠 **P1** | Call `init_device` on app open + `track_signal` on query/venue tap/save | `init_device`, `track_signal` |
| 🟠 **P1** | Call `merge_guest_profile` immediately after `magic_login` | `merge_guest_profile` |
| 🟡 **P2** | Build social preferences intake screen (load + save) | `get_social_profile`, `update_social_profile` |
| 🟡 **P2** | Remove 2 of the 3 Genie message route aliases | `app/api/genie/route.ts` · `app/api/genie-chat/route.ts` |
| 🟡 **P2** | Wire or remove `openaiClient.ts` — resolve dead guard | `app/lib/openaiClient.ts` |
| 🟡 **P2** | Update `genie_api_reference.md` with all repo-used endpoints and correct auth redirect path | docs |
| 🟡 **P2** | Clean `.env.example` — remove `XANO_GENIE_HANDLE_MESSAGE_PATH`, add `XANO_GENIE_VENUES_URL` | `.env.example` |
| ⚪ **P3** | Add `ADMIN_SECRET` auth guard before admin portal goes live | Admin endpoints |

---

## Environment Variables — Reality Check

### Used by current source

| Variable | Where used |
|----------|-----------|
| `JWT_SECRET` | Auth token helpers |
| `XANO_BASE_URL` | `xanoProxy.ts` — default `https://xwpg-kuah-brlj.n7d.xano.io` |
| `XANO_GENIE_DEV_BASE` | Optional override — `xanoProxy.ts` |
| `XANO_AUTH_BASE` | Optional override — `xanoProxy.ts` |
| `XANO_STRIPE_BASE` | Optional override — `xanoProxy.ts` |

### In `.env.example` but not used by current source

| Variable | Status |
|----------|--------|
| `XANO_GENIE_HANDLE_MESSAGE_PATH` | Stale — no references in source tree |
| `OPENAI_API_KEY` | Guard exists in `openaiClient.ts` but module is never imported |

### Used by current source but missing from `.env.example`

| Variable | Status |
|----------|--------|
| `XANO_GENIE_VENUES_URL` | Used by `xanoCatalog.ts` — no entry in `.env.example` |
| `NEXT_PUBLIC_GOOGLE_MAPS_KEY` | Used by `SinglePageGenieApp.tsx:155` for static map previews — optional (graceful null fallback), no entry in `.env.example` |

### Backend-side (Xano env vars — not in Next.js)

| Variable | Description |
|----------|-------------|
| `stripe_api_secret` | `sk_live_...` |
| `stripe_price_vibee` | V.I.Bee subscription price ID |
| `stripe_price_founding_partner` | Founding Partner price ID |
| `stripe_price_boost_1999/3999/5999` | One-time boost tier price IDs |
| `stripe_price_monthly_boost` | Monthly Boost subscription price ID |
| `stripe_webhook_secret` | V.I.Bee webhook signing secret |
| `stripe_vendor_webhook_secret` | Vendor webhook signing secret |
| `onesignal_app_id` | `2b0988a9-9a1e-4039-9131-e4859ea641e2` |
| `onesignal_api_key` | OneSignal REST key |
| `magic_jwt_secret` | Magic link JWT signing |
| `sendgrid_api_key` | Email delivery |
| `sendgrid_magic_link_template` | Magic link email template |
| `verify_offer_base_url` | `https://genie.socialbevy.com/verify/` |
| `genie_base_url` | `https://genie.socialbevy.com` |

---

## Final Assessment

The app is **not production-ready** for the full documented product surface.

**Solid and working:** Magic-link auth, vendor onboarding, vendor dashboard, Stripe checkout session creation, push notifications, saved venues, session continuity. Core Genie chat is functional but has response-contract gaps (Issue #1: `city_missing` handling and stripped intake fields).

**Biggest gaps before launch:**
1. V.I.Bee offers and redemption — the entire member value-prop has no UI
2. QR verification page is missing — staff cannot verify any redemption
3. Post-checkout success pages don't exist — successful payments land on a 404
4. Social personalization loop is dark — `track_signal` and `init_device` never called

**If launch scope is core consumer Genie chat + vendor onboarding only**, the app is close. **If launch scope includes the full V.I.Bee offer experience**, three P0 items must be completed first.

---

*Verified April 2026 — Social Genie · Combined audit from `production_readiness_report.md` v1 and v2*
