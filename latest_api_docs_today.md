# Social Bevy / Genie — API Reference (Latest)

> **Complete endpoint reference with cURL examples — April 10, 2026 — All endpoints tested and confirmed working**

---

## Base URLs

| Group | Base URL |
|-------|----------|
| **Genie** | `https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e` |
| **Auth (Magic Link)** | `https://xwpg-kuah-brlj.n7d.xano.io/api:dRDS80y8` |

> ⚠️ **There are TWO different base URLs.** Auth endpoints use the Magic Link URL. Using the wrong base URL will cause **404 errors**.

---

## Complete Endpoint Index

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `api:dRDS80y8/auth/verify_email/signup` | Request magic link / create account |
| `POST` | `api:dRDS80y8/auth/verify_email/magic_login` | Exchange token → authToken + user details |
| `POST` | `api:pgMKWi2e/genie/guest_session` | Create guest session → external_user_id |
| `POST` | `api:pgMKWi2e/genie/ep_handle_message_dev` | Core Genie query → venue recommendations |
| `GET`  | `api:pgMKWi2e/genie/vendor_search` | Search venues by name (query + city params) |
| `POST` | `api:pgMKWi2e/genie/checkout_vibee` | V.I.Bee Stripe checkout → redirect URL |
| `POST` | `api:pgMKWi2e/genie/checkout_vendor_plan` | Vendor plan Stripe checkout → redirect URL |
| `POST` | `api:pgMKWi2e/genie/vendor_onboarding_start` | Multi-step vendor onboarding |
| `GET`  | `api:pgMKWi2e/genie/vendor_dashboard_v1` | **NEW** — Vendor profile, plan status, and offers |
| `POST` | `api:pgMKWi2e/genie/vendor_create_offer` | **NEW** — Create offer (Pro vendors only) |
| `POST` | `api:pgMKWi2e/genie/register_push_token` | Register OneSignal push token |
| `POST` | `api:pgMKWi2e/genie/send_notification` | Send push notification (internal/testing only) |
| `POST` | `api:pgMKWi2e/genie/notification_opened` | Mark notification as opened |
| `POST` | `api:pgMKWi2e/stripe/webhook` | Stripe → V.I.Bee activation (Stripe-facing, not frontend) |
| `POST` | `api:pgMKWi2e/stripe/vendor_webhook` | Stripe → Vendor plan activation (Stripe-facing, not frontend) |

---

## 1. Auth Endpoints

> **Base URL:** `https://xwpg-kuah-brlj.n7d.xano.io/api:dRDS80y8`

Genie uses **Magic Link authentication** — no passwords. Same endpoint handles both new signups and returning users.

---

### 1.1 Request Magic Link / Signup

Sends a magic link email. Creates a `genie_user` if the email is new. Returns a success message only — no token yet.

**`POST`** `https://xwpg-kuah-brlj.n7d.xano.io/api:dRDS80y8/auth/verify_email/signup`

**Request Body**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `email` | string | **Yes** | User email address |
| `first_name` | string | No | Only required for new users |
| `last_name` | string | No | Only required for new users |

**Response**

```json
{
  "Message": "Check your email for your Genie access link"
}
```

**cURL**

```bash
# New user signup
curl -X POST \
  https://xwpg-kuah-brlj.n7d.xano.io/api:dRDS80y8/auth/verify_email/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "first_name": "John",
    "last_name": "Smith"
  }'

# Returning user login (email only — no name needed)
curl -X POST \
  https://xwpg-kuah-brlj.n7d.xano.io/api:dRDS80y8/auth/verify_email/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com"
  }'
```

---

### 1.2 Magic Login (Verify Token)

Exchange the magic token from the `?token=` email link for an `authToken` and full user details. Call on Home Screen load when a token is detected in the URL — no separate `/verified` page needed.

**`POST`** `https://xwpg-kuah-brlj.n7d.xano.io/api:dRDS80y8/auth/verify_email/magic_login`

**Request Body**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `magic_token` | string | **Yes** | Token from `?token=` query param in the email link |

**Response**

```json
{
  "authToken": "eyJhbGci...",
  "user_id": 16,
  "external_user_id": "85ee5e8a-9a7f-4aaa-9328-67ee4fbe6b8c",
  "email": "user@example.com",
  "verified": true,
  "membership_active": false
}
```

> 📌 **Store both `external_user_id` and `authToken` in `localStorage`.** Use `external_user_id` for all Genie API calls. Strip the token from the URL immediately after exchange using `window.history.replaceState`.

