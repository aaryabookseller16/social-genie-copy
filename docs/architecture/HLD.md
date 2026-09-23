# High-Level Design — Social Genie

> Status: reflects `main` as of Sept 2026. Update this doc when a box or arrow below changes.

## 1. Purpose

Social Genie is a mobile-first AI social concierge by Social Bevy. A user describes a vibe
("R&B brunch", "cute patio near me"), Genie returns curated venues and events, and the user can
save, share, redeem V.I.Bee member offers, or — as a venue owner — claim and manage a listing.

## 2. System context

```
                 ┌──────────────────────────────────────────────┐
  iPhone/desktop │  Browser / installed PWA                     │
  ───────────────►  • SinglePageGenieApp (React 19, client)     │
                 │  • sw.js (PWA) + OneSignal service worker    │
                 │  • localStorage: session, saved venues, auth │
                 └───────────────┬──────────────────────────────┘
                                 │ same-origin fetch("/api/...")
                 ┌───────────────▼──────────────────────────────┐
  Vercel         │  Next.js 16 App Router (this repo)           │
                 │  • Pages: /, /saved, /venue/[id], /events/…  │
                 │  • /app/api/** route handlers = thin proxy   │
                 │  • app/lib/server/xanoProxy.ts               │
                 └──┬───────────┬───────────┬────────────┬──────┘
                    │           │           │            │
         api:pgMKWi2e     api:dRDS80y8  api:jQf3GatY  api:mY7zYhwk
         Genie / Vendor   Auth (magic   Stripe        Venue catalog
         Offers / Push    link, /me)    products &    feed (genie_v1)
         Admin / Social                 sessions
                    └───────────┴─────┬─────┴────────────┘
                              ┌───────▼────────┐        ┌──────────┐
                              │  Xano backend  │◄──────►│  Stripe  │  (webhooks go
                              │  (DB + logic   │        └──────────┘   straight to Xano)
                              │  + LLM chat)   │        ┌──────────┐
                              └───────┬────────┘───────►│ OneSignal│──► push to device
                                      │                 └──────────┘
```

## 3. Components

| Component | Responsibility | Where |
|---|---|---|
| **Genie client app** | Chat, discovery, saved spots, account, vendor onboarding — one client-side shell switching "screens" | `app/components/SinglePageGenieApp.tsx`, `app/components/**` |
| **Public pages** | Server-rendered, shareable URLs with OG metadata: venues, events, influencer pages | `app/venue/[id]`, `app/events/[slug]`, `app/i/[handle]` |
| **Campaign pages** | World Cup landing, V.I.Bee signup link, Stripe success pages | `app/worldcup`, `app/join`, `app/vibee/success`, `app/vendor/success` |
| **Admin** | City-intelligence dashboard | `app/admin/city-intelligence` |
| **API proxy** | Hides Xano base URLs from the browser, normalizes errors, forwards the Bearer token | `app/api/**/route.ts` → `app/lib/server/xanoProxy.ts` |
| **Xano** | System of record: users, venues, vendors, offers, sessions, analytics; hosts Genie's chat/LLM logic | external |
| **Stripe** | V.I.Bee memberships and vendor plans; checkout sessions are created *by Xano* | external |
| **OneSignal** | Web push | `app/components/shared/NotificationsBoot.tsx` |

## 4. Key flows

**Ask Genie.** UI → `callGenie()` (`app/lib/genieClient.ts`) → `POST /api/genie/message` →
Xano `genie/ep_genie_chat_v2_dev` → response is normalized by `normalizeHandleMessageResponse()`
(`app/lib/genieMappers.ts`) into venues/events/cards.

**Guest → member.** First visit calls `genie/guest_session` and `genie/init_device`; IDs live in
localStorage (`app/lib/sessionToken.ts`). Signup/login is passwordless magic link via the Auth group;
`/verified?token=` bounces back to `/?token=` where the app exchanges it (`auth/verify_email/magic_login`),
stores `genie_auth_token_v1`, then calls `genie/convert_guest_session` to carry saves over. See
[ADR-0002](../adr/0002-passwordless-magic-link-jwt-auth.md).

**Subscribe.** `POST /api/subscription/create` → Xano `genie/checkout_vibee` or
`genie/checkout_vendor_plan` → Stripe Checkout → Stripe webhooks hit Xano directly → app polls
`/api/subscription/status` on `/vibee/success`. See [ADR-0005](../adr/0005-stripe-via-xano-webhooks.md).

**Vendor claim.** Search (`genie/vendor_search`) → `genie/vendor_onboarding_start` → contact info →
plan checkout → dashboard (`genie/vendor_dashboard_v1`, `vendor_analytics_summary`).

## 5. Cross-cutting concerns

- **Config:** Xano URLs have hard-coded production defaults in `xanoProxy.ts`/`xanoCatalog.ts`;
  env vars override them. See [environment variables](../guides/environment-variables.md).
- **State:** no server-side session. Everything user-side is localStorage keys prefixed `genie_`.
- **Analytics:** `app/lib/analytics.ts` → `/api/analytics/track` → Xano logging endpoints.
- **PWA:** `public/sw.js` registered by `PwaBoot`; `public/site.webmanifest`.
- **Hosting:** Vercel, project root = repo root. See [deployment](../guides/deployment.md).

## 6. Known architectural gaps

Tracked in detail in [LLD §7](LLD.md#7-known-issues--tech-debt) and the
[production-readiness report](../reports/production-readiness-2026-04-11.md). Headline items:
the 5.4k-line client shell, no automated tests, an unauthenticated admin route, and several
routes pointing at `*_dev` Xano endpoints.
