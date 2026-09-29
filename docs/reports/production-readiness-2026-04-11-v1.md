# Social Genie - Production Readiness Report v1
> Generated: April 11, 2026 - Branch: `new-changes-ui` - API Reference: `genie_api_reference.md` v8.0 (35 official endpoints)
>
> Method: repo-to-doc audit only. This report compares the current Next.js app against `genie_api_reference.md` and local source code. No live Xano endpoints were called.

---

## Architecture Summary

```text
Browser / PWA
    ->
Next.js 15 App Router (Vercel)
  /app/api/* routes
    ->
Xano Backend
  api:pgMKWi2e   - official Genie, Vendor, Offers, Push, Social, Admin
  api:dRDS80y8   - official passwordless auth
  api:jQf3GatY   - Stripe-native products/sessions used by this repo
  api:mY7zYhwk   - venue catalog feed used by this repo
```

Auth today is passwordless magic link. Guest usage starts with `guest_session`, and the app also converts guest sessions after login via `convert_guest_session`.

---

## Coverage Summary

The previous report mixed two different scopes:

1. Official endpoints listed in `genie_api_reference.md`
2. Additional Xano endpoints the current repo already uses but the reference doc does not list

That made the totals contradictory. This version keeps those scopes separate.

### Official API coverage from `genie_api_reference.md` (35 endpoints)

| Bucket | Count | Notes |
|--------|-------|-------|
| Actively integrated in this repo | 13 | User/vendor-facing routes actively proxied and used |
| Backend-owned / placeholder only | 2 | Webhook routes exist as placeholders but return `501` and should be handled by Xano directly |
| Not integrated in this repo | 20 | 4 offers/redemption + 6 social learning + 10 admin |

---

## Official Endpoints Integrated In This Repo

### Active app integration (13 / 35)

| # | Xano Endpoint | Next.js Route | Status |
|---|---------------|---------------|--------|
| 1 | `auth/verify_email/signup` | `POST /api/auth/signup` | Integrated |
| 2 | `auth/verify_email/magic_login` | `POST /api/auth/login` | Integrated |
| 3 | `genie/guest_session` | `POST /api/genie/session` | Integrated |
| 4 | `genie/ep_handle_message_dev` | `POST /api/genie/message` and `POST /api/genie-chat` | Integrated, duplicate alias exists |
| 5 | `genie/vendor_search` | `GET /api/vendor/search` | Integrated |
| 6 | `genie/checkout_vibee` | `POST /api/subscription/create` | Integrated |
| 7 | `genie/checkout_vendor_plan` | `POST /api/subscription/create` | Integrated |
| 8 | `genie/vendor_onboarding_start` | `POST /api/vendor/claim` and `POST /api/vendor/create` | Integrated |
| 9 | `genie/vendor_dashboard_v1` | `GET /api/vendor/dashboard` | Integrated |
| 10 | `genie/vendor_create_offer` | `POST /api/vendor/offer` | Integrated |
| 15 | `genie/register_push_token` | `POST /api/genie/register-push-token` | Integrated |
| 16 | `genie/send_notification` | `POST /api/genie/send-notification` | Integrated |
| 17 | `genie/notification_opened` | `POST /api/genie/notification-opened` | Integrated |

### Backend-owned / placeholder only (2 / 35)

These are documented official endpoints, but this repo does not actually implement their business logic.

| # | Xano Endpoint | Repo Surface | Status |
|---|---------------|-------------|--------|
| 24 | `stripe/webhook` | `POST /api/stripe/webhook` | Placeholder only, returns `501` |
| 25 | `stripe/vendor_webhook` | `POST /api/stripe/vendor-webhook` | Placeholder only, returns `501` |

> Operational note: this is acceptable only if Stripe is configured to call Xano directly. If Stripe is pointed at the Vercel app routes by mistake, checkout activation will fail.

---

## Official Endpoints Not Integrated In This Repo

### P0 - Offers and Redemption (4 missing official endpoints)

These are the clearest app-side launch gaps because they power the core V.I.Bee member experience.

| # | Xano Endpoint | What is missing |
|---|---------------|-----------------|
| 11 | `GET genie/vibee_offers` | No offers list route, page, or member UI |
| 12 | `POST genie/redeem_offer` | No redeem action, no QR generation flow |
| 13 | `GET genie/verify_redemption` | No `app/verify/[token]` page for staff scan verification |
| 14 | `GET genie/user_redemptions` | No redemption history screen |

### P1 - Social Learning and Personalization (6 missing official endpoints)

These are not wired yet, so Genie cannot build the documented personalization loop.