**cURL**

```bash
curl -X POST \
  https://xwpg-kuah-brlj.n7d.xano.io/api:dRDS80y8/auth/verify_email/magic_login \
  -H "Content-Type: application/json" \
  -d '{
    "magic_token": "TOKEN_FROM_EMAIL_LINK"
  }'
```

---

## 2. Genie Core Endpoints

> **Base URL:** `https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e`

---

### 2.1 Create Guest Session

Creates a guest session before any Genie query. Returns `external_user_id` and `session_token` — store both and pass them on every subsequent call.

**`POST`** `https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e/genie/guest_session`

**Request Body**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `channel` | string | **Yes** | `"web"` or `"mobile"` |

**Response**

```json
{
  "session_token": "a30fd548-bd96-4700-94e1-d55f60246942",
  "session_id": 96,
  "external_user_id": "a30fd548-bd96-4700-94e1-d55f60246942"
}
```

**cURL**

```bash
curl -X POST \
  https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e/genie/guest_session \
  -H "Content-Type: application/json" \
  -d '{
    "channel": "web"
  }'
```

---

### 2.2 Handle Message — Core Genie Query

Main Genie endpoint. Returns venue recommendations. Add `lat`/`lng` for near-me queries. Always use the latest `session_token` returned in each response.

**`POST`** `https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e/genie/ep_handle_message_dev`

**Request Body**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `message` | string | **Yes** | User query e.g. `"brunch in Houston"` |
| `channel` | string | **Yes** | `"web"` or `"mobile"` |
| `external_user_id` | string | **Yes** | From `guest_session` or `magic_login` response |
| `session_token` | string | **Yes** | From `guest_session` — always send the latest returned value |
| `city_context` | string | No | e.g. `"Houston"` |
| `lat` | decimal | No | User latitude — required for near-me queries |
| `lng` | decimal | No | User longitude — required for near-me queries |
| `radius_meters` | integer | No | Search radius — defaults to `2500` |

**Response Keys**

```json
{
  "reply": "...",
  "top_venues": [],
  "more_venues": [],
  "needs_location": false,
  "use_xano": true,
  "session_id": 96,
  "session_token": "...",
  "reply_mode": "has_results",
  "filters": {}
}
```

**`reply_mode` values**

| Value | Behavior |
|-------|----------|
| `has_results` | Show venue cards (`use_xano = true`) |
| `supported_no_results` | City supported but no DB matches — show `reply` text only |
| `city_missing` | Ask user for city — show `reply` as prompt |
| `city_unsupported` | City not in DB — show AI reply only |
| `ai_fallback` | AI generated — show reply only |

**cURL — Standard query**

```bash
curl -X POST \
  https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e/genie/ep_handle_message_dev \
  -H "Content-Type: application/json" \
  -d '{
    "message": "brunch in Houston",
    "channel": "web",
    "external_user_id": "YOUR_EXTERNAL_USER_ID",
    "session_token": "YOUR_SESSION_TOKEN",
    "city_context": "Houston",
    "radius_meters": 5000
  }'
```

**cURL — Near-me query (with coordinates)**

```bash
curl -X POST \
  https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e/genie/ep_handle_message_dev \
  -H "Content-Type: application/json" \
  -d '{
    "message": "brunch near me",
    "channel": "web",
    "external_user_id": "YOUR_EXTERNAL_USER_ID",
    "session_token": "YOUR_SESSION_TOKEN",
    "lat": 29.7604,
    "lng": -95.3698,
    "radius_meters": 5000
  }'
```

---

### 2.3 Vendor Search (Autosuggest)

Search venues by name for the vendor claim flow. Call while the vendor types.

**`GET`** `https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e/genie/vendor_search`

**Query Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | **Yes** | Business name search text |
| `city` | string | No | Defaults to Houston |

**Response**

```json
{
  "count": 1,
  "results": [
    {
      "id": 343,
      "venue_name": "Bungalow",
      "address": "...",
      "city": "Houston"
    }
  ]
}
```

**cURL**

```bash
curl "https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e/genie/vendor_search?query=Bungalow&city=Houston"
```

---

## 3. Checkout Endpoints

> **Base URL:** `https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e`

---

### 3.1 V.I.Bee Checkout

Creates a Stripe checkout session for the V.I.Bee membership at $2.99/month. Redirect user to the returned `checkout_url`.

