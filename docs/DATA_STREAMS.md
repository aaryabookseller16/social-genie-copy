# Data Streams & Privacy Analysis

**Repo:** `social-genie` (Social Genie / Social Bevy)
**Scope:** every inbound and outbound data flow reachable from this Next.js codebase, plus a privacy review of each.
**Method:** static read of `app/`, `public/`, `next.config.ts`, and the two committed API contracts (`genie_api_reference.md`, `latest_api_docs_today.md`).
**Status of findings:** these are *risks to investigate*, not confirmed incidents. Several depend on backend (Xano) behavior that cannot be verified from this repo alone.

---

## 1. Executive summary

Social Genie is a **thin Next.js front end over a Xano backend**. Almost no data is stored by this application itself — the Next.js API routes under `app/api/**` are overwhelmingly **pass-through proxies** to Xano instances, with light field validation and shape normalization.

That architecture has one large privacy consequence: **this repo is a data conduit, not a data controller of record.** The bulk of retention, deletion, encryption, and access-control decisions live in Xano and in the third parties (Stripe, OneSignal, SendGrid, Google, OpenAI) that Xano and the browser talk to. Anything you want to assert about data handling has to be verified on the Xano side; the code here cannot prove it.

Within the code that *is* here, the data collected is more sensitive than a venue-search app might suggest. In particular:

- **Precise device geolocation** is requested with `enableHighAccuracy: true` and forwarded to the backend on a per-query basis.
- **Free-text natural-language queries** (typed and voice-transcribed) are stored as behavioral signals and as analytics payloads.
- The **social preference profile** includes `community_tags` with documented values such as `"Black-Owned"` and `"LGBTQ+ Friendly"`, and `music_tags` with values like `"R&B / Soul"`, `"Hip-Hop / Rap"`, `"AfroBeats"`. Read together with a user identity, these are proxies for race/ethnicity and sexual orientation — **special-category data** under GDPR Art. 9 and comparable to sensitive-inference categories under CPRA.
- A **pre-consent device identity** (`genie_device_id`) is created and used to accumulate behavioral history *before* any account exists, and is later merged into the account via `merge_guest_profile`.

The rest of this document enumerates each stream and then the privacy findings.

---

## 2. Backend endpoints this app talks to

All backend traffic terminates at a single Xano host, split across four API groups. Defined in `app/lib/server/xanoProxy.ts:17-26` and `app/lib/server/xanoCatalog.ts:3-5`.

| Purpose | Env var | Hardcoded fallback |
|---|---|---|
| Genie core (venues, vendor, social learning, offers) | `XANO_GENIE_DEV_BASE` | `https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e` |
| Auth (magic link) | `XANO_AUTH_BASE` | `…/api:dRDS80y8` |
| Stripe | `XANO_STRIPE_BASE` | `…/api:jQf3GatY` |
| Venue catalog (`genie_v1`) | `XANO_GENIE_VENUES_URL` | `…/api:mY7zYhwk/genie_v1` |
| Origin override | `XANO_BASE_URL` | `https://xwpg-kuah-brlj.n7d.xano.io` |

Two routes bypass the proxy helper and hardcode the base URL directly:
- `app/api/admin/city-intelligence/route.ts:3` — `const XANO_BASE = "https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e"`
- `app/lib/genie/xano.ts:4` — reads `NEXT_PUBLIC_XANO_BASE_URL`, a **public** (client-exposed) env var, inside a `server-only` module. This module appears unused by any current route.

---

## 3. Inbound data streams (data collected from the user/device)

### 3.1 Natural-language queries — typed

