# Genie / Social Bevy — Complete API Reference
> **Version:** v8.0 · **April 2026** · **35 endpoints** · All confirmed working · Confidential  
> This is the single source of truth for all frontend development, vendor integrations, and admin tooling.

---

## Base URLs

| API Group | Base URL | Purpose |
|-----------|----------|---------|
| `Genie_Dev (#9)` | `https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e` | All Genie endpoints (core, vendor, offers, admin, social) |
| `Magic Link + Email (#4)` | `https://xwpg-kuah-brlj.n7d.xano.io/api:dRDS80y8` | User auth — signup, magic link, login |
| `Stripe Checkout (#2)` | Handled via Genie_Dev endpoints | Checkout sessions called through Genie backend |

> **Global rules:** All endpoints use HTTPS. CORS enabled (`*`). All POST/PATCH requests require `Content-Type: application/json`.

---

## Table of Contents

1. [Authentication](#1-authentication)
2. [Core Genie](#2-core-genie)
3. [Checkout](#3-checkout)
4. [Vendor](#4-vendor)
5. [Offers & Redemption](#5-offers--redemption)
6. [Push Notifications](#6-push-notifications)
7. [Social Learning](#7-social-learning)
8. [Stripe Webhooks](#8-stripe-webhooks)
9. [Admin](#9-admin)
10. [Quick Reference — All 35 Endpoints](#10-quick-reference--all-35-endpoints)
11. [Error Codes](#11-error-codes)
12. [Environment Variables](#12-environment-variables)
13. [Frontend Integration Guide](#13-frontend-integration-guide)

---

## 1. Authentication

Magic link passwordless auth. No passwords stored. Users receive a one-time link via email.

### 1.1 Request Magic Link / Signup

```
POST https://xwpg-kuah-brlj.n7d.xano.io/api:dRDS80y8/auth/verify_email/signup
```

Sends a magic link email. Creates a new `genie_user` if the email does not exist.

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | Yes | User email address |
| `first_name` | string | No | User first name |
| `last_name` | string | No | User last name |

```json
// Request
{
  "email": "user@example.com",
  "first_name": "Jordan",
  "last_name": "Smith"
}

// Response 200
{
  "Message": "Check your email for your Genie access link"
}
```

---

### 1.2 Magic Login

```
POST https://xwpg-kuah-brlj.n7d.xano.io/api:dRDS80y8/auth/verify_email/magic_login
```

Exchange the magic token from the email link for a session `authToken` and full user profile.  
Call this from the `/auth/verify` page when the `?token=` param is present in the URL.

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `magic_token` | string | Yes | Token extracted from magic link URL `?token=` |

```json
// Request
{
  "magic_token": "TOKEN_FROM_EMAIL_LINK"
}

// Response 200
{
  "authToken": "eyJ...",
  "user_id": 16,
  "external_user_id": "85ee5e8a-9a7f-4aaa-9328-67ee4fbe6b8c",
  "email": "user@example.com",
  "first_name": "Jordan",
  "last_name": "Smith",
  "verified": true,
  "membership_active": false,
  "membership_plan": null
}
```

> **Important:** Store `authToken`, `external_user_id`, and `membership_active` in app state/localStorage after login. `external_user_id` is the primary user identifier used in **all** subsequent API calls.

---

## 2. Core Genie

### 2.1 Guest Session

```
POST https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e/genie/guest_session
```

Create a guest session for anonymous users on first app open. Returns a `session_token` and `external_user_id` that persist until signup. Call this **before any Genie query** if user is not logged in.

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `channel` | string | Yes | Platform — `web`, `ios`, `android` |

```json
// Request
{ "channel": "web" }

// Response 200
{
  "session_token": "uuid-v4",
  "session_id": 96,
  "external_user_id": "uuid-v4",
  "is_guest": true
}
```

---

### 2.2 Handle Message (Core Genie Query)

```
POST https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e/genie/ep_handle_message_dev
```

The main Genie endpoint. Send any natural language query and receive ranked venue recommendations, AI fallback replies, and social profile prompt data. This powers the entire Genie chat interface.

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `message` | string | Yes | Natural language query e.g. `"brunch near me"` or `"rooftop happy hour downtown"` |
| `channel` | string | Yes | Platform — `web`, `ios`, `android` |
| `external_user_id` | string | Yes | From `guest_session` or login response |
| `session_token` | string | No | From `guest_session` or previous response — maintains continuity |
| `city_context` | string | No | e.g. `"Houston"` — speeds up city detection |
| `lat` | decimal | No | User latitude — required for near-me queries |
| `lng` | decimal | No | User longitude — required for near-me queries |
| `radius_meters` | int | No | Search radius in meters. Default: `2500` |
| `location_label` | string | No | Human-readable location label e.g. `"Midtown"` |
| `user_name` | string | No | User display name |

```json
// Standard city query
{
  "message": "brunch in Houston",
  "channel": "web",
  "external_user_id": "UUID",
  "session_token": "UUID",
  "city_context": "Houston"
}

// Near-me query
{
  "message": "happy hour near me",
  "channel": "web",
  "external_user_id": "UUID",
  "lat": 29.7604,
  "lng": -95.3698,
  "radius_meters": 3000
}

// Response 200
{
  "reply": "Found a few spots that match your vibe...",
  "top_venues": [ ...3 venue objects... ],
  "more_venues": [ ...up to 12 venue objects... ],
  "reply_mode": "has_results",
  "use_xano": true,
  "needs_location": false,
  "show_intake_prompt": false,
  "intake_prompt_copy": "",
  "profile_strength_tier": "getting_started",
  "session_id": 96,
  "session_token": "UUID",
  "filters": { "type": "brunch", "cuisine": null },
  "profile_prompt": null,
  "error": null
}
```

**`reply_mode` values:**

| Value | Meaning | Frontend action |
|-------|---------|----------------|
| `has_results` | DB-backed venues found | Show venue cards (`top_venues` + `more_venues`) |
| `supported_no_results` | City supported but no matches | Show Genie reply text, no cards |
| `city_missing` | No city detected | Ask user for their city |
| `city_unsupported` | City not in system yet | Show AI-generated text reply, no cards |
| `ai_fallback` | AI generated response | Show text reply only |

> **Important:** Check `show_intake_prompt` on every response. If `true`, show `intake_prompt_copy` as a bottom banner with a "Tell Genie →" CTA. Also track a signal via `/genie/track_signal` on every query submitted.

---

### 2.3 Venue Search

```
GET https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e/genie/vendor_search?query=QUERY&city=CITY
```

Quick venue name search for vendor onboarding claim flow. Returns matching venues from the City Graph inventory.

**Query params:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `query` | string | Yes | Search term — venue name or partial name |
| `city` | string | No | Filter by city e.g. `Houston` |

```json
// GET /genie/vendor_search?query=Bungalow&city=Houston

// Response 200
{
  "count": 1,
  "results": [
    {
      "id": 343,
      "venue_name": "Bungalow",
      "city": "Houston",
      "address": "2603 Bagby St",
      "area_neighborhood": "Midtown",
      "google_rating": 4.4
    }
  ]
}
```

---

## 3. Checkout

All checkout sessions are created via Xano and handled by Stripe. Webhooks auto-activate memberships on successful payment.

### 3.1 V.I.Bee Checkout

```
POST https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e/genie/checkout_vibee
```

Create a Stripe checkout session for V.I.Bee membership ($2.99/month). Redirects user to Stripe hosted checkout. Membership activates automatically via webhook on payment success.

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `external_user_id` | string | Yes | User UUID |
| `success_url` | string | Yes | Redirect after successful payment e.g. `https://genie.socialbevy.com/account?upgraded=true` |
| `cancel_url` | string | Yes | Redirect if user cancels e.g. `https://genie.socialbevy.com/account` |

```json
// Request
{
  "external_user_id": "UUID",
  "success_url": "https://genie.socialbevy.com/account?upgraded=true",
  "cancel_url": "https://genie.socialbevy.com/account/offers"
}

// Response 200
{
  "checkout_url": "https://checkout.stripe.com/c/pay/...",
  "session_id": "cs_live_..."
}
// → Redirect user to checkout_url
```

> **Important:** Check if user profile has `first_name`, `last_name`, `email` before calling. If any are missing, collect them first and save to user profile — Stripe requires an email address.

---

### 3.2 Vendor Plan Checkout

```
POST https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e/genie/checkout_vendor_plan
```

Create a Stripe checkout session for vendor plans. Supports `founding_partner` (subscription), `boost` (one-time, 3 tiers), and `monthly_boost` (subscription, Pro only).

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `vendor_id` | int | Yes | Vendor record ID |
| `plan_type` | string | Yes | `founding_partner` \| `boost` \| `monthly_boost` |
| `boost_tier` | string | Conditional | Required when `plan_type=boost`: `1999` \| `3999` \| `5999` |
| `success_url` | string | Yes | Redirect after payment |
| `cancel_url` | string | Yes | Redirect on cancel |

```json
// Founding Partner — $37/month
{ "vendor_id": 1, "plan_type": "founding_partner", "success_url": "...", "cancel_url": "..." }

// One-time Boost — $19.99
{ "vendor_id": 1, "plan_type": "boost", "boost_tier": "1999", "success_url": "...", "cancel_url": "..." }

// Monthly Boost — $29.99/month (Pro vendors only)
{ "vendor_id": 1, "plan_type": "monthly_boost", "success_url": "...", "cancel_url": "..." }

// Response 200
{
  "checkout_url": "https://checkout.stripe.com/c/pay/...",
  "session_id": "cs_live_...",
  "plan_type": "founding_partner",
  "mode": "subscription"
}

// Error 401 (monthly_boost for non-Pro vendor)
{ "message": "Monthly Boost is only available to Pro Genie Vendors." }
```

**Plan pricing:**

| Plan type | Stripe mode | Amount |
|-----------|-------------|--------|
| `founding_partner` | subscription | $37.00/month |
| `boost` (tier `1999`) | payment | $19.99 one-time |
| `boost` (tier `3999`) | payment | $39.99 one-time |
| `boost` (tier `5999`) | payment | $59.99 one-time |
| `monthly_boost` | subscription | $29.99/month |

---

## 4. Vendor

### 4.1 Vendor Onboarding

```
POST https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e/genie/vendor_onboarding_start
```

Multi-step vendor onboarding flow. Call with different `step` values to progress through the flow. All steps use the same endpoint.

**Steps and fields:**

| Step | Field | Type | Required | Description |
|------|-------|------|----------|-------------|
| `search` | `step` | string | Yes | `"search"` |
| `search` | `business_name` | string | Yes | Business name to search in City Graph |
| `contact` | `step` | string | Yes | `"contact"` |
| `contact` | `vendor_id` | int | Yes | From search response |
| `contact` | `onboarding_id` | int | Yes | From search response |
| `contact` | `first_name` | string | Yes | Owner first name |
| `contact` | `last_name` | string | Yes | Owner last name |
| `contact` | `email` | string | Yes | Owner email — required for Stripe checkout |
| `contact` | `phone` | string | No | Owner phone |
| `confirm` | `step` | string | Yes | `"confirm"` |
| `confirm` | `vendor_id` | int | Yes | From search response |
| `confirm` | `onboarding_id` | int | Yes | From search response |
| `confirm` | `confirmed` | bool | Yes | `true` to confirm the business match |

```json
// Step 1 — Search
{ "step": "search", "business_name": "The Breakfast Klub" }
// Response: { "vendor_id": 7, "onboarding_id": 7, "current_step": "contact", "matches": [...] }

// Step 2 — Contact info
{ "step": "contact", "vendor_id": 7, "onboarding_id": 7, "first_name": "Marcus", "last_name": "Williams", "email": "marcus@tbk.com", "phone": "7135550000" }

// Step 3 — Confirm
{ "step": "confirm", "vendor_id": 7, "onboarding_id": 7, "confirmed": true }
// Response: { "vendor_id": 7, "onboarding_id": 7, "current_step": "complete", "is_live": false, "plan_selected": null }
```

> Always use `vendor_id` from the response for subsequent steps — never hardcode. After `onboarding_start` completes, direct vendor to `checkout_vendor_plan` to select a plan.

---

### 4.2 Vendor Dashboard

```
GET https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e/genie/vendor_dashboard_v1?vendor_id=ID
```

Returns the full vendor dashboard. Response differs by plan tier — check `is_pro` to determine which data to show. Works for all vendors regardless of live status.

**Query params:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `vendor_id` | int | Yes | Vendor record ID |

```json
// Response 200 — Basic vendor (is_pro: false)
{
  "vendor_id": 1,
  "business_name": "The Breakfast Klub",
  "email": "owner@tbk.com",
  "plan_selected": "",
  "is_live": true,
  "is_pro": false,
  "onboarding_completed": true,
  "total_genie_appearances": 142,
  "total_profile_views": 38,
  "total_actions": 22,
  "total_call_clicks": 8,
  "total_map_clicks": 11,
  "total_saves": 3,
  "engagement_rate": 0.155,
  "neighborhood_reach": { "Midtown": 18, "Downtown": 9 },
  "top_query_triggers": { "brunch": 52, "breakfast": 31 }
}

// Additional fields for Pro vendors (is_pro: true)
{
  "is_pro": true,
  "total_reservation_clicks": 5,
  "monthly_boost_active": true,
  "monthly_boost_started_at": 1775842511030,
  "offers": [ ...array of offer objects... ],
  "offer_count": 9,
  "top_redeemed_offer": { "id": 3, "title": "V.I.Bee Happy Hour 20% Off" },
  "recent_redemptions": [ ...last 10 redemptions... ],
  "redemption_total": 34
}
```

**Dashboard fields by tier:**

| Field | Tier | Description |
|-------|------|-------------|
| `is_pro` | Both | `true` = Pro vendor — use to switch dashboard view |
| `total_genie_appearances` | Both | Times shown in Genie results |
| `total_profile_views` | Both | Times venue detail page opened |
| `total_actions` | Both | Sum of all customer interactions |
| `total_call_clicks` | Both | Taps on Call button |
| `total_map_clicks` | Both | Taps on Get Directions |
| `total_saves` | Both | Times saved by users |
| `engagement_rate` | Both | `total_actions / genie_appearances` |
| `neighborhood_reach` | Both | JSON — which neighborhoods users come from |
| `top_query_triggers` | Both | JSON — what searches surface this venue |
| `total_reservation_clicks` | Pro only | Taps on Reservations button |
| `offers` | Pro only | Array of active offer objects |
| `top_redeemed_offer` | Pro only | Offer with most redemptions |
| `recent_redemptions` | Pro only | Last 10 redemptions with verification status |
| `monthly_boost_active` | Pro only | `true` if Monthly Boost is currently active |

---

### 4.3 Create Offer

```
POST https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e/genie/vendor_create_offer
```

Create a V.I.Bee exclusive offer. **Pro vendors (`founding_partner`) only.** Returns `offer_id` on success.

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `vendor_id` | int | Yes | Vendor record ID — must be `founding_partner` |
| `title` | string | Yes | Offer title e.g. `"V.I.Bee Happy Hour 20% Off All Drinks"` |
| `offer_type` | string | Yes | See offer types table below |
| `description` | string | No | Full offer description |
| `discount_value` | string | No | e.g. `"20% off"` or `"$10 off"` |
| `redeem_instructions` | string | No | What to say/do when redeeming |
| `link_url` | string | No | Optional link for more info |
| `redemption_limit` | int | No | Max redemptions allowed. `0` = unlimited |
| `vibee_only` | bool | No | `true` = V.I.Bee members only (default `true`) |

```json
// Request
{
  "vendor_id": 1,
  "title": "V.I.Bee Happy Hour — 20% Off All Drinks",
  "offer_type": "happy_hour",
  "description": "Show your QR code to your server during happy hour.",
  "discount_value": "20% off",
  "redeem_instructions": "Show QR code to server between 3–7pm",
  "redemption_limit": 100,
  "vibee_only": true
}

// Response 200
{ "success": true, "offer_id": 14 }

// Error 403 (non-Pro vendor)
{ "message": "Only Founding Partner vendors can create offers." }
```

**Offer types:**

| `offer_type` | Display label | Color |
|--------------|---------------|-------|
| `happy_hour` | Happy Hour | `#FF6B35` orange |
| `brunch` | Brunch | `#F9A825` yellow |
| `perk` | Perk | `#4CAF50` green |
| `weekly_special` | Weekly Special | `#795548` brown |
| `drink_special` | Drink Special | `#9C27B0` purple |
| `food_special` | Food Special | `#2196F3` blue |
| `event_access` | Event Access | `#FF5722` deep orange |
| `vip_only` | VIP Only | `#E91E63` pink |
| `limited_time` | Limited Time | `#FF9800` amber |
| `experience` | Experience | `#00BCD4` cyan |
| `group_offer` | Group Offer | `#8BC34A` light green |
| `late_night` | Late Night | `#37474F` dark gray |
| `other` | Other | `#9E9E9E` gray |

---

## 5. Offers & Redemption

### 5.1 Get V.I.Bee Offers

```
GET https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e/genie/vibee_offers?external_user_id=UUID
```

Returns all active V.I.Bee offers available to the user. **V.I.Bee members only** — returns `403` for free users. Use `offer_count` to show a badge on the Offers tab.

**Query params:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `external_user_id` | string | Yes | User UUID — must have `membership_active = true` |

```json
// Response 200
{
  "offers": [
    {
      "id": 3,
      "title": "V.I.Bee Happy Hour — 20% Off",
      "offer_type": "happy_hour",
      "description": "Show QR to server 3–7pm",
      "discount_value": "20% off",
      "redeem_instructions": "Show QR to server",
      "vendor_id": 1,
      "active": true,
      "redemption_count": 34,
      "redemption_limit": 100,
      "vibee_only": true
    }
  ],
  "offer_count": 13
}

// Error 403 (free user)
{ "message": "V.I.Bee membership required." }
```

---

### 5.2 Redeem Offer

```
POST https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e/genie/redeem_offer
```

Redeem an offer. Creates a one-time token and generates a QR verification URL. Can only be redeemed once per user per offer — backend blocks duplicates. Returns `verify_url` which is what the QR code should encode.

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `external_user_id` | string | Yes | User UUID — must be V.I.Bee member |
| `offer_id` | int | Yes | Offer to redeem |

```json
// Request
{ "external_user_id": "UUID", "offer_id": 3 }

// Response 200
{
  "success": true,
  "redemption_token": "4d78fe06-36d6-4566-b9c0-8d4ea0bb478a",
  "offer_title": "V.I.Bee Happy Hour — 20% Off",
  "redeemed_at": 1775863227506,
  "verify_url": "https://genie.socialbevy.com/verify/4d78fe06-..."
}

// Error 403 (not V.I.Bee member)
{ "message": "User must be a V.I.Bee member to redeem offers." }

// Error 400 (already redeemed)
{ "message": "You have already redeemed this offer." }
```

> **QR code:** Encode the full `verify_url` string. Use `qrcode.react`: `<QRCode value={verify_url} size={240} />`. Show QR for 24 hours from `redeemed_at`. After 24 hours show expired state.

---

### 5.3 Verify Redemption (Public — No Auth)

```
GET https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e/genie/verify_redemption?redemption_token=TOKEN
```

**PUBLIC endpoint — no authentication required.** Called when staff scans the QR code. Auto-marks the redemption as staff-verified on page load. No tap needed. Show success state immediately.

**Query params:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `redemption_token` | string | Yes | UUID token from QR code |

```json
// Response 200 (valid)
{
  "valid": true,
  "offer_title": "V.I.Bee Happy Hour — 20% Off",
  "redeemed_at": 1775863227506,
  "verified_at": 1775863290000,
  "member_name": "Jordan Smith",
  "vendor_id": 1
}

// Error 404 (invalid token)
{ "message": "Redemption not found." }
```

**Frontend behavior:**

| Condition | UI |
|-----------|----|
| `valid: true`, fresh verify | Show large green checkmark + "Valid Redemption" + offer title + member name |
| `valid: true`, already verified (`redeemed_at ≈ verified_at`) | Show blue "Already Verified" + original `verified_at` timestamp |
| 404 error | Show red X + "Invalid Code" |

---

### 5.4 User Redemption History

```
GET https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e/genie/user_redemptions?external_user_id=UUID
```

Returns all redemptions for a user sorted by most recent first.

```json
// Response 200
{
  "redemptions": [
    {
      "id": 5,
      "offer_id": 3,
      "vendor_id": 1,
      "redemption_token": "4d78fe06-...",
      "redeemed_at": 1775863227506,
      "verified_by_staff": true,
      "verified_at": 1775863290000
    }
  ],
  "redemption_count": 1
}
```

> Check `(Date.now() - redeemed_at) < 86400000` to determine if QR re-show is allowed. Within 24 hours → show QR screen. After 24 hours → show expired state.

---

## 6. Push Notifications

Powered by OneSignal. **App ID:** `2b0988a9-9a1e-4039-9131-e4859ea641e2`

### 6.1 Register Push Token

```
POST https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e/genie/register_push_token
```

Register a user's OneSignal player ID for push notifications. Call after user grants notification permission.

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `external_user_id` | string | Yes | User UUID |
| `onesignal_player_id` | string | Yes | Player ID from OneSignal SDK |
| `channel` | string | Yes | `web` \| `ios` \| `android` |

```json
// Request
{ "external_user_id": "UUID", "onesignal_player_id": "UUID_FROM_ONESIGNAL", "channel": "web" }

// Response 200
{ "success": true, "message": "Push token registered successfully" }
```

---

### 6.2 Send Notification

```
POST https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e/genie/send_notification
```

Send a push notification to a specific user. Used by admin manual broadcast and scheduled tasks.

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `user_id` | int | Yes | Internal `user_id` (not `external_user_id`) |
| `notification_type` | string | Yes | `vibe_check` \| `whats_hot` \| `personalized` |
| `title` | string | Yes | Notification title |
| `message` | string | Yes | Notification body text |

```json
// Request
{ "user_id": 16, "notification_type": "vibe_check", "title": "What's the move tonight?", "message": "Ask Genie for the best spots near you." }

// Response 200
{ "success": true, "notification_id": 11 }
```

---

### 6.3 Notification Opened

```
POST https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e/genie/notification_opened
```

Mark a notification as opened. Call from the OneSignal `notificationOpened` handler.

```json
// Request
{ "notification_id": 11 }

// Response 200
{ "success": true, "notification_id": 11 }
```

---

## 7. Social Learning

Six endpoints that power Genie's personalization engine. Genie learns from device signals before signup and merges into the account profile on signup.

### 7.1 Initialize Device

```
POST https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e/genie/init_device
```

Create or retrieve a social profile for the device. **Call on every app open — idempotent.** If a profile exists returns it; if not, creates one. Pass `external_user_id` when user is logged in to keep profile linked.

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `device_id` | string | Yes | UUID from localStorage — persist across sessions |
| `external_user_id` | string | No | Pass when user is logged in — links profile to account |
| `session_id` | string | No | Current session ID |

```javascript
// Generate and store device_id in localStorage (run once):
function getOrCreateDeviceId() {
  const key = "genie_device_id"
  let id = localStorage.getItem(key)
  if (!id) { id = crypto.randomUUID(); localStorage.setItem(key, id) }
  return id
}
```

```json
// Request
{ "device_id": "UUID_FROM_LOCALSTORAGE", "external_user_id": "USER_UUID_OR_NULL" }

// Response 200
{
  "profile_id": 1,
  "device_id": "UUID",
  "external_user_id": "USER_UUID_OR_NULL",
  "intake_completed": false,
  "intake_shown_count": 0,
  "signal_count": 0,
  "is_new": true
}
```

---

### 7.2 Get Social Profile

```
GET https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e/genie/get_social_profile
```

Retrieve the full social profile to pre-populate the Social Preferences intake screen. Query by `device_id` or `external_user_id`.

**Query params:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `device_id` | string | Conditional | Device UUID — use if no account |
| `external_user_id` | string | Conditional | User UUID — takes priority over `device_id` |

```json
// GET /genie/get_social_profile?device_id=UUID
// or: GET /genie/get_social_profile?external_user_id=UUID

// Response 200
{
  "profile_id": 1,
  "device_id": "UUID",
  "external_user_id": "UUID_OR_NULL",
  "experiences_tags": ["Brunch", "Happy Hour", "Live Band"],
  "atmosphere_tags": ["Rooftop", "Patio", "Live DJ"],
  "bevy_bites_tags": ["Soul Food", "Seafood", "Signature Cocktails"],
  "community_tags": ["Black-Owned", "LGBTQ+ Friendly"],
  "music_tags": ["R&B / Soul", "Hip-Hop / Rap", "AfroBeats"],
  "price_range": "Mid-Range",
  "group_size": "small_group",
  "typical_time": "evening",
  "intake_completed": true,
  "intake_shown_count": 1,
  "signal_count": 12,
  "last_updated_at": 1775863227506
}

// Error 404
{ "message": "Profile not found." }
```

---

### 7.3 Update Social Profile

```
POST https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e/genie/update_social_profile
```

Save Social Preferences intake selections. **Partial update** — only fields provided are updated. Existing values preserved for fields not sent. Sets `intake_completed = true` on save.

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `device_id` | string | Conditional | Device UUID — use if not logged in |
| `external_user_id` | string | Conditional | User UUID — use if logged in |
| `experiences_tags` | array | No | Array of selected experience tags |
| `atmosphere_tags` | array | No | Array of selected atmosphere tags |
| `bevy_bites_tags` | array | No | Array of selected cuisine/drink tags |
| `community_tags` | array | No | Array of selected community tags |
| `music_tags` | array | No | Array of selected music genre tags |
| `price_range` | string | No | `Budget-Friendly` \| `Mid-Range` \| `Upscale` \| `Luxury` |
| `group_size` | string | No | `solo` \| `couple` \| `small_group` \| `large_group` |
| `typical_time` | string | No | `afternoon` \| `evening` \| `late_night` \| `weekend_brunch` |

```json
// Request
{
  "device_id": "UUID",
  "experiences_tags": ["Brunch", "Happy Hour", "Day Party"],
  "atmosphere_tags": ["Rooftop", "Patio", "Live DJ"],
  "bevy_bites_tags": ["Soul Food", "Seafood", "Signature Cocktails"],
  "community_tags": ["Black-Owned", "Free Parking"],
  "music_tags": ["R&B / Soul", "Hip-Hop / Rap", "AfroBeats"],
  "price_range": "Mid-Range",
  "group_size": "small_group",
  "typical_time": "evening"
}

// Response 200
{ "success": true, "profile_id": 1, "intake_completed": true, ...all updated fields... }
```

---

### 7.4 Track Signal

```
POST https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e/genie/track_signal
```

Log a behavioral signal. **Call on every meaningful user action.** Increments `signal_count` on the social profile. Derives `time_of_day` and `day_of_week` automatically from server time.

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `device_id` | string | Yes | Device UUID |
| `external_user_id` | string | No | User UUID if logged in |
| `signal_type` | string | Yes | `query` \| `venue_tap` \| `venue_save` \| `offer_view` \| `offer_redeem` \| `more_nearby_tap` |
| `signal_value` | string | Yes | Query text, `venue_id`, `offer_id`, etc. |
| `category_tags` | array | No | Tags associated with this signal e.g. `["Brunch","Soul Food","Black-Owned"]` |
| `city` | string | No | City context e.g. `"Houston"` |
| `neighborhood` | string | No | Neighborhood if known e.g. `"Midtown"` |
| `session_id` | string | No | Current session ID |

```json
// Query signal
{ "device_id": "UUID", "signal_type": "query", "signal_value": "brunch near me", "category_tags": ["Brunch", "Experiences"], "city": "Houston" }

// Venue tap signal
{ "device_id": "UUID", "signal_type": "venue_tap", "signal_value": "343", "category_tags": ["Brunch", "Soul Food", "Black-Owned"], "city": "Houston", "neighborhood": "Midtown" }

// Response 200
{
  "success": true,
  "signal_id": 14,
  "signal_type": "query",
  "signal_value": "brunch near me",
  "time_of_day": "afternoon",
  "day_of_week": "Saturday",
  "signal_count": 5
}
```

---

### 7.5 Merge Guest Profile

```
POST https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e/genie/merge_guest_profile
```

Called **immediately after successful user signup.** Links the anonymous device profile (and all behavioral signals) to the new account. Everything the user did as a guest is preserved.

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `device_id` | string | Yes | Device UUID from localStorage |
| `external_user_id` | string | Yes | New user UUID from signup response |

```json
// Request
{ "device_id": "UUID_FROM_LOCALSTORAGE", "external_user_id": "UUID_FROM_SIGNUP" }

// Response 200
{
  "success": true,
  "profile_id": 1,
  "device_id": "UUID",
  "external_user_id": "UUID",
  "signals_merged": 7,
  "intake_completed": false,
  "signal_count": 7
}

// Error 404 (no guest profile)
{ "message": "No guest profile found for this device." }
// Handle 404 gracefully — means device was never initialized before signup.
```

---

### 7.6 Get Profile Strength

```
GET https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e/genie/get_profile_strength?device_id=UUID
```

Returns signal strength, completeness score, and whether the intake prompt should be shown. **Prefer using the `show_intake_prompt` field from the `handle_message` response** instead of calling this separately.

```json
// Response 200
{
  "profile_id": 1,
  "signal_count": 5,
  "intake_completed": false,
  "intake_shown_count": 1,
  "completeness_score": 60,
  "strength_tier": "learning",
  "show_prompt": true,
  "prompt_copy": "Genie's learning what you like..."
}
```

**Strength tiers:**

| `strength_tier` | Signal count | Personalization level |
|-----------------|-------------|----------------------|
| `new` | 0–1 | None — standard ranking |
| `getting_started` | 2–4 | Light — profile bonus scoring active |
| `learning` | 5–9 | Moderate — behavioral patterns emerging |
| `strong` | 10+ | Full — behavior 70% + explicit prefs 30% |

---

## 8. Stripe Webhooks

These endpoints are called by Stripe — **not by your frontend.** Register them in Stripe Dashboard → Developers → Webhooks.

### 8.1 V.I.Bee Webhook

```
POST https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e/stripe/webhook
```

Handles `checkout.session.completed` for V.I.Bee subscriptions. Sets `membership_active = true` and `membership_plan = "vibee"` on the `genie_user` record.

```
Event: checkout.session.completed
Stripe metadata required: { external_user_id: "UUID" }

Effect on success:
  genie_user.membership_active = true
  genie_user.membership_plan = "vibee"
  genie_user.membership_started_at = now
```

---

### 8.2 Vendor Webhook

```
POST https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e/stripe/vendor_webhook
```

Handles `checkout.session.completed` for all vendor plans. `founding_partner` and `boost` set `plan_selected`. `monthly_boost` sets `monthly_boost_active = true` WITHOUT overwriting an existing `founding_partner` plan.

```
Event: checkout.session.completed
Stripe metadata required: { vendor_id: "1", plan_type: "founding_partner" }

Effect by plan_type:
  founding_partner → plan_selected = "founding_partner", is_live = true
  boost           → plan_selected = "boost", is_live = true
                    (does NOT downgrade founding_partner vendors)
  monthly_boost   → monthly_boost_active = true, monthly_boost_started_at = now
                    (does NOT touch plan_selected)
```

---

## 9. Admin

Internal operations endpoints for `admin.socialbevy.com`. No auth currently — add API key header before public exposure.

### 9.1 Admin Overview — KPI Dashboard

```
GET https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e/genie/admin_overview
```

Returns all platform KPIs in a single call. Auto-refreshes every 60 seconds on the admin portal.

```json
// Response 200
{
  "total_users": 34,
  "vibee_members": 1,
  "vibee_conversion_rate": 0.029,
  "total_vendors": 61,
  "pro_vendors": 1,
  "pro_vendor_conversion_rate": 0.016,
  "monthly_boost_vendors": 0,
  "active_offers": 13,
  "total_redemptions": 5,
  "verified_redemptions": 3,
  "active_push_tokens": 1,
  "total_notifications_sent": 11,
  "notifications_opened": 1,
  "notification_open_rate": 0.091,
  "vibee_mrr": 2.99,
  "pro_vendor_mrr": 37.00,
  "monthly_boost_mrr": 0.00,
  "total_mrr": 39.99
}
```

---

### 9.2 Admin Users List

```
GET https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e/genie/admin_users
```

Paginated user list with optional filters.

**Query params:**

| Param | Type | Description |
|-------|------|-------------|
| `membership_filter` | string | `"vibee"` to show only V.I.Bee members |
| `search_email` | string | Email search (partial match) |
| `page` | int | Page number. Default: `1` |
| `per_page` | int | Results per page. Default: `25` |

```json
// Response 200
{ "items": [...user objects...], "total": 5, "per_page": 25, "cur_page": 1, "next_page": null }
```

---

### 9.3 Admin Update User Membership

```
PATCH https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e/genie/admin_user_membership
```

Manually activate or deactivate a user's V.I.Bee membership.

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `external_user_id` | string | Yes | User UUID |
| `membership_active` | bool | Yes | `true` to activate, `false` to deactivate |
| `membership_plan` | string | No | `"vibee"` when activating |

```json
// Request
{ "external_user_id": "UUID", "membership_active": true, "membership_plan": "vibee" }

// Response 200
{ "success": true, "external_user_id": "UUID", "membership_active": true, "membership_plan": "vibee" }

// Error 404
{ "message": "User not found." }
```

---

### 9.4 Admin Vendors List

```
GET https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e/genie/admin_vendors
```

**Query params:**

| Param | Type | Description |
|-------|------|-------------|
| `plan_filter` | string | Filter by plan: `founding_partner` \| `boost` \| `monthly_boost` \| `basic` |
| `is_live_filter` | bool | `true` to show only live vendors |
| `page` / `per_page` | int | Pagination. Default `per_page`: 25 |

```json
// Response 200
{ "items": [...], "itemsReceived": 61, "curPage": 1, "nextPage": 2 }
```

---

### 9.5 Admin Update Vendor Status

```
PATCH https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e/genie/admin_vendor_status
```

Update vendor live status, plan, or boost status. **Pass boolean fields as strings `"true"` or `"false"`.**

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `vendor_id` | int | Yes | Vendor record ID |
| `is_live` | string | No | `"true"` or `"false"` |
| `plan_selected` | string | No | `founding_partner` \| `boost` \| `basic` |
| `monthly_boost_active` | string | No | `"true"` or `"false"` |

```json
// Request
{ "vendor_id": 1, "is_live": "true", "plan_selected": "founding_partner" }

// Response 200
{ "success": true, "vendor_id": 1, "is_live": true, "plan_selected": "founding_partner", "monthly_boost_active": false }
```

---

### 9.6 Admin Offers List

```
GET https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e/genie/admin_offers
```

**Query params:** `vendor_id` (int), `active_filter` (bool), `page` / `per_page` (int)

```json
// Response 200
{ "items": [...offer objects...], "itemsReceived": 13, "curPage": 1, "nextPage": null }
```

---

### 9.7 Admin Update Offer Status

```
PATCH https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e/genie/admin_offer_status
```

Activate or deactivate an offer. **Pass `active` as string `"true"` or `"false"`.**

```json
// Request
{ "offer_id": 3, "active": "false" }

// Response 200
{ "success": true, "offer_id": 3, "active": false }

// Error 404
{ "message": "Offer not found." }
```

---

### 9.8 Admin Redemptions List

```
GET https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e/genie/admin_redemptions
```

**Query params:** `vendor_id` (int), `verified_filter` (bool), `page` / `per_page` (int, sorted by `redeemed_at` desc)

```json
// Response 200
{ "items": [...redemption objects...], "itemsReceived": 5, "curPage": 1, "nextPage": null }
```

---

### 9.9 Admin Venues List

```
GET https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e/genie/admin_venues
```

Venue inventory with health data.

**Query params:**

| Param | Type | Description |
|-------|------|-------------|
| `city` | string | Filter by city: `Houston` \| `Pearland` \| `Sugar Land` \| `The Woodlands` \| `Cypress` \| `Katy` |
| `page` / `per_page` | int | Pagination. Default `per_page`: 25 |

```json
// Response 200
{
  "items": [
    {
      "id": 343,
      "venue_name": "The Breakfast Klub",
      "city": "Houston",
      "address": "3711 Travis St",
      "area_neighborhood": "Midtown",
      "meal_services": { "brunch": true },
      "cuisine_tags": ["soul_food", "southern"],
      "reservation_url": null,
      "google_rating": 4.8,
      "google_business_status": "OPERATIONAL"
    }
  ],
  "itemsReceived": 25,
  "curPage": 1,
  "nextPage": 2
}
```

---

### 9.10 Admin System Settings

```
PATCH https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e/genie/admin_system_settings
```

Toggle system kill switches. Controls scheduled tasks and backfill jobs.

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `setting_key` | string | Yes | See table below |
| `setting_value` | string | Yes | `"true"` or `"false"` |

**Setting keys:**

| `setting_key` | Effect when `"true"` | Effect when `"false"` |
|---------------|---------------------|----------------------|
| `vibe_check_enabled` | Vibe Check notifications fire Fridays 3pm CST | Vibe Check paused |
| `whats_hot_enabled` | What's Hot fires Wednesdays 6pm CST | What's Hot paused |
| `genie_backfill_enabled` | Google Places enrichment runs | Place details backfill paused |
| `genie_derived_backfill_enabled` | Patio/hookah/price enrichment runs | Derived backfill paused |
| `genie_cuisine_backfill_enabled` | Cuisine tag enrichment runs | Cuisine backfill paused |

```json
// Request
{ "setting_key": "vibe_check_enabled", "setting_value": "false" }

// Response 200
{ "success": true, "setting_key": "vibe_check_enabled", "setting_value": "false" }

// Error 404
{ "message": "Setting not found." }
```

---

## 10. Quick Reference — All 35 Endpoints

| # | Method | Endpoint | Section |
|---|--------|----------|---------|
| 1 | POST | `.../api:dRDS80y8/auth/verify_email/signup` | 1.1 Auth |
| 2 | POST | `.../api:dRDS80y8/auth/verify_email/magic_login` | 1.2 Auth |
| 3 | POST | `.../api:pgMKWi2e/genie/guest_session` | 2.1 Core |
| 4 | POST | `.../api:pgMKWi2e/genie/ep_handle_message_dev` | 2.2 Core |
| 5 | GET | `.../api:pgMKWi2e/genie/vendor_search` | 2.3 Core |
| 6 | POST | `.../api:pgMKWi2e/genie/checkout_vibee` | 3.1 Checkout |
| 7 | POST | `.../api:pgMKWi2e/genie/checkout_vendor_plan` | 3.2 Checkout |
| 8 | POST | `.../api:pgMKWi2e/genie/vendor_onboarding_start` | 4.1 Vendor |
| 9 | GET | `.../api:pgMKWi2e/genie/vendor_dashboard_v1` | 4.2 Vendor |
| 10 | POST | `.../api:pgMKWi2e/genie/vendor_create_offer` | 4.3 Vendor |
| 11 | GET | `.../api:pgMKWi2e/genie/vibee_offers` | 5.1 Offers |
| 12 | POST | `.../api:pgMKWi2e/genie/redeem_offer` | 5.2 Offers |
| 13 | GET | `.../api:pgMKWi2e/genie/verify_redemption` | 5.3 Offers |
| 14 | GET | `.../api:pgMKWi2e/genie/user_redemptions` | 5.4 Offers |
| 15 | POST | `.../api:pgMKWi2e/genie/register_push_token` | 6.1 Push |
| 16 | POST | `.../api:pgMKWi2e/genie/send_notification` | 6.2 Push |
| 17 | POST | `.../api:pgMKWi2e/genie/notification_opened` | 6.3 Push |
| 18 | POST | `.../api:pgMKWi2e/genie/init_device` | 7.1 Social |
| 19 | GET | `.../api:pgMKWi2e/genie/get_social_profile` | 7.2 Social |
| 20 | POST | `.../api:pgMKWi2e/genie/update_social_profile` | 7.3 Social |
| 21 | POST | `.../api:pgMKWi2e/genie/track_signal` | 7.4 Social |
| 22 | POST | `.../api:pgMKWi2e/genie/merge_guest_profile` | 7.5 Social |
| 23 | GET | `.../api:pgMKWi2e/genie/get_profile_strength` | 7.6 Social |
| 24 | POST | `.../api:pgMKWi2e/stripe/webhook` | 8.1 Webhooks |
| 25 | POST | `.../api:pgMKWi2e/stripe/vendor_webhook` | 8.2 Webhooks |
| 26 | GET | `.../api:pgMKWi2e/genie/admin_overview` | 9.1 Admin |
| 27 | GET | `.../api:pgMKWi2e/genie/admin_users` | 9.2 Admin |
| 28 | PATCH | `.../api:pgMKWi2e/genie/admin_user_membership` | 9.3 Admin |
| 29 | GET | `.../api:pgMKWi2e/genie/admin_vendors` | 9.4 Admin |
| 30 | PATCH | `.../api:pgMKWi2e/genie/admin_vendor_status` | 9.5 Admin |
| 31 | GET | `.../api:pgMKWi2e/genie/admin_offers` | 9.6 Admin |
| 32 | PATCH | `.../api:pgMKWi2e/genie/admin_offer_status` | 9.7 Admin |
| 33 | GET | `.../api:pgMKWi2e/genie/admin_redemptions` | 9.8 Admin |
| 34 | GET | `.../api:pgMKWi2e/genie/admin_venues` | 9.9 Admin |
| 35 | PATCH | `.../api:pgMKWi2e/genie/admin_system_settings` | 9.10 Admin |

> Base URL for all `pgMKWi2e` endpoints: `https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e`  
> Base URL for all `dRDS80y8` endpoints: `https://xwpg-kuah-brlj.n7d.xano.io/api:dRDS80y8`

---

## 11. Error Codes

| HTTP Status | `error_type` | When it occurs |
|-------------|-------------|----------------|
| 400 | `inputerror` | Invalid or missing input field value |
| 401 | `unauthorized` | Action requires higher privileges (e.g. Monthly Boost without Pro plan) |
| 403 | `accessdenied` | Membership required (V.I.Bee offers) or already redeemed |
| 404 | `notfound` | Record not found — user, vendor, offer, token, profile, setting |
| 500 | `ERROR_FATAL` | Backend logic error — check Xano logs |

---

## 12. Environment Variables

All stored in Xano Settings → Environment Variables.

| Variable | Description |
|----------|-------------|
| `stripe_api_secret` | Stripe live secret key — `sk_live_...` |
| `stripe_price_vibee` | V.I.Bee subscription price ID — `price_1TH7mB...` |
| `stripe_price_founding_partner` | Pro vendor subscription price ID — `price_1TICc9...` |
| `stripe_price_boost_1999` | One-time boost $19.99 price ID |
| `stripe_price_boost_3999` | One-time boost $39.99 price ID |
| `stripe_price_boost_5999` | One-time boost $59.99 price ID |
| `stripe_price_monthly_boost` | Monthly Boost subscription price ID — `price_1TKhDa...` |
| `stripe_webhook_secret` | V.I.Bee webhook signing secret |
| `stripe_vendor_webhook_secret` | Vendor webhook signing secret |
| `onesignal_app_id` | `2b0988a9-9a1e-4039-9131-e4859ea641e2` |
| `onesignal_api_key` | OneSignal REST API key |
| `magic_jwt_secret` | JWT signing secret for magic links |
| `magic_link_redirect_uri` | `https://genie.socialbevy.com` |
| `sendgrid_api_key` | SendGrid API key for email delivery |
| `sendgrid_magic_link_template` | SendGrid template ID for magic link emails |
| `verify_offer_base_url` | `https://genie.socialbevy.com/verify/` |
| `genie_base_url` | `https://genie.socialbevy.com` |
| `ADMIN_SECRET` | Admin portal password (Vercel env var — not Xano) |

---

## 13. Frontend Integration Guide

### 13.1 App Launch Sequence

```javascript
// On every app open:
1. getOrCreateDeviceId()              // localStorage
2. POST /genie/guest_session          // if not logged in
   // OR
   Restore authToken from storage    // if logged in
3. POST /genie/init_device            // always — links device to account if logged in

// On first login/signup:
4. POST /auth/verify_email/signup     // send magic link
5. [user clicks email link]
6. POST /auth/verify_email/magic_login  // exchange token → authToken
7. POST /genie/merge_guest_profile    // link device history to account
8. Store authToken + external_user_id in app state
```

---

### 13.2 Genie Query Sequence

```javascript
// On every query submit:
1. POST /genie/ep_handle_message_dev
2. POST /genie/track_signal (signal_type: "query")
3. Check response.show_intake_prompt → show banner if true
4. Check response.reply_mode:
   "has_results"          → show top_venues cards + more_venues
   "supported_no_results" → show reply text only
   "city_missing"         → ask for city
   "city_unsupported"     → show AI text reply

// On venue card tap:
5. Navigate to venue detail screen
6. POST /genie/track_signal (signal_type: "venue_tap", signal_value: venue.id)
```

---

### 13.3 V.I.Bee Upgrade Flow

```javascript
// Free user taps "Upgrade Now":
1. Check user profile for first_name, last_name, email
2a. If all present → POST /genie/checkout_vibee → redirect to checkout_url
2b. If any missing → show quick form to collect → save → POST /genie/checkout_vibee

// After Stripe redirects to success_url:
3. Check for ?upgraded=true in URL
4. Re-fetch user profile (membership_active should now be true)
5. Show success toast "Welcome to V.I.Bee!"
6. Remove ?upgraded=true from URL without page reload
```

---

### 13.4 Social Preferences Intake Flow

```javascript
// When show_intake_prompt is true in Genie response:
1. Show bottom banner with intake_prompt_copy text
2. User taps "Tell Genie →" → open intake screen

// Intake screen load:
3. GET /genie/get_social_profile?device_id=DEVICE_ID
4. Pre-populate selections from existing profile

// User selects tags and taps Save:
5. POST /genie/update_social_profile with all selections
6. Show success toast "Genie knows you better now!"
7. Navigate back + optionally trigger fresh Genie query
```

---

### 13.5 Xano Known Gotchas

| Issue | Cause | Fix |
|-------|-------|-----|
| `db.query {type:"single"}` returns `{}` not `null` | Xano external behavior | Use list of 1 + `items[0]` + `\|get:"id":0` check |
| Optional bool input `false` treated as null | Xano null coalescing | Declare as `text?`, pass `"true"`/`"false"` strings |
| `function.run ""` empty string error | Logic Assistant generates broken calls | Always verify and fix function path manually |
| `external_user_id` lookup fails despite correct where clause | Optional `text?` input null handling | Use `device_id` as primary lookup; pass both when available |
| Array fields return `{}` instead of `[]` | Xano JSON field storage | Use `Object.values()` or `Array.isArray()` check on frontend |
| `\|sort` and `\|first` chain on empty array crashes | Xano pipeline on null | Use `items[0]` with `\|get:"id":0` safe fallback |

---

*Social Bevy / Genie — Complete API Reference v8.0 — April 2026 — 35 Endpoints — All Confirmed Working — Confidential*