**`POST`** `https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e/genie/checkout_vibee`

**Request Body**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `external_user_id` | string | **Yes** | User identifier |
| `success_url` | string | **Yes** | Redirect on payment success |
| `cancel_url` | string | **Yes** | Redirect if payment cancelled |

**Response**

```json
{
  "checkout_url": "https://checkout.stripe.com/c/pay/cs_live_...",
  "session_id": "cs_live_..."
}
```

**cURL**

```bash
curl -X POST \
  https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e/genie/checkout_vibee \
  -H "Content-Type: application/json" \
  -d '{
    "external_user_id": "YOUR_EXTERNAL_USER_ID",
    "success_url": "https://genie.socialbevy.com/vibee/success",
    "cancel_url": "https://genie.socialbevy.com/account"
  }'
```

---

### 3.2 Vendor Plan Checkout ✏️ Updated Apr 10

> ⚠️ **Fix applied April 10:** `email` field removed from payload. `success_url` and `cancel_url` updated to `genie.socialbevy.com`.

**`POST`** `https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e/genie/checkout_vendor_plan`

**Request Body**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `vendor_id` | integer | **Yes** | Vendor ID |
| `plan_type` | string | **Yes** | `"founding_partner"` (subscription) or `"boost"` (one-time) |
| `boost_tier` | string | No | `"1999"` \| `"3999"` \| `"5999"` — required if `plan_type` is `"boost"` |
| `success_url` | string | **Yes** | Redirect on payment success |
| `cancel_url` | string | **Yes** | Redirect if payment cancelled |

**Response**

```json
{
  "checkout_url": "https://checkout.stripe.com/c/pay/cs_live_...",
  "session_id": "cs_live_...",
  "plan_type": "founding_partner",
  "mode": "subscription"
}
```

**cURL — Founding Partner subscription ($37/month)**

```bash
curl -X POST \
  https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e/genie/checkout_vendor_plan \
  -H "Content-Type: application/json" \
  -d '{
    "vendor_id": 1,
    "plan_type": "founding_partner",
    "success_url": "https://genie.socialbevy.com/vendor/success",
    "cancel_url": "https://genie.socialbevy.com/vendor"
  }'
```

**cURL — Boost one-time purchase**

```bash
curl -X POST \
  https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e/genie/checkout_vendor_plan \
  -H "Content-Type: application/json" \
  -d '{
    "vendor_id": 1,
    "plan_type": "boost",
    "boost_tier": "1999",
    "success_url": "https://genie.socialbevy.com/vendor/success",
    "cancel_url": "https://genie.socialbevy.com/vendor"
  }'
```

> `boost_tier` values: `"1999"` | `"3999"` | `"5999"`

---

## 4. Vendor Onboarding

> **Base URL:** `https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e`

Multi-step onboarding via a single endpoint. The `step` field controls the current stage. **Always use `vendor_id` from the previous response — never hardcode it.**

**`POST`** `https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e/genie/vendor_onboarding_start`

### Step 1 — Search for existing business

```bash
curl -X POST \
  https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e/genie/vendor_onboarding_start \
  -H "Content-Type: application/json" \
  -d '{
    "step": "search",
    "business_name": "The Breakfast Klub"
  }'
```

### Step 2 — Contact info

Use `vendor_id` and `onboarding_id` from the Step 1 response.

```bash
curl -X POST \
  https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e/genie/vendor_onboarding_start \
  -H "Content-Type: application/json" \
  -d '{
    "step": "contact",
    "vendor_id": 7,
    "onboarding_id": 7,
    "first_name": "John",
    "last_name": "Smith",
    "email": "john@mybusiness.com",
    "phone": "7135550000"
  }'
```

### Step 3 — Confirm match

```bash
curl -X POST \
  https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e/genie/vendor_onboarding_start \
  -H "Content-Type: application/json" \
  -d '{
    "step": "confirm",
    "vendor_id": 7,
    "onboarding_id": 7,
    "confirmed": true
  }'
```

**Response (all steps)**

```json
{
  "vendor_id": 7,
  "onboarding_id": 7,
  "current_step": "confirm"
}
```

> ⚠️ **Always use the `vendor_id` returned in the response for the next step. Do NOT hardcode vendor IDs.**

---

## 5. Vendor Dashboard Endpoints 🆕 New Apr 10

> **Base URL:** `https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e`

---

### 5.1 Vendor Dashboard `NEW`