| # | Xano Endpoint | What is missing |
|---|---------------|-----------------|
| 18 | `POST genie/init_device` | Not called on app open |
| 19 | `GET genie/get_social_profile` | No social preferences intake load |
| 20 | `POST genie/update_social_profile` | No social preferences save flow |
| 21 | `POST genie/track_signal` | Not called on query submit, venue tap, save, or offer actions |
| 22 | `POST genie/merge_guest_profile` | Not called after magic login |
| 23 | `GET genie/get_profile_strength` | Not wired; lower priority if `show_intake_prompt` is used from message responses |

### Separate scope - Admin (10 missing official endpoints)

The repo contains no admin UI and no admin API proxy routes for the official admin endpoints. This does not block the consumer app launch if admin lives in a separate codebase, but it is still outside the current repo.

| Xano Endpoint |
|---------------|
| `GET genie/admin_overview` |
| `GET genie/admin_users` |
| `PATCH genie/admin_user_membership` |
| `GET genie/admin_vendors` |
| `PATCH genie/admin_vendor_status` |
| `GET genie/admin_offers` |
| `PATCH genie/admin_offer_status` |
| `GET genie/admin_redemptions` |
| `GET genie/admin_venues` |
| `PATCH genie/admin_system_settings` |

---

## Additional Repo-Used Endpoints Missing From The Official API Reference

If `genie_api_reference.md` is meant to be the frontend source of truth, it is currently incomplete. The repo actively uses additional endpoints and upstreams that are not documented there.

### Auth and session helpers

- `auth/me`
- `genie/convert_guest_session`

### Prompt and engagement system

- `genie/prompt_should_show`
- `genie/prompt_log_event`
- `genie/prompt_dismiss`

### Venue and user features

- `genie/venue`
- `genie/save_venue`
- `genie/saved_venues`
- `genie/vendor_log_interaction`
- `genie/vendor_profile`
- `genie/vendor_analytics_summary`
- `genie/vendor_profile_completeness`

### Additional upstreams used by this repo

- `api:jQf3GatY/products`
- `api:jQf3GatY/sessions`
- `api:jQf3GatY/sessions/[id]`
- `api:jQf3GatY/sessions/[id]/line_items`
- `api:mY7zYhwk/genie_v1`

---

## Production Issues

### 1. Missing `app/verify/[token]` route - P0 blocker

The official docs define `verify_offer_base_url` as `https://genie.socialbevy.com/verify/`, and `verify_redemption` is an official endpoint. This repo has `app/verified/page.tsx` for magic-link redirect handling, but it does not have `app/verify/[token]` for QR staff verification.

Result: if redemption QR codes are generated today, vendor staff land on a 404 instead of a valid/invalid redemption screen.

Required UI states:

| Condition | UI |
|-----------|----|
| `valid: true`, first verification | Green success state |
| `valid: true`, already verified | Blue "Already verified" state |
| invalid / not found | Red invalid state |

### 2. No V.I.Bee offers, redeem, or redemption history UX - P0 blocker

The upgrade flow can send users to Stripe, but the repo has no member-facing screen for:

- viewing active V.I.Bee offers
- redeeming an offer
- rendering a QR code
- viewing redemption history

Without these screens, the V.I.Bee value proposition is incomplete even if membership activation succeeds in Xano.

### 3. Missing checkout success routes - P0 blocker

Current checkout defaults redirect to:

- `https://genie.socialbevy.com/vibee/success`
- `https://genie.socialbevy.com/vendor/success`

Those paths do not exist under `app/` in this repo. The callers also do not override the default success URLs, so the current code path risks a post-payment 404 after successful checkout.

### 4. Social personalization loop is not wired - P1

The app does create and restore guest sessions, and it also converts guest sessions after login. However, the social profile and behavioral-learning layer described in the official docs is still missing:

- no `init_device`
- no `track_signal`
- no social profile load/save
- no `merge_guest_profile`

Important nuance: guest state is not completely discarded because `convert_guest_session` is already called after login. The missing part is the documented social-learning profile and signal history, not all guest continuity.

### 5. Webhook routes are placeholders - P1 operational risk

The repo exposes `/api/stripe/webhook` and `/api/stripe/vendor-webhook`, but both return `501` and explicitly say Xano should handle them directly.

This is safe only if Stripe points to Xano. It is unsafe if anyone assumes the Vercel app routes are live webhook handlers.

### 6. Duplicate Genie message alias - P2 cleanup

`POST /api/genie-chat` simply re-exports the same handler as `POST /api/genie/message`.

This is not a direct launch blocker, but it adds maintenance ambiguity and should be collapsed to a single public route.