- **Where:** `app/components/SinglePageGenieApp.tsx` (input handling), `app/lib/genieClient.ts:29-88` (`callGenie`).
- **Path:** browser → `POST /api/genie/message` → Xano `genie/ep_genie_chat_v2_dev`.
- **Fields sent** (`genieClient.ts:38-71`): `message`, `channel: "web"`, `external_user_id`, `user_name` (account first name), `session_token`, `city_context`, `lat`, `lng`, `radius_meters` (default 2500), `user: { first_name, user_id }`, `user_data: { first_name, membership }`, `meta.source`.
- **Server-side enrichment:** `app/api/genie/message/route.ts:26-88` attaches the authenticated user's `first_name` and numeric `id` when a bearer token is present, even if the client omitted them.
- **Note:** free-text queries are unconstrained. Users can and do type anything ("date night," "somewhere quiet after therapy," a specific person's name). Treat query text as free-form user content, not as a bounded enum.

### 3.2 Natural-language queries — voice

- **Where:** `app/components/SinglePageGenieApp.tsx:1052-1115`.
- **Mechanism:** Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`), `lang: "en-US"`, `continuous: false`, `interimResults: false`.
- **Important:** in Chrome and Edge this API is **not local**. Audio is streamed to Google's speech servers for transcription. The app never handles the raw audio and never sees where it goes — but the user's voice does leave the device, to a party that is not disclosed anywhere in this codebase.
- The resulting transcript is placed in the input box and requires an explicit confirm before submission (`setPendingTranscript(true)`), which is a good pattern.
- Voice failures are tracked as analytics events: `voice_permission_denied` with a `reason`, `voice_listening_cancelled`.

### 3.3 Precise device geolocation

Collected in four separate places:

| File | Line | Accuracy | Trigger |
|---|---|---|---|
| `SinglePageGenieApp.tsx` | 954 | `enableHighAccuracy: true` | per-query, attached to `callGenie` |
| `SinglePageGenieApp.tsx` | 1699 | `enableHighAccuracy: true` | silent re-fetch if permission already granted |
| `SinglePageGenieApp.tsx` | 1749 | `enableHighAccuracy: true` | explicit user tap on the location banner |
| `SinglePageGenieApp.tsx` | 2529 | — | "near me" quick-chip tap |
| `single-page/VendorSection.tsx` | 1110 | `enableHighAccuracy: false` | vendor onboarding "enable location" step |
| `lib/genie/useGenieLocation.ts` | 47 | `enableHighAccuracy: true` | unused hook; **persists coords to `localStorage["genie_geo_v1"]`** |

- **Consent flow:** the app deliberately does *not* auto-prompt. The ask is surfaced only after near-me intent (chip tap or the literal phrase "near me") — `SinglePageGenieApp.tsx:1786-1800`. Once granted or denied, `genie_location_prompt_dismissed_v1` suppresses re-asking. This is a genuinely thoughtful consent design.
- **Onward flow:** coords go to Xano on every qualifying query as `lat` / `lng`. Xano's retention of these is unknown from this repo.
- **Precedence rule:** an explicit city named in the message beats device coords (`cityExtractor.ts`, `SinglePageGenieApp.tsx:931-933`), so coords are dropped when the user types a city. Good minimization behavior.
- **Vendor flow caveat:** `VendorSection.tsx:1110` requests position, then **discards the coordinates** — it only flips a `locationEnabled` boolean and fires an analytics event. The permission is requested without the data being used.

### 3.4 Device identity (pre-account tracking)

- **Where:** `app/lib/sessionToken.ts:63-93`.
- `genie_device_id` — a `crypto.randomUUID()` persisted to `localStorage`, created on first need and never rotated or expired.
- Sent to Xano via `POST /api/genie/init-device` → `genie/init_device` (idempotent, called on app open per the API reference §7.1).
- Used as the primary key for the **social profile** and for **behavioral signals** before any account exists.
- On signup, `POST /api/genie/merge-guest-profile` → `genie/merge_guest_profile` links the entire pre-account behavioral history (`signals_merged` in the response) to the new account identity.

This is the classic "anonymous until it isn't" pattern: history collected without an account is retroactively attached to a named person.

### 3.5 Session identity

`app/lib/sessionToken.ts`, `app/lib/publicApiClient.ts:208-258`.

| localStorage key | Contents | Source |
|---|---|---|
| `genie_session_token` | Xano session token (UUID) | `genie/guest_session` |
| `genie_session_id` | numeric session id | same |
| `genie_external_user_id` | user/guest UUID | same |
| `genie_device_id` | device UUID | client-generated |

A guest session is created via `POST /api/genie/session` with `{ channel: "web", context: { source: "web" } }`. On login, `convert_guest_session` transfers guest saves to the account.

### 3.6 Behavioral signals (the personalization engine)

Four distinct logging paths, all fire-and-forget:

1. **`POST /api/genie/track-signal`** → Xano `genie/track_signal`
   Fields (`app/api/genie/track-signal/route.ts:17-42`): `device_id`, `external_user_id`, `signal_type`, `signal_value`, `category_tags[]`, `city`, `neighborhood`, `session_id`.
   `signal_type` ∈ `query | venue_tap | venue_save | offer_view | offer_redeem | more_nearby_tap`.
   **`signal_value` carries the raw query text** for `query` signals (API reference §7.4 example: `"signal_value": "brunch near me"`).
   Xano additionally derives and stores `time_of_day` and `day_of_week` server-side.

2. **`POST /api/genie/log-venue-interaction`** → `genie/ep_log_venue_interaction_dev`
   `venue_id`, `interaction_type`, `user_id`, `session_id`, `source_screen`. Feeds `genie_user_venue_interaction` + `genie_behavior_signals`.

3. **`POST /api/genie/log-event-interaction`** → `genie/ep_log_event_interaction_dev`
   Same shape, `event_id` instead of `venue_id`.

4. **`POST /api/genie/interaction`** → `genie/vendor_log_interaction`
   Vendor-facing metrics: `venue_id`, `interaction_type`, `user_id`, `session_id`.

Per the API reference, signal volume drives a `strength_tier` (`new` → `getting_started` → `learning` → `strong`), and at `strong` (10+ signals) ranking is **"behavior 70% + explicit prefs 30%"**. The behavioral profile is the dominant input to what the user is shown.

### 3.7 Analytics events

- **Where:** `app/lib/analytics.ts`, `app/lib/analyticsEvents.ts` (≈80 named events), `app/api/analytics/track/route.ts`.
- **Path:** browser → `POST /api/analytics/track` → **fan-out to two Xano endpoints**.
- Payload: `{ event, venue_id, metadata: { timestamp, session_id, city, ...arbitrary data } }`.
- The `metadata` blob is **not schema-constrained** — whatever the caller passes is forwarded. Notable callers that put user content in it:
  - `trackQuery(query)` → `{ query: "<raw user query text>" }` (`analytics.ts:60-62`)
  - `trackQuickChipTapped(label, prompt)` → `{ label, prompt }`
  - `trackWeeklySignup(contact)` → **`{ contact }` — an email address or phone number placed inside an analytics metadata blob** (`analytics.ts:100-102`)
- The route then does two things (`app/api/analytics/track/route.ts:36-90`):
  - maps certain events to vendor interaction types and fires `genie/vendor_log_interaction`
  - maps certain events to signup-prompt triggers and fires `genie/prompt_log_event`
- **No first-party or third-party analytics SDK is present** — no GA, no Segment, no Mixpanel, no Vercel Analytics. All telemetry is first-party to Xano. This is a meaningful privacy positive.

### 3.8 Social preference profile (explicit intake)

- **Where:** `app/api/genie/social-profile/route.ts`, `app/lib/publicApiClient.ts:34-50, 539-569`.
- `GET` keyed by `device_id` **or** `external_user_id`; `POST` updates.
- Fields: `experiences_tags[]`, `atmosphere_tags[]`, `bevy_bites_tags[]`, `community_tags[]`, `music_tags[]`, `price_range`, `group_size`, `typical_time`.
- Documented example values (`genie_api_reference.md` §7.2):
  - `community_tags`: `["Black-Owned", "LGBTQ+ Friendly"]`
  - `music_tags`: `["R&B / Soul", "Hip-Hop / Rap", "AfroBeats"]`
  - `group_size`: `solo | couple | small_group | large_group`
  - `typical_time`: `afternoon | evening | late_night | weekend_brunch`

See finding **F-1** — this is the single most sensitive collection in the product.

### 3.9 Account data (consumer)

- **Signup:** `POST /api/auth/signup` → Xano `auth/verify_email/signup`. Collects `email` (required, regex-validated), `first_name`, `last_name`. Passwordless — Xano sends a magic link via SendGrid.
- **Login:** `POST /api/auth/login` → `auth/verify_email/magic_login`, exchanges `magic_token` for `authToken` (JWT), `user_id`, `external_user_id`, `email`, `membership_active`.
- **Read:** `GET /api/auth/me` → `auth/me`. Returns `id, first_name, last_name, email, phone, membership, subscription_status, vendor_id`.
- **Update:** `POST /api/auth/update-profile` → `auth/update_profile`. `first_name`, `last_name`, `email`, `phone`.
- **Delete:** `POST /api/auth/delete-account` → `genie/ep_delete_account_dev`. Documented as a **soft delete**. Auth is by `external_user_id` **in the request body**; the bearer token is forwarded but not required by this route (see finding **F-5**).

### 3.10 Vendor / business data

- **Onboarding:** `POST /api/vendor/claim` and `POST /api/vendor/create` → `genie/vendor_onboarding_start` (step-based: `search` → `contact` → `confirm`).
- Collects: `business_name`, `first_name`/`last_name` (split from `full_name`), `email`, `phone`, address fields, `selected_plan_id`, `location_enabled`.
- **Profile/venue edits:** `/api/vendor/profile`, `/api/vendor/venue`, `/api/vendor/contact-info` → `genie/ep_get_vendor_profile_dev`, `ep_get_venue_details_dev`, `ep_save_contact_info_dev`. Includes website, reservation URL, hours, images, social links.
- **Dashboard & analytics:** `/api/vendor/dashboard` → `genie/vendor_dashboard_v1`; `/api/vendor/analytics` → `genie/vendor_analytics_summary` (Pro tier); `/api/vendor/profile-completeness`.
- Vendors receive **aggregate** consumer metrics (views, clicks, saves, genie appearances, call/map/reservation taps). Nothing in this repo passes individual consumer identities to vendors — but `vendor_log_interaction` is sent `user_id` and `session_id`, so the *backend* holds the per-user join. Whether the vendor dashboard can drill down to it is a Xano question.

### 3.11 Contact form

`POST /api/contact` → `genie/ep_contact_us_dev`. Collects `first_name`, `last_name`, `email`, `topic`, `message`, `source`. Bearer token forwarded when present so the backend can associate the message with an account; anonymous submissions accepted. The free-text `message` field is unbounded user content.

### 3.12 World Cup lead capture

`app/worldcup/page.tsx` → `POST /api/worldcup/capture` → `genie/ep_worldcup_capture_dev`. Collects `email`, `first_name`, `city` (hardcoded `"Houston"`), `acquisition_source: "worldcup_houston"`. This is a marketing list build — see finding **F-8** on consent basis.

### 3.13 Push notification identity

- **Client:** `app/components/shared/NotificationsBoot.tsx`. OneSignal Web SDK v16, initialized on **every page load** via `Providers` in the root layout.
- OneSignal App ID is **hardcoded in client source**: `2b0988a9-9a1e-4039-9131-e4859ea641e2` (`NotificationsBoot.tsx:16`). It is also listed in `genie_api_reference.md` §12. App IDs are public by design, so this is disclosure rather than a secret leak — but it means the value cannot be rotated per-environment without a code change.
- Two service workers (`public/OneSignalSDKWorker.js`, `public/OneSignalSDKUpdaterWorker.js`) `importScripts` directly from `https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js` — **remote code executed in service-worker scope with no SRI pinning**.
- `requestPushPermission()` returns the OneSignal player ID, which is sent to `POST /api/genie/register-push-token` → `genie/register_push_token` alongside `external_user_id` and `channel`.
- **Outbound push:** `POST /api/genie/send-notification` → `genie/send_notification` with `user_id`, `notification_type`, `title`, `message`, `url`. See finding **F-4**.
- **Open tracking:** `POST /api/genie/notification-opened` → `genie/notification_opened`.

### 3.14 Payments

- **Initiation:** `POST /api/subscription/create` → Xano `genie/checkout_vibee` (consumer, sends `external_user_id` + `email`) or `genie/checkout_vendor_plan` (vendor, sends `vendor_id`, `plan_type`, `boost_tier`).
- **Raw Stripe passthrough:** `app/api/stripe/sessions/*` → Xano Stripe group (`api:jQf3GatY`) — `POST /sessions`, `GET /sessions`, `GET /sessions/{id}`, `GET /sessions/{id}/line_items`.
- **No card data touches this app.** Stripe Checkout is hosted; the app only handles session IDs and redirect URLs. Good separation.
- **Webhooks:** `app/api/subscription/webhook/route.ts` is a deliberate 501 stub. Real webhooks (`stripe/webhook`, `stripe/vendor_webhook`) are handled by Xano.
- See finding **F-3** on the unauthenticated `GET /api/stripe/sessions`.

### 3.15 Legacy local file store (largely dormant)

`app/lib/server/apiStore.ts` implements a **JSON-file database** at `process.cwd()/.next/cache/genie-api-store.json`, holding `users` (with `password_hash`, `email`, `phone`), `vendors` (business + contact details), and `analytics` events. `app/lib/server/authToken.ts` implements hand-rolled HMAC-SHA256 JWTs and scrypt password hashing against `JWT_SECRET`.

This is a **superseded local-dev backend** — the live auth path is Xano magic-link. The only live consumer is `getAuthenticatedUser()` in `app/api/genie/message/route.ts:28`, which reads this file to optionally enrich Genie queries with a name/ID. See findings **F-6** and **F-7**.

---

## 4. Outbound / third-party data streams

| Destination | What reaches it | How |
|---|---|---|
| **Xano** (`xwpg-kuah-brlj.n7d.xano.io`) | Everything above | Server-side proxy (`xanoProxy.ts`) |
| **Google Speech** (implicit) | Raw microphone audio | Web Speech API in Chrome/Edge — undisclosed |
| **OneSignal** | Push subscription, device/browser fingerprint, page visits | Client SDK, loaded on every page |
| **Stripe** | Email, name, card data (on Stripe's own domain) | Hosted Checkout redirect, orchestrated by Xano |
| **SendGrid** | Email address, magic link | Xano-side; app never calls it directly |
| **Google Maps** | Venue address in a URL; API key + address if static maps enabled | `app/lib/maps.ts` |
| **OpenAI** | Nothing currently | `app/lib/openaiClient.ts` exists and reads `OPENAI_API_KEY`, but **`getOpenAI()` is never called anywhere in this repo** |
| **Arbitrary image hosts** | User IP + `Referer` on every venue image load | `next.config.ts` allows `**` over both http and https |
| **Google Fonts** | Nothing at runtime | `next/font/google` self-hosts at build time — correct, no runtime leak |
| **cdn.onesignal.com** | Service-worker code fetch | `importScripts` in both SW files |

**On Google Maps:** `googleStaticMapUrl()` is deliberately gated behind `NEXT_PUBLIC_ENABLE_CLIENT_STATIC_MAPS === "true"` and returns `null` by default (`maps.ts:62-80`), with a comment explaining the gate exists to prevent production reliance. The preferred path is a backend-provided `map.static_map_url`. `googleMapsOpenUrl()` builds a plain search URL with no key. This is well-handled.

---

## 5. Client-side storage inventory

| Key | Contents | Sensitivity | Written by |
|---|---|---|---|
| `genie_auth_token_v1` | JWT bearer token | **High** | `localState.ts:110` |
| `genie_consumer_account_v1` | `{id, firstName, lastName, email, phone, membership, subscriptionStatus, vendorId}` | **High (PII)** | `localState.ts:85` |
| `genie_device_id` | Persistent device UUID | Medium (tracking id) | `sessionToken.ts:71` |
| `genie_session_token` | Xano session token | Medium | `sessionToken.ts:15` |
| `genie_session_id` | Numeric session id | Low | `sessionToken.ts:34` |
| `genie_external_user_id` | User/guest UUID | Medium | `sessionToken.ts:55` |
| `genie_saved_venues_v1` | Array of saved venue IDs | Low–Medium (taste profile) | `localState.ts:40` |
| `genie_geo_v1` | **`{lat, lng}` — precise coordinates** | **High** | `lib/genie/useGenieLocation.ts:51` |
| `genie_location_prompt_dismissed_v1` | `"1"` | None | `SinglePageGenieApp.tsx:1695` |
| `genie_vendor_onboarding_v1` | Vendor draft: business name, contact, email, phone | **High (PII)** | `lib/vendorOnboarding.ts:1` |
| `genie_signup_prompt_v1` | Prompt suppression state | None | `lib/signupPrompt.ts:1` |
| `genie-theme` | Theme preference | None | `providers.tsx` |

`clearConsumerSession()` (`localState.ts:117-121`) clears the auth token, account, and saved venues on logout — but **not** `genie_device_id`, `genie_external_user_id`, `genie_session_token`, `genie_geo_v1`, or `genie_vendor_onboarding_v1`. See finding **F-9**.

Additionally, **Cache Storage** holds a service-worker cache named `genie-shell-v2` (`public/sw.js`). See finding **F-2**.

---

## 6. Privacy findings — risks to investigate

> Framed as open questions and areas to examine, not as confirmed violations. Several require Xano-side verification.

### F-1 — Special-category data collected as ordinary preference tags

`community_tags` accepts documented values including `"Black-Owned"` and `"LGBTQ+ Friendly"`; `music_tags` includes `"R&B / Soul"`, `"Hip-Hop / Rap"`, `"AfroBeats"`. These are stored on a profile keyed to `device_id` and later to `external_user_id`, and per the API reference they feed ranking.

Under GDPR Art. 9, data revealing racial or ethnic origin or sexual orientation requires an Art. 9(2) condition — in a consumer app, realistically **explicit consent**, which is a higher bar than the implied consent a preference-picker UI usually carries. CPRA treats sexual orientation as sensitive personal information with a right to limit use. Even read as *venue attributes the user likes* rather than *attributes of the user*, the inference is direct enough that regulators have treated comparable signals as sensitive.

**To investigate:** Is the intake screen presented as explicit, separately-consented sensitive-data collection, or as a generic taste picker? Is there a documented lawful basis? Can a user clear `community_tags` independently of the rest of the profile? Are these tags included in any vendor-facing aggregate that could re-identify small cohorts?

**Related:** `bevy_bites_tags` (cuisine) can proxy religious dietary practice (halal, kosher); `typical_time: late_night` combined with venue category can proxy lifestyle.

### F-2 — Service worker caches authenticated API responses to disk

`public/sw.js:33-58` intercepts **every** GET request, and on any 200 response clones it into the `genie-shell-v2` Cache Storage bucket. There is no URL allowlist and no exclusion for `/api/`.

Qualifying GET endpoints that return personal data include `/api/user/saved-venues?external_user_id=…`, `/api/genie/social-profile?device_id=…`, `/api/genie/offers`, `/api/genie/redemptions`, `/api/auth/me`, and `/api/vendor/*`. These would be written to persistent on-device storage, survive logout (nothing clears the cache in `clearConsumerSession()`), and be readable by any script running on the origin.

**To investigate:** Confirm behavior in a running build with DevTools → Application → Cache Storage. Determine whether the intended design was app-shell-only caching (the `APP_SHELL` array suggests yes) and whether the catch-all `fetch` handler is an oversight.

### F-3 — `GET /api/stripe/sessions` lists checkout sessions with no authentication

`app/api/stripe/sessions/route.ts:32-49` proxies an unauthenticated `GET` to the Xano Stripe group's `sessions` collection. `GET /api/stripe/sessions/[id]` and `/line_items` are likewise unauthenticated. Stripe checkout session objects routinely contain `customer_email`, `customer_details` (name, address, phone), and amounts.

**To investigate:** What does Xano's `api:jQf3GatY/sessions` actually return to an unauthenticated caller — a list scoped to nothing, or an error? If it returns real sessions, this is an unauthenticated PII listing endpoint reachable from the public internet. This is the highest-priority item to verify.

### F-4 — Unauthenticated push-to-arbitrary-user endpoint

`app/api/genie/send-notification/route.ts` accepts `user_id`, `title`, `message`, `url` from any caller with no auth check and forwards to `genie/send_notification`. The committed API docs label this endpoint "Internal / Testing Only" (`latest_api_docs_today.md` §6.2), yet it is exposed as a public route in this app.

**To investigate:** Does Xano enforce auth on `genie/send_notification`? If not, any party can enumerate `user_id` integers and push arbitrary content — including phishing links via the `url` field — to real users' devices under the Social Bevy brand.

### F-5 — Identifier-as-authorization across the Genie API surface

A recurring pattern: routes authorize by *possessing an identifier* rather than by verifying a token. Affected routes:

| Route | Authorizes on |
|---|---|
| `GET /api/genie/social-profile` | `device_id` or `external_user_id` query param |
| `POST /api/genie/social-profile` | same, in body |
| `GET /api/genie/offers` | `external_user_id` query param |
| `GET /api/genie/redemptions` | `external_user_id` query param |
| `POST /api/genie/redeem-offer` | `external_user_id` in body |
| `GET /api/user/saved-venues` | `external_user_id` / `user_id` / `session_id` query params |
| `POST /api/user/save-venue`, `/unsave-venue` | same, in body |
| `POST /api/auth/delete-account` | `external_user_id` in body (token forwarded, not required) |
| `POST /api/genie/merge-guest-profile` | `device_id` + `external_user_id` in body |
| `POST /api/vendor/contact-info` | `external_user_id` in body |
| `GET /api/vendor/profile`, `/venue` | `external_user_id` query param |
| `GET /api/vendor/dashboard`, `/analytics` | `vendor_id` query param (token forwarded, not verified) |

The Next.js layer does not verify that the caller owns the identifier it supplies. If Xano also does not, these are IDOR endpoints: knowing or guessing an `external_user_id` yields another user's preference profile, saved venues, offers, and redemption history — and, via `delete-account`, the ability to delete their account.

Mitigating factor: `external_user_id` values are UUIDs, which are not enumerable. Aggravating factor: they are also placed in `localStorage`, passed in URL query strings (where they land in server access logs and `Referer` headers), and — for the influencer flow — potentially in shareable deep links.

**To investigate:** For each endpoint above, confirm whether Xano independently validates the bearer token against the supplied identifier. Note that `app/api/auth/delete-account/route.ts` explicitly documents "Auth is by `external_user_id` (passed in the request body)" — this looks like a known design decision worth revisiting, given it governs account deletion.

### F-6 — Password hashes and PII in a build-cache file

`app/lib/server/apiStore.ts:70-76` writes `users` records — including `password_hash`, `email`, `phone`, `first_name`, `last_name` — to `.next/cache/genie-api-store.json`.

Concerns: `.next/` is a build artifact directory, not a data directory; on Vercel the filesystem is ephemeral, so writes are silently lost (data-integrity issue) while on any persistent host the file survives with no encryption at rest; and build caches are frequently uploaded to CI artifact stores. The path is covered by the `/.next/` gitignore rule, so it is not committed.

**To investigate:** Does any live traffic still write to this store? `getAuthenticatedUser()` only reads, and the signup/login routes now go to Xano — so the store may be write-dead and read-only against stale data. If so, the whole module plus `authToken.ts` is dead code holding a copy of old user records, and deleting it is both a cleanup and a data-minimization win.

### F-7 — Legacy auth code path still gates a live route

`app/api/genie/message/route.ts:28` calls `getAuthenticatedUser(request)`, which verifies a **locally-issued** HMAC token against `JWT_SECRET` and looks the user up in the local JSON store. Live tokens come from Xano's magic-link flow and will not verify here, so `auth` is presumably always `null` in production and the route falls back to client-supplied `external_user_id` and `user_name`.

**To investigate:** Confirm whether this branch ever succeeds in production. If it does not, the route trusts client-supplied identity fields unconditionally — meaning the `user_name` and `external_user_id` attached to every Genie query are whatever the client claims. If it does succeed, there are two parallel auth systems with different secrets.

### F-8 — Consent basis for marketing capture

Three flows collect contact details for what appear to be marketing purposes with no visible consent language in the code:

- `POST /api/worldcup/capture` — `acquisition_source: "worldcup_houston"`, an explicit acquisition-funnel label.
- `trackWeeklySignup(contact)` (`analytics.ts:100`) — places an email or phone number into an **analytics** metadata blob rather than a contact record.
- Magic-link signup, which necessarily creates an email relationship.

**To investigate:** Is there an opt-in checkbox or disclosure at each capture point? Under CAN-SPAM, commercial email needs a functioning unsubscribe; under GDPR/PECR, marketing email to EU/UK recipients needs prior opt-in. The `contact` field flowing into analytics also mixes identity data into a telemetry store, which complicates any deletion request that targets "analytics data."

### F-9 — Incomplete logout and no client-side data reset

`clearConsumerSession()` (`localState.ts:117-121`) clears three keys. Left behind on the device after logout: `genie_device_id`, `genie_external_user_id`, `genie_session_token`, `genie_session_id`, `genie_geo_v1` (precise coordinates), `genie_vendor_onboarding_v1` (business contact PII), `genie_signup_prompt_v1`, and the entire `genie-shell-v2` Cache Storage bucket.

Because `genie_device_id` persists, the next user of a shared device continues accumulating signals against the previous user's device profile — and if they sign up, `merge_guest_profile` attaches the previous user's guest history to the new account.

**To investigate:** Is logout expected to reset device identity? On shared or public devices, is the cross-user linkage acceptable?

### F-10 — Account deletion is a soft delete

`app/api/auth/delete-account/route.ts` proxies to `genie/ep_delete_account_dev`, documented in-file as a **soft delete**. GDPR Art. 17 and CPRA §1798.105 both contemplate actual erasure, subject to enumerated exceptions.

**To investigate:** What does the soft delete actually do — flag the row, or purge? Does it cascade to `genie_behavior_signals`, the social profile, `genie_user_venue_interaction`, analytics events, the OneSignal subscription, and Stripe customer records? Is there a defined retention period after which the soft-deleted record is hard-deleted? Is deletion propagated to SendGrid and OneSignal?

### F-11 — Unrestricted remote image hosts

`next.config.ts:7-16` sets `images.remotePatterns` to hostname `**` over **both** `https` and `http`.

Two consequences: (a) any venue image URL in the Xano catalog causes the user's browser to make a request to an arbitrary third-party host, leaking IP address, User-Agent, and `Referer`; and (b) the Next.js image optimizer will fetch and proxy **any** URL supplied to it, which is a server-side request forgery surface against internal network addresses. Allowing plain `http` also means images can be served over cleartext, breaking the page's HTTPS guarantees.

**To investigate:** Which hosts do catalog images actually come from? Can the pattern be narrowed to those, https-only?

### F-12 — Public redemption verification discloses member names

`app/verify/[token]/page.tsx` and `app/api/genie/verify-redemption/[token]/route.ts` expose an **unauthenticated** endpoint that, given a redemption token, returns `{ valid, offer_title, redeemed_at, verified_at, member_name, vendor_id }`. The API reference marks §5.3 "Public — No Auth", and `verify_offer_base_url` is `https://genie.socialbevy.com/verify/` — the URL is designed to be scanned by venue staff from a QR code.

Disclosing `member_name` to whoever holds the token is intentional (staff need to match the person to the redemption). The risk is scope: tokens in URLs get logged, screenshotted, and shared, and the endpoint has no rate limiting visible here.

**To investigate:** Are redemption tokens single-use and short-lived? Is `member_name` a first name only, or full name? Is there rate limiting to prevent token-space probing?

### F-13 — Admin surface with no authentication in this app

`app/api/admin/city-intelligence/route.ts` takes `city`, `days_back`, `worldcup_only` and proxies to Xano `admin/city-intelligence` with **no auth check and no token forwarding**. `app/admin/city-intelligence/page.tsx` renders `CityIntelligenceDashboard` with no auth gate. `production_readiness_report.md` §10 independently flags "Admin endpoints have no auth guard."

`genie_api_reference.md` §12 lists `ADMIN_SECRET` as "Admin portal password (Vercel env var — not Xano)", but **`ADMIN_SECRET` does not appear anywhere in this codebase** — the only env vars referenced are the twelve listed in §7 below.

**To investigate:** What does the city-intelligence aggregate contain — is it truly aggregate, or does it include per-user rows? The API reference documents nine other admin endpoints (user lists, membership overrides, redemption lists) that are not integrated here; confirm they are not reachable through some other path.

### F-14 — Precise coordinates written to the browser console

`SinglePageGenieApp.tsx:972-978` logs `"NEAR ME DEBUG:"` with `lat` and `lng` on every located query. It is unconditional — not gated on `NODE_ENV`. Console output is visible to anyone with the device, captured by some browser-extension and error-reporting tooling, and persists in the console buffer.

### F-15 — Third-party service worker with no integrity pinning

`public/OneSignalSDKWorker.js` and `public/OneSignalSDKUpdaterWorker.js` each consist of a single `importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js")`. Service workers run with broad privileges over the origin — intercepting requests, reading caches, persisting across sessions. `importScripts` does not support subresource integrity, so this is unpinned remote code execution scoped to the origin. This is the standard OneSignal integration, so the risk is inherited rather than introduced, but it should be a conscious acceptance.

### F-16 — OneSignal initializes before any consent signal

`NotificationsBoot` is mounted in `Providers` (`app/providers.tsx`), which wraps the entire app in the root layout. The SDK therefore initializes on **every page load for every visitor**, including first-time anonymous visitors, before any interaction. `OneSignal.init()` sets its own identifiers and begins reporting to OneSignal even when the user never grants push permission — `promptPush()` is a separate, later call.

In an ePrivacy/GDPR context, this is non-essential third-party storage set before consent. Worth checking against whatever cookie/consent posture the product intends.

### F-17 — Undisclosed voice processor

As noted in §3.2, Web Speech API transcription in Chromium browsers sends audio to Google. Nothing in the UI or code indicates this to the user. If a privacy policy enumerates sub-processors, Google's speech service likely belongs on it.

### F-18 — Identifiers in URL query strings

`external_user_id`, `device_id`, `session_token`, `vendor_id`, and redemption tokens are passed as **GET query parameters** across many routes (`/api/genie/offers`, `/redemptions`, `/social-profile`, `/api/user/saved-venues`, `/api/genie/prompt`, `/api/vendor/*`, `/api/genie/verify-redemption/[token]`). Query strings are written to server access logs, CDN logs, and browser history, and can leak via `Referer` on outbound navigation. `session_token` in particular is a credential and is passed this way by `/api/genie/prompt`.

### F-19 — Pre-consent profiling and retroactive identification

Behavioral signals accumulate against `genie_device_id` from first app open (`init_device` is called on every launch per API reference §7.1), before any account, consent dialog, or privacy notice interaction. `merge_guest_profile` then binds that entire history to the account at signup.

This is a legitimate and common product pattern, but it means the "anonymous" phase is only pseudonymous, and the pseudonymity is deliberately reversible. Under GDPR, the pre-signup collection needs its own lawful basis; it cannot ride on the consent obtained at signup, because the collection precedes it.

### F-20 — No privacy policy, terms, or consent UI in the codebase

There is no `/privacy`, `/terms`, cookie banner, consent manager, or data-rights request flow anywhere in `app/`. The only user-facing data-rights affordance is the account-deletion button. For a product collecting precise location, voice, sensitive-category preferences, and behavioral profiles, and operating in California and Texas (Texas DPSA took effect July 2024, with no small-business revenue threshold), this is the most visible structural gap.

---

## 7. Secrets and configuration

Env vars referenced in code:

| Variable | Used in | Client-exposed |
|---|---|---|
| `XANO_BASE_URL`, `XANO_GENIE_DEV_BASE`, `XANO_AUTH_BASE`, `XANO_STRIPE_BASE`, `XANO_GENIE_VENUES_URL` | `xanoProxy.ts`, `xanoCatalog.ts` | No |
| `JWT_SECRET` | `server/authToken.ts` | No |
| `OPENAI_API_KEY` | `lib/openaiClient.ts` (never invoked) | No |
| `APP_BASE_URL` | `subscription/create` | No |
| `NEXT_PUBLIC_APP_BASE_URL` | `subscription/create` | **Yes** |
| `NEXT_PUBLIC_XANO_BASE_URL` | `lib/genie/xano.ts` | **Yes** |
| `NEXT_PUBLIC_GOOGLE_MAPS_KEY` | `lib/maps.ts`, `SinglePageGenieApp.tsx:183` | **Yes** |
| `NEXT_PUBLIC_ENABLE_CLIENT_STATIC_MAPS` | `lib/maps.ts` | **Yes** |
| `NODE_ENV` | — | — |

Observations:
- **No secrets are committed.** `.gitignore` covers `.env*`, `*.pem`, and `/.next/`. Good.
- **There is no `.env.example`**, so the required configuration is undocumented for a new developer. The `README.md` mentions only `NEXT_PUBLIC_XANO_API_BASE_URL`, which **does not exist in the code** — the real name is `NEXT_PUBLIC_XANO_BASE_URL`.
- `NEXT_PUBLIC_GOOGLE_MAPS_KEY` is inlined into the client bundle by design. It must be restricted by HTTP referrer and by API in Google Cloud Console, or it is billable by anyone who reads the bundle.
- All five Xano base URLs have **hardcoded production fallbacks** in source. Losing an env var silently routes to production rather than failing loudly.
- `genie_api_reference.md` §12 documents live Stripe (`sk_live_…`), OneSignal REST, SendGrid, and JWT secrets **by name and partial value**, and the file is marked "Confidential" yet is committed to the repo. No full secret values are present, but price IDs and the OneSignal App ID are.

---

## 8. What is handled well

Worth stating plainly, since the findings list is long:

- **No third-party analytics or ad SDKs.** No GA, Segment, Mixpanel, Meta Pixel, or TikTok Pixel. All telemetry is first-party to Xano. This is unusual and a real privacy advantage.
- **Location consent is intent-gated.** The app explicitly refuses to auto-prompt and only asks after near-me intent, with a persistent dismissal. The code comments show this was a deliberate decision.
- **City beats coordinates.** When a user names a city, coords are dropped from the request entirely (`includeCoords: false`) — genuine data minimization.
- **Voice transcripts require confirmation** before submission rather than auto-submitting.
- **No card data touches the app.** Stripe Checkout is fully hosted and orchestrated backend-side.
- **Passwordless auth** eliminates an entire class of credential-storage risk on the live path.
- **Server-side proxy pattern** keeps Xano credentials and base URLs off the client for every route except the unused `lib/genie/xano.ts`.
- **Client-side static maps are gated off by default**, with a comment explaining the gate exists to prevent production reliance.
- **Fire-and-forget telemetry never blocks or fails user actions** — analytics and interaction-logging routes swallow errors and return success.
- **Google Fonts are self-hosted at build time** via `next/font`, avoiding the runtime-request issue that has drawn regulatory attention in the EU.

---

## 9. Suggested order of investigation

1. **F-3** — verify what `GET /api/stripe/sessions` returns unauthenticated. Fastest to check, largest blast radius if wrong.
2. **F-5** — audit Xano-side authorization for the identifier-keyed endpoints, starting with `delete-account` and `social-profile`.
3. **F-4** — confirm whether `send_notification` is auth-gated in Xano.
4. **F-2** — open DevTools → Cache Storage on a logged-in session and see what `genie-shell-v2` actually holds.
5. **F-1** — decide the lawful basis and consent surface for `community_tags` before scaling beyond Houston.
6. **F-20** — publish a privacy policy that matches what §3 of this document describes.
7. **F-6 / F-7** — determine whether `apiStore.ts` and `authToken.ts` are dead, and delete them if so.
8. **F-13** — put an auth guard on the admin route and page.
9. **F-14, F-11, F-18** — mechanical cleanups.

---

*Generated from static analysis of the repository at commit `e61fd69`. No code was executed and no live endpoint was called. All findings are hypotheses to verify, not confirmed defects.*