Returns full vendor profile, plan status, and all active offers. `vendor_id` is a **query parameter** — not in the request body.

**`GET`** `https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e/genie/vendor_dashboard_v1`

**Query Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `vendor_id` | integer | **Yes** | Vendor ID |

**Response**

```json
{
  "vendor_id": 1,
  "business_name": "Your Business Name",
  "email": "owner@yourbusiness.com",
  "plan_selected": "founding_partner",
  "is_live": true,
  "plan_selected_at": 1775769661716,
  "onboarding_completed": false,
  "is_pro": true,
  "offers": [
    {
      "id": 3,
      "title": "Happy Hour Special — 20% Off All Drinks",
      "offer_type": "happy_hour",
      "member_only": true,
      "active": true,
      "redeem_instructions": "Show your Genie V.I.Bee membership",
      "schedule_json": { "discount_value": "20% off" }
    }
  ],
  "offer_count": 1
}
```

> 📌 Use `is_pro` to show/hide Pro features in the vendor dashboard UI. Use `offer_count` to show offer badge counts.

**cURL**

```bash
curl "https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e/genie/vendor_dashboard_v1?vendor_id=1"
```

---

### 5.2 Vendor Create Offer `NEW`

Creates a new offer for a Pro Genie vendor. Only vendors with `plan_selected = founding_partner` and `is_live = true` can create offers. Returns `401` if the vendor is not Pro.

**`POST`** `https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e/genie/vendor_create_offer`

**Request Body**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `vendor_id` | integer | **Yes** | Vendor ID |
| `title` | string | **Yes** | Offer title |
| `description` | string | **Yes** | Offer description |
| `offer_type` | string | **Yes** | See valid values below |
| `discount_value` | string | No | e.g. `"20% off"` |
| `redeem_instructions` | string | No | How to redeem at the venue |
| `link_url` | string | No | Deep link URL |
| `redemption_limit` | integer | No | Max number of redemptions |
| `vibee_only` | boolean | No | `true` to restrict to V.I.Bee members only |

**Valid `offer_type` values**

| Value | Description |
|-------|-------------|
| `happy_hour` | Happy hour deals |
| `brunch` | Brunch specials |
| `perk` | General member perks |
| `weekly_special` | Weekly recurring deals |
| `drink_special` | Drink-specific offers |
| `food_special` | Food-specific offers |
| `event_access` | Event entry or access |
| `vip_only` | VIP exclusive offers |
| `limited_time` | Time-limited deals |
| `experience` | Experience-based offers |
| `group_offer` | Group deals |
| `late_night` | Late night specials |
| `other` | Other offer types |

**Response — success**

```json
{
  "success": true,
  "offer_id": 9
}
```

**Response — not a Pro vendor (401)**

```json
{
  "code": "ERROR_CODE_UNAUTHORIZED",
  "message": "Vendor must be a Pro Genie Vendor to create offers."
}
```

**cURL**

```bash
curl -X POST \
  https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e/genie/vendor_create_offer \
  -H "Content-Type: application/json" \
  -d '{
    "vendor_id": 1,
    "title": "Happy Hour Special — 20% Off All Drinks",
    "description": "V.I.Bee members get 20% off all drinks every Friday 4-7pm",
    "offer_type": "happy_hour",
    "discount_value": "20% off",
    "redeem_instructions": "Show your Genie V.I.Bee membership at the bar",
    "link_url": "https://genie.socialbevy.com",
    "redemption_limit": 100,
    "vibee_only": true
  }'
```

---

## 6. Push Notification Endpoints

> **Base URL:** `https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e`
>
> **OneSignal App ID:** `2b0988a9-9a1e-4039-9131-e4859ea641e2`

---

### 6.1 Register Push Token

Register a OneSignal player ID after the user grants push permission. `onesignal_player_id` comes from `OneSignal.getSubscriptionId()`.

> 📌 Trigger the permission prompt **after** the Decision screen renders with results — not on app load.

**`POST`** `https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e/genie/register_push_token`

**Request Body**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `external_user_id` | string | **Yes** | From `guest_session` or `magic_login` — stored in `localStorage` |
| `onesignal_player_id` | string | **Yes** | UUID from `OneSignal.getSubscriptionId()` |
| `channel` | string | **Yes** | `"web"` |

**Response**

```json
{
  "success": true,
  "message": "Push token registered successfully",
  "user_id": 16,
  "channel": "web"
}
```

**cURL**