### 7. Docs and config drift - P2

Several documentation details do not match the current repo:

- `genie_api_reference.md` says magic login completes from `/auth/verify`, but this app uses `/verified` to bounce `?token=` back into `/`.
- `genie_api_reference.md` omits the additional endpoints and upstreams listed above.
- `.env.example` still includes `XANO_GENIE_HANDLE_MESSAGE_PATH`, but current source no longer uses that variable.

### 8. Environment validation is partial, not absent - P3

The previous report said there was no environment validation. That was too broad.

Current reality:

- `JWT_SECRET` is required when auth-token helpers are loaded.
- `OPENAI_API_KEY` is guarded in `app/lib/openaiClient.ts`.
- There is no centralized startup validation module for all runtime env vars.
- `openaiClient.ts` is currently not imported anywhere, so its guard does not protect the running app at boot.

This is cleanup worth doing, but it is not the same as "no validation exists."

---

## What Is Working Well

| Area | Status |
|------|--------|
| Magic-link signup and token exchange | Working |
| Guest session creation | Working |
| Guest session conversion after login | Working |
| Core Genie message flow | Working |
| Vendor business search and onboarding | Working |
| Vendor dashboard | Working |
| Vendor offer creation | Working |
| Vendor profile update and analytics routes | Working in repo, but missing from official docs |
| Save / unsave / list saved venues | Working in repo, but missing from official docs |
| Push token registration and notification tracking | Working |
| Stripe checkout session creation via Xano | Working |
| Signup prompt event plumbing | Working in repo, but missing from official docs |

---

## Pre-Launch Priority List

| Priority | Item | Official endpoint impact |
|----------|------|--------------------------|
| P0 | Build V.I.Bee offers list, redeem flow, QR display, and redemption history | `vibee_offers`, `redeem_offer`, `user_redemptions` |
| P0 | Create `app/verify/[token]/page.tsx` for staff QR verification | `verify_redemption` |
| P0 | Add real success routes or override checkout success URLs to existing pages | checkout return flow |
| P1 | Wire `init_device` on app open | `init_device` |
| P1 | Wire `track_signal` on query submit, venue open, save, and future offer actions | `track_signal` |
| P1 | Call `merge_guest_profile` after magic login | `merge_guest_profile` |
| P1 | Confirm Stripe webhooks point to Xano, not the Vercel placeholders | `stripe/webhook`, `stripe/vendor_webhook` |
| P2 | Build social preferences intake load/save UI | `get_social_profile`, `update_social_profile`, optional `get_profile_strength` |
| P2 | Remove duplicate `/api/genie-chat` alias | cleanup |
| P2 | Update `genie_api_reference.md` to include repo-used endpoints, extra base URLs, and correct auth redirect path | docs |
| P2 | Clean `.env.example` and config docs to match current source | config docs |
| P3 | Decide whether admin belongs in a separate repo, and if so document that boundary explicitly | admin scope |

---

## Environment And Config Reality Check

### Used by current app source

| Variable | Status |
|----------|--------|
| `JWT_SECRET` | Used by auth token helpers |
| `XANO_BASE_URL` | Used |
| `XANO_GENIE_DEV_BASE` | Optional override, used |
| `XANO_AUTH_BASE` | Optional override, used |
| `XANO_STRIPE_BASE` | Optional override, used |
| `XANO_GENIE_VENUES_URL` | Optional override, used by catalog fetch |

### Present in `.env.example` but not used by current source

| Variable | Status |
|----------|--------|
| `XANO_GENIE_HANDLE_MESSAGE_PATH` | Stale in current source tree |
| `OPENAI_API_KEY` | Guard exists in `openaiClient.ts`, but that module is not currently imported |

### Backend-side variables still required in Xano

The official API reference remains the source for Xano-side env vars such as Stripe price IDs, webhook secrets, OneSignal credentials, SendGrid credentials, `verify_offer_base_url`, and `genie_base_url`.

---

## Final Assessment

The app is not production-ready yet for the full documented product surface.

For the current repo:

- Core Genie chat, auth, vendor onboarding, vendor dashboard, saves, push registration, and checkout session creation are in place.
- The biggest remaining product gaps are member offers/redemption, QR verification, social personalization wiring, and broken default checkout return paths.
- The official API reference also needs revision because it does not fully describe the endpoints and upstream bases this app already depends on.

If the launch goal is only the core consumer Genie chat plus vendor onboarding, the app is close. If the launch goal includes the full V.I.Bee offer experience and documented personalization flow, more work is still required before production.

---

*Report generated from local source review only - April 2026 - Social Genie*