```bash
curl -X POST \
  https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e/genie/register_push_token \
  -H "Content-Type: application/json" \
  -d '{
    "external_user_id": "YOUR_EXTERNAL_USER_ID",
    "onesignal_player_id": "UUID_FROM_ONESIGNAL_SDK",
    "channel": "web"
  }'
```

---

### 6.2 Send Notification (Internal / Testing Only)

Send a push notification manually. Uses internal `user_id` — not `external_user_id`. Scheduled notifications fire automatically from Xano.

**`POST`** `https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e/genie/send_notification`

**Request Body**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `user_id` | integer | **Yes** | Internal user ID (not `external_user_id`) |
| `notification_type` | string | **Yes** | `"vibe_check"` \| `"whats_hot"` \| `"personalized"` |
| `title` | string | **Yes** | Notification title |
| `message` | string | **Yes** | Notification body text |
| `url` | string | **Yes** | Deep link URL |

**Response**

```json
{
  "success": true,
  "notification_type": "vibe_check",
  "status": 200
}
```

**cURL**

```bash
curl -X POST \
  https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e/genie/send_notification \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": 16,
    "notification_type": "vibe_check",
    "title": "What'\''s the move tonight?",
    "message": "Ask Genie for the best spots near you.",
    "url": "https://genie.socialbevy.com"
  }'
```

---

### 6.3 Notification Opened

Mark a notification as opened when the user taps it. Call on Home Screen mount when `notification_id` is present in the URL.

**`POST`** `https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e/genie/notification_opened`

**Request Body**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `notification_id` | integer | **Yes** | From `?notification_id=` URL query param |

**Response**

```json
{
  "success": true,
  "notification_id": 1
}
```

**cURL**

```bash
curl -X POST \
  https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e/genie/notification_opened \
  -H "Content-Type: application/json" \
  -d '{
    "notification_id": 1
  }'
```

---

## 7. Stripe Webhooks

> ⛔ **Called by Stripe automatically — do NOT call from the frontend.** Register in Stripe Dashboard → Developers → Webhooks.

| Webhook URL | Event | Effect |
|-------------|-------|--------|
| `https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e/stripe/webhook` | `checkout.session.completed` | `membership_active = true`, `membership_plan = vibee` |
| `https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e/stripe/vendor_webhook` | `checkout.session.completed` | `plan_selected = plan_type`, `is_live = true` |

---

## 8. Postman Environment Variables

| Variable | Value |
|----------|-------|
| `genieBaseUrl` | `https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e` |
| `authBaseUrl` | `https://xwpg-kuah-brlj.n7d.xano.io/api:dRDS80y8` |
| `vendorId` | `1` |
| `externalUserId` | `85ee5e8a-9a7f-4aaa-9328-67ee4fbe6b8c` |

---

## 9. Key Integration Rules

| Rule | Detail |
|------|--------|
| **Wrong base URL** | Auth = `api:dRDS80y8`, everything else = `api:pgMKWi2e`. Wrong URL → 404 |
| **Always refresh session_token** | Use the `session_token` from the latest response — not a cached one |
| **external_user_id source** | From `guest_session` (guests) or `magic_login` (authenticated). Store in `localStorage` |
| **Never hardcode vendor_id** | Always use `vendor_id` returned from onboarding step response |
| **Strip tokens from URL** | After `magic_login` and after `notification_id` tracking, call `window.history.replaceState({}, document.title, '/')` |
| **Push permission timing** | Prompt after first successful result — not on app launch |
| **send_notification** | Uses internal `user_id`, not `external_user_id`. For testing only |
| **Stripe webhooks** | Registered in Stripe Dashboard — never called from frontend |
| **vendor_create_offer** | Pro vendors only — `plan_selected = founding_partner` and `is_live = true`. Returns 401 otherwise |
| **vendor_dashboard_v1** | `vendor_id` is a query param, not a body field |

---

## 10. Changelog

| Date | Endpoint | Change |
|------|----------|--------|
| Apr 10, 2026 | `checkout_vendor_plan` | ✏️ Removed `email` field; updated `success_url` and `cancel_url` to `genie.socialbevy.com` |
| Apr 10, 2026 | `vendor_dashboard_v1` | 🆕 New endpoint — vendor profile, plan status, and offers |
| Apr 10, 2026 | `vendor_create_offer` | 🆕 New endpoint — create offer (Pro vendors only) |

---

*Social Bevy / Genie — API Reference — April 10, 2026 — All endpoints tested and confirmed working*
